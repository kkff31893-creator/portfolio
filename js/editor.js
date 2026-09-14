const presets = {
  card: {
    html: `<main class="demo-card" id="card">
  <span class="mono">INTERACTION / 01</span>
  <h2>Living surface</h2>
  <p>Двигайте курсор, чтобы изменить наклон. Кнопка переключает состояние.</p>
  <div class="actions">
    <button id="demo-button">Проверить</button>
    <strong id="demo-state" class="mono">ВЫКЛ</strong>
  </div>
</main>`,
    css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0d0d12;
  color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  perspective: 1000px;
}
.demo-card {
  width: min(86%, 390px);
  padding: 34px;
  border-radius: 24px;
  background: #15151e;
  border: 1px solid #2e2e42;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  transition: transform 0.2s ease, border-color 0.3s;
}
.demo-card:hover {
  border-color: #ef3934;
}
.demo-card span {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: #ef3934;
}
.demo-card h2 {
  font-size: 28px;
  margin: 12px 0 8px;
  letter-spacing: -0.04em;
}
.demo-card p {
  color: #9a9ab0;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 24px;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.demo-card button {
  padding: 11px 20px;
  border: 0;
  border-radius: 12px;
  background: #ef3934;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  letter-spacing: 0.05em;
  transition: transform 0.15s, background 0.2s;
}
.demo-card button:hover {
  background: #ff524d;
  transform: translateY(-1px);
}
.demo-card strong {
  font-size: 11px;
  color: #7b7b92;
}`,
    js: `const card = document.querySelector('#card');
const btn = document.querySelector('#demo-button');
const st = document.querySelector('#demo-state');
let active = false;

btn.addEventListener('click', () => {
  active = !active;
  st.textContent = active ? 'ВКЛ' : 'ВЫКЛ';
  st.style.color = active ? '#ef3934' : '#7b7b92';
  btn.textContent = active ? 'Выключить' : 'Проверить';
  card.style.borderColor = active ? '#ef3934' : '#2e2e42';
});

document.addEventListener('mousemove', (e) => {
  const rect = card.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  card.style.transform = \`rotateY(\${x * 18}deg) rotateX(\${-y * 18}deg)\`;
});`
  },

  kinetic: {
    html: `<div class="kinetic-stage">
  <span class="mono">KINETIC EXPERIMENT / 02</span>
  <h1 id="headline">DESIGN<br><span>× CODE</span><br>Tangible.</h1>
  <button id="trigger">Изменить ритм</button>
</div>`,
    css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #111;
  color: #fff;
  font-family: sans-serif;
  overflow: hidden;
}
.kinetic-stage {
  text-align: center;
  padding: 30px;
}
.kinetic-stage span.mono {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: #ef3934;
}
h1 {
  font-size: clamp(34px, 8vw, 68px);
  line-height: 0.9;
  letter-spacing: -0.06em;
  margin: 18px 0 28px;
  text-transform: uppercase;
  transition: letter-spacing 0.4s cubic-bezier(0.2, 1, 0.3, 1);
}
h1 span {
  color: #ef3934;
  -webkit-text-stroke: 1px #ef3934;
}
button {
  background: transparent;
  color: #fff;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 10px 22px;
  font: 11px monospace;
  cursor: pointer;
  transition: all 0.2s;
}
button:hover {
  border-color: #ef3934;
  color: #ef3934;
}`,
    js: `const h1 = document.querySelector('#headline');
const btn = document.querySelector('#trigger');
let expanded = false;

btn.addEventListener('click', () => {
  expanded = !expanded;
  h1.style.letterSpacing = expanded ? '0.12em' : '-0.06em';
  h1.style.transform = expanded ? 'scale(1.04)' : 'scale(1)';
  btn.textContent = expanded ? 'Вернуть' : 'Изменить ритм';
});`
  },

  bars: {
    html: `<div class="eq-box">
  <div class="eq-meta mono">
    <span>CHANNEL // 01</span>
    <span id="meter-hz">128.4 Hz</span>
  </div>
  <div class="eq-grid" id="bars"></div>
  <button id="toggle-eq">Запустить</button>
</div>`,
    css: `body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #0f1016;
  color: #f1f2f8;
  font-family: monospace;
}
.eq-box {
  width: min(84%, 380px);
  padding: 28px;
  border-radius: 24px;
  background: #171822;
  border: 1px solid #292b3a;
}
.eq-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #8a8d9f;
  margin-bottom: 24px;
}
.eq-grid {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 90px;
  margin-bottom: 24px;
  border-bottom: 1px solid #292b3a;
  padding-bottom: 4px;
}
.eq-bar {
  flex: 1;
  background: #ef3934;
  transition: height 0.18s ease;
  min-height: 4px;
}
.eq-bar:nth-child(2n) {
  background: #ff6f6a;
}
button {
  width: 100%;
  padding: 11px;
  border: 0;
  border-radius: 12px;
  background: #ef3934;
  color: #fff;
  font: 11px monospace;
  cursor: pointer;
}`,
    js: `const grid = document.querySelector('#bars');
