// The account's own posts: the grid it sees of them, and what it takes to publish one. A post opens
// the moment it is saved, for whoever it is for and has its link — anybody, or some friends — and
// shows in the account's bio, to those same people, only if it is listed there.
import { insert, pull, push, readCache, writeCache, type LeogramMusic } from '@leo-os/shared';
import { send, type Signed } from './bucket';
import { newCode } from './code';
import { load, slide, thumbnail, type Aspect, type Focus } from './images';
import { readMine, type OwnPost } from './mine';
import type { CatalogSong } from './music/catalog';
import { cutClip, type Upload } from './music/clip';
import { call, deletePost, share, SONG, type Visibility } from './post';
import type { TextLayer } from './text';

const TABLE = 'leogram_posts';
const CACHE = 'leogram-posts';

/** The most a post takes, photos and videos together, as Instagram's carousels did for years. */
export const MAX_SLIDES = 10;

/**
 * A photo or a video picked for a post. A photo is kept as its file, and decoded again when the
 * post is published: ten photos off a phone's camera, decoded at once, are hundreds of megabytes
 * Safari does not have.
 */
export interface DraftSlide {
	kind: 'photo' | 'video';
	file: Blob;
	/** What it goes up as: a photo, cut, as a JPEG; a video as it was recorded. */
	type: string;
	width: number;
	height: number;
	/** A video's first frame, which its poster is cut from. */
	frame?: Blob;
	/** For showing it while the post is written: the photo, or the video itself. */
	preview: string;
	/** What the list of slides shows of it: the photo, or the video's first frame. */
	thumb: string;
	focus: Focus;
	/** What is written on a photo, drawn into it when it is published; a video takes none. */
	texts: TextLayer[];
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

export interface Draft extends Visibility {
	slides: DraftSlide[];
	aspect: Aspect;
	caption: string;
	music: DraftMusic | null;
}

/** One file of a post on its way to the bucket. */
interface Outgoing {
	slot: number;
	kind: 'photo' | 'video' | 'poster' | 'thumb' | 'song';
	file: Blob;
	type: string;
	focus?: Focus;
}

class Posts {
	list = $state<OwnPost[]>([]);

	#account = '';

	/** Shows what the device kept from the last time, until the database is read. */
	restore(userId: string) {
		this.#account = userId;
		const cached = readCache<OwnPost[]>(CACHE, userId);
		if (Array.isArray(cached)) this.list = cached;
	}

	/** The posts as the database has them, newest first. */
	adopt(list: OwnPost[]) {
		this.list = list;
		writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}

	async #read() {
		const mine = await pull(readMine);
		if (mine) this.adopt(mine.posts);
	}

	/**
	 * Publishes a post, saying how far it has got as it goes, from 0 to 1, and gives back its code.
	 * Everything is cut and encoded before anything is sent. Then the post is saved and its files
	 * go up one by one, straight to the bucket; if one does not make it, the post is taken back down
	 * rather than left showing half of it, and the error is thrown for the composer to show.
	 */
	async publish(draft: Draft, progress: (done: number) => void): Promise<string> {
		const code = newCode();
		const files: Outgoing[] = [];

		let thumb: Blob | undefined;
		for (const [slot, item] of draft.slides.entries()) {
			const image = await load(item.frame ?? item.file);
			try {
				const { blob, canvas } = await slide(image, draft.aspect, item.focus, item.texts);
				if (slot === 0) thumb = await thumbnail(canvas);
				if (item.kind === 'video') {
					files.push({ slot, kind: 'video', file: item.file, type: item.type, focus: item.focus });
					files.push({ slot, kind: 'poster', file: blob, type: 'image/jpeg' });
				} else {
					files.push({ slot, kind: 'photo', file: blob, type: 'image/jpeg' });
				}
			} finally {
				if ('close' in image) image.close();
			}
		}
		if (thumb) files.push({ slot: 0, kind: 'thumb', file: thumb, type: 'image/jpeg' });

		let music: LeogramMusic | null = null;
		const chosen = draft.music;
		if (chosen?.upload) {
			const { clip, lead } = cutClip(chosen.upload, chosen.start, chosen.length);
			files.push({ slot: SONG, kind: 'song', file: clip, type: clip.type });
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

		const post = {
			id: code,
			caption: draft.caption,
			aspect: draft.aspect,
			slides: draft.slides.length,
			music,
			created_at: Date.now(),
			audience: draft.audience,
			listed: draft.listed
		};
		await insert(TABLE, { ...post, user_id: this.#account });

		const total = files.reduce((sum, { file }) => sum + file.size, 0);
		let sent = 0;
		try {
			// Saved as for some friends already, it opens for nobody but its author until they are
			// added; and they are, before a single file goes up.
			if (draft.audience === 'friends') await share(code, draft);
			for (const { slot, kind, file, type, focus } of files) {
				const signed = await call<Signed>('leogram_upload', {
					code,
					slot,
					kind,
					type,
					size: file.size,
					focus_x: Math.round((focus?.x ?? 0.5) * 100),
					focus_y: Math.round((focus?.y ?? 0.5) * 100)
				});
				await send(signed, file, (bytes) => progress((sent + bytes) / total));
				sent += file.size;
			}
		} catch (thrown) {
			await deletePost(code).catch(() => {});
			throw thrown;
		}
		progress(1);

		// The thumbnail from the device, until the database is read again for the address of the
		// one in the bucket.
		const shown: OwnPost = {
			...post,
			thumb: thumb ? URL.createObjectURL(thumb) : null,
			video: draft.slides.some((item) => item.kind === 'video')
		};
		this.list = [shown, ...this.list];
		void this.#read();
		return code;
	}

	/** Who a post is for changed, from its own page: its marks in the grid, and its tab, follow. */
	reshare(code: string, { audience, listed }: Pick<Visibility, 'audience' | 'listed'>) {
		this.list = this.list.map((post) => (post.id === code ? { ...post, audience, listed } : post));
		writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}

	/** Takes a post down from the grid, after it was deleted from its own page. */
	forget(code: string) {
		this.list = this.list.filter((post) => post.id !== code);
		writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}

	/** Deletes a post: it is gone for whoever has its link too. */
	delete(code: string) {
		this.forget(code);
		push(
			() => deletePost(code),
			() => this.#read()
		);
	}
}

export const posts = new Posts();
