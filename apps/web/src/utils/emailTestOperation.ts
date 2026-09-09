// Keep the same operation across request failures and page reloads. Storage
// failure prevents the send, rather than losing its retry identity.
export function getEmailTestOperation(storage: Storage, scope: string): { operationId: string; startedAt: string } {
  const key = `me3:email-test:${scope}`;
  const existing = storage.getItem(key);
  if (existing) return JSON.parse(existing);
  const operation = { operationId: crypto.randomUUID(), startedAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify(operation));
  return operation;
}

export function finishEmailTestOperation(storage: Storage, scope: string): void {
  storage.removeItem(`me3:email-test:${scope}`);
}
