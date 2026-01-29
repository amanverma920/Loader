// src/app/api/account/update/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import crypto from 'crypto'
import type { AdminSession, AdminUser } from '@/types'

export const dynamic = 'force-dynamic'

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { newUsername, oldPassword, newPassword } = await request.json()

    if (!oldPassword) {
      return NextResponse.json(
        { success: false, message: 'Old password is required.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    const user = await usersCol.findOne({ username: session.username })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found.' },
        { status: 404 }
      )
    }

    const oldHash = hashPassword(oldPassword)
    if ((user as any).passwordHash !== oldHash) {
      return NextResponse.json(
        { success: false, message: 'Old password is incorrect.' },
        { status: 400 }
      )
    }

    const updates: any = {}
    let finalUsername = user.username as string

    if (newUsername && newUsername !== user.username) {
      const existing = await usersCol.findOne({ username: newUsername })
      if (existing) {
        return NextResponse.json(
          { success: false, message: 'This username is already taken.' },
          { status: 400 }
        )
      }
      updates.username = newUsername
      finalUsername = newUsername
    }

    if (newPassword && newPassword.length > 3) {
      updates.passwordHash = hashPassword(newPassword)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No changes to update.' },
        { status: 400 }
      )
    }

    await usersCol.updateOne(
      { _id: user._id },
      { $set: updates }
    )

    // session username update (optional – anyway hum logout kara denge)
    if (updates.username) {
      await db.collection<AdminSession>('admin_sessions').updateMany(
        { username: user.username },
        { $set: { username: finalUsername } }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account updated successfully.',
    })
  } catch (error) {
    console.error('Account update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
