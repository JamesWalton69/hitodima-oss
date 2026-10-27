// Hitodama · 人魂 (Sakura Edition) Renderer - English UI

// Core DOM Elements
const island = document.getElementById('dynamic-island');
const header = document.getElementById('island-header');
const toggleBtn = document.getElementById('toggle-expand-btn');
const controlCentre = document.getElementById('control-centre');
const statusLabel = document.getElementById('status-label');
const quickMicBtn = document.getElementById('quick-mic-btn');
const closeBtn = document.getElementById('close-app-btn');
const toastEl = document.getElementById('toast');

// Controls Elements
const wifiTile = document.getElementById('wifi-tile');
const wifiSsid = document.getElementById('wifi-ssid');
const wifiSignal = document.getElementById('wifi-signal');
const darkModeTile = document.getElementById('darkmode-tile');
const darkModeStatus = document.getElementById('darkmode-status');
const darkModeIcon = document.getElementById('darkmode-icon');
const muteTile = document.getElementById('mute-tile');
const muteStatus = document.getElementById('mute-status');
const muteIcon = document.getElementById('mute-icon');
const wallpaperTile = document.getElementById('wallpaper-tile');
const volumeSlider = document.getElementById('volume-slider');
const volumeVal = document.getElementById('volume-val');
const volSliderIcon = document.getElementById('vol-slider-icon');

// AI Elements
const aiInput = document.getElementById('ai-input');
const aiSendBtn = document.getElementById('ai-send-btn');
const aiResponseArea = document.getElementById('ai-response-area');
const pasteCursorBtn = document.getElementById('paste-cursor-btn');
const ttsSpeakBtn = document.getElementById('tts-speak-btn');
const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
const aiEndpointInput = document.getElementById('ai-endpoint');
const aiModelInput = document.getElementById('ai-model');
const aiApikeyInput = document.getElementById('ai-apikey');
const personalitySelect = document.getElementById('personality-select');
const personalityVal = document.getElementById('personality-val');

// Stats Elements
const statCpu = document.getElementById('stat-cpu');
const statRam = document.getElementById('stat-ram');
const statAppRam = document.getElementById('stat-app-ram');
const statFreeRam = document.getElementById('stat-free-ram');

// Soul Avatar Elements
const toggleSoulModeBtn = document.getElementById('toggle-soul-mode-btn');
const soulCanvas = document.getElementById('soul-canvas');
const soulImg = document.getElementById('soul-img');
const soulTrigger = document.getElementById('soul-avatar-trigger');

// Tasks Elements
const todoList = document.getElementById('todo-list');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const todoCount = document.getElementById('todo-count');

// State
let isExpanded = false;
let isDarkMode = false;
let isMuted = false;
let currentVolume = 70;
let lastAiResponse = '';
let isListening = false;
let soulMode = 'canvas'; // 'canvas' or 'image'
let flameState = 'idle'; // 'idle', 'thinking', 'listening', 'speaking'
let currentPersonality = localStorage.getItem('hitodama_personality') || 'sweet';
let currentWallpaper = localStorage.getItem('hitodama_current_wp') || 'wallpaper-sakura.png';

// 1. Mouse Hit-Testing & Click-Through
island.addEventListener('mouseenter', () => {
  window.hitodama?.setIgnoreMouseEvents(false);
});

island.addEventListener('mouseleave', () => {
  if (!isExpanded) {
    window.hitodama?.setIgnoreMouseEvents(true, { forward: true });
  }
});

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2400);
}

// 2. Expand / Collapse Island
function setExpanded(expanded) {
  isExpanded = expanded;
  if (isExpanded) {
    island.classList.add('expanded');
    controlCentre.classList.remove('hidden');
    statusLabel.textContent = 'Control Centre';
    window.hitodama?.setIgnoreMouseEvents(false);
    refreshSystemData();
  } else {
    island.classList.remove('expanded');
    controlCentre.classList.add('hidden');
    statusLabel.textContent = 'Awake · Sakura · Ctrl+Space';
    window.hitodama?.setIgnoreMouseEvents(true, { forward: true });
  }
}

header.addEventListener('click', (e) => {
  if (e.target.closest('#toggle-expand-btn') || e.target.closest('#quick-mic-btn') || e.target.closest('#soul-avatar-trigger')) {
    return;
  }
  setExpanded(!isExpanded);
});

toggleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setExpanded(!isExpanded);
});

