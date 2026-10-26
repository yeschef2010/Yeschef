'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState, clearAllSaved, newId } from '@/lib/store';
import { useHouseholdSync } from '@/lib/sync';
import { FOOD_AREAS, MEALS, TOUR_STEPS, dateLine, daysLeft, locationKey, mealForHour, migrateArea, qtyFromLocations, stepForArea, todayKey } from '@/lib/helpers';
import Tour from './Tour';
import Found from './Found';
import { About, Account, EditSheet, Home, Kit, Kitchen, Recipe, Settings, Shop, Welcome } from './Screens';
import { Basket, Fridge, Info, MenuIcon, Pan, Person, Plate, Sliders } from './Icons';

const FRIENDLY_FAIL = 'Sorry Chef, I couldn’t reach the kitchen brain. Check your signal and try again.';

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore
  }
  if (!res.ok) throw new Error((data && data.message) || FRIENDLY_FAIL);
  return data;
}

function normaliseFood(it, fallbackArea) {
  const area = FOOD_AREAS.includes(it.area) ? it.area : FOOD_AREAS.includes(fallbackArea) ? fallbackArea : 'Cupboards';
  let status = it.status || null;
  if (status && !['Low', 'Out'].includes(status)) status = null;
  return {
    id: newId(),
    name: String(it.name || '').trim(),
    qty: String(it.qty || '').trim(),
    area,
    shelfDays: typeof it.shelfDays === 'number' ? it.shelfDays : null,
    status,
    category: typeof it.category === 'string' ? it.category : null,
    seenIn: fallbackArea || null,
    addedAt: Date.now(),
  };
}

