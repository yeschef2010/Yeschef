'use client';
// The invite code this phone has been let in with, and the headers every request carries.
const KEY = 'yc.access';

export function getAccess() {
  try {
    return window.localStorage.getItem(KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setAccess(code) {
  try {
    window.localStorage.setItem(KEY, String(code || ''));
  } catch (e) {
    // private mode: works for this visit only
  }
}

// The household code counts as access too, so someone who joined a kitchen never needs the invite code.
export function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const a = getAccess();
  if (a) h['x-yc-access'] = a;
  try {
    const hh = JSON.parse(window.localStorage.getItem('yc.household') || 'null');
    if (hh) h['x-yc-household'] = hh;
  } catch (e) {
    // ignore
  }
  return h;
}

// Any request turned away for lack of an invite code asks the app to show the invite screen.
export function noteRefused(res, data) {
  if (res.status === 403 && data && data.error === 'access' && typeof window !== 'undefined') window.dispatchEvent(new Event('yc-need-access'));
}
