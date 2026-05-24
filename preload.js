// preload.js
const { ipcRenderer } = require('electron');

window.isElectron = true;

window.localAI = {
  getAdvice(prompt)      { return ipcRenderer.invoke('local-ai:advice',   prompt); },
  getNews(prompt)        { return ipcRenderer.invoke('local-ai:news',     prompt); },
  getEvent(prompt)       { return ipcRenderer.invoke('local-ai:event',    prompt); },
  getQuestions(prompt)   { return ipcRenderer.invoke('local-ai:questions', prompt); },
  evaluate(prompt)       { return ipcRenderer.invoke('local-ai:evaluate',  prompt); },
  respond(prompt)        { return ipcRenderer.invoke('local-ai:respond',   prompt); },
  generateSpeech(prompt) { return ipcRenderer.invoke('local-ai:speech',   prompt); },
  getTweet(prompt)       { return ipcRenderer.invoke('local-ai:tweet',    prompt); },
  isReady()              { return ipcRenderer.invoke('local-ai:ready'); },
};

window.electronWindow = {
  setSize(w, h)          { return ipcRenderer.invoke('window:setSize', w, h); },
  setFullscreen(flag)    { return ipcRenderer.invoke('window:setFullscreen', flag); },
  getState()             { return ipcRenderer.invoke('window:getState'); },
};
