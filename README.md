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

All business API endpoints require a signed-in account. The owner account is restricted to `ADMIN_EMAIL=kanimetal1972@gmail.com`. Admins use a password and Google Authenticator TOTP; regular users use email and password. TOTP secrets are encrypted at rest with `TOTP_ENCRYPTION_KEY`. Challenges expire after 5 minutes, allow at most 5 code attempts, and auth routes also use database-backed rate limits. Authenticator codes are accepted only once per time step. Ten one-time recovery codes are generated at enrollment, stored as hashes, and shown only once.

For initial setup, configure a strong, random `ADMIN_SETUP_KEY` on the backend, open `/signup`, enter the authorized address, name, password (at least 12 characters), and setup key, then scan the displayed QR code with Google Authenticator. Enter a current 6-digit code to enable TOTP and create the admin account. If the database has the retired `demo.admin@example.test` admin, setup claims that record in place, replacing its demo credentials without creating a second admin or touching business data. The setup key is a bootstrap secret; remove it from Render after account creation. Admin registration is then disabled.

For the existing admin, preserve the current email and password and sign in at `/login`. If the account has not enrolled, a successful password check starts a five-minute authenticator enrollment challenge; scan its QR code and verify a current code. If the existing account still uses `sivakumar.m533@gmail.com`, completing enrollment migrates that account to `ADMIN_EMAIL`. Save the recovery codes shown after enrollment. If the authenticator device is lost, use one unused recovery code at login; each code works once.

Admin sessions are invalidated on logout. No email OTP delivery is used. The old email OTP routes have been removed, and the demo admin login route was removed so it cannot create a TOTP bypass.

The admin Settings submenu provides User management and Database backup. Admins can provision regular user accounts with generated passwords and export/import a JSON backup. Backups include dealers, products, and bills; they exclude login accounts and password hashes. Import replaces those business collections, so export a fresh backup before restoring.

Authentication endpoints: `POST /api/auth/totp/enroll`, `POST /api/auth/totp/enroll/verify`, `POST /api/auth/login`, `POST /api/auth/totp/login/verify`, `POST /api/auth/totp/login/recovery`, `POST /api/auth/logout`, and `GET /api/auth/me`.

## Deploying the backend to Render

Create a Render Web Service with Root Directory `backend`, Build Command `npm ci`, and Start Command `npm start`. Set `MONGODB_URI` (MongoDB Atlas URI), `JWT_SECRET` (unique random value of at least 32 characters), `ADMIN_EMAIL=kanimetal1972@gmail.com`, and `TOTP_ENCRYPTION_KEY` (random 32-byte key encoded as base64). Set `ADMIN_SETUP_KEY` to a separate long random value only for first-time admin setup; remove it from Render after successful enrollment. Set `PORT` only if required by your Render service; Express reads Render's assigned port automatically. Remove `RESEND_API_KEY` and `EMAIL_FROM` from the service.

For the frontend Vercel project, set `VITE_API_URL` to the deployed Render backend URL ending in `/api` (for example, `https://your-backend.onrender.com/api`) in the applicable Vercel environments. Vite embeds this value during the build, so redeploy the frontend after adding or changing it. Without this setting the production frontend shows a clear configuration error instead of trying to call `localhost`.

Generate random values with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"  # TOTP_ENCRYPTION_KEY
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))" # ADMIN_SETUP_KEY
```

Keep `TOTP_ENCRYPTION_KEY` stable and backed up securely. Changing or losing it makes existing encrypted authenticator secrets unreadable, and the admin must be recovered and enrolled again. Never put either secret in Vercel variables or commit them to Git.
