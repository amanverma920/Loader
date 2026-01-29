'use client'

import { ReactNode } from 'react'
import Navigation from './Navigation'

interface PageLayoutProps {
    children: ReactNode
    title: string
    description?: string
    headerAction?: ReactNode
}

export default function PageLayout({ children, title, description, headerAction }: PageLayoutProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Navigation />

            <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                                {title}
                            </h1>
                            {description && (
                                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                                    {description}
                                </p>
                            )}
                        </div>
                        {headerAction && (
                            <div className="flex-shrink-0">
                                {headerAction}
                            </div>
                        )}
                    </div>
                </div>

                {/* Page Content */}
                <div className="space-y-6">
                    {children}
                </div>
            </div>
        </div>
    )
}

// Card component for consistent styling
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden ${className}`}>
            {children}
        </div>
    )
}

// Card Header
export function CardHeader({ children, icon: Icon, className = '' }: { children: ReactNode; icon?: any; className?: string }) {
    return (
        <div className={`p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 ${className}`}>
            <div className="flex items-center space-x-3">
                {Icon && (
                    <div className="p-2 sm:p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
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
export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`p-4 sm:p-6 ${className}`}>
            {children}
        </div>
    )
}

// Button component
export function Button({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    ...props
}: {
    children: ReactNode
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    [key: string]: any
}) {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

    const variantClasses = {
        primary: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/30 focus:ring-blue-500',
        secondary: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500',
        danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 focus:ring-red-500',
        ghost: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500'
    }

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs gap-1.5',
        md: 'px-4 py-2 text-sm gap-2',
        lg: 'px-6 py-3 text-base gap-2'
    }

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    )
}
