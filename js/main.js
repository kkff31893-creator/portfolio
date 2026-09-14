// Toast Notification System
window.showToast = function (msg) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
};

window.copyText = async function (text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {}

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  return copied;
};

// Loader & Robot Head Tracking (Preserved completely)
const loaderValue = document.querySelector('#loader-value');
const loaderBar = document.querySelector('.loader-line i');
const loaderStartedAt = performance.now();
const robotStage = document.querySelector('#robot-stage');
const robotVideo = document.querySelector('#robot-video');
let loaderProgress = 0;
const loaderTicker = setInterval(() => {
  loaderProgress = Math.min(Math.round((performance.now() - loaderStartedAt) / 8), 92);
  if (loaderValue) loaderValue.textContent = String(loaderProgress).padStart(2, '0');
  if (loaderBar) loaderBar.style.transform = `scaleX(${loaderProgress / 100})`;
}, 70);

const pageReady = new Promise((resolve) => {
  if (document.readyState === 'complete') resolve();
  else addEventListener('load', resolve, { once: true });
});
const mediaReady = !robotVideo || robotVideo.readyState >= 2
  ? Promise.resolve()
  : new Promise((resolve) => robotVideo.addEventListener('loadeddata', resolve, { once: true }));
let loaderFinished = false;
function finishLoader() {
  if (loaderFinished) return;
  loaderFinished = true;
  clearInterval(loaderTicker);
  if (loaderValue) loaderValue.textContent = '100';
  if (loaderBar) loaderBar.style.transform = 'scaleX(1)';
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
}
Promise.all([pageReady, mediaReady, new Promise((resolve) => setTimeout(resolve, 720))])
  .then(() => {
    robotStage?.classList.add('is-ready');
    finishLoader();
  });
setTimeout(finishLoader, 3500);

const robotTiming = {
  center: 0.08,
  right: { start: 0.85, end: 1.85 },
  left: { start: 5.15, end: 6.85 },
};
let robotTarget = 0;
let robotCurrent = 0;
let robotFrame = 0;

function setRobotTime(time) {
  if (!robotVideo || robotVideo.readyState < 1 || Math.abs(robotVideo.currentTime - time) < 0.018) return;
  robotVideo.currentTime = Math.min(time, Math.max(0, robotVideo.duration - 0.02));
}

function renderRobot() {
  robotFrame = 0;
  robotCurrent += (robotTarget - robotCurrent) * 0.12;
  if (Math.abs(robotTarget - robotCurrent) < 0.001) robotCurrent = robotTarget;

  const direction = robotCurrent >= 0 ? 'right' : 'left';
  const amount = Math.abs(robotCurrent);
  const timing = robotTiming[direction];
  setRobotTime(amount < 0.01
    ? robotTiming.center
    : timing.start + (timing.end - timing.start) * amount);

  if (robotCurrent !== robotTarget) robotFrame = requestAnimationFrame(renderRobot);
}

function aimRobot(value) {
  robotTarget = Math.max(-1, Math.min(1, value));
  if (!robotFrame) robotFrame = requestAnimationFrame(renderRobot);
}

robotVideo?.pause();
const resetRobotFrame = () => setRobotTime(robotTiming.center);
if (robotVideo?.readyState >= 1) resetRobotFrame();
else robotVideo?.addEventListener('loadedmetadata', resetRobotFrame, { once: true });

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const hero = document.querySelector('.hero');
  const trackPointer = (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = hero?.getBoundingClientRect();
    if (!bounds || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      aimRobot(0);
      return;
    }
    const raw = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const amount = Math.abs(raw) < 0.07 ? 0 : (Math.abs(raw) - 0.07) / 0.93;
    aimRobot(Math.sign(raw) * amount);
  };
  document.addEventListener('pointermove', trackPointer, { passive: true });
  addEventListener('blur', () => aimRobot(0));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) aimRobot(0);
  });
}

// Theme System & Progress bar
const progress = document.querySelector('.scroll-progress');
const themeToggle = document.querySelector('#theme-toggle');
const themeLabel = themeToggle?.querySelector('.theme-label');
const themeColor = document.querySelector('meta[name="theme-color"]');

