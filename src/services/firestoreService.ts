import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  getDocFromServer,
  Firestore,
  QueryConstraint
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

let currentCompanyId: string | null = null;

export const setCompanyId = (id: string | null) => {
  currentCompanyId = id;
};

const getScopedPath = (path: string) => {
  if (path === 'users') return 'users';
  
  const companyId = currentCompanyId;
  if (!companyId) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated and companyId not set");
    return `companies/${uid}/${path}`;
  }
  
  return `companies/${companyId}/${path}`;
};

export interface FirestoreErrorInfo {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

export const getFromFirestore = async <T>(path: string, constraints: QueryConstraint[] = []): Promise<T[]> => {
  const scopedPath = getScopedPath(path);
  try {
    const q = query(collection(db, scopedPath), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, scopedPath);
    return [];
  }
};

export const addToFirestore = async <T extends { id?: string }>(path: string, data: T): Promise<T> => {
  const scopedPath = getScopedPath(path);
  try {
    const docRef = await addDoc(collection(db, scopedPath), {
      ...data,
      createdAt: new Date().toISOString()
    });
    return { ...data, id: docRef.id } as T;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, scopedPath);
    throw error;
  }
};

export const updateInFirestore = async <T>(path: string, id: string, data: Partial<T>): Promise<void> => {
  const scopedPath = getScopedPath(path);
  try {
    const docRef = doc(db, scopedPath, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${scopedPath}/${id}`);
    throw error;
  }
};

export const deleteFromFirestore = async (path: string, id: string): Promise<void> => {
  const scopedPath = getScopedPath(path);
  try {
    const docRef = doc(db, scopedPath, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${scopedPath}/${id}`);
    throw error;
  }
};

export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
};
