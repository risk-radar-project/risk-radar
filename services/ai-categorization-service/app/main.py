"""FastAPI service exposing the categorization model as an HTTP API.

The service loads the persisted scikit-learn pipeline and label encoder, exposes
prediction endpoints, and forwards every operational event to the audit-log
service (with Kafka as the primary transport and HTTP as a fallback).
"""

from __future__ import annotations

import asyncio
import json
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from aiokafka import AIOKafkaProducer
from fastapi import FastAPI, HTTPException, status
import httpx
from pydantic import BaseModel, Field, conlist
from pydantic_settings import BaseSettings


class ServiceSettings(BaseSettings):
    """Centralized configuration sourced from environment variables."""

    service_name: str = Field(default="ai-categorization-service", alias="SERVICE_NAME")
    model_pipeline_path: Path = Field(
        default=Path("model_data/best_model_pipeline.pkl"), alias="MODEL_PIPELINE_PATH"
    )
    label_encoder_path: Path = Field(
        default=Path("model_data/label_encoder.pkl"), alias="LABEL_ENCODER_PATH"
    )
    max_batch_size: int = Field(default=32, alias="MAX_BATCH_SIZE")

    kafka_brokers: str = Field(default="kafka:9092", alias="KAFKA_BROKERS")
    audit_topic: str = Field(default="audit_logs", alias="AUDIT_KAFKA_TOPIC")
    audit_kafka_enabled: bool = Field(default=True, alias="AUDIT_KAFKA_ENABLED")
    audit_client_id: str = Field(default="ai-categorization-service", alias="AUDIT_KAFKA_CLIENT_ID")
    kafka_timeout_seconds: int = Field(default=5, alias="KAFKA_TIMEOUT_SECONDS")

    audit_service_url: str = Field(default="http://audit-log-service:8080", alias="AUDIT_SERVICE_URL")
    audit_service_timeout: int = Field(default=3, alias="AUDIT_SERVICE_TIMEOUT_SECONDS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        populate_by_name = True


settings = ServiceSettings()


class AuditClient:
    """Sends service events to Kafka (primary) with HTTP fallback to audit-log."""

    def __init__(self, config: ServiceSettings) -> None:
        self._config = config
        self._kafka_producer: Optional[AIOKafkaProducer] = None
        self._http_client: Optional[httpx.AsyncClient] = None

    async def start(self) -> None:
        self._http_client = httpx.AsyncClient(
            base_url=self._config.audit_service_url,
            timeout=self._config.audit_service_timeout,
        )

        if self._config.audit_kafka_enabled:
            self._kafka_producer = AIOKafkaProducer(
                bootstrap_servers=[broker.strip() for broker in self._config.kafka_brokers.split(",") if broker.strip()],
                value_serializer=lambda value: json.dumps(value).encode("utf-8"),
                client_id=self._config.audit_client_id,
            )
            await self._kafka_producer.start()

    async def stop(self) -> None:
        if self._kafka_producer:
            await self._kafka_producer.stop()
            self._kafka_producer = None

        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    async def emit(
        self,
        action: str,
        status_: str,
        message: str,
        *,
        log_type: str = "SYSTEM",
        actor: Optional[Dict[str, Any]] = None,
        target: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload: Dict[str, Any] = {
            "service": self._config.service_name,
            "action": action,
            "status": status_,
            "log_type": log_type,
            "actor": actor or {"id": self._config.service_name, "type": "service"},
            "metadata": {"message": message, **(metadata or {})},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if target:
            payload["target"] = target

        if await self._try_send_kafka(payload):
            return

        await self._send_via_http(payload)

    async def _try_send_kafka(self, payload: Dict[str, Any]) -> bool:
        if not self._kafka_producer:
            return False

        try:
            await asyncio.wait_for(
                self._kafka_producer.send_and_wait(self._config.audit_topic, payload),
                timeout=self._config.kafka_timeout_seconds,
            )
            return True
        except Exception as exc:  # noqa: BLE001 - must forward reason to audit-log fallback
            payload.setdefault("metadata", {})["kafka_error"] = str(exc)
            return False

    async def _send_via_http(self, payload: Dict[str, Any]) -> None:
        if not self._http_client:
            return

        try:
            await self._http_client.post("/logs", json=payload)
        except httpx.HTTPError:
            # Swallow the error to keep the API responsive even if audit-log is unavailable.
            return


class CategorizationModel:
    """Loads the persisted model artifacts and performs predictions."""

    def __init__(self, config: ServiceSettings) -> None:
        self._config = config
        self._pipeline: Any = None
        self._label_encoder: Any = None
        self._lock = asyncio.Lock()
        self._categories: Optional[List[str]] = None

    async def load(self) -> None:
        if self._pipeline is not None and self._label_encoder is not None:
            return

        async with self._lock:
            if self._pipeline is not None and self._label_encoder is not None:
                return

            pipeline, label_encoder = await asyncio.to_thread(self._load_from_disk)
            self._pipeline = pipeline
            self._label_encoder = label_encoder
            self._categories = self._extract_categories()

    def _load_from_disk(self) -> tuple[Any, Any]:
        if not self._config.model_pipeline_path.exists():
            raise FileNotFoundError(f"Missing model pipeline at {self._config.model_pipeline_path}")
        if not self._config.label_encoder_path.exists():
            raise FileNotFoundError(f"Missing label encoder at {self._config.label_encoder_path}")

        with self._config.model_pipeline_path.open("rb") as model_file:
            pipeline = pickle.load(model_file)

        with self._config.label_encoder_path.open("rb") as encoder_file:
            label_encoder = pickle.load(encoder_file)

        return pipeline, label_encoder

    def _extract_categories(self) -> List[str]:
        classes = getattr(self._label_encoder, "classes_", None)
        if classes is None:
            return []
        return [str(label) for label in classes]

    async def get_categories(self) -> List[str]:
        await self.load()
        return list(self._categories or [])

    async def predict(self, titles: List[str]) -> List[Dict[str, Any]]:
        await self.load()

        predictions: List[Dict[str, Any]] = await asyncio.to_thread(self._predict_sync, titles)
        return predictions

    def _predict_sync(self, titles: List[str]) -> List[Dict[str, Any]]:
        encoded_predictions = self._pipeline.predict(titles)

        probabilities = None
        if hasattr(self._pipeline, "predict_proba"):
            probabilities = self._pipeline.predict_proba(titles)

        decoded_categories = self._label_encoder.inverse_transform(encoded_predictions)
        available_categories = self._categories or self._extract_categories()

        results: List[Dict[str, Any]] = []
        for idx, text in enumerate(titles):
            confidence = 1.0
            ranked_categories: List[Dict[str, Any]] = []
            if probabilities is not None and len(available_categories) == len(probabilities[idx]):
                row = probabilities[idx]
                sorted_indices = np.argsort(row)[::-1]
                for class_index in sorted_indices[:3]:
                    ranked_categories.append(
                        {
                            "category": available_categories[class_index],
                            "probability": round(float(row[class_index]), 4),
                        }
                    )
                if ranked_categories:
                    confidence = ranked_categories[0]["probability"]
            else:
                ranked_categories.append(
                    {
                        "category": decoded_categories[idx],
                        "probability": 1.0,
                    }
                )
            results.append(
                {
                    "text": text,
                    "predicted_category": decoded_categories[idx],
                    "confidence": round(confidence, 4),
                    "confidence_percent": round(confidence * 100.0, 2),
                    "ranked_categories": ranked_categories,
                }
            )

        return results


class CategorizeRequest(BaseModel):
    titles: conlist(str, min_length=1, max_length=settings.max_batch_size) = Field(
        ..., description="List of issue titles to categorize"
    )


class RankedCategory(BaseModel):
    category: str
    probability: float = Field(ge=0.0, le=1.0)


class CategorizationResult(BaseModel):
    text: str
    predicted_category: str
    confidence: float = Field(ge=0.0, le=1.0)
    confidence_percent: float = Field(ge=0.0, le=100.0)
    ranked_categories: List[RankedCategory]


class CategorizeResponse(BaseModel):
    results: List[CategorizationResult]


class ModelInfoResponse(BaseModel):
    service_name: str
    model_path: str
    label_encoder_path: str
    total_categories: int
    categories: List[str]
    max_batch_size: int


audit_client = AuditClient(settings)
model_store = CategorizationModel(settings)
app = FastAPI(title="AI Categorization Service", version="1.0.0")


@app.on_event("startup")
async def startup_event() -> None:
    try:
        await model_store.load()
        await audit_client.start()
        await audit_client.emit(
            action="startup",
            status_="SUCCESS",
            message="AI categorization service started successfully",
            log_type="SYSTEM",
            metadata={"model_path": str(settings.model_pipeline_path)},
        )
    except Exception as exc:  # noqa: BLE001
        await audit_client.emit(
            action="startup",
            status_="ERROR",
            message="Startup failure",
            log_type="ERROR",
            metadata={"error": str(exc)},
        )
        raise


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await audit_client.emit(
        action="shutdown",
        status_="SUCCESS",
        message="AI categorization service is stopping",
        log_type="SYSTEM",
    )
    await audit_client.stop()


@app.post("/categorize", response_model=CategorizeResponse, status_code=status.HTTP_200_OK)
async def categorize(request: CategorizeRequest) -> CategorizeResponse:
    try:
        predictions = await model_store.predict(request.titles)
        await audit_client.emit(
            action="categorize",
            status_="SUCCESS",
            message="Categorization completed",
            log_type="ACTION",
            metadata={"items": len(request.titles)},
        )
        return CategorizeResponse(results=[CategorizationResult(**item) for item in predictions])
    except Exception as exc:  # noqa: BLE001
        await audit_client.emit(
            action="categorize",
            status_="ERROR",
            message="Categorization failed",
            log_type="ERROR",
            metadata={"error": str(exc)},
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Prediction failed") from exc


@app.get("/model-info", response_model=ModelInfoResponse)
async def model_info() -> ModelInfoResponse:
    try:
        categories = await model_store.get_categories()
        response = ModelInfoResponse(
            service_name=settings.service_name,
            model_path=str(settings.model_pipeline_path),
            label_encoder_path=str(settings.label_encoder_path),
            total_categories=len(categories),
            categories=categories,
            max_batch_size=settings.max_batch_size,
        )
        await audit_client.emit(
            action="model-info",
            status_="SUCCESS",
            message="Model metadata retrieved",
            log_type="SYSTEM",
            metadata={"total_categories": response.total_categories},
        )
        return response
    except Exception as exc:  # noqa: BLE001
        await audit_client.emit(
            action="model-info",
            status_="ERROR",
            message="Failed to read model metadata",
            log_type="ERROR",
            metadata={"error": str(exc)},
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Model info unavailable") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=False)
