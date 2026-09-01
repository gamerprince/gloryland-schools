
import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

$("load").onclick = async () => {
  $("output").innerHTML = "Loading...";
  $("print").classList.add("hidden");

  const className = $("className").value;
  const term = Number($("term").value);
  const session = $("session").value.trim();

  const q = query(
    collection(db, "compiledResults"),
    where("className", "==", className),
    where("term", "==", term),
    where("session", "==", session),
    where("published", "==", true)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    $("output").innerHTML = "No results found.";
    return;
  }

  const rows = {};
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!rows[d.studentName]) {
      rows[d.studentName] = {
        name: d.studentName,
        total: 0,
        position: d.position
      };
    }
    rows[d.studentName].total += d.total;
  });

  const students = Object.values(rows)
    .sort((a, b) => a.position - b.position);

  let html = `
    <table class="w-full border text-sm">
      <tr class="bg-gray-200">
        <th class="border p-1">Position</th>
        <th class="border p-1">Student Name</th>
        <th class="border p-1">Grand Total</th>
      </tr>`;

  students.forEach(s => {
    html += `
      <tr>
        <td class="border p-1 text-center">${s.position}</td>
        <td class="border p-1">${s.name}</td>
        <td class="border p-1 text-center">${s.total}</td>
      </tr>`;
  });

  html += `</table>`;

  $("output").innerHTML = html;
  $("print").classList.remove("hidden");
};

$("print").onclick = () => {
  const win = window.open("", "", "width=900,height=600");
  win.document.write(`
    <html>
    <head>
      <title>Broadsheet</title>
      <style>
        body{font-family:Arial;padding:20px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #000;padding:6px;text-align:center}
        h2{text-align:center}
      </style>
    </head>
    <body>
      <h2>Class Broadsheet</h2>
      ${$("output").innerHTML}
    </body>
    </html>
  `);
  win.document.close();
  win.print();
};

