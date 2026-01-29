// src/app/balance/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import { Wallet, AlertCircle, CheckCircle, Loader2, Shield } from 'lucide-react'
import type { UserRole } from '@/types'

interface BalanceUser {
  username: string
  role: UserRole
  balance?: number
}

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: UserRole
}

export default function BalancePage() {
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [users, setUsers] = useState<BalanceUser[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [amount, setAmount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const router = useRouter()

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

        const res = await fetch('/api/balance', { cache: 'no-store' })
        const data = await res.json()
        if (!data.success) {
          setError(data.message || 'Failed to load users.')
        } else {
          setUsers(data.data || [])
          if (data.data && data.data[0]) {
            setSelectedUser(data.data[0].username)
          }
        }
      } catch (err) {
        console.error(err)
        setError('Failed to load data.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!selectedUser) {
      setError('Please select a user.')
      return
    }
    if (!amount || amount <= 0) {
      setError('Amount must be greater than zero.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedUser, amount }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to update balance.')
      } else {
        setSuccess('Balance updated successfully.')
        const nb = data.newBalance
        setUsers((prev) =>
          prev.map((u) =>
            u.username === selectedUser ? { ...u, balance: nb } : u
          )
        )
        setAmount(0)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to update balance.')
    } finally {
      setSubmitting(false)
    }
  }

  const isOwnerOrAdmin = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'super owner'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                Add Balance
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Increase user balances. Owners can manage all, admins only resellers.
              </p>
            </div>
          </div>
        </div>

        {auth.role === 'reseller' && (
          <div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl flex items-start space-x-3">
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                Not authorized
              </h2>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                Balance management is only available for owner and admin roles.
              </p>
            </div>
          </div>
        )}

        {isOwnerOrAdmin && (
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
              </div>
            )}

            <div className="bg-white/80 dark:bg-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-800/80 shadow-sm shadow-gray-200/40 dark:shadow-black/40 p-4 sm:p-5 mb-8">
              {loading ? (
                <div className="py-8 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-sm text-gray-500 dark:text-gray-400">
                  No users available to manage.
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col text-xs">
                      <label className="mb-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 tracking-wide uppercase">
                        User
                      </label>
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60"
                      >
                        {users.map((u) => (
                          <option key={u.username} value={u.username}>
                            {u.username} ({u.role}) - balance: {u.balance || 0}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col text-xs">
                      <label className="mb-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 tracking-wide uppercase">
                        Amount to add
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value || 0))}
                        className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-md shadow-emerald-500/40 hover:shadow-lg hover:from-emerald-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Add balance'
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Users list */}
            {users.length > 0 && (
              <div className="bg-white/80 dark:bg-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-800/80 shadow-sm shadow-gray-200/40 dark:shadow-black/40 p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  Users & balances
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 uppercase tracking-wide">
                        <th className="py-2 pr-4 text-left">Username</th>
                        <th className="py-2 px-4 text-left">Role</th>
                        <th className="py-2 px-4 text-left">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.username}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                            {u.username}
                          </td>
                          <td className="py-2 px-4 capitalize text-gray-800 dark:text-gray-200">
                            {u.role}
                          </td>
                          <td className="py-2 px-4 text-gray-800 dark:text-gray-200">
                            {u.balance || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
