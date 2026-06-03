/**
 * Legacy extract orchestrator — kept for compatibility.
 * The main AI extraction pipeline is in lib/ai/extractor.ts
 * which is used by the /api/extract route.
 */
import { extractWithGemini } from "./gemini"
import { extractWithGroq } from "./groq"
import type { ExtractedPolicyData } from "@/lib/types"

export type ExtractionResult = {
  data: ExtractedPolicyData
  source: "gemini" | "groq"
  raw: unknown
}

function score(d: ExtractedPolicyData) {
  let s = 0
  for (const v of Object.values(d)) if (v !== null && v !== undefined && v !== '') s++
  return s
}

export async function extractPolicy(pdf: Buffer): Promise<ExtractionResult> {
  // 1) Try Gemini (native PDF understanding).
  try {
    const data = await extractWithGemini(pdf)
    if (score(data) >= 3) return { data, source: "gemini", raw: data }
  } catch (e) {
    console.warn("[extract] Gemini failed:", (e as Error).message)
  }

  // 2) Fallback: Groq with PDF text.
  try {
    // For Groq fallback, convert PDF to text first
    const pdfParse = await import('pdf-parse').catch(() => null)
    let pdfText = ''
    if (pdfParse) {
      const parsed = await pdfParse.default(pdf)
      pdfText = parsed.text
    }
    const data = await extractWithGroq(pdfText || pdf.toString('base64').slice(0, 10000))
    return { data, source: "groq", raw: data }
  } catch (e) {
    console.error("[extract] Groq also failed:", (e as Error).message)
    throw e
  }
}
