import { Key as KeyType } from '@/types'
import { X, Key, Users, Calendar, Clock, Copy, Edit, CheckCircle, AlertCircle, Ban, User } from 'lucide-react'

interface KeyDetailsModalProps {
  keyData: KeyType
  onClose: () => void
  onEdit: () => void
}

export default function KeyDetailsModal({ keyData, onClose, onEdit }: KeyDetailsModalProps) {
  const isExpired = new Date(keyData.expiryDate) < new Date()
  const daysUntilExpiry = Math.ceil((new Date(keyData.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  
  const getStatusInfo = () => {
    if (!keyData.isActive) {
      return { 
        status: 'Disabled', 
        color: 'gray', 
        icon: Ban, 
        bgColor: 'bg-gray-100 dark:bg-gray-700',
        textColor: 'text-gray-600 dark:text-gray-300',
        borderColor: 'border-gray-300 dark:border-gray-600'
      }
    }
    if (isExpired) {
      return { 
        status: 'Expired', 
        color: 'red', 
        icon: AlertCircle, 
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-600 dark:text-red-400',
        borderColor: 'border-red-300 dark:border-red-700'
      }
    }
    return { 
      status: 'Active', 
      color: 'green', 
      icon: CheckCircle, 
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      textColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-300 dark:border-green-700'
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Key className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Key Details
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View detailed information about this API key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Key String */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span>API Key</span>
            </label>
            <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white break-all">
                {keyData.key}
              </code>
              <button
                onClick={() => copyToClipboard(keyData.key)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className={`p-1.5 ${statusInfo.bgColor} rounded-lg`}>
                <StatusIcon className={`h-4 w-4 ${statusInfo.textColor}`} />
              </div>
              <span>Status</span>
            </label>
            <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl border ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
              <StatusIcon className={`h-4 w-4 ${statusInfo.textColor}`} />
              <span className={`text-sm font-medium ${statusInfo.textColor}`}>
                {statusInfo.status}
              </span>
            </div>
          </div>

          {/* Device Usage */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span>Device Usage</span>
            </label>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {keyData.currentDevices}
              </span>
              <span className="text-gray-500 dark:text-gray-400">/</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {keyData.maxDevices}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">devices</span>
            </div>
          </div>

          {/* Expiry Information */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Calendar className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <span>Expiry Information</span>
            </label>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Expiry Date</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(keyData.expiryDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Time Remaining</span>
                <span className={`text-sm font-medium ${
                  daysUntilExpiry < 0 ? 'text-red-500' :
                  daysUntilExpiry < 7 ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {daysUntilExpiry < 0 ? 'Expired' :
                   daysUntilExpiry === 0 ? 'Expires today' :
                   `${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''} remaining`}
                </span>
              </div>
            </div>
          </div>

          {/* Created By */}
          {keyData.createdByUsername && (
            <div>
              <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span>Generated By</span>
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-900 dark:text-white">
                  {keyData.createdByUsername} ({keyData.createdByRole || 'unknown'})
                </span>
              </div>
            </div>
          )}

          {/* Created Date */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </div>
              <span>Created</span>
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-900 dark:text-white">
                {new Date(keyData.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            <div className="flex items-center justify-center space-x-2">
              <Edit className="h-4 w-4" />
              <span>Edit Key</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
