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

All business API endpoints require a signed-in account. On the first run, set `JWT_SECRET` to a long random value and configure `SMTP_USER=sivakumar.m533@gmail.com` plus a Gmail app password as `SMTP_APP_PASSWORD` in the backend environment. Enable 2-Step Verification on that Gmail account and create an app password in the Google Account security settings. Open `/signup`, request the one-time email code, verify it, and create the primary admin password (12 or more characters). The server only permits first-admin signup for `sivakumar.m533@gmail.com`. Keep these secrets in the backend host's environment variables; never commit them.

The admin Settings page lets the primary admin provision regular user accounts and export/import a JSON backup. Backups include dealers, products, and bills; they exclude login accounts and password hashes. Import replaces those business collections, so export a fresh backup before restoring. Deployments need the same `JWT_SECRET`, `SMTP_USER`, and `SMTP_APP_PASSWORD` values configured on the backend service.

## Deploying the backend to Vercel

Create a Vercel project for the `backend/` directory and set `MONGODB_URI` in the Vercel project environment variables to your MongoDB Atlas connection string. The backend exposes its `/api/*` routes as serverless functions and reuses the MongoDB connection between warm invocations. If the frontend is deployed as a separate Vercel project, set its `VITE_API_URL` environment variable to the backend deployment URL ending in `/api` (for example, `https://your-backend.vercel.app/api`) and redeploy the frontend.
