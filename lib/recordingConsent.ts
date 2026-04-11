/**
 * US states that require all-party (two-party) consent for call recording.
 * In these states, all parties must be notified before recording begins.
 *
 * Sources: state wiretapping statutes as of 2025.
 * Always verify with legal counsel before going live.
 */
export const ALL_PARTY_CONSENT_STATES = new Set([
  'CA', // California — Penal Code § 632
  'FL', // Florida — Fla. Stat. § 934.03
  'IL', // Illinois — 720 ILCS 5/14-2
  'MD', // Maryland — Md. Code, Cts. & Jud. Proc. § 10-402
  'MA', // Massachusetts — Mass. Gen. Laws ch. 272, § 99
  'MI', // Michigan — Mich. Comp. Laws § 750.539c
  'MT', // Montana — Mont. Code Ann. § 45-8-213
  'NV', // Nevada — Nev. Rev. Stat. § 200.620
  'NH', // New Hampshire — N.H. Rev. Stat. § 570-A:2
  'OR', // Oregon — Or. Rev. Stat. § 165.540
  'PA', // Pennsylvania — 18 Pa. C.S. § 5703
  'WA', // Washington — Wash. Rev. Code § 9.73.030
])

/**
 * Returns true if the patient's state requires all-party consent disclosure
 * before recording a phone call.
 */
export function requiresRecordingDisclosure(state: string | null | undefined): boolean {
  if (!state) return false
  return ALL_PARTY_CONSENT_STATES.has(state.toUpperCase().trim())
}

/**
 * The verbal disclosure to play at the start of a call in all-party states.
 * Played BEFORE any medication prompts.
 */
export const RECORDING_DISCLOSURE_TEXT =
  'This call is from RxNudge, a medication reminder service. ' +
  'This call may be recorded for quality and record-keeping purposes. ' +
  'By continuing, you consent to this recording.'
