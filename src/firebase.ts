import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyClPJ9LcIaLka0TmsZZ74lBIn_e-p9lkbE",
  authDomain: "august-journal-r1ttq.firebaseapp.com",
  projectId: "august-journal-r1ttq",
  storageBucket: "august-journal-r1ttq.firebasestorage.app",
  messagingSenderId: "637424370114",
  appId: "1:637424370114:web:689792dfe620210dbd165b"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore with custom Database ID
export const db = initializeFirestore(app, {}, "ai-studio-exfinomsenterpri-2e640b33-a773-466b-a7ca-e411abbc17a0");

// Test Connection on load
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection verified successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Client appears offline.");
    } else {
      console.warn("Connection test completed with expected results:", error);
    }
  }
}

testConnection();
