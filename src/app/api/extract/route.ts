import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractPolicyFromPDF } from '@/lib/ai/extractor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  // 1. Verify auth server-side — never trust client
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }

    // 2. Upload PDF to Supabase Storage using admin client (user's own folder)
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const adminClient = createAdminClient()
    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from('policies')
      .upload(fileName, buffer, { contentType: 'application/pdf', upsert: false })

    if (uploadErr) {
      console.error('Upload error:', uploadErr.message)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    const pdfPath = uploadData?.path || null

    // 3. Generate a signed URL (30 min) — never use public URL from private bucket
    let pdfUrl: string | null = null
    if (pdfPath) {
      const { data: signedData, error: signErr } = await adminClient.storage
        .from('policies')
        .createSignedUrl(pdfPath, 60 * 30)
      if (!signErr && signedData?.signedUrl) {
        pdfUrl = signedData.signedUrl
      }
    }

    // 4. Run AI extraction
    const extracted = await extractPolicyFromPDF(buffer)

    // 5. Return for user review — DO NOT SAVE YET (mandatory verification step)
    return NextResponse.json({
      success: true,
      extracted,
      pdfUrl,
      pdfPath,
      requiresConfirmation: true,
    })
  } catch (err) {
    console.error('Extract error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}
