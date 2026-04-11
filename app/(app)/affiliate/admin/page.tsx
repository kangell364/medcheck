import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AffiliateAdminActions from '@/components/AffiliateAdminActions'

interface AffiliateWithProfile {
  id: string
  user_id: string
  referral_code: string
  status: 'pending' | 'active' | 'suspended'
  company_name: string | null
  bio: string | null
  level1_rate: number
  level2_rate: number
  approved_at: string | null
  created_at: string
  profiles: { full_name: string | null; plan: string } | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-teal-100 text-teal-700',
    pending: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default async function AffiliateAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return (
      <div className="max-w-lg mx-auto pb-20 md:pb-0 pt-16 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500">You don&apos;t have permission to view this page.</p>
        <Link href="/dashboard" className="mt-6 inline-block text-teal-600 hover:underline">Back to Dashboard</Link>
      </div>
    )
  }

  // Fetch all affiliates with profile info
  const { data: affiliates } = await supabase
    .from('affiliates')
    .select('*, profiles(full_name, plan)')
    .order('created_at', { ascending: false }) as { data: AffiliateWithProfile[] | null }

  const pending = (affiliates || []).filter(a => a.status === 'pending')
  const active = (affiliates || []).filter(a => a.status === 'active')
  const suspended = (affiliates || []).filter(a => a.status === 'suspended')

  // Get referral counts per affiliate
  const { data: referralCounts } = await supabase
    .from('referrals')
    .select('affiliate_id, status')

  const countMap: Record<string, { active: number; total: number }> = {}
  for (const r of referralCounts || []) {
    if (!countMap[r.affiliate_id]) countMap[r.affiliate_id] = { active: 0, total: 0 }
    countMap[r.affiliate_id].total++
    if (r.status === 'active') countMap[r.affiliate_id].active++
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 md:pb-0">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Admin</h1>
          <p className="text-gray-500 mt-1">Manage affiliate applications and accounts</p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">{pending.length} pending</span>
          <span className="bg-teal-100 text-teal-700 px-3 py-1 rounded-full font-medium">{active.length} active</span>
        </div>
      </div>

      {/* Pending applications */}
      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⏳ Pending Applications</h2>
          <div className="bg-white rounded-2xl border border-amber-100 divide-y divide-gray-100">
            {pending.map(a => (
              <div key={a.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-gray-900">{a.profiles?.full_name || 'Unknown'}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.company_name && (
                      <p className="text-sm text-gray-500 mb-1">🏢 {a.company_name}</p>
                    )}
                    {a.bio && (
                      <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg p-3 italic">&ldquo;{a.bio}&rdquo;</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">Applied {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="text-xs text-gray-400">Code: <span className="font-mono">{a.referral_code}</span></p>
                  </div>
                  <AffiliateAdminActions affiliateId={a.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active affiliates */}
      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">✅ Active Affiliates</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs text-gray-400">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium text-center">Clients</th>
                  <th className="px-5 py-3 font-medium text-center">L1 Rate</th>
                  <th className="px-5 py-3 font-medium text-center">L2 Rate</th>
                  <th className="px-5 py-3 font-medium">Since</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {active.map(a => (
                  <tr key={a.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">{a.profiles?.full_name || 'Unknown'}</p>
                      {a.company_name && <p className="text-xs text-gray-400">{a.company_name}</p>}
                    </td>
                    <td className="px-5 py-4 font-mono text-teal-600 text-xs">{a.referral_code}</td>
                    <td className="px-5 py-4 text-center text-gray-700">
                      {countMap[a.id]?.active || 0} / {countMap[a.id]?.total || 0}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-700">{(Number(a.level1_rate) * 100).toFixed(0)}%</td>
                    <td className="px-5 py-4 text-center text-gray-700">{(Number(a.level2_rate) * 100).toFixed(0)}%</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">
                      {a.approved_at ? new Date(a.approved_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <AffiliateAdminActions affiliateId={a.id} isActive />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suspended */}
      {suspended.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🚫 Suspended</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {suspended.map(a => (
              <div key={a.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{a.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-400 font-mono">{a.referral_code}</p>
                </div>
                <AffiliateAdminActions affiliateId={a.id} isSuspended />
              </div>
            ))}
          </div>
        </div>
      )}

      {(!affiliates || affiliates.length === 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4">🤝</div>
          <p className="text-gray-500">No affiliate applications yet.</p>
        </div>
      )}
    </div>
  )
}
