#!/usr/bin/env node

/**
 * Arena.ai Image Generation MCP Server
 * Controls Brave browser via Chrome DevTools Protocol (CDP) on port 9222.
 * Automatically turns on the browser if it's off.
 * Generates images with free GPT-Image-2.5-Sunburst on Arena.ai.
 */

// 1. Redirect standard logs to stderr immediately to protect JSON-RPC stdout pipe
console.log = (...args) => process.stderr.write(`[arena-mcp] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
console.info = (...args) => process.stderr.write(`[arena-mcp:info] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
console.warn = (...args) => process.stderr.write(`[arena-mcp:warn] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
console.debug = (...args) => process.stderr.write(`[arena-mcp:debug] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const DEFAULT_MODEL = 'gpt-image-2.5-sunburst';

// Candidate paths for Brave executable on Windows
const BRAVE_PATHS = [
  'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
  path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
];

function findBraveExecutable() {
  for (const p of BRAVE_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Check if CDP is reachable
async function isCdpAlive() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function isBraveRunning() {
  try {
    const { execSync } = require('child_process');
    const out = execSync('tasklist /FI "IMAGENAME eq brave.exe" /NH', { encoding: 'utf8' });
    return out.toLowerCase().includes('brave.exe');
  } catch {
    return false;
  }
}

// Ensure Brave browser is running with remote debugging port 9222
async function ensureBrowser() {
  const alive = await isCdpAlive();
  if (alive) {
    console.log('Brave CDP is already active on port', CDP_PORT);
    return;
  }

  const bravePath = findBraveExecutable();
  if (!bravePath) {
    throw new Error('Brave browser executable not found. Please verify Brave installation.');
  }

  const runningWithoutPort = isBraveRunning();
  let args = [];

  if (runningWithoutPort) {
    console.log('Brave is running without CDP port. Spawning dedicated background worker...');
    const agentProfileDir = path.join(__dirname, '.arena_agent_profile');
    args = [
      `--user-data-dir=${agentProfileDir}`,
      `--remote-debugging-port=${CDP_PORT}`,
      '--start-minimized',
      '--no-first-run',
      '--disable-blink-features=AutomationControlled'
    ];
  } else {
    console.log('Brave is OFF. Launching Brave with remote debugging on port', CDP_PORT);
    args = [
      `--remote-debugging-port=${CDP_PORT}`,
      '--restore-last-session',
      '--start-minimized'
    ];
  }

  const child = spawn(bravePath, args, {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  // Wait for port 9222 to become available (up to 15 seconds)
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    await new Promise(r => setTimeout(r, 600));
    if (await isCdpAlive()) {
      console.log('Brave started successfully with CDP active.');
      return;
    }
  }

  throw new Error('Timed out waiting for Brave to start with remote debugging port 9222.');
}

// Send native non-blocking Windows desktop notification
function notifyUser(message, title = 'Arena.ai Verification') {
  try {
    const ps = `
      [System.Media.SystemSounds]::Exclamation.Play();
      Add-Type -AssemblyName System.Windows.Forms;
      $notify = New-Object System.Windows.Forms.NotifyIcon;
      $notify.Icon = [System.Drawing.SystemIcons]::Warning;
      $notify.Visible = $true;
      $notify.ShowBalloonTip(10000, '${title.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}', [System.Windows.Forms.ToolTipIcon]::Warning);
      Start-Sleep -Seconds 3;
      $notify.Dispose();
    `;
    const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
  } catch {}
}

// Check if human verification / Cloudflare Turnstile is blocking
async function checkAndHandleVerification(page) {
  const isChallenged = await page.evaluate(() => {
    const title = document.title || '';
    const body = document.body ? document.body.innerText : '';
    const hasChallengeTitle = title.includes('Just a moment') || title.includes('Attention Required') || title.includes('Security Challenge');
    const hasChallengeText = body.includes('Verify you are human') || body.includes('Confirm you are human') || body.includes('Checking if the site connection is secure');
    const hasFrame = !!document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"], #challenge-stage, .cf-turnstile');
    return hasChallengeTitle || hasChallengeText || hasFrame;
  });

  if (!isChallenged) {
    return true; // Not challenged, all clear
  }

  console.log('Verification challenge detected! Attempting auto-clear...');
  
  // Try auto-clicking turnstile checkbox in frames
  for (const frame of page.frames()) {
    try {
      const cb = frame.locator('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage');
      if (await cb.isVisible({ timeout: 1500 })) {
        await cb.click({ timeout: 2000 });
        await page.waitForTimeout(3000);
        break;
      }
    } catch {}
  }

  // Check if cleared
  const stillChallenged = await page.evaluate(() => {
    const title = document.title || '';
    const body = document.body ? document.body.innerText : '';
    return title.includes('Just a moment') || body.includes('Verify you are human') || !!document.querySelector('#challenge-stage');
  });

  if (!stillChallenged) {
    console.log('Verification cleared automatically!');
    return true;
  }

  // If still challenged, bring window to front and notify user
  console.log('Human verification required! Bringing browser to front and notifying user...');
  await page.bringToFront();
  notifyUser('Arena.ai needs human verification. Please click the verification box in Brave.', 'Arena Verification Required');

  // Wait up to 35 seconds for user to confirm
  const waitStart = Date.now();
  while (Date.now() - waitStart < 35000) {
    await page.waitForTimeout(2000);
    const textarea = page.locator('textarea[placeholder*="Describe the image"]');
    if (await textarea.isVisible().catch(() => false)) {
      console.log('Verification completed by user!');
      return true;
    }
  }

  return false;
}

// Connect to Brave and get or create the Arena tab (runs quietly in background)
async function getArenaPage(model = DEFAULT_MODEL) {
  await ensureBrowser();

  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const context = contexts.length > 0 ? contexts[0] : await browser.newContext();

  let page = context.pages().find(p => p.url().includes('arena.ai'));

  const expectedModel = model || DEFAULT_MODEL;
  const targetUrl = `https://arena.ai/image/direct?model_a=${encodeURIComponent(expectedModel)}`;

  if (!page) {
    console.log('No Arena tab found, opening tab in background...');
    page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } else {
    console.log('Reusing existing Arena tab in background:', page.url());
    if (!page.url().includes('/image/direct') || !page.url().includes(expectedModel)) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    }
  }

  await page.waitForTimeout(1000);

  // Check verification (only brings to front if challenge exists)
  const ok = await checkAndHandleVerification(page);
  if (!ok) {
    throw new Error('Verification challenge requires confirmation. Please check the Brave window.');
  }

  // Dismiss any "Got it" disclaimer popup quietly if present
  try {
    const gotItBtn = page.locator('button:has-text("Got it")');
    if (await gotItBtn.isVisible({ timeout: 1000 })) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }
  } catch {}

  return { browser, page };
}

// Core generation function
async function generateImage({ prompt, outputPath, model = DEFAULT_MODEL }) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return {
      success: false,
      error: 'Prompt cannot be empty.'
    };
  }

  const { browser, page } = await getArenaPage(model);

  try {
    console.log('Waiting for prompt textarea...');
    const textarea = page.locator('textarea[placeholder*="Describe the image"]');
    await textarea.waitFor({ state: 'visible', timeout: 20000 });

    // Count existing generated images before sending
    const initialImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => {
          const s = img.src || '';
          return s.includes('cloudflarestorage') || (img.naturalWidth > 200 && !s.includes('chrome-extension') && !s.includes('googleusercontent.com/a/'));
        })
        .map(img => img.src);
    });

    console.log(`Entering prompt: "${prompt.trim()}"`);
    await textarea.fill(prompt.trim());
    await page.waitForTimeout(500);

    const sendBtn = page.locator('button[aria-label="Send message"]');
    await sendBtn.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Clicking Send message...');
    await sendBtn.click();

    console.log('Waiting for image generation to complete (up to 120s)...');
    const start = Date.now();
    let finalSrc = null;
    let finalDimensions = null;

    while (Date.now() - start < 120000) {
      await page.waitForTimeout(2000);

      // Check current state
      const state = await page.evaluate((knownUrls) => {
        const isGenerating = !!document.querySelector('button[aria-label="Stop generation"]') ||
                             (document.body.innerText && document.body.innerText.includes('Generating image...'));

        const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
          const s = img.src || '';
          const isExtension = s.startsWith('chrome-extension://');
          const isAvatar = s.includes('googleusercontent.com/a/') || s.includes('avatar');
          const isIcon = img.naturalWidth < 180 || s.includes('logo') || s.includes('favicon');
          return !isExtension && !isAvatar && !isIcon && (img.naturalWidth > 200 || s.includes('cloudflarestorage'));
        });

        const newImgs = imgs.filter(img => !knownUrls.includes(img.src));
        const candidate = newImgs.length > 0 ? newImgs[newImgs.length - 1] : (imgs.length > 0 ? imgs[imgs.length - 1] : null);

        return {
          isGenerating,
          hasCandidate: !!candidate,
          candidateSrc: candidate ? candidate.src : null,
          candidateWidth: candidate ? candidate.naturalWidth : null,
          candidateHeight: candidate ? candidate.naturalHeight : null,
          totalValidImages: imgs.length
        };
      }, initialImages);

      if (state.hasCandidate && state.candidateSrc) {
        finalSrc = state.candidateSrc;
        finalDimensions = { width: state.candidateWidth, height: state.candidateHeight };

        if (!state.isGenerating) {
          console.log('Generation completed cleanly!');
          break;
        }
      }
    }

    if (!finalSrc) {
      return {
        success: false,
        error: 'Timed out waiting for image generation. Please check if Arena requested verification or is busy.'
      };
    }

    // Determine save path
    const resolvedPath = outputPath
      ? path.resolve(outputPath)
      : path.join(process.cwd(), 'generated-images', `arena-${Date.now()}.png`);

    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    console.log('Downloading generated image to:', resolvedPath);
    if (finalSrc.startsWith('data:image')) {
      const base64Data = finalSrc.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(resolvedPath, Buffer.from(base64Data, 'base64'));
    } else {
      const res = await fetch(finalSrc);
      if (!res.ok) {
        throw new Error(`Failed to download image from ${finalSrc}: HTTP ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(resolvedPath, Buffer.from(buffer));
    }

    const stats = fs.statSync(resolvedPath);
    console.log(`Saved successfully! Size: ${stats.size} bytes.`);

    return {
      success: true,
      filePath: resolvedPath,
      imageUrl: finalSrc,
      dimensions: finalDimensions,
      fileSize: stats.size,
      model
    };
  } finally {
    // Disconnect CDP client (leaves Brave running!)
    await browser.close().catch(() => {});
  }
}

// Set up MCP Server
const server = new Server(
  {
    name: 'arena-image-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_image',
        description: 'Generate an AI image using free GPT-Image-2.5-Sunburst on Arena.ai via Brave browser. Automatically turns on Brave if it is off and saves the result locally.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'The text prompt describing the image to generate.',
            },
            output_path: {
              type: 'string',
              description: 'Optional local file path to save the generated image (e.g. "./images/banner.png"). If omitted, saves into ./generated-images/ directory.',
            },
            model: {
              type: 'string',
              description: 'The model to use. Defaults to "gpt-image-2.5-sunburst".',
              default: 'gpt-image-2.5-sunburst'
            }
          },
          required: ['prompt'],
        },
      },
      {
        name: 'browser_status',
        description: 'Check if Brave browser is currently running with remote debugging port 9222 and view Arena.ai connection state.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'open_arena',
        description: 'Ensure Brave browser is turned on and navigate to Arena.ai image studio tab.',
        inputSchema: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'Model to preselect (default: "gpt-image-2.5-sunburst")',
              default: 'gpt-image-2.5-sunburst'
            }
          },
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'generate_image') {
      const prompt = args?.prompt || '';
      const outputPath = args?.output_path;
      const model = args?.model || DEFAULT_MODEL;

      const result = await generateImage({ prompt, outputPath, model });

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: `Image generated successfully!\n- Local Path: ${result.filePath}\n- Model: ${result.model}\n- File Size: ${(result.fileSize / 1024).toFixed(1)} KB\n- Image URL: ${result.imageUrl}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Image generation note: ${result.error}`,
            },
          ],
        };
      }
    }

    if (name === 'browser_status') {
      const alive = await isCdpAlive();
      let details = `Brave remote debugging (port ${CDP_PORT}): ${alive ? 'CONNECTED (Browser is ON)' : 'OFFLINE (Browser will auto-start on next task)'}`;

      if (alive) {
        try {
          const res = await fetch(`${CDP_URL}/json/version`);
          const info = await res.json();
          details += `\nBrowser: ${info.Browser}\nUser Agent: ${info['User-Agent']}`;
        } catch {}
      }

      return {
        content: [
          {
            type: 'text',
            text: details,
          },
        ],
      };
    }

    if (name === 'open_arena') {
      const model = args?.model || DEFAULT_MODEL;
      const { browser, page } = await getArenaPage(model);
      const title = await page.title();
      const url = page.url();
      await browser.close().catch(() => {});

      return {
        content: [
          {
            type: 'text',
            text: `Brave is active and Arena.ai is open.\n- Tab Title: ${title}\n- URL: ${url}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`,
        },
      ],
    };
  } catch (err) {
    // Return friendly error message instead of crashing or throwing MCP protocol error
    console.warn('Tool execution handled error:', err.message);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${err.message}`,
        },
      ],
    };
  }
});

// Start the server
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('Arena MCP server is running on stdio.');
}

run().catch((err) => {
  process.stderr.write(`Fatal MCP error: ${err.message}\n`);
  process.exit(1);
});
