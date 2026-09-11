# Nexora

Nexora connects people seeking flexible local work with businesses that need short-term help.

## Deploy on Vercel

1. Import this GitHub repository in Vercel as a Next.js project.
2. Create a Turso database and add a connection using the SQLite-compatible libSQL endpoint.
3. In Vercel project settings, add the variables listed in .env.example.
4. Run the SQL in drizzle/0000_smart_maddog.sql once against the Turso database.
5. Deploy, then add nexora.grapaxels.in as the Vercel custom domain.

## Required environment variables

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Turso/libSQL SQLite URL, for example libsql://nexora-your-org.turso.io |
| DATABASE_AUTH_TOKEN | Turso database token |
| APP_ORIGIN | Public web address: https://nexora.grapaxels.in |
| ADMIN_EMAIL | Nexora administrator email |

Optional sign-in and email variables are documented in .env.example. For each OAuth app, set the callback URL to https://nexora.grapaxels.in/api/auth/callback/<provider>.

## Local development

Run npm install, then npm run dev.

The app uses hosted SQLite rather than a local database file so accounts, jobs, applications, payments, and ratings persist across Vercel serverless invocations.
