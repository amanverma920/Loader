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

// GET - Get server status (maintenance mode)
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
        { status: false, reason: 'Only owner and super owner can access server status' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const serverStatus = db.collection('server_status')
    
    // Get server status from database
    let statusDoc = await serverStatus.findOne({ type: 'maintenance' })
    
    // If not exists, create default (server ON - maintenance OFF)
    if (!statusDoc) {
      await serverStatus.insertOne({
        type: 'maintenance',
        isMaintenanceMode: false,
        message: 'Server is currently under maintenance. Please try again later.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: session.username
      })
      
      statusDoc = await serverStatus.findOne({ type: 'maintenance' })
    }
    
    return NextResponse.json({
      status: true,
      data: {
        isMaintenanceMode: statusDoc?.isMaintenanceMode || false,
        message: statusDoc?.message || 'Server is currently under maintenance. Please try again later.',
        updatedAt: statusDoc?.updatedAt,
        updatedBy: statusDoc?.updatedBy
      }
    })
  } catch (error) {
    console.error('Error fetching server status:', error)
    return NextResponse.json(
      { status: false, reason: 'Error fetching server status' },
      { status: 500 }
    )
  }
}

// POST - Update server status (maintenance mode)
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
        { status: false, reason: 'Only owner and super owner can update server status' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { isMaintenanceMode, message } = body

    if (typeof isMaintenanceMode !== 'boolean') {
      return NextResponse.json(
        { status: false, reason: 'isMaintenanceMode must be a boolean' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const serverStatus = db.collection('server_status')
    
    const updateData: any = {
      isMaintenanceMode: isMaintenanceMode,
      updatedAt: new Date().toISOString(),
      updatedBy: session.username
    }
    
    if (message !== undefined) {
      updateData.message = message.trim() || 'Server is currently under maintenance. Please try again later.'
    }
    
    const existingStatus = await serverStatus.findOne({ type: 'maintenance' })
    
    if (existingStatus) {
      // Update existing
      await serverStatus.updateOne(
        { type: 'maintenance' },
        { $set: updateData }
      )
    } else {
      // Create new
      await serverStatus.insertOne({
        type: 'maintenance',
        isMaintenanceMode: isMaintenanceMode,
        message: message?.trim() || 'Server is currently under maintenance. Please try again later.',
        createdAt: new Date().toISOString(),
        ...updateData
      })
    }
    
    return NextResponse.json({
      status: true,
      message: `Server ${isMaintenanceMode ? 'is now in maintenance mode' : 'is now online'}`
    })
  } catch (error) {
    console.error('Error updating server status:', error)
    return NextResponse.json(
      { status: false, reason: 'Error updating server status' },
      { status: 500 }
    )
  }
}

