// Shared Firebase initialization — import { db } from './firebase.js'
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBgk13iR_I0ID48WgoX9MBLg2PoTlrgg0s",
  authDomain: "phdnd-podcast.firebaseapp.com",
  projectId: "phdnd-podcast",
  storageBucket: "phdnd-podcast.firebasestorage.app",
  messagingSenderId: "80092982584",
  appId: "1:80092982584:web:f112fc160bde43abaee5cd"
};

export const db = getFirestore(initializeApp(firebaseConfig));
