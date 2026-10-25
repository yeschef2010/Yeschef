'use client';
import { useEffect, useRef, useState } from 'react';
import { TOUR_STEPS } from '@/lib/helpers';
import { fileToSmallJpeg, framesFromVideoFile, grabFrame } from '@/lib/media';
import { createListener, speechSupported } from '@/lib/speech';
import { Back, Camera, Mic, Video } from './Icons';

const MAX_FRAMES = 10;

function lastWords(text, n = 2) {
  const parts = (text || '').split(/(?<=[.!?,])\s+|\s{2,}/).filter(Boolean);
  if (parts.length > 1) return parts.slice(-n);
  const words = (text || '').split(' ');
  return words.length > 14 ? ['…' + words.slice(-14).join(' ')] : text ? [text] : [];
}

export default function Tour({ steps = TOUR_STEPS, onSubmit, onDone, onExit }) {
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState('video');
  const [images, setImages] = useState([]);
  const [note, setNote] = useState('');
  const [interim, setInterim] = useState('');
  const [recording, setRecording] = useState(false);
  const [camError, setCamError] = useState('');
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  // Live camera for video mode.
  useEffect(() => {
    if (mode !== 'video') return undefined;
    let cancelled = false;
    setCamError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamError('This browser can’t open the camera here. Try Snap instead.');
      return undefined;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
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
  }, [mode, idx]);

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
      setCamError('I couldn’t read one of those photos.');
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

  function next() {
    const finalNote = listenerRef.current ? listenerRef.current.stop() || note : note;
    stopRecording();
    if (imagesRef.current.length || (finalNote || '').trim()) {
      onSubmit(step.area, imagesRef.current, finalNote || '');
    }
    setImages([]);
    setNote('');
    setInterim('');
    setMode('video');
    if (isLast) {
      stopEverything();
      onDone();
    } else setIdx(idx + 1);
  }

  function back() {
    stopRecording();
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

      <div className="camera">
        {mode === 'video' && !camError && <video ref={videoRef} playsInline muted autoPlay />}
        {mode === 'video' && camError && (
          <div className="placeholder" style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <p className="sub">{camError}</p>
            <label className="btn sm ghost" style={{ display: 'flex', alignItems: 'center' }}>
              Choose a video instead
              <input className="sr-only" type="file" accept="video/*" capture="environment" onChange={(e) => addVideoFile(e.target.files[0])} />
            </label>
          </div>
        )}
        {mode === 'photo' && images.length === 0 && <p className="placeholder">{step.scene}</p>}
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
            <label className="btn" style={{ alignSelf: 'center', borderRadius: 30, display: 'flex', alignItems: 'center' }}>
              {busy ? 'Reading…' : images.length ? 'Add more photos' : 'Take or choose photos'}
              <input className="sr-only" type="file" accept="image/*" multiple onChange={(e) => addPhotos(e.target.files)} />
            </label>
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

      <button className="btn" onClick={next}>
        {isLast ? 'Done, check what you found' : `Next: ${steps[idx + 1].area.toLowerCase()}`}
      </button>
    </div>
  );
}
