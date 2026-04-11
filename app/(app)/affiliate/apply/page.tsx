'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AffiliateApplyPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [bio, setBio] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agreed) {
      setError('You must agree to the affiliate terms.')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/affiliate/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        company_name: companyName || undefined,
        bio: bio || undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      setLoading(false)
      return
    }

    router.push('/affiliate')
  }

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <Link href="/affiliate" className="text-sm text-teal-600 hover:underline mb-4 inline-block">
          ← Back to Affiliate
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Become an Affiliate</h1>
        <p className="text-gray-500 mt-1">
          Refer subscribers to RxNudge and earn 20% of their monthly revenue.
        </p>
      </div>

      {/* Program info cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-teal-700">20%</p>
          <p className="text-xs text-teal-600 mt-1">Level 1 — Direct referral</p>
        </div>
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-teal-700">5%</p>
          <p className="text-xs text-teal-600 mt-1">Level 2 — Sub-affiliate referral</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
            />
            <p className="text-xs text-gray-400 mt-1">Used to generate your referral code (e.g. JSMITH)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company / Organization <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Valley Health Insurance"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">How will you refer clients? *</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              required
              rows={4}
              placeholder="I'm a pharmacist at Central Pharmacy and I'll recommend RxNudge to patients who need medication reminders…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 text-base resize-none"
            />
          </div>

          <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
            <input
              type="checkbox"
              id="agreed"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="w-5 h-5 text-teal-600 rounded mt-0.5 flex-shrink-0"
            />
            <label htmlFor="agreed" className="text-sm text-gray-700 cursor-pointer">
              I agree to the{' '}
              <span className="text-teal-600 underline cursor-pointer">RxNudge Affiliate Terms</span>.
              I understand that my application is subject to approval, and commissions are paid monthly for active subscribers I refer.
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !agreed}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl text-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting application…' : 'Submit Application'}
          </button>
        </form>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-sm text-amber-800">
          <strong>📋 Review process:</strong> Applications are reviewed within 1–2 business days. You&apos;ll receive an email once approved. Approved affiliates include insurance agents, pharmacists, discharge nurses, and healthcare professionals.
        </p>
      </div>
    </div>
  )
}
