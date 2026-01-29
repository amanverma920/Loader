import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

async function verifyAdminAuth(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    const token = request.cookies.get('admin-token')?.value
    
    if (!token) {
      return { authenticated: false, session: null }
    }
    
    const session = await db.collection('admin_sessions').findOne({
      token,
      expiresAt: { $gt: new Date().toISOString() }
    })
    
    return { authenticated: !!session, session }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { authenticated: false, session: null }
  }
}

// GET - Fetch username permissions or get users list for a specific username
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        { status: false, reason: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session = authResult.session
    
    // Only owner and super owner can access
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can access username permissions' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const url = new URL(request.url)
    const username = url.searchParams.get('username')
    const action = url.searchParams.get('action') // 'users' to get users list for a username

    if (action === 'users' && username) {
      // Get all users created by this username (referral users)
      const users = db.collection('users')
      
      // Get all users who were created by this username (referral)
      const referralUsers = await users.find({
        createdBy: username,
        isActive: { $ne: false }
      }, {
        projection: {
          username: 1,
          role: 1,
          createdAt: 1
        }
      }).toArray()
      
      return NextResponse.json({
        status: true,
        data: referralUsers
      })
    }

    // Get all username permissions
    const usernamePermissions = db.collection('username_permissions')
    
    if (username) {
      // Get specific username permission
      const permission = await usernamePermissions.findOne({ username })
      return NextResponse.json({
        status: true,
        data: permission || null
      })
    } else {
      // Get all username permissions
      const permissions = await usernamePermissions.find({}).toArray()
      return NextResponse.json({
        status: true,
        data: permissions
      })
    }
  } catch (error) {
    console.error('Error fetching username permissions:', error)
    return NextResponse.json(
      { status: false, reason: 'Error fetching username permissions' },
      { status: 500 }
    )
  }
}

// POST - Create or update username permission
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        { status: false, reason: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session = authResult.session
    
    // Only owner and super owner can update
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can update username permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { username, type, allowedUsers } = body

    if (!username || !type) {
      return NextResponse.json(
        { status: false, reason: 'Username and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'auto' && type !== 'manual') {
      return NextResponse.json(
        { status: false, reason: 'Type must be either "auto" or "manual"' },
        { status: 400 }
      )
    }

    if (type === 'manual' && (!allowedUsers || !Array.isArray(allowedUsers))) {
      return NextResponse.json(
        { status: false, reason: 'allowedUsers array is required for manual type' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    
    // Verify username exists
    const users = db.collection('users')
    const user = await users.findOne({ username, isActive: { $ne: false } })
    
    if (!user) {
      return NextResponse.json(
        { status: false, reason: 'Username not found or inactive' },
        { status: 404 }
      )
    }

    const usernamePermissions = db.collection('username_permissions')
    
    // Prepare permission document
    const permissionDoc: any = {
      username,
      type,
      updatedAt: new Date().toISOString(),
      updatedBy: session.username
    }

    if (type === 'manual') {
      permissionDoc.allowedUsers = allowedUsers
    } else {
      // For auto type, remove allowedUsers if it exists
      permissionDoc.allowedUsers = []
    }

    // Check if permission already exists
    const existing = await usernamePermissions.findOne({ username })
    
    if (existing) {
      // Update existing
      await usernamePermissions.updateOne(
        { username },
        { 
          $set: permissionDoc
        }
      )
    } else {
      // Create new
      permissionDoc.createdAt = new Date().toISOString()
      await usernamePermissions.insertOne(permissionDoc)
    }
    
    return NextResponse.json({
      status: true,
      message: 'Username permission updated successfully'
    })
  } catch (error) {
    console.error('Error updating username permission:', error)
    return NextResponse.json(
      { status: false, reason: 'Error updating username permission' },
      { status: 500 }
    )
  }
}

// DELETE - Delete username permission
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        { status: false, reason: 'Unauthorized' },
        { status: 401 }
      )
    }

    const session = authResult.session
    
    // Only owner and super owner can delete
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can delete username permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const username = url.searchParams.get('username')

    if (!username) {
      return NextResponse.json(
        { status: false, reason: 'Username is required' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const usernamePermissions = db.collection('username_permissions')
    
    await usernamePermissions.deleteOne({ username })
    
    return NextResponse.json({
      status: true,
      message: 'Username permission deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting username permission:', error)
    return NextResponse.json(
      { status: false, reason: 'Error deleting username permission' },
      { status: 500 }
    )
  }
}

