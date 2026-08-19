// Prisma's generated input types (under `exactOptionalPropertyTypes: true`)
// distinguish "key absent" from "key present with value `undefined`". Zod's
// `.optional()` fields are typed as `T | undefined` either way, so parsed
// input must be stripped of `undefined` values — and re-typed without the
// `undefined` member — before being handed to Prisma's create/update
// `data`/`where` arguments.
//
// Only safe for genuinely optional keys (`field?: T | undefined`). If a
// caller ever passes a REQUIRED key typed as including `undefined` (e.g.
// `{ note: string | undefined }`, no `?`), this still strips it at runtime
// but the return type claims the key is guaranteed present — a latent
// mismatch. None of this codebase's current callers do that (all come from
// Zod `.optional()` schemas), but don't reuse this helper on a shape with a
// required-but-possibly-undefined field without re-checking that guarantee.
export function omitUndefined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>
  }
}
