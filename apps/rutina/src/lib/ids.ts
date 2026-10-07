function randomBytes(count: number): Uint8Array {
	const bytes = new Uint8Array(count);
	const crypto = globalThis.crypto;
	if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
	else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	return bytes;
}

/** The `uuid` the tables are keyed by. */
export function newId(): string {
	const crypto = globalThis.crypto;
	if (crypto?.randomUUID) return crypto.randomUUID();

	// Safari only offers randomUUID over HTTPS. Same shape, drawn by hand.
	const bytes = randomBytes(16);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Ten random characters: enough for the days and exercises inside one routine's row. */
export function shortId(): string {
	const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
	return [...randomBytes(10)].map((byte) => alphabet[byte % alphabet.length]).join('');
}