// Scroll gestures (Scroll down on island to expand, scroll up to collapse)
island.addEventListener('wheel', (e) => {
  if (e.deltaY > 15 && !isExpanded) {
    setExpanded(true);
  } else if (e.deltaY < -15 && isExpanded && controlCentre.scrollTop === 0) {
    setExpanded(false);
  }
});

// 3. Tab Switching
const tabs = document.querySelectorAll('.cc-tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    panels.forEach((p) => p.classList.remove('active'));

    tab.classList.add('active');
    const target = tab.getAttribute('data-tab');
    const panel = document.getElementById(`tab-${target}`);
    if (panel) panel.classList.add('active');
  });
});

// 4. Native Windows Controls Integration
async function refreshSystemData() {
  if (!window.hitodama) return;

  // Real Volume
  try {
    const vol = await window.hitodama.getVolume();
    if (typeof vol === 'number') {
      currentVolume = vol;
      volumeSlider.value = vol;
      volumeVal.textContent = `${vol}%`;
      updateVolIcon(vol);
    }
  } catch (e) {
    console.warn('Volume sync error:', e);
  }

  // Real Mute
  try {
    isMuted = await window.hitodama.getMuted();
    updateMuteUI();
  } catch (e) {
    console.warn('Mute sync error:', e);
  }

  // Real Dark Mode
  try {
    isDarkMode = await window.hitodama.getDarkMode();
    updateDarkModeUI();
  } catch (e) {
    console.warn('Dark mode sync error:', e);
  }

  // Real Wi-Fi
  try {
    const wifi = await window.hitodama.getWifiInfo();
    if (wifi) {
      wifiSsid.textContent = wifi.ssid;
      wifiSignal.textContent = wifi.connected ? wifi.signal : 'Disconnected';
      if (wifi.connected) {
        wifiTile.classList.add('active');
      } else {
        wifiTile.classList.remove('active');
      }
    }
  } catch (e) {
    console.warn('Wi-Fi sync error:', e);
  }

  // Real Hardware Stats
  try {
    const stats = await window.hitodama.getHardwareStats();
    if (stats) {
      statCpu.textContent = stats.cpuPct;
      statRam.textContent = stats.ramPct;
      statAppRam.textContent = stats.appRam;
      statFreeRam.textContent = stats.freeRam;
    }
  } catch (e) {
    console.warn('Stats sync error:', e);
  }
}

function updateVolIcon(vol) {
  if (vol === 0 || isMuted) {
    volSliderIcon.textContent = '🔇';
  } else if (vol < 40) {
    volSliderIcon.textContent = '🔈';
  } else if (vol < 75) {
    volSliderIcon.textContent = '🔉';
  } else {
    volSliderIcon.textContent = '🔊';
  }
}

function updateMuteUI() {
  if (isMuted) {
    muteTile.classList.add('active');
    muteStatus.textContent = 'Muted';
    muteIcon.textContent = '🔇';
  } else {
    muteTile.classList.remove('active');
    muteStatus.textContent = 'Active';
    muteIcon.textContent = '🔊';
  }
  updateVolIcon(currentVolume);
}

function updateDarkModeUI() {
  if (isDarkMode) {
    darkModeTile.classList.add('active');
    darkModeStatus.textContent = 'Dark';
    darkModeIcon.textContent = '🌙';
  } else {
    darkModeTile.classList.remove('active');
    darkModeStatus.textContent = 'Light';
    darkModeIcon.textContent = '☀️';
  }
}

// Master Volume Event
volumeSlider.addEventListener('input', async (e) => {
  const val = parseInt(e.target.value, 10);
  volumeVal.textContent = `${val}%`;
  currentVolume = val;
  updateVolIcon(val);
  if (window.hitodama) {
    await window.hitodama.setVolume(val);
  }
});

// Mute Tile Click
muteTile.addEventListener('click', async () => {
  if (window.hitodama) {
    isMuted = await window.hitodama.toggleMute();
    updateMuteUI();
  }
});

// Dark Mode Tile Click
darkModeTile.addEventListener('click', async () => {
  if (window.hitodama) {
    darkModeStatus.textContent = 'Switching...';
    const targetState = !isDarkMode;
    await window.hitodama.toggleDarkMode(targetState);
    isDarkMode = targetState;
    updateDarkModeUI();
    showToast(`Windows Theme: ${targetState ? 'Dark' : 'Light'}`);
  }
});

// Wi-Fi Tile Click
wifiTile.addEventListener('click', () => {
  window.hitodama?.openUrl('ms-settings:network-wifi');
});

