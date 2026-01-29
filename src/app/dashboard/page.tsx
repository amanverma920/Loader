'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import DashboardStats from '@/components/DashboardStats'
import HourlyTrafficChart from '@/components/HourlyTrafficChart'
import RecentActivity from '@/components/RecentActivity'
import GlobalSettingsModal from '@/components/GlobalSettingsModal'
import BlockedIPsTab from '@/components/BlockedIPsTab'
import { usePanelName } from '@/contexts/PanelNameContext'
import { useLogo } from '@/contexts/LogoContext'
import {
  Settings, BarChart3, Activity, Loader2, Shield,
  Key, Users, Wallet, Plus, ArrowRight, Sparkles,
  TrendingUp, Clock, Zap
} from 'lucide-react'

interface AnalyticsData {
  totalRequests: number
  uniqueUsers: number
  totalKeys: number
  activeKeys: number
  hourlyTraffic: number[]
  hourlyCpuUsage: number[]
  recentActivity: any[]
}

type TabType = 'overview' | 'blocked-ips'

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: string
  accountExpiryDate?: string
}

export default function Dashboard() {
  const { panelName } = usePanelName()
  const { logoUrl } = useLogo()
  const router = useRouter()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    // Set greeting based on time
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 17) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')

    loadAuth()
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
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

  const loadDashboardData = async () => {
    try {
      const [analyticsResponse, activitiesResponse] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/activities')
      ])

      const analyticsData = await analyticsResponse.json()
      const activitiesData = await activitiesResponse.json()

      if (analyticsData.status) {
        setAnalyticsData({
          ...analyticsData.data,
          recentActivity: activitiesData.status ? activitiesData.data : []
        })
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const quickActions = [
    {
      name: 'Generate Key',
      description: 'Create new API key',
      icon: Key,
      href: '/generate-key',
      gradient: 'from-blue-500 to-indigo-600',
      hoverGradient: 'group-hover:from-blue-600 group-hover:to-indigo-700'
    },
    {
      name: 'View Keys',
      description: 'Manage your keys',
      icon: Zap,
      href: '/keys',
      gradient: 'from-emerald-500 to-teal-600',
      hoverGradient: 'group-hover:from-emerald-600 group-hover:to-teal-700'
    },
    {
      name: 'Add Balance',
      description: 'Top up wallet',
      icon: Wallet,
      href: '/balance',
      gradient: 'from-purple-500 to-pink-600',
      hoverGradient: 'group-hover:from-purple-600 group-hover:to-pink-700'
    },
    {
      name: 'View Users',
      description: 'User management',
      icon: Users,
      href: '/users',
      gradient: 'from-orange-500 to-red-600',
      hoverGradient: 'group-hover:from-orange-600 group-hover:to-red-700'
    }
  ]

  const tabs = [
    {
      id: 'overview' as TabType,
      name: 'Overview',
      icon: BarChart3,
      description: 'System overview and analytics',
      show: true
    },
    {
      id: 'blocked-ips' as TabType,
      name: 'Blocked IPs',
      icon: Shield,
      description: 'Security management',
      show: auth.role === 'owner' || auth.role === 'super owner'
    }
  ].filter(tab => tab.show)

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
        <Navigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 min-h-screen transition-colors duration-300">
      <Navigation />

      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">

        {/* Hero Welcome Section */}
        <div className="relative mb-8 overflow-hidden">
          <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
            </div>

            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                {/* Logo */}
                <div className="hidden sm:flex h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-xl items-center justify-center shadow-xl overflow-hidden">
                  {logoUrl && logoUrl !== '/images/logo.svg' ? (
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <Sparkles className="h-8 w-8 text-white" />
                  )}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white font-[var(--font-poppins)]">
                      {greeting}, {auth.username || 'User'}!
                    </h1>
                    <span className="text-2xl">👋</span>
                  </div>
                  <p className="text-blue-100 dark:text-blue-200 text-sm sm:text-base mt-1">
                    Welcome to {panelName || 'NexPanel'} Dashboard
                  </p>
                </div>
              </div>

              {/* Settings button */}
              {(auth.role === 'owner' || auth.role === 'super owner') && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border border-white/20"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </button>
              )}
            </div>

            {/* User role badge */}
            <div className="relative mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                <Clock className="h-3 w-3 mr-1" />
                Role: {auth.role ? auth.role.charAt(0).toUpperCase() + auth.role.slice(1) : 'User'}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/30 text-green-100 backdrop-blur-sm">
                <TrendingUp className="h-3 w-3 mr-1" />
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions - Horizontal Scroll on Mobile */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 px-1">
            Quick Actions
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.name}
                  onClick={() => router.push(action.href)}
                  className="group flex-shrink-0 w-[140px] sm:w-full relative bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden hover:-translate-y-1"
                >
                  {/* Gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  <div className="relative flex flex-col items-center text-center">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient} mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <Icon className="h-6 w-6 text-white" strokeWidth={2.5} />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-white text-sm transition-colors duration-300">
                      {action.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-white/80 mt-1 transition-colors duration-300">
                      {action.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-1.5 shadow-lg border border-gray-100 dark:border-gray-700 inline-flex">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${isActive
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <DashboardStats data={analyticsData} />

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Traffic Chart */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                        <BarChart3 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Traffic & CPU
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Real-time monitoring
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <HourlyTrafficChart
                      data={analyticsData?.hourlyTraffic || []}
                      cpuData={analyticsData?.hourlyCpuUsage || []}
                    />
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          Recent Activity
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Latest events
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 max-h-[400px] overflow-y-auto">
                    <RecentActivity activities={analyticsData?.recentActivity || []} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'blocked-ips' && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
              <div className="p-6">
                <BlockedIPsTab />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showSettingsModal && (
        <GlobalSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onUpdate={() => {
            loadDashboardData()
          }}
        />
      )}

      {/* Custom scrollbar hide style */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
