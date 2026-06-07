/* A tiny chainable, awaitable Supabase mock for unit-testing DB logic. */

export interface RecordedCall {
  table: string;
  op: "insert" | "upsert" | "update" | "delete" | "select";
  payload?: unknown;
}

export interface FakeStore {
  /** Rows returned by `.select(...)` per table. */
  selectData: Record<string, unknown[]>;
  /** Rows returned by `.delete()...select()` per table. */
  deleteReturn: Record<string, unknown[]>;
  /** Every write operation, in order, for assertions. */
  calls: RecordedCall[];
}

export function createFakeSupabase(init: Partial<FakeStore> = {}) {
  const store: FakeStore = {
    selectData: init.selectData ?? {},
    deleteReturn: init.deleteReturn ?? {},
    calls: init.calls ?? [],
  };

  function from(table: string) {
    let op: RecordedCall["op"] | null = null;
    let selected = false;

    const resolveResult = () => {
      if (op === "select") return { data: store.selectData[table] ?? [], error: null };
      if (op === "delete" && selected) return { data: store.deleteReturn[table] ?? [], error: null };
      return { data: null, error: null };
    };

    const q = {
      select(..._args: unknown[]) {
        selected = true;
        if (!op) op = "select";
        return q;
      },
      insert(payload: unknown) {
        op = "insert";
        store.calls.push({ table, op, payload });
        return q;
      },
      upsert(payload: unknown) {
        op = "upsert";
        store.calls.push({ table, op, payload });
        return q;
      },
      update(payload: unknown) {
        op = "update";
        store.calls.push({ table, op, payload });
        return q;
      },
      delete() {
        op = "delete";
        return q;
      },
      eq() {
        return q;
      },
      in() {
        return q;
      },
      is() {
        return q;
      },
      not() {
        return q;
      },
      order() {
        return q;
      },
      maybeSingle() {
        return Promise.resolve(resolveResult());
      },
      single() {
        return Promise.resolve(resolveResult());
      },
      then<T>(onF: (v: { data: unknown; error: unknown }) => T, onR?: (e: unknown) => T) {
        return Promise.resolve(resolveResult()).then(onF, onR);
      },
    };
    return q;
  }

  // Cast through unknown — the shape is sufficient for the code under test.
  return { client: { from } as unknown as import("@supabase/supabase-js").SupabaseClient, store };
}
