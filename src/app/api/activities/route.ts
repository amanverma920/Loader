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

interface Activity {
  _id?: any
  action: string
  details?: string
  userId: string
  ipAddress?: string
  timestamp: string
  metadata?: any
  type?: string
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
    const activities = db.collection('activities')
    const analytics = db.collection('analytics')
    const keys = db.collection('keys')
    const users = db.collection('users')
    
    // Get super owner usernames - always filter out super owner activities from everyone
    const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
    const superOwnerUsernames = superOwners.map((u: any) => u.username)
    
    // Get super owner keys to filter from analytics
    const superOwnerKeys = await keys.find({ createdBy: { $in: superOwnerUsernames } }).toArray()
    const superOwnerKeyIds = superOwnerKeys.map((k: any) => k._id.toString())
    
    // Filter activities based on role
    // Everyone: super owner activities are hidden from all users (including owner)
    let activitiesQuery: any = {}
    let analyticsQuery: any = {}
    
    // Always exclude super owner activities from all users (including super owner)
    if (session.role === 'super owner') {
      // Super owner: hide their own activities from everyone (including themselves)
      activitiesQuery = {
        userId: { $nin: superOwnerUsernames },
        createdBy: { $nin: superOwnerUsernames }
      }
      
      // Filter analytics to exclude super owner keys
      analyticsQuery = {
        createdBy: { $nin: superOwnerUsernames },
        keyId: { $nin: superOwnerKeyIds }
      }
    } else if (session.role === 'owner') {
      // Owner sees all activities except super owner activities
      activitiesQuery = {
        userId: { $nin: superOwnerUsernames },
        createdBy: { $nin: superOwnerUsernames }
      }
      
      // Filter analytics to exclude super owner keys
      analyticsQuery = {
        createdBy: { $nin: superOwnerUsernames },
        keyId: { $nin: superOwnerKeyIds }
      }
    } else {
      // Admin/Reseller sees only activities related to their keys (excluding super owner)
      const userKeys = await keys.find({ 
        createdBy: session.username
      }).toArray()
      // Filter out super owner keys
      const userKeyIds = userKeys
        .map((k: any) => k._id.toString())
        .filter((id: string) => !superOwnerKeyIds.includes(id))
      
      // Filter activities by keyId or createdBy (exclude super owner activities)
      activitiesQuery = {
        $and: [
          {
            $or: [
              { keyId: { $in: userKeyIds } },
              { userId: session.username },
              { createdBy: session.username }
            ]
          },
          {
            userId: { $nin: superOwnerUsernames },
            createdBy: { $nin: superOwnerUsernames }
          }
        ]
      }
      
      analyticsQuery = {
        $and: [
          {
            $or: [
              { keyId: { $in: userKeyIds } },
              { createdBy: session.username }
            ]
          },
          {
            createdBy: { $nin: superOwnerUsernames },
            keyId: { $nin: superOwnerKeyIds }
          }
        ]
      }
    }
    
    // Check if activities collection exists and has data
    const collections = await db.listCollections().toArray()
    const hasActivities = collections.some(col => col.name === 'activities')
    console.log('Activities collection exists:', hasActivities)
    
    // Get recent activities (last 20) with proper filtering
    let query = activitiesQuery || {}
    const recentActivities = await activities
      .find(query)
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray()
    
    console.log('Recent activities found:', recentActivities.length)
    if (recentActivities.length > 0) {
      console.log('Sample activity:', recentActivities[0])
    }
    
    // Get recent login activities from analytics
    const recentLogins = await analytics
      .find(analyticsQuery)
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray()
    
    console.log('Recent logins found:', recentLogins.length)
    
    // Filter out any super owner activities that might have slipped through
    const filteredRecentActivities = recentActivities.filter((activity: any) => {
      const userId = activity.userId || activity.createdBy || ''
      const createdBy = activity.createdBy || ''
      return !superOwnerUsernames.includes(userId) && !superOwnerUsernames.includes(createdBy)
    })
    
    const filteredRecentLogins = recentLogins.filter((login: any) => {
      const createdBy = login.createdBy || ''
      const keyId = login.keyId || ''
      const uuid = login.uuid || ''
      // Always exclude super owner activities from analytics
      return !superOwnerUsernames.includes(createdBy) && 
             !superOwnerKeyIds.includes(keyId) &&
             !superOwnerUsernames.includes(uuid)
    })
    
    // Combine and format all activities (after filtering)
    const allActivities: Activity[] = [
      ...filteredRecentActivities.map((activity: any) => ({
        _id: activity._id?.toString() || `activity-${Date.now()}-${Math.random()}`,
        action: activity.action || 'unknown',
        details: activity.details,
        userId: activity.userId || 'system',
        ipAddress: activity.ipAddress,
        timestamp: activity.timestamp || new Date().toISOString(),
        metadata: activity.metadata,
        type: 'system'
      })),
      ...filteredRecentLogins.map((login: any) => ({
        _id: login._id?.toString() || `login-${Date.now()}-${Math.random()}`,
        action: 'user_login',
        details: `Login from ${login.ipAddress || 'unknown IP'}`,
        userId: login.uuid || 'unknown',
        ipAddress: login.ipAddress,
        timestamp: login.timestamp || new Date().toISOString(),
        type: 'login'
      }))
    ].sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime()
      const dateB = new Date(b.timestamp || 0).getTime()
      return dateB - dateA
    }).slice(0, 20)
    
    console.log('Total activities to return:', allActivities.length)
    
    return NextResponse.json({
      status: true,
      data: allActivities,
      reason: 'Activities retrieved successfully',
    })
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error fetching activities',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    
    const body = await request.json()
    const { action, details, userId, ipAddress, metadata } = body
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    const activities = db.collection('activities')
    
    const activity: Activity = {
      action,
      details,
      userId: userId || 'system',
      ipAddress: ipAddress || 'unknown',
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
      type: 'system'
    }
    
    await activities.insertOne(activity)
    
    return NextResponse.json({
      status: true,
      data: activity,
      reason: 'Activity logged successfully',
    })
  } catch (error) {
    console.error('Error logging activity:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error logging activity',
      },
      { status: 500 }
    )
  }
}
