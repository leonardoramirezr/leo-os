-- Written by hand: drizzle-kit tracks tables, columns and policies, not functions.
--
-- «Plantillas» keeps the answers on the device first and sends them when it can, from any of the
-- account's devices, in any order. What settles two copies of the same answers is `edited_at`, the
-- moment each was last edited: the later one wins, whichever arrives last. The Data API's plain
-- PATCH cannot say «only if older», hence these two.
--
-- Both run as whoever calls them (no SECURITY DEFINER), so the table's own policy still decides
-- which rows they reach. Moments go out as ISO 8601 in UTC ending in Z, whatever the session's
-- time zone, which is how the app writes them too.

-- Saves each of `answers` — `[{ id, content, edited_at }]` — over the row already there only if it
-- is later than it, and answers with every one of those rows as the database now holds it: the one
-- just sent, or a later one from another device, which the app then takes in place of its own.
CREATE FUNCTION plantillas_save_answers(answers jsonb) RETURNS jsonb
LANGUAGE sql VOLATILE
BEGIN ATOMIC
	INSERT INTO plantillas_answers (id, content, edited_at)
	SELECT (a->>'id')::uuid, a->>'content', (a->>'edited_at')::timestamptz
	FROM jsonb_array_elements(plantillas_save_answers.answers) a
	ON CONFLICT (id) DO UPDATE SET content = excluded.content, edited_at = excluded.edited_at
	WHERE plantillas_answers.edited_at < excluded.edited_at;

	SELECT coalesce(jsonb_agg(jsonb_build_object(
		'id', p.id,
		'content', p.content,
		'edited_at', to_char(p.edited_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	)), '[]'::jsonb)
	FROM plantillas_answers p
	WHERE p.id IN (SELECT (a->>'id')::uuid FROM jsonb_array_elements(plantillas_save_answers.answers) a);
END;
--> statement-breakpoint
-- Every row of the caller's answers, the moments written the same way.
CREATE FUNCTION plantillas_read_answers() RETURNS jsonb
LANGUAGE sql STABLE
BEGIN ATOMIC
	SELECT coalesce(jsonb_agg(jsonb_build_object(
		'id', p.id,
		'content', p.content,
		'edited_at', to_char(p.edited_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
	)), '[]'::jsonb)
	FROM plantillas_answers p;
END;
--> statement-breakpoint
REVOKE ALL ON FUNCTION plantillas_save_answers(jsonb), plantillas_read_answers() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION plantillas_save_answers(jsonb), plantillas_read_answers() TO authenticated;
