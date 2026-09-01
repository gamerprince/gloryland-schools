// firebase-config.js (must be type=module in HTML)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

export const firebaseConfig = {
    apiKey: "AIzaSyCjrOQZuD7xcTxXqlbYoDG0WnYEEi0VmZY",
    authDomain: "fir-configjs-80ffe.firebaseapp.com",
    projectId: "fir-configjs-80ffe",
    storageBucket: "fir-configjs-80ffe.firebasestorage.app",
    messagingSenderId: "184537823888",
    appId: "1:184537823888:web:506bb202ca4e1ab47ff615",
    measurementId: "G-EGHL9GRS9B"
};

// initialize firebase
export const app = initializeApp(firebaseConfig);

// Firestore
export const db = getFirestore(app);

// Authentication
export const auth = getAuth(app);
