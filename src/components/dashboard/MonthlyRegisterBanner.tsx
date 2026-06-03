'use client'
import { useEffect, useState } from 'react'
import { FileSpreadsheet, FileText, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MonthlyRegisterBanner() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthName = now.toLocaleString('en-IN', { month: 'long' })
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10)
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)
    fetch(`/api/policies?limit=500`)
      .then(r => r.json())
      .then(d => {
        const policies = d.policies || []
        const expiring = policies.filter((p: any) =>
          p.expiry_date && p.expiry_date >= monthStart && p.expiry_date <= monthEnd
        )
        setCount(expiring.length)
      })
      .catch(() => setCount(0))
  }, [])

  const downloadExcel = () => {
    window.open(`/api/export/monthly?month=${month}&year=${year}`, '_blank')
  }

  const downloadPDF = () => {
    window.open(`/api/export/monthly?month=${month}&year=${year}&format=pdf`, '_blank')
  }

  const [emailSending, setEmailSending] = useState(false)
  const [emailMsg, setEmailMsg] = useState<string | null>(null)

  const sendEmail = async () => {
    setEmailSending(true)
    setEmailMsg(null)
    try {
      const res = await fetch('/api/cron/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      const data = await res.json()
      setEmailMsg(data.success
        ? `✅ Register sent to your email!`
        : `❌ ${data.message || 'Failed to send'}`)
    } catch {
      setEmailMsg('❌ Failed to send. Please use the download buttons.')
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
            📋 Expiry Register — {monthName} {year}
          </h2>
          <p className="text-amber-700 text-sm mt-1">
            {count === null
              ? 'Loading...'
              : `${count} ${count === 1 ? 'policy expires' : 'policies expire'} this month`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={downloadExcel}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Download Excel
          </Button>
          <Button
            onClick={downloadPDF}
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-50 text-sm"
          >
            <FileText className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button
            onClick={sendEmail}
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-50 text-sm"
            disabled={emailSending}
          >
            <Mail className="h-4 w-4 mr-2" />
            {emailSending ? 'Sending...' : 'Send via Email'}
          </Button>
        </div>
      </div>
      {emailMsg && (
        <p className="mt-3 text-sm text-amber-900 bg-amber-100 border border-amber-300 rounded-lg px-4 py-2">
          {emailMsg}
        </p>
      )}
    </div>
  )
}
