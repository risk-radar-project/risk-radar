import express from 'express';
import path from 'path';
import { config } from './config/config.js';
import { mediaRouter } from './routes/media-routes.js';
import { statusRouter } from './routes/status-routes.js';
import { requestContext } from './middleware/request-context.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import './authz/authz-adapter.js';
import './audit/audit-emitter.js';

const app = express();

// Trust proxy if behind gateway
if (config.trustProxy) {
    app.set('trust proxy', true);
}

app.use(express.json({ limit: config.bodyLimit }));
app.use(requestContext());
app.use(requestLogger());

// Routes
app.use('/media', mediaRouter);
app.use('/status', statusRouter);

// Static placeholders
try {
    const assetsPath = path.join(process.cwd(), 'src', 'assets');
    app.use('/assets', express.static(assetsPath));
} catch { /* ignore */ }

// Errors
app.use(errorHandler());

export default app;
