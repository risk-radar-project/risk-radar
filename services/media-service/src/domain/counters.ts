/** In-memory counters for lightweight /status metrics (reset on process restart). */
export const counters = {
    uploads: 0,
    deletes: 0,
    reads: { master: 0, thumb: 0, preview: 0 }
}
