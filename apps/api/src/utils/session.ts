import type { ClientSession } from 'mongoose';

/**
 * `exactOptionalPropertyTypes` forbids passing an explicit `session: undefined`
 * to Mongoose's query options (whose `session` is typed `ClientSession | null`,
 * not `| undefined`). Repositories that accept an optional session spread this
 * helper's result into their options object instead of writing `{ session }`
 * directly, so the key is omitted entirely when there is no session.
 */
export function withSession(session?: ClientSession): { session: ClientSession } | Record<string, never> {
  return session ? { session } : {};
}
