import { db, auth } from './firebase-config.js';
import { requireRole } from './auth-guard.js';
import { 
  collection, query, where, getDocs, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const $ = id => document.getElementById(id);

// mobile menu toggle and logout handlers
const mobileBtn = $("mobile-menu-btn");
const mobileMenu = $("mobile-menu");
if (mobileBtn) mobileBtn.onclick = () => mobileMenu.classList.toggle("hidden");
if ($("logoutBtnMob")) $("logoutBtnMob").onclick = () => signOut(auth).then(() => window.location.href = "portal.html");
if ($("logoutBtnTop")) $("logoutBtnTop").onclick = () => signOut(auth).then(() => window.location.href = "portal.html");
let teacherData = null;
let allStudents = {}; 

// Initialize Auth
requireRole('teacher').then(res => {
  teacherData = res;
}).catch(err => console.error("Auth Error:", err));

// Load Student List
$("btn-load").onclick = async () => {
  const className = $("className").value.trim();
  const term = Number($("term").value);
  const session = $("session").value.trim();
  const msg = $("status-msg");

  if (!className || !term || !session) {
    alert("Please fill all filters");
    return;
  }

  msg.classList.remove("hidden");
  allStudents = {}; 

  try {
    const q = query(
      collection(db, "compiledResults"),
      where("className", "==", className),
      where("term", "==", term),
      where("session", "==", session)
    );

    const snap = await getDocs(q);
    
    if (snap.empty) {
      document.querySelector("tbody").innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400">No records found for this selection.</td></tr>';
      return;
    }

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const name = data.studentName;
      
      if (!allStudents[name]) {
        allStudents[name] = {
          name: name,
          feeCleared: data.feeCleared || false,
          position: data.position || "N/A",
          subjects: [],
          meta: data // Base metadata (Gender, Behavior, etc.)
        };
      }
      allStudents[name].subjects.push(data);
    });

    // Call the function that was missing
    renderStudentTable(); 

  } catch (err) {
    console.error(err);
    alert("Error loading students: " + err.message);
  } finally {
    msg.classList.add("hidden");
  }
};

// 2. Added the missing renderStudentTable function
// 2. Updated renderStudentTable function
function renderStudentTable() {
  const tbody = document.querySelector("tbody");
  tbody.innerHTML = "";
  
  const names = Object.keys(allStudents);
  const term = Number($("term").value);
  const session = $("session").value;
  const selectedClass = $("className").value;
  
  names.forEach(name => {
    const s = allStudents[name];
    const row = document.createElement("tr");
    row.className = "border-b hover:bg-gray-50 transition text-sm md:text-base";
    
    const btnId = `view-${name.replace(/\s+/g, '-')}`;
    
    // Check if the admin has published this result
    const isPublished = s.subjects.some(sub => sub.published === true);
    
    row.innerHTML = `
      <td class="p-2 md:p-4 font-bold text-gray-800">${s.name}</td>
      <td class="p-2 md:p-4 text-center">
        <span class="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-[10px] md:text-xs font-black">
          ${s.subjects.length} Subjects
        </span>
      </td>
      <td class="p-2 md:p-4 text-center">
        <span class="${s.feeCleared ? 'text-green-600' : 'text-red-600'} font-bold text-[10px] uppercase">
          ${s.feeCleared ? 'Cleared' : 'Pending'}
        </span>
      </td>
      <td class="p-2 md:p-4 text-center">
        ${!isPublished ? `
          <button onclick="deleteStudentReport('${s.name}', '${selectedClass}', ${term}, '${session}')" class="text-red-600 hover:text-red-800 text-xs font-bold underline">
            Delete Result
          </button>
        ` : `
          <span class="text-gray-400 text-[10px] font-bold italic bg-gray-200 px-2 py-1 rounded">LOCKED (Published)</span>
        `}
      </td>
      <td class="p-2 md:p-4 text-center">
        <button id="${btnId}" class="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-indigo-700 transition">
          VIEW
        </button>
      </td>
    `;
    tbody.appendChild(row);

    document.getElementById(btnId).onclick = () => viewReportCard(name);
  });
}

// 3. New Delete Logic (Safe and tailored to your database)
window.deleteStudentReport = async (studentName, className, term, session) => {
  if (!confirm(`⚠️ Are you sure you want to delete all results for ${studentName}? \n\nThis will wipe their scores for this term so you can re-enter them in the 'Enter Result' page.`)) {
    return;
  }

  try {
    const q = query(
      collection(db, "compiledResults"),
      where("studentName", "==", studentName),
      where("className", "==", className),
      where("term", "==", term),
      where("session", "==", session)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      alert("No matching records found to delete.");
      return;
    }

    // Delete every subject document for this student in this term/session
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "compiledResults", d.id)));
    await Promise.all(deletePromises);

    alert("✅ Report deleted successfully. You can now re-enter the results.");
    $("btn-load").click(); // Automatically refresh the table
    
  } catch (err) {
    console.error("Delete Error:", err);
    alert("Error deleting report: " + err.message);
  }
};

