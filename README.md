# Nexora

Campus marketplace and community app built with React/Vite, Express and MongoDB.

## Local development

1. Copy `.env.example` to `.env` and fill in your values.
2. For local development use:
   - `NODE_ENV=development`
   - `APP_ORIGIN=http://localhost:5173`
   - `API_PUBLIC_ORIGIN=http://localhost:3001` (optional)
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://127.0.0.1:5173`.

Vite proxies `/api/*` to the local Express server at `http://127.0.0.1:3001`.

## Vercel deployment — one project / one domain

This project is configured to deploy the frontend and API together on the same Vercel project.

- Frontend: `https://nexora.grapaxels.in`
- API: `https://nexora.grapaxels.in/api/*`
- `api/index.js` exposes the existing Express app as one Vercel Function.
- `vercel.json` routes every `/api/*` request to that function.
- `VITE_API_URL` must stay empty so the browser uses the same domain.

### Required Vercel environment variables

Add these under **Vercel → Project → Settings → Environment Variables**, then redeploy Production:

```env
APP_ORIGIN=https://nexora.grapaxels.in
NODE_ENV=production
CAMPUS_NAME=Lovely Professional University
MONGODB_URI=your_mongodb_atlas_connection_string
MONGODB_DB=Nexora

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_HELO=localhost
SMTP_USER=your_gmail_address
SMTP_PASS=your_gmail_app_password
SMTP_FROM=Nexora <your_gmail_address>
MAIL_FROM=Nexora <your_gmail_address>

ADMIN_EMAILS=your_admin_email
API_PUBLIC_ORIGIN=https://nexora.grapaxels.in
VITE_API_URL=
SUPER_ADMIN_EMAIL=your_super_admin_email
SUPER_ADMIN_PASSWORD_HASH=your_existing_scrypt_hash
```

`RESEND_API_KEY` may stay empty when SMTP is configured.

### Important Vercel settings

Use the repository/project root containing `package.json` as the Vercel Root Directory. Keep Framework Preset as **Vite** (the included `vercel.json` also enforces it). Do not deploy the frontend and API as two separate Vercel projects for this configuration.

After deployment, verify these URLs:

- `https://nexora.grapaxels.in/`
- `https://nexora.grapaxels.in/api/config`

The second URL should return JSON rather than the Vite page or a 404.

### MongoDB Atlas

The Vercel Function must be able to connect to MongoDB Atlas. Make sure Atlas Network Access permits Vercel traffic (for testing, many projects temporarily allow `0.0.0.0/0`, then tighten access later if using static egress/Secure Compute).

## Security

Do not commit `.env`. Keep SMTP passwords, MongoDB credentials and administrator secrets in Vercel Environment Variables only.
