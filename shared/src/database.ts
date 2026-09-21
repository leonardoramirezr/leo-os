// What the tables hold, as the Data API hands them over.
//
// Nothing is described here: the shapes come from the models in `db/schema.ts`, which is also what
// the migrations are generated from. Add a column there and it shows up here; rename one and the
// apps stop typechecking until they follow.
//
// This is a type-only re-export, so `drizzle-orm` never reaches the browser.
export type { Json, MovementRow, PersonRow, SettingRow } from '@leo-os/db/schema';
