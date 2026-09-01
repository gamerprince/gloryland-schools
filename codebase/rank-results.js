import { auth, db } from "./firebase-config.js";
import {
  collection, query, where, getDocs, writeBatch, doc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

/**
 * Log admin action to auditLogs collection
 */
async function logAuditAction(action, details, status = "success", error = null) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      adminId: auth.currentUser?.uid || "unknown",
      details,
      status,
      error: error ? error.message : null,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

export async function rankResults({
  className,
  subject,
  term,
  session
}) {
  // Ask for confirmation
  const confirmMsg = `Rank and publish results for:\n\n${className} • ${subject} • Term ${term} • ${session}\n\nThis will assign positions and mark results as published.`;
  
  if (!confirm(confirmMsg)) {
    console.log("Ranking cancelled by user");
    return;
  }

  try {
    const q = query(
      collection(db, "compiledResults"),
      where("className", "==", className),
      where("subject", "==", subject),
      where("term", "==", term),
      where("session", "==", session)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      alert("❌ No results found");
      await logAuditAction("RANK_PUBLISH", { className, subject, term, session }, "failed", 
        new Error("No results found"));
      return;
    }

    // 1️⃣ sort by total DESC
    const results = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })).sort((a, b) => b.total - a.total);

    // 2️⃣ assign positions
    let position = 1;
    let lastScore = null;
    let skip = 0;

    const batch = writeBatch(db);

    results.forEach((r, index) => {
      if (lastScore !== null) {
        if (r.total === lastScore) {
          skip++;
        } else {
          position += skip + 1;
          skip = 0;
        }
      }

      lastScore = r.total;

      batch.update(
        doc(db, "compiledResults", r.id),
        {
          position,
          published: true
        }
      );
    });

    await batch.commit();

    // Log success
    await logAuditAction("RANK_PUBLISH", {
      className,
      subject,
      term,
      session,
      resultCount: results.length
    }, "success");

    alert(`✅ Results ranked & published successfully!\n${results.length} students processed.`);
  } catch (err) {
    console.error("Ranking error:", err);
    await logAuditAction("RANK_PUBLISH", { className, subject, term, session }, "failed", err);
    alert(`❌ Error: ${err.message}`);
  }
}
 