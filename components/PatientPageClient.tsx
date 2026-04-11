'use client'

import { useState, useEffect } from 'react'
import { Medication, DoseLog, Patient } from '@/lib/types'
import MyMedsClient from '@/app/(app)/my-meds/MyMedsClient'
import ConsentScreenClient from '@/components/ConsentScreenClient'
import InstallStep from '@/components/InstallStep'
import AccountStep from '@/components/AccountStep'

interface UpcomingAppointment {
  id: string
  appointment_date: string
  appointment_time: string
  appointment_type: string
  doctor_name: string
  location?: string | null
}

interface Props {
  patient: Patient & { permanent_token: string; terms_accepted_at: string | null }
  token: string
  firstName: string
  caregiverName: string
  medications: Medication[]
  todayLogs: DoseLog[]
  streak: number
  upcomingAppointments?: UpcomingAppointment[]
  patientTimezone?: string
  todayLocalStr?: string
  hasConsented: boolean
  hasAccount: boolean
  patientEmail: string
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

/** Determine which step to show after consent is confirmed */
function stepAfterConsent(hasAccount: boolean): Step {
  if (isStandalone() || isInstallDismissed()) {
    // Skip install step
    if (hasAccount || isAccountSkipped()) return 'meds'
    return 'account'
  }
  return 'install'
}

export default function PatientPageClient({
  patient,
  token,
  firstName,
  caregiverName,
  medications,
  todayLogs,
  streak,
  upcomingAppointments,
  patientTimezone,
  todayLocalStr,
  hasConsented,
  hasAccount,
  patientEmail,
}: Props) {
  const [step, setStep] = useState<Step>(() => {
    if (!hasConsented) return 'consent'
    // Server doesn't know localStorage — start at install, useEffect refines it
    return 'install'
  })

  // Refine step on client after localStorage is available
  useEffect(() => {
    if (!hasConsented) return
    const refined = stepAfterConsent(hasAccount)
    setStep(refined)
  }, [hasConsented, hasAccount])

  // ── Consent ────────────────────────────────────────────────────────────────
  const handleConsentAccepted = () => {
    const next = stepAfterConsent(hasAccount)
    setStep(next)
  }

  // ── Install ─────────────────────────────────────────────────────────────────
  const handleInstallDone = () => {
    if (hasAccount || isAccountSkipped()) {
      setStep('meds')
    } else {
      setStep('account')
    }
  }

  // ── Account ─────────────────────────────────────────────────────────────────
  const handleAccountDone = () => setStep('meds')

  const handleAccountSkip = () => {
    localStorage.setItem('rxnudge_account_skipped', '1')
    setStep('meds')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
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
      upcomingAppointments={upcomingAppointments}
      patientTimezone={patientTimezone}
      todayLocalStr={todayLocalStr}
      showPasswordNudge={!hasAccount && isAccountSkipped()}
      token={token}
    />
  )
}