// 3. Complete viewReportCard function to use your existing template logic
const viewReportCard = (name) => {
  const s = allStudents[name];
  if (!s.feeCleared) {
    alert("❌ Result cannot be viewed: School fees not cleared.");
    return;
  }

  const subjects = s.subjects;
  const meta = s.meta;
  const term = $("term").value;
  const session = $("session").value;
  const selectedClass = $("className").value; // Fix for 'class undefined'

  let grandTotal = 0;
  subjects.forEach(sub => grandTotal += sub.total);
  const average = subjects.length > 0 ? (grandTotal / subjects.length).toFixed(1) : 0;
  const position = s.subjects[0].position || "N/A";

  // Grade Remarks Logic
  const getRemark = (score) => {
    if (score >= 75) return "Excellence";
    if (score >= 65) return "Very Good";
    if (score >= 55) return "Good";
    if (score >= 45) return "Satisfactory";
    if (score >= 40) return "Pass";
    return "Fail";
  };

  const logoUrl = new URL('logo.jpg', window.location.href).href; // Absolute path for the logo
  const win = window.open("", "", "width=900,height=800");
  if (!win) return alert("Please allow pop-ups");

  win.document.write(`
    <html>
    <head>
      <title>Report Card - ${name}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @media print { .no-print { display:none; } }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
        .summary-box { display: flex; justify-content: space-between; font-weight: bold; padding: 10px; border: 2px solid #000; margin-top: 15px; }
      </style>
    </head>
    <body class="p-10">
      
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px double #333; padding-bottom: 15px; margin-bottom: 25px;">
        <img src="${logoUrl}" alt="Logo" style="width: 100px; height: 100px; object-fit: contain;">
        <div style="text-align: center; flex-grow: 1;">
          <h1 style="margin: 0; color: #1e40af; font-size: 30px; font-weight: 900;">GLORYLAND FOUNDATION SCHOOLS</h1>
          <p style="margin: 5px 0 0 0; font-weight: bold; color: #444; font-style: italic;">Excellence in Learning and Character</p>
        </div>
        <div style="width: 100px;"></div>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6 text-sm border p-4 bg-gray-50">
        <div><strong>NAME:</strong> ${name.toUpperCase()}</div>
        <div><strong>CLASS:</strong> ${selectedClass}</div>
        <div><strong>TERM:</strong> ${term}${suffix(term)} Term</div>
        <div><strong>SESSION:</strong> ${session}</div>
      </div>

      <table>
        <thead>
          <tr class="bg-gray-100">
            <th>Subject</th>
            <th>Test (40)</th>
            <th>Exam (60)</th>
            <th>Total (100)</th>
            <th>Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${subjects.map(sub => `
            <tr>
              <td>${sub.subject}</td>
              <td>${sub.test}</td>
              <td>${sub.exam}</td>
              <td>${sub.total}</td>
              <td><strong class="text-blue-700">${sub.grade}</strong></td>
              <td>${getRemark(sub.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="summary-box">
        <span>TOTAL: ${grandTotal}</span>
        <span>AVG: ${average}%</span>
        <span>POSITION: ${position}${suffix(position)}</span>
      </div>

      <div class="mt-6 p-4 border border-black">
        <div class="font-bold underline mb-1">PRINCIPAL'S REMARK:</div>
        <div class="italic">"${generatePrincipalRemark(average)}"</div>
      </div>
      
      <div class="no-print text-center mt-10">
        <button onclick="window.print()" class="bg-blue-700 text-white px-10 py-2 rounded font-bold hover:bg-blue-800 transition">Print Result</button>
      </div>
    </body>
    </html>
  `);
};

window.printReportCard = function(studentKey) {
  const s = allStudents[studentKey];
  if (!s) return alert("Data error");

  // 1. Check Fees (Point 1 from your request)
  if (s.feeCleared !== true) {
    alert(`🚫 CANNOT PRINT: ${s.name} has not cleared school fees.`);
    return;
  }

  const grandTotal = s.subjects.reduce((sum, sub) => sum + (sub.total || 0), 0);
  const average = (grandTotal / s.subjects.length).toFixed(2);
  
  // 2. Get Position and Class Size (Point 6 from your request)
  // These are saved by the Admin "Assign Positions" button
  const position = s.subjects[0].position || "N/A";
  const classSize = s.subjects[0].classSize || "?"; 
  const meta = s.subjects[0]; // For Gender, Class, etc.

  const win = window.open("", "_blank", "width=900,height=800");
  if (!win) {
    alert("Please allow pop-ups to print results");
    return;
  }

  // FIX: Create the absolute URL so the blank window knows exactly where the image is
  const logoUrl = new URL('logo.jpg', window.location.href).href;
  const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  win.document.write(`
    <html>
    <head>
      <base href="${baseHref}">
      <title>Report Card - ${s.name}</title>
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 30px; line-height: 1.4; }
        .header { text-align: center; border-bottom: 3px double #1e3a8a; margin-bottom: 20px; padding-bottom: 15px; }
        .school-name { font-size: 26px; font-weight: 900; color: #1e3a8a; margin: 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; font-weight: bold; font-size: 13px; border: 1px solid #ccc; padding: 10px; background: #fdfdfd; }
        .content-wrapper { display: grid; grid-template-columns: 3fr 1fr; gap: 20px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #444; padding: 8px; text-align: center; }
        th { background: #eef2ff; color: #1e3a8a; text-transform: uppercase; }
        .summary-box { background: #f0fdf4; padding: 15px; border: 2px solid #1e3a8a; font-weight: bold; font-size: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        .remark-box { border: 1px solid #000; padding: 10px; margin-bottom: 15px; }
        .remark-title { font-weight: bold; text-decoration: underline; font-size: 12px; margin-bottom: 5px; }
      </style>
    </head>
    <body>
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 4px double #333; padding-bottom: 15px; margin-bottom: 25px;">
        
        <div style="flex: 0 0 auto;">
          <img src="${logoUrl}" alt="Gloryland Logo" style="width: 90px; height: 90px; object-fit: contain;">
        </div>
        
        <div style="flex: 1 1 auto; text-align: center; padding: 0 20px;">
          <h1 style="margin: 0; color: #b91c1c; font-size: 32px; font-weight: 900; letter-spacing: 1px;">GLORYLAND FOUNDATION SCHOOLS</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold; font-style: italic; color: #555;">Excellence in Learning and Character</p>
          <div style="margin-top: 10px;">
            <span style="background: #f3f4f6; border: 1px solid #ddd; padding: 5px 15px; font-size: 14px; font-weight: bold; border-radius: 4px; text-transform: uppercase;">
              Terminal Report Card
            </span>
          </div>
        </div>
        
        <div style="flex: 0 0 auto; width: 90px;"></div>
        
      </div>

      <div class="info-grid">
        <div>NAME: <span style="color:#1e3a8a;">${s.name.toUpperCase()}</span></div>
        <div>CLASS: ${meta.className}</div>
        <div>TERM: ${meta.term}${suffix(meta.term)} Term</div>
        <div>SESSION: ${meta.session}</div>
        <div>NO. IN CLASS: ${classSize}</div> </div>

      <div class="content-wrapper">
        <div>
          <table>
            <thead><tr><th>SUBJECT</th><th>CA(40)</th><th>EXAM(60)</th><th>TOTAL</th><th>GRD</th></tr></thead>
            <tbody>
              ${s.subjects.map(sub => `
                <tr>
                  <td style="text-align:left; font-weight:500;">${sub.subject}</td>
                  <td>${(sub.test||0) + (sub.project||0) + (sub.other||0)}</td>
                  <td>${sub.exam}</td>
                  <td style="font-weight:bold;">${sub.total}</td>
                  <td>${sub.grade}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div>
          <table>
            <thead><tr><th colspan="2">BEHAVIOR</th></tr></thead>
            <tbody>
              <tr><td>Handwriting</td><td>${meta.handwriting || '-'}</td></tr>
              <tr><td>Politeness</td><td>${meta.politeness || '-'}</td></tr>
              <tr><td>Attitude</td><td>${meta.attitude || '-'}</td></tr>
              <tr><td>Health</td><td>${meta.health || '-'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="summary-box">
        <span>TOTAL: ${grandTotal}</span>
        <span>AVG: ${average}%</span>
        <span>POSITION: ${position}${suffix(position)}</span>
      </div>

      <div class="remark-box">
        <div class="remark-title">PRINCIPAL'S REMARK:</div>
        <div>"${generatePrincipalRemark(average)}"</div>
      </div>
      
      <center><button onclick="window.print()" style="margin-top:20px; padding:10px 20px;">Print Report</button></center>
    </body>
    </html>
  `);
};

function generatePrincipalRemark(avg) {
  if (avg >= 75) return "Excellent performance! Keep it up.";
  if (avg >= 60) return "Good result. Room for improvement.";
  if (avg >= 50) return "Average performance. Sit up.";
  return "Below average. Needs serious improvement.";
}

function suffix(n) {
  if (n === "N/A") return "";
  const num = parseInt(n);
  if (isNaN(num)) return "";
  const j = num % 10, k = num % 100;
  if (j == 1 && k != 11) return "st";
  if (j == 2 && k != 12) return "nd";
  if (j == 3 && k != 13) return "rd";
  return "th";
}