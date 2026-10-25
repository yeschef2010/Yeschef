'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_MS = 15000;

// Names are per person; household size and dietary needs are shared.
const shared = (p) => ({ household: (p && p.household) || '', dietary: (p && p.dietary) || '' });

// What changed between the last copy we agreed with the server and now.
function diff(base, next) {
  const before = new Map((base || []).map((x) => [x.id, JSON.stringify(x)]));
  const nowIds = new Set();
  const upserts = [];
  (next || []).forEach((x) => {
    nowIds.add(x.id);
    if (before.get(x.id) !== JSON.stringify(x)) upserts.push(x);
  });
  const deletes = [...before.keys()].filter((id) => !nowIds.has(id));
  return { upserts, deletes };
}

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore
  }
  if (!res.ok) {
    const err = new Error((data && data.message) || 'Couldn’t reach the shared kitchen. Check your signal.');
    err.code = data && data.error;
    throw err;
  }
  return data;
}

// Keeps stock, kit, shopping list and profile in step across everyone in a household.
export function useHouseholdSync({ code, setCode, mounted, collections, profile, setProfile }) {
  const synced = useRef({});
  const inflight = useRef(0);
  const lastLocal = useRef(0);
  const [status, setStatus] = useState('off');
  const [message, setMessage] = useState('');

  const names = Object.keys(collections);

  const apply = useCallback(
    (remote) => {
      names.forEach((n) => {
        const v = Array.isArray(remote[n]) ? remote[n] : [];
        synced.current[n] = v;
        collections[n][1](v);
      });
      const sp = shared(remote.profile);
      synced.current.profile = JSON.stringify(sp);
      setProfile((prev) => ({ ...prev, ...sp }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const load = useCallback(
    async (c, force = false) => {
      if (!c) return;
      const started = Date.now();
      try {
        const remote = await call('GET', `/api/household?code=${encodeURIComponent(c)}`);
        if (!force && (inflight.current > 0 || lastLocal.current > started)) return;
        apply(remote);
        setStatus('ok');
        setMessage('');
      } catch (e) {
        setStatus('error');
        setMessage(e.message);
      }
    },
    [apply]
  );

  // First load, then keep checking for the other phone's changes.
  useEffect(() => {
    if (!mounted || !code) {
      synced.current = {};
      setStatus('off');
      return undefined;
    }
    setStatus('syncing');
    load(code, true);
    const t = setInterval(() => document.visibilityState === 'visible' && load(code), POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && load(code);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [mounted, code, load]);

  // Send this phone's changes.
  const values = names.map((n) => collections[n][0]);
  useEffect(() => {
    if (!mounted || !code) return;
    names.forEach((n, i) => {
      const base = synced.current[n];
      const value = values[i];
      if (base == null || base === value) return;
      const { upserts, deletes } = diff(base, value);
      synced.current[n] = value;
      if (!upserts.length && !deletes.length) return;
      lastLocal.current = Date.now();
      inflight.current += 1;
      call('PATCH', '/api/household', { code, collection: n, upserts, deletes })
        .then(() => setStatus('ok'))
        .catch((e) => {
          setStatus('error');
          setMessage(e.message);
        })
        .finally(() => {
          inflight.current -= 1;
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, code, ...values]);

  useEffect(() => {
    if (!mounted || !code || synced.current.profile == null) return;
    const sp = shared(profile);
    const s = JSON.stringify(sp);
    if (s === synced.current.profile) return;
    synced.current.profile = s;
    lastLocal.current = Date.now();
    inflight.current += 1;
    call('PATCH', '/api/household', { code, collection: 'profile', value: sp })
      .catch(() => {})
      .finally(() => {
        inflight.current -= 1;
      });
  }, [mounted, code, profile]);

  const create = useCallback(async () => {
    setStatus('syncing');
    try {
      const data = { profile: shared(profile) };
      names.forEach((n) => {
        data[n] = collections[n][0];
      });
      const res = await call('POST', '/api/household', { data });
      names.forEach((n) => {
        synced.current[n] = collections[n][0];
      });
      synced.current.profile = JSON.stringify(shared(profile));
      setCode(res.code);
      setStatus('ok');
      return res.code;
    } catch (e) {
      setStatus('error');
      setMessage(e.message);
      throw e;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, ...values]);

  const join = useCallback(
    async (raw) => {
      const c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      setStatus('syncing');
      try {
        const remote = await call('GET', `/api/household?code=${encodeURIComponent(c)}`);
        apply(remote);
        setCode(c);
        setStatus('ok');
        setMessage('');
      } catch (e) {
        setStatus(code ? 'ok' : 'off');
        throw e;
      }
    },
    [apply, setCode, code]
  );

  const leave = useCallback(() => {
    synced.current = {};
    setCode(null);
    setStatus('off');
  }, [setCode]);

  return { status, message, create, join, leave, refresh: () => load(code, true) };
}
