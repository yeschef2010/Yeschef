'use client';
import { useEffect, useRef, useState } from 'react';
import { TOUR_STEPS } from '@/lib/helpers';
import { PHOTO_SIDE, fileToSmallJpeg, framesFromVideoFile, grabFrame } from '@/lib/media';
import { createListener, speechSupported } from '@/lib/speech';
import { Back, Camera, Close, Mic, Video } from './Icons';

const MAX_FRAMES = 10;

function lastWords(text, n = 2) {
  const parts = (text || '').split(/(?<=[.!?,])\s+|\s{2,}/).filter(Boolean);
  if (parts.length > 1) return parts.slice(-n);
  const words = (text || '').split(' ');
  return words.length > 14 ? ['…' + words.slice(-14).join(' ')] : text ? [text] : [];
}

export default function Tour({ steps = TOUR_STEPS, onSubmit, onDone, onExit, pending = [], jobs = [], onRemove, onRetry }) {
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState('video');
  const [images, setImages] = useState([]);
  const [note, setNote] = useState('');
  const [interim, setInterim] = useState('');
  const [recording, setRecording] = useState(false);
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState('capture'); // 'capture' | 'review'
  const [reviewJob, setReviewJob] = useState(null);
  const [stepJobs, setStepJobs] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const listenerRef = useRef(null);
  const frameTimer = useRef(null);
  const clockTimer = useRef(null);
  const imagesRef = useRef([]);
  imagesRef.current = images;

  const step = steps[idx];
  const isLast = idx === steps.length - 1;
  const canSpeak = speechSupported();
  const needsCam = phase === 'capture' && (mode === 'video' || mode === 'photo');
  const [flash, setFlash] = useState(false);

  function snap() {
    if (imagesRef.current.length >= MAX_FRAMES) return;
    const f = grabFrame(videoRef.current, PHOTO_SIDE);
    if (!f) return;
    setImages((prev) => [...prev, f].slice(0, MAX_FRAMES));
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }

  // Live camera for video mode.
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
      const list = await Promise.all(Array.from(files).slice(0, MAX_FRAMES).map(fileToSmallJpeg));
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

  // Send this area off to be read, then show what was found before moving on.
  function check() {
    const finalNote = listenerRef.current ? listenerRef.current.stop() || note : note;
    stopRecording();
    const hasSomething = imagesRef.current.length || (finalNote || '').trim();
    const jobId = hasSomething ? onSubmit(step.area, imagesRef.current, finalNote || '') : null;
    setImages([]);
    setNote('');
    setInterim('');
    setMode('video');
    if (jobId) {
      setReviewJob(jobId);
      setStepJobs((j) => [...j, jobId]);
      setPhase('review');
    } else advance();
  }

  function advance() {
    setPhase('capture');
    setReviewJob(null);
    setStepJobs([]);
    if (isLast) {
      stopEverything();
      onDone();
    } else setIdx(idx + 1);
  }

  function back() {
    stopRecording();
    if (phase === 'review') {
      setPhase('capture');
      return;
    }
    setImages([]);
    setNote('');
    setMode('video');
    if (idx === 0) {
      stopEverything();
      onExit();
    } else setIdx(idx - 1);
  }

  function pickMode(m) {
    stopRecording();
    setCamError('');
    setMode(m);
  }

  const heard = [note, interim].filter(Boolean).join(' ');
  const captions = lastWords(heard);
  const badge =
    mode === 'video'
      ? recording
        ? `Recording 0:${String(seconds).padStart(2, '0')}`
        : images.length
        ? `${images.length} shots saved`
        : 'Ready'
      : mode === 'photo'
      ? `${images.length} photo${images.length === 1 ? '' : 's'}`
      : recording
      ? 'Listening…'
      : 'Tap the mic to talk';

  return (
    <div className="screen-fixed">
      <div className="row between">
        <button className="icon-btn" onClick={back} aria-label="Back">
          <Back />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{step.area}</p>
          <p className="small">
            Kitchen tour{steps.length > 1 ? ` · step ${idx + 1} of ${steps.length}` : ''}
          </p>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {steps.length > 1 && (
        <div className="progress" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((s, i) => (
            <div key={s.area} className={i <= idx ? 'on' : ''} />
          ))}
        </div>
      )}

      {phase === 'review' && (
        <Review
          area={step.area}
          job={jobs.find((j) => j.id === reviewJob)}
          items={pending.filter((p) => stepJobs.includes(p.job))}
          onRemove={onRemove}
          onRetry={(job) => {
            const id = onRetry(job);
            setReviewJob(id);
            setStepJobs((j) => [...j, id]);
          }}
          onMore={() => setPhase('capture')}
          onNext={advance}
          nextLabel={isLast ? 'Looks right, finish' : `Looks right, next: ${steps[idx + 1].area.toLowerCase()}`}
          busyLabel={isLast ? 'Finish, I’ll keep reading' : `Next: ${steps[idx + 1].area.toLowerCase()}, I’ll keep reading`}
        />
      )}

      {phase === 'capture' && (
      <>
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
        {mode === 'voice' && <p className="placeholder">Just talk, no camera needed</p>}

        <div className="badge-rec">
          <i />
          {badge}
        </div>

        {mode !== 'voice' && images.length > 0 && mode === 'photo' && (
          <div className="thumbs">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`Photo ${i + 1}`} />
            ))}
          </div>
        )}

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
              style={{ alignSelf: 'center', borderRadius: 30, minWidth: 160, background: recording ? '#fff' : undefined }}
            >
              {recording ? 'Stop' : images.length ? 'Record more' : 'Start recording'}
            </button>
          )}
          {mode === 'photo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
              <label className="btn sm ghost" style={{ display: 'flex', alignItems: 'center', justifySelf: 'start', background: 'rgba(20,27,23,0.75)', borderRadius: 22 }}>
                {busy ? 'Reading…' : 'Upload'}
                <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} />
              </label>
              {!camError && (
                <button
                  onClick={snap}
                  aria-label="Take photo"
                  style={{ width: 72, height: 72, borderRadius: 36, border: '5px solid #fff', background: '#E8833A', padding: 0, flexShrink: 0 }}
                />
              )}
              <span />
            </div>
          )}
          {mode === 'voice' && canSpeak && (
            <button
              className="btn"
              onClick={recording ? stopRecording : () => { setRecording(true); startListening(); }}
              style={{ alignSelf: 'center', borderRadius: 30, minWidth: 160, background: recording ? '#fff' : undefined }}
            >
              {recording ? 'Stop' : heard ? 'Talk some more' : 'Start talking'}
            </button>
          )}
        </div>
      </div>

      {mode === 'photo' || !canSpeak ? (
        <textarea
          className="textarea"
          style={{ minHeight: 56, flexShrink: 0 }}
          placeholder={mode === 'photo' ? 'Optional: anything I should know? e.g. "milk’s nearly gone"' : 'Type what’s here, e.g. "4 onions, half a bag of rice"'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Notes"
        />
      ) : (
        <p className="sub" style={{ textAlign: 'center' }}>
          {step.tip}
        </p>
      )}

      <div className="grid3">
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
      </div>

      <button className="btn" onClick={check}>
        Check my {step.area === 'Equipment' ? 'kit' : step.area.toLowerCase()}
      </button>
      </>
      )}
    </div>
  );
}

