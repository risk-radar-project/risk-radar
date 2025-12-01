export async function apiFetch<T>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    })

    if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
    }

    return res.json()
}
