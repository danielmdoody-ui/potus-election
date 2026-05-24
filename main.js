// main.js â€” Electron main process
'use strict';

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const MODEL_FILE = 'phi3-mini-q4.gguf';

function resolveModelPath() {
  const candidates = [
    path.join(app.getPath('userData'), 'models', MODEL_FILE),
    path.join(app.getPath('appData'), app.getName(), 'models', MODEL_FILE),
    path.join(app.getPath('appData'), 'POTUS-SIM', 'models', MODEL_FILE),
    path.join(app.getPath('appData'), 'potuselectionsimdesktop', 'models', MODEL_FILE),
  ];

  for (const modelPath of candidates) {
    if (fs.existsSync(modelPath)) return modelPath;
  }

  if (app.isPackaged) return path.join(process.resourcesPath, 'models', MODEL_FILE);
  return path.join(__dirname, 'models', MODEL_FILE);
}

let llamaModel   = null;
let modelReady   = false;

async function loadModel() {
  const modelPath = resolveModelPath();
  if (!fs.existsSync(modelPath)) {
    console.warn('[LocalAI] Model not found at ' + modelPath);
    return;
  }
  try {
    console.log('[LocalAI] Loading modelâ€¦');
    const { getLlama } = await import('node-llama-cpp');
    const llama  = await getLlama();
    llamaModel   = await llama.loadModel({ modelPath });
    modelReady   = true;
    console.log('[LocalAI] Model ready âœ“');
  } catch (err) {
    console.error('[LocalAI] Failed to load model:', err.message);
  }
}

// â”€â”€ Create a fresh context + session for every call so sequences never exhaust â”€â”€
async function runPrompt(promptText, maxTokens) {
  if (!modelReady || !llamaModel) throw new Error('Model not ready');
  const { LlamaChatSession } = await import('node-llama-cpp');

  // Fresh context per call â€” no "No sequences left" error
  const ctx     = await llamaModel.createContext({ contextSize: 2048 });
  const session = new LlamaChatSession({ contextSequence: ctx.getSequence() });
  let output = '';
  try {
    // node-llama-cpp v3: onTextChunk receives decoded text directly.
    // session.prompt() also returns the full string -- use whichever is non-empty.
    const result = await session.prompt(promptText, {
      maxTokens: maxTokens || 400,
      onTextChunk(chunk) {
        output += chunk;
      },
    });
    if (!output && result) output = result;
  } finally {
    // Always dispose context when done to free VRAM/RAM
    await ctx.dispose().catch(() => {});
  }
  /// Fix phi-3 spacing -- preserve JSON camelCase keys, only fix prose spacing
  const isJsonOutput = /^\s*\{/.test(output.trim());
  if (isJsonOutput) {
    output = output
      .replace(/([.!?])([A-Z][a-z])/g, '$1 $2')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  } else {
    output = output
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([a-zA-Z])(\{)/g, '$1 $2')
      .replace(/(\})([a-zA-Z])/g, '$1 $2')
      .replace(/([.,!?;:])([A-Za-z\d])/g, '$1 $2')
      .replace(/([a-z]{2})(\d)/g, '$1 $2')
      .replace(/(\d)([A-Za-z])/g, '$1 $2')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  }
  return output.trim();
}

ipcMain.handle('local-ai:ready', () => modelReady);

// Questions prompt runner — system prompt forces clean JSON output
async function runQuestionsPrompt(promptText) {
  if (!modelReady || !llamaModel) throw new Error('Model not ready');
  const { LlamaChatSession } = await import('node-llama-cpp');
  const ctx     = await llamaModel.createContext({ contextSize: 2048 });
  const session = new LlamaChatSession({
    contextSequence: ctx.getSequence(),
    systemPrompt: 'You are a JSON generator. Output ONLY a valid JSON object — no markdown, no backticks, no explanation, no preamble, no text before or after the JSON. Your entire response must be parseable by JSON.parse().',
  });
  let output = '';
  try {
    const result = await session.prompt(promptText, {
      maxTokens: 400,
      onTextChunk(chunk) { output += chunk; },
    });
    if (!output && result) output = result;
  } finally {
    await ctx.dispose().catch(() => {});
  }
  output = output.replace(/```json|```/g, '').trim();
  return output;
}

