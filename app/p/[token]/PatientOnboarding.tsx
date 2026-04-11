'use client'

import { useState, useEffect } from 'react'
import { Medication, DoseLog, Patient } from '@/lib/types'
import ConsentScreenClient from '@/components/ConsentScreenClient'
import InstallStep from '@/components/InstallStep'
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

type Step = 'consent' | 'install' | 'account' | 'meds'

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

function isInstallDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('rxnudge_install_dismissed') === '1'
}

function isAccountSkipped(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('rxnudge_account_skipped') === '1'
}

function stepAfterConsent(hasAccount: boolean): Step {
  if (isStandalone() || isInstallDismissed()) {
    if (hasAccount || isAccountSkipped()) return 'meds'
    return 'account'
  }
  return 'install'
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
    // Start at install; useEffect will refine based on localStorage
    return 'install'
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

  // ── Install ───────────────────────────────────────────────────────────────
  const handleInstallDone = () => {
    if (hasAccount || isAccountSkipped()) {
      setStep('meds')
    } else {
      setStep('account')
    }
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

  if (step === 'install') {
    return <InstallStep onDone={handleInstallDone} />
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
