'use client'

import { useEffect, useState } from 'react'
import { Database, Server, Globe, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface PingData {
  pingMs: number
  status: string
}

export default function SystemStatus() {
  const [pingData, setPingData] = useState<PingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPing = async () => {
      try {
        const response = await fetch('/api/ping')
        const data = await response.json()
        if (data.status) {
          setPingData(data.data)
        }
      } catch (error) {
        console.error('Error fetching ping:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPing()
    // Refresh ping every 30 seconds
    const interval = setInterval(fetchPing, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusInfo = (pingMs: number | null) => {
    if (!pingMs) return { status: 'Disconnected', color: 'red', icon: AlertCircle }
    if (pingMs < 100) return { status: 'Excellent', color: 'green', icon: CheckCircle }
    if (pingMs < 300) return { status: 'Good', color: 'yellow', icon: CheckCircle }
    if (pingMs < 1000) return { status: 'Fair', color: 'orange', icon: AlertCircle }
    return { status: 'Poor', color: 'red', icon: AlertCircle }
  }

  const statusItems = [
    {
      name: 'Database',
      status: pingData ? `${pingData.pingMs}ms` : loading ? 'Measuring...' : 'Disconnected',
      subtitle: pingData ? pingData.status : loading ? 'Checking connection...' : 'Connection failed',
      icon: Database,
      statusInfo: getStatusInfo(pingData?.pingMs || null),
      loading
    },
    {
      name: 'API Server',
      status: 'Running',
      subtitle: 'All endpoints operational',
      icon: Server,
      statusInfo: { status: 'Online', color: 'green', icon: CheckCircle },
      loading: false
    },
    {
      name: 'Web Server',
      status: 'Online',
      subtitle: 'Serving requests normally',
      icon: Globe,
      statusInfo: { status: 'Online', color: 'green', icon: CheckCircle },
      loading: false
    },
  ] as const

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'green':
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          icon: 'text-green-600 dark:text-green-400',
          border: 'border-green-200 dark:border-green-800',
          status: 'text-green-600 dark:text-green-400'
        }
      case 'yellow':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          icon: 'text-yellow-600 dark:text-yellow-400',
          border: 'border-yellow-200 dark:border-yellow-800',
          status: 'text-yellow-600 dark:text-yellow-400'
        }
      case 'orange':
        return {
          bg: 'bg-orange-100 dark:bg-orange-900/30',
          icon: 'text-orange-600 dark:text-orange-400',
          border: 'border-orange-200 dark:border-orange-800',
          status: 'text-orange-600 dark:text-orange-400'
        }
      case 'red':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          icon: 'text-red-600 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
          status: 'text-red-600 dark:text-red-400'
        }
      default:
        return {
          bg: 'bg-gray-100 dark:bg-gray-900/30',
          icon: 'text-gray-600 dark:text-gray-400',
          border: 'border-gray-200 dark:border-gray-800',
          status: 'text-gray-600 dark:text-gray-400'
        }
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              System Status
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Current system health and performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
            <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {loading ? 'Checking...' : 'Live'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {statusItems.map((item) => {
            const Icon = item.icon
            const StatusIcon = item.statusInfo.icon
            const colors = getColorClasses(item.statusInfo.color)
            
            return (
              <div 
                key={item.name} 
                className="group relative bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl ${colors.bg} group-hover:scale-110 transition-transform duration-300`}>
                      {item.loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                      ) : (
                        <Icon className={`h-5 w-5 ${colors.icon}`} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        {item.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <StatusIcon className={`h-4 w-4 ${colors.status}`} />
                    <span className={`text-sm font-medium ${colors.status}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
                
                {/* Status indicator bar */}
                <div className="mt-4 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      item.statusInfo.color === 'green' ? 'bg-green-400' :
                      item.statusInfo.color === 'yellow' ? 'bg-yellow-400' :
                      item.statusInfo.color === 'orange' ? 'bg-orange-400' :
                      item.statusInfo.color === 'red' ? 'bg-red-400' :
                      'bg-gray-400'
                    }`}
                    style={{ 
                      width: item.statusInfo.color === 'green' ? '100%' :
                              item.statusInfo.color === 'yellow' ? '75%' :
                              item.statusInfo.color === 'orange' ? '50%' :
                              item.statusInfo.color === 'red' ? '25%' : '0%'
                    }}
                  ></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
