'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { Key, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, User, Trash2, Save } from 'lucide-react'

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: string
}

export default function ApiLicencePage() {
  const router = useRouter()
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [currentApiKey, setCurrentApiKey] = useState('')
  const [currentSecretKey, setCurrentSecretKey] = useState('')
  const [maskedApiKey, setMaskedApiKey] = useState('')
  const [maskedSecretKey, setMaskedSecretKey] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Key User Permission states
  const [usernamePermissions, setUsernamePermissions] = useState<any[]>([])
  const [selectedUsername, setSelectedUsername] = useState('')
  const [permissionType, setPermissionType] = useState<'auto' | 'manual'>('auto')
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [allUsers, setAllUsers] = useState<any[]>([])

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' })
        const data = await res.json()

        if (!data.authenticated) {
          router.push('/login')
          return
        }

        // Only owner and super owner can access
        if (data.role !== 'owner' && data.role !== 'super owner') {
          router.push('/dashboard')
          return
        }

        setAuth(data)
        loadApiKeys()
        loadUsernamePermissions()
        loadAllUsers()
      } catch (err) {
        console.error(err)
        setError('Failed to load API keys.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  const loadApiKeys = async () => {
    try {
      const res = await fetch('/api/api-licence', { cache: 'no-store' })
      const data = await res.json()

      if (data.status) {
        setCurrentApiKey(data.data.apiKey || '')
        setCurrentSecretKey(data.data.secretKey || '')
        setMaskedApiKey(data.data.maskedApiKey || '')
        setMaskedSecretKey(data.data.maskedSecretKey || '')
        // Clear input fields
        setApiKey('')
        setSecretKey('')
      } else {
        setError(data.reason || 'Failed to load API keys.')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load API keys.')
    }
  }

  const loadAllUsers = async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' })
      const data = await res.json()

      if (data.success) {
        setAllUsers(data.data || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadUsernamePermissions = async () => {
    try {
      const res = await fetch('/api/username-permissions', { cache: 'no-store' })
      const data = await res.json()

      if (data.status) {
        setUsernamePermissions(Array.isArray(data.data) ? data.data : [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleUsernameChange = async (username: string) => {
    setSelectedUsername(username)
    setSelectedUsers([])

    if (username) {
      // Load users created by this username (for auto mode)
      setLoadingUsers(true)
      try {
        const res = await fetch(`/api/username-permissions?action=users&username=${username}`, { cache: 'no-store' })
        const data = await res.json()

        if (data.status) {
          setAvailableUsers(data.data || [])

          // Check if permission already exists for this username
          const existing = usernamePermissions.find((p: any) => p.username === username)
          if (existing) {
            setPermissionType(existing.type)
            setSelectedUsers(existing.allowedUsers || [])
          } else {
            setPermissionType('auto')
            setSelectedUsers([])
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingUsers(false)
      }
    }
  }

  const handleSavePermission = async () => {
    if (!selectedUsername) {
      setError('Please select a username.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/username-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: selectedUsername,
          type: permissionType,
          allowedUsers: permissionType === 'manual' ? selectedUsers : []
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to save permission.')
        setSaving(false)
        return
      }

      setMessage('Key User Permission saved successfully!')
      await loadUsernamePermissions()

      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePermission = async (username: string) => {
    if (!confirm(`Are you sure you want to delete permission for ${username}?`)) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch(`/api/username-permissions?username=${username}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to delete permission.')
        setSaving(false)
        return
      }

      setMessage('Permission deleted successfully!')
      await loadUsernamePermissions()

      if (selectedUsername === username) {
        setSelectedUsername('')
        setSelectedUsers([])
        setAvailableUsers([])
      }

      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const toggleUserSelection = (username: string) => {
    setSelectedUsers(prev => {
      if (prev.includes(username)) {
        return prev.filter(u => u !== username)
      } else {
        return [...prev, username]
      }
    })
  }

  const handleSave = async () => {
    setError(null)
    setMessage(null)

    if (!apiKey.trim() && !secretKey.trim()) {
      setError('At least one key (API Key or Secret Key) must be provided.')
      return
    }

    if (apiKey.trim().length === 0) {
      setError('API Key cannot be empty.')
      return
    }

    if (secretKey.trim().length === 0) {
      setError('Secret Key cannot be empty.')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/api-licence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim(),
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update API keys.')
        setSaving(false)
        return
      }

      setMessage('API keys updated successfully!')
      await loadApiKeys()

      // Clear input fields after successful save
      setApiKey('')
      setSecretKey('')

      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateApiKey = async () => {
    if (!apiKey.trim()) {
      setError('API Key cannot be empty.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/api-licence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update API Key.')
        setSaving(false)
        return
      }

      setMessage('API Key updated successfully!')
      setApiKey('')
      await loadApiKeys()

      setTimeout(() => {
        setMessage(null)
      }, 3000)
    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSecretKey = async () => {
    if (!secretKey.trim()) {
      setError('Secret Key cannot be empty.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/api-licence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: secretKey.trim() }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update Secret Key.')
        setSaving(false)
        return
      }

      setMessage('Secret Key updated successfully!')
      setSecretKey('')
      await loadApiKeys()

      setTimeout(() => {
        setMessage(null)
      }, 3000)
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
          <div className="flex items-center space-x-3 mb-6">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
              <Key className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                API Licence
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Manage your API Key and Secret Key for authentication.
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

          {/* Key User Permission Section */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Key User Permission
              </h2>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Configure which user keys can be used with <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">api/connect/username</code> endpoints.
            </p>

            {/* Select Username */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Username
              </label>
              <select
                value={selectedUsername}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
              >
                <option value="">Select username</option>
                {allUsers.map((user) => (
                  <option key={user.username} value={user.username}>
                    {user.username} ({user.role})
                  </option>
                ))}
              </select>
            </div>

            {selectedUsername && (
              <>
                {/* Permission Type */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Key User Permission Type
                  </label>
                  <select
                    value={permissionType}
                    onChange={(e) => {
                      setPermissionType(e.target.value as 'auto' | 'manual')
                      if (e.target.value === 'auto') {
                        setSelectedUsers([])
                      }
                    }}
                    className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                  >
                    <option value="auto">Auto User Key</option>
                    <option value="manual">Manual User Key</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {permissionType === 'auto'
                      ? 'All users created by this username (via referral) can use their keys.'
                      : 'Select specific users whose keys can be used with this username endpoint.'}
                  </p>
                </div>

                {/* Manual User Selection */}
                {permissionType === 'manual' && (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Select Users (Multi-select) - Users created by {selectedUsername}
                    </label>
                    {loadingUsers ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto border rounded-lg p-2 bg-gray-50 dark:bg-gray-800">
                        {availableUsers.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
                            No users found for this username.
                          </p>
                        ) : (
                          availableUsers.map((user: any) => (
                            <label
                              key={user.username}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedUsers.includes(user.username)}
                                onChange={() => toggleUserSelection(user.username)}
                                className="rounded border-gray-300 dark:border-gray-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {user.username} ({user.role})
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Selected {selectedUsers.length} user(s). These users' keys will work with <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">api/connect/{selectedUsername}</code>
                    </p>
                  </div>
                )}

                {/* Save Button */}
                <button
                  onClick={handleSavePermission}
                  disabled={saving || (permissionType === 'manual' && selectedUsers.length === 0)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mb-4"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Permission
                    </>
                  )}
                </button>
              </>
            )}

            {/* Existing Permissions List */}
            {usernamePermissions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Existing Permissions
                </h3>
                <div className="space-y-2">
                  {usernamePermissions.map((permission: any) => (
                    <div
                      key={permission.username}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {permission.username}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Type: {permission.type === 'auto' ? 'Auto User Key' : 'Manual User Key'}
                          {permission.type === 'manual' && permission.allowedUsers && (
                            <span> ({permission.allowedUsers.length} users)</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeletePermission(permission.username)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                        title="Delete permission"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Current API Key */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <Key className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                API Key
              </h2>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Current API Key
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={showApiKey ? currentApiKey : maskedApiKey}
                  disabled
                  className="w-full p-2 rounded-lg border bg-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200 pr-10"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This key is used for API authentication in the connect endpoint.
              </p>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                New API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="Enter new API Key"
              />
            </div>

            <button
              onClick={handleUpdateApiKey}
              disabled={saving || !apiKey.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update API Key'
              )}
            </button>
          </div>

          {/* Current Secret Key */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Key className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Secret Key
              </h2>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Current Secret Key
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={showSecretKey ? currentSecretKey : maskedSecretKey}
                  disabled
                  className="w-full p-2 rounded-lg border bg-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200 pr-10"
                />
                <button
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This key is used for encrypting/decrypting data in the connect endpoint.
              </p>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                New Secret Key
              </label>
              <input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="Enter new Secret Key"
              />
            </div>

            <button
              onClick={handleUpdateSecretKey}
              disabled={saving || !secretKey.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update Secret Key'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

