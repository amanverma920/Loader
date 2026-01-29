'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { Server, Loader2, AlertCircle, CheckCircle, Power, PowerOff, Key, User, Save } from 'lucide-react'

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: string
}

export default function OnlineServerPage() {
  const router = useRouter()
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('Server is currently under maintenance. Please try again later.')
  
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  
  // Mod Name Change states
  const [modname, setModname] = useState('')
  const [currentModname, setCurrentModname] = useState('')
  const [selectedUserForModname, setSelectedUserForModname] = useState('')
  const [userModname, setUserModname] = useState('')
  const [currentUserModname, setCurrentUserModname] = useState('')
  const [userModNames, setUserModNames] = useState<any[]>([])
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
        loadServerStatus()
        loadModNames()
        loadAllUsers()
      } catch (err) {
        console.error(err)
        setError('Failed to load server status.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  const loadServerStatus = async () => {
    try {
      const res = await fetch('/api/server-status', { cache: 'no-store' })
      const data = await res.json()

      if (data.status) {
        setIsMaintenanceMode(data.data.isMaintenanceMode || false)
        setMaintenanceMessage(data.data.message || 'Server is currently under maintenance. Please try again later.')
      } else {
        setError(data.reason || 'Failed to load server status.')
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load server status.')
    }
  }
  
  const loadModNames = async () => {
    try {
      const res = await fetch('/api/online-server', { cache: 'no-store' })
      const data = await res.json()

      if (data.status) {
        setCurrentModname(data.data.modname || '')
        setUserModNames(data.data.userModNames || [])
      }
    } catch (err) {
      console.error(err)
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
  
  const handleUserModnameChange = (username: string) => {
    setSelectedUserForModname(username)
    const userMod = userModNames.find((u: any) => u.username === username)
    if (userMod) {
      setCurrentUserModname(userMod.modname || '')
      setUserModname(userMod.modname || '')
    } else {
      setCurrentUserModname('')
      setUserModname('')
    }
  }
  
  const handleSaveModname = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/online-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modname: modname.trim() || null }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update Mod Name.')
        setSaving(false)
        return
      }

      setMessage('Mod Name updated successfully!')
      setModname('')
      await loadModNames()
      
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
  
  const handleSaveUserModname = async () => {
    if (!selectedUserForModname) {
      setError('Please select a username.')
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/online-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: selectedUserForModname,
          userModname: userModname.trim() || null 
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update User Mod Name.')
        setSaving(false)
        return
      }

      setMessage('User Mod Name updated successfully!')
      setUserModname('')
      await loadModNames()
      
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

  const handleToggleMaintenance = async (newStatus: boolean) => {
    setError(null)
    setMessage(null)
    setSaving(true)

    try {
      const res = await fetch('/api/server-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isMaintenanceMode: newStatus,
          message: maintenanceMessage
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update server status.')
        setSaving(false)
        return
      }

      setIsMaintenanceMode(newStatus)
      setMessage(data.message || `Server ${newStatus ? 'is now in maintenance mode' : 'is now online'}`)
      
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

  const handleUpdateMessage = async () => {
    if (!maintenanceMessage.trim()) {
      setError('Maintenance message cannot be empty.')
      return
    }

    setError(null)
    setMessage(null)
    setSaving(true)

    try {
      const res = await fetch('/api/server-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isMaintenanceMode: isMaintenanceMode,
          message: maintenanceMessage.trim()
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setError(data.reason || 'Failed to update maintenance message.')
        setSaving(false)
        return
      }

      setMessage('Maintenance message updated successfully!')
      
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
          <div className="flex items-center space-x-3 mb-5">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center text-white shadow-md ${
              isMaintenanceMode 
                ? 'bg-gradient-to-tr from-red-500 to-orange-500 shadow-red-500/40' 
                : 'bg-gradient-to-tr from-green-500 to-emerald-500 shadow-green-500/40'
            }`}>
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Online Server
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage server maintenance mode and status.
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

          {/* Server Status */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  Server Status
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isMaintenanceMode 
                    ? 'Server is currently in maintenance mode. All keys are disabled.' 
                    : 'Server is online. All keys are working normally.'}
                </p>
              </div>
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                isMaintenanceMode 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              }`}>
                {isMaintenanceMode ? (
                  <PowerOff className="h-5 w-5" />
                ) : (
                  <Power className="h-5 w-5" />
                )}
                <span className="font-semibold text-sm">
                  {isMaintenanceMode ? 'Maintenance Mode' : 'Online'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleToggleMaintenance(false)}
                disabled={saving || !isMaintenanceMode}
                className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all ${
                  !isMaintenanceMode
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/40'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving && !isMaintenanceMode ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Power className="h-5 w-5" />
                    <span>Server On</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleToggleMaintenance(true)}
                disabled={saving || isMaintenanceMode}
                className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center space-x-2 transition-all ${
                  isMaintenanceMode
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/40'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving && isMaintenanceMode ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <PowerOff className="h-5 w-5" />
                    <span>Server Off</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Maintenance Message */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Maintenance Message
              </h2>
            </div>
            
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Message to display when maintenance mode is active
              </label>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={4}
                className="w-full p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100 resize-none"
                placeholder="Enter maintenance message..."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This message will be shown to users when they try to use keys during maintenance mode.
              </p>
            </div>

            <button
              onClick={handleUpdateMessage}
              disabled={saving || !maintenanceMessage.trim()}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Update Message'
              )}
            </button>
          </div>

          {/* Mod Name Change - General */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mod Name Change
              </h2>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Set the mod name that will be returned in the response for <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">api/connect</code> endpoint.
            </p>
            
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Current Mod Name
              </label>
              <input
                type="text"
                value={currentModname}
                disabled
                className="w-full p-2 rounded-lg border bg-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              />
              {!currentModname && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  No mod name set. App will receive empty string.
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                New Mod Name
              </label>
              <input
                type="text"
                value={modname}
                onChange={(e) => setModname(e.target.value)}
                className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="Enter mod name (leave empty to clear)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This name will appear in the response data as <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">modname</code> field.
              </p>
            </div>

            <button
              onClick={handleSaveModname}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Mod Name
                </>
              )}
            </button>
          </div>

          {/* Mod Name Change - Username Specific */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Mod Name Change Specific User
              </h2>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Set the mod name for a specific username. This will override the general mod name for <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">api/connect/{'{username}'}</code> endpoint.
            </p>

            {/* Select Username */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Select Username
              </label>
              <select
                value={selectedUserForModname}
                onChange={(e) => handleUserModnameChange(e.target.value)}
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

            {selectedUserForModname && (
              <>
                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Current Mod Name for {selectedUserForModname}
                  </label>
                  <input
                    type="text"
                    value={currentUserModname}
                    disabled
                    className="w-full p-2 rounded-lg border bg-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  />
                  {!currentUserModname && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      No mod name set. Will use general mod name or empty string.
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    New Mod Name for {selectedUserForModname}
                  </label>
                  <input
                    type="text"
                    value={userModname}
                    onChange={(e) => setUserModname(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                    placeholder="Enter mod name (leave empty to clear)"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This name will appear in the response for <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">api/connect/{selectedUserForModname}</code>.
                  </p>
                </div>

                <button
                  onClick={handleSaveUserModname}
                  disabled={saving}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save User Mod Name
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>When <strong>Server Off</strong> (Maintenance Mode ON): All keys will be disabled and users will see the maintenance message.</li>
                  <li>When <strong>Server On</strong> (Maintenance Mode OFF): All keys will work normally.</li>
                  <li>The maintenance message can be customized and will be returned in the API response.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

