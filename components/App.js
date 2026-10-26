'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState, clearAllSaved, newId } from '@/lib/store';
import { useHouseholdSync } from '@/lib/sync';
import { FOOD_AREAS, MEALS, TOUR_STEPS, dateLine, daysLeft, mealForHour, todayKey } from '@/lib/helpers';
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

  /* ----- Reading photos, video frames and notes ----- */
  const submitScan = useCallback((area, images, note, typedFallback) => {
    const id = newId();
    setJobs((j) => [...j, { id, area, state: 'loading', images, note, typedFallback }]);

    // Send photos a few at a time so each request stays small and the labels stay sharp.
    const batches = [];
    for (let i = 0; i < images.length; i += 3) batches.push(images.slice(i, i + 3));
    if (batches.length === 0) batches.push([]);

    Promise.allSettled(batches.map((imgs) => postJson('/api/scan', { area, images: imgs, note })))
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
            ? items.map((it) => ({ id: newId(), name: String(it.name).trim(), note: String(it.note || '').trim(), area: 'Equipment', kind: 'kit' }))
            : items.map((it) => ({ ...normaliseFood(it, area), kind: 'food' }));
        if (mapped.length === 0 && typedFallback) {
          mapped.push({ ...normaliseFood({ name: typedFallback }, 'Cupboards'), kind: 'food' });
        }
        if (mapped.length === 0) {
          const where = area === 'Auto' ? 'those' : `your ${area.toLowerCase()}`;
          const hint =
            area === 'Spice rack'
              ? 'Try photos closer up, a few jars at a time, with the labels facing the camera.'
              : 'Try again closer up, in good light, or say what\u2019s there as you go.';
          setJobs((j) => j.map((x) => (x.id === id ? { ...x, state: 'error', message: `I couldn\u2019t spot anything in ${where}. ${hint}` } : x)));
          return;
        }
        setPending((p) => [...p, ...mapped]);
        setJobs((j) => j.filter((x) => x.id !== id));
      })
      .catch((e) => {
        if (typedFallback) {
          setPending((p) => [...p, { ...normaliseFood({ name: typedFallback }, 'Cupboards'), kind: 'food' }]);
          setJobs((j) => j.filter((x) => x.id !== id));
          return;
        }
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, state: 'error', message: e.message || FRIENDLY_FAIL } : x)));
      });
  }, [setPending]);

  function retryJob(job) {
    setJobs((j) => j.filter((x) => x.id !== job.id));
    submitScan(job.area, job.images, job.note, job.typedFallback);
  }

  function confirmPending() {
    const food = pending.filter((p) => p.kind !== 'kit');
    const kitItems = pending.filter((p) => p.kind === 'kit');
    setStock((s) => {
      const next = [...s];
      food.forEach((f) => {
        const { kind, ...item } = f;
        const i = next.findIndex((x) => x.name.toLowerCase() === item.name.toLowerCase() && x.area === item.area);
        if (i >= 0) next[i] = { ...next[i], ...item, id: next[i].id };
        else next.push(item);
      });
      return next;
    });
    setKit((k) => {
      const next = [...k];
      kitItems.forEach((f) => {
        const item = { id: f.id, name: f.name, note: f.note };
        const i = next.findIndex((x) => x.name.toLowerCase() === item.name.toLowerCase());
        if (i >= 0) next[i] = { ...next[i], note: item.note || next[i].note };
        else next.push(item);
      });
      return next;
    });
    setPending([]);
    setJobs([]);
    setIdeas({});
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
          onDone={() => setScreen('review')}
          onExit={() => setScreen(onboarded ? 'kitchen' : 'welcome')}
        />
      )}

      {current === 'review' && (
        <Found
          title={reviewMode === 'add' ? 'Add to your kitchen' : "Here's what I found"}
          subtitle={
            reviewMode === 'add'
              ? 'Say it, snap it or type it. Remove anything I got wrong.'
              : `${pending.length} things from your tour. Open each section to check it.`
          }
          pending={pending}
          jobs={jobs}
          onRemove={(id) => setPending((p) => p.filter((x) => x.id !== id))}
          onAdd={(images, note, typed) => submitScan('Auto', images, note, typed)}
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
        />
      )}

      {current === 'shop' && <Shop list={shopList} setList={setShopList} stock={stock} />}

      {current === 'kit' && (
        <Kit
          kit={kit}
          onBack={go('home')}
          onEdit={(k) => setEditing({ item: k, isKit: true })}
          onAdd={(name) => setKit((k) => [...k, { id: newId(), name, note: '' }])}
          onFilm={() => startTour([TOUR_STEPS[4]])}
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
