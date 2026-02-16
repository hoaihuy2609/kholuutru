
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, onSnapshot, orderBy, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/setup#config-object
const firebaseConfig = {
    apiKey: "AIzaSyArUq6oJ2HqoG3zQVRsBi3v9IAFY-2RPc0",
    authDomain: "physivault.firebaseapp.com",
    projectId: "physivault",
    storageBucket: "physivault.firebasestorage.app",
    messagingSenderId: "1530544020",
    appId: "1:1530544020:web:376399e4c58d3baf719981"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    onSnapshot,
    orderBy,
    serverTimestamp,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
};
