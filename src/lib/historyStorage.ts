import type { HistoryEntry } from './types';

const STORAGE_KEY = 'tarot_history_v1';

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistoryEntry(entry: HistoryEntry) {
  const list = loadHistory();
  list.unshift(entry);
  saveHistory(list);
  return list;
}

export function deleteHistoryEntry(id: string) {
  const list = loadHistory().filter((x) => x.id !== id);
  saveHistory(list);
  return list;
}

export function clearHistory() {
  saveHistory([]);
  return [];
}

