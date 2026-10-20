/**
 * Choosing the free subject, through the one database function that may set
 * it (072-free-plan-guard.sql), which also checks this is not a second free
 * account for the same person.
 *
 * The device id is a random value kept on this device so the claim can tell
 * when one laptop is collecting free accounts. Only a one-way fingerprint of
 * it is stored on our side.
 */

const DEVICE = 'psyllabus:device'

export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE)
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE, id)
    }
    return id
  } catch {
    return null
  }
}

const REFUSED = {
  duplicate_email: 'This email already has a free account. Sign in to that one, or unlock every subject.',
  duplicate_device: 'This device already has free accounts. Sign in to one of those, or unlock every subject.',
  busy_network: 'Too many new free accounts from this network today. Try again tomorrow, or ask your school about a licence.',
  disposable: 'Use your own email address rather than a temporary one.',
  confirm_email: 'Confirm your email first: open the link we sent you, then try again.',
  already: 'Your free subject is already chosen.',
}

/** { ok: true } or { ok: false, error } with a sentence to show. */
export async function claimFreeSubject(supabase, subject) {
  const { data, error } = await supabase.rpc('claim_free_subject', { p_subject: subject, p_device: deviceId() })
  if (error || !data) return { ok: false, error: 'That did not work. Try again in a moment.' }
  if (!data.ok) return { ok: false, reason: data.reason, error: REFUSED[data.reason] || 'That subject could not be opened.' }
  return { ok: true }
}
