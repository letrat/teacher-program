'use client'

import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'

interface JobType {
  id: string
  name: string
  status: boolean
  _count: {
    kpis: number
    users: number
  }
}

interface KPI {
  id: string
  name: string
  weight: number
  isOfficial: boolean
  evidenceItems: Array<{
    id: string
    name: string
    isOfficial: boolean
  }>
}

export default function JobTypesPage() {
  const [jobTypes, setJobTypes] = useState<JobType[]>([])
  const [expandedJobType, setExpandedJobType] = useState<string | null>(null)
  const [jobTypeKPIs, setJobTypeKPIs] = useState<Record<string, KPI[]>>({})
  const [loadingKPIs, setLoadingKPIs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ name: '' })
  const [showEvidenceModal, setShowEvidenceModal] = useState(false)
  const [selectedKPI, setSelectedKPI] = useState<string | null>(null)
  const [evidenceFormData, setEvidenceFormData] = useState({ name: '' })
  const [showKPIModal, setShowKPIModal] = useState(false)
  const [selectedJobType, setSelectedJobType] = useState<string | null>(null)
  const [kpiFormData, setKpiFormData] = useState({ 
    name: '', 
    weight: 0, 
    minAcceptedEvidence: '' 
  })
  const [editingKPI, setEditingKPI] = useState<string | null>(null)
  const [editingKPIFormData, setEditingKPIFormData] = useState<Record<string, { name: string; weight: number; minAcceptedEvidence: string }>>({})
  const [editingEvidence, setEditingEvidence] = useState<string | null>(null)
  const [editingEvidenceFormData, setEditingEvidenceFormData] = useState<Record<string, string>>({})
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingJobType, setEditingJobType] = useState<JobType | null>(null)
  const [editFormData, setEditFormData] = useState({ name: '' })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [importResult, setImportResult] = useState<{
    success: boolean
    message: string
    details?: any
  } | null>(null)
  const [previewData, setPreviewData] = useState<{
    preview: Array<{
      name: string
      kpis: Array<{
        name: string
        weight: number
        minAcceptedEvidence: number
        evidenceItems: string[]
        rowNumbers: number[]
      }>
    }>
    errors?: string[]
    skippedRows?: number
    totalJobTypes: number
    totalKPIs: number
    totalEvidence: number
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchJobTypes()
  }, [])

  const fetchJobTypes = async () => {
    try {
      const data = await api.admin.jobTypes.list()
      const jobTypesList = Array.isArray(data) ? data : ((data as any)?.data || [])
      console.log('📊 Job types fetched:', jobTypesList.map((jt: JobType) => ({
        name: jt.name,
        officialKPIs: jt._count.kpis,
        users: jt._count.users,
      })))
      setJobTypes(jobTypesList)
    } catch (error) {
      console.error('Error fetching job types:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchKPIsForJobType = async (jobTypeId: string) => {
    if (jobTypeKPIs[jobTypeId]) {
      // Already loaded
      return
    }

    setLoadingKPIs(prev => ({ ...prev, [jobTypeId]: true }))
    try {
      const kpis = await api.admin.jobTypes.kpis(jobTypeId)
      setJobTypeKPIs(prev => ({ ...prev, [jobTypeId]: Array.isArray(kpis) ? kpis : [] }))
    } catch (error) {
      console.error('Error fetching KPIs:', error)
      setJobTypeKPIs(prev => ({ ...prev, [jobTypeId]: [] }))
    } finally {
      setLoadingKPIs(prev => ({ ...prev, [jobTypeId]: false }))
    }
  }

  const handleToggleExpand = (jobTypeId: string) => {
    if (expandedJobType === jobTypeId) {
      setExpandedJobType(null)
    } else {
      setExpandedJobType(jobTypeId)
      fetchKPIsForJobType(jobTypeId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    
    submittingRef.current = true
    setSubmitting(true)
    try {
      await api.admin.jobTypes.create(formData)
      setShowModal(false)
      setFormData({ name: '' })
      fetchJobTypes()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة الصفة')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await api.admin.jobTypes.update(id, { status: !currentStatus })
      fetchJobTypes()
    } catch (error) {
      alert('حدث خطأ')
    }
  }

  const handleEditJobType = (jobType: JobType) => {
    setEditingJobType(jobType)
    setEditFormData({ name: jobType.name })
    setShowEditModal(true)
  }

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingJobType || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    try {
      await api.admin.jobTypes.update(editingJobType.id, { name: editFormData.name })
      setShowEditModal(false)
      setEditingJobType(null)
      setEditFormData({ name: '' })
      fetchJobTypes()
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في تعديل الصفة')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleDeleteKPI = async (kpiId: string, kpiName: string, jobTypeId: string) => {
    if (!confirm(`هل أنت متأكد من حذف المعيار "${kpiName}"؟\n\nسيتم حذف المعيار من جميع المدارس.`)) {
      return
    }

    try {
      // تحديث فوري للـ state لإزالة المعيار المحذوف قبل الحذف من الـ API
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        if (updated[jobTypeId]) {
          updated[jobTypeId] = updated[jobTypeId].filter(kpi => kpi.id !== kpiId)
        }
        return updated
      })
      
      // حذف المعيار من الـ API
      await api.admin.kpis.delete(kpiId)
      
      // تحديث عدد المعايير في قائمة الصفات
      await fetchJobTypes()
      
      alert('تم حذف المعيار بنجاح')
    } catch (error: any) {
      // في حالة الخطأ، إعادة جلب البيانات لاستعادة الحالة الصحيحة
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        delete updated[jobTypeId]
        return updated
      })
      await fetchKPIsForJobType(jobTypeId)
      alert(error.message || 'حدث خطأ في حذف المعيار')
    }
  }

  const handleDeleteEvidence = async (evidenceId: string, evidenceName: string, kpiId: string, jobTypeId: string) => {
    if (!confirm(`هل أنت متأكد من حذف الشاهد "${evidenceName}"؟\n\nسيتم حذف الشاهد من جميع المدارس.`)) {
      return
    }

    try {
      // تحديث فوري للـ state لإزالة الشاهد المحذوف قبل الحذف من الـ API
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        if (updated[jobTypeId]) {
          updated[jobTypeId] = updated[jobTypeId].map(kpi => 
            kpi.id === kpiId 
              ? { ...kpi, evidenceItems: kpi.evidenceItems.filter(e => e.id !== evidenceId) }
              : kpi
          )
        }
        return updated
      })
      
      // حذف الشاهد من الـ API
      await api.admin.evidence.delete(evidenceId)
      
      alert('تم حذف الشاهد بنجاح')
    } catch (error: any) {
      // في حالة الخطأ، إعادة جلب البيانات لاستعادة الحالة الصحيحة
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        delete updated[jobTypeId]
        return updated
      })
      await fetchKPIsForJobType(jobTypeId)
      alert(error.message || 'حدث خطأ في حذف الشاهد')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // التحقق من نوع الملف
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ]
      const validExtensions = ['.xlsx', '.xls', '.csv']
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        alert('يرجى اختيار ملف Excel صالح (.xlsx, .xls, .csv)')
        return
      }
      
      setImportFile(file)
      setImportResult(null)
      setPreviewData(null)
      setShowPreview(false)
      
      // Auto-preview the file
      await handlePreview(file)
    }
  }

  const handlePreview = async (file: File) => {
    setPreviewLoading(true)
    setPreviewData(null)
    setShowPreview(false)
    
    try {
      const result = await api.admin.jobTypes.previewExcel(file)
      setPreviewData(result)
      setShowPreview(true)
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في معاينة الملف')
      setPreviewData(null)
      setShowPreview(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleExcelImport = async () => {
    if (!importFile) {
      alert('يرجى اختيار ملف Excel أولاً')
      return
    }

    setImportLoading(true)
    setImportProgress('جاري رفع الملف...')
    setImportResult(null)

    try {
      setImportProgress('جاري معالجة البيانات...')
      const result = await api.admin.jobTypes.importExcel(importFile)
      
      setImportProgress('تم الاستيراد بنجاح!')
      setImportResult({
        success: true,
        message: 'تم استيراد البيانات بنجاح',
        details: result
      })

      // إعادة تحميل البيانات
      await fetchJobTypes()
      // مسح الكاش للمعايير
      setJobTypeKPIs({})
      
      // إغلاق الـ modal بعد 3 ثوان
      setTimeout(() => {
        setShowImportModal(false)
        setImportFile(null)
        setImportResult(null)
        setImportProgress('')
        setPreviewData(null)
        setShowPreview(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 3000)
    } catch (error: any) {
      setImportProgress('')
      setImportResult({
        success: false,
        message: error.message || 'حدث خطأ في استيراد الملف'
      })
    } finally {
      setImportLoading(false)
    }
  }

  const handleAddEvidence = (kpiId: string) => {
    setSelectedKPI(kpiId)
    setEditingEvidence(null)
    setEvidenceFormData({ name: '' })
    setShowEvidenceModal(true)
  }

  const handleEditEvidence = (evidenceId: string, evidenceName: string) => {
    setEditingEvidence(evidenceId)
    setEditingEvidenceFormData({
      [evidenceId]: evidenceName
    })
  }

  const handleCancelEditEvidence = () => {
    setEditingEvidence(null)
    setEditingEvidenceFormData({})
  }

  const handleSaveEvidence = async (evidenceId: string, kpiId: string, jobTypeId: string) => {
    const name = editingEvidenceFormData[evidenceId]
    if (!name || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    try {
      // تحديث فوري للـ state قبل الحفظ في API
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        if (updated[jobTypeId]) {
          updated[jobTypeId] = updated[jobTypeId].map(kpi => 
            kpi.id === kpiId 
              ? { 
                  ...kpi, 
                  evidenceItems: kpi.evidenceItems.map(e => 
                    e.id === evidenceId ? { ...e, name } : e
                  )
                }
              : kpi
          )
        }
        return updated
      })

      await api.admin.evidence.update(evidenceId, { name })
      setEditingEvidence(null)
      setEditingEvidenceFormData({})
      
      // لا حاجة لإعادة جلب البيانات لأننا قمنا بتحديث الـ state يدوياً
    } catch (error: any) {
      // في حالة الخطأ، إعادة جلب البيانات لاستعادة الحالة الصحيحة
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        delete updated[jobTypeId]
        return updated
      })
      await fetchKPIsForJobType(jobTypeId)
      alert(error.message || 'حدث خطأ في تعديل الشاهد')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKPI || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    try {
      await api.admin.kpis.createEvidence(selectedKPI, { name: evidenceFormData.name })
      setShowEvidenceModal(false)
      setEvidenceFormData({ name: '' })
      setSelectedKPI(null)
      
      // Refresh KPIs for the job type
      const jobTypeId = Object.keys(jobTypeKPIs).find(jtId => 
        jobTypeKPIs[jtId].some(kpi => kpi.id === selectedKPI)
      )
      if (jobTypeId) {
        // Clear cached KPIs and reload
        setJobTypeKPIs(prev => {
          const updated = { ...prev }
          delete updated[jobTypeId]
          return updated
        })
        await fetchKPIsForJobType(jobTypeId)
      }
    } catch (error: any) {
      alert(error.message || 'حدث خطأ في إضافة الشاهد')
    }
  }

  const handleAddKPI = (jobTypeId: string) => {
    setSelectedJobType(jobTypeId)
    setEditingKPI(null)
    setKpiFormData({ name: '', weight: 0, minAcceptedEvidence: '' })
    setShowKPIModal(true)
  }

  const handleEditKPI = (kpi: KPI) => {
    setEditingKPI(kpi.id)
    setEditingKPIFormData({
      [kpi.id]: {
        name: kpi.name,
        weight: kpi.weight,
        minAcceptedEvidence: String((kpi as any).minAcceptedEvidence || '')
      }
    })
  }

  const handleCancelEditKPI = () => {
    setEditingKPI(null)
    setEditingKPIFormData({})
  }

  const handleSaveKPI = async (kpiId: string, jobTypeId: string) => {
    const formData = editingKPIFormData[kpiId]
    if (!formData || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    try {
      const kpiData: any = {
        name: formData.name,
        weight: Number(formData.weight),
      }
      
      if (formData.minAcceptedEvidence) {
        kpiData.minAcceptedEvidence = Number(formData.minAcceptedEvidence)
      }

      // تحديث فوري للـ state قبل الحفظ في API
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        if (updated[jobTypeId]) {
          updated[jobTypeId] = updated[jobTypeId].map(kpi => 
            kpi.id === kpiId 
              ? { 
                  ...kpi, 
                  name: formData.name, 
                  weight: Number(formData.weight),
                  minAcceptedEvidence: formData.minAcceptedEvidence ? Number(formData.minAcceptedEvidence) : (kpi as any).minAcceptedEvidence
                }
              : kpi
          )
        }
        return updated
      })

      await api.admin.kpis.update(kpiId, kpiData)
      setEditingKPI(null)
      setEditingKPIFormData({})
      
      // تحديث عدد المعايير في قائمة الصفات فقط
      await fetchJobTypes()
    } catch (error: any) {
      // في حالة الخطأ، إعادة جلب البيانات لاستعادة الحالة الصحيحة
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        delete updated[jobTypeId]
        return updated
      })
      await fetchKPIsForJobType(jobTypeId)
      alert(error.message || 'حدث خطأ في تعديل المعيار')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmitKPI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedJobType) return

    try {
      const kpiData: any = {
        name: kpiFormData.name,
        weight: Number(kpiFormData.weight),
      }
      
      if (kpiFormData.minAcceptedEvidence) {
        kpiData.minAcceptedEvidence = Number(kpiFormData.minAcceptedEvidence)
      }

      if (editingKPI) {
        // Update existing KPI
        await api.admin.kpis.update(editingKPI, kpiData)
      } else {
        // Create new KPI
      await api.admin.jobTypes.createKpi(selectedJobType, kpiData)
      }
      
      setShowKPIModal(false)
      setKpiFormData({ name: '', weight: 0, minAcceptedEvidence: '' })
      setSelectedJobType(null)
      setEditingKPI(null)
      
      // Refresh KPIs and job types
      setJobTypeKPIs(prev => {
        const updated = { ...prev }
        delete updated[selectedJobType]
        return updated
      })
      await fetchKPIsForJobType(selectedJobType)
      await fetchJobTypes() // Refresh to update count
    } catch (error: any) {
      alert(error.message || `حدث خطأ في ${editingKPI ? 'تعديل' : 'إضافة'} المعيار`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">صفات الموظفين</h1>
              <p className="text-gray-500 mt-1">إدارة صفات الموظفين والمعايير الرسمية</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-semibold"
              >
                <Upload className="w-5 h-5" />
                استيراد Excel
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-semibold"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                صفة جديدة
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">الصفات</h2>
                <p className="text-blue-100 text-sm mt-1">{jobTypes.length} صفة مسجلة</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {jobTypes.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-gray-500 text-lg mb-2">لا توجد صفات</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  إضافة أول صفة
                </button>
              </div>
            ) : (
              jobTypes.map((jobType) => (
                <div key={jobType.id} className="bg-white">
                  <div
                    onClick={() => handleToggleExpand(jobType.id)}
                    className={`p-5 cursor-pointer transition-all ${
                      expandedJobType === jobType.id
                        ? 'bg-blue-50 border-r-4 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-3xl">👥</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 truncate">{jobType.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span>{jobType._count.kpis} معيار رسمي</span>
                            <span>•</span>
                            <span>{jobType._count.users} موظف</span>
                            {jobTypeKPIs[jobType.id] && jobTypeKPIs[jobType.id].length > 0 && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-blue-600">
                                  مجموع الأوزان: {jobTypeKPIs[jobType.id].reduce((sum, k) => sum + k.weight, 0).toFixed(1)}%
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                            jobType.status
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {jobType.status ? '✓ نشط' : '✗ معطل'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditJobType(jobType)
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-blue-600 hover:bg-blue-50"
                          title="تعديل الصفة"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleStatus(jobType.id, jobType.status)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            jobType.status
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {jobType.status ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleExpand(jobType.id)
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedJobType === jobType.id ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* المعايير */}
                  {expandedJobType === jobType.id && (
                    <div className="bg-gray-50 border-t border-gray-200 p-6">
                      {loadingKPIs[jobType.id] ? (
                        <div className="text-center py-12">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                          <p className="text-gray-600">جاري تحميل المعايير...</p>
                        </div>
                      ) : jobTypeKPIs[jobType.id] && jobTypeKPIs[jobType.id].length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">المعايير الرسمية</h3>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-600">
                                {jobTypeKPIs[jobType.id].length} معيار
                              </span>
                              <button
                                onClick={() => handleAddKPI(jobType.id)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 text-sm font-semibold"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                إضافة معيار
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {jobTypeKPIs[jobType.id].map((kpi) => {
                              const totalWeight = jobTypeKPIs[jobType.id].reduce((sum, k) => sum + k.weight, 0)
                              return (
                                <div key={kpi.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
                                    {editingKPI === kpi.id ? (
                                      <div className="space-y-3">
                                        <div>
                                          <label className="block text-xs font-semibold text-gray-700 mb-1">اسم المعيار</label>
                                          <input
                                            type="text"
                                            value={editingKPIFormData[kpi.id]?.name || ''}
                                            onChange={(e) => setEditingKPIFormData({
                                              ...editingKPIFormData,
                                              [kpi.id]: { ...editingKPIFormData[kpi.id], name: e.target.value }
                                            })}
                                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            autoFocus
                                          />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">الوزن (%)</label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              value={editingKPIFormData[kpi.id]?.weight || 0}
                                              onChange={(e) => setEditingKPIFormData({
                                                ...editingKPIFormData,
                                                [kpi.id]: { ...editingKPIFormData[kpi.id], weight: parseFloat(e.target.value) || 0 }
                                              })}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">الحد الأدنى للشواهد</label>
                                            <input
                                              type="number"
                                              min="1"
                                              value={editingKPIFormData[kpi.id]?.minAcceptedEvidence || ''}
                                              onChange={(e) => setEditingKPIFormData({
                                                ...editingKPIFormData,
                                                [kpi.id]: { ...editingKPIFormData[kpi.id], minAcceptedEvidence: e.target.value }
                                              })}
                                              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleSaveKPI(kpi.id, jobType.id)}
                                            className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
                                          >
                                            حفظ
                                          </button>
                                          <button
                                            onClick={handleCancelEditKPI}
                                            className="flex-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg font-medium transition-colors"
                                          >
                                            إلغاء
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-xl">📋</span>
                                        <h4 className="font-semibold text-gray-900 text-sm truncate">{kpi.name}</h4>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className="font-bold text-blue-600 text-sm">{kpi.weight}%</span>
                                          <span className="text-xs text-gray-500">
                                            الحد الأدنى: {(kpi as any).minAcceptedEvidence || 1} شاهد
                                          </span>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditKPI(kpi)
                                          }}
                                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                          title="تعديل المعيار"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteKPI(kpi.id, kpi.name, jobType.id)
                                          }}
                                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                          title="حذف المعيار"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                    )}
                                  </div>
                                  <div className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="text-xs font-semibold text-gray-600 flex items-center gap-2">
                                        <span className="text-blue-600">📎</span>
                                        <span>الشواهد ({kpi.evidenceItems?.length || 0})</span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleAddEvidence(kpi.id)
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        إضافة شاهد
                                      </button>
                                    </div>
                                    {kpi.evidenceItems && kpi.evidenceItems.length > 0 ? (
                                      <div className="flex flex-wrap gap-2">
                                        {kpi.evidenceItems.map((evidence) => (
                                          editingEvidence === evidence.id ? (
                                            <div key={evidence.id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-300 rounded-md">
                                              <input
                                                type="text"
                                                value={editingEvidenceFormData[evidence.id] || ''}
                                                onChange={(e) => setEditingEvidenceFormData({
                                                  ...editingEvidenceFormData,
                                                  [evidence.id]: e.target.value
                                                })}
                                                className="px-2 py-0.5 text-xs border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white min-w-[150px]"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    handleSaveEvidence(evidence.id, kpi.id, jobType.id)
                                                  } else if (e.key === 'Escape') {
                                                    handleCancelEditEvidence()
                                                  }
                                                }}
                                              />
                                              <button
                                                onClick={() => handleSaveEvidence(evidence.id, kpi.id, jobType.id)}
                                                className="text-blue-600 hover:text-blue-700 p-0.5"
                                                title="حفظ"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                              </button>
                                              <button
                                                onClick={handleCancelEditEvidence}
                                                className="text-gray-600 hover:text-gray-700 p-0.5"
                                                title="إلغاء"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                          ) : (
                                          <span
                                            key={evidence.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs text-gray-700 hover:bg-blue-100 transition-colors group"
                                          >
                                            <span className="text-blue-500">•</span>
                                            <span className="font-medium">{evidence.name}</span>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleEditEvidence(evidence.id, evidence.name)
                                                }}
                                                className="opacity-0 group-hover:opacity-100 ml-1 text-blue-600 hover:text-blue-700 transition-opacity"
                                                title="تعديل الشاهد"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                              </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteEvidence(evidence.id, evidence.name, kpi.id, jobType.id)
                                              }}
                                              className="opacity-0 group-hover:opacity-100 ml-1 text-red-600 hover:text-red-700 transition-opacity"
                                              title="حذف الشاهد"
                                            >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </span>
                                          )
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-400 italic">لا توجد شواهد محددة</p>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">المجموع الكلي للأوزان:</span>
                              <span className="text-2xl font-bold text-blue-600">
                                {jobTypeKPIs[jobType.id].reduce((sum, k) => sum + k.weight, 0).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-5xl mb-4">📋</div>
                          <p className="text-gray-500 mb-4">لا توجد معايير رسمية لهذه الصفة</p>
                          <button
                            onClick={() => handleAddKPI(jobType.id)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mx-auto font-semibold"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            إضافة أول معيار
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal إضافة صفة */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-xl">
              <h3 className="text-lg font-bold text-white">إضافة صفة جديدة</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الصفة</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: معلم، وكيل، محضر مختبر"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                >
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal إضافة/تعديل شاهد */}
      {showEvidenceModal && selectedKPI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className={`bg-gradient-to-r ${editingEvidence ? 'from-blue-500 to-blue-600' : 'from-green-500 to-green-600'} px-6 py-4 rounded-t-xl`}>
              <h3 className="text-lg font-bold text-white">{editingEvidence ? 'تعديل الشاهد' : 'إضافة شاهد جديد'}</h3>
            </div>
            <form onSubmit={handleSubmitEvidence} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">اسم الشاهد</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                  value={evidenceFormData.name}
                  onChange={(e) => setEvidenceFormData({ name: e.target.value })}
                  placeholder="مثال: شهادة حضور دورة تدريبية"
                />
                <p className="text-xs text-gray-500 mt-1">هذا الشاهد سيكون رسمي ويظهر لجميع المدارس</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEvidenceModal(false)
                    setSelectedKPI(null)
                    setEvidenceFormData({ name: '' })
                    setEditingEvidence(null)
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 ${editingEvidence ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg font-semibold transition-colors`}
                >
                  {editingEvidence ? 'حفظ التعديلات' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal إضافة/تعديل معيار */}
      {showKPIModal && selectedJobType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className={`bg-gradient-to-r ${editingKPI ? 'from-blue-500 to-blue-600' : 'from-purple-500 to-purple-600'} px-6 py-4 rounded-t-xl`}>
              <h3 className="text-lg font-bold text-white">{editingKPI ? 'تعديل المعيار' : 'إضافة معيار رسمي جديد'}</h3>
              <p className="text-purple-100 text-sm mt-1">هذا المعيار سينزل على جميع المدارس</p>
            </div>
            <form onSubmit={handleSubmitKPI} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  اسم المعيار <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                  value={kpiFormData.name}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, name: e.target.value })}
                  placeholder="مثال: الأداء الوظيفي"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الوزن (النسبة المئوية) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                  value={kpiFormData.weight || ''}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, weight: parseFloat(e.target.value) || 0 })}
                  placeholder="0-100"
                />
                <p className="text-xs text-gray-500 mt-1">يجب أن يكون مجموع أوزان المعايير = 100%</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الحد الأدنى لعدد الشواهد المقبولة (اختياري)
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                  value={kpiFormData.minAcceptedEvidence || ''}
                  onChange={(e) => setKpiFormData({ ...kpiFormData, minAcceptedEvidence: e.target.value })}
                  placeholder="مثال: 3"
                />
                <p className="text-xs text-gray-500 mt-1">الحد الأدنى لعدد الشواهد المطلوبة لإكمال هذا المعيار</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowKPIModal(false)
                    setSelectedJobType(null)
                    setKpiFormData({ name: '', weight: 0, minAcceptedEvidence: '' })
                    setEditingKPI(null)
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`px-6 py-2.5 ${editingKPI ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-lg font-semibold transition-colors`}
                >
                  {editingKPI ? 'حفظ التعديلات' : 'إضافة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Job Type Modal */}
      {showEditModal && editingJobType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-4 rounded-t-xl">
              <h3 className="text-lg font-bold text-white">تعديل الصفة</h3>
              <p className="text-indigo-100 text-sm mt-1">التعديل سيؤثر على جميع المدارس</p>
            </div>
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  اسم الصفة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ name: e.target.value })}
                  placeholder="مثال: معلم، وكيل، محضر مختبر"
                />
                <p className="text-xs text-gray-500 mt-1">سيتم تحديث اسم الصفة لجميع المدارس</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingJobType(null)
                    setEditFormData({ name: '' })
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all font-medium"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  استيراد من Excel
                </h3>
                <p className="text-green-100 text-sm mt-1">استيراد الصفات والمعايير والشواهد من ملف Excel</p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportFile(null)
                  setImportResult(null)
                  setImportProgress('')
                  setPreviewData(null)
                  setShowPreview(false)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="text-white hover:text-green-100 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">تعليمات الاستيراد:</h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>العمود A: اسم الصفة (Job Type)</li>
                  <li>العمود B: اسم المعيار (KPI name)</li>
                  <li>العمود C: وزن المعيار (Weight) - رقم من 0-100</li>
                  <li>العمود D: الحد الأدنى لعدد الشواهد (Min Accepted Evidence)</li>
                  <li>العمود E: الشواهد (Evidence items) - مفصولة بفواصل أو فاصلة منقوطة</li>
                </ul>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  اختر ملف Excel <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="excel-file-input"
                    disabled={importLoading || previewLoading}
                  />
                  <label
                    htmlFor="excel-file-input"
                    className={`cursor-pointer flex flex-col items-center gap-3 ${importLoading || previewLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload className="w-12 h-12 text-gray-400" />
                    <div>
                      <span className="text-green-600 font-semibold">انقر لاختيار الملف</span>
                      <span className="text-gray-500"> أو اسحب الملف هنا</span>
                    </div>
                    <p className="text-xs text-gray-500">ملفات Excel (.xlsx, .xls, .csv)</p>
                  </label>
                </div>
                {importFile && (
                  <div className="mt-3 flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-gray-700 flex-1">{importFile.name}</span>
                    <span className="text-xs text-gray-500">{(importFile.size / 1024).toFixed(2)} KB</span>
                    <button
                      onClick={async () => {
                        setImportFile(null)
                        setPreviewData(null)
                        setShowPreview(false)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                      disabled={importLoading || previewLoading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Loading */}
              {previewLoading && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                    <p className="text-sm text-blue-800">جاري معاينة البيانات...</p>
                  </div>
                </div>
              )}

              {/* Preview Data */}
              {showPreview && previewData && (
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-[400px] overflow-y-auto">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">معاينة البيانات قبل الاستيراد</h4>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{previewData.totalJobTypes}</span> صفة •{' '}
                      <span className="font-medium">{previewData.totalKPIs}</span> معيار •{' '}
                      <span className="font-medium">{previewData.totalEvidence}</span> شاهد
                    </div>
                  </div>
                  
                  {previewData.errors && previewData.errors.length > 0 && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-red-800 mb-2">أخطاء في البيانات:</p>
                      <ul className="text-xs text-red-700 space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
                        {previewData.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-4">
                    {previewData.preview.map((jobType, jobTypeIdx) => (
                      <div key={jobTypeIdx} className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-bold text-sm">{jobTypeIdx + 1}</span>
                          </div>
                          <h5 className="font-bold text-lg text-gray-900">{jobType.name}</h5>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {jobType.kpis.length} معيار
                          </span>
                        </div>
                        
                        <div className="space-y-3 ml-10">
                          {jobType.kpis.map((kpi, kpiIdx) => (
                            <div key={kpiIdx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-gray-700">المعيار:</span>
                                    <span className="text-sm font-medium text-gray-900">{kpi.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-gray-600">
                                    <span>الوزن: <span className="font-medium">{kpi.weight}</span></span>
                                    <span>الحد الأدنى للشواهد: <span className="font-medium">{kpi.minAcceptedEvidence}</span></span>
                                  </div>
                                </div>
                              </div>
                              
                              {kpi.evidenceItems.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold text-gray-600 mb-1">الشواهد:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {kpi.evidenceItems.map((evidence, evIdx) => (
                                      <span
                                        key={evIdx}
                                        className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                                      >
                                        {evidence}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              {importProgress && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                    <p className="text-sm text-blue-800">{importProgress}</p>
                  </div>
                </div>
              )}

              {/* Result */}
              {importResult && (
                <div className={`border rounded-lg p-4 ${
                  importResult.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {importResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        importResult.success ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {importResult.message}
                      </p>
                      {importResult.details && (
                        <div className="mt-2 text-sm text-gray-700">
                          {importResult.details.jobTypesCreated && (
                            <p>✓ تم إنشاء {importResult.details.jobTypesCreated} صفة جديدة</p>
                          )}
                          {importResult.details.kpisCreated && (
                            <p>✓ تم إنشاء {importResult.details.kpisCreated} معيار جديد</p>
                          )}
                          {importResult.details.kpisUpdated && (
                            <p>✓ تم تحديث {importResult.details.kpisUpdated} معيار</p>
                          )}
                          {importResult.details.evidenceCreated && (
                            <p>✓ تم إضافة {importResult.details.evidenceCreated} شاهد</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false)
                    setImportFile(null)
                    setImportResult(null)
                    setImportProgress('')
                    setPreviewData(null)
                    setShowPreview(false)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={importLoading || previewLoading}
                >
                  إلغاء
                </button>
                {showPreview && previewData && (
                <button
                  onClick={handleExcelImport}
                    disabled={!importFile || importLoading || previewLoading}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      جاري الاستيراد...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                        الموافقة والاستيراد
                    </>
                  )}
                </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
