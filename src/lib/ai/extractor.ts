// Note: pdf-parse is a CommonJS module — imported dynamically to avoid
// Next.js Webpack bundling issues. Listed in serverComponentsExternalPackages.
import type { ExtractedPolicyData } from '@/lib/types'

// ──────────────────────────────────────────────
// RETRY UTILITY — exponential backoff, no npm dep
// ──────────────────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelay?: number; label?: string } = {}
): Promise<T> {
  const { retries = 2, baseDelay = 1000, label = 'operation' } = opts
  let lastError: Error | unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500
        console.warn(
          `[extractor] ${label} attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : err}. Retrying in ${Math.round(delay)}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

// ──────────────────────────────────────────────
// THE EXTRACTION PROMPT — India-Specific
// ──────────────────────────────────────────────
const EXTRACTION_PROMPT = `
You are an expert insurance document parser specializing in INDIAN insurance policies.
Analyze this insurance policy document carefully and extract all available information.

STRICT RULES:
1. Return ONLY valid JSON — no explanation, no markdown fences, no preamble.
2. If a field is not found in the document, return null for that field.
3. ALL dates must be in "YYYY-MM-DD" format. Convert from any Indian format:
   - DD/MM/YYYY → YYYY-MM-DD
   - DD-MM-YYYY → YYYY-MM-DD
   - DD-MMM-YYYY (e.g. 15-Jan-2025) → 2025-01-15
   - DD MMM YYYY (e.g. 15 January 2025) → 2025-01-15
   - Be careful: in India, DD/MM/YYYY is standard (day first, NOT month first).
4. ALL monetary amounts must be plain numbers (no ₹ sign, no commas).
   Example: 500000 not ₹5,00,000. Indian lakh format uses commas as: 5,00,000 = 500000.
5. policy_type must be exactly one of: health, car, bike, life, home, travel, commercial, fire, marine, other.
6. For health policies: list ALL insured family members in family_members array.
7. For motor (car/bike) policies: extract vehicle_number carefully.
   Indian vehicle registration formats: MH12AB1234, DL01C1234, KA05MN5678, TN22XY9012.
   Pattern: [State 2 letters][District 2 digits][Series 1-2 letters][Number 1-4 digits]
8. insurer_name = full official name. Recognize these common Indian insurers:
   - LIC (Life Insurance Corporation of India)
   - HDFC Life, HDFC Ergo General Insurance
   - ICICI Prudential Life, ICICI Lombard General Insurance
   - SBI Life Insurance, SBI General Insurance
   - Star Health and Allied Insurance
   - Max Life Insurance, Max Bupa (now Niva Bupa)
   - Bajaj Allianz Life / General Insurance
   - Tata AIG General Insurance, Tata AIA Life Insurance
   - Kotak Mahindra Life Insurance
   - New India Assurance, United India Insurance, National Insurance, Oriental Insurance (PSU)
   - Care Health Insurance (formerly Religare Health)
   - Aditya Birla Health / Sun Life Insurance
   - Reliance General Insurance / Nippon Life
   - Future Generali, Edelweiss Tokio, Bharti AXA (now merged into ICICI)
   - Chola MS General Insurance
   - Digit Insurance, Acko General Insurance, Go Digit (new-age)
   - Royal Sundaram General Insurance
9. PAN format: 5 uppercase letters + 4 digits + 1 uppercase letter (e.g. ABCDE1234F).
10. GST on insurance premiums in India is 18% for health and motor, 4.5% for term life.
    If total_premium is present but gst_amount is missing, you can estimate:
    gst_amount ≈ premium_amount × 0.18 (health/motor) or × 0.045 (life).
    If premium_amount + gst_amount ≈ total_premium, that confirms correctness.
11. extraction_confidence: "high" if you can read everything clearly, "medium" if some parts were unclear, "low" if you struggled.
12. extraction_notes: note anything unusual, fields that looked ambiguous, or data you are unsure about.

RETURN THIS EXACT JSON STRUCTURE:
{
  "referred_by": null,
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
// GEMINI 2.5 Flash (PRIMARY — handles scanned PDFs natively)
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
// GROQ Llama 4 Scout (FALLBACK — text-only, cannot handle scans)
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
// Check if a PDF has extractable text (not image-only)
// ──────────────────────────────────────────────
async function pdfHasText(pdfBuffer: Buffer): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
    const pdfData = await pdfParse(pdfBuffer)
    const text = pdfData.text.trim()
    // Consider it "has text" if there are at least 50 chars of meaningful content
    return text.length >= 50
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────
// MAIN EXPORT
// Strategy: Gemini ALWAYS first (handles scans natively)
//           Groq fallback ONLY if Gemini fails AND PDF has text
// ──────────────────────────────────────────────
export async function extractPolicyFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedPolicyData & { ai_model_used: string }> {
  const sizeMb = pdfBuffer.length / (1024 * 1024)
  console.log(`[extractor] PDF size: ${sizeMb.toFixed(2)} MB`)

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
    extraction_confidence: 'low' as const,
    extraction_notes: 'Automatic extraction failed. Please fill in the details manually.',
    ai_model_used: 'none',
  }

  // ── Step 1: Always try Gemini first (with retry) ──
  try {
    console.log('[extractor] Trying Gemini 2.5 Flash (primary)...')
    const result = await withRetry(() => extractWithGemini(pdfBuffer), {
      retries: 2,
      baseDelay: 1000,
      label: 'Gemini',
    })
    console.log('[extractor] Gemini succeeded')
    return { ...result, ai_model_used: 'gemini-2.5-flash' }
  } catch (geminiError) {
    console.error(
      '[extractor] Gemini failed after retries:',
      geminiError instanceof Error ? geminiError.message : geminiError
    )
  }

  // ── Step 2: Fallback to Groq ONLY if the PDF has extractable text ──
  const hasText = await pdfHasText(pdfBuffer)
  if (!hasText) {
    console.warn('[extractor] PDF has no extractable text — Groq cannot process it. Returning empty.')
    return defaultErrorResponse as ExtractedPolicyData & { ai_model_used: string }
  }

  try {
    console.log('[extractor] Falling back to Groq Llama 4 Scout...')
    const result = await withRetry(() => extractWithGroq(pdfBuffer), {
      retries: 1,
      baseDelay: 1000,
      label: 'Groq',
    })
    console.log('[extractor] Groq fallback succeeded')
    return { ...result, ai_model_used: 'groq-llama-4-scout' }
  } catch (groqError) {
    console.error(
      '[extractor] Groq fallback failed:',
      groqError instanceof Error ? groqError.message : groqError
    )
  }

  // ── Both failed ──
  return defaultErrorResponse as ExtractedPolicyData & { ai_model_used: string }
}
