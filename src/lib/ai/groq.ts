/**
 * Legacy Groq wrapper — kept for compatibility.
 * The main AI extraction pipeline is in lib/ai/extractor.ts
 * which is used by the /api/extract route.
 */
import Groq from "groq-sdk"
import type { ExtractedPolicyData } from "@/lib/types"

const SYSTEM = `You extract structured insurance-policy data. Return ONLY JSON. No prose.`

const USER = (text: string) => `Extract this schema from the policy text below. Use null when unknown. Dates must be YYYY-MM-DD.
Return only the JSON object, no explanation.

POLICY TEXT:
"""${text.slice(0, 20000)}"""`

export async function extractWithGroq(pdfText: string): Promise<ExtractedPolicyData> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not set")
  const groq = new Groq({ apiKey: key })
  const completion = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER(pdfText) },
    ],
    temperature: 0.1,
  })
  const text = completion.choices[0]?.message?.content ?? "{}"
  return JSON.parse(text) as ExtractedPolicyData
}
