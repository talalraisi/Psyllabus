'use client'

/** The screen after signing up with email. Development only; sending is faked. */

import { notFound } from 'next/navigation'
import CheckEmail from '@/components/marketing/CheckEmail'

const ENABLED = process.env.NODE_ENV !== 'production'

export default function CheckEmailPreview() {
  if (!ENABLED) notFound()
  return <CheckEmail email="student@gmail.com" onResend={() => new Promise((r) => setTimeout(() => r(null), 600))} onChangeEmail={() => {}} />
}
