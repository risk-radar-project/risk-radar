import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';
import { AuditLogEntry } from '../types';

export class WebSocketHandler {
    private io: Server;

    constructor(httpServer: HttpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.io.on('connection', (socket) => {
            logger.info('WebSocket client connected', { socketId: socket.id });

            socket.on('disconnect', () => {
                logger.info('WebSocket client disconnected', { socketId: socket.id });
            });

            socket.on('subscribe', (data) => {
                // Allow clients to subscribe to specific log types or services
                if (data.service) {
                    socket.join(`service:${data.service}`);
                }
                if (data.log_type) {
                    socket.join(`log_type:${data.log_type}`);
                }
                logger.debug('Client subscribed', { socketId: socket.id, data });
            });

            socket.on('unsubscribe', (data) => {
                if (data.service) {
                    socket.leave(`service:${data.service}`);
                }
                if (data.log_type) {
                    socket.leave(`log_type:${data.log_type}`);
                }
                logger.debug('Client unsubscribed', { socketId: socket.id, data });
            });
        });
    }

    broadcastNewLog(log: AuditLogEntry): void {
        try {
            // Broadcast to all connected clients
            this.io.emit('new_log', log);

            // Broadcast to service-specific rooms
            this.io.to(`service:${log.service}`).emit('service_log', log);

            // Broadcast to log_type-specific rooms
            this.io.to(`log_type:${log.log_type}`).emit('log_type_log', log);

            logger.debug('Broadcasted new log via WebSocket', {
                logId: log.id,
                service: log.service
            });

        } catch (error) {
            logger.error('Failed to broadcast log via WebSocket', error);
        }
    }

    getConnectedClientsCount(): number {
        return this.io.sockets.sockets.size;
    }

    async close(): Promise<void> {
        // Remove any listeners and close IO server with callback to ensure cleanup
        this.io.removeAllListeners();
        await new Promise<void>((resolve) => {
            this.io.close(() => resolve());
        });
    }
}

let wsHandler: WebSocketHandler | null = null;

export function initializeWebSocket(httpServer: HttpServer): WebSocketHandler {
    wsHandler = new WebSocketHandler(httpServer);
    return wsHandler;
}

export function getWebSocketHandler(): WebSocketHandler | null {
    return wsHandler;
}
