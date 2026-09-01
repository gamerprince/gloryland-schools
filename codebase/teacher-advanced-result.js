import { db, auth } from './firebase-config.js';
import { requireRole } from './auth-guard.js';
import {
  collection, addDoc, query, where, getDocs, doc, getDoc, writeBatch, deleteDoc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const $ = id => document.getElementById(id);

// ===== UTILITIES =====
// Grading bands (strict per request):
// A: 70% and above
// C: 55% - 69%
// P: 40% - 54%
// F: below 40%

function getGrade(score) {
  score = Number(score);
  if (score >= 70) return 'A';
  if (score >= 55) return 'C';
  if (score >= 40) return 'P';
  return 'F';
}

function getGradePoint(score) {
  score = Number(score);
  if (score >= 70) return 4.0;
  if (score >= 55) return 3.0;
  if (score >= 40) return 2.0;
  return 0.0;
}

function calculateAverage(term1, term2, term3) {
  const t1 = Number(term1) || 0;
  const t2 = Number(term2) || 0;
  const t3 = Number(term3) || 0;
  return ((t1 + t2 + t3) / 3).toFixed(2);
}

function calculateWeightedAverage(term1, term2, term3) {
  const t1 = (Number(term1) || 0) * 0.2;
  const t2 = (Number(term2) || 0) * 0.3;
  const t3 = (Number(term3) || 0) * 0.5;
  return (t1 + t2 + t3).toFixed(2);
}

// ===== MOBILE MENU =====
const mobileBtn = $("mobile-menu-btn");
const mobileMenu = $("mobile-menu");
if (mobileBtn) mobileBtn.onclick = () => mobileMenu.classList.toggle("hidden");
if ($("logoutBtnMob")) $("logoutBtnMob").onclick = () => signOut(auth).then(() => window.location.href = "portal.html");
if ($("logoutBtnTop")) $("logoutBtnTop").onclick = () => signOut(auth).then(() => window.location.href = "portal.html");

// ===== AUTH =====
let currentTeacherId = null;
requireRole('teacher').then(res => {
  currentTeacherId = res.user.uid;
  console.log("Teacher Authenticated:", currentTeacherId);
}).catch(err => {
  console.error("Auth Guard Error:", err);
  window.location.href = "index.html";
});

// ===== TAB SWITCHING =====
const tabEntry = $("tab-entry");
const tabProcess = $("tab-process");
const entrySection = $("entry-section");
const processSection = $("process-section");

tabEntry.onclick = () => {
  tabEntry.classList.add("border-b-4", "border-indigo-600", "text-indigo-600");
  tabEntry.classList.remove("text-gray-600", "hover:text-indigo-600");
  
  tabProcess.classList.remove("border-b-4", "border-indigo-600", "text-indigo-600");
  tabProcess.classList.add("text-gray-600", "hover:text-indigo-600");
  
  entrySection.classList.remove("hidden");
  processSection.classList.add("hidden");
};

tabProcess.onclick = () => {
  tabProcess.classList.add("border-b-4", "border-indigo-600", "text-indigo-600");
  tabProcess.classList.remove("text-gray-600", "hover:text-indigo-600");
  
  tabEntry.classList.remove("border-b-4", "border-indigo-600", "text-indigo-600");
  tabEntry.classList.add("text-gray-600", "hover:text-indigo-600");
  
  processSection.classList.remove("hidden");
  entrySection.classList.add("hidden");
};

// ===== ENTRY SECTION: NEW ENTRY =====
let currentEntryData = {
  studentName: '',
  className: '',
  session: '',
  subjects: {} // { subjectName: { term1, term2, term3 } }
};

$("btn-new-entry").onclick = async () => {
  const studentName = $("studentName").value.trim();
  const className = $("className").value.trim();
  const session = $("session").value.trim();

  if (!studentName || !className || !session) {
    alert("Please fill in Student Name, Class, and Session");
    return;
  }

  currentEntryData = { studentName, className, session, subjects: {} };
  loadSubjectsForEntry();
};

async function loadSubjectsForEntry() {
  const container = $("subjects-container");
  container.innerHTML = '<div class="col-span-full text-center text-gray-500 italic">Loading subjects...</div>';

  try {
    const docId = `${currentTeacherId}_${currentEntryData.className.replace(/\s+/g, '')}`;
    const docSnap = await getDoc(doc(db, "teacher_assignments", docId));

    if (!docSnap.exists()) {
      container.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">No subjects assigned to this class</div>';
      return;
    }

    const subjects = docSnap.data().subjects || [];
    container.innerHTML = '';

    subjects.forEach(subject => {
      const card = document.createElement("div");
      card.className = "bg-white p-5 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition";
      card.innerHTML = `
        <div class="font-bold text-gray-800 mb-4 border-b pb-2">${subject}</div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">Ist TermScore</label>
            <input type="number" min="0" max="100" placeholder="0-100" class="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400 outline-none" data-subject="${subject}" data-term="1">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">2nd Term Score</label>
            <input type="number" min="0" max="100" placeholder="0-100" class="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400 outline-none" data-subject="${subject}" data-term="2">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">3rd Term Score</label>
            <input type="number" min="0" max="100" placeholder="0-100" class="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-400 outline-none" data-subject="${subject}" data-term="3">
          </div>
          <button class="w-full mt-3 bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 transition" onclick="editSubjectScore('${subject}')">
            Edit Full Details
          </button>
        </div>
      `;
      container.appendChild(card);

      // Track input changes
      card.querySelectorAll("input[type='number']").forEach(input => {
        input.onchange = () => {
          const subject = input.dataset.subject;
          const term = input.dataset.term;
          const value = input.value;

          if (!currentEntryData.subjects[subject]) {
            currentEntryData.subjects[subject] = { term1: 0, term2: 0, term3: 0 };
          }
          currentEntryData.subjects[subject][`term${term}`] = value;
        };
      });
    });

    // Add Save Button
    const saveBtn = document.createElement("button");
    saveBtn.className = "col-span-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 transition";
    saveBtn.innerHTML = "💾 Save All Scores";
    saveBtn.onclick = saveAllScores;
    container.appendChild(saveBtn);

  } catch (err) {
    console.error(err);
    container.innerHTML = '<div class="col-span-full text-center text-red-500 font-bold">Error loading subjects</div>';
  }
}

async function saveAllScores() {
  if (Object.keys(currentEntryData.subjects).length === 0) {
    alert("Please enter at least one subject score");
    return;
  }

  try {
    const batch = writeBatch(db);
    const normalizeKey = value => value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const studentKey = normalizeKey(currentEntryData.studentName);
    const classKey = normalizeKey(currentEntryData.className);
    const sessionKey = normalizeKey(currentEntryData.session);

    Object.entries(currentEntryData.subjects).forEach(([subject, scores]) => {
      const t1 = Number(scores.term1) || 0;
      const t2 = Number(scores.term2) || 0;
      const t3 = Number(scores.term3) || 0;
      const average = calculateAverage(t1, t2, t3);
      const subjectKey = normalizeKey(subject);
      const docId = `${currentTeacherId}_${studentKey}_${classKey}_${sessionKey}_${subjectKey}`;

      const docRef = doc(db, "advancedResults", docId);
      batch.set(docRef, {
        studentName: currentEntryData.studentName,
        studentNameLower: currentEntryData.studentName.toLowerCase(),
        className: currentEntryData.className,
        session: currentEntryData.session,
        subject: subject,
        term1: t1,
        term2: t2,
        term3: t3,
        average: average,
        grade: getGrade(average),
        gradePoint: getGradePoint(average),
        teacherId: currentTeacherId,
        createdAt: new Date().toISOString(),
        processed: false
      });
    });

    await batch.commit();
    alert("✅ All subject scores saved successfully!");
    currentEntryData = { studentName: '', className: '', session: '', subjects: {} };
    $("studentName").value = '';
    $("subjects-container").innerHTML = '';
  } catch (err) {
    console.error(err);
    alert("Error saving scores: " + err.message);
  }
}

window.editSubjectScore = (subject) => {
  const scores = currentEntryData.subjects[subject] || { term1: 0, term2: 0, term3: 0 };
  
  $("modal-subject").value = subject;
  $("modal-term1").value = scores.term1 || '';
  $("modal-term2").value = scores.term2 || '';
  $("modal-term3").value = scores.term3 || '';

  updateAverageDisplay();
  $("modal-scores").classList.remove("hidden");

  $("btn-save-scores").onclick = () => {
    currentEntryData.subjects[subject] = {
      term1: $("modal-term1").value,
      term2: $("modal-term2").value,
      term3: $("modal-term3").value
    };
    closeScoresModal();
  };
};

function updateAverageDisplay() {
  const t1 = Number($("modal-term1").value) || 0;
  const t2 = Number($("modal-term2").value) || 0;
  const t3 = Number($("modal-term3").value) || 0;
  const avg = calculateAverage(t1, t2, t3);
  $("modal-average").textContent = avg;
}

$("modal-term1").oninput = updateAverageDisplay;
$("modal-term2").oninput = updateAverageDisplay;
$("modal-term3").oninput = updateAverageDisplay;

window.closeScoresModal = () => {
  $("modal-scores").classList.add("hidden");
};

// ===== PROCESS SECTION =====
let allProcessStudents = {};

$("btn-load-students").onclick = async () => {
  const className = $("processClassName").value.trim();
  const session = $("processSession").value.trim();
  const msg = $("status-msg");

  if (!className || !session) {
    alert("Please fill in Class and Session");
    return;
  }

  msg.classList.remove("hidden");
  allProcessStudents = {};

  try {
    const q = query(
      collection(db, "advancedResults"),
      where("className", "==", className),
      where("session", "==", session)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      $("student-list").innerHTML = '<tr><td colspan="6" class="p-10 text-center text-gray-400">No advanced result records found.</td></tr>';
      msg.classList.add("hidden");
      return;
    }

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const name = data.studentName;

      if (!allProcessStudents[name]) {
        allProcessStudents[name] = {
          name: name,
          className: className,
          session: session,
          subjects: [],
          processed: false
        };
      }
      allProcessStudents[name].subjects.push(data);
    });

    renderProcessTable();
  } catch (err) {
    console.error(err);
    alert("Error loading students: " + err.message);
  } finally {
    msg.classList.add("hidden");
  }
};

