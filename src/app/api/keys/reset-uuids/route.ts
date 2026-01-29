import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

// Force dynamic rendering since this route uses dynamic data
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

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        { status: false, reason: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Store session in a variable after null check
    const session = authResult.session
    
    const { keyIds } = await request.json()

    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      return NextResponse.json(
        { status: false, reason: 'Invalid key IDs provided' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const keys = db.collection('keys')
    const devices = db.collection('devices')

    // Convert string IDs to ObjectIds
    let objectIds = keyIds.map(id => new ObjectId(id))
    
    // Filter keys based on role
    // Super owner can reset ALL keys (owner, admin, reseller) - no restrictions
    // Owner can reset all except super owner keys
    // Admin/Reseller can only reset their own
    const users = db.collection('users')
    const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
    const superOwnerUsernames = superOwners.map((u: any) => u.username)
    
    let keysToReset = await keys.find({ _id: { $in: objectIds } }).toArray()
    
    if (session.role === 'super owner') {
      // Super owner can reset all keys - no filter needed
    } else if (session.role === 'owner') {
      keysToReset = keysToReset.filter((key: any) => !superOwnerUsernames.includes(key.createdBy))
      // Also filter objectIds to only include keys user can reset
      const allowedKeyIds = keysToReset.map((k: any) => k._id.toString())
      const filteredObjectIds = objectIds.filter(id => allowedKeyIds.includes(id.toString()))
      if (filteredObjectIds.length === 0) {
        return NextResponse.json({
          status: false,
          reason: 'No keys found or you do not have permission to reset UUIDs for these keys',
        }, { status: 403 })
      }
      // Update objectIds to only include allowed keys
      objectIds = filteredObjectIds
    } else {
      keysToReset = keysToReset.filter((key: any) => key.createdBy === session.username)
      // Also filter objectIds to only include keys user can reset
      const allowedKeyIds = keysToReset.map((k: any) => k._id.toString())
      const filteredObjectIds = objectIds.filter(id => allowedKeyIds.includes(id.toString()))
      if (filteredObjectIds.length === 0) {
        return NextResponse.json({
          status: false,
          reason: 'No keys found or you do not have permission to reset UUIDs for these keys',
        }, { status: 403 })
      }
      // Update objectIds to only include allowed keys
      objectIds = filteredObjectIds
    }

    // Reset device count for selected keys
    const updateResult = await keys.updateMany(
      { _id: { $in: objectIds } },
      { $set: { currentDevices: 0 } }
    )

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { status: false, reason: 'No keys found with the provided IDs' },
        { status: 404 }
      )
    }

    // Delete all devices (UUIDs) associated with the selected keys
    const deleteResult = await devices.deleteMany({
      keyId: { $in: objectIds }
    })

    // Log activities for reset UUIDs
    try {
      const activities = db.collection('activities')
      for (const keyId of objectIds) {
        const key = await keys.findOne({ _id: keyId })
        if (key) {
          await activities.insertOne({
            action: 'uuids_reset',
            details: `UUIDs reset for key: ${key.key.substring(0, 8)}...`,
            userId: 'system',
            ipAddress: 'unknown',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        }
      }
    } catch (error) {
      console.error('Failed to log activities:', error)
    }

    return NextResponse.json({
      status: true,
      data: {
        keysUpdated: updateResult.modifiedCount,
        uuidsDeleted: deleteResult.deletedCount,
        message: `Successfully reset UUIDs for ${updateResult.modifiedCount} key(s)`
      },
      reason: 'UUIDs reset successfully'
    })

  } catch (error) {
    console.error('Reset UUIDs error:', error)
    return NextResponse.json(
      { status: false, reason: 'Failed to reset UUIDs' },
      { status: 500 }
    )
  }
}
