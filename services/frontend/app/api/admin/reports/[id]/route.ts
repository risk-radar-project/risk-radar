import { NextRequest, NextResponse } from 'next/server'

const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://127.0.0.1:8085'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const url = `${REPORT_SERVICE_URL}/report/${id}`
        console.log(`Admin API Route: Deleting report ${id}`)
        
        const response = await fetch(url, {
            method: 'DELETE',
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Backend returned error: ${response.status}`, errorText)
            return NextResponse.json(
                { error: `Backend error: ${response.status}` },
                { status: response.status }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Failed to delete report:', error)
        return NextResponse.json(
            { error: 'Failed to delete report', details: error.message },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const url = `${REPORT_SERVICE_URL}/report/${id}`
        console.log(`Admin API Route: Updating report ${id}`)
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
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
        console.error('Failed to update report:', error)
        return NextResponse.json(
            { error: 'Failed to update report', details: error.message },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')
        
        if (!status) {
            return NextResponse.json(
                { error: 'Status parameter is required' },
                { status: 400 }
            )
        }
        
        const url = `${REPORT_SERVICE_URL}/report/${id}/status?status=${status}`
        console.log(`Admin API Route: Changing status of report ${id} to ${status}`)
        
        const response = await fetch(url, {
            method: 'PATCH',
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
        console.error('Failed to change report status:', error)
        return NextResponse.json(
            { error: 'Failed to change status', details: error.message },
            { status: 500 }
        )
    }
}