// 5. Wallpaper Gallery & Setting
async function applyWallpaper(fileName) {
  if (window.hitodama) {
    showToast('🌸 Applying desktop wallpaper...');
    const ok = await window.hitodama.setWallpaper(fileName);
    if (ok) {
      currentWallpaper = fileName;
      localStorage.setItem('hitodama_current_wp', fileName);
      updateWallpaperCardsUI();
      showToast('✨ Wallpaper applied to desktop!');
    } else {
      showToast('Failed to set wallpaper');
    }
  }
}

function updateWallpaperCardsUI() {
  document.querySelectorAll('.wp-card').forEach((card) => {
    const file = card.getAttribute('data-wp');
    const isCurrent = file === currentWallpaper;
    const btn = card.querySelector('.wp-apply-btn');
    if (isCurrent) {
      card.classList.add('active-wp');
      if (btn) btn.textContent = 'Applied ✓';
    } else {
      card.classList.remove('active-wp');
      if (btn) {
        btn.textContent = file === 'wallpaper-lofi.png' ? 'Set Wallpaper 🌙' : 'Set Wallpaper 🌸';
      }
    }
  });
}

// Quick wallpaper button in Controls
wallpaperTile.addEventListener('click', () => {
  applyWallpaper('wallpaper-sakura.png');
});

// Wallpaper Card buttons in Wallpapers Tab
document.querySelectorAll('.wp-apply-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const file = btn.getAttribute('data-file');
    applyWallpaper(file);
  });
});

updateWallpaperCardsUI();

// 6. Soul Avatar Mode Toggle
function toggleSoulMode() {
  if (soulMode === 'canvas') {
    soulMode = 'image';
    soulCanvas.classList.add('hidden');
    soulImg.classList.remove('hidden');
    toggleSoulModeBtn.textContent = 'Switch to Shader';
    showToast('Switched to Arena AI Soul Avatar');
  } else {
    soulMode = 'canvas';
    soulCanvas.classList.remove('hidden');
    soulImg.classList.add('hidden');
    toggleSoulModeBtn.textContent = 'Switch Avatar';
    showToast('Switched to Sakura Living Flame');
  }
}
soulTrigger.addEventListener('click', toggleSoulMode);
toggleSoulModeBtn.addEventListener('click', toggleSoulMode);

// Personality Switcher
personalitySelect.value = currentPersonality;
personalitySelect.addEventListener('change', (e) => {
  currentPersonality = e.target.value;
  localStorage.setItem('hitodama_personality', currentPersonality);
  const labels = {
    sweet: 'Sweet Sakura 🌸',
    tsundere: 'Tsundere 🎀',
    chad: 'True Chad 🗿',
    zen: 'Quiet Zen 🍵'
  };
  personalityVal.textContent = labels[currentPersonality] || 'Sweet Sakura 🌸';
  showToast(`Personality set to ${labels[currentPersonality]}`);
});

// 7. AI Chat & Voice Integration
aiEndpointInput.value = localStorage.getItem('hitodama_ai_endpoint') || 'http://localhost:11434/v1';
aiModelInput.value = localStorage.getItem('hitodama_ai_model') || 'llama3.2';
aiApikeyInput.value = localStorage.getItem('hitodama_ai_apikey') || '';

[aiEndpointInput, aiModelInput, aiApikeyInput].forEach((el) => {
  el.addEventListener('change', () => {
    localStorage.setItem('hitodama_ai_endpoint', aiEndpointInput.value.trim());
    localStorage.setItem('hitodama_ai_model', aiModelInput.value.trim());
    localStorage.setItem('hitodama_ai_apikey', aiApikeyInput.value.trim());
    showToast('AI settings saved');
  });
});

function getSystemPersonalityPrompt() {
  switch (currentPersonality) {
    case 'tsundere':
      return 'You are Hitodama (人魂), a cute Japanese tsundere spirit assistant. Be slightly prickly at first but helpful, ultra-concise (1-2 sentences), and cute.';
    case 'chad':
      return 'You are Hitodama (人魂), an ultra-confident, direct, stoic productivity assistant. Keep answers concise, direct, and powerful.';
    case 'zen':
      return 'You are Hitodama (人魂), a mindful, calm Japanese spirit companion. Keep responses brief, tranquil, and clear.';
    default:
      return 'You are Hitodama (人魂), a sweet and adorable Japanese spirit companion. Keep responses warm, helpful, cute, and under 2 sentences with soft kaomoji.';
  }
}

