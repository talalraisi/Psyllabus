'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, PageLoading, Spinner } from '@/components/PageShell'
import { isPremium, planLabel, FREE_SUBJECT_LIMIT } from '@/lib/access'

const MAX_AVATAR_MB = 5

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [codeError, setCodeError] = useState('')

  const fileRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const user = await getCurrentUser(supabase)
        if (!user) {
          router.push('/login')
          return
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (cancelled) return

        if (profileError) {
          setLoadError(profileError.message)
          setLoading(false)
          return
        }
        if (!data) {
          router.push('/onboarding')
          return
        }

        setProfile({ ...data, id: data.id ?? user.id, email: user.email ?? '' })
        setFullName(data.full_name ?? '')
        setAvatarUrl(data.avatar_url ?? '')
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err?.message || 'Could not load your profile.')
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const flash = (text) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 4000)
  }

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !profile?.id) return

    setError('')
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.')
    if (file.size > MAX_AVATAR_MB * 1024 * 1024)
      return setError(`Image must be under ${MAX_AVATAR_MB}MB.`)

    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError(
        uploadError.message.includes('Bucket not found')
          ? 'Photo storage is not set up yet. Run npm run setup-db.'
          : uploadError.message
      )
      setUploading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error: saveError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id)

    if (saveError) setError(saveError.message)
    else {
      setAvatarUrl(publicUrl)
      setProfile((p) => ({ ...p, avatar_url: publicUrl }))
      flash('Photo updated')
    }
    setUploading(false)
  }

  const onSave = async (e) => {
    e.preventDefault()
    if (!profile?.id) return
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id)

    if (saveError) setError(saveError.message)
    else {
      setProfile((p) => ({ ...p, full_name: fullName }))
      flash('Profile updated')
    }
    setSaving(false)
  }

  const onRedeem = async (e) => {
    e.preventDefault()
    const value = code.trim().toUpperCase()
    if (!value || redeeming) return

    setRedeeming(true)
    setCodeError('')

    const { data, error: rpcError } = await supabase.rpc('redeem_access_code', {
      p_code: value,
    })

    if (rpcError || !data?.ok) {
      setCodeError(rpcError?.message || data?.error || 'Could not redeem that code.')
      setRedeeming(false)
      return
    }

    setProfile((p) => ({
      ...p,
      plan: 'premium',
      access_source: data.label,
      is_admin: p?.is_admin || data.admin,
    }))
    setCode('')
    flash(`Unlocked by ${data.label}. Every subject is now available.`)
    setRedeeming(false)
  }

  if (loading) {
    return (
      <DashboardLayout profile={null}>
        <PageLoading title="Profile" width="narrow" rows={3} />
      </DashboardLayout>
    )
  }

  if (loadError || !profile) {
    return (
      <DashboardLayout profile={null}>
        <Page width="narrow">
          <PageHeader title="Profile" />
          <div className="surface p-6">
            <p className="t-card-title mb-2">We could not load your profile</p>
            <p className="t-small mb-6">{loadError || 'Please try again.'}</p>
            <button onClick={() => location.reload()} className="btn btn-solid control-md">
              Reload
            </button>
          </div>
        </Page>
      </DashboardLayout>
    )
  }

  const premium = isPremium(profile)
  const initial = String(profile.full_name || profile.email || 'S').charAt(0).toUpperCase()

  return (
    <DashboardLayout profile={profile}>
      <Page width="narrow">
        <PageHeader title="Profile" subtitle="Your account and access" />

        {message && (
          <p className="mb-4 rounded-[var(--r-md)] border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[var(--success-text)]">
            {message}
          </p>
        )}

        {/* Photo */}
        <div className="surface mb-3 p-5">
          <div className="flex items-center gap-5">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-20 w-20 rounded-full border border-[var(--border)] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--brand-tint)] text-2xl font-bold text-[var(--brand)]">
                {initial}
              </div>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onPickPhoto}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn btn-solid control-md"
              >
                {uploading && <Spinner />}
                {uploading ? 'Uploading' : avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              <p className="t-caption mt-2">JPG or PNG, up to {MAX_AVATAR_MB}MB</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <form onSubmit={onSave} className="surface mb-3 space-y-5 p-5">
          <div>
            <label htmlFor="fullName" className="t-small mb-2 block font-medium text-[var(--text)]">
              Full name
            </label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="field"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['Email', profile.email || 'Not available'],
              ['Curriculum', profile.curriculum || 'Not set'],
              ['Graduation', profile.grad_year ? `Class of ${profile.grad_year}` : 'Not set'],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3"
              >
                <p className="t-caption">{label}</p>
                <p className="mt-1 truncate text-sm text-[var(--text-body)]">{value}</p>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn btn-solid control-md w-full">
            {saving && <Spinner />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </form>

        {/* Access */}
        <Section title="Access" className="mb-0">
          <div id="unlock" className="surface p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="t-card-title">{planLabel(profile)}</p>
                <p className="t-small mt-1">
                  {premium
                    ? 'Every subject and feature is unlocked.'
                    : `Free accounts track ${FREE_SUBJECT_LIMIT} subject.`}
                </p>
              </div>
              {premium && (
                <span className="shrink-0 rounded-full bg-[var(--sand)] px-3 py-1 text-xs font-medium text-[var(--text)]">
                  Full access
                </span>
              )}
            </div>

            {!premium && (
              <>
                <form onSubmit={onRedeem} className="flex flex-wrap gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter your code"
                    aria-label="Access code"
                    className="field max-w-[240px] flex-1 uppercase"
                  />
                  <button
                    type="submit"
                    disabled={redeeming || !code.trim()}
                    className="btn btn-solid control-md"
                  >
                    {redeeming && <Spinner />}
                    {redeeming ? 'Checking' : 'Unlock'}
                  </button>
                </form>
                {codeError && (
                  <p className="mt-3 rounded-[var(--r-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
                    {codeError}
                  </p>
                )}
                <p className="t-caption mt-3">
                  If your school has bought Project Syllabus, ask them for the code.{' '}
                  <Link href="/pricing" className="text-[var(--brand)] hover:underline">
                    See plans
                  </Link>
                </p>
              </>
            )}
          </div>
        </Section>
      </Page>
    </DashboardLayout>
  )
}
