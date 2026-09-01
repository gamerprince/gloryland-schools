/* ----------Result checking logic
Compiled results lookup

Printing results ---------- */

import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

/* ---------- HELPER FUNCTIONS ---------- */
function suffix(n) {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

function validateSearchInputs(nameLower, className, term, session) {
  const errors = [];

  if (!nameLower) {
    errors.push("Student name is required");
  }
  if (!className || className === "Select a class") {
    errors.push("Class is required");
  }
  if (!term || term === "0") {
    errors.push("Term is required");
  }
  if (!session) {
    errors.push("Session is required");
  }
  if (isNaN(Number(term))) {
    errors.push("Invalid term value");
  }

  return errors;
}

/* ---------- RESULT LOOKUP ---------- */
document.addEventListener("DOMContentLoaded", () => {

  $("check").onclick = async () => {
    const resultDiv = $("result"); // FIX 1: Defined resultDiv
    resultDiv.innerHTML = "⏳ Searching...";
    $("printResult").classList.add("hidden");

    const nameLower = $("studentName").value.trim().toLowerCase();
    const className = $("className").value;
    const term = Number($("term").value);
    const session = $("session").value.trim();

    // Validate inputs
    const validationErrors = validateSearchInputs(nameLower, className, term, session);
    if (validationErrors.length > 0) {
      resultDiv.innerHTML = `
        <div class="p-4 bg-red-100 border border-red-400 rounded">
          <strong>❌ Validation Errors:</strong>
          <ul class="mt-2 list-disc list-inside text-sm">
            ${validationErrors.map(e => `<li>${e}</li>`).join("")}
          </ul>
        </div>`;
      return;
    }

    try {
      const q = query(
        collection(db, "compiledResults"),
        where("studentNameLower", "==", nameLower),
        where("className", "==", className),
        where("term", "==", term),
        where("session", "==", session)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        resultDiv.innerHTML = `
          <div class="p-4 bg-yellow-100 border border-yellow-400 rounded">
            <strong>⚠️ No results found</strong>
            <p class="text-sm mt-1">Check your name, class, term and session are correct.</p>
          </div>`;
        return;
      }

      const docs = snap.docs.map(d => d.data());
      const first = docs[0];

      // 1. Check Publication Status
      if (first.published !== true) {
        resultDiv.innerHTML = `
          <div class="p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-center">
            <p class="font-bold text-lg">⏳ Results Processing</p>
            <p class="text-sm">The school hasn't officially published these results yet. Please check back later.</p>
          </div>`;
        return;
      }

      // 2. Check Fee Clearance
      if (first.feeCleared !== true) {
        resultDiv.innerHTML = `
          <div class="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-center">
            <p class="font-bold text-lg">🚫 ACCESS RESTRICTED</p>
            <p class="text-sm mt-1">Please clear your outstanding school fees to view this result slip.</p>
          </div>`;
        return;
      }

      // 3. Build Table Rows and Calculate Grand Total
      let grandTotal = 0;
      let rowsHtml = "";
      docs.sort((a, b) => a.subject.localeCompare(b.subject));

      const getRemark = (score) => {
        if (score >= 75) return "Excellence";
        if (score >= 65) return "Very Good";
        if (score >= 55) return "Good";
        if (score >= 45) return "Satisfactory";
        if (score >= 40) return "Pass";
        return "Fail";
      };

      docs.forEach(r => {
        grandTotal += (r.total || 0);
        rowsHtml += `
          <tr class="border-b">
            <td class="p-2 font-medium">${r.subject}</td>
            <td class="p-2 text-center">${r.test || 0}</td>
            <td class="p-2 text-center">${r.exam || 0}</td>
            <td class="p-2 text-center font-bold text-indigo-700">${r.total || 0}</td>
            <td class="p-2 text-center font-bold">${r.grade || 'N/A'}</td>
            <td class="p-2 text-center">${getRemark(r.total || 0)}</td>
          </tr>`;
      });

      // 4. Update UI
      const logoUrl = new URL('logo.jpg', window.location.href).href;
      resultDiv.innerHTML = `
        <div id="printableResult" class="p-8 bg-white">
          <div class="flex items-center justify-between border-b-4 border-double border-gray-800 pb-4 mb-6">
            <img src="${logoUrl}" style="width: 80px; height: 80px; object-fit: contain;">
            <div class="text-center flex-grow">
              <h1 class="text-2xl font-black text-blue-800">GLORYLAND FOUNDATION SCHOOLS</h1>
              <p class="text-xs font-bold italic text-gray-500">Excellence in Learning and Character</p>
            </div>
            <div style="width: 80px;"></div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-sm mb-6 bg-gray-50 p-4 rounded border">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Class:</strong> ${className}</p>
            <p><strong>Term:</strong> ${term}${suffix(term)} Term</p>
            <p><strong>Session:</strong> ${session}</p>
          </div>

          <table class="w-full text-sm border-collapse border mb-4">
            <thead class="bg-gray-100">
              <tr>
                <th class="border p-2 text-left">Subject</th>
                <th class="border p-2">Test</th>
                <th class="border p-2">Exam</th>
                <th class="border p-2">Total</th>
                <th class="border p-2">Grade</th>
                <th class="border p-2">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${docs.map(r => `
                <tr>
                  <td class="border p-2">${r.subject}</td>
                  <td class="border p-2 text-center">${r.test || 0}</td>
                  <td class="border p-2 text-center">${r.exam || 0}</td>
                  <td class="border p-2 text-center font-bold">${r.total || 0}</td>
                  <td class="border p-2 text-center font-bold text-blue-700">${r.grade || 'N/A'}</td>
                  <td class="border p-2 text-center">${getRemark(r.total || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      $("printResult").classList.remove("hidden");

    } catch (err) {
      console.error("Query Error:", err);
      resultDiv.innerHTML = `<div class="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 font-bold text-center">Error: ${err.message}</div>`;
    }
  };

  /* ---------- PRINT LOGIC ---------- */
  $("printResult").onclick = () => {
    const win = window.open("", "", "width=900,height=800");
    if (!win) return alert("Please allow pop-ups");

    win.document.write(`
      <html>
      <head>
        <title>Student Report - Gloryland Foundation Schools</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print { .no-print { display: none; } body { padding: 0; } }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; }
        </style>
      </head>
      <body>
        ${$("result").innerHTML}
        <div class="no-print text-center mt-8">
          <button onclick="window.print()" class="bg-red-600 text-white px-8 py-2 rounded font-bold">Print Now</button>
        </div>
      </body>
      </html>
    `);
  };

}); // FIX 2: Added missing closing brackets for DOMContentLoaded