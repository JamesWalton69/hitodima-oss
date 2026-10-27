# 🌸 Hitodama · 人魂 (Sakura Edition)
> **A soul for your Windows · 魂の宿るデスクトップ**  
> An open-source, local-first ambient AI desktop companion for Windows with universal model support, custom voice dictation, system automation, and integrated Arena AI asset generation.

Inspired by [Hitodama](https://hitodama.in), reimagined with complete freedom to use **any local or cloud AI model** (Ollama, LM Studio, Groq, OpenRouter, Gemini), modular voice TTS/STT, and a cute pink Japanese aesthetic.

---

## ✨ Features

- **🌸 Living Sakura Hitodama Soul**: Real-time canvas procedural flame shader with dynamic emotional states (Idle, Thinking, Listening, Speaking) and orbiting sakura blossom petals.
- **🏝️ Dynamic Island & Control Centre**: Seamless floating top bezel docked to your screen with click-through hit-testing and smooth wheel expand/collapse gestures.
- **✨ 5 Hitodama Soul Slots (スロット)**:
  1. **人魂 (Soul)**: Switch between procedural Sakura Flame shader and Arena AI avatar.
  2. **性格 (Personality)**: Sweet Sakura 🌸, Tsundere 🎀, True Chad 🗿, or Quiet Zen 🍵.
  3. **音声 (Voice)**: Speech synthesis with cute pitch tuning.
  4. **能力 (Abilities)**: Real Windows dark mode, master volume, Wi-Fi monitor, and 1-click wallpaper automation.
  5. **音声入力 (Dictation)**: Global push-to-talk (`Ctrl + Space`) with active-window cursor text injection.
- **🖼️ Built-in Wallpaper Collection (Arena AI)**:
  - 🌸 **さくらルーム (Sakura Lofi)**
  - 🍡 **桜庭園 (Sakura Garden)**
  - 🎀 **ピンク東京 (Pastel Tokyo)**
  - 🌙 **夜桜サイバー (Night Cyber)**
  - *Click any wallpaper to immediately apply it to your Windows desktop.*
- **🤖 Universal AI Endpoint**: Compatible with any OpenAI-compatible API (`http://localhost:11434/v1` for Ollama, LM Studio, Groq, OpenRouter, Gemini).
- **📋 Paste at Cursor**: Sends AI responses directly into whatever application you're working in via simulated clipboard injection.
- **📝 Daily Objectives (To-Do List)**: Built-in task manager with persistent local storage.
- **📊 Real-time Hardware Stats**: Monitors CPU %, RAM %, and Hitodama heap footprint.
- **🎨 Integrated Arena MCP Server**: Native MCP integration with Arena.ai for generating custom 8k wallpapers and avatars via Brave browser.

---

## 🚀 Quick Start

### Prerequisites
- Windows 10/11
- [Node.js](https://nodejs.org/) (v18+)

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/JamesWalton69/hitodima-oss.git
cd hitodima-oss

# Install dependencies
npm install
npm install --prefix hitodama-oss

# Launch Hitodama
npm start
```

---

## ⌨️ Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + Space` | Summon Hitodama / Start Voice Dictation |
| `Scroll Down (Wheel ↓)` | Expand Control Centre (コントロールセンター) |
| `Scroll Up (Wheel ↑)` | Collapse Control Centre |
| `Enter` | Send AI Query |

---

## 📁 Project Structure

```
├── hitodama-oss/           # Core Electron desktop companion application
│   ├── main.js             # Electron main process & Win32 IPC handlers
│   ├── preload.js          # Secure context bridge
│   ├── src/
│   │   ├── index.html      # Dynamic Island DOM & Control Centre layout
│   │   ├── styles.css      # Sakura glassmorphic theme & animations
│   │   ├── renderer.js     # Sakura soul flame shader, state machine & UI logic
│   │   ├── setWallpaper.ps1# Win32 wallpaper automation script
│   │   ├── setTheme.ps1    # Win32 dark/light mode automation script
│   │   └── assets/         # 8k generated wallpapers & soul avatars
│   └── package.json        # Electron app dependencies
├── index.js                # Arena AI Image Generation MCP server
├── package.json            # Root workspace scripts & MCP SDK dependencies
└── README.md
```

---

## 📜 License
MIT License. Built for the open-source community.
