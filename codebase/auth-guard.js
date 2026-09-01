import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { doc, getDoc } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/**
 * role = "teacher" or "admin"
 * Note: Document ID = user.uid in both collections
 */
export function requireRole(role) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }

      const col = role === "admin" ? "admins" : "teachers";
      
      try {
        const docSnap = await getDoc(doc(db, col, user.uid));

        if (!docSnap.exists()) {
          alert(`Access denied. You are not marked as ${role}.`);
          await signOut(auth);
          window.location.href = "index.html";
          return;
        }

        resolve({
          user,
          profile: docSnap.data()
        });
      } catch (err) {
        console.error("Auth check failed:", err);
        alert("Authentication error. Please try again.");
        window.location.href = "index.html";
      }
    });
  });
}
