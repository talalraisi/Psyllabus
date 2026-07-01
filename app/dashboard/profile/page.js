'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppHeader from '@/components/AppHeader'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    avatar_url: ''
  })

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
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

      setProfile(data)
      setFormData({
        full_name: data.full_name || '',
        date_of_birth: data.date_of_birth || '',
        avatar_url: data.avatar_url || ''
      })
      setLoading(false)
    }
    loadProfile()
  }, [router, supabase])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth || null,
        avatar_url: formData.avatar_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setSuccess('Profile updated successfully!')
    setSaving(false)
    
    // Update local state
    setProfile({
      ...profile,
      full_name: formData.full_name,
      date_of_birth: formData.date_of_birth,
      avatar_url: formData.avatar_url
    })
 setTimeout(() => setSuccess(''), 3000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="page px-6 py-8">
        <div className="container-narrow">
          <p className="text-text-muted text-sm">Loading profile…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="page px-6 py-8">
      <div className="container-narrow">
        <AppHeader
          backHref="/dashboard"
          backLabel="Dashboard"
          rightAction={
            <button onClick={handleLogout} className="btn-ghost">
              Sign out
            </button>
          }
        />

        <div className="card card-pad">
          <h1 className="text-2xl font-bold text-text mb-2">Your profile</h1>
          <p className="text-text-muted text-sm mb-8">
            Manage your personal information and preferences.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-6">
            <div>
              <label className="label">Profile picture URL</label>
              <input
                type="url"
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                placeholder="https://example.com/avatar.jpg"
                className="input"
              />
              <p className="text-text-faint text-xs mt-1">
                Enter a URL to your profile picture
              </p>
            </div>

            {formData.avatar_url && (
              <div className="flex items-center gap-4">
                <img
                  src={formData.avatar_url}
                  alt="Profile preview"
                  className="w-16 h-16 rounded-full object-cover border border-border"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
                <p className="text-text-muted text-sm">Preview</p>
              </div>
            )}

            <div>
              <label className="label">Full name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="Talal Al-Raisi"
                required
                className="input"
              />
            </div>

            <div>
              <label className="label">Date of birth</label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                className="input"
              />
              <p className="text-text-faint text-xs mt-1">
                Optional
              </p>
            </div>

            <div className="p-4 rounded-[var(--radius-sm)] border border-border bg-bg-subtle">
              <p className="text-text-faint text-xs mb-1">Email</p>
              <p className="text-text text-sm">{profile.email || 'Not available'}</p>
            </div>

            <div className="p-4 rounded-[var(--radius-sm)] border border-border bg-bg-subtle">
              <p className="text-text-faint text-xs mb-1">Curriculum</p>
              <p className="text-text text-sm">{profile.curriculum}</p>
            </div>

            <div className="p-4 rounded-[var(--radius-sm)] border border-border bg-bg-subtle">
              <p className="text-text-faint text-xs mb-1">Graduation year</p>
              <p className="text-text text-sm">Class of {profile.grad_year}</p>
            </div>

            {error && <div className="error-box">{error}</div>}
            {success && <div className="text-solid text-sm font-medium">{success}</div>}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full py-3.5 text-base"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
