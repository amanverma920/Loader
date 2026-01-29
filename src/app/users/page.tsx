// src/app/users/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import {
  Users,
  Shield,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Edit3,
  Trash2,
  CheckCircle,
} from 'lucide-react'
import type { UserRole } from '@/types'

interface ManagedUser {
  _id?: string
  username: string
  email?: string
  role: UserRole
  createdAt?: string
  createdBy?: string
  isActive?: boolean
  balance?: number
  accountExpiryDate?: string
}

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: UserRole
}

export default function ManageUsersPage() {
  const router = useRouter()
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [savingFor, setSavingFor] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // edit modal
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('reseller')
  const [editEmail, setEditEmail] = useState<string>('')
  const [editBalance, setEditBalance] = useState<number>(0)
  const [editExpiryDate, setEditExpiryDate] = useState<string>('')
  const [editExpiryTime, setEditExpiryTime] = useState<string>('')

  const [editSaving, setEditSaving] = useState(false)

  // delete confirm
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

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

        const res = await fetch('/api/users', { cache: 'no-store' })
        const data = await res.json()

        if (!data.success) {
          setError(data.message || 'Failed to load users.')
        } else {
          setUsers(data.data || [])
        }
      } catch (err) {
        console.error('Manage users load error:', err)
        setError('Something went wrong while loading users.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  const handleToggleActive = async (user: ManagedUser) => {
    try {
      setSavingFor(user.username)
      setError(null)
      setSuccess(null)

      const currentlyActive = user.isActive !== false

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setActive',
          username: user.username,
          isActive: !currentlyActive,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Failed to update user.')
        return
      }

      setUsers(prev =>
        prev.map(u =>
          u.username === user.username
            ? { ...u, isActive: !currentlyActive }
            : u
        )
      )

      setSuccess(
        `User ${user.username} ${currentlyActive ? 'disabled' : 'activated'
        } successfully.`
      )
    } catch (err) {
      console.error('Toggle user active error:', err)
      setError('Failed to update user. Please try again.')
    } finally {
      setSavingFor(null)
    }
  }

  const openEdit = (user: ManagedUser) => {
    setError(null)
    setSuccess(null)
    setEditingUser(user)
    setEditRole(user.role)
    setEditEmail(user.email || '')
    setEditBalance(user.balance || 0)


    // Set expiry date and time if exists
    if (user.accountExpiryDate) {
      const expiryDate = new Date(user.accountExpiryDate)
      // Convert UTC to IST for display
      // IST is UTC+5:30, so add 5:30 hours
      const istOffsetMinutes = 5 * 60 + 30
      const istDate = new Date(expiryDate.getTime() + istOffsetMinutes * 60 * 1000)
      const dateStr = istDate.toISOString().split('T')[0]
      const timeStr = istDate.toTimeString().split(' ')[0].slice(0, 5)
      setEditExpiryDate(dateStr)
      setEditExpiryTime(timeStr)
    } else {
      setEditExpiryDate('')
      setEditExpiryTime('')
    }
  }

  const handleEditSave = async () => {
    if (!editingUser) return
    try {
      setEditSaving(true)
      setError(null)
      setSuccess(null)

      // Calculate expiry date from date and time (IST to UTC)
      let accountExpiryDate: string | undefined
      if (editExpiryDate && editExpiryTime) {
        // Create date string in IST format
        const dateTimeStr = `${editExpiryDate}T${editExpiryTime}:00`
        // Parse as local time (browser will treat as local)
        const localDate = new Date(dateTimeStr)
        // Get UTC equivalent
        // IST is UTC+5:30, so we need to subtract 5:30 hours
        const istOffsetMinutes = 5 * 60 + 30 // 5 hours 30 minutes in minutes
        const utcDate = new Date(localDate.getTime() - istOffsetMinutes * 60 * 1000)
        accountExpiryDate = utcDate.toISOString()
      } else if (editExpiryDate) {
        // Only date provided, set to end of day in IST (23:59:59)
        const dateTimeStr = `${editExpiryDate}T23:59:59`
        const localDate = new Date(dateTimeStr)
        const istOffsetMinutes = 5 * 60 + 30
        const utcDate = new Date(localDate.getTime() - istOffsetMinutes * 60 * 1000)
        accountExpiryDate = utcDate.toISOString()
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateUser',
          username: editingUser.username,
          newRole: editRole,
          newEmail: editEmail,
          newBalance: editBalance,
          accountExpiryDate: accountExpiryDate || null,

        }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Failed to update user.')
        setEditSaving(false)
        return
      }

      setUsers(prev =>
        prev.map(u =>
          u.username === editingUser.username
            ? {
              ...u,
              role: editRole,
              email: editEmail,
              balance: editBalance,
              accountExpiryDate: accountExpiryDate,

            }
            : u
        )
      )

      setSuccess(`User ${editingUser.username} updated successfully.`)
      setEditingUser(null)
      setEditSaving(false)
    } catch (err) {
      console.error('Edit user error:', err)
      setError('Failed to update user. Please try again.')
      setEditSaving(false)
    }
  }

  const openDelete = (user: ManagedUser) => {
    setError(null)
    setSuccess(null)
    setDeletingUser(user)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return

    try {
      setDeleteSaving(true)
      setError(null)
      setSuccess(null)

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteUser',
          username: deletingUser.username,
        }),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Failed to delete user.')
        setDeleteSaving(false)
        return
      }

      setUsers(prev =>
        prev.filter(u => u.username !== deletingUser.username)
      )
      setSuccess(`User ${deletingUser.username} deleted successfully.`)
      setDeletingUser(null)
      setDeleteSaving(false)
    } catch (err) {
      console.error('Delete user error:', err)
      setError('Failed to delete user. Please try again.')
      setDeleteSaving(false)
    }
  }



  const isOwnerOrAdmin = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'super owner'

  // Check if current user is system-created owner
  const currentUserData = users.find(u => u.username === auth.username)
  const isSystemCreatedOwner = auth.role === 'owner' && (!currentUserData?.createdBy || currentUserData.createdBy === 'system')
  const isOwnerCreatedByOwner = auth.role === 'owner' && currentUserData?.createdBy && currentUserData.createdBy !== 'system' && currentUserData.createdBy !== auth.username

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Users className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Manage Users
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Owners can manage all users. Other owners and admins can only manage users they created.
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
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                Not authorized
              </h2>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                Only owner and admin roles can manage users. Please contact your
                panel owner.
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mt-4 mb-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-3">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              {success}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 mb-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
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
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/60 dark:bg-gray-950 divide-y divide-gray-200/70 dark:divide-gray-800">
                  {filteredUsers.map(user => {
                    const active = user.isActive !== false

                    // Permission checks
                    const canEditUser =
                      (auth.role === 'super owner' && user.username !== auth.username) ||
                      (isSystemCreatedOwner && user.role !== 'super owner' && user.username !== auth.username) ||
                      (isOwnerCreatedByOwner && user.createdBy === auth.username && user.username !== auth.username) ||
                      (auth.role === 'admin' && user.createdBy === auth.username && user.username !== auth.username)

                    const canDeleteUser =
                      (auth.role === 'super owner' && user.role !== 'super owner' && user.username !== auth.username) ||
                      (isSystemCreatedOwner && user.role !== 'super owner' && user.username !== auth.username) ||
                      (isOwnerCreatedByOwner && user.createdBy === auth.username && user.username !== auth.username) ||
                      (auth.role === 'admin' && user.createdBy === auth.username && user.username !== auth.username)

                    const canToggleActive = canEditUser
                    const disableDeleteButton = !canDeleteUser || user.username === auth.username

                    return (
                      <tr
                        key={user.username}
                        className="hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors"
                      >
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {user.username}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {user.email || '-'}
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
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {typeof user.balance === 'number'
                            ? user.balance.toFixed(2)
                            : '0.00'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {user.accountExpiryDate
                            ? new Date(user.accountExpiryDate).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })
                            : 'No expiry'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {user.createdBy || '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                          <span
                            className={
                              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                              (active
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200')
                            }
                          >
                            {active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end space-x-2">
                            {/* Toggle active/inactive */}
                            <button
                              disabled={
                                savingFor === user.username || !canToggleActive
                              }
                              onClick={() => handleToggleActive(user)}
                              className={
                                'inline-flex items-center space-x-1 rounded-full px-3 py-1 text-xs font-medium border transition ' +
                                (active
                                  ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20') +
                                (savingFor === user.username || !canToggleActive
                                  ? ' opacity-70 cursor-wait' : '')
                              }
                            >
                              {savingFor === user.username ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : active ? (
                                <ToggleLeft className="h-3 w-3" />
                              ) : (
                                <ToggleRight className="h-3 w-3" />
                              )}
                              <span>{active ? 'Disable' : 'Activate'}</span>
                            </button>

                            {/* Edit */}
                            <button
                              disabled={!canEditUser}
                              onClick={() => openEdit(user)}
                              className="inline-flex items-center space-x-1 rounded-full px-3 py-1 text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>



                            {/* Delete */}
                            <button
                              disabled={disableDeleteButton}
                              onClick={() => openDelete(user)}
                              className="inline-flex items-center space-x-1 rounded-full px-3 py-1 text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
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
            <p className="text-sm text-gray-600 dark:text-gray-300">
              No users found.
            </p>
          </div>
        )}

        {/* Edit Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Edit User – {editingUser.username}
              </h2>

              <div className="space-y-4">
                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as UserRole)}
                    disabled={
                      auth.role === 'super owner' ? false :
                        (isSystemCreatedOwner ? false :
                          (auth.role === 'owner' ? true : true))
                    }
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {auth.role === 'super owner' ? (
                      <>
                        <option value="super owner">Super Owner</option>
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="reseller">Reseller</option>
                      </>
                    ) : isSystemCreatedOwner ? (
                      <>
                        <option value="admin">Admin</option>
                        <option value="reseller">Reseller</option>
                      </>
                    ) : (
                      <>
                        <option value="admin">Admin</option>
                        <option value="reseller">Reseller</option>
                      </>
                    )}
                  </select>
                  {!isSystemCreatedOwner && auth.role !== 'super owner' && (
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                      Only super owner and system-created owner can change roles
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    disabled={auth.role === 'super owner' ? false : (auth.role === 'owner' ? false : (auth.role === 'admin' ? true : true))}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="user@example.com"
                  />
                  {auth.role === 'admin' && (
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                      Admins can only add balance to resellers they created
                    </p>
                  )}
                </div>

                {/* Balance */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Balance
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editBalance}
                    onChange={e => setEditBalance(Number(e.target.value || 0))}
                    disabled={auth.role === 'super owner' ? false : (auth.role === 'owner' ? false : (auth.role === 'admin' ? false : true))}
                    className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {auth.role === 'admin' && (
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                      Admins can only add balance to resellers they created
                    </p>
                  )}
                </div>

                {/* Account Expiry Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    Account Expiry Date (IST)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editExpiryDate}
                      onChange={e => setEditExpiryDate(e.target.value)}
                      disabled={auth.role === 'super owner' ? false : (auth.role === 'owner' ? false : true)}
                      className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <input
                      type="time"
                      value={editExpiryTime}
                      onChange={e => setEditExpiryTime(e.target.value)}
                      disabled={auth.role === 'super owner' ? false : (auth.role === 'owner' ? false : true)}
                      className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  {auth.role === 'admin' && (
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                      Admins can only add balance to resellers they created
                    </p>
                  )}
                </div>


              </div>

              <div className="flex justify-end space-x-2 mt-5">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  disabled={editSaving}
                  onClick={handleEditSave}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70 flex items-center space-x-1"
                >
                  {editSaving && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center space-x-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <span>Delete User</span>
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                Are you sure you want to delete{' '}
                <span className="font-semibold">
                  {deletingUser.username}
                </span>
                ? This action cannot be undone.
              </p>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  disabled={deleteSaving}
                  onClick={handleDeleteConfirm}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-70 flex items-center space-x-1"
                >
                  {deleteSaving && (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  )}
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
