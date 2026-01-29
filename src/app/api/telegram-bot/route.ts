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

// GET - Get bot token and chat ID
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
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const users = db.collection('users')
    
    // Get bot token (only for super owner and owner)
    let botToken = ''
    
    // Get bot settings to fetch botUsername (needed for all users to show Open Bot button)
    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const botUsername = botSettings?.botUsername || ''
    
    if (session.role === 'super owner' || session.role === 'owner') {
      botToken = botSettings?.botToken || ''
    }
    
    // Get current user's chat ID
    const currentUser = await users.findOne({ username: session.username })
    const chatId = currentUser?.telegram_chat_id || ''
    
    // Get bot permissions (which roles can access bot)
    const botPermissions = botSettings?.permissions || {
      reseller: true,
      admin: true,
      owner: true
    }
    
    // Get owner permissions (owner can manage admin and reseller permissions)
    const ownerPermissions = botSettings?.ownerPermissions || {
      reseller: true,
      admin: true
    }
    
    // Get maintenance mode status
    const maintenanceMode = botSettings?.maintenanceMode || false
    const maintenanceMessage = botSettings?.maintenanceMessage || '🔧 Bot is currently under maintenance. Please try again later.'
    
    // Check if current user's role has permission to access bot
    let hasPermission = botPermissions[session.role as keyof typeof botPermissions] !== false
    
    // For admin and reseller, also check owner permissions if owner option is on
    if ((session.role === 'admin' || session.role === 'reseller') && botPermissions.owner !== false) {
      const ownerHasPermission = ownerPermissions[session.role as keyof typeof ownerPermissions] !== false
      // Both super owner permission AND owner permission must be true
      hasPermission = hasPermission && ownerHasPermission
    }
    
    return NextResponse.json({
      status: true,
      data: {
        botToken: session.role === 'super owner' || session.role === 'owner' ? botToken : '',
        chatId: chatId || '',
        botUsername: botUsername || '', // Always return botUsername so users can see Open Bot button if they have permission
        canManageBotToken: session.role === 'super owner',
        hasPermission: hasPermission,
        permissions: session.role === 'super owner' ? botPermissions : undefined,
        ownerPermissions: session.role === 'owner' ? ownerPermissions : undefined,
        canManageOwnerPermissions: session.role === 'owner' && botPermissions.owner !== false,
        maintenanceMode: session.role === 'super owner' ? maintenanceMode : undefined,
        maintenanceMessage: session.role === 'super owner' ? maintenanceMessage : undefined
      }
    })
  } catch (error) {
    console.error('Error fetching bot settings:', error)
    return NextResponse.json(
      { status: false, reason: 'Error fetching bot settings' },
      { status: 500 }
    )
  }
}

