# Setup Guide - Trading Performance Analysis App

This guide covers all the configuration steps needed to set up this project with Supabase authentication and Google OAuth.

## Table of Contents
- [Supabase Setup](#supabase-setup)
- [Google OAuth Setup](#google-oauth-setup)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Testing the Setup](#testing-the-setup)

---

## Supabase Setup

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `trading-performance-app` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (usually 2-3 minutes)

### 2. Get Project Credentials
1. In your Supabase dashboard, go to **Settings > API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xyzcompany.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 3. Configure Authentication Settings
1. Go to **Authentication > Settings**
2. Configure the following:
   - **Site URL**: Set to your local development URL (e.g., `http://localhost:3000`)
   - **Redirect URLs**: Add `http://localhost:3000/**` for local development
   - **Enable sign ups**: ✅ Enabled
   - **Enable email confirmations**: ✅ Enabled
   - **Email confirmation link expiration**: 24 hours (default)

### 4. Set Up Email Provider (Optional)
1. Go to **Authentication > Email Templates**
2. Customize the email templates if needed
3. For production, consider setting up a custom SMTP provider

### 5. Apply Database Schema
1. Go to **SQL Editor**
2. Copy and paste the following SQL:

```sql
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

3. Click **Run** to execute the migration

### 6. Set Up Edge Functions (Optional)
1. Go to **Edge Functions**
2. Create a new function called `notify-new-user`
3. Copy the function code from `supabase/functions/notify-new-user/index.ts`
4. Deploy the function

---

## Google OAuth Setup

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API (if not already enabled)

### 2. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill in the required information:
   - **App name**: `Trading Performance App`
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Add test users (your email addresses)
6. Save and continue

### 3. Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Configure the OAuth client:
   - **Name**: `Trading App Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for development)
     - `http://localhost:5173` (if using default Vite port)
     - Your production URL (when deployed)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/auth/callback` (for development)
     - Your production callback URL (when deployed)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

### 4. Configure Supabase for Google OAuth
1. In your Supabase dashboard, go to **Authentication > Providers**
2. Find **Google** and click **Enable**
3. Enter the credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
4. Save the configuration

---

## Environment Variables

### 1. Create Environment File
Create a `.env.local` file in your project root with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google OAuth (if using Google login)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Service (for notifications)
VITE_RESEND_API_KEY=your-resend-api-key
```

### 2. Replace Placeholder Values
- Replace `your-project-ref` with your actual Supabase project reference
- Replace `your-anon-key-here` with your Supabase anon key
- Replace `your-google-client-id` and `your-google-client-secret` with your Google OAuth credentials
- Replace `your-resend-api-key` with your Resend API key (if using email notifications)

---

## Database Schema

The project uses the following database structure:

### Tables
- **`auth.users`** (managed by Supabase): Stores user authentication data
- **`public.profiles`** (custom): Stores user profile information

### Triggers
- **`on_auth_user_created`**: Automatically creates a profile when a user signs up
- **`update_profiles_updated_at`**: Updates the `updated_at` timestamp

### Row Level Security (RLS)
- Users can only view, update, and insert their own profile data
- All operations are restricted to the authenticated user's own data

---

## Testing the Setup

### 1. Test Email/Password Registration
1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000/login`
3. Click "Sign up" and create a new account
4. Check your email for the confirmation link
5. Click the confirmation link
6. Verify the user appears in:
   - Supabase Dashboard > Authentication > Users
   - Supabase Dashboard > Table Editor > profiles

### 2. Test Google OAuth (if configured)
1. On the login page, click "Continue with Google"
2. Complete the Google OAuth flow
3. Verify the user is created in both tables

### 3. Test Login Flow
1. Log out and log back in
2. Verify the AuthStatus component shows the correct user
3. Check that the user can access protected routes

### 4. Verify Database Triggers
1. Register a new user
2. Check that a profile is automatically created
3. Verify the profile contains the correct user information

---

## Troubleshooting

### Common Issues

#### Users not appearing in database
- Check that the database migration was applied correctly
- Verify the trigger function exists and is working
- Check Supabase logs for any errors

#### Email confirmation not working
- Verify the Site URL in Supabase settings matches your local URL
- Check that email confirmations are enabled
- Look for 403 errors in the auth logs

#### Google OAuth not working
- Verify the redirect URIs in Google Cloud Console
- Check that the Google provider is enabled in Supabase
- Ensure the OAuth consent screen is configured correctly

#### Environment variables not loading
- Make sure the `.env.local` file is in the project root
- Verify all variable names start with `VITE_`
- Restart the development server after changing environment variables

### Useful Commands
```bash
# Start development server
npm run dev

# Check environment variables
echo $VITE_SUPABASE_URL

# View Supabase logs
# (Check in Supabase Dashboard > Logs)
```

---

## Production Deployment

When deploying to production:

1. **Update environment variables** with production URLs
2. **Configure production redirect URIs** in Google Cloud Console
3. **Update Supabase Site URL** to your production domain
4. **Set up custom domain** in Supabase (optional)
5. **Configure production email provider** in Supabase
6. **Update Vite config** for production build

---

## Security Notes

- Never commit `.env.local` to version control
- Use strong database passwords
- Regularly rotate API keys
- Monitor Supabase logs for suspicious activity
- Keep dependencies updated
- Use HTTPS in production

---

This setup guide should get your Trading Performance Analysis app fully functional with Supabase authentication and Google OAuth integration. 