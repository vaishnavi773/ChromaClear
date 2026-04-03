/* ─── ChromaClear main.js — Studio ───────────────────────────────────────── */
'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const uploadArea        = document.getElementById('uploadArea');
const uploadContent     = document.getElementById('uploadContent');
const fileInput         = document.getElementById('fileInput');
const processBtn        = document.getElementById('processBtn');
const enhanceCheck      = document.getElementById('enhanceCheck');
const adjCheck          = document.getElementById('adjCheck');
const adjPanel          = document.getElementById('adjPanel');
const adjResetBtn       = document.getElementById('adjResetBtn');
const previewWrap       = document.getElementById('previewWrap');
const originalImg       = document.getElementById('originalImg');
const resultImg         = document.getElementById('resultImg');
const processingOverlay = document.getElementById('processingOverlay');
const overlayText       = document.getElementById('overlayText');
const compareWrap       = document.getElementById('compareWrap');
const compareContainer  = document.getElementById('compareContainer');
const compareHandle     = document.getElementById('compareHandle');
const cmpOriginal       = document.getElementById('cmpOriginal');
const cmpResult         = document.getElementById('cmpResult');
const cmpPct            = document.getElementById('cmpPct');
const downloadBtn       = document.getElementById('downloadBtn');
const resetBtn          = document.getElementById('resetBtn');
const resultMeta        = document.getElementById('resultMeta');
const pillDot           = document.getElementById('pillDot');
const pillText          = document.getElementById('pillText');
const origInfo          = document.getElementById('origInfo');
const resultInfoBadge   = document.getElementById('resultInfo');
const progressWrap      = document.getElementById('progressWrap');
const progressFill      = document.getElementById('progressFill');
const progSteps = {
  upload:   document.getElementById('progUpload'),
  colorize: document.getElementById('progColorize'),
  enhance:  document.getElementById('progEnhance'),
  finalize: document.getElementById('progFinalize'),
};
const shortcutsHint   = document.getElementById('shortcutsHint');
const shortcutsToast  = document.getElementById('shortcutsToast');

const adjBrightness = document.getElementById('adjBrightness');
const adjContrast   = document.getElementById('adjContrast');
const adjSaturation = document.getElementById('adjSaturation');
const adjWarmth     = document.getElementById('adjWarmth');
const adjSharpness  = document.getElementById('adjSharpness');
const adjVignette   = document.getElementById('adjVignette');

// ── State ─────────────────────────────────────────────────────────────────────
let currentMode      = 'colorize';
let currentScale     = 1;
let selectedFile     = null;
let originalDataUrl  = null;
let resultDataUrl    = null;
let shortcutsVisible = false;
let sliderPct        = 50;
let isDragging       = false;

// ── Model status ───────────────────────────────────────────────────────────────
async function checkModel() {
  try {
    const r = await fetch('/api/model-status');
    const d = await r.json();
    pillDot.className    = `pill-dot ${d.available ? 'online' : 'offline'}`;
    pillText.textContent = d.available ? 'Neural model ready' : 'Algorithmic mode';
  } catch {
    pillText.textContent = 'Server offline';
    pillDot.className    = 'pill-dot offline';
  }
}
checkModel();

// ── Scroll reveal ─────────────────────────────────────────────────────────────
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.08 });

// ── Mode buttons ──────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    document.getElementById('enhanceToggle').style.opacity = currentMode !== 'enhance'  ? '1' : '0.5';
    document.querySelector('.opt-scale').style.opacity     = currentMode !== 'colorize' ? '1' : '0.5';
  });
});

// ── Scale buttons ─────────────────────────────────────────────────────────────
document.querySelectorAll('.scale-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentScale = parseInt(btn.dataset.scale);
  });
});

// ── Live Adjustments ──────────────────────────────────────────────────────────
adjCheck.addEventListener('change', () => adjPanel.classList.toggle('visible', adjCheck.checked));

function applyAdjustments() {
  if (!resultDataUrl) return;
  const brightness = parseFloat(adjBrightness.value) / 100;
  const contrast   = parseFloat(adjContrast.value)   / 100;
  const saturation = parseFloat(adjSaturation.value) / 100;
  const warmth     = parseFloat(adjWarmth.value);
  const sharpness  = parseFloat(adjSharpness.value);
  const sharpContrast = contrast + (sharpness * 0.04);

  let filter = `brightness(${brightness}) contrast(${sharpContrast}) saturate(${saturation})`;
  if (warmth > 0) filter += ` sepia(${warmth * 0.4}%)`;
  if (warmth < 0) filter += ` hue-rotate(${Math.abs(warmth) * 0.6}deg)`;

  resultImg.style.filter = filter;
  cmpResult.style.filter = filter;

  const vigPct = parseFloat(adjVignette.value);
  const rWrap  = resultImg.closest('.panel-img-wrap');
  if (rWrap) rWrap.style.boxShadow = vigPct > 0 ? `inset 0 0 ${vigPct * 1.5}px ${vigPct * 0.8}px rgba(0,0,0,.8)` : '';

  document.getElementById('brightnessVal').textContent = adjBrightness.value + '%';
  document.getElementById('contrastVal').textContent   = adjContrast.value   + '%';
  document.getElementById('saturationVal').textContent = adjSaturation.value + '%';
  document.getElementById('warmthVal').textContent     = (warmth >= 0 ? '+' : '') + warmth;
  document.getElementById('sharpnessVal').textContent  = sharpness + 'px';
  document.getElementById('vignetteVal').textContent   = adjVignette.value   + '%';
}

