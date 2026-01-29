'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useLogo } from '@/contexts/LogoContext'
import {
    LayoutDashboard,
    Key,
    Plus,
    Users,
    Settings,
    Wallet,
    Shield,
    Server,
    UserCircle,
    Menu,
    X,
    ChevronRight,
    LogOut,
    Moon,
    Sun,
    Gift,
    Power
} from 'lucide-react'

interface AuthInfo {
    authenticated: boolean
    username?: string
    role?: string
}

interface SidebarLayoutProps {
    children: ReactNode
    title: string
    description?: string
    icon?: any
    headerAction?: ReactNode
    iconGradient?: string
}

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super owner', 'owner', 'admin', 'reseller'] },
    { name: 'Keys', href: '/keys', icon: Key, roles: ['super owner', 'owner', 'admin', 'reseller'] },
    { name: 'Generate Key', href: '/generate-key', icon: Plus, roles: ['super owner', 'owner', 'admin', 'reseller'] },
    { name: 'Users', href: '/users', icon: Users, roles: ['super owner', 'owner', 'admin'] },
    { name: 'Balance', href: '/balance', icon: Wallet, roles: ['super owner', 'owner', 'admin'] },
    { name: 'Referrals', href: '/referrals', icon: Gift, roles: ['super owner', 'owner', 'admin'] },
    { name: 'Blocked IPs', href: '/blocked-ips', icon: Shield, roles: ['super owner', 'owner', 'admin', 'reseller'] },
    { name: 'API Licence', href: '/api-licence', icon: Key, roles: ['super owner', 'owner'] },
    { name: 'Online Server', href: '/online-server', icon: Server, roles: ['super owner', 'owner'] },
    { name: 'Users Server', href: '/users-server-off-on', icon: Power, roles: ['super owner', 'owner', 'admin'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['super owner', 'owner', 'admin', 'reseller'] },
    { name: 'Profile', href: '/profile', icon: UserCircle, roles: ['super owner', 'owner', 'admin', 'reseller'] },
]

export default function SidebarLayout({
    children,
    title,
    description,
    icon: Icon,
    headerAction,
    iconGradient = 'from-blue-500 to-purple-600'
}: SidebarLayoutProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { logoUrl } = useLogo()
    const [auth, setAuth] = useState<AuthInfo>({ authenticated: false })
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const fetchAuth = async () => {
            try {
                const res = await fetch('/api/auth/status', { cache: 'no-store' })
                const data = await res.json()
                setAuth(data)
            } catch (err) {
                console.error(err)
            }
        }
        fetchAuth()

        // Check dark mode
        setIsDark(document.documentElement.classList.contains('dark'))
    }, [])

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark')
        setIsDark(!isDark)
        localStorage.setItem('theme', isDark ? 'light' : 'dark')
    }

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
        } catch (err) {
            console.error(err)
        }
    }

    const filteredNavItems = navItems.filter(item =>
        auth.role && item.roles.includes(auth.role)
    )

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 
        bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl
        border-r border-gray-200/50 dark:border-gray-700/50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        shadow-2xl lg:shadow-xl
      `}>
                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200/50 dark:border-gray-700/50">
                    <Link href="/dashboard" className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden shadow-lg shadow-blue-500/30">
                            {logoUrl ? (
                                <Image src={logoUrl} alt="Logo" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                            ) : (
                                <LayoutDashboard className="h-5 w-5 text-white" />
                            )}
                        </div>
                        <span className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                            NexPanel
                        </span>
                    </Link>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* User Info */}
                <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex items-center space-x-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                            {auth.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {auth.username || 'User'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {auth.role || 'Guest'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                    {filteredNavItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200 group
                  ${isActive
                                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                                    }
                `}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                                <span className="flex-1">{item.name}</span>
                                {isActive && <ChevronRight className="h-4 w-4" />}
                            </Link>
                        )
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={toggleDarkMode}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            <span>{isDark ? 'Light' : 'Dark'}</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="lg:pl-72">
                {/* Top Header Bar */}
                <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50">
                    <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                        {/* Mobile menu button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </button>

                        {/* Page Title with Icon */}
                        <div className="flex items-center space-x-3">
                            {Icon && (
                                <div className={`hidden sm:flex h-10 w-10 rounded-xl bg-gradient-to-tr ${iconGradient} items-center justify-center text-white shadow-lg`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                            )}
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                                    {title}
                                </h1>
                                {description && (
                                    <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Header Actions */}
                        <div className="flex items-center space-x-2">
                            {headerAction}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}

// Glassmorphism Card component
export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`
      bg-white/70 dark:bg-gray-800/70 
      backdrop-blur-xl 
      rounded-2xl 
      border border-white/50 dark:border-gray-700/50 
      shadow-xl shadow-gray-200/50 dark:shadow-black/30
      ${className}
    `}>
            {children}
        </div>
    )
}

// Card Header with icon
export function GlassCardHeader({
    children,
    icon: Icon,
    iconGradient = 'from-blue-500 to-purple-600',
    className = ''
}: {
    children: ReactNode
    icon?: any
    iconGradient?: string
    className?: string
}) {
    return (
        <div className={`p-5 border-b border-gray-200/50 dark:border-gray-700/50 ${className}`}>
            <div className="flex items-center space-x-3">
                {Icon && (
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${iconGradient} flex items-center justify-center text-white shadow-lg`}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}
                <div className="flex-1">
                    {children}
                </div>
            </div>
        </div>
    )
}

// Card Content
export function GlassCardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`p-5 ${className}`}>
            {children}
        </div>
    )
}