export default function App() {
  const [stock, setStock] = usePersistentState('yc.stock', []);
  const [kit, setKit] = usePersistentState('yc.kit', []);
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
    collections: { stock: [stock, setStock], kit: [kit, setKit], shop: [shopList, setShopList] },
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
  const [tourSteps, setTourSteps] = useState(TOUR_STEPS);
  const [reviewMode, setReviewMode] = useState('tour'); // 'tour' | 'add'
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
  const mealKey = mealForHour(now.getHours());
  const ideaKey = `${todayKey(now)}-${mealKey}-${mode}`;
  const idea = ideas[ideaKey] || null;

  /* ----- Saving found items into the kitchen ----- */
  const commitItems = useCallback((list) => {
    const food = list.filter((p) => p.kind !== 'kit');
    const kitItems = list.filter((p) => p.kind === 'kit');
    if (food.length) {
      setStock((s) => {
        const next = [...s];
        food.forEach((f) => {
          const { kind, job, seenIn, ...item } = f;
          // File by what it is, but remember where it was seen: a bottle in the fridge
          // adds "1 chilled" rather than replacing the six in the cupboard.
          const key = locationKey(seenIn, item.area);
          const i = next.findIndex((x) => x.name.toLowerCase() === item.name.toLowerCase() && x.area === item.area);
          if (i >= 0) {
            const prev = next[i];
            const locations = { ...(prev.locations || { main: prev.qty }), [key]: item.qty };
            next[i] = { ...prev, ...item, id: prev.id, locations, qty: qtyFromLocations(locations) };
          } else {
            const locations = { [key]: item.qty };
            next.push({ ...item, locations, qty: qtyFromLocations(locations) });
          }
        });
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
  }, [setStock, setKit, setIdeas]);

  // Jobs whose results should go straight into the kitchen when they arrive.
  const autoSave = useRef(new Set());

  /* ----- Reading photos, video frames, notes, receipts and files ----- */
  const submitScan = useCallback((area, images, note, typedFallback, docs = []) => {
    const id = newId();
    setJobs((j) => [...j, { id, area, state: 'loading', images, note, typedFallback, docs }]);

    // Send photos a few at a time so each request stays small and the labels stay sharp. Each file goes on its own.
    const batches = [];
    for (let i = 0; i < images.length; i += 3) batches.push({ images: images.slice(i, i + 3), docs: [] });
    docs.forEach((d) => batches.push({ images: [], docs: [d] }));
    if (batches.length === 0) batches.push({ images: [], docs: [] });

    Promise.allSettled(batches.map((b) => postJson('/api/scan', { area, images: b.images, docs: b.docs, note })))
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
            : items.map((it) => ({ ...normaliseFood(it, area), kind: 'food', job: id }));
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
          setJobs((j) => j.map((x) => (x.id === id ? { ...x, state: 'error', message: `I couldn\u2019t spot any food in ${where}. ${hint}` } : x)));
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
    return submitScan(job.area, job.images, job.note, job.typedFallback, job.docs || []);
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

  function confirmPending() {
    commitItems(pending);
    setPending([]);
    setJobs([]);
    setOnboarded(true);
    setScreen(reviewMode === 'add' ? 'kitchen' : 'home');
  }

  /* ----- Meal ideas ----- */
  const getIdea = useCallback(async (avoidCurrent) => {
    setIdeaState('loading');
    setIdeaError('');
    const stockForAi = stock.map((s) => ({ name: s.name, qty: s.qty, area: s.area, daysLeft: daysLeft(s), status: s.status }));
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const weekend = now.getDay() === 0 || now.getDay() === 6;
    try {
      const prev = ideas[ideaKey];
      const avoid = avoidCurrent && prev ? [...(prev.avoid || []), prev.title] : [];
      const data = await postJson('/api/ideas', {
        meal: mealKey,
        mode,
        stock: stockForAi,
        kit: kit.map((k) => ({ name: k.name, note: k.note })),
        household: profile.household,
        dietary: profile.dietary,
        context: `It's ${day}${weekend ? ' (weekend)' : ''}, ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}.`,
        avoid,
      });
      setIdeas((all) => ({ ...all, [ideaKey]: { ...data, avoid } }));
      setIdeaState('idle');
    } catch (e) {
      setIdeaError(e.message || FRIENDLY_FAIL);
      setIdeaState('error');
    }
  }, [stock, kit, profile, mealKey, mode, ideaKey, ideas, now]);

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

  function cooked() {
    const used = new Set((idea.usedUp || []).map((u) => u.toLowerCase()));
    const gone = stock.filter((s) => used.has(s.name.toLowerCase()));
    setStock((s) => s.filter((x) => !used.has(x.name.toLowerCase())));
    setIdeas((all) => {
      const next = { ...all };
      delete next[ideaKey];
      return next;
    });
    autoTried.current[ideaKey] = true;
    setBanner(
      gone.length
        ? `Nice one, Chef. I've taken ${gone.map((g) => g.name).join(', ')} off your stock.`
        : 'Nice one, Chef. Tap Kitchen if anything else needs updating.'
    );
    setScreen('home');
  }

  function startTour(steps = TOUR_STEPS) {
    setTourSteps(steps);
    setReviewMode('tour');
    setScreen('tour');
  }

  function resetAll() {
    clearAllSaved();
    setStock([]);
    setKit([]);
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

  const tabs = ['home', 'kitchen', 'shop', 'kit', 'account', 'settings', 'about'];
  const showTabs = tabs.includes(current);
  const showMenu = ['home', 'kitchen', 'shop'].includes(current);
  const go = (s) => () => {
    setBanner('');
    setScreen(s);
  };
  const mealName = MEALS[mealKey];

  return (
    <div className="app">
      {current === 'welcome' && (
        <Welcome
          onTour={() => startTour()}
          onSkip={() => {
            setOnboarded(true);
            setScreen('home');
          }}
        />
      )}

      {current === 'tour' && (
        <Tour
          key={tourSteps.map((s) => s.area).join()}
          steps={tourSteps}
          onSubmit={(area, images, note) => submitScan(area, images, note)}
          pending={pending}
          jobs={jobs}
          onRemove={(id) => setPending((p) => p.filter((x) => x.id !== id))}
          onRetry={retryJob}
          onSave={saveJobs}
          onDone={() => {
            setOnboarded(true);
            setBanner('Your kitchen\u2019s saved. Tap Kitchen any time to update an area.');
            setScreen(tourSteps.length === 1 ? (tourSteps[0].area === 'Equipment' ? 'kit' : 'kitchen') : 'home');
          }}
          onExit={() => setScreen(onboarded ? 'kitchen' : 'welcome')}
        />
      )}

      {current === 'review' && (
        <Found
          title={reviewMode === 'add' ? 'Add to your kitchen' : "Here's what I found"}
          subtitle={
            reviewMode === 'add'
              ? 'Scan a receipt, or say, snap or type what you\u2019ve got.'
              : `${pending.length} things from your tour. Open each section to check it.`
          }
          pending={pending}
          jobs={jobs}
          onRemove={(id) => setPending((p) => p.filter((x) => x.id !== id))}
          onAdd={(images, note, typed) => submitScan('Auto', images, note, typed)}
          onReceipt={reviewMode === 'add' ? (images, docs) => submitScan('Receipt', images, '', null, docs) : undefined}
          onConfirm={confirmPending}
          onRetry={retryJob}
          onBack={reviewMode === 'add' ? () => setScreen('kitchen') : null}
          confirmLabel={reviewMode === 'add' ? 'Save to my kitchen' : 'Looks right, Chef'}
        />
      )}

      {current === 'home' && (
        <Home
          mealKey={mealKey}
          dateText={dateLine(now)}
          stock={stock}
          idea={idea}
          ideaState={ideaState}
          ideaError={ideaError}
          mode={mode}
          setMode={(m) => {
            setMode(m);
            setIdeaState('idle');
          }}
          onGetIdea={() => getIdea(false)}
          onAnother={() => getIdea(true)}
          onCook={go('recipe')}
          onAddToList={(names) => addToList(names)}
          onTour={() => startTour()}
          banner={banner}
          showUseUp={settings.useUp}
        />
      )}

      {current === 'recipe' && <Recipe idea={idea} onBack={go('home')} onCooked={cooked} onAddToList={(n) => addToList(n)} />}

      {current === 'kitchen' && (
        <Kitchen
          stock={stock}
          onEdit={(it) => setEditing({ item: it, isKit: false })}
          onAdd={() => {
            setReviewMode('add');
            setScreen('review');
          }}
          onTour={() => startTour()}
          onUpdateArea={(area) => startTour([stepForArea(area)])}
        />
      )}

      {current === 'shop' && <Shop list={shopList} setList={setShopList} stock={stock} />}

      {current === 'kit' && (
        <Kit
          kit={kit}
          onBack={go('home')}
          onEdit={(k) => setEditing({ item: k, isKit: true })}
          onAdd={(name) => setKit((k) => [...k, { id: newId(), name, note: '' }])}
          onFilm={() => startTour([stepForArea('Equipment')])}
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
          onClose={() => setEditing(null)}
          onRemove={(id) => {
            if (editing.isKit) setKit((k) => k.filter((x) => x.id !== id));
            else setStock((s) => s.filter((x) => x.id !== id));
            setEditing(null);
          }}
          onSave={(item) => {
            if (editing.isKit) setKit((k) => k.map((x) => (x.id === item.id ? item : x)));
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
          <button aria-current={current === 'shop' ? 'page' : undefined} onClick={go('shop')}>
            <Basket />
            Shop
          </button>
        </nav>
      )}
    </div>
  );
}
