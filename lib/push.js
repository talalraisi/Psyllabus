'use client'

/**
 * Push reminders on this device: whether it can have them, and turning them
 * on and off. The subscription is stored in push_subscriptions (RLS: the
 * owner's rows only) and the daily job (app/api/reminders) sends to it.
 *
 * iPhones only allow it once Psyllabus is added to the Home Screen.
 */

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function keyBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(padded)
  return Uint8Array.from(raw, (ch) => ch.charCodeAt(0))
}

/** 'on', 'off', 'blocked', 'install' (iPhone, not on the Home Screen yet) or 'unsupported'. */
export async function pushState() {
  if (typeof window === 'undefined' || !KEY) return 'unsupported'
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return ios && !standalone ? 'install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'blocked'
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = reg && (await reg.pushManager.getSubscription())
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export async function turnOnPush(supabase, userId) {
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
  await navigator.serviceWorker.ready
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }))
  const json = sub.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: json.endpoint, user_id: userId, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' })
  if (error) throw error
  await supabase.from('profiles').update({ push_reminders: true }).eq('id', userId)
  return 'on'
}

export async function turnOffPush(supabase) {
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = reg && (await reg.pushManager.getSubscription())
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}
