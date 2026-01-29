import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    const token = request.cookies.get('admin-token')?.value
    
    if (!token) {
      return null
    }
    
    const session = await db.collection('admin_sessions').findOne({
      token,
      expiresAt: { $gt: new Date().toISOString() }
    })
    
    return session
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    const globalSettings = await settings.findOne({})
    const panelName = globalSettings?.panelName || 'Vip Panel'
    
    return NextResponse.json({
      status: true,
      panelName,
    })
  } catch (error) {
    console.error('Error fetching panel name:', error)
    return NextResponse.json({
      status: true,
      panelName: 'Vip Panel',
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json(
        {
          status: false,
          reason: 'Unauthorized',
        },
        { status: 401 }
      )
    }

    // Only owner and super owner can change panel name
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        {
          status: false,
          reason: 'Only owner and super owner can change panel name',
        },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { panelName } = body
    
    if (!panelName || typeof panelName !== 'string' || panelName.trim().length === 0) {
      return NextResponse.json(
        {
          status: false,
          reason: 'Panel name is required',
        },
        { status: 400 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    await settings.updateOne(
      {},
      { $set: { panelName: panelName.trim() } },
      { upsert: true }
    )
    
    return NextResponse.json({
      status: true,
      panelName: panelName.trim(),
      reason: 'Panel name updated successfully',
    })
  } catch (error) {
    console.error('Error updating panel name:', error)
    return NextResponse.json(
      {
        status: false,
        reason: 'Error updating panel name',
      },
      { status: 500 }
    )
  }
}