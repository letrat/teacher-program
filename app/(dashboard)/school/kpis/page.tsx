'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FileText, Plus, Edit, Trash2, Award, Building2, Settings, Search, X, Check, Save, Power, PowerOff, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { SkeletonCard, SkeletonList } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import api from '@/lib/api'

interface JobType {
  id: string
  name: string
}

interface EvidenceItem {
  id: string
  name: string
  isOfficial: boolean
}

interface KPI {
  id: string
  name: string
  weight: number
  isOfficial: boolean
  minAcceptedEvidence?: number | null // الحد الأدنى لعدد الشواهد المقبولة المطلوبة
  jobType: {
    id: string
    name: string
  }
  evidenceItems: EvidenceItem[]
  isActive?: boolean // حالة التفعيل/التعطيل
}

export default function KPIsPage() {
  const [officialKPIs, setOfficialKPIs] = useState<KPI[]>([])
  const [schoolKPIs, setSchoolKPIs] = useState<KPI[]>([])
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [selectedJobType, setSelectedJobType] = useState<string>('') // الصفة المختارة
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddKPI, setShowAddKPI] = useState(false)
  const [editingKPI, setEditingKPI] = useState<KPI | null>(null)
  const [addingEvidence, setAddingEvidence] = useState<{ kpiId: string; kpiName: string } | null>(null)
  const [editingEvidence, setEditingEvidence] = useState<{ kpiId: string; evidenceId: string; name: string } | null>(null)
  const [editingWeight, setEditingWeight] = useState<{ kpiId: string; weight: number } | null>(null)
  const [newEvidenceName, setNewEvidenceName] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    weight: 0,
    jobTypeId: '',
    minAcceptedEvidence: null as number | null,
  })
  const [editFormData, setEditFormData] = useState({
    name: '',
    weight: 0,
    minAcceptedEvidence: null as number | null,
  })
  const [weightsInfo, setWeightsInfo] = useState<{
    totalWeight: number
    isValid: boolean
    jobTypeName: string
  } | null>(null)
  const [kpiError, setKpiError] = useState<{ kpiId: string; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedJobType) {
      fetchKPIsForJobType(selectedJobType)
    } else {
      // مسح المعايير عند عدم اختيار صفة
      setOfficialKPIs([])
      setSchoolKPIs([])
    }
  }, [selectedJobType])

  const fetchData = async () => {
    try {
      const jobTypesData = await api.school.jobTypes.list()
      setJobTypes(jobTypesData as JobType[])
    } catch (error) {
      toast.error('حدث خطأ في جلب البيانات')
    } finally {
      setLoading(false)
    }
  }

  const fetchKPIsForJobType = async (jobTypeId: string) => {
    try {
      setLoading(true)
      const [kpisData, weightsData] = await Promise.all([
        api.school.kpis.list(),
        api.school.jobTypes.weights(jobTypeId),
      ])

      // حفظ معلومات الأوزان للتنبيه
      if (weightsData) {
        const jobType = jobTypes.find(jt => jt.id === jobTypeId)
        const weights = weightsData as { totalWeight: number; isValid: boolean }
        setWeightsInfo({
          totalWeight: weights.totalWeight || 0,
          isValid: weights.isValid || false,
          jobTypeName: jobType?.name || '',
        })
      }

      // إنشاء map للأوزان والحالات
      const weightsMap = new Map<string, { weight: number; isActive: boolean }>()
      const weights = weightsData as { totalWeight: number; isValid: boolean; kpis?: Array<{ kpiId: string; weight: number; isActive: boolean }> }
      if (weights.kpis) {
        weights.kpis.forEach((kpi: any) => {
          weightsMap.set(kpi.kpiId, { weight: kpi.weight, isActive: kpi.isActive })
        })
      }

      // تصفية المعايير حسب الصفة المختارة
      const kpis = kpisData as { official?: KPI[]; school?: KPI[] }
      const filteredOfficial = (kpis.official || []).filter((kpi: KPI) => kpi.jobType.id === jobTypeId)
      const filteredSchool = (kpis.school || []).filter((kpi: KPI) => kpi.jobType.id === jobTypeId)

      // إضافة معلومات الوزن والحالة
      const officialWithStatus = filteredOfficial.map((kpi: KPI) => {
        const weightInfo = weightsMap.get(kpi.id)
        return {
          ...kpi,
          weight: weightInfo?.weight ?? kpi.weight,
          isActive: weightInfo?.isActive ?? true,
        }
      })

      const schoolWithStatus = filteredSchool.map((kpi: KPI) => {
        const weightInfo = weightsMap.get(kpi.id)
        return {
          ...kpi,
          weight: weightInfo?.weight ?? kpi.weight,
          isActive: weightInfo?.isActive ?? true,
        }
      })

      setOfficialKPIs(officialWithStatus)
      setSchoolKPIs(schoolWithStatus)
    } catch (error) {
      toast.error('حدث خطأ في جلب المعايير')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitKPI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    
    if (!selectedJobType) {
      toast.error('يرجى اختيار الصفة الوظيفية أولاً')
      return
    }
    
    setSubmitting(true)
    try {
      await api.school.kpis.create({ ...formData, jobTypeId: selectedJobType })
      toast.success('تم إضافة المعيار بنجاح')
      setShowAddKPI(false)
      setFormData({ name: '', weight: 0, jobTypeId: selectedJobType, minAcceptedEvidence: null })
      fetchKPIsForJobType(selectedJobType)
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في إضافة المعيار')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleUpdateKPI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    
    if (!editingKPI || !selectedJobType) {
      return
    }
    
    submittingRef.current = true
    setSubmitting(true)
    
    // التحقق من صحة البيانات
    if (!editFormData.name || editFormData.name.trim() === '') {
      toast.error('اسم المعيار مطلوب')
      return
    }
    
    if (editFormData.weight < 0 || editFormData.weight > 100) {
      toast.error('الوزن يجب أن يكون بين 0 و 100')
      return
    }
    
    if (!editFormData.minAcceptedEvidence || editFormData.minAcceptedEvidence < 1) {
      toast.error('الحد الأدنى لعدد الشواهد يجب أن يكون 1 أو أكثر')
      return
    }
    
    // التحقق من أن الوزن بعد التعديل لا يتجاوز 100%
    try {
      // جلب جميع الأوزان الحالية
      const weightsData = await api.school.jobTypes.weights(selectedJobType)
      const weights = weightsData as { totalWeight?: number; isValid?: boolean; kpis?: Array<{ kpiId: string; weight: number; isActive: boolean }> } | Array<any>
      let currentWeights: any[] = []
      
      if (weights && typeof weights === 'object' && 'kpis' in weights && Array.isArray(weights.kpis)) {
        currentWeights = weights.kpis
      } else if (Array.isArray(weights)) {
        currentWeights = weights
      }
      
      // إذا كانت المصفوفة فارغة، إنشاء مصفوفة من جميع المعايير المتاحة
      if (currentWeights.length === 0) {
        const allKPIs = [...officialKPIs, ...schoolKPIs]
        currentWeights = allKPIs.map((kpi) => ({
          kpiId: kpi.id,
          name: kpi.name,
          weight: kpi.weight || 0,
          isActive: kpi.isActive !== false,
        }))
      }
      
      // تحديث الوزن للمعيار الذي يتم تعديله
      const updatedWeights = currentWeights.map((kpi: any) => 
        kpi.kpiId === editingKPI.id 
          ? { ...kpi, weight: editFormData.weight }
          : kpi
      )
      
      // حساب مجموع الأوزان للمعايير النشطة بعد التعديل
      const activeWeights = updatedWeights.filter((w: any) => w.isActive !== false)
      const totalWeight = activeWeights.reduce((sum: number, w: any) => sum + (w.weight || 0), 0)
      
      // التحقق من أن المجموع لا يتجاوز 100%
      if (totalWeight > 100.01) {
        setKpiError({
          kpiId: editingKPI.id,
          message: `⚠️ لا يمكن التعديل! مجموع الأوزان بعد التعديل سيتجاوز 100% (${totalWeight.toFixed(2)}%) يرجى تقليل الوزن أو تعطيل معايير أخرى`
        })
        return
      }
      
      // مسح رسالة الخطأ إذا كانت موجودة
      setKpiError(null)
      
      // تحذير إذا كان المجموع لا يساوي 100% (لكن أقل من 100%)
      if (Math.abs(totalWeight - 100) > 0.01 && totalWeight < 100) {
        const confirmMessage = `مجموع أوزان المعايير النشطة بعد التعديل سيكون ${totalWeight.toFixed(2)}% وليس 100%. هل تريد المتابعة؟`
        if (!confirm(confirmMessage)) {
          return
        }
      }
    } catch (error) {
      console.error('Error checking weights:', error)
      // في حالة الخطأ، نتابع التعديل لكن نسجل الخطأ
    }
    
    try {
      console.log('🔄 Updating KPI:', {
        kpiId: editingKPI.id,
        isOfficial: editingKPI.isOfficial,
        data: editFormData
      })
      
      const result: any = await api.school.kpis.update(editingKPI.id, {
        name: editFormData.name.trim(),
        weight: editFormData.weight,
        minAcceptedEvidence: editFormData.minAcceptedEvidence,
      })
      
      console.log('✅ Update result:', result)
      
      const wasOfficial = editingKPI.isOfficial
      const originalKPIId = editingKPI.id
      
      if (wasOfficial && result.message) {
        toast.success(result.message, { duration: 5000 })
      } else {
        toast.success('تم تحديث المعيار بنجاح')
      }
      
      setEditingKPI(null)
      setEditFormData({ name: '', weight: 0, minAcceptedEvidence: null })
      setKpiError(null)
      
      // إعادة جلب البيانات بعد التحديث
      await fetchKPIsForJobType(selectedJobType)
      
      // تعطيل المعيار الرسمي تلقائياً بعد إنشاء النسخة الخاصة
      if (wasOfficial) {
        // انتظر قليلاً حتى يتم تحديث البيانات في الـ state
        setTimeout(async () => {
          try {
            // جلب البيانات المحدثة من الـ API
            const [kpisData, weightsData] = await Promise.all([
              api.school.kpis.list(),
              api.school.jobTypes.weights(selectedJobType),
            ])
            
            // البحث عن المعيار الرسمي في البيانات المحدثة
            const kpis = kpisData as { official?: KPI[]; school?: KPI[] }
            const filteredOfficial = (kpis.official || []).filter((kpi: KPI) => kpi.jobType.id === selectedJobType)
            const officialKPI = filteredOfficial.find((k: KPI) => k.id === originalKPIId)
            
            if (officialKPI) {
              // إنشاء map للأوزان والحالات
              const weightsMap = new Map<string, { weight: number; isActive: boolean }>()
              const weights = weightsData as { totalWeight?: number; isValid?: boolean; kpis?: Array<{ kpiId: string; weight: number; isActive: boolean }> }
              if (weights.kpis) {
                weights.kpis.forEach((kpi: any) => {
                  weightsMap.set(kpi.kpiId, { weight: kpi.weight, isActive: kpi.isActive })
                })
              }
              
              const weightInfo = weightsMap.get(originalKPIId)
              const isCurrentlyActive = weightInfo?.isActive ?? true
              
              // إذا كان المعيار لا يزال نشطاً، قم بتعطيله
              if (isCurrentlyActive) {
                console.log('🔄 Auto-disabling official KPI:', originalKPIId)
                await handleToggleActive(originalKPIId, true)
              }
            }
          } catch (error) {
            console.error('❌ Error auto-disabling official KPI:', error)
          }
        }, 1500)
      }
    } catch (error: any) {
      console.error('❌ Error updating KPI:', error)
      toast.error(error.message || 'حدث خطأ في تحديث المعيار')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleEditKPI = (kpi: KPI) => {
    setEditingKPI(kpi)
    setEditFormData({
      name: kpi.name,
      weight: kpi.weight,
      minAcceptedEvidence: kpi.minAcceptedEvidence ?? null,
    })
    setShowAddKPI(false)
    setKpiError(null)
  }

  const handleCancelEditKPI = () => {
    setEditingKPI(null)
    setEditFormData({ name: '', weight: 0, minAcceptedEvidence: null })
    setKpiError(null)
  }

  const handleToggleActive = async (kpiId: string, currentState: boolean) => {
    if (!selectedJobType || submittingRef.current) return
    
    submittingRef.current = true
    setSubmitting(true)
    try {
      // جلب جميع الأوزان الحالية من الـ API لضمان البيانات الصحيحة
      const weightsData = await api.school.jobTypes.weights(selectedJobType)
      const weights = weightsData as { totalWeight?: number; isValid?: boolean; kpis?: Array<{ kpiId: string; weight: number; isActive: boolean }> } | Array<any>
      
      console.log('🔍 Debug - weightsData:', weights)
      console.log('🔍 Debug - weightsData type:', typeof weights)
      console.log('🔍 Debug - weightsData.kpis:', typeof weights === 'object' && 'kpis' in weights ? weights.kpis : undefined)
      console.log('🔍 Debug - weightsData.kpis type:', typeof (typeof weights === 'object' && 'kpis' in weights ? weights.kpis : undefined))
      console.log('🔍 Debug - weightsData.kpis isArray:', Array.isArray(typeof weights === 'object' && 'kpis' in weights ? weights.kpis : undefined))
      
      let currentWeights: any[] = []
      
      if (weights && typeof weights === 'object' && 'kpis' in weights && Array.isArray(weights.kpis)) {
        currentWeights = weights.kpis
      } else if (Array.isArray(weights)) {
        // في حالة أن الـ API يرجع المصفوفة مباشرة
        currentWeights = weights
      }
      
      console.log('🔍 Debug - currentWeights (after parsing):', currentWeights)
      console.log('🔍 Debug - currentWeights length:', currentWeights.length)
      console.log('🔍 Debug - officialKPIs:', officialKPIs)
      console.log('🔍 Debug - schoolKPIs:', schoolKPIs)
      
      // إذا كانت المصفوفة فارغة، إنشاء مصفوفة من جميع المعايير المتاحة
      if (currentWeights.length === 0) {
        const allKPIs = [...officialKPIs, ...schoolKPIs]
        console.log('🔍 Debug - allKPIs:', allKPIs)
        if (allKPIs.length === 0) {
          toast.error('لا توجد معايير متاحة. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
          return
        }
        currentWeights = allKPIs.map((kpi) => ({
          kpiId: kpi.id,
          name: kpi.name,
          weight: kpi.weight || 0,
          isActive: kpi.isActive !== false,
        }))
        console.log('🔍 Debug - currentWeights (created from KPIs):', currentWeights)
      }
      
      // التأكد من أن المصفوفة ليست فارغة
      if (!Array.isArray(currentWeights) || currentWeights.length === 0) {
        toast.error('لا توجد معايير متاحة. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      // التأكد من أن جميع العناصر تحتوي على kpiId
      const validWeights = currentWeights.filter((w: any) => w && w.kpiId)
      if (validWeights.length === 0) {
        toast.error('خطأ في بيانات المعايير. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      // تحديث حالة المعيار المطلوب
      const updatedWeights = validWeights.map((kpi: any) => 
        kpi.kpiId === kpiId 
          ? { ...kpi, isActive: !currentState }
          : kpi
      )
      
      console.log('🔍 Debug - updatedWeights:', updatedWeights)
      console.log('🔍 Debug - updatedWeights is array:', Array.isArray(updatedWeights))
      console.log('🔍 Debug - updatedWeights length:', updatedWeights.length)
      
      // التحقق من أن المصفوفة المحدثة ليست فارغة
      if (!Array.isArray(updatedWeights) || updatedWeights.length === 0) {
        toast.error('خطأ في تحديث حالة المعيار. يرجى المحاولة مرة أخرى.')
        return
      }
      
      // التحقق من مجموع الأوزان للمعايير النشطة
      const activeWeights = updatedWeights.filter((w: any) => w.isActive !== false)
      const totalWeight = activeWeights.reduce((sum: number, w: any) => sum + (w.weight || 0), 0)
      
      console.log('📊 Frontend - حساب المجموع قبل التعطيل/التفعيل:', {
        totalKPIs: currentWeights.length,
        activeKPIs: activeWeights.length,
        totalWeight: totalWeight.toFixed(2),
        kpiId,
        currentState,
        newState: !currentState,
        activeWeightsDetails: activeWeights.map((w: any) => ({
          kpiId: w.kpiId,
          name: w.name,
          weight: w.weight,
          isActive: w.isActive
        }))
      })
      
      // إذا كان يحاول تفعيل معيار (currentState = false يعني أنه معطل حالياً)
      if (!currentState) {
        // التحقق من أن تفعيل المعيار لن يتجاوز 100%
        if (totalWeight > 100.01) {
          toast.error(`لا يمكن تفعيل المعيار. مجموع الأوزان سيتجاوز 100% (${totalWeight.toFixed(2)}%)`)
          return
        }
        
        // تحذير إذا كان المجموع لا يساوي 100% (لكن أقل من 100%)
        if (Math.abs(totalWeight - 100) > 0.01) {
          const confirmMessage = `مجموع أوزان المعايير النشطة سيكون ${totalWeight.toFixed(2)}% وليس 100%. هل تريد المتابعة؟`
          if (!confirm(confirmMessage)) {
            return
          }
        }
      }
      // إذا كان يحاول تعطيل معيار (currentState = true يعني أنه نشط حالياً)
      // السماح بالتعطيل دائماً بدون أي تحقق
      
      // التأكد من أن جميع العناصر في المصفوفة صحيحة
      const finalWeights = updatedWeights.map((w: any) => {
        if (!w.kpiId) {
          console.error('❌ Invalid weight item (missing kpiId):', w)
          return null
        }
        return {
          kpiId: w.kpiId,
          name: w.name || '',
          weight: typeof w.weight === 'number' ? w.weight : 0,
          isActive: w.isActive !== false,
        }
      }).filter((w: any) => w !== null)
      
      if (finalWeights.length === 0) {
        toast.error('خطأ في بيانات المعايير. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      // حفظ التغييرات - التأكد من إرسال مصفوفة صحيحة
      if (!Array.isArray(finalWeights) || finalWeights.length === 0) {
        console.error('❌ ERROR: finalWeights is not a valid array:', finalWeights)
        toast.error('خطأ في بيانات المعايير. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      // التحقق من أن جميع العناصر صحيحة
      const invalidItems = finalWeights.filter((w: any) => !w || !w.kpiId || typeof w.weight !== 'number')
      if (invalidItems.length > 0) {
        console.error('❌ ERROR: Invalid items in finalWeights:', invalidItems)
        toast.error('خطأ في بيانات المعايير. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      // التحقق النهائي قبل الإرسال
      if (!finalWeights || !Array.isArray(finalWeights) || finalWeights.length === 0) {
        console.error('❌ CRITICAL ERROR: finalWeights is invalid before sending:', {
          finalWeights,
          type: typeof finalWeights,
          isArray: Array.isArray(finalWeights),
          length: finalWeights?.length,
        })
        toast.error('خطأ في بيانات المعايير. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      // التحقق من أن جميع العناصر صحيحة
      const hasInvalidItems = finalWeights.some((w: any) => {
        const invalid = !w || !w.kpiId || typeof w.weight !== 'number'
        if (invalid) {
          console.error('❌ Invalid item found:', w)
        }
        return invalid
      })
      
      if (hasInvalidItems) {
        console.error('❌ CRITICAL ERROR: finalWeights contains invalid items')
        toast.error('خطأ في بيانات المعايير. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        return
      }
      
      console.log('🚀 Sending to API:', {
        jobTypeId: selectedJobType,
        weights: finalWeights,
        weightsIsArray: Array.isArray(finalWeights),
        weightsLength: finalWeights.length,
        firstItem: finalWeights[0],
        allItemsValid: finalWeights.every((w: any) => w && w.kpiId && typeof w.weight === 'number'),
        stringified: JSON.stringify({ weights: finalWeights })
      })
      
      // إرسال البيانات
      try {
        await api.school.jobTypes.updateWeights(selectedJobType, finalWeights)
      } catch (apiError: any) {
        console.error('❌ API Error details:', {
          error: apiError,
          message: apiError?.message,
          jobTypeId: selectedJobType,
          weightsLength: finalWeights.length,
          weightsSample: finalWeights.slice(0, 2),
        })
        throw apiError
      }
      toast.success(currentState ? 'تم تعطيل المعيار' : 'تم تفعيل المعيار')
      
      // إعادة جلب البيانات بعد التحديث
      await fetchKPIsForJobType(selectedJobType)
      
      console.log('✅ تم تحديث البيانات بعد تعطيل/تفعيل المعيار')
    } catch (error: any) {
      console.error('❌ خطأ في تعطيل/تفعيل المعيار:', error)
      // إذا كان الخطأ متعلق بمجموع الأوزان، عرض رسالة واضحة
      if (error.message && error.message.includes('100%')) {
        toast.error(error.message, { duration: 5000 })
      } else {
        toast.error(error.message || 'حدث خطأ في تحديث حالة المعيار')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleUpdateWeight = async (kpiId: string, newWeight: number) => {
    if (!selectedJobType) return
    
    try {
      // جلب جميع الأوزان الحالية من الـ API لضمان البيانات الصحيحة
      const weightsData = await api.school.jobTypes.weights(selectedJobType)
      const weights = weightsData as { totalWeight?: number; isValid?: boolean; kpis?: Array<{ kpiId: string; weight: number; isActive: boolean }> }
      let currentWeights = weights.kpis || []
      
      // إذا كانت المصفوفة فارغة، إنشاء مصفوفة من جميع المعايير المتاحة
      if (currentWeights.length === 0) {
        const allKPIs = [...officialKPIs, ...schoolKPIs]
        currentWeights = allKPIs.map((kpi) => ({
          kpiId: kpi.id,
          name: kpi.name,
          weight: kpi.weight || 0,
          isActive: kpi.isActive !== false,
        }))
      }
      
      // التأكد من أن المصفوفة ليست فارغة
      if (currentWeights.length === 0) {
        toast.error('لا توجد معايير متاحة. يرجى تحديث الصفحة والمحاولة مرة أخرى.')
        setEditingWeight(null)
        return
      }
      
      // تحديث الوزن للمعيار المطلوب
      const updatedWeights = currentWeights.map((kpi: any) => 
        kpi.kpiId === kpiId 
          ? { ...kpi, weight: newWeight }
          : kpi
      )
      
      // التحقق من أن المصفوفة المحدثة ليست فارغة
      if (updatedWeights.length === 0) {
        toast.error('خطأ في تحديث الوزن. يرجى المحاولة مرة أخرى.')
        setEditingWeight(null)
        return
      }
      
      // التحقق من مجموع الأوزان للمعايير النشطة
      const activeWeights = updatedWeights.filter((w: any) => w.isActive !== false)
      const totalWeight = activeWeights.reduce((sum: number, w: any) => sum + (w.weight || 0), 0)
      
      console.log('📊 Frontend - حساب المجموع بعد تحديث الوزن:', {
        totalKPIs: currentWeights.length,
        activeKPIs: activeWeights.length,
        totalWeight: totalWeight.toFixed(2),
        kpiId,
        newWeight,
        activeWeightsDetails: activeWeights.map((w: any) => ({
          kpiId: w.kpiId,
          name: w.name,
          weight: w.weight,
          isActive: w.isActive
        }))
      })
      
      // إذا كان المجموع يتجاوز 100%
      if (totalWeight > 100.01) {
        toast.error(`لا يمكن تحديث الوزن. مجموع الأوزان سيتجاوز 100% (${totalWeight.toFixed(2)}%)`)
        setEditingWeight(null)
        return
      }
      
      // إذا كان المجموع لا يساوي 100%، عرض تحذير
      if (Math.abs(totalWeight - 100) > 0.01) {
        const confirmMessage = `مجموع أوزان المعايير النشطة سيكون ${totalWeight.toFixed(2)}% وليس 100%. هل تريد المتابعة؟`
        if (!confirm(confirmMessage)) {
          setEditingWeight(null)
          return
        }
      }
      
      // حفظ التغييرات
      await api.school.jobTypes.updateWeights(selectedJobType, updatedWeights)
      toast.success('تم تحديث الوزن بنجاح')
      setEditingWeight(null)
      
      // إعادة جلب البيانات بعد التحديث
      await fetchKPIsForJobType(selectedJobType)
      
      console.log('✅ تم تحديث البيانات بعد تحديث الوزن')
    } catch (error: any) {
      console.error('❌ خطأ في تحديث الوزن:', error)
      // إذا كان الخطأ متعلق بمجموع الأوزان، عرض رسالة واضحة
      if (error.message && error.message.includes('100%')) {
        toast.error(error.message, { duration: 5000 })
      } else {
        toast.error(error.message || 'حدث خطأ في تحديث الوزن')
      }
      setEditingWeight(null)
    }
  }

  const handleAddEvidence = async () => {
    if (!addingEvidence || !newEvidenceName.trim()) {
      toast.error('اسم الشاهد مطلوب')
      return
    }

    try {
      await api.school.kpis.evidence.create(addingEvidence.kpiId, { name: newEvidenceName })
      toast.success('تم إضافة الشاهد بنجاح')
      setAddingEvidence(null)
      setNewEvidenceName('')
      if (selectedJobType) {
        fetchKPIsForJobType(selectedJobType)
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في إضافة الشاهد')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleEditEvidence = async () => {
    if (!editingEvidence || !editingEvidence.name.trim()) {
      toast.error('اسم الشاهد مطلوب')
      return
    }

    if (submittingRef.current) return
    
    submittingRef.current = true
    setSubmitting(true)
    try {
      await api.school.kpis.evidence.update(editingEvidence.kpiId, {
        evidenceId: editingEvidence.evidenceId,
        name: editingEvidence.name,
      })
      toast.success('تم تعديل الشاهد بنجاح')
      setEditingEvidence(null)
      if (selectedJobType) {
        fetchKPIsForJobType(selectedJobType)
      }
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ في تعديل الشاهد')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleDeleteKPI = async (kpiId: string, kpiName: string) => {
    if (!confirm(`هل أنت متأكد من حذف المعيار "${kpiName}"؟ سيتم حذف جميع الشواهد المرتبطة به أيضاً.`)) {
      return
    }

    if (submittingRef.current) return
      
    submittingRef.current = true
    setSubmitting(true)
    try {
      // تحديث فوري للـ state لإزالة المعيار المحذوف قبل الحذف من الـ API
      setOfficialKPIs(prev => prev.filter(kpi => kpi.id !== kpiId))
      setSchoolKPIs(prev => prev.filter(kpi => kpi.id !== kpiId))
      
      // حذف المعيار من الـ API
      await api.school.kpis.delete(kpiId)
      
      toast.success('تم حذف المعيار بنجاح')
      
      // تحديث معلومات الأوزان فقط بدون إعادة جلب جميع البيانات
      if (selectedJobType) {
        try {
          const weightsData = await api.school.jobTypes.weights(selectedJobType)
          const weights = weightsData as { totalWeight?: number; isValid?: boolean; kpis?: Array<{ kpiId: string; weight: number; isActive: boolean }> }
          if (weights) {
            const jobType = jobTypes.find(jt => jt.id === selectedJobType)
            setWeightsInfo({
              totalWeight: weights.totalWeight || 0,
              isValid: weights.isValid || false,
              jobTypeName: jobType?.name || '',
            })
          }
        } catch (error) {
          console.error('Error updating weights info:', error)
        }
      }
    } catch (error: any) {
      // في حالة الخطأ، إعادة جلب البيانات لاستعادة الحالة الصحيحة
      if (selectedJobType) {
        await fetchKPIsForJobType(selectedJobType)
      }
      toast.error(error.message || 'حدث خطأ في حذف المعيار')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleDeleteEvidence = async (kpiId: string, evidenceId: string, evidenceName: string) => {
    if (!confirm(`هل أنت متأكد من حذف الشاهد "${evidenceName}"؟`)) {
      return
    }

    if (submittingRef.current) return
    
    submittingRef.current = true
    setSubmitting(true)
    try {
      // تحديث فوري للـ state لإزالة الشاهد المحذوف قبل الحذف من الـ API
      setOfficialKPIs(prev => prev.map(kpi => 
        kpi.id === kpiId 
          ? { ...kpi, evidenceItems: kpi.evidenceItems.filter(e => e.id !== evidenceId) }
          : kpi
      ))
      setSchoolKPIs(prev => prev.map(kpi => 
        kpi.id === kpiId 
          ? { ...kpi, evidenceItems: kpi.evidenceItems.filter(e => e.id !== evidenceId) }
          : kpi
      ))
      
      // حذف الشاهد من الـ API
      await api.school.kpis.evidence.delete(kpiId, evidenceId)
      
      toast.success('تم حذف الشاهد بنجاح')
      
      // لا حاجة لإعادة جلب البيانات لأننا قمنا بتحديث الـ state يدوياً
    } catch (error: any) {
      // في حالة الخطأ، إعادة جلب البيانات لاستعادة الحالة الصحيحة
      if (selectedJobType) {
        await fetchKPIsForJobType(selectedJobType)
      }
      toast.error(error.message || 'حدث خطأ في حذف الشاهد')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  // Filter KPIs by search query
  const filteredOfficialKPIs = officialKPIs.filter((kpi) => 
    kpi.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredSchoolKPIs = schoolKPIs.filter((kpi) => 
    kpi.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة المدرسة', href: '/school' },
          { label: 'إدارة المعايير' }
        ]} />
        <SkeletonList />
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <Breadcrumbs items={[
        { label: 'لوحة المدرسة', href: '/school' },
        { label: 'إدارة المعايير' }
      ]} />
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 rounded-2xl p-6 sm:p-8 border border-slate-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-zinc-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 bg-clip-text text-transparent">
                  إدارة المعايير
                </h1>
              </div>
            </div>
            {selectedJobType && (
              <button
                onClick={() => setShowAddKPI(!showAddKPI)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base font-medium"
              >
                <Plus className="w-5 h-5" />
                {showAddKPI ? 'إلغاء' : 'إضافة معيار خاص'}
              </button>
            )}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            إدارة المعايير الرسمية والخاصة والشواهد المرتبطة بها
          </p>
        </div>
      </div>

      {/* Job Type Selection */}
      <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-6 sm:p-8 border border-blue-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <label className="block text-base font-bold text-gray-800">
            اختر الصفة الوظيفية <span className="text-red-500">*</span>
          </label>
        </div>
        <select
          value={selectedJobType}
          onChange={(e) => {
            setSelectedJobType(e.target.value)
            setSearchQuery('')
            setShowAddKPI(false)
          }}
          className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 text-lg font-medium bg-white transition-all duration-200 hover:border-blue-300"
        >
          <option value="">-- اختر الصفة الوظيفية --</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>
              {jt.name}
            </option>
          ))}
        </select>
        {selectedJobType && (
          <>
            {/* تنبيه مجموع الأوزان */}
            {weightsInfo && !weightsInfo.isValid && (
              <div className="mt-4 bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-red-800 mb-1">تحذير: مجموع الأوزان غير مكتمل</h3>
                  <p className="text-red-700 text-sm">
                    مجموع الأوزان للمعايير النشطة لصفة <span className="font-bold">{weightsInfo.jobTypeName}</span> هو{' '}
                    <span className="font-bold">{weightsInfo.totalWeight}%</span> ولا يساوي 100%.{' '}
                    <span className="font-semibold">الدرجات النهائية للمعلمين بهذه الصفة قد تكون غير دقيقة.</span>
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-sm text-gray-700">
                تم اختيار: <span className="font-bold text-blue-700">
                  {jobTypes.find(jt => jt.id === selectedJobType)?.name}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Add KPI Form (Inline) */}
      {showAddKPI && selectedJobType && (
        <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-xl p-6 sm:p-8 border-2 border-green-200 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <Plus className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">إضافة معيار خاص</h3>
          </div>
          <form onSubmit={handleSubmitKPI} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  اسم المعيار
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all duration-200 bg-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="أدخل اسم المعيار"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الوزن (0-100%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all duration-200 bg-white"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الحد الأدنى لعدد الشواهد المقبولة <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all duration-200 bg-white"
                  value={formData.minAcceptedEvidence || ''}
                  onChange={(e) => setFormData({ ...formData, minAcceptedEvidence: e.target.value ? Number(e.target.value) : null })}
                  placeholder="مثال: 3"
                />
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                  عدد الشواهد المقبولة المطلوبة لتحقيق المعيار
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setShowAddKPI(false)
                  setFormData({ name: '', weight: 0, jobTypeId: selectedJobType, minAcceptedEvidence: null })
                }}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
              >
                إضافة المعيار
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Search and Total Weight Summary */}
      {selectedJobType && (
        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث في المعايير..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-12 pl-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all duration-200 bg-gray-50 hover:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {(() => {
              const allKPIs = [...officialKPIs, ...schoolKPIs]
              const activeKPIs = allKPIs.filter(k => k.isActive !== false)
              const total = activeKPIs.reduce((sum, k) => sum + (k.weight || 0), 0)
              const isBalanced = Math.abs(total - 100) < 0.01
              const isOver = total > 100
              return (
                <div className={`bg-gradient-to-r rounded-xl p-4 border-2 flex items-center justify-between transition-all duration-200 ${
                  isBalanced 
                    ? 'from-green-50 to-emerald-50 border-green-200' 
                    : isOver 
                    ? 'from-red-50 to-rose-50 border-red-200'
                    : 'from-orange-50 to-amber-50 border-orange-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      isBalanced ? 'bg-green-100' : isOver ? 'bg-red-100' : 'bg-orange-100'
                    }`}>
                      <Settings className={`w-5 h-5 ${
                        isBalanced ? 'text-green-600' : isOver ? 'text-red-600' : 'text-orange-600'
                      }`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">مجموع الأوزان (نشطة):</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-bold ${
                      isBalanced ? 'text-green-600' : isOver ? 'text-red-600' : 'text-orange-600'
                    }`}>
                      {total.toFixed(2)}%
                    </span>
                    <div className={`text-xs font-medium mt-1 ${
                      isBalanced ? 'text-green-700' : isOver ? 'text-red-700' : 'text-orange-700'
                    }`}>
                      {isBalanced ? '✓ متوازن' : isOver ? '⚠️ يتجاوز 100%' : '⚠️ أقل من 100%'}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {!selectedJobType ? (
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl shadow-xl p-16 text-center border border-gray-200">
          <div className="p-4 bg-blue-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Settings className="w-10 h-10 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">اختر الصفة الوظيفية</h3>
          <p className="text-gray-600 text-base">يرجى اختيار الصفة الوظيفية من القائمة أعلاه لعرض المعايير</p>
        </div>
      ) : (
        <>
          {/* Container للمعايير الرسمية والخاصة جنب بعض */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* المعايير الرسمية */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-blue-100">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  المعايير الرسمية
                  <span className="mr-2 text-base font-normal text-gray-500">({filteredOfficialKPIs.length})</span>
                </h2>
              </div>
              {filteredOfficialKPIs.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="لا توجد معايير رسمية"
                  description={searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد معايير رسمية متاحة لهذه الصفة'}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredOfficialKPIs.map((kpi) => (
                  <KPICard
                    key={kpi.id}
                    kpi={kpi}
                    isOfficial={true}
                    selectedJobType={selectedJobType}
                    editingKPI={editingKPI}
                    editFormData={editFormData}
                    setEditFormData={setEditFormData}
                    onEditKPI={handleEditKPI}
                    onUpdateKPI={handleUpdateKPI}
                    onCancelEditKPI={handleCancelEditKPI}
                    onAddEvidence={(kpiId, kpiName) => {
                      setAddingEvidence({ kpiId, kpiName })
                      setNewEvidenceName('')
                    }}
                    onDeleteEvidence={handleDeleteEvidence}
                    onToggleActive={handleToggleActive}
                    onUpdateWeight={handleUpdateWeight}
                    editingWeight={editingWeight}
                    setEditingWeight={setEditingWeight}
                    addingEvidence={addingEvidence}
                    editingEvidence={editingEvidence}
                    newEvidenceName={newEvidenceName}
                    setNewEvidenceName={setNewEvidenceName}
                    onAddEvidenceSubmit={handleAddEvidence}
                    onEditEvidence={(kpiId, evidenceId, name) => setEditingEvidence({ kpiId, evidenceId, name })}
                    onEditEvidenceSubmit={handleEditEvidence}
                    onCancelEdit={() => setEditingEvidence(null)}
                    onCancelAdd={() => setAddingEvidence(null)}
                    onRefresh={() => selectedJobType && fetchKPIsForJobType(selectedJobType)}
                    errorMessage={kpiError?.kpiId === kpi.id ? kpiError.message : undefined}
                  />
                  ))}
                </div>
              )}
            </div>

            {/* المعايير الخاصة */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-green-100">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                  المعايير الخاصة بالمدرسة
                  <span className="mr-2 text-base font-normal text-gray-500">({filteredSchoolKPIs.length})</span>
                </h2>
              </div>
              {filteredSchoolKPIs.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title={searchQuery ? "لا توجد نتائج" : "لا توجد معايير خاصة"}
                  description={searchQuery ? 'لا توجد نتائج للبحث' : 'يمكنك إضافة معيار خاص من الزر أعلاه'}
                  action={!searchQuery ? {
                    label: 'إضافة معيار خاص',
                    onClick: () => setShowAddKPI(true),
                    variant: 'primary'
                  } : undefined}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredSchoolKPIs.map((kpi) => (
                  <KPICard
                    key={kpi.id}
                    kpi={kpi}
                    isOfficial={false}
                    selectedJobType={selectedJobType}
                    editingKPI={editingKPI}
                    editFormData={editFormData}
                    setEditFormData={setEditFormData}
                    onEditKPI={handleEditKPI}
                    onUpdateKPI={handleUpdateKPI}
                    onCancelEditKPI={handleCancelEditKPI}
                    onAddEvidence={(kpiId, kpiName) => {
                      setAddingEvidence({ kpiId, kpiName })
                      setNewEvidenceName('')
                    }}
                    onDeleteEvidence={handleDeleteEvidence}
                    onDeleteKPI={() => handleDeleteKPI(kpi.id, kpi.name)}
                    onToggleActive={handleToggleActive}
                    onUpdateWeight={handleUpdateWeight}
                    editingWeight={editingWeight}
                    setEditingWeight={setEditingWeight}
                    addingEvidence={addingEvidence}
                    editingEvidence={editingEvidence}
                    newEvidenceName={newEvidenceName}
                    setNewEvidenceName={setNewEvidenceName}
                    onAddEvidenceSubmit={handleAddEvidence}
                    onEditEvidence={(kpiId, evidenceId, name) => setEditingEvidence({ kpiId, evidenceId, name })}
                    onEditEvidenceSubmit={handleEditEvidence}
                    onCancelEdit={() => setEditingEvidence(null)}
                    onCancelAdd={() => setAddingEvidence(null)}
                    onRefresh={() => selectedJobType && fetchKPIsForJobType(selectedJobType)}
                    errorMessage={kpiError?.kpiId === kpi.id ? kpiError.message : undefined}
                  />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// KPI Card Component
function KPICard({
  kpi,
  isOfficial,
  selectedJobType,
  editingKPI,
  editFormData,
  setEditFormData,
  onEditKPI,
  onUpdateKPI,
  onCancelEditKPI,
  onAddEvidence,
  onDeleteEvidence,
  onDeleteKPI,
  onToggleActive,
  onUpdateWeight,
  editingWeight,
  setEditingWeight,
  addingEvidence,
  editingEvidence,
  newEvidenceName,
  setNewEvidenceName,
  onAddEvidenceSubmit,
  onEditEvidence,
  onEditEvidenceSubmit,
  onCancelEdit,
  onCancelAdd,
  onRefresh,
  errorMessage,
}: {
  kpi: KPI
  isOfficial: boolean
  selectedJobType: string
  editingKPI: KPI | null
  editFormData: { name: string; weight: number; minAcceptedEvidence: number | null }
  setEditFormData: (data: { name: string; weight: number; minAcceptedEvidence: number | null }) => void
  onEditKPI?: (kpi: KPI) => void
  onUpdateKPI?: (e: React.FormEvent) => void
  onCancelEditKPI?: () => void
  onAddEvidence: (kpiId: string, kpiName: string) => void
  onDeleteEvidence: (kpiId: string, evidenceId: string, evidenceName: string) => void
  onDeleteKPI?: () => void
  onToggleActive?: (kpiId: string, currentState: boolean) => void
  onUpdateWeight?: (kpiId: string, newWeight: number) => void
  editingWeight: { kpiId: string; weight: number } | null
  setEditingWeight: (value: { kpiId: string; weight: number } | null) => void
  addingEvidence: { kpiId: string; kpiName: string } | null
  editingEvidence: { kpiId: string; evidenceId: string; name: string } | null
  newEvidenceName: string
  setNewEvidenceName: (name: string) => void
  onAddEvidenceSubmit: () => void
  onEditEvidence: (kpiId: string, evidenceId: string, name: string) => void
  onEditEvidenceSubmit: () => void
  onCancelEdit: () => void
  onCancelAdd: () => void
  onRefresh?: () => void
  errorMessage?: string | null | undefined
}) {
  const [expanded, setExpanded] = useState(false)
  const officialEvidences = kpi.evidenceItems.filter(e => e.isOfficial)
  const schoolEvidences = kpi.evidenceItems.filter(e => !e.isOfficial)
  const isAdding = addingEvidence?.kpiId === kpi.id
  const isEditing = (evidenceId: string) => editingEvidence?.evidenceId === evidenceId && editingEvidence?.kpiId === kpi.id
  const isEditingThisWeight = editingWeight?.kpiId === kpi.id
  const isActive = kpi.isActive !== false
  const isEditingThisKPI = editingKPI?.id === kpi.id

  return (
    <div className={`bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border-2 ${
      isActive 
        ? 'border-gray-200 hover:border-blue-300' 
        : 'border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100'
    }`}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditingThisKPI ? (
              <form onSubmit={onUpdateKPI} className="space-y-4">
                {isOfficial && (
                  <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      سيتم إنشاء نسخة خاصة من المعيار وتعطيل المعيار الرسمي تلقائياً
                    </p>
                  </div>
                )}
                {errorMessage && (
                  <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800 font-bold flex-1">
                      {errorMessage}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      اسم المعيار <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="أدخل اسم المعيار"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      الوزن (0-100%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm"
                      value={editFormData.weight}
                      onChange={(e) => setEditFormData({ ...editFormData, weight: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    الحد الأدنى لعدد الشواهد <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm"
                    value={editFormData.minAcceptedEvidence || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, minAcceptedEvidence: e.target.value ? Number(e.target.value) : null })}
                    placeholder="مثال: 3"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onCancelEditKPI}
                    className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-sm font-medium"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                  >
                    {isOfficial ? 'إنشاء نسخة خاصة' : 'حفظ'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                  <h3 className={`text-lg sm:text-xl font-bold truncate ${
                    isActive ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {kpi.name}
                  </h3>
              <span
                className={`px-3 py-1.5 text-xs font-bold rounded-full flex-shrink-0 shadow-sm ${
                  isOfficial
                    ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300'
                    : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-300'
                }`}
              >
                {isOfficial ? 'رسمي' : 'خاص'}
              </span>
              <span
                className={`px-3 py-1.5 text-xs font-bold rounded-full flex-shrink-0 shadow-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border border-green-300'
                    : 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600 border border-gray-400'
                }`}
              >
                {isActive ? '✓ نشط' : '✗ معطل'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl">
              <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                <Award className="w-4 h-4 text-blue-600" />
                <span className="truncate font-medium">{kpi.jobType.name}</span>
              </span>
              <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                <Settings className="w-4 h-4 text-purple-600" />
                {isEditingThisWeight ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editingWeight.weight}
                      onChange={(e) => {
                        const val = Number(e.target.value)
                        if (val >= 0 && val <= 100) {
                          setEditingWeight({ kpiId: kpi.id, weight: val })
                        }
                      }}
                      className="w-24 px-3 py-1.5 border-2 border-purple-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          onUpdateWeight?.(kpi.id, editingWeight.weight)
                        } else if (e.key === 'Escape') {
                          setEditingWeight(null)
                        }
                      }}
                    />
                    <button
                      onClick={() => onUpdateWeight?.(kpi.id, editingWeight.weight)}
                      className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                      title="حفظ"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingWeight(null)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="إلغاء"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <span 
                    className="cursor-pointer hover:text-purple-600 hover:font-bold transition-all font-semibold"
                    onClick={() => setEditingWeight({ kpiId: kpi.id, weight: kpi.weight })}
                    title="انقر للتعديل"
                  >
                    الوزن: <span className="text-purple-600">{kpi.weight}%</span>
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                <FileText className="w-4 h-4 text-indigo-600" />
                <div className="flex flex-col items-start">
                  <span className="text-xs text-gray-500 leading-tight">الحد الأدنى للشواهد:</span>
                  <span className="font-bold text-indigo-600 leading-tight">{kpi.minAcceptedEvidence ?? 1} شاهد</span>
                  <span className="text-xs text-gray-400 mt-0.5">({kpi.evidenceItems.length} شاهد متاح)</span>
                </div>
              </span>
            </div>
          </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEditKPI && (
              <button
                onClick={() => onEditKPI(kpi)}
                className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:shadow-md"
                title="تعديل المعيار"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                expanded 
                  ? 'bg-blue-100 text-blue-600 shadow-md' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
              }`}
              title={expanded ? 'إخفاء الشواهد' : 'عرض الشواهد'}
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            {onToggleActive && (
              <button
                onClick={() => onToggleActive(kpi.id, isActive)}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-green-600 hover:bg-green-50 hover:shadow-md'
                    : 'text-gray-400 hover:bg-gray-100 hover:shadow-md'
                }`}
                title={isActive ? 'تعطيل المعيار' : 'تفعيل المعيار'}
              >
                {isActive ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
              </button>
            )}
            <button
              onClick={() => {
                if (!expanded) {
                  setExpanded(true)
                }
                // انتظر قليلاً حتى يفتح القسم التفصيلي ثم افتح نموذج الإضافة
                setTimeout(() => {
                  onAddEvidence(kpi.id, kpi.name)
                }, 100)
              }}
              className="p-2.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all duration-200 hover:shadow-md"
              title="إضافة شاهد"
            >
              <Plus className="w-5 h-5" />
            </button>
            {!isOfficial && onDeleteKPI && (
              <button
                onClick={onDeleteKPI}
                className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 hover:shadow-md"
                title="حذف المعيار"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-5 pt-5 border-t-2 border-gray-200 space-y-5">
            {/* Add Evidence Form (Inline) */}
            {isAdding && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="أدخل اسم الشاهد..."
                    value={newEvidenceName}
                    onChange={(e) => setNewEvidenceName(e.target.value)}
                    className="flex-1 px-4 py-3 border-2 border-green-300 rounded-xl focus:ring-4 focus:ring-green-200 focus:border-green-500 transition-all duration-200 bg-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        onAddEvidenceSubmit()
                      } else if (e.key === 'Escape') {
                        onCancelAdd()
                      }
                    }}
                  />
                  <button
                    onClick={onAddEvidenceSubmit}
                    className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
                    title="حفظ"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={onCancelAdd}
                    className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                    title="إلغاء"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Official Evidences */}
            {officialEvidences.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <span>الشواهد الرسمية <span className="text-blue-600">({officialEvidences.length})</span></span>
                </h4>
                <div className="space-y-2">
                  {officialEvidences.map((evidence) => (
                    <div
                      key={evidence.id}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 shadow-sm hover:shadow-md transition-all duration-200"
                    >
                      <span className="text-sm font-medium text-gray-800">{evidence.name}</span>
                      <span className="text-xs font-bold text-blue-700 bg-blue-200 px-3 py-1 rounded-full border border-blue-300">رسمي</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* School Evidences */}
            {schoolEvidences.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 rounded-lg">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  <span>الشواهد الخاصة <span className="text-green-600">({schoolEvidences.length})</span></span>
                </h4>
                <div className="space-y-2">
                  {schoolEvidences.map((evidence) => {
                    const editing = isEditing(evidence.id)
                    return (
                      <div
                        key={evidence.id}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 shadow-sm hover:shadow-md transition-all duration-200 ${
                          editing
                            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
                            : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                        }`}
                      >
                        {editing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingEvidence!.name}
                              onChange={(e) => onEditEvidence(kpi.id, evidence.id, e.target.value)}
                              className="flex-1 px-4 py-2 border-2 border-yellow-400 rounded-xl focus:ring-4 focus:ring-yellow-200 focus:border-yellow-500 transition-all duration-200 bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  onEditEvidenceSubmit()
                                } else if (e.key === 'Escape') {
                                  onCancelEdit()
                                }
                              }}
                            />
                            <button
                              onClick={onEditEvidenceSubmit}
                              className="p-2 bg-yellow-600 text-white rounded-xl hover:bg-yellow-700 transition-all duration-200 shadow-md hover:shadow-lg"
                              title="حفظ"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={onCancelEdit}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
                              title="إلغاء"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-gray-800">{evidence.name}</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onEditEvidence(kpi.id, evidence.id, evidence.name)}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-100 rounded-xl transition-all duration-200 hover:shadow-md"
                                title="تعديل"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onDeleteEvidence(kpi.id, evidence.id, evidence.name)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-100 rounded-xl transition-all duration-200 hover:shadow-md"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {kpi.evidenceItems.length === 0 && !isAdding && (
              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm font-medium">لا توجد شواهد لهذا المعيار</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
