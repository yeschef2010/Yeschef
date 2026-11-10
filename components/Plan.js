'use client';
import { useState } from 'react';
import { Lights, Stepper } from './Screens';
import { safePrep } from '@/lib/helpers';
import { dayLong, eatersText, fromIso } from '@/lib/plan';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso) => {
  const d = fromIso(iso);
  return `${d.getDate()} ${MONTH[d.getMonth()]}`;
};

function Night({ night, isTonight, busy, onSwap, onToggle, onEaters, onOpen }) {
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState('');
  const [editWho, setEditWho] = useState(false);
  const idea = night.idea;
  const ask = () => {
    onSwap(night.date, text.trim());
    setText('');
    setAsking(false);
  };
  return (
    <div className={`night${night.off ? ' off' : ''}${night.cooked ? ' cooked' : ''}`}>
      <div className="night-head">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="night-day">{isTonight ? 'Tonight' : dayLong(night.date)}</span>
          <span className="small">{isTonight ? `${dayLong(night.date)} ${shortDate(night.date)}` : shortDate(night.date)}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {!night.off && (
            <button className="chip" onClick={() => setEditWho(!editWho)} aria-expanded={editWho}>
              {eatersText(night.eaters)}
            </button>
          )}
          <button className="chip" aria-pressed={!!night.off} onClick={() => onToggle(night.date)}>
            {night.off ? 'Night off' : 'Cooking'}
          </button>
        </div>
      </div>

      {editWho && !night.off && (
        <div className="eaters">
          <Stepper label="Adults" value={night.eaters.adults} min={night.eaters.kids ? 0 : 1} onChange={(n) => onEaters(night.date, { ...night.eaters, adults: n })} />
          <Stepper label="Kids" value={night.eaters.kids} min={night.eaters.adults ? 0 : 1} onChange={(n) => onEaters(night.date, { ...night.eaters, kids: n })} />
        </div>
      )}

      {night.off ? (
        <p className="sub">Not cooking. Enjoy.</p>
      ) : night.loading ? (
        <div className="row" style={{ minHeight: 60 }}>
          <div className="spinner" />
          <p className="sub">Thinking up {dayLong(night.date)}…</p>
        </div>
      ) : idea ? (
        <>
          <button className="night-meal" onClick={() => onOpen(night.date)}>
            <span className="eyebrow">
              {idea.time}
              {night.cooked ? ' · cooked' : ''}
              {idea.detail === 'loading' ? ' · writing the recipe…' : ''}
            </span>
            <span className="idea-title">{idea.title}</span>
            {idea.why && <span className="idea-why">{idea.why}</span>}
            <span className="idea-foot">
              <Lights lights={idea.lights} small />
            </span>
          </button>
          {night.defrost && night.defrost.length > 0 && (
            <p className="defrost">
              <strong>From the freezer:</strong> {night.defrost.map((d) => d.name.toLowerCase()).join(', ')}.{' '}
              {night.defrost.some((d) => d.big) ? 'I’ll remind you the night before.' : 'I’ll remind you that morning.'}
            </p>
          )}
          {safePrep(idea.prep) && <p className="defrost"><strong>Prep:</strong> {safePrep(idea.prep)}</p>}
          {!night.cooked && (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => onSwap(night.date, '')} disabled={busy}>
                Swap it
              </button>
              <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setAsking(!asking)} disabled={busy}>
                Ask for…
              </button>
            </div>
          )}
          {asking && (
            <form className="ask" onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask(); }}>
              <label htmlFor={`ask-${night.date}`} className="sr-only">What would you like on {dayLong(night.date)}?</label>
              <input id={`ask-${night.date}`} className="input" placeholder={`e.g. fish, or something the kids love`} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
              <button className="btn sm" type="submit" disabled={!text.trim()}>Go</button>
            </form>
          )}
        </>
      ) : night.error ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="error" style={{ margin: 0 }}>Couldn’t plan this one.</p>
          <button className="btn ghost sm" onClick={() => onSwap(night.date, '')}>Try again</button>
        </div>
      ) : (
        <p className="sub">Not planned yet.</p>
      )}
    </div>
  );
}

export default function Plan({ nights, todayIso, planning, error, onPlanAll, onSwap, onToggle, onEaters, onOpen, onShop, shopState, notify, onNotify, household }) {
  const planned = nights.some((n) => n.idea);
  const busy = planning || nights.some((n) => n.loading);
  const first = nights[0];
  const last = nights[nights.length - 1];
  return (
    <div className="screen" style={{ paddingTop: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 56 }}>
        <h2 className="h2" style={{ fontSize: 34 }}>Plan the week</h2>
        <p className="sub">
          {first && last ? `${dayLong(first.date)} ${shortDate(first.date)} to ${dayLong(last.date)} ${shortDate(last.date)}.` : ''} Weeknight dinners, joined up so nothing goes to waste.
        </p>
      </div>

      {!planned && (
        <button className="btn" onClick={onPlanAll} disabled={busy}>
          {planning ? 'Planning your week…' : 'Plan my week'}
        </button>
      )}
      {error && <p className="error" style={{ whiteSpace: 'pre-line' }}>{error}</p>}

      <div className="nights">
        {nights.map((n) => (
          <Night key={n.date} night={n} isTonight={n.date === todayIso} busy={busy} onSwap={onSwap} onToggle={onToggle} onEaters={onEaters} onOpen={onOpen} />
        ))}
      </div>

      {planned && (
        <div className="card tight">
          <p className="h3" style={{ fontSize: 18 }}>Shopping for the week</p>
          <p className="sub">Adds only what you don’t already have, in sensible pack sizes that cover more than one night where they can.</p>
          <button className="btn" onClick={onShop} disabled={busy || shopState === 'loading'}>
            {shopState === 'loading' ? 'Working out the packs…' : shopState === 'done' ? 'Added. Update the list again' : 'Add what’s missing to the shopping list'}
          </button>
          {shopState === 'error' && <p className="error">Couldn’t work out the shopping. Try again in a moment.</p>}
        </div>
      )}

      {planned && (
        <button className="btn quiet sm" onClick={onPlanAll} disabled={busy}>
          Start the week again
        </button>
      )}

      <div className="card tight">
        <p className="h3" style={{ fontSize: 18 }}>Reminders</p>
        <p className="sub">Sunday 8pm: “Want to plan the week?” And on the day, a nudge to get things out of the freezer, sent to everyone in your household.</p>
        {notify === 'on' ? (
          <p className="sub" style={{ color: 'var(--leaf-dark)', fontWeight: 700 }}>Reminders are on for this phone.</p>
        ) : notify === 'unsupported' ? (
          <p className="sub">This phone can’t get reminders from here. On iPhone, add Yes Chef to your Home Screen first (Share, then Add to Home Screen), then open it from there.</p>
        ) : notify === 'blocked' ? (
          <p className="sub">Notifications are turned off for Yes Chef in this phone’s settings.</p>
        ) : !household ? (
          <p className="sub">Reminders need a household, so both your phones get them. Set one up in Account first.</p>
        ) : (
          <button className="btn secondary" onClick={onNotify} disabled={notify === 'working'}>
            {notify === 'working' ? 'Turning on…' : 'Turn on reminders'}
          </button>
        )}
      </div>
    </div>
  );
}