// POST - Update bot token (super owner only) or chat ID (all users)
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
    const body = await request.json()
    const { botToken, chatId, permissions, botUsername, maintenanceMode, maintenanceMessage } = body

    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const users = db.collection('users')
    
    // Update bot token (only super owner can do this)
    if (botToken !== undefined) {
      if (session.role !== 'super owner') {
        return NextResponse.json(
          { status: false, reason: 'Only super owner can update bot token' },
          { status: 403 }
        )
      }

      // Validate bot token format (Telegram bot tokens are usually in format: number:token)
      if (botToken && !/^\d+:[A-Za-z0-9_-]+$/.test(botToken.trim())) {
        return NextResponse.json(
          { status: false, reason: 'Invalid bot token format' },
          { status: 400 }
        )
      }

      // Save bot token
      await settings.updateOne(
        { type: 'telegram_bot' },
        { 
          $set: { 
            botToken: botToken.trim() || '',
            updatedAt: new Date().toISOString(),
            updatedBy: session.username
          } 
        },
        { upsert: true }
      )

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'bot_token_updated',
          details: botToken ? `Bot token updated by ${session.username}` : `Bot token cleared by ${session.username}`,
          userId: session.username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    }

    // Update bot username (only super owner can do this)
    if (botUsername !== undefined) {
      if (session.role !== 'super owner') {
        return NextResponse.json(
          { status: false, reason: 'Only super owner can update bot username' },
          { status: 403 }
        )
      }

      // Validate username format (alphanumeric and underscores only)
      if (botUsername && !/^[a-zA-Z0-9_]+$/.test(botUsername.trim())) {
        return NextResponse.json(
          { status: false, reason: 'Invalid username format. Use only letters, numbers, and underscores.' },
          { status: 400 }
        )
      }

      // Save bot username
      await settings.updateOne(
        { type: 'telegram_bot' },
        { 
          $set: { 
            botUsername: botUsername ? botUsername.trim() : '',
            botUsername_updated_at: new Date().toISOString(),
            botUsername_updated_by: session.username
          } 
        },
        { upsert: true }
      )

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'bot_username_updated',
          details: botUsername ? `Bot username updated to @${botUsername} by ${session.username}` : `Bot username cleared by ${session.username}`,
          userId: session.username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    }

    // Update chat ID (all authenticated users can update their own chat ID)
    if (chatId !== undefined) {
      // Validate chat ID is a number
      if (chatId && (isNaN(Number(chatId)) || Number(chatId) <= 0)) {
        return NextResponse.json(
          { status: false, reason: 'Invalid chat ID. Chat ID must be a positive number.' },
          { status: 400 }
        )
      }

      // Update user's chat ID
      await users.updateOne(
        { username: session.username },
        { 
          $set: { 
            telegram_chat_id: chatId ? chatId.toString() : '',
            telegram_chat_id_updated_at: new Date().toISOString()
          } 
        }
      )

      // Also update telegram_id if chat ID is same (for backward compatibility)
      if (chatId) {
        await users.updateOne(
          { username: session.username },
          { 
            $set: { 
              telegram_id: Number(chatId)
            } 
          }
        )
      }

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'chat_id_updated',
          details: chatId ? `Chat ID updated to ${chatId} by ${session.username}` : `Chat ID cleared by ${session.username}`,
          userId: session.username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    }

    // Update bot permissions (only super owner can do this)
    if (permissions !== undefined) {
      if (session.role !== 'super owner') {
        return NextResponse.json(
          { status: false, reason: 'Only super owner can update bot permissions' },
          { status: 403 }
        )
      }

      // Validate permissions object
      if (typeof permissions !== 'object' || permissions === null) {
        return NextResponse.json(
          { status: false, reason: 'Invalid permissions format' },
          { status: 400 }
        )
      }

      // Save bot permissions
      await settings.updateOne(
        { type: 'telegram_bot' },
        { 
          $set: { 
            permissions: {
              reseller: permissions.reseller !== false,
              admin: permissions.admin !== false,
              owner: permissions.owner !== false
            },
            permissions_updated_at: new Date().toISOString(),
            permissions_updated_by: session.username
          } 
        },
        { upsert: true }
      )

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'bot_permissions_updated',
          details: `Bot permissions updated by ${session.username}: reseller=${permissions.reseller !== false}, admin=${permissions.admin !== false}, owner=${permissions.owner !== false}`,
          userId: session.username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    }

    // Update owner permissions (only owner can do this, and only if owner bot permission is enabled)
    const { ownerPermissions } = body
    if (ownerPermissions !== undefined) {
      if (session.role !== 'owner') {
        return NextResponse.json(
          { status: false, reason: 'Only owner can update admin/reseller bot permissions' },
          { status: 403 }
        )
      }

      // Check if owner bot permission is enabled
      const botSettings = await settings.findOne({ type: 'telegram_bot' })
      const botPermissions = botSettings?.permissions || {
        reseller: true,
        admin: true,
        owner: true
      }

      if (botPermissions.owner === false) {
        return NextResponse.json(
          { status: false, reason: 'Owner bot access is disabled. Please enable it first.' },
          { status: 403 }
        )
      }

      // Validate ownerPermissions object
      if (typeof ownerPermissions !== 'object' || ownerPermissions === null) {
        return NextResponse.json(
          { status: false, reason: 'Invalid owner permissions format' },
          { status: 400 }
        )
      }

      // Save owner permissions
      await settings.updateOne(
        { type: 'telegram_bot' },
        { 
          $set: { 
            ownerPermissions: {
              reseller: ownerPermissions.reseller !== false,
              admin: ownerPermissions.admin !== false
            },
            ownerPermissions_updated_at: new Date().toISOString(),
            ownerPermissions_updated_by: session.username
          } 
        },
        { upsert: true }
      )

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'owner_bot_permissions_updated',
          details: `Owner bot permissions updated by ${session.username}: reseller=${ownerPermissions.reseller !== false}, admin=${ownerPermissions.admin !== false}`,
          userId: session.username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    }

    // Update maintenance mode (only super owner can do this)
    if (maintenanceMode !== undefined || maintenanceMessage !== undefined) {
      if (session.role !== 'super owner') {
        return NextResponse.json(
          { status: false, reason: 'Only super owner can update maintenance mode' },
          { status: 403 }
        )
      }

      const client = await clientPromise
      const db = client.db('nexpanel')
      const settings = db.collection('settings')
      const users = db.collection('users')
      const Telegraf = (await import('telegraf')).Telegraf

      // Get current maintenance mode status
      const currentBotSettings = await settings.findOne({ type: 'telegram_bot' })
      const currentMaintenanceMode = currentBotSettings?.maintenanceMode || false
      const isTurningOn = maintenanceMode === true && !currentMaintenanceMode

      // Update maintenance mode
      const updateData: any = {}
      if (maintenanceMode !== undefined) {
        updateData.maintenanceMode = maintenanceMode === true
        updateData.maintenanceMode_updated_at = new Date().toISOString()
        updateData.maintenanceMode_updated_by = session.username
      }
      if (maintenanceMessage !== undefined) {
        updateData.maintenanceMessage = maintenanceMessage || '🔧 Bot is currently under maintenance. Please try again later.'
      }

      await settings.updateOne(
        { type: 'telegram_bot' },
        { $set: updateData },
        { upsert: true }
      )

      // If maintenance mode is being turned ON, send broadcast to all users
      if (isTurningOn) {
        try {
          const botToken = currentBotSettings?.botToken
          if (botToken) {
            const bot = new Telegraf(botToken)
            const botSettings = await settings.findOne({ type: 'telegram_bot' })
            const botPermissions = botSettings?.permissions || {
              reseller: true,
              admin: true,
              owner: true
            }

            // Get all users with chat IDs (except super owners)
            const targetUsers = await users.find({
              role: { $in: ['owner', 'admin', 'reseller'] },
              $and: [
                { telegram_chat_id: { $exists: true } },
                { telegram_chat_id: { $ne: '' } },
                { telegram_chat_id: { $ne: null } }
              ]
            }).toArray()

            const maintenanceMsg = maintenanceMessage || '🔧 <b>Maintenance Mode Activated</b>\n\nBot is currently under maintenance. Please try again later.\n\nThank you for your patience!'

            // Send maintenance message to all users
            for (const user of targetUsers) {
              try {
                const chatId = user.telegram_chat_id || user.telegram_id
                if (chatId) {
                  await bot.telegram.sendMessage(chatId, maintenanceMsg, { parse_mode: 'HTML' })
                }
              } catch (error: any) {
                console.error(`Failed to send maintenance message to ${user.username}:`, error.message)
              }
            }
          }
        } catch (error) {
          console.error('Error sending maintenance broadcast:', error)
        }
      }

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'maintenance_mode_updated',
          details: `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'} by ${session.username}. Message: ${maintenanceMessage || 'Default'}`,
          userId: session.username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }
    }

    return NextResponse.json({
      status: true,
      message: 'Settings updated successfully'
    })
  } catch (error) {
    console.error('Error updating bot settings:', error)
    return NextResponse.json(
      { status: false, reason: 'Error updating bot settings' },
      { status: 500 }
    )
  }
}

