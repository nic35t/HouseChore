# HouseChore

## Firebase runtime config

Firebase web config is intentionally not committed to this repository.

1. Copy `firebase-config.example.js` to `firebase-config.js`.
2. Fill it with a restricted Firebase web API key and project config.
3. Keep `firebase-config.js` out of git. It is ignored by `.gitignore`.
4. Configure the API key in Google Cloud/Firebase with HTTP referrer restrictions for the production domain and localhost development origins.
5. Deploy `firestore.rules` after assigning the admin custom claim to trusted admin accounts.

For Netlify, set these environment variables instead of committing `firebase-config.js`:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `HOUSECHORE_APP_ID` optional, defaults to `housechod-v1`

## Previously exposed Firebase web key

The old Firebase web API key appeared in the public repository history. Removing it from the latest commit does not revoke it.

Immediate actions:

- Create or rotate to a new restricted Firebase web API key in Google Cloud Console.
- Restrict the old key immediately, then delete it after the new deployment is verified.
- Enable GitHub secret scanning and push protection for this repository.
- If you still want to scrub history after key rotation, rewrite history with `git filter-repo` or BFG and force-push with coordination. Treat this as cleanup only; rotation/restriction is the security fix.
