import { writeFileSync } from "node:fs";

const requiredEnv = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID"
];

const missing = requiredEnv.filter(name => !process.env[name]);

if (missing.length > 0) {
  throw new Error(`Missing Firebase config env vars: ${missing.join(", ")}`);
}

const config = {
  appId: process.env.HOUSECHORE_APP_ID || "housechod-v1",
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  }
};

writeFileSync(
  new URL("../firebase-config.js", import.meta.url),
  `window.HOUSECHORE_CONFIG = ${JSON.stringify(config, null, 2)};\n`
);
