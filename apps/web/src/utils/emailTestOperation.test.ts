import { describe, expect, it, vi } from "vitest";
import { getEmailTestOperation, finishEmailTestOperation } from "./emailTestOperation";

describe("email test retry identity", () => {
  function storage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } as Storage;
  }
  it("survives failures and reloading, and creates a new operation only after completion", () => {
    const saved = storage();
    const first = getEmailTestOperation(saved, "owner/provider/recipient");
    expect(getEmailTestOperation(saved, "owner/provider/recipient")).toEqual(first);
    expect(getEmailTestOperation(saved, "other-owner/provider/recipient").operationId).not.toBe(first.operationId);
    finishEmailTestOperation(saved, "owner/provider/recipient");
    expect(getEmailTestOperation(saved, "owner/provider/recipient").operationId).not.toBe(first.operationId);
  });
  it("fails before dispatch if durable browser storage is unavailable", () => {
    const saved = storage(); saved.setItem = vi.fn(() => { throw new Error("Storage unavailable"); });
    expect(() => getEmailTestOperation(saved, "test")).toThrow("Storage unavailable");
  });
});
