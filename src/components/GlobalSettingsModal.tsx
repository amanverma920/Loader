'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Save, Loader2, DollarSign, Plus, Trash2, CheckCircle2, Clock, Calendar } from 'lucide-react'

interface GlobalSettingsModalProps {
  onClose: () => void
  onUpdate: () => void
}

interface DurationPricing {
  duration: number
  price: number
  type?: 'hours' | 'days' // hours or days
}

interface GlobalSettings {
  pricePerDay?: number
  durationPricing?: DurationPricing[]
}

export default function GlobalSettingsModal({ onClose, onUpdate }: GlobalSettingsModalProps) {
  const [formData, setFormData] = useState<GlobalSettings>({
    pricePerDay: 10,
    durationPricing: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showSuccess])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()
      
      if (data.status) {
        setFormData({
          pricePerDay: data.data.pricePerDay || 10,
          durationPricing: data.data.durationPricing || [],
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      setFormData({
        pricePerDay: 10,
        durationPricing: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const text = await response.text()
      if (!text) {
        throw new Error('Empty response from server')
      }

      const result = JSON.parse(text)
      
      if (result.status) {
        setSuccessMessage('Settings saved successfully!')
        setShowSuccess(true)
        setTimeout(() => {
          onUpdate()
          onClose()
        }, 1500)
      } else {
        alert(`Error updating settings: ${result.reason}`)
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      if (error instanceof Error) {
        alert(`Error updating settings: ${error.message}`)
      } else {
        alert('Error updating settings. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  const addDurationPricing = () => {
    setFormData(prev => ({
      ...prev,
      durationPricing: [...(prev.durationPricing || []), { duration: 1, price: 0, type: 'days' }]
    }))
    setSuccessMessage('Duration added successfully!')
    setShowSuccess(true)
  }

  const removeDurationPricing = (index: number) => {
    setFormData(prev => ({
      ...prev,
      durationPricing: prev.durationPricing?.filter((_, i) => i !== index) || []
    }))
    setSuccessMessage('Duration removed successfully!')
    setShowSuccess(true)
  }

  const updateDurationPricing = (index: number, field: 'duration' | 'price' | 'type', value: number | string) => {
    setFormData(prev => ({
      ...prev,
      durationPricing: prev.durationPricing?.map((dp, i) => 
        i === index ? { ...dp, [field]: value } : dp
      ) || []
    }))
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">Loading settings...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-auto my-auto max-h-[95vh] sm:max-h-[98vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 sm:p-2 rounded-lg">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                Edit Global Settings
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                Configure system-wide settings and announcements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="group relative p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {showSuccess && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm text-green-700 dark:text-green-400 font-medium">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center space-x-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
                <span>Duration Pricing</span>
              </label>
              <button
                type="button"
                onClick={addDurationPricing}
                className="flex items-center space-x-1 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>Add Duration</span>
              </button>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formData.durationPricing && formData.durationPricing.length > 0 ? (
                formData.durationPricing.map((dp, index) => (
                  <div key={index} className="flex items-start sm:items-center space-x-2 p-2 sm:p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Type</label>
                        <select
                          value={dp.type || 'days'}
                          onChange={(e) => updateDurationPricing(index, 'type', e.target.value as 'hours' | 'days')}
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-yellow-500 transition-all duration-200"
                        >
                          <option value="days">Days</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                          Duration ({dp.type === 'hours' ? 'Hours' : 'Days'})
                        </label>
                        <input
                          type="number"
                          value={dp.duration}
                          onChange={(e) => updateDurationPricing(index, 'duration', parseInt(e.target.value) || 1)}
                          min="1"
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-yellow-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Price (per device)</label>
                        <input
                          type="number"
                          value={dp.price}
                          onChange={(e) => updateDurationPricing(index, 'price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-yellow-500 transition-all duration-200"
                        />
                      </div>
                    </div>
                    {formData.durationPricing && formData.durationPricing.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDurationPricing(index)}
                        className="p-1.5 sm:p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mt-5 sm:mt-0"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 sm:px-4 py-3 text-center text-gray-500 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                  No durations configured. Click &quot;Add Duration&quot; to add one.
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set different prices for different durations. You can add hours or days. Price is per device - will be multiplied by number of devices.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2 sm:py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
