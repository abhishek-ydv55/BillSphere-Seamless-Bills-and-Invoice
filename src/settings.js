document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const clearDataBtn = document.getElementById('clear-data-btn');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // --- State ---
    let confirmAction = null;

    // --- Event Listeners ---
    clearDataBtn.addEventListener('click', handleClearAllData);
    modalCancelBtn.addEventListener('click', hideConfirmationModal);

    // --- Functions ---
    function handleClearAllData() {
        showConfirmationModal(
            'Clear All Invoice Data',
            'Are you sure you want to permanently delete ALL invoices? This action cannot be undone.',
            () => {
                localStorage.removeItem('invoices');
                showToast('All invoice data has been cleared!');
            }
        );
    }

    function showConfirmationModal(title, message, onConfirm) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmAction = onConfirm;

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
        confirmAction = null;
        modalConfirmBtn.onclick = null;
    }

    function showToast(message) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.textContent = message;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, 3000);
    }

    // --- Theme Switcher Logic (copied for this page) ---
    function initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        const currentTheme = localStorage.getItem('theme') || 'light';

        document.documentElement.setAttribute('data-theme', currentTheme);

        if (currentTheme === 'dark') {
            themeToggle.checked = true;
        }

        themeToggle.addEventListener('click', (e) => {
            const isDark = themeToggle.checked;
            const newTheme = isDark ? 'dark' : 'light';

            if (!document.startViewTransition) {
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                return;
            }

            const x = e.clientX;
            const y = e.clientY;

            const transition = document.startViewTransition(() => {
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            });

            transition.ready.then(() => {
                const clipPath = `circle(0px at ${x}px ${y}px)`;
                document.documentElement.animate(
                    { clipPath: [clipPath, `circle(150vmax at ${x}px ${y}px)`] },
                    { duration: 800, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
                );
            });
        });
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

    initTheme();
    displayCurrentDate();
});