[adjBrightness, adjContrast, adjSaturation, adjWarmth, adjSharpness, adjVignette]
  .forEach(el => el.addEventListener('input', applyAdjustments));

adjResetBtn.addEventListener('click', () => {
  adjBrightness.value = adjContrast.value = adjSaturation.value = 100;
  adjWarmth.value = adjSharpness.value = adjVignette.value = 0;
  resultImg.style.filter = '';
  cmpResult.style.filter = '';
  const rw = resultImg.closest('.panel-img-wrap');
  if (rw) rw.style.boxShadow = '';
  applyAdjustments();
  showToast('Adjustments reset', 'success');
});

// ── Progress ──────────────────────────────────────────────────────────────────
function setProgress(pct) { progressFill.style.width = pct + '%'; }
function setStep(key, state) {
  const el = progSteps[key]; if (!el) return;
  el.classList.remove('active', 'done');
  if (state) el.classList.add(state);
}
function resetProgress() { Object.keys(progSteps).forEach(k => setStep(k, null)); setProgress(0); }

async function runProgress(mode) {
  const steps = ['upload'];
  if (mode === 'colorize' || mode === 'both') steps.push('colorize');
  if (mode === 'enhance'  || mode === 'both') steps.push('enhance');
  steps.push('finalize');
  const labels = { upload:'Uploading', colorize:'Colorizing', enhance:'Enhancing', finalize:'Finalizing' };

  resetProgress();
  progressWrap.classList.add('visible');
  const inc = 90 / steps.length; let cur = 0;

  for (const step of steps) {
    setStep(step, 'active');
    overlayText.textContent = (labels[step] || step) + '…';
    await sleep(200 + Math.random() * 300);
    setProgress(cur += inc);
    setStep(step, 'done');
  }
}

function finishProgress() {
  setProgress(100);
  ['upload','colorize','enhance','finalize'].forEach(k => setStep(k, 'done'));
  setTimeout(() => { progressWrap.classList.remove('visible'); resetProgress(); }, 1200);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Placeholder ───────────────────────────────────────────────────────────────
function showResultPlaceholder(show) {
  const el = document.getElementById('resultPlaceholder');
  if (!el) return;
  el.style.display        = show ? 'flex'  : 'none';
  resultImg.style.display = show ? 'none'  : 'block';
}

// ── Drag & Drop ────────────────────────────────────────────────────────────────
uploadArea.addEventListener('dragover',  e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
});
uploadArea.addEventListener('click', e => {
  if (e.target.classList.contains('btn-upload')) return;
  if (e.target !== uploadArea && uploadContent.contains(e.target)) return;
  fileInput.click();
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFileSelect(fileInput.files[0]); });

// ── Paste ─────────────────────────────────────────────────────────────────────
document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) { handleFileSelect(f); break; } }
  }
});

// ── File Select ───────────────────────────────────────────────────────────────
function handleFileSelect(file) {
  const allowed = ['image/png','image/jpeg','image/webp','image/bmp','image/tiff'];
  if (!allowed.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|bmp|tif{1,2})$/i)) {
    showToast('Please upload a valid image file.', 'error'); return;
  }
  if (file.size > 16 * 1024 * 1024) { showToast('File too large (max 16 MB).', 'error'); return; }

  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ev => {
    originalDataUrl = ev.target.result;
    originalImg.src = originalDataUrl;

    const tmp = new Image();
    tmp.onload = () => { origInfo.textContent = `${tmp.width}×${tmp.height}`; };
    tmp.src = originalDataUrl;

    previewWrap.style.display = 'grid';
    compareWrap.style.display = 'none';
    resultImg.src = '';
    resultImg.style.filter = '';
    processingOverlay.classList.remove('active');
    showResultPlaceholder(true);
    processBtn.disabled = false;
    uploadArea.classList.add('has-file');
    showToast('Image ready — click Process!', 'success');
    previewWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  reader.readAsDataURL(file);
}

