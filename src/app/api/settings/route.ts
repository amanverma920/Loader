import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

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

interface DurationPricing {
  duration: number  // days
  price: number
}

interface GlobalSettings {
  _id?: any
  pricePerDay?: number  // Keep for backward compatibility
  durationPricing?: DurationPricing[]  // New duration-based pricing
}

export async function GET(request: NextRequest) {
  console.log('GET /api/settings called') // Debug log
  try {
    const isAuthenticated = await verifyAdminAuth(request)
    
    if (!isAuthenticated) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: 'Unauthorized',
        },
        { status: 401 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    let globalSettings = await settings.findOne({}) as GlobalSettings | null
    
    if (!globalSettings) {
      const defaultSettings: GlobalSettings = {
        pricePerDay: parseFloat(process.env.DEFAULT_PRICE_PER_DAY || '10'),
        durationPricing: [
          { duration: 1, price: 10 },
          { duration: 7, price: 50 },
          { duration: 30, price: 200 }
        ],
      }
      
      const result = await settings.insertOne(defaultSettings)
      globalSettings = { _id: result.insertedId, ...defaultSettings }
    } else if (!globalSettings.durationPricing || globalSettings.durationPricing.length === 0) {
      // Migrate old settings to new format
      const defaultPricing = [
        { duration: 1, price: globalSettings.pricePerDay || 10 },
        { duration: 7, price: (globalSettings.pricePerDay || 10) * 7 },
        { duration: 30, price: (globalSettings.pricePerDay || 10) * 30 }
      ]
      await settings.updateOne({}, { $set: { durationPricing: defaultPricing } })
      globalSettings.durationPricing = defaultPricing
    }
    
    return NextResponse.json({
      status: true,
      data: globalSettings,
      reason: 'Global settings retrieved successfully',
    })
  } catch (error) {
    console.error('Error fetching global settings:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error fetching global settings',
      },
      { status: 500 }
    )
  }
}

// Catch-all handler for debugging
export async function POST(request: NextRequest) {
  console.log('POST /api/settings called') // Debug log
  return NextResponse.json({
    status: false,
    reason: 'POST method not supported for settings',
  }, { status: 405 })
}

export async function DELETE(request: NextRequest) {
  console.log('DELETE /api/settings called') // Debug log
  return NextResponse.json({
    status: false,
    reason: 'DELETE method not supported for settings',
  }, { status: 405 })
}

// Handle all HTTP methods explicitly
export async function PUT(request: NextRequest) {
  console.log('PUT /api/settings called') // Debug log
  try {
    // Check authentication
    const token = request.cookies.get('admin-token')
    if (!token) {
      console.log('No admin-token found') // Debug log
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Authentication required',
      }, { status: 401 })
    }
    
    console.log('Authentication passed') // Debug log
    
    // Ensure we have a valid request body
    if (!request.body) {
      console.log('No request body') // Debug log
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Request body is required',
      }, { status: 400 })
    }

    const body = await request.json()
    console.log('Request body:', body) // Debug log
    
    // Validate required fields
    if (!body || typeof body !== 'object') {
      console.log('Invalid body format') // Debug log
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Invalid request body format',
      }, { status: 400 })
    }
    
    const { pricePerDay, durationPricing } = body
    
    console.log('Connecting to MongoDB...') // Debug log
    const client = await clientPromise
    console.log('MongoDB connected successfully') // Debug log
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const keys = db.collection('keys')
    
    // Get current settings for comparison
    const currentSettings = await settings.findOne({}) as GlobalSettings | null || {
      pricePerDay: parseFloat(process.env.DEFAULT_PRICE_PER_DAY || '10'),
      durationPricing: [
        { duration: 1, price: 10 },
        { duration: 7, price: 50 },
        { duration: 30, price: 200 }
      ],
    }
    
    const updates: any = {}
    const activityLogs = []

    if (pricePerDay !== undefined && pricePerDay !== currentSettings.pricePerDay) {
      const priceValue = parseFloat(pricePerDay)
      if (!isNaN(priceValue) && priceValue >= 0) {
        updates.pricePerDay = priceValue
        activityLogs.push({
          action: 'price_per_day_updated',
          details: `Price per day updated from ${currentSettings.pricePerDay || 10} to ${priceValue}`,
          userId: 'system',
        })
      }
    }

    if (durationPricing !== undefined && Array.isArray(durationPricing)) {
      // Validate duration pricing array
      const validPricing = durationPricing.filter((dp: any) => 
        typeof dp.duration === 'number' && 
        typeof dp.price === 'number' && 
        dp.duration > 0 && 
        dp.price >= 0 &&
        (!dp.type || dp.type === 'hours' || dp.type === 'days')
      ).map((dp: any) => ({
        duration: dp.duration,
        price: dp.price,
        type: dp.type || 'days' // Default to days if not specified
      }))
      
      if (validPricing.length >= 0) {
        updates.durationPricing = validPricing
        activityLogs.push({
          action: 'duration_pricing_updated',
          details: `Duration pricing updated with ${validPricing.length} durations`,
          userId: 'system',
        })
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        status: true,
        data: currentSettings,
        reason: 'No changes to update',
      })
    }
    
    // Update global settings
    await settings.updateOne({}, { $set: updates }, { upsert: true })
    
    // Log activities
    try {
      const activities = db.collection('activities')
      for (const activity of activityLogs) {
        await activities.insertOne({
          ...activity,
          ipAddress: 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      }
    } catch (error) {
      console.error('Failed to log activities:', error)
    }
    
    const updatedSettings = {
      ...currentSettings,
      ...updates,
    }
    
    return NextResponse.json({
      status: true,
      data: updatedSettings,
      reason: 'Global settings updated successfully',
    })
  } catch (error) {
    console.error('Error updating global settings:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error updating global settings',
      },
      { status: 500 }
    )
  }
}
