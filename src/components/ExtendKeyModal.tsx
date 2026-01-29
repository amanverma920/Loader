'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Key, CheckCircle, AlertCircle } from 'lucide-react'
import { Key as KeyType } from '@/types'

interface ExtendKeyModalProps {
  keys: KeyType[]
  onClose: () => void
  onExtend: (keyIds: string[], newExpiryDate: string) => Promise<any>
  onSuccess?: (count: number) => void
}

export default function ExtendKeyModal({ keys, onClose, onExtend, onSuccess }: ExtendKeyModalProps) {
  const [singleKeyInput, setSingleKeyInput] = useState('')
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<string>>(new Set())
  const [extendDateTime, setExtendDateTime] = useState('')
  const [allExtendDateTime, setAllExtendDateTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Set default date time to current time + 1 day
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateTimeString = tomorrow.toISOString().slice(0, 16)
    setExtendDateTime(dateTimeString)
    setAllExtendDateTime(dateTimeString)
  }, [])

  const handleExtendSingleKey = async () => {
    if (!singleKeyInput.trim()) {
      setError('Please enter a key')
      setTimeout(() => setError(''), 3000)
      return
    }

    const foundKey = keys.find(k => k.key === singleKeyInput.trim())
    if (!foundKey) {
      setError('Key not found')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!extendDateTime) {
      setError('Please select date and time')
      setTimeout(() => setError(''), 3000)
      return
    }

    setLoading(true)
    setError('')
    
    try {
      // Get current expiry date of the key
      const currentExpiry = new Date(foundKey.expiryDate)
      // Get the selected extend date/time
      const selectedExtendDate = new Date(extendDateTime)
      // Get current date/time
      const now = new Date()
      
      // Calculate the difference between selected date and now (this is how much to extend)
      const extendDuration = selectedExtendDate.getTime() - now.getTime()
      
      // Add this duration to the current expiry date
      const newExpiryDate = new Date(currentExpiry.getTime() + extendDuration)
      
      await onExtend([foundKey._id], newExpiryDate.toISOString())
      
      // Close modal first
      setSingleKeyInput('')
      onClose()
      
      // Show success message
      if (onSuccess) {
        onSuccess(1)
      }
    } catch (error) {
      setError('Failed to extend key')
      setTimeout(() => setError(''), 3000)
      setLoading(false)
    }
  }

  const handleExtendAllKeys = async () => {
    if (selectedKeyIds.size === 0) {
      setError('Please select at least one key')
      setTimeout(() => setError(''), 3000)
      return
    }

    if (!allExtendDateTime) {
      setError('Please select date and time')
      setTimeout(() => setError(''), 3000)
      return
    }

    setLoading(true)
    setError('')
    
    try {
      // Get the selected extend date/time
      const selectedExtendDate = new Date(allExtendDateTime)
      // Get current date/time
      const now = new Date()
      
      // Calculate the difference between selected date and now (this is how much to extend)
      const extendDuration = selectedExtendDate.getTime() - now.getTime()
      
      // For each selected key, add the extend duration to its current expiry date
      const selectedKeys = keys.filter(k => selectedKeyIds.has(k._id))
      const extendPromises = selectedKeys.map(key => {
        const currentExpiry = new Date(key.expiryDate)
        const newExpiryDate = new Date(currentExpiry.getTime() + extendDuration)
        return onExtend([key._id], newExpiryDate.toISOString())
      })
      
      await Promise.all(extendPromises)
      const totalSelected = selectedKeyIds.size
      
      // Close modal first
      setSelectedKeyIds(new Set())
      onClose()
      
      // Show success message with actual count
      if (onSuccess) {
        onSuccess(totalSelected)
      }
    } catch (error) {
      setError('Failed to extend keys')
      setTimeout(() => setError(''), 3000)
      setLoading(false)
    }
  }

  const toggleKeySelection = (keyId: string) => {
    const newSelected = new Set(selectedKeyIds)
    if (newSelected.has(keyId)) {
      newSelected.delete(keyId)
    } else {
      newSelected.add(keyId)
    }
    setSelectedKeyIds(newSelected)
  }

  const toggleAllKeys = () => {
    if (selectedKeyIds.size === keys.length) {
      setSelectedKeyIds(new Set())
    } else {
      setSelectedKeyIds(new Set(keys.map(k => k._id)))
    }
  }


  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Extend Key</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Extend expiry date for keys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Extend Single Key Section */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Extend Single Key</span>
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter Key
                </label>
                <input
                  type="text"
                  value={singleKeyInput}
                  onChange={(e) => setSingleKeyInput(e.target.value)}
                  placeholder="Enter key to extend"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={extendDateTime}
                  onChange={(e) => setExtendDateTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={handleExtendSingleKey}
                disabled={loading}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Extending...</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    <span>Extend</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* All Extend Keys Section - Always visible */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <Key className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>All Extend Keys</span>
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={allExtendDateTime}
                  onChange={(e) => setAllExtendDateTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Keys to Extend
                  </label>
                  <button
                    onClick={toggleAllKeys}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedKeyIds.size === keys.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-700">
                  {keys.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      No keys available
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-600">
                      {keys.map((key) => (
                        <label
                          key={key._id}
                          className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedKeyIds.has(key._id)}
                            onChange={() => toggleKeySelection(key._id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {key.key}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Expires: {new Date(key.expiryDate).toLocaleString()}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleExtendAllKeys}
                disabled={loading || selectedKeyIds.size === 0}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Extending...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Extend Keys ({selectedKeyIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-green-700 dark:text-green-400 text-sm">{success}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
