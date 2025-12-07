import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

// تسجيل مكونات Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// إعدادات افتراضية للرسوم البيانية
export const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      rtl: true,
      labels: {
        usePointStyle: true,
        padding: 15,
        font: {
          family: 'inherit',
          size: 12,
        },
      },
    },
    tooltip: {
      rtl: true,
      padding: 12,
      titleFont: {
        size: 14,
        weight: 'bold' as const,
      },
      bodyFont: {
        size: 13,
      },
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
      },
    },
  },
}

// ألوان للرسوم البيانية
export const chartColors = {
  primary: '#5e72e4',
  secondary: '#8392ab',
  success: '#2dce89',
  danger: '#f5365c',
  warning: '#fb6340',
  info: '#11cdef',
  light: '#e9ecef',
  dark: '#172b4d',
  gradient: {
    primary: ['#5e72e4', '#667eea'],
    success: ['#2dce89', '#2dceaa'],
    danger: ['#f5365c', '#f56036'],
    warning: ['#fb6340', '#fbb140'],
  },
}













