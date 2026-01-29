'use client'

import { X, CheckCircle2, Copy, Key, Calendar, Users, Wallet, Zap, Clock } from 'lucide-react'
import { useState } from 'react'

interface GenerateKeySuccessModalProps {
  keyData: {
    key: string
    expiryDate: string
    maxDevices: number
    price: number
    duration: number
    newBalance?: number
    activatedAt?: string | null
  }
  onClose: () => void
}

export default function GenerateKeySuccessModal({ keyData, onClose }: GenerateKeySuccessModalProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(keyData.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full my-auto max-h-[95vh] sm:max-h-[98vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50 animate-in fade-in zoom-in duration-200">
        <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl z-10 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="p-1.5 sm:p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                Key Generated Successfully!
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                Your new API key is ready to use
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors duration-200"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Key Display */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 sm:p-5 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">API Key</span>
              </div>
              <button
                onClick={copyToClipboard}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 hover:scale-105"
              >
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
              <code className="text-sm sm:text-base font-mono text-gray-900 dark:text-white break-all select-all">
                {keyData.key}
              </code>
            </div>
          </div>

          {/* Key Details */}
          <div className="space-y-3 sm:space-y-4">
            {keyData.activatedAt ? (
              <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                  {formatDate(keyData.expiryDate)}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  Not Activated
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Max Devices</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                {keyData.maxDevices}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Price Paid</span>
              </div>
              <span className="text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400">
                {keyData.price.toFixed(2)}
              </span>
            </div>

            {keyData.newBalance !== undefined && (
              <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Remaining Balance</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">
                  {keyData.newBalance.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 text-sm sm:text-base"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}