window.applyTheme = function (theme) {
  const isLight = theme === 'light';
  document.documentElement.dataset.theme = theme;
  themeToggle?.setAttribute('aria-pressed', String(isLight));
  themeToggle?.setAttribute(
    'aria-label',
    isLight ? 'Включить тёмную тему' : 'Включить светлую тему'
  );
  if (themeLabel) themeLabel.textContent = isLight ? 'Dark' : 'Light';
  if (themeColor) themeColor.content = isLight ? '#F4F1EA' : '#101010';
  if (window.drawPattern) window.drawPattern();
};

window.applyTheme(document.documentElement.dataset.theme || 'dark');
themeToggle?.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  window.applyTheme(nextTheme);
  localStorage.setItem('portfolio-theme', nextTheme);
  if (window.showToast) window.showToast(`Switched to ${nextTheme.toUpperCase()} theme`);
});

// Hotkey 'L' for theme, 'T' for terminal
document.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (e.key === 'l' || e.key === 'L') {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    window.applyTheme(next);
    localStorage.setItem('portfolio-theme', next);
  } else if (e.key === 't' || e.key === 'T') {
    document.querySelector('#console')?.scrollIntoView({ behavior: 'smooth' });
    document.querySelector('#terminal-input')?.focus();
  }
});

function updateProgress() {
  const range = document.documentElement.scrollHeight - innerHeight;
  if (progress) progress.style.transform = `scaleX(${range > 0 ? scrollY / range : 0})`;
}
addEventListener('scroll', updateProgress, { passive: true });
addEventListener('resize', updateProgress);
updateProgress();

// Scroll-reactive 3D signature object
const scrollArtifact = document.querySelector('#scroll-artifact');
let artifactFrame = 0;

function updateScrollArtifact() {
  artifactFrame = 0;
  if (!scrollArtifact) return;
  const range = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const pageProgress = Math.max(0, Math.min(1, scrollY / range));
  const enter = Math.max(0, Math.min(1, (scrollY - innerHeight * 0.42) / (innerHeight * 0.72)));
  const exit = pageProgress > 0.92 ? Math.max(0, 1 - (pageProgress - 0.92) / 0.08) : 1;
  const pulse = Math.sin(pageProgress * Math.PI * 6);
  const cornerA = 42 + pulse * 12;
  const cornerB = 100 - cornerA;

  scrollArtifact.style.setProperty('--artifact-opacity', String(enter * exit * 0.76));
  scrollArtifact.style.setProperty('--artifact-shift', `${Math.sin(pageProgress * Math.PI * 5) * 38}px`);
  scrollArtifact.style.setProperty('--artifact-rot-x', `${18 + pageProgress * 260}deg`);
  scrollArtifact.style.setProperty('--artifact-rot-y', `${pageProgress * 920}deg`);
  scrollArtifact.style.setProperty('--artifact-scale', String(0.8 + (pulse + 1) * 0.08));
  scrollArtifact.style.setProperty(
    '--artifact-radius',
    `${cornerA}% ${cornerB}% ${48 - pulse * 9}% ${52 + pulse * 9}% / ${54 + pulse * 8}% ${46 - pulse * 8}% ${cornerB}% ${cornerA}%`
  );
}

function scheduleArtifactUpdate() {
  if (!artifactFrame) artifactFrame = requestAnimationFrame(updateScrollArtifact);
}

if (scrollArtifact && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  addEventListener('scroll', scheduleArtifactUpdate, { passive: true });
  addEventListener('resize', scheduleArtifactUpdate);
  updateScrollArtifact();
}

// Project 01: Quiet Control (Interactive Dashboard & Pomodoro Timer)
const modes = {
  focus: {
    text: 'One thing. Full attention.',
    index: 'MODE / 01',
    bars: [34, 52, 75, 42, 88, 64, 92, 55, 70, 46, 82, 61],
  },
  explore: {
    text: 'Follow the useful surprise.',
    index: 'MODE / 02',
    bars: [72, 44, 91, 62, 38, 79, 54, 86, 43, 68, 95, 57],
  },
  rest: {
    text: 'Less input. More perspective.',
    index: 'MODE / 03',
    bars: [25, 30, 22, 36, 28, 34, 20, 32, 26, 38, 24, 29],
  },
};

