'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'

const MAX_AVATAR_MB = 5

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileInputRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      // Defensive: an expired or partially-restored session can return a null
      // data payload, which would throw on destructuring.
      const auth = await supabase.auth.getUser().catch(() => null)
      const user = auth?.data?.user
      if (!user?.id) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        router.push('/onboarding')
        return
      }

      setProfile({ ...data, id: data.id || user.id, email: user.email })
      setFullName(data.full_name || '')
      setAvatarUrl(data.avatar_url || '')
      setLoading(false)
    }
    loadProfile()
  }, [router, supabase])

  const pickPhoto = () => fileInputRef.current?.click()

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_AVATAR_MB}MB.`)
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(
        uploadError.message.includes('Bucket not found')
          ? 'Photo storage is not set up yet. Run scripts/005-avatars.sql in Supabase first.'
          : uploadError.message
      )
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: saveError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (saveError) {
      setError(saveError.message)
    } else {
      setAvatarUrl(publicUrl)
      setProfile((p) => ({ ...p, avatar_url: publicUrl }))
      setSuccess('Photo updated')
      setTimeout(() => setSuccess(''), 3000)
    }
    setUploading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id)

    if (error) {
      setError(error.message)
    } else {
      setProfile((p) => ({ ...p, full_name: fullName }))
      setSuccess('Profile updated')
      setTimeout(() => setSuccess(''), 3000)
    }
    setSaving(false)
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-[#f8f6f1] flex items-center justify-center">
        <p className="text-sm text-[#6b7280]">Loading profile…</p>
      </div>
    )
  }

  const initial = String(profile.full_name || profile.email || 'S')
    .charAt(0)
    .toUpperCase()

  return (
    <DashboardLayout profile={profile}>
      <div className="px-5 py-6 md:px-12 md:py-10 max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-[28px] font-bold text-[#1a2e1e] mb-1">Profile</h1>
          <p className="text-sm text-[#6b7280]">Your personal information</p>
        </header>

        <div className="bg-white rounded-xl p-6 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-4">
          <div className="flex items-center gap-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile photo"
                className="w-20 h-20 rounded-full object-cover border border-[#f0f0f0]"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#f0fdf4] border border-[#f0f0f0] flex items-center justify-center text-2xl font-bold text-[#2D6A4F]">
                {initial}
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelected}
                className="hidden"
              />
              <button
                onClick={pickPhoto}
                disabled={uploading}
                className="px-4 py-2 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              <p className="text-xs text-[#9ca3af] mt-2">JPG or PNG, up to {MAX_AVATAR_MB}MB</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl p-6 border border-[#f0f0f0] shadow-[0_1px_2px_rgba(0,0,0,0.04)] space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-[#1a2e1e] mb-2">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-[#e5e7eb] bg-white text-sm outline-none focus:border-[#2D6A4F]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Email', value: profile.email || '—' },
              { label: 'Curriculum', value: profile.curriculum },
              { label: 'Graduation', value: `Class of ${profile.grad_year}` },
            ].map((f) => (
              <div key={f.label} className="p-3 rounded-lg bg-[#f9fafb] border border-[#f0f0f0]">
                <p className="text-xs text-[#9ca3af]">{f.label}</p>
                <p className="text-sm text-[#374151] mt-0.5 truncate">{f.value}</p>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-3">
              {error}
            </p>
          )}
          {success && <p className="text-sm font-medium text-[#16a34a]">{success}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-[#2D6A4F] text-white rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  )
}
