import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import { acquireActivationLock, releaseActivationLock } from "@/lib/activationLock";

function d1(sqlite: Database): D1Database {
  const prepare = (sql: string, binds: unknown[] = []) => ({
    bind: (...next: unknown[]) => prepare(sql, next),
    first: async <T>() => (sqlite.query(sql).get(...(binds as never[])) as T | null) ?? null,
    run: async () => {
      sqlite.query(sql).run(...(binds as never[]));
      return { success: true };
    },
  });
  return { prepare: (sql: string) => prepare(sql) } as unknown as D1Database;
}

describe("activation lock", () => {
  let sqlite: Database;
  let db: D1Database;

  beforeEach(async () => {
    sqlite = new Database(":memory:");
    sqlite.run(await Bun.file("d1/0006_activation_locks.sql").text());
    db = d1(sqlite);
  });

  it("allows exactly one claim for a lead", async () => {
    expect(await acquireActivationLock(db, "lead-1", "token-a")).toBe(true);
    expect(await acquireActivationLock(db, "lead-1", "token-b")).toBe(false);
  });

  it("only lets the owner release a cleanly rolled-back attempt", async () => {
    await acquireActivationLock(db, "lead-1", "token-a");
    await releaseActivationLock(db, "lead-1", "token-b");
    expect(await acquireActivationLock(db, "lead-1", "token-c")).toBe(false);

    await releaseActivationLock(db, "lead-1", "token-a");
    expect(await acquireActivationLock(db, "lead-1", "token-c")).toBe(true);
  });
});
