/**
 * Maps an AI-suggested filing name (project / recording-list) onto the existing
 * options. The edge function only knows names; the client owns the ids.
 *
 * - If the name matches an existing option (case-insensitive, trimmed) →
 *   `{ matchId }`.
 * - Otherwise, if the name is non-empty → `{ matchId: null, proposeNew: <name> }`
 *   so the wizard can offer a "create new" chip.
 * - Empty / missing name → `{ matchId: null }` (nothing suggested).
 */
export interface SuggestedNameMatch {
  matchId: string | null;
  /** Non-null when the suggestion is to create a new option with this name. */
  proposeNew?: string;
}

export function mapSuggestedName(
  suggested: { name: string; is_new: boolean } | null | undefined,
  options: Array<{ id: string; name: string }>,
): SuggestedNameMatch {
  const name = suggested?.name?.trim();
  if (!name) return { matchId: null };

  const norm = name.toLocaleLowerCase();
  const hit = options.find((o) => o.name.trim().toLocaleLowerCase() === norm);
  if (hit) return { matchId: hit.id };

  // No existing match — propose creating it (regardless of the model's is_new
  // flag, since a name it thought existed might have been renamed/removed).
  return { matchId: null, proposeNew: name };
}
