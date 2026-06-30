const dbName = 'BudgetDB';
const dbVersion = 2;

let db;

function withDB(work) {
    return openDB().then((database) => work(database));
}

export function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => {
            reject('Error opening IndexedDB: ' + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('transactions')) {
                const objectStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

export function addTransaction(transaction) {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('transactions', 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.add(transaction);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error adding transaction: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error adding transaction: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error adding transaction: ' + event.target.errorCode);
        }).catch(reject);
    });
}

export function getTransactionsByDate(date) {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('transactions', 'readonly');
            const store = tx.objectStore('transactions');
            const index = store.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error getting transactions: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error getting transactions: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error getting transactions: ' + event.target.errorCode);
        }).catch(reject);
    });
}

export function getAllTransactions() {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('transactions', 'readonly');
            const store = tx.objectStore('transactions');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error getting all transactions: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error getting all transactions: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error getting all transactions: ' + event.target.errorCode);
        }).catch(reject);
    });
}

export function deleteTransaction(id) {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('transactions', 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject('Error deleting transaction: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error deleting transaction: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error deleting transaction: ' + event.target.errorCode);
        }).catch(reject);
    });
}

export function updateTransaction(transaction) {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('transactions', 'readwrite');
            const store = tx.objectStore('transactions');
            const request = store.put(transaction);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error updating transaction: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error updating transaction: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error updating transaction: ' + event.target.errorCode);
        }).catch(reject);
    });
}

export function getSetting(key) {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('settings', 'readonly');
            const store = tx.objectStore('settings');
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => reject('Error getting setting: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error getting setting: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error getting setting: ' + event.target.errorCode);
        }).catch(reject);
    });
}

export function setSetting(setting) {
    return new Promise((resolve, reject) => {
        withDB((db) => {
            const tx = db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const request = store.put(setting);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject('Error saving setting: ' + event.target.errorCode);
            tx.onerror = (event) => reject('Error saving setting: ' + event.target.errorCode);
            tx.onabort = (event) => reject('Error saving setting: ' + event.target.errorCode);
        }).catch(reject);
    });
}
