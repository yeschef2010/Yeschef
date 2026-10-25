'use client';
import { useEffect, useRef, useState } from 'react';

// State that is saved on this phone, so the kitchen is still there next time.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(initial);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw));
    } catch (e) {
      // Storage can be blocked (private browsing); the app still works for this visit.
    }
    loaded.current = true;
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore
    }
  }, [key, value]);

  return [value, setValue];
}

export function clearAllSaved() {
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('yc.'))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch (e) {
    // ignore
  }
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
