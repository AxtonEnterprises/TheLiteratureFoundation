import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_RVb_1Gafl5m_LsRPf5PrmRL-SInsN6M",
  authDomain: "random-reads-10add.firebaseapp.com",
  projectId: "random-reads-10add",
  storageBucket: "random-reads-10add.firebasestorage.app",
  messagingSenderId: "424669347546",
  appId: "1:424669347546:web:92104ea189afaf60676fe3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
