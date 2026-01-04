import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:8080'

    try {
        const res = await fetch(`${USER_SERVICE}/users/${id}/roles`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        })

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Unknown error' }))
            return NextResponse.json(err, { status: res.status })
        }

        const data = await res.json()
        return NextResponse.json(data)
    } catch (error) {
        console.error('Error updating role:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
