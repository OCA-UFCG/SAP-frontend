import * as admin from "firebase-admin";

let authInstance: admin.auth.Auth | null = null;

function normalizePrivateKey() {
  const encodedPrivateKey = process.env.FIREBASE_PRIVATE_KEY_BASE64
    ? Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString(
        "utf8",
      )
    : undefined;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()
    ? process.env.FIREBASE_PRIVATE_KEY
    : encodedPrivateKey;

  if (!rawPrivateKey) return undefined;

  const trimmedPrivateKey = rawPrivateKey.trim();
  const unquotedPrivateKey =
    (trimmedPrivateKey.startsWith('"') && trimmedPrivateKey.endsWith('"')) ||
    (trimmedPrivateKey.startsWith("'") && trimmedPrivateKey.endsWith("'"))
      ? trimmedPrivateKey.slice(1, -1)
      : trimmedPrivateKey;

  return unquotedPrivateKey.replace(/\\n/g, "\n");
}

function getAdminAuth(): admin.auth.Auth {
  if (authInstance) return authInstance;

  if (!admin.apps.length) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = normalizePrivateKey();

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Firebase Admin credentials are not set. Please check FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, or FIREBASE_PRIVATE_KEY_BASE64."
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
