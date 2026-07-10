// Note: pdf-parse is a CommonJS module — imported dynamically to avoid
// Next.js Webpack bundling issues. Listed in serverComponentsExternalPackages.
import type { ExtractedPolicyData } from '@/lib/types'

// ──────────────────────────────────────────────
// THE EXTRACTION PROMPT
// ──────────────────────────────────────────────
const EXTRACTION_PROMPT = `
You are an expert insurance document parser for Indian insurance policies.
Analyze this insurance policy document carefully and extract all available information.

STRICT RULES:
1. Return ONLY valid JSON — no explanation, no markdown fences, no preamble.
2. If a field is not found in the document, return null for that field.
3. ALL dates must be in "YYYY-MM-DD" format. Convert from any Indian format (DD/MM/YYYY, DD-MMM-YYYY, etc.).
4. ALL monetary amounts must be plain numbers (no ₹ sign, no commas). Example: 500000 not ₹5,00,000.
5. policy_type must be exactly one of: health, car, bike, life, home, travel, commercial, fire, marine, other.
6. For health policies: list ALL insured family members in family_members array.
7. For motor (car/bike) policies: extract vehicle_number carefully — it's usually a registration number like MH12AB1234.
8. insurer_name = full official name of the insurance company.
9. extraction_confidence: "high" if you can read everything clearly, "medium" if some parts were unclear, "low" if you struggled.
10. extraction_notes: note anything unusual, fields that looked ambiguous, or data you are unsure about.

RETURN THIS EXACT JSON STRUCTURE:
{
  "holder_name": "Full name of primary insured person",
  "holder_phone": "10-digit mobile number or null",
  "holder_email": "email or null",
  "holder_dob": "YYYY-MM-DD or null",
  "holder_address": "full address or null",
  "holder_pan": "PAN number or null",
  "policy_number": "policy number string",
  "insurer_name": "full insurance company name",
  "policy_type": "health|car|bike|life|home|travel|commercial|fire|marine|other",
  "plan_name": "product/plan name",
  "sum_insured": number or null,
  "premium_amount": number or null,
  "premium_frequency": "annual|half-yearly|quarterly|monthly|single or null",
  "gst_amount": number or null,
  "total_premium": number or null,
  "issue_date": "YYYY-MM-DD or null",
  "start_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "vehicle_number": "registration number or null",
  "vehicle_make": "brand/manufacturer or null",
  "vehicle_model": "model name or null",
  "vehicle_year": integer or null,
  "idv_value": number or null,
  "engine_number": "or null",
  "chassis_number": "or null",
  "family_members": [
    {"name":"string","dob":"YYYY-MM-DD or null","relation":"self|spouse|son|daughter|father|mother|other","age":number or null}
  ],
  "sum_insured_per_member": number or null,
  "nominee_name": "for life policies or null",
  "nominee_relation": "or null",
  "death_benefit": number or null,
  "policy_term": "e.g. 20 years or null",
  "premium_paying_term": "e.g. 15 years or null",
  "extraction_confidence": "high|medium|low",
  "extraction_notes": "any notes about ambiguous data, or null"
}
`

