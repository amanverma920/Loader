'use client'

import { useState, useEffect, useRef } from 'react'
import { Archive, Upload, AlertCircle, Loader2, X, Download, FileText, CheckCircle, RefreshCw, Package, Link as LinkIcon, Check } from 'lucide-react'

interface FileInfo {
  _id: string
  url: string
  fileName: string
  fileSize: number
  version: number
  uploadedAt: string
  contentType: string
  uploadedBy: string
  fileType: 'zip'
}

interface FileUploaderProps {
  onUploadSuccess?: () => void
  onUploadError?: (error: string) => void
}

export default function FileUploader({ onUploadSuccess, onUploadError }: FileUploaderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [zipFile, setZipFile] = useState<FileInfo | null>(null)
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null)
  const [zipVersion, setZipVersion] = useState<number>(1)
  const [zipVersionUpdated, setZipVersionUpdated] = useState(false)
  const [copiedZipLink, setCopiedZipLink] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const zipInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFiles()
  }, [])

  useEffect(() => {
    if (zipFile) {
      setZipVersion(zipFile.version)
      setZipVersionUpdated(false)
    } else {
      setZipVersion(1)
      setZipVersionUpdated(false)
    }
  }, [zipFile])

  const loadFiles = async () => {
    try {
      const response = await fetch('/api/upload')
      const result = await response.json()
      
      if (result.status && result.data) {
        const files = result.data
        if (files.zip) {
          setZipFile(files.zip)
        }
      }
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleZipVersionUpdate = () => {
    const newVersion = zipVersion + 1
    setZipVersion(newVersion)
    setZipVersionUpdated(true)
    setSuccess(`ZIP Version updated to ${newVersion}. You can now upload a new ZIP file.`)
    setTimeout(() => setSuccess(''), 5000)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedZipLink(true)
      setTimeout(() => setCopiedZipLink(false), 2000)
      setSuccess('Link copied to clipboard!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Failed to copy:', error)
      setError('Failed to copy link. Please try again.')
      setTimeout(() => setError(''), 3000)
    }
  }

  const handleZipFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      console.log('No file selected')
      return
    }

    console.log('File selected:', file.name, file.type)

    // Validate file type
    const fileName = file.name.toLowerCase()
    const lastDotIndex = fileName.lastIndexOf('.')
    if (lastDotIndex === -1) {
      setError('File must have an extension. Only .zip files are allowed.')
      setTimeout(() => setError(''), 5000)
      if (e.target) {
        e.target.value = ''
      }
      return
    }
    
    const fileExtension = fileName.substring(lastDotIndex + 1)
    if (fileExtension !== 'zip') {
      setError('Only .zip files are allowed for ZIP upload')
      setTimeout(() => setError(''), 5000)
      if (e.target) {
        e.target.value = ''
      }
      return
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      setError('File size must be less than 100MB')
      setTimeout(() => setError(''), 5000)
      if (e.target) {
        e.target.value = ''
      }
      return
    }

    setSelectedZipFile(file)
    setError('')
    setSuccess('ZIP file selected successfully!')
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleUpload = async () => {
    console.log('Upload button clicked for ZIP')
    
    if (!selectedZipFile) {
      setError('Please select a ZIP file to upload')
      setTimeout(() => setError(''), 5000)
      return
    }

    // For first upload (no existing file), allow version 1 without requiring version update
    // For subsequent uploads, require version update and version increment
    if (zipFile) {
      // Check if version is updated
      if (!zipVersionUpdated) {
        setError('Please update ZIP version number first using the "Update Version" button')
        setTimeout(() => setError(''), 5000)
        return
      }

      // Check if version is incremented
      if (zipVersion <= zipFile.version) {
        setError(`ZIP version must be greater than current version (${zipFile.version}). Please update version first.`)
        setTimeout(() => setError(''), 5000)
        return
      }
    } else {
      // First upload - ensure version is 1
      if (zipVersion !== 1) {
        setError(`For first upload, version must be 1. Current version is ${zipVersion}.`)
        setTimeout(() => setError(''), 5000)
        return
      }
    }

    setIsUploading(true)
    setError('')
    setSuccess('')
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', selectedZipFile)
      formData.append('version', zipVersion.toString())
      formData.append('fileType', 'zip')

      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(percentComplete)
        }
      })

      // Handle completion
      xhr.addEventListener('load', () => {
        try {
          console.log('Upload response status:', xhr.status)
          console.log('Upload response text:', xhr.responseText)
          
          let result
          try {
            result = JSON.parse(xhr.responseText)
            console.log('Parsed result:', result)
          } catch (parseError) {
            console.error('Failed to parse response:', xhr.responseText, parseError)
            setError(`Server returned invalid response: ${xhr.responseText.substring(0, 100)}`)
            setIsUploading(false)
            setUploadProgress(0)
            setTimeout(() => setError(''), 5000)
            return
          }

          if (xhr.status === 200 && result.status) {
            console.log('Upload successful, updating state')
            setZipFile(result.data)
            setSelectedZipFile(null)
            setZipVersionUpdated(false)
            if (zipInputRef.current) {
              zipInputRef.current.value = ''
            }
            setSuccess('ZIP file uploaded successfully!')
            onUploadSuccess?.()
            setTimeout(() => setSuccess(''), 5000)
          } else {
            const errorMessage = result.reason || result.message || `Upload failed with status ${xhr.status}`
            console.error('Upload error:', errorMessage, result, 'Status:', xhr.status)
            setError(errorMessage)
            onUploadError?.(errorMessage)
            setTimeout(() => setError(''), 5000)
          }
        } catch (error) {
          console.error('Error handling upload response:', error)
          setError(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
          onUploadError?.(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`)
          setTimeout(() => setError(''), 5000)
        } finally {
          setIsUploading(false)
          setUploadProgress(0)
        }
      })

      // Handle errors
      xhr.addEventListener('error', (e) => {
        console.error('XHR error event:', e)
        setError('Network error. Please check your connection and try again.')
        onUploadError?.('Network error. Please check your connection and try again.')
        setIsUploading(false)
        setUploadProgress(0)
        setTimeout(() => setError(''), 5000)
      })

      xhr.addEventListener('abort', () => {
        setError('Upload cancelled')
        setIsUploading(false)
        setUploadProgress(0)
        setTimeout(() => setError(''), 5000)
      })

      // Handle network errors
      xhr.onerror = () => {
        console.error('XHR onerror:', xhr.status, xhr.statusText)
        setError(`Network error: ${xhr.statusText || 'Connection failed'}`)
        setIsUploading(false)
        setUploadProgress(0)
        setTimeout(() => setError(''), 5000)
      }

      // Send request
      xhr.open('POST', '/api/upload')
      xhr.send(formData)

    } catch (error) {
      console.error('Upload error:', error)
      setError('Failed to upload file. Please try again.')
      onUploadError?.('Failed to upload file. Please try again.')
      setIsUploading(false)
      setUploadProgress(0)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleDeleteFile = async () => {
    if (!confirm('Are you sure you want to delete this ZIP file?')) {
      return
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileType: 'zip' })
      })

      const result = await response.json()

      if (result.status) {
        setZipFile(null)
        setZipVersion(1)
        setZipVersionUpdated(false)
        setSuccess('ZIP file deleted successfully!')
        onUploadSuccess?.()
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(result.reason || 'Failed to delete file')
        setTimeout(() => setError(''), 5000)
      }
    } catch (error) {
      console.error('Delete error:', error)
      setError('Failed to delete file. Please try again.')
      setTimeout(() => setError(''), 5000)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          Server File Management
        </h3>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
          Upload .zip files for your server. Update version before uploading new file.
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-3 shadow-lg">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center space-x-3 shadow-lg">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          <span className="text-green-700 dark:text-green-400 text-sm font-medium">{success}</span>
        </div>
      )}

      {/* ZIP File Section */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Package className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
            ZIP File Management
          </h4>
        </div>

        {/* Current ZIP File Display */}
        {zipFile && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0 w-full sm:w-auto">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex-shrink-0">
                  <Archive className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                    Current ZIP File
                  </h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {zipFile.fileName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
                    <span>Version: <strong className="text-gray-600 dark:text-gray-300">{zipFile.version}</strong></span>
                    <span>Size: <strong className="text-gray-600 dark:text-gray-300">{formatFileSize(zipFile.fileSize)}</strong></span>
                    <span className="hidden sm:inline">Uploaded: {new Date(zipFile.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 w-full sm:w-auto flex-wrap gap-2">
                <button
                  onClick={() => {
                    const baseUrl = window.location.origin
                    const linkUrl = `${baseUrl}/api/files/zip`
                    copyToClipboard(linkUrl)
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1"
                >
                  {copiedZipLink ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-3 w-3" />
                      Link
                    </>
                  )}
                </button>
                <a
                  href={zipFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
                <button
                  onClick={handleDeleteFile}
                  className="flex-1 sm:flex-none px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors duration-200 flex items-center justify-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ZIP Version Update */}
        <div className="mb-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                ZIP Version: <strong className="text-gray-900 dark:text-white">{zipVersion}</strong>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {zipFile 
                  ? `Next version will be: ${zipVersion + 1}`
                  : 'This will be the first version (1)'}
              </p>
            </div>
            <button
              onClick={handleZipVersionUpdate}
              disabled={isUploading}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Update ZIP Version</span>
            </button>
          </div>
          {zipVersionUpdated && (
            <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs text-green-700 dark:text-green-400">
                ✓ ZIP Version updated to {zipVersion}. You can now upload a new ZIP file.
              </p>
            </div>
          )}
        </div>

        {/* ZIP File Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="zipInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select ZIP File
            </label>
            <div className="relative">
              <input
                ref={zipInputRef}
                id="zipInput"
                type="file"
                accept=".zip"
                onChange={handleZipFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <label
                htmlFor="zipInput"
                className={`flex items-center justify-center w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-dashed rounded-xl transition-all duration-300 touch-manipulation ${
                  isUploading
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed pointer-events-none'
                    : selectedZipFile
                    ? 'border-orange-500 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/20 cursor-pointer active:bg-orange-100 dark:active:bg-orange-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-700/50 hover:border-orange-500 dark:hover:border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 cursor-pointer active:bg-orange-50 dark:active:bg-orange-900/20'
                }`}
                style={{ pointerEvents: isUploading ? 'none' : 'auto', WebkitTapHighlightColor: 'transparent' }}
              >
                <div className="flex flex-col items-center space-y-2">
                  <Upload className={`h-6 w-6 ${selectedZipFile ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {selectedZipFile ? selectedZipFile.name : 'Click to select ZIP file'}
                  </span>
                  {selectedZipFile && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedZipFile.size)}
                    </span>
                  )}
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Only .zip files are allowed. Maximum file size: 100MB
            </p>
          </div>

          {/* ZIP Upload Button */}
          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={
                isUploading || 
                !selectedZipFile || 
                (zipFile ? (!zipVersionUpdated || zipVersion <= zipFile.version) : zipVersion !== 1)
              }
              className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload ZIP</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">Uploading...</span>
              <span className="text-gray-500 dark:text-gray-400">{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          How it works
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• <strong>Step 1:</strong> Click "Update ZIP Version" button</li>
          <li>• <strong>Step 2:</strong> Select ZIP file to upload</li>
          <li>• <strong>Step 3:</strong> Click upload button</li>
          <li>• <strong>Old file works until version is updated</strong> - new upload only activates after version update</li>
          <li>• The file URL will be included in the login response as "serverfile"</li>
        </ul>
      </div>
    </div>
  )
}
