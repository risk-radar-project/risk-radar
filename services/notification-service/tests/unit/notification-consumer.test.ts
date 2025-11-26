import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { KafkaMessage } from "kafkajs";
import type { NotificationEvent } from "../../src/types/events";

jest.mock("../../src/services/notification-dispatcher", () => ({
    notificationDispatcher: { dispatch: jest.fn() }
}));

type EachMessageHandler = (payload: { message: KafkaMessage }) => Promise<void>;

jest.mock("kafkajs", () => {
    const actual = jest.requireActual("kafkajs") as typeof import("kafkajs");

    const handlerRef: { handler: EachMessageHandler | null } = { handler: null };

    const mockConsumer = {
        connect: jest.fn(async () => undefined) as jest.MockedFunction<() => Promise<void>>,
        subscribe: jest.fn(async () => undefined) as jest.MockedFunction<() => Promise<void>>,
        run: jest.fn(async (options: { eachMessage: EachMessageHandler }) => {
            handlerRef.handler = options.eachMessage;
        }) as jest.MockedFunction<(options: { eachMessage: EachMessageHandler }) => Promise<void>>,
        disconnect: jest.fn(async () => undefined) as jest.MockedFunction<() => Promise<void>>
    };

    const mockKafkaInstance = {
        consumer: jest.fn(() => mockConsumer)
    };

    return {
        ...actual,
        Kafka: jest.fn(() => mockKafkaInstance),
        __mockKafka: {
            mockConsumer,
            mockKafkaInstance,
            getEachMessageHandler(): EachMessageHandler | null {
                return handlerRef.handler;
            },
            reset(): void {
                handlerRef.handler = null;
            }
        }
    };
});

import { NotificationConsumer } from "../../src/services/notification-consumer";
import { config } from "../../src/config/config";
import { notificationDispatcher } from "../../src/services/notification-dispatcher";

type KafkaMockModule = {
    __mockKafka: {
        mockConsumer: {
            connect: jest.Mock;
            subscribe: jest.Mock;
            run: jest.Mock;
            disconnect: jest.Mock;
        };
        getEachMessageHandler: () => EachMessageHandler | null;
        reset: () => void;
    };
};

const kafkaMock = jest.requireMock("kafkajs") as KafkaMockModule;

const dispatchMock = notificationDispatcher.dispatch as jest.MockedFunction<typeof notificationDispatcher.dispatch>;

function buildMessage(payload: object | null): KafkaMessage {
    const base = {
        key: null,
        value: payload ? Buffer.from(JSON.stringify(payload)) : null,
        timestamp: Date.now().toString(),
        size: 0,
        attributes: 0,
        offset: "0"
    };

    return base as unknown as KafkaMessage;
}

