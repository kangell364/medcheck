'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ArchiveMedButtonProps {
  medId: string
  medName: string
  patientId: string
  isArchived?: boolean
}

export default function ArchiveMedButton({ medId, medName, patientId, isArchived = false }: ArchiveMedButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/medications/${medId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: isArchived ? true : false }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to update medication.')
        return
      }

      router.refresh()
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs transition-colors disabled:opacity-50 ${
        isArchived
          ? 'text-gray-400 hover:text-teal-600'
          : 'text-gray-400 hover:text-amber-500'
      }`}
      title={isArchived ? `Restore ${medName}` : `Archive ${medName}`}
    >
      {loading ? '…' : isArchived ? '♻️ Restore' : '📦 Archive'}
    </button>
  )
}
