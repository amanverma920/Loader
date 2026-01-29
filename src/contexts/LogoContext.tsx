'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface LogoContextType {
  logoUrl: string
  setLogoUrl: (url: string) => void
  loading: boolean
  refresh: () => void
}

const LogoContext = createContext<LogoContextType | undefined>(undefined)

export function LogoProvider({ children }: { children: ReactNode }) {
  const [logoUrl, setLogoUrlState] = useState<string>('/images/logo.svg')
  const [loading, setLoading] = useState(true)

  const loadLogo = useCallback(async () => {
    try {
      const response = await fetch('/api/logo', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
      const data = await response.json()
      if (data.status && data.logoUrl) {
        setLogoUrlState(data.logoUrl)
      }
    } catch (error) {
      console.error('Failed to load logo:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogo()
    
    // Listen for storage events to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'logo-updated') {
        loadLogo()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom events for same-tab updates
    const handleLogoUpdate = () => {
      loadLogo()
    }
    
    window.addEventListener('logo-updated', handleLogoUpdate as EventListener)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('logo-updated', handleLogoUpdate as EventListener)
    }
  }, [loadLogo])

  const setLogoUrl = async (url: string) => {
    const trimmedUrl = url.trim()
    setLogoUrlState(trimmedUrl)
    try {
      const response = await fetch('/api/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: trimmedUrl }),
      })
      const data = await response.json()
      if (data.status) {
        // Reload to ensure consistency
        await loadLogo()
        // Trigger event for same-tab updates
        window.dispatchEvent(new Event('logo-updated'))
        // Trigger storage event for cross-tab updates
        localStorage.setItem('logo-updated', Date.now().toString())
        localStorage.removeItem('logo-updated')
      }
    } catch (error) {
      console.error('Failed to save logo:', error)
      // Revert on error
      await loadLogo()
    }
  }

  const refresh = useCallback(() => {
    loadLogo()
  }, [loadLogo])

  return (
    <LogoContext.Provider value={{ logoUrl, setLogoUrl, loading, refresh }}>
      {children}
    </LogoContext.Provider>
  )
}

export function useLogo() {
  const context = useContext(LogoContext)
  if (context === undefined) {
    throw new Error('useLogo must be used within a LogoProvider')
  }
  return context
}