import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

async function verifyAdminAuth(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    const token = request.cookies.get('admin-token')?.value
    
    if (!token) {
      return false
    }
    
    const session = await db.collection('admin_sessions').findOne({
      token,
      expiresAt: { $gt: new Date().toISOString() }
    })
    
    return !!session
  } catch (error) {
    console.error('Auth verification error:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminAuth(request)
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    // Clean up expired blocks first
    const blockDurationMinutes = parseInt(process.env.BLOCK_DURATION_MINUTES || '20')
    const expirationTime = new Date(Date.now() - blockDurationMinutes * 60 * 1000)
    
    await db.collection('blocked_ips').deleteMany({
      isPermanent: false,
      blockedAt: { $lt: expirationTime.toISOString() }
    })
    
    const blockedIPs = await db.collection('blocked_ips')
      .find({})
      .sort({ blockedAt: -1 })
      .toArray()
    
    // Add remaining time for temporary blocks
    const processedIPs = blockedIPs.map(ip => {
      const remainingTime = ip.isPermanent ? null : 
        Math.max(0, Math.ceil((new Date(ip.blockedAt).getTime() + blockDurationMinutes * 60 * 1000 - Date.now()) / (60 * 1000)))
      
      return {
        ...ip,
        _id: ip._id.toString(),
        remainingMinutes: remainingTime,
        isExpired: !ip.isPermanent && (remainingTime !== null && remainingTime <= 0)
      }
    })
    
    return NextResponse.json(processedIPs)
    
  } catch (error) {
    console.error('Error fetching blocked IPs:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminAuth(request)
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { error: 'IP ID is required' },
        { status: 400 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    const result = await db.collection('blocked_ips').deleteOne({
      _id: new ObjectId(id)
    })
    
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'IP not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true, message: 'IP unblocked successfully' })
    
  } catch (error) {
    console.error('Error unblocking IP:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
