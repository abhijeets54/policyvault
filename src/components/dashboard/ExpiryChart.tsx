'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns'

interface Props {
  data: { month: string; count: number }[]
}

export function ExpiryChart({ data }: Props) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Policies Expiring — Next 6 Months</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} policies`, '']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={index === 0 ? '#f59e0b' : '#93c5fd'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Build 6-month data from a list of policies with expiry dates */
export function buildChartData(expiryDates: (string | null)[]): { month: string; count: number }[] {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const date = addMonths(now, i)
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const count = expiryDates.filter(d => {
      if (!d) return false
      const dt = new Date(d)
      return dt >= start && dt <= end
    }).length
    return { month: format(date, 'MMM yy'), count }
  })
}
