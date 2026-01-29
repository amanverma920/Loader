'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SidebarLayout, { GlassCard, GlassCardContent } from '@/components/SidebarLayout'
import GenerateKeySuccessModal from '@/components/GenerateKeySuccessModal'
import { Key, Users, Calendar, Loader2, Zap, Wallet, AlertCircle, ChevronDown, Clock, Plus } from 'lucide-react'

interface DurationPricing {
    duration: number
    price: number
    type?: 'hours' | 'days'
}

export default function GenerateKeyPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        maxDevices: 1,
        selectedDuration: 0,
        selectedDurationType: 'days' as 'hours' | 'days',
        customKeyName: '',
        keyType: 'random' as 'random' | 'custom' | 'name',
    })
    const [loading, setLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [userBalance, setUserBalance] = useState<number>(0)
    const [durationPricing, setDurationPricing] = useState<DurationPricing[]>([])
    const [selectedPrice, setSelectedPrice] = useState<number>(0)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [error, setError] = useState('')
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [generatedKeyData, setGeneratedKeyData] = useState<any>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadGlobalSettings()
        loadUserBalance()
    }, [])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isDropdownOpen])

    const updatePrice = useCallback(() => {
        if (!formData.selectedDuration || durationPricing.length === 0) {
            setSelectedPrice(0)
            return
        }

        const selectedPricing = durationPricing.find((dp: DurationPricing) =>
            dp.duration === formData.selectedDuration && (dp.type || 'days') === formData.selectedDurationType
        )
        if (selectedPricing) {
            const basePrice = selectedPricing.price
            const totalPrice = basePrice * formData.maxDevices
            setSelectedPrice(totalPrice)
        } else {
            setSelectedPrice(0)
        }
    }, [formData.selectedDuration, formData.selectedDurationType, formData.maxDevices, durationPricing])

    useEffect(() => {
        updatePrice()
    }, [updatePrice])

    const loadGlobalSettings = async () => {
        try {
            const response = await fetch('/api/settings')
            const data = await response.json()

            if (data.status) {
                const pricing = data.data.durationPricing || []
                setDurationPricing(pricing)
                if (pricing.length > 0) {
                    const first = pricing[0]
                    setFormData(prev => ({
                        ...prev,
                        selectedDuration: first.duration,
                        selectedDurationType: first.type || 'days'
                    }))
                }
            }
        } catch (error) {
            console.error('Error loading global settings:', error)
            setDurationPricing([])
        } finally {
            setLoading(false)
        }
    }

    const loadUserBalance = async () => {
        try {
            const response = await fetch('/api/user/balance')
            const data = await response.json()

            if (data.success) {
                setUserBalance(data.data.balance || 0)
            }
        } catch (error) {
            console.error('Error loading user balance:', error)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.selectedDuration || formData.selectedDuration === 0) {
            setError('Please select a duration')
            setTimeout(() => setError(''), 5000)
            return
        }

        if (formData.keyType === 'custom' && (!formData.customKeyName || formData.customKeyName.trim().length < 4)) {
            setError('Please enter a custom key name (minimum 4 characters)')
            setTimeout(() => setError(''), 5000)
            return
        }

        if (selectedPrice > userBalance) {
            setError(`Insufficient balance! Required: ${selectedPrice.toFixed(2)}, Available: ${userBalance.toFixed(2)}`)
            setTimeout(() => setError(''), 5000)
            return
        }

        let expiryDate: Date
        if (formData.selectedDurationType === 'hours') {
            expiryDate = new Date(Date.now() + formData.selectedDuration * 60 * 60 * 1000)
        } else {
            expiryDate = new Date()
            expiryDate.setDate(expiryDate.getDate() + formData.selectedDuration)
        }
        const expiryDateString = expiryDate.toISOString().split('T')[0]

        setIsGenerating(true)
        try {
            const response = await fetch('/api/generate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    expiryDate: expiryDateString,
                    duration: formData.selectedDuration,
                    durationType: formData.selectedDurationType,
                    price: selectedPrice
                }),
            })

            const result = await response.json()

            if (result.status) {
                setGeneratedKeyData(result.data)
                setShowSuccessModal(true)
                await loadUserBalance()
                // Reset form
                setFormData(prev => ({
                    ...prev,
                    maxDevices: 1,
                    customKeyName: '',
                    keyType: 'random'
                }))
            } else {
                const errorMessage = result.reason || 'Failed to generate key'
                setError(errorMessage)
                setTimeout(() => setError(''), 10000)
            }
        } catch (error) {
            console.error('Error generating key:', error)
            setError('Error generating key. Please try again.')
            setTimeout(() => setError(''), 5000)
        } finally {
            setIsGenerating(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'maxDevices' ? parseInt(value) || 1 : value,
        }))
    }

    const handleDurationSelect = (duration: number, type: 'hours' | 'days' = 'days') => {
        setFormData(prev => ({
            ...prev,
            selectedDuration: duration,
            selectedDurationType: type
        }))
        setIsDropdownOpen(false)
    }

    const selectedDurationData = durationPricing.find(dp =>
        dp.duration === formData.selectedDuration && (dp.type || 'days') === formData.selectedDurationType
    )

    const getExpiryDate = (duration: number, type: 'hours' | 'days' = 'days') => {
        if (type === 'hours') {
            return new Date(Date.now() + duration * 60 * 60 * 1000)
        }
        return new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
    }

    if (loading) {
        return (
            <SidebarLayout title="Generate Key" description="Loading..." icon={Plus} iconGradient="from-blue-500 to-purple-600">
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading settings...</span>
                </div>
            </SidebarLayout>
        )
    }

    return (
        <SidebarLayout
            title="Generate Key"
            description="Create a new API key with custom settings"
            icon={Plus}
            iconGradient="from-blue-500 to-purple-600"
        >
            <div className="max-w-2xl mx-auto">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-3 shadow-lg">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
                    </div>
                )}

                <GlassCard>
                    <div className="flex items-center space-x-3 p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                            <Plus className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                New API Key
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure your key settings below
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Maximum Devices */}
                        <div>
                            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span>Maximum Devices</span>
                            </label>
                            <input
                                type="number"
                                name="maxDevices"
                                value={formData.maxDevices}
                                onChange={handleChange}
                                min="1"
                                max="10000000000"
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Enter maximum number of devices"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Price will be multiplied by number of devices
                            </p>
                        </div>

                        {/* Duration Selection */}
                        <div className="relative" ref={dropdownRef}>
                            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                </div>
                                <span>Select Duration</span>
                            </label>

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    disabled={durationPricing.length === 0}
                                    className="w-full px-4 py-3 text-left bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                        {selectedDurationData ? (
                                            <>
                                                <span className="font-semibold text-gray-900 dark:text-white truncate">
                                                    {selectedDurationData.duration} {selectedDurationData.type === 'hours' ? 'Hour' : 'Day'}{selectedDurationData.duration !== 1 ? 's' : ''}
                                                </span>
                                                <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                    ({selectedDurationData.price.toFixed(2)} per device)
                                                </span>
                                            </>
                                        ) : durationPricing.length === 0 ? (
                                            <span className="text-gray-500 dark:text-gray-400">No durations available</span>
                                        ) : (
                                            <span className="text-gray-500 dark:text-gray-400">Select duration...</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''} ${durationPricing.length === 0 ? 'opacity-50' : ''}`} />
                                </button>

                                {isDropdownOpen && durationPricing.length > 0 && (
                                    <div className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                        {durationPricing.map((dp: DurationPricing, index: number) => {
                                            const type = dp.type || 'days'
                                            const isSelected = formData.selectedDuration === dp.duration && formData.selectedDurationType === type
                                            const expiryDate = getExpiryDate(dp.duration, type)
                                            return (
                                                <button
                                                    key={`${dp.duration}-${type}-${index}`}
                                                    type="button"
                                                    onClick={() => handleDurationSelect(dp.duration, type)}
                                                    className={`w-full px-4 py-3 text-left transition-all duration-150 ${isSelected
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                            {type === 'hours' && <Clock className="h-4 w-4 text-purple-500 flex-shrink-0" />}
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`font-semibold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                                                    {dp.duration} {type === 'hours' ? (dp.duration === 1 ? 'Hour' : 'Hours') : (dp.duration === 1 ? 'Day' : 'Days')}
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                                                    Expires: {expiryDate.toLocaleDateString()} {type === 'hours' && expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} | {dp.price.toFixed(2)} per device
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={`text-lg font-bold whitespace-nowrap ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                                            {dp.price.toFixed(2)}
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            {durationPricing.length === 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                                    No durations configured. Please add durations in Settings.
                                </p>
                            )}
                        </div>

                        {/* Key Type */}
                        <div>
                            <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                    <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span>Choose Key Type</span>
                            </label>
                            <select
                                name="keyType"
                                value={formData.keyType}
                                onChange={(e) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        keyType: e.target.value as 'random' | 'custom' | 'name',
                                        customKeyName: e.target.value === 'random' ? '' : prev.customKeyName
                                    }))
                                }}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            >
                                <option value="random">Random Key</option>
                                <option value="name">Name Key</option>
                                <option value="custom">Custom Key</option>
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Select the type of key you want to generate. Name Key format: {formData.selectedDuration}{formData.selectedDurationType === 'hours' ? 'H' : 'D'}&gt;USERNAME-RANDOM
                            </p>
                        </div>

                        {/* Custom Key Name */}
                        {formData.keyType === 'custom' && (
                            <div>
                                <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                        <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <span>Custom Key Name</span>
                                </label>
                                <input
                                    type="text"
                                    name="customKeyName"
                                    value={formData.customKeyName}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter custom key name"
                                    maxLength={50}
                                    required={formData.keyType === 'custom'}
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Enter the name for your custom key (minimum 4 characters). It will be generated exactly as you type it.
                                </p>
                            </div>
                        )}

                        {/* Balance and Price Card */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Balance</span>
                                </div>
                                <span className="text-base font-bold text-gray-900 dark:text-white">{userBalance.toFixed(2)}</span>
                            </div>

                            {formData.selectedDuration > 0 && selectedPrice > 0 && (
                                <div className="space-y-2 pt-3 border-t border-blue-200 dark:border-blue-800">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Selected Duration:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {formData.selectedDuration} {formData.selectedDurationType === 'hours' ? (formData.selectedDuration === 1 ? 'hour' : 'hours') : (formData.selectedDuration === 1 ? 'day' : 'days')}
                                        </span>
                                    </div>
                                    {selectedDurationData && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Price per device:</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{selectedDurationData.price.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Number of devices:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{formData.maxDevices}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Price:</span>
                                        <span className={`text-lg font-bold ${selectedPrice > userBalance ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            {selectedPrice.toFixed(2)}
                                        </span>
                                    </div>
                                    {selectedPrice > userBalance && (
                                        <div className="flex items-start space-x-2 mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-xs text-red-700 dark:text-red-400">
                                                Insufficient balance! You need {(selectedPrice - userBalance).toFixed(2)} more.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isGenerating || !formData.selectedDuration || selectedPrice > userBalance || selectedPrice === 0 || durationPricing.length === 0}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {isGenerating ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Generating...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Zap className="h-4 w-4" />
                                        <span>Generate Key</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>
                </GlassCard>

                {showSuccessModal && generatedKeyData && (
                    <GenerateKeySuccessModal
                        keyData={generatedKeyData}
                        onClose={() => {
                            setShowSuccessModal(false)
                            setGeneratedKeyData(null)
                        }}
                    />
                )}
            </div>
        </SidebarLayout>
    )
}
