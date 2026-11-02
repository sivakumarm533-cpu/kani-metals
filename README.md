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

## Deploying the backend to Vercel

Create a Vercel project for the `backend/` directory and set `MONGODB_URI` in the Vercel project environment variables to your MongoDB Atlas connection string. The backend exposes its `/api/*` routes as serverless functions and reuses the MongoDB connection between warm invocations. If the frontend is deployed as a separate Vercel project, set its `VITE_API_URL` environment variable to the backend deployment URL ending in `/api` (for example, `https://your-backend.vercel.app/api`) and redeploy the frontend.
