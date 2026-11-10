'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentState, clearAllSaved, newId } from '@/lib/store';
import { useHouseholdSync } from '@/lib/sync';
import { normAmount, parseQty, formatAmount, addAmounts, findSame, takeFrom, totalOf } from '@/lib/amounts';
import { FOOD_AREAS, MEALS, PRODUCT_AREAS, kindOfArea, dateLine, daysLeft, locationKey, mealForHour, migrateArea, qtyFromLocations, todayKey } from '@/lib/helpers';
import AddItems from './Tour';
import { splitPastedOrder } from '@/lib/media';
import { parseHousehold } from '@/lib/servings';
import { authHeaders, getAccess, noteRefused, setAccess } from '@/lib/access';
import { checkList, estimate, withEstimates } from '@/lib/drift';
import { aisleOf, matchesListItem, shopById } from '@/lib/shops';
import { About, AccessGate, Account, EditSheet, Home, Kit, Kitchen, Recipe, Settings, Shop, Welcome } from './Screens';
import { Basket, Calendar, Spray, Fridge, Info, MenuIcon, Pan, Person, Plate, Sliders } from './Icons';
import Plan from './Plan';
import { dayLong, dayShort, defrostFor, eatersText, isoDate, savedFor, weekNeeds, weeknights } from '@/lib/plan';

const FRIENDLY_FAIL = 'Sorry Chef, I couldn’t reach the kitchen brain. Check your signal and try again.';

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore
  }
  if (!res.ok) {
    noteRefused(res, data);
    const err = new Error((data && data.message) || FRIENDLY_FAIL);
    err.detail = (data && data.detail) || (data ? '' : `HTTP ${res.status}`);
    throw err;
  }
  return data;
}

const PHYSICAL = { Fridge: 'Fridge', Freezer: 'Freezer', Cupboard: 'Cupboards', Cupboards: 'Cupboards' };

function cleanCheck(c, areas) {
  if (!c || typeof c !== 'object' || !c.question || !Array.isArray(c.options)) return null;
  const options = c.options
    .filter((o) => o && o.label)
    .map((o) => ({ label: String(o.label), area: areas.includes(o.area) ? o.area : undefined, shelfDays: typeof o.shelfDays === 'number' ? o.shelfDays : o.shelfDays === null ? null : undefined }))
    .slice(0, 3);
  return options.length >= 2 ? { question: String(c.question), options } : null;
}

function normaliseFood(it, fallbackArea, where) {
  const amount = normAmount(it.amount) || parseQty(it.qty);
  const ALL = [...FOOD_AREAS, ...PRODUCT_AREAS];
  const area = ALL.includes(it.area) ? it.area : ALL.includes(fallbackArea) ? fallbackArea : 'Cupboards';
  let status = it.status || null;
  if (status && !['Low', 'Out'].includes(status)) status = null;
  return {
    id: newId(),
    name: String(it.name || '').trim(),
    qty: String(it.qty || '').trim() || (amount ? formatAmount(amount) : ''),
    amount,
    pack: normAmount(it.pack),
    // A receipt is new shopping, so it adds to what's there. Anything filmed or snapped is what's there now.
    source: fallbackArea === 'Receipt' ? 'receipt' : 'seen',
    area,
    shelfDays: typeof it.shelfDays === 'number' ? it.shelfDays : null,
    status,
    category: typeof it.category === 'string' ? it.category : null,
    style: ['Red', 'White', 'Rosé', 'Sparkling'].includes(it.style) ? it.style : null,
    // Where it physically is: what the person told us, what the AI saw, or the area being scanned.
    seenIn: fallbackArea === 'Receipt' ? null : PHYSICAL[where] || PHYSICAL[it.seenIn] || fallbackArea || null,
    check: cleanCheck(it.check, ALL),
    addedAt: Date.now(),
  };
}

// Put one found item into a list: update the same thing if it's already there, otherwise add it.
function mergeItem(next, f, eaters) {
  const { kind, job, seenIn, check, source, amount, pack, ...item } = f;
  const key = locationKey(seenIn, item.area);
  const here = amount || item.qty;
  const i = findSame(next, item);
  if (i < 0) {
    const locations = { [key]: here };
    next.push({ ...item, pack: pack || null, locations, qty: qtyFromLocations(locations), countedAt: Date.now() });
    return;
  }
  const prev = next[i];
  const locations = { ...(prev.locations || { main: prev.qty }) };
  if (source === 'receipt') {
    // New shopping adds to what's already in (what's probably left of everyday things, not what was counted days ago).
    // If the old amount was just words ("half a bag"), keep both.
    const est = estimate(prev, eaters);
    if (est && key === 'main' && Object.keys(locations).length <= 1) locations.main = est.amount.n > 0 ? est.amount : undefined;
    if (locations.main === undefined) delete locations.main;
    const old = locations[key];
    const sum = old == null ? parseQty(here) : addAmounts(old, here);
    locations[key] = sum || (old ? `${typeof here === 'object' ? formatAmount(here) : here} + ${typeof old === 'object' ? formatAmount(old) : old}` : here);
  } else {
    locations[key] = here;
  }
  // Keep the older use-by if it's sooner: the old pint still needs drinking first.
  const prevLeft = daysLeft(prev);
  const newLeft = daysLeft(item);
  const keepOld = source === 'receipt' && prevLeft != null && (newLeft == null || prevLeft < newLeft);
  next[i] = {
    ...prev,
    ...item,
    name: prev.name,
    id: prev.id,
    category: prev.category || item.category,
    ...(keepOld ? { shelfDays: prev.shelfDays, addedAt: prev.addedAt } : {}),
    status: source === 'receipt' ? null : item.status,
    pack: pack || prev.pack || null,
    locations,
    qty: qtyFromLocations(locations),
    countedAt: Date.now(),
  };
}

