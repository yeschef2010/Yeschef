'use client';

// Photos are sent bigger than video stills so small print, like spice jar labels, stays readable.
const PHOTO_SIDE = 1400;
const FRAME_SIDE = 1024;
const QUALITY = 0.75;

function drawScaled(source, w, h, maxSide = FRAME_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', QUALITY);
}

// Turn a photo the user picked into a small JPEG we can send to the AI.
export function fileToSmallJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(drawScaled(img, img.naturalWidth, img.naturalHeight, PHOTO_SIDE));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = async () => {
      URL.revokeObjectURL(url);
      // Some browsers can still decode it this way.
      try {
        const bmp = await createImageBitmap(file);
        resolve(drawScaled(bmp, bmp.width, bmp.height, PHOTO_SIDE));
      } catch (e) {
        reject(new Error('Could not read that photo'));
      }
    };
    img.src = url;
  });
}

// Grab a still from the live camera.
export function grabFrame(video) {
  if (!video || !video.videoWidth) return null;
  return drawScaled(video, video.videoWidth, video.videoHeight);
}

// Pull a handful of stills out of a video file the user picked.
export function framesFromVideoFile(file, count = 6) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    const frames = [];
    let times = [];
    let i = 0;
    const cleanup = () => URL.revokeObjectURL(url);
    video.onloadedmetadata = () => {
      const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
      times = Array.from({ length: count }, (_, k) => (dur * (k + 0.5)) / count);
      video.currentTime = times[0];
    };
    video.onseeked = () => {
      const f = grabFrame(video);
      if (f) frames.push(f);
      i += 1;
      if (i < times.length) video.currentTime = times[i];
      else {
        cleanup();
        resolve(frames);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read that video'));
    };
  });
}
