// src/app/users-server-off-on/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import {
  Server,
  Power,
  PowerOff,
  AlertCircle,
  Loader2,
  CheckCircle,
  Users,
} from 'lucide-react'
import type { UserRole } from '@/types'

interface ManagedUser {
  _id?: string
  username: string
  role: UserRole
  serverStatus?: boolean
  createdBy?: string
}

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: UserRole
}

export default function UsersServerOffOnPage() {
  const router = useRouter()
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/status', { cache: 'no-store' })
        const authData = await authRes.json()

        if (!authData.authenticated) {
          router.push('/login')
          return
        }

        setAuth(authData)

        if (authData.role === 'reseller') {
          setLoading(false)
          return
        }

        await loadUsers()
      } catch (err) {
        console.error('Users server off/on load error:', err)
        setError('Something went wrong while loading users.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users-server-status', { cache: 'no-store' })
      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Failed to load users.')
      } else {
        setUsers(data.data || [])
        // Initialize serverStatus to true if not set (default: on)
        setUsers(prev => prev.map(u => ({ ...u, serverStatus: u.serverStatus !== false })))
      }
    } catch (err) {
      console.error('Load users error:', err)
      setError('Failed to load users.')
    }
  }

  const handleSelectUser = (username: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(username)) {
        newSet.delete(username)
      } else {
        newSet.add(username)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const filtered = getFilteredUsers()
    const allSelected = filtered.every(u => selectedUsers.has(u.username))

    if (allSelected) {
      // Deselect all
      setSelectedUsers(prev => {
        const newSet = new Set(prev)
        filtered.forEach(u => newSet.delete(u.username))
        return newSet
      })
    } else {
      // Select all
      setSelectedUsers(prev => {
        const newSet = new Set(prev)
        filtered.forEach(u => {
          // Don't select users that cannot be managed
          if (canManageUser(u)) {
            newSet.add(u.username)
          }
        })
        return newSet
      })
    }
  }

  const canManageUser = (user: ManagedUser): boolean => {
    if (auth.role === 'super owner') {
      // Super owner can manage all users except themselves
      return user.username !== auth.username
    } else if (auth.role === 'owner') {
      // Owner can manage all users except super owner and themselves
      return user.role !== 'super owner' && user.username !== auth.username
    } else if (auth.role === 'admin') {
      // Admin can only manage users they created
      return user.createdBy === auth.username && user.username !== auth.username
    }
    return false
  }

  const handleToggleServerStatus = async (serverStatus: boolean) => {
    if (selectedUsers.size === 0) {
      setError('Please select at least one user.')
      return
    }

    try {
      setProcessing(true)
      setError(null)
      setSuccess(null)

      const usernames = Array.from(selectedUsers)

      const res = await fetch('/api/users-server-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggleServerStatus',
          usernames,
          serverStatus,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Failed to update server status.')
        return
      }

      // Show results
      const successCount = data.results.filter((r: any) => r.success).length
      const failCount = data.results.filter((r: any) => !r.success).length

      if (failCount > 0) {
        const errorMessages = data.results
          .filter((r: any) => !r.success)
          .map((r: any) => `${r.username}: ${r.message}`)
          .join('\n')
        setError(`Some operations failed:\n${errorMessages}`)
      } else {
        setSuccess(
          `Server ${serverStatus ? 'turned ON' : 'turned OFF'} for ${successCount} user(s) successfully.`
        )
      }

      // Refresh users list
      await loadUsers()
      setSelectedUsers(new Set())
    } catch (err) {
      console.error('Toggle server status error:', err)
      setError('Failed to update server status. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const getFilteredUsers = () => {
    return users.filter(u =>
      u.username.toLowerCase().includes(search.toLowerCase())
    )
  }

  const isOwnerOrAdmin = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'super owner'

  const filteredUsers = getFilteredUsers()

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Server className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Users Server Off/On
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Manage user server status. When turned off, all keys stop working.
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        {isOwnerOrAdmin && (
          <div className="mb-4">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search username..."
              className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        )}

        {/* Reseller unauthorized */}
        {auth.role === 'reseller' && (
          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                Not authorized
              </h2>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                Only owner, admin, and super owner can manage user server status.
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-4 mb-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-3">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-line">
              {success}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 mb-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
              {error}
            </p>
          </div>
        )}

        {/* Bulk Actions */}
        {isOwnerOrAdmin && selectedUsers.size > 0 && (
          <div className="mt-4 mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {selectedUsers.size} user(s) selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleServerStatus(true)}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                  <span>Turn ON Selected</span>
                </button>
                <button
                  onClick={() => handleToggleServerStatus(false)}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PowerOff className="h-4 w-4" />
                  )}
                  <span>Turn OFF Selected</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center space-y-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Loading users...
              </p>
            </div>
          </div>
        )}

        {/* Table */}
        {!loading && isOwnerOrAdmin && filteredUsers.length > 0 && (
          <div className="mt-4 bg-white/80 dark:bg-gray-900/70 rounded-2xl shadow-lg shadow-gray-200/60 dark:shadow-black/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50/80 dark:bg-gray-900/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={
                          filteredUsers.length > 0 &&
                          filteredUsers.every(
                            u => selectedUsers.has(u.username) || !canManageUser(u)
                          )
                        }
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Server Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created By
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/60 dark:bg-gray-950 divide-y divide-gray-200/70 dark:divide-gray-800">
                  {filteredUsers.map(user => {
                    const canManage = canManageUser(user)
                    const serverStatus = user.serverStatus !== false // default: true
                    const isSelected = selectedUsers.has(user.username)

                    return (
                      <tr
                        key={user.username}
                        className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors ${isSelected ? 'bg-blue-100/50 dark:bg-blue-900/20' : ''
                          }`}
                      >
                        <td className="px-6 py-3 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectUser(user.username)}
                            disabled={!canManage}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {user.username}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          <span
                            className={
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                              (user.role === 'super owner'
                                ? 'bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 dark:from-yellow-900/40 dark:to-orange-900/40 dark:text-orange-200'
                                : user.role === 'owner'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200'
                                  : user.role === 'admin'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200')
                            }
                          >
                            {user.role?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                          <span
                            className={
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                              (serverStatus
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200')
                            }
                          >
                            {serverStatus ? (
                              <>
                                <Power className="h-3 w-3 mr-1" />
                                ON
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3 mr-1" />
                                OFF
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {user.createdBy || '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && isOwnerOrAdmin && filteredUsers.length === 0 && (
          <div className="mt-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 p-6 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-300">
              No users found.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

