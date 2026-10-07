// Every workout done: the day of which routine, when, and each set as it was done. A session is
// saved whole after every set, so a workout the phone cuts short keeps what was done until then.
//
// A gym is as likely as not to have no signal. A session the database did not get stays on the
// device as pending, and goes again every time the app opens — and with every set after it — until
// it does: reading the database over it never loses it.
//
// They are what the expected efforts, the first and last blocks and the statistics come from.
import {
	eq,
	pull,
	push,
	readCache,
	remove,
	select,
	sync,
	upsert,
	writeCache,
	type RutinaSessionRow
} from '@leo-os/shared';
import { parseSets, type Session } from './routine';

const TABLE = 'rutina_sessions';
const COLUMNS = 'id,routine_id,day_id,started_at,ended_at,finished,sets';

/** What this account's sessions look like on the device, so the app opens without waiting. */
const CACHE = 'rutina:sessions';

/** The sessions written on the device that the database has not confirmed yet. */
const PENDING = 'rutina:pending';

/**
 * Every app shares the few megabytes localStorage has. Years of workouts would fit, but past this
 * many characters the copy on the device is dropped rather than crowd the other apps out: the
 * sessions are read from the database instead.
 */
const CACHE_LIMIT = 1_500_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function number(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parse(raw: unknown): Session[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === 'string' ? item.id : '';
		const routineId = typeof item.routineId === 'string' ? item.routineId : '';
		const dayId = typeof item.dayId === 'string' ? item.dayId : '';
		if (!id || !routineId || !dayId) return [];
		return [
			{
				id,
				routineId,
				dayId,
				startedAt: number(item.startedAt),
				endedAt: number(item.endedAt),
				finished: item.finished === true,
				sets: parseSets(item.sets)
			}
		];
	});
}

function sessionOf(row: RutinaSessionRow) {
	return {
		id: row.id,
		routineId: row.routine_id,
		dayId: row.day_id,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		finished: row.finished,
		sets: row.sets
	};
}

function rowOf(session: Session) {
	return {
		id: session.id,
		routine_id: session.routineId,
		day_id: session.dayId,
		started_at: session.startedAt,
		ended_at: session.endedAt,
		finished: session.finished,
		sets: session.sets
	};
}

/** Postgres' code for a row pointing at one that is not there: the session's routine was deleted. */
const ORPHAN = '23503';

class Sessions {
	list = $state<Session[]>([]);

	#account = '';
	#version = 0;
	#pending: Session[] = [];

	find(id: string | undefined): Session | undefined {
		return id ? this.list.find((session) => session.id === id) : undefined;
	}

	/** A routine's sessions, oldest first. */
	of(routineId: string): Session[] {
		return this.list
			.filter((session) => session.routineId === routineId)
			.toSorted((a, b) => a.startedAt - b.startedAt);
	}

	async load(userId: string) {
		this.#account = userId;
		this.#pending = parse(readCache(PENDING, userId));
		this.list = this.#merge(parse(readCache(CACHE, userId)));
		await this.#read();
		// What the database did not get last time goes now.
		for (const session of this.#pending) this.#push(() => this.#send(session));
	}

	refresh() {
		if (this.#account && sync.pending === 0) this.#read();
	}

	/** Adds the session or replaces the one it was: the whole of it goes every time. */
	save(session: Session) {
		const copy = $state.snapshot(session) as Session;
		const index = this.list.findIndex((candidate) => candidate.id === session.id);
		if (index >= 0) this.list[index] = copy;
		else this.list.push(copy);
		this.#setPending([...this.#pending.filter((pending) => pending.id !== copy.id), copy]);
		this.#push(() => this.#send(copy));
	}

	remove(id: string) {
		this.list = this.list.filter((session) => session.id !== id);
		this.#setPending(this.#pending.filter((pending) => pending.id !== id));
		this.#push(() => remove(TABLE, eq('id', id)));
	}

	/** A routine deleted takes its sessions along in the database; this drops the copy on screen. */
	forget(routineId: string) {
		this.list = this.list.filter((session) => session.routineId !== routineId);
		this.#setPending(this.#pending.filter((pending) => pending.routineId !== routineId));
		this.#keep();
	}

	/** Sends a session; once the database has it, it is no longer pending — unless it changed since. */
	async #send(session: Session) {
		try {
			await upsert(TABLE, rowOf(session));
		} catch (thrown) {
			// Its routine was deleted, on another device say: there is nowhere left to put it.
			if ((thrown as { code?: string } | null)?.code !== ORPHAN) throw thrown;
		}
		this.#setPending(this.#pending.filter((pending) => pending !== session));
	}

	/** The database's sessions, with the pending ones over them: those are newer. */
	#merge(sessions: Session[]): Session[] {
		const pending = new Map(this.#pending.map((session) => [session.id, session]));
		return [...sessions.filter((session) => !pending.has(session.id)), ...pending.values()];
	}

	#setPending(pending: Session[]) {
		this.#pending = pending;
		if (this.#account) writeCache(PENDING, this.#account, pending);
	}

	#push(run: () => Promise<void>) {
		this.#version++;
		this.#keep();
		push(run, () => this.#read());
	}

	async #read() {
		const version = this.#version;
		const rows = await pull(() => select<RutinaSessionRow>(TABLE, COLUMNS));
		if (!rows || version !== this.#version) return;

		this.list = this.#merge(parse(rows.map(sessionOf)));
		this.#keep();
	}

	#keep() {
		if (this.#account) writeCache(CACHE, this.#account, $state.snapshot(this.list), CACHE_LIMIT);
	}
}

export const sessions = new Sessions();
