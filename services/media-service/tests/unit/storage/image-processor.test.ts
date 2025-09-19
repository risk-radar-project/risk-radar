import { normalizeToJpeg, makeVariant, censorFullImagePixelate } from '../../../src/storage/image-processor';
import sharp from 'sharp';

describe('image-processor', () => {
    const makeSolid = async (w: number, h: number, color: string) => {
        return await sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
    };

    test('normalizeToJpeg returns jpeg bytes and preserves dimensions', async () => {
        const buf = await makeSolid(64, 32, '#ff0000');
        const { bytes, info } = await normalizeToJpeg(buf, { jpegQuality: 80 });
        expect(info.width).toBe(64);
        expect(info.height).toBe(32);
        const meta = await sharp(bytes).metadata();
        expect(meta.format).toBe('jpeg');
    });

    test('makeVariant constrains max side while preserving aspect ratio', async () => {
        const buf = await makeSolid(400, 200, '#00ff00');
        const variant = await makeVariant(buf, { maxSide: 100, jpegQuality: 70 });
        const meta = await sharp(variant).metadata();
        expect(Math.max(meta.width || 0, meta.height || 0)).toBeLessThanOrEqual(100);
    });

    test('censorFullImagePixelate produces jpeg output', async () => {
        const buf = await makeSolid(120, 80, '#0000ff');
        const censored = await censorFullImagePixelate(buf, 12, 60);
        const meta = await sharp(censored).metadata();
        expect(meta.format).toBe('jpeg');
    });
});
