/* ==========================================
   DEVELOPER INVOICE GENERATOR (invoice.js)
   ========================================== */

function generateInvoice() {
    // 1. Get the total count from the global window object
    // (We will set this in admin.html)
    const totalStudents = window.globalTotalStudents || 0;
    
    // 2. Get the user inputs
    const rate = document.getElementById('inv-rate').value;
    const bank = document.getElementById('inv-bank').value;
    const accNum = document.getElementById('inv-acc-num').value;
    const accName = document.getElementById('inv-acc-name').value;

    // 3. Validation
    if (!rate || !bank || !accNum || !accName) {
        alert("Please fill in all invoice details (Rate, Bank, Account Number, and Name)!");
        return;
    }

    if (totalStudents === 0) {
        alert("Student count is 0. Please wait for the dashboard to load student data.");
        return;
    }

    const totalAmount = totalStudents * rate;
    const date = new Date().toLocaleDateString();

    // 4. Create the Invoice Window
    const win = window.open("", "", "width=900,height=800");
    
    if (!win) {
        alert("Popup blocked! Please allow popups for this website to see the invoice.");
        return;
    }

    win.document.write(`
        <html>
        <head>
            <title>Invoice - Portal Maintenance</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="p-10 bg-gray-100">
            <div class="max-w-3xl mx-auto bg-white shadow-xl border p-10 rounded-sm">
                <div class="flex justify-between items-start border-b-4 border-blue-700 pb-6 mb-8">
                    <div>
                        <h1 class="text-2xl font-black text-gray-800">${accName.toUpperCase()}</h1>
                        <p class="text-sm font-bold text-blue-600">Full-Stack Web Developer</p>
                    </div>
                    <div class="text-right">
                        <h2 class="text-4xl font-black text-gray-200 tracking-tighter uppercase">Invoice</h2>
                        <p class="text-sm font-bold mt-2">Date: ${date}</p>
                    </div>
                </div>

                <div class="mb-10">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-1">Bill To:</p>
                    <p class="font-black text-lg">The Management</p>
                    <p class="font-medium text-gray-700">Gloryland Foundation Academy</p>
                </div>

                <table class="w-full mb-10 text-left">
                    <thead>
                        <tr class="border-b-2 border-gray-800 text-xs uppercase tracking-widest">
                            <th class="py-3">Description</th>
                            <th class="py-3 text-center">Rate</th>
                            <th class="py-3 text-center">Quantity</th>
                            <th class="py-3 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody class="text-gray-700">
                        <tr class="border-b">
                            <td class="py-6">
                                <span class="font-bold block">Portal Maintenance & Usage</span>
                                <span class="text-xs text-gray-400">Software license fee per registered child.</span>
                            </td>
                            <td class="py-6 text-center">₦${Number(rate).toLocaleString()}</td>
                            <td class="py-6 text-center">${totalStudents} students</td>
                            <td class="py-6 text-right font-black text-blue-700 text-lg">₦${totalAmount.toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="flex justify-between items-end">
                    <div class="bg-blue-50 p-5 rounded border border-blue-100">
                        <p class="text-[10px] font-black text-blue-400 uppercase mb-3 tracking-widest">Payment Destination</p>
                        <p class="text-sm"><strong>Bank:</strong> ${bank}</p>
                        <p class="text-sm font-bold"><strong>Account Name:</strong> ${accName}</p>
                        <p class="text-lg font-mono text-blue-800 mt-2 bg-white px-2 py-1 border rounded inline-block"><strong>${accNum}</strong></p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold text-gray-400 mb-1 uppercase">Amount Payable</p>
                        <p class="text-5xl font-black text-blue-700 tracking-tighter">₦${totalAmount.toLocaleString()}</p>
                    </div>
                </div>

                <div class="mt-20 pt-8 border-t text-center">
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                        This is a system-verified invoice generated based on student registrations in the school portal.
                    </p>
                </div>
            </div>
            <script>
                window.onload = () => { setTimeout(() => window.print(), 800); };
            <\/script>
        </body>
        </html>
    `);
    win.document.close();
}

// Attach the function to the button
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-print-invoice');
    if (btn) {
        btn.onclick = generateInvoice;
    }
});