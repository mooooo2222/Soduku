/*
  storage.js - simple localStorage persistence for Sudoku

  Exports:
  - saveGame(key, state): saves JSON-serializable state under key
  - loadGame(key): returns parsed state or null
  - removeGame(key)
  - listSavedGames(): returns array of { key, timestamp }
  Default keys used by the app:
    - "sudoku:current" (auto-save)
    - "sudoku:save:<timestamp>" (manual saves)
    - "sudoku:stats"
*/

const PREFIX = 'sudoku:';

export function saveGame(key, state) {
  try {
    const payload = {
      ts: Date.now(),
      state
    };
    localStorage.setItem(PREFIX + key, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('saveGame error', e);
    return false;
  }
}

export function loadGame(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.error('loadGame error', e);
    return null;
  }
}

export function removeGame(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    return true;
  } catch (e) {
    console.error('removeGame error', e);
    return false;
  }
}

export function listSavedGames() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const meta = loadGame(k.replace(PREFIX, ''));
    if (meta) {
      out.push({
        key: k.replace(PREFIX, ''),
        ts: meta.ts
      });
    }
  }
  // sort by newest first
  out.sort((a,b) => b.ts - a.ts);
  return out;
}

// Convenience wrappers for common keys
export function saveCurrent(state) {
  return saveGame('current', state);
}
export function loadCurrent() {
  return loadGame('current');
}
export function saveManual(state) {
  const key = 'save:' + Date.now();
  const ok = saveGame(key, state);
  return ok ? key : null;
}
export function loadManual(key) {
  return loadGame(key);
}
