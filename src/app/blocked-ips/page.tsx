'use client'

import { useState, useEffect } from 'react'
import SidebarLayout from '@/components/SidebarLayout'
import { Shield, Unlock, Clock, AlertTriangle, Timer } from 'lucide-react'

interface BlockedIP {
  _id: string
  ip: string
  blockedAt: string
  reason: string
  attemptCount: number
  isPermanent: boolean
  expiresAt?: string
  remainingMinutes?: number | null
  isExpired?: boolean
}

export default function BlockedIPsPage() {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBlockedIPs()
    // Refresh every minute to update remaining times
    const interval = setInterval(fetchBlockedIPs, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchBlockedIPs = async () => {
    try {
      const response = await fetch('/api/blocked-ips')
      if (!response.ok) {
        throw new Error('Failed to fetch blocked IPs')
      }
      const data = await response.json()
      setBlockedIPs(data)
    } catch (error) {
      setError('Failed to load blocked IPs')
      console.error('Error fetching blocked IPs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnblockIP = async (id: string) => {
    try {
      const response = await fetch(`/api/blocked-ips?id=${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to unblock IP')
      }

      // Remove from local state
      setBlockedIPs(prev => prev.filter(ip => ip._id !== id))
    } catch (error) {
      setError('Failed to unblock IP')
      console.error('Error unblocking IP:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatRemainingTime = (minutes: number | null) => {
    if (minutes === null) return 'Permanent'
    if (minutes <= 0) return 'Expired'

    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return `${hours}h ${mins}m remaining`
    }
    return `${mins}m remaining`
  }

  if (isLoading) {
    return (
      <SidebarLayout title="Blocked IPs" description="Loading..." icon={Shield} iconGradient="from-red-500 to-orange-500">
        <div className="animate-pulse">
          <div className="grid gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout
      title="Blocked IP Addresses"
      description="Manage IPs blocked due to security violations"
      icon={Shield}
      iconGradient="from-red-500 to-orange-500"
    >
      <div className="max-w-6xl mx-auto">

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center space-x-3 shadow-lg">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <span className="text-red-700 dark:text-red-400 font-medium">{error}</span>
          </div>
        )}

        {/* Blocked IPs List */}
        {blockedIPs.length === 0 ? (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl p-8 sm:p-12 text-center shadow-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl w-fit mx-auto mb-4">
              <Shield className="h-12 w-12 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No blocked IP addresses
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
              All IP addresses are currently allowed to access the system.
            </p>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-2xl overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                      Blocked At
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                      Reason
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                      Time
                    </th>
                    <th className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {blockedIPs.map((ip) => (
                    <tr key={ip._id} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="p-2 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/50 dark:to-orange-900/50 rounded-lg mr-3">
                            <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                            {ip.ip}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {formatDate(ip.blockedAt)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                        <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                          {ip.reason}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${ip.isPermanent
                          ? 'bg-gradient-to-r from-red-100 to-red-200 text-red-700 dark:from-red-900/60 dark:to-red-800/60 dark:text-red-200'
                          : 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 dark:from-yellow-900/60 dark:to-amber-800/60 dark:text-yellow-200'
                          }`}>
                          {ip.isPermanent ? 'Permanent' : 'Temporary'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          {formatRemainingTime(ip.remainingMinutes || null)}
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleUnblockIP(ip._id)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-medium shadow-lg shadow-red-500/25 hover:shadow-red-500/40 hover:scale-105 transition-all duration-200"
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
