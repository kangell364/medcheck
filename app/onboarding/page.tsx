import Link from 'next/link'

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-teal-100 rounded-3xl mb-6">
            <span className="text-4xl">💊</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome to MedCheck!</h1>
          <p className="text-xl text-gray-500">How will you be using MedCheck?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Self tracker */}
          <Link href="/onboarding/self" className="group">
            <div className="bg-white rounded-3xl border-2 border-transparent hover:border-teal-400 p-8 shadow-sm hover:shadow-md transition-all">
              <div className="text-5xl mb-5">🙋</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Track MY medications
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                I want reminders for my own medications and to track my adherence.
              </p>
              <div className="mt-6 flex items-center gap-2 text-teal-600 font-medium group-hover:gap-3 transition-all">
                Get started <span>→</span>
              </div>
            </div>
          </Link>

          {/* Caregiver */}
          <Link href="/onboarding/caregiver" className="group">
            <div className="bg-white rounded-3xl border-2 border-transparent hover:border-teal-400 p-8 shadow-sm hover:shadow-md transition-all">
              <div className="text-5xl mb-5">👨‍👩‍👧</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Track my parent&apos;s medications
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                I want to help a family member stay on track and get alerts if they miss a dose.
              </p>
              <div className="mt-6 flex items-center gap-2 text-teal-600 font-medium group-hover:gap-3 transition-all">
                Get started <span>→</span>
              </div>
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          You can always change this later in Settings
        </p>
      </div>
    </div>
  )
}
