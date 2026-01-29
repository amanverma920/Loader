import { useState, useEffect } from 'react'
import { BarChart3, Users, Key, Zap, TrendingUp, TrendingDown, Clock, AlertCircle, UserCheck, UserCircle } from 'lucide-react'

interface DashboardStatsProps {
  data: {
    totalRequests?: number
    uniqueUsers?: number
    totalKeys?: number
    activeKeys?: number
    totalUsers?: number
  } | null
}

export default function DashboardStats({ data }: DashboardStatsProps) {
  const [accountExpiry, setAccountExpiry] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    // Load user account expiry date and role
    const loadUserData = async () => {
      try {
        const response = await fetch('/api/auth/status')
        const result = await response.json()
        if (result.authenticated) {
          if (result.accountExpiryDate) {
            setAccountExpiry(result.accountExpiryDate)
          }
          if (result.role) {
            setUserRole(result.role)
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }
    loadUserData()

    // Update current time every second for live countdown
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const getTimeUntilExpiry = () => {
    if (!accountExpiry) return null

    const expiry = new Date(accountExpiry)
    const now = currentTime
    const diffTime = expiry.getTime() - now.getTime()

    if (diffTime <= 0) {
      return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 }
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)

    return { expired: false, days, hours, minutes, seconds }
  }

  const formatExpiryDateTime = (expiryDate: string) => {
    const date = new Date(expiryDate)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    })
  }

  const timeUntilExpiry = accountExpiry ? getTimeUntilExpiry() : null

  type StatItem = {
    name: string
    value: number | string
    icon: typeof Clock | typeof UserCheck
    color: string
    trend: 'up' | 'down' | 'neutral'
    trendValue: string
    description: string
    expiryDate?: string | null
    timeUntilExpiry?: { expired: boolean; days: number; hours: number; minutes: number; seconds: number } | null
    userRole?: string | null
  }

  const stats: StatItem[] = [
    {
      name: 'Account Expiry',
      value: accountExpiry ? (timeUntilExpiry?.expired ? 'Expired' : 'Active') : 'N/A',
      icon: Clock,
      color: 'indigo',
      trend: 'neutral',
      trendValue: '',
      description: accountExpiry
        ? (timeUntilExpiry?.expired
          ? 'Account has expired'
          : timeUntilExpiry
            ? `${timeUntilExpiry.days}d ${timeUntilExpiry.hours}h ${timeUntilExpiry.minutes}m ${timeUntilExpiry.seconds}s left`
            : 'Loading...')
        : 'No expiry date set',
      expiryDate: accountExpiry,
      timeUntilExpiry: timeUntilExpiry
    },
    {
      name: 'User Role',
      value: userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Loading...',
      icon: UserCheck,
      color: 'purple',
      trend: 'neutral',
      trendValue: '',
      description: userRole
        ? `Current user role: ${userRole.charAt(0).toUpperCase() + userRole.slice(1)}`
        : 'Loading role...',
      userRole: userRole
    },
    {
      name: 'Total Requests',
      value: data?.totalRequests || 0,
      icon: BarChart3,
      color: 'blue',
      trend: 'up',
      trendValue: '+12.5%',
      description: 'Total API requests processed'
    },
    {
      name: 'Unique Users',
      value: data?.uniqueUsers || 0,
      icon: Users,
      color: 'green',
      trend: 'up',
      trendValue: '+8.3%',
      description: 'Active unique users'
    },
    {
      name: 'Total Keys',
      value: data?.totalKeys || 0,
      icon: Key,
      color: 'teal',
      trend: 'up',
      trendValue: '+5.2%',
      description: 'Generated API keys'
    },
    {
      name: 'Active Keys',
      value: data?.activeKeys || 0,
      icon: Zap,
      color: 'orange',
      trend: 'up',
      trendValue: '+15.7%',
      description: 'Currently active keys'
    },
    {
      name: 'Total Users',
      value: data?.totalUsers || 0,
      icon: UserCircle,
      color: 'pink',
      trend: 'up',
      trendValue: '+10.2%',
      description: 'Total registered users'
    },
  ]

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-500',
          bgLight: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-600 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800'
        }
      case 'green':
        return {
          bg: 'bg-green-500',
          bgLight: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-600 dark:text-green-400',
          border: 'border-green-200 dark:border-green-800'
        }
      case 'purple':
        return {
          bg: 'bg-purple-500',
          bgLight: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-600 dark:text-purple-400',
          border: 'border-purple-200 dark:border-purple-800'
        }
      case 'orange':
        return {
          bg: 'bg-orange-500',
          bgLight: 'bg-orange-100 dark:bg-orange-900/30',
          text: 'text-orange-600 dark:text-orange-400',
          border: 'border-orange-200 dark:border-orange-800'
        }
      case 'indigo':
        return {
          bg: 'bg-indigo-500',
          bgLight: 'bg-indigo-100 dark:bg-indigo-900/30',
          text: 'text-indigo-600 dark:text-indigo-400',
          border: 'border-indigo-200 dark:border-indigo-800'
        }
      case 'purple':
        return {
          bg: 'bg-purple-500',
          bgLight: 'bg-purple-100 dark:bg-purple-900/30',
          text: 'text-purple-600 dark:text-purple-400',
          border: 'border-purple-200 dark:border-purple-800'
        }
      case 'teal':
        return {
          bg: 'bg-teal-500',
          bgLight: 'bg-teal-100 dark:bg-teal-900/30',
          text: 'text-teal-600 dark:text-teal-400',
          border: 'border-teal-200 dark:border-teal-800'
        }
      case 'pink':
        return {
          bg: 'bg-pink-500',
          bgLight: 'bg-pink-100 dark:bg-pink-900/30',
          text: 'text-pink-600 dark:text-pink-400',
          border: 'border-pink-200 dark:border-pink-800'
        }
      default:
        return {
          bg: 'bg-gray-500',
          bgLight: 'bg-gray-100 dark:bg-gray-900/30',
          text: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-200 dark:border-gray-800'
        }
    }
  }

  return (
    <div className="relative">
      {/* Mobile: Horizontal scroll, Desktop: Grid */}
      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 sm:overflow-visible">
        {stats.map((stat) => {
          const Icon = stat.icon
          const colors = getColorClasses(stat.color)

          return (
            <div
              key={stat.name}
              className="group relative flex-shrink-0 w-[160px] sm:w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 overflow-hidden hover:-translate-y-1"
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-${stat.color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              <div className="relative p-6">
                <div className="flex items-center justify-between">
                  {/* Icon */}
                  <div className={`p-3 rounded-xl ${colors.bgLight} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className={`h-6 w-6 ${colors.text}`} />
                  </div>

                  {/* Trend indicator - Hide for Account Expiry */}
                  {stat.trend !== 'neutral' && (
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${stat.trend === 'up'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      }`}>
                      {stat.trend === 'up' ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{stat.trendValue}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {stat.name}
                  </p>
                  {stat.name === 'Account Expiry' ? (
                    <div className="mt-2">
                      {!stat.expiryDate ? (
                        <div>
                          <p className="text-lg font-bold text-gray-500 dark:text-gray-400">
                            N/A
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            No expiry date set
                          </p>
                        </div>
                      ) : stat.timeUntilExpiry?.expired ? (
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">
                            Expired
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className={`text-lg font-bold ${stat.timeUntilExpiry && stat.timeUntilExpiry.days < 7
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-gray-900 dark:text-white'
                            }`}>
                            {stat.timeUntilExpiry
                              ? `${stat.timeUntilExpiry.days}d ${stat.timeUntilExpiry.hours}h ${stat.timeUntilExpiry.minutes}m ${stat.timeUntilExpiry.seconds}s`
                              : 'Loading...'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatExpiryDateTime(stat.expiryDate)} IST
                          </p>
                        </div>
                      )}
                    </div>
                  ) : stat.name === 'User Role' ? (
                    <div className="mt-2">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {stat.userRole ? stat.userRole.charAt(0).toUpperCase() + stat.userRole.slice(1) : 'Loading...'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stat.description}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {stat.description}
                      </p>
                    </>
                  )}
                </div>

                {/* Bottom border accent */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
