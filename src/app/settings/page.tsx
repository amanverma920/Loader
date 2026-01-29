'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SidebarLayout, { GlassCard, GlassCardContent } from '@/components/SidebarLayout'
import { Settings, Loader2, AlertCircle, CheckCircle, Tag, Bot, MessageSquare, ExternalLink, Radio, Wrench } from 'lucide-react'
import { usePanelName } from '@/contexts/PanelNameContext'

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { panelName, setPanelName } = usePanelName()
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPanelName, setSavingPanelName] = useState(false)
  const [savingBotToken, setSavingBotToken] = useState(false)
  const [savingChatId, setSavingChatId] = useState(false)

  const [panelNameInput, setPanelNameInput] = useState('')
  const [currentUsername, setCurrentUsername] = useState('')
  const [newUsername, setNewUsername] = useState('')

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [panelNameError, setPanelNameError] = useState<string | null>(null)
  const [panelNameMessage, setPanelNameMessage] = useState<string | null>(null)
  const [botToken, setBotToken] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const [chatId, setChatId] = useState('')
  const [botTokenError, setBotTokenError] = useState<string | null>(null)
  const [botTokenMessage, setBotTokenMessage] = useState<string | null>(null)
  const [chatIdError, setChatIdError] = useState<string | null>(null)
  const [chatIdMessage, setChatIdMessage] = useState<string | null>(null)
  const [canManageBotToken, setCanManageBotToken] = useState(false)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null)
  const [webhookError, setWebhookError] = useState<string | null>(null)
  const [hasBotPermission, setHasBotPermission] = useState(true)
  const [botPermissions, setBotPermissions] = useState({
    reseller: true,
    admin: true,
    owner: true
  })
  const [ownerPermissions, setOwnerPermissions] = useState({
    reseller: true,
    admin: true
  })
  const [canManageOwnerPermissions, setCanManageOwnerPermissions] = useState(false)
  const [savingPermissions, setSavingPermissions] = useState(false)
  const [permissionsMessage, setPermissionsMessage] = useState<string | null>(null)
  const [permissionsError, setPermissionsError] = useState<string | null>(null)
  const [botUsernameInput, setBotUsernameInput] = useState('')
  const [savingBotUsername, setSavingBotUsername] = useState(false)
  const [botUsernameMessage, setBotUsernameMessage] = useState<string | null>(null)
  const [botUsernameError, setBotUsernameError] = useState<string | null>(null)
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastTargetRoles, setBroadcastTargetRoles] = useState<string[]>(['reseller', 'admin', 'owner'])
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('⚠️ Bot is currently under maintenance. Please try again later.')
  const [savingMaintenance, setSavingMaintenance] = useState(false)
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null)
  const [maintenanceSuccess, setMaintenanceSuccess] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' })
        const data = await res.json()

        if (!data.authenticated) {
          router.push('/login')
          return
        }

        setAuth(data)
        setCurrentUsername(data.username || '')
        setNewUsername(data.username || '')
        setPanelNameInput(panelName)

        // Load bot settings
        loadBotSettings()
      } catch (err) {
        console.error(err)
        setError('Failed to load account info.')
      } finally {
        setLoading(false)
      }
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, panelName])

  const loadBotSettings = async () => {
    try {
      const res = await fetch('/api/telegram-bot', { cache: 'no-store' })
      const data = await res.json()

      if (data.status) {
        setBotToken(data.data.botToken || '')
        const username = data.data.botUsername || ''
        setBotUsername(username)
        setBotUsernameInput(username)
        setChatId(data.data.chatId || '')
        setCanManageBotToken(data.data.canManageBotToken || false)
        // Ensure hasPermission is properly set
        // If hasPermission is explicitly false, set it to false, otherwise check if permissions allow
        const hasPermission = data.data.hasPermission !== false
        setHasBotPermission(hasPermission)
        if (data.data.permissions) {
          setBotPermissions(data.data.permissions)
        }
        if (data.data.ownerPermissions) {
          setOwnerPermissions(data.data.ownerPermissions)
        }
        setCanManageOwnerPermissions(data.data.canManageOwnerPermissions || false)
        loadWebhookInfo()
      }

      // Load maintenance mode if super owner
      if (auth.role === 'super owner') {
        await loadMaintenanceMode()
      }
    } catch (err) {
      console.error('Error loading bot settings:', err)
    }
  }

  const loadMaintenanceMode = async () => {
    try {
      const res = await fetch('/api/bot-maintenance', { cache: 'no-store' })
      const data = await res.json()

      if (data.status && data.data) {
        setMaintenanceMode(data.data.maintenanceMode || false)
        setMaintenanceMessage(data.data.maintenanceMessage || '⚠️ Bot is currently under maintenance. Please try again later.')
      }
    } catch (err) {
      console.error('Error loading maintenance mode:', err)
    }
  }

  const handleSaveMaintenance = async () => {
    setMaintenanceError(null)
    setMaintenanceSuccess(null)

    setSavingMaintenance(true)
    try {
      const res = await fetch('/api/bot-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceMode,
          maintenanceMessage: maintenanceMessage.trim() || '⚠️ Bot is currently under maintenance. Please try again later.'
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setMaintenanceError(data.reason || 'Failed to update maintenance mode')
      } else {
        setMaintenanceSuccess(data.message || `Maintenance mode ${maintenanceMode ? 'enabled' : 'disabled'} successfully!`)
        await loadMaintenanceMode()
        setTimeout(() => {
          setMaintenanceSuccess(null)
        }, 5000)
      }
    } catch (err) {
      console.error(err)
      setMaintenanceError('Something went wrong.')
    } finally {
      setSavingMaintenance(false)
    }
  }

  const handleSaveBotToken = async () => {
    setBotTokenError(null)
    setBotTokenMessage(null)

    if (!botToken.trim()) {
      setBotTokenError('Bot token cannot be empty')
      return
    }

    setSavingBotToken(true)
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken.trim() }),
      })

      const data = await res.json()

      if (!data.status) {
        setBotTokenError(data.reason || 'Failed to update bot token')
      } else {
        setBotTokenMessage('Bot token updated successfully!')
        await loadBotSettings()

        // Automatically setup webhook after saving token (for Vercel)
        setTimeout(async () => {
          await handleSetupWebhook()
        }, 500)

        setTimeout(() => {
          setBotTokenMessage(null)
        }, 3000)
      }
    } catch (err) {
      console.error(err)
      setBotTokenError('Something went wrong.')
    } finally {
      setSavingBotToken(false)
    }
  }

  const handleSaveChatId = async () => {
    setChatIdError(null)
    setChatIdMessage(null)

    if (!chatId.trim()) {
      setChatIdError('Chat ID cannot be empty')
      return
    }

    // Validate chat ID is a number
    if (isNaN(Number(chatId.trim())) || Number(chatId.trim()) <= 0) {
      setChatIdError('Chat ID must be a positive number')
      return
    }

    setSavingChatId(true)
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chatId.trim() }),
      })

      const data = await res.json()

      if (!data.status) {
        setChatIdError(data.reason || 'Failed to update chat ID')
      } else {
        setChatIdMessage('Chat ID updated successfully! You can now use the bot.')
        // Reload bot settings to update permission status and show Open Bot button
        await loadBotSettings()
        // Force a small delay to ensure state updates
        setTimeout(async () => {
          await loadBotSettings()
        }, 500)
        setTimeout(() => {
          setChatIdMessage(null)
        }, 3000)
      }
    } catch (err) {
      console.error(err)
      setChatIdError('Something went wrong.')
    } finally {
      setSavingChatId(false)
    }
  }

  const handleOpenBot = () => {
    if (botUsername) {
      window.open(`https://t.me/${botUsername}`, '_blank')
    } else {
      alert('Bot username not set. Please set bot token first.')
    }
  }

  const handleSavePermissions = async () => {
    setPermissionsError(null)
    setPermissionsMessage(null)

    setSavingPermissions(true)
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: botPermissions }),
      })

      const data = await res.json()

      if (!data.status) {
        setPermissionsError(data.reason || 'Failed to update permissions')
      } else {
        setPermissionsMessage('Bot permissions updated successfully!')
        await loadBotSettings()
        setTimeout(() => {
          setPermissionsMessage(null)
        }, 3000)
      }
    } catch (err) {
      console.error(err)
      setPermissionsError('Something went wrong.')
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleSaveOwnerPermissions = async () => {
    setPermissionsError(null)
    setPermissionsMessage(null)

    setSavingPermissions(true)
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerPermissions: ownerPermissions }),
      })

      const data = await res.json()

      if (!data.status) {
        setPermissionsError(data.reason || 'Failed to update permissions')
      } else {
        setPermissionsMessage('Admin & Reseller bot permissions updated successfully!')
        await loadBotSettings()
        setTimeout(() => {
          setPermissionsMessage(null)
        }, 3000)
      }
    } catch (err) {
      console.error(err)
      setPermissionsError('Something went wrong.')
    } finally {
      setSavingPermissions(false)
    }
  }

  const handleSaveBotUsername = async () => {
    setBotUsernameError(null)
    setBotUsernameMessage(null)

    if (!botUsernameInput.trim()) {
      setBotUsernameError('Bot username cannot be empty')
      return
    }

    // Remove @ if user included it
    const cleanUsername = botUsernameInput.trim().replace(/^@/, '')

    // Validate username format (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setBotUsernameError('Invalid username format. Use only letters, numbers, and underscores.')
      return
    }

    setSavingBotUsername(true)
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botUsername: cleanUsername }),
      })

      const data = await res.json()

      if (!data.status) {
        setBotUsernameError(data.reason || 'Failed to update bot username')
      } else {
        setBotUsernameMessage('Bot username updated successfully!')
        setBotUsername(cleanUsername)
        await loadBotSettings()
        setTimeout(() => {
          setBotUsernameMessage(null)
        }, 3000)
      }
    } catch (err) {
      console.error(err)
      setBotUsernameError('Something went wrong.')
    } finally {
      setSavingBotUsername(false)
    }
  }

  const handleSendBroadcast = async () => {
    setBroadcastError(null)
    setBroadcastSuccess(null)

    if (!broadcastMessage.trim()) {
      setBroadcastError('Broadcast message cannot be empty')
      return
    }

    if (broadcastTargetRoles.length === 0) {
      setBroadcastError('Please select at least one target role')
      return
    }

    setSendingBroadcast(true)
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: broadcastMessage.trim(),
          targetRoles: broadcastTargetRoles
        }),
      })

      const data = await res.json()

      if (!data.status) {
        setBroadcastError(data.reason || 'Failed to send broadcast')
      } else {
        const { successCount, failCount, totalUsers } = data.data
        setBroadcastSuccess(
          `Broadcast sent successfully! Sent to ${successCount} out of ${totalUsers} user(s). ${failCount > 0 ? `${failCount} failed.` : ''}`
        )
        setBroadcastMessage('')
        setTimeout(() => {
          setBroadcastSuccess(null)
        }, 5000)
      }
    } catch (err) {
      console.error(err)
      setBroadcastError('Something went wrong while sending broadcast.')
    } finally {
      setSendingBroadcast(false)
    }
  }

  const loadWebhookInfo = async () => {
    if (auth.role === 'super owner' || auth.role === 'owner') {
      try {
        const res = await fetch('/api/telegram-webhook-setup', { cache: 'no-store' })
        const data = await res.json()
        if (data.status && data.data) {
          setWebhookUrl(data.data.webhookUrl || '')
        }
      } catch (err) {
        console.error('Error loading webhook info:', err)
      }
    }
  }

  const handleSetupWebhook = async () => {
    if (!botToken) {
      setWebhookError('Please set bot token first')
      return
    }

    setSettingWebhook(true)
    setWebhookError(null)
    setWebhookMessage(null)

    try {
      const res = await fetch('/api/telegram-webhook-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (!data.status) {
        const errorMsg = data.reason || 'Failed to setup webhook'
        const errorDetails = data.errorCode ? ` (Error Code: ${data.errorCode})` : ''
        const fullError = errorMsg + errorDetails

        setWebhookError(fullError)
        console.error('Webhook setup error:', data)
      } else {
        setWebhookMessage('Webhook setup successfully! Bot should work now.')
        await loadWebhookInfo()
        setTimeout(() => {
          setWebhookMessage(null)
        }, 5000)
      }
    } catch (err) {
      console.error(err)
      setWebhookError('Something went wrong while setting up webhook.')
    } finally {
      setSettingWebhook(false)
    }
  }


  const handleSavePanelName = async () => {
    setPanelNameError(null)
    setPanelNameMessage(null)

    if (!panelNameInput || panelNameInput.trim().length === 0) {
      setPanelNameError('Panel name cannot be empty')
      return
    }

    setSavingPanelName(true)
    try {
      const response = await fetch('/api/panel-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelName: panelNameInput.trim() }),
      })

      const data = await response.json()

      if (!data.status) {
        setPanelNameError(data.reason || 'Failed to update panel name')
      } else {
        await setPanelName(panelNameInput.trim())
        setPanelNameMessage('Panel name updated successfully! Page will refresh...')
        setTimeout(() => {
          setPanelNameMessage(null)
          // Force a page refresh to ensure all components update
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      console.error(err)
      setPanelNameError('Something went wrong.')
    } finally {
      setSavingPanelName(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setMessage(null)

    if (newPassword && newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.')
      return
    }

    if (!oldPassword) {
      setError('Please enter your old password.')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/account/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername,
          oldPassword,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        setError(data.message || 'Failed to update account.')
        setSaving(false)
        return
      }

      // 🔥 SUCCESS: ab logout karwana hai from /api/auth/logout
      setMessage('Update successful. Logging out...')

      setTimeout(async () => {
        await fetch('/api/auth/logout', {
          method: 'POST'
        })
        router.push('/login')
      }, 700)

    } catch (err) {
      console.error(err)
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <SidebarLayout title="Settings" description="Loading..." icon={Settings} iconGradient="from-blue-500 to-indigo-600">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout
      title="Account Settings"
      description="Update your username and password securely."
      icon={Settings}
      iconGradient="from-blue-500 to-indigo-600"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <GlassCard>
          <GlassCardContent>

            {/* Messages */}
            {error && (
              <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {message && (
              <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
              </div>
            )}

            {/* Panel Name Section - Only for Owner and Super Owner */}
            {(auth.role === 'owner' || auth.role === 'super owner') && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Tag className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Panel Name
                  </h2>
                </div>

                {panelNameError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{panelNameError}</p>
                  </div>
                )}

                {panelNameMessage && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{panelNameMessage}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Panel Name
                  </label>
                  <input
                    type="text"
                    value={panelNameInput}
                    onChange={(e) => setPanelNameInput(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                    placeholder="Enter panel name"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This name will appear throughout the UI (login page, dashboard, etc.)
                  </p>
                </div>

                <button
                  onClick={handleSavePanelName}
                  disabled={savingPanelName}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {savingPanelName ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Save Panel Name'
                  )}
                </button>
              </div>
            )}

            {/* Telegram Bot Token Section - Only for Super Owner */}
            {auth.role === 'super owner' && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Telegram Bot Token
                  </h2>
                </div>

                {botTokenError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{botTokenError}</p>
                  </div>
                )}

                {botTokenMessage && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{botTokenMessage}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Bot Token
                  </label>
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Get your bot token from @BotFather on Telegram
                  </p>
                </div>

                {botUsername && (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Bot Username
                    </label>
                    <div className="w-full p-2 rounded-lg border bg-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                      @{botUsername}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveBotToken}
                    disabled={savingBotToken}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {savingBotToken ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Save Bot Token'
                    )}
                  </button>

                  {botToken && (
                    <button
                      onClick={handleSetupWebhook}
                      disabled={settingWebhook || !botToken}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {settingWebhook ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        'Setup Webhook'
                      )}
                    </button>
                  )}
                </div>

                {webhookError && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{webhookError}</p>
                  </div>
                )}

                {webhookMessage && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{webhookMessage}</p>
                  </div>
                )}

                {webhookUrl && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL:</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 break-all">{webhookUrl}</p>
                  </div>
                )}
              </div>
            )}

            {/* Bot Maintenance Mode Section - Only for Super Owner */}
            {auth.role === 'super owner' && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Wrench className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Bot Maintenance Mode
                  </h2>
                </div>

                {maintenanceError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{maintenanceError}</p>
                  </div>
                )}

                {maintenanceSuccess && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{maintenanceSuccess}</p>
                  </div>
                )}

                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Enable maintenance mode to restrict bot access for all users (except super owner). When enabled, all users with bot access will receive the maintenance message automatically.
                </p>

                <div className="mb-4 flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Maintenance Mode
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Enable to restrict bot access (super owner will still have access)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={maintenanceMode}
                      onChange={(e) => setMaintenanceMode(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 dark:peer-focus:ring-yellow-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-600"></div>
                  </label>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Maintenance Message
                  </label>
                  <textarea
                    value={maintenanceMessage}
                    onChange={(e) => setMaintenanceMessage(e.target.value)}
                    rows={3}
                    className="w-full p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100 resize-none"
                    placeholder="Enter maintenance message..."
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Message to show to users when maintenance mode is enabled (supports HTML)
                  </p>
                </div>

                <button
                  onClick={handleSaveMaintenance}
                  disabled={savingMaintenance}
                  className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {savingMaintenance ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    maintenanceMode ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'
                  )}
                </button>
              </div>
            )}

            {/* Broadcasting Section - Only for Super Owner */}
            {auth.role === 'super owner' && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Radio className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Broadcasting System
                  </h2>
                </div>

                {broadcastError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{broadcastError}</p>
                  </div>
                )}

                {broadcastSuccess && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{broadcastSuccess}</p>
                  </div>
                )}

                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Send broadcast messages to selected user roles via Telegram bot.
                </p>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Broadcast Message
                  </label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    rows={5}
                    className="w-full p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100 resize-none"
                    placeholder="Enter your broadcast message here...&#10;&#10;You can use HTML formatting."
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Supports HTML formatting. All users with chat IDs in selected roles will receive this message.
                  </p>
                </div>

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Target Roles
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={broadcastTargetRoles.includes('owner')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBroadcastTargetRoles([...broadcastTargetRoles, 'owner'])
                          } else {
                            setBroadcastTargetRoles(broadcastTargetRoles.filter(r => r !== 'owner'))
                          }
                        }}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Owner</span>
                    </label>

                    <label className="flex items-center space-x-2 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={broadcastTargetRoles.includes('admin')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBroadcastTargetRoles([...broadcastTargetRoles, 'admin'])
                          } else {
                            setBroadcastTargetRoles(broadcastTargetRoles.filter(r => r !== 'admin'))
                          }
                        }}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Admin</span>
                    </label>

                    <label className="flex items-center space-x-2 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={broadcastTargetRoles.includes('reseller')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBroadcastTargetRoles([...broadcastTargetRoles, 'reseller'])
                          } else {
                            setBroadcastTargetRoles(broadcastTargetRoles.filter(r => r !== 'reseller'))
                          }
                        }}
                        className="w-4 h-4 text-pink-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Reseller</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleSendBroadcast}
                  disabled={sendingBroadcast || !broadcastMessage.trim() || broadcastTargetRoles.length === 0}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {sendingBroadcast ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Sending Broadcast...
                    </>
                  ) : (
                    'Send Broadcast'
                  )}
                </button>
              </div>
            )}

            {/* Bot Permissions Section - Only for Super Owner */}
            {auth.role === 'super owner' && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Bot Permissions
                  </h2>
                </div>

                {permissionsError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{permissionsError}</p>
                  </div>
                )}

                {permissionsMessage && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{permissionsMessage}</p>
                  </div>
                )}

                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Control which roles can access the Telegram bot. Toggle to hide/show bot options for each role.
                </p>

                <div className="space-y-4 mb-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Owner
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow owner role to use bot
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={botPermissions.owner}
                        onChange={(e) => setBotPermissions({ ...botPermissions, owner: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Admin
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow admin role to use bot
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={botPermissions.admin}
                        onChange={(e) => setBotPermissions({ ...botPermissions, admin: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Reseller
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow reseller role to use bot
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={botPermissions.reseller}
                        onChange={(e) => setBotPermissions({ ...botPermissions, reseller: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {savingPermissions ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Save Permissions'
                  )}
                </button>
              </div>
            )}

            {/* Owner Bot Permissions Section - Only for Owner when owner bot is enabled */}
            {auth.role === 'owner' && canManageOwnerPermissions && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Admin & Reseller Bot Permissions
                  </h2>
                </div>

                {permissionsError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{permissionsError}</p>
                  </div>
                )}

                {permissionsMessage && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{permissionsMessage}</p>
                  </div>
                )}

                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Control which roles can access the Telegram bot. Toggle to hide/show bot options for Admin and Reseller roles.
                </p>

                <div className="space-y-4 mb-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Admin
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow admin role to use bot
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ownerPermissions.admin}
                        onChange={(e) => setOwnerPermissions({ ...ownerPermissions, admin: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Reseller
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Allow reseller role to use bot
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ownerPermissions.reseller}
                        onChange={(e) => setOwnerPermissions({ ...ownerPermissions, reseller: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleSaveOwnerPermissions}
                  disabled={savingPermissions}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {savingPermissions ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Save Admin & Reseller Permissions'
                  )}
                </button>
              </div>
            )}

            {/* Telegram Chat ID Section - For All Users with Permission */}
            {hasBotPermission && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-4">
                  <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Telegram Chat ID
                  </h2>
                </div>

                {chatIdError && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{chatIdError}</p>
                  </div>
                )}

                {chatIdMessage && (
                  <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-300">{chatIdMessage}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Your Chat ID
                  </label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                    placeholder="Enter your Telegram Chat ID (e.g., 123456789)"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Get your Chat ID by messaging @userinfobot on Telegram
                  </p>
                </div>

                <div className="mb-4 flex gap-2">
                  <button
                    onClick={handleSaveChatId}
                    disabled={savingChatId}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {savingChatId ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Save Chat ID'
                    )}
                  </button>

                  {hasBotPermission && botUsername && botUsername.trim() !== '' && (
                    <button
                      onClick={handleOpenBot}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Bot
                    </button>
                  )}
                </div>

                {/* Bot Username Section - Only for Super Owner */}
                {auth.role === 'super owner' && (
                  <>
                    {botUsernameError && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <p className="text-sm text-red-700 dark:text-red-300">{botUsernameError}</p>
                      </div>
                    )}

                    {botUsernameMessage && (
                      <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <p className="text-sm text-green-700 dark:text-green-300">{botUsernameMessage}</p>
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                        Bot Username
                      </label>
                      <input
                        type="text"
                        value={botUsernameInput}
                        onChange={(e) => setBotUsernameInput(e.target.value)}
                        className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                        placeholder="Enter bot username (without @)"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Bot username without @ symbol (e.g., mybot instead of @mybot)
                      </p>
                    </div>

                    <button
                      onClick={handleSaveBotUsername}
                      disabled={savingBotUsername || !botUsernameInput.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mb-4"
                    >
                      {savingBotUsername ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        'Save Bot Username'
                      )}
                    </button>
                  </>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  After updating your Chat ID, you can use the bot to generate keys via Telegram.
                </p>
              </div>
            )}

            {/* Permission Denied Message */}
            {!hasBotPermission && (
              <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      Bot Access Restricted
                    </h3>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Your role ({auth.role}) does not have permission to access the Telegram bot. Please contact administrator to enable bot access for your role.
                  </p>
                </div>
              </div>
            )}

            {/* Account Settings Section - Only show heading for Owner and Super Owner */}
            {(auth.role === 'owner' || auth.role === 'super owner') && (
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Account Settings
                  </h2>
                </div>
              </div>
            )}

            {/* Current Username */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Username
              </label>
              <input
                value={currentUsername}
                disabled
                className="w-full mt-1 p-2 rounded-lg border bg-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              />
            </div>

            {/* Enter New Username */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter New Username
              </label>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="New username"
              />
            </div>

            {/* Enter Old Password */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter Old Password
              </label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="Old password"
              />
            </div>

            {/* Enter New Password */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="New password"
              />
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full mt-1 p-2 rounded-lg border bg-gray-50 dark:bg-gray-800 dark:border-gray-600 text-gray-800 dark:text-gray-100"
                placeholder="Confirm new password"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Save Changes'
              )}
            </button>
          </GlassCardContent>
        </GlassCard>
      </div>
    </SidebarLayout>
  )
}
