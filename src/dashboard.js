document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('total-revenue')) return; // Exit if not on the dashboard page

    const totalRevenueEl = document.getElementById('total-revenue');
    const invoicesSentEl = document.getElementById('invoices-sent');
    const pendingAmountEl = document.getElementById('pending-amount');
    const topCustomerNameEl = document.getElementById('top-customer-name');
    const invoicesTable = document.getElementById('invoices-table');
    const revenueChartCanvas = document.getElementById('revenue-chart').getContext('2d');
    const searchInput = document.getElementById('invoice-search');

    // --- Modal Elements ---
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // Add event listener to the table for delegation
    invoicesTable.addEventListener('click', handleTableActions);
    searchInput.addEventListener('input', handleSearch);
    modalCancelBtn.addEventListener('click', hideConfirmationModal);


    let revenueChart = null; // To hold the chart instance
    let allInvoices = []; // To store all invoices from localStorage
    let confirmAction = null; // To store the function to run on modal confirmation

    function loadDashboardData() {
        displayCurrentDate();
        // Load invoices from localStorage
        const invoicesJSON = localStorage.getItem('billSphere_invoices');
        allInvoices = invoicesJSON ? JSON.parse(invoicesJSON) : [];

        // Sort invoices by ID (timestamp) descending to show newest first
        allInvoices.sort((a, b) => {
            return (Number(b.id) || 0) - (Number(a.id) || 0);
        });

        const invoices = allInvoices; // For initial load
        
        if (!invoices || invoices.length === 0) {
            showToast('No invoice data found. Create an invoice to get started!');
        }
        updateSummary(invoices);
        populateInvoicesTable(invoices);
        renderRevenueChart(invoices);
    }

    function displayCurrentDate() {
        const dateDisplayEl = document.getElementById('current-date-display');
        if (!dateDisplayEl) return;

        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const year = today.getFullYear();
        
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

        dateDisplayEl.textContent = `${day}/${month}/${year}, ${dayName}`;
    }

    function updateSummary(invoices) {
        const getAmount = (inv) => {
            if (typeof inv.grandTotal === 'number') return inv.grandTotal;
            if (inv.totals && inv.totals.grandTotal) {
                return parseFloat(inv.totals.grandTotal.replace(/[^0-9.-]+/g, '')) || 0;
            }
            return 0;
        };

        const totalRevenue = invoices
            .filter(inv => inv.status === 'Paid')
            .reduce((sum, inv) => sum + getAmount(inv), 0);

        const pendingAmount = invoices
            .filter(inv => inv.status !== 'Paid') // Any status other than 'Paid' is considered pending
            .reduce((sum, inv) => sum + getAmount(inv), 0);

        // Calculate Top Customer
        const customerTotals = {};
        invoices.forEach(inv => {
            const name = inv.buyer?.name || inv.customerName;
            if (name) {
                customerTotals[name] = (customerTotals[name] || 0) + getAmount(inv);
            }
        });

        let topCustomer = { name: 'N/A', amount: 0 };
        for (const [name, amount] of Object.entries(customerTotals)) {
            if (amount > topCustomer.amount) {
                topCustomer = { name, amount };
            }
        }

        // Update the DOM
        totalRevenueEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
        invoicesSentEl.textContent = invoices.length;
        pendingAmountEl.textContent = `₹${pendingAmount.toLocaleString('en-IN')}`;        
        
        // Truncate long customer names
        const topCustomerDisplayName = topCustomer.name.length > 20 ? `${topCustomer.name.substring(0, 18)}...` : topCustomer.name;
        topCustomerNameEl.textContent = topCustomerDisplayName;
        topCustomerNameEl.title = topCustomer.name; // Show full name on hover
    }

    function populateInvoicesTable(invoices) {
        if (!invoices || invoices.length === 0) {
            invoicesTable.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center;">No recent invoices.</td></tr></tbody>';
            if (searchInput.value) {
                invoicesTable.innerHTML = '<tbody><tr><td colspan="4" style="text-align:center;">No invoices match your search.</td></tr></tbody>';
            }
            return;
        }

        let tableHTML = `
            <thead>
                <tr>
                    <th>Date Created</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
        `;
        invoices.forEach(inv => {
            const currentStatus = inv.status === 'Paid' ? 'Paid' : getStatusFromDueDate(inv.dueDate);
            const customerName = inv.buyer?.name || inv.customerName || 'N/A';
            const dateCreated = inv.date || inv.invoiceDate;
            const amount = typeof inv.grandTotal === 'number' ? inv.grandTotal : (inv.totals?.grandTotal ? parseFloat(inv.totals.grandTotal.replace(/[^0-9.-]+/g, '')) : 0);

            tableHTML += `
                <tr data-invoice-id="${inv.id}">
                    <td>${formatDisplayDate(dateCreated)}</td>
                    <td>${customerName}</td>
                    <td>₹${amount.toLocaleString('en-IN')}</td>
                    <td><span class="status ${currentStatus.toLowerCase()}">${currentStatus}</span></td>
                    <td class="actions-cell">
                        <button class="btn btn-sm btn-primary edit-btn">Edit</button>
                        <button class="btn btn-sm btn-success download-pdf-btn">PDF</button>
                        <button class="btn btn-sm btn-danger delete-btn">Delete</button>
                    </td>
                </tr>
            `;
        });
        tableHTML += '</tbody>';
        invoicesTable.innerHTML = tableHTML;
    }

    function renderRevenueChart(invoices) {
        if (revenueChart) {
            revenueChart.destroy(); // Destroy the old chart instance before creating a new one
        }

        const monthlyRevenue = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        invoices.forEach(inv => {
            const dateStr = inv.date || inv.invoiceDate;
            if (inv.status === 'Paid' && dateStr) {
                const month = new Date(dateStr).getMonth(); // 0-11
                const amount = typeof inv.grandTotal === 'number' ? inv.grandTotal : (inv.totals?.grandTotal ? parseFloat(inv.totals.grandTotal.replace(/[^0-9.-]+/g, '')) : 0);
                monthlyRevenue[month] = (monthlyRevenue[month] || 0) + amount;
            }
        });

        const chartLabels = monthNames;
        const chartData = chartLabels.map((_, index) => monthlyRevenue[index] || 0);

        const gradient = revenueChartCanvas.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(54, 162, 235, 0.6)');
        gradient.addColorStop(1, 'rgba(54, 162, 235, 0)');

        revenueChart = new Chart(revenueChartCanvas, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Revenue',
                    data: chartData,
                    backgroundColor: gradient, // Use gradient for fill
                    fill: true,
                    tension: 0.4, // Makes the line smooth
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                }]
            },
            options: {
                scales: { y: { beginAtZero: true } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function handleTableActions(event) {
        const target = event.target;
        const invoiceRow = target.closest('tr');
        if (!invoiceRow) return;

        const invoiceId = invoiceRow.dataset.invoiceId;
        if (!invoiceId) return;

        if (target.classList.contains('edit-btn')) {
            // Set the ID in sessionStorage and redirect to the editor
            sessionStorage.setItem('editInvoiceId', invoiceId);
            window.location.href = './index.html';
        } else if (target.classList.contains('delete-btn')) {
            // Confirm and delete the invoice
            showConfirmationModal(
                'Confirm Deletion',
                `Are you sure you want to delete invoice ${invoiceId}?`,
                () => deleteInvoice(invoiceId)
            );
        } else if (target.classList.contains('download-pdf-btn')) {
            // Download the invoice as a PDF
            target.disabled = true;
            target.textContent = '...';
            downloadInvoiceAsPdf(invoiceId).finally(() => { target.disabled = false; target.textContent = 'PDF'; });
        }
    }

    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();

        if (!searchTerm) {
            populateInvoicesTable(allInvoices); // Show all if search is empty
            return;
        }

        const filteredInvoices = allInvoices.filter(inv => {
            const name = inv.buyer?.name || inv.customerName || '';
            const no = inv.invoiceNo || inv.invoiceNumber || '';
            return (name.toLowerCase().includes(searchTerm) || no.toLowerCase().includes(searchTerm));
        });

        populateInvoicesTable(filteredInvoices);
    }

    function showConfirmationModal(title, message, onConfirm) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmAction = onConfirm; // Store the action to run on confirm

        modalConfirmBtn.onclick = () => {
            if (typeof confirmAction === 'function') {
                confirmAction();
            }
            hideConfirmationModal();
        };

        confirmationModal.classList.add('visible');
    }

    function hideConfirmationModal() {
        confirmationModal.classList.remove('visible');
        confirmAction = null; // Clear the action
        modalConfirmBtn.onclick = null; // Clean up the event handler
    }

    function deleteInvoice(invoiceId) {
        const invoices = JSON.parse(localStorage.getItem('billSphere_invoices') || '[]');
        const updatedInvoices = invoices.filter(inv => String(inv.id) !== String(invoiceId));
        localStorage.setItem('billSphere_invoices', JSON.stringify(updatedInvoices));
        showToast('Invoice deleted successfully!');
        loadDashboardData(); // Refresh the dashboard
    }

    async function downloadInvoiceAsPdf(invoiceId) {
        const invoiceToDownload = allInvoices.find(inv => String(inv.id) === String(invoiceId));
        if (!invoiceToDownload) {
            showToast('Error: Invoice data not found.');
            return;
        }

        const settings = await getSettings();
        const invoiceElement = createInvoicePreviewElement(invoiceToDownload, settings);

        // Sanitize customer name for the filename
        const customerName = invoiceToDownload.buyer?.name || invoiceToDownload.customerName || 'invoice';
        const safeCustomerName = customerName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${invoiceToDownload.invoiceNo || invoiceToDownload.invoiceNumber || 'INV'}_${safeCustomerName}.pdf`;

        // Options for html2pdf.js to ensure single-page output
        const opt = {
            margin:       [0.5, 0.5, 0.5, 0.5], // top, left, bottom, right in inches
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 1.9, useCORS: true, logging: false }, // Reduced scale to fit content
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }, // Using 'letter' format
            pagebreak:    { mode: ['avoid-all'] } // Avoid breaking elements across pages
        };

        await html2pdf().from(invoiceElement).set(opt).save();
    }

    // --- Helper functions copied from script.js for PDF generation ---

    function createInvoicePreviewElement(invoiceData, settings) {
        const element = document.createElement('div');
        element.id = 'invoice-paper';

        // Normalize data fields
        const customerName = invoiceData.buyer?.name || invoiceData.customerName || 'N/A';
        const customerAddress = invoiceData.buyer?.address || invoiceData.customerAddress || '';
        const invoiceNo = invoiceData.invoiceNo || invoiceData.invoiceNumber || 'N/A';
        const invoiceDate = invoiceData.date || invoiceData.invoiceDate;
        
        // Helper to display amounts (handles both number and pre-formatted string)
        const displayMoney = (val) => {
            if (typeof val === 'string') return val;
            return formatCurrency(val || 0);
        };

        const status = invoiceData.status === 'Paid' ? 'Paid' : getStatusFromDueDate(invoiceData.dueDate);
        const stampHTML = `<div class="invoice-stamp stamp-${status.toLowerCase()}">${status}</div>`;

        // Inject CSS directly into the element to ensure PDF renders correctly
        const styles = `
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
                :root { --primary-color: #6c5ce7; }
                #invoice-paper {
                    background: white;
                    width: 100%;
                    padding: 10mm;
                    box-sizing: border-box;
                    font-family: 'Inter', sans-serif;
                    font-size: 9.5pt;
                    color: #000;
                    position: relative;
                }
                .invoice-layout { display: flex; flex-direction: column; gap: 20px; }
                .invoice-header-section { display: flex; justify-content: space-between; margin-bottom: 10px; }
                .header-content-left { flex: 2; }
                .header-content-right { flex: 1; display: flex; justify-content: flex-end; align-items: flex-start; }
                .doc-title { font-size: 20pt; font-weight: 700; color: var(--primary-color); margin: 0; text-transform: uppercase; line-height: 1.2; }
                .doc-subtitle { font-size: 10pt; color: #666; margin: 0 0 5px 0; }
                .meta-grid { display: grid; grid-template-columns: auto 1fr; gap: 8px 5px; max-width: 300px; }
                .meta-row { display: contents; }
                .meta-label { font-weight: 600; color: #555; }
                .logo-wrapper img { width: 80px; height: 80px; object-fit: cover; border-radius: 50%; }
                .party-info-section { display: flex; gap: 30px; margin-bottom: 10px; }
                .party-card { flex: 1; border: 1px solid #eee; padding: 10px; border-radius: 6px; background: #fcfcfc; border-top: 3px solid var(--primary-color); }
                .party-title { margin: 0 0 10px 0; font-size: 9pt; text-transform: uppercase; color: var(--primary-color); font-weight: 700; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .party-details h3 { margin: 0 0 5px 0; font-size: 11pt; font-weight: 700; text-transform: uppercase; }
                .party-meta { margin-top: 10px; font-size: 9pt; }
                .pm-row { display: flex; gap: 5px; margin-bottom: 2px; }
                .items-section { margin-top: 10px; }
                .generic-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .generic-table th { background: #eef2ff; color: var(--primary-color); padding: 8px; text-align: left; font-weight: 700; font-size: 9pt; border: 1px solid #c7d2fe; }
                .generic-table td { padding: 4px; border: 1px solid #e0e0e0; vertical-align: middle; word-wrap: break-word; word-break: break-word; }
                .summary-section { display: flex; gap: 30px; margin-top: 15px; }
                .summary-left { flex: 6; }
                .summary-right { flex: 4; }
                .amount-words-box { margin-bottom: 15px; font-style: italic; background: #eef2ff; color: var(--primary-color); padding: 10px; border-radius: 4px; border: 1px solid #e0e7ff; }
                .bank-details-box, .terms-box { margin-bottom: 15px; }
                .bank-details-box h4, .terms-box h4 { font-size: 9pt; text-transform: uppercase; color: var(--primary-color); margin: 0 0 5px 0; }
                .totals-grid { background: #fcfcfc; padding: 15px; border-radius: 6px; border: 1px solid #eee; }
                .t-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                .grand-total-row { border-top: 2px solid #ddd; padding: 10px; margin-top: 8px; font-weight: 700; font-size: 12pt; background-color: var(--primary-color); color: #fff; border-radius: 4px; }
                .balance-due-row { font-weight: 800; font-size: 14pt; border-top: 1px dashed #ccc; padding-top: 5px; color: #c0392b; }
                .signature-box { margin-top: 20px; text-align: right; }
                .sign-space { height: 30px; }
                .invoice-stamp { position: absolute; top: 20px; right: 160px; left: auto; width: max-content; white-space: nowrap; font-size: 2rem; font-weight: 700; text-transform: uppercase; border: 3px solid; padding: 5px 15px; transform: rotate(-15deg); opacity: 1; z-index: 9999; color: #555; border-color: #555; }
                .stamp-paid { color: #27ae60; border-color: #27ae60; }
                .stamp-due { color: #f39c12; border-color: #f39c12; }
                .stamp-overdue { color: #c0392b; border-color: #c0392b; }
            </style>
        `;

        element.innerHTML = `
            ${styles}
            <div class="invoice-layout">
                <!-- Header Section -->
                <header class="invoice-header-section">
                    <div class="header-content-left">
                        <h1 class="doc-title">TAX INVOICE</h1>
                        <p class="doc-subtitle">Original for Recipient</p>
                        <div class="meta-grid">
                            <div class="meta-row">
                                <span class="meta-label">Invoice No:</span>
                                <div class="meta-value-group">
                                    <span>${invoiceNo}</span>
                                </div>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Date:</span>
                                <span>${formatDisplayDate(invoiceDate)}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Due Date:</span>
                                <span>${formatDisplayDate(invoiceData.dueDate)}</span>
                            </div>
                            <div class="meta-row">
                                <span class="meta-label">Status:</span>
                                <span>${status}</span>
                            </div>
                        </div>
                    </div>
                    <div class="header-content-right">
                        <div class="logo-wrapper">
                            <img src="${settings.companyLogoUrl || '../build/bill_sphere.png'}" alt="Logo" style="width: 80px; height: 80px; object-fit: cover; border-radius: 50%;">
                        </div>
                    </div>
                </header>

                <!-- Party Information Section -->
                <section class="party-info-section">
                    <div class="party-card left-card">
                        <h4 class="party-title">Bill From</h4>
                        <div class="party-details">
                            <h3 style="text-transform: uppercase;">${settings.companyName || 'Your Company Name'}</h3>
                            <div>${(settings.companyAddress || '123 Business Rd, Business City, 12345').replace(/\n/g, '<br>')}</div>
                            <div class="party-meta">
                                <div class="pm-row"><span>GSTIN/Tax ID:</span> <span>${settings.companyGst || 'YOURGSTIN12345'}</span></div>
                                <div class="pm-row"><span>Phone:</span> <span>${settings.companyPhone || ''}</span></div>
                                <div class="pm-row"><span>Email:</span> <span>${settings.companyEmail || ''}</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="party-card right-card">
                        <h4 class="party-title">Bill To</h4>
                        <div class="party-details">
                            <h3 style="text-transform: uppercase;">${customerName}</h3>
                            <div>${(customerAddress).replace(/\n/g, '<br>')}</div>
                            <div class="party-meta">
                                <div class="pm-row"><span>Place of Supply:</span> <span>${invoiceData.placeOfSupply || 'State/Country'}</span></div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Items Section -->
                <section class="items-section">
                    <table class="generic-table">
                        <thead>
                            <tr>
                                <th>Item Description</th>
                                <th style="width: 70px;">Qty</th>
                                <th style="width: 100px;">Rate</th>
                                <th style="width: 120px;">Tax (%)</th>
                                <th style="width: 120px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoiceData.items.map(item => `
                                <tr>
                                    <td>${(item.description || '').toUpperCase()}</td>
                                    <td style="text-align: center;">${item.quantity}</td>
                                    <td style="text-align: center;">${formatCurrency(item.rate)}</td>
                                    <td style="text-align: center;">${item.gstRate || 0}%</td>
                                    <td style="text-align: right;">${formatCurrency(item.quantity * item.rate)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </section>

                <!-- Summary Section -->
                <section class="summary-section">
                    <div class="summary-left">
                        <div class="amount-words-box">
                            <span class="aw-label">Amount in Words:</span>
                            <p class="aw-value">${invoiceData.totals?.amountInWords || 'Zero Only'}</p>
                        </div>
                        <div class="bank-details-box">
                            <h4>Bank Details</h4>
                            <div class="bank-grid">
                                <div class="b-row"><span>Bank:</span> <span>${settings.bankName || 'N/A'}</span></div>
                                <div class="b-row"><span>A/c No:</span> <span>${settings.accountNumber || 'N/A'}</span></div>
                                <div class="b-row"><span>IFSC/SWIFT:</span> <span>${settings.ifscCode || 'N/A'}</span></div>
                                <div class="b-row"><span>Payee ID:</span> <span>${settings.payeeId || 'N/A'}</span></div>
                            </div>
                        </div>
                        <div class="terms-box">
                            <h4>Terms & Conditions</h4>
                            <ul>
                                <li>Payment due within 15 days.</li>
                                <li>ENSURE TIMELY PAYMENT.</li>
                            </ul>
                        </div>
                    </div>
                    <div class="summary-right">
                        <div class="totals-grid">
                            <div class="t-row">
                                <span class="t-label">Subtotal</span>
                                <span class="t-value">${displayMoney(invoiceData.totals?.subtotal || invoiceData.subtotal)}</span>
                            </div>
                            <div class="t-row">
                                <span class="t-label">Total Tax</span>
                                <span class="t-value">${displayMoney(invoiceData.totals?.tax || invoiceData.gstAmount)}</span>
                            </div>
                            <div class="t-row grand-total-row">
                                <span class="t-label">Grand Total</span>
                                <span class="t-value">${displayMoney(invoiceData.totals?.grandTotal || invoiceData.grandTotal)}</span>
                            </div>
                            <div class="t-row">
                                <span class="t-label">Late Fees</span>
                                <span class="t-value">${formatCurrency(parseFloat(invoiceData.totals?.amountPaid || 0))}</span>
                            </div>
                            <div class="t-row balance-due-row">
                                <span class="t-label">Balance Due</span>
                                <span class="t-value">${displayMoney(invoiceData.totals?.balanceDue || invoiceData.totals?.grandTotal || invoiceData.grandTotal)}</span>
                            </div>
                        </div>
                        <div class="signature-box">
                            <div class="sign-space"></div>
                            <p>Authorized Signatory</p>
                        </div>
                    </div>
                </section>
            </div>
            ${stampHTML}
        `;
        return element;
    }

    async function getSettings() {
        const settingsJSON = localStorage.getItem('settings');
        return settingsJSON ? JSON.parse(settingsJSON) : {};
    }

    function getStatusFromDueDate(dueDate) {
        if (!dueDate) return 'Due';
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date
        return parseISODate(dueDate) < today ? 'Overdue' : 'Due';
    }

    function showToast(message) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Show the toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 100); // Small delay to ensure CSS transition works

        // Hide and remove the toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide'); // Add hide class for exit animation
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 3000);
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    }

    function formatDisplayDate(isoDate) {
        if (!isoDate || typeof isoDate !== 'string') return 'N/A';
        const parts = isoDate.split('-');
        if (parts.length !== 3) return isoDate; // Return original if format is unexpected
        const [year, month, day] = parts;
        return `${day}-${month}-${year}`;
    }

    function parseISODate(isoDate) {
        if (!isoDate || typeof isoDate !== 'string') return null;
        const parts = isoDate.split('-');
        if (parts.length !== 3) return null;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return new Date(year, month, day);
    }

    loadDashboardData();
});