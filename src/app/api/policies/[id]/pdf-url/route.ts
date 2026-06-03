import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


// GET /api/policies/[id]/pdf-url — generate fresh signed URL for the policy PDF
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS: user can only get their own policy
  const { data: policy } = await supabase
    .from('policies')
    .select('raw_pdf_path')
    .eq('id', params.id)
    .single()

  if (!policy?.raw_pdf_path) return NextResponse.json({ url: null })

  const adminClient = createAdminClient()
  const { data } = await adminClient.storage
    .from('policies')
    .createSignedUrl(policy.raw_pdf_path, 60 * 30) // 30 minutes

  return NextResponse.json({ url: data?.signedUrl ?? null })
}
