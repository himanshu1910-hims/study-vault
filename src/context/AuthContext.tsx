import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, FIREBASE_PROJECT_ID, googleProvider, handleFirestoreError } from '../lib/firebase';
import { OperationType } from '../types';
import { sanitizeString } from '../utils/fileHelpers';

interface AuthContextValue {
  user: User | null;
  isAuthReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);

      if (firebaseUser && firebaseUser.emailVerified) {
        const userPath = `users/${firebaseUser.uid}`;
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const snap = await getDoc(userRef);
          const safeEmail = sanitizeString(firebaseUser.email, 200, 'scholar@studyvault.app');
          const safeName = sanitizeString(firebaseUser.displayName, 100, 'StudyVault User');
          const safePhoto = sanitizeString(firebaseUser.photoURL, 1000, '');

          if (!snap.exists()) {
            await setDoc(userRef, {
              userId: firebaseUser.uid,
              email: safeEmail,
              displayName: safeName,
              photoURL: safePhoto,
              totalStorageUsed: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(userRef, {
              email: safeEmail,
              displayName: safeName,
              photoURL: safePhoto,
              updatedAt: serverTimestamp(),
            });
          }
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.WRITE, userPath);
          } catch {
            // Logged in console with full FirestoreErrorInfo
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const message = err instanceof Error ? err.message : String(err);
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User closed popup intentionally
      } else if (code === 'auth/unauthorized-domain') {
        const currentHost = window.location.hostname;
        setAuthError(
          `Domain "${currentHost}" needs to be added to Authorized Domains in Firebase Console (${FIREBASE_PROJECT_ID} -> Authentication -> Settings -> Authorized domains). Local library mode remains fully active.`
        );
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else {
        setAuthError(`Sign-in error: ${message}`);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthReady,
        isSigningIn,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
