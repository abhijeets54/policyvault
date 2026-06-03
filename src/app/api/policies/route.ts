import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Force user_id to the authenticated user — never trust client
    const { data, error } = await supabase
      .from('policies')
      .insert({ ...body, user_id: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ policy: data }, { status: 201 })
  } catch (err) {
    console.error('POST /api/policies error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create policy' },
      { status: 500 }
    )
  }
}
