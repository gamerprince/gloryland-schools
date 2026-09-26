import { db } from "./firebase-config.js";
import { 
  collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, getDoc, where, writeBatch 
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

// Class list for dropdowns
const classList = [
  "Daycare", "Kindergarten 1 (KG1)", "Kindergarten 2 (KG2)",
  "Nursery 1", "Nursery 2", "Nursery 3",
  "Basic 1 Onyx", "Basic 1 Gold", "Basic 2", "Basic 3", "Basic 4", "Basic 5", "Basic 6",
  "JSS 1", "JSS 2", "JSS 3"
];

// Initialize cp-class dropdown for "Complete Payment" section
window.addEventListener('DOMContentLoaded', () => {
  const cpClassSelect = $('cp-class');
  if (cpClassSelect) {
    classList.forEach(cls => {
      const opt = document.createElement('option');
      opt.value = cls;
      opt.textContent = cls;
      cpClassSelect.appendChild(opt);
    });
  }
});

/* =========================================================
   1. UTILITIES & PREDICTIVE SEARCH
========================================================= */
function formatStudentName(name) {
  return name.trim().split(/\s+/).map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

let registeredEntries = []; // { name, id, className }
let registeredLedgerEntries = []; // names from bursaryLedgers for CP search
let selectedLedger = null;
async function loadNamesForSearch() {
  try {
    // Prefer admissions collection as requested — gracefully fall back to students_registry
    const tryCollections = ['admissions', 'students_registry'];
    for (const colName of tryCollections) {
      try {
        const snap = await getDocs(collection(db, colName));
        snap.forEach(d => {
          const data = d.data() || {};
          const name = data.fullName || data.pupilName || data.studentName || data.name;
          const className = data.class || data.className || data.currentClass || '';
          if (name) registeredEntries.push({ name: String(name).trim(), id: d.id, className });
        });
        if (registeredEntries.length) break; // stop after first populated collection
      } catch (e) {
        console.warn('Collection read failed', colName, e);
      }
    }
    // dedupe by lowercased name
    const map = {};
    registeredEntries.forEach(e => { map[e.name.toLowerCase()] = e; });
    registeredEntries = Object.values(map).sort((a,b) => a.name.localeCompare(b.name));
  } catch (e) { console.error("Search load error:", e); }
}
loadNamesForSearch();

// Load names from bursaryLedgers for the Complete Payment predictive search
async function loadLedgerNamesForCP() {
  try {
    const snap = await getDocs(collection(db, 'bursaryLedgers'));
    snap.forEach(d => {
      const data = d.data() || {};
      const name = data.pupilName || data.studentName || data.fullName || '';
      const className = data.className || data.class || '';
      if (name) registeredLedgerEntries.push({ name: String(name).trim(), id: d.id, className });
    });
    // dedupe
    const map = {};
    registeredLedgerEntries.forEach(e => { map[e.name.toLowerCase()] = e; });
    registeredLedgerEntries = Object.values(map).sort((a,b) => a.name.localeCompare(b.name));
  } catch (e) { console.error('Ledger names load error:', e); }
}
loadLedgerNamesForCP();

function attachPredictiveSearch(inputId, sourceArray = null) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'relative w-full';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  const dropdown = document.createElement('div');
  dropdown.className = 'absolute z-50 w-full bg-white border border-gray-200 rounded-b-lg shadow-2xl max-h-48 overflow-y-auto hidden top-full left-0 mt-1';
  wrapper.appendChild(dropdown);

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    if (!val) { dropdown.classList.add('hidden'); return; }

    // scoring: prefer exact, prefix, substring, then by Levenshtein distance
    function levenshtein(a, b) {
      const al = a.length, bl = b.length;
      if (al === 0) return bl;
      if (bl === 0) return al;
      const v0 = new Array(bl + 1), v1 = new Array(bl + 1);
      for (let j = 0; j <= bl; j++) v0[j] = j;
      for (let i = 0; i < al; i++) {
        v1[0] = i + 1;
        for (let j = 0; j < bl; j++) {
          const cost = a[i] === b[j] ? 0 : 1;
          v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
        }
        for (let j = 0; j <= bl; j++) v0[j] = v1[j];
      }
      return v1[bl];
    }

    const source = sourceArray || registeredEntries;
    const matches = source
      .map(e => {
        const name = e.name || '';
        const nameLower = name.toLowerCase();
        let score = levenshtein(val, nameLower);
        if (nameLower === val) score -= 1000; // exact first
        else if (nameLower.startsWith(val)) score -= 500; // prefixes next
        else if (nameLower.includes(val)) score -= 200; // substrings next
        return { entry: e, score };
      })
      .sort((a, b) => a.score - b.score)
      .map(x => x.entry);

    if (matches.length > 0) {
      dropdown.classList.remove('hidden');
      matches.slice(0, 50).forEach(match => {
        const div = document.createElement('div');
        div.className = 'p-3 hover:bg-green-50 cursor-pointer text-sm font-bold text-gray-700 border-b border-gray-100 transition-colors';
        const regex = new RegExp(`(${val})`, "gi");
        div.innerHTML = match.name.replace(regex, "<span class='text-green-600'>$1</span>");
        div.onmousedown = (e) => {
          e.preventDefault();
          input.value = match.name;
          dropdown.classList.add('hidden');
          // Populate class if available
          try {
            if (inputId === 'a-name' && $('a-class') && match.className) $('a-class').value = match.className;
            if (inputId === 'b-name' && $('b-class') && match.className) $('b-class').value = match.className;
            if (inputId === 'cp-search' && $('cp-class') && match.className) $('cp-class').value = match.className;
          } catch (er) { console.warn('Apply match class error', er); }
        };
        dropdown.appendChild(div);
      });
    } else { dropdown.classList.add('hidden'); }
  });

  input.addEventListener('blur', () => {
    dropdown.classList.add('hidden');
    if (input.value) input.value = formatStudentName(input.value);
  });
}

