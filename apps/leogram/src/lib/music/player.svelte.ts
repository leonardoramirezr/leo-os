// A post's song: it plays from its moment and starts over at the end of it, for as long as the post
// is open. A browser lets a page make sound only once it has been touched, so a post that opens on
// its own waits, silent, for the first tap anywhere on it.
//
// An <audio> element and not Web Audio: on the iPhone, Web Audio goes quiet with the ring switch
// and an <audio> element does not, which is how a song is expected to behave.

const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;

export class Player {
	/** Sounding right now. */
	playing = $state(false);
	/** Asked to play before anything was touched, and refused: the next tap starts it. */
	waiting = $state(false);

	#audio = new Audio();
	#start = 0;
	#end = 0;
	#frame = 0;
	/** Paused because the page was hidden, to play again when it comes back. */
	#resume = false;

	constructor(src: string, start: number, length: number) {
		this.#audio.preload = 'auto';
		this.#audio.src = src;
		this.setMoment(start, length);

		this.#audio.addEventListener('playing', () => {
			this.playing = true;
			this.waiting = false;
			this.#watch();
		});
		this.#audio.addEventListener('pause', () => (this.playing = false));
		// A preview can end before the moment does: round it goes all the same.
		this.#audio.addEventListener('ended', () => {
			this.#rewind();
			void this.#audio.play().catch(() => {});
		});
		document.addEventListener('visibilitychange', this.#visibility);
	}

	/** Where it plays from, and for how long before it goes back there. */
	setMoment(start: number, length: number) {
		this.#start = Math.max(0, start);
		this.#end = this.#start + Math.max(1, length);
		if (this.#audio.currentTime < this.#start || this.#audio.currentTime >= this.#end) this.#rewind();
	}

	/** Plays from where it is, or from the moment's start once it is outside of it. */
	play() {
		if (this.#audio.currentTime < this.#start || this.#audio.currentTime >= this.#end) this.#rewind();
		// Called right away and not after anything awaited: Safari only lets it sound if it comes
		// straight from the tap.
		this.#audio.play().catch((error: unknown) => {
			if (error instanceof DOMException && error.name === 'NotAllowedError') this.#wait();
		});
	}

	/** From the start of the moment, as when the moment has just been picked. */
	restart() {
		this.#rewind();
		this.play();
	}

	pause() {
		this.#unwait();
		this.#audio.pause();
	}

	toggle() {
		if (this.playing || this.waiting) this.pause();
		else this.play();
	}

	destroy() {
		this.pause();
		cancelAnimationFrame(this.#frame);
		document.removeEventListener('visibilitychange', this.#visibility);
		this.#audio.removeAttribute('src');
		this.#audio.load();
	}

	#rewind() {
		const seek = () => (this.#audio.currentTime = this.#start);
		// Before the file says how long it is, a seek may be dropped: it waits for it.
		if (this.#audio.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
		else this.#audio.addEventListener('loadedmetadata', seek, { once: true });
	}

	/** Brings it back to the start of the moment once it reaches its end. */
	#watch() {
		cancelAnimationFrame(this.#frame);
		const check = () => {
			if (this.#audio.paused) return;
			if (this.#audio.currentTime >= this.#end) this.#audio.currentTime = this.#start;
			this.#frame = requestAnimationFrame(check);
		};
		this.#frame = requestAnimationFrame(check);
	}

	#wait() {
		if (this.waiting) return;
		this.waiting = true;
		for (const type of GESTURES) document.addEventListener(type, this.#gesture, true);
	}

	#unwait() {
		this.waiting = false;
		for (const type of GESTURES) document.removeEventListener(type, this.#gesture, true);
	}

	#gesture = () => {
		this.#unwait();
		this.play();
	};

	#visibility = () => {
		if (document.hidden) {
			this.#resume = this.playing;
			this.#audio.pause();
		} else if (this.#resume) {
			this.#resume = false;
			this.play();
		}
	};
}
