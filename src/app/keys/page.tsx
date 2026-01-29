'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Navigation from '@/components/Navigation'
import KeyList from '@/components/KeyList'
import GenerateKeyModal from '@/components/GenerateKeyModal'
import GenerateKeySuccessModal from '@/components/GenerateKeySuccessModal'
import KeyDetailsModal from '@/components/KeyDetailsModal'
import EditKeyModal from '@/components/EditKeyModal'
import ExtendKeyModal from '@/components/ExtendKeyModal'
import { Key } from '@/types'
import { Key as KeyIcon, Plus, AlertCircle, Clock } from 'lucide-react'

function KeysPageContent() {
  const searchParams = useSearchParams()
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [generatedKeyData, setGeneratedKeyData] = useState<any>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [selectedKey, setSelectedKey] = useState<Key | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [auth, setAuth] = useState<{ role?: string }>({})

  useEffect(() => {
    loadAuth()
    loadKeys()
  }, [])

  const loadAuth = async () => {
    try {
      const res = await fetch('/api/auth/status', { cache: 'no-store' })
      const data = await res.json()
      if (data.authenticated) {
        setAuth(data)
      }
    } catch (error) {
      console.error('Error loading auth:', error)
    }
  }

  useEffect(() => {
    // Check if extend query parameter is present
    // Only show for Owner and Admin, not Reseller
    if (searchParams?.get('extend') === 'true' && (auth.role === 'owner' || auth.role === 'admin')) {
      setShowExtendModal(true)
      // Remove query parameter from URL
      window.history.replaceState({}, '', '/keys')
    }
    
    // Check if generate query parameter is present
    if (searchParams?.get('generate') === 'true') {
      setShowGenerateModal(true)
      // Remove query parameter from URL
      window.history.replaceState({}, '', '/keys')
    }
  }, [searchParams, auth.role])

  const loadKeys = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/keys')
      const data = await response.json()
      
      if (data.status) {
        // Sort keys by createdAt (newest first) so new keys appear at top
        const sortedKeys = [...data.data].sort((a: Key, b: Key) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return dateB - dateA // Newest first
        })
        setKeys(sortedKeys)
      } else {
        setError('Failed to load keys')
      }
    } catch (error) {
      console.error('Error loading keys:', error)
      setError('Error loading keys. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateKey = async (keyData: any) => {
    try {
      const response = await fetch('/api/generate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(keyData),
      })

      const result = await response.json()
      
      if (result.status) {
        setGeneratedKeyData(result.data)
        setShowGenerateModal(false)
        setShowSuccessModal(true)
        loadKeys() // Reload keys - new key will appear at top due to sorting
      } else {
        // Show error message - if server is off, this will show the message
        const errorMessage = result.reason || 'Failed to generate key'
        setError(errorMessage)
        
        // Check if error is about server being off - close modal in that case
        const isServerOffError = errorMessage.toLowerCase().includes('server is turned off') || 
                                 errorMessage.toLowerCase().includes('server off')
        
        if (isServerOffError) {
          // Close modal after showing error message
          setTimeout(() => {
            setShowGenerateModal(false)
            setError('') // Clear error after closing
          }, 3000) // Show error for 3 seconds then close
        } else {
          // For other errors, keep modal open
          setTimeout(() => setError(''), 10000) // Show for 10 seconds
        }
      }
    } catch (error) {
      console.error('Error generating key:', error)
      setError('Error generating key. Please try again.')
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleViewKeyDetails = (key: Key) => {
    setSelectedKey(key)
    setShowDetailsModal(true)
  }

  const handleEditKey = (key: Key) => {
    setSelectedKey(key)
    setShowEditModal(true)
  }

  const handleSaveKey = async (keyId: string, updates: Partial<Key>) => {
    try {
      const response = await fetch('/api/keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyId, updates }),
      })

      const result = await response.json()
      
      if (result.status) {
        setShowEditModal(false)
        setSelectedKey(null)
        setSuccess('Key updated successfully!')
        loadKeys()
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(`Error updating key: ${result.reason}`)
        setTimeout(() => setError(''), 5000)
      }
    } catch (error) {
      console.error('Error updating key:', error)
      setError('Error updating key. Please try again.')
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleDeleteKeys = async (keyIds: string[]) => {
    if (keyIds.length === 0) return

    if (window.confirm(`Are you sure you want to delete ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
      try {
        const response = await fetch('/api/keys', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ keyIds }),
        })

        const result = await response.json()
        
        if (result.status) {
          setSuccess(`Successfully deleted ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}!`)
          loadKeys()
          setTimeout(() => setSuccess(''), 5000)
        } else {
          setError(`Error deleting keys: ${result.reason}`)
          setTimeout(() => setError(''), 5000)
        }
      } catch (error) {
        console.error('Error deleting keys:', error)
        setError('Error deleting keys. Please try again.')
        setTimeout(() => setError(''), 5000)
      }
    }
  }

  const handleDisableKeys = async (keyIds: string[]) => {
    if (keyIds.length === 0) return

    if (window.confirm(`Are you sure you want to disable ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}?`)) {
      try {
        const response = await fetch('/api/keys', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ keyIds, updates: { isActive: false } }),
        })

        const result = await response.json()
        
        if (result.status) {
          setSuccess(`Successfully disabled ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}!`)
          loadKeys()
          setTimeout(() => setSuccess(''), 5000)
        } else {
          setError(`Error disabling keys: ${result.reason}`)
          setTimeout(() => setError(''), 5000)
        }
      } catch (error) {
        console.error('Error disabling keys:', error)
        setError('Error disabling keys. Please try again.')
        setTimeout(() => setError(''), 5000)
      }
    }
  }

  const handleActivateKeys = async (keyIds: string[]) => {
    if (keyIds.length === 0) return

    if (window.confirm(`Are you sure you want to activate ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}?`)) {
      try {
        const response = await fetch('/api/keys', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ keyIds, updates: { isActive: true } }),
        })

        const result = await response.json()
        
        if (result.status) {
          setSuccess(`Successfully activated ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}!`)
          loadKeys()
          setTimeout(() => setSuccess(''), 5000)
        } else {
          setError(`Error activating keys: ${result.reason}`)
          setTimeout(() => setError(''), 5000)
        }
      } catch (error) {
        console.error('Error activating keys:', error)
        setError('Error activating keys. Please try again.')
        setTimeout(() => setError(''), 5000)
      }
    }
  }

  const handleResetUUIDs = async (keyIds: string[]) => {
    if (keyIds.length === 0) return

    if (window.confirm(`Are you sure you want to reset UUIDs for ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}? This will disconnect all devices and remove all stored UUIDs.`)) {
      try {
        const response = await fetch('/api/keys/reset-uuids', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ keyIds }),
        })

        const result = await response.json()
        
        if (result.status) {
          setSuccess(`Successfully reset UUIDs for ${keyIds.length} key${keyIds.length > 1 ? 's' : ''}!`)
          loadKeys()
          setTimeout(() => setSuccess(''), 5000)
        } else {
          setError(`Error resetting UUIDs: ${result.reason}`)
          setTimeout(() => setError(''), 5000)
        }
      } catch (error) {
        console.error('Error resetting UUIDs:', error)
        setError('Error resetting UUIDs. Please try again.')
        setTimeout(() => setError(''), 5000)
      }
    }
  }

  const handleExtendKeys = async (keyIds: string[], newExpiryDate: string) => {
    try {
      const response = await fetch('/api/keys', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          keyIds, 
          updates: { expiryDate: newExpiryDate } 
        }),
      })

      const result = await response.json()
      
      if (result.status) {
        // Don't show success message here, it will be shown after modal closes
        loadKeys()
        return result
      } else {
        setError(`Error extending keys: ${result.reason}`)
        setTimeout(() => setError(''), 5000)
        throw new Error(result.reason)
      }
    } catch (error) {
      console.error('Error extending keys:', error)
      setError('Error extending keys. Please try again.')
      setTimeout(() => setError(''), 5000)
      throw error
    }
  }

  const getStats = () => {
    const total = keys.length
    const active = keys.filter(key => key.isActive).length
    const disabled = keys.filter(key => !key.isActive).length
    const expired = keys.filter(key => new Date(key.expiryDate) < new Date()).length
    
    return { total, active, disabled, expired }
  }

  const stats = getStats()

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
        <Navigation />
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 sm:px-6 lg:px-8">
          <div className="px-2 sm:px-4 py-4 sm:py-6 sm:px-0">
            <div className="animate-pulse mb-6 sm:mb-8">
              <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/2 sm:w-1/4 mb-3 sm:mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 sm:w-1/2"></div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm overflow-hidden shadow-lg rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
                      <div className="h-5 w-12 sm:h-6 sm:w-16 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                    </div>
                    <div className="mt-3 sm:mt-4 space-y-2">
                      <div className="h-3 sm:h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                      <div className="h-6 sm:h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-gray-200/50 dark:border-gray-700/50">
              <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-3 sm:mb-4"></div>
              <div className="space-y-3 sm:space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 sm:h-16 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
      <Navigation />
      
      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 sm:px-6 lg:px-8">
        <div className="px-2 sm:px-4 py-4 sm:py-6 sm:px-0 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-3 sm:space-y-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Keys Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
              Manage API keys, monitor usage, and control access
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            {/* Extend Key button - Only for Super Owner, Owner and Admin, not Reseller */}
            {(auth.role === 'owner' || auth.role === 'admin' || auth.role === 'super owner') && (
              <button
                onClick={() => setShowExtendModal(true)}
                className="group relative flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 group-hover:scale-110 transition-transform duration-300" />
                <span>Extend Key</span>
              </button>
            )}
            <button
              onClick={() => setShowGenerateModal(true)}
              className="group relative flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4 group-hover:scale-110 transition-transform duration-300" />
              <span>Generate New Key</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-xl sm:rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg sm:rounded-xl">
                  <KeyIcon className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Total Keys</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-xl sm:rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg sm:rounded-xl">
                  <div className="h-4 w-4 sm:h-6 sm:w-6 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Active Keys</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-xl sm:rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 sm:p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg sm:rounded-xl">
                  <div className="h-4 w-4 sm:h-6 sm:w-6 bg-yellow-500 rounded-full"></div>
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.disabled}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Disabled Keys</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-xl sm:rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 rounded-lg sm:rounded-xl">
                  <AlertCircle className="h-4 w-4 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-right">
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stats.expired}</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Expired Keys</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2 sm:space-x-3 shadow-lg">
            <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-red-700 dark:text-red-400 text-xs sm:text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center space-x-2 sm:space-x-3 shadow-lg">
            <div className="h-4 w-4 sm:h-5 sm:w-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <div className="h-2 w-2 bg-white rounded-full"></div>
            </div>
            <div>
              <p className="text-green-700 dark:text-green-400 text-xs sm:text-sm font-medium">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-xl sm:rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <KeyList
            keys={keys}
            onViewDetails={handleViewKeyDetails}
            onEditKey={handleEditKey}
            onDeleteKeys={handleDeleteKeys}
            onDisableKeys={handleDisableKeys}
            onResetUUIDs={handleResetUUIDs}
            onActivateKeys={handleActivateKeys}
          />
        </div>
      </div>

      {showGenerateModal && (
        <GenerateKeyModal
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerateKey}
        />
      )}

      {showSuccessModal && generatedKeyData && (
        <GenerateKeySuccessModal
          keyData={generatedKeyData}
          onClose={() => {
            setShowSuccessModal(false)
            setGeneratedKeyData(null)
          }}
        />
      )}

      {showDetailsModal && selectedKey && (
        <KeyDetailsModal
          keyData={selectedKey}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedKey(null)
          }}
          onEdit={() => {
            setShowDetailsModal(false)
            handleEditKey(selectedKey)
          }}
        />
      )}

      {showEditModal && selectedKey && (
        <EditKeyModal
          keyData={selectedKey}
          onClose={() => {
            setShowEditModal(false)
            setSelectedKey(null)
          }}
          onSave={handleSaveKey}
        />
      )}

      {showExtendModal && (
        <ExtendKeyModal
          keys={keys}
          onClose={() => setShowExtendModal(false)}
          onExtend={handleExtendKeys}
          onSuccess={(count) => {
            setSuccess(`Successfully extended ${count} key${count > 1 ? 's' : ''}!`)
            setTimeout(() => setSuccess(''), 5000)
          }}
        />
      )}
    </div>
  )
}

export default function KeysPage() {
  return (
    <Suspense fallback={
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
        <Navigation />
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 sm:px-6 lg:px-8">
          <div className="px-2 sm:px-4 py-4 sm:py-6 sm:px-0">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/4 mb-4"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <KeysPageContent />
    </Suspense>
  )
}