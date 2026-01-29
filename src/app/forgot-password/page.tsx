'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AlertCircle, CheckCircle, Loader2, Mail, Lock, KeyRound, Shield } from 'lucide-react'
import { usePanelName } from '@/contexts/PanelNameContext'
import { useLogo } from '@/contexts/LogoContext'

export default function ForgotPasswordPage() {
  const { panelName } = usePanelName()
  const { logoUrl } = useLogo()
  const router = useRouter()
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState<'input' | 'otp' | 'password'>('input')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.message || 'Failed to send OTP. Please try again.')
      } else {
        setSuccess('OTP has been sent to your email. Please check your inbox.')
        setStep('otp')
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, otp }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.message || 'Invalid OTP. Please try again.')
      } else {
        setSuccess('OTP verified successfully.')
        setStep('password')
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      setIsLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, otp, newPassword }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        setError(data.message || 'Failed to reset password. Please try again.')
      } else {
        setSuccess('Password reset successfully! Redirecting to login...')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Branding Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-orange-300 rounded-full blur-3xl" />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-pink-300 rounded-full blur-3xl" />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          {/* Logo */}
          <div className="mb-8">
            <div className="h-24 w-24 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20 overflow-hidden">
              {logoUrl && logoUrl !== '/images/logo.svg' ? (
                <Image
                  src={logoUrl}
                  alt={`${panelName || 'NexPanel'} Logo`}
                  width={80}
                  height={80}
                  className="w-full h-full object-contain p-2"
                  unoptimized
                />
              ) : (
                <Lock className="h-12 w-12 text-white" />
              )}
            </div>
          </div>

          {/* Brand Name */}
          <h1 className="text-4xl font-bold mb-4 text-center">
            {panelName || 'NexPanel'}
          </h1>
          <p className="text-lg text-orange-100 dark:text-gray-300 text-center mb-12 max-w-md">
            Recover your account securely with our password reset process.
          </p>

          {/* Steps */}
          <div className="space-y-6 w-full max-w-sm">
            <div className={`flex items-center space-x-4 rounded-xl p-4 border transition-all ${step === 'input'
              ? 'bg-white/20 border-white/30'
              : 'bg-white/10 border-white/10'
              }`}>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step === 'input' ? 'bg-white/30' : 'bg-white/20'
                }`}>
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Step 1: Enter Email</h3>
                <p className="text-sm text-orange-100 dark:text-gray-400">Provide your username or email</p>
              </div>
            </div>

            <div className={`flex items-center space-x-4 rounded-xl p-4 border transition-all ${step === 'otp'
              ? 'bg-white/20 border-white/30'
              : 'bg-white/10 border-white/10'
              }`}>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step === 'otp' ? 'bg-white/30' : 'bg-white/20'
                }`}>
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Step 2: Verify OTP</h3>
                <p className="text-sm text-orange-100 dark:text-gray-400">Enter the code sent to your email</p>
              </div>
            </div>

            <div className={`flex items-center space-x-4 rounded-xl p-4 border transition-all ${step === 'password'
              ? 'bg-white/20 border-white/30'
              : 'bg-white/10 border-white/10'
              }`}>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${step === 'password' ? 'bg-white/30' : 'bg-white/20'
                }`}>
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Step 3: New Password</h3>
                <p className="text-sm text-orange-100 dark:text-gray-400">Create your new password</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 lg:w-1/2 min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
        {/* Mobile Background Decoration */}
        <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-400/20 rounded-full blur-3xl" />
        </div>

        {/* Mobile Header with Logo */}
        <div className="lg:hidden relative z-10 pt-6 pb-2 px-6">
          <div className="flex items-center justify-center space-x-3">
            {/* Logo Container - Round */}
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg shadow-orange-500/25 overflow-hidden">
              {logoUrl && logoUrl !== '/images/logo.svg' ? (
                <Image
                  src={logoUrl}
                  alt={`${panelName || 'NexPanel'} Logo`}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <Lock className="h-5 w-5 text-white" />
              )}
            </div>
            {/* Brand Name - Poppins Font */}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white font-[var(--font-poppins)]">
              {panelName || 'NexPanel'}
            </h1>
          </div>
        </div>

        {/* Form Container - Centered, slightly higher on mobile */}
        <div className="flex-1 flex items-center justify-center px-6 pt-2 pb-6 lg:py-8 relative z-10">
          <div className="w-full max-w-md">
            {/* Form Card */}
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-100 dark:border-gray-800">
              {/* Form Header */}
              <div className="text-center lg:text-left mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Forgot Password
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {step === 'input' && 'Enter your username or email to receive OTP'}
                  {step === 'otp' && 'Enter the OTP sent to your email'}
                  {step === 'password' && 'Enter your new password'}
                </p>
              </div>

              {/* Mobile Step Indicator */}
              <div className="lg:hidden flex justify-center mb-6">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step === 'input'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                    1
                  </div>
                  <div className={`w-8 h-1 rounded ${step !== 'input' ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step === 'otp'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                    : step === 'password'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                    2
                  </div>
                  <div className={`w-8 h-1 rounded ${step === 'password' ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step === 'password'
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                    3
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 dark:text-red-300 text-sm font-medium">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                    {success}
                  </p>
                </div>
              )}

              {/* Step 1: Input Username/Email */}
              {step === 'input' && (
                <form className="space-y-5" onSubmit={handleSendOTP}>
                  <div className="space-y-2">
                    <label
                      htmlFor="usernameOrEmail"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Username or Email
                    </label>
                    <input
                      id="usernameOrEmail"
                      name="usernameOrEmail"
                      type="text"
                      required
                      value={usernameOrEmail}
                      onChange={(e) => setUsernameOrEmail(e.target.value)}
                      className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                      placeholder="Enter username or email"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full flex justify-center py-3.5 px-4 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:from-orange-500 hover:to-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      <>
                        <Mail className="h-5 w-5 mr-2" />
                        Send OTP
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Step 2: Verify OTP */}
              {step === 'otp' && (
                <form className="space-y-5" onSubmit={handleVerifyOTP}>
                  <div className="space-y-2">
                    <label
                      htmlFor="otp"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Enter OTP
                    </label>
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-center text-2xl tracking-[0.5em] font-mono"
                      placeholder="000000"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full flex justify-center py-3.5 px-4 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:from-orange-500 hover:to-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify OTP'
                    )}
                  </button>
                </form>
              )}

              {/* Step 3: Reset Password */}
              {step === 'password' && (
                <form className="space-y-5" onSubmit={handleResetPassword}>
                  <div className="space-y-2">
                    <label
                      htmlFor="newPassword"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                      placeholder="Enter new password"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                      placeholder="Confirm new password"
                      disabled={isLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group w-full flex justify-center py-3.5 px-4 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:from-orange-500 hover:to-red-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Resetting Password...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </button>
                </form>
              )}

              {/* Back to login */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 font-medium transition-colors"
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
