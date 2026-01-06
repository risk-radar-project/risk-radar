import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:8080'
    const targetUrl = `${USER_SERVICE}/users/${id}/unban`

    console.log(`[unban/route] Forwarding to: ${targetUrl}`)

    try {
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Authorization': authHeader }
        })

        console.log(`[unban/route] Response status: ${res.status}`)

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            console.log(`[unban/route] Error response:`, err)
            return NextResponse.json(err, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error unbanning user:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
