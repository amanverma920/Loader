// src/app/api/auth/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { AdminSession } from '@/types'
import { checkAndHandleSystemOwnerExpiry } from '@/lib/systemOwnerExpiry'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')

    const token = request.cookies.get('admin-token')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false })
    }

    const nowISO = new Date().toISOString()

    const session = await db
      .collection<AdminSession>('admin_sessions')
      .findOne({
        token,
        expiresAt: { $gt: nowISO },
      })

    if (!session) {
      // clear cookie
      const resp = NextResponse.json({ authenticated: false })
      resp.cookies.set('admin-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0,
      })
      return resp
    }

    // Check and handle system owner expiry (auto-disable/restore users)
    await checkAndHandleSystemOwnerExpiry()

    // Get user account expiry date
    const user = await db.collection('users').findOne({
      username: session.username
    })

    return NextResponse.json({
      authenticated: true,
      username: session.username,
      role: session.role,
      accountExpiryDate: user?.accountExpiryDate || null,
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json(
      { authenticated: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
