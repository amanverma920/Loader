import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

function decryptAES(encryptedData: string, key: string): string {
  const decoder = new TextDecoder()
  const encryptedBuffer = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)))
  const keyBuffer = new TextEncoder().encode(key)
  
  let decrypted = ""
  for (let i = 0; i < encryptedBuffer.length; i++) {
    const charCode = encryptedBuffer[i] ^ keyBuffer[i % keyBuffer.length]
    decrypted += String.fromCharCode(charCode)
  }
  
  return decrypted
}

// Encrypt function for response (XOR + Base64)
function encryptAES(data: string, key: string): string {
  const dataBuffer = Buffer.from(data, 'utf8')
  const keyBuffer = Buffer.from(key, 'utf8')
  
  const encrypted = Buffer.alloc(dataBuffer.length)
  for (let i = 0; i < dataBuffer.length; i++) {
    encrypted[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length]
  }
  
  return encrypted.toString('base64')
}

// Generate signature for integrity verification (simple hash, no crypto dependency needed in C++)
function generateSignature(data: string, timestamp: number, key: string): string {
  const message = `${data}|${timestamp}|${key}`
  
  // Simple hash function (djb2 variant) - matches C++ implementation
  // Use bitwise operations with mask to ensure 32-bit unsigned integer behavior
  let hash = 5381
  for (let i = 0; i < message.length; i++) {
    // Ensure we work with 32-bit unsigned integers (matches C++ unsigned long on 32-bit systems)
    hash = ((hash << 5) + hash) + message.charCodeAt(i)
    // Mask to 32 bits to prevent overflow issues
    hash = hash >>> 0
  }
  
  // Convert to hex - ensure it's treated as unsigned
  let hexHash = (hash >>> 0).toString(16)
  
  // Take first 16 characters or pad to 16 (match C++ behavior)
  if (hexHash.length > 16) {
    hexHash = hexHash.substring(0, 16) // Take first 16 chars
  } else {
    while (hexHash.length < 16) {
      hexHash = '0' + hexHash
    }
  }
  
  return hexHash
}

// Helper function to sort object keys for consistent JSON
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }
  
  const sorted: any = {}
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    sorted[key] = sortObjectKeys(obj[key])
  }
  return sorted
}

