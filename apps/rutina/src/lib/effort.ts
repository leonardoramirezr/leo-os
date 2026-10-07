// A block of work as the user writes it: repetitions at a weight, «15@72kg». The same notation goes
// into the editor's «Último bloque» field and the import's `last_block`, so it reads the forms a
// routine kept elsewhere tends to have, and writes them back in the plainest one.
import type { RutinaBlock } from '@leo-os/shared';

/** Past these, a number is a typo rather than a set. */
const MAX_REPS = 1000;
const MAX_WEIGHT = 1000;

/**
 * One piece of a block: «3x12» (sets × reps) or «12», «10+3» (a rest-pause, counted whole), or «60s»,
 * then «@72kg» when it says the weight. A comma may stand for the decimal point only right before
 * «kg» — «72,5kg» — since elsewhere it separates sets. Sticky: it reads exactly where it is told.
 */
const PIECE =
	/\s*(?:(\d+)\s*x\s*)?(\d+(?:\s*\+\s*\d+)*)\s*(?:segundos|segs?|s|repeticiones|reps?)?\s*(?:@\s*(\d+(?:\.\d+)?(?:,\d{1,2}(?=\s*k))?)\s*(?:kgs?|kilos?|k)?)?\s*[,;/]?/y;

/**
 * The sets a block of work stands for. «15@72kg» is one set of 15 with 72 kg; «15,15,12@72kg» three
 * at 72 kg; «10,(10+3)@40kg» two, the second of 13; «3x12@20kg» three of 12; «12», 12 with no
 * weight. A weight goes for the sets written before it that have none. Whatever follows the
 * numbers — «6,6,7@14kg mala técnica» — is a note, and is left out.
 *
 * Gives back `undefined` when it cannot make out a single set.
 */
export function parseBlocks(text: string): RutinaBlock[] | undefined {
	const source = text.toLowerCase().replace(/[()]/g, ' ').replace(/×/g, 'x');
	const blocks: RutinaBlock[] = [];
	let pending: number[] = [];
	let weight = 0;

	for (let at = 0; ; ) {
		PIECE.lastIndex = at;
		const match = PIECE.exec(source);
		if (!match || PIECE.lastIndex === at) break;
		at = PIECE.lastIndex;

		const reps = match[2].split('+').reduce((sum, part) => sum + Number(part), 0);
		const sets = Math.min(Number(match[1] ?? 1), 20);
		for (let set = 0; set < sets; set++) pending.push(reps);

		if (match[3] !== undefined) {
			weight = Number(match[3].replace(',', '.'));
			blocks.push(...pending.map((reps) => ({ reps, weight })));
			pending = [];
		}
	}
	// Sets written after the last weight keep it: «15@72, 12» is two sets at 72 kg.
	blocks.push(...pending.map((reps) => ({ reps, weight })));

	const valid = blocks.filter(
		({ reps, weight }) => reps >= 1 && reps <= MAX_REPS && weight >= 0 && weight <= MAX_WEIGHT
	);
	return valid.length ? valid : undefined;
}

/** «72», «72.5», «2.25»: the weight as written, with no zeros trailing. */
export function formatWeight(weight: number): string {
	return String(Math.round(weight * 100) / 100);
}

/**
 * The plainest way to write the sets back: runs of one weight share it, «15,15,12@72kg». A block
 * that mixes sets with and without weight spells the zero out, so that reading it back gives the
 * same sets.
 */
export function blocksText(blocks: RutinaBlock[]): string {
	const runs: { reps: number[]; weight: number }[] = [];
	for (const block of blocks) {
		const run = runs.at(-1);
		if (run && run.weight === block.weight) run.reps.push(block.reps);
		else runs.push({ reps: [block.reps], weight: block.weight });
	}

	const weighted = runs.some((run) => run.weight > 0);
	return runs
		.map((run) => run.reps.join(',') + (weighted ? `@${formatWeight(run.weight)}kg` : ''))
		.join(', ');
}

/** One set for the screen: «15 @ 72 kg», «12» with no weight, «60 s» against the clock. */
export function blockLabel(block: RutinaBlock, timed: boolean): string {
	const amount = timed ? `${block.reps} s` : String(block.reps);
	return block.weight > 0 ? `${amount} @ ${formatWeight(block.weight)} kg` : amount;
}

/** Same reps, same weight. */
export function sameBlock(a: RutinaBlock, b: RutinaBlock): boolean {
	return a.reps === b.reps && a.weight === b.weight;
}

/** Repetitions times kilograms. Seconds count as repetitions: a plank's work is its time. */
export function volumeOf(blocks: RutinaBlock[]): number {
	return blocks.reduce((sum, block) => sum + block.reps * block.weight, 0);
}
