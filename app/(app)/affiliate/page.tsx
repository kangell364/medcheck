import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AffiliateCopyButton from '@/components/AffiliateCopyButton'
import type { Affiliate, Referral, AffiliateEarnings } from '@/lib/types'

interface ReferralWithProfile extends Referral {
  profiles: {
    full_name: string | null
    plan: string
  } | null
}

interface SubAffiliate extends Affiliate {
  profiles: { full_name: string | null } | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-teal-100 text-teal-700',
    pending: 'bg-amber-100 text-amber-700',
    churned: 'bg-red-100 text-red-700',
    suspended: 'bg-red-100 text-red-700',
    paid: 'bg-teal-100 text-teal-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function AffiliatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch affiliate record
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('*')
    .eq('user_id', user.id)
    .single() as { data: Affiliate | null }

  // --- Not an affiliate yet ---
  if (!affiliate) {
    return (
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Program</h1>
          <p className="text-gray-500 mt-1">Earn recurring commissions by referring subscribers to RxNudge.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">🤝</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Earn with RxNudge</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Refer patients, families, and caregivers to RxNudge and earn a percentage of their monthly subscription — for as long as they stay subscribed.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
            <div className="bg-teal-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-teal-700">20%</p>
              <p className="text-sm text-teal-600 mt-1">Direct referral commission</p>
            </div>
            <div className="bg-teal-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-teal-700">5%</p>
              <p className="text-sm text-teal-600 mt-1">Sub-affiliate tier commission</p>
            </div>
            <div className="bg-teal-50 rounded-xl p-4">
              <p className="text-2xl font-bold text-teal-700">∞</p>
              <p className="text-sm text-teal-600 mt-1">Recurring monthly payouts</p>
            </div>
          </div>

          <Link
            href="/affiliate/apply"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-8 rounded-xl inline-block transition-colors text-lg"
          >
            Apply to Become an Affiliate
          </Link>
          <p className="text-xs text-gray-400 mt-4">Applications reviewed within 1–2 business days</p>
        </div>
      </div>
    )
  }

