'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface PanelNameContextType {
  panelName: string
  setPanelName: (name: string) => void
  loading: boolean
  refresh: () => void
}

const PanelNameContext = createContext<PanelNameContextType | undefined>(undefined)

export function PanelNameProvider({ children }: { children: ReactNode }) {
  // Load from localStorage first to prevent flash
  const getInitialPanelName = () => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached-panel-name')
      if (cached) {
        return cached
      }
    }
    return 'Vip Panel'
  }

  const [panelName, setPanelNameState] = useState<string>(getInitialPanelName())
  const [loading, setLoading] = useState(true)

  const loadPanelName = useCallback(async () => {
    try {
      const response = await fetch('/api/panel-name', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        }
      })
      const data = await response.json()
      if (data.status && data.panelName) {
        setPanelNameState(data.panelName)
        // Cache in localStorage to prevent flash on next load
        if (typeof window !== 'undefined') {
          localStorage.setItem('cached-panel-name', data.panelName)
        }
      } else if (data.status && !data.panelName) {
        // If no panel name is set, keep default
        setPanelNameState('Vip Panel')
        if (typeof window !== 'undefined') {
          localStorage.setItem('cached-panel-name', 'Vip Panel')
        }
      }
    } catch (error) {
      console.error('Failed to load panel name:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPanelName()
    
    // Listen for storage events to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'panel-name-updated') {
        loadPanelName()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom events for same-tab updates
    const handlePanelNameUpdate = () => {
      loadPanelName()
    }
    
    window.addEventListener('panel-name-updated', handlePanelNameUpdate as EventListener)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('panel-name-updated', handlePanelNameUpdate as EventListener)
    }
  }, [loadPanelName])

  const setPanelName = async (name: string) => {
    const trimmedName = name.trim()
    setPanelNameState(trimmedName)
    // Update cache immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('cached-panel-name', trimmedName)
    }
    try {
      const response = await fetch('/api/panel-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelName: trimmedName }),
      })
      const data = await response.json()
      if (data.status) {
        // Reload to ensure consistency
        await loadPanelName()
        // Trigger event for same-tab updates
        window.dispatchEvent(new Event('panel-name-updated'))
        // Trigger storage event for cross-tab updates
        localStorage.setItem('panel-name-updated', Date.now().toString())
        localStorage.removeItem('panel-name-updated')
      }
    } catch (error) {
      console.error('Failed to save panel name:', error)
      // Revert on error
      await loadPanelName()
    }
  }

  const refresh = useCallback(() => {
    loadPanelName()
  }, [loadPanelName])

  return (
    <PanelNameContext.Provider value={{ panelName, setPanelName, loading, refresh }}>
      {children}
    </PanelNameContext.Provider>
  )
}

export function usePanelName() {
  const context = useContext(PanelNameContext)
  if (context === undefined) {
    throw new Error('usePanelName must be used within a PanelNameProvider')
  }
  return context
}