process.env.HOSTNAME = 'authz';
process.env.AUTHZ_SERVICE_PORT = '8081';
process.env.AUDIT_LOG_SERVICE_PORT = '8082';
import path from 'path';
import fs from 'fs/promises';

// Force getDiskUsage fallback by mocking check-disk-space to throw
jest.mock('check-disk-space', () => ({ __esModule: true, default: () => { throw new Error('fail'); } }));

import { getDiskUsage, writeFileBuffered } from '../../../src/storage/fs-storage.js';

describe('fs-storage fallback', () => {
    const root = path.join(process.cwd(), 'tmp-fallback');
    beforeAll(async () => { await fs.mkdir(root, { recursive: true }); });
    afterAll(async () => { try { await fs.rm(root, { recursive: true, force: true }); } catch { } });

    it('walks directory when disk stats fail', async () => {
        await writeFileBuffered(root, 'id1', 'master', Buffer.from('abc'));
        const usage = await getDiskUsage(root);
        expect(usage.totalBytes).toBeGreaterThan(0);
        expect(usage.totalBytes).toBe(usage.usedBytes);
    });
});
