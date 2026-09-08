# Lit Chain Mobile — Phase 1

This is a standalone Expo / React Native client inside the existing LitChain repo.

## Included

- Expo Router
- Android package: `org.theliteraturefoundation.litchain`
- iOS bundle ID: `org.theliteraturefoundation.litchain`
- Firebase + Firestore connection
- Persistent Firebase auth with AsyncStorage
- Email/password sign in
- Email/password account creation
- Starter authenticated home screen
- No changes to the existing web app

## Upload from your phone

Upload the entire `mobile` folder into the root of the LitChain repo.

## Firebase values

Create `mobile/.env` from `.env.example`.

Copy only the `apiKey` and `appId` values from the existing web app's `src/firebase.js`.
The other project identifiers are already filled in.

Do not commit `.env`.

## Next step

After this folder is uploaded, configure Expo Application Services (EAS) for a cloud Android build.
Google sign-in will be added after the native Android/iOS OAuth registrations exist.
