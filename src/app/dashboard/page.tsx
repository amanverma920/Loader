'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'
import DashboardStats from '@/components/DashboardStats'
import HourlyTrafficChart from '@/components/HourlyTrafficChart'
import RecentActivity from '@/components/RecentActivity'
import SystemStatus from '@/components/SystemStatus'
import GlobalSettingsModal from '@/components/GlobalSettingsModal'
import BlockedIPsTab from '@/components/BlockedIPsTab'
import { Settings, BarChart3, Activity, Server, Loader2, Shield } from 'lucide-react'

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
}

export default function Dashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })

  useEffect(() => {
    loadAuth()
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 30000) // Refresh every 30 seconds
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

  const tabs = [
    {
      id: 'overview' as TabType,
      name: 'Overview',
      icon: BarChart3,
      description: 'System overview and analytics',
      show: true // All users can see Overview
    },
    {
      id: 'blocked-ips' as TabType,
      name: 'Blocked IPs',
      icon: Shield,
      description: 'Security management',
      show: auth.role === 'owner' || auth.role === 'super owner' // Owner and Super Owner
    }
  ].filter(tab => tab.show)

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen transition-colors duration-300">
        <Navigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header skeleton */}
            <div className="animate-pulse mb-8">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
            
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm overflow-hidden shadow-lg rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="h-12 w-12 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
                      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                      <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Content skeleton */}
            <div className="space-y-6">
              <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
                <div className="h-64 bg-gray-200 dark:bg-gray-600 rounded-xl"></div>
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
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="px-4 py-6 sm:px-0 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Monitor your system performance and manage security settings
            </p>
          </div>
          
          {/* Global Settings - Only for Owner and Super Owner */}
          {(auth.role === 'owner' || auth.role === 'super owner') && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="group relative flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <Settings className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" />
              <span>Global Settings</span>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-[9999] shadow-lg backdrop-blur-sm min-w-max">
                Configure system-wide settings
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-0 mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group relative min-w-0 flex-1 overflow-hidden py-4 px-6 text-center text-sm font-medium hover:no-underline focus:outline-none transition-colors duration-300 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Icon className={`h-4 w-4 ${
                        isActive 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                      }`} />
                      <span>{tab.name}</span>
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 sm:px-0">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="mb-8">
                <DashboardStats data={analyticsData} />
              </div>

              {/* Charts and Activity Section */}
              <div className="space-y-8 mb-8">
                {/* Hourly Traffic Chart */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                          <BarChart3 className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Hourly Traffic & CPU Usage
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Real-time traffic monitoring and system performance
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <HourlyTrafficChart 
                      data={analyticsData?.hourlyTraffic || []} 
                      cpuData={analyticsData?.hourlyCpuUsage || []} 
                    />
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl shadow-xl rounded-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-xl">
                          <Activity className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Recent Activity
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Latest system events and user activities
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
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
            // Refresh dashboard data when settings are updated
            loadDashboardData()
          }}
        />
      )}
    </div>
  )
}
