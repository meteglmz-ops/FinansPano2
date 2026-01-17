document.addEventListener('DOMContentLoaded', () => {
    // --- Global State ---
    const state = {
        currentPage: 'pano',
        activeAccountId: null,
        transactions: [],
        accounts: [],
        categories: {
            income: ['Maaş', 'Bonus', 'Satış', 'Diğer'],
            expense: ['Fatura', 'Market', 'Ulaşım', 'Kira', 'Eğlence', 'Sağlık', 'Diğer']
        },
        reportDateRange: { from: null, to: null }
    };

    // --- DOM Elements ---
    const dom = {
        // Containers
        toastContainer: document.getElementById('toast-container'),
        pages: document.querySelectorAll('.page'),
        menuItems: document.querySelectorAll('#main-menu li'),
        // Dashboard
        dashboardSummaryCards: document.getElementById('dashboard-summary-cards'),
        addTransactionBtn: document.getElementById('add-transaction-btn'),
        transactionList: document.getElementById('transaction-list'),
        expenseChartCanvas: document.getElementById('expense-chart'),
        accountList: document.getElementById('account-list'),
        panoEmptyState: document.getElementById('pano-empty-state'),
        chartEmptyState: document.getElementById('chart-empty-state'),
        // Transaction Modal
        transactionModal: document.getElementById('transaction-modal'),
        modalCloseBtn: document.querySelector('.modal-close-btn'),
        modalForm: document.getElementById('modal-form'),
        modalTitle: document.getElementById('modal-title'),
        modalSubmitBtn: document.getElementById('modal-submit-btn'),
        // Reports
        reportDatePicker: document.getElementById('report-datepicker'),
        generateReportBtn: document.getElementById('generate-report-btn'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        reportSummary: document.getElementById('report-summary'),
        // Settings
        addCategoryForm: document.getElementById('add-category-form'),
        incomeCategoryList: document.getElementById('income-category-list'),
        expenseCategoryList: document.getElementById('expense-category-list'),
        addAccountForm: document.getElementById('add-account-form'),
        settingsAccountList: document.getElementById('settings-account-list'),
        deleteAllDataBtn: document.getElementById('delete-all-data-btn'),
        // Full Transaction List
        fullTransactionListUl: document.getElementById('full-transaction-list-ul'),
        islemlerEmptyState: document.getElementById('islemler-empty-state'),
        searchInput: document.getElementById('search-input'),
        filterType: document.getElementById('filter-type'),
        filterCategory: document.getElementById('filter-category'),
        filterAccount: document.getElementById('filter-account'),
    };
    
    let expenseChart;

    // --- DATA PERSISTENCE ---
    const saveData = () => {
        localStorage.setItem('financeDataV2', JSON.stringify({
            transactions: state.transactions,
            accounts: state.accounts,
            categories: state.categories,
            activeAccountId: state.activeAccountId
        }));
    };
    
    const loadData = () => {
        const data = JSON.parse(localStorage.getItem('financeDataV2'));
        if (data) {
            state.transactions = data.transactions || [];
            state.accounts = data.accounts || [];
            state.categories = data.categories || state.categories;
            state.activeAccountId = data.activeAccountId || null;
        }

        if (state.accounts.length === 0) {
            // First time setup
            const defaultAccountId = `acc_${Date.now()}`;
            state.accounts.push({ id: defaultAccountId, name: 'Varsayılan Hesap', balance: 0 });
            state.activeAccountId = defaultAccountId;
        } else if (!state.activeAccountId || !state.accounts.find(a => a.id === state.activeAccountId)) {
            state.activeAccountId = state.accounts[0].id;
        }
    };
    
    // --- UI RENDERING ---
    const render = () => {
        // Recalculate all account balances before rendering
        calculateAllAccountBalances();

        // Render based on current page
        dom.pages.forEach(p => p.classList.toggle('active', p.id === state.currentPage));
        dom.pages.forEach(p => p.classList.toggle('hidden', p.id !== state.currentPage));
        dom.menuItems.forEach(i => i.classList.toggle('active', i.dataset.page === state.currentPage));

        renderAccounts();
        
        switch (state.currentPage) {
            case 'pano':
                renderDashboard();
                break;
            case 'islemler':
                renderFullTransactionList();
                break;
            case 'ayarlar':
                 renderSettings();
                 break;
        }
        saveData();
    };

    const renderDashboard = () => {
        const activeAccount = state.accounts.find(a => a.id === state.activeAccountId);
        if (!activeAccount) return;

        const accountTransactions = state.transactions.filter(t => t.accountId === state.activeAccountId);
        const income = accountTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expense = accountTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);

        dom.dashboardSummaryCards.innerHTML = `
            <div class="card"><h3 class="income-text">Toplam Gelir</h3><p>${formatCurrency(income)}</p></div>
            <div class="card"><h3 class="expense-text">Toplam Gider</h3><p>${formatCurrency(Math.abs(expense))}</p></div>
            <div class="card"><h3>Hesap Bakiyesi</h3><p>${formatCurrency(activeAccount.balance)}</p></div>
        `;
        
        // Render recent transactions
        dom.transactionList.innerHTML = '';
        const recent = accountTransactions.slice().reverse().slice(0, 5);
        dom.panoEmptyState.classList.toggle('hidden', recent.length > 0);
        recent.forEach(t => renderTransactionItem(t, dom.transactionList));

        renderExpenseChart(accountTransactions);
    };

    const renderFullTransactionList = () => {
        const search = dom.searchInput.value.toLowerCase();
        const type = dom.filterType.value;
        const category = dom.filterCategory.value;
        const account = dom.filterAccount.value;

        const filtered = state.transactions.filter(t => {
            const searchMatch = !search || t.description.toLowerCase().includes(search);
            const typeMatch = type === 'all' || t.type === type;
            const categoryMatch = category === 'all' || t.category === category;
            const accountMatch = account === 'all' || t.accountId === account;
            return searchMatch && typeMatch && categoryMatch && accountMatch;
        });

        dom.fullTransactionListUl.innerHTML = '';
        dom.islemlerEmptyState.classList.toggle('hidden', filtered.length > 0);
        filtered.slice().reverse().forEach(t => renderTransactionItem(t, dom.fullTransactionListUl));
    };

    const renderAccounts = () => {
        dom.accountList.innerHTML = '';
        state.accounts.forEach(account => {
            const li = document.createElement('li');
            li.classList.toggle('active', account.id === state.activeAccountId);
            li.innerHTML = `<a href="#" data-id="${account.id}"><span class="account-name">${account.name}</span> <span class="account-balance">${formatCurrency(account.balance)}</span></a>`;
            dom.accountList.appendChild(li);
        });
    };
    
    const renderTransactionItem = (transaction, listElement) => {
        const li = document.createElement('li');
        li.dataset.id = transaction.id;
        li.className = transaction.amount > 0 ? 'income' : 'expense';
        li.innerHTML = `
            <div class="transaction-info">
                <span class="description">${transaction.description}</span>
                <span class="category">${transaction.category}</span>
            </div>
            <div class="transaction-details">
                <span class="transaction-amount">${formatCurrency(transaction.amount)}</span>
                <div class="action-btns">
                    <button class="edit-btn"><i class="fas fa-pencil-alt"></i></button>
                    <button class="delete-btn"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>`;
        listElement.appendChild(li);
    };

    const renderSettings = () => {
        // Categories
        dom.incomeCategoryList.innerHTML = '';
        dom.expenseCategoryList.innerHTML = '';
        state.categories.income.forEach(cat => renderCategoryItem(cat, 'income', dom.incomeCategoryList));
        state.categories.expense.forEach(cat => renderCategoryItem(cat, 'expense', dom.expenseCategoryList));

        // Accounts
        dom.settingsAccountList.innerHTML = '';
        state.accounts.forEach(acc => {
             const li = document.createElement('li');
             li.innerHTML = `<span>${acc.name} (${formatCurrency(acc.balance)})</span> <button class="delete-btn" data-id="${acc.id}"><i class="fas fa-trash-alt"></i></button>`;
             dom.settingsAccountList.appendChild(li);
        });
    };
    
    const renderCategoryItem = (category, type, listElement) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${category}</span> <button class="delete-btn" data-category="${category}" data-type="${type}"><i class="fas fa-trash-alt"></i></button>`;
        listElement.appendChild(li);
    };

    // --- CHART ---
    const renderExpenseChart = (transactions) => {
        const expenseByCategory = transactions
            .filter(t => t.amount < 0)
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {});

        const labels = Object.keys(expenseByCategory);
        const data = Object.values(expenseByCategory);
        
        dom.chartEmptyState.classList.toggle('hidden', labels.length > 0);

        if (expenseChart) expenseChart.destroy();
        expenseChart = new Chart(dom.expenseChartCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#3b82f6', '#10b981', '#6b7280'], borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                cutout: '70%',
            }
        });
    };

    // --- CALCULATIONS & HELPERS ---
    const calculateAllAccountBalances = () => {
        const initialBalances = state.accounts.reduce((acc, curr) => {
            const initialTransaction = state.transactions.find(t => t.type === 'initial' && t.accountId === curr.id);
            acc[curr.id] = initialTransaction ? initialTransaction.amount : 0;
            return acc;
        }, {});
        
        state.accounts.forEach(acc => {
            const relevantTransactions = state.transactions
                .filter(t => t.accountId === acc.id && t.type !== 'initial');
            const total = relevantTransactions.reduce((sum, t) => sum + t.amount, 0);
            acc.balance = (initialBalances[acc.id] || 0) + total;
        });
    };

    const formatCurrency = (value) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
    const showToast = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    // --- MODAL ---
    const openTransactionModal = (transactionId = null) => {
        const form = dom.modalForm;
        form.reset();
        
        const type = form.elements['modal-type'].value;
        populateModalCategories(type);
        populateModalAccounts();
        
        flatpickr(form.elements['modal-date'], { defaultDate: 'today', dateFormat: 'Y-m-d' });

        if (transactionId) {
            // Edit mode
            const t = state.transactions.find(t => t.id === transactionId);
            if (!t) return;
            dom.modalTitle.textContent = 'İşlemi Düzenle';
            form.elements['transaction-id'].value = t.id;
            form.elements['modal-description'].value = t.description;
            form.elements['modal-amount'].value = Math.abs(t.amount);
            form.elements['modal-type'].value = t.amount > 0 ? 'income' : 'expense';
            populateModalCategories(t.amount > 0 ? 'income' : 'expense');
            form.elements['modal-category'].value = t.category;
            form.elements['modal-account'].value = t.accountId;
            flatpickr(form.elements['modal-date'], { defaultDate: t.date, dateFormat: 'Y-m-d' });
        } else {
            // Add mode
            dom.modalTitle.textContent = 'Yeni İşlem';
            form.elements['transaction-id'].value = '';
            form.elements['modal-account'].value = state.activeAccountId;
        }
        dom.transactionModal.classList.remove('hidden');
    };
    
    const closeTransactionModal = () => dom.transactionModal.classList.add('hidden');

    const handleModalFormSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.elements['transaction-id'].value;
        const description = form.elements['modal-description'].value;
        const amount = parseFloat(form.elements['modal-amount'].value);
        const type = form.elements['modal-type'].value;
        const category = form.elements['modal-category'].value;
        const accountId = form.elements['modal-account'].value;
        const date = form.elements['modal-date'].value;

        if (!description || !amount || !category || !accountId || !date) {
            return showToast('Lütfen tüm alanları doldurun.', 'error');
        }

        const finalAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);

        if (id) {
            // Update
            const index = state.transactions.findIndex(t => t.id === parseInt(id));
            if (index !== -1) {
                state.transactions[index] = { ...state.transactions[index], description, amount: finalAmount, type, category, accountId, date };
                showToast('İşlem güncellendi.');
            }
        } else {
            // Create
            state.transactions.push({ id: Date.now(), description, amount: finalAmount, type, category, accountId, date });
            showToast('İşlem eklendi.');
        }
        
        closeTransactionModal();
        render();
    };
    
    const populateModalCategories = (type) => {
        const select = dom.modalForm.elements['modal-category'];
        select.innerHTML = '';
        state.categories[type].forEach(cat => {
            select.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    };

    const populateModalAccounts = () => {
        const select = dom.modalForm.elements['modal-account'];
        select.innerHTML = '';
        state.accounts.forEach(acc => {
            select.innerHTML += `<option value="${acc.id}">${acc.name}</option>`;
        });
    };
    
    // --- EVENT HANDLERS ---
    const setupEventListeners = () => {
        // Navigation
        dom.menuItems.forEach(item => item.addEventListener('click', e => {
            e.preventDefault();
            state.currentPage = item.dataset.page;
            render();
        }));

        dom.accountList.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (link) {
                e.preventDefault();
                state.activeAccountId = link.dataset.id;
                render();
            }
        });
        
        // Modals
        dom.addTransactionBtn.addEventListener('click', () => openTransactionModal());
        dom.modalCloseBtn.addEventListener('click', closeTransactionModal);
        dom.modalForm.addEventListener('submit', handleModalFormSubmit);
        dom.modalForm.elements['modal-type'].addEventListener('change', (e) => populateModalCategories(e.target.value));

        // Transaction Actions
        document.querySelector('.content-wrapper').addEventListener('click', e => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            if (editBtn) {
                const transactionId = parseInt(editBtn.closest('li').dataset.id);
                openTransactionModal(transactionId);
            }
            if (deleteBtn) {
                const transactionId = parseInt(deleteBtn.closest('li').dataset.id);
                if (confirm('Bu işlemi silmek istediğinizden emin misiniz?')) {
                    state.transactions = state.transactions.filter(t => t.id !== transactionId);
                    showToast('İşlem silindi.');
                    render();
                }
            }
        });
        
        // Settings
        dom.addCategoryForm.addEventListener('submit', e => {
            e.preventDefault();
            const name = e.target.elements['new-category-name'].value.trim();
            const type = e.target.elements['new-category-type'].value;
            if (name && !state.categories[type].includes(name)) {
                state.categories[type].push(name);
                renderSettings();
                saveData();
                showToast('Kategori eklendi.');
                e.target.reset();
            } else {
                showToast('Geçersiz veya mevcut kategori adı.', 'error');
            }
        });

        dom.addAccountForm.addEventListener('submit', e => {
            e.preventDefault();
            const name = e.target.elements['new-account-name'].value.trim();
            const balance = parseFloat(e.target.elements['new-account-balance'].value);
            if (name && !isNaN(balance)) {
                const newAccount = { id: `acc_${Date.now()}`, name, balance: 0 };
                state.accounts.push(newAccount);
                // Add initial balance as a transaction
                if(balance !== 0) {
                     state.transactions.push({ id: Date.now(), description: 'Başlangıç Bakiyesi', amount: balance, type: 'initial', category: 'Initial', accountId: newAccount.id, date: new Date().toISOString() });
                }
                render();
                showToast('Hesap eklendi.');
                e.target.reset();
            }
        });

        dom.deleteAllDataBtn.addEventListener('click', () => {
             if (confirm('TÜM VERİLERİ SİLMEK istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
                localStorage.removeItem('financeDataV2');
                // Reset state to default
                state.transactions = [];
                state.accounts = [];
                state.activeAccountId = null;
                loadData(); // Re-initializes with default account
                render();
                showToast('Tüm veriler silindi.', 'error');
            }
        });

        document.getElementById('ayarlar').addEventListener('click', e => {
            const delCatBtn = e.target.closest('.category-list-container .delete-btn');
            const delAccBtn = e.target.closest('#settings-account-list .delete-btn');
            if(delCatBtn) {
                 const category = delCatBtn.dataset.category;
                 const type = delCatBtn.dataset.type;
                 state.categories[type] = state.categories[type].filter(c => c !== category);
                 showToast('Kategori silindi.');
                 renderSettings();
                 saveData();
            }
            if(delAccBtn) {
                if(state.accounts.length <= 1) return showToast('Son hesabı silemezsiniz.', 'error');
                const accountId = delAccBtn.dataset.id;
                if(confirm('Bu hesabı ve İÇİNDEKİ TÜM İŞLEMLERİ silmek istediğinizden emin misiniz?')) {
                    state.accounts = state.accounts.filter(a => a.id !== accountId);
                    state.transactions = state.transactions.filter(t => t.accountId !== accountId);
                    state.activeAccountId = state.accounts[0].id; // Switch to first available account
                    render();
                    showToast('Hesap silindi.', 'error');
                }
            }
        });
        
        // Transaction Page Filters
        [dom.searchInput, dom.filterType, dom.filterCategory, dom.filterAccount].forEach(el => {
            el.addEventListener('input', renderFullTransactionList);
        });

        // Reports
        flatpickr(dom.reportDatePicker, {
            mode: "range",
            dateFormat: "Y-m-d",
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    state.reportDateRange.from = selectedDates[0];
                    state.reportDateRange.to = selectedDates[1];
                }
            }
        });
        dom.generateReportBtn.addEventListener('click', renderReport);
        dom.exportCsvBtn.addEventListener('click', exportReportToCSV);
    };
    
    // --- REPORTS ---
    const renderReport = () => {
        const { from, to } = state.reportDateRange;
        if (!from || !to) return showToast('Lütfen bir tarih aralığı seçin.', 'error');

        const filtered = state.transactions.filter(t => {
            const date = new Date(t.date);
            return date >= from && date <= to;
        });
        
        const income = filtered.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expense = filtered.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);

        dom.reportSummary.innerHTML = `
            <div class="card"><h3 class="income-text">Seçili Dönem Gelir</h3><p>${formatCurrency(income)}</p></div>
            <div class="card"><h3 class="expense-text">Seçili Dönem Gider</h3><p>${formatCurrency(Math.abs(expense))}</p></div>
            <div class="card"><h3>Seçili Dönem Net</h3><p>${formatCurrency(income + expense)}</p></div>
        `;
        dom.exportCsvBtn.classList.remove('hidden');
    };
    
    const exportReportToCSV = () => {
         const { from, to } = state.reportDateRange;
         if (!from || !to) return showToast('Lütfen önce rapor oluşturun.', 'error');
         
         const filtered = state.transactions.filter(t => {
            const date = new Date(t.date);
            return date >= from && date <= to;
        });

        let csvContent = "data:text/csv;charset=utf-8,Tarih,Açıklama,Kategori,Hesap,Tutar\n";
        filtered.forEach(t => {
            const row = [
                new Date(t.date).toLocaleDateString('tr-TR'),
                t.description,
                t.category,
                state.accounts.find(a=>a.id === t.accountId)?.name || 'Bilinmeyen',
                t.amount.toFixed(2)
            ].join(',');
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rapor_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- INITIALIZATION ---
    const init = () => {
        loadData();
        setupEventListeners();
        render();
    };

    init();
});
