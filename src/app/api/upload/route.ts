import { NextRequest, NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { GridFSBucket, ObjectId } from 'mongodb'

export const dynamic = 'force-dynamic'

async function verifyAdminAuth(request: NextRequest) {
  try {
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    const token = request.cookies.get('admin-token')?.value
    
    if (!token) {
      return { authenticated: false, role: null, username: null }
    }
    
    const session = await db.collection('admin_sessions').findOne({
      token,
      expiresAt: { $gt: new Date().toISOString() }
    })
    
    if (!session) {
      return { authenticated: false, role: null, username: null }
    }

    // Check if user is owner or super owner
    if (session.role !== 'owner' && session.role !== 'super owner') {
      return { authenticated: false, role: session.role, username: session.username }
    }
    
    return { authenticated: true, role: session.role, username: session.username }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { authenticated: false, role: null, username: null }
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request)
    
    if (!auth.authenticated) {
      return NextResponse.json(
        { status: false, reason: auth.role ? 'Only owner and super owner can upload files' : 'Unauthorized' },
        { status: 403 }
      )
    }

    const client = await clientPromise
    const db = client.db('nexpanel')

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const versionStr = formData.get('version') as string
    const fileType = formData.get('fileType') as string

    if (!file) {
      return NextResponse.json(
        { status: false, reason: 'No file provided' },
        { status: 400 }
      )
    }

    if (!versionStr) {
      return NextResponse.json(
        { status: false, reason: 'Version number is required' },
        { status: 400 }
      )
    }

    const version = parseInt(versionStr)
    if (isNaN(version) || version < 1) {
      return NextResponse.json(
        { status: false, reason: 'Invalid version number' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name
    const fileExtension = fileName.split('.').pop()?.toLowerCase()
    
    // Only ZIP files are allowed
    if (fileType !== 'zip' || fileExtension !== 'zip') {
      return NextResponse.json(
        { status: false, reason: 'Only .zip files are allowed' },
        { status: 400 }
      )
    }
    
    const actualFileType: 'zip' = 'zip'

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { status: false, reason: 'File size must be less than 100MB' },
        { status: 400 }
      )
    }

    // Check current file of same type and version
    const existingFile = await db.collection('server_files').findOne({ fileType: actualFileType })
    console.log('Existing file check:', { actualFileType, existingFile: existingFile ? { version: existingFile.version } : null, newVersion: version })
    
    if (existingFile && version <= existingFile.version) {
      console.log('Version check failed:', { existingVersion: existingFile.version, newVersion: version })
      return NextResponse.json(
        { status: false, reason: `${actualFileType.toUpperCase()} version must be greater than current version (${existingFile.version}). Please update version first.` },
        { status: 400 }
      )
    }
    
    console.log('Version check passed, proceeding with upload')

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Use GridFS to store file
    const bucket = new GridFSBucket(db, { bucketName: 'server_files' })
    
    // Generate unique filename with version
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueFileName = `${actualFileType}_v${version}_${timestamp}_${sanitizedFileName}`

    // Delete old file from GridFS if exists
    if (existingFile && existingFile.gridfsId) {
      try {
        const gridfsObjectId = typeof existingFile.gridfsId === 'string' 
          ? new ObjectId(existingFile.gridfsId) 
          : existingFile.gridfsId
        await bucket.delete(gridfsObjectId)
      } catch (error) {
        console.error('Error deleting old file from GridFS:', error)
        // Continue even if old file deletion fails
      }
    }

    // Upload file to GridFS
    const uploadStream = bucket.openUploadStream(uniqueFileName, {
      contentType: file.type || `application/${fileExtension}`,
      metadata: {
        fileType: actualFileType,
        version: version,
        originalName: fileName,
        uploadedBy: auth.username
      }
    })

    // Write buffer to GridFS
    uploadStream.end(buffer)
    
    // Wait for upload to complete
    const gridfsId = await new Promise<ObjectId>((resolve, reject) => {
      uploadStream.on('finish', () => {
        resolve(uploadStream.id)
      })
      uploadStream.on('error', reject)
    })

    // Delete old file of same type from database
    if (existingFile) {
      await db.collection('server_files').deleteOne({ _id: existingFile._id })
    }

    // Save file info to database with consistent URL
    const fileUrl = `/api/files/${actualFileType}`
    const fileDoc = {
      url: fileUrl,
      fileName: uniqueFileName,
      originalName: fileName,
      fileSize: file.size,
      version: version,
      uploadedAt: new Date().toISOString(),
      contentType: file.type || `application/${fileExtension}`,
      uploadedBy: auth.username,
      fileType: actualFileType,
      gridfsId: gridfsId
    }

    const result = await db.collection('server_files').insertOne(fileDoc)
    
    console.log('File uploaded successfully:', { fileType: actualFileType, version, gridfsId: gridfsId.toString() })

    return NextResponse.json({
      status: true,
      data: {
        _id: result.insertedId.toString(),
        ...fileDoc
      },
      reason: 'File uploaded successfully'
    })

  } catch (error: any) {
    console.error('Error uploading file:', error)
    console.error('Error stack:', error?.stack)
    const errorMessage = error?.message || 'Failed to upload file'
    return NextResponse.json(
      { status: false, reason: errorMessage, error: error?.toString() },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request)
    
    if (!auth.authenticated) {
      return NextResponse.json(
        { status: false, reason: auth.role ? 'Only owner and super owner can view files' : 'Unauthorized' },
        { status: 403 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    // Get ZIP file
    const zipFile = await db.collection('server_files').findOne({ fileType: 'zip' })
    
    const baseUrl = request.headers.get('host') || 'localhost:3000'
    const protocol = request.headers.get('x-forwarded-proto') || 'http'

    const result: { zip?: any } = {}

    if (zipFile) {
      const fullUrl = zipFile.url.startsWith('http') 
        ? zipFile.url 
        : `${protocol}://${baseUrl}${zipFile.url}`
      result.zip = {
        _id: zipFile._id.toString(),
        url: fullUrl,
        fileName: zipFile.fileName,
        originalName: zipFile.originalName,
        fileSize: zipFile.fileSize,
        version: zipFile.version,
        uploadedAt: zipFile.uploadedAt,
        contentType: zipFile.contentType,
        uploadedBy: zipFile.uploadedBy,
        fileType: 'zip'
      }
    }

    return NextResponse.json({
      status: true,
      data: result
    })

  } catch (error) {
    console.error('Error fetching server files:', error)
    return NextResponse.json(
      { status: false, reason: 'Failed to fetch server files' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminAuth(request)
    
    if (!auth.authenticated) {
      return NextResponse.json(
        { status: false, reason: auth.role ? 'Only owner and super owner can delete files' : 'Unauthorized' },
        { status: 403 }
      )
    }
    
    const client = await clientPromise
    const db = client.db('nexpanel')
    
    // Get fileType from request body
    const body = await request.json().catch(() => ({}))
    const fileType = body.fileType as 'zip'

    if (!fileType || fileType !== 'zip') {
      return NextResponse.json({
        status: false,
        reason: 'File type must be zip'
      }, { status: 400 })
    }
    
    const file = await db.collection('server_files').findOne({ fileType })
    
    if (!file) {
      return NextResponse.json({
        status: false,
        reason: `No ${fileType.toUpperCase()} file found to delete`
      })
    }

    // Delete file from GridFS
    if (file.gridfsId) {
      try {
        const bucket = new GridFSBucket(db, { bucketName: 'server_files' })
        const gridfsObjectId = typeof file.gridfsId === 'string' 
          ? new ObjectId(file.gridfsId) 
          : file.gridfsId
        await bucket.delete(gridfsObjectId)
      } catch (error) {
        console.error('Error deleting file from GridFS:', error)
        // Continue even if file deletion fails
      }
    }

    // Delete from database
    await db.collection('server_files').deleteOne({ _id: file._id })

    return NextResponse.json({
      status: true,
      reason: `${fileType.toUpperCase()} file deleted successfully`
    })

  } catch (error) {
    console.error('Error deleting server file:', error)
    return NextResponse.json(
      { status: false, reason: 'Failed to delete server file' },
      { status: 500 }
    )
  }
}
