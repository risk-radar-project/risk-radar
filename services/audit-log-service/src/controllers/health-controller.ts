import { Request, Response } from 'express';
import { database } from '../database/database';
import { getWebSocketHandler } from '../websocket/websocket-handler';
import { getKafkaStatus } from '../messaging/kafka-consumer';

export async function healthCheck(req: Request, res: Response): Promise<void> {
    try {
        const dbHealth = await database.healthCheck();
        const wsHandler = getWebSocketHandler();
        const wsConnections = wsHandler ? wsHandler.getConnectedClientsCount() : 0;
        const kafkaStatus = getKafkaStatus();

        const status = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            database_connection: dbHealth ? 'healthy' : 'unhealthy',
            websocket_enabled: Boolean(wsHandler),
            websocket_connections: wsConnections,
            kafka_connection: kafkaStatus,
        };

        const httpStatus = dbHealth ? 200 : 503;
        res.status(httpStatus).json(status);

    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
