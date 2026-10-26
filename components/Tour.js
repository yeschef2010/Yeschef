'use client';
import { useEffect, useRef, useState } from 'react';
import { FOOD_AREAS, PRODUCT_AREAS } from '@/lib/helpers';
import { PHOTO_SIDE, fileToSmallJpeg, framesFromVideoFile, grabFrame, receiptFiles } from '@/lib/media';
import { createListener, speechSupported } from '@/lib/speech';
import { Back, Camera, Close, Mic, Video } from './Icons';
import ItemGroups from './ItemGroups';

const MAX_FRAMES = 10;
const WHERE = ['Anywhere', 'Fridge', 'Freezer', 'Cupboard'];

const MODES = {
  kitchen: { title: 'Add items', scanArea: 'Auto', save: 'Save to my kitchen', chips: true, receipts: true,
    tip: 'Film, snap or talk me through anything: fridge, freezer, cupboards, drinks. I’ll sort it.' },
  products: { title: 'Add products', scanArea: 'Products', save: 'Save products', chips: false, receipts: true,
    tip: 'Cleaning bits, washing machine and dishwasher stuff. Say if anything’s nearly empty.' },
  kit: { title: 'Add kit', scanArea: 'Equipment', save: 'Save kit', chips: false, receipts: false,
    tip: 'Pans, gadgets, and anything your oven gets wrong.' },
};

function lastWords(text, n = 2) {
  const parts = (text || '').split(/(?<=[.!?,])\s+|\s{2,}/).filter(Boolean);
  if (parts.length > 1) return parts.slice(-n);
  const words = (text || '').split(' ');
  return words.length > 14 ? ['…' + words.slice(-14).join(' ')] : text ? [text] : [];
}

