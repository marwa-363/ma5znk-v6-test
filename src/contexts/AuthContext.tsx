import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile, UserPermissions } from '../types';
import { auth, db } from '../firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { setCompanyId } from '../services/firestoreService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  originalProfile: UserProfile | null;
  loading: boolean;
  isImpersonating: boolean;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<User>;
  signOut: () => Promise<void>;
  impersonate: (targetUser: UserProfile) => Promise<void>;
  stopImpersonating: () => Promise<void>;
  hasPermission: (module: keyof UserPermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email === 'admin@admin.com') {
        await firebaseSignOut(auth);
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      if (firebaseUser) {
        // Load user data from Firestore
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        // Ensure profile exists
        try {
          // Use getDocFromServer for initial check to verify connection
          const docSnap = await getDocFromServer(profileRef);
          if (!docSnap.exists()) {
            const isDefaultAdmin = firebaseUser.email === 'abdelrhmannabel66@gmail.com';
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')?.[0] || 'User',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')?.[0] || 'User',
              email: firebaseUser.email || '',
              role: isDefaultAdmin ? 'admin' : 'admin', // Default to admin as requested by user
              companyId: firebaseUser.uid, // Simplified companyId
              permissions: {
                invoices: true,
                products: true,
                reports: true,
                treasury: true,
                view_dashboard: true,
                view_reports: true,
                edit_customers: true,
                add_products: true,
                edit_products: true,
                delete_products: true,
                create_invoices: true,
                edit_invoices: true,
                delete_invoices: true,
                access_settings: true,
                access_suppliers: true,
                access_treasury: true,
              },
              createdAt: new Date().toISOString()
            };
            await setDoc(profileRef, newProfile);
          }
        } catch (err) {
          console.error("Error ensuring profile exists:", err);
          if (err instanceof Error && err.message.includes('insufficient permissions')) {
            handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        }

        unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            const realProfile = docSnap.data() as UserProfile;
            setOriginalProfile(realProfile);
            setCompanyId(realProfile.companyId);

            // Check for impersonation
            const impersonatedData = localStorage.getItem('impersonated_user');
            if (impersonatedData && realProfile.role === 'admin') {
              setProfile(JSON.parse(impersonatedData));
              setIsImpersonating(true);
            } else {
              setProfile(realProfile);
              setIsImpersonating(false);
            }
          } else {
            // If profile doesn't exist, we might need to handle it (e.g., first login)
            setProfile(null);
            setOriginalProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error loading profile:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setOriginalProfile(null);
        setIsImpersonating(false);
        localStorage.removeItem('impersonated_user');
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      return result.user;
    } catch (error) {
      console.error("Error signing in", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('impersonated_user');
      await firebaseSignOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const impersonate = async (targetUser: UserProfile) => {
    if (originalProfile?.role !== 'admin') return;
    localStorage.setItem('impersonated_user', JSON.stringify(targetUser));
    setProfile(targetUser);
    setCompanyId(targetUser.companyId);
    setIsImpersonating(true);
    // No page refresh needed, but we can trigger a re-render or redirect
  };

  const stopImpersonating = async () => {
    localStorage.removeItem('impersonated_user');
    setProfile(originalProfile);
    if (originalProfile) setCompanyId(originalProfile.companyId);
    setIsImpersonating(false);
  };

  const hasPermission = (module: keyof UserPermissions): boolean => {
    if (!profile) return false;
    if (profile.role === 'admin') return true;
    return profile.permissions[module] === true;
  };

  const value = {
    user,
    profile,
    originalProfile,
    loading,
    isImpersonating,
    signInWithEmail,
    signInWithGoogle: async () => {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
      }
    },
    signUpWithEmail: async (email: string, pass: string, name: string) => {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        // We don't create the profile here because the onSnapshot in useEffect 
        // will handle it if we have a trigger, but actually we should probably 
        // create a basic profile here or let the LandingPage/AuthModal handle it.
        // For now, let's just return the user.
        return result.user;
      } catch (error) {
        console.error("Error signing up", error);
        throw error;
      }
    },
    signOut,
    impersonate,
    stopImpersonating,
    hasPermission
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
