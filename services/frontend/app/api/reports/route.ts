
import { NextResponse } from 'next/server'

const MAP_SERVICE_URL = process.env.MAP_SERVICE_URL || 'http://127.0.0.1:8086'

export async function GET() {
    try {
        console.log(`API Route: Fetching reports from ${MAP_SERVICE_URL}...`)
        const response = await fetch(`${MAP_SERVICE_URL}/reports`, {
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Backend returned error: ${response.status}`, errorText)
            return NextResponse.json(
                { error: `Backend error: ${response.status}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Failed to fetch from backend:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch data',
                details: error.message,
                cause: error.cause ? error.cause.message : undefined
            },
            { status: 500 }
        )
    }
}
