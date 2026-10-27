'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState, clearAllSaved, newId } from '@/lib/store';
import { useHouseholdSync } from '@/lib/sync';
import { normAmount, parseQty, formatAmount, addAmounts, findSame, takeFrom, totalOf } from '@/lib/amounts';
import { FOOD_AREAS, MEALS, PRODUCT_AREAS, kindOfArea, dateLine, daysLeft, locationKey, mealForHour, migrateArea, qtyFromLocations, todayKey } from '@/lib/helpers';
import AddItems from './Tour';
import { About, Account, EditSheet, Home, Kit, Kitchen, Recipe, Settings, Shop, Welcome } from './Screens';
import { Basket, Spray, Fridge, Info, MenuIcon, Pan, Person, Plate, Sliders } from './Icons';

const FRIENDLY_FAIL = 'Sorry Chef, I couldn’t reach the kitchen brain. Check your signal and try again.';

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore
  }
  if (!res.ok) {
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
function mergeItem(next, f) {
  const { kind, job, seenIn, check, source, amount, pack, ...item } = f;
  const key = locationKey(seenIn, item.area);
  const here = amount || item.qty;
  const i = findSame(next, item);
  if (i < 0) {
    const locations = { [key]: here };
    next.push({ ...item, pack: pack || null, locations, qty: qtyFromLocations(locations) });
    return;
  }
  const prev = next[i];
  const locations = { ...(prev.locations || { main: prev.qty }) };
  if (source === 'receipt') {
    // New shopping adds to what's already in. If the old amount was just words ("half a bag"), keep both.
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
  const [ideas, setIdeas] = usePersistentState('yc.ideas', {});
  const [household, setHousehold] = usePersistentState('yc.household', null);
  const [mounted, setMounted] = useState(false);
  const [joinPrefill, setJoinPrefill] = useState('');
  useEffect(() => setMounted(true), []);

  const sync = useHouseholdSync({
    code: household,
    setCode: setHousehold,
    mounted,
    collections: { stock: [stock, setStock], kit: [kit, setKit], shop: [shopList, setShopList], products: [products, setProducts] },
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
      setScreen('account');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [mounted]);

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
        productItems.forEach((f) => mergeItem(next, { ...f, seenIn: null }));
        return next;
      });
    }
    if (food.length) {
      setStock((s) => {
        const next = [...s];
        food.forEach((f) => mergeItem(next, f));
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
  }, [setStock, setKit, setProducts, setIdeas]);

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
    for (let i = 0; i < images.length; i += 3) batches.push({ images: images.slice(i, i + 3), docs: [] });
    docs.forEach((d) => batches.push({ images: [], docs: [d] }));
    if (batches.length === 0) batches.push({ images: [], docs: [] });

    Promise.allSettled(batches.map((b) => postJson('/api/scan', { area, images: b.images, docs: b.docs, note, where: opts.where || null, known: knownNames.current })))
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
    const stockForAi = stock.map((s) => ({ name: s.name, qty: ((t) => (t ? `${s.qty}; ${t.n} ${t.unit === 'each' ? t.word || 'each' : t.unit} in total` : s.qty))(totalOf(s)), area: s.area, daysLeft: daysLeft(s), status: s.status }));
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const weekend = now.getDay() === 0 || now.getDay() === 6;
    return {
      meal: mealKey,
      mode,
      stock: stockForAi,
      kit: kit.map((k) => ({ name: k.name, note: k.note })),
      household: profile.household,
      dietary: profile.dietary,
      context: `It's ${day}${weekend ? ' (weekend)' : ''}, ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}.`,
    };
  }, [stock, kit, profile, mealKey, mode, now]);

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
      .then((r) => patch({ ...r, missing: r.missing && r.missing.length ? r.missing : card.missing, detail: 'ready' }))
      .catch(() => patch({ detail: 'error' }));
  }, [setIdeas]);

  const getIdea = useCallback(async (avoidCurrent) => {
    setIdeaState('loading');
    setIdeaError('');
    const base = ideaBase();
    const key = ideaKey;
    try {
      const avoid = avoidCurrent && ideaSet ? [...(ideaSet.avoid || []), ...ideaSet.ideas.map((i) => i.title)].slice(-12) : [];
      const data = await postJson('/api/ideas', { ...base, step: 'cards', avoid });
      const cards = (data.ideas || []).map((c) => ({ ...c, detail: 'loading' }));
      setIdeas((all) => ({ ...all, [key]: { ideas: cards, avoid } }));
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
    if (stock.length === 0 || idea || ideaState !== 'idle' || autoTried.current[ideaKey]) return;
    autoTried.current[ideaKey] = true;
    getIdea(false);
  }, [mounted, current, settings.autoIdea, stock.length, idea, ideaState, ideaKey, getIdea]);

  function addToList(names, why = 'For a recipe') {
    setShopList((list) => {
      const have = new Set(list.map((l) => l.name.toLowerCase()));
      const add = names.filter((n) => n && !have.has(n.toLowerCase())).map((n) => ({ id: newId(), name: n, why, done: false }));
      return [...list, ...add];
    });
    setBanner(`Added ${names.length === 1 ? names[0].toLowerCase() : `${names.length} things`} to your shopping list.`);
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

  const tabs = ['home', 'kitchen', 'products', 'shop', 'kit', 'account', 'settings', 'about'];
  const showTabs = tabs.includes(current);
  const showMenu = ['home', 'kitchen', 'products', 'shop'].includes(current);
  const go = (s) => () => {
    setBanner('');
    setScreen(s);
  };
  const mealName = MEALS[mealKey];

  return (
    <div className="app">
      {current === 'welcome' && (
        <Welcome
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
          stock={stock}
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
          onCook={(i) => {
            setIdeaIdx(i);
            setBanner('');
            setScreen('recipe');
          }}
          onAddToList={(names) => addToList(names)}
          onTour={() => startAdd('kitchen')}
          banner={banner}
          showUseUp={settings.useUp}
        />
      )}

      {current === 'recipe' && <Recipe idea={idea} stock={stock} onRetry={() => loadRecipe(ideaKey, ideaList.indexOf(idea), idea, ideaBase())} onBack={go('home')} onCooked={cooked} onAddToList={(n) => addToList(n)} />}

      {current === 'kitchen' && (
        <Kitchen
          stock={stock}
          onEdit={(it) => setEditing({ item: it, isKit: false })}
          onAdd={() => startAdd('kitchen')}
        />
      )}

      {current === 'products' && (
        <Kitchen
          products
          stock={products}
          onEdit={(it) => setEditing({ item: it, isKit: false, isProduct: true })}
          onAdd={() => startAdd('products')}
        />
      )}

      {current === 'shop' && <Shop list={shopList} setList={setShopList} stock={[...stock, ...products]} />}

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
          onRemove={(id) => {
            if (editing.isKit) setKit((k) => k.filter((x) => x.id !== id));
            else if (editing.isProduct) setProducts((p) => p.filter((x) => x.id !== id));
            else setStock((s) => s.filter((x) => x.id !== id));
            setEditing(null);
          }}
          onSave={(item) => {
            if (editing.isKit) setKit((k) => k.map((x) => (x.id === item.id ? item : x)));
            else if (editing.isProduct) setProducts((p) => p.map((x) => (x.id === item.id ? item : x)));
            else setStock((s) => s.map((x) => (x.id === item.id ? item : x)));
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