setTimeout(() => {
  attachPredictiveSearch("a-name", registeredEntries);
  attachPredictiveSearch("b-name", registeredEntries);
  attachPredictiveSearch("cp-search", registeredLedgerEntries);
}, 500);

if($("a-date")) $("a-date").valueAsDate = new Date();
if($("b-date")) $("b-date").valueAsDate = new Date();

/* =========================================================
   2. PART A MATH & SEARCH LOGIC
========================================================= */
const updatePartAMath = () => {
  const arrears = Number($("a-bal-last")?.value) || 0;
  const current = Number($("a-current-fees")?.value) || 0;
  const paid = Number($("a-amount")?.value) || 0;
  const prevPaid = getPaidTotal(selectedLedger || {});
  // total owed after accounting for prior installments
  const totalOwed = (arrears + current) - prevPaid;
  const displayTotal = Math.max(0, totalOwed);
  if($("a-total-owed-display")) $("a-total-owed-display").innerText = `₦ ${displayTotal.toLocaleString()}`;
  if ($("a-balance")) $("a-balance").placeholder = `Remaining: ₦${Math.max(0, (totalOwed - paid)).toLocaleString()}`;
};

['a-bal-last', 'a-current-fees', 'a-amount'].forEach(id => {
  if ($(id)) $(id).oninput = updatePartAMath;
});

function getPaidTotal(r) {
  return (Number(r.p1Amt)||0)+(Number(r.p2Amt)||0)+(Number(r.p3Amt)||0)+(Number(r.p4Amt)||0);
}
function getBalance(r) {
  return ((Number(r.balLastTerm)||0)+(Number(r.currentFees)||0)) - getPaidTotal(r);
}

async function loadIncomplete() {
  const className = $('cp-class').value;
  const term = $("a-term")?.value || "1st Term";
  const box = $('cp-results');
  if(!className) return alert('Select Class');
  box.innerHTML = 'Searching...';
  try {
    const snap = await getDocs(query(collection(db,'bursaryLedgers'), where('className','==',className), where('term','==',term)));
    box.innerHTML = '';
    const items = [];
    snap.forEach(d => { items.push({ id: d.id, data: d.data() }); });
    // If a name is in cp-search, prefer that name on top
    const preferred = ($('cp-search')?.value || '').trim().toLowerCase();
    if (preferred) {
      items.sort((a,b) => {
        const an = (a.data.pupilName||'').toLowerCase();
        const bn = (b.data.pupilName||'').toLowerCase();
        if (an === preferred && bn !== preferred) return -1;
        if (bn === preferred && an !== preferred) return 1;
        return 0;
      });
    }
    items.forEach(item => {
      const d = item; const r = d.data;
      const bal = getBalance(r);
      if (bal <= 0) return;
      const card = document.createElement('div');
      card.className = 'p-4 border rounded shadow-sm bg-white mb-2 flex justify-between items-center';
      card.innerHTML = `
        <div><div class="font-bold">${r.pupilName}</div><div class="text-xs text-red-600">Balance: ₦${bal.toLocaleString()}</div></div>
        <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs" onclick="window.selectPendingStudent('${d.id}')">Select</button>`;
      box.appendChild(card);
    });
  } catch(e) { box.innerHTML = e.message; }
}

