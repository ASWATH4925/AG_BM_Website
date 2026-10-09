// Keeps the yard's records in this browser until a shared database is added.
// Everything lives under one key; a version bump starts fresh from the seed data.
const KEY = 'agbm.db.v2';
const VERSION = 2;

export function loadSaved() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.version === VERSION && data.db ? data : null;
  } catch {
    return null;
  }
}

export function save(db, seq) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: new Date().toISOString(), seq, db }));
    return true;
  } catch {
    return false;
  }
}

export function clearSaved() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
}
