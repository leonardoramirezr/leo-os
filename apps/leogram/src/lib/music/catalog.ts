// Songs anyone knows, from Apple's catalog: its search is open to any page, asks for no key, and
// for each song hands over a 30-second preview that plays from Apple's own servers. A post keeps
// the preview's address, not the sound. Only what is typed in the search box is sent there.

export interface CatalogSong {
	title: string;
	artist: string;
	/** The album cover. */
	artwork: string;
	/** The 30-second preview. */
	url: string;
}

const SEARCH = 'https://itunes.apple.com/search';

/** Apple's store whose catalog is searched: the one these apps are used from. */
const COUNTRY = 'mx';

interface Result {
	trackName?: unknown;
	artistName?: unknown;
	artworkUrl100?: unknown;
	previewUrl?: unknown;
}

export async function searchCatalog(term: string, signal?: AbortSignal): Promise<CatalogSong[]> {
	// No `media=music`: asked with it by a browser on an iPhone or iPad, Apple answers with a redirect
	// to `musics://`, for the Music app to open the search, which fetch cannot follow: every search
	// failed there. `entity=song` alone brings the same songs, in the same order.
	const query = new URLSearchParams({
		term,
		entity: 'song',
		limit: '30',
		country: COUNTRY
	});

	let response: Response;
	try {
		response = await fetch(`${SEARCH}?${query}`, { signal });
	} catch (thrown) {
		if (signal?.aborted) throw thrown;
		throw new Error('Sin conexión con el catálogo de música.');
	}
	if (!response.ok) throw new Error(`El catálogo de música respondió ${response.status}.`);

	const answer = (await response.json()) as { results?: Result[] };
	return (answer.results ?? []).flatMap((result) => {
		const { trackName, artistName, artworkUrl100, previewUrl } = result;
		if (typeof trackName !== 'string' || typeof previewUrl !== 'string') return [];
		return [
			{
				title: trackName,
				artist: typeof artistName === 'string' ? artistName : '',
				// The address names its size, and Apple serves any other it is asked for.
				artwork:
					typeof artworkUrl100 === 'string' ? artworkUrl100.replace('100x100bb', '300x300bb') : '',
				url: previewUrl
			}
		];
	});
}
