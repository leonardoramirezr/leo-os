// A post's code: the key of its row and the `?p=` of its link, eleven characters like those of an
// Instagram link. They are 66 random bits, so nobody comes across a post by trying codes.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function newCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(11));
	return Array.from(bytes, (byte) => ALPHABET[byte & 63]).join('');
}

/** Whether a `?p=` can be a post's code at all: anything else is not worth asking the database. */
export function isCode(value: string | null): value is string {
	return value !== null && /^[A-Za-z0-9_-]{11}$/.test(value);
}

/** The link that opens the post for anybody: this app's address with the code. */
export function linkOf(code: string): string {
	const url = new URL(location.pathname, location.origin);
	url.searchParams.set('p', code);
	return url.href;
}

/** The `uuid` a comment is keyed by. */
export function newId(): string {
	if (crypto.randomUUID) return crypto.randomUUID();

	// Safari only offers randomUUID over HTTPS. Same shape, drawn by hand.
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
