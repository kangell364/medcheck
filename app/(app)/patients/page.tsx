import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Patient } from '@/lib/types'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .eq('owner_id', user!.id)
    .order('created_at', { ascending: true }) as { data: Patient[] | null }

  return (
    <div className="max-w-3xl mx-auto pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">Manage medication tracking for your patients</p>
        </div>
        <Link
          href="/patients/new"
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
        >
          <span>➕</span> Add Patient
        </Link>
      </div>

      {(!patients || patients.length === 0) ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No patients yet</h2>
          <p className="text-gray-500 mb-6">Add a patient to start tracking their medications.</p>
          <Link
            href="/patients/new"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-xl inline-block transition-colors"
          >
            Add First Patient
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/patients/${patient.id}`}
              className="bg-white rounded-2xl border border-gray-100 hover:border-teal-200 hover:shadow-sm p-5 flex items-center gap-4 transition-all group"
            >
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                {patient.is_self ? '🙋' : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 text-lg">{patient.name}</h3>
                  {patient.is_self && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">Me</span>
                  )}
                  {!patient.active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{patient.phone}</p>
                <p className="text-xs text-gray-400">{patient.timezone}</p>
              </div>
              <span className="text-gray-300 group-hover:text-teal-400 transition-colors text-xl">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
