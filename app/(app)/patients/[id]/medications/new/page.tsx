'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const FREQUENCY_OPTIONS = [
  { value: 'once', label: 'Once daily', defaultTimes: ['08:00'] },
  { value: 'twice', label: 'Twice daily', defaultTimes: ['08:00', '20:00'] },
  { value: 'three_times', label: 'Three times daily', defaultTimes: ['08:00', '13:00', '20:00'] },
]

interface RxSuggestion {
  name: string
  rxcui: string
}

export default function NewMedicationPage() {
  const params = useParams()
  const patientId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const todayStr = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [dosage, setDosage] = useState('')
  const [startDate, setStartDate] = useState(todayStr)
  const [frequency, setFrequency] = useState('once')
  const [reminderTimes, setReminderTimes] = useState(['08:00'])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<RxSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // RxNorm autocomplete
  useEffect(() => {
    if (name.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(
          `https://rxnav.nlm.nih.gov/REST/spellingsuggestions.json?name=${encodeURIComponent(name)}`
        )
        const data = await res.json()
        const spelled: string[] = data?.suggestionGroup?.suggestionList?.suggestion || []

        // Also search by approximate match
        const res2 = await fetch(
          `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(name)}`
        )
        const data2 = await res2.json()
        const groups = data2?.drugGroup?.conceptGroup || []
        const rxNames: RxSuggestion[] = []

        for (const group of groups) {
          if (group.conceptProperties) {
            for (const prop of group.conceptProperties.slice(0, 5)) {
              rxNames.push({ name: prop.name, rxcui: prop.rxcui })
            }
          }
        }

        // Combine spelling suggestions + drug matches, dedupe
        const allNames = new Map<string, string>()
        spelled.slice(0, 3).forEach(s => allNames.set(s.toLowerCase(), s))
        rxNames.forEach(r => allNames.set(r.name.toLowerCase(), r.name))

        const combined: RxSuggestion[] = Array.from(allNames.entries())
          .slice(0, 8)
          .map(([, name]) => ({ name, rxcui: '' }))

        setSuggestions(combined)
        setShowSuggestions(combined.length > 0)
      } catch {
        // Silently fail — user can still type manually
        setSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [name])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectSuggestion(suggestion: RxSuggestion) {
    setName(suggestion.name)
    setShowSuggestions(false)
    setSuggestions([])
  }

  function handleFrequencyChange(freq: string) {
    setFrequency(freq)
    const opt = FREQUENCY_OPTIONS.find(o => o.value === freq)
    if (opt) setReminderTimes([...opt.defaultTimes])
  }

  function updateTime(index: number, value: string) {
    const updated = [...reminderTimes]
    updated[index] = value
    setReminderTimes(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.from('medications').insert({
      patient_id: patientId,
      name,
      nickname: nickname || null,
      dosage: dosage || null,
      start_date: startDate,
      frequency,
      reminder_times: reminderTimes,
      notes: notes || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(`/patients/${patientId}`)
    }
  }

  // What the AI will say on the call
  const callName = nickname || name

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <Link href={`/patients/${patientId}`} className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Patient
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Medication</h1>
        <p className="text-gray-500 mt-1">Set up a new medication with reminder times</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Medication Name with RxNorm Autocomplete */}
          <div className="relative" ref={suggestionsRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medication Name (Official) *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                placeholder="Start typing a medication name…"
                autoComplete="off"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-teal-50 text-sm border-b border-gray-50 last:border-0 transition-colors"
                  >
                    💊 {s.name}
                  </button>
                ))}
                <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50">
                  Powered by RxNorm (US National Library of Medicine)
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Use the official drug name — this appears on reports and PDFs sent to doctors.
            </p>
          </div>

          {/* Nickname / Plain Language Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nickname (Optional)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. blood pressure pill, water pill, heart med"
            />
            <p className="text-xs text-gray-400 mt-1">
              A friendly name used in phone calls and reminders. E.g. &apos;heart pill&apos;, &apos;little white one&apos;.
            </p>

            {/* Live preview */}
            {name && (
              <div className="mt-2 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3">
                <p className="text-xs text-teal-600 font-medium mb-1">📞 AI will say on the call:</p>
                <p className="text-sm text-teal-800 italic">
                  &quot;Did you take your <strong>{callName}</strong>?&quot;
                </p>
              </div>
            )}
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
            <input
              type="text"
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
              placeholder="e.g. 500mg, 1 tablet, 10mg"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
            />
            <p className="text-xs text-gray-400 mt-1">
              When did this medication begin? Used to calculate adherence accurately.
            </p>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How Often?</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFrequencyChange(opt.value)}
                  className={`py-3 px-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    frequency === opt.value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminder Times */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Times</label>
            <div className="space-y-2">
              {reminderTimes.map((time, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-20">
                    {i === 0 ? 'Morning' : i === 1 ? 'Evening' : 'Midday'}:
                  </span>
                  <input
                    type="time"
                    value={time}
                    onChange={e => updateTime(i, e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Take with food, avoid grapefruit, etc."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding medication…' : 'Add Medication'}
          </button>
        </form>
      </div>
    </div>
  )
}
