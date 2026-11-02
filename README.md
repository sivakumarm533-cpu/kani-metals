# Kani Metals

## Project structure

- `frontend/` — React and Vite application
- `backend/` — backend application folder

## Frontend development

```powershell
cd frontend
npm install
npm run dev
```

Build the frontend with `npm run build` from the `frontend` folder.

## Local backend and MongoDB

1. Install and start MongoDB locally. The backend connects to `mongodb://127.0.0.1:27017/datadb` by default.
2. In one terminal, start the API:

   ```powershell
   cd backend
   npm run dev
   ```

3. In a second terminal, start the website:

   ```powershell
   cd frontend
   npm run dev
   ```

The dealer and bill forms send data to the backend API. The backend stores dealers, products, and bills in separate MongoDB collections inside the `datadb` database. Check `http://localhost:5000/api/health` to confirm the API is running.

## Authentication and admin setup

All business API endpoints require a signed-in account. Set `JWT_SECRET` to a unique random value of at least 32 characters and configure `RESEND_API_KEY`, `EMAIL_FROM`, and `ADMIN_EMAIL` in the backend environment. `EMAIL_FROM` must use a sender address on a domain verified in Resend; `ADMIN_EMAIL` is the sole address permitted to register the initial admin. Open `/signup`, request and verify the 6-digit OTP, then enter and confirm the primary admin password (12 or more characters). Registration is disabled after the admin is created.

If the existing admin account still uses `sivakumar.m533@gmail.com`, sign in once with that existing address and password. The login OTP is sent to the configured `ADMIN_EMAIL`; after it is verified, the stored admin account is migrated to that address.

Every admin login requires a valid password followed by a new email OTP. Admin-created regular users sign in with email and password only. Admin sessions are invalidated on logout. OTPs expire after 5 minutes, permit at most 5 incorrect attempts, and have a 60-second resend cooldown. Authentication routes also use database-backed rate limits.

For local testing only, set `ENABLE_DEMO_ADMIN=true`, `DEMO_ADMIN_EMAIL`, and `DEMO_ADMIN_PASSWORD` (at least 12 characters) in both the backend `.env` and the frontend can read its demo credentials from the backend status endpoint. The address should use a reserved test domain such as `demo.admin@example.test`; it is not a real Gmail inbox. The development frontend shows the demo address/password and a one-click sign-in. The backend refuses this endpoint outside localhost, in production, and on Vercel. Turn it off with `ENABLE_DEMO_ADMIN=false`; the generated Demo Admin account can also be removed from Settings → User management.

The admin Settings submenu provides User management and Database backup. Admins can provision regular user accounts with generated passwords and export/import a JSON backup. Backups include dealers, products, and bills; they exclude login accounts and password hashes. Import replaces those business collections, so export a fresh backup before restoring.

Authentication endpoints: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/create-admin`, `POST /api/auth/login`, `POST /api/auth/send-login-otp`, `POST /api/auth/verify-login-otp`, `POST /api/auth/logout`, and `GET /api/auth/me`.

## Deploying the backend to Render

Create a Render Web Service with Root Directory `backend`, Build Command `npm ci`, and Start Command `npm start`. Add these environment variables in Render: `MONGODB_URI` (MongoDB Atlas URI), `JWT_SECRET` (unique random value of at least 32 characters), `RESEND_API_KEY`, `EMAIL_FROM` (for example, `Kani Metals <auth@your-verified-domain.com>`), `ADMIN_EMAIL=kanimetal1972@gmail.com`, and `ENABLE_DEMO_ADMIN=false`. Set `PORT` only if required by your Render service; Express reads Render's assigned port automatically. Remove legacy `SMTP_USER` and `SMTP_APP_PASSWORD` values.

For the frontend Vercel project, set `VITE_API_URL` to the deployed Render backend URL ending in `/api` (for example, `https://your-backend.onrender.com/api`) in the applicable Vercel environments. Vite embeds this value during the build, so redeploy the frontend after adding or changing it. Without this setting the production frontend shows a clear configuration error instead of trying to call `localhost`.

### Resend sender setup

In Resend, add and verify a domain you control by publishing the DNS records it provides. Then set `EMAIL_FROM` to an address on that verified domain and set `RESEND_API_KEY` to a server-side API key in Render. The onboarding/test sender is restricted and is not suitable for sending OTPs to arbitrary recipients. Never put the API key in Vercel or frontend variables.
