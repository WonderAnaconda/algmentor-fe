# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/56e218fe-7672-472f-8ed2-04797b7cd757

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/56e218fe-7672-472f-8ed2-04797b7cd757) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/56e218fe-7672-472f-8ed2-04797b7cd757) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Hosting on GitHub Pages

This project is set up for static hosting on GitHub Pages using [gh-pages](https://www.npmjs.com/package/gh-pages) and React Router's HashRouter for guaranteed SPA routing.

### Steps to Deploy

1. **Set your API endpoint in your local `.env` file** (not needed on GitHub, only for local build):
   ```sh
   VITE_API_ENDPOINT_URL=https://your-api-url
   ```
2. **Build and deploy:**
   ```sh
   npm run deploy
   ```
   This will:
   - Build the app for production
   - Copy `index.html` to `404.html` for SPA fallback
   - Publish the `dist/` folder to the `gh-pages` branch

3. **Access your site at:**
   ```
   https://<your-github-username>.github.io/algmentor-fe/
   ```

### Notes
- The app uses `HashRouter`, so URLs will look like `/#/dashboard`.
- All environment variables are injected at build time; the `.env` file is not needed on GitHub.
- Make sure your API and Supabase allow CORS from your GitHub Pages domain.
- If you make changes, just run `npm run deploy` again to update the site.

## Step-by-Step: Hosting on GitHub Pages (with Google OAuth & Supabase)

This guide will walk you through everything needed to host this Vite + React + Supabase app on GitHub Pages, including Google OAuth and correct routing.

### 1. Vite Configuration
- In `vite.config.ts`, set:
  ```js
  base: '/algmentor-fe/' // Use your repo name here
  ```

### 2. Use HashRouter for Routing
- In `src/App.tsx`, use:
  ```js
  import { HashRouter } from 'react-router-dom';
  // ...
  <HashRouter>
    {/* your routes */}
  </HashRouter>
  ```
- This ensures all routes work on GitHub Pages.

### 3. gh-pages Deployment
- Install gh-pages:
  ```sh
  npm install --save-dev gh-pages
  ```
- In `package.json`, add:
  ```json
  "predeploy": "npm run build && npm run postbuild",
  "deploy": "gh-pages -d dist",
  "postbuild": "cp dist/index.html dist/404.html"
  ```
- Deploy with:
  ```sh
  npm run deploy
  ```
- Your site will be at: `https://<your-github-username>.github.io/algmentor-fe/`

### 4. .env Usage
- Create a `.env` file locally (not pushed to GitHub):
  ```sh
  VITE_API_ENDPOINT_URL=https://your-api-url
  VITE_SUPABASE_URL=your-supabase-url
  VITE_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
  ```
- These are injected at build time.

### 5. Google OAuth Setup
- In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
  - **Authorized redirect URIs:**
    - `http://localhost:3000/auth/v1/callback` (for local dev)
    - `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
    - `https://<your-github-username>.github.io/algmentor-fe/`
  - **Authorized JavaScript origins:**
    - `http://localhost:3000`
    - `https://<your-github-username>.github.io`

### 6. Supabase Auth Settings
- In the Supabase dashboard:
  - **Site URL:**
    - `https://<your-github-username>.github.io/algmentor-fe/`
  - **Redirect URLs:**
    - `https://<your-github-username>.github.io/algmentor-fe/`
    - `https://<your-github-username>.github.io/algmentor-fe/dashboard`

### 7. Code Changes for OAuth Redirects
- In `src/components/AuthCard.tsx`, update:
  ```js
  redirectTo: `${window.location.origin}/algmentor-fe/dashboard`
  emailRedirectTo: `${window.location.origin}/algmentor-fe/dashboard`
  ```
- This ensures users land on the dashboard after login/signup.

### 8. CORS for Your API
- If you use a custom backend (e.g., FastAPI), set CORS to allow your GitHub Pages domain:
  ```python
  allow_origins=[
    "https://<your-github-username>.github.io",
    "https://<your-github-username>.github.io/algmentor-fe"
  ]
  ```
- Supabase client API does not require CORS settings.

### 9. Troubleshooting
- If you see 404s on refresh, make sure `404.html` is copied from `index.html`.
- If OAuth redirects to the wrong path, check all `redirectTo` and Supabase/Google settings.
- Always use the correct base path (`/algmentor-fe/`) everywhere.

---

**Follow these steps and you’ll have a working, production-ready static app with Google login, Supabase, and custom API support on GitHub Pages!**

## Local Python Analysis with Pyodide

This app now performs all trading journal analysis **locally in your browser** using Python via [Pyodide](https://pyodide.org/):

- When you upload a file (Excel or CSV), the analysis is run in your browser using the same Python code as the backend.
- The Python environment (Pyodide + packages + analysis script) loads in the background as soon as you open the app.
- You can interact with the dashboard and upload a file at any time. If you upload before Python is ready, the analysis will start automatically as soon as it is.
- Excel files are parsed in the browser to extract the 'Journal' sheet as CSV, which is then analyzed in Python. CSV files are passed directly.
- All computation and data stay on your device—no remote API call is made for analysis.
- The UI and analysis results are identical to the previous backend-powered version.

### How it works
1. **Pyodide loads in the background** (with pandas, numpy, scipy, and your analysis script).
2. **User uploads a file** (Excel or CSV).
3. **If Pyodide is ready:** analysis starts immediately. If not, the file is queued and analysis starts as soon as Pyodide is ready.
4. **Progress bar** is shown during analysis.
5. **Results are displayed** in the dashboard, just as before.

### Notes
- The first load may take a few seconds as the Python environment is downloaded (cached for future visits).
- All analysis is private and runs in your browser—no data is sent to a server.
- The app is ready for future support of additional formats and more advanced local analysis.

---
