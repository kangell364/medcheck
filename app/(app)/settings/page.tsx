import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account</h2>
        <dl className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="text-sm font-medium text-gray-900">{profile?.full_name || '—'}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-sm font-medium text-gray-900">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Account type</dt>
            <dd className="text-sm font-medium text-gray-900 capitalize">{profile?.user_type || 'caregiver'}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-sm text-gray-500">Plan</dt>
            <dd className="text-sm font-medium text-gray-900 capitalize">
              <span className="bg-teal-100 text-teal-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                {profile?.plan || 'Free'}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Billing */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Billing</h2>
        <p className="text-sm text-gray-500 mb-4">
          MedCheck Free includes up to 1 patient. Upgrade for more patients and call features.
        </p>
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-5 text-white">
          <h3 className="font-bold text-xl mb-1">MedCheck Pro</h3>
          <p className="text-teal-100 text-sm mb-3">Unlimited patients • Automated daily calls • SMS alerts</p>
          <p className="text-3xl font-bold mb-4">$19<span className="text-base font-normal text-teal-200">/month</span></p>
          <button className="bg-white text-teal-700 font-semibold py-2.5 px-6 rounded-xl hover:bg-teal-50 transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h2>
        <SignOutButton />
      </div>
    </div>
  )
}
