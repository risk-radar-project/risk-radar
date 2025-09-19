import { promises as fs } from 'fs';
import path from 'path';

// Jest globalTeardown script to remove the temporary media directory after all tests finish.
export default async function globalTeardown(): Promise<void> {
    const tmpDir = path.join(__dirname, '..', '..', 'tmp-test-media');
    try {
        // Use rm with recursive to remove nested sharded directories.
        await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (err) { }
}
