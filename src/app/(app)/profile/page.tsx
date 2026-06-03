'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { Save, LogOut } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Partial<Profile>>({})
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setProfile(data)
          setLoading(false)
        })
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      company_name: profile.company_name,
      phone: profile.phone,
    }).eq('id', user.id)
    if (error) setError(error.message)
    else { setSuccess(true); setTimeout(() => setSuccess(false), 3000) }
    setSaving(false)
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else { setNewPassword(''); setSuccess(true); setTimeout(() => setSuccess(false), 3000) }
    setChangingPassword(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) return <div className="max-w-lg mx-auto py-12 text-center text-gray-400">Loading...</div>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>
        <p className="text-gray-500 text-sm mt-1">{email}</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">✓ Saved successfully!</div>}

      {/* Profile form */}
      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Personal Information</h2>
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={profile.full_name ?? ''} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Company / Firm Name</Label>
          <Input value={profile.company_name ?? ''} onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={profile.phone ?? ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={email} disabled className="bg-gray-50 text-gray-500" />
          <p className="text-xs text-gray-400">Email cannot be changed. Contact admin.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />{saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Change Password</h2>
        <div className="space-y-2">
          <Label>New Password</Label>
          <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 characters" />
        </div>
        <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline" className="w-full">
          {changingPassword ? 'Changing…' : 'Change Password'}
        </Button>
      </div>

      {/* Plan info */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-2">Subscription</h2>
        <div className="flex items-center gap-2">
          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">Free Plan</span>
          <span className="text-sm text-gray-500">Unlimited policies · All features included</span>
        </div>
      </div>

      {/* Sign out */}
      <Button variant="destructive" onClick={handleSignOut} className="w-full">
        <LogOut className="h-4 w-4 mr-2" />Sign Out
      </Button>
    </div>
  )
}