// One place to add anything: film, snap, talk, type or scan a receipt. The AI files each item where it belongs.
export default function AddItems({ mode: addMode = 'kitchen', onSubmit, onDone, onExit, onSave, pending = [], jobs = [], onRemove, onRetry, onUpdatePending }) {
  const cfg = MODES[addMode] || MODES.kitchen;
  const [mode, setMode] = useState('video');
  const [where, setWhere] = useState('Anywhere');
  const [images, setImages] = useState([]);
  const [receipt, setReceipt] = useState({ images: [], docs: [] });
  const [note, setNote] = useState('');
  const [interim, setInterim] = useState('');
  const [recording, setRecording] = useState(false);
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState('capture'); // 'capture' | 'review'
  const [myJobs, setMyJobs] = useState([]);
  const [flash, setFlash] = useState(false);
  const [paused, setPaused] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const listenerRef = useRef(null);
  const frameTimer = useRef(null);
  const clockTimer = useRef(null);
  const imagesRef = useRef([]);
  imagesRef.current = images;
  const recordingRef = useRef(false);
  recordingRef.current = recording;

  const canSpeak = speechSupported();
  const needsCam = phase === 'capture' && (mode === 'video' || mode === 'photo');

  function snap() {
    if (imagesRef.current.length >= MAX_FRAMES) return;
    const f = grabFrame(videoRef.current, PHOTO_SIDE);
    if (!f) return;
    setImages((prev) => [...prev, f].slice(0, MAX_FRAMES));
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }

  // Live camera for video and snap.
  useEffect(() => {
    if (!needsCam) return undefined;
    let cancelled = false;
    setCamError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError('This browser can’t open the camera here. Try Snap instead.');
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setCamError('I couldn’t open the camera. Check camera permission, or use Snap instead.'));
    return () => {
      cancelled = true;
      stopRecording();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCam]);

  useEffect(() => () => stopEverything(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the screen on, so it doesn't lock mid-sentence.
  useEffect(() => {
    let lock = null;
    const grab = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
      } catch (e) {
        // Not supported or not allowed.
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') grab();
      else if (recordingRef.current) {
        stopRecording();
        setPaused(true);
      }
    };
    grab();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (lock) lock.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startListening() {
    if (!canSpeak) return;
    const l = createListener(({ finalText, interim: i }) => {
      setNote(finalText);
      setInterim(i);
    });
    listenerRef.current = l;
    l && l.start(note);
  }
  function stopListening() {
    if (listenerRef.current) {
      const t = listenerRef.current.stop();
      listenerRef.current = null;
      setInterim('');
      if (t) setNote(t);
    }
  }
  function startRecording() {
    setPaused(false);
    setRecording(true);
    setSeconds(0);
    const take = () => {
      if (imagesRef.current.length >= MAX_FRAMES) return;
      const f = grabFrame(videoRef.current);
      if (f) setImages((prev) => (prev.length >= MAX_FRAMES ? prev : [...prev, f]));
    };
    take();
    frameTimer.current = setInterval(take, 2500);
    clockTimer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    startListening();
  }
  function stopRecording() {
    clearInterval(frameTimer.current);
    clearInterval(clockTimer.current);
    frameTimer.current = null;
    setRecording(false);
    stopListening();
  }
  function stopEverything() {
    stopRecording();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function addPhotos(files) {
    setBusy(true);
    try {
      const list = await Promise.all(Array.from(files).slice(0, MAX_FRAMES).map((f) => fileToSmallJpeg(f)));
      setImages((prev) => [...prev, ...list].slice(0, MAX_FRAMES));
    } catch (e) {
      setCamError('I couldn’t open one of those photos. If you’re on a Mac, try a JPG or PNG, or use your phone.');
    }
    setBusy(false);
  }
  async function addVideoFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const frames = await framesFromVideoFile(file, 8);
      setImages((prev) => [...prev, ...frames].slice(0, MAX_FRAMES));
    } catch (e) {
      setCamError('I couldn’t read that video. Try photos instead.');
    }
    setBusy(false);
  }
  async function addReceipt(files) {
    if (!files || !files.length) return;
    setBusy(true);
    setCamError('');
    const r = await receiptFiles(files);
    setReceipt((prev) => ({ images: [...prev.images, ...r.images].slice(0, 6), docs: [...prev.docs, ...r.docs].slice(0, 2) }));
    if (r.problems.length) setCamError(r.problems.join(' '));
    setBusy(false);
  }

  const heard = [note, interim].filter(Boolean).join(' ');
  const receiptCount = receipt.images.length + receipt.docs.length;
  const hasContent = images.length > 0 || !!heard.trim() || receiptCount > 0;

  // Send everything off to be read, then show what was found.
  function upload() {
    setPaused(false);
    const finalNote = (listenerRef.current ? listenerRef.current.stop() || note : note) || '';
    stopRecording();
    const ids = [];
    const whereHint = cfg.chips && where !== 'Anywhere' ? where : null;
    if (imagesRef.current.length || finalNote.trim()) {
      ids.push(onSubmit(cfg.scanArea, imagesRef.current, finalNote, null, [], { where: whereHint }));
    }
    if (receiptCount) ids.push(onSubmit('Receipt', receipt.images, '', null, receipt.docs, {}));
    setImages([]);
    setReceipt({ images: [], docs: [] });
    setNote('');
    setInterim('');
    setMode('video');
    if (ids.length) {
      setMyJobs((j) => [...j, ...ids]);
      setPhase('review');
    }
  }

  function save() {
    if (myJobs.length && onSave) onSave(myJobs);
    stopEverything();
    onDone();
  }

  function back() {
    stopRecording();
    if (phase === 'review') {
      setPhase('capture');
      return;
    }
    stopEverything();
    onExit();
  }

  function pickMode(m) {
    stopRecording();
    setCamError('');
    setMode(m);
  }

  const readyParts = [
    images.length ? `${images.length} picture${images.length === 1 ? '' : 's'}` : '',
    heard.trim() ? 'your notes' : '',
    receiptCount ? `${receiptCount} receipt${receiptCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const captions = mode === 'receipt' ? [] : lastWords(heard);
  const badge =
    mode === 'video'
      ? recording
        ? `Recording 0:${String(seconds).padStart(2, '0')}`
        : images.length
        ? `${images.length} picture${images.length === 1 ? '' : 's'} saved`
        : 'Ready'
      : mode === 'photo'
      ? `${images.length} photo${images.length === 1 ? '' : 's'}`
      : mode === 'receipt'
      ? receiptCount
        ? `${receiptCount} receipt${receiptCount === 1 ? '' : 's'} ready`
        : 'Receipt'
      : recording
      ? 'Listening…'
      : canSpeak
      ? 'Tap to talk, or type below'
      : 'Type below';

  const myItems = pending.filter((p) => myJobs.includes(p.job));
  const myJobRecords = jobs.filter((j) => myJobs.includes(j.id));
  const areaChoices = addMode === 'products' ? PRODUCT_AREAS : addMode === 'kit' ? ['Equipment'] : FOOD_AREAS;

  return (
    <div className="screen-fixed">
      <div className="row between">
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Back />
        </button>
        <p style={{ fontSize: 17, fontWeight: 800 }}>{phase === 'review' ? 'Here’s what I found' : cfg.title}</p>
        <div style={{ width: 44 }} />
      </div>

      {phase === 'review' && (
        <Review
          items={myItems}
          jobs={myJobRecords}
          areaChoices={areaChoices}
          onRemove={onRemove}
          onUpdate={onUpdatePending}
          onRetry={(job) => {
            const id = onRetry(job);
            setMyJobs((j) => [...j.filter((x) => x !== job.id), id]);
          }}
          onMore={() => setPhase('capture')}
          onSave={save}
          saveLabel={cfg.save}
        />
      )}

      {phase === 'capture' && (
        <>
          {cfg.chips && (
            <div className="where" role="group" aria-label="Where are you?">
              <span className="small" style={{ fontWeight: 700 }}>Where are you?</span>
              {WHERE.map((w) => (
                <button key={w} className="chip" aria-pressed={where === w} onClick={() => setWhere(w)}>
                  {w}
                </button>
              ))}
            </div>
          )}

          <div className="camera">
            {needsCam && !camError && <video ref={videoRef} playsInline muted autoPlay />}
            {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0.6 }} />}
            {mode === 'video' && camError && (
              <div className="placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <p className="sub">{camError}</p>
                <label className="btn sm ghost" style={{ display: 'flex', alignItems: 'center' }}>
                  Choose a video instead
                  <input className="sr-only" type="file" accept="video/*" capture="environment" onChange={(e) => addVideoFile(e.target.files[0])} />
                </label>
              </div>
            )}
            {mode === 'photo' && camError && <p className="placeholder sub" style={{ fontSize: 16 }}>{camError}</p>}
            {mode === 'voice' && <p className="placeholder">Just talk, or type below</p>}
            {mode === 'receipt' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', padding: 20, width: '100%' }}>
                <p className="on-dark" style={{ fontSize: 18, fontWeight: 800, textAlign: 'center' }}>Got a receipt? I’ll read it</p>
                <p className="on-dark" style={{ fontSize: 14, textAlign: 'center', opacity: 0.85 }}>
                  Snap a paper receipt, or upload a screenshot or PDF of an online order. Long receipt? Take it in two halves.
                </p>
                <label className="btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tomato)' }}>
                  {busy ? 'Reading…' : 'Photo of receipt'}
                  <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(e) => { addReceipt(e.target.files); e.target.value = ''; }} />
                </label>
                <label className="btn ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Upload a file
                  <input className="sr-only" type="file" accept="image/*,application/pdf,.pdf" multiple onChange={(e) => { addReceipt(e.target.files); e.target.value = ''; }} />
                </label>
                {camError && <p className="error">{camError}</p>}
              </div>
            )}

            <div className="badge-rec">
              <i />
              {badge}
            </div>

            {mode === 'photo' && images.length > 0 && (
              <div className="thumbs">
                {images.map((src, i) => (
                  <img key={i} src={src} alt={`Photo ${i + 1}`} />
                ))}
              </div>
            )}

            {paused && (
              <div className="caption" style={{ position: 'absolute', top: 54, left: 14, right: 14, background: 'var(--honey)', color: 'var(--forest)' }}>
                Paused when your screen turned off. I’ve kept what you said. Tap below to carry on.
              </div>
            )}
            {mode !== 'receipt' && (
              <div className="captions">
                {captions.map((c, i) => (
                  <p key={i} className="caption">
                    {c}
                  </p>
                ))}
                {mode === 'video' && !camError && (
                  <button
                    className="btn"
                    onClick={recording ? stopRecording : startRecording}
                    style={{ alignSelf: 'center', borderRadius: 30, minWidth: 160, background: recording ? '#F8F5EC' : undefined, color: recording ? '#153D2C' : undefined }}
                  >
                    {recording ? 'Stop' : images.length ? 'Record more' : 'Start recording'}
                  </button>
                )}
                {mode === 'photo' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                    <label className="btn sm ghost" style={{ display: 'flex', alignItems: 'center', justifySelf: 'start', background: 'rgba(248,245,236,0.92)', borderRadius: 22 }}>
                      {busy ? 'Reading…' : 'Upload'}
                      <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} />
                    </label>
                    {!camError && (
                      <button onClick={snap} aria-label="Take photo" style={{ width: 72, height: 72, borderRadius: 36, border: '5px solid #F8F5EC', background: '#EB4933', padding: 0, flexShrink: 0 }} />
                    )}
                    <span />
                  </div>
                )}
                {mode === 'voice' && canSpeak && (
                  <button
                    className="btn"
                    onClick={recording ? stopRecording : () => { setPaused(false); setRecording(true); startListening(); }}
                    style={{ alignSelf: 'center', borderRadius: 30, minWidth: 160, background: recording ? '#F8F5EC' : undefined, color: recording ? '#153D2C' : undefined }}
                  >
                    {recording ? 'Stop' : heard ? 'Talk some more' : 'Start talking'}
                  </button>
                )}
              </div>
            )}
          </div>

          {mode === 'photo' || mode === 'voice' || !canSpeak ? (
            <textarea
              className="textarea"
              style={{ minHeight: 56, flexShrink: 0 }}
              placeholder={mode === 'photo' ? 'Optional: anything I should know? e.g. "milk’s nearly gone"' : 'Or type it, e.g. "4 onions, half a bag of rice"'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Notes"
            />
          ) : (
            <p className="sub" style={{ textAlign: 'center' }}>
              {hasContent ? `Ready to upload: ${readyParts.join(', ')}. Add more, or tap Upload.` : cfg.tip}
            </p>
          )}

          <div className={cfg.receipts ? 'grid4' : 'grid3'}>
            <button className="mode-btn" aria-pressed={mode === 'video'} onClick={() => pickMode('video')}>
              <Video />
              Video
            </button>
            <button className="mode-btn" aria-pressed={mode === 'photo'} onClick={() => pickMode('photo')}>
              <Camera />
              Snap
            </button>
            <button className="mode-btn" aria-pressed={mode === 'voice'} onClick={() => pickMode('voice')}>
              <Mic />
              Voice
            </button>
            {cfg.receipts && (
              <button className="mode-btn" aria-pressed={mode === 'receipt'} onClick={() => pickMode('receipt')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 3 H18 V21 L15.5 19 L13 21 L10.5 19 L8 21 L6 19 Z" />
                  <path d="M9 8 H15 M9 12 H15 M9 16 H12" />
                </svg>
                Receipt
              </button>
            )}
          </div>

          <button className="btn" onClick={upload} disabled={!hasContent}>
            Upload
          </button>
        </>
      )}
    </div>
  );
}

function Review({ items, jobs, areaChoices, onRemove, onUpdate, onRetry, onMore, onSave, saveLabel }) {
  const [moving, setMoving] = useState(null);
  const loading = jobs.some((j) => j.state === 'loading');
  const failed = jobs.filter((j) => j.state === 'error');
  const questions = items.filter((it) => it.check && Array.isArray(it.check.options) && it.check.options.length);
  const areas = [...new Set(items.map((it) => it.area))];

  return (
    <>
      <div className="scroll">
        {loading && (
          <div className="card tight" style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
            <div className="spinner" />
            <p className="sub">Reading it now. This usually takes a few seconds.</p>
          </div>
        )}
        {failed.map((j) => (
          <div key={j.id} className="error" style={{ flexShrink: 0 }}>
            {j.message}{' '}
            <button className="btn sm ghost" style={{ marginTop: 8, height: 36 }} onClick={() => onRetry(j)}>
              Try again
            </button>
          </div>
        ))}

        {questions.map((it) => (
          <div key={it.id} className="card tight orange" style={{ flexShrink: 0 }}>
            <p style={{ fontSize: 15, lineHeight: 1.45 }}>
              <strong>{it.name}:</strong> {it.check.question}
            </p>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {it.check.options.map((o) => (
                <button
                  key={o.label}
                  className="btn sm ghost"
                  style={{ height: 40 }}
                  onClick={() =>
                    onUpdate(it.id, {
                      area: o.area || it.area,
                      shelfDays: o.shelfDays === undefined ? it.shelfDays : o.shelfDays,
                      category: o.area && o.area !== it.area ? null : it.category,
                      check: null,
                      addedAt: Date.now(),
                    })
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && failed.length === 0 && <p className="sub">Nothing found yet.</p>}

        {items.length > 0 && (
          <div className="card" style={{ flexShrink: 0 }}>
            <p className="sub">
              {items.length} {items.length === 1 ? 'thing' : 'things'} found. Tap one to move it, or the cross to remove it.
            </p>
            {areas.map((a) => (
              <div key={a} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p className="area-label">{a === 'Equipment' ? 'Kit' : a}</p>
                <ItemGroups items={items.filter((it) => it.area === a)} area={a} onRemove={onRemove} onSelect={(it) => setMoving(it)} />
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="btn ghost" onClick={onMore}>
        Add more
      </button>
      <button className="btn" onClick={onSave} disabled={questions.length > 0 && !loading}>
        {questions.length > 0 ? 'Answer the question above first' : loading ? `${saveLabel}, I’ll keep reading` : saveLabel}
      </button>

      {moving && (
        <div className="overlay">
          <button className="backdrop" aria-label="Close" onClick={() => setMoving(null)} />
          <div className="sheet" role="dialog" aria-label={`Move ${moving.name}`}>
            <div className="row between">
              <p className="h3">Move {moving.name}</p>
              <button className="icon-btn" onClick={() => setMoving(null)} aria-label="Close">
                <Close />
              </button>
            </div>
            <div className="grid3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              {areaChoices.map((a) => (
                <button
                  key={a}
                  className="mode-btn"
                  style={{ height: 48 }}
                  aria-pressed={moving.area === a}
                  onClick={() => {
                    onUpdate(moving.id, { area: a, category: a === moving.area ? moving.category : null, check: null });
                    setMoving(null);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
