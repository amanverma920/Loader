import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import type { AdminUser } from '@/types'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { usernameOrEmail, otp } = await request.json()

    if (!usernameOrEmail || !otp) {
      return NextResponse.json(
        { success: false, message: 'Username/email and OTP are required.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')
    const otpCol = db.collection('password_reset_otps')

    // Find user by username or email
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

    // Hash the submitted OTP to compare with stored hash
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')

    // Find the OTP record for this user
    const otpRecord = await otpCol.findOne({
      username: user.username,
      otp: hashedOtp
    })

    if (!otpRecord) {
      return NextResponse.json(
        { success: false, message: 'Invalid OTP. Please try again.' },
        { status: 400 }
      )
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expiresAt)
    const now = new Date()

    if (now > expiresAt) {
      // Delete expired OTP
      await otpCol.deleteOne({ _id: otpRecord._id })
      
      return NextResponse.json(
        { success: false, message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // OTP is valid - return success
    // Note: We don't delete the OTP here as it will be needed for the password reset
    // It will be deleted after successful password reset
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully.',
    })

  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