// ── Process ────────────────────────────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  processBtn.disabled = true;
  processingOverlay.classList.add('active');
  resultImg.src = '';
  resultImg.style.filter = '';
  compareWrap.style.display = 'none';

  const fd = new FormData();
  fd.append('image',   selectedFile);
  fd.append('mode',    currentMode);
  fd.append('enhance', enhanceCheck.checked ? 'true' : 'false');
  fd.append('scale',   currentScale);

  const progressPromise = runProgress(currentMode);
  const start = Date.now();

  try {
    const r = await fetch('/api/process', { method: 'POST', body: fd });
    const d = await r.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    await progressPromise;
    finishProgress();

    if (!d.success) throw new Error(d.error || 'Processing failed');

    resultDataUrl = d.result;
    resultImg.src = d.result;
    showResultPlaceholder(false);
    processingOverlay.classList.remove('active');
    applyAdjustments();

    const rimg = new Image();
    rimg.onload = () => { resultInfoBadge.textContent = `${rimg.width}×${rimg.height}`; };
    rimg.src = d.result;

    cmpOriginal.src = d.original;
    cmpResult.src   = d.result;
    compareWrap.style.display = 'block';
    downloadBtn.href = d.result;

    resultMeta.innerHTML = `<strong style="color:var(--text)">${d.steps.join(' → ')}</strong><br>Engine: ${d.model_used} &nbsp;·&nbsp; Time: ${elapsed}s`;

    showToast('Processing complete! 🎨', 'success');
    setTimeout(() => compareWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);

  } catch (err) {
    processingOverlay.classList.remove('active');
    progressWrap.classList.remove('visible');
    showResultPlaceholder(true);
    showToast(err.message || 'Something went wrong.', 'error');
  } finally {
    processBtn.disabled = false;
  }
});

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', resetAll);

function resetAll() {
  selectedFile = originalDataUrl = resultDataUrl = null;
  fileInput.value = '';
  previewWrap.style.display = 'none';
  compareWrap.style.display = 'none';
  progressWrap.classList.remove('visible');
  processBtn.disabled = true;
  uploadArea.classList.remove('has-file');
  showResultPlaceholder(false);

  adjBrightness.value = adjContrast.value = adjSaturation.value = 100;
  adjWarmth.value = adjSharpness.value = adjVignette.value = 0;
  resultImg.style.filter = '';
  cmpResult.style.filter = '';
  const rw = resultImg.closest('.panel-img-wrap');
  if (rw) rw.style.boxShadow = '';
  document.getElementById('brightnessVal').textContent = '100%';
  document.getElementById('contrastVal').textContent   = '100%';
  document.getElementById('saturationVal').textContent = '100%';
  document.getElementById('warmthVal').textContent     = '+0';
  document.getElementById('sharpnessVal').textContent  = '0px';
  document.getElementById('vignetteVal').textContent   = '0%';

  uploadArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Compare Slider ─────────────────────────────────────────────────────────────
function setSliderPosition(pct) {
  pct = Math.max(2, Math.min(98, pct));
  sliderPct = pct;
  cmpResult.style.clipPath      = `inset(0 0 0 ${pct}%)`;
  compareHandle.style.left      = pct + '%';
  compareHandle.style.transform = 'translateX(-50%)';
  cmpPct.textContent = Math.round(pct) + '%';
}

compareContainer.addEventListener('mousedown', e => { isDragging = true; updateSlider(e); });
document.addEventListener('mouseup',   () => { isDragging = false; });
document.addEventListener('mousemove', e => { if (isDragging) updateSlider(e); });

compareContainer.addEventListener('touchstart', e => { isDragging = true; updateSlider(e.touches[0]); }, { passive: true });
document.addEventListener('touchend',  () => { isDragging = false; });
document.addEventListener('touchmove', e => { if (isDragging) updateSlider(e.touches[0]); }, { passive: true });

function updateSlider(e) {
  const rect = compareContainer.getBoundingClientRect();
  setSliderPosition(((e.clientX - rect.left) / rect.width) * 100);
}

const compareObserver = new MutationObserver(() => {
  if (compareWrap.style.display !== 'none') requestAnimationFrame(() => setSliderPosition(50));
});
compareObserver.observe(compareWrap, { attributes: true, attributeFilter: ['style'] });

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  switch (e.key) {
    case 'Enter':      if (!processBtn.disabled) processBtn.click(); break;
    case 'Escape':     if (selectedFile) resetAll(); if (shortcutsVisible) toggleShortcuts(false); break;
    case 'ArrowLeft':  setSliderPosition(sliderPct - 5); break;
    case 'ArrowRight': setSliderPosition(sliderPct + 5); break;
    case '?':          toggleShortcuts(!shortcutsVisible); break;
  }
});

function toggleShortcuts(show) {
  shortcutsVisible = show;
  shortcutsToast.classList.toggle('show', show);
  if (show) setTimeout(() => toggleShortcuts(false), 5000);
}
shortcutsHint.addEventListener('click', () => toggleShortcuts(!shortcutsVisible));

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
const toast = document.getElementById('toast');
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}