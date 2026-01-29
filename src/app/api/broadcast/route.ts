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

// POST - Send broadcast message
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
    
    // Only super owner can broadcast
    if (session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only super owner can send broadcasts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { message, targetRoles } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { status: false, reason: 'Message cannot be empty' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const users = db.collection('users')
    const settings = db.collection('settings')

    // Get bot token
    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const botToken = botSettings?.botToken

    if (!botToken) {
      return NextResponse.json(
        { status: false, reason: 'Bot token not found. Please set bot token first.' },
        { status: 400 }
      )
    }

    // Get target users based on roles
    const targetRolesArray = targetRoles || ['reseller', 'admin', 'owner']
    const targetUsers = await users.find({
      role: { $in: targetRolesArray },
      $and: [
        { telegram_chat_id: { $exists: true } },
        { telegram_chat_id: { $ne: '' } },
        { telegram_chat_id: { $ne: null } }
      ]
    }).toArray()

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { status: false, reason: 'No users found with chat IDs for the selected roles' },
        { status: 404 }
      )
    }

    // Initialize bot
    const bot = new Telegraf(botToken)
    
    let successCount = 0
    let failCount = 0
    const failedUsers: string[] = []

    // Send message to each user
    for (const user of targetUsers) {
      try {
        const chatId = user.telegram_chat_id || user.telegram_id
        
        if (chatId) {
          await bot.telegram.sendMessage(chatId, message.trim(), { parse_mode: 'HTML' })
          successCount++
        } else {
          failCount++
          failedUsers.push(user.username || 'Unknown')
        }
      } catch (error: any) {
        failCount++
        failedUsers.push(user.username || 'Unknown')
        console.error(`Failed to send message to ${user.username}:`, error.message)
      }
    }

    // Log activity
    try {
      const activities = db.collection('activities')
      await activities.insertOne({
        action: 'broadcast_sent',
        details: `Broadcast sent to ${successCount} user(s) by ${session.username}. Target roles: ${targetRolesArray.join(', ')}. Failed: ${failCount}`,
        userId: session.username,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
        type: 'system'
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }

    return NextResponse.json({
      status: true,
      message: 'Broadcast sent successfully',
      data: {
        successCount,
        failCount,
        totalUsers: targetUsers.length,
        failedUsers: failedUsers.length > 0 ? failedUsers : undefined
      }
    })
  } catch (error) {
    console.error('Error sending broadcast:', error)
    return NextResponse.json(
      { status: false, reason: 'Error sending broadcast' },
      { status: 500 }
    )
  }
}

