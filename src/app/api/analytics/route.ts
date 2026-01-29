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
    
    const analytics = db.collection('analytics')
    const keys = db.collection('keys')
    const devices = db.collection('devices')
    const users = db.collection('users')
    
    // Filter data based on role
    // Super owner: sees all data
    // Owner: sees all data (except super owner)
    // Admin/Reseller: sees only their own data (keys they created)
    let analyticsQuery: any = {}
    let keysQuery: any = {}
    let usersQuery: any = {}
    
    if (session.role === 'super owner') {
      // Super owner sees all - no filters
    } else if (session.role === 'owner') {
      // Owner sees all except super owner
      usersQuery = { role: { $ne: 'super owner' } }
      // Filter out keys created by super owners
      const superOwners = await users.find({ role: 'super owner' }).project({ username: 1, _id: 0 }).toArray()
      const superOwnerUsernames = superOwners.map((u: any) => u.username)
      keysQuery = { createdBy: { $nin: superOwnerUsernames } }
    } else {
      // For Admin/Reseller, filter analytics by their keys
      // First get their keys
      const userKeys = await keys.find({ createdBy: session.username }).toArray()
      const userKeyIds = userKeys.map((k: any) => k._id.toString())
      
      // Filter analytics by keyId if it exists, or by createdBy
      analyticsQuery = {
        $or: [
          { keyId: { $in: userKeyIds } },
          { createdBy: session.username }
        ]
      }
      
      keysQuery = { createdBy: session.username }
      usersQuery = { role: { $ne: 'super owner' } }
    }
    
    const analyticsData = await analytics.find(analyticsQuery).toArray()
    const keysData = await keys.find(keysQuery).toArray()
    const devicesData = await devices.find({}).toArray()
    const totalUsersCount = await users.countDocuments(usersQuery)
    
    // Calculate traffic statistics
    const totalRequests = analyticsData.length
    const uniqueUsers = new Set(analyticsData.map((a: any) => a.uuid)).size
    const totalKeys = keysData.length
    const activeKeys = keysData.filter((k: any) => k.isActive).length
    
    // Calculate hourly traffic
    const hourlyTraffic = new Array(24).fill(0)
    analyticsData.forEach((analytics: any) => {
      const hour = new Date(analytics.timestamp).getHours()
      hourlyTraffic[hour]++
    })
    
    // Generate CPU usage data (mock data for now)
    const hourlyCpuUsage = Array.from({ length: 24 }, () => Math.floor(Math.random() * 40) + 20) // 20-60% range
    
    return NextResponse.json({
      status: true,
      data: {
        totalRequests,
        uniqueUsers,
        totalKeys,
        activeKeys,
        totalUsers: totalUsersCount,
        hourlyTraffic,
        hourlyCpuUsage,
        recentActivity: analyticsData.slice(-10).reverse(),
      },
      reason: 'Analytics retrieved successfully',
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error fetching analytics',
      },
      { status: 500 }
    )
  }
}
