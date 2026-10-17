"use client";

import { initializeApp, getApps } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Guardado no `globalThis` porque o `initializeAuth` só pode rodar uma vez por
// app, e o recarregamento do `next dev` roda este arquivo de novo.
const globalForAuth = globalThis as { __sedesAuth?: Auth };

/**
 * `initializeAuth` em vez de `getAuth`: o `getAuth` liga também o login por
 * pop-up/redirecionamento, que a plataforma não usa (o login é por e-mail e
 * senha) e que baixa um iframe do firebaseapp.com e a biblioteca `gapi` do
 * Google em toda página, ~130 KB a mais no celular. A persistência é a mesma
 * que o `getAuth` usa no navegador.
 */
function getClientAuth(): Auth {
  if (globalForAuth.__sedesAuth) return globalForAuth.__sedesAuth;

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  globalForAuth.__sedesAuth = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
      browserSessionPersistence,
    ],
  });
  return globalForAuth.__sedesAuth;
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