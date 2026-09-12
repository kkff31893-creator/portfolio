const root = document.documentElement;
const toggle = document.querySelector('#theme-toggle');
const themeIcon = document.querySelector('#theme-icon');
const themeLabel = document.querySelector('#theme-label');
const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
let storedTheme = null;
try { storedTheme = localStorage.getItem('doting-theme'); } catch {}

function setTheme(dark) {
  root.dataset.theme = dark ? 'dark' : 'light';
  toggle.setAttribute('aria-pressed', String(dark));
  toggle.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
  themeIcon.textContent = dark ? '☀' : '☾';
  themeLabel.textContent = dark ? 'LIGHT' : 'DARK';
}

setTheme(storedTheme ? storedTheme === 'dark' : prefersDark);
toggle.addEventListener('click', () => {
  const dark = root.dataset.theme !== 'dark';
  setTheme(dark);
  try { localStorage.setItem('doting-theme', dark ? 'dark' : 'light'); } catch {}
});

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.querySelector('#hero-stage');
stage.addEventListener('pointermove', (event) => {
  if (reduceMotion) return;
  const rect = stage.getBoundingClientRect();
  stage.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  stage.style.setProperty('--my', `${event.clientY - rect.top}px`);
});

document.querySelectorAll('[data-drag]').forEach((chip) => {
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;

  chip.addEventListener('pointerdown', (event) => {
    if (reduceMotion) return;
    chip.setPointerCapture(event.pointerId);
    startX = event.clientX - offsetX;
    startY = event.clientY - offsetY;
  });

  chip.addEventListener('pointermove', (event) => {
    if (!chip.hasPointerCapture(event.pointerId)) return;
    const bounds = stage.getBoundingClientRect();
    const current = chip.getBoundingClientRect();
    offsetX = Math.max(bounds.left - current.left + offsetX, Math.min(event.clientX - startX, bounds.right - current.right + offsetX));
    offsetY = Math.max(bounds.top - current.top + offsetY, Math.min(event.clientY - startY, bounds.bottom - current.bottom + offsetY));
    chip.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  });

  chip.addEventListener('pointerup', (event) => chip.releasePointerCapture(event.pointerId));
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
