'use client';

export function speechSupported() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Live speech-to-text using the phone's own recogniser.
// onUpdate receives { finalText, interim } every time something new is heard.
export function createListener(onUpdate) {
  const Rec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!Rec) return null;

  let rec = null;
  let active = false;
  let finalText = '';

  const make = () => {
    rec = new Rec();
    rec.lang = 'en-GB';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const r = ev.results[i];
        if (r.isFinal) finalText = (finalText + ' ' + r[0].transcript).trim();
        else interim += r[0].transcript;
      }
      onUpdate({ finalText, interim: interim.trim() });
    };
    // Phones stop listening after a pause; keep going until the user taps stop.
    rec.onend = () => {
      if (active) {
        try {
          rec.start();
        } catch (e) {
          // ignore
        }
      }
    };
    rec.onerror = () => {};
  };

  return {
    start(existing = '') {
      finalText = existing;
      active = true;
      make();
      try {
        rec.start();
      } catch (e) {
        // ignore
      }
    },
    stop() {
      active = false;
      try {
        rec && rec.stop();
      } catch (e) {
        // ignore
      }
      return finalText;
    },
    get text() {
      return finalText;
    },
  };
}
