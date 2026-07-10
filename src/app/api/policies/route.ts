import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const month = searchParams.get('month')  // "MM" for monthly register
  const year = searchParams.get('year')    // "YYYY"
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  // RLS ensures user only gets their own policies
  let query = supabase
    .from('policies')
    .select('*', { count: 'exact' })
    .order('expiry_date', { ascending: true })

  if (search) {
    query = query.or(
      `holder_name.ilike.%${search}%,policy_number.ilike.%${search}%,` +
      `holder_phone.ilike.%${search}%,vehicle_number.ilike.%${search}%`
    )
  }
  
  if (type && type !== 'all') {
    query = query.eq('policy_type', type)
  }
  
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  // Monthly register filter: policies expiring in the given month
  if (month && year) {
    const startDate = `${year}-${month.padStart(2, '0')}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0)
      .toISOString().split('T')[0]
    query = query.gte('expiry_date', startDate).lte('expiry_date', endDate)
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    policies: data || [],
    count: count || 0,
    page,
    limit,
    total_pages: Math.ceil((count || 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()

    // Strip fields that don't exist as columns in the policies schema.
    // ai_model_used and extraction_notes are returned by the AI extractor but
    // are not schema columns — passing them to .insert() causes a PostgREST
    // "column not found in schema cache" 500 error.
    // We preserve both values inside extracted_fields (JSONB) so nothing is lost.
    // _corrections is our correction tracking payload — also not a DB column.
    const {
      ai_model_used,
      extraction_notes,
      _corrections,
      extracted_fields: existingExtractedFields,
      ...rest
    } = body

    // Merge ai_model_used + extraction_notes into extracted_fields for audit purposes
    const extracted_fields = {
      ...(existingExtractedFields && typeof existingExtractedFields === 'object'
        ? existingExtractedFields
        : {}),
      ...(ai_model_used   !== undefined && { ai_model_used }),
      ...(extraction_notes !== undefined && { extraction_notes }),
    }

    // Force user_id to the authenticated user — never trust client
    const { data, error } = await supabase
      .from('policies')
      .insert({ ...rest, extracted_fields, user_id: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // ── Log field corrections (if any) for the feedback loop ──
    if (Array.isArray(_corrections) && _corrections.length > 0 && data?.id) {
      try {
        const adminClient = createAdminClient()
        const correctionRows = _corrections.map((c: {
          field_name: string
          ai_value: string | null
          corrected_value: string | null
        }) => ({
          policy_id: data.id,
          user_id: user.id,
          field_name: c.field_name,
          ai_value: c.ai_value,
          corrected_value: c.corrected_value,
          insurer_name: rest.insurer_name || null,
          ai_model_used: ai_model_used || null,
        }))

        const { error: corrErr } = await adminClient
          .from('extraction_corrections')
          .insert(correctionRows)

        if (corrErr) {
          // Non-fatal: log but don't fail the policy save
          console.error('[corrections] Failed to save corrections:', corrErr.message)
        } else {
          console.log(`[corrections] Logged ${correctionRows.length} field corrections for policy ${data.id}`)
        }
      } catch (corrError) {
        console.error('[corrections] Error saving corrections:', corrError)
      }
    }

    return NextResponse.json({ policy: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/policies error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create policy' },
      { status: 500 }
    )
  }
}