const modeButtons = document.querySelectorAll('[data-mode]');
const chartBars = document.querySelectorAll('#activity-chart i');
const barTooltip = document.querySelector('#bar-tooltip');

modeButtons.forEach((button) =>
  button.addEventListener('click', () => {
    const mode = modes[button.dataset.mode];
    modeButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    const desc = document.querySelector('#mode-description');
    if (desc) desc.textContent = mode.text;
    const idx = document.querySelector('#mode-index');
    if (idx) idx.textContent = mode.index;
    chartBars.forEach((bar, index) => {
      bar.style.height = `${mode.bars[index]}%`;
      bar.dataset.val = `${mode.bars[index]}%`;
      bar.dataset.hour = `${(8 + index)}:00`;
    });
  })
);
modeButtons[0]?.click();

// Tooltip on chart bars
chartBars.forEach((bar) => {
  bar.addEventListener('mouseenter', (e) => {
    if (!barTooltip) return;
    barTooltip.textContent = `${bar.dataset.hour || '12:00'} • ${bar.dataset.val || '60%'}`;
    barTooltip.style.opacity = '1';
  });
  bar.addEventListener('mouseleave', () => {
    if (barTooltip) barTooltip.style.opacity = '0';
  });
});

// App Window Sidebar Screen Switcher
const appSidebarTabs = document.querySelectorAll('.app-sidebar-item');
const appScreens = document.querySelectorAll('.app-screen');
appSidebarTabs.forEach((tab) => {
  tab.setAttribute('aria-pressed', String(tab.classList.contains('sidebar-active')));
  tab.addEventListener('click', () => {
    const screenKey = tab.dataset.screen;
    appSidebarTabs.forEach(t => {
      const selected = t === tab;
      t.classList.toggle('sidebar-active', selected);
      t.setAttribute('aria-pressed', String(selected));
    });
    appScreens.forEach(s => s.classList.toggle('active', s.dataset.screen === screenKey));
  });
});

// Focus Pomodoro Timer inside Project 01
let pomodoroSeconds = 25 * 60;
let pomodoroTimer = null;
let pomodoroRunning = false;
const timerBtn = document.querySelector('#focus-timer-btn');
const timerDisplay = document.querySelector('#focus-timer-display');
timerBtn?.setAttribute('aria-pressed', 'false');

timerBtn?.addEventListener('click', () => {
  pomodoroRunning = !pomodoroRunning;
  timerBtn.setAttribute('aria-pressed', String(pomodoroRunning));
  timerBtn.textContent = pomodoroRunning ? 'ПАУЗА' : 'ФОКУС';
  if (pomodoroRunning) {
    pomodoroTimer = setInterval(() => {
      pomodoroSeconds--;
      const m = String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0');
      const s = String(pomodoroSeconds % 60).padStart(2, '0');
      if (timerDisplay) timerDisplay.textContent = `${m}:${s}`;
      if (pomodoroSeconds <= 0) {
        clearInterval(pomodoroTimer);
        pomodoroRunning = false;
        timerBtn.textContent = 'СБРОСИТЬ';
        if (window.soundEngine) window.soundEngine.playGameOver();
        if (window.showToast) window.showToast('Фокус-сессия завершена');
      }
    }, 1000);
  } else {
    clearInterval(pomodoroTimer);
  }
});

// Project 02: Catch the Signal (Enhanced Reaction Benchmark)
const game = document.querySelector('#game-field');
const gameIntro = document.querySelector('#game-intro');
const gameTarget = document.querySelector('#game-target');
const gameScore = document.querySelector('#game-score');
const gameBest = document.querySelector('#game-best');
const gameTime = document.querySelector('#game-time');
const gameAvg = document.querySelector('#game-avg');
const gameResult = document.querySelector('#game-result');

