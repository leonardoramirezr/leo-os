// A card rendered by Anki's templates is HTML made for Anki's reviewer: styled, scripted, full of
// images and audio. Repaso's cards are plain text, so this reads what that HTML would show as text.
//
// It is parsed inside a <template>, whose contents are inert: nothing in it loads, nothing in it
// runs, and none of it ever reaches the page. What leaves is a string.
import { FIELD_END, FIELD_START, SECTION_END, SECTION_START } from './template';

/** Never shown as text: code, styling, media, controls, and what the reviewer keeps out of sight. */
const REMOVED =
	'script, style, template, noscript, link, meta, base, title, iframe, object, embed, img, picture, ' +
	'video, audio, source, track, svg, canvas, map, input, textarea, select, button, [hidden]';

/** Each on lines of its own, as a browser lays them out. */
const BLOCKS = new Set([
	'address', 'article', 'aside', 'blockquote', 'caption', 'center', 'dd', 'details', 'dialog', 'div',
	'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
	'header', 'hgroup', 'hr', 'legend', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary',
	'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul'
]);

/** Labels: kept on the back although every card says the same, when what they label is there. */
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'th', 'summary', 'caption', 'legend']);

const MARKER = /[\uE000-\uE003]/;
const MARKERS = /[\uE000-\uE003]/g;
/** Something to read: neither a space nor a marker. */
const VISIBLE = /[^\s\uE000-\uE003]/;
const SOUND = /\[sound:[^\]]*\]/g;
const HIDING = /display\s*:\s*none|visibility\s*:\s*hidden/i;

