import { NextRequest, NextResponse } from 'next/server'

const MEDIA_SERVICE_URL = process.env.MEDIA_SERVICE_URL || 'http://127.0.0.1:8084'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()

        console.log('API Route: Uploading images to media service')


        const response = await fetch(`${MEDIA_SERVICE_URL}/media`, {
            method: 'POST',
            headers: {
                // Media-service requires X-User-ID header (401 Unauthorized without it)
                'X-User-ID': 'ea2698bc-9348-44f5-b64b-0b973da92da7' // Temporary UUID for development
            },
            body: formData
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`Media service returned error: ${response.status}`, errorText)
            return NextResponse.json(
                { error: `Failed to upload images: ${response.status}` },
                { status: response.status }
            )
        }

        const data = await response.json()
        return NextResponse.json(data)
    } catch (error: any) {
        console.error('Failed to upload images:', error)
        return NextResponse.json(
            {
                error: 'Failed to upload images',
                details: error.message
            },
            { status: 500 }
        )
    }
}
