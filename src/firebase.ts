import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

export async function checkRedirectAuthResult(): Promise<User | null> {
  try {
    const res = await getRedirectResult(auth);
    return res ? res.user : null;
  } catch (err) {
    console.error('Redirect result error:', err);
    throw err;
  }
}

export async function signInGuest(): Promise<User> {
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export function getOperativeUid(): string {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  let localUid = '';
  try {
    localUid = localStorage.getItem('spywar_agent_uid') || '';
  } catch {}
  if (!localUid) {
    localUid = 'agent_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    try {
      localStorage.setItem('spywar_agent_uid', localUid);
    } catch {}
  }
  return localUid;
}

export async function ensureAuthenticatedUser(): Promise<{ uid: string; isAnonymous: boolean; displayName?: string | null }> {
  if (auth.currentUser) return auth.currentUser;

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch {
    // If anonymous sign-in is restricted or blocked, return persistent local operative identity
    return {
      uid: getOperativeUid(),
      isAnonymous: true,
      displayName: 'Guest Operative'
    };
  }
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client offline, please check connection.");
    }
  }
}

// Initial connection test
testConnection().catch(() => {});

export { app, db, auth };

