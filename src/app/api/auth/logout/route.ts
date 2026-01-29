import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

// Force dynamic rendering since this route uses cookies
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    // Get the session token from cookies
    const token = request.cookies.get('admin-token')?.value
    
    if (token) {
      // Remove the session from database
      await db.collection('admin_sessions').deleteOne({ token })
    }
    
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' })
    
    // Determine if we should use secure cookies
    const isHttps = process.env.NODE_ENV === 'production' || 
                   request.headers.get('x-forwarded-proto') === 'https' ||
                   request.url.startsWith('https://')
    
    response.cookies.set('admin-token', '', {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 0
    })
    
    return response
    
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