// ===== CLEAN SHEET PRINTING =====
$("btn-print-clean-sheet").onclick = () => {
  printCleanSheet();
};

function printCleanSheet() {
  const className = $("processClassName").value.trim();
  const session = $("processSession").value.trim();
  const gradingMethod = $("gradingMethod").value;

  if (!className || !session) {
    alert('Please select Class and Session first');
    return;
  }

  const students = Object.values(allProcessStudents || {});
  if (!students.length) {
    alert('No students loaded. Click Load Students first.');
    return;
  }

  // gather all subjects for the class
  const subjectSet = new Set();
  students.forEach(st => st.subjects.forEach(s => subjectSet.add(s.subject)));
  const subjects = Array.from(subjectSet).sort();

  // compute final scores per subject and overall average per student
  const studentSummaries = students.map(st => {
    const subjMap = {};
    st.subjects.forEach(s => {
      const t1 = Number(s.term1) || 0;
      const t2 = Number(s.term2) || 0;
      const t3 = Number(s.term3) || 0;
      const final = gradingMethod === 'weighted' ? Number(calculateWeightedAverage(t1, t2, t3)) : Number(calculateAverage(t1, t2, t3));
      subjMap[s.subject] = { final: final, grade: getGrade(final) };
    });

    const finals = Object.values(subjMap).map(x => x.final);
    const overallAvg = finals.length ? finals.reduce((a,b)=>a+b,0)/finals.length : 0;
    return { name: st.name, subjects: subjMap, overallAvg: Number(overallAvg.toFixed(2)) };
  });

  // sort descending by overallAvg (highest first)
  studentSummaries.sort((a,b) => b.overallAvg - a.overallAvg);

  // assign positions (shared position for equal averages)
  let lastAvg = null; let lastPos = 0; let index = 0;
  studentSummaries.forEach(s => {
    index += 1;
    if (s.overallAvg === lastAvg) {
      s.position = lastPos;
    } else {
      s.position = index;
      lastPos = index;
      lastAvg = s.overallAvg;
    }
  });

  // summary counts: distinction (A) >=70, pass (C or P) >=40 & <70, fail <40
  const onRoll = studentSummaries.length;
  let distinctions = 0, passes = 0, fails = 0;
  let classTotal = 0;
  studentSummaries.forEach(s => {
    const avg = Number(s.overallAvg);
    if (Number.isFinite(avg)) {
      classTotal += avg;
      if (avg >= 70) distinctions++;
        else if (avg >= 40) passes++;
      else fails++;
    }
  });
  const classAverage = onRoll && classTotal > 0 ? (classTotal / onRoll).toFixed(2) : '0.00';

  // build print HTML
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Annual Result Clean Sheet</title><style>
    body{font-family:Arial,sans-serif;margin:20px;color:#111}
    .center{text-align:center}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #333;padding:6px;font-size:13px}
    th{background:#f4f4f4}
    .summary{margin-top:18px;font-size:14px}
    .signature{margin-top:36px}
    @media print{ .no-print{display:none} }
  </style></head><body>
    <div class="center">
      <h2>ANNUAL RESULT CLEAN SHEET FOR ${className} — SESSION ${session}</h2>
      <p><em>Generated: ${new Date().toLocaleString()}</em></p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:5%">S/N</th>
          <th style="width:25%">Name</th>
`;

  subjects.forEach(sub => { html += `<th>${sub}</th>`; });
  html += `<th style="width:10%">Total Average</th><th style="width:8%">Position</th></tr></thead><tbody>`;

  studentSummaries.forEach((s, i) => {
    html += `<tr><td class="center">${i+1}</td><td>${s.name}</td>`;
    subjects.forEach(sub => {
      const cell = s.subjects[sub] ? s.subjects[sub].final : '';
      html += `<td class="center">${cell}</td>`;
    });
    html += `<td class="center font-bold">${s.overallAvg.toFixed(2)}</td><td class="center">${s.position}</td></tr>`;
  });

  html += `</tbody></table>`;

  html += `<div class="summary">
    <p><strong>Class:</strong> ${className}</p>
    <p><strong>No. on roll:</strong> ${onRoll}</p>
    <p><strong>No. of distinction(s):</strong> ${distinctions}</p>
    <p><strong>No. of pass(es):</strong> ${passes}</p>
    <p><strong>No. of fail(s):</strong> ${fails}</p>
    <p><strong>Class average:</strong> ${classAverage}</p>
  </div>

  <div class="signature">
    <p>Class Teacher:</p>
    <div style="height:60px;border-bottom:1px solid #333;width:60%;"></div>
    <p style="margin-top:8px">Signature: ______________________ &nbsp;&nbsp; Date: ______________________</p>
  </div>

  <div class="no-print" style="margin-top:18px">
    <button onclick="window.print()" style="padding:8px 12px;background:#0b74de;color:#fff;border:none;border-radius:6px;">Print</button>
  </div>

  </body></html>`;

  const w = window.open('', '', 'width=1000,height=800');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),300);
}

function renderProcessTable() {
  const tbody = $("student-list");
  tbody.innerHTML = "";

  const names = Object.keys(allProcessStudents);

  names.forEach(name => {
    const student = allProcessStudents[name];
    const avgScores = student.subjects.map(s => Number(s.average));
    const overallAvg = avgScores.length ? (avgScores.reduce((a, b) => a + b, 0) / avgScores.length).toFixed(2) : '0.00';

    const row = document.createElement("tr");
    row.className = "border-b hover:bg-gray-50 transition text-sm";
    row.innerHTML = `
      <td class="p-3 font-bold text-gray-800"></td>
      <td class="p-3 text-center">
        <span class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
          ${student.subjects.length} Subjects
        </span>
      </td>
      <td class="p-3 text-center font-bold text-lg text-indigo-600">${overallAvg}</td>
      <td class="p-3 text-center"></td>
      <td class="p-3 text-center"></td>
      <td class="p-3 text-center">
       <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
          Ready
        </span> 
      </td>
    `;

    row.children[0].textContent = student.name;

    const viewButton = document.createElement('button');
    viewButton.className = 'bg-indigo-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-indigo-700 transition';
    viewButton.textContent = 'View Result';
    viewButton.addEventListener('click', () => viewProcessedResult(name));
    row.children[3].appendChild(viewButton);

    const removeButton = document.createElement('button');
    removeButton.className = 'bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700 transition';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => removeStudent(name));
    row.children[4].appendChild(removeButton);

    tbody.appendChild(row);
  });
}

async function removeStudent(studentName) {
  if (!confirm(`Remove all records for ${studentName}? This cannot be undone.`)) return;

  const className = $("processClassName").value.trim();
  const session = $("processSession").value.trim();

  if (!className || !session) {
    alert('Select Class and Session before removing a student.');
    return;
  }

  try {
    const q = query(
      collection(db, 'advancedResults'),
      where('studentName', '==', studentName),
      where('className', '==', className),
      where('session', '==', session)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      alert('No records found for this student to remove.');
      return;
    }

    const batch = writeBatch(db);
    snap.forEach(docSnap => batch.delete(doc(db, 'advancedResults', docSnap.id)));
    await batch.commit();

    delete allProcessStudents[studentName];
    renderProcessTable();
    alert(`${studentName} has been removed successfully.`);
  } catch (err) {
    console.error(err);
    alert('Error removing student: ' + err.message);
  }
}

window.viewProcessedResult = (studentName) => {
  const student = allProcessStudents[studentName];
  const gradingMethod = $("gradingMethod").value;

  let html = `
    <div class="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 rounded-lg mb-4">
      <div class="text-lg font-black">${student.name}</div>
      <div class="text-sm opacity-90">${student.className} | Session: ${student.session}</div>
    </div>

    <div class="space-y-3">
      <div class="border-b pb-3">
        <h4 class="font-bold text-gray-700 mb-2">📊 Subject Breakdown</h4>
        <table class="w-full text-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-2 text-left font-bold">Subject</th>
              <th class="p-2 text-center font-bold">T1</th>
              <th class="p-2 text-center font-bold">T2</th>
              <th class="p-2 text-center font-bold">T3</th>
              <th class="p-2 text-center font-bold">Avg/Final</th>
              <th class="p-2 text-center font-bold">Grade</th>
            </tr>
          </thead>
          <tbody>
  `;

  let totalPoints = 0;
  let subjectCount = 0;

  student.subjects.forEach(subject => {
    const t1 = Number(subject.term1);
    const t2 = Number(subject.term2);
    const t3 = Number(subject.term3);
    
    let finalScore;
    if (gradingMethod === 'weighted') {
      finalScore = calculateWeightedAverage(t1, t2, t3);
    } else {
      finalScore = calculateAverage(t1, t2, t3);
    }
    
    const grade = getGrade(finalScore);
    const gradePoint = getGradePoint(finalScore);

    totalPoints += gradePoint;
    subjectCount += 1;

    html += `
      <tr class="border-b hover:bg-gray-50">
        <td class="p-2 font-semibold">${subject.subject}</td>
        <td class="p-2 text-center">${t1}</td>
        <td class="p-2 text-center">${t2}</td>
        <td class="p-2 text-center">${t3}</td>
        <td class="p-2 text-center font-bold text-indigo-600">${finalScore}</td>
        <td class="p-2 text-center font-black text-lg ${grade === 'A' ? 'text-green-600' : grade === 'F' ? 'text-red-600' : 'text-gray-700'}">${grade}</td>
      </tr>
    `;
  });

  const gpa = (totalPoints / subjectCount).toFixed(2);
  const generalGrade = gpa >= 3.5 ? 'Excellent' : gpa >= 2.5 ? 'Good' : 'Fair';

  html += `
          </tbody>
        </table>
      </div>

      <div class="grid grid-cols-3 gap-3 text-center">
        <div class="bg-green-50 p-3 rounded border border-green-200">
          <div class="text-xs text-gray-500 font-bold">GPA</div>
          <div class="text-2xl font-black text-green-600">${gpa}</div>
        </div>
        <div class="bg-blue-50 p-3 rounded border border-blue-200">
          <div class="text-xs text-gray-500 font-bold">Performance</div>
          <div class="text-lg font-bold text-blue-600">${generalGrade}</div>
        </div>
        <div class="bg-purple-50 p-3 rounded border border-purple-200">
          <div class="text-xs text-gray-500 font-bold">Subjects Taken</div>
          <div class="text-2xl font-black text-purple-600">${subjectCount}</div>
        </div>
      </div>
    </div>
  `;

  $("result-card-content").innerHTML = html;
  $("result-modal-title").textContent = `Result Card - ${student.name}`;
  $("modal-result").classList.remove("hidden");

  $("btn-print-result").onclick = () => printResult(student.name, student.className, student.session);
};

window.closeResultModal = () => {
  $("modal-result").classList.add("hidden");
};

function printResult(studentName, className, session) {
  const student = allProcessStudents[studentName];
  const gradingMethod = $("gradingMethod").value;

  let printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${studentName} - Result Card</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header-section { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #333; padding-bottom: 10px; margin-bottom: 30px; }
        .logo-img { width: 80px; height: 80px; object-fit: contain; }
        .header-content { text-align: center; flex-grow: 1; }
        .header-content h1 { margin: 0; font-size: 24px; }
        .header-content p { margin: 5px 0; color: #666; }
        .spacer { width: 80px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .text-center { text-align: center; }
        .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0; }
        .summary-box { border: 1px solid #ddd; padding: 15px; text-align: center; }
        .summary-box h3 { margin: 0 0 10px 0; font-size: 12px; color: #666; }
        .summary-box .value { font-size: 28px; font-weight: bold; color: #333; }
        .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header-section">
        <img src="logo.jpg" alt="Logo" class="logo-img">
        <div class="header-content">
          <h1>GLORYLAND FOUNDATION ACADEMY</h1>
          <p>Multi-Term Advanced Result Card</p>
          <p>Session: ${session}</p>
        </div>
        <div class="spacer"></div>
      </div>

      <div style="margin-bottom: 20px;">
        <p><strong>Student Name:</strong> ${studentName}</p>
        <p><strong>Class:</strong> ${className}</p>
        <p><strong>Grading Method:</strong> ${gradingMethod === 'weighted' ? 'Weighted (T1:20%, T2:30%, T3:50%)' : 'Average of 3 Terms'}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th class="text-center">Ist Term</th>
            <th class="text-center">2nd Term</th>
            <th class="text-center">3rd Term</th>
            <th class="text-center">Final Score</th>
            <th class="text-center">Grade</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totalPoints = 0;
  let subjectCount = 0;

  student.subjects.forEach(subject => {
    const t1 = Number(subject.term1);
    const t2 = Number(subject.term2);
    const t3 = Number(subject.term3);
    
    let finalScore;
    if (gradingMethod === 'weighted') {
      finalScore = calculateWeightedAverage(t1, t2, t3);
    } else {
      finalScore = calculateAverage(t1, t2, t3);
    }
    
    const grade = getGrade(finalScore);
    const gradePoint = getGradePoint(finalScore);

    totalPoints += gradePoint;
    subjectCount += 1;

    printHtml += `
      <tr>
        <td>${subject.subject}</td>
        <td class="text-center">${t1}</td>
        <td class="text-center">${t2}</td>
        <td class="text-center">${t3}</td>
        <td class="text-center"><strong>${finalScore}</strong></td>
        <td class="text-center"><strong>${grade}</strong></td>
      </tr>
    `;
  });

  const gpa = (totalPoints / subjectCount).toFixed(2);

  printHtml += `
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-box">
          <h3>GPA (Grade Point Average)</h3>
          <div class="value">${gpa}</div>
        </div>
        <div class="summary-box">
          <h3>Total Subjects</h3>
          <div class="value">${subjectCount}</div>
        </div>
        <div class="summary-box">
          <h3>Subjects Passed</h3>
          <div class="value">${student.subjects.filter(s => {
            const t1 = Number(s.term1);
            const t2 = Number(s.term2);
            const t3 = Number(s.term3);
            let final = gradingMethod === 'weighted' ? calculateWeightedAverage(t1, t2, t3) : calculateAverage(t1, t2, t3);
            return getGrade(final) !== 'F';
          }).length}</div>
        </div>
      </div>

      <div class="footer">
        <p>Printed on: ${new Date().toLocaleString()}</p>
        <p>This is an official academic record.</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(printHtml);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
}
