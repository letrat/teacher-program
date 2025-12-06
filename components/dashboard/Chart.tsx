'use client'

import { useEffect, useState } from 'react'
import { ChartOptions } from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'
import '@/lib/chart-config' // تسجيل Chart.js
import { chartOptions } from '@/lib/chart-config'
import { useWindowSize } from '@/lib/hooks/useWindowSize'

interface ChartProps {
  type: 'bar' | 'line' | 'pie' | 'doughnut'
  data: any
  options?: ChartOptions
  height?: number
  className?: string
}

export default function Chart({ type, data, options, height = 300, className = '' }: ChartProps) {
  const windowSize = useWindowSize()
  const [chartHeight, setChartHeight] = useState(height)

  useEffect(() => {
    // Adjust height based on screen size
    if (windowSize.width > 0) {
      if (windowSize.width < 640) {
        // Mobile
        setChartHeight(Math.max(250, height * 0.8))
      } else if (windowSize.width < 1024) {
        // Tablet
        setChartHeight(Math.max(280, height * 0.9))
      } else {
        // Desktop
        setChartHeight(height)
      }
    }
  }, [windowSize.width, height])

  const mergedOptions: ChartOptions = {
    ...chartOptions,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      ...chartOptions.plugins,
      legend: {
        ...chartOptions.plugins?.legend,
        position: windowSize.width < 640 ? 'bottom' : 'top',
        labels: {
          ...chartOptions.plugins?.legend?.labels,
          font: {
            ...chartOptions.plugins?.legend?.labels?.font,
            size: windowSize.width < 640 ? 10 : 12,
          },
          padding: windowSize.width < 640 ? 10 : 15,
        },
      },
      tooltip: {
        ...chartOptions.plugins?.tooltip,
        titleFont: {
          size: windowSize.width < 640 ? 12 : 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: windowSize.width < 640 ? 11 : 13,
        },
      },
      ...options?.plugins,
    },
    ...options,
  }

  const chartComponents = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
  }

  const ChartComponent = chartComponents[type]

  return (
    <div 
      className={`bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 ${className}`} 
      style={{ height: `${chartHeight}px`, minHeight: '250px' }}
    >
      <ChartComponent data={data} options={mergedOptions as any} />
    </div>
  )
}

