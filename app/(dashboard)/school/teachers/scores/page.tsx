'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Table from '@/components/dashboard/Table'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { TrendingUp, TrendingDown, Award, Download, Search, Filter, User, Users, Eye, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import * as XLSX from 'xlsx-js-style'

interface TeacherScore {
  id: string
  name: string
  jobType: string
  overallScore: number
  overallPercentage: number
  kpis?: Array<{
    kpiId: string
    kpiName: string
    weight: number
    score: number
    acceptedCount: number
    minRequired: number | null
    isAchieved: boolean
  }>
  error?: string
}

export default function TeachersScoresPage() {
  const [teachers, setTeachers] = useState<TeacherScore[]>([])
  const [jobTypesWeights, setJobTypesWeights] = useState<Array<{
    jobTypeId: string
    jobTypeName: string
    totalWeight: number
    isValid: boolean
  }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score')
  const [filterJobType, setFilterJobType] = useState('')
  const [filterScore, setFilterScore] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchScores()
  }, [])

  const fetchScores = async () => {
    try {
      const data = await api.school.teachers.scores() as { teachers?: any[]; jobTypesWeights?: any[] }
      setTeachers(data.teachers || [])
      setJobTypesWeights(data.jobTypesWeights || [])
    } catch (error: any) {
      setError(error.message || 'حدث خطأ في جلب الدرجات')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  // تصفية المعلمين
  const filteredTeachers = teachers.filter((teacher) => {
    // البحث بالاسم
    if (searchQuery && !teacher.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    // تصفية حسب الصفة
    if (filterJobType && !teacher.jobType.includes(filterJobType)) return false
    // تصفية حسب الدرجة
    if (filterScore) {
      const score = parseFloat(filterScore)
      if (isNaN(score)) return true
      if (filterScore.startsWith('>')) {
        return teacher.overallScore > score
      } else if (filterScore.startsWith('<')) {
        return teacher.overallScore < score
      } else {
        return Math.abs(teacher.overallScore - score) < 0.5
      }
    }
    return true
  })

  // ترتيب المعلمين
  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    if (sortBy === 'score') {
      return b.overallScore - a.overallScore
    } else {
      return a.name.localeCompare(b.name, 'ar')
    }
  })

  // جلب الصفات الوظيفية الفريدة
  const jobTypes = Array.from(new Set(teachers.map((t) => t.jobType)))

  const exportToExcel = () => {
    try {
      // إنشاء workbook جديد
      const wb = XLSX.utils.book_new()

      // ========== ورقة الملخص (Summary Sheet) ==========
      const summaryData: any[] = []
      
      // العنوان الرئيسي مع تصميم احترافي
      summaryData.push(['📊 تقرير أداء المعلمين - ملخص شامل'])
      summaryData.push([])
      
      // معلومات التقرير في جدول منسق
      const exportDate = new Date().toLocaleDateString('ar-SA', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      const exportTime = new Date().toLocaleTimeString('ar-SA')
      
      summaryData.push(['معلومات التقرير'])
      summaryData.push(['تاريخ التصدير', exportDate])
      summaryData.push(['وقت التصدير', exportTime])
      summaryData.push(['إجمالي المعلمين', sortedTeachers.length])
      summaryData.push(['عدد المعلمين المفلترين', sortedTeachers.length])
      summaryData.push([])
      
      // إحصائيات سريعة
      const avgScore = sortedTeachers.length > 0 
        ? sortedTeachers.reduce((sum, t) => sum + t.overallScore, 0) / sortedTeachers.length 
        : 0
      const maxScore = sortedTeachers.length > 0 
        ? Math.max(...sortedTeachers.map((t) => t.overallScore)) 
        : 0
      const minScore = sortedTeachers.length > 0 
        ? Math.min(...sortedTeachers.map((t) => t.overallScore)) 
        : 0
      const excellentCount = sortedTeachers.filter(t => t.overallPercentage >= 80).length
      const goodCount = sortedTeachers.filter(t => t.overallPercentage >= 60 && t.overallPercentage < 80).length
      const needsImprovementCount = sortedTeachers.filter(t => t.overallPercentage < 60).length
      
      summaryData.push(['📈 الإحصائيات السريعة'])
      summaryData.push(['متوسط الدرجة', avgScore.toFixed(2) + ' / 5'])
      summaryData.push(['أعلى درجة', maxScore.toFixed(2) + ' / 5'])
      summaryData.push(['أقل درجة', minScore.toFixed(2) + ' / 5'])
      summaryData.push(['متوسط النسبة المئوية', (avgScore / 5 * 100).toFixed(1) + '%'])
      summaryData.push([])
      
      summaryData.push(['📊 توزيع الأداء'])
      summaryData.push(['المستوى', 'العدد', 'النسبة'])
      summaryData.push(['ممتاز (80% فأكثر)', excellentCount, sortedTeachers.length > 0 ? `${((excellentCount / sortedTeachers.length) * 100).toFixed(1)}%` : '0%'])
      summaryData.push(['جيد (60-79%)', goodCount, sortedTeachers.length > 0 ? `${((goodCount / sortedTeachers.length) * 100).toFixed(1)}%` : '0%'])
      summaryData.push(['يحتاج تحسين (أقل من 60%)', needsImprovementCount, sortedTeachers.length > 0 ? `${((needsImprovementCount / sortedTeachers.length) * 100).toFixed(1)}%` : '0%'])
      summaryData.push([])
      summaryData.push([])
      
      // رأس الجدول الرئيسي
      summaryData.push(['#', 'اسم المعلم', 'الصفة الوظيفية', 'الدرجة النهائية', 'النسبة المئوية', 'الحالة', 'عدد المعايير', 'المعايير المحققة', 'المعايير غير المحققة'])
      
      // بيانات المعلمين
      sortedTeachers.forEach((teacher, index) => {
        const status = teacher.error 
          ? '❌ خطأ' 
          : teacher.overallPercentage >= 80 
            ? '✅ ممتاز' 
            : teacher.overallPercentage >= 60 
              ? '⚠️ جيد' 
              : '🔴 يحتاج تحسين'
        
        const kpiCount = teacher.kpis ? teacher.kpis.length : 0
        const achievedCount = teacher.kpis ? teacher.kpis.filter(k => k.isAchieved).length : 0
        const notAchievedCount = kpiCount - achievedCount
        
        summaryData.push([
          index + 1,
          teacher.name,
          teacher.jobType,
          teacher.overallScore.toFixed(2) + ' / 5',
          teacher.overallPercentage.toFixed(1) + '%',
          status,
          kpiCount,
          achievedCount,
          notAchievedCount
        ])
      })
      
      // إنشاء ورقة الملخص
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
      
      // تنسيق عرض الأعمدة
      wsSummary['!cols'] = [
        { wch: 5 },   // #
        { wch: 30 },  // اسم المعلم
        { wch: 20 },  // الصفة الوظيفية
        { wch: 18 },  // الدرجة النهائية
        { wch: 16 },  // النسبة المئوية
        { wch: 18 },  // الحالة
        { wch: 14 },  // عدد المعايير
        { wch: 18 },  // المعايير المحققة
        { wch: 20 },  // المعايير غير المحققة
      ]
      
      // تنسيق الخلايا الاحترافي
      const titleStyle = {
        font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' }, name: 'Arial' },
        fill: { fgColor: { rgb: '1F4E78' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
          bottom: { style: 'medium', color: { rgb: '000000' } },
          left: { style: 'medium', color: { rgb: '000000' } },
          right: { style: 'medium', color: { rgb: '000000' } }
        }
      }
      
      const sectionTitleStyle = {
        font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' }, name: 'Arial' },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      }
      
      const infoLabelStyle = {
        font: { bold: true, sz: 11, name: 'Arial' },
        fill: { fgColor: { rgb: 'D9E1F2' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        }
      }
      
      const infoValueStyle = {
        font: { sz: 11, name: 'Arial' },
        fill: { fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        }
      }
      
      const headerStyle = {
        font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' }, name: 'Arial' },
        fill: { fgColor: { rgb: '70AD47' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
          bottom: { style: 'medium', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      }
      
      // تطبيق التنسيق على العنوان الرئيسي
      if (wsSummary['A1']) {
        wsSummary['A1'].s = titleStyle
        if (!wsSummary['!merges']) wsSummary['!merges'] = []
        wsSummary['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
      }
      
      // تطبيق التنسيق على "معلومات التقرير"
      if (wsSummary['A3']) {
        wsSummary['A3'].s = sectionTitleStyle
        if (!wsSummary['!merges']) wsSummary['!merges'] = []
        wsSummary['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 1 } })
      }
      
      // تطبيق التنسيق على معلومات التقرير (الصفوف 4-7)
      for (let row = 3; row < 8; row++) {
        const cellRefA = XLSX.utils.encode_cell({ r: row, c: 0 })
        const cellRefB = XLSX.utils.encode_cell({ r: row, c: 1 })
        if (wsSummary[cellRefA]) wsSummary[cellRefA].s = infoLabelStyle
        if (wsSummary[cellRefB]) wsSummary[cellRefB].s = infoValueStyle
      }
      
      // تطبيق التنسيق على "الإحصائيات السريعة"
      const statsTitleRow = 9
      if (wsSummary[XLSX.utils.encode_cell({ r: statsTitleRow, c: 0 })]) {
        wsSummary[XLSX.utils.encode_cell({ r: statsTitleRow, c: 0 })].s = sectionTitleStyle
        if (!wsSummary['!merges']) wsSummary['!merges'] = []
        wsSummary['!merges'].push({ s: { r: statsTitleRow, c: 0 }, e: { r: statsTitleRow, c: 1 } })
      }
      
      // تطبيق التنسيق على الإحصائيات السريعة
      for (let row = statsTitleRow + 1; row < statsTitleRow + 6; row++) {
        const cellRefA = XLSX.utils.encode_cell({ r: row, c: 0 })
        const cellRefB = XLSX.utils.encode_cell({ r: row, c: 1 })
        if (wsSummary[cellRefA]) wsSummary[cellRefA].s = infoLabelStyle
        if (wsSummary[cellRefB]) wsSummary[cellRefB].s = infoValueStyle
      }
      
      // تطبيق التنسيق على "توزيع الأداء"
      const distributionTitleRow = statsTitleRow + 6
      if (wsSummary[XLSX.utils.encode_cell({ r: distributionTitleRow, c: 0 })]) {
        wsSummary[XLSX.utils.encode_cell({ r: distributionTitleRow, c: 0 })].s = sectionTitleStyle
        if (!wsSummary['!merges']) wsSummary['!merges'] = []
        wsSummary['!merges'].push({ s: { r: distributionTitleRow, c: 0 }, e: { r: distributionTitleRow, c: 2 } })
      }
      
      // تطبيق التنسيق على رأس جدول توزيع الأداء
      const distributionHeaderRow = distributionTitleRow + 1
      for (let col = 0; col < 3; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: distributionHeaderRow, c: col })
        if (wsSummary[cellRef]) wsSummary[cellRef].s = headerStyle
      }
      
      // تطبيق التنسيق على بيانات توزيع الأداء
      for (let row = distributionHeaderRow + 1; row < distributionHeaderRow + 4; row++) {
        for (let col = 0; col < 3; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
          if (!wsSummary[cellRef]) continue
          const rowStyle = {
            font: { sz: 11, name: 'Arial' },
            fill: { fgColor: { rgb: (row - distributionHeaderRow - 1) % 2 === 0 ? 'FFFFFF' : 'F2F2F2' } },
            alignment: { horizontal: col === 0 ? 'right' : 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          }
          wsSummary[cellRef].s = rowStyle
        }
      }
      
      // تطبيق التنسيق على رأس الجدول الرئيسي
      const headerRow = distributionHeaderRow + 5
      for (let col = 0; col < 9; col++) {
        const cellRef = XLSX.utils.encode_cell({ r: headerRow, c: col })
        if (!wsSummary[cellRef]) continue
        wsSummary[cellRef].s = headerStyle
      }
      
      // تطبيق التنسيق على بيانات المعلمين
      sortedTeachers.forEach((teacher, index) => {
        const row = headerRow + 1 + index
        const status = teacher.error 
          ? '❌ خطأ' 
          : teacher.overallPercentage >= 80 
            ? '✅ ممتاز' 
            : teacher.overallPercentage >= 60 
              ? '⚠️ جيد' 
              : '🔴 يحتاج تحسين'
        
        // تنسيق حسب الحالة
        let statusColor = 'FFC7CE' // أحمر (يحتاج تحسين)
        let statusTextColor = '9C0006'
        if (status.includes('ممتاز')) {
          statusColor = 'C6EFCE' // أخضر
          statusTextColor = '006100'
        } else if (status.includes('جيد')) {
          statusColor = 'FFEB9C' // أصفر
          statusTextColor = '9C6500'
        }
        
        const rowStyle = {
          font: { sz: 11, name: 'Arial' },
          fill: { fgColor: { rgb: index % 2 === 0 ? 'FFFFFF' : 'F9F9F9' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          }
        }
        
        const statusStyle = {
          ...rowStyle,
          fill: { fgColor: { rgb: statusColor } },
          font: { bold: true, sz: 11, color: { rgb: statusTextColor }, name: 'Arial' }
        }
        
        for (let col = 0; col < 9; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
          if (!wsSummary[cellRef]) continue
          if (col === 5) { // عمود الحالة
            wsSummary[cellRef].s = statusStyle
          } else {
            wsSummary[cellRef].s = rowStyle
          }
        }
      })
      
      // إضافة ورقة الملخص
      XLSX.utils.book_append_sheet(wb, wsSummary, 'الملخص')

      // ========== ورقة تفاصيل كل معلم ==========
      sortedTeachers.forEach((teacher, teacherIndex) => {
        if (teacher.error) {
          // إذا كان هناك خطأ، أنشئ ورقة بسيطة
          const errorData = [
            ['اسم المعلم:', teacher.name],
            ['الصفة الوظيفية:', teacher.jobType],
            ['الخطأ:', teacher.error],
          ]
          const wsError = XLSX.utils.aoa_to_sheet(errorData)
          wsError['!cols'] = [{ wch: 20 }, { wch: 30 }]
          XLSX.utils.book_append_sheet(wb, wsError, `${teacherIndex + 1}_${teacher.name.substring(0, 20)}`)
          return
        }

        const detailData: any[] = []
        
        // العنوان الرئيسي
        detailData.push([`📋 تقرير أداء المعلم: ${teacher.name}`])
        detailData.push([])
        
        // معلومات المعلم في جدول منسق
        detailData.push(['معلومات المعلم'])
        detailData.push(['اسم المعلم', teacher.name])
        detailData.push(['الصفة الوظيفية', teacher.jobType])
        detailData.push(['الدرجة النهائية', teacher.overallScore.toFixed(2) + ' / 5'])
        detailData.push(['النسبة المئوية', teacher.overallPercentage.toFixed(1) + '%'])
        
        // تقييم الأداء
        let performanceLevel = ''
        let performanceEmoji = ''
        if (teacher.overallPercentage >= 80) {
          performanceLevel = 'ممتاز - أداء متميز'
          performanceEmoji = '✅'
        } else if (teacher.overallPercentage >= 60) {
          performanceLevel = 'جيد - أداء مقبول'
          performanceEmoji = '⚠️'
        } else {
          performanceLevel = 'يحتاج تحسين - يحتاج إلى تطوير'
          performanceEmoji = '🔴'
        }
        detailData.push(['مستوى الأداء', `${performanceEmoji} ${performanceLevel}`])
        detailData.push([])
        
        // إحصائيات سريعة
        if (teacher.kpis && teacher.kpis.length > 0) {
          const achievedCount = teacher.kpis.filter(k => k.isAchieved).length
          const notAchievedCount = teacher.kpis.length - achievedCount
          const totalAcceptedEvidence = teacher.kpis.reduce((sum, k) => sum + k.acceptedCount, 0)
          const totalMinRequired = teacher.kpis
            .filter(k => k.minRequired !== null)
            .reduce((sum, k) => sum + (k.minRequired || 0), 0)
          
          detailData.push(['📊 إحصائيات سريعة'])
          detailData.push(['إجمالي المعايير', teacher.kpis.length])
          detailData.push(['المعايير المحققة', `${achievedCount} (${((achievedCount / teacher.kpis.length) * 100).toFixed(1)}%)`])
          detailData.push(['المعايير غير المحققة', `${notAchievedCount} (${((notAchievedCount / teacher.kpis.length) * 100).toFixed(1)}%)`])
          detailData.push(['إجمالي الشواهد المقبولة', totalAcceptedEvidence])
          if (totalMinRequired > 0) {
            detailData.push(['إجمالي الحد الأدنى المطلوب', totalMinRequired])
            detailData.push(['نسبة الإنجاز', `${((totalAcceptedEvidence / totalMinRequired) * 100).toFixed(1)}%`])
          }
          detailData.push([])
        }
        
        // جدول KPIs
        detailData.push(['📈 تفاصيل المعايير (KPIs)'])
        detailData.push(['#', 'اسم المعيار', 'الوزن (%)', 'الدرجة (من 5)', 'النسبة (%)', 'الدرجة الموزونة', 'الشواهد المقبولة', 'الحد الأدنى', 'الحالة', 'التقييم'])
        
        if (teacher.kpis && teacher.kpis.length > 0) {
          teacher.kpis.forEach((kpi, kpiIndex) => {
            const weightedScore = (kpi.score * kpi.weight) / 100
            const kpiPercentage = (kpi.score / 5) * 100
            let kpiEvaluation = ''
            let kpiEmoji = ''
            if (kpiPercentage >= 80) {
              kpiEvaluation = 'ممتاز'
              kpiEmoji = '✅'
            } else if (kpiPercentage >= 60) {
              kpiEvaluation = 'جيد'
              kpiEmoji = '⚠️'
            } else {
              kpiEvaluation = 'يحتاج تحسين'
              kpiEmoji = '🔴'
            }
            
            const status = kpi.isAchieved ? '✅ محقق' : '❌ غير محقق'
            
            detailData.push([
              kpiIndex + 1,
              kpi.kpiName,
              kpi.weight.toFixed(1) + '%',
              kpi.score.toFixed(2),
              kpiPercentage.toFixed(1) + '%',
              weightedScore.toFixed(2),
              kpi.acceptedCount,
              kpi.minRequired !== null ? kpi.minRequired : '—',
              status,
              `${kpiEmoji} ${kpiEvaluation}`
            ])
          })
          
          // المجموع
          detailData.push([])
          const totalWeight = teacher.kpis.reduce((sum, k) => sum + k.weight, 0)
          const totalWeightedScore = teacher.kpis.reduce((sum, k) => sum + (k.score * k.weight) / 100, 0)
          detailData.push(['المجموع', '', 
            totalWeight.toFixed(1) + '%',
            '',
            '',
            totalWeightedScore.toFixed(2),
            '',
            '',
            '',
            ''
          ])
          
          // ملاحظات
          detailData.push([])
          detailData.push(['ملاحظات:'])
          detailData.push(['- مجموع الأوزان يجب أن يساوي 100%'])
          detailData.push([`- مجموع الأوزان الفعلي: ${totalWeight.toFixed(1)}%`])
          if (Math.abs(totalWeight - 100) > 0.1) {
            detailData.push(['⚠️ تحذير: مجموع الأوزان لا يساوي 100%'])
          }
          detailData.push([])
          detailData.push(['- الحالة: "محقق" تعني أن عدد الشواهد المقبولة >= الحد الأدنى المطلوب'])
          detailData.push(['- الحالة: "غير محقق" تعني أن عدد الشواهد المقبولة < الحد الأدنى المطلوب'])
          const unachievedKPIs = teacher.kpis.filter(k => !k.isAchieved && k.minRequired !== null)
          if (unachievedKPIs.length > 0) {
            detailData.push([])
            detailData.push(['⚠️ المعايير غير المحققة:'])
            unachievedKPIs.forEach(kpi => {
              detailData.push([`- ${kpi.kpiName}: ${kpi.acceptedCount} شاهد مقبول من ${kpi.minRequired} مطلوب`])
            })
          }
        } else {
          detailData.push(['لا توجد معايير متاحة'])
        }
        
        // إنشاء ورقة التفاصيل
        const wsDetail = XLSX.utils.aoa_to_sheet(detailData)
        
        // تنسيق عرض الأعمدة
        wsDetail['!cols'] = [
          { wch: 5 },   // #
          { wch: 35 },  // اسم المعيار
          { wch: 12 },  // الوزن
          { wch: 14 },  // الدرجة
          { wch: 14 },  // النسبة
          { wch: 16 },  // الدرجة الموزونة
          { wch: 18 },  // الشواهد المقبولة
          { wch: 14 },  // الحد الأدنى
          { wch: 16 },  // الحالة
          { wch: 18 },  // التقييم
        ]
        
        // تنسيق ورقة التفاصيل
        const detailTitleStyle = {
          font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4472C4' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        }
        
        const detailHeaderStyle = {
          font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '70AD47' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          }
        }
        
        const detailInfoStyle = {
          font: { bold: true, sz: 10 },
          fill: { fgColor: { rgb: 'E7E6E6' } },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
          }
        }
        
        // تطبيق التنسيق على العنوان الرئيسي
        if (wsDetail['A1']) {
          wsDetail['A1'].s = detailTitleStyle
          if (!wsDetail['!merges']) wsDetail['!merges'] = []
          wsDetail['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } })
        }
        
        // حساب عدد صفوف معلومات المعلم
        let infoRows = 6 // معلومات المعلم الأساسية
        if (teacher.kpis && teacher.kpis.length > 0) {
          infoRows += 8 // إحصائيات سريعة
        }
        
        // تطبيق التنسيق على "معلومات المعلم"
        if (wsDetail['A3']) {
          wsDetail['A3'].s = sectionTitleStyle
          if (!wsDetail['!merges']) wsDetail['!merges'] = []
          wsDetail['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 1 } })
        }
        
        // تطبيق التنسيق على معلومات المعلم
        for (let row = 3; row < infoRows - (teacher.kpis && teacher.kpis.length > 0 ? 8 : 0); row++) {
          const cellRefA = XLSX.utils.encode_cell({ r: row, c: 0 })
          const cellRefB = XLSX.utils.encode_cell({ r: row, c: 1 })
          if (wsDetail[cellRefA]) wsDetail[cellRefA].s = infoLabelStyle
          if (wsDetail[cellRefB]) wsDetail[cellRefB].s = infoValueStyle
        }
        
        // تطبيق التنسيق على "إحصائيات سريعة" إذا كانت موجودة
        if (teacher.kpis && teacher.kpis.length > 0) {
          const statsTitleRow = infoRows - 8
          if (wsDetail[XLSX.utils.encode_cell({ r: statsTitleRow, c: 0 })]) {
            wsDetail[XLSX.utils.encode_cell({ r: statsTitleRow, c: 0 })].s = sectionTitleStyle
            if (!wsDetail['!merges']) wsDetail['!merges'] = []
            wsDetail['!merges'].push({ s: { r: statsTitleRow, c: 0 }, e: { r: statsTitleRow, c: 1 } })
          }
          
          for (let row = statsTitleRow + 1; row < infoRows; row++) {
            const cellRefA = XLSX.utils.encode_cell({ r: row, c: 0 })
            const cellRefB = XLSX.utils.encode_cell({ r: row, c: 1 })
            if (wsDetail[cellRefA]) wsDetail[cellRefA].s = infoLabelStyle
            if (wsDetail[cellRefB]) wsDetail[cellRefB].s = infoValueStyle
          }
        }
        
        // تطبيق التنسيق على عنوان "تفاصيل المعايير"
        const kpiTitleRow = infoRows
        const kpiTitleCell = XLSX.utils.encode_cell({ r: kpiTitleRow, c: 0 })
        if (wsDetail[kpiTitleCell]) {
          wsDetail[kpiTitleCell].s = detailTitleStyle
          if (!wsDetail['!merges']) wsDetail['!merges'] = []
          wsDetail['!merges'].push({ s: { r: kpiTitleRow, c: 0 }, e: { r: kpiTitleRow, c: 9 } })
        }
        
        // تطبيق التنسيق على رأس جدول KPIs
        const kpiHeaderRow = kpiTitleRow + 1
        for (let col = 0; col < 10; col++) {
          const cellRef = XLSX.utils.encode_cell({ r: kpiHeaderRow, c: col })
          if (!wsDetail[cellRef]) continue
          wsDetail[cellRef].s = detailHeaderStyle
        }
        
        // تطبيق التنسيق على بيانات KPIs
        if (teacher.kpis && teacher.kpis.length > 0) {
          teacher.kpis.forEach((kpi, kpiIndex) => {
            const row = kpiHeaderRow + 1 + kpiIndex
            const kpiPercentage = (kpi.score / 5) * 100
            
            let evaluationColor = 'FFC7CE' // أحمر (يحتاج تحسين)
            let evaluationTextColor = '9C0006'
            if (kpiPercentage >= 80) {
              evaluationColor = 'C6EFCE' // أخضر
              evaluationTextColor = '006100'
            } else if (kpiPercentage >= 60) {
              evaluationColor = 'FFEB9C' // أصفر
              evaluationTextColor = '9C6500'
            }
            
            const statusColor = kpi.isAchieved ? 'C6EFCE' : 'FFC7CE' // أخضر للمحقق، أحمر لغير المحقق
            const statusTextColor = kpi.isAchieved ? '006100' : '9C0006'
            
            const rowStyle = {
              font: { sz: 10 },
              fill: { fgColor: { rgb: kpiIndex % 2 === 0 ? 'FFFFFF' : 'F2F2F2' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
              }
            }
            
            const evaluationStyle = {
              ...rowStyle,
              fill: { fgColor: { rgb: evaluationColor } },
              font: { bold: true, sz: 10, color: { rgb: evaluationTextColor } }
            }
            
            const statusStyle = {
              ...rowStyle,
              fill: { fgColor: { rgb: statusColor } },
              font: { bold: true, sz: 10, color: { rgb: statusTextColor } }
            }
            
            for (let col = 0; col < 10; col++) {
              const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
              if (!wsDetail[cellRef]) continue
              if (col === 8) { // عمود الحالة
                wsDetail[cellRef].s = statusStyle
              } else if (col === 9) { // عمود التقييم
                wsDetail[cellRef].s = evaluationStyle
              } else {
                wsDetail[cellRef].s = rowStyle
              }
            }
          })
          
          // تطبيق التنسيق على صف المجموع
          const totalRow = kpiHeaderRow + 1 + teacher.kpis.length
          for (let col = 0; col < 10; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: totalRow, c: col })
            if (!wsDetail[cellRef]) continue
            wsDetail[cellRef].s = {
              font: { bold: true, sz: 12, name: 'Arial' },
              fill: { fgColor: { rgb: 'D9E1F2' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'medium', color: { rgb: '000000' } },
                bottom: { style: 'medium', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
              }
            }
          }
        }
        
        // إضافة ورقة التفاصيل (اسم المعلم فقط، بدون رموز خاصة)
        const sheetName = `${teacherIndex + 1}_${teacher.name.substring(0, 25)}`.replace(/[\\\/\?\*\[\]]/g, '_')
        XLSX.utils.book_append_sheet(wb, wsDetail, sheetName)
      })

      // ========== تصدير الملف ==========
      const fileName = `أداء_المعلمين_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      toast.success('تم تصدير البيانات بنجاح')
    } catch (error: any) {
      console.error('Error exporting to Excel:', error)
      toast.error('حدث خطأ في تصدير البيانات: ' + error.message)
    }
  }


  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة المدرسة', href: '/school' },
          { label: 'أداء المعلمين' }
        ]} />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">جاري التحميل...</div>
        </div>
      </div>
    )
  }

  const columns = [
    {
      key: 'name',
      label: 'اسم المعلم',
      render: (value: string, row: TeacherScore) => (
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center ml-3">
            <span className="text-blue-600 font-bold">
              {row.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      ),
    },
    {
      key: 'jobType',
      label: 'الصفة الوظيفية',
    },
    {
      key: 'overallScore',
      label: 'الدرجة النهائية',
      render: (value: number, row: TeacherScore) => {
        if (row.error) {
          return <span className="text-sm text-red-600">{row.error}</span>
        }
        const percentage = row.overallPercentage
        const colorClass = percentage >= 80 ? 'text-green-600' : percentage >= 60 ? 'text-yellow-600' : 'text-red-600'
        return (
          <div>
            <div className={`font-semibold ${colorClass}`}>
              {value.toFixed(2)} / 5
            </div>
            <div className="text-xs text-gray-500">{percentage.toFixed(1)}%</div>
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (_: any, row: TeacherScore) => (
        <Link
          href={`/school/teachers/${row.id}/score`}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          عرض التفاصيل →
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة المدرسة', href: '/school' },
        { label: 'أداء المعلمين' }
      ]} />
      {/* العنوان */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 rounded-2xl p-6 sm:p-8 border border-amber-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-amber-900 to-orange-900 bg-clip-text text-transparent">
                  أداء المعلمين
                </h1>
              </div>
            </div>
            {sortedTeachers.length > 0 && (
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-md"
              >
                <Download className="w-5 h-5" />
                تصدير Excel
              </button>
            )}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            عرض ومراجعة درجات جميع المعلمين ({sortedTeachers.length} معلم)
          </p>
        </div>
      </div>
      {/* تنبيهات مجموع الأوزان */}
      {jobTypesWeights.filter(jtw => !jtw.isValid).length > 0 && (
        <div className="space-y-3">
          {jobTypesWeights
            .filter(jtw => !jtw.isValid)
            .map((jobTypeWeight) => (
              <div key={jobTypeWeight.jobTypeId} className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-1">تحذير: مجموع الأوزان غير مكتمل</h3>
                  <p className="text-red-700 text-sm">
                    مجموع الأوزان للمعايير النشطة لصفة <span className="font-bold">{jobTypeWeight.jobTypeName}</span> هو{' '}
                    <span className="font-bold">{jobTypeWeight.totalWeight}%</span> ولا يساوي 100%.{' '}
                    <span className="font-semibold">الدرجات النهائية للمعلمين بهذه الصفة قد تكون غير دقيقة.</span>
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">البحث والتصفية</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">بحث بالاسم</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن معلم..."
                className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ترتيب حسب</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'name')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="score">الدرجة (من الأعلى للأقل)</option>
              <option value="name">الاسم</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">الصفة الوظيفية</label>
            <select
              value={filterJobType}
              onChange={(e) => setFilterJobType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">جميع الصفات</option>
              {jobTypes.map((jt) => (
                <option key={jt} value={jt}>
                  {jt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      {sortedTeachers.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-blue-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">متوسط الدرجة</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {(
                      sortedTeachers.reduce((sum, t) => sum + t.overallScore, 0) /
                      sortedTeachers.length
                    ).toFixed(2)}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-green-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">أعلى درجة</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">
                    {Math.max(...sortedTeachers.map((t) => t.overallScore)).toFixed(2)}
                  </p>
                </div>
                <Award className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 border-r-4 border-orange-600">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">أقل درجة</p>
                  <p className="text-2xl font-bold text-orange-600 mt-1">
                    {Math.min(...sortedTeachers.map((t) => t.overallScore)).toFixed(2)}
                  </p>
                </div>
                <TrendingDown className="w-12 h-12 text-orange-600" />
              </div>
            </div>
          </div>

        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Divider Section */}
      {sortedTeachers.length > 0 && (
        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-4 rounded-full shadow-lg border-2 border-blue-200 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-gray-800 leading-tight">أداء المعلمين</h2>
                  <span className="text-xs text-gray-600 font-medium">{sortedTeachers.length} معلم</span>
                </div>
                <div className="w-px h-8 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-semibold text-gray-700">التقييمات</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teachers Cards Grid */}
      {sortedTeachers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">لا توجد بيانات متاحة</p>
          {searchQuery || filterJobType || filterScore ? (
            <p className="text-gray-500 text-sm mt-2">جرب تغيير معايير البحث</p>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTeachers.map((teacher, index) => {
            const percentage = teacher.overallPercentage
            const getPerformanceColor = () => {
              if (percentage >= 80) return { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800' }
              if (percentage >= 60) return { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' }
              return { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800' }
            }
            const colors = getPerformanceColor()
            const performanceLabel = percentage >= 80 ? 'ممتاز' : percentage >= 60 ? 'جيد' : 'يحتاج تحسين'
            const kpiCount = teacher.kpis ? teacher.kpis.length : 0
            const achievedKPIs = teacher.kpis ? teacher.kpis.filter(k => k.isAchieved).length : 0

            return (
              <Link
                key={teacher.id}
                href={`/school/teachers/${teacher.id}/score`}
                className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border-r-4 ${colors.border} overflow-hidden group`}
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-14 h-14 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-2xl font-bold ${colors.text}`}>
                          {teacher.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {teacher.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{teacher.jobType}</p>
                      </div>
                    </div>
                    {index < 3 && (
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${colors.badge} flex-shrink-0`}>
                        #{index + 1}
                      </div>
                    )}
                  </div>

                  {/* Score Display */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-sm text-gray-600">الدرجة النهائية</span>
                      <span className={`text-2xl font-bold ${colors.text}`}>
                        {teacher.overallScore.toFixed(2)} / 5
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${colors.bg.replace('50', '500')}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{percentage.toFixed(1)}%</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${colors.badge}`}>
                        {performanceLabel}
                      </span>
                    </div>
                  </div>

                  {/* KPIs Summary */}
                  {teacher.kpis && teacher.kpis.length > 0 && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-gray-600">المعايير المحققة:</span>
                          <span className="font-semibold text-green-600">{achievedKPIs}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-600" />
                          <span className="text-gray-600">إجمالي المعايير:</span>
                          <span className="font-semibold text-blue-600">{kpiCount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* View Details Button */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-2 text-blue-600 group-hover:text-blue-700 font-medium text-sm">
                      <Eye className="w-4 h-4" />
                      <span>عرض التفاصيل الكاملة</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}


