// Reads a zip archive straight from a File. Only the directory at the end and the entries asked for
// are ever read: a shared deck can carry hundreds of megabytes of images and audio, which never have
// to fit in memory to get at the few megabytes of cards.

export interface ZipEntry {
	name: string;
	/** 0 is stored as is, 8 is deflate. */
	method: number;
	compressedSize: number;
	size: number;
	/** Where the entry's own header starts. */
	offset: number;
}

export class ZipError extends Error {
	constructor(message = 'Not a zip archive') {
		super(message);
		this.name = 'ZipError';
	}
}

const END = 0x06054b50;
const END64 = 0x06064b50;
const LOCATOR64 = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

async function bytes(file: Blob, start: number, end: number): Promise<DataView> {
	if (start < 0 || end > file.size || start > end) throw new ZipError();
	return new DataView(await file.slice(start, end).arrayBuffer());
}

function u64(view: DataView, at: number): number {
	return Number(view.getBigUint64(at, true));
}

/** Every entry in the archive, by name. */
export async function readEntries(file: Blob): Promise<Map<string, ZipEntry>> {
	// The end record is 22 bytes plus a comment of up to 64 KiB, with the zip64 locator before it.
	const tailStart = Math.max(0, file.size - (22 + 0xffff + 20));
	const tail = await bytes(file, tailStart, file.size);

	let end = -1;
	for (let at = tail.byteLength - 22; at >= 0; at--) {
		if (tail.getUint32(at, true) === END) {
			end = at;
			break;
		}
	}
	if (end < 0) throw new ZipError();

	let count = tail.getUint16(end + 10, true);
	let directorySize = tail.getUint32(end + 12, true);
	let directoryStart = tail.getUint32(end + 16, true);

	// Past 65 535 entries — a deck with that many images — the real numbers are in the zip64 record.
	if (count === 0xffff || directorySize === 0xffffffff || directoryStart === 0xffffffff) {
		const locator = end - 20;
		if (locator < 0 || tail.getUint32(locator, true) !== LOCATOR64) throw new ZipError();
		const recordStart = u64(tail, locator + 8);
		const record = await bytes(file, recordStart, recordStart + 56);
		if (record.getUint32(0, true) !== END64) throw new ZipError();
		count = u64(record, 32);
		directorySize = u64(record, 40);
		directoryStart = u64(record, 48);
	}

	const directory = await bytes(file, directoryStart, directoryStart + directorySize);
	const decoder = new TextDecoder();
	const entries = new Map<string, ZipEntry>();

	let at = 0;
	for (let index = 0; index < count; index++) {
		if (at + 46 > directory.byteLength || directory.getUint32(at, true) !== CENTRAL) {
			throw new ZipError();
		}
		const nameLength = directory.getUint16(at + 28, true);
		const extraLength = directory.getUint16(at + 30, true);
		const commentLength = directory.getUint16(at + 32, true);
		const entry: ZipEntry = {
			name: decoder.decode(
				new Uint8Array(directory.buffer, directory.byteOffset + at + 46, nameLength)
			),
			method: directory.getUint16(at + 10, true),
			compressedSize: directory.getUint32(at + 20, true),
			size: directory.getUint32(at + 24, true),
			offset: directory.getUint32(at + 42, true)
		};

		// Whatever did not fit in 32 bits is in the zip64 extra field, in this order.
		let extra = at + 46 + nameLength;
		const extraEnd = extra + extraLength;
		while (extra + 4 <= extraEnd) {
			const id = directory.getUint16(extra, true);
			const length = directory.getUint16(extra + 2, true);
			if (id === 0x0001) {
				let field = extra + 4;
				if (entry.size === 0xffffffff) {
					entry.size = u64(directory, field);
					field += 8;
				}
				if (entry.compressedSize === 0xffffffff) {
					entry.compressedSize = u64(directory, field);
					field += 8;
				}
				if (entry.offset === 0xffffffff) entry.offset = u64(directory, field);
			}
			extra += 4 + length;
		}

		entries.set(entry.name, entry);
		at = extraEnd + commentLength;
	}

	return entries;
}

/** The entry's contents, uncompressed. */
export async function readEntry(file: Blob, entry: ZipEntry): Promise<Uint8Array> {
	// The entry's own header may carry an extra field of a different length than the directory says.
	const header = await bytes(file, entry.offset, entry.offset + 30);
	if (header.getUint32(0, true) !== LOCAL) throw new ZipError();
	const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
	const data = file.slice(start, start + entry.compressedSize);

	if (entry.method === 0) return new Uint8Array(await data.arrayBuffer());
	if (entry.method !== 8) throw new ZipError(`Unsupported compression method ${entry.method}`);

	if (typeof DecompressionStream === 'undefined') throw new ZipError('No DecompressionStream');
	const stream = data.stream().pipeThrough(new DecompressionStream('deflate-raw'));
	const contents = new Uint8Array(await new Response(stream).arrayBuffer());
	if (contents.byteLength !== entry.size) throw new ZipError('Truncated entry');
	return contents;
}
