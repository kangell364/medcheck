import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | RxNudge',
  description: 'RxNudge Terms of Service and User Agreement',
}

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective Date: {effectiveDate}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-gray-700 leading-relaxed">

          {/* ─── TOP WARNING BOX ─── */}
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-5">
            <p className="text-red-900 font-bold text-base mb-1">⚠️ RxNudge is a reminder app only.</p>
            <p className="text-red-800 text-sm leading-relaxed font-medium">
              Members added to your account are <strong>NOT</strong> under RxNudge&apos;s care.
              RxNudge cannot respond to emergencies, health crises, or missed medications.{' '}
              <strong>In an emergency, call 911.</strong>
            </p>
          </div>

          {/* ─── WHAT WE ARE ─── */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <p className="text-teal-900 font-bold text-base mb-1">💊 What is RxNudge?</p>
            <p className="text-teal-800 text-sm leading-relaxed">
              RxNudge is a <strong>reminder notification app</strong> — like setting an alarm on your
              phone, just smarter. We help people remember to take their medications by sending calls
              and texts at scheduled times. That&apos;s it. We are not doctors, nurses, caregivers, or a
              healthcare service of any kind.
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-sm">
              By accessing or using RxNudge (&quot;the Service,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you (&quot;User,&quot;
              &quot;Account Holder,&quot; &quot;you,&quot; or &quot;your&quot;) agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you do not agree to all of these Terms, you must immediately stop using
              the Service. Your continued use constitutes ongoing acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. What RxNudge Does</h2>
            <p className="text-sm mb-3">
              RxNudge is an automated reminder platform that sends phone calls, text messages, and
              notifications to remind you — or people you add to your account — to take medications
              at scheduled times. The Service is a <strong>convenience reminder tool only</strong>.
            </p>
            <p className="text-sm">
              RxNudge does <strong>not</strong>: dispense medications, provide medical advice, diagnose
              or treat any condition, verify medication accuracy or dosage, guarantee delivery of any
              reminder, supervise or monitor anyone&apos;s health or safety, or serve as a substitute for
              professional medical care.
            </p>
          </section>

          {/* ─── SECTION 2a — THE BIG ONE ─── */}
          <section className="border-2 border-red-400 rounded-xl p-6 bg-red-50">
            <h2 className="text-xl font-bold text-red-900 mb-4">
              2a. Members Are Not Under Our Care
            </h2>

            <p className="text-sm font-bold text-red-900 mb-3 uppercase tracking-wide">
              RxNudge IS NOT a healthcare provider, medical service, home care agency,
              or caregiver service of any kind.
            </p>

            <p className="text-sm text-red-800 mb-3">
              <strong>Members added to RxNudge accounts ARE NOT patients of RxNudge.</strong>{' '}
              RxNudge does not provide care, supervision, monitoring, treatment, or oversight of
              any member&apos;s health, safety, or wellbeing.
            </p>

            <p className="text-sm text-red-800 mb-3">
              RxNudge is a reminder notification app — nothing more. Adding someone to your RxNudge
              account does <strong>not</strong> create any duty of care, medical relationship,
              custodial relationship, or legal responsibility on the part of RxNudge toward that person.
            </p>

            <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-3">
              <p className="text-sm font-bold text-red-900 mb-2">
                YOU — the account holder — remain solely and entirely responsible for:
              </p>
              <ul className="text-sm text-red-800 space-y-1 list-none">
                <li>• The health, safety, and wellbeing of yourself and any person you add</li>
                <li>• Ensuring medications are taken correctly and as prescribed</li>
                <li>• Maintaining appropriate supervision and care for any person in your care</li>
                <li>• Contacting emergency services or healthcare providers when needed</li>
              </ul>
            </div>

            <div className="bg-red-200 border-2 border-red-500 rounded-lg p-4 mb-3">
              <p className="text-sm font-bold text-red-900 uppercase tracking-wide text-center">
                IF A MEMBER MISSES A MEDICATION, IS IN DISTRESS, OR REQUIRES ASSISTANCE,
                RXNUDGE WILL NOT AND CANNOT RESPOND.
              </p>
              <p className="text-sm font-bold text-red-900 uppercase tracking-wide text-center mt-2">
                CONTACT EMERGENCY SERVICES (911) OR A HEALTHCARE PROVIDER IMMEDIATELY.
              </p>
            </div>

            <p className="text-sm text-red-800 font-semibold">
              RxNudge assumes zero liability for the health, safety, or wellbeing of any member.
              Our sole function is to send reminder notifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. No Medical Relationship</h2>
            <p className="text-sm mb-3">
              Use of the Service does not create a doctor-patient relationship, caregiver relationship,
              treatment relationship, or any other professional healthcare relationship between you and
              RxNudge or any of its employees, contractors, or affiliates.
            </p>
            <p className="text-sm">
              Nothing in the Service constitutes medical advice. No information provided through the
              Service should be relied upon for health decisions. Always consult a qualified healthcare
              professional about your medications, health conditions, and care needs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Medical Disclaimer</h2>
            <p className="text-sm mb-3">
              <strong>THE SERVICE IS NOT A MEDICAL DEVICE AND DOES NOT DIAGNOSE, TREAT, CURE,
              OR PREVENT ANY DISEASE OR MEDICAL CONDITION.</strong>
            </p>
            <p className="text-sm mb-3">
              We make no representation that reminders will be received, that medications will be
              taken, or that use of the Service will improve any health outcome.{' '}
              <strong>You are solely responsible for taking medications correctly, on time, and as
              directed by your healthcare provider.</strong>
            </p>
            <p className="text-sm mb-3">RxNudge assumes no liability whatsoever for:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Any missed medication dose, regardless of cause</li>
              <li>Any medication taken in excess of the prescribed amount</li>
              <li>Any adverse health event, injury, illness, or death</li>
              <li>Any failure, delay, or error in delivering a reminder call, text, or notification</li>
              <li>Any technical failure, outage, or interruption of the Service</li>
              <li>Any harm from relying on this Service as a sole means of medication management</li>
              <li>Any drug interactions or contraindications</li>
              <li>Any error in the medication schedule entered by the user</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Your Responsibilities</h2>
            <p className="text-sm mb-3">You agree that you are solely responsible for:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li>Entering accurate medication names, dosages, and schedules into the Service</li>
              <li>Verifying that all medication information entered is correct and up-to-date</li>
              <li>Ensuring the phone numbers and contact information entered are accurate</li>
              <li>Taking medications as prescribed by a licensed healthcare provider</li>
              <li>Not relying exclusively on RxNudge reminders for medication management</li>
              <li>The health and safety of yourself and any person you add to your account</li>
              <li>Contacting appropriate emergency services or healthcare providers when needed</li>
              <li>Complying with all applicable laws regarding your use of the Service</li>
              <li>Obtaining any required consent before adding another person to your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5a. Adding Other Members to Your Account</h2>
            <p className="text-sm mb-3">
              When you add another person to your RxNudge account, you represent, warrant, and agree that:
            </p>
            <ul className="text-sm list-disc pl-5 space-y-1 mb-3">
              <li>You have the permission of that person to add them and to send them reminders</li>
              <li>You have obtained their express consent to receive automated telephone calls,
                  text messages, and other communications from RxNudge at the number you provide</li>
              <li>The person is aware that calls from RxNudge may be recorded where required by law</li>
              <li>You will promptly remove any person from the Service if they ask to be removed
                  or withdraw consent to receive messages</li>
              <li>All information you provide about the person (name, phone number, state,
                  medications) is accurate and current</li>
            </ul>
            <p className="text-sm mb-3">
              <strong>Adding someone to your account does not make RxNudge responsible for their
              care, wellbeing, or medication management in any way.</strong> RxNudge&apos;s sole function
              is to send reminder notifications to the phone number you provide.
            </p>
            <p className="text-sm">
              If you add a person without their consent, or provide false information about consent,
              you agree to fully indemnify, defend, and hold harmless RxNudge from any and all
              claims, fines, penalties, or damages arising from such unauthorized addition, including
              any claims under the Telephone Consumer Protection Act (TCPA), the Texas Business &amp;
              Commerce Code Chapter 302, state wiretapping laws, or any other applicable law.
            </p>
          </section>

          {/* ─── SMS / TCPA COMPLIANCE SECTION — UNTOUCHED ─── */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. SMS &amp; Telephone Communications — TCPA Compliance</h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-900 text-sm font-semibold">
                📱 Message &amp; Data Rates May Apply. Message frequency varies. Carriers are not responsible
                for delayed or undelivered messages.
              </p>
            </div>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.1 Express Written Consent</h3>
            <p className="text-sm mb-4">
              By enrolling in RxNudge and providing a mobile phone number, you expressly consent —
              and, where enrolling another person, you represent that such person expressly consents —
              to receive automated text messages (SMS/MMS) and/or pre-recorded or artificial voice
              telephone calls from RxNudge at the mobile number provided, including numbers currently
              on any federal or state Do-Not-Call registry. This consent is not a condition of
              purchasing any goods or services. Standard message and data rates from your wireless
              carrier may apply.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.2 Types of Messages</h3>
            <p className="text-sm mb-2">By using the Service, you may receive:</p>
            <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
              <li>Daily medication reminder text messages (SMS/MMS)</li>
              <li>Automated voice calls for medication reminders</li>
              <li>Enrollment confirmation and opt-in verification messages</li>
              <li>Opt-out and opt-in confirmation messages</li>
              <li>Help and support messages in response to your requests</li>
              <li>Service notifications and updates related to your account</li>
            </ul>
            <p className="text-sm mb-4">
              Message frequency depends on the number of medications enrolled and your reminder
              schedule. Typically, <strong>1–5 messages per day</strong> per enrolled member.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.3 How to Opt Out (STOP)</h3>
            <p className="text-sm mb-4">
              You may opt out of receiving SMS/MMS messages at any time by replying{' '}
              <strong>STOP</strong> to any RxNudge text message. The following opt-out keywords are
              also recognized: <strong>STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT</strong>. Upon receipt
              of any of these keywords, we will send one final confirmation message and you will
              receive no further SMS/MMS messages from RxNudge unless you re-subscribe. Opting out
              of SMS does not cancel your RxNudge account or remove you from voice call reminders
              (if enabled). To disable all reminders, log in to your account settings.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.4 How to Re-Subscribe (START)</h3>
            <p className="text-sm mb-4">
              If you have previously opted out, you may re-subscribe to SMS reminders at any time
              by replying <strong>START</strong> to the RxNudge number or by updating your reminder
              preferences in your account settings. Re-subscribing constitutes a new express consent
              to receive automated messages.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.5 Help</h3>
            <p className="text-sm mb-4">
              For help, reply <strong>HELP</strong> to any RxNudge text message. You will receive
              a support message with contact information and a link to rxnudge.app. You may also
              contact us at{' '}
              <a href="mailto:support@rxnudge.app" className="text-teal-600 hover:underline">
                support@rxnudge.app
              </a>.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.6 Carrier Disclaimer</h3>
            <p className="text-sm mb-4">
              <strong>Carriers (including but not limited to AT&amp;T, Verizon, T-Mobile, Sprint,
              US Cellular, and their affiliates) are not liable for delayed or undelivered
              messages.</strong> Message delivery is subject to effective transmission and your
              carrier&apos;s coverage area. RxNudge does not guarantee delivery of any SMS, MMS, or
              voice message and shall not be liable for any failed, delayed, or undelivered
              communication.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.7 Automated Calls — TCPA &amp; Texas Law</h3>
            <p className="text-sm mb-4">
              RxNudge may place automated or pre-recorded voice calls to phone numbers you provide.
              By using the Service, you expressly consent to receive such calls. If you do not wish
              to receive automated calls, you may disable call reminders in your account settings
              at any time.
            </p>
            <p className="text-sm mb-4">
              Users located in Texas acknowledge that RxNudge&apos;s automated communications constitute
              informational (non-marketing) messages sent pursuant to express prior consent, and are
              therefore exempt from certain telemarketing registration requirements under Texas
              Business &amp; Commerce Code Chapter 302, as amended by Senate Bill 140 (effective
              September 1, 2025). Nonetheless, RxNudge complies with all applicable consent,
              opt-out, and quiet hours requirements under both federal TCPA and Texas law.
            </p>
            <p className="text-sm mb-4">
              <strong>Quiet Hours:</strong> RxNudge will not initiate automated calls or send
              SMS reminders between the hours of 9:00 PM and 8:00 AM in the member&apos;s local time
              zone, consistent with federal TCPA and Texas regulations.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.8 Do-Not-Call Compliance</h3>
            <p className="text-sm mb-4">
              RxNudge&apos;s communications are initiated solely based on the express written consent
              you provide at enrollment. By providing a phone number and consenting to reminders,
              you acknowledge that your consent supersedes any registration on the National
              Do-Not-Call Registry or the Texas No-Call List with respect to RxNudge&apos;s informational
              reminder communications. You may withdraw consent at any time as described in
              Section 6.3.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.9 Consent Revocation — FCC Rules (Effective April 2025)</h3>
            <p className="text-sm mb-4">
              Pursuant to updated FCC rules effective April 11, 2025, you may revoke consent to
              receive automated messages at any time using any reasonable means, including replying
              STOP to any message, contacting us at support@rxnudge.app, or updating your preferences
              in your account dashboard. RxNudge will honor all consent revocation requests within
              a commercially reasonable time, not to exceed 10 business days.
            </p>

            <h3 className="text-base font-semibold text-gray-800 mb-2">6.10 SMS Program Details Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 border border-gray-200">
              <p><strong>Program Name:</strong> RxNudge Medication Reminders</p>
              <p><strong>Message Types:</strong> Medication reminders, enrollment confirmations, service notifications</p>
              <p><strong>Frequency:</strong> Varies by schedule; typically 1–5 messages/day</p>
              <p><strong>Cost:</strong> Free from RxNudge. Message &amp; data rates from your carrier may apply.</p>
              <p><strong>To Stop:</strong> Reply STOP to any message</p>
              <p><strong>For Help:</strong> Reply HELP or email support@rxnudge.app</p>
              <p><strong>Carriers:</strong> Not responsible for delayed or undelivered messages</p>
              <p><strong>Supported Carriers:</strong> AT&amp;T, Verizon, T-Mobile, Sprint, US Cellular, and most major U.S. carriers</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Disclaimer of Warranties</h2>
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Limitation of Liability</h2>
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Indemnification</h2>
            <p className="text-sm">
              You agree to indemnify, defend, and hold harmless RxNudge and its officers, directors,
              employees, agents, and affiliates from and against any and all claims, liabilities,
              damages, losses, costs, and expenses (including reasonable attorneys&apos; fees) arising out
              of or relating to: (a) your use of the Service; (b) your violation of these Terms;
              (c) your violation of any applicable law or regulation, including without limitation
              the TCPA and Texas Business &amp; Commerce Code Chapter 302; (d) any information you submit
              to the Service; (e) any unauthorized addition of a third party; or (f) any harm to
              any person resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Call Recording &amp; Monitoring</h2>
            <p className="text-sm mb-3">
              RxNudge reminder calls may be recorded or monitored for quality assurance, service
              improvement, and record-keeping purposes. By using the Service and providing a phone
              number, you acknowledge and agree that calls placed by RxNudge to you or any member
              you add may be recorded.
            </p>
            <p className="text-sm mb-3">
              In states that require all-party consent for call recording (including California,
              Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire,
              Oregon, Pennsylvania, and Washington), RxNudge will play an automated verbal disclosure
              at the beginning of each call notifying the recipient that the call may be recorded.
              By selecting a state for a member in the Service, you represent that the member resides
              in that state, and you authorize RxNudge to deliver the appropriate disclosure on
              your behalf.
            </p>
            <p className="text-sm">
              <strong>You are responsible for ensuring that the state information you provide for
              each member is accurate.</strong> RxNudge is not liable for any recording law violations
              resulting from inaccurate state information provided by you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Data &amp; Privacy</h2>
            <p className="text-sm">
              We store the medication names, schedules, and contact information you enter into the
              Service. We are not a healthcare provider and do not handle medical records. RxNudge
              is not a Covered Entity or Business Associate under HIPAA. While we take reasonable
              steps to protect information you enter, we make no representations that the Service
              is HIPAA-compliant. Do not use RxNudge for any purpose that requires HIPAA compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">12. Governing Law &amp; Dispute Resolution</h2>
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
            <h2 className="text-xl font-bold text-gray-900 mb-3">13. Changes to Terms</h2>
            <p className="text-sm">
              We reserve the right to modify these Terms at any time. We will notify registered users
              of material changes via email or in-app notice. Your continued use of the Service after
              any such changes constitutes your acceptance of the new Terms. If you do not agree with
              the updated Terms, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">14. Contact</h2>
            <p className="text-sm">
              For questions about these Terms, contact us at:{' '}
              <a href="mailto:legal@rxnudge.app" className="text-teal-600 hover:underline">
                legal@rxnudge.app
              </a>
              <br />
              For SMS support, reply <strong>HELP</strong> to any message or email:{' '}
              <a href="mailto:support@rxnudge.app" className="text-teal-600 hover:underline">
                support@rxnudge.app
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
