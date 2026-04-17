import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | RxNudge',
  description: 'RxNudge Privacy Policy — how we collect, use, and protect your information.',
}

export default function PrivacyPage() {
  const effectiveDate = 'April 11, 2026'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/signup" className="text-sm text-teal-600 hover:underline mb-6 inline-block">
            ← Back to Sign Up
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">💊</span>
            <span className="text-xl font-bold text-teal-700">RxNudge</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective Date: {effectiveDate}</p>
          <p className="text-sm font-bold text-gray-900 mt-3">RxNudge is a service provided by Lendpromise.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Overview</h2>
            <p className="text-sm">
              RxNudge (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy
              Policy explains how we collect, use, disclose, and safeguard information when you use
              our medication reminder service at rxnudge.app (&quot;the Service&quot;). Please read this
              policy carefully. If you disagree with its terms, please discontinue use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Information We Collect</h2>
            <p className="text-sm font-semibold text-gray-800 mb-2">Information You Provide Directly:</p>
            <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
              <li>Account information: name, email address, password</li>
              <li>Patient information: names, phone numbers, time zones</li>
              <li>Medication information: medication names, dosages, schedules, reminder times</li>
              <li>Family/caregiver contact information you add to the Service</li>
              <li>Payment information (processed securely by Stripe — we do not store card numbers)</li>
            </ul>
            <p className="text-sm font-semibold text-gray-800 mb-2">Information Collected Automatically:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Log data: IP address, browser type, pages visited, time spent</li>
              <li>Device information: device type, operating system</li>
              <li>Usage data: features used, actions taken within the Service</li>
              <li>Call and message delivery logs (for service reliability purposes)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p className="text-sm mb-2">We use collected information to:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Provide and operate the medication reminder Service</li>
              <li>Send reminder calls and text messages on your configured schedule</li>
              <li>Send alert notifications to designated family members or caregivers</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (account confirmation, password reset, reports)</li>
              <li>Monitor and improve the performance and reliability of the Service</li>
              <li>Respond to customer support requests</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="text-sm mt-3">
              <strong>We do not sell, rent, or trade your personal information or health-related data
              to third parties for marketing purposes.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Health Information</h2>
            <p className="text-sm mb-3">
              The medication and patient information you enter into RxNudge may be considered
              health-related information. We treat this data with heightened care:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Health data is encrypted in transit and at rest</li>
              <li>Access is restricted to authorized service components only</li>
              <li>We do not share health data with advertisers or data brokers</li>
              <li>Health data is used solely to provide the reminder Service you have configured</li>
            </ul>
            <p className="text-sm mt-3">
              As noted in our Terms of Service, RxNudge is not a HIPAA Covered Entity. If HIPAA
              compliance is required for your use case, RxNudge may not be appropriate for your needs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Information Sharing &amp; Disclosure</h2>
            <p className="text-sm mb-3">We may share your information with:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li><strong>Service Providers:</strong> Third-party vendors who help operate the Service
                (Supabase for database, Twilio for calls/SMS, Stripe for payments, Resend for email).
                These providers are bound by confidentiality obligations.</li>
              <li><strong>Family Members / Caregivers:</strong> Alert notifications are sent to the
                contacts you designate within the Service.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law,
                court order, or governmental authority.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale
                of assets, your information may be transferred as part of that transaction.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Call Recording</h2>
            <p className="text-sm mb-3">
              Reminder calls placed by RxNudge may be recorded. In states requiring all-party
              consent (CA, FL, IL, MD, MA, MI, MT, NV, NH, OR, PA, WA), a verbal disclosure is
              played automatically at the start of every call before any recording begins.
            </p>
            <p className="text-sm">
              Call recordings and transcriptions may be used to: (a) confirm medication responses,
              (b) improve voice recognition accuracy, and (c) resolve disputes. Recordings are
              retained for up to 90 days and then deleted unless required for an active dispute.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Data Retention</h2>
            <p className="text-sm">
              We retain your account and medication data for as long as your account is active.
              If you delete your account, we will delete or anonymize your personal data within
              30 days, except where retention is required by law. Dose log history may be retained
              in anonymized form for service improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Data Security</h2>
            <p className="text-sm">
              We implement reasonable technical and organizational security measures to protect your
              information, including TLS encryption for data in transit and encryption at rest.
              However, <strong>no method of transmission over the Internet or electronic storage is
              100% secure.</strong> We cannot guarantee absolute security, and you use the Service
              at your own risk. In the event of a data breach affecting your information, we will
              notify you as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Your Rights &amp; Choices</h2>
            <p className="text-sm mb-3">You have the right to:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate personal data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Opt-out:</strong> Opt out of non-essential communications at any time</li>
              <li><strong>Portability:</strong> Request an export of your data in a portable format</li>
            </ul>
            <p className="text-sm mt-3">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@rxnudge.app" className="text-teal-600 hover:underline">
                privacy@rxnudge.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Children&apos;s Privacy</h2>
            <p className="text-sm">
              The Service is not directed to children under the age of 13. We do not knowingly
              collect personal information from children under 13. If you believe we have inadvertently
              collected such information, please contact us immediately and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Third-Party Links</h2>
            <p className="text-sm">
              The Service may contain links to third-party websites. We are not responsible for
              the privacy practices of those sites and encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Changes to This Policy</h2>
            <p className="text-sm">
              We may update this Privacy Policy from time to time. We will notify you of material
              changes via email or prominent notice within the Service. Your continued use of the
              Service after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Contact Us</h2>
            <p className="text-sm">
              For privacy-related questions or requests, contact us at:{' '}
              <a href="mailto:privacy@rxnudge.app" className="text-teal-600 hover:underline">
                privacy@rxnudge.app
              </a>
            </p>
          </section>

        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          © {new Date().getFullYear()} RxNudge. All rights reserved.
        </p>
      </div>
    </div>
  )
}