  // --- Pending ---
  if (affiliate.status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Program</h1>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Under Review</h2>
          <p className="text-gray-500 mb-4">
            Your affiliate application is being reviewed. You&apos;ll receive an email once it&apos;s approved — typically within 1–2 business days.
          </p>
          <StatusBadge status="pending" />
        </div>
      </div>
    )
  }

  // --- Suspended ---
  if (affiliate.status === 'suspended') {
    return (
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Program</h1>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h2>
          <p className="text-gray-500">Your affiliate account has been suspended. Please contact support for more information.</p>
        </div>
      </div>
    )
  }

  // --- Active affiliate dashboard ---
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()

  // Fetch referrals with profiles
  const { data: referrals } = await supabase
    .from('referrals')
    .select('*, profiles(full_name, plan)')
    .eq('affiliate_id', affiliate.id)
    .order('signed_up_at', { ascending: false }) as { data: ReferralWithProfile[] | null }

  // Fetch earnings
  const { data: earnings } = await supabase
    .from('affiliate_earnings')
    .select('*')
    .eq('affiliate_id', affiliate.id)
    .order('period_month', { ascending: false }) as { data: AffiliateEarnings[] | null }

  // This month's earnings
  const thisMonthEarnings = (earnings || [])
    .filter(e => e.period_month >= startOfMonth.slice(0, 7))
    .reduce((sum, e) => sum + Number(e.earnings), 0)

  // YTD earnings
  const ytdEarnings = (earnings || [])
    .filter(e => e.period_month.slice(0, 4) === String(now.getFullYear()))
    .reduce((sum, e) => sum + Number(e.earnings), 0)

  // Active clients
  const activeClients = (referrals || []).filter(r => r.status === 'active').length
  const churnedClients = (referrals || []).filter(r => r.status === 'churned').length
  const totalClients = (referrals || []).length

  // New this month
  const newThisMonth = (referrals || []).filter(r =>
    r.signed_up_at >= startOfMonth
  ).length

  // Last 6 months earnings for chart
  const last6Months: { label: string; month: string; total: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    const total = (earnings || [])
      .filter(e => e.period_month.slice(0, 7) === monthKey)
      .reduce((sum, e) => sum + Number(e.earnings), 0)
    last6Months.push({ label, month: monthKey, total })
  }
  const maxMonthEarning = Math.max(...last6Months.map(m => m.total), 1)

  // Sub-affiliates (level 2)
  const { data: subAffiliates } = await supabase
    .from('affiliates')
    .select('*, profiles(full_name)')
    .eq('referred_by', affiliate.id) as { data: SubAffiliate[] | null }

  const referralLink = `https://app.rxnudge.app/ref/${affiliate.referral_code}`

  return (
    <div className="max-w-4xl mx-auto pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Dashboard</h1>
          <p className="text-gray-500 mt-1">Code: <span className="font-mono font-semibold text-teal-600">{affiliate.referral_code}</span></p>
        </div>
        <StatusBadge status={affiliate.status} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">💰 This Month</p>
          <p className="text-2xl font-bold text-gray-900">${thisMonthEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">📅 Year to Date</p>
          <p className="text-2xl font-bold text-gray-900">${ytdEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">👥 Active Clients</p>
          <p className="text-2xl font-bold text-gray-900">{activeClients}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs text-gray-400 mb-1">📈 New This Month</p>
          <p className="text-2xl font-bold text-gray-900">{newThisMonth}</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Referral Link</h2>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 mb-4">
          <code className="flex-1 text-sm text-teal-700 font-mono break-all">{referralLink}</code>
          <AffiliateCopyButton text={referralLink} />
        </div>
        <div className="flex gap-6 text-sm text-gray-500">
          <span>📊 {totalClients} total signups</span>
          <span>✅ {activeClients} active</span>
          <span>❌ {churnedClients} churned</span>
        </div>
      </div>

      {/* Client roster */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Client Roster</h2>
        {(!referrals || referrals.length === 0) ? (
          <p className="text-gray-400 text-sm">No referrals yet. Share your referral link to get started!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium">Plan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Your Cut/mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {referrals.map(r => {
                  const name = r.profiles?.full_name || 'Unknown'
                  const nameParts = name.trim().split(' ')
                  const displayName = nameParts.length > 1
                    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                    : nameParts[0]
                  const cut = Number(r.monthly_revenue) * affiliate.level1_rate
                  return (
                    <tr key={r.id}>
                      <td className="py-3 font-medium text-gray-800">{displayName}</td>
                      <td className="py-3 text-gray-500">
                        {new Date(r.signed_up_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 text-gray-500 capitalize">{r.profiles?.plan || '—'}</td>
                      <td className="py-3">
                        {r.status === 'active'
                          ? <span className="text-teal-600">✅ Active</span>
                          : <span className="text-red-500">❌ Churned</span>
                        }
                      </td>
                      <td className="py-3 text-right font-semibold text-gray-900">
                        {r.monthly_revenue > 0 ? `$${cut.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Earnings chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Earnings — Last 6 Months</h2>
        <div className="flex items-end gap-3 h-32">
          {last6Months.map(m => {
            const heightPct = maxMonthEarning > 0 ? (m.total / maxMonthEarning) * 100 : 0
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">${m.total.toFixed(0)}</span>
                <div className="w-full relative" style={{ height: '80px' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-teal-500 rounded-t-lg transition-all"
                    style={{ height: `${Math.max(heightPct, m.total > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payout history */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payout History</h2>
        {(!earnings || earnings.length === 0) ? (
          <p className="text-gray-400 text-sm">No earnings records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-3 font-medium">Month</th>
                  <th className="pb-3 font-medium">Level</th>
                  <th className="pb-3 font-medium text-right">Gross Rev</th>
                  <th className="pb-3 font-medium text-right">Rate</th>
                  <th className="pb-3 font-medium text-right">Earnings</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {earnings.map(e => (
                  <tr key={e.id}>
                    <td className="py-3 text-gray-700">
                      {new Date(e.period_month + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 text-gray-500">L{e.level}</td>
                    <td className="py-3 text-right text-gray-700">${Number(e.gross_revenue).toFixed(2)}</td>
                    <td className="py-3 text-right text-gray-500">{(Number(e.rate) * 100).toFixed(0)}%</td>
                    <td className="py-3 text-right font-semibold text-gray-900">${Number(e.earnings).toFixed(2)}</td>
                    <td className="py-3"><StatusBadge status={e.status} /></td>
                    <td className="py-3 text-gray-400 text-xs">
                      {e.paid_at ? new Date(e.paid_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Level 2 sub-affiliates */}
      {subAffiliates && subAffiliates.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Level 2 — Your Network</h2>
          <p className="text-sm text-gray-400 mb-4">Affiliates you referred — you earn 5% of their clients&apos; revenue.</p>
          <div className="divide-y divide-gray-100">
            {subAffiliates.map(sub => {
              const subEarnings = (earnings || [])
                .filter(e => e.level === 2)
                .reduce((sum, e) => sum + Number(e.earnings), 0)
              return (
                <div key={sub.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{sub.profiles?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 font-mono">{sub.referral_code}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={sub.status} />
                    <p className="text-xs text-gray-400 mt-1">${subEarnings.toFixed(2)} earned</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
