-- Written by hand: drizzle-kit tracks tables, columns and policies, not functions.
--
-- A post is for anybody with its link, as every post was until now, or for some friends only, who
-- open it signed in; and its author's bio (`?u=<username>`) lists the posts marked to be listed
-- there, to whoever can open each one. `leogram_can_see` is the one place that says who may open
-- a post, and everything else asks it: the post's link, the bio, and the policies that let an
-- account like a post and comment on it (the next migration).
--
-- A preview's copy of `public` creates the functions in the order they were first created
-- (db/preview.mjs), and a SQL-standard body can only name a function that exists by then. So
-- `leogram_post`, which now asks `leogram_can_see`, is dropped and created again after it: being
-- replaced, it would keep its place ahead of it.

-- Whether whoever asks may open the post: anybody, for one that is for anybody with its link; its
-- author and the friends it is for, otherwise. No post with that code is no post to open.
CREATE FUNCTION leogram_can_see(code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT EXISTS (
		SELECT FROM leogram_posts p
		WHERE p.id = leogram_can_see.code AND (
			p.audience = 'link'
			OR p.user_id = auth.user_id()
			OR EXISTS (
				SELECT FROM leogram_audience f WHERE f.post_id = p.id AND f.friend_id = auth.user_id()
			)
		)
	);
END;
--> statement-breakpoint
DROP FUNCTION leogram_post(text);
--> statement-breakpoint
-- The post, with what is said about it and where to read its files; or, to whoever it is not for,
-- only that it is `restricted`, which tells a friend who is signed out to sign in. `mine` and
-- `liked` are about whoever asks, `me` is their username (null signed out), `avatars` the photos
-- of everyone shown, by username, and `friends` who it is for, which only its author is told.
CREATE FUNCTION leogram_post(code text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT CASE WHEN NOT leogram_can_see(p.id) THEN jsonb_build_object('restricted', true) ELSE jsonb_build_object(
		'id', p.id,
		'username', a.username,
		'caption', p.caption,
		'aspect', p.aspect,
		'slides', p.slides,
		'music', p.music,
		'created_at', p.created_at,
		'audience', p.audience,
		'listed', p.listed,
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
		'me', (SELECT m.username FROM leogram_profiles m WHERE m.user_id = auth.user_id()),
		'friends', CASE WHEN p.user_id = auth.user_id() THEN coalesce((
			SELECT jsonb_agg(jsonb_build_object(
				'id', u.user_id,
				'username', u.username,
				'avatar', (
					SELECT leogram_private.sign('GET', v.key, 172800, leogram_private.today())
					FROM leogram_avatars v WHERE v.user_id = u.user_id
				)
			) ORDER BY u.username)
			FROM leogram_audience f JOIN leogram_profiles u ON u.user_id = f.friend_id
			WHERE f.post_id = p.id
		), '[]'::jsonb) END
	) END
	FROM leogram_posts p JOIN leogram_profiles a ON a.user_id = p.user_id
	WHERE p.id = leogram_post.code;
END;
--> statement-breakpoint
-- The account's own profile and grid: its username and photo, each of its posts with its thumbnail
-- and who it is for, newest first, and its favourites. `used` is the bytes its files take in the
-- bucket.
CREATE OR REPLACE FUNCTION leogram_mine() RETURNS jsonb
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
				'audience', p.audience,
				'listed', p.listed,
				'thumb', (
					SELECT leogram_private.sign('GET', t.key, 172800, leogram_private.today())
					FROM leogram_media t WHERE t.post_id = p.id AND t.kind = 'thumb'
				),
				'video', EXISTS (SELECT FROM leogram_media v WHERE v.post_id = p.id AND v.kind = 'video')
			) ORDER BY p.created_at DESC)
			FROM leogram_posts p WHERE p.user_id = auth.user_id()
		), '[]'::jsonb),
		'favorites', coalesce((
			SELECT jsonb_agg(jsonb_build_object(
				'id', u.user_id,
				'username', u.username,
				'avatar', (
					SELECT leogram_private.sign('GET', v.key, 172800, leogram_private.today())
					FROM leogram_avatars v WHERE v.user_id = u.user_id
				)
			) ORDER BY u.username)
			FROM leogram_favorites f JOIN leogram_profiles u ON u.user_id = f.friend_id
			WHERE f.user_id = auth.user_id()
		), '[]'::jsonb)
	);
