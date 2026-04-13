import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // 1. Added this import

const firebaseConfig = {
  apiKey: "AIzaSyAwtq6OO_bbIsZLFwb3xH19vFfqPfeen40",
  authDomain: "budget-track-ad317.firebaseapp.com",
  projectId: "budget-track-ad317",
  storageBucket: "budget-track-ad317.firebasestorage.app",
  messagingSenderId: "835924278795",
  appId: "1:835924278795:web:d87fa58d0cf7ea5ebf110e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Initialize Firestore and EXPORT it so your page can use it
export const db = getFirestore(app);