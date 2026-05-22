// preload.js
const { ipcRenderer } = require('electron');

window.isElectron = true;

window.localAI = {
  getAdvice(prompt)      { return ipcRenderer.invoke('local-ai:advice',   prompt); },
  getEvent(prompt)       { return ipcRenderer.invoke('local-ai:event',    prompt); },
  getQuestions(prompt)   { return ipcRenderer.invoke('local-ai:questions', prompt); },
  evaluate(prompt)       { return ipcRenderer.invoke('local-ai:evaluate',  prompt); },
  respond(prompt)        { return ipcRenderer.invoke('local-ai:respond',   prompt); },
  generateSpeech(prompt) { return ipcRenderer.invoke('local-ai:speech',   prompt); },
  isReady()              { return ipcRenderer.invoke('local-ai:ready'); },
};
