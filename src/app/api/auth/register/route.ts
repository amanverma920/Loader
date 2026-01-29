// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import crypto from 'crypto'
import type { AdminUser, ReferralCode } from '@/types'

export const dynamic = 'force-dynamic'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { username, email, password, referralCode } = await request.json()

    if (!username || !email || !password || !referralCode) {
      return NextResponse.json(
        { success: false, message: 'All fields are required.' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')

    const usersCol = db.collection<AdminUser>('users')
    const refCol = db.collection<ReferralCode>('referral_codes')

    const existingUser = await usersCol.findOne({ username })
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Username already exists.' },
        { status: 409 }
      )
    }

    const ref = await refCol.findOne({ code: referralCode, isActive: true })
    if (!ref) {
      return NextResponse.json(
        { success: false, message: 'Invalid or used referral code.' },
        { status: 400 }
      )
    }

    const nowISO = new Date().toISOString()
    const startingBalance = typeof ref.initialBalance === 'number' ? ref.initialBalance : 0
    
    // Set account expiry date from referral code expiry date
    let accountExpiryDate: string | undefined
    if (ref.expiryDate) {
      accountExpiryDate = ref.expiryDate
    } else if (ref.expiryDays && ref.expiryDays > 0) {
      // If expiryDays is provided but expiryDate is not, calculate it
      const now = new Date()
      const expiry = new Date(now.getTime() + ref.expiryDays * 24 * 60 * 60 * 1000)
      accountExpiryDate = expiry.toISOString()
    }

    await usersCol.insertOne({
      username,
      email,
      passwordHash: hashPassword(password),
      role: ref.role,
      createdAt: nowISO,
      createdBy: ref.createdBy,
      isActive: true,
      referralCodeUsed: ref.code,
      balance: startingBalance, // ✅ balance set
      accountExpiryDate, // ✅ account expiry date from referral code
    })

    await refCol.updateOne(
      { _id: ref._id },
      {
        $set: {
          isActive: false,
          usedBy: username,
          usedAt: nowISO,
        },
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now log in.',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
