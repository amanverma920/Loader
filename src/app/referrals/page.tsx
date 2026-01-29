// src/app/referrals/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SidebarLayout from '@/components/SidebarLayout'
import { Shield, Users, Key, AlertCircle, CheckCircle, Loader2, Gift } from 'lucide-react'
import type { ReferralCode, UserRole } from '@/types'

interface AuthInfo {
  username?: string
  role?: UserRole
  authenticated: boolean
}

export default function ReferralsPage() {
  const [codes, setCodes] = useState<ReferralCode[]>([])
  const [role, setRole] = useState<UserRole>('reseller')
  const [initialBalance, setInitialBalance] = useState<number>(0)
  const [expiryDays, setExpiryDays] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const router = useRouter()

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' })
        const data = await res.json()
        if (!data.authenticated) {
          router.push('/login')
          return
        }
        setAuth(data)
        if (data.role === 'reseller') {
          setLoading(false)
          return
        }
        await loadCodes()
      } catch (err) {
        console.error(err)
        setError('Failed to load authentication.')
        setLoading(false)
      }
    }

    const loadCodes = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/referrals', { cache: 'no-store' })
        if (res.status === 401) {
          router.push('/login')
          return
        }
        const data = await res.json()
        if (data.success) {
          setCodes(data.data || [])
        } else {
          setError(data.message || 'Failed to fetch referral codes.')
        }
      } catch (err) {
        console.error(err)
        setError('Failed to fetch referral codes.')
      } finally {
        setLoading(false)
      }
    }

    loadAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async () => {
    // Validate expiry days
    if (!expiryDays || expiryDays <= 0) {
      setError('Expiry days is required and must be greater than 0.')
      return
    }

    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, initialBalance, expiryDays }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to create referral code.')
      } else {
        setSuccess('Referral code generated.')
        setCodes((prev) => [data.data, ...prev])
      }
    } catch (err) {
      console.error(err)
      setError('Failed to create referral code.')
    } finally {
      setCreating(false)
    }
  }

  const handleDisable = async (code: string) => {
    if (!confirm(`Disable referral code ${code}?`)) return
    try {
      const res = await fetch('/api/referrals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.message || 'Failed to disable code.')
      } else {
        setCodes((prev) =>
          prev.map((c) => (c.code === code ? { ...c, isActive: false } : c))
        )
      }
    } catch (err) {
      console.error(err)
      alert('Failed to disable code.')
    }
  }

  const isOwnerOrAdmin = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'super owner'

  return (
    <SidebarLayout
      title="Referral Codes"
      description="Generate referral codes with specific roles and starting balance."
      icon={Gift}
      iconGradient="from-purple-500 to-blue-500"
    >
      <div className="max-w-4xl mx-auto">

        {/* Reseller unauthorized view */}
        {auth.role === 'reseller' && (
          <div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-2xl flex items-start space-x-3">
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                Not authorized
              </h2>
              <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                Referral management is only available for owner and admin roles.
              </p>
            </div>
          </div>
        )}

        {auth.role !== 'reseller' && (
          <>
            {/* Alerts */}
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

            {/* Create form */}
            <div className="mb-8 bg-white/80 dark:bg-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-800/80 shadow-sm shadow-gray-200/40 dark:shadow-black/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  Create new referral code
                </h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex flex-col text-xs">
                    <label className="mb-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 tracking-wide uppercase">
                      Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60"
                    >
                      {auth.role === 'super owner' && (
                        <>
                          <option value="super owner">Super Owner</option>
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>

                        </>
                      )}
                      {auth.role === 'owner' && (
                        <>
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                        </>
                      )}
                      <option value="reseller">Reseller</option>
                    </select>
                  </div>

                  <div className="flex flex-col text-xs">
                    <label className="mb-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 tracking-wide uppercase">
                      Starting balance
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(Number(e.target.value || 0))}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60"
                      placeholder="0"
                    />
                  </div>

                  <div className="flex flex-col text-xs">
                    <label className="mb-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 tracking-wide uppercase">
                      Expiry (Days) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(Number(e.target.value || 1))}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-500/60"
                      placeholder="Enter days (required)"
                    />
                    <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                      Account will expire after these days (required)
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/40 hover:shadow-lg hover:from-purple-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Generate code
                  </>
                )}
              </button>
            </div>

            {/* Codes list */}
            <div className="bg-white/80 dark:bg-gray-900/80 rounded-2xl border border-gray-200/60 dark:border-gray-800/80 shadow-sm shadow-gray-200/40 dark:shadow-black/40 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Existing referral codes
                </h2>
              </div>

              {loading ? (
                <div className="py-10 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading referral codes...
                </div>
              ) : codes.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  No referral codes created yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 uppercase tracking-wide">
                        <th className="py-2 pr-4 text-left">Code</th>
                        <th className="py-2 px-4 text-left">Role</th>
                        <th className="py-2 px-4 text-left">Created By</th>
                        <th className="py-2 px-4 text-left">Start Balance</th>
                        <th className="py-2 px-4 text-left">Expiry</th>
                        <th className="py-2 px-4 text-left">Status</th>
                        <th className="py-2 px-4 text-left">Used By</th>
                        <th className="py-2 pl-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {codes.map((c) => (
                        <tr
                          key={c.code}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-gray-100">
                            {c.code}
                          </td>
                          <td className="py-2 px-4 capitalize text-gray-800 dark:text-gray-200">
                            {c.role}
                          </td>
                          <td className="py-2 px-4 text-gray-700 dark:text-gray-300">
                            {c.createdBy}
                          </td>
                          <td className="py-2 px-4 text-gray-700 dark:text-gray-300">
                            {typeof c.initialBalance === 'number' ? c.initialBalance : 0}
                          </td>
                          <td className="py-2 px-4 text-gray-700 dark:text-gray-300">
                            {c.expiryDays ? `${c.expiryDays} days` : c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : 'No expiry'}
                          </td>
                          <td className="py-2 px-4">
                            {c.isActive ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                Disabled
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-4 text-gray-700 dark:text-gray-300">
                            {c.usedBy || '-'}
                          </td>
                          <td className="py-2 pl-4 text-right">
                            {c.isActive && !c.usedBy && (
                              <button
                                type="button"
                                onClick={() => handleDisable(c.code)}
                                className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 transition-all"
                              >
                                Disable
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  )
}