window.selectPendingStudent = async (id) => {
  const docSnap = await getDoc(doc(db, 'bursaryLedgers', id));
  const data = docSnap.data();
  if($("selected-ledger-id")) $("selected-ledger-id").value = id;
  $("a-name").value = data.pupilName;
  $("a-class").value = data.className;
  $("a-bal-last").value = data.balLastTerm || 0;
  $("a-current-fees").value = data.currentFees || 0;
  selectedLedger = data;
  updatePartAMath();
  // show total paid so far
  if ($("a-total-paid-display")) {
    const paid = getPaidTotal(selectedLedger || {});
    $("a-total-paid-display").innerText = `₦ ${Number(paid).toLocaleString()}`;
  }
};

if($('cp-load')) $('cp-load').onclick = loadIncomplete;

/* =========================================================
   3. SAVE PART A (TO LEDGER_2025-2026)
========================================================= */
if($("btn-save-a")) $("btn-save-a").onclick = async () => {
  const btn = $("btn-save-a");
  const msg = $("msg-a");
  const ledgerId = $("selected-ledger-id")?.value;
  
  const entry = {
    pupilName: formatStudentName($("a-name").value),
    className: $("a-class").value,
    amount: Number($("a-amount").value),
    receipt: $("a-receipt").value,
    date: $("a-date").value,
    balLastTerm: Number($("a-bal-last").value),
    currentFees: Number($("a-current-fees").value)
  };

  if(!entry.pupilName || !entry.amount) return alert("Missing Name/Amount");
  btn.disabled = true; btn.textContent = "SAVING...";

  try {
    // A. Save to the main Bursary Log
    await addDoc(collection(db, "bursaryEntries"), { ...entry, createdAt: serverTimestamp() });

    // NOTE: Part A should NOT feed into Cash Analysis. Only Part B writes to `cashAnalysis`.
    // The automatic addDoc to "cashAnalysis" was removed per request — Part A will
    // only write to the main bursary log and update the bursary ledger.

    // C. Update the Ledger (bursaryLedgers)
    const ledgerRef = collection(db, "bursaryLedgers");
    let targetDocId = $("selected-ledger-id")?.value; // FIX: Use the actual value from the hidden input

    if (!targetDocId) {
      const q = query(ledgerRef, where("pupilName", "==", entry.pupilName), where("className", "==", entry.className), where("term", "==", $("a-term")?.value || "1st Term"));
      const snap = await getDocs(q);
      if (!snap.empty) targetDocId = snap.docs[0].id;
    }

    if (targetDocId) {
      // Student exists in ledger - update with new payment
      const docSnap = await getDoc(doc(db, "bursaryLedgers", targetDocId));
      const current = docSnap.data();
      let updateData = { balLastTerm: entry.balLastTerm, currentFees: entry.currentFees, term: $("a-term")?.value || "1st Term" };
      
      // Slot logic (p1 to p4)
      if (!current.p1Amt) { updateData.p1Amt = entry.amount; updateData.p1Rec = entry.receipt; updateData.p1Date = entry.date; }
      else if (!current.p2Amt) { updateData.p2Amt = entry.amount; updateData.p2Rec = entry.receipt; updateData.p2Date = entry.date; }
      else if (!current.p3Amt) { updateData.p3Amt = entry.amount; updateData.p3Rec = entry.receipt; updateData.p3Date = entry.date; }
      else { updateData.p4Amt = entry.amount; updateData.p4Rec = entry.receipt; updateData.p4Date = entry.date; }

      await updateDoc(doc(db, "bursaryLedgers", targetDocId), updateData);
      // update local selectedLedger so the UI shows updated totals
      selectedLedger = Object.assign({}, current, updateData);
      if ($("a-total-paid-display")) {
        const paid = getPaidTotal(selectedLedger || {});
        $("a-total-paid-display").innerText = `₦ ${Number(paid).toLocaleString()}`;
      }
    } else {
      // Student doesn't exist - create new ledger entry
      const newDoc = await addDoc(ledgerRef, {
        pupilName: entry.pupilName,
        className: entry.className,
        term: $("a-term")?.value || "1st Term",
        balLastTerm: entry.balLastTerm,
        currentFees: entry.currentFees,
        p1Amt: entry.amount,
        p1Rec: entry.receipt,
        p1Date: entry.date,
        p2Amt: 0,
        p2Rec: "",
        p2Date: "",
        p3Amt: 0,
        p3Rec: "",
        p3Date: "",
        p4Amt: 0,
        p4Rec: "",
        p4Date: ""
      });
      // set selected ledger id to the newly created doc so UI remains in sync
      if (newDoc && newDoc.id && $("selected-ledger-id")) $("selected-ledger-id").value = newDoc.id;
      selectedLedger = {
        pupilName: entry.pupilName, className: entry.className, term: $("a-term")?.value || "1st Term",
        balLastTerm: entry.balLastTerm, currentFees: entry.currentFees,
        p1Amt: entry.amount, p1Rec: entry.receipt, p1Date: entry.date,
        p2Amt: 0, p2Rec: "", p2Date: "", p3Amt: 0, p3Rec: "", p3Date: "", p4Amt: 0, p4Rec: "", p4Date: ""
      };
      if ($("a-total-paid-display")) $("a-total-paid-display").innerText = `₦ ${Number(getPaidTotal(selectedLedger)).toLocaleString()}`;
    }

    if (msg) msg.innerText = "✅ Saved to Log and Ledger!";
    ["a-name", "a-amount", "a-receipt"].forEach(id => { if($(id)) $(id).value = ""; });
    if($("selected-ledger-id")) $("selected-ledger-id").value = "";
    selectedLedger = null;
      // Refresh views: reload incomplete list and refresh cash analysis table
      if($('cp-class') && $('cp-class').value) loadIncomplete();

  } catch(e) { 
    console.error(e); 
    if (msg) msg.innerText = "Error: " + e.message; 
  }
  finally { btn.disabled = false; btn.textContent = "SAVE PAYMENT (PART A)"; }
};

