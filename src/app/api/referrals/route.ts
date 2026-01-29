// src/app/api/referrals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import crypto from 'crypto'
import type { AdminSession, ReferralCode, UserRole } from '@/types'

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

function generateReferralCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase()
}

// ✅ GET – list of referral codes (owner & admin only)
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
    const refCol = db.collection<ReferralCode>('referral_codes')

    // Filter referrals based on role
    // Super owner: sees ALL referrals (owner, admin, reseller) - no restrictions
    // Owner: sees all referrals (except super owner referrals)
    // Admin: sees only referrals they created (except super owner referrals)
    let query: any = {}
    if (session.role === 'super owner') {
      // Super owner sees ALL referrals - no filter
    } else if (session.role === 'owner') {
      // Owner sees all except super owner referrals
      query.role = { $ne: 'super owner' }
    } else if (session.role === 'admin') {
      // Admin sees only their created referrals (except super owner)
      query.createdBy = session.username
      query.role = { $ne: 'super owner' }
    } else {
      // Others - hide super owner referrals
      query.role = { $ne: 'super owner' }
    }

    const codes = await refCol
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json({ success: true, data: codes })
  } catch (error) {
    console.error('Referrals GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ✅ POST – create referral (owner: any role, admin: only reseller)
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

    const body = await request.json()
    const { role, initialBalance, expiryDays } = body as { role: UserRole; initialBalance?: number; expiryDays?: number }

    const allowedRoles: UserRole[] = ['super owner', 'owner', 'admin', 'reseller']

    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Invalid role.' },
        { status: 400 }
      )
    }

    // Expiry days is mandatory
    if (typeof expiryDays !== 'number' || Number.isNaN(expiryDays) || expiryDays <= 0) {
      return NextResponse.json(
        { success: false, message: 'Expiry days is required and must be greater than 0.' },
        { status: 400 }
      )
    }

    // 🔒 Admin sirf reseller ka referral bana sakta hai
    if (session.role === 'admin' && role !== 'reseller') {
      return NextResponse.json(
        { success: false, message: 'Admins can only create reseller referrals.' },
        { status: 403 }
      )
    }

    // Only super owner can create super owner referrals
    if (role === 'super owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { success: false, message: 'Only super owner can create super owner referrals.' },
        { status: 403 }
      )
    }

    // Super owner can create ALL types of referrals (owner, admin, reseller, super owner) - no restrictions

    // Owner can create owner referrals
    if (role === 'owner' && session.role === 'owner') {
      // Allow owner to create owner referrals
    } else if (role === 'owner' && session.role !== 'super owner' && session.role !== 'owner') {
      return NextResponse.json(
        { success: false, message: 'Only owner and super owner can create owner referrals.' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const refCol = db.collection<ReferralCode>('referral_codes')

    const code = generateReferralCode()
    const nowISO = new Date().toISOString()
    const now = new Date()

    const startBalance =
      typeof initialBalance === 'number' && !Number.isNaN(initialBalance)
        ? Math.max(0, initialBalance)
        : 0

    // Calculate expiry date (expiryDays is mandatory, so it will always be valid)
    const expiry = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000)
    const expiryDate = expiry.toISOString()

    const doc: ReferralCode = {
      code,
      role,
      createdBy: session.username,
      createdAt: nowISO,
      isActive: true,
      initialBalance: startBalance, // ✅ new user balance
      expiryDays: expiryDays, // ✅ expiry days (mandatory)
      expiryDate, // ✅ expiry date for referral code
    }

    await refCol.insertOne(doc)

    return NextResponse.json({
      success: true,
      data: doc,
      message: 'Referral code generated successfully.',
    })
  } catch (error) {
    console.error('Referrals POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ✅ DELETE – disable code (owner & admin only)
export async function DELETE(request: NextRequest) {
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

    const { code } = await request.json()
    if (!code) {
      return NextResponse.json(
        { success: false, message: 'Code is required.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const refCol = db.collection<ReferralCode>('referral_codes')

    await refCol.updateOne(
      { code },
      { $set: { isActive: false } }
    )

    return NextResponse.json({
      success: true,
      message: 'Referral code disabled.',
    })
  } catch (error) {
    console.error('Referrals DELETE error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
