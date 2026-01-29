'use client'

import { useState, useEffect } from 'react'
import { Key as KeyType } from '@/types'
import { X, Key, Users, Calendar, Save, Loader2, Edit, ToggleRight } from 'lucide-react'

interface EditKeyModalProps {
  keyData: KeyType
  onClose: () => void
  onSave: (keyId: string, updates: Partial<KeyType>) => Promise<void>
}

export default function EditKeyModal({ keyData, onClose, onSave }: EditKeyModalProps) {
  const [formData, setFormData] = useState({
    key: '',
    maxDevices: 1,
    expiryDate: '',
    expiryTime: '',
    isActive: true
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (keyData) {
      const expiryDate = new Date(keyData.expiryDate)
      // Convert UTC to IST for display
      const istDateStr = expiryDate.toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      
      // Parse IST date string (format: DD/MM/YYYY, HH:MM:SS)
      const [datePart, timePart] = istDateStr.split(', ')
      const [day, month, year] = datePart.split('/')
      const [hours, minutes] = timePart.split(':')
      
      // Format for date input (YYYY-MM-DD)
      const dateStr = `${year}-${month}-${day}`
      // Format for time input (HH:MM)
      const timeStr = `${hours}:${minutes}`
      
      setFormData({
        key: keyData.key,
        maxDevices: keyData.maxDevices,
        expiryDate: dateStr,
        expiryTime: timeStr,
        isActive: keyData.isActive
      })
    }
  }, [keyData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) : value
    }))
  }

  const handleToggle = (field: 'isActive') => {
    setFormData(prev => ({
      ...prev,
      [field]: !prev[field]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyData) return

    setLoading(true)
    try {
      // Combine date and time in IST format
      const [year, month, day] = formData.expiryDate.split('-')
      const [hours, minutes] = formData.expiryTime.split(':')
      
      // Create date string in IST format: YYYY-MM-DDTHH:MM:SS
      const istDateTimeStr = `${year}-${month}-${day}T${hours}:${minutes}:00`
      
      // Create a date object treating the input as IST
      // We need to manually convert IST to UTC
      // IST is UTC+5:30, so we subtract 5 hours and 30 minutes
      const istDate = new Date(istDateTimeStr)
      const utcDate = new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000))
      
      const updates = {
        key: formData.key,
        maxDevices: parseInt(formData.maxDevices.toString()),
        expiryDate: utcDate.toISOString(),
        isActive: formData.isActive
      }

      await onSave(keyData._id, updates)
      onClose()
    } catch (error) {
      console.error('Error updating key:', error)
      alert('Error updating key. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!keyData) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Edit className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Edit Key
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Update key settings and configuration
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Key String */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span>API Key</span>
            </label>
            <input
              type="text"
              name="key"
              value={formData.key}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 font-mono"
              placeholder="Enter API key"
            />
          </div>

          {/* Max Devices */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span>Maximum Devices</span>
            </label>
            <input
              type="number"
              name="maxDevices"
              value={formData.maxDevices}
              onChange={handleChange}
              min="1"
              max="100"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              placeholder="Enter maximum number of devices"
            />
          </div>

          {/* Expiry Date & Time */}
          <div>
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Calendar className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <span>Expiry Date & Time (IST)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              />
              <input
                type="time"
                name="expiryTime"
                value={formData.expiryTime}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Time is in IST (India Standard Time)
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-4">
            {/* Active Status Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ToggleRight className={`h-4 w-4 ${formData.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Active Status</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formData.isActive ? 'Active' : 'Disabled'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('isActive')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                  formData.isActive
                    ? 'bg-gradient-to-r from-green-600 to-green-500 shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
