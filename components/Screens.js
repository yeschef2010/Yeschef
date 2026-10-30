'use client';
import { useState } from 'react';
import { WINE_STYLES, wineStyleOf, AREA_CATEGORIES, FLAT_AREAS, FOOD_AREAS, MEALS, PRODUCT_AREAS, categoryOf, daysLeft, listJoin, needsAttention, stockTag } from '@/lib/helpers';
import { Back, Bag, Chevron, Close, Logo, Pin, Tick } from './Icons';
import ItemGroups from './ItemGroups';
import { drinksYouCanMake } from '@/lib/drinks';
import { AISLES, SHOPS, aisleOf, isRunningLow } from '@/lib/shops';
import { parseQty, formatAmount, totalOf, subtractAmounts, findSame } from '@/lib/amounts';

/* ---------- Welcome ---------- */
export function ShopPicker({ value, onChange }) {
  return (
    <div className="where shops" role="group" aria-label="Where do you usually shop?">
      {SHOPS.map((sh) => (
        <button key={sh.id} className="chip" aria-pressed={value === sh.id} onClick={() => onChange(sh.id)}>
          {sh.name}
        </button>
      ))}
    </div>
  );
}

export function Welcome({ onTour, onSkip, supermarket, setSupermarket }) {
  return (
    <div className="screen" style={{ justifyContent: 'space-between', paddingTop: 56 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Logo width={190} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="h1">
            Hi Chef<span className="dot">!</span>
          </h1>
          <p className="lead">I'm your kitchen assistant. You cook, I'll handle the admin: what's in, what needs using up, and what to buy.</p>
          <p className="lead">First, show me what you’ve got. Film, snap, talk or scan a receipt, anywhere in the house, and I’ll sort it all out.</p>
        </div>
        {setSupermarket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="lbl">Where do you usually shop?</p>
            <ShopPicker value={supermarket} onChange={setSupermarket} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn" onClick={onTour}>
          Show me what you’ve got
        </button>
        <button className="btn quiet" onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

/* ---------- Drinks you can make from what's in ---------- */
export function DrinksCard({ stock, title = 'Ready to pour' }) {
  const drinks = drinksYouCanMake(stock);
  if (drinks.length === 0) return null;
  return (
    <div className="card tight sage" style={{ flexShrink: 0 }}>
      <p className="eyebrow" style={{ color: 'var(--forest)' }}>{title}</p>
      {drinks.map((d) => (
        <div key={d.name} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 800 }}>
            {d.name}
            {d.alcoholFree ? <span style={{ fontWeight: 600, fontSize: 13 }}> · alcohol-free</span> : null}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.4, color: 'var(--text-2)' }}>
            {listJoin(d.items.map((i) => (i.qty ? `${i.name.toLowerCase()} (${i.qty.toLowerCase()})` : i.name.toLowerCase())))}
            {d.garnish ? `, with ${d.garnish.name.toLowerCase()} for the glass` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Main meal screen ---------- */
export function Home({ mealKey, dateText, stock, ideas = [], ideaState, ideaError, mode, setMode, onGetIdea, onAnother, onCook, onAddToList, onTour, banner, bannerAction, onBannerAction, showUseUp }) {
  const meal = MEALS[mealKey];
  const urgent = stock.filter((s) => s.area !== 'Spice rack' && !s.status && stockTag(s).cls === 'red');
  const empty = stock.length === 0;

  return (
    <div className="screen" style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 56 }}>
        <p className="small" style={{ fontWeight: 700 }}>
          {dateText}
        </p>
        <h2 className="h2" style={{ fontSize: 32 }}>
          {meal.greeting}
          <span className="dot">.</span>
        </h2>
      </div>

      {banner && (
        <div className="card green tight">
          <p style={{ fontSize: 15, lineHeight: 1.45 }}>{banner}</p>
          {bannerAction && (
            <button className="btn sm ghost" style={{ alignSelf: 'flex-start', height: 38 }} onClick={onBannerAction}>
              {bannerAction.label}
            </button>
          )}
        </div>
      )}

      {empty ? (
        <div className="card">
          <p className="h3">Let's see what you've got</p>
          <p className="sub">I need to know what's in your kitchen before I can suggest anything. Film, snap, talk or scan a receipt.</p>
          <button className="btn" onClick={onTour}>
            Add your first items
          </button>
        </div>
      ) : (
        <>
          {showUseUp && urgent.length > 0 && (
            <div className="card orange tight">
              <p className="eyebrow orange">Use it up</p>
              <p style={{ fontSize: 16, lineHeight: 1.45 }}>
                Your {listJoin(urgent.slice(0, 3).map((u) => u.name.toLowerCase()))} {urgent.length === 1 && !/s$/i.test(urgent[0].name) ? 'needs' : 'need'} using soon. I'll plan around {urgent.length === 1 && !/s$/i.test(urgent[0].name) ? 'it' : 'them'}.
              </p>
            </div>
          )}

          <div className="seg" role="group" aria-label="How much time have you got?">
            <button aria-pressed={mode === 'quick'} onClick={() => setMode('quick')}>
              Quick and easy
            </button>
            <button aria-pressed={mode === 'fun'} onClick={() => setMode('fun')}>
              Fun in the kitchen
            </button>
          </div>

          {mealKey === 'tomorrow' && (
            <p className="sub" style={{ marginBottom: -4 }}>Dinner’s done for today. Here’s what you could have tomorrow, and anything to do tonight.</p>
          )}

          {ideaState === 'loading' && (
            <div className="card" style={{ borderRadius: 20, padding: 18 }}>
              <div className="row" style={{ minHeight: 120, justifyContent: 'center' }}>
                <div className="spinner" />
                <p className="sub">Thinking up {meal.thinking}…</p>
              </div>
            </div>
          )}
          {ideaState === 'error' && (
            <div className="card" style={{ borderRadius: 20, padding: 18, gap: 12 }}>
              <p className="error" style={{ whiteSpace: 'pre-line' }}>{ideaError}</p>
              <button className="btn sm" onClick={onGetIdea}>
                Try again
              </button>
            </div>
          )}
          {ideaState === 'idle' && ideas.length === 0 && (
            <div className="card" style={{ borderRadius: 20, padding: 18, gap: 12 }}>
              <p className="h3">Ready when you are</p>
              <button className="btn" onClick={onGetIdea}>
                {meal.get}
              </button>
            </div>
          )}
          {ideaState === 'idle' && ideas.length > 0 && (
            <>
              <div className="ideas">
                {ideas.map((idea, i) => (
                  <button key={i} className="idea-card" onClick={() => onCook(i)}>
                    <span className="eyebrow">
                      {IDEA_TYPES[idea.type] ? (idea.type === 'quick' && mode === 'fun' ? 'Easiest' : IDEA_TYPES[idea.type]) : 'Idea'}
                      {idea.time ? ` · ${idea.time}` : ''}
                    </span>
                    <span className="idea-title">{idea.title}</span>
                    {idea.why && <span className="idea-why">{idea.why}</span>}
                    {idea.prep && (
                      <span className="idea-prep">
                        <strong>Tonight:</strong> {idea.prep}
                      </span>
                    )}
                    <span className="idea-foot">
                      <Lights lights={idea.lights} small />
                      {idea.missing && idea.missing.length > 0 && <span className="idea-grab">Grab: {listJoin(idea.missing.map((m) => m.toLowerCase()))}</span>}
                    </span>
                  </button>
                ))}
              </div>
              <button className="btn quiet sm" onClick={onAnother}>
                Three more ideas
              </button>
            </>
          )}
          {mealKey === 'dinner' && <DrinksCard stock={stock} title="And to drink, you’ve got everything for" />}
        </>
      )}
    </div>
  );
}

const IDEA_TYPES = { useup: 'Use it up', quick: 'Quickest', different: 'Something different' };

// UK front-of-pack style traffic lights, per portion.
const LIGHT_NAMES = [['fat', 'Fat'], ['saturates', 'Sat fat'], ['sugar', 'Sugar'], ['salt', 'Salt']];
export function Lights({ lights, small = false }) {
  if (!lights || !LIGHT_NAMES.some(([k]) => lights[k])) return null;
  return (
    <span className={`lights${small ? ' small' : ''}`} aria-label={`Per portion: ${LIGHT_NAMES.filter(([k]) => lights[k]).map(([k, n]) => `${n} ${lights[k]}`).join(', ')}`}>
      {LIGHT_NAMES.filter(([k]) => lights[k]).map(([k, n]) => (
        <span key={k} className={`light ${lights[k]}`}>
          {n}
          {!small && <em>{lights[k] === 'medium' ? 'Med' : lights[k] === 'low' ? 'Low' : 'High'}</em>}
        </span>
      ))}
    </span>
  );
}

/* ---------- Recipe ---------- */
// Work out what cooking this recipe takes off the stock.
function cookPlan(idea, stock) {
  const usedUp = new Set((idea.usedUp || []).map((u) => String(u).toLowerCase()));
  const rows = [];
  const seen = new Set();
  for (const ing of idea.ingredients || []) {
    if (!ing.inStock && !ing.stockName) continue;
    const want = String(ing.stockName || ing.name).toLowerCase();
    let item = stock.find((s) => s.name.toLowerCase() === want);
    if (!item) {
      const areas = [...new Set(stock.map((s) => s.area))];
      for (const area of areas) {
        const i = findSame(stock.filter((s) => s.area === area), { name: ing.stockName || ing.name, area });
        if (i >= 0) {
          item = stock.filter((s) => s.area === area)[i];
          break;
        }
      }
    }
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    const use = parseQty(ing.use);
    const total = totalOf(item);
    const after = use && total ? subtractAmounts(total, use) : null;
    const choice = usedUp.has(item.name.toLowerCase()) || (after && after.n <= 0) ? 'all' : after ? 'take' : 'keep';
    rows.push({ item, use, after, choice });
  }
  return rows;
}

function CookedSheet({ idea, stock, onConfirm, onClose }) {
  const [rows, setRows] = useState(() => cookPlan(idea, stock));
  const pick = (id, choice) => setRows((r) => r.map((x) => (x.item.id === id ? { ...x, choice } : x)));
  return (
    <div className="overlay">
      <button className="backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Update my kitchen">
        <div className="row between">
          <p className="h3">Nice one, Chef. What did you use?</p>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>
        {rows.length === 0 && <p className="sub">Nothing from your kitchen to take off for this one.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '55vh', overflowY: 'auto' }}>
          {rows.map(({ item, use, after, choice }) => {
            const options = [
              ...(use && after && after.n > 0 ? [['take', `Take off ${formatAmount(use)}`]] : []),
              ['all', 'Used it all'],
              ['keep', use && after ? 'Didn’t use it' : 'Some left'],
            ];
            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 16, fontWeight: 700 }}>
                  {item.name}
                  <span className="small" style={{ fontWeight: 600, color: 'var(--muted)' }}>
                    {' '}
                    · {choice === 'take' && after ? `${item.qty || 'some'} → ${formatAmount(after, totalOf(item))} left` : choice === 'all' ? 'finished' : `keeping ${item.qty || 'it'}`}
                  </span>
                </p>
                <div className="where" role="group" aria-label={`${item.name} used`}>
                  {options.map(([k, label]) => (
                    <button key={k} className="chip" aria-pressed={choice === k} onClick={() => pick(item.id, k)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn" onClick={() => onConfirm(rows.filter((r) => r.choice !== 'keep').map((r) => ({ id: r.item.id, action: r.choice, use: r.use })))}>
          Update my kitchen
        </button>
      </div>
    </div>
  );
}

export function Recipe({ idea, stock = [], onBack, onCooked, onAddToList, onRetry }) {
  const [cooking, setCooking] = useState(false);
  if (!idea) return null;
  const waiting = idea.detail === 'loading' || idea.detail === 'error' || !Array.isArray(idea.steps) || !idea.steps.length;
  return (
    <div className="screen">
      <button className="icon-btn" onClick={onBack} aria-label="Back">
        <Back />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="h2" style={{ fontSize: 28 }}>
          {idea.title}
        </h2>
        <p className="sub">{[idea.time, idea.tag].filter(Boolean).join(' · ')}</p>
      </div>
      {idea.prep && (
        <div className="card honey tight">
          <p style={{ fontSize: 15, lineHeight: 1.45 }}>
            <strong>Tonight:</strong> {idea.prep}
          </p>
        </div>
      )}
      {idea.lights && LIGHT_NAMES.some(([k]) => idea.lights[k]) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="eyebrow">Per portion</p>
          <Lights lights={idea.lights} />
        </div>
      )}
      {idea.tip && (
        <div className="card orange tight">
          <p style={{ fontSize: 15, lineHeight: 1.45 }}>
            <strong>Heads up:</strong> {idea.tip}
          </p>
        </div>
      )}
      {waiting ? (
        <div className="card" style={{ borderRadius: 20, padding: 18, gap: 12 }}>
          {idea.detail === 'error' ? (
            <>
              <p className="error">Sorry Chef, I couldn’t write that recipe out. Try again in a moment.</p>
              {onRetry && (
                <button className="btn sm" onClick={onRetry}>
                  Try again
                </button>
              )}
            </>
          ) : (
            <div className="row" style={{ minHeight: 80, justifyContent: 'center' }}>
              <div className="spinner" />
              <p className="sub">Writing the recipe out…</p>
            </div>
          )}
        </div>
      ) : (
        <>
      <div>
        <p className="eyebrow" style={{ marginBottom: 4 }}>
          Ingredients
        </p>
        {idea.ingredients.map((ing, i) => (
          <div className="list-row" key={i}>
            <p style={{ fontSize: 16 }}>
              {ing.name}
              {ing.amount ? <span style={{ color: 'var(--muted)' }}> · {ing.amount}</span> : null}
            </p>
            <span className={`pill tag ${ing.inStock ? 'fine' : 'urgent'}`} style={{ alignSelf: 'center' }}>
              {ing.inStock ? 'In stock' : 'Grab one'}
            </span>
          </div>
        ))}
      </div>
      {idea.missing && idea.missing.length > 0 && (
        <button className="btn sm ghost" onClick={() => onAddToList(idea.missing)}>
          Add missing to shopping list
        </button>
      )}
      <div className="steps">
        <p className="eyebrow">Method</p>
        {idea.steps.map((s, i) => (
          <div className="step" key={i}>
            <span className="n">{i + 1}</span>
            <p>{s}</p>
          </div>
        ))}
      </div>
      <button className="btn" onClick={() => setCooking(true)}>
        Cooked it, update my kitchen
      </button>
        </>
      )}
      {cooking && <CookedSheet idea={idea} stock={stock} onClose={() => setCooking(false)} onConfirm={(changes) => { setCooking(false); onCooked(changes); }} />}
    </div>
  );
}

/* ---------- Edit sheet ---------- */
export function EditSheet({ item, isKit, isProduct = false, onSave, onRemove, onClose }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(isKit ? item.note || '' : item.qty || '');
  const [area, setArea] = useState(item.area || 'Fridge');
  const [status, setStatus] = useState(item.status || '');
  const [category, setCategory] = useState(() => categoryOf({ ...item, area: isKit ? 'Equipment' : item.area }));
  const [style, setStyle] = useState(() => wineStyleOf(item));
  const [days, setDays] = useState(() => {
    const d = daysLeft(item);
    return d == null ? '' : String(Math.max(0, d));
  });

  function save() {
    if (isKit) return onSave({ ...item, name: name.trim() || item.name, note: qty, category });
    const d = days === '' ? null : Math.max(0, parseInt(days, 10) || 0);
    onSave({
      ...item,
      name: name.trim() || item.name,
      qty,
      locations: { main: parseQty(qty) || qty },
      area,
      status: status || null,
      category: (AREA_CATEGORIES[area] || []).includes(category) ? category : null,
      style: category === 'Wine' && WINE_STYLES.includes(style) ? style : null,
      shelfDays: d,
      addedAt: Date.now(),
    });
  }

  return (
    <div className="overlay">
      <button className="backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Edit ${item.name}`}>
        <div className="row between">
          <p className="h3">Edit</p>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>
        <label className="lbl" htmlFor="ed-name">Name</label>
        <input id="ed-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="lbl" htmlFor="ed-qty">{isKit ? 'Note' : 'How much'}</label>
        <input id="ed-qty" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
        <label className="lbl" htmlFor="ed-cat">Group</label>
        <select id="ed-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {(AREA_CATEGORIES[isKit ? 'Equipment' : area] || []).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {area === 'Drinks' && category === 'Wine' && (
          <>
            <label className="lbl" htmlFor="ed-style">Type of wine</label>
            <select id="ed-style" className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
              {WINE_STYLES.map((w) => (
                <option key={w}>{w}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </>
        )}
        {!isKit && (
          <>
            <div className="row">
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="lbl" htmlFor="ed-area">Where</label>
                <select id="ed-area" className="input" value={area} onChange={(e) => setArea(e.target.value)}>
                  {(isProduct ? PRODUCT_AREAS : FOOD_AREAS).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              {!isProduct && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="lbl" htmlFor="ed-days">Use within (days)</label>
                  <input id="ed-days" className="input" inputMode="numeric" placeholder="Keeps" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
              )}
            </div>
            <label className="lbl" htmlFor="ed-status">Stock level</label>
            <select id="ed-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Plenty</option>
              <option value="Low">Running low</option>
              <option value="Out">Run out</option>
            </select>
          </>
        )}
        <div className="row">
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => onRemove(item.id)}>
            {isKit ? 'Remove' : isProduct ? 'Remove' : 'Used it up'}
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Kitchen ---------- */
export function Kitchen({ stock, onEdit, onAdd, onUpdateArea, products = false, banner }) {
  const areas = products ? PRODUCT_AREAS : FOOD_AREAS;
  const [open, setOpen] = useState({ [areas[0]]: true });
  const [openCats, setOpenCats] = useState({});
  const toggleCat = (area) => (cat) => setOpenCats((o) => ({ ...o, [`${area}|${cat}`]: !o[`${area}|${cat}`] }));
  const catsFor = (area) => Object.fromEntries(Object.entries(openCats).filter(([k]) => k.startsWith(area + '|')).map(([k, v]) => [k.split('|')[1], v]));
  return (
    <div className="screen" style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 56 }}>
        <h2 className="h2" style={{ fontSize: 32 }}>{products ? 'Household products' : 'Your kitchen'}</h2>
        <p className="sub">{stock.length} things logged. Tap one to change it.</p>
      </div>
      {banner && (
        <div className="card green tight">
          <p style={{ fontSize: 15, lineHeight: 1.45 }}>{banner}</p>
        </div>
      )}
      {products ? (
        <div className="legend" aria-label="Colour key">
          <span><i className="amber" />Running low</span>
          <span><i className="red" />Run out</span>
          <span><i className="grey" />Plenty</span>
        </div>
      ) : (
        <div className="legend" aria-label="Colour key">
          <span><i className="green" />Good</span>
          <span><i className="amber" />Use soon</span>
          <span><i className="red" />Check before use</span>
          <span><i className="grey" />Keeps</span>
        </div>
      )}
      <button className="btn" onClick={onAdd}>{products ? 'Add products' : 'Add items'}</button>
      {areas.map((area) => {
        const items = stock.filter((s) => s.area === area);
        const flagged = items.filter(needsAttention).length;
        const isOpen = !!open[area];
        return (
          <div className="section" key={area}>
            <button className="section-head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [area]: !isOpen })}>
              <span>{area}</span>
              <span className={`meta${flagged ? ' alert' : ''}`}>
                {flagged ? `${flagged} need attention` : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                <Chevron open={isOpen} />
              </span>
            </button>
            {isOpen && (
              <div className="section-body">
                {items.length === 0 ? (
                  <p className="sub" style={{ padding: '6px 8px 8px' }}>Nothing logged here yet.</p>
                ) : (
                  <ItemGroups
                    items={items}
                    area={area}
                    onTap={onEdit}
                    showTags
                    showCategories={!FLAT_AREAS.includes(area)}
                    collapsible
                    openCats={catsFor(area)}
                    onToggleCat={toggleCat(area)}
                  />
                )}
                {area === 'Spice rack' && <p className="sub" style={{ padding: '0 6px 4px' }}>Staples I assume you've always got: salt, pepper, cooking oil.</p>}
                {onUpdateArea && (
                  <button className="btn sm ghost" onClick={() => onUpdateArea(area)}>
                    Update {area === 'Spice rack' ? 'spice rack' : area.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Shopping list ---------- */
export function Shop({ list, setList, stock, shop, onAdd, onFindOptions, onPickShop }) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState('');
  const [unfolded, setUnfolded] = useState({});
  const [shopping, setShopping] = useState(false);
  const open = list.filter((l) => !l.done);
  const done = list.filter((l) => l.done);
  const onList = (name) => open.some((l) => l.name.toLowerCase() === name.toLowerCase());
  const suggestions = stock.filter((s) => isRunningLow(s) && !onList(s.name));
  const link = (term) => (shop && shop.search ? shop.search(term) : null);

  function add() {
    const n = text.trim();
    if (!n) return;
    onAdd([n], '', { findOptions: true });
    setText('');
  }

  const toggle = (id) => setList(list.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const choose = (id, name) => setList(list.map((x) => (x.id === id ? { ...x, chosen: x.chosen === name ? null : name } : x)));

  const byAisle = AISLES.map((a) => [a, open.filter((l) => (l.aisle || aisleOf(l.name)) === a)]).filter(([, items]) => items.length);

  async function share() {
    const textList = byAisle
      .map(([a, items]) => `${a}\n${items.map((l) => `- ${l.chosen || l.name}${l.qty ? ` (${l.qty})` : ''}`).join('\n')}`)
      .join('\n\n');
    if (!textList) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Shopping list', text: textList });
        return;
      }
      await navigator.clipboard.writeText(textList);
      setCopied('Copied. Paste it wherever you like.');
    } catch (e) {
      // user cancelled
    }
  }

  return (
    <div className="screen" style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 56 }}>
        <h2 className="h2" style={{ fontSize: 32 }}>Next shop</h2>
        <p className="sub">
          {shop ? (shop.search ? `Tap the arrow to find it at ${shop.name}.` : `${shop.name} doesn’t shop online, so this is your list to take with you.`) : 'Everything you need, in one list.'}{' '}
          <button className="link-btn" onClick={onPickShop}>{shop ? 'Change' : 'Pick your supermarket'}</button>
        </p>
      </div>

      <div className="row">
        <label htmlFor="shop-add" className="sr-only">Add to list</label>
        <input id="shop-add" className="input" placeholder="Add something, e.g. roast chicken" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button className="btn sm" onClick={add} disabled={!text.trim()}>Add</button>
      </div>

      {suggestions.length > 0 && (
        <div className="card tight">
          <p className="eyebrow orange">Running low</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s) => (
              <button key={s.id} className="btn sm ghost" style={{ height: 36 }} onClick={() => onAdd([{ name: s.name, area: s.area, category: s.category, qty: '' }], `Running low${s.qty ? ` · ${s.qty} left` : ''}`)}>
                + {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {open.length === 0 && <p className="sub">Your list is empty. Things you run out of, and anything a recipe needs, land here too.</p>}

      {byAisle.map(([aisle, items]) => (
        <div key={aisle} className="aisle">
          <p className="cat-label">{aisle}</p>
          {items.map((l) => {
            const name = l.chosen || l.name;
            const hasOpts = l.options && l.options.length > 1;
            const isOpen = !!unfolded[l.id];
            return (
              <div key={l.id} className="shop-item">
                <div className="shop-row">
                  <button className="tickbox" onClick={() => toggle(l.id)} aria-label={`Tick off ${name}`}>
                    <span className="box" />
                  </button>
                  <div className="shop-text">
                    <span className="shop-name">
                      {name}
                      {l.qty ? <span className="small"> · {l.qty}</span> : null}
                    </span>
                    {(l.why || l.chosen) && <span className="shop-why">{[l.chosen ? l.name : '', l.why].filter(Boolean).join(' · ')}</span>}
                  </div>
                  {hasOpts && (
                    <button className="opts-toggle" aria-expanded={isOpen} onClick={() => setUnfolded((u) => ({ ...u, [l.id]: !isOpen }))}>
                      {l.options.length} types <Chevron open={isOpen} />
                    </button>
                  )}
                  {l.optionsState === 'loading' && <span className="small">…</span>}
                  {link(name) && (
                    <a className="shop-go" href={link(name)} target="_blank" rel="noreferrer" aria-label={`Find ${name} at ${shop.name}`}>
                      <Chevron open={false} />
                    </a>
                  )}
                </div>
                {hasOpts && isOpen && (
                  <div className="opts">
                    {l.options.map((o) => (
                      <div key={o.name} className={`opt${l.chosen === o.name ? ' on' : ''}`}>
                        <button
                          className="opt-pick"
                          onClick={() => {
                            choose(l.id, o.name);
                            setUnfolded((u) => ({ ...u, [l.id]: false }));
                          }}
                          aria-pressed={l.chosen === o.name}
                        >
                          <span className="opt-name">{o.name}</span>
                          {o.note && <span className="opt-note">{o.note}</span>}
                        </button>
                        {link(o.name) && (
                          <a className="opt-go" href={link(o.name)} target="_blank" rel="noreferrer" aria-label={`Find ${o.name} at ${shop.name}`}>
                            <Chevron open={false} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {l.optionsState === 'error' && (
                  <button className="link-btn small" style={{ paddingLeft: 36 }} onClick={() => onFindOptions(l)}>Couldn’t find types. Try again</button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {done.length > 0 && (
        <details className="done-list">
          <summary className="small">Got {done.length} {done.length === 1 ? 'thing' : 'things'}</summary>
          {done.map((l) => (
            <button key={l.id} className="check" aria-pressed onClick={() => toggle(l.id)}>
              <span className="box"><Tick /></span>
              <span className="label" style={{ fontSize: 15 }}>{l.chosen || l.name}</span>
            </button>
          ))}
        </details>
      )}

      {open.length > 0 && shop && shop.search && (
        <button className="btn" onClick={() => setShopping(true)}>
          Shop it at {shop.name}
        </button>
      )}
      {shopping && (
        <ShopIt
          items={byAisle.flatMap(([, items]) => items)}
          shop={shop}
          onChoose={choose}
          onDone={(id) => setList((ls) => ls.map((x) => (x.id === id ? { ...x, done: true } : x)))}
          onClose={() => setShopping(false)}
        />
      )}

      {list.length > 0 && (
        <div className="row">
          <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setList(open)} disabled={!done.length}>Clear ticked</button>
          <button className="btn sm" style={{ flex: 1 }} onClick={share} disabled={!open.length}>Share list</button>
        </div>
      )}
      {copied && <p className="sub">{copied}</p>}
      <p className="small">Snap your receipt after the shop and I’ll tick off what you bought.</p>
    </div>
  );
}

// One item at a time: open it at the supermarket, add it to the basket there, come back, next.
function ShopIt({ items, shop, onChoose, onDone, onClose }) {
  const [queue] = useState(() => items.map((i) => i.id));
  const [pos, setPos] = useState(0);
  const [opened, setOpened] = useState(false);
  const item = items.find((i) => i.id === queue[pos]);
  const finished = pos >= queue.length;
  const next = () => {
    setOpened(false);
    setPos((p) => p + 1);
  };
  const name = item ? item.chosen || item.name : '';
  return (
    <div className="overlay">
      <button className="backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={`Shop it at ${shop.name}`}>
        <div className="row between">
          <p className="eyebrow">{finished ? 'All done' : `${pos + 1} of ${queue.length} · ${shop.name}`}</p>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close />
          </button>
        </div>
        {finished || !item ? (
          <>
            <p className="h3">That’s the lot, Chef.</p>
            <p className="sub">Check out in the {shop.name} app. Snap the receipt when it arrives and I’ll update your kitchen.</p>
            <button className="btn" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <div className="progress"><i style={{ width: `${(pos / queue.length) * 100}%` }} /></div>
            <p className="h3" style={{ fontSize: 26 }}>
              {name}
              {item.qty ? <span className="small"> · {item.qty}</span> : null}
            </p>
            {item.why && <p className="sub">{item.why}</p>}
            {item.options && item.options.length > 1 && (
              <div className="where" role="group" aria-label="Which type?">
                {item.options.map((o) => (
                  <button key={o.name} className="chip" aria-pressed={item.chosen === o.name} onClick={() => onChoose(item.id, o.name)}>
                    {o.name}
                  </button>
                ))}
              </div>
            )}
            <a className="btn" href={shop.search(name)} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              Find it at {shop.name}
            </a>
            <div className="row">
              <button className="btn ghost sm" style={{ flex: 1 }} onClick={next}>Skip</button>
              <button
                className="btn sm"
                style={{ flex: 2, background: opened ? 'var(--leaf)' : undefined }}
                onClick={() => {
                  onDone(item.id);
                  next();
                }}
              >
                Added, next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Kit ---------- */
export function Kit({ kit, onBack, onEdit, onAdd, onFilm }) {
  const [text, setText] = useState('');
  const [toast, setToast] = useState(false);
  return (
    <div className="screen">
      <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 className="h2" style={{ fontSize: 32 }}>Your kit</h2>
        <p className="sub">I only suggest recipes you can make with this. Tap one to change it.</p>
      </div>
      {kit.length > 0 ? (
        <div className="plain-bg">
          <ItemGroups items={kit.map((k) => ({ ...k, area: 'Equipment' }))} area="Equipment" onTap={onEdit} />
        </div>
      ) : (
        <p className="sub">No kit logged yet.</p>
      )}
      <div className="row">
        <label htmlFor="kit-add" className="sr-only">Add kit</label>
        <input id="kit-add" className="input" placeholder="e.g. Air fryer" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); } }} />
        <button className="btn sm" disabled={!text.trim()} onClick={() => { onAdd(text.trim()); setText(''); }}>Add</button>
      </div>
      <button className="btn ghost sm" onClick={onFilm}>Film or snap my kit</button>
      <div className="card orange tight">
        <p className="eyebrow orange">Oven check</p>
        <p style={{ fontSize: 15, lineHeight: 1.45 }}>Does your oven cook unevenly? The toast test finds the hot spots in five minutes.</p>
        {toast && (
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15, lineHeight: 1.45 }}>
            <li>Lay slices of bread across a baking tray.</li>
            <li>Bake at 180°C for 5 minutes.</li>
            <li>Look where it's darkest, then tap your oven above and add a note, e.g. "Runs hot on the left".</li>
          </ol>
        )}
        <button className="btn sm" onClick={() => setToast(!toast)}>{toast ? 'Got it' : 'How to do the toast test'}</button>
      </div>
    </div>
  );
}

/* ---------- Menu pages ---------- */
function HouseholdCard({ household, sync, joinPrefill, onJoined }) {
  const [code, setCode] = useState(joinPrefill || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function run(fn) {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function invite() {
    const link = `${window.location.origin}/?join=${household}`;
    const text = `Join our kitchen on Yes Chef! Open this link, then tap Add to Home Screen: ${link}  (or enter code ${household})`;
    try {
      if (navigator.share) await navigator.share({ title: 'Yes Chef! invite', text });
      else {
        await navigator.clipboard.writeText(text);
        setNote('Invite copied. Paste it into a message.');
      }
    } catch (e) {
      // cancelled
    }
  }

  if (household) {
    const pretty = household.replace(/(.{4})/, '$1-');
    return (
      <div className="card">
        <p className="eyebrow">Shared kitchen</p>
        <p style={{ fontSize: 16, lineHeight: 1.45 }}>Everyone with this code sees the same stock, kit and shopping list.</p>
        <p style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.08em' }}>{pretty}</p>
        <p className="small">
          {sync.status === 'error' ? sync.message : sync.status === 'syncing' ? 'Syncing…' : 'Up to date. Changes on other phones show within about 15 seconds.'}
        </p>
        <button className="btn sm" onClick={invite}>Invite someone</button>
        {note && <p className="sub">{note}</p>}
        <button className="btn sm ghost" onClick={() => (confirmLeave ? sync.leave() : setConfirmLeave(true))}>
          {confirmLeave ? 'Tap again to stop sharing on this phone' : 'Leave shared kitchen'}
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="eyebrow">Share your kitchen</p>
      <p style={{ fontSize: 16, lineHeight: 1.45 }}>Link phones so everyone in the house sees the same stock and shopping list.</p>
      <button className="btn sm" disabled={busy} onClick={() => run(async () => { await sync.create(); onJoined(); })}>
        Start a shared kitchen
      </button>
      <p className="small" style={{ textAlign: 'center' }}>or join one you've been invited to</p>
      <div className="row">
        <label htmlFor="join-code" className="sr-only">Household code</label>
        <input id="join-code" className="input" placeholder="Enter code" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn sm" disabled={busy || code.replace(/[^A-Za-z0-9]/g, '').length < 6} onClick={() => run(async () => { await sync.join(code); onJoined(); })}>
          Join
        </button>
      </div>
      <p className="small">Joining replaces this phone's kitchen with the shared one.</p>
      {busy && <div className="spinner" />}
      {err && <p className="error">{err}</p>}
    </div>
  );
}

export function Account({ profile, setProfile, onBack, household, sync, joinPrefill, onJoined }) {
  const field = (key, label, placeholder) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="lbl" htmlFor={`acc-${key}`}>{label}</label>
      <input id={`acc-${key}`} className="input" placeholder={placeholder} value={profile[key] || ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
    </div>
  );
  return (
    <div className="screen">
      <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
      <h2 className="h2" style={{ fontSize: 32 }}>Account</h2>
      <HouseholdCard household={household} sync={sync} joinPrefill={joinPrefill} onJoined={onJoined} />
      {field('name', 'Your name', 'Chef')}
      {field('household', 'Who are you cooking for?', 'e.g. 2 adults, 2 kids')}
      {field('dietary', 'Dietary needs or dislikes', 'e.g. no mushrooms, one veggie')}
      <p className="sub">I use this to size recipes and steer clear of things you don't eat.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p className="lbl">Where do you usually shop?</p>
        <ShopPicker value={profile.supermarket} onChange={(id) => setProfile({ ...profile, supermarket: id })} />
        <p className="sub">Your shopping list links straight to their search, so you see real products and prices.</p>
      </div>
    </div>
  );
}

export function Settings({ settings, setSettings, onReset, onBack }) {
  const [confirm, setConfirm] = useState(false);
  const toggle = (key, name, desc) => (
    <div className="list-row">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <p style={{ fontSize: 16, fontWeight: 700 }}>{name}</p>
        <p className="small">{desc}</p>
      </div>
      <button className="switch" aria-pressed={!!settings[key]} aria-label={name} onClick={() => setSettings({ ...settings, [key]: !settings[key] })}>
        <span />
      </button>
    </div>
  );
  return (
    <div className="screen">
      <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
      <h2 className="h2" style={{ fontSize: 32 }}>Settings</h2>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {toggle('useUp', 'Use-it-up alerts', 'Flag food that needs eating soon')}
        {toggle('autoIdea', 'Suggest meals automatically', 'An idea is ready when you open the app')}
      </div>
      <p className="small">Coming later: on-the-way-home nudges, calendar planning and health traffic lights.</p>
      <div className="card tight">
        <p style={{ fontSize: 16, fontWeight: 700 }}>Start again</p>
        <p className="sub">Clears your kitchen, kit and shopping list from this phone.</p>
        <button className="btn sm ghost" onClick={() => (confirm ? onReset() : setConfirm(true))}>
          {confirm ? 'Tap again to clear everything' : 'Reset everything'}
        </button>
      </div>
    </div>
  );
}

export function About({ onBack }) {
  return (
    <div className="screen">
      <button className="icon-btn" onClick={onBack} aria-label="Back"><Back /></button>
      <h2 className="h2" style={{ fontSize: 32 }}>About</h2>
      <Logo width={200} />
      <p className="lead">You're the chef. We do the prep: what's in, what needs using up, and what to buy, so less goes in the bin and more stays in your pocket.</p>
      <p className="small">Test version 0.1</p>
    </div>
  );
}

export { Pin };
