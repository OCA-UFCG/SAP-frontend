import * as admin from "firebase-admin";

let authInstance: admin.auth.Auth | null = null;

function getAdminAuth(): admin.auth.Auth {
  if (authInstance) return authInstance;

  if (!admin.apps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Firebase Admin credentials are not set. Please check NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  authInstance = admin.auth();
  return authInstance;
}

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(target, prop, receiver) {
    const auth = getAdminAuth();
    const value = Reflect.get(auth, prop, receiver);
    if (typeof value === "function") {
      return value.bind(auth);
    }
    return value;
  },
});
