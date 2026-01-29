import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'

export async function GET() {
  try {
    const startTime = Date.now()
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    // Perform a simple ping operation
    await db.command({ ping: 1 })
    
    const endTime = Date.now()
    const pingMs = endTime - startTime
    
    return NextResponse.json({
      status: true,
      data: {
        pingMs,
        status: pingMs < 100 ? 'Excellent' : pingMs < 300 ? 'Good' : pingMs < 1000 ? 'Fair' : 'Poor'
      },
      reason: 'Ping measured successfully',
    })
  } catch (error) {
    console.error('Error measuring ping:', error)
    return NextResponse.json(
      {
        status: false,
        data: null,
        reason: 'Error measuring ping',
      },
      { status: 500 }
    )
  }
}
