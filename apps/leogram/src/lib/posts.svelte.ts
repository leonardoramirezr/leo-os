// The account's own posts: the grid it sees of them, and what it takes to publish one. A post is
// public the moment it is saved, to whoever is given its link, and to nobody else.
import {
	insert,
	pull,
	push,
	readCache,
	select,
	writeCache,
	type LeogramMusic,
	type LeogramPostRow
} from '@leo-os/shared';
import { newCode } from './code';
import { load, slide, thumbnail, type Aspect, type Focus } from './images';
import type { CatalogSong } from './music/catalog';
import { cutClip, type Upload } from './music/clip';
import { removePost, SONG } from './post';

const TABLE = 'leogram_posts';
const CACHE = 'leogram-posts';

/** What the grid reads of each post: everything but its files. */
const COLUMNS = 'id,caption,aspect,slides,music,thumb,created_at';
export type OwnPost = Pick<
	LeogramPostRow,
	'id' | 'caption' | 'aspect' | 'slides' | 'music' | 'thumb' | 'created_at'
>;

/**
 * The thumbnails make the copy on the device heavy, and localStorage is a few megabytes the whole
 * site shares: past this many characters it is not kept, and the grid waits for the database.
 */
const CACHE_LIMIT = 1_500_000;

/**
 * How much of a file one request carries. A song's clip can run past a megabyte as a data URL,
 * and a request that size is better split than refused.
 */
const PART = 900_000;

/** The most photos a post takes, as Instagram's carousels did for years. */
export const MAX_PHOTOS = 10;

/**
 * A photo picked for a post. It is kept as its file, and decoded again when the post is published:
 * ten photos off a phone's camera, decoded at once, are hundreds of megabytes Safari does not have.
 */
export interface DraftPhoto {
	file: Blob;
	width: number;
	height: number;
	/** For showing it while the post is written. */
	preview: string;
	focus: Focus;
}

export interface DraftMusic {
	title: string;
	artist: string;
	/** The catalog's song; none for one of the device's. */
	song?: CatalogSong;
	/** The device's song; none for one of the catalog's. */
	upload?: Upload;
	/** Seconds into the song where the post's music starts, and how many it plays. */
	start: number;
	length: number;
}

export interface Draft {
	photos: DraftPhoto[];
	aspect: Aspect;
	caption: string;
	music: DraftMusic | null;
}

function byNewest(a: OwnPost, b: OwnPost): number {
	return b.created_at - a.created_at;
}

class Posts {
	list = $state<OwnPost[]>([]);

	#account = '';

	async load(userId: string) {
		this.#account = userId;
		const cached = readCache<OwnPost[]>(CACHE, userId);
		if (Array.isArray(cached)) this.list = cached;
		await this.#read();
	}

	async #read() {
		const rows = await pull(() => select<OwnPost>(TABLE, COLUMNS));
		if (!rows) return;
		this.list = rows.sort(byNewest);
		this.#save();
	}

	#save() {
		writeCache(CACHE, this.#account, $state.snapshot(this.list), CACHE_LIMIT);
	}

	/**
	 * Publishes a post, saying how far it has got as it goes, and gives back its code. Nothing is
	 * sent until every photo is ready; if a file does not make it, the post is taken back down
	 * rather than left showing half of it, and the error is thrown for the composer to show.
	 */
	async publish(draft: Draft, progress: (done: number, total: number) => void): Promise<string> {
		const code = newCode();
		const files: { slot: number; url: string }[] = [];

		let thumb = '';
		for (const [slot, photo] of draft.photos.entries()) {
			progress(slot, draft.photos.length + 1);
			const image = await load(photo.file);
			try {
				const { url, canvas } = await slide(image, draft.aspect, photo.focus);
				if (slot === 0) thumb = await thumbnail(canvas);
				files.push({ slot, url });
			} finally {
				if ('close' in image) image.close();
			}
		}

		let music: LeogramMusic | null = null;
		const chosen = draft.music;
		if (chosen?.upload) {
			const { url, lead } = await cutClip(chosen.upload, chosen.start, chosen.length);
			files.push({ slot: SONG, url });
			music = {
				source: 'upload',
				title: chosen.title,
				artist: chosen.artist,
				artwork: '',
				url: '',
				// The clip starts a moment early (see cutMp3): from there is where it plays.
				start: Math.round(lead * 1000) / 1000,
				length: chosen.length
			};
		} else if (chosen?.song) {
			music = {
				source: 'catalog',
				title: chosen.title,
				artist: chosen.artist,
				artwork: chosen.song.artwork,
				url: chosen.song.url,
				start: chosen.start,
				length: chosen.length
			};
		}

		const parts = files.flatMap(({ slot, url }) =>
			Array.from({ length: Math.ceil(url.length / PART) }, (_, part) => ({
				post_id: code,
				user_id: this.#account,
				slot,
				part,
				data: url.slice(part * PART, (part + 1) * PART)
			}))
		);

		const post: OwnPost = {
			id: code,
			caption: draft.caption,
			aspect: draft.aspect,
			slides: draft.photos.length,
			music,
			thumb,
			created_at: Date.now()
		};
		await insert(TABLE, { ...post, user_id: this.#account });
		try {
			for (const [sent, row] of parts.entries()) {
				progress(draft.photos.length + sent / parts.length, draft.photos.length + 1);
				await insert('leogram_media', row);
			}
		} catch (thrown) {
			await removePost(code).catch(() => {});
			throw thrown;
		}
		progress(1, 1);

		this.list = [post, ...this.list];
		this.#save();
		return code;
	}

	/** Takes a post down from the grid, after it was deleted from its own page. */
	forget(code: string) {
		this.list = this.list.filter((post) => post.id !== code);
		this.#save();
	}

	/** Deletes a post: it is gone for whoever has its link too. */
	delete(code: string) {
		this.forget(code);
		push(
			() => removePost(code),
			() => this.#read()
		);
	}
}

export const posts = new Posts();