// Clean JSON from AI response (remove markdown fences if AI adds them)
function cleanJSON(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

// Parse and validate JSON from AI
function parseExtractionResult(text: string): ExtractedPolicyData {
  const clean = cleanJSON(text)
  try {
    return JSON.parse(clean) as ExtractedPolicyData
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as ExtractedPolicyData
    throw new Error('AI returned malformed JSON')
  }
}

// ──────────────────────────────────────────────
// PRIMARY: Groq Llama 4 Scout (text extraction)
// ──────────────────────────────────────────────
async function extractWithGroq(pdfBuffer: Buffer): Promise<ExtractedPolicyData> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey })

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const pdfData = await pdfParse(pdfBuffer)

  // Truncate to 20 000 chars — stays well within Llama 4 Scout's context
  const pdfText = pdfData.text.trim().slice(0, 20_000)
  if (!pdfText) throw new Error('pdf-parse extracted no text — PDF may be image-only')

  console.log(`[extractor] Extracted ${pdfText.length} chars of text from PDF for Groq`)

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are an expert insurance document parser for Indian insurance policies. ' +
          'Return ONLY valid JSON matching the schema. No prose, no markdown fences.',
      },
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\nPOLICY TEXT:\n"""\n${pdfText}\n"""`,
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  })

  const text = response.choices[0]?.message?.content || ''
  if (!text) throw new Error('Groq returned empty response')

  return parseExtractionResult(text)
}

// ──────────────────────────────────────────────
// PRIMARY: Gemini 2.5 Flash via @google/genai SDK
// ──────────────────────────────────────────────
async function extractWithGemini(pdfBuffer: Buffer): Promise<ExtractedPolicyData> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: EXTRACTION_PROMPT },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBuffer.toString('base64'),
        },
      },
    ],
    config: { temperature: 0.1, maxOutputTokens: 4096 },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned empty response')
  return parseExtractionResult(text)
}

// ──────────────────────────────────────────────
// MAIN EXPORT
// Strategy: Size-based routing
// If PDF > 4MB: Try Groq first, then Gemini
// If PDF <= 4MB: Try Gemini first, then Groq
// ──────────────────────────────────────────────
export async function extractPolicyFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedPolicyData & { ai_model_used: string }> {
  const sizeMb = pdfBuffer.length / (1024 * 1024)
  const isLargePdf = sizeMb > 4.0 // Threshold set to 4 MB

  console.log(`[extractor] PDF size: ${sizeMb.toFixed(2)} MB. isLargePdf: ${isLargePdf}`)

  const runGemini = async () => {
    console.log('[extractor] Trying Gemini 2.5 Flash...')
    const result = await extractWithGemini(pdfBuffer)
    console.log('[extractor] Gemini succeeded')
    return { ...result, ai_model_used: 'gemini-2.5-flash' }
  }

  const runGroq = async () => {
    console.log('[extractor] Trying Groq Llama 4 Scout...')
    const result = await extractWithGroq(pdfBuffer)
    console.log('[extractor] Groq succeeded')
    return { ...result, ai_model_used: 'groq-llama-4-scout' }
  }

  const defaultErrorResponse = {
    referred_by: null, holder_name: null, holder_phone: null, holder_email: null,
    holder_dob: null, holder_address: null, holder_pan: null,
    policy_number: null, insurer_name: null, policy_type: null,
    plan_name: null, sum_insured: null, premium_amount: null,
    premium_frequency: null, gst_amount: null, total_premium: null,
    issue_date: null, start_date: null, expiry_date: null,
    vehicle_number: null, vehicle_make: null, vehicle_model: null,
    vehicle_year: null, idv_value: null, engine_number: null,
    chassis_number: null, family_members: [], sum_insured_per_member: null,
    nominee_name: null, nominee_relation: null, death_benefit: null,
    policy_term: null, premium_paying_term: null,
    extraction_confidence: 'low',
    extraction_notes: 'Automatic extraction failed for both models. Please fill in the details manually.',
    ai_model_used: 'none',
  }

  if (isLargePdf) {
    // Large PDF: Groq first
    try {
      return await runGroq()
    } catch (groqError) {
      console.error('[extractor] Groq failed:', groqError instanceof Error ? groqError.message : groqError)
      try {
        console.log('[extractor] Falling back to Gemini...')
        return await runGemini()
      } catch (geminiError) {
        console.error('[extractor] Gemini fallback failed:', geminiError instanceof Error ? geminiError.message : geminiError)
        return defaultErrorResponse as ExtractedPolicyData & { ai_model_used: string }
      }
    }
  } else {
    // Small PDF: Gemini first
    try {
      return await runGemini()
    } catch (geminiError) {
      console.error('[extractor] Gemini failed:', geminiError instanceof Error ? geminiError.message : geminiError)
      try {
        console.log('[extractor] Falling back to Groq...')
        return await runGroq()
      } catch (groqError) {
        console.error('[extractor] Groq fallback failed:', groqError instanceof Error ? groqError.message : groqError)
        return defaultErrorResponse as ExtractedPolicyData & { ai_model_used: string }
      }
    }
  }
}
