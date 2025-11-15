/** Antivirus stub; always returns clean. Replace with real engine integration later. */
export async function scanBuffer(_bytes: Buffer): Promise<{ detected: boolean; engine?: string }> {
    // Stub: always clean
    return { detected: false }
}
