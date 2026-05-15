import { pushUndo } from "./store";

/**
 * Convenience for the common "apply a patch, push its inverse" pattern.
 * `prev` is the inverse payload (state before); `next` is the forward
 * payload (state after). Both are applied via the same `apply` function
 * — typically the mutation's `.mutate` callback. The forward apply runs
 * immediately so the caller doesn't have to.
 *
 * Use this when:
 *  • The mutation takes a single payload (e.g. `{ id, patch }`).
 *  • The inverse is just a different payload to the same mutation.
 *  • The entity id doesn't change between apply and undo.
 *
 * For create-then-delete, delete-then-recreate (new id), or multi-step
 * operations, use `pushUndo` directly.
 */
export function applyWithUndo<P>(opts: {
  description: string;
  prev: P;
  next: P;
  apply: (payload: P) => void;
}) {
  opts.apply(opts.next);
  pushUndo({
    description: opts.description,
    undo: () => opts.apply(opts.prev),
    redo: () => opts.apply(opts.next),
  });
}

/**
 * Record-level convenience: given an entity object and a partial patch,
 * compute the inverse patch by copying the current values of the
 * patched keys, then call `applyWithUndo`. Saves the boilerplate of
 * writing out `prev` and `next` separately for the common case of
 * "change a few fields on a row".
 */
export function patchWithUndo<T extends object, K extends keyof T>(opts: {
  description: string;
  record: T;
  patch: Pick<T, K>;
  apply: (patch: Pick<T, K>) => void;
}) {
  const prev = {} as Pick<T, K>;
  for (const key of Object.keys(opts.patch) as K[]) {
    prev[key] = opts.record[key];
  }
  applyWithUndo({
    description: opts.description,
    prev,
    next: opts.patch,
    apply: opts.apply,
  });
}