const hz = document.querySelector('#meter-hz');
const btn = document.querySelector('#toggle-eq');

for (let i = 0; i < 14; i++) {
  const b = document.createElement('div');
  b.className = 'eq-bar';
  b.style.height = (20 + Math.random() * 70) + '%';
  grid.appendChild(b);
}

let timer;
let running = false;
btn.addEventListener('click', () => {
  running = !running;
  btn.textContent = running ? 'Остановить' : 'Запустить';
  if (running) {
    timer = setInterval(() => {
      document.querySelectorAll('.eq-bar').forEach(b => {
        b.style.height = (12 + Math.random() * 84) + '%';
      });
      hz.textContent = (80 + Math.random() * 120).toFixed(1) + ' Hz';
    }, 180);
  } else {
    clearInterval(timer);
  }
});`
  }
};

let currentPreset = 'card';
let files = { ...presets[currentPreset] };
let activeFile = 'css';
let previewTimer;

const input = document.querySelector('#code-input');
const highlight = document.querySelector('#highlight');
const lineNumbers = document.querySelector('#line-numbers');
const preview = document.querySelector('#live-preview');
const stateLabel = document.querySelector('#editor-state');
const statsLabel = document.querySelector('#editor-stats');

function highlightCode(code, lang) {
  let escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (lang === 'css') {
    escaped = escaped
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="token-comment">$1</span>')
      .replace(/([^{]+)(?=\{)/g, '<span class="token-tag">$1</span>')
      .replace(/([\w-]+)(?=\s*:)/g, '<span class="token-keyword">$1</span>')
      .replace(/(:\s*)([^;]+)(;)/g, '$1<span class="token-string">$2</span>$3');
  } else if (lang === 'html') {
    escaped = escaped
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="token-comment">$1</span>')
      .replace(/(&lt;\/?[a-z0-9-]+)/gi, '<span class="token-keyword">$1</span>')
      .replace(/(&gt;)/g, '<span class="token-keyword">&gt;</span>')
      .replace(/(\s[a-z0-9-]+)(=)/gi, '<span class="token-tag">$1</span>=')
      .replace(/("[^"]*")/g, '<span class="token-string">$1</span>');
  } else if (lang === 'js') {
    escaped = escaped
      .replace(/(\/\/.*)/g, '<span class="token-comment">$1</span>')
      .replace(/\b(const|let|var|function|return|if|else|for|document|window)\b/g, '<span class="token-keyword">$1</span>')
      .replace(/(`[\s\S]*?`|"[^"]*"|'[^']*')/g, '<span class="token-string">$1</span>')
      .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
  }
  return escaped;
}

function updateCursorStats() {
  if (!input || !statsLabel) return;
  const selStart = input.selectionStart || 0;
  const lines = input.value.substring(0, selStart).split('\n');
  const lineNum = lines.length;
  const colNum = lines[lines.length - 1].length + 1;
  statsLabel.textContent = `LN ${lineNum}, COL ${colNum}`;
}

function renderPreview() {
  if (!preview) return;
  const safeScript = files.js.replace(/<\/script/gi, '<\\/script');
  preview.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>${files.css}</style></head><body>${files.html}<script>${safeScript}<\/script></body></html>`;
  if (stateLabel) stateLabel.textContent = 'Preview updated';
}

