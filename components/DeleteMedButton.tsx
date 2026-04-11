'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DeleteMedButtonProps {
  medId: string
  medName: string
  patientId: string
}

export default function DeleteMedButton({ medId, medName, patientId }: DeleteMedButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  async function handleDelete(keepHistory: boolean) {
    setDeleting(true)
    setShowModal(false)
    try {
      const res = await fetch(`/api/medications/${medId}?keepHistory=${keepHistory}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete medication.')
        return
      }

      router.refresh()
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={deleting}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
        title={`Remove ${medName}`}
      >
        {deleting ? '…' : '🗑️ Delete'}
      </button>

      {/* Modal overlay */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Remove &quot;{medName}&quot;?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              This medication has dose history. What would you like to do with the records?
            </p>

            <div className="flex flex-col gap-3">
              {/* Keep History */}
              <button
                onClick={() => handleDelete(true)}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors"
              >
                ✅ Keep History (Recommended)
              </button>
              <p className="text-xs text-gray-400 -mt-2 text-center">
                Stops reminders, but preserves all past dose logs for reporting.
              </p>

              {/* Delete Everything */}
              <button
                onClick={() => handleDelete(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors"
              >
                🗑️ Delete Everything
              </button>
              <p className="text-xs text-gray-400 -mt-2 text-center">
                Permanently removes this medication and all its dose history.
              </p>

              {/* Cancel */}
              <button
                onClick={() => setShowModal(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
