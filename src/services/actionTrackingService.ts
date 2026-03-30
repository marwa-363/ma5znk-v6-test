import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';

export interface UserAction {
  id: string;
  action: string;
  details: string;
  userId: string;
  companyId: string;
  userName?: string;
  module?: string;
  timestamp: any;
}

export const logAction = async (data: Omit<UserAction, 'id' | 'timestamp'>) => {
  try {
    const path = `companies/${data.companyId}/logs`;
    await addDoc(collection(db, path), {
      ...data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error logging action:", error);
  }
};

export const getActions = (companyId: string, callback: (actions: UserAction[]) => void, max: number = 50) => {
  if (!companyId) return () => {};
  
  const path = `companies/${companyId}/logs`;
  const q = query(
    collection(db, path),
    orderBy('timestamp', 'desc'),
    limit(max)
  );

  return onSnapshot(q, (snapshot) => {
    const actions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserAction));
    callback(actions);
  }, (error) => {
    console.error("Error fetching actions:", error);
  });
};
