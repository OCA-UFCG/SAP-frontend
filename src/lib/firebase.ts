"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let authInstance: Auth | null = null;

function getClientAuth(): Auth {
  if (authInstance) return authInstance;

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  authInstance = getAuth(app);
  return authInstance;
}

export const auth = new Proxy({} as Auth, {
  get(target, prop, receiver) {
    const activeAuth = getClientAuth();
    const value = Reflect.get(activeAuth, prop, receiver);
    if (typeof value === "function") {
      return value.bind(activeAuth);
    }
    return value;
  },
});
