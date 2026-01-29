// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import crypto from 'crypto'
import type { AdminUser, AdminSession } from '@/types'
import { checkAndHandleSystemOwnerExpiry } from '@/lib/systemOwnerExpiry'

export const dynamic = 'force-dynamic'

// 🔥 Session TTL (minutes)
const SESSION_TTL_MINUTES = 30

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')

    const ip = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const blockDurationMinutes = parseInt(
      process.env.BLOCK_DURATION_MINUTES || '2880',
      10
    )

    const now = new Date()
    const nowISO = now.toISOString()

    // ✅ Check if IP is blocked
    const blockedIP = await db.collection('blocked_ips').findOne({
      ip,
      $or: [
        { isPermanent: true },
        {
          isPermanent: false,
          expiresAt: { $gt: nowISO },
        },
      ],
    })

    if (blockedIP) {
      const remainingMinutes =
        blockedIP.isPermanent || !blockedIP.expiresAt
          ? null
          : Math.max(
            0,
            Math.round(
              (new Date(blockedIP.expiresAt).getTime() - now.getTime()) /
              (60 * 1000)
            )
          )

      return NextResponse.json(
        {
          success: false,
          message: blockedIP.isPermanent
            ? 'Your IP has been permanently blocked. Contact the owner.'
            : `Too many failed attempts. Try again after ${remainingMinutes} minutes.`,
        },
        { status: 403 }
      )
    }

    // ✅ Ensure default super owner and owner users exist
    const usersCol = db.collection<AdminUser>('users')

    const existingUserCount = await usersCol.countDocuments({})
    if (existingUserCount === 0) {
      const nowISO = new Date().toISOString()

      // Create default super owner
      const superOwnerExists = await usersCol.findOne({ role: 'super owner' })
      if (!superOwnerExists) {
        await usersCol.insertOne({
          username: 'superowner',
          passwordHash: hashPassword('superowner'),
          role: 'super owner',
          createdAt: nowISO,
          createdBy: 'system',
          isActive: true,
          balance: 10000000000000000, // Default balance for super owner
        })
        console.log('✅ Default super owner user created (username: superowner, password: superowner)')
      }

      // Create default owner
      const ownerExists = await usersCol.findOne({ role: 'owner' })
      if (!ownerExists) {
        const envUsername = process.env.ADMIN_USERNAME || 'admin'
        const envPassword = process.env.ADMIN_PASSWORD || 'admin123'

        await usersCol.insertOne({
          username: envUsername,
          passwordHash: hashPassword(envPassword),
          role: 'owner',
          createdAt: nowISO,
          createdBy: 'system',
          isActive: true,
        })
        console.log(`✅ Default owner user created (username: ${envUsername}, password: ${envPassword})`)
      }
    } else {
      // Check if super owner exists, if not create it
      const superOwnerExists = await usersCol.findOne({ role: 'super owner' })
      if (!superOwnerExists) {
        await usersCol.insertOne({
          username: 'superowner',
          passwordHash: hashPassword('superowner'),
          role: 'super owner',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          isActive: true,
          balance: 10000000000000000, // Default balance for super owner
        })
        console.log('✅ Default super owner user created (username: superowner, password: superowner)')
      } else {
        // Update existing super owners to have default balance if missing
        // First, find all super owners
        const allSuperOwners = await usersCol.find({
          role: 'super owner'
        }).toArray()

        // Filter and update those without balance or with null balance
        for (const superOwner of allSuperOwners) {
          if (superOwner.balance === null || superOwner.balance === undefined || !('balance' in superOwner)) {
            await usersCol.updateOne(
              { _id: superOwner._id },
              { $set: { balance: 10000000000000000 } }
            )
          }
        }
      }

      // Check if owner exists, if not create it
      const ownerExists = await usersCol.findOne({ role: 'owner' })
      if (!ownerExists) {
        const envUsername = process.env.ADMIN_USERNAME || 'admin'
        const envPassword = process.env.ADMIN_PASSWORD || 'admin123'

        await usersCol.insertOne({
          username: envUsername,
          passwordHash: hashPassword(envPassword),
          role: 'owner',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          isActive: true,
        })
        console.log(`✅ Default owner user created (username: ${envUsername}, password: ${envPassword})`)
      }
    }

    // Check and handle system owner expiry (auto-disable/restore users)
    await checkAndHandleSystemOwnerExpiry()

    // ✅ Find user in DB
    const user = await usersCol.findOne({ username })

    // Check if account is expired
    if (user && user.accountExpiryDate) {
      const expiryDate = new Date(user.accountExpiryDate)
      if (now >= expiryDate) {
        // Account has expired
        await db.collection('login_attempts').insertOne({
          ip,
          username,
          success: false,
          timestamp: nowISO,
          userAgent,
        })

        return NextResponse.json(
          {
            success: false,
            message: 'Your account has expired. Please contact the administrator.',
            accountExpired: true,
          },
          { status: 403 }
        )
      }
    }

    const isValidCredentials =
      !!user &&
      user.isActive !== false &&
      user.passwordHash === hashPassword(password)

    // ✅ Log attempt
    await db.collection('login_attempts').insertOne({
      ip,
      username,
      success: isValidCredentials,
      timestamp: nowISO,
      userAgent,
    })

    if (!isValidCredentials) {
      // Count recent failed attempts
      const recentAttempts = await db.collection('login_attempts').countDocuments({
        ip,
        success: false,
        timestamp: {
          $gte: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // last 15 min
        },
      })

      const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10)

      if (recentAttempts >= maxAttempts) {
        await db.collection('blocked_ips').insertOne({
          ip,
          blockedAt: nowISO,
          reason: `Too many failed login attempts (${recentAttempts})`,
          attemptCount: recentAttempts,
          isPermanent: false,
          expiresAt: new Date(
            now.getTime() + blockDurationMinutes * 60 * 1000
          ).toISOString(),
        })

        return NextResponse.json(
          {
            success: false,
            message: `Too many failed login attempts. Your IP has been blocked for ${blockDurationMinutes} minutes.`,
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          message: `Invalid credentials. ${maxAttempts - recentAttempts} attempts remaining.`,
        },
        { status: 401 }
      )
    }

    // ✅ Successful login → create 30 min session
    const sessionToken = crypto.randomUUID()
    const sessionExpiresAt = new Date(
      now.getTime() + SESSION_TTL_MINUTES * 60 * 1000
    ).toISOString() // now + 30 min

    await db.collection<AdminSession>('admin_sessions').insertOne({
      token: sessionToken,
      username: user!.username,
      role: user!.role,
      createdAt: nowISO,
      expiresAt: sessionExpiresAt,
    })

    const isHttps = process.env.NODE_ENV === 'production'

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      username: user!.username,
      role: user!.role,
    })

    // 🔥 Cookie bhi 30 min ke liye
    response.cookies.set('admin-token', sessionToken, {
      httpOnly: true,
      secure: isHttps,
      path: '/',
      sameSite: 'lax',
      maxAge: SESSION_TTL_MINUTES * 60, // 30 min in seconds
    })

    return response

  } catch (error) {
    console.error('💥 Login error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
