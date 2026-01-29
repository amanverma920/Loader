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
    const logoUrl = globalSettings?.logoUrl || '/images/logo.svg'
    
    return NextResponse.json({
      status: true,
      logoUrl,
    })
  } catch (error) {
    console.error('Error fetching logo:', error)
    return NextResponse.json({
      status: true,
      logoUrl: '/images/logo.svg',
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

    // Only owner and super owner can change logo
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        {
          status: false,
          reason: 'Only owner and super owner can change logo',
        },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const { logoUrl } = body
    
    if (!logoUrl || typeof logoUrl !== 'string' || logoUrl.trim().length === 0) {
      return NextResponse.json(
        {
          status: false,
          reason: 'Logo URL is required',
        },
        { status: 400 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    await settings.updateOne(
      {},
      { $set: { logoUrl: logoUrl.trim() } },
      { upsert: true }
    )
    
    return NextResponse.json({
      status: true,
      logoUrl: logoUrl.trim(),
      reason: 'Logo updated successfully',
    })
  } catch (error) {
    console.error('Error updating logo:', error)
    return NextResponse.json(
      {
        status: false,
        reason: 'Error updating logo',
      },
      { status: 500 }
    )
  }
}