/* =========================================================
   5. LOAD CASH ANALYSIS TABLE WITH FILTERING
========================================================= */

// Store all cash analysis records and filter state
let allCashAnalysisRecords = [];
let cashAnalysisFilterClass = '';
let cashAnalysisFilterName = '';

async function loadCashAnalysis() {
  const tbody = $("cash-tbody");
  if (!tbody) return;
  await feeCategoriesReady;
  tbody.innerHTML = `<tr><td colspan='${6 + getCashFeeColumns().length}' class='p-4 text-center'>Loading...</td></tr>`;
  try {
    const q = query(collection(db, "cashAnalysis"), orderBy("timestamp", "desc"));
    const snap = await getDocs(q);
    allCashAnalysisRecords = [];
    snap.forEach(d => {
      const data = d.data();
      // Exclude deleted records
      if (data.deleted !== true) {
        allCashAnalysisRecords.push({ id: d.id, ...data });
      }
    });
    
    // Populate class filter dropdown
    populateCashAnalysisClassFilter();
    
    // Render the filtered table
    renderCashAnalysisTable();
  } catch (e) { console.error("Table Load Error:", e); }
}

function populateCashAnalysisClassFilter() {
  const classSelect = $("cash-filter-class");
  if (!classSelect) return;
  
  // Get unique classes from all records
  const uniqueClasses = [...new Set(allCashAnalysisRecords.map(r => r.className).filter(c => c))];
  uniqueClasses.sort();
  
  // Preserve the "-- All Classes --" option and add classes
  const currentValue = classSelect.value;
  classSelect.innerHTML = '<option value="">-- All Classes --</option>';
  uniqueClasses.forEach(cls => {
    const opt = document.createElement('option');
    opt.value = cls;
    opt.textContent = cls;
    classSelect.appendChild(opt);
  });
  classSelect.value = currentValue;
}

function getCashFeeColumns() {
  const columns = new Map(feeCategories.map(fee => [fee.id, fee.label]));
  allCashAnalysisRecords.forEach(record => {
    Object.keys(record.fees || {}).forEach(id => {
      if (!columns.has(id)) columns.set(id, record.feeLabels?.[id] || id.replace(/[-_]/g, " "));
    });
  });
  return [...columns].map(([id, label]) => ({ id, label }));
}

function renderCashAnalysisHeaders(columns) {
  const totalHeader = $("cash-total-header");
  if (!totalHeader) return;
  const row = totalHeader.parentElement;
  row.querySelectorAll(".dynamic-fee-heading").forEach(header => header.remove());
  columns.forEach(fee => {
    const header = document.createElement("th");
    header.className = "dynamic-fee-heading";
    header.textContent = fee.label;
    row.insertBefore(header, totalHeader);
  });
}

