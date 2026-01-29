'use client'

import { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import { useTheme } from '@/contexts/ThemeContext'

Chart.register(...registerables)

interface HourlyTrafficChartProps {
  data: number[]
  cpuData?: number[]
}

// Generate mock CPU usage data if not provided
const generateMockCpuData = (): number[] => {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 40) + 20) // 20-60% range
}

export default function HourlyTrafficChart({ data, cpuData }: HourlyTrafficChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)
  const { theme, mounted } = useTheme()

  useEffect(() => {
    if (chartRef.current && mounted) {
      const ctx = chartRef.current.getContext('2d')
      if (ctx) {
        // Destroy existing chart
        if (chartInstance.current) {
          chartInstance.current.destroy()
        }

        // Check if dark mode is enabled
        const isDarkMode = theme === 'dark'
        
        // Use provided CPU data or generate mock data
        const cpuUsageData = cpuData || generateMockCpuData()
        
        // Create new chart
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [
              {
                label: 'Requests',
                data: data.length > 0 ? data : Array(24).fill(0),
                borderColor: '#3B82F6',
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2,
                yAxisID: 'y',
              },
              {
                label: 'CPU Usage',
                data: cpuUsageData,
                borderColor: '#10B981',
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: false,
                borderWidth: 2,
                yAxisID: 'y1',
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10,
              },
            },
            scales: {
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                beginAtZero: true,
                grid: {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                },
                ticks: {
                  color: isDarkMode ? '#d1d5db' : '#374151',
                  maxTicksLimit: 6,
                  padding: 8,
                },
                border: {
                  display: false,
                },
              },
              y1: {
                type: 'linear',
                display: true,
                position: 'right',
                beginAtZero: true,
                max: 100,
                grid: {
                  drawOnChartArea: false,
                },
                ticks: {
                  color: isDarkMode ? '#d1d5db' : '#374151',
                  maxTicksLimit: 6,
                  padding: 8,
                  callback: function(value) {
                    return value + '%'
                  }
                },
                border: {
                  display: false,
                },
              },
              x: {
                grid: {
                  color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                },
                ticks: {
                  color: isDarkMode ? '#d1d5db' : '#374151',
                  maxTicksLimit: 12,
                  padding: 8,
                },
                border: {
                  display: false,
                },
              },
            },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: {
                  color: isDarkMode ? '#d1d5db' : '#374151',
                  usePointStyle: true,
                  padding: 20,
                },
              },
              tooltip: {
                backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                titleColor: isDarkMode ? '#d1d5db' : '#374151',
                bodyColor: isDarkMode ? '#d1d5db' : '#374151',
                borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            },
            elements: {
              point: {
                radius: 3,
                hoverRadius: 5,
              },
            },
            interaction: {
              intersect: false,
              mode: 'index',
            },
          },
        })
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [data, cpuData, theme, mounted])

  return (
    <div className="relative w-full h-full">
      <canvas ref={chartRef} className="w-full h-full" />
    </div>
  )
}
