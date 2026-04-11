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

  async function handleDelete() {
    const confirmed = window.confirm(
      `Remove ${medName}? This will stop all reminders for this medication.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/medications/${medId}`, {
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
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
      title={`Remove ${medName}`}
    >
      {deleting ? '…' : '🗑️ Delete'}
    </button>
  )
}
