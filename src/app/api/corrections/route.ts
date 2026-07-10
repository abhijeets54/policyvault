import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/corrections
 *
 * Returns correction statistics for the current user's extractions.
 * Useful for understanding which fields the AI gets wrong most often
 * and which insurers have the worst extraction accuracy.
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Fetch all corrections for this user
    const { data: corrections, error } = await supabase
      .from('extraction_corrections')
      .select('field_name, ai_value, corrected_value, insurer_name, ai_model_used, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[corrections] Query error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Compute stats: most corrected fields
    const fieldCounts: Record<string, number> = {}
    const insurerCounts: Record<string, number> = {}

    for (const c of corrections || []) {
      fieldCounts[c.field_name] = (fieldCounts[c.field_name] || 0) + 1
      if (c.insurer_name) {
        insurerCounts[c.insurer_name] = (insurerCounts[c.insurer_name] || 0) + 1
      }
    }

    // Sort by frequency
    const topFields = Object.entries(fieldCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([field, count]) => ({ field, count }))

    const topInsurers = Object.entries(insurerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([insurer, count]) => ({ insurer, count }))

    return NextResponse.json({
      total_corrections: corrections?.length || 0,
      top_corrected_fields: topFields,
      top_corrected_insurers: topInsurers,
      recent: (corrections || []).slice(0, 20),
    })
  } catch (err) {
    console.error('[corrections] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch corrections' },
      { status: 500 }
    )
  }
}