END;
--> statement-breakpoint
-- An account's bio, for anybody, signed in or not: its username and photo, and the posts it lists
-- there that whoever asks can open, newest first. `mine` is whether it is theirs, `favorite`
-- whether they keep it among their favourites. Null for a username nobody has.
CREATE FUNCTION leogram_profile(username text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT jsonb_build_object(
		'id', u.user_id,
		'username', u.username,
		'avatar', (
			SELECT leogram_private.sign('GET', v.key, 172800, leogram_private.today())
			FROM leogram_avatars v WHERE v.user_id = u.user_id
		),
		'mine', coalesce(u.user_id = auth.user_id(), false),
		'favorite', EXISTS (
			SELECT FROM leogram_favorites f WHERE f.user_id = auth.user_id() AND f.friend_id = u.user_id
		),
		'posts', coalesce((
			SELECT jsonb_agg(jsonb_build_object(
				'id', p.id,
				'slides', p.slides,
				'music', p.music,
				'audience', p.audience,
				'thumb', (
					SELECT leogram_private.sign('GET', t.key, 172800, leogram_private.today())
					FROM leogram_media t WHERE t.post_id = p.id AND t.kind = 'thumb'
				),
				'video', EXISTS (SELECT FROM leogram_media v WHERE v.post_id = p.id AND v.kind = 'video')
			) ORDER BY p.created_at DESC)
			FROM leogram_posts p
			WHERE p.user_id = u.user_id AND p.listed AND leogram_can_see(p.id)
		), '[]'::jsonb),
		'me', (SELECT m.username FROM leogram_profiles m WHERE m.user_id = auth.user_id())
	)
	FROM leogram_profiles u
	WHERE u.username = lower(btrim(leogram_profile.username, ' @'));
END;
--> statement-breakpoint
-- Accounts whose username has what was typed in it, to share a post with or keep as favourites:
-- the ones that start with it first, then the shortest. Never the one asking, and twenty at most;
-- typing nothing finds nobody.
CREATE FUNCTION leogram_find(query text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT coalesce(jsonb_agg(jsonb_build_object(
		'id', found.user_id,
		'username', found.username,
		'avatar', (
			SELECT leogram_private.sign('GET', v.key, 172800, leogram_private.today())
			FROM leogram_avatars v WHERE v.user_id = found.user_id
		)
	) ORDER BY found.at, length(found.username), found.username), '[]'::jsonb)
	FROM (
		-- strpos and not LIKE: `_`, which usernames have, is one of LIKE's wildcards.
		SELECT u.user_id, u.username, strpos(u.username, q.text) AS at
		FROM leogram_profiles u, (SELECT lower(btrim(leogram_find.query, ' @')) AS text) AS q
		WHERE q.text <> '' AND strpos(u.username, q.text) > 0
			AND u.user_id IS DISTINCT FROM auth.user_id()
		ORDER BY strpos(u.username, q.text), length(u.username), u.username
		LIMIT 20
	) AS found;
END;
--> statement-breakpoint
-- Says who a post of the account's own is for, and whether its bio lists it, all at once: the
-- post's link stops opening for whoever is left out in the same moment it starts opening for whoever
-- is added. `friends` is a JSON array of the accounts' ids — JSON and not a Postgres array, which
-- is how the Data API takes it with nothing to convert —, it only counts for `friends`, and only
-- accounts with a profile, other than the author's own, make it in.
CREATE FUNCTION leogram_share(code text, audience text, listed boolean, friends jsonb DEFAULT '[]')
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
BEGIN ATOMIC
	SELECT leogram_private.fail('Esa publicación no es tuya.')
	WHERE NOT EXISTS (
		SELECT FROM leogram_posts p WHERE p.id = leogram_share.code AND p.user_id = auth.user_id()
	);
	UPDATE leogram_posts p
	SET audience = leogram_share.audience, listed = leogram_share.listed
	WHERE p.id = leogram_share.code AND p.user_id = auth.user_id();
	DELETE FROM leogram_audience f
	WHERE f.post_id = leogram_share.code AND (
		leogram_share.audience <> 'friends'
		OR NOT coalesce(leogram_share.friends @> jsonb_build_array(f.friend_id), false)
	);
	INSERT INTO leogram_audience (post_id, user_id, friend_id)
	SELECT p.id, p.user_id, u.user_id
	FROM leogram_posts p JOIN leogram_profiles u ON leogram_share.friends @> jsonb_build_array(u.user_id)
	WHERE p.id = leogram_share.code AND p.user_id = auth.user_id()
		AND leogram_share.audience = 'friends' AND u.user_id <> p.user_id
	ON CONFLICT DO NOTHING;
	SELECT true;
END;
--> statement-breakpoint
REVOKE ALL ON FUNCTION
	leogram_can_see(text),
	leogram_post(text),
	leogram_profile(text),
	leogram_find(text),
	leogram_share(text, text, boolean, jsonb)
FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION leogram_post(text), leogram_profile(text) TO anonymous, authenticated;
--> statement-breakpoint
-- `leogram_can_see` too, which the policies on likes and comments call as whoever is writing.
GRANT EXECUTE ON FUNCTION
	leogram_can_see(text),
	leogram_find(text),
	leogram_share(text, text, boolean, jsonb)
TO authenticated;
