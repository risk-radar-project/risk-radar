
import { NextResponse } from 'next/server'
import { JwtPayload, parseJwt } from '@/lib/auth/jwt-utils'

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://127.0.0.1:8080'
const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://127.0.0.1:8085'

export async function GET(request: Request) {
    try {
        // 1. Check Authorization
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid authorization token' },
                { status: 401 }
            )
        }

        const token = authHeader.substring(7)
        const payload = parseJwt(token)

        if (!payload) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401 }
            )
        }

        const roles = payload.roles || []
        const permissions = payload.permissions || []

        // Allow if admin or has stats:view permission
        const isAdmin = roles.includes('ADMIN') ||
            roles.includes('ROLE_ADMIN') ||
            permissions.includes('*:*') ||
            permissions.includes('PERM_*:*') ||
            permissions.includes('stats:view') ||
            permissions.includes('PERM_STATS:VIEW')

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Insufficient permissions. Admin role or stats:view required.' },
                { status: 403 }
            )
        }

        // 2. Fetch Report Stats
        let reportStats = {
            totalReports: 0,
            pendingReports: 0,
            verifiedReports: 0,
            rejectedReports: 0,
            reportsToday: 0,
            reportsThisWeek: 0
        }

        try {
            const reportRes = await fetch(`${REPORT_SERVICE_URL}/reports/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-ID': payload.userId || ''
                }
            })
            if (reportRes.ok) {
                reportStats = await reportRes.json()
            } else {
                console.error('Failed to fetch report stats:', reportRes.status, await reportRes.text())
            }
        } catch (error) {
            console.error('Error fetching report stats:', error)
        }

        // 3. Fetch User Stats
        let userStats = {
            totalUsers: 0,
            bannedUsers: 0
        }

        try {
            const userRes = await fetch(`${USER_SERVICE_URL}/users/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-ID': payload.userId || ''
                }
            })
            if (userRes.ok) {
                userStats = await userRes.json()
            } else {
                console.error('Failed to fetch user stats:', userRes.status, await userRes.text())
            }
        } catch (error) {
            console.error('Error fetching user stats:', error)
        }

        // 4. Combine and return
        return NextResponse.json({
            ...reportStats,
            ...userStats
        })

    } catch (error) {
        console.error('Error in stats proxy:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
