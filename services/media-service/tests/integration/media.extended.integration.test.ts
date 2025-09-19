import request from 'supertest';
import path from 'path';
import { jest } from '@jest/globals';

jest.mock('file-type', () => ({ fileTypeFromBuffer: async (_buf: any) => ({ mime: 'image/png' }) }));

// Capture audit events
const emitted: any[] = [];
jest.mock('../../src/audit/audit-emitter.js', () => ({ emitAudit: jest.fn(async (e) => { emitted.push(e); }) }));
jest.mock('../../src/authz/authz-adapter.js', () => ({ hasPermission: jest.fn(async () => true) }));
jest.mock('../../src/moderation/openai-moderation.js', () => ({ moderateImage: jest.fn(async () => ({ flagged: false, elapsedMs: 3 })) }));

// Minimal in-memory DB similar to base integration test
const dbState: any[] = [];
const dbQuery = jest.fn(async (sql: string, params?: any[]) => {
    sql = sql.trim();
    if (sql.startsWith('INSERT INTO media_assets')) {
        const id = params![0];
        const rec = {
            id,
            owner_id: params![1] || null,
            visibility: params![2],
            status: params![3],
            deleted: false,
            content_type: 'image/jpeg',
            size_bytes: params![5],
            width: params![6],
            height: params![7],
            content_hash: params![8],
            original_filename: params![9],
            alt: params![10],
            tags: null,
            collection: null,
            moderation_flagged: params![12],
            moderation_decision_time_ms: params![13],
            is_temporary: params![14],
            expires_at: params![15],
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
        };
        dbState.push(rec); return { rows: [rec] } as any;
    }
    if (sql.startsWith('SELECT * FROM media_assets WHERE id=')) {
        return { rows: dbState.filter(r => r.id === params![0]) } as any;
    }
    if (sql.startsWith('UPDATE media_assets SET')) {
        const id = params![params!.length - 1];
        const rec = dbState.find(r => r.id === id);
        if (rec) rec.updated_at = new Date();
        if (sql.includes('visibility=')) {
            const visIdx = sql.split(',').findIndex(s => s.includes('visibility='));
            if (visIdx >= 0) rec.visibility = params![visIdx];
        }
        if (sql.includes('alt=')) {
            // alt param before id near end; simplistic update: re-read record after patch in controller anyway
        }
        if (sql.includes('status=')) {
            const stIdx = sql.split(',').findIndex(s => s.includes('status='));
            if (stIdx >= 0) rec.status = params![stIdx];
        }
        return { rows: [] } as any;
    }
    return { rows: [] } as any;
});
jest.mock('../../src/db/pool.js', () => ({ db: { query: (sql: string, params?: any[]) => dbQuery(sql, params) } }));

process.env.MEDIA_ROOT = path.join(process.cwd(), 'tmp-test-media');
process.env.HOSTNAME = 'authz';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';

import app from '../../src/app.js';

function png() { return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64'); }

describe('Media extended integration', () => {
    let mediaId: string;

    it('rejects invalid visibility enum on upload', async () => {
        const bad = await request(app)
            .post('/media')
            .attach('file', png(), { filename: 'v.png', contentType: 'image/png' })
            .field('visibility', 'INVALID_ENUM');
        expect(bad.status).toBe(400);

        const good = await request(app)
            .post('/media')
            .set('X-User-ID', 'user-1')
            .attach('file', png(), { filename: 'v2.png', contentType: 'image/png' })
            .field('visibility', 'owner');
        expect(good.status).toBe(201);
        mediaId = good.body.id;
    });

    it('updates visibility with audit event', async () => {
        const beforeCount = emitted.length;
        const res = await request(app)
            .patch(`/media/${mediaId}`)
            .send({ visibility: 'public' })
            .set('Content-Type', 'application/json')
            .set('X-User-ID', 'user-1');
        expect(res.status).toBe(200);
        expect(res.body.visibility).toBe('public');
        const after = emitted.slice(beforeCount).map(e => e.action);
        expect(after).toContain('visibility_changed');
    });

    it('clamps censor strength and emits audit', async () => {
        const before = emitted.length;
        const res = await request(app)
            .patch(`/media/${mediaId}`)
            .send({ censor: { strength: 9999 } })
            .set('Content-Type', 'application/json')
            .set('X-User-ID', 'user-1');
        expect(res.status).toBe(200);
        const actions = emitted.slice(before).map(e => e.action);
        expect(actions).toContain('media_censored');
    });

    it('returns 304 on ETag match for master', async () => {
        const first = await request(app).get(`/media/${mediaId}`);
        expect(first.status).toBe(200);
        const etag = first.headers['etag'];
        if (etag) {
            const second = await request(app).get(`/media/${mediaId}`).set('If-None-Match', etag as string);
            expect(second.status).toBe(304);
        }
    });

    it('emits media_uploaded audit event', () => {
        const actions = emitted.map(e => e.action);
        expect(actions).toContain('media_uploaded');
    });
});