async function askHitodama(promptText) {
  const query = promptText || aiInput.value.trim();
  if (!query) return;

  flameState = 'thinking';
  statusLabel.textContent = 'Thinking...';
  aiResponseArea.innerHTML = '<p class="placeholder-msg">Hitodama is thinking... 🌸</p>';

  const config = {
    baseURL: aiEndpointInput.value.trim(),
    model: aiModelInput.value.trim(),
    apiKey: aiApikeyInput.value.trim()
  };

  const payload = {
    prompt: `${getSystemPersonalityPrompt()}\nUser: ${query}`,
    config
  };

  const res = await window.hitodama?.aiCompletion(payload);

  if (res && res.success) {
    lastAiResponse = res.text;
    aiResponseArea.textContent = res.text;
    flameState = 'speaking';
    statusLabel.textContent = 'Response ready 🌸';
    // Read aloud response
    speakAloud(res.text);
  } else {
    const errorMsg = res?.error || 'AI response error';
    lastAiResponse = `[Error]: ${errorMsg}`;
    aiResponseArea.innerHTML = `<span style="color: #ff99aa;">${errorMsg}</span>`;
    flameState = 'idle';
    statusLabel.textContent = 'Awake · Sakura · Ctrl+Space';
  }
  aiInput.value = '';
}

aiSendBtn.addEventListener('click', () => askHitodama());
aiInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') askHitodama();
});

// Paste at cursor in active external window
pasteCursorBtn.addEventListener('click', async () => {
  if (!lastAiResponse) return;
  setExpanded(false);
  await window.hitodama?.pasteTextAtCursor(lastAiResponse);
  showToast('Pasted at cursor!');
});

// TTS Speech
function speakAloud(text) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.2; // Sweet, cute pitch
  utterance.onstart = () => {
    flameState = 'speaking';
    statusLabel.textContent = 'Hitodama speaking... 🌸';
  };
  utterance.onend = () => {
    flameState = 'idle';
    statusLabel.textContent = 'Awake · Sakura · Ctrl+Space';
  };
  window.speechSynthesis.speak(utterance);
}

ttsSpeakBtn.addEventListener('click', () => {
  if (lastAiResponse) speakAloud(lastAiResponse);
});

copyClipboardBtn.addEventListener('click', () => {
  if (!lastAiResponse) return;
  navigator.clipboard.writeText(lastAiResponse);
  showToast('Copied to clipboard 📋');
});

// 8. Voice Dictation (Ctrl+Space or Quick Mic)
function startVoiceDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      flameState = 'listening';
      statusLabel.textContent = 'Listening... Speak now 🌸';
      quickMicBtn.style.color = '#ff70a6';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      aiInput.value = transcript;
    };

    recognition.onend = () => {
      isListening = false;
      flameState = 'idle';
      statusLabel.textContent = 'Awake · Sakura · Ctrl+Space';
      quickMicBtn.style.color = '';
      if (aiInput.value.trim()) {
        if (!isExpanded) setExpanded(true);
        askHitodama(aiInput.value.trim());
      }
    };

    recognition.onerror = () => {
      isListening = false;
      flameState = 'idle';
      statusLabel.textContent = 'Speech error';
      quickMicBtn.style.color = '';
    };

    recognition.start();
  } else {
    setExpanded(true);
    aiInput.focus();
    showToast('Type a query or configure speech engine 🌸');
  }
}

quickMicBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  startVoiceDictation();
});

window.hitodama?.onDictationHotkey(() => {
  if (!isExpanded) {
    setExpanded(true);
    startVoiceDictation();
  } else {
    setExpanded(false);
  }
});

// 9. Interactive Tasks
let tasks = JSON.parse(localStorage.getItem('hitodama_tasks_en') || '[]');
if (tasks.length === 0) {
  tasks = [
    { text: '🌸 Explore the Sakura Pink theme', done: true },
    { text: '🖼️ Apply your favorite wallpaper to desktop', done: true },
    { text: '🎙️ Hold Ctrl + Space for voice dictation', done: false }
  ];
}

function renderTasks() {
  todoList.innerHTML = '';
  let completedCount = 0;

  tasks.forEach((task, idx) => {
    if (task.done) completedCount++;

    const item = document.createElement('div');
    item.className = `todo-item ${task.done ? 'done' : ''}`;

    const left = document.createElement('div');
    left.className = 'todo-left';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = task.done;
    chk.addEventListener('change', () => {
      task.done = chk.checked;
      saveTasks();
    });

    const label = document.createElement('span');
    label.textContent = task.text;

    left.appendChild(chk);
    left.appendChild(label);

    const delBtn = document.createElement('button');
    delBtn.className = 'todo-delete-btn';
    delBtn.textContent = '×';
    delBtn.title = 'Delete task';
    delBtn.addEventListener('click', () => {
      tasks.splice(idx, 1);
      saveTasks();
    });

    item.appendChild(left);
    item.appendChild(delBtn);
    todoList.appendChild(item);
  });

  todoCount.textContent = `🌸 ${completedCount}/${tasks.length}`;
}

