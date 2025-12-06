'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, FileText, X, CheckCircle, Award, Image as ImageIcon, AlertCircle } from 'lucide-react'
import Breadcrumbs from '@/components/ui/Breadcrumbs'
import { SkeletonCard } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import api from '@/lib/api'

interface JobType {
  id: string
  name: string
}

interface KPI {
  id: string
  name: string
  weight: number
  minAcceptedEvidence?: number | null
}

interface EvidenceItem {
  id: string
  name: string
}

function SubmitPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jobType, setJobType] = useState<JobType | null>(null)
  const [kpis, setKpis] = useState<KPI[]>([])
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([])
  const [selectedKPI, setSelectedKPI] = useState<string>('')
  const [selectedEvidence, setSelectedEvidence] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingEvidenceItems, setLoadingEvidenceItems] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadingRef = useRef(false)
  const [dragActive, setDragActive] = useState(false)
  const [weightsInfo, setWeightsInfo] = useState<{
    totalWeight: number
    isValid: boolean
    jobTypeName: string
  } | null>(null)

  useEffect(() => {
    fetchJobTypeAndKPIs()
    fetchWeightsInfo()
  }, [])

  const fetchWeightsInfo = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const data = await api.teacher.dashboard() as { weightsInfo?: { totalWeight: number; isValid: boolean; jobTypeName: string } }
      if (data.weightsInfo) {
        setWeightsInfo(data.weightsInfo)
      }
    } catch (error) {
      // Silently fail - weights info is optional
    }
  }

  useEffect(() => {
    // إذا كان هناك kpiId في query params، حدده تلقائياً
    const kpiIdFromQuery = searchParams.get('kpiId')
    if (kpiIdFromQuery && kpis.length > 0) {
      const kpiExists = kpis.some(k => k.id === kpiIdFromQuery)
      if (kpiExists && selectedKPI !== kpiIdFromQuery) {
        setSelectedKPI(kpiIdFromQuery)
      }
    }
  }, [searchParams, kpis, selectedKPI])

  useEffect(() => {
    if (selectedKPI) {
      fetchEvidenceItems(selectedKPI)
    } else {
      setEvidenceItems([])
      setSelectedEvidence('')
    }
  }, [selectedKPI])

  const fetchJobTypeAndKPIs = async () => {
    try {
      const api = (await import('@/lib/api')).default
      const jobTypesData = await api.teacher.jobTypes()
      
      if (Array.isArray(jobTypesData) && jobTypesData.length > 0) {
        const teacherJobType = jobTypesData[0]
        setJobType(teacherJobType)
        await fetchKPIs(teacherJobType.id)
      } else {
        toast.error('لم يتم تحديد صفة الموظف. يرجى التواصل مع مدير المدرسة')
        setLoading(false)
      }
    } catch (error: any) {
      toast.error('حدث خطأ في جلب البيانات')
      setLoading(false)
    }
  }

  const fetchKPIs = async (jobTypeId: string) => {
    try {
      const api = (await import('@/lib/api')).default
      const data = await api.teacher.kpis(jobTypeId)
      
      if (Array.isArray(data)) {
        setKpis(data)
      } else {
        setKpis([])
      }
    } catch (error: any) {
      toast.error('حدث خطأ في جلب المعايير')
      setKpis([])
    } finally {
      setLoading(false)
    }
  }

  const fetchEvidenceItems = async (kpiId: string) => {
    setLoadingEvidenceItems(true)
    try {
      const data = await api.teacher.evidence(kpiId)
      setEvidenceItems(data as EvidenceItem[])
      setSelectedEvidence('')
    } catch (error) {
      toast.error('حدث خطأ في جلب الشواهد')
      setEvidenceItems([])
    } finally {
      setLoadingEvidenceItems(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    // Also check by extension for better compatibility
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mpeg', '.mov', '.avi', '.webm', '.xls', '.xlsx', '.ppt', '.pptx', '.doc', '.docx']
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase()
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(fileExtension)) {
      toast.error('نوع الملف غير مدعوم. يرجى رفع PDF، صورة، فيديو، Excel، Word، أو PowerPoint')
      return
    }

    // Validate file size (max 30MB)
    if (selectedFile.size > 30 * 1024 * 1024) {
      toast.error('حجم الملف كبير جداً. الحد الأقصى 30MB')
      return
    }

    setFile(selectedFile)
    const reader = new FileReader()
    reader.onloadend = () => {
      setFilePreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const removeFile = () => {
    setFile(null)
    setFilePreview('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // منع إرسال طلبات متعددة باستخدام useRef للفحص الفوري
    if (uploadingRef.current) {
      return
    }
    
    if (!selectedKPI || !selectedEvidence) {
      toast.error('يرجى اختيار المعيار والشاهد')
      return
    }

    if (!file) {
      toast.error('يرجى رفع ملف')
      return
    }

    // تعيين الحالة فوراً باستخدام useRef
    uploadingRef.current = true
    setUploading(true)
    const uploadToast = toast.loading('جاري رفع الملف...')

    try {
      // Upload file
      const uploadData = await api.upload.file(file)
      toast.loading('جاري إرسال الشاهد...', { id: uploadToast })

      // Submit evidence
      await api.teacher.submitEvidence({
        kpiId: selectedKPI,
        evidenceId: selectedEvidence,
        fileUrl: uploadData.fileUrl,
        description,
      })

      toast.success('تم رفع الشاهد بنجاح', { id: uploadToast })
      router.push('/teacher/submissions')
    } catch (error) {
      toast.error('حدث خطأ في رفع الشاهد', { id: uploadToast })
    } finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }

  const isImage = (file: File | null) => {
    if (!file) return false
    return file.type.startsWith('image/')
  }

  const selectedKPIName = kpis.find(k => k.id === selectedKPI)?.name || ''
  const selectedEvidenceName = evidenceItems.find(e => e.id === selectedEvidence)?.name || ''

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة التحكم', href: '/teacher' },
          { label: 'رفع شاهد جديد' }
        ]} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  if (!jobType) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة التحكم', href: '/teacher' },
          { label: 'رفع شاهد جديد' }
        ]} />
        <EmptyState
          icon={Award}
          title="لم يتم تحديد صفة الموظف"
          description="يرجى التواصل مع مدير المدرسة لتحديد صفة الموظف في حسابك"
          action={{
            label: 'العودة للوحة التحكم',
            onClick: () => router.push('/teacher'),
            variant: 'primary'
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Breadcrumbs items={[
        { label: 'لوحة التحكم', href: '/teacher' },
        { label: 'رفع شاهد جديد' }
      ]} />
      <div className="relative overflow-hidden bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-2xl p-6 sm:p-8 border border-green-100 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-200 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-200 rounded-full -ml-24 -mb-24 opacity-20 blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
              <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-green-900 to-emerald-900 bg-clip-text text-transparent">
                رفع شاهد جديد
              </h1>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-green-300 to-transparent mb-3"></div>
          <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
            اختر المعيار والشاهد وارفع الملف في صفحة واحدة
          </p>
        </div>
      </div>

      {/* تنبيه مجموع الأوزان */}
      {weightsInfo && !weightsInfo.isValid && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-800 mb-1">تحذير: مجموع الأوزان غير مكتمل</h3>
            <p className="text-red-700 text-sm">
              مجموع الأوزان للمعايير النشطة لصفة <span className="font-bold">{weightsInfo.jobTypeName}</span> هو{' '}
              <span className="font-bold">{weightsInfo.totalWeight}%</span> ولا يساوي 100%.{' '}
              <span className="font-semibold">الدرجة النهائية قد تكون غير دقيقة.</span>
            </p>
            <p className="text-red-700 text-sm mt-2 font-medium">
              الرجاء التواصل مع مدير المدرسة لتعديل أوزان المعايير.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Job Type Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium text-blue-900">صفة الموظف:</span>
            <span className="text-xs sm:text-sm text-blue-700">{jobType.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column: KPI and Evidence Selection */}
          <div className="space-y-4 sm:space-y-6">
            {/* KPI Selection */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                اختر المعيار
              </h2>
              {kpis.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد معايير متاحة. يرجى التواصل مع مدير المدرسة.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {kpis.map((kpi) => (
                    <button
                      key={kpi.id}
                      type="button"
                      onClick={() => setSelectedKPI(kpi.id)}
                      className={`p-4 rounded-lg border-2 text-right transition-all ${
                        selectedKPI === kpi.id
                          ? 'border-blue-600 bg-blue-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{kpi.name}</div>
                          <div className="text-sm text-gray-600 mt-1 flex items-center gap-3">
                            <span>الوزن: {kpi.weight}%</span>
                            <span>•</span>
                            <span className="font-medium text-indigo-600">
                              الحد الأدنى: {kpi.minAcceptedEvidence ?? 1} شاهد
                            </span>
                          </div>
                        </div>
                        {selectedKPI === kpi.id && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Evidence Selection */}
            {selectedKPI && (
              <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  اختر الشاهد
                </h2>
                {loadingEvidenceItems ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent mx-auto mb-2"></div>
                    <p>جاري تحميل الشواهد...</p>
                  </div>
                ) : evidenceItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p>لا يوجد شواهد</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {evidenceItems.map((evidence) => (
                      <button
                        key={evidence.id}
                        type="button"
                        onClick={() => setSelectedEvidence(evidence.id)}
                        className={`p-4 rounded-lg border-2 text-right transition-all ${
                          selectedEvidence === evidence.id
                            ? 'border-green-600 bg-green-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-900">{evidence.name}</div>
                          {selectedEvidence === evidence.id && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: File Upload */}
          <div className="space-y-4 sm:space-y-6">
            {/* File Upload Area */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                رفع الملف
              </h2>

              {!file ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    اسحب الملف هنا أو{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      اختر ملف
                    </button>
                  </p>
                  <p className="text-sm text-gray-500">PDF، صورة، فيديو، Excel، Word، أو PowerPoint (حد أقصى 30MB)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.avi,.webm,.xls,.xlsx,.ppt,.pptx,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {isImage(file) ? (
                          <ImageIcon className="w-8 h-8 text-blue-600" />
                        ) : (
                          <FileText className="w-8 h-8 text-red-600" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{file.name}</div>
                          <div className="text-sm text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    {isImage(file) && filePreview && (
                      <div className="mt-4">
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="max-w-full h-auto rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    تغيير الملف
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.avi,.webm,.xls,.xlsx,.ppt,.pptx,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                وصف (اختياري)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                placeholder="أضف وصفاً للشاهد..."
              />
            </div>

            {/* Summary */}
            {(selectedKPI || selectedEvidence) && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3">ملخص الطلب</h3>
                <div className="space-y-2 text-sm">
                  {selectedKPIName && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">المعيار:</span>
                      <span className="font-medium text-gray-900">{selectedKPIName}</span>
                    </div>
                  )}
                  {selectedEvidenceName && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">الشاهد:</span>
                      <span className="font-medium text-gray-900">{selectedEvidenceName}</span>
                    </div>
                  )}
                  {file && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">الملف:</span>
                      <span className="font-medium text-gray-900">{file.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading || !selectedKPI || !selectedEvidence || !file}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {uploading ? 'جاري الرفع...' : 'إرسال الشاهد'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function SubmitPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Breadcrumbs items={[
          { label: 'لوحة التحكم', href: '/teacher' },
          { label: 'رفع شاهد جديد' }
        ]} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    }>
      <SubmitPageContent />
    </Suspense>
  )
}