let score = 0;
let bestScore = parseInt(localStorage.getItem('dk-signal-best') || '0', 10);
if (gameBest) gameBest.textContent = String(bestScore).padStart(2, '0');

let gameTimer = null;
let targetSpawnTime = 0;
let reactionTimes = [];

function moveTarget() {
  const margin = 32;
  const maxX = Math.max(margin, game.clientWidth - gameTarget.offsetWidth - margin);
  const maxY = Math.max(margin, game.clientHeight - gameTarget.offsetHeight - margin);
  gameTarget.style.left = `${margin + Math.random() * (maxX - margin)}px`;
  gameTarget.style.top = `${margin + Math.random() * (maxY - margin)}px`;
  targetSpawnTime = performance.now();
  if (window.soundEngine) window.soundEngine.playSignalSpawn();
}

function finishGame() {
  clearInterval(gameTimer);
  game.classList.remove('is-playing');
  gameTarget.hidden = true;
  gameIntro.hidden = false;

  const avgReaction = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('dk-signal-best', String(bestScore));
    if (gameBest) gameBest.textContent = String(bestScore).padStart(2, '0');
  }

  let rank = 'C';
  if (score >= 22) rank = 'S+';
  else if (score >= 17) rank = 'A';
  else if (score >= 12) rank = 'B';

  gameResult.innerHTML = `РЕЗУЛЬТАТ: <strong>${score}</strong> • СРЕДНЯЯ РЕАКЦИЯ: <strong>${avgReaction} мс</strong> • ОЦЕНКА: <strong>${rank}</strong>`;
  if (window.soundEngine) window.soundEngine.playGameOver();
}

document.querySelector('#game-start')?.addEventListener('click', () => {
  clearInterval(gameTimer);
  score = 0;
  reactionTimes = [];
  let seconds = 20;
  gameScore.textContent = '00';
  gameTime.textContent = seconds;
  if (gameAvg) gameAvg.textContent = '000';
  gameResult.textContent = '';
  gameIntro.hidden = true;
  gameTarget.hidden = false;
  game.classList.add('is-playing');
  moveTarget();

  gameTimer = setInterval(() => {
    seconds -= 1;
    gameTime.textContent = String(seconds).padStart(2, '0');
    if (seconds <= 0) finishGame();
  }, 1000);
});

gameTarget?.addEventListener('click', (e) => {
  const reaction = Math.round(performance.now() - targetSpawnTime);
  reactionTimes.push(reaction);
  score += 1;
  gameScore.textContent = String(score).padStart(2, '0');

  const currentAvg = Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length);
  if (gameAvg) gameAvg.textContent = String(currentAvg).padStart(3, '0');

  // Spawn visual ripple dot
  const ripple = document.createElement('div');
  ripple.className = 'game-ripple';
  ripple.style.left = `${e.clientX - game.getBoundingClientRect().left}px`;
  ripple.style.top = `${e.clientY - game.getBoundingClientRect().top}px`;
  game.appendChild(ripple);
  setTimeout(() => ripple.remove(), 400);

  if (window.soundEngine) window.soundEngine.playHit();
  moveTarget();
});

// Project 03: Generative System (Interactive Waves, Constellation, Flow Field & Export)
const canvas = document.querySelector('#pattern-canvas');
const density = document.querySelector('#pattern-density');
const seedLabel = document.querySelector('#pattern-seed');
let seed = 1;
let currentAlgorithm = 'waves';
let isCanvasPlaying = false;
let canvasAnimationId = null;
let animPhase = 0;
let mousePos = { x: -9999, y: -9999, active: false };

function random(index) {
  const value = Math.sin(seed * 91.7 + index * 47.13) * 43758.5453;
  return value - Math.floor(value);
}

// Track mouse over canvas for physics deflection
canvas?.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mousePos.x = e.clientX - rect.left;
  mousePos.y = e.clientY - rect.top;
  mousePos.active = true;
  if (!isCanvasPlaying) drawPattern();
});

canvas?.addEventListener('pointerleave', () => {
  mousePos.active = false;
  if (!isCanvasPlaying) drawPattern();
});

