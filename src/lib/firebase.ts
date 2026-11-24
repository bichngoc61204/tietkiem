import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyC9jVh_B8bx6ycA95pSE_x7V6dIMagW5pk',
  authDomain: 'tietkiem-18e06.firebaseapp.com',
  projectId: 'tietkiem-18e06',
  storageBucket: 'tietkiem-18e06.firebasestorage.app',
  messagingSenderId: '391422813474',
  appId: '1:391422813474:web:4c35c91ccca12f1342717b',
  measurementId: 'G-L7T58D503T',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