function renderCashAnalysisTable() {
  const tbody = $("cash-tbody");
  if (!tbody) return;
  const feeColumns = getCashFeeColumns();
  renderCashAnalysisHeaders(feeColumns);
  const columnCount = 6 + feeColumns.length;
  
  // Filter records based on current filter states
  let filtered = allCashAnalysisRecords.filter(r => {
    const classMatch = !cashAnalysisFilterClass || r.className === cashAnalysisFilterClass;
    const nameMatch = !cashAnalysisFilterName || 
      (r.studentName || '').toLowerCase().includes(cashAnalysisFilterName.toLowerCase());
    return classMatch && nameMatch;
  });
  
  tbody.innerHTML = "";
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan='${columnCount}' class='p-4 text-center text-gray-400'>No records match your filters</td></tr>`;
    return;
  }
  
  let i = 0;
  filtered.forEach(r => {
    const val = v => v || 0;
    const fourthChildBadge = r.is4thChild ? '<span class="inline-block bg-purple-300 text-white text-[10px] font-black px-2 py-1 rounded ml-2">4TH</span>' : '';
    const verifiedBadge = r.verified ? '<span class="inline-block bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded ml-1">✓ VERIFIED</span>' : '';
    let row = `\n        <tr class="border-b ${r.verified ? 'bg-green-50' : ''}">\n          <td>${++i}</td>\n          <td class="sticky left-0 ${r.verified ? 'bg-green-50' : 'bg-white'} font-bold">${r.studentName}${fourthChildBadge}${verifiedBadge}</td>\n          <td>${r.is4thChild ? '✓' : ''}</td>\n          <td>${r.className || ''}</td>`;
    // iterate categories in the same order as feeCategories array
    feeColumns.forEach(fc => {
      row += `<td>${val(r.fees?.[fc.id])}</td>`;
    });
    row += `\n          <td class="bg-blue-50">₦${val(r.totalAmount)}</td>\n          <td><button class="action-btn ${r.verified ? 'bg-gray-300' : 'bg-orange-500'} text-white text-[10px] font-bold px-2 py-1 rounded hover:${r.verified ? 'bg-gray-400' : 'bg-orange-600'} transition" data-id="${r.id}" data-verified="${r.verified || false}" onclick="openActionMenu('${r.id}')">⋮</button></td>\n        </tr>`;
    tbody.innerHTML += row;
  });
}

// Setup filter event listeners
window.addEventListener('DOMContentLoaded', () => {
  if(typeof loadCashAnalysis === 'function') loadCashAnalysis();
  
  // Class filter dropdown change
  const classFilter = $("cash-filter-class");
  if (classFilter) {
    classFilter.addEventListener('change', (e) => {
      cashAnalysisFilterClass = e.target.value;
      renderCashAnalysisTable();
    });
  }
  
  // Name filter input with autocomplete
  const nameFilter = $("cash-filter-name");
  if (nameFilter) {
    // Setup autocomplete for name filter
    attachCashAnalysisNameAutocomplete("cash-filter-name");
    
    nameFilter.addEventListener('input', (e) => {
      cashAnalysisFilterName = e.target.value;
      renderCashAnalysisTable();
    });
  }
  
  // Clear filters button
  const resetBtn = $("cash-filter-reset");
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      cashAnalysisFilterClass = '';
      cashAnalysisFilterName = '';
      if (classFilter) classFilter.value = '';
      if (nameFilter) nameFilter.value = '';
      renderCashAnalysisTable();
    });
  }
});

// Autocomplete for cash analysis name search
function attachCashAnalysisNameAutocomplete(inputId) {
  const input = $("cash-filter-name");
  if (!input) return;
  
  // Create wrapper and dropdown if not already exists
  let wrapper = input.parentElement;
  if (!wrapper.classList.contains('relative')) {
    wrapper = document.createElement('div');
    wrapper.className = 'relative w-full';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
  }
  
  let dropdown = wrapper.querySelector('.cash-autocomplete-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'cash-autocomplete-dropdown absolute z-50 w-full bg-white border border-gray-200 rounded-b-lg shadow-2xl max-h-48 overflow-y-auto hidden top-full left-0 mt-1';
    wrapper.appendChild(dropdown);
  }
  
  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    dropdown.innerHTML = '';
    
    if (!val) {
      dropdown.classList.add('hidden');
      return;
    }
    
    // Get all unique names from cash analysis records
    const allNames = [...new Set(allCashAnalysisRecords.map(r => r.studentName).filter(n => n))];
    
    // Simple matching: names containing the search value
    const matches = allNames.filter(name => name.toLowerCase().includes(val))
      .sort((a, b) => {
        // Prioritize: exact match, starts with, then contains
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        if (aLower === val && bLower !== val) return -1;
        if (bLower === val && aLower !== val) return 1;
        if (aLower.startsWith(val) && !bLower.startsWith(val)) return -1;
        if (!aLower.startsWith(val) && bLower.startsWith(val)) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 20); // Limit to 20 suggestions
    
    if (matches.length > 0) {
      dropdown.classList.remove('hidden');
      matches.forEach(name => {
        const div = document.createElement('div');
        div.className = 'p-3 hover:bg-green-50 cursor-pointer text-sm font-bold text-gray-700 border-b border-gray-100 transition-colors';
        const regex = new RegExp(`(${val})`, "gi");
        div.innerHTML = name.replace(regex, "<span class='text-green-600 font-black'>$1</span>");
        div.addEventListener('click', () => {
          input.value = name;
          dropdown.classList.add('hidden');
          cashAnalysisFilterName = name;
          renderCashAnalysisTable();
        });
        dropdown.appendChild(div);
      });
    } else {
      dropdown.classList.add('hidden');
    }
  });
  
  // Hide dropdown on blur
  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });
}

/* =========================================================
   4. SAVE PART B (TO CASH ANALYSIS)
========================================================= */

// 4th Child tracking
let is4thChildActive = false;
const btn4thChild = $("btn-4th-child");
if (btn4thChild) {
  btn4thChild.addEventListener('click', (e) => {
    e.preventDefault();
    is4thChildActive = !is4thChildActive;
    btn4thChild.classList.toggle('bg-purple-300', is4thChildActive);
    btn4thChild.classList.toggle('text-white', is4thChildActive);
    btn4thChild.classList.toggle('bg-white', !is4thChildActive);
    btn4thChild.classList.toggle('text-purple-700', !is4thChildActive);
    btn4thChild.classList.toggle('border-purple-600', is4thChildActive);
  });
}

const defaultFeeCategories = [
  { id: "development", label: "Development Fees" }, { id: "exam", label: "Exam Fees" },
  { id: "medical", label: "Medical Fees" }, { id: "maintenance", label: "Maintenance Fees" },
  { id: "schoolFees", label: "School Fees" }, { id: "lesson", label: "Lesson Fees" },
  { id: "pta", label: "PTA" }, { id: "bookPack", label: "Book Pack" },
  { id: "uniform", label: "Uniform" }, { id: "sportswear", label: "Sportswear" },
  { id: "cardigan", label: "Cardigan" }, { id: "phonics", label: "Phonics/French Fees" },
  { id: "cbt", label: "CBT Fees" }, { id: "robotics", label: "Robotics & Coding Fees" },
  { id: "excursion", label: "Excursion / Extra Curr." }
];
let feeCategories = [...defaultFeeCategories];

function renderFeeInputs() {
  const grid = $("fee-grid");
  if (!grid) return;
  grid.innerHTML = "";
  feeCategories.forEach(fee => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex items-center justify-between bg-white p-2 border rounded text-xs";
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 w-full";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "fee-tick";
    checkbox.value = fee.id;
    checkbox.dataset.target = `amt-${fee.id}`;
    const labelText = document.createElement("span");
    labelText.textContent = fee.label;
    label.append(checkbox, labelText);
    const input = document.createElement("input");
    input.type = "number";
    input.id = `amt-${fee.id}`;
    input.placeholder = "0";
    input.className = "hidden w-20 p-1 border-b text-right outline-none";
    checkbox.addEventListener("change", () => {
      input.classList.toggle("hidden", !checkbox.checked);
      if (checkbox.checked) input.focus();
    });
    wrapper.append(label, input);
    grid.appendChild(wrapper);
  });
}

async function loadFeeCategories() {
  try {
    const snap = await getDoc(doc(db, "settings", "bursaryFeeCategories"));
    const saved = snap.exists() && Array.isArray(snap.data().categories) ? snap.data().categories : [];
    const categories = [...defaultFeeCategories];
    saved.forEach(fee => {
      if (fee?.id && fee?.label && !categories.some(item => item.id === fee.id)) categories.push(fee);
    });
    feeCategories = categories;
  } catch (err) {
    console.error("Fee categories load error:", err);
  }
  renderFeeInputs();
}

const feeCategoriesReady = loadFeeCategories();

// Load fee template into Part B when a class is selected
async function loadFeeTemplateForB(className) {
  await feeCategoriesReady;
  document.querySelectorAll('.fee-tick').forEach(cb => {
    cb.checked = false;
    const input = $(cb.dataset.target);
    if (input) { input.value = ''; input.classList.add('hidden'); }
  });
  if (!className) return;
  try {
    const docSnap = await getDoc(doc(db, 'feeTemplates', className));
    if (docSnap.exists()) {
      const saved = docSnap.data().fees || {};
      feeCategories.forEach(f => {
        const cb = document.querySelector(`.fee-tick[value="${f.id}"]`);
        const inp = $(`amt-${f.id}`);
        if (saved[f.id] && cb && inp) {
          cb.checked = true;
          inp.value = saved[f.id];
          inp.classList.remove('hidden');
        }
      });
    }
  } catch (err) { console.error('Template load error:', err); }
}

const bClassEl = $('b-class');
if (bClassEl) {
  bClassEl.addEventListener('change', (e) => loadFeeTemplateForB(e.target.value));
}

if($("btn-save-b")) $("btn-save-b").onclick = async () => {
  await feeCategoriesReady;
  const btn = $("btn-save-b");
  const msg = $("msg-b");
  const data = {
    studentName: formatStudentName($("b-name").value),
    className: $("b-class").value,
    date: $("b-date").value,
    is4thChild: is4thChildActive,
    fees: {}, feeLabels: {}, totalAmount: 0, balance: 0, timestamp: serverTimestamp(), verified: false
  };

  if(!data.studentName || !data.className) return alert("Name/Class missing");
  
  document.querySelectorAll('.fee-tick:checked').forEach(cb => {
    const amt = Number($(cb.dataset.target).value) || 0;
    if(amt > 0) {
      data.fees[cb.value] = amt;
      data.feeLabels[cb.value] = feeCategories.find(fee => fee.id === cb.value)?.label || cb.value;
      data.totalAmount += amt;
    }
  });

  btn.disabled = true; btn.textContent = "SAVING...";
  try {
    await addDoc(collection(db, "cashAnalysis"), data);
    if (msg) msg.innerText = "✅ Saved to Cash Analysis!";
    if ($("b-name")) $("b-name").value = "";
    document.querySelectorAll('.fee-tick').forEach(cb => { cb.checked = false; const inp = $(cb.dataset.target); if(inp) inp.classList.add('hidden'); });
    // Reset 4th child button
    is4thChildActive = false;
    if (btn4thChild) {
      btn4thChild.classList.remove('bg-purple-300', 'text-white', 'border-purple-600');
      btn4thChild.classList.add('bg-white', 'text-purple-700');
    }
    // Refresh cash analysis table and filters
    if (typeof loadCashAnalysis === 'function') loadCashAnalysis();
  } catch(e) { 
    console.error(e);
    if (msg) msg.innerText = "Error: " + e.message;
  }
  finally { btn.disabled = false; btn.textContent = "SAVE TO CASH ANALYSIS (PART B)"; }
};

/* =========================================================
   VERIFY & DELETE FEATURES FOR CASH ANALYSIS
========================================================= */

const ADMIN_PASSCODE = "Adminuser11";
let pendingAction = null; // { action: 'delete'|'verify'|'verifyClass', recordId, className }

// Passcode modal functions
function showPasscodeModal(message, callback) {
  const modal = $("passcode-modal");
  const msgEl = $("modal-message");
  const input = $("passcode-input");
  const submitBtn = $("passcode-submit");
  const cancelBtn = $("passcode-cancel");
  
  msgEl.textContent = message;
  input.value = "";
  modal.classList.remove("hidden");
  input.focus();
  
  const handleSubmit = () => {
    const passcode = input.value.trim();
    if (passcode === ADMIN_PASSCODE) {
      modal.classList.add("hidden");
      callback(true);
    } else {
      alert("❌ Incorrect passcode. Try again.");
      input.value = "";
      input.focus();
    }
  };
  
  const handleCancel = () => {
    modal.classList.add("hidden");
    callback(false);
  };
  
  submitBtn.onclick = handleSubmit;
  cancelBtn.onclick = handleCancel;
  input.onkeypress = (e) => { if (e.key === "Enter") handleSubmit(); };
}

// Open action menu for individual record
window.openActionMenu = (recordId) => {
  const record = allCashAnalysisRecords.find(r => r.id === recordId);
  if (!record) return alert("Record not found");
  
  if (record.verified) {
    alert("❌ This record is already verified and cannot be modified.");
    return;
  }
  
  const modal = $("action-menu-modal");
  const title = $("action-menu-title");
  const verifyBtn = $("action-verify-btn");
  const deleteBtn = $("action-delete-btn");
  const backBtn = $("action-back-btn");
  
  title.textContent = `Actions for ${record.studentName}`;
  modal.classList.remove("hidden");
  
  // Clear previous event listeners by cloning
  const newVerifyBtn = verifyBtn.cloneNode(true);
  const newDeleteBtn = deleteBtn.cloneNode(true);
  const newBackBtn = backBtn.cloneNode(true);
  
  verifyBtn.parentNode.replaceChild(newVerifyBtn, verifyBtn);
  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
  backBtn.parentNode.replaceChild(newBackBtn, backBtn);
  
  // Add new event listeners
  newVerifyBtn.onclick = () => {
    modal.classList.add("hidden");
    showPasscodeModal("Enter passcode to verify this record:", (success) => {
      if (success) verifyRecord(recordId);
    });
  };
  
  newDeleteBtn.onclick = () => {
    modal.classList.add("hidden");
    const confirmDelete = confirm(`Delete record for ${record.studentName}?\n\nThis action cannot be undone.`);
    if (confirmDelete) deleteRecord(recordId);
  };
  
  newBackBtn.onclick = () => {
    modal.classList.add("hidden");
  };
};

// Delete a single record
async function deleteRecord(recordId) {
  try {
    const docRef = doc(db, "cashAnalysis", recordId);
    await updateDoc(docRef, { deleted: true, deletedAt: serverTimestamp() });
    
    // Remove from local array
    allCashAnalysisRecords = allCashAnalysisRecords.filter(r => r.id !== recordId);
    
    // Re-render and refresh filters
    populateCashAnalysisClassFilter();
    renderCashAnalysisTable();
    
    alert("✅ Record deleted successfully");
  } catch (e) {
    console.error("Delete error:", e);
    alert("Error deleting record: " + e.message);
  }
}

// Verify a single record
async function verifyRecord(recordId) {
  try {
    const docRef = doc(db, "cashAnalysis", recordId);
    await updateDoc(docRef, { verified: true, verifiedAt: serverTimestamp() });
    
    // Update local array
    const record = allCashAnalysisRecords.find(r => r.id === recordId);
    if (record) record.verified = true;
    
    // Re-render
    renderCashAnalysisTable();
    
    alert("✅ Record verified successfully");
  } catch (e) {
    console.error("Verify error:", e);
    alert("Error verifying record: " + e.message);
  }
}

// Verify entire class
async function verifyClass() {
  const className = $("cash-filter-class").value;
  if (!className) {
    alert("⚠️ Please select a class from the filter dropdown first.");
    return;
  }
  
  const recordsInClass = allCashAnalysisRecords.filter(r => r.className === className && !r.verified && !r.deleted);
  if (recordsInClass.length === 0) {
    alert(`⚠️ No unverified records in ${className}.`);
    return;
  }
  
  const confirmMsg = `Verify all ${recordsInClass.length} unverified record(s) in ${className}?\n\nNew data added to this class later will need to be verified again.`;
  if (!confirm(confirmMsg)) return;
  
  showPasscodeModal("Enter passcode to verify all records in this class:", async (success) => {
    if (!success) return;
    
    try {
      // Batch update all unverified records in this class
      const batch = writeBatch(db);
      recordsInClass.forEach(record => {
        const docRef = doc(db, "cashAnalysis", record.id);
        batch.update(docRef, { verified: true, verifiedAt: serverTimestamp() });
        record.verified = true; // Update local
      });
      await batch.commit();
      
      // Re-render
      renderCashAnalysisTable();
      
      alert(`✅ ${recordsInClass.length} record(s) verified successfully`);
    } catch (e) {
      console.error("Batch verify error:", e);
      alert("Error verifying class: " + e.message);
    }
  });
}

// Show/hide verify class button based on filter selection
window.addEventListener('DOMContentLoaded', () => {
  const verifyClassBtn = $("verify-class-btn");
  const classFilter = $("cash-filter-class");
  
  if (classFilter && verifyClassBtn) {
    classFilter.addEventListener('change', (e) => {
      verifyClassBtn.style.display = e.target.value ? 'inline-block' : 'none';
    });
    
    verifyClassBtn.addEventListener('click', verifyClass);
  }
  
  // Close modals when clicking outside
  const passcodeModal = $("passcode-modal");
  if (passcodeModal) {
    passcodeModal.addEventListener('click', (e) => {
      if (e.target === passcodeModal) passcodeModal.classList.add('hidden');
    });
  }
  
  const actionMenuModal = $("action-menu-modal");
  if (actionMenuModal) {
    actionMenuModal.addEventListener('click', (e) => {
      if (e.target === actionMenuModal) actionMenuModal.classList.add('hidden');
    });
  }
});
