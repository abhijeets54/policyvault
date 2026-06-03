'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VerificationForm } from '@/components/VerificationForm'
import type { ExtractedPolicyData } from '@/lib/types'
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'

interface UploadState {
  step: 'upload' | 'verification'
  extracted: (ExtractedPolicyData & { ai_model_used: string }) | null
  pdfUrl: string | null
  pdfPath: string | null
  isLoading: boolean
  error: string | null
  fileName: string | null
  fileSize: number | null
}

const EXTRACTION_STEPS = [
  'Uploading document...',
  'AI is reading your policy...',
  'Extracting details...',
  'Done!',
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function UploadPage() {
  const router = useRouter()
  const [upload, setUpload] = useState<UploadState>({
    step: 'upload',
    extracted: null,
    pdfUrl: null,
    pdfPath: null,
    isLoading: false,
    error: null,
    fileName: null,
    fileSize: null,
  })
  const [extractionStep, setExtractionStep] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const performExtraction = async (file: File) => {
    setUpload(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      fileName: file.name,
      fileSize: file.size,
    }))

    const formData = new FormData()
    formData.append('file', file)

    let step = 0
    const stepInterval = setInterval(() => {
      step = Math.min(step + 1, EXTRACTION_STEPS.length - 2)
      setExtractionStep(step)
    }, 1500)

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      clearInterval(stepInterval)
      setExtractionStep(EXTRACTION_STEPS.length - 1)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Extraction failed')
      }

      const data = await response.json()

      setUpload(prev => ({
        ...prev,
        step: 'verification',
        extracted: data.extracted,
        pdfUrl: data.pdfUrl,
        pdfPath: data.pdfPath,
        isLoading: false,
      }))
    } catch (err) {
      clearInterval(stepInterval)
      setUpload(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'AI extraction failed. You can still fill details manually.',
      }))
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setSelectedFile(file)
    await performExtraction(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 25 * 1024 * 1024,
    multiple: false,
    disabled: upload.isLoading,
    onDropRejected: (rejections) => {
      const msg = rejections[0]?.errors[0]?.message || 'Invalid file'
      setUpload(prev => ({ ...prev, error: msg }))
    },
  })

  const handleConfirm = async (formData: Record<string, unknown>) => {
    setUpload(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          raw_pdf_url: upload.pdfUrl,
          raw_pdf_path: upload.pdfPath,
          status: 'active',
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to save policy')
      }

      const data = await response.json()
      router.push(`/policies/${data.policy.id}`)
      router.refresh()
    } catch (err) {
      setUpload(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to save policy',
      }))
    }
  }

  // ── STEP 1: Upload ──────────────────────────────────────────────────
  if (upload.step === 'upload') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Policy</h1>
          <p className="text-gray-600">Drop a PDF policy document — AI will extract all the details for you.</p>
        </div>

        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
            ${isDragActive
              ? 'border-[#1e3a5f] bg-blue-50 scale-[1.02]'
              : 'border-gray-300 bg-white hover:border-[#1e3a5f] hover:bg-blue-50/30'
            }
            ${upload.isLoading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            <div className={`
              flex h-20 w-20 items-center justify-center rounded-2xl transition-colors
              ${isDragActive ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-400'}
            `}>
              {isDragActive ? (
                <Upload className="h-9 w-9" />
              ) : (
                <FileText className="h-9 w-9" />
              )}
            </div>

            {isDragActive ? (
              <div>
                <p className="text-lg font-semibold text-[#1e3a5f]">Drop it here!</p>
                <p className="text-sm text-blue-600 mt-1">Release to upload your policy PDF</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-semibold text-gray-800">
                  Drop PDF here or <span className="text-[#1e3a5f] underline">click to browse</span>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Supports any Indian insurance policy PDF — max 25MB
                </p>
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-2 bg-[#1e3a5f] hover:bg-[#162e4d] text-white"
              disabled={upload.isLoading}
            >
              Select PDF File
            </Button>
          </div>
        </div>

        {/* File preview (after selection before loading completes) */}
        {upload.fileName && !upload.isLoading && (
          <Card className="mt-4 p-4 flex items-center gap-3 bg-blue-50 border-blue-200">
            <FileText className="h-8 w-8 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{upload.fileName}</p>
              <p className="text-xs text-gray-500">{upload.fileSize ? formatFileSize(upload.fileSize) : ''}</p>
            </div>
          </Card>
        )}

        {/* Loading / Progress */}
        {upload.isLoading && (
          <Card className="mt-6 p-6 space-y-4 bg-white border shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700 truncate">{upload.fileName}</span>
              {upload.fileSize && (
                <span className="text-xs text-gray-400">{formatFileSize(upload.fileSize)}</span>
              )}
            </div>

            <div className="space-y-2">
              {EXTRACTION_STEPS.map((step, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    i < extractionStep
                      ? 'text-green-700'
                      : i === extractionStep
                      ? 'text-[#1e3a5f] font-semibold bg-blue-50'
                      : 'text-gray-400'
                  }`}
                >
                  <span className="text-base w-5 text-center flex-shrink-0">
                    {i < extractionStep ? (
                      <CheckCircle className="h-4 w-4 text-green-600 inline" />
                    ) : i === extractionStep ? (
                      <span className="animate-spin inline-block">⏳</span>
                    ) : (
                      '○'
                    )}
                  </span>
                  <span className="text-sm">{step}</span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
              <div
                className="bg-[#1e3a5f] h-1.5 rounded-full transition-all duration-700"
                style={{ width: `${((extractionStep + 1) / EXTRACTION_STEPS.length) * 100}%` }}
              />
            </div>
          </Card>
        )}

        {/* Error State */}
        {upload.error && (
          <Card className="mt-6 p-5 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Extraction Error</p>
                <p className="text-sm text-red-700 mt-1">{upload.error}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUpload(prev => ({ ...prev, error: null }))}
              >
                Try Again
              </Button>
              {selectedFile && (
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => {
                    // Go to verification with empty extracted data for manual fill
                    setUpload(prev => ({
                      ...prev,
                      step: 'verification',
                      error: null,
                      extracted: {
                        holder_name: null, holder_phone: null, holder_email: null,
                        holder_dob: null, holder_address: null, holder_pan: null,
                        policy_number: null, insurer_name: null, policy_type: null,
                        plan_name: null, sum_insured: null, premium_amount: null,
                        premium_frequency: null, gst_amount: null, total_premium: null,
                        issue_date: null, start_date: null, expiry_date: null,
                        vehicle_number: null, vehicle_make: null, vehicle_model: null,
                        vehicle_year: null, idv_value: null, engine_number: null,
                        chassis_number: null, family_members: [], sum_insured_per_member: null,
                        nominee_name: null, nominee_relation: null, death_benefit: null,
                        policy_term: null, premium_paying_term: null,
                        extraction_confidence: 'low',
                        extraction_notes: 'Automatic extraction failed. Please fill in the details manually.',
                        ai_model_used: 'none',
                      },
                    }))
                  }}
                >
                  Fill Manually
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    )
  }

  // ── STEP 2: Verification ──────────────────────────────────────────────
  if (upload.step === 'verification' && upload.extracted) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Extracted Details</h1>
          <p className="text-gray-600">Review the information extracted by AI and correct any mistakes before saving.</p>
        </div>

        {upload.error && (
          <Card className="mb-6 p-5 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{upload.error}</p>
            </div>
          </Card>
        )}

        <VerificationForm
          extracted={upload.extracted}
          pdfUrl={upload.pdfUrl}
          onConfirm={handleConfirm}
          onScanAgain={selectedFile ? async () => {
            setUpload(prev => ({ ...prev, step: 'upload', extracted: null, error: null }))
            await performExtraction(selectedFile)
          } : undefined}
          onCancel={() =>
            setUpload(prev => ({ ...prev, step: 'upload', extracted: null, error: null }))
          }
          isLoading={upload.isLoading}
        />
      </div>
    )
  }

  return null
}
