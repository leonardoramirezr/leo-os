// Where the answers live on the device: IndexedDB, which keeps them for good and does not crowd the
// few megabytes of localStorage every app shares. Keys start with the schema and the account, so a
// preview and the published site, or two people on the same phone, never read each other's.
//
// Never throws: with site data blocked there is no store, and the answers live on in memory and in
// the database.

const NAME = 'plantillas';
const STORE = 'answers';

let connection: Promise<IDBDatabase> | undefined;

function open() {
	connection ??= new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(NAME, 1);
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

/** Every value whose key starts with `prefix`. */
export async function all(prefix: string): Promise<unknown[]> {
	try {
		return await run('readonly', (store) => store.getAll(IDBKeyRange.bound(prefix, `${prefix}￿`)));
	} catch {
		return [];
	}
}

/** Says whether it made it. */
export async function put(key: string, value: unknown): Promise<boolean> {
	try {
		await run('readwrite', (store) => store.put(value, key));
		return true;
	} catch {
		return false;
	}
}

export async function remove(key: string): Promise<void> {
	try {
		await run('readwrite', (store) => store.delete(key));
	} catch {
		// Nothing stored to begin with.
	}
}
