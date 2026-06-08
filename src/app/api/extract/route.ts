import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractPolicyFromPDF } from '@/lib/ai/extractor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/extract
 *
 * Accepts JSON body: { pdfPath: string }
 * where pdfPath is the Supabase Storage path already uploaded by the client.
 *
 * The client uploads the PDF directly to Supabase Storage (bypassing Vercel's
 * 4.5 MB serverless body limit), then sends just the path here so the server
 * can fetch the file and run AI extraction.
 */
export async function POST(req: NextRequest) {
  // 1. Verify auth server-side — never trust client
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { pdfPath } = body as { pdfPath?: string }

    if (!pdfPath) {
      return NextResponse.json({ error: 'No pdfPath provided' }, { status: 400 })
    }

    // Ensure the path belongs to this user (security: path must start with user's id)
    if (!pdfPath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // 2. Generate a signed URL so the AI can read the file
    const { data: signedData, error: signErr } = await adminClient.storage
      .from('policies')
      .createSignedUrl(pdfPath, 60 * 30)

    if (signErr || !signedData?.signedUrl) {
      console.error('[extract] Signed URL error:', signErr?.message)
      return NextResponse.json({ error: 'Could not access uploaded file' }, { status: 500 })
    }

    const pdfUrl = signedData.signedUrl

    // 3. Download the PDF from storage into a buffer for AI extraction
    console.log('[extract] Downloading PDF from storage...')
    const pdfResponse = await fetch(pdfUrl)
    if (!pdfResponse.ok) {
      return NextResponse.json({ error: 'Failed to download PDF from storage' }, { status: 500 })
    }
    const buffer = Buffer.from(await pdfResponse.arrayBuffer())
    console.log(`[extract] PDF downloaded: ${buffer.length} bytes`)

    // 4. Run AI extraction
    const extracted = await extractPolicyFromPDF(buffer)
    console.log(`[extract] Extraction complete. Model used: ${extracted.ai_model_used}`)

    // 5. Return for user review — DO NOT SAVE YET (mandatory verification step)
    return NextResponse.json({
      success: true,
      extracted,
      pdfUrl,
      pdfPath,
      requiresConfirmation: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed'
    console.error('[extract] Fatal error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