function Review({ area, job, items, onRemove, onRetry, onMore, onNext, nextLabel, busyLabel }) {
  const label = area === 'Equipment' ? 'kit' : area.toLowerCase();
  const loading = job && job.state === 'loading';
  const failed = job && job.state === 'error';
  return (
    <>
      <div className="scroll">
        <div className="card" style={{ flexShrink: 0 }}>
          <p className="h3">{loading ? `Reading your ${label}…` : failed ? 'Hmm, not quite' : `Here’s your ${label}`}</p>
          {loading && (
            <div className="row">
              <div className="spinner" />
              <p className="sub">This usually takes a few seconds.</p>
            </div>
          )}
          {failed && (
            <>
              <p className="error">{job.message}</p>
              <button className="btn sm ghost" onClick={() => onRetry(job)}>Try again</button>
            </>
          )}
          {!loading && !failed && (
            <p className="sub">{items.length} {items.length === 1 ? 'thing' : 'things'} found. Tap the cross on anything I got wrong.</p>
          )}
          {loading && items.length > 0 && (
            <p className="sub">Found so far:</p>
          )}
          {items.length > 0 && (
            <div className="grid4">
              {items.map((it) => (
                <div className="tile removable" key={it.id}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <p className="name">{it.name}</p>
                    <p className="qty">{it.qty || it.note || it.status || ''}</p>
                  </div>
                  <button className="x" onClick={() => onRemove(it.id)} aria-label={`Remove ${it.name}`}>
                    <Close size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <button className="btn ghost" onClick={onMore}>Add more to this {area === 'Equipment' ? 'list' : 'area'}</button>
      <button className="btn" onClick={onNext}>{loading ? busyLabel : nextLabel}</button>
    </>
  );
}
