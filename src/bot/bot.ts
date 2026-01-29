import { Telegraf, Context } from 'telegraf'
import clientPromise from '../lib/mongodb'
import dotenv from 'dotenv'

dotenv.config()

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

// Initialize bot with token from database or environment
let bot: Telegraf
let currentBotToken: string | null = null

async function initializeBot() {
  currentBotToken = await getBotToken()
  
  if (!currentBotToken) {
    console.error('ERROR: Bot token not found in database or environment variables!')
    console.error('Please set bot token in Settings page (Super Owner only) or set TELEGRAM_BOT_TOKEN environment variable.')
    process.exit(1)
  }
  
  bot = new Telegraf(currentBotToken)
  console.log('Bot initialized with token from database')
  
  // Register all bot commands
  registerBotCommands()
  
  // Check bot info to get username
  try {
    const botInfo = await bot.telegram.getMe()
    console.log('Bot started as:', botInfo.username)
    
    // Save bot username to database
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    await settings.updateOne(
      { type: 'telegram_bot' },
      { $set: { botUsername: botInfo.username, updatedAt: new Date().toISOString() } },
      { upsert: true }
    )
  } catch (error) {
    console.error('Error getting bot info:', error)
  }
}

// Function to register all bot commands
function registerBotCommands() {
  if (!bot) return

// Initialize bot
initializeBot().catch(error => {
  console.error('Failed to initialize bot:', error)
  process.exit(1)
})

// Helper function to get user from database using Telegram Chat ID
async function getUserByChatId(chatId: number) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    const users = db.collection('users')
    
    // Find user by telegram_chat_id or telegram_id field
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

// Helper function to verify user has permission (chat ID matches)
async function verifyUserPermission(chatId: number): Promise<{ allowed: boolean; user?: any }> {
  const user = await getUserByChatId(chatId)
  
  if (!user) {
    return { allowed: false }
  }
  
  // Check if user has chat ID set
  const userChatId = user.telegram_chat_id || user.telegram_id
  
  if (!userChatId || userChatId.toString() !== chatId.toString()) {
    return { allowed: false, user }
  }
  
  return { allowed: true, user }
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
      // Calculate price for hours (price per day / 24 * hours)
      totalPrice = (pricePerDay / 24) * duration
      days = duration / 24 // For expiry calculation
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

    // Check if key already exists, if so generate a new one
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

// Function to get user keys
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

// Function to get user balance
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

// Format key info for display
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

// Start command
bot.start(async (ctx: Context) => {
  const chatId = ctx.from?.id
  const telegramUsername = ctx.from?.username
  const firstName = ctx.from?.first_name || 'User'

  if (!chatId) {
    return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
  }

  // Check if user has permission (chat ID must be set in database)
  const { allowed, user } = await verifyUserPermission(chatId)
  
  if (!allowed) {
    if (user) {
      // User exists but chat ID doesn't match
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
      // User not found
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

  // Update user info
  if (user.username) {
    await updateUserChatId(user.username, chatId, telegramUsername || '', firstName)
  }

  const welcomeMessage = `👋 Welcome ${user.username || firstName}!\n\n` +
    `🔑 <b>NexPanel Key Generator Bot</b>\n\n` +
    `Use /help to see all available commands.\n\n` +
    `Quick actions:\n` +
    `• /generate - Create a new key\n` +
    `• /mykeys - View your keys\n` +
    `• /balance - Check your balance`

  ctx.reply(welcomeMessage, { parse_mode: 'HTML' })
  })

  // Help command
  bot.command('help', async (ctx: Context) => {
  const helpMessage = `📚 <b>Bot Commands</b>\n\n` +
    `🔹 /start - Start the bot\n` +
    `🔹 /generate - Generate a new key\n` +
    `🔹 /mykeys - View all your keys\n` +
    `🔹 /balance - Check your account balance\n` +
    `🔹 /help - Show this help message\n\n` +
    `<b>Key Types:</b>\n` +
    `• Random Key - 16 character random alphanumeric\n` +
    `• Name Key - Format: {duration}{type}>{username}-{random}\n` +
    `• Custom Key - Your custom key name (min 4 chars)\n\n` +
    `<b>Duration Types:</b>\n` +
    `• Hours - Duration in hours\n` +
    `• Days - Duration in days\n\n` +
    `<b>Example Usage:</b>\n` +
    `Use /generate and follow the interactive prompts!`

  ctx.reply(helpMessage, { parse_mode: 'HTML' })
  })

  // Balance command
  bot.command('balance', async (ctx: Context) => {
  const chatId = ctx.from?.id
  if (!chatId) {
    return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
  }

  const { allowed, user } = await verifyUserPermission(chatId)
  if (!allowed || !user) {
    return ctx.reply('❌ You don\'t have permission to use this bot. Please update your Chat ID in Settings.')
  }

  const balance = await getUserBalance(user.username)
  
  ctx.reply(
    `💰 <b>Your Balance</b>\n\n` +
    `Username: ${user.username}\n` +
    `Balance: <b>${balance.toFixed(2)}</b>\n\n` +
    `Use /generate to create keys.`,
    { parse_mode: 'HTML' }
  )
  })

  // My Keys command
  bot.command('mykeys', async (ctx: Context) => {
  const chatId = ctx.from?.id
  if (!chatId) {
    return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
  }

  const { allowed, user } = await verifyUserPermission(chatId)
  if (!allowed || !user) {
    return ctx.reply('❌ You don\'t have permission to use this bot. Please update your Chat ID in Settings.')
  }

  const keys = await getUserKeys(user.username)
  
  if (keys.length === 0) {
    return ctx.reply('📭 You don\'t have any keys yet.\n\nUse /generate to create your first key!')
  }

  // Show first 10 keys (Telegram message limit)
  const keysToShow = keys.slice(0, 10)
  let message = `🔑 <b>Your Keys (${keys.length} total)</b>\n\n`
  
  keysToShow.forEach((key, index) => {
    message += `<b>${index + 1}. Key #${index + 1}</b>\n`
    message += formatKeyInfo(key)
    message += `\n`
  })

  if (keys.length > 10) {
    message += `\n... and ${keys.length - 10} more keys`
  }

    ctx.reply(message, { parse_mode: 'HTML' })
  })

  // Generate key command - Interactive
  bot.command('generate', async (ctx: Context) => {
  const chatId = ctx.from?.id
  if (!chatId) {
    return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
  }

  const { allowed, user } = await verifyUserPermission(chatId)
  if (!allowed || !user) {
    return ctx.reply('❌ You don\'t have permission to use this bot. Please update your Chat ID in Settings.')
  }

  // For simplicity, we'll use inline keyboard for quick generation
  // Users can use the full command with parameters for advanced options
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🎲 Random Key', callback_data: 'generate_random' },
        { text: '📝 Name Key', callback_data: 'generate_name' }
      ],
      [
        { text: '✏️ Custom Key', callback_data: 'generate_custom' }
      ],
      [
        { text: '❌ Cancel', callback_data: 'cancel_generate' }
      ]
    ]
  }

  ctx.reply(
    `🔑 <b>Generate Key</b>\n\n` +
    `Select key type:\n\n` +
    `• 🎲 Random Key - 16 character random\n` +
    `• 📝 Name Key - Format: {duration}{type}>{username}-{random}\n` +
    `• ✏️ Custom Key - Your custom key name\n\n` +
    `For advanced options, use:\n` +
    `/generate_advanced`,
    { 
      parse_mode: 'HTML',
      reply_markup: keyboard
    }
  )
  })

  // Generate advanced command - with parameters
  bot.command('generate_advanced', async (ctx: Context) => {
  ctx.reply(
    `🔧 <b>Advanced Key Generation</b>\n\n` +
    `Use this format:\n\n` +
    `<code>/gen keyType duration durationType maxDevices</code>\n\n` +
    `<b>Parameters:</b>\n` +
    `• keyType: random, name, or custom\n` +
    `• duration: number (e.g., 7)\n` +
    `• durationType: hours or days\n` +
    `• maxDevices: number (e.g., 1, 5)\n\n` +
    `<b>Examples:</b>\n` +
    `<code>/gen random 7 days 1</code>\n` +
    `<code>/gen name 30 days 5</code>\n` +
    `<code>/gen custom 15 days 2</code>\n\n` +
    `For custom keys, you'll be asked for the key name after sending this command.`,
    { parse_mode: 'HTML' }
  )
  })

  // Short gen command
  bot.command('gen', async (ctx: Context) => {
  const chatId = ctx.from?.id
  if (!chatId) {
    return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
  }

  const { allowed, user } = await verifyUserPermission(chatId)
  if (!allowed || !user) {
    return ctx.reply('❌ You don\'t have permission to use this bot. Please update your Chat ID in Settings.')
  }

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : []
  
  if (args.length < 4) {
    return ctx.reply(
      `❌ Invalid format!\n\n` +
      `Use: <code>/gen keyType duration durationType maxDevices</code>\n\n` +
      `Example: <code>/gen random 7 days 1</code>`,
      { parse_mode: 'HTML' }
    )
  }

  const [keyType, durationStr, durationType, maxDevicesStr] = args

  if (!['random', 'name', 'custom'].includes(keyType.toLowerCase())) {
    return ctx.reply('❌ Invalid key type. Use: random, name, or custom')
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

  // Get settings for defaults
  const client = await clientPromise
  const db = client.db('nexpanel')
  const settings = db.collection('settings')
  const globalSettings = await settings.findOne({}) || {
    credit: process.env.DEFAULT_GLOBAL_CREDIT || 'Alex bhai',
    announcement: process.env.DEFAULT_GLOBAL_ANNOUNCEMENT || 'Welcome to NexPanel',
    announcementmode: false,
  }

  // If custom key, ask for key name
  if (keyType.toLowerCase() === 'custom') {
    ctx.reply('✏️ Please send your custom key name (minimum 4 characters):')
    // Store state for custom key input
    // Note: For production, use session storage or database for state management
    return
  }

  // Generate key
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
    await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
    ctx.reply(
      `✅ <b>Key Generated Successfully!</b>\n\n` +
      formatKeyInfo(result.data) +
      `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
      `🔑 Key: <code>${result.data.key}</code>\n\n` +
      `⚠️ Save this key securely!`,
      { parse_mode: 'HTML' }
    )
  } else {
    await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
    ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`)
  }
  })

  // Handle callback queries (inline keyboard buttons)
  bot.on('callback_query', async (ctx: Context) => {
  const query = (ctx as any).callbackQuery
  const data = query?.data

  if (!data) return

  const chatId = ctx.from?.id
  if (!chatId) {
    return (ctx as any).answerCbQuery('Error: Unable to identify your Telegram Chat ID')
  }

  const { allowed, user } = await verifyUserPermission(chatId)
  if (!allowed || !user) {
    return (ctx as any).answerCbQuery('You don\'t have permission to use this bot', true)
  }

  if (data.startsWith('generate_')) {
    const keyType = data.replace('generate_', '')
    
    if (keyType === 'cancel_generate') {
      await (ctx as any).answerCbQuery('Cancelled')
      return ctx.editMessageText('❌ Key generation cancelled.')
    }

    // Default values for quick generation
    const defaultDuration = 7
    const defaultDurationType: 'hours' | 'days' = 'days'
    const defaultMaxDevices = 1

    // Get settings
    const client = await clientPromise
    const db = client.db('nexpanel')
    const settings = db.collection('settings')
    const globalSettings = await settings.findOne({}) || {}

    if (keyType === 'custom') {
      await (ctx as any).answerCbQuery('Please send your custom key name')
      return ctx.reply('✏️ Please send your custom key name (minimum 4 characters):\n\nUse: /customkey <your-key-name>')
    }

    await (ctx as any).answerCbQuery('Generating key...')
    const loadingMsg = await ctx.reply('⏳ Generating key...')

    const result = await generateKey(
      user.username,
      defaultMaxDevices,
      defaultDuration,
      defaultDurationType,
      keyType === 'name' ? 'name' : 'random',
      undefined
    )

    if (result.success && result.data) {
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      await ctx.editMessageText(
        `✅ <b>Key Generated Successfully!</b>\n\n` +
        formatKeyInfo(result.data) +
        `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
        `🔑 Key: <code>${result.data.key}</code>\n\n` +
        `⚠️ Save this key securely!`,
        { parse_mode: 'HTML' }
      )
    } else {
      await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
      await ctx.editMessageText(`❌ ${result.reason || 'Failed to generate key'}`)
    }
  }
  })

  // Custom key command
  bot.command('customkey', async (ctx: Context) => {
  const chatId = ctx.from?.id
  if (!chatId) {
    return ctx.reply('❌ Error: Unable to identify your Telegram Chat ID')
  }

  const { allowed, user } = await verifyUserPermission(chatId)
  if (!allowed || !user) {
    return ctx.reply('❌ You don\'t have permission to use this bot. Please update your Chat ID in Settings.')
  }

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : []
  
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
    await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
    ctx.reply(
      `✅ <b>Custom Key Generated Successfully!</b>\n\n` +
      formatKeyInfo(result.data) +
      `\n💰 New Balance: ${result.data.newBalance.toFixed(2)}\n\n` +
      `🔑 Key: <code>${result.data.key}</code>\n\n` +
      `⚠️ Save this key securely!`,
      { parse_mode: 'HTML' }
    )
  } else {
    await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMsg.message_id)
    ctx.reply(`❌ ${result.reason || 'Failed to generate key'}`)
  }
  })

  // Error handling
  bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err)
    ctx.reply('❌ An error occurred. Please try again later.')
  })
}

// Start bot after initialization
async function startBot() {
  try {
    await initializeBot()
    
    console.log('🤖 Starting Telegram bot...')
    await bot.launch()
    console.log('✅ Telegram bot started successfully!')
  } catch (error) {
    console.error('❌ Failed to start bot:', error)
    process.exit(1)
  }
}

// Start bot
startBot()

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('🛑 Stopping bot...')
  if (bot) {
    bot.stop('SIGINT')
  }
  process.exit(0)
})
process.once('SIGTERM', () => {
  console.log('🛑 Stopping bot...')
  if (bot) {
    bot.stop('SIGTERM')
  }
  process.exit(0)
})

