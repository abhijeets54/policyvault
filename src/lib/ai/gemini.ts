/**
 * Legacy Gemini wrapper — updated to use the new @google/genai SDK.
 * The main AI extraction pipeline is in lib/ai/extractor.ts
 * which is used by the /api/extract route.
 */
import { GoogleGenAI } from '@google/genai'
import type { ExtractedPolicyData } from '@/lib/types'

const PROMPT = `You are an expert insurance document parser for Indian insurance policies.
Extract all available information and return ONLY valid JSON — no markdown, no preamble.
Use the exact field names from the schema. Return null for any field you cannot find.
Dates must be YYYY-MM-DD format. Monetary values must be plain numbers.`

export async function extractWithGemini(pdf: Buffer): Promise<ExtractedPolicyData> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: PROMPT },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdf.toString('base64'),
        },
      },
    ],
  })

  const text = response.text ?? ''
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(clean) as ExtractedPolicyData
}
