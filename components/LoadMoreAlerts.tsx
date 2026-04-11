'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface LoadMoreAlertsProps {
  currentCount: number
  pageSize: number
}

export default function LoadMoreAlerts({ currentCount, pageSize }: LoadMoreAlertsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function loadMore() {
    const params = new URLSearchParams(searchParams.toString())
    const currentPage = parseInt(params.get('page') || '1', 10)
    params.set('page', String(currentPage + 1))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (currentCount < pageSize) return null

  return (
    <div className="mt-6 text-center">
      <button
        onClick={loadMore}
        className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-medium py-3 px-8 rounded-xl text-sm transition-colors"
      >
        Load more
      </button>
    </div>
  )
}
