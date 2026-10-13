import { prepareImage } from './images';

/** A file picked for a mini app, ready to be sent. */
export interface PickedFile {
	id: string;
	name: string;
	type: string;
	/** A data URL; an image comes scaled down, as the chat sends photos. Empty for a text file. */
	url: string;
	/** A text file goes as its text: the API takes documents such as PDFs as files, not plain text. */
	text?: string;
	/** Still being read. Never stored. */
	reading?: boolean;
}

/** What the API takes in a file, and more than a phone should be holding in a request. */
export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export class FileTooLargeError extends Error {}

const TEXT_TYPES = /^text\/|^application\/(json|xml|javascript|x-yaml|yaml|x-sh|sql|csv|x-ndjson)/;
const TEXT_EXTENSIONS = /\.(txt|md|markdown|csv|tsv|json|xml|ya?ml|html?|css|js|ts|py|sql|log|srt|vtt)$/i;

export async function readPicked(file: File): Promise<Omit<PickedFile, 'id'>> {
	if (file.type.startsWith('image/')) {
		const url = await prepareImage(file);
		return { name: file.name, type: url.slice(5, url.indexOf(';')), url };
	}
	if (file.size > MAX_FILE_SIZE) throw new FileTooLargeError();
	if (TEXT_TYPES.test(file.type) || TEXT_EXTENSIONS.test(file.name)) {
		return { name: file.name, type: file.type || 'text/plain', url: '', text: await file.text() };
	}
	return { name: file.name, type: file.type || 'application/octet-stream', url: await dataUrl(file) };
}

function dataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
