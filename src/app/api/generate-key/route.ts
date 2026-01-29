import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

async function getSession(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    const token = request.cookies.get('admin-token')?.value
    
    if (!token) {
      return null
    }
    
    const session = await db.collection('admin_sessions').findOne({
      token,
      expiresAt: { $gt: new Date().toISOString() }
    })
    
    return session
  } catch (error) {
    console.error('Auth verification error:', error)
    return null
  }
}

function generateKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session) {
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
    const { maxDevices, expiryDate, duration, durationType, price, customKeyName, keyType } = body

    const client = await clientPromise
    const db = client.db('nexpanel')
    const keys = db.collection('keys')
    const settings = db.collection('settings')
    const users = db.collection('users')

    const globalSettings = await settings.findOne({}) || {
      pricePerDay: parseFloat(process.env.DEFAULT_PRICE_PER_DAY || '10')
    }

    const currentUser = await users.findOne({ username: session.username })
    if (!currentUser) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'User not found',
      }, { status: 404 })
    }

    let days = duration
    let totalPrice = price
    const durationTypeValue = durationType || 'days'
    
    if (!days || !totalPrice) {
      const expiry = expiryDate ? new Date(expiryDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      expiry.setHours(0, 0, 0, 0)
      
      days = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const pricePerDay = globalSettings.pricePerDay || 10
      totalPrice = days * pricePerDay
    }

    const userBalance = typeof currentUser.balance === 'number' ? currentUser.balance : 0
    
    if (userBalance < totalPrice) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: `Insufficient balance. Required: ${totalPrice.toFixed(2)}, Available: ${userBalance.toFixed(2)}`,
      }, { status: 400 })
    }

    // Check if user's server is off (including parent users)
    const checkUserServerStatus = async (username: string, visited: Set<string> = new Set()): Promise<{ isOff: boolean; message?: string }> => {
      try {
        // Prevent infinite loops from circular references
        if (visited.has(username)) {
          return { isOff: false }
        }
        visited.add(username)
        
        const user = await users.findOne({ username })
        if (!user) {
          return { isOff: false }
        }
        
        // Check current user's server status (default: true/on)
        const serverStatus = user.serverStatus !== false
        if (!serverStatus) {
          return { 
            isOff: true, 
            message: 'Your server is turned OFF. Key generation is blocked. Please contact administrator.' 
          }
        }
        
        // Check parent user's server status recursively
        if (user.createdBy && user.createdBy !== username) {
          const parentResult = await checkUserServerStatus(user.createdBy, visited)
          if (parentResult.isOff) {
            return { 
              isOff: true, 
              message: 'Your parent user\'s server is turned OFF. Key generation is blocked. Please contact administrator.' 
            }
          }
        }
        
        return { isOff: false }
      } catch (err) {
        console.error('Error checking user server status:', err)
        // If there's an error, allow the operation to continue (fail open)
        return { isOff: false }
      }
    }

    const serverStatusCheck = await checkUserServerStatus(session.username)
    if (serverStatusCheck.isOff) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: serverStatusCheck.message || 'Server is turned OFF. Key generation is blocked.',
      }, { status: 403 })
    }

    // Generate key based on keyType
    let key = ''
    
    if (keyType === 'custom' && customKeyName && customKeyName.trim()) {
      // Use custom key name exactly as provided (trim whitespace only)
      let customKey = customKeyName.trim()
      
      // Validate custom key name - minimum 4 characters
      if (customKey.length < 4) {
        return NextResponse.json({
          status: false,
          data: null,
          reason: 'Custom key name must be at least 4 characters long',
        }, { status: 400 })
      }
      
      // Use the exact custom name as provided (no sanitization, no padding)
      key = customKey
    } else if (keyType === 'name') {
      // Generate name key format: {duration}{type}>{username}-{random5-6chars}
      // Example: 5H>ENGINEHOST-ICX5E or 1D>ENGINEHOST-ICX5E
      // Use the original duration value from request, not calculated days
      const durationValue = duration || days || 1
      const durationTypeValue = durationType || 'days'
      const durationPrefix = durationTypeValue === 'hours' ? 'H' : 'D'
      
      // Get username from session
      const username = session.username || 'USER'
      
      // Generate random 5-6 character alphanumeric string
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      const randomLength = Math.floor(Math.random() * 2) + 5 // 5 or 6 characters
      let randomSuffix = ''
      for (let i = 0; i < randomLength; i++) {
        randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      
      // Format: {duration}{type}>{username}-{random}
      key = `${durationValue}${durationPrefix}>${username}-${randomSuffix}`
    } else if (keyType === 'random' || !keyType) {
      // Generate random key
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      for (let i = 0; i < 16; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length))
      }
    } else {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Invalid key type. Please select Random Key, Name Key, or Custom Key',
      }, { status: 400 })
    }

    // Check if key already exists, if so generate a new one
    let attempts = 0
    while (attempts < 10) {
      const existingKey = await keys.findOne({ key })
      if (!existingKey) {
        break
      }
      
      // If custom key already exists, append random suffix
      if (keyType === 'custom' && customKeyName && customKeyName.trim()) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let suffix = ''
        for (let i = 0; i < 4; i++) {
          suffix += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        key = key.substring(0, 12) + suffix
      } else if (keyType === 'name') {
        // For name key, regenerate with new random suffix
        // Use the original duration value from request, not calculated days
        const durationValue = duration || days || 1
        const durationTypeValue = durationType || 'days'
        const durationPrefix = durationTypeValue === 'hours' ? 'H' : 'D'
        const username = session.username || 'USER'
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        const randomLength = Math.floor(Math.random() * 2) + 5 // 5 or 6 characters
        let randomSuffix = ''
        for (let i = 0; i < randomLength; i++) {
          randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        key = `${durationValue}${durationPrefix}>${username}-${randomSuffix}`
      } else {
        // Generate completely new random key
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        key = ''
        for (let i = 0; i < 16; i++) {
          key += chars.charAt(Math.floor(Math.random() * chars.length))
        }
      }
      attempts++
    }
    
    if (attempts >= 10) {
      return NextResponse.json({
        status: false,
        data: null,
        reason: 'Unable to generate unique key, please try again',
      }, { status: 400 })
    }

    // Calculate expiry date - but don't set it yet, will be set when key is first used
    // For now, set a placeholder date far in future
    const placeholderExpiryDate = new Date('2099-12-31').toISOString().split('T')[0]

    const newBalance = userBalance - totalPrice
    await users.updateOne(
      { username: session.username },
      { $set: { balance: newBalance } }
    )

    const keyData = {
      key,
      maxDevices: maxDevices || 1,
      currentDevices: 0,
      expiryDate: placeholderExpiryDate, // Placeholder - will be set when key is first used
      createdAt: new Date().toISOString(),
      isActive: true,
      price: totalPrice,
      duration: days,
      durationType: durationTypeValue,
      createdBy: session.username,
      activatedAt: null, // Will be set when key is first used
    }

    await keys.insertOne(keyData)

    try {
      const activities = db.collection('activities')
      await activities.insertOne({
        action: 'key_created',
        details: `Key: ${key.substring(0, 8)}... | Price: ${totalPrice.toFixed(2)} | Duration: ${days} ${durationTypeValue === 'hours' ? 'hours' : 'days'} | Status: Pending Activation`,
        userId: session.username,
        ipAddress: 'unknown',
        timestamp: new Date().toISOString(),
        type: 'system'
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }

    return NextResponse.json({
      status: true,
      data: {
        ...keyData,
        newBalance: newBalance,
      },
      reason: 'Key generated successfully',
    })
  } catch (error) {
    console.error('Error generating key:', error)
    return NextResponse.json({
      status: false,
      data: null,
      reason: 'Error generating key',
    }, { status: 500 })
  }
}