function saveTasks() {
  localStorage.setItem('hitodama_tasks_en', JSON.stringify(tasks));
  renderTasks();
}

addTaskBtn.addEventListener('click', () => {
  const val = newTaskInput.value.trim();
  if (val) {
    tasks.push({ text: val, done: false });
    newTaskInput.value = '';
    saveTasks();
  }
});

newTaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addTaskBtn.click();
  }
});

// Exit
closeBtn.addEventListener('click', () => {
  window.hitodama?.closeApp();
});

// 10. Sakura Hitodama Living Flame & Orbiting Petals Canvas Shader
const ctx = soulCanvas.getContext('2d');
let frame = 0;

const petals = Array.from({ length: 5 }, () => ({
  x: Math.random() * 36,
  y: Math.random() * 36,
  size: 1.5 + Math.random() * 1.5,
  speed: 0.3 + Math.random() * 0.4,
  angle: Math.random() * Math.PI * 2,
  rot: Math.random() * Math.PI
}));

function renderSakuraSoul() {
  frame += 0.045;
  const w = soulCanvas.width;
  const h = soulCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Dynamic Palette according to state
  let cCore = '#ffffff';
  let cInner = 'rgba(255, 182, 218, 0.9)';
  let cOuter = 'rgba(255, 105, 180, 0.55)';
  let cAura = 'rgba(255, 60, 140, 0)';

  if (flameState === 'thinking') {
    // Mystical Sakura Lavender
    cInner = 'rgba(255, 160, 240, 0.95)';
    cOuter = 'rgba(200, 80, 255, 0.6)';
    cAura = 'rgba(150, 40, 220, 0)';
  } else if (flameState === 'listening') {
    // Warm Coral Blossom
    cInner = 'rgba(255, 175, 140, 0.95)';
    cOuter = 'rgba(255, 90, 80, 0.6)';
    cAura = 'rgba(255, 50, 40, 0)';
  } else if (flameState === 'speaking') {
    // Radiant Sakura Bloom
    cInner = 'rgba(255, 205, 230, 0.95)';
    cOuter = 'rgba(255, 80, 160, 0.65)';
    cAura = 'rgba(255, 30, 120, 0)';
  }

  // 1. Outer Sakura Spirit Glow
  const pulse = Math.sin(frame * 2.2) * 1.8;
  const outerGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15 + pulse);
  outerGrad.addColorStop(0, cInner);
  outerGrad.addColorStop(0.5, cOuter);
  outerGrad.addColorStop(1, cAura);

  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 16 + pulse, 0, Math.PI * 2);
  ctx.fill();

  // 2. Swirling Hitodama Flame Tendrils
  const numTendrils = flameState === 'thinking' ? 4 : 3;
  for (let i = 0; i < numTendrils; i++) {
    const angle = frame * 2.4 + i * (Math.PI * 2 / numTendrils);
    const dist = 3.6 + Math.sin(frame * 3.2 + i) * 2;
    const tx = cx + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist * 0.75;

    const tendrilGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 5);
    tendrilGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    tendrilGrad.addColorStop(0.5, cInner);
    tendrilGrad.addColorStop(1, cAura);

    ctx.fillStyle = tendrilGrad;
    ctx.beginPath();
    ctx.arc(tx, ty, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Floating Orbiting Sakura Petals
  petals.forEach((p, idx) => {
    p.angle += 0.035;
    p.rot += 0.02;
    const orbitRadius = 10 + Math.sin(frame + idx) * 3;
    const px = cx + Math.cos(p.angle) * orbitRadius;
    const py = cy + Math.sin(p.angle) * (orbitRadius * 0.8);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(p.rot);
    ctx.fillStyle = 'rgba(255, 192, 220, 0.75)';
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 4. White-Hot Radiant Core
  const corePulse = Math.cos(frame * 3) * 0.6;
  ctx.fillStyle = cCore;
  ctx.shadowColor = '#ffb3d9';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 4 + corePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  requestAnimationFrame(renderSakuraSoul);
}

// Initialization
renderSakuraSoul();
renderTasks();
refreshSystemData();

// Live stats refresh loop
setInterval(() => {
  if (isExpanded) {
    refreshSystemData();
  }
}, 2500);
