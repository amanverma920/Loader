import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import crypto from 'crypto'

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

// GET - Fetch API keys (only for owner and super owner)
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
    
    // Only owner and super owner can access API keys
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can access API keys' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const apiKeys = db.collection('api_keys')
    
    // Get API keys from database
    let apiKeyDoc = await apiKeys.findOne({ type: 'main' })
    
    // If not exists, create default keys from .env or generate new ones
    if (!apiKeyDoc) {
      const defaultApiKey = process.env.API_KEY || crypto.randomBytes(32).toString('hex')
      const defaultSecretKey = process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex')
      
      await apiKeys.insertOne({
        type: 'main',
        apiKey: defaultApiKey,
        secretKey: defaultSecretKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: session.username
      })
      
      apiKeyDoc = await apiKeys.findOne({ type: 'main' })
    }
    
    // Get all username permissions
    const usernamePermissions = db.collection('username_permissions')
    const permissions = await usernamePermissions.find({}).toArray()
    
    // Return keys (masked for security) and username permissions
    return NextResponse.json({
      status: true,
      data: {
        apiKey: apiKeyDoc?.apiKey || '',
        secretKey: apiKeyDoc?.secretKey || '',
        maskedApiKey: apiKeyDoc?.apiKey ? `${apiKeyDoc.apiKey.substring(0, 8)}...${apiKeyDoc.apiKey.substring(apiKeyDoc.apiKey.length - 4)}` : '',
        maskedSecretKey: apiKeyDoc?.secretKey ? `${apiKeyDoc.secretKey.substring(0, 8)}...${apiKeyDoc.secretKey.substring(apiKeyDoc.secretKey.length - 4)}` : '',
        updatedAt: apiKeyDoc?.updatedAt,
        updatedBy: apiKeyDoc?.updatedBy,
        usernamePermissions: permissions
      }
    })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { status: false, reason: 'Error fetching API keys' },
      { status: 500 }
    )
  }
}

// POST - Update API keys (only for owner and super owner)
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
    
    // Only owner and super owner can update API keys
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return NextResponse.json(
        { status: false, reason: 'Only owner and super owner can update API keys' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { apiKey, secretKey } = body

    if (!apiKey && !secretKey) {
      return NextResponse.json(
        { status: false, reason: 'At least one key (API Key or Secret Key) must be provided' },
        { status: 400 }
      )
    }

    // Validate keys are not empty
    if (apiKey !== undefined && (!apiKey || apiKey.trim().length === 0)) {
      return NextResponse.json(
        { status: false, reason: 'API Key cannot be empty' },
        { status: 400 }
      )
    }

    if (secretKey !== undefined && (!secretKey || secretKey.trim().length === 0)) {
      return NextResponse.json(
        { status: false, reason: 'Secret Key cannot be empty' },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')
    const apiKeys = db.collection('api_keys')
    
    // Get existing keys
    let apiKeyDoc = await apiKeys.findOne({ type: 'main' })
    
    const updateData: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: session.username
    }
    
    if (apiKey !== undefined) {
      updateData.apiKey = apiKey.trim()
    }
    
    if (secretKey !== undefined) {
      updateData.secretKey = secretKey.trim()
    }
    
    if (apiKeyDoc) {
      // Update existing
      await apiKeys.updateOne(
        { type: 'main' },
        { $set: updateData }
      )
    } else {
      // Create new
      const defaultApiKey = apiKey || process.env.API_KEY || crypto.randomBytes(32).toString('hex')
      const defaultSecretKey = secretKey || process.env.SECRET_KEY || crypto.randomBytes(32).toString('hex')
      
      await apiKeys.insertOne({
        type: 'main',
        apiKey: defaultApiKey,
        secretKey: defaultSecretKey,
        createdAt: new Date().toISOString(),
        ...updateData
      })
    }
    
    return NextResponse.json({
      status: true,
      message: 'API keys updated successfully'
    })
  } catch (error) {
    console.error('Error updating API keys:', error)
    return NextResponse.json(
      { status: false, reason: 'Error updating API keys' },
      { status: 500 }
    )
  }
}

