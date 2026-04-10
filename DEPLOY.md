# MedCheck Deployment Guide

## GitHub Repository
✅ **https://github.com/kangell364/medcheck**

## Step 1: Run Database Migrations

Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/swzyqqpbvobukicaxfkd/sql/new) and run the contents of `supabase/migrations/001_initial.sql`

This creates:
- `profiles` table (extends auth.users)
- `patients` table
- `medications` table  
- `dose_logs` table
- `patient_alerts` table
- `alert_log` table
- Row Level Security policies on all tables
- Auto-create profile trigger on signup

## Step 2: Configure Supabase Auth

In your [Supabase Auth Settings](https://supabase.com/dashboard/project/swzyqqpbvobukicaxfkd/auth/url-configuration):
- Set **Site URL** to your Vercel URL (e.g., `https://medcheck.vercel.app`)
- Add **Redirect URLs**: `https://medcheck.vercel.app/**`

## Step 3: Deploy to Vercel

### Option A: Vercel Dashboard (Easiest)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Connect your GitHub account
3. Import `kangell364/medcheck`
4. Add environment variables from your `.env.local` file
5. Click **Deploy**

### Option B: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

## Step 4: Environment Variables Required

Copy these from your `.env.local` file into Vercel's environment settings:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
NEXT_PUBLIC_APP_URL   <-- set to your Vercel URL after deploy
```

## Step 5: Configure Twilio Webhooks

After deployment, set these webhooks in [Twilio Console](https://console.twilio.com):

- **Inbound voice URL**: `https://YOUR_VERCEL_URL/api/twilio/inbound`
- **Status callback**: `https://YOUR_VERCEL_URL/api/twilio/status`

## Step 6: Update NEXT_PUBLIC_APP_URL

After getting your Vercel URL, update the env var:
```
NEXT_PUBLIC_APP_URL=https://YOUR_ACTUAL_VERCEL_URL
```

This is needed so outbound call TwiML points to the right URL.

## Step 7: Configure Stripe Webhook (Optional)

In [Stripe Dashboard](https://dashboard.stripe.com/webhooks), add endpoint:
- URL: `https://YOUR_VERCEL_URL/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.deleted`

Then update `STRIPE_WEBHOOK_SECRET` with the signing secret.

## Triggering Outbound Calls

For automated daily reminders, call the outbound API:
```
POST https://YOUR_VERCEL_URL/api/twilio/outbound
Content-Type: application/json
{ "patientId": "uuid-here" }
```

This can be scheduled via:
- A cron job service (EasyCron, cron-job.org)
- Vercel Cron Jobs (Pro plan)

## Checking Missed Doses

To check all patients for missed doses and send alerts:
```
GET https://YOUR_VERCEL_URL/api/alerts/check
```

Schedule this to run 1-2 hours after reminder calls.
