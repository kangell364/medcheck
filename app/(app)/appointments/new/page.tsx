'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Patient {
  id: string
  name: string
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const supabase = createClient()

  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    patient_id: '',
    doctor_name: '',
    location: '',
    appointment_date: '',
    appointment_time: '',
    appointment_type: 'checkup',
    needs_ride: false,
    notes: '',
  })

  useEffect(() => {
    async function loadPatients() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('patients')
        .select('id, name')
        .eq('owner_id', user.id)
        .eq('active', true)
        .order('name')
      setPatients(data || [])
      if (data && data.length > 0) {
        setForm(f => ({ ...f, patient_id: data[0].id }))
      }
    }
    loadPatients()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const target = e.target
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      setForm(f => ({ ...f, [target.name]: target.checked }))
    } else {
      setForm(f => ({ ...f, [target.name]: target.value }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to create appointment')
        setLoading(false)
        return
      }

      router.push('/appointments')
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto pb-20 md:pb-0">
      <div className="mb-6">
        <Link href="/appointments" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Appointments
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Add Appointment</h1>
        <p className="text-gray-500 mt-1">Schedule a new appointment for a patient.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Patient */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Patient *</label>
          <select
            name="patient_id"
            value={form.patient_id}
            onChange={handleChange}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            {patients.length === 0 && <option value="">No patients found</option>}
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Doctor Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Doctor Name *</label>
          <input
            type="text"
            name="doctor_name"
            value={form.doctor_name}
            onChange={handleChange}
            required
            placeholder="Dr. Smith"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location</label>
          <input
            type="text"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="123 Medical Center Dr, Suite 100"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date *</label>
            <input
              type="date"
              name="appointment_date"
              value={form.appointment_date}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Time *</label>
            <input
              type="time"
              name="appointment_time"
              value={form.appointment_time}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Appointment Type</label>
          <select
            name="appointment_type"
            value={form.appointment_type}
            onChange={handleChange}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="checkup">Checkup</option>
            <option value="specialist">Specialist</option>
            <option value="lab">Lab</option>
            <option value="procedure">Procedure</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Needs Ride */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="needs_ride"
            name="needs_ride"
            checked={form.needs_ride}
            onChange={handleChange}
            className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-gray-300"
          />
          <label htmlFor="needs_ride" className="text-sm font-semibold text-gray-700">
            🚗 Patient needs a ride
          </label>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            placeholder="Any additional notes..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Appointment'}
          </button>
          <Link
            href="/appointments"
            className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
