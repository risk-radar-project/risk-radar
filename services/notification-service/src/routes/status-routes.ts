import { Router } from "express";
import { getStatus } from "../controllers/status-controller";

const router = Router();

router.get("/", getStatus);

export default router;
