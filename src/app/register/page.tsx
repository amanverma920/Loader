'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, AlertCircle, CheckCircle, Loader2, Shield, Key, Gift, Zap } from 'lucide-react'
import { usePanelName } from '@/contexts/PanelNameContext'
import { useLogo } from '@/contexts/LogoContext'

export default function RegisterPage() {
  const { panelName } = usePanelName()
  const { logoUrl } = useLogo()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, referralCode }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message || 'Registration failed.')
      } else {
        setSuccess(data.message || 'Account created successfully.')
        setTimeout(() => {
          router.push('/login')
        }, 1000)
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong, please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Branding Panel (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 bg-blue-300 rounded-full blur-3xl" />
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
                <UserPlus className="h-12 w-12 text-white" />
              )}
            </div>
          </div>

          {/* Brand Name */}
          <h1 className="text-4xl font-bold mb-4 text-center">
            Join {panelName || 'NexPanel'}
          </h1>
          <p className="text-lg text-purple-100 dark:text-gray-300 text-center mb-12 max-w-md">
            Create your account and start managing your keys and users today.
          </p>

          {/* Features */}
          <div className="space-y-6 w-full max-w-sm">
            <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Referral System</h3>
                <p className="text-sm text-purple-100 dark:text-gray-400">Get bonus with referral codes</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Key className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Instant Access</h3>
                <p className="text-sm text-purple-100 dark:text-gray-400">Start generating keys right away</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Fast & Secure</h3>
                <p className="text-sm text-purple-100 dark:text-gray-400">Enterprise-grade security</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 lg:w-1/2 min-h-screen flex flex-col bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden">
        {/* Mobile Background Decoration */}
        <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-400/20 to-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-gradient-to-tr from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />
        </div>

        {/* Mobile Header with Logo */}
        <div className="lg:hidden relative z-10 pt-6 pb-2 px-6">
          <div className="flex items-center justify-center space-x-3">
            {/* Logo Container - Smaller */}
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/25 overflow-hidden">
              {logoUrl && logoUrl !== '/images/logo.svg' ? (
                <Image
                  src={logoUrl}
                  alt={`${panelName || 'NexPanel'} Logo`}
                  width={32}
                  height={32}
                  className="w-full h-full object-contain p-1"
                  unoptimized
                />
              ) : (
                <UserPlus className="h-5 w-5 text-white" />
              )}
            </div>
            {/* Brand Name - Poppins Font */}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white font-[var(--font-poppins)]">
              {panelName || 'NexPanel'}
            </h1>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 relative z-10">
          <div className="w-full max-w-md">
            {/* Form Card */}
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-100 dark:border-gray-800">
              {/* Form Header */}
              <div className="text-center lg:text-left mb-6">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Create account
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Sign up using a valid referral code
                </p>
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

              {/* Register Form */}
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                    placeholder="Choose a username"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      placeholder="Password"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Confirm
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      placeholder="Confirm"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Referral Code
                  </label>
                  <input
                    type="text"
                    required
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 tracking-widest uppercase transition-all"
                    placeholder="ENTER CODE"
                    disabled={isLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="group w-full flex justify-center py-3.5 px-4 text-sm font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:from-purple-500 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Register'
                  )}
                </button>

                {/* Back to Login */}
                <div className="flex items-center justify-center text-sm pt-2">
                  <span className="text-gray-500 dark:text-gray-400 mr-2">Already have an account?</span>
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                  >
                    Sign in
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
