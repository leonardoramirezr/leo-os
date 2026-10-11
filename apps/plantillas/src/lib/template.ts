// What a template is made of. Its body is plain text in which every `[[[question]]]` is a blank:
// filling it in puts the answer where the blank was.
//
// The same question asked twice is one blank, answered once and put in both places: a template that
// names the subject at the start and again at the end asks for it only once.

/** A piece of a template's body: text as it is, or a blank and the question it asks. */
export type Part = { text: string } | { question: string };

/** Three brackets on each side, and anything but a closing bracket run between them. */
const BLANK = /\[\[\[([\s\S]*?)\]\]\]/g;

/** The question a blank asks, as it is shown and as its answer is filed under. */
function questionOf(raw: string): string {
	return raw.replace(/\s+/g, ' ').trim();
}

/** The body in pieces, in order. A blank with nothing between its brackets is left as text. */
export function parse(body: string): Part[] {
	const parts: Part[] = [];
	let last = 0;

	for (const match of body.matchAll(BLANK)) {
		const question = questionOf(match[1]);
		if (!question) continue;

		if (match.index > last) parts.push({ text: body.slice(last, match.index) });
		parts.push({ question });
		last = match.index + match[0].length;
	}
	if (last < body.length) parts.push({ text: body.slice(last) });
	return parts;
}

/** Every question the body asks, once each, in the order they first come up. */
export function questions(body: string): string[] {
	const asked = parse(body).flatMap((part) => ('question' in part ? [part.question] : []));
	return [...new Set(asked)];
}

/** The prompt itself: the body with every blank replaced by its answer, or by nothing if it has none. */
export function render(body: string, answers: Record<string, string>): string {
	return parse(body)
		.map((part) => ('question' in part ? (answers[part.question] ?? '').trim() : part.text))
		.join('');
}

/** Cuts a text to about `length` characters, at a space where there is one. */
export function shorten(text: string, length: number): string {
	if (text.length <= length) return text;
	const cut = text.slice(0, length - 1);
	const space = cut.lastIndexOf(' ');
	return `${(space > length / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '')}…`;
}
