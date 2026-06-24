import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Read configuration values (with direct fallback based on firebase-applet-config.json for premium reliability)
const firebaseConfig = {
  apiKey: "AIzaSyAo6a8zwOVq69UknA_eTXvcv8Q2De-bH4k",
  authDomain: "quantum-park-43n78.firebaseapp.com",
  projectId: "quantum-park-43n78",
  storageBucket: "quantum-park-43n78.firebasestorage.app",
  messagingSenderId: "648308790685",
  appId: "1:648308790685:web:f00d36584fda1555f80b74",
  firestoreDatabaseId: "ai-studio-8b18d193-a55c-4848-b49b-8e83cf535b73"
};

// Initialize Firebase App gracefully
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default app;
