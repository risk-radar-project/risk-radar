import express from "express";
import cors from "cors";
import notificationsRouter from "./routes/notifications-routes";
import statusRouter from "./routes/status-routes";
import { requestContext } from "./middleware/request-context";
import { errorHandler } from "./middleware/error-handler";

export function createApp(): express.Application {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: "1mb" }));
    app.use(requestContext);

    app.use("/notifications", notificationsRouter);
    app.use("/status", statusRouter);

    app.use(errorHandler);
    return app;
}
