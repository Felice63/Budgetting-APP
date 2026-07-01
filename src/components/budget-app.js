import './budget-calendar/budget-calendar.js';
import { openDB, addTransaction, getTransactionsByDate, getAllTransactions, deleteTransaction, updateTransaction, getSetting, setSetting } from '../storage/db.js';

class BudgetApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selectedDate = new Date();
        this.currentTransactions = [];
        this.allTransactions = [];
        this.editingTransactionId = null;
    }

    async connectedCallback() {
        let isPersisted = false;
        if (navigator.storage && navigator.storage.persist) {
            isPersisted = await navigator.storage.persisted();
            if (!isPersisted) {
                isPersisted = await navigator.storage.persist();
            }
        }
        await openDB();
        this.render();
        this.addEventListeners();
        await this.loadSelectedDate();
        await this.refreshCalendarTransactions();
        this.loadTransactions();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --bg: #f4f7fb;
                    --panel: rgba(255, 255, 255, 0.88);
                    --panel-border: rgba(30, 41, 59, 0.08);
                    --text: #0f172a;
                    --muted: #64748b;
                    --accent: #0f766e;
                    --accent-strong: #115e59;
                    --income: #15803d;
                    --expense: #b91c1c;
                    display: block;
                    min-height: 100vh;
                    padding: 24px;
                    color: var(--text);
                    background:
                        radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 28%),
                        radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 24%),
                        var(--bg);
                    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    box-sizing: border-box;
                }
                .container {
                    display: grid;
                    grid-template-columns: minmax(300px, 360px) minmax(0, 1fr);
                    gap: 24px;
                    max-width: 2400px;
                    margin: 0 auto;
                }
                .sidebar,
                .main-content {
                    background: var(--panel);
                    border: 1px solid var(--panel-border);
                    border-radius: 24px;
                    box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
                    backdrop-filter: blur(18px);
                }
                .sidebar {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    min-width: 0;
                }
                .eyebrow {
                    font-size: 0.76rem;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                    color: var(--accent);
                    margin: 0;
                    font-weight: 700;
                }
                h1 {
                    margin: 0;
                    font-size: clamp(1.7rem, 2vw, 2.2rem);
                    line-height: 1.05;
                }
                .subhead {
                    margin: 0;
                    color: var(--muted);
                    line-height: 1.5;
                }
                #selected-date {
                    width: 100%;
                    border: 0;
                    text-align: left;
                    font-weight: bold;
                    font-size: 1rem;
                    padding: 14px 16px;
                    border-radius: 16px;
                    background: rgba(15, 118, 110, 0.08);
                    color: var(--accent-strong);
                    cursor: pointer;
                    font: inherit;
                }
                #selected-date:hover {
                    background: rgba(15, 118, 110, 0.12);
                }
                .selected-date-help {
                    margin-top: -8px;
                    padding: 0 4px;
                    font-size: 0.82rem;
                    line-height: 1.35;
                    color: var(--muted);
                }
                #transaction-form {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 16px;
                    border-radius: 20px;
                    border: 1px solid rgba(15, 118, 110, 0.12);
                    background: rgba(255, 255, 255, 0.75);
                }
                #transaction-form h3,
                .transactions-header h3 {
                    margin: 0;
                    font-size: 1rem;
                }
                #transaction-form input,
                #transaction-form select {
                    padding: 12px 14px;
                    border: 1px solid rgba(100, 116, 139, 0.22);
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.95);
                    color: var(--text);
                    font: inherit;
                }
                #transaction-form button {
                    padding: 12px 14px;
                    background: linear-gradient(135deg, var(--accent), #14b8a6);
                    color: white;
                    border: none;
                    border-radius: 14px;
                    cursor: pointer;
                    font-weight: 700;
                    box-shadow: 0 10px 20px rgba(15, 118, 110, 0.22);
                }
                #transaction-form button:hover {
                    filter: brightness(0.98);
                    transform: translateY(-1px);
                }
                .form-actions {
                    display: flex;
                    gap: 10px;
                }
                .secondary-button {
                    background: rgba(100, 116, 139, 0.12);
                    color: var(--text);
                    box-shadow: none;
                }
                .secondary-button:hover {
                    background: rgba(100, 116, 139, 0.18);
                }
                .summary {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 10px;
                }
                .summary-card {
                    padding: 14px;
                    border-radius: 18px;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
                    border: 1px solid rgba(100, 116, 139, 0.12);
                }
                .summary-card span {
                    display: block;
                }
                .summary-label {
                    font-size: 0.72rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--muted);
                    margin-bottom: 8px;
                }
                .summary-value {
                    font-size: 1rem;
                    font-weight: 800;
                    line-height: 1.1;
                }
                .summary-value.income {
                    color: var(--income);
                }
                .summary-value.expense {
                    color: var(--expense);
                }
                .summary-value.net {
                    color: var(--accent-strong);
                }
                #transactions-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                #transactions-list li {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                    padding: 12px 14px;
                    border-radius: 16px;
                    background: rgba(255, 255, 255, 0.86);
                    border: 1px solid rgba(100, 116, 139, 0.12);
                }
                .tx-name {
                    font-weight: 600;
                }
                .tx-meta {
                    font-size: 0.85rem;
                    color: var(--muted);
                }
                .tx-amount {
                    font-weight: 800;
                    white-space: nowrap;
                }
                .tx-row-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: 10px;
                }
                .tx-edit {
                    border: 1px solid rgba(15, 118, 110, 0.18);
                    background: rgba(15, 118, 110, 0.08);
                    color: #0f766e;
                    border-radius: 999px;
                    padding: 6px 10px;
                    font: inherit;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .tx-edit:hover {
                    background: rgba(15, 118, 110, 0.14);
                }
                .tx-delete {
                    border: 1px solid rgba(185, 28, 28, 0.18);
                    background: rgba(185, 28, 28, 0.06);
                    color: #b91c1c;
                    border-radius: 999px;
                    padding: 6px 10px;
                    font: inherit;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .tx-delete:hover {
                    background: rgba(185, 28, 28, 0.12);
                }
                .main-content {
                    padding: 24px;
                    min-width: 0;
                    overflow: hidden;
                }
                .calendar-shell {
                    display: grid;
                    gap: 16px;
                }
                .calendar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    gap: 12px;
                }
                .calendar-header h2 {
                    margin: 0;
                    font-size: 1.1rem;
                }
                .calendar-header p {
                    margin: 0;
                    color: var(--muted);
                }
                @media (max-width: 900px) {
                    :host {
                        padding: 12px;
                    }
                    .container {
                        grid-template-columns: 1fr;
                    }
                }
                @media (max-width: 560px) {
                    .summary {
                        grid-template-columns: 1fr;
                    }
                }
                @media print {
                    :host {
                        min-height: auto;
                        padding: 0;
                        background: white;
                    }
                    .container {
                        display: block;
                        max-width: none;
                    }
                    .sidebar {
                        display: none;
                    }
                    .main-content {
                        padding: 0;
                        border: none;
                        box-shadow: none;
                        background: transparent;
                        overflow: visible;
                    }
                    .calendar-shell {
                        gap: 0;
                    }
                    .calendar-header {
                        display: none;
                    }
                }
            </style>
            <div class="container">
                <aside class="sidebar">
                    <div>
                        <p class="eyebrow">Personal Finance</p>
                        <h1>Budget App</h1>
                        <p class="subhead">Track daily transactions against the selected calendar date.</p>
                    </div>
                    <button type="button" id="selected-date">No date selected</button>
                    <span class="selected-date-help">Click the date above to reset to today.</span>
                    <div class="summary">
                        <div class="summary-card">
                            <span class="summary-label">Income</span>
                            <span class="summary-value income" id="income-total">$0.00</span>
                        </div>
                        <div class="summary-card">
                            <span class="summary-label">Expense</span>
                            <span class="summary-value expense" id="expense-total">$0.00</span>
                        </div>
                        <div class="summary-card">
                            <span class="summary-label">Net</span>
                            <span class="summary-value net" id="net-total">$0.00</span>
                        </div>
                    </div>
                    <form id="transaction-form">
                        <h3 id="transaction-form-title">Add Transaction</h3>
                        <input type="text" id="description" placeholder="Description" required>
                        <input type="number" id="amount" placeholder="Amount" step="0.01" required>
                        <select id="type">
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                        <div class="form-actions">
                            <button type="submit" id="transaction-submit-button">Add</button>
                            <button type="button" class="secondary-button" id="cancel-edit-button" hidden>Cancel</button>
                        </div>
                    </form>
                    <div class="transactions-header">
                        <h3>Transactions</h3>
                        <ul id="transactions-list"></ul>
                    </div>
                </aside>
                <main class="main-content">
                    <div class="calendar-shell">
                        <div class="calendar-header">
                            <div>
                                <h2>Calendar</h2>
                                <p>Pick a day to review or add entries.</p>
                            </div>
                        </div>
                        <budget-calendar></budget-calendar>
                    </div>
                </main>
            </div>
        `;
    }

    addEventListeners() {
        const calendar = this.shadowRoot.querySelector('budget-calendar');
        const selectedDateEl = this.shadowRoot.querySelector('#selected-date');
        const transactionForm = this.shadowRoot.querySelector('#transaction-form');
        const transactionsList = this.shadowRoot.querySelector('#transactions-list');
        const transactionFormTitle = this.shadowRoot.querySelector('#transaction-form-title');
        const transactionSubmitButton = this.shadowRoot.querySelector('#transaction-submit-button');
        const cancelEditButton = this.shadowRoot.querySelector('#cancel-edit-button');

        calendar.setSelectedDate(this.selectedDate);

        calendar.addEventListener('date-selected', (e) => {
            this.selectedDate = e.detail.date;
            calendar.setActiveDate(this.selectedDate);
            void this.saveSelectedDate(this.selectedDate);
            selectedDateEl.textContent = this.selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            this.loadTransactions();
        });

        calendar.addEventListener('delete-transaction', async (e) => {
            await this.handleTransactionDelete(e.detail.id);
        });

        calendar.addEventListener('edit-transaction', (e) => {
            this.beginTransactionEdit(e.detail.id);
        });

        selectedDateEl.addEventListener('click', async () => {
            const currentDate = new Date();

            this.selectedDate = currentDate;
            calendar.setActiveDate(currentDate);
            calendar.setSelectedDate(currentDate);
            await this.saveSelectedDate(currentDate);
            selectedDateEl.textContent = currentDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            await this.loadTransactions();
        });

        transactionsList.addEventListener('click', async (e) => {
            const editButton = e.target.closest('[data-edit-transaction-id]');
            if (editButton) {
                this.beginTransactionEdit(Number(editButton.dataset.editTransactionId));
                return;
            }

            const deleteButton = e.target.closest('[data-delete-transaction-id]');
            if (!deleteButton) {
                return;
            }

            const transactionId = Number(deleteButton.dataset.deleteTransactionId);
            if (!Number.isNaN(transactionId)) {
                await this.handleTransactionDelete(transactionId);
            }
        });

        cancelEditButton.addEventListener('click', () => {
            this.resetTransactionForm();
            transactionForm.reset();
            transactionFormTitle.textContent = 'Add Transaction';
            transactionSubmitButton.textContent = 'Add';
            cancelEditButton.hidden = true;
        });

        transactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const description = this.shadowRoot.querySelector('#description').value;
            const amount = parseFloat(this.shadowRoot.querySelector('#amount').value);
            const type = this.shadowRoot.querySelector('#type').value;

            if (description && !isNaN(amount)) {
                const transaction = {
                    date: this.toDateKey(this.selectedDate),
                    description,
                    amount,
                    type,
                };
                if (this.editingTransactionId !== null) {
                    await updateTransaction({ ...transaction, id: this.editingTransactionId });
                } else {
                    await addTransaction(transaction);
                }
                this.resetTransactionForm();
                transactionForm.reset();
                transactionFormTitle.textContent = 'Add Transaction';
                transactionSubmitButton.textContent = 'Add';
                cancelEditButton.hidden = true;
                await this.refreshCalendarTransactions();
                this.loadTransactions();
            }
        });
    }

    async refreshCalendarTransactions() {
        const calendar = this.shadowRoot.querySelector('budget-calendar');
        this.allTransactions = await getAllTransactions();
        calendar.setTransactions(this.allTransactions);
    }

    async loadSelectedDate() {
        const calendar = this.shadowRoot.querySelector('budget-calendar');
        try {
            const selectedDateSetting = await getSetting('selected-date');

            if (selectedDateSetting?.value) {
                const persistedDate = new Date(selectedDateSetting.value);
                if (!Number.isNaN(persistedDate.getTime())) {
                    this.selectedDate = persistedDate;
                }
            }
        } catch (error) {
            console.warn('Unable to load selected date setting:', error);
        }

        if (calendar) {
            calendar.setActiveDate(this.selectedDate);
        }

        const selectedDateEl = this.shadowRoot.querySelector('#selected-date');
        if (selectedDateEl) {
            selectedDateEl.textContent = this.selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
        }

        await this.saveSelectedDate(this.selectedDate);
    }

    async saveSelectedDate(date) {
        try {
            await setSetting({
                key: 'selected-date',
                value: date.toISOString(),
            });
        } catch (error) {
            console.warn('Unable to save selected date setting:', error);
        }
    }

    async loadTransactions() {
        const date = this.toDateKey(this.selectedDate);
        const transactions = await getTransactionsByDate(date);
        this.currentTransactions = transactions;
        this.renderTransactions(transactions);
    }

    async handleTransactionDelete(id) {
        await deleteTransaction(id);
        await this.refreshCalendarTransactions();
        await this.loadTransactions();
    }

    beginTransactionEdit(id) {
        const transaction = this.allTransactions.find((entry) => entry.id === id) || this.currentTransactions.find((entry) => entry.id === id);

        if (!transaction) {
            return;
        }

        this.editingTransactionId = id;
        this.shadowRoot.querySelector('#description').value = transaction.description;
        this.shadowRoot.querySelector('#amount').value = transaction.amount;
        this.shadowRoot.querySelector('#type').value = transaction.type;
        this.shadowRoot.querySelector('#transaction-form-title').textContent = 'Edit Transaction';
        this.shadowRoot.querySelector('#transaction-submit-button').textContent = 'Update';
        this.shadowRoot.querySelector('#cancel-edit-button').hidden = false;
    }

    resetTransactionForm() {
        this.editingTransactionId = null;
        const transactionFormTitle = this.shadowRoot.querySelector('#transaction-form-title');
        const transactionSubmitButton = this.shadowRoot.querySelector('#transaction-submit-button');
        const cancelEditButton = this.shadowRoot.querySelector('#cancel-edit-button');

        if (transactionFormTitle) {
            transactionFormTitle.textContent = 'Add Transaction';
        }
        if (transactionSubmitButton) {
            transactionSubmitButton.textContent = 'Add';
        }
        if (cancelEditButton) {
            cancelEditButton.hidden = true;
        }
    }

    toDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    renderTransactions(transactions) {
        const list = this.shadowRoot.querySelector('#transactions-list');
        const incomeTotalEl = this.shadowRoot.querySelector('#income-total');
        const expenseTotalEl = this.shadowRoot.querySelector('#expense-total');
        const netTotalEl = this.shadowRoot.querySelector('#net-total');

        list.innerHTML = '';

        const totals = transactions.reduce((accumulator, transaction) => {
            const amount = Number(transaction.amount) || 0;

            if (transaction.type === 'income') {
                accumulator.income += amount;
            } else {
                accumulator.expense += amount;
            }

            return accumulator;
        }, { income: 0, expense: 0 });

        const net = totals.income - totals.expense;

        incomeTotalEl.textContent = this.formatCurrency(totals.income);
        expenseTotalEl.textContent = this.formatCurrency(totals.expense);
        netTotalEl.textContent = this.formatCurrency(net);

        if (transactions.length === 0) {
            list.innerHTML = '<li>No transactions for this day.</li>';
            return;
        }
        transactions.forEach(tx => {
            const item = document.createElement('li');
            item.innerHTML = `
                <div>
                    <div class="tx-name">${tx.description}</div>
                    <div class="tx-meta">${tx.type}</div>
                </div>
                <div class="tx-row-actions">
                    <span class="tx-amount" style="color: ${tx.type === 'income' ? 'var(--income)' : 'var(--expense)'}">
                        ${tx.type === 'expense' ? '-' : '+'}${this.formatCurrency(tx.amount)}
                    </span>
                    <button type="button" class="tx-edit" data-edit-transaction-id="${tx.id}">Edit</button>
                    <button type="button" class="tx-delete" data-delete-transaction-id="${tx.id}">Delete</button>
                </div>
            `;
            list.appendChild(item);
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }
}

customElements.define('budget-app', BudgetApp);
