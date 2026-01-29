import { Key, Edit, Trash2, Ban, CheckCircle, Settings, User, Clock, Activity } from 'lucide-react'

interface Activity {
  _id?: string
  action: string
  details?: string
  userId: string
  ipAddress?: string
  timestamp: string
  metadata?: any
  type?: string
}

interface RecentActivityProps {
  activities: Activity[]
}

const getActivityIcon = (action: string) => {
  switch (action) {
    case 'key_created':
      return Key
    case 'key_edited':
      return Edit
    case 'key_deleted':
      return Trash2
    case 'key_disabled':
      return Ban
    case 'key_enabled':
      return CheckCircle
    case 'global_settings_updated':
      return Settings
    case 'user_login':
      return User
    default:
      return Activity
  }
}

const getActivityColor = (action: string) => {
  switch (action) {
    case 'key_created':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' }
    case 'key_edited':
      return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' }
    case 'key_deleted':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' }
    case 'key_disabled':
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800' }
    case 'key_enabled':
      return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-200 dark:border-green-800' }
    case 'global_settings_updated':
      return { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800' }
    case 'user_login':
      return { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-800' }
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-800' }
  }
}

const getActivityMessage = (activity: Activity) => {
  switch (activity.action) {
    case 'key_created':
      return `New API key created`
    case 'key_edited':
      return `API key updated`
    case 'key_deleted':
      return `API key deleted`
    case 'key_disabled':
      return `API key disabled`
    case 'key_enabled':
      return `API key enabled`
    case 'global_settings_updated':
      return `Global settings updated`
    case 'user_login':
      return `User logged in`
    default:
      return activity.details || 'Activity recorded'
  }
}

const getTimeAgo = (timestamp: string) => {
  const now = new Date()
  const activityTime = new Date(timestamp)
  const diffInSeconds = Math.floor((now.getTime() - activityTime.getTime()) / 1000)

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No recent activity</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Activity will appear here as it happens.
        </p>
      </div>
    )
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, activityIdx) => {
          const Icon = getActivityIcon(activity.action)
          const colors = getActivityColor(activity.action)
          const isLast = activityIdx === activities.length - 1
          
          return (
            <li key={activity._id || activityIdx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800 ${colors.bg}`}>
                      <Icon className={`h-4 w-4 ${colors.text}`} />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {getActivityMessage(activity)}
                      </p>
                      {activity.details && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {activity.details}
                        </p>
                      )}
                      {activity.ipAddress && (
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                            {activity.ipAddress}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      <span>{getTimeAgo(activity.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
