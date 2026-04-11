'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DeleteDoctorButtonProps {
  doctorId: string
  doctorName: string
}

export default function DeleteDoctorButton({ doctorId, doctorName }: DeleteDoctorButtonProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Remove Dr. ${doctorName}? This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/doctors/${doctorId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to delete doctor.')
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
      title={`Remove Dr. ${doctorName}`}
    >
      {deleting ? '…' : '🗑️ Delete'}
    </button>
  )
}
