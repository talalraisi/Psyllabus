/**
 * Browser notifications.
 *
 * Deliberately honest about its limits: without a push server, a web app can
 * only raise a notification while one of its tabs is open. Everything here is
 * built on that, and the UI says so rather than promising alerts that will not
 * arrive. Installing the PWA keeps a tab alive on mobile, which is why the
 * settings copy points at "Add to Home Screen".
 */

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/**
 * Raise a notification if allowed. Returns false when it could not be shown,
 * so callers can fall back to something visible in the page.
 */
export function notify(title, { body, tag, onClick } = {}) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    const n = new Notification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' })
    n.onclick = () => {
      window.focus()
      if (onClick) onClick()
      n.close()
    }
    return true
  } catch {
    return false
  }
}

/** A short chime, generated rather than shipped as an asset. */
export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const now = ctx.currentTime
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + i * 0.18)
      gain.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.4)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    /* audio is a nicety, never a failure */
  }
}

/** mm:ss for a duration in seconds. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
