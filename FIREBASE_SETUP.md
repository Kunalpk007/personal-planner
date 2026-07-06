# Firebase Setup Guide — Kunal's Planner

> **Free forever** on Spark plan: 50K reads/day, 20K writes/day, unlimited Auth.
> No credit card required.

---

## Step 1 — Create Firebase Project

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Click **Add project** → name it `kunals-planner`
3. Disable Google Analytics → **Create project**

---

## Step 2 — Enable Authentication

1. Left sidebar → **Build → Authentication → Get started**
2. **Sign-in method** tab → enable **Email/Password** → Save
3. Also enable **Google** (already wired in login page):
   - Set "Project support email" to your Gmail
   - Save

---

## Step 3 — Enable Firestore

1. Left sidebar → **Build → Firestore Database → Create database**
2. Choose **Production mode** (not test mode)
3. Region: **`asia-south1`** (Mumbai — lowest latency for India)
4. Click **Enable**

---

## Step 4 — Set Firestore Security Rules

In Firestore → **Rules** tab, replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/planner/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**. This ensures each user can only access their own data.

---

## Step 5 — Register the Web App & Get Client Keys

1. Project Overview (home icon) → gear icon → **Project settings**
2. Scroll to **Your apps** → click **`</>`** (Web)
3. App nickname: `kunals-planner-web` → **Register app**
4. Copy the `firebaseConfig` object — you'll need these values:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",              // → NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: "xxx.firebaseapp.com", // → NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: "kunals-planner",       // → NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: "xxx.appspot.com",  // → NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789",    // → NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "1:xxx:web:xxx",           // → NEXT_PUBLIC_FIREBASE_APP_ID
}
```

---

## Step 6 — Get Server-Side Service Account Key

1. Project Settings → **Service accounts** tab
2. Click **Generate new private key** → **Generate key**
3. A `.json` file downloads — open it and copy:
   - `client_email` value  → `FIREBASE_CLIENT_EMAIL`
   - `private_key` value   → `FIREBASE_PRIVATE_KEY`

---

## Step 7 — Create `.env.local` in the Project Root

Create a new file at `e:\Claude Projects\kunals-planner\.env.local`:

```env
# ── Client-side (public — safe to expose) ──────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy_REPLACE_ME
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kunals-planner.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kunals-planner
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kunals-planner.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=REPLACE_ME
NEXT_PUBLIC_FIREBASE_APP_ID=1:REPLACE_ME:web:REPLACE_ME

# ── Server-side only (NEVER commit — already in .gitignore) ────────────────
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@kunals-planner.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvA...\n-----END PRIVATE KEY-----\n"
```

> **Important:** The `FIREBASE_PRIVATE_KEY` value must be wrapped in double quotes
> and keep the literal `\n` characters exactly as copied from the JSON file.

---

## Step 8 — Verify `.gitignore` Has `.env.local`

Open `.gitignore` and confirm this line exists (it already does in this project):
```
.env.local
```

---

## Step 9 — Test the Integration

```bash
npm run dev
```

Then:
1. Open the app → **Sign up** with a new email
2. Open **DevTools → Network** tab → filter by "firestore"
3. After ~5 seconds of use, you should see a `Write` request to Firestore
4. Open **Firebase Console → Firestore** → you should see:
   ```
   users/
     {your-uid}/
       planner/
         state    ← your data lives here
   ```
5. The nav bar should show **"Saved ✓"** in green after each sync

---

## Step 10 — Enable Google OAuth (Optional but Recommended)

For the Google "Sign in with Google" button to work:

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Select your Firebase project → **APIs & Services → OAuth consent screen**
3. Choose **External** → fill in:
   - App name: `Kunal's Planner`
   - User support email: your Gmail
   - Developer contact: your Gmail
4. **Save and Continue** through all steps
5. Back in Firebase → Authentication → Sign-in method → Google → add your Gmail as a test user

---

## Free Tier — Will You Ever Hit the Limits?

| Resource | Free Limit | Your Realistic Daily Usage |
|----------|-----------|---------------------------|
| Firestore reads | 50,000 / day | ~10–30 per session |
| Firestore writes | 20,000 / day | 1 per 5 seconds of activity ≈ 10–50/day |
| Auth users | Unlimited | ✅ |
| Firestore storage | 1 GB | < 1 MB per user |
| Hosting bandwidth | 10 GB / month | ✅ |

**Verdict: You will never hit limits as a personal app. Spark plan is permanent.**

---

## Production Hosting — Free Options

| Platform | Free Tier | Custom Domain | Notes |
|----------|-----------|--------------|-------|
| **Vercel** | Unlimited deployments | ✅ Yes | Best for Next.js, zero config |
| Firebase Hosting | 10GB/month | ✅ Yes | Native Firebase integration |
| Netlify | 100GB/month | ✅ Yes | Good fallback |

**Recommended: Vercel** — connect your GitHub repo, auto-deploys on every push.
Add your `.env.local` values as Environment Variables in Vercel dashboard.

---

## Total Cost to Run in Production

| Item | Cost |
|------|------|
| Firebase (Spark plan) | **Free** |
| Vercel hosting | **Free** |
| Domain (e.g. kunalsplanner.com) | ~₹800–1,200 / year |
| Google Play developer account | $25 one-time |
| Apple Developer account (if iOS) | $99 / year |

**Minimum: ~₹800/year + $25 one-time for Android launch.**

---

## After Firebase is Live — Remove the Argon2 Fallback

Once Firebase is working for all your accounts, you can remove the custom auth system to simplify the codebase. Tell Claude: *"Remove the Argon2/JWT fallback auth — Firebase is now the only auth provider."*

Files that will be cleaned up:
- `lib/auth/session.ts`
- `lib/auth/users.ts`
- The `decrypt` import in `proxy.ts`
- The `loginAction` import in `app/login/page.tsx`

---

_Last updated: 2026-06-17_
