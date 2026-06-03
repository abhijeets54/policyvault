export type PolicyType =
  | 'health' | 'car' | 'bike' | 'life'
  | 'home' | 'travel' | 'commercial' | 'fire' | 'marine' | 'other'

export type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'lapsed' | 'pending'

export interface FamilyMember {
  name: string
  dob: string | null
  relation: 'self' | 'spouse' | 'son' | 'daughter' | 'father' | 'mother' | 'other'
  age: number | null
}

export interface Policy {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  // Holder
  holder_name: string | null
  holder_phone: string | null
  holder_email: string | null
  holder_dob: string | null
  holder_address: string | null
  holder_pan: string | null
  // Policy
  policy_number: string | null
  insurer_name: string | null
  policy_type: PolicyType | null
  plan_name: string | null
  // Financial
  sum_insured: number | null
  premium_amount: number | null
  premium_frequency: string | null
  gst_amount: number | null
  total_premium: number | null
  // Dates
  issue_date: string | null
  start_date: string | null
  expiry_date: string | null
  // Vehicle
  vehicle_number: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  idv_value: number | null
  engine_number: string | null
  chassis_number: string | null
  // Health
  family_members: FamilyMember[]
  sum_insured_per_member: number | null
  // Life
  nominee_name: string | null
  nominee_relation: string | null
  death_benefit: number | null
  policy_term: string | null
  premium_paying_term: string | null
  // Meta
  raw_pdf_url: string | null
  raw_pdf_path: string | null
  extracted_fields: Record<string, unknown>
  extraction_confidence: 'high' | 'medium' | 'low' | null
  notes: string | null
  status: PolicyStatus
  // Alerts
  alert_90_sent: boolean
  alert_60_sent: boolean
  alert_30_sent: boolean
  alert_15_sent: boolean
  alert_7_sent: boolean
  alert_3_sent: boolean
  alert_1_sent: boolean
  alert_expired_sent: boolean
}

export interface Profile {
  id: string
  created_at: string
  full_name: string
  email: string
  company_name: string | null
  phone: string | null
  role: 'agent' | 'admin'
  is_active: boolean
}

export interface AlertLog {
  id: string
  policy_id: string
  user_id: string
  alert_type: string
  sent_via: string[]
  message_preview: string
  sent_at: string
  status: 'sent' | 'failed' | 'skipped'
}

// What the AI returns after extracting from PDF
export interface ExtractedPolicyData {
  holder_name: string | null
  holder_phone: string | null
  holder_email: string | null
  holder_dob: string | null
  holder_address: string | null
  holder_pan: string | null
  policy_number: string | null
  insurer_name: string | null
  policy_type: PolicyType | null
  plan_name: string | null
  sum_insured: number | null
  premium_amount: number | null
  premium_frequency: string | null
  gst_amount: number | null
  total_premium: number | null
  issue_date: string | null
  start_date: string | null
  expiry_date: string | null
  vehicle_number: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  idv_value: number | null
  engine_number: string | null
  chassis_number: string | null
  family_members: FamilyMember[]
  sum_insured_per_member: number | null
  nominee_name: string | null
  nominee_relation: string | null
  death_benefit: number | null
  policy_term: string | null
  premium_paying_term: string | null
  extraction_confidence: 'high' | 'medium' | 'low'
  extraction_notes: string | null  // AI notes any issues
  notes?: string | null
  ai_model_used?: string
}