const SUPERSCRIPT = table('0123456789+-=()n', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ');
const SUBSCRIPT = table('0123456789+-=()', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎');

function table(from: string, to: string): Record<string, string> {
	return Object.fromEntries([...from].map((char, index) => [char, [...to][index]]));
}

/**
 * The selectors a note type's CSS hides outright (`.json-src { display: none }`), outside any
 * @media or @supports: those depend on where Anki runs, which is nowhere here. Checked once, so that
 * a selector this browser does not understand is left out rather than failing every card.
 */
export function hiddenBy(css: string): string {
	const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
	let topLevel = '';
	let depth = 0;
	let atRule = false;
	for (const char of flat) {
		if (char === '@' && depth === 0) atRule = true;
		if (char === '{') depth++;
		if (!atRule) topLevel += char;
		if (char === '}') {
			depth--;
			if (depth === 0) atRule = false;
		} else if (char === ';' && depth === 0) {
			// An @import or an @charset ends at its semicolon.
			atRule = false;
		}
	}

	const probe = document.createDocumentFragment();
	const selectors: string[] = [];
	for (const [, list, body] of topLevel.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!HIDING.test(body)) continue;
		for (const selector of list.split(',').map((part) => part.trim())) {
			if (!selector || selector.includes('::')) continue;
			try {
				probe.querySelector(selector);
				selectors.push(selector);
			} catch {
				// Something this browser's selectors cannot say: it hides nothing here.
			}
		}
	}
	return selectors.join(', ');
}

export interface Plain {
	text: string;
	/** Whether any of it is the note's own: a field's text, not what the template adds to every card. */
	own: boolean;
}

/**
 * The text of one side of a card. On the back, the lines that every card has alike — the deck's
 * credits, the label of a field left empty, a row of dashes — go too: they say nothing about this
 * card. The front keeps them, as a prompt such as «Translate:» is one of them.
 */
export function toText(html: string, hidden: string, side: 'question' | 'answer'): Plain {
	const template = document.createElement('template');
	// `card` is the class Anki's reviewer gives the page, which the note type's CSS may count on.
	template.innerHTML = `<div class="card">${html.replace(SOUND, '')}</div>`;
	const root = template.content;
	const wrapper = root.firstElementChild;
	const drop = (element: Element) => element !== wrapper && element.remove();

	root.querySelectorAll(REMOVED).forEach(drop);
	for (const element of root.querySelectorAll('[style]')) {
		if (HIDING.test(element.getAttribute('style') ?? '')) drop(element);
	}
	if (hidden) {
		// The markers only mean something in text: in an attribute they would spoil a class name.
		for (const element of root.querySelectorAll('*')) {
			for (const attribute of element.attributes) {
				if (MARKER.test(attribute.value)) attribute.value = attribute.value.replace(MARKERS, '');
			}
		}
		root.querySelectorAll(hidden).forEach(drop);
	}

	// Which elements hold something of this card: its fields' text, or a section its fields opened.
	const holding = new Set<Node>();
	walkText(root, (node, field, section) => {
		if (!field && !section) return;
		for (let parent = node.parentNode; parent && !holding.has(parent); parent = parent.parentNode) {
			holding.add(parent);
		}
	});

	// A link that holds nothing of the card is the template's: a logo, a dictionary, the author's site.
	for (const link of root.querySelectorAll('a')) if (!holding.has(link)) link.remove();
	// A heading over something of the card stays on the back as if it were the card's own.
	if (side === 'answer') {
		for (const heading of root.querySelectorAll([...HEADINGS].join(', '))) {
			if (holding.has(heading) || !heading.parentNode || !holding.has(heading.parentNode)) continue;
			heading.prepend(SECTION_START);
			heading.append(SECTION_END);
		}
	}

	return lines(read(root), side);
}

/** Drops the back's lines with nothing of the card on them, and the markers from what is left. */
function lines(text: string, side: 'question' | 'answer'): Plain {
	let own = false;
	const depth = { fields: 0, sections: 0 };
	const kept: string[] = [];

	for (const line of text.split('\n')) {
		const { field, section } = scan(line, depth);
		if (field) own = true;
		const visible = line.replace(MARKERS, '');
		// Empty lines stay: they are the gaps between paragraphs.
		if (side === 'question' || field || section || !visible.trim()) kept.push(visible);
	}
	return { text: tidy(kept.join('\n')), own };
}

/**
 * Whether the text has anything to read inside a field, and inside a section, moving `depth` on past
 * the markers in it. A marker may open in one piece of text and close in another.
 */
function scan(text: string, depth: { fields: number; sections: number }) {
	let field = false;
	let section = false;
	let last = 0;
	for (const marker of text.matchAll(MARKERS)) {
		if (/\S/.test(text.slice(last, marker.index))) {
			field ||= depth.fields > 0;
			section ||= depth.sections > 0;
		}
		last = marker.index + 1;
		const char = marker[0];
		if (char === FIELD_START) depth.fields++;
		else if (char === FIELD_END) depth.fields = Math.max(0, depth.fields - 1);
		else if (char === SECTION_START) depth.sections++;
		else depth.sections = Math.max(0, depth.sections - 1);
	}
	if (/\S/.test(text.slice(last))) {
		field ||= depth.fields > 0;
		section ||= depth.sections > 0;
	}
	return { field, section };
}

function textNodes(root: DocumentFragment): Text[] {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	while (walker.nextNode()) nodes.push(walker.currentNode as Text);
	return nodes;
}

/** Goes through the text in document order, telling of each piece what `scan` tells. */
function walkText(root: DocumentFragment, visit: (node: Text, field: boolean, section: boolean) => void) {
	const depth = { fields: 0, sections: 0 };
	for (const node of textNodes(root)) {
		const { field, section } = scan(node.data, depth);
		visit(node, field, section);
	}
}

/**
 * What a browser would show, laid out roughly as `innerText` does: blocks on lines of their own,
 * runs of spaces as one, list items with a bullet, table cells side by side, readings in brackets.
 */
function read(root: DocumentFragment): string {
	// Strings, and the number of line breaks a block asks for around it.
	const out: (string | number)[] = [];

	const visit = (node: Node, pre: boolean) => {
		if (node instanceof Text) {
			out.push(pre ? node.data : node.data.replace(/[\t\n\r ]+/g, ' '));
			return;
		}
		if (!(node instanceof Element)) {
			for (const child of node.childNodes) visit(child, pre);
			return;
		}

		const tag = node.localName;
		if (tag === 'rp') return;
		if (tag === 'br') {
			out.push('\n');
			return;
		}

		const breaks = tag === 'p' ? 2 : BLOCKS.has(tag) ? 1 : 0;
		// A term and its definition read best on one line: «On: イチ、イツ».
		const term = tag === 'dt' && node.nextElementSibling?.localName === 'dd';
		const definition = tag === 'dd' && node.previousElementSibling?.localName === 'dt';
		if (breaks && !definition) out.push(breaks);
		if (tag === 'li') out.push('• ');
		if ((tag === 'td' || tag === 'th') && node.previousElementSibling) out.push(' · ');
		if (tag === 'rt') out.push('（');

		const small = tag === 'sup' || tag === 'sub' ? (node.textContent ?? '') : '';
		if (/^[\d+\-=()n]+$/.test(small)) {
			// H₂O and x², rather than H2O and x2.
			const map = tag === 'sup' ? SUPERSCRIPT : SUBSCRIPT;
			out.push([...small].map((char) => map[char] ?? char).join(''));
		} else {
			for (const child of node.childNodes) visit(child, pre || tag === 'pre');
		}

		if (tag === 'rt') out.push('）');
		if (term) out.push(/[:：]\s*$/.test(node.textContent ?? '') ? ' ' : ': ');
		else if (breaks) out.push(breaks);
	};
	visit(root, false);

	let text = '';
	let started = false;
	let pending = 0;
	for (const item of out) {
		if (typeof item === 'number') {
			pending = Math.max(pending, item);
		} else if (item === '\n' || VISIBLE.test(item)) {
			// Breaks count only between things to read: none at the start, and none at the end.
			if (pending && started) text += '\n'.repeat(pending);
			pending = 0;
			started ||= item !== '\n';
			text += item;
		} else {
			// Spaces, or markers with nothing to read: the markers always, the spaces unless a break is due.
			text += pending ? item.replace(/[^\uE000-\uE003]/g, '') : item;
		}
	}
	return text;
}

function tidy(text: string): string {
	return text
		.replace(/ /g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
