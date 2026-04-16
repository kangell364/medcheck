'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import SignOutButton from '@/components/SignOutButton'

type Profile = {
  id: string
  full_name: string | null
  phone: string | null
  user_type: string | null
  plan: string | null
  created_at: string
}

export default function SettingsPage() {
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string>('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const currentEmail = user?.email ?? ''
      setUserEmail(currentEmail)
      setEmail(currentEmail)

      const res = await fetch('/api/profile', { cache: 'no-store' })
      if (!res.ok) return
      const j = await res.json()
      setProfile(j.profile)
      setFullName(j.profile?.full_name ?? '')
      setPhone(j.profile?.phone ?? '')
    }
    load()
  }, [supabase])

  async function save() {
    setSaving(true)
    setError('')

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone, email }),
    })

    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(j?.error || 'Save failed')
      setSaving(false)
      return
    }

    if (j.profile) setProfile(j.profile)
    setEditing(false)
    setSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 md:pb-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Account</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-teal-700 hover:text-teal-800"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditing(false)
                  setError('')
                  setFullName(profile?.full_name ?? '')
                  setPhone(profile?.phone ?? '')
                  setEmail(userEmail)
                }}
                className="text-sm font-semibold text-gray-600 hover:text-gray-800"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <dl className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Name</dt>
            <dd className="text-sm font-medium text-gray-900">
              {!editing ? (
                profile?.full_name || '—'
              ) : (
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-56 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Your name"
                />
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Phone</dt>
            <dd className="text-sm font-medium text-gray-900">
              {!editing ? (
                profile?.phone || '—'
              ) : (
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-56 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+1..."
                />
              )}
            </dd>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-sm font-medium text-gray-900">
              {!editing ? (
                userEmail || '—'
              ) : (
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-56 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="you@example.com"
                />
              )}
            </dd>
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
          RxNudge Free includes up to 1 member. Upgrade for more members and call features.
        </p>
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-xl p-5 text-white">
          <h3 className="font-bold text-xl mb-1">RxNudge Pro</h3>
          <p className="text-teal-100 text-sm mb-3">Unlimited members • Automated daily calls • SMS alerts</p>
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
