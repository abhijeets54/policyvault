'use client'
import { useState, useEffect } from 'react'
import type { AlertLog } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function AlertsPage() {
  const [logs, setLogs] = useState<AlertLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => { setLogs(d.logs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const STATUS_COLOR: Record<string, string> = {
    sent: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    skipped: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alert History</h1>
        <p className="text-gray-500 text-sm mt-1">All expiry alerts sent for your policies</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Sent At</th>
              <th className="text-left p-3 font-medium text-gray-600">Alert Type</th>
              <th className="text-left p-3 font-medium text-gray-600">Message</th>
              <th className="text-left p-3 font-medium text-gray-600">Channels</th>
              <th className="text-left p-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No alerts sent yet.</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="border-t">
                  <td className="p-3 text-gray-600 text-xs">{formatDate(log.sent_at)}</td>
                  <td className="p-3 font-mono text-xs">{log.alert_type}</td>
                  <td className="p-3 text-gray-700">{log.message_preview}</td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      {(log.sent_via || []).map(ch => (
                        <span key={ch} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{ch}</span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLOR[log.status] ?? ''}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
