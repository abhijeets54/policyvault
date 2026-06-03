'use client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import type { ExtractedPolicyData, FamilyMember } from '@/lib/types'
import { useState } from 'react'

type FormData = ExtractedPolicyData & { notes?: string | null; ai_model_used?: string }

interface VerificationFormProps {
  extracted: ExtractedPolicyData & { ai_model_used: string }
  pdfUrl: string | null
  onConfirm: (data: any) => Promise<void>
  onCancel: () => void
  onScanAgain?: () => void   // re-runs AI extraction on same file
  isLoading?: boolean
}

export function VerificationForm({ extracted, pdfUrl, onConfirm, onCancel, onScanAgain, isLoading }: VerificationFormProps) {
  const [formData, setFormData] = useState<FormData>(extracted as FormData)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(extracted.family_members || [])

  const confidenceColors = {
    high: 'bg-green-50 border-green-300',
    medium: 'bg-yellow-50 border-yellow-300',
    low: 'bg-red-50 border-red-300',
  }

  const confidenceIcons = {
    high: '🟢',
    medium: '🟡',
    low: '🔴',
  }

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddFamilyMember = () => {
    setFamilyMembers([...familyMembers, { name: '', dob: null, relation: 'self', age: null }])
  }

  const handleRemoveFamilyMember = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index))
  }

  const handleFamilyMemberChange = (index: number, field: string, value: any) => {
    const updated = [...familyMembers]
    updated[index] = { ...updated[index], [field]: value }
    setFamilyMembers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.holder_name || !formData.policy_number || !formData.insurer_name || !formData.expiry_date) {
      alert('Please fill in required fields: Holder Name, Policy Number, Insurer Name, Expiry Date')
      return
    }

    await onConfirm({ ...formData, family_members: familyMembers })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: PDF Viewer */}
      <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100 h-[600px]">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full"
            title="Policy PDF"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>PDF preview not available</p>
          </div>
        )}
      </div>

      {/* Right: Extracted Data Form */}
      <div className="space-y-4 overflow-y-auto max-h-[600px] pr-4">
        {/* Confidence Banner */}
        <Card className={`p-4 border-2 ${confidenceColors[extracted.extraction_confidence || 'medium']}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{confidenceIcons[extracted.extraction_confidence || 'medium']}</span>
            <div>
              <p className="font-semibold">
                {extracted.extraction_confidence === 'high' && 'High Confidence — Please verify'}
                {extracted.extraction_confidence === 'medium' && 'Medium Confidence — Some fields may need correction'}
                {extracted.extraction_confidence === 'low' && 'Low Confidence — Please review all fields'}
              </p>
              <p className="text-sm text-gray-600">AI used: {extracted.ai_model_used}</p>
            </div>
          </div>
        </Card>

        {/* Extraction Notes */}
        {extracted.extraction_notes && (
          <Card className="p-4 bg-amber-50 border-amber-300">
            <p className="text-sm font-semibold text-amber-900">⚠️ AI Notes:</p>
            <p className="text-sm text-amber-800">{extracted.extraction_notes}</p>
          </Card>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Accordion type="single" collapsible defaultValue="personal">
            {/* Personal Information */}
            <AccordionItem value="personal">
              <AccordionTrigger>Personal Information</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={formData.holder_name || ''}
                    onChange={(e) => handleFieldChange('holder_name', e.target.value)}
                    className={!formData.holder_name ? 'border-yellow-300' : ''}
                    required
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.holder_phone || ''}
                    onChange={(e) => handleFieldChange('holder_phone', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.holder_email || ''}
                    onChange={(e) => handleFieldChange('holder_email', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.holder_dob || ''}
                    onChange={(e) => handleFieldChange('holder_dob', e.target.value)}
                  />
                </div>
                <div>
                  <Label>PAN</Label>
                  <Input
                    value={formData.holder_pan || ''}
                    onChange={(e) => handleFieldChange('holder_pan', e.target.value)}
                    placeholder="XXXXXXXXXXXXXXX"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={formData.holder_address || ''}
                    onChange={(e) => handleFieldChange('holder_address', e.target.value)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Policy Information */}
            <AccordionItem value="policy">
              <AccordionTrigger>Policy Information</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div>
                  <Label>Policy Number *</Label>
                  <Input
                    value={formData.policy_number || ''}
                    onChange={(e) => handleFieldChange('policy_number', e.target.value)}
                    className={!formData.policy_number ? 'border-yellow-300' : ''}
                    required
                  />
                </div>
                <div>
                  <Label>Insurer Name *</Label>
                  <Input
                    value={formData.insurer_name || ''}
                    onChange={(e) => handleFieldChange('insurer_name', e.target.value)}
                    className={!formData.insurer_name ? 'border-yellow-300' : ''}
                    required
                  />
                </div>
                <div>
                  <Label>Policy Type</Label>
                  <select
                    value={formData.policy_type || ''}
                    onChange={(e) => handleFieldChange('policy_type', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select type</option>
                    <option value="health">Health</option>
                    <option value="car">Car</option>
                    <option value="bike">Bike</option>
                    <option value="life">Life</option>
                    <option value="home">Home</option>
                    <option value="travel">Travel</option>
                    <option value="commercial">Commercial</option>
                    <option value="fire">Fire</option>
                    <option value="marine">Marine</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Plan Name</Label>
                  <Input
                    value={formData.plan_name || ''}
                    onChange={(e) => handleFieldChange('plan_name', e.target.value)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Financial Information */}
            <AccordionItem value="financial">
              <AccordionTrigger>Financial Information</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div>
                  <Label>Sum Insured (₹)</Label>
                  <Input
                    type="number"
                    value={formData.sum_insured || ''}
                    onChange={(e) => handleFieldChange('sum_insured', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <Label>Premium Amount (₹)</Label>
                  <Input
                    type="number"
                    value={formData.premium_amount || ''}
                    onChange={(e) => handleFieldChange('premium_amount', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <Label>Premium Frequency</Label>
                  <select
                    value={formData.premium_frequency || ''}
                    onChange={(e) => handleFieldChange('premium_frequency', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select frequency</option>
                    <option value="annual">Annual</option>
                    <option value="semi-annual">Semi-Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="single">Single</option>
                  </select>
                </div>
                <div>
                  <Label>GST Amount (₹)</Label>
                  <Input
                    type="number"
                    value={formData.gst_amount || ''}
                    onChange={(e) => handleFieldChange('gst_amount', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <Label>Total Premium (₹)</Label>
                  <Input
                    type="number"
                    value={formData.total_premium || ''}
                    onChange={(e) => handleFieldChange('total_premium', e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Dates */}
            <AccordionItem value="dates">
              <AccordionTrigger>Important Dates</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div>
                  <Label>Issue Date</Label>
                  <Input
                    type="date"
                    value={formData.issue_date || ''}
                    onChange={(e) => handleFieldChange('issue_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => handleFieldChange('start_date', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Expiry Date *</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date || ''}
                    onChange={(e) => handleFieldChange('expiry_date', e.target.value)}
                    className={!formData.expiry_date ? 'border-yellow-300' : ''}
                    required
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Vehicle Information (for motor policies) */}
            {['car', 'bike'].includes(formData.policy_type || '') && (
              <AccordionItem value="vehicle">
                <AccordionTrigger>Vehicle Information</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <div>
                    <Label>Vehicle Number</Label>
                    <Input
                      value={formData.vehicle_number || ''}
                      onChange={(e) => handleFieldChange('vehicle_number', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Make</Label>
                    <Input
                      value={formData.vehicle_make || ''}
                      onChange={(e) => handleFieldChange('vehicle_make', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Input
                      value={formData.vehicle_model || ''}
                      onChange={(e) => handleFieldChange('vehicle_model', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Year</Label>
                    <Input
                      type="number"
                      value={formData.vehicle_year || ''}
                      onChange={(e) => handleFieldChange('vehicle_year', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <Label>IDV Value (₹)</Label>
                    <Input
                      type="number"
                      value={formData.idv_value || ''}
                      onChange={(e) => handleFieldChange('idv_value', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <Label>Engine Number</Label>
                    <Input
                      value={formData.engine_number || ''}
                      onChange={(e) => handleFieldChange('engine_number', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Chassis Number</Label>
                    <Input
                      value={formData.chassis_number || ''}
                      onChange={(e) => handleFieldChange('chassis_number', e.target.value)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Health Information */}
            {formData.policy_type === 'health' && (
              <AccordionItem value="health">
                <AccordionTrigger>Family Members</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  {familyMembers.map((member, idx) => (
                    <Card key={idx} className="p-3 space-y-2">
                      <Input
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => handleFamilyMemberChange(idx, 'name', e.target.value)}
                      />
                      <Input
                        type="date"
                        placeholder="DOB"
                        value={member.dob || ''}
                        onChange={(e) => handleFamilyMemberChange(idx, 'dob', e.target.value)}
                      />
                      <select
                        value={member.relation}
                        onChange={(e) => handleFamilyMemberChange(idx, 'relation', e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                      >
                        <option value="self">Self</option>
                        <option value="spouse">Spouse</option>
                        <option value="son">Son</option>
                        <option value="daughter">Daughter</option>
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="other">Other</option>
                      </select>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveFamilyMember(idx)}
                      >
                        Remove
                      </Button>
                    </Card>
                  ))}
                  <Button type="button" variant="outline" onClick={handleAddFamilyMember}>
                    + Add Member
                  </Button>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Life Insurance Information */}
            {formData.policy_type === 'life' && (
              <AccordionItem value="life">
                <AccordionTrigger>Life Insurance Details</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-4">
                  <div>
                    <Label>Nominee Name</Label>
                    <Input
                      value={formData.nominee_name || ''}
                      onChange={(e) => handleFieldChange('nominee_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Nominee Relation</Label>
                    <Input
                      value={formData.nominee_relation || ''}
                      onChange={(e) => handleFieldChange('nominee_relation', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Death Benefit (₹)</Label>
                    <Input
                      type="number"
                      value={formData.death_benefit || ''}
                      onChange={(e) => handleFieldChange('death_benefit', e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                  <div>
                    <Label>Policy Term</Label>
                    <Input
                      value={formData.policy_term || ''}
                      onChange={(e) => handleFieldChange('policy_term', e.target.value)}
                      placeholder="e.g., 20 years"
                    />
                  </div>
                  <div>
                    <Label>Premium Paying Term</Label>
                    <Input
                      value={formData.premium_paying_term || ''}
                      onChange={(e) => handleFieldChange('premium_paying_term', e.target.value)}
                      placeholder="e.g., 15 years"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Additional Notes */}
            <AccordionItem value="notes">
              <AccordionTrigger>Additional Notes</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-4">
                <div>
                  <Label>Notes</Label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    rows={4}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Action Buttons — Scan Again | Cancel | Confirm & Save */}
          <div className="flex flex-wrap gap-3 pt-6 border-t">
            <Button type="submit" className="flex-1 bg-[#1e3a5f] hover:bg-[#162e4d] text-white" disabled={isLoading}>
              {isLoading ? 'Saving...' : '✓ Confirm & Save'}
            </Button>
            {onScanAgain && (
              <Button type="button" variant="outline" onClick={onScanAgain} disabled={isLoading}>
                🔄 Scan Again
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
