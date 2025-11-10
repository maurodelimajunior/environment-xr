import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDBlQJuOM8XBWorM1XovwUL3YcW01O1wA",
  authDomain: "environment-mlcg.firebaseapp.com",
  databaseURL: "https://environment-mlcg-default-rtdb.firebaseio.com",
  projectId: "environment-mlcg",
  storageBucket: "environment-mlcg.firebasestorage.app",
  messagingSenderId: "776951625571",
  appId: "1:776951625571:web:ed0915ec89852603170556"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export { ref, set, onValue, signInWithEmailAndPassword, onAuthStateChanged };