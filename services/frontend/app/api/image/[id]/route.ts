import { NextRequest, NextResponse } from 'next/server'

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const id = params.id
    // Docker internal URL for media-service
    const MEDIA_SERVICE_INTERNAL_URL = 'http://media-service:8080/media'

    const { searchParams } = new URL(request.url)
    const variant = searchParams.get('variant')

    // Construct URL based on variant (thumb, preview, or default/master)
    let fetchUrl = `${MEDIA_SERVICE_INTERNAL_URL}/${id}`
    if (variant === 'thumb') {
        fetchUrl += '/thumb'
    } else if (variant === 'preview') {
        fetchUrl += '/preview'
    }

    try {
        const res = await fetch(fetchUrl, {
            cache: 'no-store',
            headers: {
                // Use a system/admin ID to bypass visibility checks for unverified reports
                'X-User-ID': '00000000-0000-0000-0000-000000000000'
            }
        })

        if (!res.ok) {
            return new NextResponse(null, { status: res.status })
        }

        const blob = await res.blob()
        const headers = new Headers()
        headers.set('Content-Type', res.headers.get('Content-Type') || 'image/jpeg')
        headers.set('Cache-Control', 'public, max-age=3600')

        return new NextResponse(blob, { headers })
    } catch (error) {
        console.error('Error proxying image:', error)
        return new NextResponse(null, { status: 500 })
    }
}
