import { NextRequest, NextResponse } from 'next/server'
import { Telegraf, Context } from 'telegraf'
import clientPromise from '@/lib/mongodb'
import dotenv from 'dotenv'

dotenv.config()

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Import functions from bot.ts (will be shared)
async function getUserBalance(username: string): Promise<number> {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const users = db.collection('users')
    const user = await users.findOne({ username })
    return typeof user?.balance === 'number' ? user.balance : 0
  } catch (error) {
    console.error('Error getting user balance:', error)
    return 0
  }
}

async function getUserKeys(username: string): Promise<any[]> {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const keys = db.collection('keys')
    const keysData = await keys.find({ createdBy: username }).sort({ createdAt: -1 }).toArray()
    return keysData
  } catch (error) {
    console.error('Error getting user keys:', error)
    return []
  }
}

function formatKeyInfo(key: any): string {
  const isActivated = key.activatedAt ? '✅ Activated' : '⏳ Pending'
  const expiryStatus = key.activatedAt ? 
    (new Date(key.expiryDate) > new Date() ? '✅ Active' : '❌ Expired') : 
    '⏳ Not Activated'
  const devicesInfo = `${key.currentDevices}/${key.maxDevices} devices`
  const durationInfo = `${key.duration} ${key.durationType === 'hours' ? 'hours' : 'days'}`
  return `🔑 Key: \`${key.key}\`
📊 Status: ${isActivated} | ${expiryStatus}
📱 Devices: ${devicesInfo}
⏰ Duration: ${durationInfo}
💰 Price: ${key.price?.toFixed(2) || '0.00'}
📅 Created: ${new Date(key.createdAt).toLocaleDateString()}
`
}

