// Leo Partī's files are in a private bucket of the Neon project, and the browser reaches it through
// addresses the database signs: one to upload each file of a post of the account's own, for that
// file's type and exact size, and one to read each file of a post whose link it has
// (db/migrations/0007_leogram_public.sql). The key to the bucket never leaves the database, and
// nothing stands in between: the file goes straight from the device to the bucket.

/** Where to upload a file, as `leogram_upload()` and `leogram_upload_avatar()` give it. */
export interface Signed {
	/** Takes a PUT of the file, with `headers`, for the next hour. */
	url: string;
	headers: Record<string, string>;
	/** Where to delete the file this one replaces; null when it replaces none. */
	drop: string | null;
}

/**
 * Sends a file where it was signed for, telling how many of its bytes have gone. XMLHttpRequest
 * and not fetch: fetch cannot tell how an upload is going.
 */
export function send(signed: Signed, file: Blob, progress?: (sent: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open('PUT', signed.url);
		for (const [name, value] of Object.entries(signed.headers)) request.setRequestHeader(name, value);
		request.upload.addEventListener('progress', (event) => progress?.(event.loaded));
		request.addEventListener('load', () => {
			if (request.status >= 200 && request.status < 300) resolve();
			else reject(new Error(`El almacenamiento respondió ${request.status}.`));
		});
		request.addEventListener('error', () => reject(new Error('Sin conexión con el almacenamiento.')));
		request.addEventListener('abort', () => reject(new Error('Se canceló la subida.')));
		request.send(file);
	});
}

/**
 * Deletes files at the addresses the database signed for that, without waiting for it: one that
 * does not go now goes at the next deploy, which deletes whatever nothing points to any more
 * (db/storage.mjs).
 */
export function drop(urls: readonly (string | null | undefined)[]) {
	for (const url of urls) {
		if (url) fetch(url, { method: 'DELETE' }).catch(() => {});
	}
}
