-- Written by hand: drizzle-kit tracks tables, columns and policies, not functions, nor what lives
-- outside the models.
--
-- Leogram keeps photos, videos and songs in the project's Neon bucket, a private one, and the
-- browser reaches it with addresses these functions sign (AWS Signature Version 4, which is what
-- the bucket speaks): to upload a file of the account's own post, and to read the files of a post
-- whose link one has. The key they sign with never leaves the database, and no other server is
-- needed. `db/storage.mjs` sets up the bucket and puts the key here, at every deploy.
--
-- What anyone with a post's link sees of it, signed in or not: signed out, the request carries the
-- anonymous token Neon Auth hands anybody, which the Data API runs as `anonymous`, a role that
-- reaches no table and may only call `leogram_post`. That one runs as its owner (SECURITY DEFINER)
-- and only ever hands over the one post whose code it is given, so no post can be listed.
--
-- Bodies are SQL-standard (BEGIN ATOMIC): the tables they read are looked up once, when they are
-- created, so no search path at call time can point them anywhere else; in a preview, whose
-- migrations run in its own schema, that makes them read the preview's tables. It also means a
-- migration that changes a column they read has to drop and create them again.

-- A new function can be called by everyone unless told otherwise. Every function this role makes
-- from now on starts out closed: now that `anonymous` reaches the schema, calling one has to be a
-- deliberate grant.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
-- What the Data API never serves: the bucket's key, and the helpers that sign with it. Shared by
-- the published site and every preview, which keep their files apart by the schema in each key.
CREATE SCHEMA IF NOT EXISTS leogram_private;
--> statement-breakpoint
-- The one bucket, where it is, and the credential that signs for it (`storage:write`, minted by
-- `db/storage.mjs` or given to it). A single row.
CREATE TABLE IF NOT EXISTS leogram_private.bucket (
	single boolean PRIMARY KEY DEFAULT true CHECK (single),
	-- https://br-xxx.storage.c-N.us-east-2.aws.neon.tech, as the Neon API gives it
	endpoint text NOT NULL,
	region text NOT NULL,
	name text NOT NULL,
	key_id text NOT NULL,
	secret text NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- HMAC-SHA256 (RFC 2104) out of core's sha256(), so that signing needs no extension.
CREATE OR REPLACE FUNCTION leogram_private.hmac(secret bytea, message bytea) RETURNS bytea
LANGUAGE sql IMMUTABLE STRICT
BEGIN ATOMIC
	SELECT sha256(
		(SELECT string_agg(set_byte('\x00'::bytea, 0, get_byte(k.block, i) # 92), ''::bytea ORDER BY i)
			FROM generate_series(0, 63) AS i)
		|| sha256(
			(SELECT string_agg(set_byte('\x00'::bytea, 0, get_byte(k.block, i) # 54), ''::bytea ORDER BY i)
				FROM generate_series(0, 63) AS i)
			|| message
		)
	)
	FROM (
		SELECT h.k0 || decode(repeat('00', 64 - length(h.k0)), 'hex') AS block
		FROM (SELECT CASE WHEN length(secret) > 64 THEN sha256(secret) ELSE secret END AS k0) AS h
	) AS k;
END;
--> statement-breakpoint
-- An address that lets whoever holds it do `method` on one object, from `at` for `expires` seconds:
-- AWS Signature Version 4 in its query-string form, path-style as the bucket wants it. An upload is
-- signed for its type and its exact size, which the bucket then holds the request to. Null while
-- there is no bucket.
CREATE OR REPLACE FUNCTION leogram_private.sign(
	method text,
	object text,
	expires integer,
	at timestamptz DEFAULT now(),
	content_type text DEFAULT NULL,
	content_length bigint DEFAULT NULL
) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
	SELECT concat(
		q.origin, q.path, '?', q.query, '&X-Amz-Signature=',
		encode(
			leogram_private.hmac(
				leogram_private.hmac(leogram_private.hmac(leogram_private.hmac(leogram_private.hmac(
					convert_to('AWS4' || q.secret, 'UTF8'), convert_to(q.day, 'UTF8')),
					convert_to(q.region, 'UTF8')), convert_to('s3', 'UTF8')),
					convert_to('aws4_request', 'UTF8')),
				convert_to(concat_ws(E'\n', 'AWS4-HMAC-SHA256', q.stamp, q.scope, encode(sha256(convert_to(
					concat_ws(E'\n', method, q.path, q.query, q.headers, q.signed, 'UNSIGNED-PAYLOAD'),
				'UTF8')), 'hex')), 'UTF8')
			),
			'hex'
		)
	)
	FROM (
		SELECT s.*,
			concat(
				'X-Amz-Algorithm=AWS4-HMAC-SHA256',
				'&X-Amz-Credential=', replace(s.key_id || '/' || s.scope, '/', '%2F'),
				'&X-Amz-Date=', s.stamp,
				'&X-Amz-Expires=', expires,
				'&X-Amz-SignedHeaders=', replace(s.signed, ';', '%3B')
			) AS query
		FROM (
			SELECT
				b.key_id,
				b.secret,
				b.region,
				rtrim(b.endpoint, '/') AS origin,
				'/' || b.name || '/' || object AS path,
				to_char(at AT TIME ZONE 'UTC', 'YYYYMMDD') AS day,
				to_char(at AT TIME ZONE 'UTC', 'YYYYMMDD"T"HH24MISS"Z"') AS stamp,
				to_char(at AT TIME ZONE 'UTC', 'YYYYMMDD') || '/' || b.region || '/s3/aws4_request' AS scope,
				CASE WHEN content_type IS NULL THEN 'host'
					ELSE 'content-length;content-type;host' END AS signed,
				concat(
					CASE WHEN content_type IS NOT NULL THEN
						'content-length:' || content_length || E'\n'
						|| 'content-type:' || content_type || E'\n'
					END,
					'host:', regexp_replace(b.endpoint, '^https?://([^/]+).*$', '\1'), E'\n'
				) AS headers
			FROM leogram_private.bucket AS b
			-- Keys are made by the functions below, and stay within what needs no escaping.
			WHERE object ~ '^[A-Za-z0-9._/-]+$'
		) AS s
	) AS q;
END;
--> statement-breakpoint
-- The schema of the table a row is in, from the row's `tableoid`. Keys start with it, which keeps
-- the published site's files and each preview's apart in the one bucket; and it is what a function
-- checks before handing out the address to delete a file. It is the function's own tables that say
-- so, never `current_schema()`, which is whatever search path the caller came with.
CREATE OR REPLACE FUNCTION leogram_private.home(t oid) RETURNS text
LANGUAGE sql STABLE STRICT
RETURN (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = t);
--> statement-breakpoint
-- A refusal, as an error the Data API hands back with its message.
CREATE OR REPLACE FUNCTION leogram_private.fail(message text) RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION USING MESSAGE = message, ERRCODE = 'P0001';
END
$$;
--> statement-breakpoint
-- The moment reads are signed at: the start of the day, so that a file keeps one address all day
-- long and the browser's cache can keep it; the address lasts two days from then.
CREATE OR REPLACE FUNCTION leogram_private.today() RETURNS timestamptz
LANGUAGE sql STABLE
RETURN date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
--> statement-breakpoint
-- The post, with what is said about it and where to read its files. `mine` and `liked` are about
-- whoever asks, `me` is their username (null signed out), and `avatars` the photos of everyone
-- shown, by username.
CREATE FUNCTION leogram_post(code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT jsonb_build_object(
		'id', p.id,
		'username', a.username,
		'caption', p.caption,
		'aspect', p.aspect,
		'slides', p.slides,
		'music', p.music,
		'created_at', p.created_at,
		'items', coalesce((
			SELECT jsonb_agg(jsonb_build_object(
				'slot', m.slot,
				'kind', m.kind,
				'url', leogram_private.sign('GET', m.key, 172800, leogram_private.today()),
				'poster', (
					SELECT leogram_private.sign('GET', v.key, 172800, leogram_private.today())
					FROM leogram_media v WHERE v.post_id = p.id AND v.slot = m.slot AND v.kind = 'poster'
				),
				'focus_x', m.focus_x,
				'focus_y', m.focus_y
			) ORDER BY m.slot)
			FROM leogram_media m WHERE m.post_id = p.id AND m.kind IN ('photo', 'video')
		), '[]'::jsonb),
		'song', (
			SELECT leogram_private.sign('GET', s.key, 172800, leogram_private.today())
			FROM leogram_media s WHERE s.post_id = p.id AND s.kind = 'song'
		),
		'mine', coalesce(p.user_id = auth.user_id(), false),
		'likes', (SELECT count(*) FROM leogram_likes l WHERE l.post_id = p.id),
		'liked', EXISTS (SELECT FROM leogram_likes l WHERE l.post_id = p.id AND l.user_id = auth.user_id()),
		'comments', coalesce((
			SELECT jsonb_agg(jsonb_build_object(
				'id', c.id,
				'username', u.username,
				'text', c.text,
				'created_at', c.created_at,
				'mine', coalesce(c.user_id = auth.user_id(), false)
			) ORDER BY c.created_at, c.id)
			FROM leogram_comments c JOIN leogram_profiles u ON u.user_id = c.user_id
			WHERE c.post_id = p.id
		), '[]'::jsonb),
		'avatars', coalesce((
			SELECT jsonb_object_agg(
				u.username, leogram_private.sign('GET', v.key, 172800, leogram_private.today())
			)
			FROM leogram_profiles u JOIN leogram_avatars v ON v.user_id = u.user_id
			WHERE u.user_id = p.user_id
				OR u.user_id = auth.user_id()
				OR u.user_id IN (SELECT c.user_id FROM leogram_comments c WHERE c.post_id = p.id)
		), '{}'::jsonb),
		'me', (SELECT m.username FROM leogram_profiles m WHERE m.user_id = auth.user_id())
	)
	FROM leogram_posts p JOIN leogram_profiles a ON a.user_id = p.user_id
	WHERE p.id = leogram_post.code;
END;
--> statement-breakpoint
-- The account's own profile and grid: its username and photo, and each of its posts with its
-- thumbnail, newest first. `used` is the bytes its files take in the bucket.
CREATE FUNCTION leogram_mine() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT jsonb_build_object(
		'username', (SELECT u.username FROM leogram_profiles u WHERE u.user_id = auth.user_id()),
		'avatar', (
			SELECT leogram_private.sign('GET', v.key, 172800, leogram_private.today())
			FROM leogram_avatars v WHERE v.user_id = auth.user_id()
		),
		'used', (SELECT coalesce(sum(m.size), 0) FROM leogram_media m WHERE m.user_id = auth.user_id()),
		'posts', coalesce((
			SELECT jsonb_agg(jsonb_build_object(
				'id', p.id,
				'caption', p.caption,
				'aspect', p.aspect,
				'slides', p.slides,
				'music', p.music,
				'created_at', p.created_at,
				'thumb', (
					SELECT leogram_private.sign('GET', t.key, 172800, leogram_private.today())
					FROM leogram_media t WHERE t.post_id = p.id AND t.kind = 'thumb'
				),
				'video', EXISTS (SELECT FROM leogram_media v WHERE v.post_id = p.id AND v.kind = 'video')
			) ORDER BY p.created_at DESC)
			FROM leogram_posts p WHERE p.user_id = auth.user_id()
		), '[]'::jsonb)
	);
END;
--> statement-breakpoint
-- Where to upload one file of a post of the account's own: `url` takes a PUT with `headers` and
-- the file, which has to be of the type and the size said here. Uploading to a slot again replaces
-- what was there, and `drop` is where to delete the file it replaced.
CREATE FUNCTION leogram_upload(
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
-- Where to upload the account's profile photo, a JPEG of `size` bytes; `drop` is where to delete
-- the one it replaces.
CREATE FUNCTION leogram_upload_avatar(size bigint) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
BEGIN ATOMIC
	SELECT leogram_private.fail('El almacenamiento de Leogram todavía no está listo.')
	WHERE NOT EXISTS (SELECT FROM leogram_private.bucket);
	SELECT leogram_private.fail('Primero elige tu nombre de usuario.')
	WHERE NOT EXISTS (SELECT FROM leogram_profiles u WHERE u.user_id = auth.user_id());
	SELECT leogram_private.fail('Esa foto es demasiado grande.')
	WHERE NOT (leogram_upload_avatar.size BETWEEN 1 AND 2 * 1024 * 1024);
	WITH replaced AS (
		SELECT v.key, leogram_private.home(v.tableoid) AS home
		FROM leogram_avatars v WHERE v.user_id = auth.user_id()
	), stored AS (
		INSERT INTO leogram_avatars AS v (user_id, key, size)
		SELECT
			u.user_id,
			concat(
				leogram_private.home(u.tableoid), '/avatars/',
				replace(gen_random_uuid()::text, '-', ''), '.jpg'
			),
			leogram_upload_avatar.size
		FROM leogram_profiles u WHERE u.user_id = auth.user_id()
		ON CONFLICT (user_id) DO UPDATE SET key = excluded.key, size = excluded.size
		RETURNING v.key
	)
	SELECT jsonb_build_object(
		'url', leogram_private.sign('PUT', stored.key, 3600, now(), 'image/jpeg', leogram_upload_avatar.size),
		'headers', jsonb_build_object('content-type', 'image/jpeg'),
		'drop', (
			SELECT leogram_private.sign('DELETE', r.key, 900) FROM replaced r
			WHERE starts_with(r.key, r.home || '/avatars/')
		)
	)
	FROM stored;
END;
--> statement-breakpoint
-- Takes the profile photo off; gives back where to delete it, or null when there was none.
CREATE FUNCTION leogram_remove_avatar() RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER
BEGIN ATOMIC
	WITH removed AS (
		DELETE FROM leogram_avatars v WHERE v.user_id = auth.user_id()
		RETURNING v.key, leogram_private.home(v.tableoid) AS home
	)
	SELECT leogram_private.sign('DELETE', r.key, 900) FROM removed r
	WHERE starts_with(r.key, r.home || '/avatars/');
END;
--> statement-breakpoint
-- Deletes a post of the account's own, with its likes and comments, and gives back where to delete
-- each of its files, which the browser does next.
CREATE FUNCTION leogram_delete_post(code text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY DEFINER
BEGIN ATOMIC
	SELECT leogram_private.fail('Esa publicación no es tuya.')
	WHERE NOT EXISTS (
		SELECT FROM leogram_posts p WHERE p.id = leogram_delete_post.code AND p.user_id = auth.user_id()
	);
	-- Its files are read before the post goes, which takes their rows with it.
	WITH files AS (
		SELECT m.key, leogram_private.home(m.tableoid) AS home
		FROM leogram_media m WHERE m.post_id = leogram_delete_post.code
	), deleted AS (
		DELETE FROM leogram_posts p
		WHERE p.id = leogram_delete_post.code AND p.user_id = auth.user_id()
		RETURNING p.id
	)
	SELECT coalesce(jsonb_agg(leogram_private.sign('DELETE', f.key, 900)), '[]'::jsonb)
	FROM files f
	WHERE starts_with(f.key, f.home || '/' || leogram_delete_post.code || '/')
		AND EXISTS (SELECT FROM deleted);
END;
--> statement-breakpoint
REVOKE ALL ON FUNCTION
	leogram_post(text),
	leogram_mine(),
	leogram_upload(text, integer, text, text, bigint, integer, integer),
	leogram_upload_avatar(bigint),
	leogram_remove_avatar(),
	leogram_delete_post(text)
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION leogram_post(text) TO anonymous, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION
	leogram_mine(),
	leogram_upload(text, integer, text, text, bigint, integer, integer),
	leogram_upload_avatar(bigint),
	leogram_remove_avatar(),
	leogram_delete_post(text)
TO authenticated;
--> statement-breakpoint
-- To call `leogram_post`, `anonymous` has to reach the schema; it is still granted no table.
GRANT USAGE ON SCHEMA public TO anonymous;