describe("NotificationConsumer", () => {
    let consumer: NotificationConsumer;

    beforeEach(() => {
        kafkaMock.__mockKafka.reset();
        jest.clearAllMocks();
        consumer = new NotificationConsumer();
        config.kafkaBrokers = ["broker-1:9092"];
        config.kafkaConnectRetryAttempts = 3;
        config.kafkaConnectRetryInitialDelayMs = 1;
        config.kafkaConnectRetryMaxDelayMs = 2;
    });

    it("dispatches parsed events from Kafka messages", async () => {
        await consumer.start();

        const handler = kafkaMock.__mockKafka.getEachMessageHandler();
        expect(handler).toBeTruthy();

        const event: NotificationEvent = {
            eventId: "4e0f9e6c-47cf-4d47-a451-3cd93f195403",
            eventType: "USER_REGISTERED",
            userId: "6a9380c5-4443-4d20-9ed4-1099abbfa9c0",
            initiatorId: null,
            payload: { email: "kafka@example.com" },
            source: "kafka-test"
        };

        await handler!({ message: buildMessage(event) });

        expect(dispatchMock).toHaveBeenCalledWith(event);
        await consumer.stop();
        expect(kafkaMock.__mockKafka.mockConsumer.disconnect).toHaveBeenCalled();
    });

    it("ignores invalid messages without payloads", async () => {
        await consumer.start();
        const handler = kafkaMock.__mockKafka.getEachMessageHandler();
        expect(handler).toBeTruthy();

        await handler!({ message: buildMessage(null) });

        expect(dispatchMock).not.toHaveBeenCalled();
        await consumer.stop();
    });

    it("does not restart when already running", async () => {
        await consumer.start();
        await consumer.start();

        expect(kafkaMock.__mockKafka.mockConsumer.connect).toHaveBeenCalledTimes(1);
        await consumer.stop();
    });

    it("drops malformed JSON payloads", async () => {
        await consumer.start();
        const handler = kafkaMock.__mockKafka.getEachMessageHandler();
        expect(handler).toBeTruthy();

        const malformed = buildMessage({});
        malformed.value = Buffer.from("{ not json");

        await handler!({ message: malformed });

        expect(dispatchMock).not.toHaveBeenCalled();
        await consumer.stop();
    });

    it("drops messages failing schema validation", async () => {
        await consumer.start();
        const handler = kafkaMock.__mockKafka.getEachMessageHandler();
        expect(handler).toBeTruthy();

        const invalidPayload = {
            eventType: "USER_REGISTERED",
            userId: "6a9380c5-4443-4d20-9ed4-1099abbfa9c0",
            source: "kafka-test"
        };

        await handler!({ message: buildMessage(invalidPayload) });

        expect(dispatchMock).not.toHaveBeenCalled();
        await consumer.stop();
    });

    it("propagates dispatcher failures so Kafka can retry", async () => {
        await consumer.start();
        const handler = kafkaMock.__mockKafka.getEachMessageHandler();
        expect(handler).toBeTruthy();

        const failingEvent: NotificationEvent = {
            eventId: "8b6b8dbe-a5e7-4ba4-8a64-e7bce49963cf",
            eventType: "USER_REGISTERED",
            userId: "6a9380c5-4443-4d20-9ed4-1099abbfa9c0",
            initiatorId: null,
            payload: { email: "retry@example.com" },
            source: "kafka-test"
        };
        dispatchMock.mockRejectedValueOnce(new Error("channel failed"));

        await expect(handler!({ message: buildMessage(failingEvent) })).rejects.toThrow("channel failed");

        await consumer.stop();
    });

    it("skips startup when Kafka brokers are missing", async () => {
        config.kafkaBrokers = [];
        await expect(consumer.start()).resolves.toBeUndefined();
        expect(kafkaMock.__mockKafka.mockConsumer.connect).not.toHaveBeenCalled();
        expect(dispatchMock).not.toHaveBeenCalled();
        await expect(consumer.stop()).resolves.toBeUndefined();
    });

    it("retries Kafka connection when initial attempt fails", async () => {
        let attempts = 0;
        kafkaMock.__mockKafka.mockConsumer.connect.mockImplementation(async () => {
            attempts += 1;
            if (attempts === 1) {
                throw new Error("offline");
            }
        });

        await consumer.start();

        expect(kafkaMock.__mockKafka.mockConsumer.connect).toHaveBeenCalledTimes(2);
        await consumer.stop();
    });

    it("fails fast when Kafka remains unreachable", async () => {
        config.kafkaConnectRetryAttempts = 2;
        kafkaMock.__mockKafka.mockConsumer.connect.mockImplementation(async () => {
            throw new Error("offline");
        });

        await expect(consumer.start()).rejects.toThrow("offline");
        expect(kafkaMock.__mockKafka.mockConsumer.connect).toHaveBeenCalledTimes(2);

        kafkaMock.__mockKafka.mockConsumer.connect.mockImplementation(async () => undefined);
    });

    it("rejects startup when stopped during retry cycle", async () => {
        kafkaMock.__mockKafka.mockConsumer.connect.mockImplementationOnce(async () => {
            await consumer.stop();
            throw new Error("offline");
        });

        await expect(consumer.start()).rejects.toThrow("Kafka consumer failed to start after configured retries");

        kafkaMock.__mockKafka.mockConsumer.connect.mockImplementation(async () => undefined);
    });

    it("attempts to reconnect when the consumer stops unexpectedly", async () => {
        let runCalls = 0;
        const originalRun = kafkaMock.__mockKafka.mockConsumer.run.getMockImplementation();

        kafkaMock.__mockKafka.mockConsumer.run
            .mockImplementationOnce(async (options: unknown) => {
                runCalls += 1;
                await originalRun?.(options as { eachMessage: EachMessageHandler });
                throw new Error("run failed");
            })
            .mockImplementation(async (options: unknown) => {
                runCalls += 1;
                await originalRun?.(options as { eachMessage: EachMessageHandler });
            });

        await consumer.start();

        await new Promise((resolve) => setTimeout(resolve, 5));

        expect(runCalls).toBeGreaterThanOrEqual(2);
        expect(kafkaMock.__mockKafka.mockConsumer.connect).toHaveBeenCalledTimes(2);
        await consumer.stop();

        if (originalRun) {
            kafkaMock.__mockKafka.mockConsumer.run.mockImplementation(originalRun);
        }
    });

    it("skips reconnection when already reconnecting", async () => {
        const originalRun = kafkaMock.__mockKafka.mockConsumer.run.getMockImplementation();

        kafkaMock.__mockKafka.mockConsumer.run.mockImplementation(async (options: unknown) => {
            await originalRun?.(options as { eachMessage: EachMessageHandler });
            const mutable = consumer as unknown as { reconnecting: boolean };
            mutable.reconnecting = true;
            throw new Error("run crash");
        });

        await consumer.start();
        await new Promise((resolve) => setTimeout(resolve, 5));

        expect(kafkaMock.__mockKafka.mockConsumer.connect).toHaveBeenCalledTimes(1);
        await consumer.stop();

        if (originalRun) {
            kafkaMock.__mockKafka.mockConsumer.run.mockImplementation(originalRun);
        }
    });

    it("exits the process when reconnection attempts fail", async () => {
        const exitSpy = jest.spyOn(process, "exit").mockImplementation((() => undefined) as never);
        const originalRun = kafkaMock.__mockKafka.mockConsumer.run.getMockImplementation();
        const originalConnect = (consumer as unknown as { connectWithRetry: (flag: boolean) => Promise<void> })
            .connectWithRetry
            .bind(consumer);
        const connectSpy = jest
            .spyOn(consumer as unknown as { connectWithRetry: (flag: boolean) => Promise<void> }, "connectWithRetry")
            .mockImplementation(async (flag: boolean) => {
                if (flag) {
                    return originalConnect(flag);
                }
                throw new Error("reconnect failed");
            });

        kafkaMock.__mockKafka.mockConsumer.run.mockImplementation(async (options: unknown) => {
            await originalRun?.(options as { eachMessage: EachMessageHandler });
            throw new Error("fatal crash");
        });

        await consumer.start();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(exitSpy).toHaveBeenCalledWith(1);

        await consumer.stop();
        connectSpy.mockRestore();
        if (originalRun) {
            kafkaMock.__mockKafka.mockConsumer.run.mockImplementation(originalRun);
        }
        exitSpy.mockRestore();
    });

    it("warns when consumer disconnect fails during cleanup", async () => {
        await consumer.start();
        kafkaMock.__mockKafka.mockConsumer.disconnect.mockImplementationOnce(async () => {
            throw new Error("disconnect failure");
        });

        await consumer.stop();

        expect(kafkaMock.__mockKafka.mockConsumer.disconnect).toHaveBeenCalled();
        kafkaMock.__mockKafka.mockConsumer.disconnect.mockImplementation(async () => undefined);
    });
});
