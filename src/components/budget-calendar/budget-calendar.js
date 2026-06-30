import { getSetting, setSetting } from '../../storage/db.js';

class BudgetCalendar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentDate = new Date();
        this.selectedDateKey = this.toDateKey(new Date());
        this.transactionsByDate = new Map();
        this.startingBalancesByMonth = new Map();
    }

    async connectedCallback() {
        this.render();
        this.addEventListeners();
        await this.loadStartingBalanceForCurrentMonth();
    }

    setTransactions(transactions = []) {
        const groupedTransactions = new Map();

        transactions.forEach((transaction) => {
            const dateKey = transaction.date;
            const existingTransactions = groupedTransactions.get(dateKey) || [];
            existingTransactions.push(transaction);
            groupedTransactions.set(dateKey, existingTransactions);
        });

        this.transactionsByDate = groupedTransactions;
        this.updateCalendar();
    }

    setSelectedDate(date) {
        this.selectedDateKey = this.toDateKey(date);
        this.updateCalendar();
    }

    setActiveDate(date) {
        this.currentDate = new Date(date);
        this.selectedDateKey = this.toDateKey(date);
        this.updateCalendar();
    }

    setStartingBalance(amount) {
        const monthKey = this.getMonthKey(this.currentDate);
        const normalizedAmount = Number(amount) || 0;
        this.startingBalancesByMonth.set(monthKey, normalizedAmount);
        void this.saveStartingBalanceForCurrentMonth(normalizedAmount);
        this.updateCalendar();
    }

    toDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    getMonthKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    getStartingBalanceForCurrentMonth() {
        const monthKey = this.getMonthKey(this.currentDate);
        return Number(this.startingBalancesByMonth.get(monthKey) || 0);
    }

    getStartingBalanceSettingKey() {
        return `starting-balance:${this.getMonthKey(this.currentDate)}`;
    }

    async loadStartingBalanceForCurrentMonth() {
        try {
            const setting = await getSetting(this.getStartingBalanceSettingKey());
            const startingBalance = Number(setting?.value) || 0;
            const monthKey = this.getMonthKey(this.currentDate);

            this.startingBalancesByMonth.set(monthKey, startingBalance);

            const startingBalanceInput = this.shadowRoot?.querySelector('#starting-balance-input');
            if (startingBalanceInput) {
                startingBalanceInput.value = String(startingBalance);
            }
        } catch (error) {
            console.warn('Unable to load starting balance setting:', error);
        }

        this.updateCalendar();
    }

    async saveStartingBalanceForCurrentMonth(amount) {
        try {
            await setSetting({
                key: this.getStartingBalanceSettingKey(),
                value: Number(amount) || 0,
            });
        } catch (error) {
            console.warn('Unable to save starting balance setting:', error);
        }
    }

    getTransactionsForCurrentMonth() {
        const month = this.currentDate.getMonth();
        const year = this.currentDate.getFullYear();

        return [...this.transactionsByDate.entries()]
            .filter(([dateKey]) => {
                const [entryYear, entryMonth] = dateKey.split('-').map(Number);
                return entryYear === year && entryMonth === month + 1;
            })
            .flatMap(([, transactions]) => transactions);
    }

    getMonthlyTotals() {
        return this.getTransactionsForCurrentMonth().reduce((accumulator, transaction) => {
            const amount = Number(transaction.amount) || 0;

            if (transaction.type === 'income') {
                accumulator.income += amount;
            } else {
                accumulator.expense += amount;
            }

            return accumulator;
        }, { income: 0, expense: 0 });
    }

    getMonthlyEndingBalance() {
        const monthlyTotals = this.getMonthlyTotals();
        return this.getStartingBalanceForCurrentMonth() + (monthlyTotals.income - monthlyTotals.expense);
    }

    getWeeklySummaries() {
        const currentYear = this.currentDate.getFullYear();
        const currentMonth = this.currentDate.getMonth();
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
        const visibleStart = new Date(startOfMonth);
        visibleStart.setDate(startOfMonth.getDate() - startOfMonth.getDay());

        const weeklySummaries = [];
        let weekStart = new Date(visibleStart);
        let runningBalance = this.getStartingBalanceForCurrentMonth();

        while (weekStart <= endOfMonth) {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            const transactions = this.getTransactionsForCurrentMonth().filter((transaction) => {
                const transactionDate = this.parseDateKey(transaction.date);
                return transactionDate && transactionDate >= weekStart && transactionDate <= weekEnd;
            });

            const totals = transactions.reduce((accumulator, transaction) => {
                const amount = Number(transaction.amount) || 0;

                if (transaction.type === 'income') {
                    accumulator.income += amount;
                } else {
                    accumulator.expense += amount;
                }

                return accumulator;
            }, { income: 0, expense: 0 });

            runningBalance += totals.income - totals.expense;

            weeklySummaries.push({
                label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
                income: totals.income,
                expense: totals.expense,
                balance: runningBalance,
            });

            weekStart = new Date(weekEnd);
            weekStart.setDate(weekEnd.getDate() + 1);
        }

        return weeklySummaries;
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    color: #0f172a;
                }
                .layout {
                    display: grid;
                    grid-template-columns: minmax(0, 3.2fr) minmax(280px, 320px);
                    gap: 16px;
                }
                .calendar {
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    border-radius: 24px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.9);
                    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
                }
                .month-indicator {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding: 18px 18px 14px;
                    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92));
                }
                .month-meta {
                    display: grid;
                    gap: 10px;
                    min-width: 0;
                    flex: 1;
                }
                #month {
                    font-size: 1.1rem;
                    font-weight: 800;
                    text-align: center;
                }
                .starting-balance {
                    display: grid;
                    gap: 6px;
                }
                .starting-balance label {
                    font-size: 0.68rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #64748b;
                    font-weight: 700;
                }
                .starting-balance input {
                    min-width: 0;
                    padding: 10px 12px;
                    border-radius: 14px;
                    border: 1px solid rgba(15, 23, 42, 0.12);
                    background: rgba(255, 255, 255, 0.96);
                    color: #0f172a;
                    font: inherit;
                    font-weight: 700;
                }
                .nav-button {
                    background: rgba(15, 118, 110, 0.08);
                    border: 1px solid rgba(15, 118, 110, 0.14);
                    cursor: pointer;
                    padding: 10px 14px;
                    border-radius: 999px;
                    color: #0f766e;
                    font-weight: 700;
                }
                .nav-button:hover {
                    background-color: rgba(15, 118, 110, 0.14);
                }
                .day-of-week {
                    border-bottom: 2px solid rgba(15, 23, 42, 0.08);
                }    
                .day-of-week,
                .date-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                }
                .day-of-week > div {
                    text-align: center;
                    padding: 12px 6px;
                    font-size: 0.75rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    font-weight: 700;
                    color: #64748b;
                    background: rgba(248, 250, 252, 0.95);
                }
                .date-grid > div {
                    position: relative;
                    min-height: 96px;
                    border-right: 2px solid rgba(15, 23, 42, 0.06);
                    border-bottom: 2px solid rgba(15, 23, 42, 0.06);
                    padding: 8px;
                    transition: background-color 0.2s ease, transform 0.2s ease;
                    background: rgba(255, 255, 255, 0.92);
                    cursor: pointer;
                }
                .date-grid > div:hover {
                    background-color: rgba(15, 118, 110, 0.06);
                }
                .date-grid > div.today {
                    background: linear-gradient(180deg, rgba(15, 118, 110, 0.16), rgba(15, 118, 110, 0.08));
                }
                .date-grid > div.selected {
                    background: linear-gradient(180deg, rgba(37, 99, 235, 0.2), rgba(37, 99, 235, 0.1));
                }
                .date-grid > div.has-transactions::after {
                    content: '';
                    position: absolute;
                    inset: auto 8px 8px 8px;
                    height: 4px;
                    border-radius: 999px;
                    background: linear-gradient(90deg, #0f766e, #38bdf8);
                    opacity: 0.75;
                }
                .date-grid > div.other-month {
                    color: #94a3b8;
                    cursor: default;
                    background: rgba(248, 250, 252, 0.75);
                }
                .date-grid > div.other-month:hover {
                    background-color: rgba(248, 250, 252, 0.75);
                }
                .date-grid span {
                    /*position: relative;
                    top: 8px;
                    left: 8px;*/
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .day-balance {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    border-radius: 999px;
                    font-size: 0.64rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                    background: rgba(255, 255, 255, 0.84);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
                    z-index: 1;
                }
                .day-balance.income {
                    color: #15803d;
                }
                .day-balance.expense {
                    color: #b91c1c;
                }
                .day-balance.neutral {
                    color: #475569;
                }
                .summary-rail {
                    display: grid;
                    gap: 16px;
                    align-content: start;
                }
                .rail-card {
                    padding: 18px;
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    border-radius: 20px;
                    background: rgba(255, 255, 255, 0.92);
                    box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06);
                }
                .rail-card h3 {
                    margin: 0;
                    font-size: 1rem;
                }
                .rail-card-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: baseline;
                    margin-bottom: 12px;
                }
                .rail-card-header span {
                    color: #64748b;
                    font-size: 0.8rem;
                }
                .weekly-balances {
                    display: grid;
                    gap: 10px;
                }
                .weekly-balance-card {
                    padding: 12px 14px;
                    border-radius: 16px;
                    background: rgba(248, 250, 252, 0.95);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                }
                .weekly-balance-card strong {
                    display: block;
                    font-size: 0.9rem;
                    margin-bottom: 4px;
                }
                .weekly-balance-card .meta {
                    color: #64748b;
                    font-size: 0.78rem;
                    margin-bottom: 6px;
                }
                .weekly-balance-card .value {
                    font-size: 1rem;
                    font-weight: 800;
                }
                .weekly-balance-card .value.income,
                .month-end-card .value.surplus {
                    color: #15803d;
                }
                .weekly-balance-card .value.expense,
                .month-end-card .value.deficit {
                    color: #b91c1c;
                }
                .weekly-balance-card .value.neutral,
                .month-end-card .value.balance {
                    color: #0f766e;
                }
                .month-end-card {
                    display: grid;
                    gap: 8px;
                }
                .month-end-card .status {
                    font-size: 0.76rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    font-weight: 800;
                }
                .month-end-card .status.surplus {
                    color: #15803d;
                }
                .month-end-card .status.balance {
                    color: #0f766e;
                }
                .month-end-card .status.deficit {
                    color: #b91c1c;
                }
                .month-end-card .value {
                    font-size: 1.35rem;
                    font-weight: 900;
                }
                .month-end-card .subtext {
                    color: #64748b;
                    font-size: 0.84rem;
                    line-height: 1.45;
                }
                .transaction-badges {
                    position: absolute;
                    left: 8px;
                    right: 8px;
                    bottom: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    align-items: stretch;
                }
                .transaction-preview {
                    display: inline-flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    max-width: 100%;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 0.66rem;
                    font-weight: 700;
                    line-height: 1.35;
                    background: rgba(255, 255, 255, 0.82);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                    box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
                    overflow: hidden;
                }
                .transaction-preview.income {
                    color: #15803d;
                }
                .transaction-preview.expense {
                    color: #b91c1c;
                }
                .transaction-preview-name {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    min-width: 0;
                }
                .transaction-preview-amount {
                    flex: 0 0 auto;
                    white-space: nowrap;
                }
                .transaction-more {
                    display: inline-flex;
                    align-self: flex-start;
                    padding: 1px 8px;
                    border-radius: 999px;
                    font-size: 0.64rem;
                    font-weight: 800;
                    color: #475569;
                    background: rgba(248, 250, 252, 0.92);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                }
                .day-details {
                    display: grid;
                    gap: 10px;
                    padding: 16px 18px 18px;
                    border-top: 1px solid rgba(15, 23, 42, 0.08);
                    background: rgba(248, 250, 252, 0.94);
                }
                .day-details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    gap: 12px;
                }
                .day-details-header h3 {
                    margin: 0;
                    font-size: 0.98rem;
                }
                .day-details-header span {
                    font-size: 0.8rem;
                    color: #64748b;
                }
                .day-details-stats {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 8px;
                }
                .day-details-stat {
                    padding: 10px 12px;
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                }
                .day-details-stat-label {
                    display: block;
                    font-size: 0.66rem;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #64748b;
                    margin-bottom: 4px;
                }
                .day-details-stat-value {
                    font-size: 0.92rem;
                    font-weight: 800;
                }
                .day-details-stat-value.income {
                    color: #15803d;
                }
                .day-details-stat-value.expense {
                    color: #b91c1c;
                }
                .day-details-stat-value.net {
                    color: #0f766e;
                }
                .day-details-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: grid;
                    gap: 8px;
                }
                .day-details-list li {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.88);
                    border: 1px solid rgba(15, 23, 42, 0.08);
                }
                .day-details-list-title {
                    font-weight: 700;
                    font-size: 0.9rem;
                }
                .day-details-list-meta {
                    font-size: 0.75rem;
                    color: #64748b;
                    text-transform: capitalize;
                }
                .day-details-list-amount {
                    font-weight: 800;
                    white-space: nowrap;
                    flex: 0 0 auto;
                }
                .day-details-list-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 0 0 auto;
                    margin-left: 8px;
                }
                .day-details-delete {
                    border: 1px solid rgba(185, 28, 28, 0.18);
                    background: rgba(185, 28, 28, 0.06);
                    color: #b91c1c;
                    border-radius: 999px;
                    padding: 5px 10px;
                    font: inherit;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .day-details-delete:hover {
                    background: rgba(185, 28, 28, 0.12);
                }
                .day-details-edit {
                    border: 1px solid rgba(15, 118, 110, 0.18);
                    background: rgba(15, 118, 110, 0.08);
                    color: #0f766e;
                    border-radius: 999px;
                    padding: 5px 10px;
                    font: inherit;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                }
                .day-details-edit:hover {
                    background: rgba(15, 118, 110, 0.14);
                }
                .day-details-empty {
                    margin: 0;
                    color: #64748b;
                    font-size: 0.9rem;
                }
                @media print {
                    :host {
                        color: black;
                    }
                    .layout {
                        grid-template-columns: 1fr;
                        gap: 0;
                    }
                    .summary-rail,
                    .day-details {
                        display: none;
                    }
                    .calendar {
                        box-shadow: none;
                        border: 1px solid #cbd5e1;
                        border-radius: 0;
                        background: white;
                        page-break-inside: avoid;
                    }
                    .month-indicator {
                        padding: 10px 12px 8px;
                        background: white;
                    }
                    .starting-balance,
                    .nav-button {
                        display: none;
                    }
                    .day-of-week > div,
                    .date-grid > div,
                    .weekly-balance-card,
                    .month-end-card {
                        break-inside: avoid;
                    }
                    .day-of-week > div,
                    .date-grid > div {
                        min-height: 70px;
                    }
                    .date-grid > div:hover,
                    .date-grid > div.other-month:hover {
                        background: inherit;
                    }
                    .transaction-badges,
                    .day-balance {
                        bottom: 6px;
                    }
                    .date-grid > div.has-transactions::after {
                        opacity: 0.95;
                    }
                }
                @media (max-width: 700px) {
                    .layout {
                        grid-template-columns: 1fr;
                    }
                    .month-indicator {
                        padding-inline: 12px;
                    }
                    .nav-button {
                        padding: 9px 12px;
                    }
                    .date-grid > div {
                        min-height: 72px;
                    }
                }
            </style>
            <div class="layout">
                <div class="calendar">
                    <header class="month-indicator">
                        <button id="prev-month" class="nav-button">&lt; Prev</button>
                        <div class="month-meta">
                            <div id="month"></div>
                            <div class="starting-balance">
                                <label for="starting-balance-input">Starting Balance</label>
                                <input id="starting-balance-input" type="number" step="0.01" inputmode="decimal" value="0">
                            </div>
                        </div>
                        <button id="next-month" class="nav-button">Next &gt;</button>
                    </header>
                    <section class="day-of-week">
                        <div>Sun</div>
                        <div>Mon</div>
                        <div>Tue</div>
                        <div>Wed</div>
                        <div>Thu</div>
                        <div>Fri</div>
                        <div>Sat</div>
                    </section>
                    <section class="date-grid">
                    </section>
                    <section class="day-details" aria-live="polite"></section>
                </div>
                <aside class="summary-rail" aria-label="Weekly balance summary">
                    <section class="rail-card">
                        <div class="rail-card-header">
                            <h3>Weekly Balance</h3>
                            <span id="weekly-balance-month-label"></span>
                        </div>
                        <div class="weekly-balances" id="weekly-balances"></div>
                    </section>
                    <section class="rail-card month-end-card" id="month-end-card"></section>
                </aside>
            </div>
        `;
        this.updateCalendar();
    }

    addEventListeners() {
        const startingBalanceInput = this.shadowRoot.querySelector('#starting-balance-input');

        this.shadowRoot.querySelector('#prev-month').addEventListener('click', async () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            await this.loadStartingBalanceForCurrentMonth();
            this.updateCalendar();
        });

        this.shadowRoot.querySelector('#next-month').addEventListener('click', async () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            await this.loadStartingBalanceForCurrentMonth();
            this.updateCalendar();
        });

        this.shadowRoot.querySelector('.date-grid').addEventListener('click', (e) => {
            const target = e.target.closest('div');
            if (target && !target.classList.contains('other-month') && target.parentElement.classList.contains('date-grid')) {
                const day = parseInt(target.querySelector('span').textContent, 10);
                const selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
                this.selectedDateKey = this.toDateKey(selectedDate);
                this.updateCalendar();
                this.dispatchEvent(new CustomEvent('date-selected', { detail: { date: selectedDate } }));
            }
        });

        startingBalanceInput.addEventListener('input', () => {
            const monthKey = this.getMonthKey(this.currentDate);
            const amount = parseFloat(startingBalanceInput.value) || 0;
            this.startingBalancesByMonth.set(monthKey, amount);
            void setSetting({
                key: this.getStartingBalanceSettingKey(),
                value: amount,
            });
            this.renderSummaryRail();
        });

        this.shadowRoot.querySelector('.day-details').addEventListener('click', (e) => {
            const editButton = e.target.closest('[data-edit-transaction-id]');
            if (editButton) {
                const transactionId = Number(editButton.dataset.editTransactionId);
                if (!Number.isNaN(transactionId)) {
                    this.dispatchEvent(new CustomEvent('edit-transaction', {
                        detail: { id: transactionId },
                        bubbles: true,
                        composed: true,
                    }));
                }
                return;
            }

            const deleteButton = e.target.closest('[data-delete-transaction-id]');
            if (!deleteButton) {
                return;
            }

            const transactionId = Number(deleteButton.dataset.deleteTransactionId);
            if (!Number.isNaN(transactionId)) {
                this.dispatchEvent(new CustomEvent('delete-transaction', {
                    detail: { id: transactionId },
                    bubbles: true,
                    composed: true,
                }));
            }
        });
    }

    updateCalendar() {
        const month = this.currentDate.getMonth();
        const year = this.currentDate.getFullYear();
        const today = new Date();
        const monthKey = this.getMonthKey(this.currentDate);
        const startingBalanceInput = this.shadowRoot.querySelector('#starting-balance-input');

        const monthYear = this.shadowRoot.querySelector('#month');
        monthYear.textContent = this.currentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
        });

        if (startingBalanceInput) {
            startingBalanceInput.value = String(this.startingBalancesByMonth.get(monthKey) ?? 0);
        }

        const dateGrid = this.shadowRoot.querySelector('.date-grid');
        dateGrid.innerHTML = '';

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        for (let i = firstDay - 1; i >= 0; i--) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('other-month');
            emptyCell.innerHTML = `<span>${daysInPrevMonth - i}</span>`;
            dateGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            const cellDate = new Date(year, month, day);
            const dateKey = this.toDateKey(cellDate);
            const transactionsForDay = this.transactionsByDate.get(dateKey) || [];
            const visibleTransactions = transactionsForDay.slice(0, 2);
            const hiddenCount = Math.max(0, transactionsForDay.length - visibleTransactions.length);

            dayCell.innerHTML = `
                <span>${day}</span>
                ${transactionsForDay.length > 0 ? `
                    <div class="transaction-badges" aria-label="${transactionsForDay.length} transaction${transactionsForDay.length === 1 ? '' : 's'}">
                        ${visibleTransactions.map((transaction) => `
                            <div class="transaction-preview ${transaction.type}">
                                <span class="transaction-preview-name">${this.escapeHtml(transaction.description)}</span>
                                <span class="transaction-preview-amount">${transaction.type === 'expense' ? '-' : '+'}${this.formatCurrency(transaction.amount)}</span>
                            </div>
                        `).join('')}
                        ${hiddenCount > 0 ? `<span class="transaction-more">+${hiddenCount} more</span>` : ''}
                    </div>
                ` : ''}
            `;

            if (transactionsForDay.length > 0) {
                dayCell.classList.add('has-transactions');
            }
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                dayCell.classList.add('today');
            }
            if (dateKey === this.selectedDateKey) {
                dayCell.classList.add('selected');
            }
            dateGrid.appendChild(dayCell);
        }

        this.renderSummaryRail();
        this.renderDayDetails();
    }

    renderSummaryRail() {
        const weeklyBalancesEl = this.shadowRoot.querySelector('#weekly-balances');
        const weeklyMonthLabelEl = this.shadowRoot.querySelector('#weekly-balance-month-label');
        const monthEndCardEl = this.shadowRoot.querySelector('#month-end-card');
        const month = this.currentDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
        });

        if (weeklyMonthLabelEl) {
            weeklyMonthLabelEl.textContent = month;
        }

        const weeklySummaries = this.getWeeklySummaries();
        if (weeklyBalancesEl) {
            weeklyBalancesEl.innerHTML = weeklySummaries.map((weekSummary) => {
                const balanceClass = weekSummary.balance > 0 ? 'income' : weekSummary.balance < 0 ? 'expense' : 'neutral';
                const balancePrefix = weekSummary.balance > 0 ? '+' : weekSummary.balance < 0 ? '-' : '';

                return `
                    <article class="weekly-balance-card">
                        <strong>${weekSummary.label}</strong>
                        <div class="meta">Income ${this.formatCurrency(weekSummary.income)} · Expense ${this.formatCurrency(weekSummary.expense)}</div>
                        <div class="value ${balanceClass}">${balancePrefix}${this.formatCurrency(Math.abs(weekSummary.balance))}</div>
                    </article>
                `;
            }).join('');
        }

        const monthlyTotals = this.getMonthlyTotals();
        const monthlyNet = monthlyTotals.income - monthlyTotals.expense;
        const endingBalance = this.getMonthlyEndingBalance();
        const startingBalance = this.getStartingBalanceForCurrentMonth();
        const balanceDelta = endingBalance - startingBalance;
        const monthStatus = balanceDelta > 0 ? 'surplus' : balanceDelta < 0 ? 'deficit' : 'balance';
        const monthLabel = balanceDelta > 0 ? 'Surplus' : balanceDelta < 0 ? 'Deficit' : 'Balance';

        if (monthEndCardEl) {
            monthEndCardEl.innerHTML = `
                <div class="rail-card-header">
                    <h3>Ending Balance</h3>
                    <span>${month}</span>
                </div>
                <div class="status ${monthStatus}">${monthLabel}</div>
                <div class="value ${monthStatus}">${this.formatCurrency(Math.abs(endingBalance))}</div>
                <div class="subtext">Starting balance ${this.formatCurrency(startingBalance)} · Income ${this.formatCurrency(monthlyTotals.income)} · Expense ${this.formatCurrency(monthlyTotals.expense)} · Difference ${this.formatCurrency(Math.abs(balanceDelta))}.</div>
            `;
        }
    }

    renderDayDetails() {
        const dayDetails = this.shadowRoot.querySelector('.day-details');
        const transactions = this.transactionsByDate.get(this.selectedDateKey) || [];
        const selectedDate = this.parseDateKey(this.selectedDateKey);

        if (!selectedDate) {
            dayDetails.innerHTML = '<p class="day-details-empty">Select a day to see its transactions.</p>';
            return;
        }

        dayDetails.innerHTML = `
            <div class="day-details-header">
                <h3>${this.formatSelectedDate(selectedDate)}</h3>
                <span>${transactions.length} transaction${transactions.length === 1 ? '' : 's'}</span>
            </div>
            ${transactions.length === 0 ? '<p class="day-details-empty">No transactions recorded for this day yet.</p>' : `
                <ul class="day-details-list">
                    ${transactions.map((transaction) => `
                        <li>
                            <div>
                                <div class="day-details-list-title">${this.escapeHtml(transaction.description)}</div>
                                <div class="day-details-list-meta">${this.escapeHtml(transaction.type)}</div>
                            </div>
                            <div class="day-details-list-actions">
                                <div class="day-details-list-amount" style="color: ${transaction.type === 'income' ? '#15803d' : '#b91c1c'}">
                                    ${transaction.type === 'expense' ? '-' : '+'}${this.formatCurrency(transaction.amount)}
                                </div>
                                <button class="day-details-edit" type="button" data-edit-transaction-id="${transaction.id}">Edit</button>
                                <button class="day-details-delete" type="button" data-delete-transaction-id="${transaction.id}">Delete</button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            `}
        `;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(Number(amount) || 0);
    }

    parseDateKey(dateKey) {
        if (!dateKey) {
            return null;
        }

        const [year, month, day] = dateKey.split('-').map(Number);

        if (!year || !month || !day) {
            return null;
        }

        return new Date(year, month - 1, day);
    }

    formatSelectedDate(date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
}

customElements.define('budget-calendar', BudgetCalendar);
