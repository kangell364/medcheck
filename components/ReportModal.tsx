'use client'

import { useState } from 'react'
import { Patient, Medication } from '@/lib/types'

interface PatientWithMeds {
  patient: Patient
  meds: Medication[]
}

interface ReportModalProps {
  patientData: PatientWithMeds[]
  userEmail: string
  userName: string | null
}

export default function ReportModal({ patientData, userEmail, userName }: ReportModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Default: last 30 days
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]

  const [dateFrom, setDateFrom] = useState(toDateStr(thirtyDaysAgo))
  const [dateTo, setDateTo] = useState(toDateStr(today))
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(() => {
    const all = new Set<string>()
    patientData.forEach(({ meds }) => meds.forEach(m => all.add(m.id)))
    return all
  })
  const [email, setEmail] = useState(userEmail)
  const [loading, setLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const toggleMed = (medId: string) => {
    setSelectedMeds(prev => {
      const next = new Set(prev)
      if (next.has(medId)) next.delete(medId)
      else next.add(medId)
      return next
    })
  }

  const selectAll = () => {
    const all = new Set<string>()
    patientData.forEach(({ meds }) => meds.forEach(m => all.add(m.id)))
    setSelectedMeds(all)
  }

  const selectNone = () => setSelectedMeds(new Set())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedMeds.size === 0) {
      setResult({ success: false, message: 'Please select at least one medication.' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // Group selected meds by patient
      const patientGroups = patientData
        .map(({ patient, meds }) => ({
          patientId: patient.id,
          medicationIds: meds.filter(m => selectedMeds.has(m.id)).map(m => m.id),
        }))
        .filter(g => g.medicationIds.length > 0)

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientGroups,
          dateFrom,
          dateTo,
          email,
          requestedBy: userName || userEmail,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, message: `Report sent to ${email}!` })
      } else {
        setResult({ success: false, message: data.error || 'Failed to generate report.' })
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (selectedMeds.size === 0) {
      setResult({ success: false, message: 'Please select at least one medication.' })
      return
    }
    setPdfLoading(true)
    setResult(null)
    try {
      const patientGroups = patientData
        .map(({ patient, meds }) => ({
          patientId: patient.id,
          medicationIds: meds.filter(m => selectedMeds.has(m.id)).map(m => m.id),
        }))
        .filter(g => g.medicationIds.length > 0)

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientGroups,
          dateFrom,
          dateTo,
          email: '__pdf__',
          requestedBy: userName || userEmail,
          pdfOnly: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.html) {
        // Open in new tab and trigger print dialog (save as PDF)
        const win = window.open('', '_blank')
        if (win) {
          win.document.write(data.html)
          win.document.close()
          setTimeout(() => win.print(), 800)
        }
      } else {
        setResult({ success: false, message: data.error || 'Failed to generate PDF.' })
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setPdfLoading(false)
    }
  }

  const totalMeds = patientData.reduce((sum, { meds }) => sum + meds.length, 0)

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setIsOpen(true); setResult(null) }}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors shadow-md"
      >
        📋 Generate Report
      </button>

      {/* Modal backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">📋 Generate Doctor Report</h2>
                <p className="text-sm text-gray-500 mt-0.5">Send a professional adherence report via email</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Report Period</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      max={dateTo}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      min={dateFrom}
                      max={toDateStr(today)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Medication Selector */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">
                    Medications ({selectedMeds.size}/{totalMeds} selected)
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAll} className="text-xs text-teal-600 hover:text-teal-800 font-medium">All</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={selectNone} className="text-xs text-gray-400 hover:text-gray-600 font-medium">None</button>
                  </div>
                </div>

                <div className="space-y-4">
                  {patientData.map(({ patient, meds }) => (
                    <div key={patient.id}>
                      <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">{patient.name}</p>
                      <div className="space-y-2 pl-2">
                        {meds.length === 0 && (
                          <p className="text-xs text-gray-400 italic">No medications</p>
                        )}
                        {meds.map(med => {
                          const nickname = (med as any).nickname
                          const label = nickname ? `${med.name} (${nickname})` : med.name
                          return (
                            <label
                              key={med.id}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <input
                                type="checkbox"
                                checked={selectedMeds.has(med.id)}
                                onChange={() => toggleMed(med.id)}
                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                              <div>
                                <span className="text-sm text-gray-800 group-hover:text-gray-900">{label}</span>
                                {med.dosage && (
                                  <span className="text-xs text-gray-400 ml-2">{med.dosage}</span>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Send Report To</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Pre-filled with your account email. Change to send to a doctor.</p>
              </div>

              {/* Result message */}
              {result && (
                <div className={`rounded-xl px-4 py-3 text-sm font-medium ${result.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {result.success ? '✅ ' : '❌ '}{result.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading || selectedMeds.size === 0}
                  className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-xl text-sm font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? '⏳ Building…' : '📄 Download PDF'}
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedMeds.size === 0}
                  className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '⏳ Sending…' : '📧 Email Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
