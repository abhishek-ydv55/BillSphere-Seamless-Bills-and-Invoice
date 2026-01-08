document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    let confirmAction = null; // To store the function to run on confirmation (though not used on this page)
    let currentInvoiceData = null; // To store invoice data for the preview modal

    // --- Main Initialization ---
    // Only initialize the specific part of the app that is relevant.
    if (document.getElementById('billsphere-generator')) {
        initGeneratorPage(); // Handles invoice creation/editing logic
    }

    // =================================================================
    // INVOICE GENERATOR PAGE LOGIC
    // =================================================================
    function initGeneratorPage() {
        // --- DOM Elements ---
        const addItemBtn = document.getElementById('add-item-btn');
        const markAsPaidBtn = document.getElementById('mark-as-paid-btn');
        const saveInvoiceBtn = document.getElementById('save-invoice-btn');
        const itemsTable = document.getElementById('items-table');
        const companyLogoUploadInput = document.getElementById('company-logo-upload');
        const editableSettingsFields = document.querySelectorAll('[contenteditable="true"][data-field]');
        const invoicePrefixInput = document.getElementById('invoice-prefix');
        const saveItemBtn = document.getElementById('modal-save-item-btn');
        const cancelItemBtn = document.getElementById('modal-cancel-item-btn');
        const modalItemRateInput = document.getElementById('modal-item-rate');
        const invoicePreviewModal = document.getElementById('invoice-preview-modal');
        const modalPrintBtn = document.getElementById('modal-print-btn');
        const modalConfirmSaveBtn = document.getElementById('modal-confirm-save-btn');
        const modalDownloadPdfBtn = document.getElementById('modal-download-pdf-btn');
        const modalClosePreviewBtn = document.getElementById('modal-close-preview-btn');
        const modalMarkPaidBtn = document.getElementById('modal-mark-paid-btn');
        const amountPaidInput = document.getElementById('amount-paid');
        const dueDateInput = document.getElementById('due-date');

        // --- Event Listeners ---
        addItemBtn.addEventListener('click', showAddItemModal);
        markAsPaidBtn.addEventListener('click', handleMarkAsPaid);
        saveInvoiceBtn.addEventListener('click', showInvoicePreview);
        itemsTable.addEventListener('input', handleItemsTableChange);
        itemsTable.addEventListener('click', handleItemsTableClick);
        companyLogoUploadInput.addEventListener('change', handleLogoUpload);
        saveItemBtn.addEventListener('click', saveItemFromModal);
        invoicePrefixInput.addEventListener('blur', handleSettingsChange);
        cancelItemBtn.addEventListener('click', hideAddItemModal);
        if (amountPaidInput) {
            amountPaidInput.addEventListener('input', updateTotals);
        }
        modalItemRateInput.addEventListener('focus', (event) => {
            event.target.select();
        });
        if (modalPrintBtn) {
            modalPrintBtn.addEventListener('click', printInvoice);
        }
        if (modalConfirmSaveBtn) {
            modalConfirmSaveBtn.addEventListener('click', confirmAndSaveInvoice);
        }
        if (modalDownloadPdfBtn) {
            modalDownloadPdfBtn.addEventListener('click', downloadAsPdf);
        }
        if (modalClosePreviewBtn) {
            modalClosePreviewBtn.addEventListener('click', () => {
                invoicePreviewModal.classList.remove('visible');
                invoicePreviewModal.style.display = 'none';
            });
        }
        if (modalMarkPaidBtn) {
            modalMarkPaidBtn.addEventListener('click', handleMarkAsPaid);
        }
        if (dueDateInput) {
            dueDateInput.addEventListener('change', () => {
                const statusEl = document.querySelector('.meta-value');
                if (statusEl && statusEl.innerText !== 'Paid') {
                    statusEl.innerText = getStatusFromDueDate(dueDateInput.value);
                }
            });
        }

        editableSettingsFields.forEach(field => {
            field.addEventListener('blur', handleSettingsChange);
            field.addEventListener('focus', selectAllTextOnFocus); // Add this line
        });

        // --- Initial Setup ---
        loadSettings();
        displayCurrentDate();
        loadInvoiceForEditing();
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

    async function loadInvoiceForEditing() {
        // Using sessionStorage to pass the ID for editing, as it's temporary for one session.
        const invoiceIdToEdit = sessionStorage.getItem('editInvoiceId');
        if (invoiceIdToEdit) {
            const invoices = await getInvoices();
            const invoiceToEdit = invoices.find(inv => String(inv.id) === String(invoiceIdToEdit));
            if (invoiceToEdit) {
                populateFormWithData(invoiceToEdit);
            }
            // Clean up after loading
            sessionStorage.removeItem('editInvoiceId');
        } else {
            setDefaultDates(); // Only set default dates for a new invoice
        }
    }

    // All functions below are scoped to the Generator Page

    function handleMarkAsPaid() {
        // Create a temporary data object if one doesn't exist (for new invoices)
        if (!currentInvoiceData) {
            currentInvoiceData = {};
        }

        const markAsPaidBtn = document.getElementById('mark-as-paid-btn');
        const isPaid = markAsPaidBtn.textContent === 'Paid';
        const statusEl = document.querySelector('.meta-value');

        if (isPaid) {
            // Revert to Pending
            const dueDate = document.getElementById('due-date').value;
            const newStatus = getStatusFromDueDate(dueDate);
            currentInvoiceData.status = newStatus;
            markAsPaidBtn.textContent = 'Mark as Paid';
            removeStampFromInvoicePaper();
            
            if (statusEl) {
                statusEl.innerText = newStatus;
            }
        } else {
            // Mark as Paid
            currentInvoiceData.status = 'Paid';
            markAsPaidBtn.textContent = 'Paid';
            addStampToInvoicePaper('Paid');
            
            if (statusEl) {
                statusEl.innerText = 'Paid';
            }
        }
    }

    function showAddItemModal() {
        toggleModal('add-item-modal', true);
    }

    function hideAddItemModal() {
        // Clear the form for the next use
        document.getElementById('modal-item-description').value = '';
        document.getElementById('modal-item-hsn').value = '';
        document.getElementById('modal-item-quantity').value = '1';
        document.getElementById('modal-item-rate').value = '0.00';
        document.getElementById('modal-item-gst').value = '18'; // Reset GST to default
        toggleModal('add-item-modal', false);
    }

    function saveItemFromModal() {
        const description = document.getElementById('modal-item-description').value;
        const hsn = document.getElementById('modal-item-hsn').value;
        const quantity = parseFloat(document.getElementById('modal-item-quantity').value) || 1;
        const rate = parseFloat(document.getElementById('modal-item-rate').value) || 0;
        const gstRate = parseFloat(document.getElementById('modal-item-gst').value) || 0;

        addItemRow(description, quantity, rate, gstRate, hsn);
        hideAddItemModal();
    }

    function addItemRow(description = '', quantity = 1, rate = 0, gstRate = 18, hsn = '') {
        const invoiceItemsBody = document.getElementById('invoice-items-body');
        if (!invoiceItemsBody) return;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="item-desc"><textarea placeholder="Item description" rows="1">${description}</textarea></td>
            <td class="item-hsn"><input type="text" value="${hsn}" placeholder="HSN"></td>
            <td class="item-qty"><input type="number" value="${quantity}" min="0"></td>
            <td class="item-rate"><input type="number" value="${rate}" step="0.01" min="0"></td>
            <td class="item-gst"><input type="number" value="${gstRate !== undefined && gstRate !== null ? gstRate : 18}" step="0.01" min="0"></td>
            <td class="item-amount">₹0.00</td>
            <td class="item-remove"><button class="remove-item-btn">&times;</button></td>
        `;
        invoiceItemsBody.appendChild(row);
        updateTotals();
    }

    function populateFormWithData(invoice) {
        // Populate main fields
        // Handle both old structure (flat) and new structure (nested)
        const buyerName = invoice.buyer ? invoice.buyer.name : invoice.customerName;
        const buyerAddr = invoice.buyer ? invoice.buyer.address : invoice.customerAddress;
        
        document.getElementById('customer-name').value = buyerName || '';
        document.getElementById('customer-address').value = buyerAddr || '';
        
        // Invoice Meta
        document.getElementById('invoice-date').value = invoice.date || invoice.invoiceDate || '';
        document.getElementById('due-date').value = invoice.dueDate || '';
        document.getElementById('buyers-order-detail').value = invoice.buyersOrderDetail || '';

        // Populate items
        const invoiceItemsBody = document.getElementById('invoice-items-body');
        invoiceItemsBody.innerHTML = ''; // Clear existing items
        invoice.items.forEach(item => { 
            addItemRow(item.description, item.quantity, item.rate, item.gstRate, item.hsn);
        });

        // Store the full data object so we can update it on save
        currentInvoiceData = invoice;

        // Show "Mark as Paid" button if the invoice is not already paid
        const markAsPaidBtn = document.getElementById('mark-as-paid-btn');
        if (invoice.status === 'Paid') {
            markAsPaidBtn.disabled = false;
            markAsPaidBtn.textContent = 'Paid';
            addStampToInvoicePaper('Paid');
            const statusEl = document.querySelector('.meta-value');
            if(statusEl) statusEl.innerText = 'Paid';
        } else {
            markAsPaidBtn.disabled = false;
            markAsPaidBtn.textContent = 'Mark as Paid';
            const statusEl = document.querySelector('.meta-value');
            if(statusEl) statusEl.innerText = getStatusFromDueDate(invoice.dueDate);
        }

        const amountPaidInput = document.getElementById('amount-paid');
        if (amountPaidInput) {
            amountPaidInput.value = (invoice.totals && invoice.totals.amountPaid) ? invoice.totals.amountPaid : 0;
        }

        if (invoice.totals && invoice.totals.amountInWords) {
            const awEl = document.querySelector('.aw-value');
            if (awEl) awEl.innerText = invoice.totals.amountInWords;
        }

        // Restore Terms & Conditions
        const termsTitle = document.querySelector('.terms-box h4');
        const termsList = document.querySelector('.terms-box ul');
        if (invoice.terms) {
            if (termsTitle) termsTitle.innerText = invoice.terms.title || 'Terms & Conditions';
            if (termsList) termsList.innerHTML = invoice.terms.content || '';
        } else {
            if (termsTitle) termsTitle.innerText = 'Terms & Conditions';
            if (termsList) termsList.innerHTML = '<li>ENSURE TIMELY PAYMENT</li><li>E. & O.E.</li>';
        }

        // The 'Save Invoice' button will now update this existing invoice
        document.getElementById('save-invoice-btn').textContent = 'Update Invoice';
    }

    function handleItemsTableClick(e) {
        if (e.target.classList.contains('remove-item-btn')) {
            e.target.closest('tr').remove();
            updateTotals();
        }
    }

    function handleItemsTableChange(e) {
        if (e.target.tagName === 'INPUT') {
            updateTotals();
        }
    }

    function updateTotals() {
        let subtotal = 0;
        let totalGst = 0;
        const invoiceItemsBody = document.getElementById('invoice-items-body');
        if (!invoiceItemsBody) return;

        const subtotalEl = document.getElementById('subtotal');
        const gstAmountEl = document.getElementById('gst-amount');
        const grandTotalEl = document.getElementById('grand-total');
        const amountPaidInput = document.getElementById('amount-paid');
        const balanceDueEl = document.getElementById('balance-due');
        const rows = invoiceItemsBody.querySelectorAll('tr');

        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty input').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate input').value) || 0;
            const amount = qty * rate;
            const gstRate = parseFloat(row.querySelector('.item-gst input').value) || 0;
            const gstAmountForItem = amount * (gstRate / 100);
            row.querySelector('.item-amount').textContent = formatCurrency(amount);
            subtotal += amount;
            totalGst += gstAmountForItem;
        });

        const grandTotal = subtotal + totalGst;
        
        let amountPaid = 0;
        if (amountPaidInput) {
            amountPaid = parseFloat(amountPaidInput.value) || 0;
        }
        const balanceDue = grandTotal - amountPaid;

        subtotalEl.textContent = formatCurrency(subtotal);
        gstAmountEl.textContent = formatCurrency(totalGst);
        grandTotalEl.textContent = formatCurrency(grandTotal);
        if (balanceDueEl) {
            balanceDueEl.textContent = formatCurrency(balanceDue);
        }
    }

    async function showInvoicePreview() {
        // 1. Scrape Data for Saving
        currentInvoiceData = scrapeInvoiceData();

        // 2. Generate Visual Preview (Clone DOM)
        const invoicePaper = document.getElementById('invoice-paper');
        const previewModal = document.getElementById('invoice-preview-modal');
        const previewContent = document.getElementById('preview-content');

        const clone = invoicePaper.cloneNode(true);
        clone.style.pointerEvents = 'none';

        // Remove elements that shouldn't be in the preview/PDF
        const elementsToRemove = clone.querySelectorAll('.logo-upload-trigger, input[type="file"], .action-col, .item-remove, #add-item-btn');
        elementsToRemove.forEach(el => el.remove());

        // Replace inputs/textareas with text nodes for perfect PDF rendering
        const originalInputs = invoicePaper.querySelectorAll('input:not([type="file"]), textarea, select');
        const cloneInputs = clone.querySelectorAll('input, textarea, select');

        for (let i = 0; i < originalInputs.length; i++) {
            const original = originalInputs[i];
            const cloned = cloneInputs[i];
            
            if (original.type === 'hidden') continue;

            let displayValue = original.value;
            if (original.type === 'date' && displayValue) {
                displayValue = formatDisplayDate(displayValue);
            } else if (original.tagName === 'SELECT' && original.selectedIndex >= 0) {
                displayValue = original.options[original.selectedIndex].text;
            }

            const span = document.createElement('span');
            span.textContent = displayValue;
            if (!displayValue) span.innerHTML = '&nbsp;';

            // Styling to match input appearance
            if (original.tagName === 'TEXTAREA' || original.classList.contains('bare-input-lg')) {
                span.style.display = 'block';
                span.style.width = '100%';
            } else {
                span.style.display = 'inline-block';
                span.style.width = 'auto';
            }
            span.style.fontFamily = 'inherit';
            span.style.fontSize = 'inherit';
            span.style.color = 'inherit';
            span.style.background = 'transparent';
            
            // Copy styles from computed style
            const computedStyle = window.getComputedStyle(original);
            span.style.textAlign = computedStyle.textAlign;
            span.style.fontWeight = computedStyle.fontWeight;
            span.style.textTransform = computedStyle.textTransform;
            
            // Specific fix for textarea to preserve newlines
            if (original.tagName === 'TEXTAREA') {
                span.style.whiteSpace = 'pre-wrap';
                span.style.wordBreak = 'break-word';
            }

            if (cloned.parentNode) {
                cloned.parentNode.replaceChild(span, cloned);
            }
        }

        // Enlarge Balance Due in the preview
        const allElements = clone.getElementsByTagName('*');
        for (let el of allElements) {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
                if (el.textContent.trim() === 'Balance Due') {
                    if (el.parentElement) {
                        el.parentElement.style.fontSize = '14pt';
                        el.parentElement.style.fontWeight = '800';
                    }
                }
            }
        }

        // Ensure stamp is present in the preview based on status/date
        const status = currentInvoiceData.status === 'Paid' ? 'Paid' : getStatusFromDueDate(currentInvoiceData.dueDate);
        
        // Remove any existing stamp to ensure we set the correct one
        const existingStamp = clone.querySelector('.invoice-stamp');
        if (existingStamp) existingStamp.remove();

        const stamp = document.createElement('div');
        stamp.className = `invoice-stamp stamp-${status.toLowerCase()}`;
        stamp.textContent = status;
        clone.appendChild(stamp);

        previewContent.innerHTML = '';
        previewContent.appendChild(clone);

        // Show modal
        previewModal.classList.add('visible');
        previewModal.style.display = 'flex';
        
        // Ensure confirm button is visible
        const confirmSaveBtn = document.getElementById('modal-confirm-save-btn');
        if (confirmSaveBtn) confirmSaveBtn.style.display = 'inline-block';
    }

    function scrapeInvoiceData() {
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? (el.value || el.innerText) : '';
        };
        const getText = (id) => {
            const el = document.getElementById(id);
            return el ? el.innerText : '';
        };

        const items = [];
        document.querySelectorAll('#invoice-items-body tr').forEach(row => {
            items.push({
                description: row.querySelector('.item-desc textarea')?.value || '',
                hsn: row.querySelector('.item-hsn input')?.value || '',
                quantity: parseFloat(row.querySelector('.item-qty input')?.value) || 0,
                rate: parseFloat(row.querySelector('.item-rate input')?.value) || 0,
                gstRate: parseFloat(row.querySelector('.item-gst input')?.value) || 0,
                amount: row.querySelector('.item-amount')?.innerText || '0.00'
            });
        });

        return {
            id: currentInvoiceData?.id || String(Date.now()),
            invoiceNo: (getVal('invoice-prefix') || '') + (getVal('invoice-num') || ''),
            date: getVal('invoice-date'),
            dueDate: getVal('due-date'),
            buyersOrderDetail: getVal('buyers-order-detail'),
            status: document.querySelector('.meta-value')?.innerText || 'Pending',
            seller: {
                name: getText('company-name'),
                address: getText('company-address'),
                gst: getText('company-gst'),
                phone: getText('company-phone'),
                email: getText('company-email')
            },
            buyer: {
                name: getVal('customer-name'),
                address: getVal('customer-address')
            },
            items: items,
            totals: {
                subtotal: getText('subtotal'),
                tax: getText('gst-amount'),
                grandTotal: getText('grand-total'),
                amountPaid: getVal('amount-paid'),
                balanceDue: getText('balance-due'),
                amountInWords: document.querySelector('.aw-value')?.innerText
            },
            terms: {
                title: document.querySelector('.terms-box h4')?.innerText,
                content: document.querySelector('.terms-box ul')?.innerHTML
            }
        };
    }

    async function confirmAndSaveInvoice() {
        if (!currentInvoiceData) return;

        const invoices = await getInvoices();
        const existingInvoiceIndex = invoices.findIndex(inv => inv.id === currentInvoiceData.id);

        if (existingInvoiceIndex > -1) {
            // Update existing invoice
            invoices[existingInvoiceIndex] = currentInvoiceData;
        } else {
            // Add new invoice
            invoices.push(currentInvoiceData);
        }

        await saveInvoices(invoices);

        // Hide modal and reset form
        document.getElementById('invoice-preview-modal').classList.remove('visible');
        document.getElementById('invoice-preview-modal').style.display = 'none';
        await resetInvoiceForm();
        currentInvoiceData = null; // Clear stored data

        // Redirect to the dashboard to show the newly saved invoice
        window.location.href = 'dashboard.html';
    }

    function printInvoice() {
        window.print();
    }
    
    function downloadAsPdf() {
        const invoiceElement = document.querySelector('#preview-content #invoice-paper');
        if (!invoiceElement || !currentInvoiceData) {
            console.error('Preview content or invoice data not found for PDF generation.');
            return;
        }

        // Sanitize customer name for the filename
        const invNum = currentInvoiceData.invoiceNo || currentInvoiceData.invoiceNumber || 'INV';
        const custName = currentInvoiceData.buyer?.name || currentInvoiceData.customerName || 'customer';
        const safeCustomerName = custName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${invNum}_${safeCustomerName}.pdf`;

        // Add compact class for PDF generation
        invoiceElement.classList.add('compact-pdf');

        // Calculate dynamic height for a single long page
        // 1px approx 0.264583 mm (at 96 DPI)
        const contentHeightMm = invoiceElement.scrollHeight * 0.264583;
        // Add buffer for margins (approx 10mm top + 10mm bottom) and ensure min A4 height (297mm)
        const pageHeightMm = Math.max(contentHeightMm + 20, 297);

        const opt = {
            margin:       5, // units in mm
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false }, // Higher scale for better quality
            jsPDF:        { unit: 'mm', format: [210, pageHeightMm], orientation: 'portrait' }
        };

        // Use the library to generate the PDF
        html2pdf().from(invoiceElement).set(opt).save().then(() => {
            // Remove compact class
            invoiceElement.classList.remove('compact-pdf');
        });
    }

    async function resetInvoiceForm() {
        const customerNameInput = document.getElementById('customer-name');
        const customerAddressInput = document.getElementById('customer-address');
        const serviceUsedInput = document.getElementById('service-used');
        const invoiceNumInput = document.getElementById('invoice-num');
        const invoiceItemsBody = document.getElementById('invoice-items-body');
        const amountPaidInput = document.getElementById('amount-paid');
        const buyersOrderDetailInput = document.getElementById('buyers-order-detail');

        customerNameInput.value = '';
        customerAddressInput.value = '';
        invoiceNumInput.value = '';
        invoiceItemsBody.innerHTML = '';
        if (buyersOrderDetailInput) buyersOrderDetailInput.value = '';
        if (amountPaidInput) amountPaidInput.value = 0;
        updateTotals();
        removeStampFromInvoicePaper();
        
        // Reset Terms & Conditions
        const termsTitle = document.querySelector('.terms-box h4');
        const termsList = document.querySelector('.terms-box ul');
        if (termsTitle) termsTitle.innerText = 'Terms & Conditions';
        if (termsList) termsList.innerHTML = '<li>ENSURE TIMELY PAYMENT</li><li>E. & O.E.</li>';

        const markAsPaidBtn = document.getElementById('mark-as-paid-btn');
        markAsPaidBtn.disabled = false;
        markAsPaidBtn.textContent = 'Mark as Paid';

        document.getElementById('save-invoice-btn').textContent = 'Save Invoice';
        await setDefaultDates();
    }

    // Function to select all text in a contenteditable element on focus
    function selectAllTextOnFocus(event) {
        const element = event.target;
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
    async function handleSettingsChange(e) {
        const element = e.target;
        const field = e.target.dataset.field;
        if (!field) return;

        const value = element.tagName === 'INPUT' ? element.value : element.innerText;
        const settings = await getSettings();
        settings[field] = value;
        await saveSettings(settings);
    }
    async function handleLogoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const settings = await getSettings();
                settings.companyLogoUrl = reader.result;
                await saveSettings(settings);
                document.getElementById('company-logo-img').src = reader.result;
            } catch (error) {
                console.error('Failed to save logo:', error);
                alert('Failed to save logo. Storage might be full.');
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Allow re-uploading the same file
    }

    async function loadSettings() {
        const settings = await getSettings();
        updateSettingsUI(settings);
    }

    function updateSettingsUI(settings) {
        const companyLogoImg = document.getElementById('company-logo-img');
        const invoicePrefixInput = document.getElementById('invoice-prefix');

        document.getElementById('company-name').textContent = settings.companyName || 'Your Company Name';
        document.getElementById('company-address').innerText = settings.companyAddress || '123 Business Rd, Business City, 12345';
        document.getElementById('company-gst').textContent = settings.companyGst || 'YOURGSTIN12345';
        document.getElementById('bank-name').textContent = settings.bankName || 'Your Bank Name';
        document.getElementById('account-number').textContent = settings.accountNumber || '591820110000144';
        document.getElementById('ifsc-code').textContent = settings.ifscCode || 'BKID0005918';
        document.getElementById('payee-id').textContent = settings.payeeId || 'GDD/PAYEE/56295';
        document.getElementById('company-phone').textContent = settings.companyPhone || 'Your Phone Number';
        document.getElementById('company-email').textContent = settings.companyEmail || 'your.email@example.com';
        if (invoicePrefixInput) invoicePrefixInput.value = settings.invoicePrefix || 'INV-';

        if (settings.companyLogoUrl) {
            companyLogoImg.src = settings.companyLogoUrl;
        }
    }

    function addStampToInvoicePaper(text) {
        removeStampFromInvoicePaper(); // Ensure no duplicate stamps
        if (!text) return;
        const invoicePaper = document.getElementById('invoice-paper');
        const stamp = document.createElement('div');
        stamp.className = 'invoice-stamp';
        const lowerText = text.toLowerCase();
        if (['paid', 'due', 'overdue'].includes(lowerText)) stamp.classList.add(`stamp-${lowerText}`);
        stamp.textContent = text;
        invoicePaper.appendChild(stamp);
    }

    function removeStampFromInvoicePaper() {
        const existingStamp = document.querySelector('#invoice-paper .invoice-stamp');
        if (existingStamp) {
            existingStamp.remove();
        }
    }

    function showModal(action) {
        confirmAction = action;
        toggleModal('confirmation-modal', true);
    }

    function hideConfirmationModal() {
        confirmAction = null;
        toggleModal('confirmation-modal', false);
        // Reset modal text to default for single-item deletion
        setConfirmationModalText('Confirm Deletion', 'Are you sure you want to proceed?');
    }

    function setConfirmationModalText(title, message) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-message').textContent = message;
    }

    function toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.toggle('visible', show);
        }
    }

    // =================================================================
    // GLOBAL HELPER FUNCTIONS
    // =================================================================

    async function generateInvoiceNumber() {
        const settings = await getSettings();
        let lastNumber = settings.lastInvoiceNumber || 0;
        lastNumber++;
        settings.lastInvoiceNumber = lastNumber;
        await saveSettings(settings);
        return String(lastNumber).padStart(3, '0');
    }

    function calculateAllTotals(items) {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const gstAmount = items.reduce((sum, item) => {
            return sum + (item.quantity * item.rate * (item.gstRate / 100));
        }, 0);
        const grandTotal = subtotal + gstAmount;
        return { subtotal, gstAmount, grandTotal };
    }

    async function getSettings() {
        const settingsJSON = localStorage.getItem('settings');
        return settingsJSON ? JSON.parse(settingsJSON) : {};
    }

    async function saveSettings(settings) {
        localStorage.setItem('settings', JSON.stringify(settings));
    }

    async function getInvoices() {
        const invoicesJSON = localStorage.getItem('billSphere_invoices');
        return invoicesJSON ? JSON.parse(invoicesJSON) : [];
    }

    async function saveInvoices(invoices) {
        localStorage.setItem('billSphere_invoices', JSON.stringify(invoices));
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

    function getCurrentDate() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function getStatusFromDueDate(dueDate) {
        if (!dueDate) return 'Due';
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize today's date
        return parseISODate(dueDate) < today ? 'Overdue' : 'Due';
    }

    async function setDefaultDates() {
        const invoiceDateInput = document.getElementById('invoice-date');
        const dueDateInput = document.getElementById('due-date');
        const invoiceNumInput = document.getElementById('invoice-num');
        const today = getCurrentDate();

        if (invoiceDateInput) invoiceDateInput.value = today;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Default due date 30 days from now
        const yyyy = dueDate.getFullYear();
        const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dueDate.getDate()).padStart(2, '0');
        if (dueDateInput) dueDateInput.value = `${yyyy}-${mm}-${dd}`;

        const statusEl = document.querySelector('.meta-value');
        if (statusEl && statusEl.innerText !== 'Paid') {
            statusEl.innerText = getStatusFromDueDate(`${yyyy}-${mm}-${dd}`);
        }

        // Generate and set the unique invoice number for new invoices
        if (invoiceNumInput) invoiceNumInput.value = await generateInvoiceNumber();
    }
});
