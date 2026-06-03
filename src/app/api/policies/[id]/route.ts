import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS ensures they can only get their own policy
  const { data, error } = await supabase
    .from('policies').select('*').eq('id', params.id).single()
  
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ policy: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    
    // Remove sensitive fields that should not be updated
    delete body.user_id
    delete body.id
    delete body.created_at

    const { data, error } = await supabase
      .from('policies')
      .update(body)
      .eq('id', params.id)
      .select()
      .single()
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ policy: data })
  } catch (err) {
    console.error('PATCH /api/policies/[id] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update policy' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Get policy to delete PDF from storage
    const { data: policy } = await supabase
      .from('policies')
      .select('raw_pdf_path')
      .eq('id', params.id)
      .single()

    if (policy?.raw_pdf_path) {
      const adminClient = createAdminClient()
      await adminClient.storage.from('policies').remove([policy.raw_pdf_path])
    }

    const { error } = await supabase
      .from('policies')
      .delete()
      .eq('id', params.id)
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/policies/[id] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete policy' },
      { status: 500 }
    )
  }
}
