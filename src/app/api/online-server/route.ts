import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import crypto from 'crypto'

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

// GET - Fetch mod names (only for owner and super owner)
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
    
    // Only owner and super owner can access mod names
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can access mod names' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const apiKeys = db.collection('api_keys')
    
    // Get general mod name from api_keys
    let apiKeyDoc = await apiKeys.findOne({ type: 'main' })
    
    // Get mod names for all users
    const users = db.collection('users')
    const usersWithModName = await users.find({ modname: { $exists: true, $ne: '' } }).toArray()
    const userModNames = usersWithModName.map((u: any) => ({
      username: u.username,
      modname: u.modname || ''
    }))
    
    return NextResponse.json({
      status: true,
      data: {
        modname: apiKeyDoc?.modname || '',
        userModNames: userModNames
      }
    })
  } catch (error) {
    console.error('Error fetching mod names:', error)
    return NextResponse.json(
      { status: false, reason: 'Error fetching mod names' },
      { status: 500 }
    )
  }
}

// POST - Update mod names (only for owner and super owner)
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
    
    // Only owner and super owner can update mod names
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can update mod names' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { modname, username, userModname } = body

    // Get database connection
    const client = await clientPromise
    const db = client.db('nexpanel')
    const apiKeys = db.collection('api_keys')
    const users = db.collection('users')
    
    // Get existing keys (needed for mod name updates)
    let apiKeyDoc = await apiKeys.findOne({ type: 'main' })

    // Handle mod name updates
    if (modname !== undefined) {
      // Update general mod name in api_keys
      const updateData: any = {
        updatedAt: new Date().toISOString(),
        updatedBy: session.username
      }
      
      if (modname === null || modname === '') {
        updateData.modname = ''
      } else {
        updateData.modname = modname.trim()
      }
      
      if (apiKeyDoc) {
        await apiKeys.updateOne(
          { type: 'main' },
          { $set: updateData }
        )
      } else {
        // Create new api_keys doc if doesn't exist
        const defaultApiKey = process.env.API_KEY || crypto.randomBytes(32).toString('hex')
        const defaultSecretKey = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex')
        
        await apiKeys.insertOne({
          type: 'main',
          apiKey: defaultApiKey,
          secretKey: defaultSecretKey,
          modname: modname === null || modname === '' ? '' : modname.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: session.username
        })
      }
    }
    
    if (username !== undefined && userModname !== undefined) {
      // Update user-specific mod name
      const userDoc = await users.findOne({ username })
      if (!userDoc) {
        return NextResponse.json(
          { status: false, reason: 'User not found' },
          { status: 404 }
        )
      }
      
      const userUpdateData: any = {}
      if (userModname === null || userModname === '') {
        userUpdateData.modname = ''
      } else {
        userUpdateData.modname = userModname.trim()
      }
      
      await users.updateOne(
        { username },
        { $set: userUpdateData }
      )
    }
    
    return NextResponse.json({
      status: true,
      message: 'Mod name updated successfully'
    })
  } catch (error) {
    console.error('Error updating mod name:', error)
    return NextResponse.json(
      { status: false, reason: 'Error updating mod name' },
      { status: 500 }
    )
  }
}

