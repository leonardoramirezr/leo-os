// Tiny key-value store on IndexedDB: conversations hold images, which are too large for localStorage.

const STORE = 'kv';

let connection: Promise<IDBDatabase> | undefined;

function open() {
	connection ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open('willchat', 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	}).catch((error) => {
		connection = undefined;
		throw error;
	});
	return connection;
}

async function run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
	const db = await open();
	return new Promise<T>((resolve, reject) => {
		const transaction = db.transaction(STORE, mode);
		const request = operation(transaction.objectStore(STORE));
		transaction.oncomplete = () => resolve(request.result);
		transaction.onerror = transaction.onabort = () => reject(transaction.error);
	});
}

export function get<T>(key: string) {
	return run<T | undefined>('readonly', (store) => store.get(key));
}

export function set(key: string, value: unknown) {
	return run('readwrite', (store) => store.put(value, key));
}

export function del(key: string) {
	return run('readwrite', (store) => store.delete(key));
}
