'use client'

import { useState } from 'react'
import { IconEye, IconEyeOff } from '@/components/Icons'

/**
 * Password input with a reveal toggle.
 *
 * Typing a password blind on a phone keyboard is where most failed sign-ins
 * come from, so being able to check what you typed matters more here than the
 * shoulder-surfing it theoretically exposes. It starts hidden and the toggle
 * is opt-in, which is the same trade every bank app makes.
 *
 * `pr-11` on the input keeps the text clear of the button rather than running
 * underneath it.
 */
export default function PasswordField({
  value,
  onChange,
  placeholder = 'Your password',
  autoComplete = 'current-password',
  minLength,
  required = true,
  id,
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        className="input pr-11"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        // tabIndex -1 so tabbing goes password then submit, not via the eye.
        tabIndex={-1}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[var(--r-md)] text-[var(--text-faint)] transition-colors duration-150 hover:bg-[var(--surface-sunken)] hover:text-[var(--text-muted)]"
      >
        {visible ? <IconEyeOff width={18} height={18} /> : <IconEye width={18} height={18} />}
      </button>
    </div>
  )
}
