'use client';
import { useRef, useState } from 'react';
import { FOOD_AREAS, PRODUCT_AREAS } from '@/lib/helpers';
import { fileToSmallJpeg, receiptFiles } from '@/lib/media';
import { createListener, speechSupported } from '@/lib/speech';
import { Back, Camera, Chevron, Close, Keyboard, Mic } from './Icons';
import ItemGroups from './ItemGroups';

const SECTIONS = [...FOOD_AREAS, ...PRODUCT_AREAS, 'Equipment'];

function AddMissed({ onAdd, title }) {
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [photos, setPhotos] = useState([]);
  const listener = useRef(null);
  const canSpeak = speechSupported();

  function toggle(m) {
    stopListening();
    setText('');
    setPhotos([]);
    setOpen(open === m ? null : m);
  }

  function startListening() {
    const l = createListener(({ finalText, interim: i }) => {
      setText(finalText);
      setInterim(i);
    });
    listener.current = l;
    if (l) {
      l.start(text);
      setListening(true);
    }
  }
  function stopListening() {
    if (listener.current) {
      const t = listener.current.stop();
      if (t) setText(t);
    }
    listener.current = null;
    setInterim('');
    setListening(false);
  }

  async function pickPhotos(files) {
    const list = await Promise.all(Array.from(files).slice(0, 6).map(fileToSmallJpeg)).catch(() => []);
    setPhotos((p) => [...p, ...list].slice(0, 6));
  }

  function submit() {
    stopListening();
    const t = (listener.current ? listener.current.text : text).trim();
    if (!t && photos.length === 0) return;
    onAdd(photos, t, open === 'type' ? t : null);
    setText('');
    setPhotos([]);
    setOpen(null);
  }

  return (
    <div className="card tight" style={{ flexShrink: 0 }}>
      <p style={{ fontSize: 15, fontWeight: 700 }}>{title || 'Missed something? Add it'}</p>
      <div className="grid3">
        <button className="mode-btn" aria-pressed={open === 'say'} onClick={() => toggle('say')}>
          <Mic />
          Say it
        </button>
        <button className="mode-btn" aria-pressed={open === 'snap'} onClick={() => toggle('snap')}>
          <Camera />
          Snap it
        </button>
        <button className="mode-btn" aria-pressed={open === 'type'} onClick={() => toggle('type')}>
          <Keyboard />
          Type it
        </button>
      </div>

      {open === 'say' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canSpeak ? (
            <>
              <p style={{ fontSize: 16, lineHeight: 1.45, minHeight: 24 }}>
                {[text, interim].filter(Boolean).join(' ') || (listening ? 'Listening…' : 'Tap below and tell me what I missed.')}
              </p>
              <div className="row">
                <button className="btn sm ghost" style={{ flex: 1 }} onClick={listening ? stopListening : startListening}>
                  {listening ? 'Stop' : text ? 'Talk more' : 'Start talking'}
                </button>
                <button className="btn sm" style={{ flex: 1 }} onClick={submit} disabled={!text && !listening}>
                  Add it
                </button>
              </div>
            </>
          ) : (
            <p className="sub">Voice isn’t available in this browser. Use Type it instead.</p>
          )}
        </div>
      )}

      {open === 'snap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {photos.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {photos.map((p, i) => (
                <img key={i} src={p} alt={`Photo ${i + 1}`} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8 }} />
              ))}
            </div>
          )}
          <div className="row">
            <label className="btn sm ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photos.length ? 'More photos' : 'Take or choose'}
              <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => pickPhotos(e.target.files)} />
            </label>
            <button className="btn sm" style={{ flex: 1 }} onClick={submit} disabled={!photos.length}>
              Add these
            </button>
          </div>
        </div>
      )}

      {open === 'type' && (
        <div className="row">
          <label htmlFor="missed" className="sr-only">
            What did I miss?
          </label>
          <input
            id="missed"
            className="input"
            placeholder="e.g. half a block of feta"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn sm" onClick={submit} disabled={!text.trim()}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function ReceiptCard({ onReceipt }) {
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function handle(files) {
    if (!files || !files.length) return;
    setBusy(true);
    setMsg('');
    const { images, docs, problems } = await receiptFiles(files);
    if (images.length || docs.length) onReceipt(images, docs);
    setMsg(problems.join(' '));
    setBusy(false);
  }

  return (
    <div className="card tight green" style={{ flexShrink: 0 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2E6B1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
          <path d="M6 3 H18 V21 L15.5 19 L13 21 L10.5 19 L8 21 L6 19 Z" />
          <path d="M9 8 H15 M9 12 H15 M9 16 H12" />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Got a receipt? I'll read it</p>
          <p className="sub" style={{ fontSize: 14 }}>Snap a paper receipt, or upload a screenshot or PDF of an online order.</p>
        </div>
      </div>
      <div className="row">
        <label className="btn sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {busy ? 'Reading…' : 'Photo of receipt'}
          <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
        </label>
        <label className="btn sm ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Upload a file
          <input className="sr-only" type="file" accept="image/*,application/pdf,.pdf" multiple onChange={(e) => { handle(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {msg && <p className="error">{msg}</p>}
    </div>
  );
}

export default function Found({ title, subtitle, pending, jobs, onRemove, onAdd, onConfirm, confirmLabel, onBack, onRetry, onReceipt }) {
  const [openSecs, setOpenSecs] = useState({ Fridge: true });
  const loading = jobs.filter((j) => j.state === 'loading');
  const failed = jobs.filter((j) => j.state === 'error');

  const sections = SECTIONS.map((area) => {
    const items = pending.filter((p) => p.area === area);
    return { area, items, label: area === 'Equipment' ? 'Equipment' : area };
  }).filter((sec) => !onReceipt || sec.items.length > 0);

  return (
    <div className="screen-fixed">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {onBack && (
          <button className="icon-btn" onClick={onBack} aria-label="Back">
            <Back />
          </button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2 className="h2">{title}</h2>
          <p className="sub">{subtitle}</p>
        </div>
      </div>

      {onReceipt && <ReceiptCard onReceipt={onReceipt} />}
      <AddMissed onAdd={onAdd} title={onReceipt ? 'Or tell me what you\u2019ve got' : undefined} />

      <div className="scroll">
        {loading.length > 0 && (
          <div className="card tight" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <div className="spinner" />
            <p className="sub">Reading {loading.map((j) => (j.area === 'Auto' ? 'what you added' : j.area === 'Receipt' ? 'your receipt' : j.area.toLowerCase())).join(', ')}…</p>
          </div>
        )}
        {failed.map((j) => (
          <div key={j.id} className="error" style={{ flexShrink: 0 }}>
            {j.message}
            {onRetry && (
              <>
                {' '}
                <button className="btn sm ghost" style={{ marginTop: 8, height: 36 }} onClick={() => onRetry(j)}>
                  Try again
                </button>
              </>
            )}
          </div>
        ))}

        {sections.map((s) => {
          const open = !!openSecs[s.area];
          return (
            <div className="section" key={s.area}>
              <button className="section-head" aria-expanded={open} onClick={() => setOpenSecs({ ...openSecs, [s.area]: !open })}>
                <span>{s.label}</span>
                <span className="meta">
                  {s.items.length} {s.items.length === 1 ? 'item' : 'items'}
                  <Chevron open={open} />
                </span>
              </button>
              {open && (
                <div className="section-body">
                  {s.items.length === 0 ? (
                    <p className="sub" style={{ padding: '6px 8px 8px' }}>
                      Nothing here yet.
                    </p>
                  ) : (
                    <ItemGroups items={s.items} area={s.area} onRemove={onRemove} />
                                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn" onClick={onConfirm} disabled={loading.length > 0}>
        {loading.length > 0 ? 'Still reading…' : confirmLabel}
      </button>
    </div>
  );
}
