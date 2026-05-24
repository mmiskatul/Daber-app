# Daber Expo App

This is a minimal Expo frontend for Daber authentication and onboarding.

It includes:

- Firebase email login
- Firebase email registration
- Google sign-in
- Apple sign-in on iOS
- backend sync with `POST /auth/sync-user`
- onboarding submit with `POST /onboarding`

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your Firebase web config
3. Add Google OAuth client IDs if you want Google sign-in
4. Install dependencies:

```bash
npm install
```

5. Start Expo:

```bash
npm run start
```

## Docker

Build the frontend image:

```bash
docker build -t daber-app .
```

Run the Expo app container:

```bash
docker run --rm -p 8081:8081 -p 19000:19000 -p 19001:19001 -p 19006:19006 --env-file .env daber-app
```

## Backend requirements

The backend must be running at `EXPO_PUBLIC_BACKEND_BASE_URL`.

The app expects these backend routes:

- `POST /auth/sync-user`
- `POST /onboarding`

## Notes

- Apple sign-in only works on iOS with proper Firebase Apple provider setup.
- Google sign-in requires Firebase Google provider setup and the correct client IDs.
- Email/password login and registration work with Firebase Auth and backend sync.
