import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  await supabase.auth.signOut()
  // Derive origin from request so this works in any environment (local, staging, prod)
  const origin = req.nextUrl.origin
  return NextResponse.redirect(new URL('/login', origin))
}