window.drawPattern = function () {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.clearRect(0, 0, rect.width, rect.height);

  const styles = getComputedStyle(document.documentElement);
  const accentColor = styles.getPropertyValue('--accent').trim() || '#ef3934';
  const textColor = styles.getPropertyValue('--text').trim() || '#ffffff';
  const count = Number(density?.value || 24);

  if (currentAlgorithm === 'waves') {
    context.strokeStyle = accentColor;
    context.lineWidth = 1.4;
    context.shadowColor = accentColor;
    context.shadowBlur = 8;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * rect.width) / count;
      let shift = (random(i) - 0.5) * 60;
      if (isCanvasPlaying) {
        shift += Math.sin(animPhase + i * 0.4) * 22;
      }
      // Deflect lines away from mouse
      let mouseDeflect = 0;
      if (mousePos.active) {
        const dx = x - mousePos.x;
        const dy = rect.height * 0.5 - mousePos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140) {
          mouseDeflect = (1 - dist / 140) * (dx > 0 ? 36 : -36);
        }
      }

      context.beginPath();
      context.moveTo(x, 16);
      context.bezierCurveTo(
        x + shift + mouseDeflect,
        rect.height * 0.32,
        x - shift - mouseDeflect * 0.5,
        rect.height * 0.68,
        x + shift * 0.3,
        rect.height - 16
      );
      context.stroke();

      if (random(i + 100) > 0.7) {
        context.shadowBlur = 0;
        context.fillStyle = textColor;
        context.fillRect(x - 2, 20 + random(i + 200) * (rect.height - 44), 4, 4);
        context.shadowColor = accentColor;
        context.shadowBlur = 8;
      }
    }
    context.shadowBlur = 0;
  } else if (currentAlgorithm === 'constellation') {
    const points = [];
    const ptCount = Math.round(count * 1.5);
    for (let i = 0; i < ptCount; i++) {
      let px = random(i * 3) * rect.width;
      let py = random(i * 3 + 1) * (rect.height - 30) + 15;
      if (isCanvasPlaying) {
        px = (px + Math.sin(animPhase + i) * 12 + rect.width) % rect.width;
        py = (py + Math.cos(animPhase + i) * 8 + rect.height) % rect.height;
      }
      points.push({ x: px, y: py });
    }
    context.strokeStyle = accentColor;
    context.lineWidth = 0.9;
    context.shadowColor = accentColor;
    context.shadowBlur = 6;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (d < 85) {
          context.globalAlpha = (1 - d / 85) * 0.85;
          context.beginPath();
          context.moveTo(points[i].x, points[i].y);
          context.lineTo(points[j].x, points[j].y);
          context.stroke();
        }
      }
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      context.fillStyle = textColor;
      context.beginPath();
      context.arc(points[i].x, points[i].y, 2.5, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = accentColor;
      context.shadowBlur = 6;
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  } else if (currentAlgorithm === 'flow') {
    context.strokeStyle = accentColor;
    context.lineWidth = 1.2;
    context.shadowColor = accentColor;
    context.shadowBlur = 5;
    const cols = count;
    const rows = Math.round(count * 0.6);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cx = (c + 0.5) * (rect.width / cols);
        const cy = (r + 0.5) * (rect.height / rows);
        const angle = random(c * rows + r) * Math.PI * 2 + animPhase;
        const len = 12;
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        context.stroke();
      }
    }
    context.shadowBlur = 0;
  }
};

density?.addEventListener('input', drawPattern);

document.querySelector('#regenerate-pattern')?.addEventListener('click', () => {
  seed = 1 + Math.floor(Math.random() * 999);
  if (seedLabel) seedLabel.textContent = String(seed).padStart(3, '0');
  drawPattern();
});

// Mode switch buttons for Generative algorithm
document.querySelectorAll('.pattern-mode-btn').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
  btn.addEventListener('click', () => {
    currentAlgorithm = btn.dataset.alg;
    document.querySelectorAll('.pattern-mode-btn').forEach(b => {
      const selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    drawPattern();
  });
});