// Helper function to generate random key
function generateRandomKey(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Helper function to generate name key
function generateNameKey(duration: number, durationType: 'hours' | 'days', username: string): string {
  const durationPrefix = durationType === 'hours' ? 'H' : 'D'
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const randomLength = Math.floor(Math.random() * 2) + 5 // 5 or 6 characters
  let randomSuffix = ''
  for (let i = 0; i < randomLength; i++) {
    randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${duration}${durationPrefix}>${username.toUpperCase()}-${randomSuffix}`
}

// Function to generate key
async function generateKey(
  username: string,
  maxDevices: number,
  duration: number,
  durationType: 'hours' | 'days',
  keyType: 'random' | 'name' | 'custom',
  customKeyName?: string
): Promise<{ success: boolean; data?: any; reason?: string }> {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const keys = db.collection('keys')
    const settings = db.collection('settings')
    const users = db.collection('users')

    const globalSettings = await settings.findOne({}) || {
      pricePerDay: parseFloat(process.env.DEFAULT_PRICE_PER_DAY || '10')
    }

    const currentUser = await users.findOne({ username })
    if (!currentUser) {
      return { success: false, reason: 'User not found' }
    }

    let days = duration
    const pricePerDay = globalSettings.pricePerDay || 10
    let totalPrice: number
    
    if (durationType === 'hours') {
      totalPrice = (pricePerDay / 24) * duration
      days = duration / 24
    } else {
      totalPrice = days * pricePerDay
    }

    const userBalance = typeof currentUser.balance === 'number' ? currentUser.balance : 0

    if (userBalance < totalPrice) {
      return {
        success: false,
        reason: `Insufficient balance. Required: ${totalPrice.toFixed(2)}, Available: ${userBalance.toFixed(2)}`
      }
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

    const serverStatusCheck = await checkUserServerStatus(username)
    if (serverStatusCheck.isOff) {
      return {
        success: false,
        reason: serverStatusCheck.message || 'Server is turned OFF. Key generation is blocked.'
      }
    }

    // Generate key based on keyType
    let key = ''
    
    if (keyType === 'custom' && customKeyName && customKeyName.trim()) {
      let customKey = customKeyName.trim()
      if (customKey.length < 4) {
        return { success: false, reason: 'Custom key name must be at least 4 characters long' }
      }
      key = customKey
    } else if (keyType === 'name') {
      key = generateNameKey(duration, durationType, username)
    } else {
      key = generateRandomKey(16)
    }

    // Check if key already exists
    let attempts = 0
    while (attempts < 10) {
      const existingKey = await keys.findOne({ key })
      if (!existingKey) {
        break
      }
      
      if (keyType === 'custom' && customKeyName && customKeyName.trim()) {
        const suffix = generateRandomKey(4)
        key = key.substring(0, 12) + suffix
      } else if (keyType === 'name') {
        key = generateNameKey(duration, durationType, username)
      } else {
        key = generateRandomKey(16)
      }
      attempts++
    }

    if (attempts >= 10) {
      return { success: false, reason: 'Unable to generate unique key, please try again' }
    }

    const placeholderExpiryDate = new Date('2099-12-31').toISOString().split('T')[0]

    const newBalance = userBalance - totalPrice
    await users.updateOne(
      { username },
      { $set: { balance: newBalance } }
    )

    const keyData = {
      key,
      maxDevices: maxDevices || 1,
      currentDevices: 0,
      expiryDate: placeholderExpiryDate,
      createdAt: new Date().toISOString(),
      isActive: true,
      price: totalPrice,
      duration: days,
      durationType: durationType,
      createdBy: username,
      activatedAt: null,
    }

    await keys.insertOne(keyData)

    // Log activity
    try {
      const activities = db.collection('activities')
      await activities.insertOne({
        action: 'key_created',
        details: `Key: ${key.substring(0, 8)}... | Price: ${totalPrice.toFixed(2)} | Duration: ${duration} ${durationType} | Status: Pending Activation | Source: Telegram Bot`,
        userId: username,
        ipAddress: 'telegram-bot',
        timestamp: new Date().toISOString(),
        type: 'system'
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }

    return {
      success: true,
      data: {
        ...keyData,
        newBalance: newBalance,
      }
    }
  } catch (error) {
    console.error('Error generating key:', error)
    return { success: false, reason: 'Error generating key' }
  }
}

// Helper function to get bot token from database
async function getBotToken(): Promise<string | null> {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    
    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const token = botSettings?.botToken || process.env.TELEGRAM_BOT_TOKEN || ''
    
    return token || null
  } catch (error) {
    console.error('Error getting bot token:', error)
    return process.env.TELEGRAM_BOT_TOKEN || null
  }
}

// Helper function to get user from database using Telegram Chat ID
async function getUserByChatId(chatId: number) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const users = db.collection('users')
    
    const user = await users.findOne({ 
      $or: [
        { telegram_chat_id: chatId.toString() },
        { telegram_id: chatId }
      ]
    })
    return user
  } catch (error) {
    console.error('Error getting user by chat ID:', error)
    return null
  }
}

// Helper function to check account status
async function checkAccountStatus(user: any): Promise<{ valid: boolean; message?: string }> {
  // Check if account is deleted
  if (!user || user.deleted || user.deletedAt) {
    return {
      valid: false,
      message: '❌ Your account has been deleted. Please contact the administrator.'
    }
  }

  // Check if account is disabled
  if (user.isActive === false || user.disabled === true) {
    return {
      valid: false,
      message: '❌ Your account has been disabled. Please contact the administrator.'
    }
  }

  // Check account expiry date - check multiple possible field names (prioritize accountExpiryDate)
  const expiryDateValue = user.accountExpiryDate ||
                          user.account_expiry_date ||
                          user.expiryDate || 
                          user.expiry_date || 
                          user.expiresAt || 
                          user.expires_at || 
                          user.accountExpiry || 
                          user.account_expiry
  
  if (expiryDateValue) {
    try {
      const expiryDate = new Date(expiryDateValue)
      // Check if date is valid
      if (!isNaN(expiryDate.getTime())) {
        const now = new Date()
        
        if (expiryDate < now) {
          return {
            valid: false,
            message: `❌ Your account has expired on ${expiryDate.toLocaleDateString()}. Please contact the administrator to renew your account.`
          }
        }
      }
    } catch (error) {
      console.error('Error parsing expiry date:', error)
    }
  }

  return { valid: true }
}

// Helper function to verify user has permission (chat ID matches)
async function verifyUserPermission(chatId: number): Promise<{ allowed: boolean; user?: any; accountMessage?: string }> {
  const user = await getUserByChatId(chatId)
  
  if (!user) {
    return { allowed: false }
  }
  
  const userChatId = user.telegram_chat_id || user.telegram_id
  
  if (!userChatId || userChatId.toString() !== chatId.toString()) {
    return { allowed: false, user }
  }

  // Check account status
  const accountStatus = await checkAccountStatus(user)
  if (!accountStatus.valid) {
    return { allowed: false, user, accountMessage: accountStatus.message }
  }
  
  return { allowed: true, user }
}

// Helper function to check maintenance mode
async function checkMaintenanceMode(role: string): Promise<{ inMaintenance: boolean; message?: string }> {
  // Super owner is never affected by maintenance mode
  if (role === 'super owner') {
    return { inMaintenance: false }
  }

  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')

    const botSettings = await settings.findOne({ type: 'telegram_bot' })
    const maintenanceMode = botSettings?.maintenanceMode || false
    const maintenanceMessage = botSettings?.maintenanceMessage || '⚠️ Bot is currently under maintenance. Please try again later.'

    if (maintenanceMode) {
      return {
        inMaintenance: true,
        message: maintenanceMessage
      }
    }

    return { inMaintenance: false }
  } catch (error) {
    console.error('Error checking maintenance mode:', error)
    return { inMaintenance: false }
  }
}

// Helper function to update user chat ID
async function updateUserChatId(username: string, chatId: number, telegramUsername?: string, firstName?: string) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const users = db.collection('users')
    
    await users.updateOne(
      { username },
      { 
        $set: { 
          telegram_chat_id: chatId.toString(),
          telegram_id: chatId,
          telegram_username: telegramUsername || '',
          telegram_first_name: firstName || '',
          telegram_updated_at: new Date().toISOString()
        } 
      }
    )
    return true
  } catch (error) {
    console.error('Error updating user chat ID:', error)
    return false
  }
}

// Initialize bot instance
let botInstance: Telegraf | null = null

async function getBotInstance(): Promise<Telegraf | null> {
  if (botInstance) {
    return botInstance
  }

  const token = await getBotToken()
  if (!token) {
    console.error('Bot token not found')
    return null
  }

  botInstance = new Telegraf(token)
  registerBotHandlers(botInstance)
  
  return botInstance
}

// Register bot handlers
function registerBotHandlers(bot: Telegraf) {
  // Start command
  bot.start(async (ctx: Context) => {
    const chatId = ctx.from?.id
    const telegramUsername = ctx.from?.username
    const firstName = ctx.from?.first_name || 'User'

    if (!chatId) {
      return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
    }

    // First get user to check role for maintenance mode
    const tempUser = await getUserByChatId(chatId)
    const tempUserRole = tempUser?.role || ''

    // Check maintenance mode (super owner bypass)
    const maintenance = await checkMaintenanceMode(tempUserRole)
    if (maintenance.inMaintenance) {
      return ctx.reply(maintenance.message || '⚠️ Bot is currently under maintenance. Please try again later.')
    }

    const { allowed, user, accountMessage } = await verifyUserPermission(chatId)
    
    // Check account status first
    if (accountMessage) {
      return ctx.reply(accountMessage, { parse_mode: 'HTML' })
    }
    
    if (!allowed) {
      if (user) {
        return ctx.reply(
          `👋 Welcome ${firstName}!\n\n` +
          `❌ Your Telegram Chat ID doesn't match your account.\n\n` +
          `Please update your Chat ID in the panel Settings page:\n` +
          `1. Go to Settings\n` +
          `2. Enter your Chat ID: <code>${chatId}</code>\n` +
          `3. Click "Save Chat ID"\n` +
          `4. Try again\n\n` +
          `Your Chat ID: <code>${chatId}</code>`,
          { parse_mode: 'HTML' }
        )
      } else {
        return ctx.reply(
          `👋 Welcome ${firstName}!\n\n` +
          `❌ Your Telegram account is not linked to a panel account.\n\n` +
          `To use this bot:\n` +
          `1. Register or login to the panel first\n` +
          `2. Go to Settings page\n` +
          `3. Enter your Chat ID: <code>${chatId}</code>\n` +
          `4. Click "Save Chat ID"\n` +
          `5. Come back and try again\n\n` +
          `Your Chat ID: <code>${chatId}</code>`,
          { parse_mode: 'HTML' }
        )
      }
    }

    if (user.username) {
      await updateUserChatId(user.username, chatId, telegramUsername || '', firstName)
    }

    const userRole = user.role || 'reseller'
    const welcomeMessage = `👋 Welcome ${user.username || firstName}!\n\n` +
      `🔑 <b>Vip Panel Key Generator Bot</b>\n\n` +
      `Role: <b>${userRole}</b>\n\n` +
      `Use the keyboard buttons below to access all features:`

    ctx.reply(welcomeMessage, { 
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(userRole)
    })
  })

  // Help command
  bot.command('help', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!
    const userRole = user.role || 'reseller'

    let helpMessage = `📚 <b>Bot Commands & Help</b>\n\n` +
      `<b>🎯 Keyboard Buttons:</b>\n` +
      `Use the keyboard buttons below to quickly access features.\n\n` +
      `<b>📋 Basic Commands:</b>\n` +
      `• /start - Start the bot and show main menu\n` +
      `• /help - Show this help message\n` +
      `• /balance - Check your account balance\n` +
      `• /myaccountinfo - View your account information\n\n` +
      `<b>🔑 Key Generation Commands:</b>\n` +
      `• /generate - Show key generation menu\n` +
      `• /gen random 7 days 1 - Generate random key\n` +
      `• /gen name 7 days 1 - Generate name-based key\n` +
      `• /customkey MYKEY123 7 days 1 - Create custom key with name\n` +
      `• /manualkey YOUR_KEY_TEXT 7 days 1 - Create key with your own text\n\n` +
      `<b>Examples:</b>\n` +
      `<code>/gen random 7 days 1</code>\n` +
      `<code>/gen name 30 days 2</code>\n` +
      `<code>/customkey MYKEY123 7 days 1</code>\n` +
      `<code>/manualkey ABC123XYZ789 30 days 1</code>\n\n` +
      `<b>🔧 Key Management Commands:</b>\n` +
      `• /mykeys - View all your keys\n` +
      `• /keyinfo &lt;key&gt; - View key information\n` +
      `• /deletekey &lt;key&gt; - Delete a key\n` +
      `• /resetkey &lt;key&gt; - Reset devices for a key\n` +
      `• /blockkey &lt;key&gt; - Block/deactivate a key\n` +
      `• /activekey &lt;key&gt; - Activate/unblock a key\n\n` +
      `<b>Examples:</b>\n` +
      `<code>/keyinfo ABC123DEF456GHIJ</code>\n` +
      `<code>/deletekey ABC123DEF456GHIJ</code>\n` +
      `<code>/resetkey ABC123DEF456GHIJ</code>\n\n`

    // Add role-based help
    if (userRole === 'super owner') {
      helpMessage += `<b>⚙️ Advanced Features (Super Owner):</b>\n` +
        `• Advanced Settings - View system settings\n` +
        `• Statistics - View detailed system statistics\n\n`
    } else if (userRole === 'owner') {
      helpMessage += `<b>⚙️ Advanced Features (Owner):</b>\n` +
        `• Statistics - View your statistics\n\n`
    } else if (userRole === 'admin') {
      helpMessage += `<b>⚙️ Advanced Features (Admin):</b>\n` +
        `• View Stats - View basic statistics\n\n`
    }

    helpMessage += `<b>📱 Using Keyboard Buttons:</b>\n` +
      `• Click buttons on keyboard for quick access\n` +
      `• All features available via buttons\n` +
      `• Commands provide more control\n\n` +
      `<b>💡 Tips:</b>\n` +
      `• Use /manualkey for custom key text\n` +
      `• Use /customkey for name-based custom keys\n` +
      `• Check balance before generating keys\n` +
      `• Save your keys securely!\n\n` +
      `<b>Need more help?</b>\n` +
      `Contact administrator or check web panel.`

    ctx.reply(helpMessage, { 
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(userRole)
    })
  })

  // Helper function to check maintenance and account before command
  async function checkBeforeCommand(ctx: Context): Promise<{ allowed: boolean; user?: any; message?: string }> {
    const chatId = ctx.from?.id
    if (!chatId) {
      return { allowed: false, message: '❌ Error: Unable to identify your Telegram Chat ID' }
    }

    // Get user to check role for maintenance mode
    const tempUser = await getUserByChatId(chatId)
    const userRole = tempUser?.role || ''

    // Check maintenance mode (super owner bypass)
    const maintenance = await checkMaintenanceMode(userRole)
    if (maintenance.inMaintenance) {
      return { allowed: false, message: maintenance.message || '⚠️ Bot is currently under maintenance. Please try again later.' }
    }

    const { allowed, user, accountMessage } = await verifyUserPermission(chatId)
    
    if (accountMessage) {
      return { allowed: false, message: accountMessage }
    }

    if (!allowed || !user) {
      return { allowed: false, message: '❌ You don\'t have permission to use this bot. Please update your Chat ID in Settings.' }
    }

    return { allowed: true, user }
  }

  // Helper function to get user balance
  async function getUserBalance(username: string): Promise<number> {
    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const users = db.collection('users')
      
      const user = await users.findOne({ username })
      if (!user) {
        return 0
      }
      
      return typeof user.balance === 'number' ? user.balance : 0
    } catch (error) {
      console.error('Error getting user balance:', error)
      return 0
    }
  }

  // Helper function to get user keys
  async function getUserKeys(username: string): Promise<any[]> {
    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      
      const userKeys = await keys.find({ createdBy: username }).sort({ createdAt: -1 }).toArray()
      return userKeys
    } catch (error) {
      console.error('Error getting user keys:', error)
      return []
    }
  }

  // Helper function to create main menu keyboard (reply keyboard - persistent)
  function getMainMenuKeyboard(role: string = 'reseller') {
    // Base buttons for all roles
    const baseButtons = [
      [
        { text: '📋 My Account Info' },
        { text: '💰 Balance' }
      ],
      [
        { text: '🔑 Generate Key' },
        { text: '📝 My Keys' }
      ],
      [
        { text: '🔄 Reset All Keys' },
        { text: 'ℹ️ Help' }
      ]
    ]

    // Role-based advanced buttons
    const advancedButtons: any[] = []
    
    if (role === 'super owner') {
      // Super owner gets all advanced features
      advancedButtons.push([
        { text: '⚙️ Advanced Settings' },
        { text: '📊 Statistics' }
      ])
    } else if (role === 'owner') {
      // Owner gets some advanced features
      advancedButtons.push([
        { text: '📊 Statistics' }
      ])
    } else if (role === 'admin') {
      // Admin gets limited advanced features
      advancedButtons.push([
        { text: '📊 View Stats' }
      ])
    }

    // Combine buttons
    const keyboardButtons = [...baseButtons, ...advancedButtons]

    return {
      keyboard: keyboardButtons,
      resize_keyboard: true,
      one_time_keyboard: false,
      selective: false
    }
  }

  // Helper function to create generate key keyboard (reply keyboard)
  function getGenerateKeyboard() {
    return {
      keyboard: [
        [
          { text: '🎲 Random Key (7d)' },
          { text: '📝 Name Key (7d)' }
        ],
        [
          { text: '🎲 Random Key (30d)' },
          { text: '📝 Name Key (30d)' }
        ],
        [
          { text: '✏️ Custom Key' },
          { text: '✍️ Manual Key' }
        ],
        [
          { text: '🔙 Main Menu' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  }

  // Helper function to create key management keyboard (reply keyboard)
  function getKeyManagementKeyboard() {
    return {
      keyboard: [
        [
          { text: '🔍 View Key Info' },
          { text: '🗑️ Delete Key' }
        ],
        [
          { text: '🔄 Reset Key' },
          { text: '🚫 Block Key' }
        ],
        [
          { text: '✅ Activate Key' }
        ],
        [
          { text: '🔙 Main Menu' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  }

  // Balance command
  bot.command('balance', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!
    const userRole = user.role || 'reseller'

    const balance = await getUserBalance(user.username)
    
    ctx.reply(
      `💰 <b>Your Balance</b>\n\n` +
      `Username: ${user.username}\n` +
      `Balance: <b>${balance.toFixed(2)}</b>\n\n` +
      `Use keyboard buttons below to create keys.`,
      { 
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(userRole)
      }
    )
  })

  // My Account Info command
  bot.command('myaccountinfo', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    const balance = await getUserBalance(user.username)
    
    // Format expiry date - check multiple possible field names
    let expiryInfo = 'No expiry date set'
    
    // Check all possible expiry date field names (prioritize accountExpiryDate as that's what's used in the API)
    const expiryDateValue = user.accountExpiryDate ||
                           user.account_expiry_date ||
                           user.expiryDate || 
                           user.expiry_date || 
                           user.expiresAt || 
                           user.expires_at || 
                           user.accountExpiry || 
                           user.account_expiry || 
                           user.expiry || 
                           user.validUntil || 
                           user.valid_until
    
    if (expiryDateValue && expiryDateValue !== '' && expiryDateValue !== null && expiryDateValue !== undefined) {
      try {
        const expiryDate = new Date(expiryDateValue)
        // Check if date is valid (not Invalid Date)
        if (!isNaN(expiryDate.getTime()) && expiryDate.toString() !== 'Invalid Date') {
          const now = new Date()
          const isExpired = expiryDate < now
          
          if (isExpired) {
            expiryInfo = `❌ Expired on ${expiryDate.toLocaleDateString()} (${expiryDate.toLocaleTimeString()})`
          } else {
            expiryInfo = `✅ Valid until ${expiryDate.toLocaleDateString()} (${expiryDate.toLocaleTimeString()})`
          }
        } else {
          // If date format is invalid, still show the value for debugging
          expiryInfo = `Date: ${String(expiryDateValue)} (Invalid format)`
        }
      } catch (error) {
        console.error('Error parsing expiry date:', error, 'Value:', expiryDateValue)
        expiryInfo = `Date: ${String(expiryDateValue)} (Parse error)`
      }
    }

    // Get account status
    let accountStatus = '✅ Active'
    if (user.isActive === false || user.disabled === true) {
      accountStatus = '❌ Disabled'
    }
    if (user.deleted || user.deletedAt) {
      accountStatus = '❌ Deleted'
    }

    const userRole = user.role || 'reseller'
    ctx.reply(
      `👤 <b>My Account Information</b>\n\n` +
      `Username: <b>${user.username}</b>\n` +
      `Role: <b>${user.role || 'N/A'}</b>\n` +
      `Balance: <b>${balance.toFixed(2)}</b>\n` +
      `Status: ${accountStatus}\n` +
      `Expiry Date: ${expiryInfo}\n\n` +
      `Use keyboard buttons below to create keys and manage your keys.`,
      { 
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(userRole)
      }
    )
  })

  // My Keys command
  bot.command('mykeys', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    const keys = await getUserKeys(user.username)
    
    if (keys.length === 0) {
      return ctx.reply(
        '📭 You don\'t have any keys yet.\n\nUse /generate to create your first key!',
        { reply_markup: getMainMenuKeyboard() }
      )
    }

    const keysToShow = keys.slice(0, 5) // Show only 5 keys to avoid message too long
    let message = `🔑 <b>Your Keys (${keys.length} total)</b>\n\n`
    
    keysToShow.forEach((key, index) => {
      const status = key.isActive ? '✅ Active' : '❌ Blocked'
      message += `<b>${index + 1}. ${status}</b>\n`
      message += `Key: <code>${key.key}</code>\n`
      message += `Devices: ${key.currentDevices}/${key.maxDevices}\n`
      message += `Duration: ${key.duration} ${key.durationType === 'hours' ? 'hours' : 'days'}\n`
      message += `Price: ${key.price?.toFixed(2) || '0.00'}\n\n`
    })

    if (keys.length > 5) {
      message += `\n... and ${keys.length - 5} more keys\n`
      message += `Use buttons below to manage your keys\n`
    }

    message += `\n<b>Use keyboard buttons below to manage keys:</b>\n`
    message += `• View Key Info - View details of a key\n`
    message += `• Delete Key - Delete a key\n`
    message += `• Reset Key - Reset devices for a key\n`
    message += `• Block Key - Block/deactivate a key\n`
    message += `• Activate Key - Activate/unblock a key`

    const userRole = user.role || 'reseller'
    ctx.reply(message, { 
      parse_mode: 'HTML',
      reply_markup: getKeyManagementKeyboard()
    })
  })

  // Generate command - interactive menu
  bot.command('generate', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }

    const userRole = check.user?.role || 'reseller'
    
    ctx.reply(
      `🔑 <b>Generate Key</b>\n\n` +
      `Select key type from the keyboard buttons below:\n\n` +
      `<b>Quick Generate:</b>\n` +
      `• Random Key (7d) - Random key for 7 days\n` +
      `• Name Key (7d) - Name key for 7 days\n` +
      `• Random Key (30d) - Random key for 30 days\n` +
      `• Name Key (30d) - Name key for 30 days\n\n` +
      `<b>Custom Options:</b>\n` +
      `• Custom Key - Create custom key (use /customkey command)\n` +
      `• Manual Key - Create key with your own text (use /manualkey command)\n\n` +
      `<b>Command Examples:</b>\n` +
      `<code>/gen random 7 days 1</code>\n` +
      `<code>/customkey MYKEY123 7 days 1</code>\n` +
      `<code>/manualkey ABC123XYZ789 30 days 1</code>\n\n` +
      `Click buttons below to generate keys.`,
      { 
        parse_mode: 'HTML',
        reply_markup: getGenerateKeyboard()
      }
    )
  })

  // Gen command - advanced key generation
  bot.command('gen', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length < 4) {
      return ctx.reply(
        `❌ Invalid format!\n\n` +
        `Use: <code>/gen keyType duration durationType maxDevices</code>\n\n` +
        `Example: <code>/gen random 7 days 1</code>`,
        { parse_mode: 'HTML' }
      )
    }

    const [keyType, durationStr, durationType, maxDevicesStr] = args

    if (!['random', 'name'].includes(keyType.toLowerCase())) {
      return ctx.reply('❌ Invalid key type. Use: random or name. For custom keys, use /customkey command.')
    }

    const duration = parseInt(durationStr)
    if (isNaN(duration) || duration < 1) {
      return ctx.reply('❌ Invalid duration. Must be a positive number.')
    }

    if (!['hours', 'days'].includes(durationType.toLowerCase())) {
      return ctx.reply('❌ Invalid duration type. Use: hours or days')
    }

    const maxDevices = parseInt(maxDevicesStr)
    if (isNaN(maxDevices) || maxDevices < 1) {
      return ctx.reply('❌ Invalid max devices. Must be a positive number.')
    }

    // Get settings
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const globalSettings = await settings.findOne({}) || {}

    const loadingMsg = await ctx.reply('⏳ Generating key...')

    const result = await generateKey(
      user.username,
      maxDevices,
      duration,
      durationType.toLowerCase() as 'hours' | 'days',
      keyType.toLowerCase() as 'random' | 'name',
      undefined
    )

    if (result.success && result.data) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      } catch (e) {
        // Ignore if message already deleted
      }
      ctx.reply(
        `✅ <b>Key Generated Successfully!</b>\n\n` +
        formatKeyInfo(result.data) +
        `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
        `🔑 Key: <code>${result.data.key}</code>\n\n` +
        `⚠️ Save this key securely!\n\n` +
        `<b>Quick Actions:</b>\n` +
        `<code>/deletekey ${result.data.key}</code> - Delete\n` +
        `<code>/resetkey ${result.data.key}</code> - Reset devices\n` +
        `<code>/blockkey ${result.data.key}</code> - Block`,
        { parse_mode: 'HTML' }
      )
    } else {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      } catch (e) {
        // Ignore if message already deleted
      }
      ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`)
    }
  })

  // Manual key command - user provides their own key text
  bot.command('manualkey', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length < 4) {
      return ctx.reply(
        `✍️ <b>Manual Key Generation</b>\n\n` +
        `❌ Please provide all required parameters!\n\n` +
        `<b>Usage:</b>\n` +
        `<code>/manualkey YOUR_KEY_TEXT duration durationType maxDevices</code>\n\n` +
        `<b>Examples:</b>\n` +
        `<code>/manualkey ABC123XYZ789 7 days 1</code>\n` +
        `<code>/manualkey MY-CUSTOM-KEY-2024 30 days 2</code>\n` +
        `<code>/manualkey MYKEY12345 7 hours 1</code>\n\n` +
        `<b>Parameters:</b>\n` +
        `• YOUR_KEY_TEXT: Your custom key (letters, numbers, hyphens/underscores only, min 8 chars)\n` +
        `• duration: Number (e.g., 7, 30)\n` +
        `• durationType: "hours" or "days"\n` +
        `• maxDevices: Number of devices (e.g., 1, 2)\n\n` +
        `<b>Note:</b> Key must be unique and at least 8 characters long.`,
        { parse_mode: 'HTML' }
      )
    }

    const [manualKey, durationStr, durationType, maxDevicesStr] = args
    const duration = parseInt(durationStr)
    const maxDevices = parseInt(maxDevicesStr)

    // Validate key
    if (manualKey.length < 8) {
      return ctx.reply('❌ Key must be at least 8 characters long.')
    }

    // Only allow alphanumeric, hyphens, and underscores
    if (!/^[A-Za-z0-9\-_]+$/.test(manualKey)) {
      return ctx.reply('❌ Key can only contain letters, numbers, hyphens (-), and underscores (_).')
    }

    if (isNaN(duration) || duration < 1) {
      return ctx.reply('❌ Invalid duration. Must be a positive number.')
    }

    if (!['hours', 'days'].includes(durationType.toLowerCase())) {
      return ctx.reply('❌ Invalid duration type. Use: hours or days')
    }

    if (isNaN(maxDevices) || maxDevices < 1) {
      return ctx.reply('❌ Invalid max devices. Must be a positive number.')
    }

    // Check if key already exists
    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      
      const existingKey = await keys.findOne({ key: manualKey })
      if (existingKey) {
        return ctx.reply(`❌ Key "${manualKey}" already exists. Please choose a different key.`)
      }
    } catch (error) {
      console.error('Error checking existing key:', error)
      return ctx.reply('❌ Error checking key availability. Please try again.')
    }

    // Get settings
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const globalSettings = await settings.findOne({}) || {}

    const loadingMsg = await ctx.reply('⏳ Creating manual key...')

    // Create manual key directly (similar to generateKey but with user-provided key)
    try {
      const users = db.collection('users')
      const userData = await users.findOne({ username: user.username })
      if (!userData) {
        throw new Error('User not found')
      }

      const userBalance = typeof userData.balance === 'number' ? userData.balance : 0
      
      // Calculate price (you may want to adjust this logic)
      const pricePerDay = 1.0 // Adjust as needed
      const days = durationType.toLowerCase() === 'hours' ? duration / 24 : duration
      const totalPrice = days * pricePerDay * maxDevices

      if (userBalance < totalPrice) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
        } catch (e) {
          // Ignore
        }
        return ctx.reply(
          `❌ Insufficient balance!\n\n` +
          `Required: <b>${totalPrice.toFixed(2)}</b>\n` +
          `Your Balance: <b>${userBalance.toFixed(2)}</b>\n\n` +
          `Please add balance to create this key.`,
          { parse_mode: 'HTML' }
        )
      }

      // Create key data
      const placeholderExpiryDate = new Date('2099-12-31').toISOString().split('T')[0]
      const newBalance = userBalance - totalPrice

      await users.updateOne(
        { username: user.username },
        { $set: { balance: newBalance } }
      )

      const keyData = {
        key: manualKey,
        maxDevices: maxDevices,
        currentDevices: 0,
        expiryDate: placeholderExpiryDate,
        createdAt: new Date().toISOString(),
        isActive: true,
        price: totalPrice,
        duration: duration,
        durationType: durationType.toLowerCase(),
        createdBy: user.username,
        activatedAt: null,
      }

      const keys = db.collection('keys')
      await keys.insertOne(keyData)

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'key_created',
          details: `Manual Key: ${manualKey} | Price: ${totalPrice.toFixed(2)} | Duration: ${duration} ${durationType} | Status: Pending Activation | Source: Telegram Bot`,
          userId: user.username,
          ipAddress: 'telegram-bot',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }

      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      } catch (e) {
        // Ignore if message already deleted
      }

      ctx.reply(
        `✅ <b>Manual Key Created Successfully!</b>\n\n` +
        `<b>Key Details:</b>\n` +
        `🔑 Key: <code>${manualKey}</code>\n` +
        `⏱️ Duration: ${duration} ${durationType}\n` +
        `📱 Max Devices: ${maxDevices}\n` +
        `💰 Price: ${totalPrice.toFixed(2)}\n` +
        `💰 New Balance: ${newBalance.toFixed(2)}\n` +
        `📊 Status: ✅ Active (Pending Activation)\n\n` +
        `⚠️ Save this key securely!\n\n` +
        `<b>Quick Actions:</b>\n` +
        `<code>/keyinfo ${manualKey}</code> - View details\n` +
        `<code>/deletekey ${manualKey}</code> - Delete\n` +
        `<code>/resetkey ${manualKey}</code> - Reset devices\n` +
        `<code>/blockkey ${manualKey}</code> - Block`,
        { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard(user.role || 'reseller') }
      )
    } catch (error) {
      console.error('Error creating manual key:', error)
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      } catch (e) {
        // Ignore
      }
      ctx.reply(`❌ Error creating key: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  // Custom key command
  bot.command('customkey', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      return ctx.reply(
        `❌ Please provide a custom key name!\n\n` +
        `Use: <code>/customkey &lt;key-name&gt; [duration] [durationType] [maxDevices]</code>\n\n` +
        `Example: <code>/customkey MYKEY123 7 days 1</code>`,
        { parse_mode: 'HTML' }
      )
    }

    const customKeyName = args[0]
    const duration = args[1] ? parseInt(args[1]) : 7
    const durationType = (args[2] || 'days').toLowerCase() as 'hours' | 'days'
    const maxDevices = args[3] ? parseInt(args[3]) : 1

    if (customKeyName.length < 4) {
      return ctx.reply('❌ Custom key name must be at least 4 characters long.')
    }

    if (isNaN(duration) || duration < 1) {
      return ctx.reply('❌ Invalid duration. Must be a positive number.')
    }

    if (!['hours', 'days'].includes(durationType)) {
      return ctx.reply('❌ Invalid duration type. Use: hours or days')
    }

    if (isNaN(maxDevices) || maxDevices < 1) {
      return ctx.reply('❌ Invalid max devices. Must be a positive number.')
    }

    // Get settings
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const globalSettings = await settings.findOne({}) || {}

    const loadingMsg = await ctx.reply('⏳ Generating custom key...')

    const result = await generateKey(
      user.username,
      maxDevices,
      duration,
      durationType,
      'custom',
      customKeyName
    )

    if (result.success && result.data) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      } catch (e) {
        // Ignore if message already deleted
      }
      ctx.reply(
        `✅ <b>Custom Key Generated Successfully!</b>\n\n` +
        formatKeyInfo(result.data) +
        `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
        `🔑 Key: <code>${result.data.key}</code>\n\n` +
        `⚠️ Save this key securely!\n\n` +
        `<b>Quick Actions:</b>\n` +
        `<code>/deletekey ${result.data.key}</code> - Delete\n` +
        `<code>/resetkey ${result.data.key}</code> - Reset devices\n` +
        `<code>/blockkey ${result.data.key}</code> - Block`,
        { parse_mode: 'HTML' }
      )
    } else {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      } catch (e) {
        // Ignore if message already deleted
      }
      ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`)
    }
  })

  // Key info command - Get details of a specific key
  bot.command('keyinfo', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      return ctx.reply(
        `❌ Please provide a key!\n\n` +
        `Use: <code>/keyinfo &lt;key&gt;</code>\n\n` +
        `Example: <code>/keyinfo ABC123DEF456GHIJ</code>`,
        { parse_mode: 'HTML' }
      )
    }

    const keyToFind = args[0].trim()

    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')

      const key = await keys.findOne({ key: keyToFind, createdBy: user.username })

      if (!key) {
        return ctx.reply(`❌ Key not found or you don't have permission to view it.`)
      }

      let message = `🔑 <b>Key Information</b>\n\n`
      message += formatKeyInfo(key)
      message += `\n<b>Quick Actions:</b>\n`
      message += `<code>/deletekey ${key.key}</code> - Delete\n`
      message += `<code>/resetkey ${key.key}</code> - Reset devices\n`
      if (key.isActive) {
        message += `<code>/blockkey ${key.key}</code> - Block\n`
      } else {
        message += `<code>/activekey ${key.key}</code> - Activate\n`
      }

      ctx.reply(message, { parse_mode: 'HTML' })
    } catch (error) {
      console.error('Error getting key info:', error)
      ctx.reply('❌ Error getting key information. Please try again.')
    }
  })

  // Delete key command
  bot.command('deletekey', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      return ctx.reply(
        `❌ Please provide a key to delete!\n\n` +
        `Use: <code>/deletekey &lt;key&gt;</code>\n\n` +
        `Example: <code>/deletekey ABC123DEF456GHIJ</code>\n\n` +
        `Use /mykeys to see your keys.`,
        { parse_mode: 'HTML' }
      )
    }

    const keyToDelete = args[0].trim()

    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      const devices = db.collection('devices')

      // Find key by key string
      const key = await keys.findOne({ key: keyToDelete, createdBy: user.username })

      if (!key) {
        return ctx.reply(`❌ Key not found or you don't have permission to delete it.`)
      }

      const keyId = key._id

      // Delete associated devices first
      await devices.deleteMany({ keyId: keyId })

      // Delete the key
      await keys.deleteOne({ _id: keyId })

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'key_deleted',
          details: `Key deleted via Telegram Bot: ${keyToDelete.substring(0, 8)}...`,
          userId: user.username,
          ipAddress: 'telegram-bot',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }

      ctx.reply(
        `✅ <b>Key Deleted Successfully!</b>\n\n` +
        `Key: <code>${keyToDelete}</code>\n` +
        `Status: Deleted`,
        { parse_mode: 'HTML' }
      )
    } catch (error) {
      console.error('Error deleting key:', error)
      ctx.reply('❌ Error deleting key. Please try again.')
    }
  })

  // Reset key command (Reset UUIDs/devices)
  bot.command('resetkey', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      return ctx.reply(
        `❌ Please provide a key to reset!\n\n` +
        `Use: <code>/resetkey &lt;key&gt;</code>\n\n` +
        `Example: <code>/resetkey ABC123DEF456GHIJ</code>\n\n` +
        `This will reset all devices (UUIDs) for this key.\n` +
        `Use /mykeys to see your keys.`,
        { parse_mode: 'HTML' }
      )
    }

    const keyToReset = args[0].trim()

    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      const devices = db.collection('devices')

      // Find key by key string
      const key = await keys.findOne({ key: keyToReset, createdBy: user.username })

      if (!key) {
        return ctx.reply(`❌ Key not found or you don't have permission to reset it.`)
      }

      const keyId = key._id

      // Reset device count
      await keys.updateOne(
        { _id: keyId },
        { $set: { currentDevices: 0 } }
      )

      // Delete all devices (UUIDs) associated with this key
      const deleteResult = await devices.deleteMany({ keyId: keyId })

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'uuids_reset',
          details: `UUIDs reset via Telegram Bot for key: ${keyToReset.substring(0, 8)}...`,
          userId: user.username,
          ipAddress: 'telegram-bot',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }

      ctx.reply(
        `✅ <b>Key Reset Successfully!</b>\n\n` +
        `Key: <code>${keyToReset}</code>\n` +
        `Devices Reset: ${deleteResult.deletedCount} device(s)\n` +
        `Status: All devices cleared, key can be used again.`,
        { parse_mode: 'HTML' }
      )
    } catch (error) {
      console.error('Error resetting key:', error)
      ctx.reply('❌ Error resetting key. Please try again.')
    }
  })

  // Reset all keys command (Reset UUIDs/devices for all keys)
  bot.command('resetallkeys', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')
      const devices = db.collection('devices')

      // Find all keys for this user
      const userKeys = await keys.find({ createdBy: user.username }).toArray()

      if (userKeys.length === 0) {
        return ctx.reply('📭 You don\'t have any keys to reset.')
      }

      const keyIds = userKeys.map((key: any) => key._id)

      // Reset device count for all keys
      const updateResult = await keys.updateMany(
        { _id: { $in: keyIds } },
        { $set: { currentDevices: 0 } }
      )

      // Delete all devices (UUIDs) associated with these keys
      const deleteResult = await devices.deleteMany({ keyId: { $in: keyIds } })

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'all_uuids_reset',
          details: `All UUIDs reset via Telegram Bot for ${userKeys.length} key(s) by ${user.username}`,
          userId: user.username,
          ipAddress: 'telegram-bot',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }

      const userRole = user.role || 'reseller'
      ctx.reply(
        `✅ <b>All Keys Reset Successfully!</b>\n\n` +
        `Keys Reset: ${updateResult.modifiedCount} key(s)\n` +
        `Devices Deleted: ${deleteResult.deletedCount} device(s)\n\n` +
        `Status: All devices cleared for all your keys. All keys can be used again.`,
        { 
          parse_mode: 'HTML',
          reply_markup: getMainMenuKeyboard(userRole)
        }
      )
    } catch (error) {
      console.error('Error resetting all keys:', error)
      ctx.reply('❌ Error resetting all keys. Please try again.')
    }
  })

  // Block key command (Deactivate key)
  bot.command('blockkey', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      return ctx.reply(
        `❌ Please provide a key to block!\n\n` +
        `Use: <code>/blockkey &lt;key&gt;</code>\n\n` +
        `Example: <code>/blockkey ABC123DEF456GHIJ</code>\n\n` +
        `This will deactivate/block the key.\n` +
        `Use /mykeys to see your keys.`,
        { parse_mode: 'HTML' }
      )
    }

    const keyToBlock = args[0].trim()

    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')

      // Find key by key string
      const key = await keys.findOne({ key: keyToBlock, createdBy: user.username })

      if (!key) {
        return ctx.reply(`❌ Key not found or you don't have permission to block it.`)
      }

      // Block the key
      await keys.updateOne(
        { _id: key._id },
        { $set: { isActive: false } }
      )

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'key_disabled',
          details: `Key blocked via Telegram Bot: ${keyToBlock.substring(0, 8)}...`,
          userId: user.username,
          ipAddress: 'telegram-bot',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }

      ctx.reply(
        `✅ <b>Key Blocked Successfully!</b>\n\n` +
        `Key: <code>${keyToBlock}</code>\n` +
        `Status: ❌ Blocked (Inactive)`,
        { parse_mode: 'HTML' }
      )
    } catch (error) {
      console.error('Error blocking key:', error)
      ctx.reply('❌ Error blocking key. Please try again.')
    }
  })

  // Activate key command
  bot.command('activekey', async (ctx: Context) => {
    const check = await checkBeforeCommand(ctx)
    if (!check.allowed) {
      return ctx.reply(check.message || '❌ Error occurred')
    }
    const user = check.user!

    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Invalid command format')
    }

    const args = ctx.message.text.split(' ').slice(1)
    
    if (args.length === 0) {
      return ctx.reply(
        `❌ Please provide a key to activate!\n\n` +
        `Use: <code>/activekey &lt;key&gt;</code>\n\n` +
        `Example: <code>/activekey ABC123DEF456GHIJ</code>\n\n` +
        `This will activate/unblock the key.\n` +
        `Use /mykeys to see your keys.`,
        { parse_mode: 'HTML' }
      )
    }

    const keyToActivate = args[0].trim()

    try {
      const client = await clientPromise
      const db = client.db('nexpanel')
      const keys = db.collection('keys')

      // Find key by key string
      const key = await keys.findOne({ key: keyToActivate, createdBy: user.username })

      if (!key) {
        return ctx.reply(`❌ Key not found or you don't have permission to activate it.`)
      }

      // Activate the key
      await keys.updateOne(
        { _id: key._id },
        { $set: { isActive: true } }
      )

      // Log activity
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'key_enabled',
          details: `Key activated via Telegram Bot: ${keyToActivate.substring(0, 8)}...`,
          userId: user.username,
          ipAddress: 'telegram-bot',
          timestamp: new Date().toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activity:', error)
      }

      ctx.reply(
        `✅ <b>Key Activated Successfully!</b>\n\n` +
        `Key: <code>${keyToActivate}</code>\n` +
        `Status: ✅ Active`,
        { parse_mode: 'HTML' }
      )
    } catch (error) {
      console.error('Error activating key:', error)
      ctx.reply('❌ Error activating key. Please try again.')
    }
  })

  // Note: Callback query handlers removed - we're using reply keyboard (persistent keyboard buttons) now
  // All button interactions are handled via text messages in the message handler below

  // Handle keyboard button clicks (text messages)
  // Note: This handler runs after command handlers, so commands are already handled
  bot.on('message', async (ctx: Context) => {
    try {
      // Only handle text messages
      if (!ctx.message || !('text' in ctx.message) || !ctx.message.text) {
        return // Not a text message, ignore
      }

      const messageText = ctx.message.text.trim()
      
      // Skip if it's a command (commands are already handled by command handlers)
      if (messageText.startsWith('/')) {
        return // Commands already handled
      }

      // Check permissions
      const check = await checkBeforeCommand(ctx)
      if (!check.allowed) {
        // Still show keyboard even if permission check fails (for better UX)
        return ctx.reply(check.message || '❌ Error occurred. Please check your Chat ID in Settings.', {
          reply_markup: getMainMenuKeyboard('reseller')
        })
      }
      
      const user = check.user!
      const userRole = user.role || 'reseller'

      // Handle main menu buttons
      // Normalize button text for comparison
      const buttonText = messageText.trim()
      
      // My Account Info button - check multiple variations
      if (buttonText === '📋 My Account Info' || 
          buttonText === 'My Account Info' || 
          buttonText.toLowerCase().includes('account info') || 
          buttonText.toLowerCase().includes('my account')) {
        // Execute myaccountinfo command logic
        const balance = await getUserBalance(user.username)
        let expiryInfo = 'No expiry date set'
        const expiryDateValue = user.accountExpiryDate ||
                               user.account_expiry_date ||
                               user.expiryDate || 
                               user.expiry_date || 
                               user.expiresAt || 
                               user.expires_at || 
                               user.accountExpiry || 
                               user.account_expiry || 
                               user.expiry || 
                               user.validUntil || 
                               user.valid_until
        
        if (expiryDateValue && expiryDateValue !== '' && expiryDateValue !== null && expiryDateValue !== undefined) {
          try {
            const expiryDate = new Date(expiryDateValue)
            if (!isNaN(expiryDate.getTime()) && expiryDate.toString() !== 'Invalid Date') {
              const now = new Date()
              const isExpired = expiryDate < now
              expiryInfo = isExpired 
                ? `❌ Expired on ${expiryDate.toLocaleDateString()} (${expiryDate.toLocaleTimeString()})`
                : `✅ Valid until ${expiryDate.toLocaleDateString()} (${expiryDate.toLocaleTimeString()})`
            }
          } catch (error) {
            console.error('Error parsing expiry date:', error)
          }
        }

        let accountStatus = '✅ Active'
        if (user.isActive === false || user.disabled === true) {
          accountStatus = '❌ Disabled'
        }
        if (user.deleted || user.deletedAt) {
          accountStatus = '❌ Deleted'
        }

        ctx.reply(
          `👤 <b>My Account Information</b>\n\n` +
          `Username: <b>${user.username}</b>\n` +
          `Role: <b>${user.role || 'N/A'}</b>\n` +
          `Balance: <b>${balance.toFixed(2)}</b>\n` +
          `Status: ${accountStatus}\n` +
          `Expiry Date: ${expiryInfo}`,
          { 
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(userRole)
          }
        )
        return
      }

      // Balance button
      if (buttonText === '💰 Balance' || buttonText === 'Balance' || 
          buttonText.toLowerCase().includes('balance')) {
        const balance = await getUserBalance(user.username)
        ctx.reply(
          `💰 <b>Your Balance</b>\n\n` +
          `Username: ${user.username}\n` +
          `Balance: <b>${balance.toFixed(2)}</b>`,
          { 
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(userRole)
          }
        )
        return
      }

      // Generate Key button
      if (buttonText === '🔑 Generate Key' || buttonText === 'Generate Key' || 
          buttonText.toLowerCase().includes('generate key') || buttonText.toLowerCase().includes('generate')) {
        ctx.reply(
          `🔑 <b>Generate Key</b>\n\n` +
          `Select key type from the keyboard buttons below:\n\n` +
          `<b>Quick Generate:</b>\n` +
          `• Random Key (7d) - Random key for 7 days\n` +
          `• Name Key (7d) - Name key for 7 days\n` +
          `• Random Key (30d) - Random key for 30 days\n` +
          `• Name Key (30d) - Name key for 30 days\n\n` +
          `<b>Custom Options:</b>\n` +
          `• Custom Key - Create custom key (use /customkey command)\n` +
          `• Manual Key - Create key with your own text (use /manualkey command)\n\n` +
          `<b>Command Examples:</b>\n` +
          `<code>/gen random 7 days 1</code>\n` +
          `<code>/customkey MYKEY123 7 days 1</code>\n` +
          `<code>/manualkey ABC123XYZ789 30 days 1</code>\n\n` +
          `Click buttons below to generate keys.`,
          { 
            parse_mode: 'HTML',
            reply_markup: getGenerateKeyboard()
          }
        )
        return
      }

      // Random Key (7d) button
      if (buttonText === '🎲 Random Key (7d)' || buttonText.includes('Random Key (7d)') ||
          (buttonText.toLowerCase().includes('random') && buttonText.includes('7d'))) {
        const loadingMsg = await ctx.reply('⏳ Generating random key...')
        
        const client = await clientPromise
        const db = client.db('nexpanel')
        const settings = db.collection('settings')
        const globalSettings = await settings.findOne({}) || {}

        const result = await generateKey(
          user.username,
          1,
          7,
          'days',
          'random',
          undefined
        )

        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
        } catch (e) {
          // Ignore
        }

        if (result.success && result.data) {
          ctx.reply(
            `✅ <b>Key Generated Successfully!</b>\n\n` +
            formatKeyInfo(result.data) +
            `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
            `🔑 Key: <code>${result.data.key}</code>\n\n` +
            `⚠️ Save this key securely!`,
            {
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        } else {
          ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`, {
            reply_markup: getMainMenuKeyboard(userRole)
          })
        }
        return
      }

      // Random Key (30d) button
      if (buttonText === '🎲 Random Key (30d)' || buttonText.includes('Random Key (30d)') ||
          (buttonText.toLowerCase().includes('random') && buttonText.includes('30d'))) {
        const loadingMsg = await ctx.reply('⏳ Generating random key...')
        
        const client = await clientPromise
        const db = client.db('nexpanel')
        const settings = db.collection('settings')
        const globalSettings = await settings.findOne({}) || {}

        const result = await generateKey(
          user.username,
          1,
          30,
          'days',
          'random',
          undefined
        )

        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
        } catch (e) {
          // Ignore
        }

        if (result.success && result.data) {
          ctx.reply(
            `✅ <b>Key Generated Successfully!</b>\n\n` +
            formatKeyInfo(result.data) +
            `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
            `🔑 Key: <code>${result.data.key}</code>\n\n` +
            `⚠️ Save this key securely!`,
            {
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        } else {
          ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`, {
            reply_markup: getMainMenuKeyboard(userRole)
          })
        }
        return
      }

      // Name Key (7d) button
      if (buttonText === '📝 Name Key (7d)' || buttonText.includes('Name Key (7d)') ||
          (buttonText.toLowerCase().includes('name') && buttonText.includes('7d'))) {
        const loadingMsg = await ctx.reply('⏳ Generating name key...')
        
        const client = await clientPromise
        const db = client.db('nexpanel')
        const settings = db.collection('settings')
        const globalSettings = await settings.findOne({}) || {}

        const result = await generateKey(
          user.username,
          1,
          7,
          'days',
          'name',
          undefined
        )

        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
        } catch (e) {
          // Ignore
        }

        if (result.success && result.data) {
          ctx.reply(
            `✅ <b>Key Generated Successfully!</b>\n\n` +
            formatKeyInfo(result.data) +
            `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
            `🔑 Key: <code>${result.data.key}</code>\n\n` +
            `⚠️ Save this key securely!`,
            {
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        } else {
          ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`, {
            reply_markup: getMainMenuKeyboard(userRole)
          })
        }
        return
      }

      // Name Key (30d) button
      if (buttonText === '📝 Name Key (30d)' || buttonText.includes('Name Key (30d)') ||
          (buttonText.toLowerCase().includes('name') && buttonText.includes('30d'))) {
        const loadingMsg = await ctx.reply('⏳ Generating name key...')
        
        const client = await clientPromise
        const db = client.db('nexpanel')
        const settings = db.collection('settings')
        const globalSettings = await settings.findOne({}) || {}

        const result = await generateKey(
          user.username,
          1,
          30,
          'days',
          'name',
          undefined
        )

        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
        } catch (e) {
          // Ignore
        }

        if (result.success && result.data) {
          ctx.reply(
            `✅ <b>Key Generated Successfully!</b>\n\n` +
            formatKeyInfo(result.data) +
            `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
            `🔑 Key: <code>${result.data.key}</code>\n\n` +
            `⚠️ Save this key securely!`,
            {
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        } else {
          ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`, {
            reply_markup: getMainMenuKeyboard(userRole)
          })
        }
        return
      }

      // Custom Key button
      if (buttonText === '✏️ Custom Key' || buttonText === 'Custom Key' || 
          buttonText.toLowerCase().includes('custom key') || buttonText.toLowerCase().includes('custom')) {
        ctx.reply(
          `✏️ <b>Custom Key Generation</b>\n\n` +
          `To create a custom key, use this command:\n\n` +
          `<code>/customkey YOURKEYNAME 7 days 1</code>\n\n` +
          `Example:\n` +
          `<code>/customkey MYKEY123 7 days 1</code>\n\n` +
          `Format: /customkey &lt;key-name&gt; [duration] [durationType] [maxDevices]`,
          {
            parse_mode: 'HTML',
            reply_markup: getGenerateKeyboard()
          }
        )
        return
      }

      // Manual Key button
      if (buttonText === '✍️ Manual Key' || buttonText === 'Manual Key' || 
          buttonText.toLowerCase().includes('manual key') || buttonText.toLowerCase().includes('manual')) {
        ctx.reply(
          `✍️ <b>Manual Key Generation</b>\n\n` +
          `Create a key with your own custom key text.\n\n` +
          `<b>Usage:</b>\n` +
          `<code>/manualkey YOUR_KEY_TEXT 7 days 1</code>\n\n` +
          `<b>Examples:</b>\n` +
          `<code>/manualkey ABC123XYZ789 7 days 1</code>\n` +
          `<code>/manualkey MY-CUSTOM-KEY-2024 30 days 2</code>\n` +
          `<code>/manualkey MYKEY 7 hours 1</code>\n\n` +
          `<b>Format:</b>\n` +
          `<code>/manualkey &lt;key-text&gt; &lt;duration&gt; &lt;durationType&gt; &lt;maxDevices&gt;</code>\n\n` +
          `<b>Parameters:</b>\n` +
          `• key-text: Your custom key (letters, numbers, hyphens only)\n` +
          `• duration: Number (e.g., 7, 30)\n` +
          `• durationType: "hours" or "days"\n` +
          `• maxDevices: Number of devices (e.g., 1, 2)\n\n` +
          `<b>Note:</b> Key must be unique and at least 8 characters long.`,
          {
            parse_mode: 'HTML',
            reply_markup: getGenerateKeyboard()
          }
        )
        return
      }

      // My Keys button
      if (buttonText === '📝 My Keys' || buttonText === 'My Keys' || 
          buttonText.toLowerCase().includes('my keys') || buttonText.toLowerCase().includes('keys')) {
        const keys = await getUserKeys(user.username)
        
        if (keys.length === 0) {
          return ctx.reply(
            '📭 You don\'t have any keys yet.\n\nUse "Generate Key" button to create your first key!',
            { reply_markup: getMainMenuKeyboard(userRole) }
          )
        }

        const keysToShow = keys.slice(0, 5)
        let message = `🔑 <b>Your Keys (${keys.length} total)</b>\n\n`
        
        keysToShow.forEach((key: any, index: number) => {
          const status = key.isActive ? '✅ Active' : '❌ Blocked'
          message += `<b>${index + 1}. ${status}</b>\n`
          message += `Key: <code>${key.key}</code>\n`
          message += `Devices: ${key.currentDevices}/${key.maxDevices}\n`
          message += `Duration: ${key.duration} ${key.durationType === 'hours' ? 'hours' : 'days'}\n`
          message += `Price: ${key.price?.toFixed(2) || '0.00'}\n\n`
        })

        if (keys.length > 5) {
          message += `\n... and ${keys.length - 5} more keys\n`
        }

        message += `\n<b>Use keyboard buttons below to manage keys:</b>\n`
        message += `• View Key Info - View details of a key\n`
        message += `• Delete Key - Delete a key\n`
        message += `• Reset Key - Reset devices for a key\n`
        message += `• Block Key - Block/deactivate a key\n`
        message += `• Activate Key - Activate/unblock a key\n\n`
        message += `Or use commands:\n`
        message += `<code>/keyinfo &lt;key&gt;</code>\n`
        message += `<code>/deletekey &lt;key&gt;</code>\n`
        message += `<code>/resetkey &lt;key&gt;</code>`

        ctx.reply(message, { 
          parse_mode: 'HTML',
          reply_markup: getKeyManagementKeyboard()
        })
        return
      }

      // Reset All Keys button
      if (buttonText === '🔄 Reset All Keys' || buttonText === 'Reset All Keys' || 
          buttonText.toLowerCase().includes('reset all') || buttonText.toLowerCase().includes('reset all keys')) {
        const loadingMsg = await ctx.reply('⏳ Resetting all keys...')
        
        try {
          const client = await clientPromise
          const db = client.db('nexpanel')
          const keys = db.collection('keys')
          const devices = db.collection('devices')

          const userKeys = await keys.find({ createdBy: user.username }).toArray()

          if (userKeys.length === 0) {
            try {
              await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
            } catch (e) {
              // Ignore
            }
            return ctx.reply(
              '📭 You don\'t have any keys to reset.',
              { reply_markup: getMainMenuKeyboard(userRole) }
            )
          }

          const keyIds = userKeys.map((key: any) => key._id)
          const updateResult = await keys.updateMany(
            { _id: { $in: keyIds } },
            { $set: { currentDevices: 0 } }
          )
          const deleteResult = await devices.deleteMany({ keyId: { $in: keyIds } })

          try {
            const activities = db.collection('activities')
            await activities.insertOne({
              action: 'all_uuids_reset',
              details: `All UUIDs reset via Telegram Bot for ${userKeys.length} key(s) by ${user.username}`,
              userId: user.username,
              ipAddress: 'telegram-bot',
              timestamp: new Date().toISOString(),
              type: 'system'
            })
          } catch (error) {
            console.error('Failed to log activity:', error)
          }

          try {
            await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
          } catch (e) {
            // Ignore
          }

          ctx.reply(
            `✅ <b>All Keys Reset Successfully!</b>\n\n` +
            `Keys Reset: ${updateResult.modifiedCount} key(s)\n` +
            `Devices Deleted: ${deleteResult.deletedCount} device(s)\n\n` +
            `Status: All devices cleared for all your keys. All keys can be used again.`,
            { 
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        } catch (error) {
          console.error('Error resetting all keys:', error)
          ctx.reply('❌ Error resetting all keys. Please try again.', {
            reply_markup: getMainMenuKeyboard(userRole)
          })
        }
        return
      }

      // Help button
      if (buttonText === 'ℹ️ Help' || buttonText === 'Help' || 
          buttonText.toLowerCase().includes('help')) {
        let helpMessage = `📚 <b>Bot Commands & Help</b>\n\n` +
          `<b>🎯 Keyboard Buttons:</b>\n` +
          `Use the keyboard buttons below to quickly access features.\n\n` +
          `<b>📋 Basic Commands:</b>\n` +
          `• /start - Start the bot and show main menu\n` +
          `• /help - Show this help message\n` +
          `• /balance - Check your account balance\n` +
          `• /myaccountinfo - View your account information\n\n` +
          `<b>🔑 Key Generation Commands:</b>\n` +
          `• /generate - Show key generation menu\n` +
          `• /gen random 7 days 1 - Generate random key\n` +
          `• /gen name 7 days 1 - Generate name-based key\n` +
          `• /customkey MYKEY123 7 days 1 - Create custom key with name\n` +
          `• /manualkey YOUR_KEY_TEXT 7 days 1 - Create key with your own text\n\n` +
          `<b>Examples:</b>\n` +
          `<code>/gen random 7 days 1</code>\n` +
          `<code>/gen name 30 days 2</code>\n` +
          `<code>/customkey MYKEY123 7 days 1</code>\n` +
          `<code>/manualkey ABC123XYZ789 30 days 1</code>\n\n` +
          `<b>🔧 Key Management Commands:</b>\n` +
          `• /mykeys - View all your keys\n` +
          `• /keyinfo &lt;key&gt; - View key information\n` +
          `• /deletekey &lt;key&gt; - Delete a key\n` +
          `• /resetkey &lt;key&gt; - Reset devices for a key\n` +
          `• /blockkey &lt;key&gt; - Block/deactivate a key\n` +
          `• /activekey &lt;key&gt; - Activate/unblock a key\n\n` +
          `<b>Examples:</b>\n` +
          `<code>/keyinfo ABC123DEF456GHIJ</code>\n` +
          `<code>/deletekey ABC123DEF456GHIJ</code>\n` +
          `<code>/resetkey ABC123DEF456GHIJ</code>\n\n`

        if (userRole === 'super owner') {
          helpMessage += `<b>⚙️ Advanced Features (Super Owner):</b>\n` +
            `• Advanced Settings - View system settings\n` +
            `• Statistics - View detailed system statistics\n\n`
        } else if (userRole === 'owner') {
          helpMessage += `<b>⚙️ Advanced Features (Owner):</b>\n` +
            `• Statistics - View your statistics\n\n`
        } else if (userRole === 'admin') {
          helpMessage += `<b>⚙️ Advanced Features (Admin):</b>\n` +
            `• View Stats - View basic statistics\n\n`
        }

        helpMessage += `<b>📱 Using Keyboard Buttons:</b>\n` +
          `• Click buttons on keyboard for quick access\n` +
          `• All features available via buttons\n` +
          `• Commands provide more control\n\n` +
          `<b>💡 Tips:</b>\n` +
          `• Use /manualkey for custom key text\n` +
          `• Use /customkey for name-based custom keys\n` +
          `• Check balance before generating keys\n` +
          `• Save your keys securely!\n\n` +
          `<b>Need more help?</b>\n` +
          `Contact administrator or check web panel.`

        ctx.reply(helpMessage, { 
          parse_mode: 'HTML',
          reply_markup: getMainMenuKeyboard(userRole)
        })
        return
      }

      // Main Menu button
      if (buttonText === '🏠 Main Menu' || buttonText === 'Main Menu' || 
          buttonText === '🔙 Main Menu' || buttonText.toLowerCase().includes('main menu')) {
        const welcomeMessage = `🏠 <b>Main Menu</b>\n\n` +
          `Welcome ${user.username || 'User'}!\n\n` +
          `Select an option from the keyboard below:`

        ctx.reply(welcomeMessage, {
          parse_mode: 'HTML',
          reply_markup: getMainMenuKeyboard(userRole)
        })
        return
      }

      // Role-based advanced features
      if (userRole === 'super owner' && (buttonText === '⚙️ Advanced Settings' || buttonText === 'Advanced Settings' || 
          buttonText.toLowerCase().includes('advanced settings') || buttonText.toLowerCase().includes('advanced'))) {
        try {
          const client = await clientPromise
          const db = client.db('nexpanel')
          const settings = db.collection('settings')
          const globalSettings = await settings.findOne({}) || {
            credit: process.env.DEFAULT_GLOBAL_CREDIT || 'Alex bhai',
            announcement: process.env.DEFAULT_GLOBAL_ANNOUNCEMENT || 'Welcome to NexPanel',
            announcementmode: false,
            maintenancemode: false,
            maintenancemessage: ''
          }

          // Check maintenance mode
          const maintenanceMode = globalSettings.maintenancemode || false
          const maintenanceMessage = globalSettings.maintenancemessage || 'Bot is currently under maintenance.'

          // Get bot settings
          const botSettings: any = await settings.findOne({ type: 'telegram_bot' }) || {}
          const botToken = botSettings?.botToken ? '✅ Configured' : '❌ Not configured'
          const botStatus = botSettings?.botToken ? '✅ Active' : '❌ Inactive'

          // Get system stats
          const users = db.collection('users')
          const keys = db.collection('keys')
          const totalUsers = await users.countDocuments({})
          const totalKeys = await keys.countDocuments({})
          const activeKeys = await keys.countDocuments({ isActive: true })

          let settingsMessage = `⚙️ <b>Advanced Settings</b>\n\n` +
            `<b>🔧 System Settings:</b>\n` +
            `📝 Global Credit: <code>${globalSettings.credit || 'N/A'}</code>\n` +
            `📢 Announcement: ${globalSettings.announcementmode ? '✅ Enabled' : '❌ Disabled'}\n` +
            `🔧 Maintenance Mode: ${maintenanceMode ? '⚠️ Enabled' : '✅ Disabled'}\n` +
            `${maintenanceMode ? `📝 Maintenance Message: ${maintenanceMessage}\n` : ''}\n` +
            `<b>🤖 Bot Settings:</b>\n` +
            `🔑 Bot Token: ${botToken}\n` +
            `📊 Bot Status: ${botStatus}\n\n` +
            `<b>📈 System Overview:</b>\n` +
            `👥 Total Users: <b>${totalUsers}</b>\n` +
            `🔑 Total Keys: <b>${totalKeys}</b>\n` +
            `✅ Active Keys: <b>${activeKeys}</b>\n\n` +
            `<b>💡 Configuration:</b>\n` +
            `Use the admin panel web interface to modify these settings:\n` +
            `• Global Credit Text\n` +
            `• Announcement Settings\n` +
            `• Maintenance Mode\n` +
            `• Bot Configuration\n\n` +
            `<b>📋 Quick Commands:</b>\n` +
            `<code>/help</code> - Show all commands\n` +
            `<code>/statistics</code> - View statistics\n\n` +
            `<b>🌐 Web Panel:</b>\n` +
            `For advanced configuration, please use the web admin panel.`

          ctx.reply(settingsMessage, {
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(userRole)
          })
        } catch (error) {
          console.error('Error loading advanced settings:', error)
          ctx.reply(
            `❌ Error loading settings. Please try again later.\n\n` +
            `Use the admin panel for advanced configuration.`,
            {
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        }
        return
      }

      // Statistics/View Stats button
      if ((userRole === 'super owner' || userRole === 'owner' || userRole === 'admin') && 
          (buttonText === '📊 Statistics' || buttonText === 'Statistics' || buttonText === '📊 View Stats' || 
           buttonText === 'View Stats' || buttonText.toLowerCase().includes('statistics') || 
           buttonText.toLowerCase().includes('view stats') || buttonText.toLowerCase().includes('stats'))) {
        try {
          const loadingMsg = await ctx.reply('⏳ Loading statistics...')
          
          const client = await clientPromise
          const db = client.db('nexpanel')
          const users = db.collection('users')
          const keys = db.collection('keys')
          const devices = db.collection('devices')
          const activities = db.collection('activities')

          // Get statistics based on role
          let statsMessage = `📊 <b>Statistics</b>\n\n`
          
          if (userRole === 'super owner') {
            // Super Owner: Full system statistics
            const totalUsers = await users.countDocuments({})
            const totalKeys = await keys.countDocuments({})
            const activeKeys = await keys.countDocuments({ isActive: true })
            const blockedKeys = await keys.countDocuments({ isActive: false })
            const totalDevices = await devices.countDocuments({})
            
            // Get recent activities count (last 24 hours)
            const yesterday = new Date()
            yesterday.setHours(yesterday.getHours() - 24)
            const recentActivities = await activities.countDocuments({
              timestamp: { $gte: yesterday.toISOString() }
            })
            
            // Calculate total revenue from keys
            const allKeys = await keys.find({}).toArray()
            const totalRevenue = allKeys.reduce((sum: number, key: any) => sum + (key.price || 0), 0)
            
            statsMessage += `<b>📈 System Overview:</b>\n` +
              `👥 Total Users: <b>${totalUsers}</b>\n` +
              `🔑 Total Keys: <b>${totalKeys}</b>\n` +
              `✅ Active Keys: <b>${activeKeys}</b>\n` +
              `❌ Blocked Keys: <b>${blockedKeys}</b>\n` +
              `📱 Total Devices: <b>${totalDevices}</b>\n` +
              `💰 Total Revenue: <b>${totalRevenue.toFixed(2)}</b>\n` +
              `📊 Recent Activities (24h): <b>${recentActivities}</b>\n\n`
            
            // User's own statistics
            const userKeys = await keys.find({ createdBy: user.username }).toArray()
            const userActiveKeys = userKeys.filter((k: any) => k.isActive).length
            const userDevices = await devices.countDocuments({ userId: user.username })
            const userRevenue = userKeys.reduce((sum: number, key: any) => sum + (key.price || 0), 0)
            
            statsMessage += `<b>👤 Your Statistics:</b>\n` +
              `🔑 Your Keys: <b>${userKeys.length}</b> (${userActiveKeys} active)\n` +
              `📱 Your Devices: <b>${userDevices}</b>\n` +
              `💰 Your Revenue: <b>${userRevenue.toFixed(2)}</b>\n`
              
          } else if (userRole === 'owner') {
            // Owner: Limited statistics
            const userKeys = await keys.find({ createdBy: user.username }).toArray()
            const activeKeys = userKeys.filter((k: any) => k.isActive).length
            const blockedKeys = userKeys.filter((k: any) => !k.isActive).length
            const totalDevices = await devices.countDocuments({ userId: user.username })
            
            const totalRevenue = userKeys.reduce((sum: number, key: any) => sum + (key.price || 0), 0)
            
            statsMessage += `<b>📈 Your Statistics:</b>\n` +
              `🔑 Total Keys: <b>${userKeys.length}</b>\n` +
              `✅ Active Keys: <b>${activeKeys}</b>\n` +
              `❌ Blocked Keys: <b>${blockedKeys}</b>\n` +
              `📱 Total Devices: <b>${totalDevices}</b>\n` +
              `💰 Total Spent: <b>${totalRevenue.toFixed(2)}</b>\n`
              
          } else if (userRole === 'admin') {
            // Admin: Basic statistics
            const userKeys = await keys.find({ createdBy: user.username }).toArray()
            const activeKeys = userKeys.filter((k: any) => k.isActive).length
            const totalDevices = await devices.countDocuments({ userId: user.username })
            
            statsMessage += `<b>📈 Your Statistics:</b>\n` +
              `🔑 Your Keys: <b>${userKeys.length}</b>\n` +
              `✅ Active Keys: <b>${activeKeys}</b>\n` +
              `📱 Total Devices: <b>${totalDevices}</b>\n`
          }
          
          statsMessage += `\n💡 Use admin panel for more detailed statistics.`
          
          try {
            await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
          } catch (e) {
            // Ignore
          }
          
          ctx.reply(statsMessage, {
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(userRole)
          })
        } catch (error) {
          console.error('Error loading statistics:', error)
          ctx.reply(
            `❌ Error loading statistics. Please try again later.`,
            {
              reply_markup: getMainMenuKeyboard(userRole)
            }
          )
        }
        return
      }

      // Handle key management buttons - these need key input
      // View Key Info button
      if (buttonText === '🔍 View Key Info' || buttonText === 'View Key Info' || 
          buttonText.toLowerCase().includes('view key info') || buttonText.toLowerCase().includes('key info')) {
        ctx.reply(
          `🔍 <b>View Key Info</b>\n\n` +
          `Please send the key to view its information.\n\n` +
          `Use command: <code>/keyinfo &lt;key&gt;</code>\n\n` +
          `Example: <code>/keyinfo ABC123DEF456GHIJ</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: getKeyManagementKeyboard()
          }
        )
        return
      }

      // Delete Key button
      if (buttonText === '🗑️ Delete Key' || buttonText === 'Delete Key' || 
          buttonText.toLowerCase().includes('delete key') || buttonText.toLowerCase().includes('delete')) {
        ctx.reply(
          `🗑️ <b>Delete Key</b>\n\n` +
          `Please send the key to delete.\n\n` +
          `Use command: <code>/deletekey &lt;key&gt;</code>\n\n` +
          `Example: <code>/deletekey ABC123DEF456GHIJ</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: getKeyManagementKeyboard()
          }
        )
        return
      }

      // Reset Key button (single key, not all keys)
      if (buttonText === '🔄 Reset Key' || buttonText === 'Reset Key' || 
          buttonText.toLowerCase().includes('reset key')) {
        ctx.reply(
          `🔄 <b>Reset Key</b>\n\n` +
          `Please send the key to reset its devices.\n\n` +
          `Use command: <code>/resetkey &lt;key&gt;</code>\n\n` +
          `Example: <code>/resetkey ABC123DEF456GHIJ</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: getKeyManagementKeyboard()
          }
        )
        return
      }

      // Block Key button
      if (buttonText === '🚫 Block Key' || buttonText === 'Block Key' || 
          buttonText.toLowerCase().includes('block key') || buttonText.toLowerCase().includes('block')) {
        ctx.reply(
          `🚫 <b>Block Key</b>\n\n` +
          `Please send the key to block.\n\n` +
          `Use command: <code>/blockkey &lt;key&gt;</code>\n\n` +
          `Example: <code>/blockkey ABC123DEF456GHIJ</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: getKeyManagementKeyboard()
          }
        )
        return
      }

      // Activate Key button
      if (buttonText === '✅ Activate Key' || buttonText === 'Activate Key' || 
          buttonText.toLowerCase().includes('activate key') || buttonText.toLowerCase().includes('activate')) {
        ctx.reply(
          `✅ <b>Activate Key</b>\n\n` +
          `Please send the key to activate.\n\n` +
          `Use command: <code>/activekey &lt;key&gt;</code>\n\n` +
          `Example: <code>/activekey ABC123DEF456GHIJ</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: getKeyManagementKeyboard()
          }
        )
        return
      }

      // Unknown message - show main menu
      ctx.reply(
        `❓ Unknown command. Please use the keyboard buttons below or type /help for help.`,
        {
          reply_markup: getMainMenuKeyboard(userRole)
        }
      )
    } catch (error) {
      console.error('Error in message handler:', error)
      // Try to reply with error message, but don't fail if user is not authenticated
      try {
        const chatId = ctx.from?.id
        if (chatId) {
          ctx.reply('❌ An error occurred. Please try again.', {
            reply_markup: getMainMenuKeyboard('reseller')
          })
        }
      } catch (e) {
        // Ignore errors when replying
        console.error('Error replying to user:', e)
      }
    }
  })

  // Error handling
  bot.catch((err: any, ctx: Context) => {
    console.error(`Error for ${ctx.updateType}:`, err)
    ctx.reply('❌ An error occurred. Please try again later.')
  })
}

// Webhook handler
export async function POST(request: NextRequest) {
  try {
    const bot = await getBotInstance()
    if (!bot) {
      return NextResponse.json(
        { error: 'Bot not initialized' },
        { status: 500 }
      )
    }

    const body = await request.json()
    await bot.handleUpdate(body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET handler for webhook setup verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Telegram webhook endpoint is active',
    status: 'ok'
  })
}

