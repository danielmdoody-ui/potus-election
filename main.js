// main.js â€” Electron main process
'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
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
  // Fix phi-3 mini spacing issues â€” the model sometimes emits tokens without inter-word spaces
  output = output
    .replace(/([a-z])([A-Z])/g, '$1 $2')          // camelCase seams: missedIt -> missed It
    .replace(/([a-zA-Z])(\{)/g, '$1 $2')           // word before JSON brace
    .replace(/(\})([a-zA-Z])/g, '$1 $2')           // JSON brace before word
    .replace(/([.,!?;:])([A-Za-z\d])/g, '$1 $2')  // punctuation run-on: "word.Next" -> "word. Next"
    .replace(/([a-z]{2})(\d)/g, '$1 $2')           // letter-digit: "day14" -> "day 14"
    .replace(/(\d)([A-Za-z])/g, '$1 $2')           // digit-letter: "14senators" -> "14 senators"
    .replace(/ {2,}/g, ' ')                         // collapse double-spaces
    .replace(/\n{3,}/g, '\n\n');                    // collapse excess newlines
  return output.trim();
}

ipcMain.handle('local-ai:ready', () => modelReady);

ipcMain.handle('local-ai:questions', async (_e, prompt) => {
  try {
    const raw     = await runPrompt(prompt, 600);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
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
    const text = await runPrompt(prompt, 350);
    console.log('[LocalAI] advice output:', text?.slice(0, 80));
    return text && text.length > 10 ? text : null;
  } catch (err) {
    console.warn('[LocalAI] advice error:', err.message);
    return null;
  }
});

ipcMain.handle('local-ai:event', async (_e, prompt) => {
  try {
    const raw     = await runPrompt(prompt, 600);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed  = JSON.parse(match[0]);
    if (parsed && parsed.headline && parsed.situation) {
      return parsed;
    }
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build/icon.ico'),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  loadModel().catch(err => console.error('[LocalAI] boot error:', err));
  autoUpdater.checkForUpdatesAndNotify();
});


// ── Joint Session Address: generate presidential speech from topics ──────────
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
