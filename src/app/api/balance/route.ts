// src/app/api/balance/route.ts
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

// ✅ GET – list users you can manage
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.role === 'reseller') {
      return NextResponse.json(
        { success: false, message: 'Not authorized' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    let filter: any = {}

    // Super owner can see ALL users (including themselves)
    if (session.role === 'super owner') {
      // No filter - super owner sees everything including themselves
    } else if (session.role === 'admin') {
      // Admin sirf apne banaye resellers ko dikhe
      filter = { createdBy: session.username, role: 'reseller' }
    } else if (session.role === 'owner') {
      // Owner can see all except super owner and their own account
      filter = { 
        role: { $ne: 'super owner' },
        username: { $ne: session.username }
      }
    } else {
      filter = { role: { $ne: 'super owner' } }
    }

    const users = await usersCol
      .find(filter)
      .project({ username: 1, role: 1, balance: 1, _id: 0 })
      .sort({ role: 1, username: 1 })
      .toArray()

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    console.error('Balance GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ✅ POST – add balance
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.role === 'reseller') {
      return NextResponse.json(
        { success: false, message: 'Not authorized' },
        { status: 403 }
      )
    }

    const { username, amount } = await request.json()

    if (!username || typeof amount !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Username and amount are required.' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Amount must be greater than zero.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    const target = await usersCol.findOne({ username })
    if (!target) {
      return NextResponse.json(
        { success: false, message: 'User not found.' },
        { status: 404 }
      )
    }

    // Super owner and Owner can modify any user's balance
    // Admin sirf apne banaye resellers ko balance add kar sake
    if (session.role === 'admin') {
      if (target.role !== 'reseller' || target.createdBy !== session.username) {
        return NextResponse.json(
          { success: false, message: 'You can only add balance to resellers you created.' },
          { status: 403 }
        )
      }
    }

    // Owner cannot add balance to their own account (but super owner can)
    if (session.role === 'owner' && target.username === session.username) {
      return NextResponse.json(
        { success: false, message: 'Owner cannot add balance to their own account.' },
        { status: 403 }
      )
    }

    // Super owner can edit their own balance
    // (No restriction needed - super owner can edit anyone including themselves)

    const newBalance = (target.balance || 0) + amount

    await usersCol.updateOne(
      { username },
      {
        $set: { balance: newBalance },
      }
    )

    // optional: ek "balance_logs" collection me log kar sakte ho, agar chaho

    return NextResponse.json({
      success: true,
      message: 'Balance updated.',
      newBalance,
    })
  } catch (error) {
    console.error('Balance POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
