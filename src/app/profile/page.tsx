'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { User, Loader2, AlertCircle, CheckCircle, Upload, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { useLogo } from '@/contexts/LogoContext'

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { logoUrl, setLogoUrl } = useLogo()
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [profileImageInput, setProfileImageInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' })
        const data = await res.json()

        if (!data.authenticated) {
          router.push('/login')
          return
        }

        setAuth(data)
        setProfileImageUrl(logoUrl)
        setProfileImageInput(logoUrl)
      } catch (err) {
        console.error(err)
        setError('Failed to load profile info.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router, logoUrl])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB')
        return
      }

      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setProfileImageInput(result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSaveProfileImage = async () => {
    setError(null)
    setMessage(null)

    if (!profileImageInput || profileImageInput.trim().length === 0) {
      setError('Please select an image')
      return
    }

    setSaving(true)
    try {
      // If it's a data URL (base64), you might want to upload it to a server first
      // For now, we'll save it as URL
      await setLogoUrl(profileImageInput.trim())
      setProfileImageUrl(profileImageInput.trim())
      setMessage('Profile image updated successfully! Page will refresh...')
      setTimeout(() => {
        setMessage(null)
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLogo = async () => {
    setError(null)
    setMessage(null)

    if (!profileImageInput || profileImageInput.trim().length === 0) {
      setError('Please enter a logo URL or upload an image')
      return
    }

    setSaving(true)
    try {
      await setLogoUrl(profileImageInput.trim())
      setMessage('Logo updated successfully! Page will refresh...')
      setTimeout(() => {
        setMessage(null)
        window.location.reload()
      }, 1500)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
      <Navigation />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-black/40 p-6">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-5">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/40">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Profile Settings
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Update your profile picture and logo
              </p>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
            </div>
          )}

          {/* Profile Image Section */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Profile Picture
              </h2>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Current Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {profileImageInput ? (
                    <Image
                      src={profileImageInput}
                      alt="Profile"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                      onError={() => {
                        setProfileImageInput('/images/logo.svg')
                      }}
                    />
                  ) : (
                    <User className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Image</span>
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Supported formats: JPG, PNG, GIF (Max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Or Enter Image URL
              </label>
              <input
                type="text"
                value={profileImageInput}
                onChange={(e) => setProfileImageInput(e.target.value)}
                className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="https://example.com/image.png or data:image/..."
              />
            </div>

            <button
              onClick={handleSaveProfileImage}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Save Profile Picture'
              )}
            </button>
          </div>

          {/* Logo Section */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <ImageIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Logo (Navigation Bar)
              </h2>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Current Logo
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                      unoptimized
                      onError={() => {
                        // Fallback handled in Navigation component
                      }}
                    />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={profileImageInput}
                    onChange={(e) => setProfileImageInput(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                    placeholder="Enter logo URL or use profile image"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Enter image URL or data URL. Same as profile picture.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveLogo}
              disabled={saving}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Save Logo'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}