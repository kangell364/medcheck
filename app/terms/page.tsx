import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | RxNudge',
  description: 'RxNudge Terms of Service and User Agreement',
}

export default function TermsPage() {
  const effectiveDate = 'April 11, 2025'

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective Date: {effectiveDate}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-gray-700 leading-relaxed">

          {/* IMPORTANT NOTICE */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-5">
            <p className="text-amber-900 font-bold text-base mb-1">⚠️ IMPORTANT MEDICAL DISCLAIMER</p>
            <p className="text-amber-800 text-sm leading-relaxed">
              RxNudge is a <strong>medication reminder tool only</strong>. It is NOT a medical device,
              NOT a substitute for professional medical advice, and NOT responsible for your health outcomes.
              Always consult a licensed healthcare provider regarding your medications.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-sm">
              By accessing or using RxNudge (&quot;the Service,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you (&quot;User,&quot;
              &quot;you,&quot; or &quot;your&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not
              agree to all of these Terms, you must immediately stop using the Service. Your continued
              use of the Service constitutes your ongoing acceptance of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
            <p className="text-sm mb-3">
              RxNudge provides an automated medication reminder platform that sends phone calls, text
              messages, and notifications to remind users or their designated patients to take medications
              as scheduled. The Service is intended solely as a <strong>convenience reminder tool</strong>.
            </p>
            <p className="text-sm">
              RxNudge does <strong>not</strong>: dispense medications, provide medical advice, diagnose or
              treat any condition, verify medication accuracy or dosage, guarantee delivery of any reminder,
              or serve as a substitute for professional medical care or supervision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Medical Disclaimer &amp; Limitation of Medical Liability</h2>
            <p className="text-sm mb-3">
              <strong>THE SERVICE IS NOT A MEDICAL DEVICE AND IS NOT INTENDED TO DIAGNOSE, TREAT, CURE,
              OR PREVENT ANY DISEASE OR MEDICAL CONDITION.</strong>
            </p>
            <p className="text-sm mb-3">
              RxNudge is a technology tool designed solely to send reminders. We make no representation
              that reminders will be received, that medications will be taken, or that use of the Service
              will improve any health outcome. <strong>You are solely responsible for taking your
              medications correctly, on time, and in the proper dosage as directed by your healthcare
              provider.</strong>
            </p>
            <p className="text-sm mb-3">
              RxNudge assumes no liability whatsoever for:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Any missed medication dose, regardless of cause</li>
              <li>Any medication taken in excess of the prescribed amount</li>
              <li>Any adverse health event, injury, illness, or death resulting from a missed or
                  incorrect medication dose</li>
              <li>Any failure, delay, or error in delivering a reminder call, text, or notification</li>
              <li>Any technical failure, outage, or interruption of the Service</li>
              <li>Any harm resulting from reliance on the Service as a sole means of medication management</li>
              <li>Any drug interactions or contraindications</li>
              <li>Any error in the medication schedule entered by the user</li>
            </ul>
            <p className="text-sm mt-3">
              <strong>You acknowledge and agree that the Service is a supplemental reminder tool only,
              and that you bear full personal responsibility for the management of your own or your
              patient&apos;s medications.</strong> RxNudge strongly recommends maintaining independent methods
              of medication tracking and working closely with licensed healthcare professionals.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. No Doctor-Patient Relationship</h2>
            <p className="text-sm">
              Use of the Service does not create a doctor-patient, caregiver-patient, or any other
              professional healthcare relationship between you and RxNudge or any of its employees,
              contractors, or affiliates. Nothing in the Service constitutes medical advice, and no
              information provided through the Service should be relied upon as such. Always consult
              a qualified healthcare professional before making any decisions about medications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. User Responsibilities</h2>
            <p className="text-sm mb-3">You agree that you are solely responsible for:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Entering accurate medication names, dosages, and schedules into the Service</li>
              <li>Verifying that all medication information entered is correct and up-to-date</li>
              <li>Ensuring the phone numbers and contact information entered are accurate</li>
              <li>Taking medications as prescribed by a licensed healthcare provider</li>
              <li>Not relying exclusively on RxNudge reminders for medication management</li>
              <li>Maintaining appropriate oversight and care for any patient for whom you use the Service</li>
              <li>Complying with all applicable laws regarding healthcare and medication management</li>
              <li>Obtaining any required consent before adding another person as a patient in the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5a. Third-Party Patient Enrollment &amp; Caregiver Consent</h2>
            <p className="text-sm mb-3">
              When you enroll a third party (such as a family member, parent, or patient in your care)
              as a patient in the Service, you represent, warrant, and agree that:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1 mb-3">
              <li>You have obtained the express prior consent of that person to receive automated
                  telephone calls, text messages, and other communications from RxNudge at the
                  phone number you provide</li>
              <li>You have the legal authority to enroll that person in the Service and to accept
                  these Terms on their behalf</li>
              <li>The enrolled person is aware that calls from RxNudge may be recorded (where
                  applicable) and has consented to such recording</li>
              <li>You will immediately remove any person from the Service if they withdraw their
                  consent to receive calls or messages</li>
              <li>All information you provide about the enrolled person (name, phone number, state
                  of residence, medications) is accurate and current</li>
            </ul>
            <p className="text-sm mb-3">
              <strong>You acknowledge that by checking the consent confirmation box when adding a
              patient, you are making a legally binding representation that the above conditions
              are satisfied.</strong> RxNudge relies on this representation in good faith and
              assumes no liability for calls placed based on your confirmed consent.
            </p>
            <p className="text-sm">
              If you enroll a person without their consent, or provide false information about
              consent, you agree to fully indemnify, defend, and hold harmless RxNudge from any
              and all claims, fines, penalties, or damages arising from such unauthorized enrollment,
              including any claims under the Telephone Consumer Protection Act (TCPA), state
              wiretapping laws, or any other applicable federal or state law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Disclaimer of Warranties</h2>
            <p className="text-sm mb-3">
              <strong>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND,
              EXPRESS OR IMPLIED.</strong> To the fullest extent permitted by applicable law, RxNudge
              expressly disclaims all warranties, including but not limited to:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
              <li>Any warranty that the Service will be uninterrupted, error-free, or secure</li>
              <li>Any warranty that reminders will be delivered on time or at all</li>
              <li>Any warranty regarding the accuracy or reliability of any information provided</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Limitation of Liability</h2>
            <p className="text-sm mb-3">
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RXNUDGE AND ITS OFFICERS,
              DIRECTORS, EMPLOYEES, AGENTS, PARTNERS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING
              BUT NOT LIMITED TO DAMAGES FOR PERSONAL INJURY, WRONGFUL DEATH, LOSS OF HEALTH, MEDICAL
              EXPENSES, PAIN AND SUFFERING, OR ANY OTHER DAMAGES ARISING OUT OF OR IN CONNECTION WITH
              YOUR USE OF OR INABILITY TO USE THE SERVICE.</strong>
            </p>
            <p className="text-sm mb-3">
              In no event shall RxNudge&apos;s total cumulative liability to you for all claims arising
              from or relating to these Terms or the Service exceed the greater of (a) the total amount
              paid by you to RxNudge in the twelve (12) months immediately preceding the claim, or
              (b) one hundred dollars ($100.00 USD).
            </p>
            <p className="text-sm">
              Some jurisdictions do not allow the exclusion of certain warranties or the limitation or
              exclusion of liability for certain types of damages. Accordingly, some of the above
              limitations may not apply to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Indemnification</h2>
            <p className="text-sm">
              You agree to indemnify, defend, and hold harmless RxNudge and its officers, directors,
              employees, agents, and affiliates from and against any and all claims, liabilities,
              damages, losses, costs, and expenses (including reasonable attorneys&apos; fees) arising out
              of or relating to: (a) your use of the Service; (b) your violation of these Terms;
              (c) your violation of any applicable law or regulation; (d) any information you submit
              to the Service; or (e) any harm to any patient or third party resulting from your use
              of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Call Recording &amp; Monitoring</h2>
            <p className="text-sm mb-3">
              RxNudge reminder calls may be recorded or monitored for quality assurance, service
              improvement, and record-keeping purposes. By using the Service and providing a phone
              number, you acknowledge and agree that calls placed by RxNudge to you or your designated
              patients may be recorded.
            </p>
            <p className="text-sm mb-3">
              In states that require all-party consent for call recording (including California,
              Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire,
              Oregon, Pennsylvania, and Washington), RxNudge will play an automated verbal disclosure
              at the beginning of each call notifying the recipient that the call may be recorded.
              By selecting a patient&apos;s state in the Service, you represent that the patient resides
              in that state, and you authorize RxNudge to deliver the appropriate disclosure on your
              behalf.
            </p>
            <p className="text-sm">
              <strong>You are responsible for ensuring that the state information you provide for
              each patient is accurate.</strong> RxNudge is not liable for any recording law violations
              resulting from inaccurate state information provided by you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. HIPAA Notice</h2>

            <p className="text-sm">
              RxNudge is not a Covered Entity or Business Associate under the Health Insurance
              Portability and Accountability Act (&quot;HIPAA&quot;). While we take reasonable steps to
              protect health-related information you enter, we make no representations that the
              Service is HIPAA-compliant. Do not enter Protected Health Information (&quot;PHI&quot;) if
              HIPAA compliance is required for your use case.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Governing Law &amp; Dispute Resolution</h2>
            <p className="text-sm mb-3">
              These Terms shall be governed by and construed in accordance with the laws of the
              State of Texas, without regard to its conflict of law provisions. Any dispute arising
              out of or relating to these Terms or the Service shall be resolved exclusively through
              binding arbitration in Harris County, Texas, under the rules of the American Arbitration
              Association, except that either party may seek injunctive or other equitable relief in
              any court of competent jurisdiction.
            </p>
            <p className="text-sm">
              <strong>YOU WAIVE YOUR RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN ANY CLASS ACTION
              LAWSUIT OR CLASS-WIDE ARBITRATION.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Changes to Terms</h2>
            <p className="text-sm">
              We reserve the right to modify these Terms at any time. We will notify registered users
              of material changes via email or in-app notice. Your continued use of the Service after
              any such changes constitutes your acceptance of the new Terms. If you do not agree with
              the updated Terms, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Contact</h2>
            <p className="text-sm">
              For questions about these Terms, contact us at:{' '}
              <a href="mailto:legal@rxnudge.app" className="text-teal-600 hover:underline">
                legal@rxnudge.app
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
