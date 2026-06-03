# PolicyVault Setup & Deployment Guide

## 1. Local Setup

### Prerequisites
- Node.js (v18 or v20 recommended)
- npm or yarn

### Installation
1. Navigate to the project folder.
2. Run `npm install` to install dependencies.

### Environment Variables
Create a `.env.local` file in the root directory and copy the contents from `.env.example`. Replace the empty values with your actual API keys.
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI — Primary (Gemini)
GEMINI_API_KEY=your_gemini_api_key

# AI — Fallback (Groq)
GROQ_API_KEY=your_groq_api_key

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_resend_domain_email

# WhatsApp (WAHA — optional, leave blank to disable)
WAHA_API_URL=
WAHA_API_KEY=
WAHA_SESSION_NAME=default

# App config
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=a_secure_random_string
```

### Database Setup (Supabase)
1. Create a new Supabase project.
2. Open the **SQL Editor** in Supabase and run the entire contents of `supabase/schema.sql`. This will create all necessary tables, functions, triggers, indexes, and Row Level Security (RLS) policies.
3. Go to **Storage** and create a **private** bucket named `policies`. (The `schema.sql` script also contains an insert for this if you run it).
4. Go to **Authentication > Providers**:
   - Enable the **Email** provider.
   - Disable **Confirm email** (since users are created manually).
   - Disable all other social providers (Google, GitHub, etc.).

### Running the App Locally
1. Run `npm run dev`
2. Access the application at `http://localhost:3000`
*(Note: PWA installation is typically disabled on localhost unless you explicitly allow it in browser flags, but it will work fine in production over HTTPS.)*

### Managing Users
There is no public sign-up page. To add a new agent:
1. Go to Supabase Dashboard > Authentication > Users > "Add user" -> "Create new user".
2. Enter the agent's email and a temporary password.
3. The database trigger (`handle_new_user`) will automatically create a row in the `profiles` table.
4. To update their name and company, run a quick SQL query:
   ```sql
   UPDATE public.profiles
   SET full_name = 'Rajesh Kumar', company_name = 'Kumar Insurance Agency'
   WHERE email = 'rajesh@example.com';
   ```

---

## 2. Deployment

### Vercel
PolicyVault is optimized for Vercel's hobby tier.
1. Push your code to a GitHub repository.
2. Go to Vercel and import the repository.
3. Add all your environment variables from `.env.local` to Vercel. 
4. Ensure `NEXT_PUBLIC_APP_URL` is set to your actual Vercel domain (e.g., `https://policyvault.vercel.app`).
5. Click **Deploy**.

### Post-Deployment (Cron Jobs)
Once deployed, you need to tell Supabase to ping your Vercel API routes on a schedule to trigger emails and status updates.
1. Open `supabase/cron_setup.sql`.
2. Replace `YOUR_VERCEL_URL` with your production URL.
3. Replace `YOUR_CRON_SECRET` with the exact `CRON_SECRET` you set in Vercel.
4. Run the script in the Supabase SQL Editor.

This schedules:
- **Daily Alerts:** Runs at 8:00 AM IST.
- **Mark Expired Policies:** Runs daily.
- **Monthly Register:** Runs on the 1st of every month at 8:00 AM IST.
