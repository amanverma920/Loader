// src/components/Navigation.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Shield, LogOut, BarChart3, Key, Wallet, Users, Menu, X, Settings, User, Clock, Lock, Server, Power, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { usePanelName } from '@/contexts/PanelNameContext'
import { useLogo } from '@/contexts/LogoContext'
import type { UserRole } from '@/types'

interface AuthInfo {
  authenticated: boolean
  username?: string
  role?: UserRole
}

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { panelName } = usePanelName()
  const { logoUrl } = useLogo()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })

  useEffect(() => {
    let isMounted = true

    const loadAuth = async () => {
      try {
        const res = await fetch('/api/auth/status', { cache: 'no-store' })
        const data = await res.json()

        // 🔐 Agar login nahi hai to direct /login bhej do
        if (!data.authenticated) {
          if (isMounted) setAuth({ authenticated: false })
          router.push('/login')
          return
        }

        if (isMounted) {
          setAuth(data)
        }
      } catch (err) {
        console.error('Auth status error in nav:', err)
        // Error pe bhi safe side se login page
        router.push('/login')
      }
    }

    // Pehli baar load pe check
    loadAuth()

    // 🔁 Har 60 second me session check karo (auto logout after expiry)
    const interval = setInterval(loadAuth, 60_000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [router])

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (response.ok) {
        setAuth({ authenticated: false })
        router.push('/login')
        setIsMobileMenuOpen(false)
      }
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const isOwnerOrAdmin = auth.role === 'owner' || auth.role === 'admin' || auth.role === 'super owner'

  const baseItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      description: 'System overview and security management',
      show: true,
    },
    {
      name: 'Keys',
      href: '/keys',
      icon: Key,
      description: 'Manage API keys',
      show: true,
    },
    {
      name: 'Generate Key',
      href: '/generate-key',
      icon: Plus,
      description: 'Generate new API key',
      show: true,
    },
    {
      name: 'Add Balance',
      href: '/balance',
      icon: Wallet,
      description: 'Add balance to users',
      show: isOwnerOrAdmin, // ✅ hide for reseller
    },
    {
      name: 'Manage Users',
      href: '/users',
      icon: Users,
      description: 'View and manage users',
      show: isOwnerOrAdmin, // ✅ owner/admin/super owner
    },
    {
      name: 'Referrals',
      href: '/referrals',
      icon: Users,
      description: 'Create and manage referral codes',
      show: isOwnerOrAdmin, // ✅ hide for reseller
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      description: 'Update profile picture and settings',
      show: auth.role === 'owner' || auth.role === 'super owner', // Owner and Super Owner
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'Change username or password',
      show: true, // Owner + Admin + Reseller sab ko dikhe
    },
    {
      name: 'API Licence',
      href: '/api-licence',
      icon: Lock,
      description: 'Manage API Key and Secret Key',
      show: auth.role === 'owner' || auth.role === 'super owner', // Only Owner and Super Owner
    },
    {
      name: 'Online Server',
      href: '/online-server',
      icon: Server,
      description: 'Manage server maintenance mode',
      show: auth.role === 'owner' || auth.role === 'super owner', // Only Owner and Super Owner
    },
    {
      name: 'Users Server Off/On',
      href: '/users-server-off-on',
      icon: Power,
      description: 'Manage user server status',
      show: isOwnerOrAdmin, // Owner, Admin, and Super Owner
    },
  ]

  const navigationItems = baseItems.filter((item) => item.show)

  const isActive = (href: string) => pathname?.startsWith(href)

  return (
    <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg shadow-gray-200/40 dark:shadow-black/40 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center gap-4">
          {/* Left - Logo */}
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/40 overflow-hidden relative">
              {logoUrl && logoUrl !== '/images/logo.svg' ? (
                <Image
                  src={logoUrl}
                  alt={`${panelName || 'NexPanel'} Logo`}
                  width={36}
                  height={36}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              ) : (
                <Key className="h-5 w-5" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                {panelName || 'NexPanel'}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Secure admin control
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-1.5 flex-shrink-0">
            {navigationItems.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group relative px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all duration-200 whitespace-nowrap ${active
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800'
                    }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 flex-shrink-0 transition-colors duration-200 ${active
                      ? 'text-blue-500'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-blue-500'
                      }`}
                  />
                  <span className="hidden md:inline">{item.name}</span>

                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 pointer-events-none opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto text-xs text-gray-100 bg-gray-900/95 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg whitespace-nowrap z-50 shadow-lg backdrop-blur-sm">
                    {item.description}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900 dark:border-b-gray-700" />
                  </div>
                </Link>
              )
            })}

            <div className="pl-1.5 border-l border-gray-200 dark:border-gray-700 ml-1">
              <ThemeToggle />
            </div>

            <button
              onClick={handleLogout}
              className="relative ml-1.5 inline-flex items-center justify-center p-2 rounded-xl text-gray-600 hover:text-red-500 hover:bg-red-50 dark:text-gray-300 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </button>
          </div>

          {/* Mobile right side */}
          <div className="md:hidden flex items-center space-x-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="group relative p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-all duration-200"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar - Slides from Left */}
      <div
        className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Sidebar Panel */}
        <div
          className={`absolute top-0 left-0 h-full w-72 bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-500 text-white shadow-lg overflow-hidden">
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
                  <Key className="h-5 w-5" />
                )}
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                {panelName || 'NexPanel'}
              </span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto py-4 px-3">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      router.push(item.href)
                      setIsMobileMenuOpen(false)
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${active
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-white' : ''}`} />
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom Section - Logout */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-all duration-200"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}