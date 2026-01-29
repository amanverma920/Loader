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

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: 'Unauthorized',
        },
        { status: 401 }
      )
    }
    
    // Store session in a variable after null check
    const session = authResult.session
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    const keys = db.collection('keys')
    const users = db.collection('users')
    
    // Filter keys based on role
    // Super owner: sees ALL keys (owner, admin, reseller keys) - no restrictions
    // Owner: sees all keys (except super owner keys)
    // Admin/Reseller: sees only keys they created
    let query: any = {}
    if (session.role === 'super owner') {
      // Super owner sees ALL keys - no filter
    } else if (session.role === 'owner') {
      // Owner sees all except super owner keys
      const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
      const superOwnerUsernames = superOwners.map((u: any) => u.username)
      if (superOwnerUsernames.length > 0) {
        query.createdBy = { $nin: superOwnerUsernames }
      }
      // If no super owners, show all keys
    } else {
      // Admin/Reseller sees only their own keys
      query.createdBy = session.username
    }
    
    const keysData = await keys.find(query).toArray()
    
    // Fetch user information for each key's creator
    const keysWithUserInfo = await Promise.all(
      keysData.map(async (key: any) => {
        if (key.createdBy) {
          const creator = await users.findOne({ username: key.createdBy })
          return {
            ...key,
            createdByUsername: key.createdBy,
            createdByRole: creator?.role || 'unknown'
          }
        }
        return {
          ...key,
          createdByUsername: null,
          createdByRole: null
        }
      })
    )
    
    return NextResponse.json({
      status: true,
      data: keysWithUserInfo,
      reason: 'Keys retrieved successfully',
    })
  } catch (error) {
    console.error('Error fetching keys:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error fetching keys',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: 'Unauthorized',
        },
        { status: 401 }
      )
    }
    
    // Store session in a variable after null check
    const session = authResult.session
    
    const body = await request.json()
    
    // Check if this is a single key update or bulk update
    if (body.keyId && body.updates) {
      // Single key update (for editing individual keys)
      const { keyId, updates } = body
      
      if (!keyId) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'Key ID is required',
        }, { status: 400 })
      }
      
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      const users = db.collection('users')
      
      if (!ObjectId.isValid(keyId)) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'Invalid key ID format',
        }, { status: 400 })
      }
      
      // Get the key before updating for activity logging
      const existingKey = await keys.findOne({ _id: new ObjectId(keyId) })
      if (!existingKey) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'Key not found',
        }, { status: 404 })
      }
      
      // Check if user has permission to edit this key
      // Super owner can edit ALL keys (owner, admin, reseller) - no restrictions
      // Owner can edit all keys except super owner keys
      // Admin/Reseller can only edit their own keys
      if (session.role === 'super owner') {
        // Super owner can edit all keys - no check needed
      } else if (session.role === 'owner') {
        const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
        const superOwnerUsernames = superOwners.map((u: any) => u.username)
        if (superOwnerUsernames.includes(existingKey.createdBy)) {
          return NextResponse.json({
            status: false,
            data: null,
            reason: 'Owner cannot edit super owner keys',
          }, { status: 403 })
        }
      } else if (existingKey.createdBy !== session.username) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'You do not have permission to edit this key',
        }, { status: 403 })
      }
      
      const result = await keys.updateOne(
        { _id: new ObjectId(keyId) },
        { $set: updates }
      )
      
      if (result.matchedCount === 0) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'Key not found',
        }, { status: 404 })
      }

      // Log activity based on what was updated
      try {
        const activities = db.collection('activities')
        let action = 'key_edited'
        let details = `Key: ${existingKey.key.substring(0, 8)}...`
        
        if (updates.isActive === false) {
          action = 'key_disabled'
          details = `Key disabled: ${existingKey.key.substring(0, 8)}...`
        } else if (updates.isActive === true) {
          action = 'key_enabled'
          details = `Key enabled: ${existingKey.key.substring(0, 8)}...`
        }
        
        await activities.insertOne({
          action,
          details,
          userId: 'system',
          ipAddress: 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
      
      return NextResponse.json({
        status: true,
        data: { keyId },
        reason: 'Key updated successfully',
      })
      
    } else if (body.keyIds && body.updates) {
      // Bulk update (for disabling multiple keys)
      const { keyIds, updates } = body
      
      if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'Key IDs are required',
        }, { status: 400 })
      }
      
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      const users = db.collection('users')
      
      // Validate all key IDs
      const validObjectIds = keyIds.filter(id => ObjectId.isValid(id))
      if (validObjectIds.length === 0) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'No valid key IDs provided',
        }, { status: 400 })
      }
      
      const objectIds = validObjectIds.map(id => new ObjectId(id))
      
      // Get the keys before updating for activity logging
      let keysToUpdate = await keys.find({ _id: { $in: objectIds } }).toArray()
      
      // Filter keys based on role
      // Super owner can update ALL keys (owner, admin, reseller) - no restrictions
      // Owner can update all except super owner keys
      // Admin/Reseller can only update their own
      if (session.role === 'super owner') {
        // Super owner can update all keys - no filter needed
      } else if (session.role === 'owner') {
        const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
        const superOwnerUsernames = superOwners.map((u: any) => u.username)
        keysToUpdate = keysToUpdate.filter((key: any) => !superOwnerUsernames.includes(key.createdBy))
        // Also filter objectIds to only include keys user can update
        const allowedKeyIds = keysToUpdate.map(k => k._id.toString())
        const filteredObjectIds = objectIds.filter(id => allowedKeyIds.includes(id.toString()))
        if (filteredObjectIds.length === 0) {
          return NextResponse.json({
            status: false,
            data: null,
            reason: 'No keys found or you do not have permission to update these keys',
          }, { status: 403 })
        }
        // Update query to only include allowed keys
        objectIds.splice(0, objectIds.length, ...filteredObjectIds)
      } else {
        keysToUpdate = keysToUpdate.filter((key: any) => key.createdBy === session.username)
        // Also filter objectIds to only include keys user can update
        const allowedKeyIds = keysToUpdate.map(k => k._id.toString())
        const filteredObjectIds = objectIds.filter(id => allowedKeyIds.includes(id.toString()))
        if (filteredObjectIds.length === 0) {
          return NextResponse.json({
            status: false,
            data: null,
            reason: 'No keys found or you do not have permission to update these keys',
          }, { status: 403 })
        }
        // Update query to only include allowed keys
        objectIds.splice(0, objectIds.length, ...filteredObjectIds)
      }
      
      if (keysToUpdate.length === 0) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'No keys found',
        }, { status: 404 })
      }
      
      // Update all keys
      const result = await keys.updateMany(
        { _id: { $in: objectIds } },
        { $set: updates }
      )
      
      if (result.matchedCount === 0) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'No keys found',
        }, { status: 404 })
      }

      // Log activities for updated keys
      try {
        const activities = db.collection('activities')
        for (const key of keysToUpdate) {
          let action = 'key_edited'
          let details = `Key: ${key.key.substring(0, 8)}...`
          
          if (updates.isActive === false) {
            action = 'key_disabled'
            details = `Key disabled: ${key.key.substring(0, 8)}...`
          } else if (updates.isActive === true) {
            action = 'key_enabled'
            details = `Key enabled: ${key.key.substring(0, 8)}...`
          }
          
          await activities.insertOne({
            action,
            details,
            userId: 'system',
            ipAddress: 'unknown',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        }
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
      
      return NextResponse.json({
        status: true,
        data: { keysUpdated: result.modifiedCount },
        reason: `${result.modifiedCount} key(s) updated successfully`,
      })
      
    } else {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Invalid request format. Expected keyId+updates or keyIds+updates',
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating keys:', error)
    return NextResponse.json({
      status: false,
      data: null,
      reason: 'Error updating keys',
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request)
    
    if (!authResult.authenticated || !authResult.session) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: 'Unauthorized',
        },
        { status: 401 }
      )
    }
    
    // Store session in a variable after null check
    const session = authResult.session
    
    const body = await request.json()
    const { keyIds } = body
    
    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Key IDs are required',
      }, { status: 400 })
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    const keys = db.collection('keys')
    const devices = db.collection('devices')
    const users = db.collection('users')
    
    const validObjectIds = keyIds.filter(id => ObjectId.isValid(id))
    if (validObjectIds.length === 0) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'No valid key IDs provided',
      }, { status: 400 })
    }
    
    const objectIds = validObjectIds.map(id => new ObjectId(id))
    
    // Get the keys before deleting for activity logging
    let keysToDelete = await keys.find({ _id: { $in: objectIds } }).toArray()
    
    // Filter keys based on role
    // Super owner can delete ALL keys (owner, admin, reseller) - no restrictions
    // Owner can delete all except super owner keys
    // Admin/Reseller can only delete their own
    const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
    const superOwnerUsernames = superOwners.map((u: any) => u.username)
    
    if (session.role === 'super owner') {
      // Super owner can delete all keys - no filter needed
    } else if (session.role === 'owner') {
      keysToDelete = keysToDelete.filter((key: any) => !superOwnerUsernames.includes(key.createdBy))
    } else {
      keysToDelete = keysToDelete.filter((key: any) => key.createdBy === session.username)
    }
    
    // Also filter objectIds to only include keys user can delete
    const allowedKeyIds = keysToDelete.map(k => k._id.toString())
    const filteredObjectIds = objectIds.filter(id => allowedKeyIds.includes(id.toString()))
    if (filteredObjectIds.length === 0) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'No keys found or you do not have permission to delete these keys',
      }, { status: 403 })
    }
    // Update objectIds to only include allowed keys
    objectIds.splice(0, objectIds.length, ...filteredObjectIds)
    
    // Delete associated devices first
    await devices.deleteMany({ keyId: { $in: objectIds } })
    
    // Delete the keys
    const result = await keys.deleteMany({ _id: { $in: objectIds } })
    
    // Log activities for deleted keys
    try {
      const activities = db.collection('activities')
      for (const key of keysToDelete) {
        await activities.insertOne({
          action: 'key_deleted',
          details: `Key deleted: ${key.key.substring(0, 8)}...`,
          userId: 'system',
          ipAddress: 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      }
    } catch (error) {
      console.error('Failed to log activities:', error)
    }
    
    return NextResponse.json({
      status: true,
      data: { deletedCount: result.deletedCount },
      reason: `${result.deletedCount} key(s) deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting keys:', error)
    return NextResponse.json({
      status: false,
      data: null,
      reason: 'Error deleting keys',
    }, { status: 500 })
  }
}
