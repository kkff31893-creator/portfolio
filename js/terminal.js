const terminalOutput = document.querySelector('#terminal-output');
const terminalForm = document.querySelector('#terminal-form');
const terminalInput = document.querySelector('#terminal-input');

const commandHistory = [];
let historyIndex = -1;

const commandList = [
  'help', 'about', 'skills', 'projects', 'visuals', 
  'telegram', 'contact', 'theme', 'matrix', 'clear', 
  'whoami', 'date', 'sudo', 'sound', 'resume'
];

const commands = {
  help: `AVAILABLE COMMANDS:
about     — Identity & creative focus
skills    — Competencies & tech matrix
projects  — Selected experiments
visuals   — Generated visual studies
telegram  — Open direct chat with @doting_w
contact   — Contact options (TG & email)
theme     — Toggle theme (light / dark)
matrix    — Run digital cascade cascade
sound     — Toggle procedural sound SFX
whoami    — Query visitor session
date      — Current local time (UTC+5)
clear     — Clear terminal display`,

  about: `DMITRY KAMENSKIKH
Design Engineer & Creative Developer.
Specialization: High-end web interfaces, kinetic typography, 3D WebGL, and scalable design systems.
Telegram: @doting_w`,

  skills: `CORE COMPETENCIES:
[01] FRONTEND ARCHITECTURE : TypeScript, Vue 3, React, Next.js, WebSockets
[02] MOTION & CREATIVE     : WebGL, Three.js, GLSL, Canvas 2D, GSAP
[03] UI / UX SYSTEMS       : Design Tokens, Figma API, Component Libs
[04] PERFORMANCE & POLISH  : 60+ FPS, Zero-jank, A11y & Semantics`,

  projects: `SELECTED EXPERIMENTS:
01 / Quiet Control     — Sensory UI Workspace with LED meters
02 / Catch the Signal  — Reaction radar benchmark
03 / Generative System — Vector wave field generator`,

  visuals: `VISUAL LAB:
01 / FOLD  — Black chrome and red glass ribbon
02 / BLOOM — Mechanical light sculpture
03 / CORE  — Modular responsive form
Scroll through the page to see the floating object transform.`,

  telegram: `TELEGRAM CHANNEL OPENED:
User: @doting_w
URL:  https://t.me/doting_w
Opening conversation link in a new tab...`,

  contact: `DIRECT CONTACTS:
Telegram : @doting_w  (https://t.me/doting_w)
Email    : dmitry@kamenskikh.dev
Status   : Available for freelance & select full-time (Q3–Q4 2026)`,

  whoami: `SESSION INFO:
Host   : dk-workstation.local
User   : guest.developer
Access : Granted (Read / Interact / Fork)`,

  sudo: `sudo: authorization bypass denied. You are already empowered to explore everything.`,

  resume: `RESUME / CV HIGHLIGHTS:
6+ years crafting high-performance digital experiences.
FWA of the Day, Awwwards Nominee design benchmarks.
Full CV PDF available on request: @doting_w`
};

function print(text, className = '') {
  if (!terminalOutput) return;
  const line = document.createElement('div');
  line.className = `terminal-line ${className}`;
  line.textContent = text;
  terminalOutput.append(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

let matrixInterval = null;
function runMatrix() {
  if (matrixInterval) clearInterval(matrixInterval);
  print('INITIALIZING MATRIX RAIN CASCADE...', 'command');
  const chars = '01アイウエオカキクケコサシスセソタチツテト0123456789<>/+*#$%&';
  let counter = 0;
  matrixInterval = setInterval(() => {
    let str = '';
    for (let i = 0; i < 48; i++) {
      str += chars[Math.floor(Math.random() * chars.length)];
    }
    print(str, 'terminal-matrix');
    counter++;
    if (counter > 28) {
      clearInterval(matrixInterval);
      matrixInterval = null;
      print('CASCADE COMPLETE. RESTORING SYSTEM PROMPT.', 'welcome');
    }
  }, 70);
}

function run(command) {
  const raw = command.trim();
  const value = raw.toLowerCase();
  if (!value) return;

  commandHistory.push(raw);
  historyIndex = commandHistory.length;

  print(`visitor@dk › ${raw}`, 'command');

  if (value === 'clear') {
    terminalOutput.replaceChildren();
    return;
  }

  if (value === 'matrix') {
    runMatrix();
    return;
  }

  if (value === 'telegram' || value === 'tg') {
    print(commands.telegram);
    window.open('https://t.me/doting_w', '_blank');
    return;
  }

  if (value === 'date') {
    const now = new Date();
    print(`SYSTEM TIME: ${now.toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' })} (UTC+5 Perm/Yekaterinburg)`);
    return;
  }

  if (value.startsWith('theme')) {
    const parts = value.split(' ');
    let targetTheme = '';
    if (parts[1] === 'light' || parts[1] === 'dark') {
      targetTheme = parts[1];
    } else {
      targetTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    }
    if (window.applyTheme) window.applyTheme(targetTheme);
    localStorage.setItem('portfolio-theme', targetTheme);
    print(`THEME SWITCHED TO [${targetTheme.toUpperCase()} MODE]`);
    return;
  }

  if (value === 'sound' || value === 'sfx') {
    if (window.soundEngine) {
      const state = window.soundEngine.toggle();
      print(`PROCEDURAL SOUND ENGINE: ${state ? '[MUTED / OFF]' : '[ENABLED / ON]'}`);
    }
    return;
  }

  if (commands[value]) {
    print(commands[value]);
  } else {
    print(`Unknown command: "${raw}". Type "help" to view directory.`);
  }
}

terminalForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!terminalInput) return;
  run(terminalInput.value);
  terminalInput.value = '';
});

// Arrow key navigation for history & Tab autocomplete
terminalInput?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (commandHistory.length > 0 && historyIndex > 0) {
      historyIndex--;
      terminalInput.value = commandHistory[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      terminalInput.value = commandHistory[historyIndex];
    } else {
      historyIndex = commandHistory.length;
      terminalInput.value = '';
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const current = terminalInput.value.trim().toLowerCase();
    if (current) {
      const match = commandList.find(c => c.startsWith(current));
      if (match) {
        terminalInput.value = match;
      }
    }
  } else if (window.soundEngine && e.key.length === 1) {
    window.soundEngine.playKey();
  }
});

document.querySelectorAll('[data-command]').forEach((button) =>
  button.addEventListener('click', () => {
    run(button.dataset.command);
    terminalInput?.focus();
  })
);

print('Портфолио Дмитрия\nВведите help или выберите команду ниже.\nTelegram: @doting_w', 'welcome');
