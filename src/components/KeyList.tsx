'use client'

import { useState, useMemo, useEffect } from 'react'
import { Key as KeyType } from '@/types'
import { Search, Filter, Eye, Edit, Trash2, Ban, Copy, MoreHorizontal, Calendar, Users, Zap, AlertCircle, CheckCircle, Key, EyeOff, Power, Clock, User } from 'lucide-react'

interface KeyListProps {
  keys: KeyType[]
  onViewDetails: (key: KeyType) => void
  onEditKey: (key: KeyType) => void
  onDeleteKeys: (keyIds: string[]) => Promise<void>
  onDisableKeys: (keyIds: string[]) => Promise<void>
  onResetUUIDs: (keyIds: string[]) => Promise<void>
  onActivateKeys?: (keyIds: string[]) => Promise<void>
}

type FilterStatus = 'all' | 'active' | 'disabled' | 'expired'

export default function KeyList({ keys, onViewDetails, onEditKey, onDeleteKeys, onDisableKeys, onResetUUIDs, onActivateKeys }: KeyListProps) {
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showAllKeys, setShowAllKeys] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Update current time every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredKeys = useMemo(() => {
    let filtered = keys

    if (searchTerm) {
      filtered = filtered.filter(key =>
        key.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (key.createdByUsername && key.createdByUsername.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(key => {
        const isExpired = key.activatedAt ? new Date(key.expiryDate) < new Date() : false
        const isPending = !key.activatedAt
        switch (filterStatus) {
          case 'active':
            return key.isActive && !isExpired && !isPending
          case 'disabled':
            return !key.isActive
          case 'expired':
            return isExpired
          default:
            return true
        }
      })
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter)
      filtered = filtered.filter(key => {
        const keyDate = new Date(key.expiryDate)
        return keyDate.toDateString() === filterDate.toDateString()
      })
    }

    return filtered
  }, [keys, searchTerm, filterStatus, dateFilter])

  const toggleKeyVisibility = (keyId: string) => {
    const newVisibleKeys = new Set(visibleKeys)
    if (newVisibleKeys.has(keyId)) {
      newVisibleKeys.delete(keyId)
    } else {
      newVisibleKeys.add(keyId)
    }
    setVisibleKeys(newVisibleKeys)
  }

  const toggleShowAllKeys = () => {
    setShowAllKeys(!showAllKeys)
    // Clear individual visibility states when toggling show all
    if (!showAllKeys) {
      setVisibleKeys(new Set())
    }
  }

  const toggleKeySelection = (keyId: string) => {
    const newSelectedKeys = new Set(selectedKeys)
    if (newSelectedKeys.has(keyId)) {
      newSelectedKeys.delete(keyId)
    } else {
      newSelectedKeys.add(keyId)
    }
    setSelectedKeys(newSelectedKeys)
  }

  const toggleAllKeys = () => {
    if (selectedKeys.size === filteredKeys.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(filteredKeys.map(key => key._id)))
    }
  }

  const copyToClipboard = async (keyString: string) => {
    try {
      await navigator.clipboard.writeText(keyString)
      setToastMessage('Key copied to clipboard!')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } catch (error) {
      console.error('Failed to copy key:', error)
      setToastMessage('Failed to copy key')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedKeys.size === 0) return

    if (window.confirm(`Are you sure you want to delete ${selectedKeys.size} key${selectedKeys.size > 1 ? 's' : ''}?`)) {
      setLoading(true)
      try {
        await onDeleteKeys(Array.from(selectedKeys))
        setSelectedKeys(new Set())
      } catch (error) {
        console.error('Error deleting keys:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleBulkDisable = async () => {
    if (selectedKeys.size === 0) return

    if (window.confirm(`Are you sure you want to disable ${selectedKeys.size} key${selectedKeys.size > 1 ? 's' : ''}?`)) {
      setLoading(true)
      try {
        await onDisableKeys(Array.from(selectedKeys))
        setSelectedKeys(new Set())
      } catch (error) {
        console.error('Error disabling keys:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleBulkActivate = async () => {
    if (selectedKeys.size === 0 || !onActivateKeys) return

    if (window.confirm(`Are you sure you want to activate ${selectedKeys.size} key${selectedKeys.size > 1 ? 's' : ''}?`)) {
      setLoading(true)
      try {
        await onActivateKeys(Array.from(selectedKeys))
        setSelectedKeys(new Set())
      } catch (error) {
        console.error('Error activating keys:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleBulkResetUUIDs = async () => {
    if (selectedKeys.size === 0) return

    if (window.confirm(`Are you sure you want to reset UUIDs for ${selectedKeys.size} key${selectedKeys.size > 1 ? 's' : ''}? This will disconnect all devices and remove all stored UUIDs.`)) {
      setLoading(true)
      try {
        await onResetUUIDs(Array.from(selectedKeys))
        setSelectedKeys(new Set())
      } catch (error) {
        console.error('Error resetting UUIDs:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleDeleteUnusedKeys = async () => {
    const unusedKeys = keys.filter(key => !key.activatedAt).map(key => key._id)

    if (unusedKeys.length === 0) {
      alert('No unused keys found')
      return
    }

    if (window.confirm(`Are you sure you want to delete ${unusedKeys.length} unused key${unusedKeys.length > 1 ? 's' : ''}? These are keys that have not been activated yet.`)) {
      setLoading(true)
      try {
        await onDeleteKeys(unusedKeys)
        setSelectedKeys(new Set())
        setToastMessage(`${unusedKeys.length} unused key${unusedKeys.length > 1 ? 's' : ''} deleted successfully`)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      } catch (error) {
        console.error('Error deleting unused keys:', error)
        setToastMessage('Failed to delete unused keys')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleDeleteExpiredKeys = async () => {
    const expiredKeys = keys.filter(key => {
      if (!key.activatedAt) return false
      return new Date(key.expiryDate) < new Date()
    }).map(key => key._id)

    if (expiredKeys.length === 0) {
      alert('No expired keys found')
      return
    }

    if (window.confirm(`Are you sure you want to delete ${expiredKeys.length} expired key${expiredKeys.length > 1 ? 's' : ''}?`)) {
      setLoading(true)
      try {
        await onDeleteKeys(expiredKeys)
        setSelectedKeys(new Set())
        setToastMessage(`${expiredKeys.length} expired key${expiredKeys.length > 1 ? 's' : ''} deleted successfully`)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      } catch (error) {
        console.error('Error deleting expired keys:', error)
        setToastMessage('Failed to delete expired keys')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 3000)
      } finally {
        setLoading(false)
      }
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterStatus('all')
    setDateFilter('')
  }

  const getKeyStatus = (key: KeyType) => {
    // Check if key is not activated yet
    if (!key.activatedAt) {
      return { status: 'pending', color: 'yellow', icon: Clock, text: 'Pending Activation' }
    }

    const isExpired = new Date(key.expiryDate) < currentTime

    if (!key.isActive) {
      return { status: 'disabled', color: 'gray', icon: Ban, text: 'Disabled' }
    }
    if (isExpired) {
      return { status: 'expired', color: 'red', icon: AlertCircle, text: 'Expired' }
    }
    return { status: 'active', color: 'green', icon: CheckCircle, text: 'Active' }
  }

  const getTimeUntilExpiry = (key: KeyType) => {
    // If key is not activated, show pending
    if (!key.activatedAt) {
      return null
    }

    // Calculate time difference directly (both dates are in UTC)
    const expiry = new Date(key.expiryDate)
    const now = currentTime
    const diffTime = expiry.getTime() - now.getTime()

    if (diffTime <= 0) {
      return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)

    return { expired: false, days, hours, minutes, seconds }
  }

  const formatExpiryDateTime = (expiryDate: string) => {
    const date = new Date(expiryDate)
    // Format directly in IST timezone
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    })
  }

  const hasInactiveSelected = Array.from(selectedKeys).some(keyId => {
    const key = keys.find(k => k._id === keyId)
    return key && !key.isActive
  })

  if (keys.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Key className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No keys found</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Get started by generating your first API key.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search keys or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleShowAllKeys}
              className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all duration-300 hover:scale-105 text-xs sm:text-sm"
              title={showAllKeys ? "Hide all keys" : "Show all keys"}
            >
              {showAllKeys ? (
                <>
                  <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium hidden sm:inline">Hide All Keys</span>
                  <span className="font-medium sm:hidden">Hide All</span>
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium hidden sm:inline">Show All Keys</span>
                  <span className="font-medium sm:hidden">Show All</span>
                </>
              )}
            </button>

            <button
              onClick={toggleAllKeys}
              className="group relative flex items-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-300 hover:scale-105 text-xs sm:text-sm"
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={selectedKeys.size === filteredKeys.length && filteredKeys.length > 0}
                  onChange={toggleAllKeys}
                  className="sr-only"
                  id="select-all-checkbox"
                />
                <label
                  htmlFor="select-all-checkbox"
                  className={`flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-md border-2 cursor-pointer transition-all duration-200 ${selectedKeys.size === filteredKeys.length && filteredKeys.length > 0
                    ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/30'
                    : 'bg-white/10 dark:bg-gray-700/50 border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400'
                    }`}
                >
                  {selectedKeys.size === filteredKeys.length && filteredKeys.length > 0 && (
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </label>
              </div>
              <span className="font-medium">Select All</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-300 text-xs sm:text-sm"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>

            <button
              onClick={handleDeleteUnusedKeys}
              disabled={loading}
              className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors duration-300 text-xs sm:text-sm disabled:opacity-50"
              title="Delete all unused (not activated) keys"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete Unused</span>
              <span className="sm:hidden">Unused</span>
            </button>

            <button
              onClick={handleDeleteExpiredKeys}
              disabled={loading}
              className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors duration-300 text-xs sm:text-sm disabled:opacity-50"
              title="Delete all expired keys"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete Expired</span>
              <span className="sm:hidden">Expired</span>
            </button>

            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="expired">Expired</option>
                </select>

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 text-xs sm:text-sm"
                />

                <button
                  onClick={clearFilters}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors duration-300 text-xs sm:text-sm"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedKeys.size > 0 && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              {selectedKeys.size} key{selectedKeys.size > 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {hasInactiveSelected && onActivateKeys && (
                <button
                  onClick={handleBulkActivate}
                  disabled={loading}
                  className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors duration-300 disabled:opacity-50 text-xs sm:text-sm"
                >
                  <Power className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>Activate Selected</span>
                </button>
              )}
              <button
                onClick={handleBulkDisable}
                disabled={loading}
                className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-xl hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors duration-300 disabled:opacity-50 text-xs sm:text-sm"
              >
                <Ban className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Disable Selected</span>
              </button>

              <button
                onClick={handleBulkResetUUIDs}
                disabled={loading}
                className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors duration-300 disabled:opacity-50 text-xs sm:text-sm"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Reset UUIDs</span>
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={loading}
                className="group relative flex items-center space-x-2 px-3 sm:px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors duration-300 disabled:opacity-50 text-xs sm:text-sm"
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Delete Selected</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredKeys.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 sm:py-12 text-center">
            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3 sm:mb-4">
              <Search className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">No keys found</h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        ) : (
          filteredKeys.map((key) => {
            const keyStatus = getKeyStatus(key)
            const timeUntilExpiry = getTimeUntilExpiry(key)
            const StatusIcon = keyStatus.icon
            // Key is visible if showAllKeys is true OR if it's in the visibleKeys set
            const isVisible = showAllKeys || visibleKeys.has(key._id)

            return (
              <div
                key={key._id}
                className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(key._id)}
                        onChange={() => toggleKeySelection(key._id)}
                        className="sr-only"
                        id={`checkbox-${key._id}`}
                      />
                      <label
                        htmlFor={`checkbox-${key._id}`}
                        className={`flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-md border-2 cursor-pointer transition-all duration-200 hover:scale-110 ${selectedKeys.has(key._id)
                          ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-500/30'
                          : 'bg-white/10 dark:bg-gray-700/50 border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400'
                          }`}
                      >
                        {selectedKeys.has(key._id) && (
                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </label>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="flex-shrink-0">
                          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${keyStatus.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                            keyStatus.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                              keyStatus.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                                'bg-gray-100 dark:bg-gray-700'
                            }`}>
                            <StatusIcon className={`h-3 w-3 sm:h-4 sm:w-4 ${keyStatus.color === 'green' ? 'text-green-600 dark:text-green-400' :
                              keyStatus.color === 'red' ? 'text-red-600 dark:text-red-400' :
                                keyStatus.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-gray-400'
                              }`} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <p className={`text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate transition-all duration-300 ${isVisible ? 'blur-none' : 'blur-md'
                              }`}>
                              {key.key}
                            </p>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => copyToClipboard(key.key)}
                                className="group relative p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => toggleKeyVisibility(key._id)}
                                className="group relative p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                                title={isVisible ? "Hide key" : "Show key"}
                              >
                                {isVisible ? (
                                  <EyeOff className="h-3 w-3" />
                                ) : (
                                  <Eye className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {!isVisible && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Key is hidden - click the eye icon to reveal
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:gap-4 mt-1">
                            <div className="flex items-center space-x-1">
                              <Users className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {key.currentDevices}/{key.maxDevices} devices
                              </span>
                            </div>

                            {key.createdByUsername && (
                              <div className="flex items-center space-x-1">
                                <User className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {key.createdByUsername} ({key.createdByRole || 'unknown'})
                                </span>
                              </div>
                            )}

                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <div className="flex flex-col gap-1">
                                {timeUntilExpiry === null ? (
                                  <span className="text-xs text-yellow-500">Pending Activation</span>
                                ) : timeUntilExpiry.expired ? (
                                  <span className="text-xs text-red-500">Expired</span>
                                ) : (
                                  <>
                                    <span className={`text-xs font-medium ${timeUntilExpiry.days < 7 ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-400'
                                      }`}>
                                      {timeUntilExpiry.days > 0 && `${timeUntilExpiry.days}d `}
                                      {timeUntilExpiry.hours > 0 && `${timeUntilExpiry.hours}h `}
                                      {timeUntilExpiry.minutes > 0 && `${timeUntilExpiry.minutes}m `}
                                      {timeUntilExpiry.seconds}s left
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {formatExpiryDateTime(key.expiryDate)} IST
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 sm:space-x-2 ml-2 sm:ml-4">
                    <button
                      onClick={() => onViewDetails(key)}
                      className="group relative p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors duration-200"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                    <button
                      onClick={() => onEditKey(key)}
                      className="group relative p-1.5 sm:p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors duration-200"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {showToast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
