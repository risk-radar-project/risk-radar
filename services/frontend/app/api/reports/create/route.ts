import { NextRequest, NextResponse } from 'next/server'

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://127.0.0.1:8085'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        console.log('API Route: Creating report with data:', body)

        const authHeader = request.headers.get('Authorization')

        // Forward the request to report-service
        const response = await fetch(`${REPORT_SERVICE_URL}/createReport`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': request.headers.get('user-agent') || 'RiskRadar-Frontend',
                ...(authHeader ? { 'Authorization': authHeader } : {})
            },
            body: JSON.stringify(body)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Report service returned error: ${response.status}`, errorText)
            return NextResponse.json(
                { error: `Failed to create report: ${response.status}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data, { status: 201 })
    } catch (error: any) {
        console.error('Failed to create report:', error)
        return NextResponse.json(
            {
                error: 'Failed to create report',
                details: error.message
            },
            { status: 500 }
        )
    }
}