// Play / Pause animation toggle
const playBtn = document.querySelector('#toggle-pattern-play');
playBtn?.setAttribute('aria-pressed', 'false');
playBtn?.addEventListener('click', () => {
  isCanvasPlaying = !isCanvasPlaying;
  playBtn.setAttribute('aria-pressed', String(isCanvasPlaying));
  playBtn.textContent = isCanvasPlaying ? 'Пауза' : 'Авто';
  if (isCanvasPlaying) {
    const loop = () => {
      animPhase += 0.04;
      drawPattern();
      if (isCanvasPlaying) canvasAnimationId = requestAnimationFrame(loop);
    };
    loop();
  } else {
    cancelAnimationFrame(canvasAnimationId);
  }
});

// Export Canvas as PNG
document.querySelector('#export-pattern')?.addEventListener('click', () => {
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `DK-GENERATIVE-SEED-${String(seed).padStart(3, '0')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  if (window.showToast) window.showToast('PNG сохранён');
});

new ResizeObserver(drawPattern).observe(canvas);

// Local UTC+5 Perm/Yekaterinburg Clock (Ticking)
function updateClock() {
  const clockElem = document.querySelector('#live-utc-clock');
  if (clockElem) {
    const now = new Date();
    clockElem.textContent = now.toLocaleTimeString('ru-RU', { timeZone: 'Asia/Yekaterinburg' });
  }
}
setInterval(updateClock, 1000);
updateClock();

// Copy Email Button
document.querySelector('#copy-email-btn')?.addEventListener('click', () => {
  const email = 'dmitry@kamenskikh.dev';
  window.copyText(email).then((copied) => {
    if (window.showToast) window.showToast(copied ? `Email copied: ${email}` : 'Не удалось скопировать email');
  });
});

// Interactive Telegram Inquiry Builder
document.querySelectorAll('.inquiry-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    chip.setAttribute('aria-pressed', String(chip.classList.contains('selected')));
    const selected = Array.from(document.querySelectorAll('.inquiry-chip.selected')).map(c => c.textContent.trim());
    const tgLink = document.querySelector('#custom-tg-btn');
    if (tgLink) {
      if (selected.length > 0) {
        const text = encodeURIComponent(`Привет, Дмитрий! Интересует проект: ${selected.join(', ')}`);
        tgLink.href = `https://t.me/doting_w?text=${text}`;
      } else {
        tgLink.href = 'https://t.me/doting_w';
      }
    }
  });
});

// 3D Cyber ID Pass Tilt & Holographic Coordinate Tracking
const cyberCard = document.querySelector('#cyber-id-card');
if (cyberCard && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  cyberCard.addEventListener('pointermove', (e) => {
    const rect = cyberCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -9;
    const rotY = ((x - cx) / cx) * 9;
    cyberCard.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
    cyberCard.style.setProperty('--card-mx', `${((x / rect.width) * 100).toFixed(1)}%`);
    cyberCard.style.setProperty('--card-my', `${((y / rect.height) * 100).toFixed(1)}%`);
  });
  cyberCard.addEventListener('pointerleave', () => {
    cyberCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });
}

// Visual Cards 3D Subtle Tilt
document.querySelectorAll('.visual-card').forEach((card) => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -4;
    const rotY = ((x - cx) / cx) * 4;
    card.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
  });
});

// Scrollspy for Header Navigation
const sections = document.querySelectorAll('section[id], article[id]');
const navLinks = document.querySelectorAll('.header nav a, .mobile-dock a');
const headerEl = document.querySelector('.header');
function updateScrollspy() {
  let currentSection = '';
  sections.forEach((sec) => {
    const top = sec.offsetTop - 140;
    if (scrollY >= top) {
      currentSection = sec.getAttribute('id');
    }
  });
  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      const targetId = href.slice(1);
      link.classList.toggle('active-nav', targetId === currentSection);
    }
  });
  if (headerEl) {
    headerEl.classList.toggle('is-scrolled', window.scrollY > 40);
  }
}
addEventListener('scroll', updateScrollspy, { passive: true });
updateScrollspy();

