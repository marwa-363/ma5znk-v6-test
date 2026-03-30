import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, getDocFromServer, doc } from "firebase/firestore";

// Import the Firebase configuration from the source of truth
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

async function testConnection() {
  console.log("Testing Firestore connection for project:", firebaseConfig.projectId);
  try {
    // Attempt to get a non-existent document to test connection
    // Using getDocFromServer forces a network request
    await getDocFromServer(doc(db, 'test_connection', 'ping'));
    console.log("Firestore connection check completed (server reached)");
  } catch (error: any) {
    if (error?.message?.includes('the client is offline') || error?.code === 'unavailable') {
      console.error("CRITICAL: Firestore is offline or unreachable.");
      console.error("1. Ensure Firestore is ENABLED at: https://console.firebase.google.com/project/" + firebaseConfig.projectId + "/firestore");
      console.error("2. Check if your API Key has domain restrictions in Google Cloud Console.");
      console.error("3. Ensure you have initialized the database in 'Test Mode' or 'Production Mode'.");
    } else {
      console.log("Firestore connection test status:", error.message || "Connected (document not found is normal)");
    }
  }
}

testConnection();
