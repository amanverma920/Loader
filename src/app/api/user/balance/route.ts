// src/app/api/user/balance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { AdminSession, AdminUser } from '@/types'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  const client = await clientPromise
  const db = client.db('nexpanel')

  const token = request.cookies.get('admin-token')?.value
  if (!token) return null

  const nowISO = new Date().toISOString()
  const session = await db.collection<AdminSession>('admin_sessions').findOne({
    token,
    expiresAt: { $gt: nowISO },
  })

  return session
}

// ✅ GET – get current user's balance
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    const user = await usersCol.findOne(
      { username: session.username }
    )

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      )
    }

    // Ensure balance is a number, default to 0 if undefined or null
    const balance = typeof user.balance === 'number' ? user.balance : 0

    return NextResponse.json({
      success: true,
      data: {
        balance: balance,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('User balance GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

