'use client'

import { useState, useEffect } from 'react'
import { Shield, Unlock, Clock, AlertTriangle, Search, Filter, Trash2, Ban, Timer } from 'lucide-react'

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

export default function BlockedIPsTab() {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'permanent' | 'temporary'>('all')

  useEffect(() => {
    fetchBlockedIPs()
    // Refresh every minute to update remaining times
    const interval = setInterval(fetchBlockedIPs, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchBlockedIPs = async () => {
    try {
      setIsLoading(true)
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
      setSuccess('IP address unblocked successfully!')
      setTimeout(() => setSuccess(''), 5000)
    } catch (error) {
      setError('Failed to unblock IP')
      console.error('Error unblocking IP:', error)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleBulkUnblock = async (ids: string[]) => {
    if (ids.length === 0) return

    if (window.confirm(`Are you sure you want to unblock ${ids.length} IP address${ids.length > 1 ? 'es' : ''}?`)) {
      try {
        const promises = ids.map(id => 
          fetch(`/api/blocked-ips?id=${id}`, { method: 'DELETE' })
        )
        
        await Promise.all(promises)
        setBlockedIPs(prev => prev.filter(ip => !ids.includes(ip._id)))
        setSuccess(`Successfully unblocked ${ids.length} IP address${ids.length > 1 ? 'es' : ''}!`)
        setTimeout(() => setSuccess(''), 5000)
      } catch (error) {
        setError('Failed to unblock some IP addresses')
        setTimeout(() => setError(''), 5000)
      }
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

  const filteredIPs = blockedIPs.filter(ip => {
    const matchesSearch = ip.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ip.reason.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'permanent' && ip.isPermanent) ||
                         (filterStatus === 'temporary' && !ip.isPermanent)
    
    return matchesSearch && matchesFilter
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Blocked IP Addresses
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage IP addresses blocked due to security violations
          </p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center space-x-2">
          <Unlock className="h-5 w-5 text-green-500" />
          <span className="text-green-700 dark:text-green-400">{success}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search IP addresses or reasons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
          />
        </div>

        {/* Filter */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filterStatus === 'all'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('permanent')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filterStatus === 'permanent'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Permanent
          </button>
          <button
            onClick={() => setFilterStatus('temporary')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filterStatus === 'temporary'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Temporary
          </button>
        </div>
      </div>

      {/* Blocked IPs List */}
      {filteredIPs.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No blocked IP addresses
          </h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            All IP addresses are currently allowed to access the system.
          </p>
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Blocked At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Remaining Time
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/50 dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredIPs.map((ip) => (
                  <tr key={ip._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                        {ip.ip}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatDate(ip.blockedAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {ip.reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                        {ip.attemptCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        ip.isPermanent 
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {ip.isPermanent ? 'Permanent' : 'Temporary'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        {formatRemainingTime(ip.remainingMinutes || null)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleUnblockIP(ip._id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors duration-200 flex items-center gap-1 ml-auto"
                      >
                        <Unlock className="h-4 w-4" />
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
  )
}
