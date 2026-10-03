-- Written by hand, like 0007_leogram_public.sql, whose way of doing things this follows.
--
-- What a post's link shows in a chat before it is opened. WhatsApp, Telegram, Messages and the
-- rest draw that preview from the page the link leads to, without running any of it, and every
-- post opens on the same static page: they all got Leogram's name and nothing of the post. So the
-- link leads to a Neon Function instead (`neon/leogram-link.ts`), which reads the post here, with
-- the anonymous token a visitor has, and writes a page of the post's own for them to read.
--
-- Its picture is `card`: slot 0 the way the post shows it, small enough for any chat. WhatsApp
-- leaves out a picture past a few hundred kilobytes without a word, and a photo 1080 pixels wide is
-- often that heavy. Posts carry a card from now on; one published before shows its slot 0 itself
-- when that is light enough, and the grid's thumbnail when it is not.

-- `leogram_upload` as 0007 made it, now taking a `card` too: one per post, of slot 0, like the
-- thumbnail.
CREATE OR REPLACE FUNCTION leogram_upload(
	code text,
	slot integer,
	kind text,
	type text,
	size bigint,
	focus_x integer DEFAULT 50,
	focus_y integer DEFAULT 50
) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
BEGIN ATOMIC
	SELECT leogram_private.fail('El almacenamiento de Leogram todavía no está listo.')
	WHERE NOT EXISTS (SELECT FROM leogram_private.bucket);
	SELECT leogram_private.fail('Esa publicación no es tuya.')
	WHERE NOT EXISTS (
		SELECT FROM leogram_posts p WHERE p.id = leogram_upload.code AND p.user_id = auth.user_id()
	);
	SELECT leogram_private.fail('Ese archivo no va en esa publicación.')
	WHERE NOT EXISTS (
		SELECT FROM leogram_posts p
		WHERE p.id = leogram_upload.code AND CASE leogram_upload.kind
			WHEN 'song' THEN leogram_upload.slot = -1
			WHEN 'thumb' THEN leogram_upload.slot = 0
			WHEN 'card' THEN leogram_upload.slot = 0
			WHEN 'photo' THEN leogram_upload.slot BETWEEN 0 AND p.slides - 1
			WHEN 'video' THEN leogram_upload.slot BETWEEN 0 AND p.slides - 1
			WHEN 'poster' THEN leogram_upload.slot BETWEEN 0 AND p.slides - 1
			ELSE false
		END
	);
	-- What each kind may be, and how big: photos come cut and compressed, a video comes as it was
	-- recorded, a song is a clip of half a minute.
	SELECT leogram_private.fail('Ese archivo es de un tipo o un tamaño que Leogram no guarda.')
	WHERE NOT (leogram_upload.size > 0 AND CASE leogram_upload.kind
		WHEN 'video' THEN leogram_upload.type IN ('video/mp4', 'video/quicktime', 'video/webm')
			AND leogram_upload.size <= 300 * 1024 * 1024
		WHEN 'song' THEN leogram_upload.type IN ('audio/mpeg', 'audio/wav')
			AND leogram_upload.size <= 20 * 1024 * 1024
		ELSE leogram_upload.type = 'image/jpeg' AND leogram_upload.size <= 10 * 1024 * 1024
	END);
	-- Anyone can make an account, and the bucket is the project's: each one gets 2 GB of it.
	SELECT leogram_private.fail('Ya no te cabe nada más: tus publicaciones ocupan los 2 GB que te tocan.')
	WHERE (
		SELECT coalesce(sum(m.size), 0) FROM leogram_media m
		WHERE m.user_id = auth.user_id()
			AND NOT (m.post_id = leogram_upload.code AND m.slot = leogram_upload.slot
				AND m.kind = leogram_upload.kind)
	) + leogram_upload.size > 2::bigint * 1024 * 1024 * 1024;
	WITH replaced AS (
		SELECT m.key, leogram_private.home(m.tableoid) AS home FROM leogram_media m
		WHERE m.post_id = leogram_upload.code AND m.slot = leogram_upload.slot
			AND m.kind = leogram_upload.kind
	), stored AS (
		INSERT INTO leogram_media AS m (post_id, user_id, slot, kind, key, type, size, focus_x, focus_y)
		SELECT
			p.id,
			p.user_id,
			leogram_upload.slot,
			leogram_upload.kind,
			-- <schema>/<post>/photo0-<random>.jpg
			concat(
				leogram_private.home(p.tableoid), '/', p.id, '/', leogram_upload.kind,
				CASE WHEN leogram_upload.slot >= 0 THEN leogram_upload.slot::text END,
				'-', left(replace(gen_random_uuid()::text, '-', ''), 16), '.',
				CASE leogram_upload.type
					WHEN 'image/jpeg' THEN 'jpg' WHEN 'video/mp4' THEN 'mp4' WHEN 'video/quicktime' THEN 'mov'
					WHEN 'video/webm' THEN 'webm' WHEN 'audio/mpeg' THEN 'mp3' WHEN 'audio/wav' THEN 'wav'
				END
			),
			leogram_upload.type,
			leogram_upload.size,
			greatest(0, least(100, coalesce(leogram_upload.focus_x, 50))),
			greatest(0, least(100, coalesce(leogram_upload.focus_y, 50)))
		FROM leogram_posts p WHERE p.id = leogram_upload.code
		ON CONFLICT (post_id, slot, kind) DO UPDATE
		SET key = excluded.key, type = excluded.type, size = excluded.size,
			focus_x = excluded.focus_x, focus_y = excluded.focus_y
		RETURNING m.key, leogram_private.home(m.tableoid) AS home
	)
	SELECT jsonb_build_object(
		'url', leogram_private.sign('PUT', stored.key, 3600, now(), leogram_upload.type, leogram_upload.size),
		'headers', jsonb_build_object('content-type', leogram_upload.type),
		-- Only ever a file of this schema's own: in a preview, a copied post's files are the
		-- published site's, and not the preview's to delete.
		'drop', (
			SELECT leogram_private.sign('DELETE', r.key, 900) FROM replaced r
			WHERE starts_with(r.key, r.home || '/' || leogram_upload.code || '/')
		)
	)
	FROM stored;
