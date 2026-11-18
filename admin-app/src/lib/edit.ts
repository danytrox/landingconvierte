// Immutable updates that keep object key order (so saved JSON diffs stay minimal).
export type Path = (string | number)[];

export function getIn(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((v, k) => (v == null ? undefined : (v as Record<string | number, unknown>)[k]), value);
}

export function setIn<T>(value: T, path: Path, next: unknown): T {
  if (path.length === 0) return next as T;
  const [head, ...rest] = path;
  if (Array.isArray(value)) {
    const copy = value.slice();
    copy[head as number] = setIn(copy[head as number], rest, next);
    return copy as T;
  }
  const rec = (value ?? {}) as Record<string, unknown>;
  // Spreading keeps the existing key order; a new key is appended at the end.
  return { ...rec, [head]: setIn(rec[head as string], rest, next) } as T;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function removeItem<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}