export default function App() {
  const [stock, setStock] = usePersistentState('yc.stock', []);
  const [kit, setKit] = usePersistentState('yc.kit', []);
  const [products, setProducts] = usePersistentState('yc.products', []);
  const [pending, setPending] = usePersistentState('yc.pending', []);
  const [onboarded, setOnboarded] = usePersistentState('yc.onboarded', false);
  const [profile, setProfile] = usePersistentState('yc.profile', { name: '', household: '', dietary: '' });
  const [settings, setSettings] = usePersistentState('yc.settings', { useUp: true, autoIdea: true });
  const [shopList, setShopList] = usePersistentState('yc.shop', []);
  const [waste, setWaste] = usePersistentState('yc.waste', []);
  const [plan, setPlan] = usePersistentState('yc.plan', []);
  const [lastCheck, setLastCheck] = usePersistentState('yc.lastCheck', 0);
  const shopRef = useRef(shopList);
  shopRef.current = shopList;
  const [bannerAction, setBannerAction] = useState(null);
  // The last thing swiped away, so it can come back.
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  function swipeDelete(shown, isProduct) {
    // The Kitchen shows estimates; keep the real record so Undo puts back exactly what was there.
    const item = (isProduct ? products : stock).find((x) => x.id === shown.id) || shown;
    const set = isProduct ? setProducts : setStock;
    set((list) => list.filter((x) => x.id !== item.id));
    setUndo({ ...item, isProduct });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  }
  function undoDelete() {
    if (!undo) return;
    const { isProduct, ...item } = undo;
    (isProduct ? setProducts : setStock)((list) => (list.some((x) => x.id === item.id) ? list : [...list, item]));
    setUndo(null);
  }
  const [ideas, setIdeas] = usePersistentState('yc.ideas', {});
  const [household, setHousehold] = usePersistentState('yc.household', null);
  // Who's usually eating: set on a recipe, or read from "2 adults, 2 kids" in Account.
  const eaters =
    profile.adults != null || profile.kids != null
      ? { adults: profile.adults ?? 2, kids: profile.kids ?? 0 }
      : parseHousehold(profile.household);
  const [mounted, setMounted] = useState(false);
  const [joinPrefill, setJoinPrefill] = useState('');
  useEffect(() => setMounted(true), []);

  const sync = useHouseholdSync({
    code: household,
    setCode: setHousehold,
    mounted,
    collections: { stock: [stock, setStock], kit: [kit, setKit], shop: [shopList, setShopList], products: [products, setProducts], waste: [waste, setWaste], plan: [plan, setPlan] },
    profile,
    setProfile,
  });

  // Move herbs and drinks logged before they had their own areas.
  useEffect(() => {
    if (!mounted) return;
    setStock((s) => {
      const moved = s.map(migrateArea);
      if (!moved.some((x, i) => x !== s[i])) return s;
      // If the same thing now sits in one area twice (e.g. sparkling water from the fridge and the cupboard), combine them.
      const out = [];
      moved.forEach((it) => {
        const j = out.findIndex((o) => o.area === it.area && o.name.toLowerCase() === it.name.toLowerCase());
        if (j < 0) return out.push(it);
        const a = out[j].locations || { main: out[j].qty };
        const b = it.locations || { main: it.qty };
        const locations = { ...a, ...Object.fromEntries(Object.entries(b).filter(([k]) => !(k in a))) };
        out[j] = { ...out[j], locations, qty: qtyFromLocations(locations) };
      });
      return out;
    });
  }, [mounted, setStock]);

  // Opened from an invite link: ?join=CODE
  useEffect(() => {
    if (!mounted) return;
    const j = new URLSearchParams(window.location.search).get('join');
    if (j) {
      setJoinPrefill(j);
      // A brand-new phone joins from the welcome screen; an existing one from Account.
      if (onboarded) setScreen('account');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const [screen, setScreen] = useState(null);
  const [addMode, setAddMode] = useState('kitchen'); // 'kitchen' | 'products' | 'kit'
  const [jobs, setJobs] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState('quick');
  const [ideaState, setIdeaState] = useState('idle');
  const [ideaError, setIdeaError] = useState('');
  const [banner, setBanner] = useState('');
  const [now, setNow] = useState(() => new Date());
  const stockRef = useRef(stock);
  stockRef.current = stock;
  const eatersRef = useRef(eaters);
  eatersRef.current = eaters;
  // The kitchen as it probably is now: everyday things (milk, bread, fruit) run down between counts.
  const stockView = useMemo(() => withEstimates(stock, eaters, now.getTime()), [stock, eaters, now]);
  const checkItems = useMemo(() => (now.getTime() - (lastCheck || 0) > 3 * 86400000 ? checkList(stockView) : []), [stockView, lastCheck, now]);
  const binnedThisMonth = waste.filter((w) => new Date(w.at).getMonth() === now.getMonth() && new Date(w.at).getFullYear() === now.getFullYear()).length;

  // "Still got these?" answers.
  function answerCheck(id, answer) {
    const item = stock.find((x) => x.id === id);
    if (!item) return;
    if (answer === 'gone') {
      setStock((l) => l.filter((x) => x.id !== id));
      addToList([{ name: item.name, area: item.area, category: item.category, why: 'Ran out' }], 'Ran out', { quiet: true });
    } else {
      setStock((l) => l.map((x) => (x.id === id ? { ...x, countedAt: Date.now(), status: answer === 'low' ? 'Low' : null } : x)));
      if (answer === 'low') addToList([{ name: item.name, area: item.area, category: item.category, why: 'Running low' }], 'Running low', { quiet: true });
    }
  }

  /* ----- Invite-only access ----- */
  // 'ok' | 'needed'. Only shown when an invite code is set in Vercel and this phone has no way in yet.
  const [gate, setGate] = useState('ok');
  useEffect(() => {
    if (!mounted) return undefined;
    const need = () => setGate('needed');
    window.addEventListener('yc-need-access', need);
    if (!household && !getAccess()) {
      fetch('/api/access')
        .then((r) => r.json())
        .then((d) => d && d.required && setGate('needed'))
        .catch(() => {});
    }
    return () => window.removeEventListener('yc-need-access', need);
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enterInvite(code) {
    const res = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data && data.message) || 'That invite code isn’t right.');
    setAccess(code);
    setGate('ok');
  }

  async function joinFromGate(code) {
    await sync.join(code);
    setGate('ok');
    setOnboarded(true);
    setScreen('home');
  }

  /* ----- Reminders (phone notifications) ----- */
  const [notifyState, setNotifyState] = useState('off');
  const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Register the service worker and see whether this phone already gets reminders.
  useEffect(() => {
    if (!mounted || !pushSupported()) {
      if (mounted) setNotifyState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') setNotifyState('blocked');
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub && Notification.permission === 'granted') {
          setNotifyState('on');
          // Keep the household's copy up to date (e.g. after joining a household).
          if (household) postJson('/api/push', { code: household, subscription: sub.toJSON() }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [mounted, household]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enableNotifications() {
    if (!pushSupported()) return setNotifyState('unsupported');
    if (!household) return;
    setNotifyState('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return setNotifyState(permission === 'denied' ? 'blocked' : 'off');
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { publicKey } = await fetch('/api/push').then((r) => r.json());
      const raw = atob(publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (publicKey.length % 4)) % 4));
      const applicationServerKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));
      await postJson('/api/push', { code: household, subscription: sub.toJSON() });
      setNotifyState('on');
    } catch (e) {
      setNotifyState('off');
      setPlanError(`Couldn’t turn reminders on. ${e.message || ''}`.trim());
    }
  }

  // Tapping a reminder opens the right page (?go=plan).
  useEffect(() => {
    if (!mounted) return;
    const go = new URLSearchParams(window.location.search).get('go');
    if (go && ['home', 'plan', 'kitchen', 'shop'].includes(go)) {
      setScreen(go);
      window.history.replaceState(null, '', '/');
    }
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- Plan the week ----- */
  const todayIso = isoDate(now);
  const planDates = useMemo(() => weeknights(now), [now.getDate(), now.getHours() >= 20]); // eslint-disable-line react-hooks/exhaustive-deps
  const [planBusy, setPlanBusy] = useState({});
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState('');
  const [planShop, setPlanShop] = useState('');
  const [recipeFrom, setRecipeFrom] = useState(null);
  const defaultEaters = eaters || { adults: 2, kids: 0 };
  const nights = planDates.map((d) => {
    const saved = plan.find((n) => n.date === d);
    const base = saved || { id: d, date: d, eaters: defaultEaters, off: false };
    return { ...base, eaters: base.eaters || defaultEaters, loading: planBusy[d] === 'loading', error: planBusy[d] === 'error' };
  });
  const tonightPlan = nights.find((n) => n.date === todayIso && n.idea && !n.off && !n.cooked) || null;

  function upsertNight(date, patch) {
    setPlan((list) => {
      const cutoff = isoDate(new Date(Date.now() - 14 * 86400000));
      const kept = list.filter((n) => n.date >= cutoff);
      const i = kept.findIndex((n) => n.date === date);
      const prev = i >= 0 ? kept[i] : { id: date, date, eaters: defaultEaters, off: false };
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      return i >= 0 ? kept.map((n, j) => (j === i ? next : n)) : [...kept, next];
    });
  }

  // Write out one planned night's full recipe, and work out what it needs from the freezer.
  function loadPlanRecipe(date, card, who) {
    const base = { ...ideaBase(), eaters: who, household: eatersText(who), meal: 'dinner' };
    upsertNight(date, (n) => ({ idea: { ...(n.idea || card), detail: 'loading' } }));
    postJson('/api/ideas', { ...base, step: 'recipe', idea: { title: card.title, why: card.why, time: card.time } })
      .then((r) =>
        upsertNight(date, (n) =>
          n.idea && n.idea.title === card.title
            ? { idea: { ...n.idea, ...r, serves: r.serves || who, missing: r.missing && r.missing.length ? r.missing : card.missing, detail: 'ready' }, defrost: defrostFor(r, stockRef.current) }
            : {}
        )
      )
      .catch(() => upsertNight(date, (n) => (n.idea && n.idea.title === card.title ? { idea: { ...n.idea, detail: 'error' } } : {})));
  }

  // Plan some or all of the week's nights in one go, keeping the others as they are.
  async function planWeek(onlyDates, requests = {}) {
    const targets = (onlyDates || planDates).filter((d) => !(nights.find((n) => n.date === d) || {}).off);
    if (!targets.length) return;
    if (!onlyDates) setPlanning(true);
    setPlanError('');
    setPlanBusy((b) => ({ ...b, ...Object.fromEntries(targets.map((d) => [d, 'loading'])) }));
    const keep = nights.filter((n) => !targets.includes(n.date) && n.idea && !n.off).map((n) => ({ day: dayLong(n.date), title: n.idea.title }));
    try {
      const data = await postJson('/api/ideas', {
        ...ideaBase(),
        step: 'week',
        nights: targets.map((d) => {
          const n = nights.find((x) => x.date === d);
          return { date: d, day: dayLong(d), eaters: eatersText(n.eaters), request: requests[d] || '' };
        }),
        keep,
      });
      (data.nights || []).forEach((card) => {
        if (!card) return;
        const n = nights.find((x) => x.date === card.date);
        upsertNight(card.date, { idea: { ...card, detail: 'loading' }, request: requests[card.date] || '', cooked: false, defrost: [] });
        loadPlanRecipe(card.date, card, (n && n.eaters) || defaultEaters);
      });
      const failed = targets.filter((d) => !(data.nights || []).some((c) => c && c.date === d));
      setPlanBusy((b) => ({ ...b, ...Object.fromEntries(targets.map((d) => [d, failed.includes(d) ? 'error' : ''])) }));
      setPlanShop('');
    } catch (e) {
      setPlanBusy((b) => ({ ...b, ...Object.fromEntries(targets.map((d) => [d, onlyDates ? 'error' : ''])) }));
      setPlanError(`${e.message || FRIENDLY_FAIL}${e.detail ? `\nDetails: ${e.detail}` : ''}`);
    }
    setPlanning(false);
  }

  // Everything the week needs that isn't in the kitchen, in sensible packs, onto the shopping list.
  async function shopForWeek() {
    const needs = weekNeeds(nights.filter((n) => !n.off), stock);
    if (!needs.length) {
      setPlanShop('done');
      setBanner('You’ve already got everything for the week.');
      return;
    }
    setPlanShop('loading');
    try {
      const r = await postJson('/api/ideas', { ...ideaBase(), step: 'packs', needs: needs.map((n) => ({ name: n.name, amount: n.amount, nights: n.nights })) });
      const items = (r.items && r.items.length ? r.items : needs.map((n) => ({ name: n.name, buy: n.amount, why: n.nights.join(', ') })));
      addToList(
        items.map((i) => {
          const hint = needs.find((n) => n.name.toLowerCase() === i.name.toLowerCase()) || {};
          return { name: i.name, qty: i.buy, why: i.why || 'For the week', area: hint.area, category: hint.category };
        }),
        'For the week',
        { quiet: true }
      );
      setPlanShop('done');
    } catch (e) {
      setPlanShop('error');
    }
  }

  function openPlanRecipe(date) {
    setRecipeFrom({ plan: date });
    setBanner('');
    setScreen('recipe');
  }

  // Used up or binned from the edit sheet. Binned things go in the waste tally.
  function finishItem(item, how, isProduct) {
    (isProduct ? setProducts : setStock)((l) => l.filter((x) => x.id !== item.id));
    if (how === 'binned') setWaste((w) => [...w, { id: newId(), name: item.name, qty: item.qty || '', area: item.area, at: Date.now() }].slice(-500));
    const already = shopRef.current.some((l) => !l.done && matchesListItem(l, item.name));
    setBanner(how === 'binned' ? `Binned ${item.name.toLowerCase()}. That’s ${binnedThisMonth + 1} thing${binnedThisMonth ? 's' : ''} binned this month.` : `Used up ${item.name.toLowerCase()}.`);
    setBannerAction(already ? null : { label: `Add ${item.name.toLowerCase()} to the shopping list`, run: () => addToList([{ name: item.name, area: item.area, category: item.category, why: how === 'binned' ? 'Binned it' : 'Used it up' }]) });
  }
  const autoTried = useRef({});

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const current = screen || (onboarded ? 'home' : 'welcome');
  const mealKey = mealForHour(now.getHours(), now.getMinutes());
  const ideaKey = `${todayKey(now)}-${mealKey}-${mode}`;
  // Three ideas per meal. Older saved ideas were a single one, so wrap those.
  const ideaSet = ((v) => (!v ? null : Array.isArray(v.ideas) ? v : v.title ? { ideas: [v], avoid: v.avoid || [] } : null))(ideas[ideaKey]);
  const ideaList = ideaSet ? ideaSet.ideas : [];
  const [ideaIdx, setIdeaIdx] = useState(0);
  const idea = ideaList[ideaIdx] || ideaList[0] || null;

  /* ----- Saving found items into the kitchen ----- */
  const commitItems = useCallback((list) => {
    const food = list.filter((p) => p.kind !== 'kit' && p.kind !== 'product');
    const kitItems = list.filter((p) => p.kind === 'kit');
    const productItems = list.filter((p) => p.kind === 'product');
    if (productItems.length) {
      setProducts((ps) => {
        const next = [...ps];
        productItems.forEach((f) => mergeItem(next, { ...f, seenIn: null }, eatersRef.current));
        return next;
      });
    }
    if (food.length) {
      setStock((s) => {
        const next = [...s];
        food.forEach((f) => mergeItem(next, f, eatersRef.current));
        return next;
      });
    }
    if (kitItems.length) {
      setKit((k) => {
        const next = [...k];
        kitItems.forEach((f) => {
          const item = { id: f.id, name: f.name, note: f.note, category: f.category || null };
          const i = next.findIndex((x) => x.name.toLowerCase() === item.name.toLowerCase());
          if (i >= 0) next[i] = { ...next[i], note: item.note || next[i].note };
          else next.push(item);
        });
        return next;
      });
    }
    if (food.length || kitItems.length) setIdeas({});
    // Anything bought on a receipt comes off the shopping list.
    const bought = [...food, ...productItems].filter((f) => f.source === 'receipt').map((f) => f.name);
    if (bought.length) {
      const open = shopRef.current.filter((l) => !l.done);
      const ticked = open.filter((l) => bought.some((b) => matchesListItem(l, b)));
      if (ticked.length) {
        const ids = new Set(ticked.map((t) => t.id));
        setShopList((l) => l.map((x) => (ids.has(x.id) ? { ...x, done: true } : x)));
        const still = open.filter((l) => !ids.has(l.id)).map((l) => l.name.toLowerCase());
        setTimeout(() => setBanner(`Ticked ${ticked.length} ${ticked.length === 1 ? 'thing' : 'things'} off your shopping list.${still.length ? ` Still need: ${still.slice(0, 5).join(', ')}${still.length > 5 ? '…' : ''}.` : ' All done.'}`), 50);
      }
    }
  }, [setStock, setKit, setProducts, setIdeas, setShopList]);

  // Names already in the kitchen, so the AI reuses them rather than making duplicates.
  const knownNames = useRef([]);
  knownNames.current = [...stock, ...products].map((s) => s.name);

  // Jobs whose results should go straight into the kitchen when they arrive.
  const autoSave = useRef(new Set());

  /* ----- Reading photos, video frames, notes, receipts and files ----- */
  const submitScan = useCallback((area, images, note, typedFallback, docs = [], opts = {}) => {
    const id = newId();
    setJobs((j) => [...j, { id, area, state: 'loading', images, note, typedFallback, docs, opts }]);

    // Send photos a few at a time so each request stays small and the labels stay sharp. Each file goes on its own.
    const batches = [];
    for (let i = 0; i < images.length; i += 3) batches.push({ images: images.slice(i, i + 3), docs: [], note });
    docs.forEach((d) => batches.push({ images: [], docs: [d], note }));
    // A pasted order on its own is read in small pieces, side by side.
    if (batches.length === 0 && opts.pasted) splitPastedOrder(note).forEach((piece) => batches.push({ images: [], docs: [], note: piece }));
    if (batches.length === 0) batches.push({ images: [], docs: [], note });

    Promise.allSettled(batches.map((b) => postJson('/api/scan', { area, images: b.images, docs: b.docs, note: b.note, where: opts.where || null, known: knownNames.current })))
      .then((results) => {
        const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        if (ok.length === 0) throw results[0].reason || new Error(FRIENDLY_FAIL);
        const kind = ok[0].kind;
        const seen = new Set();
        const items = ok
          .flatMap((d) => d.items || [])
          .filter((it) => it && it.name)
          .filter((it) => {
            const k = `${String(it.name).toLowerCase().trim()}|${it.area || ''}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        const mapped =
          kind === 'kit'
            ? items.map((it) => ({ id: newId(), name: String(it.name).trim(), note: String(it.note || '').trim(), area: 'Equipment', category: it.category || null, kind: 'kit', job: id }))
            : items.map((it) => {
                const f = normaliseFood(it, area, opts.where);
                return { ...f, kind: kindOfArea(f.area), job: id };
              });
        if (mapped.length === 0 && typedFallback) {
          mapped.push({ ...normaliseFood({ name: typedFallback }, 'Cupboards'), kind: 'food', job: id });
        }
        if (mapped.length === 0) {
          const where = area === 'Auto' ? 'those' : area === 'Receipt' ? 'that receipt' : `your ${area.toLowerCase()}`;
          const hint =
            area === 'Spice rack'
              ? 'Try photos closer up, a few jars at a time, with the labels facing the camera.'
              : area === 'Receipt'
              ? 'Try a flat, well-lit photo with the whole receipt in shot, or a long receipt in two halves.'
              : 'Try again closer up, in good light, or say what\u2019s there as you go.';
          setJobs((j) => j.map((x) => (x.id === id ? { ...x, state: 'error', message: `I couldn\u2019t spot anything in ${where}. ${hint}` } : x)));
          return;
        }
        if (autoSave.current.has(id)) {
          commitItems(mapped);
          setBanner(`Saved ${mapped.length} more ${mapped.length === 1 ? 'thing' : 'things'} to your kitchen.`);
        } else setPending((p) => [...p, ...mapped]);
        setJobs((j) => j.filter((x) => x.id !== id));
      })
      .catch((e) => {
        if (typedFallback) {
          setPending((p) => [...p, { ...normaliseFood({ name: typedFallback }, 'Cupboards'), kind: 'food', job: id }]);
          setJobs((j) => j.filter((x) => x.id !== id));
          return;
        }
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, state: 'error', message: e.message || FRIENDLY_FAIL } : x)));
      });
    return id;
  }, [setPending, commitItems]);

  function retryJob(job) {
    setJobs((j) => j.filter((x) => x.id !== job.id));
    return submitScan(job.area, job.images, job.note, job.typedFallback, job.docs || [], job.opts || {});
  }

  // Save one area's results now (used by the kitchen tour, area by area).
  function saveJobs(ids) {
    const set = new Set(ids);
    const items = pending.filter((p) => set.has(p.job));
    commitItems(items);
    setPending((p) => p.filter((x) => !set.has(x.job)));
    ids.forEach((id) => autoSave.current.add(id));
    setJobs((j) => j.filter((x) => !(set.has(x.id) && x.state === 'error')));
    setOnboarded(true);
  }



  /* ----- Meal ideas ----- */
  // What the AI needs to know for any idea or recipe right now.
  const ideaBase = useCallback(() => {
    const saved = savedFor(plan, isoDate(now));
    const stockForAi = stockView.map((s) => ({ saved: saved.get(s.name.toLowerCase()) || undefined, name: s.name, qty: ((t) => (t ? `${s.qty}; ${t.n} ${t.unit === 'each' ? t.word || 'each' : t.unit} in total` : s.qty))(totalOf(s)), area: s.area, daysLeft: daysLeft(s), status: s.status }));
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const weekend = now.getDay() === 0 || now.getDay() === 6;
    return {
      meal: mealKey,
      mode,
      stock: stockForAi,
      kit: kit.map((k) => ({ name: k.name, note: k.note })),
      eaters,
      household: eaters
        ? `${eaters.adults} adult${eaters.adults === 1 ? '' : 's'}${eaters.kids ? `, ${eaters.kids} kid${eaters.kids === 1 ? '' : 's'}` : ''}${profile.household && !parseHousehold(profile.household) ? ` (${profile.household})` : ''}`
        : profile.household,
      dietary: profile.dietary,
      context: `It's ${day}${weekend ? ' (weekend)' : ''}, ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}.`,
    };
  }, [stockView, kit, profile, mealKey, mode, now, plan]);

  // Fill in one idea's full recipe (ingredients, steps) in the background.
  const loadRecipe = useCallback((key, i, card, base) => {
    const patch = (p) =>
      setIdeas((all) => {
        const set = all[key];
        if (!set || !Array.isArray(set.ideas) || !set.ideas[i] || set.ideas[i].title !== card.title) return all;
        const list = set.ideas.map((x, j) => (j === i ? { ...x, ...p } : x));
        return { ...all, [key]: { ...set, ideas: list } };
      });
    patch({ detail: 'loading' });
    postJson('/api/ideas', { ...base, step: 'recipe', idea: { title: card.title, why: card.why, time: card.time } })
      .then((r) => patch({ ...r, serves: r.serves || base.eaters || null, missing: r.missing && r.missing.length ? r.missing : card.missing, detail: 'ready' }))
      .catch(() => patch({ detail: 'error' }));
  }, [setIdeas]);

  // request: what they've asked for ("high protein"). Left out, it keeps the current one (for "Three more").
  const getIdea = useCallback(async (avoidCurrent, request) => {
    setIdeaState('loading');
    setIdeaError('');
    const ask = (request === undefined ? (ideaSet && ideaSet.request) || '' : request).trim().slice(0, 120);
    const base = { ...ideaBase(), request: ask };
    const key = ideaKey;
    try {
      const sameAsk = ideaSet && (ideaSet.request || '') === ask;
      const avoid = avoidCurrent && ideaSet && sameAsk ? [...(ideaSet.avoid || []), ...ideaSet.ideas.map((i) => i.title)].slice(-12) : [];
      const data = await postJson('/api/ideas', { ...base, step: 'cards', avoid });
      const cards = (data.ideas || []).map((c) => ({ ...c, detail: 'loading' }));
      setIdeas((all) => ({ ...all, [key]: { ideas: cards, avoid, request: ask } }));
      setIdeaIdx(0);
      setIdeaState('idle');
      cards.forEach((c, i) => loadRecipe(key, i, c, base));
    } catch (e) {
      setIdeaError(`${e.message || FRIENDLY_FAIL}${e.detail ? `\nDetails: ${e.detail}` : ''}`);
      setIdeaState('error');
    }
  }, [ideaBase, ideaKey, ideaSet, loadRecipe]);

  useEffect(() => {
    if (!mounted || current !== 'home' || !settings.autoIdea) return;
    if (stock.length === 0 || idea || ideaState !== 'idle' || autoTried.current[ideaKey] || (mealKey === 'dinner' && tonightPlan)) return;
    autoTried.current[ideaKey] = true;
    getIdea(false);
  }, [mounted, current, settings.autoIdea, stock.length, idea, ideaState, ideaKey, getIdea]);

  // Add things to the shopping list. Each can be a name, or a stock item (so we know its aisle and usual amount).
  function addToList(things, why = 'For a recipe', { quiet = false, findOptions = false } = {}) {
    const list = shopRef.current;
    const added = [];
    const fresh = things
      .map((t) => (typeof t === 'string' ? { name: t } : t))
      .filter((t) => t && t.name && !list.some((l) => !l.done && matchesListItem(l, t.name)) && !added.some((x) => x.name.toLowerCase() === t.name.toLowerCase()))
      .map((t) => {
        const item = { id: newId(), name: t.name, why: t.why || why, done: false, aisle: aisleOf(t.name, t), qty: t.qty || '', addedAt: Date.now() };
        added.push(item);
        return item;
      });
    if (fresh.length) setShopList((l) => [...l.filter((x) => !fresh.some((f) => f.name.toLowerCase() === x.name.toLowerCase() && x.done)), ...fresh]);
    if (findOptions) fresh.forEach(findShopOptions);
    if (!quiet) setBanner(fresh.length ? `Added ${fresh.length === 1 ? fresh[0].name.toLowerCase() : `${fresh.length} things`} to your shopping list.` : 'Already on your shopping list.');
    return fresh;
  }

  // "Roast chicken" → a few sensible things to buy.
  function findShopOptions(item) {
    const patch = (p) => setShopList((l) => l.map((x) => (x.id === item.id ? { ...x, ...p } : x)));
    patch({ optionsState: 'loading' });
    const shop = shopById(profile.supermarket);
    postJson('/api/shop', { item: item.name, why: item.why, shop: shop ? shop.name : '', household: profile.household, dietary: profile.dietary })
      .then((r) => patch({ options: r.options || [], optionsState: 'ready' }))
      .catch(() => patch({ optionsState: 'error' }));
  }

  function cooked(changes = []) {
    const byId = new Map(changes.map((c) => [c.id, c]));
    setStock((list) =>
      list.flatMap((x) => {
        const c = byId.get(x.id);
        if (!c) return [x];
        if (c.action === 'all') return [];
        const locations = takeFrom(x, c.use);
        if (!locations) return [x];
        if (Object.keys(locations).length === 0) return [];
        return [{ ...x, locations, qty: qtyFromLocations(locations) }];
      })
    );
    // Work out the message from the plan (setStock runs later).
    const msgTaken = [];
    const msgDone = [];
    changes.forEach((c) => {
      const x = stock.find((s) => s.id === c.id);
      if (!x) return;
      const left = c.action === 'take' ? takeFrom(x, c.use) : null;
      if (c.action === 'all' || (left && Object.keys(left).length === 0)) msgDone.push(x.name);
      else if (left) msgTaken.push(`${formatAmount(c.use)} of ${x.name.toLowerCase()}`);
    });
    setIdeas((all) => {
      const next = { ...all };
      delete next[ideaKey];
      return next;
    });
    autoTried.current[ideaKey] = true;
    const doneItems = changes
      .map((c) => stock.find((s) => s.id === c.id))
      .filter((x) => x && msgDone.includes(x.name) && !shopRef.current.some((l) => !l.done && matchesListItem(l, x.name)));
    setBannerAction(
      doneItems.length
        ? { label: `Add ${doneItems.length === 1 ? doneItems[0].name.toLowerCase() : 'them'} to the shopping list`, run: () => addToList(doneItems.map((d) => ({ name: d.name, area: d.area, category: d.category, why: 'Finished it' }))) }
        : null
    );
    setBanner(
      msgTaken.length || msgDone.length
        ? `Nice one, Chef. ${[msgTaken.length ? `Taken off ${msgTaken.join(', ')}.` : '', msgDone.length ? `Finished: ${msgDone.join(', ')}.` : ''].filter(Boolean).join(' ')}`
        : 'Nice one, Chef. Tap Kitchen if anything else needs updating.'
    );
    setScreen('home');
  }

  function startAdd(m = 'kitchen') {
    setAddMode(m);
    setScreen('add');
  }

  function resetAll() {
    clearAllSaved();
    setStock([]);
    setKit([]);
    setProducts([]);
    setPending([]);
    setShopList([]);
    setIdeas({});
    setProfile({ name: '', household: '', dietary: '' });
    setSettings({ useUp: true, autoIdea: true });
    setHousehold(null);
    setOnboarded(false);
    setScreen('welcome');
  }

  if (!mounted) return <div className="app" />;
  if (gate === 'needed') {
    return (
      <div className="app">
        <AccessGate onCode={enterInvite} onJoin={joinFromGate} joinPrefill={joinPrefill} />
      </div>
    );
  }

  const tabs = ['home', 'plan', 'kitchen', 'products', 'shop', 'kit', 'account', 'settings', 'about'];
  const showTabs = tabs.includes(current);
  const showMenu = ['home', 'plan', 'kitchen', 'products', 'shop'].includes(current);
  const go = (s) => () => {
    setBanner('');
    setBannerAction(null);
    setScreen(s);
  };
  const mealName = MEALS[mealKey];

  return (
    <div className="app">
      {current === 'welcome' && (
        <Welcome
          joinPrefill={joinPrefill}
          onJoin={async (code) => {
            await sync.join(code);
            setOnboarded(true);
            setScreen('home');
          }}
          supermarket={profile.supermarket}
          setSupermarket={(id) => setProfile({ ...profile, supermarket: id })}
          onTour={() => startAdd('kitchen')}
          onSkip={() => {
            setOnboarded(true);
            setScreen('home');
          }}
        />
      )}

      {current === 'add' && (
        <AddItems
          key={addMode}
          mode={addMode}
          onSubmit={submitScan}
          pending={pending}
          jobs={jobs}
          onRemove={(id) => setPending((p) => p.filter((x) => x.id !== id))}
          onUpdatePending={(id, patch) => setPending((p) => p.map((x) => (x.id === id ? { ...x, ...patch, kind: patch.area ? kindOfArea(patch.area) : x.kind } : x)))}
          onRetry={retryJob}
          onSave={saveJobs}
          onDone={() => {
            const firstTime = !onboarded;
            setOnboarded(true);
            setBanner(addMode === 'kitchen' ? 'Saved to your kitchen.' : '');
            setScreen(addMode === 'products' ? 'products' : addMode === 'kit' ? 'kit' : firstTime ? 'home' : 'kitchen');
          }}
          onExit={() => setScreen(addMode === 'products' ? 'products' : addMode === 'kit' ? 'kit' : onboarded ? 'kitchen' : 'welcome')}
        />
      )}

      {current === 'home' && (
        <Home
          mealKey={mealKey}
          dateText={dateLine(now)}
          stock={stockView}
          tonightPlan={tonightPlan}
          onCookPlan={() => tonightPlan && openPlanRecipe(tonightPlan.date)}
          onOpenPlan={go('plan')}
          checkItems={checkItems}
          onCheck={answerCheck}
          onCheckDone={() => setLastCheck(Date.now())}
          ideas={ideaList}
          ideaState={ideaState}
          ideaError={ideaError}
          mode={mode}
          setMode={(m) => {
            setMode(m);
            setIdeaState('idle');
          }}
          onGetIdea={() => getIdea(false)}
          onAnother={() => getIdea(true)}
          request={(ideaSet && ideaSet.request) || ''}
          onAsk={(text) => getIdea(false, text)}
          onCook={(i) => {
            setRecipeFrom(null);
            setIdeaIdx(i);
            setBanner('');
            setScreen('recipe');
          }}
          onAddToList={(names) => addToList(names, 'For a recipe', { findOptions: true })}
          onTour={() => startAdd('kitchen')}
          banner={banner}
          bannerAction={bannerAction}
          onBannerAction={() => {
            if (bannerAction) bannerAction.run();
            setBannerAction(null);
          }}
          showUseUp={settings.useUp}
        />
      )}

      {current === 'recipe' && recipeFrom && recipeFrom.plan && (() => {
        const night = nights.find((n) => n.date === recipeFrom.plan);
        if (!night || !night.idea) return null;
        return (
          <Recipe
            key={night.date + night.idea.title}
            idea={night.idea}
            stock={stock}
            eaters={night.eaters}
            onEaters={(e) => upsertNight(night.date, { eaters: e })}
            onRetry={() => loadPlanRecipe(night.date, night.idea, night.eaters)}
            onBack={() => { setRecipeFrom(null); setScreen(night.date === todayIso ? 'home' : 'plan'); }}
            onCooked={(changes) => {
              cooked(changes);
              upsertNight(night.date, { cooked: true });
              setRecipeFrom(null);
            }}
            onAddToList={(n) => addToList(n, `For ${dayShort(night.date)}`, { findOptions: true })}
          />
        );
      })()}
      {current === 'recipe' && !(recipeFrom && recipeFrom.plan) && <Recipe idea={idea} stock={stock} eaters={eaters} onEaters={(e) => setProfile((p) => ({ ...p, adults: e.adults, kids: e.kids }))} onRetry={() => loadRecipe(ideaKey, ideaList.indexOf(idea), idea, { ...ideaBase(), request: (ideaSet && ideaSet.request) || '' })} onBack={go('home')} onCooked={cooked} onAddToList={(n) => addToList(n, 'For a recipe', { findOptions: true })} />}
      {current === 'plan' && (
        <Plan
          nights={nights}
          todayIso={todayIso}
          planning={planning}
          error={planError}
          onPlanAll={() => planWeek(null)}
          onSwap={(date, request) => planWeek([date], { [date]: request })}
          onToggle={(date) => upsertNight(date, (n) => ({ off: !n.off }))}
          onEaters={(date, e) => upsertNight(date, { eaters: e })}
          onOpen={openPlanRecipe}
          onShop={shopForWeek}
          shopState={planShop}
          notify={notifyState}
          onNotify={enableNotifications}
          household={household}
        />
      )}

      {current === 'kitchen' && (
        <Kitchen
          stock={stockView}
          banner={banner}
          binned={binnedThisMonth}
          onEdit={(it) => setEditing({ item: stock.find((x) => x.id === it.id) || it, isKit: false })}
          onDelete={(it) => swipeDelete(it, false)}
          undo={undo && !undo.isProduct ? undo : null}
          onUndo={undoDelete}
          onAdd={() => startAdd('kitchen')}
        />
      )}

      {current === 'products' && (
        <Kitchen
          products
          stock={products}
          onEdit={(it) => setEditing({ item: it, isKit: false, isProduct: true })}
          onDelete={(it) => swipeDelete(it, true)}
          undo={undo && undo.isProduct ? undo : null}
          onUndo={undoDelete}
          onAdd={() => startAdd('products')}
        />
      )}

      {current === 'shop' && (
        <Shop
          list={shopList}
          setList={setShopList}
          stock={[...stockView, ...products]}
          shop={shopById(profile.supermarket)}
          onAdd={(things, why, opts) => addToList(things, why, { quiet: true, ...opts })}
          onFindOptions={findShopOptions}
          onPickShop={() => setScreen('account')}
        />
      )}

      {current === 'kit' && (
        <Kit
          kit={kit}
          onBack={go('home')}
          onEdit={(k) => setEditing({ item: k, isKit: true })}
          onAdd={(name) => setKit((k) => [...k, { id: newId(), name, note: '' }])}
          onFilm={() => startAdd('kit')}
        />
      )}

      {current === 'account' && (
        <Account
          profile={profile}
          setProfile={setProfile}
          onBack={go('home')}
          household={household}
          sync={sync}
          joinPrefill={joinPrefill}
          onJoined={() => {
            setOnboarded(true);
            setJoinPrefill('');
            setIdeas({});
          }}
        />
      )}
      {current === 'settings' && <Settings settings={settings} setSettings={setSettings} onReset={resetAll} onBack={go('home')} />}
      {current === 'about' && <About onBack={go('home')} />}

      {showMenu && (
        <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Menu">
          <MenuIcon />
        </button>
      )}

      {menuOpen && (
        <div className="overlay">
          <button className="backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <nav className="menu" aria-label="Menu">
            {[
              ['account', 'Account', <Person key="a" />],
              ['settings', 'Settings', <Sliders key="s" />],
              ['kit', 'Kit', <Pan key="k" />],
              ['about', 'About', <Info key="i" />],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => {
                  setMenuOpen(false);
                  setScreen(key);
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {editing && (
        <EditSheet
          item={editing.item}
          isKit={editing.isKit}
          isProduct={!!editing.isProduct}
          onClose={() => setEditing(null)}
          onFinish={editing.isKit ? null : (how) => {
            finishItem(editing.item, how, !!editing.isProduct);
            setEditing(null);
          }}
          onRemove={(id) => {
            if (editing.isKit) setKit((k) => k.filter((x) => x.id !== id));
            else if (editing.isProduct) setProducts((p) => p.filter((x) => x.id !== id));
            else setStock((s) => s.filter((x) => x.id !== id));
            setEditing(null);
          }}
          onSave={(item) => {
            if (editing.isKit) setKit((k) => k.map((x) => (x.id === item.id ? item : x)));
            else if (editing.isProduct) setProducts((p) => p.map((x) => (x.id === item.id ? item : x)));
            else setStock((s) => s.map((x) => (x.id === item.id ? { ...item, countedAt: Date.now() } : x)));
            setEditing(null);
          }}
        />
      )}

      {showTabs && (
        <nav className="tabbar" aria-label="Main">
          <button aria-current={current === 'home' ? 'page' : undefined} onClick={go('home')}>
            <Plate />
            {mealName.tab}
          </button>
          <button aria-current={current === 'plan' ? 'page' : undefined} onClick={go('plan')}>
            <Calendar />
            Plan
          </button>
          <button aria-current={current === 'kitchen' ? 'page' : undefined} onClick={go('kitchen')}>
            <Fridge />
            Kitchen
          </button>
          <button aria-current={current === 'products' ? 'page' : undefined} onClick={go('products')}>
            <Spray />
            Products
          </button>
          <button aria-current={current === 'shop' ? 'page' : undefined} onClick={go('shop')}>
            <Basket />
            Shop
          </button>
        </nav>
      )}
    </div>
  );
}