END;
--> statement-breakpoint
-- What a chat shows of the post before its link is opened, to whoever has the link: who posted it,
-- the caption, when, its likes and comments, and its picture, as `kind` and an address that reads
-- it for a day at least. The same post `leogram_post` hands over, told in less; null when there is
-- none with that code.
CREATE FUNCTION leogram_card(code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT jsonb_build_object(
		'username', a.username,
		'caption', p.caption,
		'aspect', p.aspect,
		'created_at', p.created_at,
		'likes', (SELECT count(*) FROM leogram_likes l WHERE l.post_id = p.id),
		'comments', (SELECT count(*) FROM leogram_comments c WHERE c.post_id = p.id),
		'image', (
			SELECT jsonb_build_object(
				'kind', m.kind,
				'url', leogram_private.sign('GET', m.key, 172800, leogram_private.today())
			)
			FROM leogram_media m
			WHERE m.post_id = p.id AND m.slot = 0
				AND (m.kind IN ('card', 'thumb') OR (m.kind IN ('photo', 'poster') AND m.size <= 300 * 1024))
			ORDER BY CASE m.kind WHEN 'card' THEN 0 WHEN 'thumb' THEN 2 ELSE 1 END
			LIMIT 1
		)
	)
	FROM leogram_posts p JOIN leogram_profiles a ON a.user_id = p.user_id
	WHERE p.id = leogram_card.code;
END;
--> statement-breakpoint
REVOKE ALL ON FUNCTION leogram_card(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION leogram_card(text) TO anonymous, authenticated;