ipcMain.handle('local-ai:questions', async (_e, prompt) => {
  try {
    const raw     = await runQuestionsPrompt(prompt);
    const match   = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed  = JSON.parse(match[0]);
    if (parsed && parsed.situation && Array.isArray(parsed.prompts) && parsed.prompts.length >= 2) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[LocalAI] questions error:', err.message);
    return null;
  }
});

ipcMain.handle('local-ai:evaluate', async (_e, prompt) => {
  try {
    const raw     = await runPrompt(prompt, 600);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed  = JSON.parse(match[0]);
    if (parsed && (parsed.feedback || parsed.paragraph1)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[LocalAI] evaluate error:', err.message);
    return null;
  }
});

ipcMain.handle('local-ai:advice', async (_e, prompt) => {
  try {
    const text = await runPrompt(prompt, 900);
    console.log('[LocalAI] advice output:', text?.slice(0, 80));
    return text && text.length > 10 ? text : null;
  } catch (err) {
    console.warn('[LocalAI] advice error:', err.message);
    return null;
  }
});

ipcMain.handle('local-ai:news', async (_e, prompt) => {
  try {
    const text = await runPrompt(prompt, 900);
    console.log('[LocalAI] news output:', text?.slice(0, 100));
    return text && text.length > 40 ? text : null;
  } catch (err) {
    console.warn('[LocalAI] news error:', err.message);
    return null;
  }
});


// Event prompt runner — uses a JSON-enforcing system prompt to prevent trailing text
async function runEventPrompt(promptText) {
  if (!modelReady || !llamaModel) throw new Error('Model not ready');
  const { LlamaChatSession } = await import('node-llama-cpp');
  const ctx     = await llamaModel.createContext({ contextSize: 2048 });
  const session = new LlamaChatSession({
    contextSequence: ctx.getSequence(),
    systemPrompt: 'You are a JSON generator. Output ONLY a valid JSON object — no markdown, no backticks, no explanation, no preamble, no text before or after the JSON. Stop immediately after the closing }. Your entire response must be parseable by JSON.parse().',
  });
  let output = '';
  try {
    const result = await session.prompt(promptText, {
      maxTokens: 700,
      onTextChunk(chunk) { output += chunk; },
    });
    if (!output && result) output = result;
  } finally {
    await ctx.dispose().catch(() => {});
  }
  output = output.replace(/```json|```/g, '').trim();
  return output;
}

ipcMain.handle('local-ai:event', async (_e, prompt) => {
  try {
    const raw     = await runEventPrompt(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
    if (!match) { console.warn('[LocalAI] event error: no JSON object in output'); return null; }
    const parsed  = JSON.parse(match[0]);
    if (parsed && parsed.headline && (parsed.brief || parsed.situation)) {
      return parsed;
    }
    console.warn('[LocalAI] event error: missing required fields (headline/brief)');
    return null;
  } catch (err) {
    console.warn('[LocalAI] event error:', err.message);
    return null;
  }
});

// NEW â€” evaluate a free-text presidential response
ipcMain.handle('local-ai:respond', async (_e, prompt) => {
  try {
    const raw     = await runPrompt(prompt, 500);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed  = JSON.parse(match[0]);
    if (parsed && parsed.outcome && parsed.effects) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[LocalAI] respond error:', err.message);
    return null;
  }
});

let mainWin = null;

// Load saved window config
function getSavedWindowConfig() {
  try {
    const userData = app.getPath('userData');
    const cfgPath = path.join(userData, 'window-config.json');
    if (fs.existsSync(cfgPath)) return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch(e) {}
  return { width: 1280, height: 720, fullscreen: false };
}

function saveWindowConfig(cfg) {
  try {
    const userData = app.getPath('userData');
    fs.writeFileSync(path.join(userData, 'window-config.json'), JSON.stringify(cfg));
  } catch(e) {}
}

function createWindow() {
  const cfg = getSavedWindowConfig();
  mainWin = new BrowserWindow({
    width: cfg.width || 1280,
    height: cfg.height || 720,
    fullscreen: cfg.fullscreen || false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWin.loadFile('index.html');
}

ipcMain.handle('window:setSize', (_e, w, h) => {
  if (!mainWin) return;
  if (mainWin.isFullScreen()) mainWin.setFullScreen(false);
  mainWin.setSize(w, h, true);
  mainWin.center();
  saveWindowConfig({ width: w, height: h, fullscreen: false });
});

ipcMain.handle('window:setFullscreen', (_e, flag) => {
  if (!mainWin) return;
  mainWin.setFullScreen(flag);
  if (!flag) {
    const cfg = getSavedWindowConfig();
    mainWin.setSize(cfg.width || 1280, cfg.height || 720, true);
    mainWin.center();
  }
  saveWindowConfig({ ...getSavedWindowConfig(), fullscreen: flag });
});

ipcMain.handle('window:getState', () => {
  if (!mainWin) return { fullscreen: false };
  return { fullscreen: mainWin.isFullScreen() };
});

app.whenReady().then(() => {
  createWindow();
  loadModel().catch(err => console.error('[LocalAI] boot error:', err));
  autoUpdater.checkForUpdatesAndNotify();
});


// ── Joint Session Address: generate presidential speech from topics ──────────
// Tweet-specific prompt runner — uses a system prompt and strips leaked reasoning
async function runTweetPrompt(promptText) {
  if (!modelReady || !llamaModel) throw new Error('Model not ready');
  const { LlamaChatSession } = await import('node-llama-cpp');
  const ctx     = await llamaModel.createContext({ contextSize: 2048 });
  const session = new LlamaChatSession({
    contextSequence: ctx.getSequence(),
    systemPrompt: 'You are a social media post generator. Output ONLY the post text — nothing else. No explanations, no notes, no parentheses, no (Note: ...) commentary, no character counts, no instructions. Just the raw post text.',
  });
  let output = '';
  try {
    const result = await session.prompt(promptText, {
      maxTokens: 120,
      onTextChunk(chunk) { output += chunk; },
    });
    if (!output && result) output = result;
  } finally {
    await ctx.dispose().catch(() => {});
  }
  // Strip any leaked meta-commentary — anything in parens after the real content
  output = output
    .replace(/\s*\(Note:[^)]*\)/gi, '')
    .replace(/\s*\(This tweet[^)]*\)/gi, '')
    .replace(/\s*\(The tweet[^)]*\)/gi, '')
    .replace(/\s*\(\d+ chars?\)/gi, '')
    .replace(/\s*\(under \d+[^)]*\)/gi, '')
    .replace(/^["']|["']$/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([.,!?;:])([A-Za-z\d])/g, '$1 $2')
    .replace(/ {2,}/g, ' ')
    .trim();
  // If model still leaked a long reasoning block, just take the first sentence
  if (output.length > 160) {
    const firstLine = output.split(/\n/)[0].trim();
    output = firstLine.length > 10 ? firstLine : output.slice(0, 155) + '…';
  }
  return output;
}

// Short tweet-sized generation for the X feed
ipcMain.handle('local-ai:tweet', async (_e, prompt) => {
  try {
    const text = await runTweetPrompt(prompt);
    if (text && text.trim().length > 10) return text.trim();
    return null;
  } catch (err) {
    console.warn('[LocalAI] tweet error:', err.message);
    return null;
  }
});

ipcMain.handle('local-ai:speech', async (_e, prompt) => {
  try {
    const text = await runPrompt(prompt, 800);
    if (text && text.length > 40) return text;
    return null;
  } catch (err) {
    console.warn('[LocalAI] speech error:', err.message);
    return null;
  }
});
