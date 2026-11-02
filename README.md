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

All business API endpoints require a signed-in account. Set `JWT_SECRET` to a unique random value of at least 32 characters and configure `SMTP_USER=sivakumar.m533@gmail.com` plus a Gmail app password as `SMTP_APP_PASSWORD` in the backend environment. Enable 2-Step Verification on that Gmail account and create an app password in the Google Account security settings. Open `/signup`, enter the authorized email, verify the 6-digit OTP, then enter and confirm the primary admin password (12 or more characters). The server only permits first-admin signup for `sivakumar.m533@gmail.com` and disables registration after the admin is created.

Every admin login requires a valid password followed by a new email OTP. Admin-created regular users sign in with email and password only. Admin sessions are invalidated on logout. OTPs expire after 5 minutes, permit at most 5 incorrect attempts, and have a 60-second resend cooldown. Authentication routes also use database-backed rate limits.

For local testing only, set `ENABLE_DEMO_ADMIN=true`, `DEMO_ADMIN_EMAIL`, and `DEMO_ADMIN_PASSWORD` (at least 12 characters) in both the backend `.env` and the frontend can read its demo credentials from the backend status endpoint. The address should use a reserved test domain such as `demo.admin@example.test`; it is not a real Gmail inbox. The development frontend shows the demo address/password and a one-click sign-in. The backend refuses this endpoint outside localhost, in production, and on Vercel. Turn it off with `ENABLE_DEMO_ADMIN=false`; the generated Demo Admin account can also be removed from Settings → User management.

The admin Settings submenu provides User management and Database backup. Admins can provision regular user accounts with generated passwords and export/import a JSON backup. Backups include dealers, products, and bills; they exclude login accounts and password hashes. Import replaces those business collections, so export a fresh backup before restoring. Deployments need `JWT_SECRET`, `SMTP_USER`, and `SMTP_APP_PASSWORD` configured on the backend service.

Authentication endpoints: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/create-admin`, `POST /api/auth/login`, `POST /api/auth/send-login-otp`, `POST /api/auth/verify-login-otp`, `POST /api/auth/logout`, and `GET /api/auth/me`.

## Deploying the backend to Vercel

Create a Vercel project for the `backend/` directory and set `MONGODB_URI` in the Vercel project environment variables to your MongoDB Atlas connection string. The backend exposes its `/api/*` routes as serverless functions and reuses the MongoDB connection between warm invocations. If the frontend is deployed as a separate Vercel project, set its `VITE_API_URL` environment variable to the backend deployment URL ending in `/api` (for example, `https://your-backend.vercel.app/api`) and redeploy the frontend.
