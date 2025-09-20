const rawDPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
export const DPR = rawDPR >= 1.5 ? 2 : 1;

let canvasRef = null;
let ctxRef = null;

function applySettings() {
  if (!ctxRef || !canvasRef) return;
  ctxRef.imageSmoothingEnabled = false;
  if ('mozImageSmoothingEnabled' in ctxRef) {
    ctxRef.mozImageSmoothingEnabled = false;
  }
  if ('webkitImageSmoothingEnabled' in ctxRef) {
    ctxRef.webkitImageSmoothingEnabled = false;
  }
  if ('msImageSmoothingEnabled' in ctxRef) {
    ctxRef.msImageSmoothingEnabled = false;
  }
  ctxRef.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function resolveCanvasSize(targetWidth, targetHeight) {
  if (!canvasRef) {
    return {
      width: typeof targetWidth === 'number' ? targetWidth : 0,
      height: typeof targetHeight === 'number' ? targetHeight : 0
    };
  }

  const width =
    typeof targetWidth === 'number'
      ? targetWidth
      : canvasRef.clientWidth || canvasRef.width / DPR || canvasRef.width || canvasRef.offsetWidth || 300;
  const height =
    typeof targetHeight === 'number'
      ? targetHeight
      : canvasRef.clientHeight || canvasRef.height / DPR || canvasRef.height || canvasRef.offsetHeight || 150;

  return { width, height };
}

export function initCanvas(id = 'game', width, height) {
  const canvas = document.getElementById(id);
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`Canvas with id "${id}" not found.`);
  }
  canvasRef = canvas;
  ctxRef = canvas.getContext('2d');
  if (!ctxRef) {
    throw new Error('Unable to acquire 2D rendering context.');
  }
  resize(width, height);
  return ctxRef;
}

export function getCtx() {
  if (!ctxRef) {
    throw new Error('Canvas has not been initialised.');
  }
  return ctxRef;
}

export function resize(width, height) {
  if (!canvasRef || !ctxRef) {
    return { width: 0, height: 0 };
  }

  const { width: logicalWidth, height: logicalHeight } = resolveCanvasSize(width, height);

  if (typeof width === 'number') {
    canvasRef.style.width = `${logicalWidth}px`;
  }
  if (typeof height === 'number') {
    canvasRef.style.height = `${logicalHeight}px`;
  }

  const deviceWidth = Math.max(1, Math.round(logicalWidth * DPR));
  const deviceHeight = Math.max(1, Math.round(logicalHeight * DPR));

  if (canvasRef.width !== deviceWidth) {
    canvasRef.width = deviceWidth;
  }
  if (canvasRef.height !== deviceHeight) {
    canvasRef.height = deviceHeight;
  }

  applySettings();
  return { width: logicalWidth, height: logicalHeight };
}