// Create encrypted response with timestamp and signature
function createEncryptedResponse(data: any, secretKey: string): string {
  const timestamp = Date.now()
  // Sort keys and use compact JSON to match C++ json.dump() format
  const sortedData = sortObjectKeys(data)
  const dataString = JSON.stringify(sortedData)
  
  // Create signature for integrity check
  const signature = generateSignature(dataString, timestamp, secretKey)
  
  // Include dataString in payload so app can verify with exact same string
  // This ensures signature verification works correctly
  const payload = {
    data: sortedData,
    dataString: dataString, // Exact string used for signature generation
    timestamp: timestamp,
    signature: signature
  }
  
  // Sort payload keys too for consistency
  const sortedPayload = sortObjectKeys(payload)
  const payloadString = JSON.stringify(sortedPayload)
  return encryptAES(payloadString, secretKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const html = `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EngineHost.in - Premium Hosting Solutions</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = { darkMode: 'class' }
    </script>
    <style>
        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes shimmer {
            0%, 100% { 
                background-position: 0% 50%;
                filter: brightness(1);
            }
            50% { 
                background-position: 100% 50%;
                filter: brightness(1.3);
            }
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardFloat {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes particleFloat {
            0% { transform: translateY(100vh) translateX(0) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(-100px) translateX(100px) rotate(360deg); opacity: 0; }
        }
        @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        .float-animation { animation: float 4s ease-in-out infinite; }
        .shimmer-animation {
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #6366f1, #3b82f6);
            background-size: 200% 200%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: shimmer 3s ease-in-out infinite;
        }
        .fade-in-up { animation: fadeInUp 0.8s ease-out; }
        .fade-in-up-delay { animation: fadeInUp 1s ease-out 0.3s both; }
        .card-float { animation: cardFloat 5s ease-in-out infinite; }
        .card-float:nth-child(1) { animation-delay: 0s; }
        .card-float:nth-child(2) { animation-delay: 0.6s; }
        .card-float:nth-child(3) { animation-delay: 1.2s; }
        .card-float:nth-child(4) { animation-delay: 1.8s; }
        .particle {
            position: absolute;
            background: rgba(59, 130, 246, 0.5);
            border-radius: 50%;
            animation: particleFloat 20s infinite;
            box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
        .gradient-bg {
            background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #4facfe, #00f2fe);
            background-size: 400% 400%;
            animation: gradient 15s ease infinite;
        }
        .icon-bounce { animation: float 3s ease-in-out infinite; display: inline-block; }
    </style>
</head>
<body class="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-x-hidden overflow-y-auto">
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse"></div>
        <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
    </div>
    <div class="particles absolute inset-0 overflow-hidden pointer-events-none" id="particles"></div>
    <div class="relative max-w-6xl w-full z-10 my-8">
        <div class="bg-white/90 dark:bg-gray-900/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 md:p-12 lg:p-16 border-2 border-white/30 dark:border-gray-700/30 shadow-2xl">
            <div class="text-center mb-10 sm:mb-12 fade-in-up">
                <div class="inline-flex items-center justify-center h-20 w-20 sm:h-24 sm:w-24 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 text-white shadow-2xl shadow-blue-500/50 mb-6 float-animation">
                    <svg class="h-10 w-10 sm:h-12 sm:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                </div>
                <h1 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-4 shimmer-animation">
                    ENGINEHOST.IN
                </h1>
                <p class="mt-4 text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-white tracking-tight">
                    Power Your Dreams with Premium Hosting
                </p>
                <p class="mt-3 text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 font-medium">
                    Fast • Reliable • Secure • Scalable
                </p>
                <p class="mt-4 text-sm sm:text-base text-blue-600 dark:text-blue-400 font-semibold">
                    User: ${params.username}
                </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-10 sm:mt-12 fade-in-up-delay">
                <div class="card-float group bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 border-2 border-blue-300/50 dark:border-blue-600/50 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-110 transition-all duration-500 cursor-pointer">
                    <div class="text-5xl sm:text-6xl mb-4 text-center icon-bounce">⚡</div>
                    <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Lightning Fast</h3>
                    <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                        Ultra-fast SSD storage and optimized servers for maximum performance
                    </p>
                </div>
                <div class="card-float group bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 border-2 border-purple-300/50 dark:border-purple-600/50 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-500/30 hover:scale-110 transition-all duration-500 cursor-pointer">
                    <div class="text-5xl sm:text-6xl mb-4 text-center icon-bounce">🔒</div>
                    <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Secure & Safe</h3>
                    <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                        Enterprise-grade security with SSL certificates and daily backups
                    </p>
                </div>
                <div class="card-float group bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-indigo-800/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 border-2 border-indigo-300/50 dark:border-indigo-600/50 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/30 hover:scale-110 transition-all duration-500 cursor-pointer">
                    <div class="text-5xl sm:text-6xl mb-4 text-center icon-bounce">📈</div>
                    <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Scalable</h3>
                    <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                        Grow your business with flexible hosting plans that scale with you
                    </p>
                </div>
                <div class="card-float group bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/40 dark:to-pink-800/40 backdrop-blur-md rounded-2xl p-6 sm:p-8 border-2 border-pink-300/50 dark:border-pink-600/50 hover:border-pink-400 dark:hover:border-pink-500 hover:shadow-2xl hover:shadow-pink-500/30 hover:scale-110 transition-all duration-500 cursor-pointer">
                    <div class="text-5xl sm:text-6xl mb-4 text-center icon-bounce">🎯</div>
                    <h3 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">24/7 Support</h3>
                    <p class="text-sm sm:text-base text-gray-700 dark:text-gray-300 text-center leading-relaxed">
                        Round-the-clock expert support whenever you need assistance
                    </p>
                </div>
            </div>
            <div class="mt-10 sm:mt-12 text-center fade-in-up-delay">
                <a href="https://enginehost.in" class="inline-flex items-center justify-center px-8 sm:px-12 py-4 sm:py-5 text-base sm:text-lg md:text-xl font-bold rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white shadow-2xl shadow-blue-500/50 hover:shadow-blue-500/70 hover:from-blue-500 hover:via-purple-500 hover:to-indigo-500 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all transform hover:scale-110 active:scale-95 duration-300">
                    <span>Get Started Today</span>
                    <svg class="ml-2 h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </a>
            </div>
        </div>
    </div>
    <script>
        function createParticles() {
            const particlesContainer = document.getElementById('particles');
            const particleCount = window.innerWidth < 768 ? 25 : 40;
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                const size = Math.random() * 6 + 3;
                const left = Math.random() * 100;
                const delay = Math.random() * 20;
                const duration = Math.random() * 15 + 15;
                particle.style.width = size + 'px';
                particle.style.height = size + 'px';
                particle.style.left = left + '%';
                particle.style.animationDelay = delay + 's';
                particle.style.animationDuration = duration + 's';
                particlesContainer.appendChild(particle);
            }
        }
        createParticles();
    </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const username = params.username
    
    // Validate username exists in database
    const client = await clientPromise
    const db = client.db('nexpanel')
    const users = db.collection('users')
    
    const userDoc = await users.findOne({ username, isActive: { $ne: false } })
    if (!userDoc) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: `User '${username}' not found or inactive`,
        },
        { status: 404 }
      )
    }
    
    const apiKey = request.headers.get("X-API-Key")
    
    if (!apiKey) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: "API key not provided",
        },
        { status: 401 }
      )
    }
    
    // Get API keys from database
    const apiKeys = db.collection('api_keys')
    
    let apiKeyDoc = await apiKeys.findOne({ type: 'main' })
    
    // If not exists in database, use .env as fallback
    let expectedApiKey: string
    let secretKey: string
    
    if (apiKeyDoc) {
      expectedApiKey = apiKeyDoc.apiKey
      secretKey = apiKeyDoc.secretKey
    } else {
      // Fallback to .env
      expectedApiKey = process.env.API_KEY || "your-secret-api-key-123"
      secretKey = process.env.SECRET_KEY || "your-secret-key"
      
      // Save to database for future use
      await apiKeys.insertOne({
        type: 'main',
        apiKey: expectedApiKey,
        secretKey: secretKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      })
    }
    
    if (apiKey !== expectedApiKey) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: "Invalid API key",
        },
        { status: 401 }
      )
    }
    
    // Check maintenance mode
    const serverStatus = db.collection('server_status')
    const maintenanceStatus = await serverStatus.findOne({ type: 'maintenance' })
    
    if (maintenanceStatus && maintenanceStatus.isMaintenanceMode) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: maintenanceStatus.message || "Server is currently under maintenance. Please try again later.",
          maintenanceMode: true
        },
        { status: 503 }
      )
    }
    
    const body = await request.json()
    const { encryptedData } = body
    
    if (!encryptedData) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: "Encrypted data not provided",
        },
        { status: 400 }
      )
    }
    
    const decryptedBase64 = decryptAES(encryptedData, secretKey)
    const keyUUID = atob(decryptedBase64)
    
    const [key, uuid] = keyUUID.split("_")
    
    if (!key || !uuid) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: "Invalid key format",
        },
        { status: 400 }
      )
    }
    
    const keys = db.collection('keys')
    const devices = db.collection('devices')
    const analytics = db.collection('analytics')
    
    // First, find the key
    let keyDoc = await keys.findOne({ 
      key, 
      isActive: true
    })
    
    if (!keyDoc) {
      return NextResponse.json(
        {
          status: false,
          data: null,
          reason: `Key not Register`,
        },
        { status: 403 }
      )
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
            message: 'Your server is turned OFF. Key usage is blocked. Please contact administrator.' 
          }
        }
        
        // Check parent user's server status recursively
        if (user.createdBy && user.createdBy !== username) {
          const parentResult = await checkUserServerStatus(user.createdBy, visited)
          if (parentResult.isOff) {
            return { 
              isOff: true, 
              message: 'Your parent user\'s server is turned OFF. Key usage is blocked. Please contact administrator.' 
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
    
    // Check server status for the key creator
    if (keyDoc.createdBy) {
      const serverStatusCheck = await checkUserServerStatus(keyDoc.createdBy)
      if (serverStatusCheck.isOff) {
        return NextResponse.json(
          {
            status: false,
            data: null,
            reason: serverStatusCheck.message || 'Server is turned OFF. Key usage is blocked.',
          },
          { status: 403 }
        )
      }
    }
    
    // Check if key belongs to SuperOwner or Owner - if yes, allow it with any username
    const keyOwner = await users.findOne({ username: keyDoc.createdBy })
    const isSuperOwnerOrOwner = keyOwner && (keyOwner.role === 'super owner' || keyOwner.role === 'owner')
    
    if (isSuperOwnerOrOwner) {
      // SuperOwner and Owner keys can be used with any username - no further checks needed
    } else {
      // For other users, check if key belongs to this username
      if (keyDoc.createdBy !== username) {
        // Check Key User Permission settings (Auto/Manual)
        const usernamePermissions = db.collection('username_permissions')
        const permission = await usernamePermissions.findOne({ username })
        
        if (permission) {
          let keyAllowed = false
          
          if (permission.type === 'auto') {
            // Auto User Key: Check if key owner was created by this username (referral)
            const keyOwnerUser = await users.findOne({ username: keyDoc.createdBy })
            if (keyOwnerUser && keyOwnerUser.createdBy === username) {
              keyAllowed = true
            }
          } else if (permission.type === 'manual') {
            // Manual User Key: Check if key owner is in the allowed users list
            if (permission.allowedUsers && Array.isArray(permission.allowedUsers)) {
              if (permission.allowedUsers.includes(keyDoc.createdBy)) {
                keyAllowed = true
              }
            }
          }
          
          if (!keyAllowed) {
            return NextResponse.json(
              {
                status: false,
                data: null,
                reason: `Key not Register`,
              },
              { status: 403 }
            )
          }
        } else {
          // No permission set - only keys created by this username are allowed (default behavior)
          return NextResponse.json(
            {
              status: false,
              data: null,
              reason: `Key not Register`,
            },
            { status: 403 }
          )
        }
      }
      // If keyDoc.createdBy === username, it's allowed (default behavior)
    }
    
    // Check if key is activated (first time use)
    const isFirstUse = !keyDoc.activatedAt
    let finalExpiryDate = keyDoc.expiryDate
    
    if (isFirstUse) {
      // Activate the key and set expiry date from now
      const now = new Date()
      const duration = keyDoc.duration || 1
      const durationType = keyDoc.durationType || 'days'
      
      let expiryDate: Date
      if (durationType === 'hours') {
        // For hours, add exact duration to current time
        expiryDate = new Date(now.getTime() + duration * 60 * 60 * 1000)
      } else {
        // For days, add exact duration (24 hours per day) to current time
        expiryDate = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)
      }
      
      // Store full datetime for expiry (in UTC)
      finalExpiryDate = expiryDate.toISOString()
      
      // Update key with activation time and real expiry date
      await keys.updateOne(
        { _id: keyDoc._id },
        { 
          $set: { 
            activatedAt: now.toISOString(),
            expiryDate: finalExpiryDate
          } 
        }
      )
      
      // Log activation
      try {
        const activities = db.collection('activities')
        await activities.insertOne({
          action: 'key_activated',
          details: `Key activated for user '${username}': ${key.substring(0, 8)}... | Expires: ${finalExpiryDate}`,
          userId: username,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: now.toISOString(),
          type: 'system'
        })
      } catch (error) {
        console.error('Failed to log activation:', error)
      }
    } else {
      // Key is already activated, check if expired
      if (new Date() > new Date(keyDoc.expiryDate)) {
        return NextResponse.json(
          {
            status: false,
            data: null,
            reason: "Key has expired",
          },
          { status: 403 }
        )
      }
      finalExpiryDate = keyDoc.expiryDate
    }
    
    const existingDevice = await devices.findOne({ keyId: keyDoc._id, uuid })
    if (!existingDevice) {
      if (keyDoc.currentDevices >= keyDoc.maxDevices) {
        return NextResponse.json(
          {
            status: false,
            data: null,
            reason: "Device limit reached",
          },
          { status: 403 }
        )
      }
      
      const deviceDoc = {
        keyId: keyDoc._id,
        uuid,
        ipAddress: request.ip || "unknown",
        lastLogin: new Date(),
        createdAt: new Date(),
      }
      
      await devices.insertOne(deviceDoc)
      await keys.updateOne({ _id: keyDoc._id }, { $inc: { currentDevices: 1 } })
    } else {
      await devices.updateOne(
        { keyId: keyDoc._id, uuid },
        { $set: { lastLogin: new Date(), ipAddress: request.ip || "unknown" } }
      )
    }
    
    try {
      const activities = db.collection('activities')
      await activities.insertOne({
        action: 'user_login',
        details: `Login successful for user '${username}' with key: ${key.substring(0, 8)}...`,
        userId: username,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        timestamp: new Date().toISOString(),
        type: 'login'
      })
    } catch (error) {
      console.error('Failed to log activity:', error)
    }
    
    // Track analytics for total requests
    try {
      const now = new Date()
      await analytics.insertOne({
        keyId: keyDoc._id.toString(),
        uuid: uuid,
        createdBy: username,
        timestamp: now.toISOString(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        action: 'key_connect',
        username: username  // Track which username endpoint was used
      })
    } catch (error) {
      console.error('Failed to log analytics:', error)
    }
    
    let serverfile = null
    try {
      // Get ZIP file
      const zipFile = await db.collection('server_files').findOne({ fileType: 'zip' })
      
      const serverFileDoc = zipFile
      
      if (serverFileDoc && serverFileDoc.url) {
        // Construct full URL
        const baseUrl = request.headers.get('host') || 'localhost:3000'
        const protocol = request.headers.get('x-forwarded-proto') || 'http'
        // If url already starts with http, use as is, otherwise construct full URL
        if (serverFileDoc.url.startsWith('http')) {
          serverfile = serverFileDoc.url
        } else {
          serverfile = `${protocol}://${baseUrl}${serverFileDoc.url}`
        }
      }
    } catch (error) {
      console.error('Failed to get server file:', error)
    }
    
    // Format expiry date for response in IST timezone with date and time (24-hour format)
    let expiryDateForResponse: string
    if (finalExpiryDate.includes('T')) {
      // Convert UTC to IST (UTC+5:30) and format as YYYY-MM-DD HH:mm:ss
      const expiryUTC = new Date(finalExpiryDate)
      
      // Use Intl.DateTimeFormat for reliable IST formatting
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24-hour format
      })
      
      const parts = formatter.formatToParts(expiryUTC)
      const year = parts.find(p => p.type === 'year')?.value || ''
      const month = parts.find(p => p.type === 'month')?.value || ''
      const day = parts.find(p => p.type === 'day')?.value || ''
      const hour = parts.find(p => p.type === 'hour')?.value || ''
      const minute = parts.find(p => p.type === 'minute')?.value || ''
      const second = parts.find(p => p.type === 'second')?.value || ''
      
      expiryDateForResponse = `${year}-${month}-${day} ${hour}:${minute}:${second}`
    } else {
      expiryDateForResponse = finalExpiryDate
    }
    
    // Get mod name - first check user-specific, then fallback to general
    let modname = ""
    try {
      // Check user-specific mod name first
      if (userDoc && userDoc.modname) {
        modname = userDoc.modname
      } else {
        // Fallback to general mod name
        const apiKeys = db.collection('api_keys')
        const apiKeyDoc = await apiKeys.findOne({ type: 'main' })
        if (apiKeyDoc && apiKeyDoc.modname) {
          modname = apiKeyDoc.modname
        }
      }
    } catch (error) {
      console.error('Failed to get mod name:', error)
    }
    
    // Prepare response data
    const responseData = {
      announcement: keyDoc.announcement || "Sample Announcement",
      expirydate: expiryDateForResponse,
      key: keyDoc.key,
      total_devices: keyDoc.maxDevices,
      devices_left: keyDoc.maxDevices - (keyDoc.currentDevices + (existingDevice ? 0 : 1)),
      uuid,
      credit: keyDoc.credit,
      announcementmode: keyDoc.announcementmode || false,
      serverfile,
      modname: modname,
    }
    
    // Encrypt the response with timestamp and signature
    const encryptedResponse = createEncryptedResponse(responseData, secretKey)
    
    return NextResponse.json({
      status: true,
      encryptedData: encryptedResponse,
      reason: "Successful",
    })
  } catch (error) {
    console.error('Error in connect:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: "Error processing request",
      },
      { status: 500 }
    )
  }
}

