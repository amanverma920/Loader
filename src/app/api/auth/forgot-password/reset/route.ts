import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { AdminUser } from '@/types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail, otp, newPassword } = await request.json()

    if (!usernameOrEmail || !otp || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'All fields are required.' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters long.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')
    const otpCol = db.collection('password_reset_otps')

    // Find user
    const user = await usersCol.findOne({
      $or: [
        { username: usernameOrEmail },
        { email: usernameOrEmail }
      ]
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found.' },
        { status: 404 }
      )
    }

    // Verify OTP
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')
    const otpDoc = await otpCol.findOne({
      username: user.username,
      otp: hashedOtp,
      expiresAt: { $gt: new Date().toISOString() }
    })

    if (!otpDoc) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired OTP.' },
        { status: 400 }
      )
    }

    // Update password
    await usersCol.updateOne(
      { username: user.username },
      { $set: { passwordHash: hashPassword(newPassword) } }
    )

    // Delete used OTP
    await otpCol.deleteOne({ _id: otpDoc._id })

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully.',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

