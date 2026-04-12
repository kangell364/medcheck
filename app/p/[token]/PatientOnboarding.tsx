'use client'

import { useState, useEffect } from 'react'
import { Medication, DoseLog, Patient } from '@/lib/types'
import ConsentScreenClient from '@/components/ConsentScreenClient'
import AccountStep from '@/components/AccountStep'
import MyMedsClient from '@/app/(app)/my-meds/MyMedsClient'

export interface PatientOnboardingData {
  patient: Patient & {
    permanent_token: string
    terms_accepted_at: string | null
    email?: string | null
    user_id?: string | null
  }
  firstName: string
  caregiverName: string
  medications: Medication[]
  todayLogs: DoseLog[]
  streak: number
  patientTimezone?: string
  todayLocalStr?: string
}

type Step = 'consent' | 'account' | 'meds'

function isAccountSkipped(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('rxnudge_account_skipped') === '1'
}

function stepAfterConsent(hasAccount: boolean): Step {
  if (hasAccount || isAccountSkipped()) return 'meds'
  return 'account'
}

export default function PatientOnboarding({
  patient,
  firstName,
  caregiverName,
  medications,
  todayLogs,
  streak,
  patientTimezone,
  todayLocalStr,
}: PatientOnboardingData) {
  const hasConsented = !!patient.terms_accepted_at
  const hasAccount = !!patient.user_id
  const patientEmail = patient.email ?? ''
  const token = patient.permanent_token

  const [step, setStep] = useState<Step>(() => {
    if (!hasConsented) return 'consent'
    // Start at account; useEffect will refine based on localStorage
    return 'account'
  })

  // Refine step client-side once localStorage is available
  useEffect(() => {
    if (!hasConsented) return
    setStep(stepAfterConsent(hasAccount))
  }, [hasConsented, hasAccount])

  // ── Consent ──────────────────────────────────────────────────────────────
  const handleConsentAccepted = () => {
    setStep(stepAfterConsent(hasAccount))
  }

  // ── Account ───────────────────────────────────────────────────────────────
  const handleAccountDone = () => setStep('meds')

  const handleAccountSkip = () => {
    localStorage.setItem('rxnudge_account_skipped', '1')
    setStep('meds')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (step === 'consent') {
    return (
      <ConsentScreenClient
        patientId={patient.id}
        token={token}
        firstName={firstName}
        caregiverName={caregiverName}
        onAccepted={handleConsentAccepted}
      />
    )
  }

  if (step === 'account') {
    return (
      <AccountStep
        patientId={patient.id}
        token={token}
        email={patientEmail}
        onDone={handleAccountDone}
        onSkip={handleAccountSkip}
      />
    )
  }

  return (
    <MyMedsClient
      patient={patient}
      medications={medications}
      todayLogs={todayLogs}
      streak={streak}
      firstName={firstName}
      patientTimezone={patientTimezone}
      todayLocalStr={todayLocalStr}
      showPasswordNudge={!hasAccount && isAccountSkipped()}
      token={token}
    />
  )
}
