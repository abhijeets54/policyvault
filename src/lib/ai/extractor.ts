// Note: pdf-parse is a CommonJS module — imported dynamically inside extractWithGroq()
// to avoid Next.js Webpack bundling issues. It is listed in serverComponentsExternalPackages.
import type { ExtractedPolicyData } from '@/lib/types'

// AI clients are intentionally NOT created at module level.
// Per Next.js + Vercel best practices, env vars are only available
// at request time, not during static build analysis.

// ──────────────────────────────────────────────
// THE EXTRACTION PROMPT — used for BOTH AI models
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
    // Try to find JSON object in the response
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as ExtractedPolicyData
    throw new Error('AI returned malformed JSON')
  }
}

// ──────────────────────────────────────────────
// PRIMARY: Gemini 2.5 Flash — handles PDFs natively via inlineData
// ──────────────────────────────────────────────
async function extractWithGemini(pdfBase64: string): Promise<ExtractedPolicyData> {
  // Instantiate inside function — never at module level (build would fail without env vars)
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const result = await model.generateContent([
    {
      inlineData: { data: pdfBase64, mimeType: 'application/pdf' },
    },
    EXTRACTION_PROMPT,
  ])

  return parseExtractionResult(result.response.text())
}

// ──────────────────────────────────────────────
// FALLBACK: Groq Llama 4 Scout (text-only)
//
// Groq does NOT support PDFs via image_url — only image/* MIME types are
// accepted for vision requests (per official Groq docs).
// We use `pdf-parse` to extract raw text, then send it as a text prompt.
// This is the officially supported approach and works reliably for
// text-based Indian insurance PDFs.
// ──────────────────────────────────────────────
async function extractWithGroq(pdfBuffer: Buffer): Promise<ExtractedPolicyData> {
  // Instantiate inside function — never at module level (build would fail without env vars)
  const Groq = (await import('groq-sdk')).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
  const pdfData = await pdfParse(pdfBuffer)

  // Truncate to 20 000 chars — stays well within Llama 4 Scout's token budget
  const pdfText = pdfData.text.trim().slice(0, 20_000)
  if (!pdfText) throw new Error('pdf-parse extracted no text — PDF may be image-only')

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    response_format: { type: 'json_object' }, // forces valid JSON output
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
    max_tokens: 2048,
    temperature: 0.1,
  })

  const text = response.choices[0]?.message?.content || ''
  return parseExtractionResult(text)
}

// ──────────────────────────────────────────────
// MAIN EXPORT — tries Gemini, falls back to Groq
// ──────────────────────────────────────────────
export async function extractPolicyFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedPolicyData & { ai_model_used: string }> {
  const pdfBase64 = pdfBuffer.toString('base64')

  // Try Gemini first
  try {
    const result = await extractWithGemini(pdfBase64)
    return { ...result, ai_model_used: 'gemini-2.5-flash' }
  } catch (geminiError) {
    console.warn('Gemini extraction failed, trying Groq:', geminiError)
  }

  // Fall back to Groq
  try {
    const result = await extractWithGroq(pdfBuffer)
    return { ...result, ai_model_used: 'groq-llama-4-scout' }
  } catch (groqError) {
    console.error('Both AI extractors failed:', groqError)
    // Return empty extraction so user can fill manually
    return {
      holder_name: null, holder_phone: null, holder_email: null,
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
      extraction_notes: 'Automatic extraction failed. Please fill in the details manually.',
      ai_model_used: 'none',
    }
  }
}
