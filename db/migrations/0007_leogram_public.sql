-- Written by hand: drizzle-kit tracks tables, columns and policies, not functions.
--
-- What anyone with a Leogram post's link sees of it, signed in or not. Signed out, the request
-- carries the anonymous token Neon Auth hands anybody, which the Data API runs as `anonymous`: a
-- role that reaches no table and may only call these two. They run as their owner (SECURITY
-- DEFINER) and only ever hand over the one post whose code they are given, so no post can be
-- listed: it is seen by whoever was given its link, and by nobody else.
--
-- Their bodies are SQL-standard (BEGIN ATOMIC): the tables they read are looked up once, when they
-- are created, so no search path at call time can point them anywhere else. In a preview, whose
-- migrations run in its own schema, that makes them read the preview's tables. It also means a
-- migration that changes a column they read has to drop and create them again.

-- The post, with what is said about it. `mine` and `liked` are about whoever asks, `me` is their
-- profile (null signed out), and `avatars` the faces of everyone shown, by username.
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
			SELECT jsonb_object_agg(u.username, u.avatar)
			FROM leogram_profiles u
			WHERE u.avatar <> '' AND (
				u.user_id = p.user_id
				OR u.user_id = auth.user_id()
				OR u.user_id IN (SELECT c.user_id FROM leogram_comments c WHERE c.post_id = p.id)
			)
		), '{}'::jsonb),
		'me', (SELECT m.username FROM leogram_profiles m WHERE m.user_id = auth.user_id())
	)
	FROM leogram_posts p JOIN leogram_profiles a ON a.user_id = p.user_id
	WHERE p.id = leogram_post.code;
END;
--> statement-breakpoint
-- One of its files as a data URL, its parts joined: slot 0 to slides − 1 for the photos, -1 for the
-- song's clip. Null for a file the post does not have.
CREATE FUNCTION leogram_file(code text, slot integer) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
BEGIN ATOMIC
	SELECT string_agg(m.data, '' ORDER BY m.part)
	FROM leogram_media m
	WHERE m.post_id = leogram_file.code AND m.slot = leogram_file.slot;
END;
--> statement-breakpoint
-- A new function can be called by everyone unless told otherwise. These two are named out loud,
-- and every function this role makes from now on starts out closed: now that `anonymous` may reach
-- the schema, calling one has to be a deliberate grant.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION leogram_post(text), leogram_file(text, integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION leogram_post(text), leogram_file(text, integer) TO anonymous, authenticated;
--> statement-breakpoint
-- To call them, `anonymous` has to reach the schema; it is still granted no table.
GRANT USAGE ON SCHEMA public TO anonymous;
