import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { Telegraf } from 'telegraf'

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

// GET - Get maintenance mode status
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
    
    // Only super owner can check maintenance mode
    if (session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only super owner can check maintenance mode' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')

    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const maintenanceMode = botSettings?.maintenanceMode || false
    const maintenanceMessage = botSettings?.maintenanceMessage || '⚠️ Bot is currently under maintenance. Please try again later.'

    return NextResponse.json({
      status: true,
      data: {
        maintenanceMode,
        maintenanceMessage
      }
    })
  } catch (error) {
    console.error('Error fetching maintenance mode:', error)
    return NextResponse.json(
      { status: false, reason: 'Error fetching maintenance mode' },
      { status: 500 }
    )
  }
}

// POST - Update maintenance mode
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
    
    // Only super owner can update maintenance mode
    if (session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only super owner can update maintenance mode' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { maintenanceMode, maintenanceMessage } = body

    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const users = db.collection('users')

    // Get bot settings
    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const botToken = botSettings?.botToken
    const botUsername = botSettings?.botUsername

    if (!botToken) {
      return NextResponse.json(
        { status: false, reason: 'Bot token not found. Please set bot token first.' },
        { status: 400 }
      )
    }

    // Update maintenance mode
    await settings.updateOne(
      { type: 'telegram_bot' },
      { 
        $set: { 
          maintenanceMode: maintenanceMode === true,
          maintenanceMessage: maintenanceMessage || '⚠️ Bot is currently under maintenance. Please try again later.',
          maintenanceMode_updated_at: new Date().toISOString(),
          maintenanceMode_updated_by: session.username
        } 
      },
      { upsert: true }
    )

    // If maintenance mode is enabled, send message to all users (except super owner)
    if (maintenanceMode === true) {
      try {
        const bot = new Telegraf(botToken)
        const message = maintenanceMessage || '⚠️ Bot is currently under maintenance. Please try again later.'
        
        // Get all users with chat IDs (except super owners)
        const allUsers = await users.find({
          role: { $ne: 'super owner' },
          $or: [
            { 
              $and: [
                { telegram_chat_id: { $exists: true } },
                { telegram_chat_id: { $ne: '' } },
                { telegram_chat_id: { $ne: null } }
              ]
            },
            { telegram_id: { $exists: true } }
          ]
        }).toArray()

        let successCount = 0
        let failCount = 0

        for (const user of allUsers) {
          try {
            const chatId = user.telegram_chat_id || user.telegram_id
            if (chatId) {
              await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' })
              successCount++
            }
          } catch (error: any) {
            failCount++
            console.error(`Failed to send maintenance message to ${user.username}:`, error.message)
          }
        }

        // Log activity
        try {
          const activities = db.collection('activities')
          await activities.insertOne({
            action: 'maintenance_mode_enabled',
            details: `Maintenance mode enabled by ${session.username}. Message sent to ${successCount} user(s). Failed: ${failCount}`,
            userId: session.username,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        } catch (error) {
          console.error('Failed to log activity:', error)
        }
      } catch (error) {
        console.error('Error sending maintenance messages:', error)
      }
    } else {
      // If maintenance mode is disabled, send message to all users (except super owner)
      try {
        const bot = new Telegraf(botToken)
        const message = '✅ Bot maintenance mode has been disabled. The bot is now available for use!'
        
        // Get all users with chat IDs (except super owners)
        const allUsers = await users.find({
          role: { $ne: 'super owner' },
          $or: [
            { 
              $and: [
                { telegram_chat_id: { $exists: true } },
                { telegram_chat_id: { $ne: '' } },
                { telegram_chat_id: { $ne: null } }
              ]
            },
            { telegram_id: { $exists: true } }
          ]
        }).toArray()

        let successCount = 0
        let failCount = 0

        for (const user of allUsers) {
          try {
            const chatId = user.telegram_chat_id || user.telegram_id
            if (chatId) {
              await bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' })
              successCount++
            }
          } catch (error: any) {
            failCount++
            console.error(`Failed to send maintenance disabled message to ${user.username}:`, error.message)
          }
        }

        // Log activity
        try {
          const activities = db.collection('activities')
          await activities.insertOne({
            action: 'maintenance_mode_disabled',
            details: `Maintenance mode disabled by ${session.username}. Message sent to ${successCount} user(s). Failed: ${failCount}`,
            userId: session.username,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        } catch (error) {
          console.error('Failed to log activity:', error)
        }
      } catch (error) {
        console.error('Error sending maintenance disabled messages:', error)
        
        // Still log activity even if message sending failed
        try {
          const activities = db.collection('activities')
          await activities.insertOne({
            action: 'maintenance_mode_disabled',
            details: `Maintenance mode disabled by ${session.username}`,
            userId: session.username,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            timestamp: new Date().toISOString(),
            type: 'system'
          })
        } catch (error) {
          console.error('Failed to log activity:', error)
        }
      }
    }

    return NextResponse.json({
      status: true,
      message: `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'} successfully`,
      data: {
        maintenanceMode: maintenanceMode === true,
        maintenanceMessage: maintenanceMessage || '⚠️ Bot is currently under maintenance. Please try again later.'
      }
    })
  } catch (error) {
    console.error('Error updating maintenance mode:', error)
    return NextResponse.json(
      { status: false, reason: 'Error updating maintenance mode' },
      { status: 500 }
    )
  }
}

