/**
 * Legacy Gemini wrapper — kept for compatibility.
 * The main AI extraction pipeline is in lib/ai/extractor.ts
 * which is used by the /api/extract route.
 */
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ExtractedPolicyData } from "@/lib/types"

const PROMPT = `You are an expert insurance document parser for Indian insurance policies.
Extract all available information and return ONLY valid JSON — no markdown, no preamble.
Use the exact field names from the schema. Return null for any field you cannot find.
Dates must be YYYY-MM-DD format. Monetary values must be plain numbers.`

export async function extractWithGemini(pdf: Buffer): Promise<ExtractedPolicyData> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY is not set")
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  })

  const result = await model.generateContent([
    { inlineData: { data: pdf.toString("base64"), mimeType: "application/pdf" } },
    { text: PROMPT },
  ])
  const text = result.response.text()
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  return JSON.parse(clean) as ExtractedPolicyData
}
