'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { invalidateProfile, clearCache } from '@/lib/cache'
import { OPERATOR } from '@/lib/legal'
import AvatarCropper from '@/components/AvatarCropper'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { Page, PageHeader, Section, PageLoading, Spinner } from '@/components/PageShell'
import { isPremium, planLabel, FREE_SUBJECT_LIMIT } from '@/lib/access'

// Only a guard against someone picking a RAW file; the cropper re-encodes
// everything to a small square before it is uploaded.
const MAX_AVATAR_MB = 25

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [hasWork, setHasWork] = useState(true)

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  // Shown inside the crop dialog, which covers the page while it is open.
  const [photoError, setPhotoError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
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

        // Whether anything is filed under the current subjects. It decides
        // whether the list can still be changed, and the database enforces the
        // same rule, so this only ever decides what to say.
        const [{ count: progressCount }, { count: attemptCount }] = await Promise.all([
          supabase
            .from('progress')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('quiz_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ])
        if (cancelled) return
        setHasWork((progressCount || 0) > 0 || (attemptCount || 0) > 0)

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

  // Choosing a file opens the cropper. Nothing is uploaded until Save.
  const onPickPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !profile?.id) return

    setError('')
    setPhotoError('')
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.')
    if (file.size > MAX_AVATAR_MB * 1024 * 1024)
      return setError(
        `That image is over ${MAX_AVATAR_MB}MB, which is bigger than this can handle. Most photos are well under.`
      )

    setPendingPhoto(file)
  }

  /**
   * Upload the cropped square.
   *
   * The cropper hands back a 512px JPEG whatever went in, so a 12MB phone photo
   * arrives here at roughly 60KB and the size limit is close to irrelevant.
   */
  const onCropped = async (blob) => {
    if (!profile?.id) return
    setPhotoError('')

    // Offline is the commonest reason this fails, and the browser's own
    // message for it is a TypeError nobody would read as "you have no
    // internet". Say it plainly, before trying.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPhotoError('You are offline. Reconnect and press Save again — your crop is still here.')
      return
    }

    setUploading(true)
    const path = `${profile.id}/avatar-${Date.now()}.jpg`

    /**
     * A session that expired while the page was open.
     *
     * Storage checks the token, not the cookie, and a tab left open overnight
     * has a token that stopped working hours ago. The upload then fails with
     * a bare 401 — which is what "it just doesn't upload" looks like from the
     * outside. Refreshing first turns that into either a working upload or a
     * sentence telling them to sign in again.
     */
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !sessionData?.session) {
      setPhotoError('Your session has expired. Sign in again and the photo will upload.')
      setUploading(false)
      return
    }

    /**
     * Never hang.
     *
     * A request on a dropping connection can sit there for minutes, and with
     * no try/catch a thrown network error left this on "Saving…" for good with
     * nothing on screen. Every failure now ends in a sentence, in the dialog
     * the person is looking at rather than on the page underneath it.
     */
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), ms)
        ),
      ])

    try {
      const { error: uploadError } = await withTimeout(
        supabase.storage
          .from('avatars')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' }),
        30000
      )

      if (uploadError) {
        setPhotoError(
          uploadError.message.includes('Bucket not found')
            ? 'Photo storage is not set up on the server yet.'
            : /exceeded|too large|size|maximum/i.test(uploadError.message)
              ? 'That photo is too large for the server. Tell Talal — the crop should have prevented this.'
              : /jwt|token|unauthor|401/i.test(uploadError.message)
                ? 'Your session has expired. Sign in again and the photo will upload.'
                : `The upload was refused: ${uploadError.message}`
        )
        return
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: saveError } = await withTimeout(
        supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id),
        15000
      )

      if (saveError) {
        setPhotoError(`The photo uploaded but could not be saved to your profile: ${saveError.message}`)
        return
      }

      invalidateProfile(profile.id)
      setAvatarUrl(publicUrl)
      setProfile((p) => ({ ...p, avatar_url: publicUrl }))
      setPendingPhoto(null)
      flash('Photo updated')
    } catch (e) {
      setPhotoError(
        e?.message === 'timeout'
          ? 'The upload is taking too long — your connection may have dropped. Try again.'
          : typeof navigator !== 'undefined' && navigator.onLine === false
            ? 'You went offline during the upload. Reconnect and press Save again.'
            : 'The upload could not reach the server. Check your connection and try again.'
      )
    } finally {
      setUploading(false)
    }
  }

  /**
   * Erasure. The RPC runs as definer because a client cannot delete its own
   * auth.users row, and removing only the profile would leave an account that
   * can still sign in to nothing.
   */
  const deleteAccount = async () => {
    if (deleting) return
    setDeleting(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('delete_my_account')

    if (rpcError || !data?.ok) {
      setError(rpcError?.message || data?.error || 'Could not delete the account. Please email us.')
      setDeleting(false)
      return
    }

    clearCache()
    await supabase.auth.signOut()
    router.push('/?deleted=1')
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
      invalidateProfile(profile.id)
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

    invalidateProfile(profile.id)
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
      {pendingPhoto && (
        <AvatarCropper
          file={pendingPhoto}
          saving={uploading}
          error={photoError}
          onCancel={() => {
            setPendingPhoto(null)
            setPhotoError('')
          }}
          onCropped={onCropped}
        />
      )}
        <PageLoading title="Profile" width="narrow" rows={3} variant="form" />
      </DashboardLayout>
    )
  }

  if (loadError || !profile) {
    return (
      <DashboardLayout profile={null}>
        <Page width="narrow">
          <PageHeader title="Profile" />
          <div>
            <p className="text-[16px] font-semibold tracking-[-0.015em]">
              We could not load your profile
            </p>
            <p className="mb-7 mt-2 text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {loadError || 'Please try again.'}
            </p>
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
          <p
            className="mb-8 border-l-2 pl-4 text-[14px]"
            style={{ borderColor: 'var(--status-proficient)', color: 'var(--text-body)' }}
          >
            {message}
          </p>
        )}

        {/* Photo */}
        <div className="mb-10">
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
              <p className="t-caption mt-2">
                JPG, PNG or HEIC. You can zoom and drag to frame it before it saves.
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <form onSubmit={onSave} className="mb-12 space-y-6 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
          <div>
            <label htmlFor="fullName" className="mb-2 block text-[14px] font-medium">
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

          <dl className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-3">
            {[
              ['Email', profile.email || 'Not available'],
              ['Curriculum', profile.curriculum || 'Not set'],
              ['Graduation', profile.grad_year ? `Class of ${profile.grad_year}` : 'Not set'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
                  {label}
                </dt>
                <dd className="mt-1 truncate text-[14px]" style={{ color: 'var(--text-body)' }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {error && (
            <p className="border-l-2 pl-4 text-[14px]" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={saving} className="btn btn-solid control-md">
            {saving && <Spinner />}
            {saving ? 'Saving' : 'Save changes'}
          </button>
        </form>

        {/* Subjects.
            Locked by work rather than by time: nothing earned means nothing to
            lose, and a student who has just signed up and picked wrong should
            not be stuck with it. One answer to one question closes it, because
            from that point a change would hide something real rather than move
            it. The database enforces this; the page only explains it. */}
        <Section title="Subjects">
          <ul className="mb-5 flex flex-col">
            {(profile.subjects || []).map((s) => (
              <li
                key={s}
                className="border-b py-2.5 text-[14px] last:border-b-0"
                style={{ borderColor: 'var(--border)', color: 'var(--text-body)' }}
              >
                {s}
              </li>
            ))}
          </ul>

          {hasWork ? (
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Set for good — everything you prove is filed under them. Get in touch if the list is wrong.
            </p>
          ) : (
            <>
              <p className="mb-5 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Still changeable until your first quiz.
              </p>
              <Link href="/onboarding" className="btn btn-outline control-md">
                Change my subjects
              </Link>
            </>
          )}
        </Section>

        {/* Access */}
        <Section title="Access" className="mb-0">
          <div id="unlock">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-semibold tracking-[-0.012em]">{planLabel(profile)}</p>
                <p className="mt-1.5 text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
                  {premium
                    ? 'Every subject and feature is unlocked.'
                    : `Free accounts track ${FREE_SUBJECT_LIMIT} subject.`}
                </p>
              </div>
              {premium && (
                <span
                  className="shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-medium"
                  style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)' }}
                >
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
                  <p
                    className="mt-4 border-l-2 pl-4 text-[14px]"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
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

        {/* Right to erasure. Oman's PDPL makes this absolute, and a school's IT
            department will ask for it before anything else. It has to actually
            delete, not flag as inactive. */}
        <Section title="Your data">
          <div>
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Take a copy of everything, any time. Deleting removes it rather than hiding it.
            </p>

            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="btn btn-quiet control-md mt-4 border-[var(--danger-border)] text-[var(--danger)]"
              >
                Delete my account and data
              </button>
            ) : (
              <div className="mt-6 border-l-2 pl-4" style={{ borderColor: 'var(--danger)' }}>
                <p className="text-[14.5px] font-semibold" style={{ color: 'var(--danger)' }}>
                  This cannot be undone.
                </p>
                <p className="t-small mt-2">
              Your account and everything in it, permanently. No backup, no recovery.
                </p>
                <p className="t-small mt-2">
                  Type <strong className="text-[var(--text)]">DELETE</strong> to confirm.
                </p>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  className="input mt-3"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setConfirmingDelete(false)
                      setDeleteConfirm('')
                    }}
                    className="btn btn-quiet control-md"
                  >
                    Keep my account
                  </button>
                  <button
                    onClick={deleteAccount}
                    disabled={deleting || deleteConfirm.trim().toUpperCase() !== 'DELETE'}
                    className="btn control-md bg-[var(--danger)] text-white disabled:opacity-40"
                  >
                    {deleting ? 'Deleting…' : 'Delete everything'}
                  </button>
                </div>
              </div>
            )}

            <p className="t-caption mt-4">
              You can also ask us to show you or correct what we hold, by writing to{' '}
              <a href={`mailto:${OPERATOR.dpoEmail}`} className="text-[var(--brand)] hover:underline">
                {OPERATOR.dpoEmail}
              </a>
              . See the{' '}
              <Link href="/privacy?from=dashboard" className="text-[var(--brand)] hover:underline">
                privacy policy
              </Link>{' '}
              for what is held and why.
            </p>
          </div>
        </Section>
      </Page>
    </DashboardLayout>
  )
}
