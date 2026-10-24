import { codeFromHash } from '../net/roomCode';

export type EntryAction =
  | { kind: 'front' }
  | { kind: 'invited'; code: string }
  | { kind: 'autoJoin'; code: string; name: string };

/** What to do on first load: an invite link joins straight away when a name is already saved. */
export function entryAction(hash: string, savedName: string): EntryAction {
  const code = codeFromHash(hash);
  if (!code) return { kind: 'front' };
  const name = savedName.trim();
  return name ? { kind: 'autoJoin', code, name } : { kind: 'invited', code };
}
