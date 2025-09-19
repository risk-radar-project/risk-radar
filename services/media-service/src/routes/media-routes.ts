import { Router } from 'express';
import { mediaController } from '../controllers/media-controller.js';

/**
 * Wrap an async-compatible Express handler so that rejected promises are forwarded to next().
 * This avoids repeating try/catch blocks and prevents unhandled rejections.
 */
const a = (fn: any) => (req: any, res: any, next: any) => {
    try {
        const r = fn(req, res, next);
        if (r && typeof r.then === 'function') r.catch(next);
    } catch (e) {
        next(e);
    }
};

export const mediaRouter = Router();

mediaRouter.post('/', mediaController.upload.map((mw) => a(mw)));
mediaRouter.get('/', a(mediaController.list));
mediaRouter.get('/:id', a(mediaController.getMaster));
mediaRouter.get('/:id/thumb', a(mediaController.getThumb));
mediaRouter.get('/:id/preview', a(mediaController.getPreview));
mediaRouter.patch('/:id', a(mediaController.patch));
mediaRouter.delete('/:id', a(mediaController.remove));
mediaRouter.post('/temporary/keep', a(mediaController.keepTemporary));
mediaRouter.post('/temporary/reject', a(mediaController.rejectTemporary));
