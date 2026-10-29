import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

export function normalizeSessionId(session) {
  return String(session || "").trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

export async function getTeacherSessionStatus(db, session) {
  try {
    const snap = await getDoc(doc(db, "sessions", normalizeSessionId(session)));
    if (snap.exists()) {
      return snap.data().status === "ended" ? "ended" : "active";
    }
  } catch (error) {
    console.warn("Unable to read session status:", error);
  }
  // Sessions created before lifecycle metadata existed are historical and read-only
  // except the currently selected default session, which has no historical copy.
  return session === "2026/2027" ? "active" : "ended";
}

export function ensureSessionEndedBanner(containerId = "teacher-session-lock-banner") {
  let banner = document.getElementById(containerId);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = containerId;
    banner.className = "hidden max-w-6xl mx-auto mt-4 px-4";
    const content = document.createElement("div");
    content.className = "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 font-bold text-center";
    content.textContent = "Session Ended — This session is read-only. Existing data can be viewed but cannot be changed.";
    banner.appendChild(content);
    document.body.insertBefore(banner, document.body.children[1] || null);
  }
  return banner;
}

export async function applyTeacherSessionLock(db, sessionElementId, options = {}) {
  const sessionElement = document.getElementById(sessionElementId);
  if (!sessionElement) return false;
  const session = sessionElement.value || sessionElement.textContent;
  const status = await getTeacherSessionStatus(db, session);
  const ended = status === "ended";
  const banner = ensureSessionEndedBanner(options.bannerId);
  banner.classList.toggle("hidden", !ended);

  document.querySelectorAll("input, textarea, select, button").forEach(control => {
    if (control === sessionElement || control.closest("nav") || control.type === "hidden") return;
    control.disabled = ended;
    if (ended) control.classList.add("cursor-not-allowed", "opacity-60");
    else control.classList.remove("cursor-not-allowed", "opacity-60");
  });

  if (options.onStatus) options.onStatus(status, ended);
  return ended;
}

export function isSessionInput(formElement, sessionElementId) {
  return formElement && formElement.id === sessionElementId;
}