function renderEditor() {
  if (!input) return;
  input.value = files[activeFile];
  if (highlight) {
    highlight.innerHTML = highlightCode(files[activeFile], activeFile);
  }
  if (lineNumbers) {
    lineNumbers.textContent = files[activeFile]
      .split('\n')
      .map((_, index) => index + 1)
      .join('\n');
  }
  const langElem = document.querySelector('#file-language');
  if (langElem) langElem.textContent = activeFile.toUpperCase();
  
  const codePanel = document.querySelector('#code-panel');
  if (codePanel) codePanel.setAttribute('aria-labelledby', `tab-${activeFile}`);
  
  const activeTab = document.querySelector(`[data-file="${activeFile}"]`);
  if (activeTab) {
    input.setAttribute('aria-label', `Редактировать ${activeTab.textContent.trim()}`);
  }
  input.scrollTop = 0;
  input.scrollLeft = 0;
  if (highlight) {
    highlight.scrollTop = 0;
    highlight.scrollLeft = 0;
  }
  updateCursorStats();
}

document.querySelectorAll('[data-file]').forEach((tab) =>
  tab.addEventListener('click', () => {
    activeFile = tab.dataset.file;
    document.querySelectorAll('[data-file]').forEach((item) => {
      const selected = item === tab;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    renderEditor();
  })
);

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(btn.classList.contains('active')));
  btn.addEventListener('click', () => {
    const presetKey = btn.dataset.preset;
    if (!presets[presetKey]) return;
    currentPreset = presetKey;
    files = { ...presets[presetKey] };
    document.querySelectorAll('.preset-btn').forEach(b => {
      const selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    renderEditor();
    renderPreview();
    if (window.showToast) window.showToast(`Loaded preset: ${btn.textContent}`);
  });
});

input?.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + '  ' + input.value.substring(end);
    input.selectionStart = input.selectionEnd = start + 2;
    input.dispatchEvent(new Event('input'));
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    renderPreview();
    if (window.showToast) window.showToast('Preview refreshed ↻');
  }
});

input?.addEventListener('input', () => {
  files[activeFile] = input.value;
  if (highlight) {
    highlight.innerHTML = highlightCode(input.value, activeFile);
  }
  if (lineNumbers) {
    lineNumbers.textContent = input.value
      .split('\n')
      .map((_, index) => index + 1)
      .join('\n');
  }
  if (stateLabel) stateLabel.textContent = 'Editing…';
  updateCursorStats();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 280);
});

input?.addEventListener('click', updateCursorStats);
input?.addEventListener('keyup', updateCursorStats);

input?.addEventListener('scroll', () => {
  if (highlight) {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }
  if (lineNumbers) {
    lineNumbers.scrollTop = input.scrollTop;
  }
});

document.querySelector('#replay-code')?.addEventListener('click', () => {
  files = { ...presets[currentPreset] };
  renderEditor();
  renderPreview();
  if (window.showToast) window.showToast('Code reset to initial state');
});

document.querySelector('#copy-code')?.addEventListener('click', () => {
  const codeToCopy = files[activeFile];
  window.copyText(codeToCopy).then((copied) => {
    if (window.showToast) {
      window.showToast(copied ? `${activeFile.toUpperCase()} copied! 📋` : 'Failed to copy code');
    }
  });
});

renderEditor();
renderPreview();
