// What becomes of a table's image: shared from a phone, which is how it reaches Photos or a chat;
// downloaded on a computer; or copied, to paste wherever it goes.
//
// Safari only lets `navigator.share` and the clipboard through right after a tap, with nothing
// awaited in between: the image is drawn before the tap, and the tap only hands it over.

/** The file the image is saved as, named after the table. */
export function fileOf(blob: Blob, title: string): File {
	const name =
		title
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'tabla';
	return new File([blob], `${name}.png`, { type: 'image/png' });
}

/** Whether this is a phone or a tablet that can hand the image to the share sheet. */
export function canShare(file: File): boolean {
	return matchMedia('(pointer: coarse)').matches && Boolean(navigator.canShare?.({ files: [file] }));
}

/** Opens the share sheet where there is one, and downloads the file elsewhere. */
export async function saveImage(file: File) {
	if (canShare(file)) {
		try {
			await navigator.share({ files: [file] });
			return;
		} catch (error) {
			// Closed without picking anything: nothing else was wanted.
			if (error instanceof DOMException && error.name === 'AbortError') return;
		}
	}

	const url = URL.createObjectURL(file);
	const link = document.createElement('a');
	link.href = url;
	link.download = file.name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function canCopyImage(): boolean {
	return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';
}

/** Puts the image on the clipboard. Throws when the browser refuses. */
export async function copyImage(blob: Blob) {
	await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
