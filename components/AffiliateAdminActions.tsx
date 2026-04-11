'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  affiliateId: string
  isActive?: boolean
  isSuspended?: boolean
}

export default function AffiliateAdminActions({ affiliateId, isActive, isSuspended }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleAction(approved: boolean) {
    setLoading(true)
    try {
      const res = await fetch('/api/affiliate/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, approved }),
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (isActive) {
    return (
      <button
        onClick={() => handleAction(false)}
        disabled={loading}
        className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
      >
        Suspend
      </button>
    )
  }

  if (isSuspended) {
    return (
      <button
        onClick={() => handleAction(true)}
        disabled={loading}
        className="text-xs text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50"
      >
        Reinstate
      </button>
    )
  }

  // Pending
  return (
    <div className="flex gap-2 flex-shrink-0">
      <button
        onClick={() => handleAction(true)}
        disabled={loading}
        className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '…' : '✅ Approve'}
      </button>
      <button
        onClick={() => handleAction(false)}
        disabled={loading}
        className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? '…' : '✗ Reject'}
      </button>
    </div>
  )
}
