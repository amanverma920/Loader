'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="relative inline-flex h-7 w-12 sm:h-8 sm:w-14 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-300 ease-in-out">
        <div className="inline-block h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-white shadow-md transform translate-x-0.5"></div>
      </div>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="group relative inline-flex h-7 w-12 sm:h-8 sm:w-14 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 shadow-md hover:shadow-lg active:scale-95"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {/* Tooltip - Only show on desktop */}
      <div className="hidden sm:block absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {theme === 'light' ? 'Dark' : 'Light'} mode
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-gray-900 dark:border-b-gray-700"></div>
      </div>
      
      {/* Toggle handle */}
      <span
        className={`relative inline-block h-5 w-5 sm:h-6 sm:w-6 transform rounded-full bg-white dark:bg-gray-800 shadow-md transition-all duration-300 ease-in-out flex items-center justify-center ${
          theme === 'dark' ? 'translate-x-5 sm:translate-x-7' : 'translate-x-0.5'
        }`}
      >
        {/* Icons */}
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          theme === 'dark' ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'
        }`}>
          <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-600 dark:text-gray-300" />
        </div>
        <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
          theme === 'light' ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'
        }`}>
          <Sun className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-500" />
        </div>
      </span>
    </button>
  )
}
