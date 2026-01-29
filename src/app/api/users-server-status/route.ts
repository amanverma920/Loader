// src/app/api/users-server-status/route.ts
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

// Helper function to recursively find all users created by a specific username
async function getAllChildUsers(username: string, usersCol: any): Promise<string[]> {
  const childUsers = await usersCol.find({ createdBy: username }).toArray()
  let allUsers: string[] = [username]
  
  for (const child of childUsers) {
    const grandChildren = await getAllChildUsers(child.username, usersCol)
    allUsers = [...allUsers, ...grandChildren]
  }
  
  return allUsers
}

// GET - Get server status for all users
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

    // Super owner can see ALL users (no restrictions)
    if (session.role === 'super owner') {
      // No filter - super owner sees everything
    } else if (session.role === 'admin') {
      // Admin can see their own account + users they created
      filter = {
        $or: [
          { username: session.username }, // Their own account
          { createdBy: session.username } // Users they created
        ]
      }
    } else if (session.role === 'owner') {
      // Owner can see all except super owner
      filter = { role: { $ne: 'super owner' } }
    } else {
      // Reseller and others - hide super owner
      filter = { role: { $ne: 'super owner' } }
    }

    const users = await usersCol
      .find(filter, {
        projection: {
          passwordHash: 0, // Exclude password hash
          // All other fields will be included by default when using exclusion projection
        },
      })
      .sort({ role: 1, username: 1 })
      .toArray()
    
    // Map to only return the fields we need
    const filteredUsers = users.map((user: any) => ({
      _id: user._id,
      username: user.username,
      role: user.role,
      serverStatus: user.serverStatus,
      createdBy: user.createdBy,
    }))

    return NextResponse.json({ success: true, data: filteredUsers })
  } catch (error) {
    console.error('Users server status GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Toggle server status for users
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
    const { action, usernames, serverStatus } = body

    if (!action || !Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid request.' },
        { status: 400 }
      )
    }

    if (action !== 'toggleServerStatus') {
      return NextResponse.json(
        { success: false, message: 'Invalid action.' },
        { status: 400 }
      )
    }

    if (typeof serverStatus !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'Server status must be a boolean.' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usersCol = db.collection<AdminUser>('users')

    const results: any[] = []

    // Process each username
    for (const username of usernames) {
      const target = await usersCol.findOne({ username })
      if (!target) {
        results.push({
          username,
          success: false,
          message: 'User not found.',
        })
        continue
      }

      // Permission checks
      // Super owner can manage all users (but shouldn't manage themselves)
      if (session.role === 'super owner') {
        if (target.username === session.username && !serverStatus) {
          results.push({
            username,
            success: false,
            message: 'You cannot turn off your own server.',
          })
          continue
        }
      } else if (session.role === 'owner') {
        // Owner can manage all users except super owner and themselves
        if (target.role === 'super owner') {
          results.push({
            username,
            success: false,
            message: 'You cannot manage super owner accounts.',
          })
          continue
        }
        if (target.username === session.username && !serverStatus) {
          results.push({
            username,
            success: false,
            message: 'You cannot turn off your own server.',
          })
          continue
        }
      } else if (session.role === 'admin') {
        // Admin can only manage users they created (not their own account)
        if (target.createdBy !== session.username) {
          results.push({
            username,
            success: false,
            message: 'You can only manage users you created.',
          })
          continue
        }
        if (target.username === session.username && !serverStatus) {
          results.push({
            username,
            success: false,
            message: 'You cannot turn off your own server.',
          })
          continue
        }
      }

      // Get all child users recursively
      const allAffectedUsers = await getAllChildUsers(username, usersCol)

      // Update server status for the user and all their child users
      await usersCol.updateMany(
        { username: { $in: allAffectedUsers } },
        { $set: { serverStatus: serverStatus } }
      )

      results.push({
        username,
        success: true,
        message: `Server ${serverStatus ? 'turned ON' : 'turned OFF'} for user and ${allAffectedUsers.length - 1} child user(s).`,
        affectedCount: allAffectedUsers.length,
      })
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.length} user(s).`,
    })
  } catch (error) {
    console.error('Users server status POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

