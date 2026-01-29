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

// POST - Set webhook URL
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
    
    // Only super owner and owner can set webhook
    if (session.role !== 'super owner' && session.role !== 'owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can set webhook' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    // Get bot token
    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const botToken = botSettings?.botToken || process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return NextResponse.json(
        { status: false, reason: 'Bot token not found. Please set bot token first.' },
        { status: 400 }
      )
    }

    // Get webhook URL from request body or use default
    let webhookUrl: string | undefined
    
    try {
      const body = await request.json().catch(() => ({}))
      webhookUrl = body?.webhookUrl
    } catch (error) {
      // Body might be empty, use default
      webhookUrl = undefined
    }

    // If no URL provided, construct from request headers
    if (!webhookUrl) {
      const host = request.headers.get('host')
      const protocol = request.headers.get('x-forwarded-proto') || request.headers.get('x-forwarded-protocol') || 'https'
      
      if (!host) {
        return NextResponse.json(
          { status: false, reason: 'Unable to determine host. Please provide webhook URL manually.' },
          { status: 400 }
        )
      }
      
      webhookUrl = `${protocol}://${host}/api/telegram-webhook`
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { status: false, reason: 'Webhook URL must use HTTPS protocol. Telegram requires HTTPS for webhooks.' },
        { status: 400 }
      )
    }

    // Set webhook via Telegram API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`
    
    console.log('Setting webhook:', { telegramApiUrl, webhookUrl })
    
    let response: Response
    let result: any
    
    try {
      response = await fetch(telegramApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      })

      result = await response.json()
      console.log('Telegram API response:', result)

      if (!result.ok) {
        return NextResponse.json(
          { 
            status: false, 
            reason: result.description || 'Failed to set webhook',
            errorCode: result.error_code,
            details: result
          },
          { status: 400 }
        )
      }
    } catch (error: any) {
      console.error('Failed to call Telegram API:', error)
      return NextResponse.json(
        { 
          status: false, 
          reason: `Network error: ${error.message || 'Failed to connect to Telegram API'}` 
        },
        { status: 500 }
      )
    }

    // Save webhook URL to database
    await settings.updateOne(
      { type: 'telegram_bot' },
      { 
        $set: { 
          webhookUrl: webhookUrl,
          webhookSetAt: new Date().toISOString(),
          webhookSetBy: session.username
        } 
      },
      { upsert: true }
    )

    // Log activity
    try {
      const activities = db.collection('activities')
      await activities.insertOne({
        action: 'webhook_set',
        details: `Webhook URL set to ${webhookUrl} by ${session.username}`,
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
      message: 'Webhook set successfully',
      data: {
        webhookUrl: webhookUrl,
        result: result
      }
    })
  } catch (error: any) {
    console.error('Error setting webhook:', error)
    return NextResponse.json(
      { 
        status: false, 
        reason: error.message || 'Error setting webhook',
        error: error.toString()
      },
      { status: 500 }
    )
  }
}

// GET - Get webhook info
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
    
    // Only super owner and owner can get webhook info
    if (session.role !== 'super owner' && session.role !== 'owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can get webhook info' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    // Get bot token and webhook URL
    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const botToken = botSettings?.botToken || process.env.TELEGRAM_BOT_TOKEN

    if (!botToken) {
      return NextResponse.json({
        status: false,
        reason: 'Bot token not found'
      })
    }

    // Get webhook info from Telegram
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    const response = await fetch(telegramApiUrl)
    const result = await response.json()

    return NextResponse.json({
      status: true,
      data: {
        webhookUrl: botSettings?.webhookUrl || '',
        telegramInfo: result
      }
    })
  } catch (error) {
    console.error('Error getting webhook info:', error)
    return NextResponse.json(
      { status: false, reason: 'Error getting webhook info' },
      { status: 500 }
    )
  }
}

