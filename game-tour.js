// ── game-tour.js ── AI Narrative Data + Cinematic Tour / Demo Mode
const AI_ACTION_NARRATIVES = {
  rally: [
    (n,s)=>`${n} holds a packed rally in ${s||'a key state'} - enthusiasm rising`,
    (n,s)=>`${n} draws record crowds at events in ${s||'swing states'} this week`,
    (n)=>`${n} barnstorms three states - ground game expanding fast`,
  ],
  attack: [
    (n)=>`${n} goes negative - new attack ads target the opponent record`,
    (n)=>`${n} campaign unleashes an opposition research dump`,
    (n)=>`${n} PAC floods airwaves with contrast advertising`,
  ],
  coalition: [
    (n)=>`${n} courts key voter blocs - outreach intensifies`,
    (n)=>`${n} announces a coalition-building tour with party leaders`,
    (n)=>`${n} holds unity meeting with faction leaders`,
  ],
  fundraise: [
    (n)=>`${n} raises record funds in online money-bomb`,
    (n)=>`${n} hosts elite donor event - war chest grows`,
  ],
  media: [
    (n)=>`${n} books three major TV interviews this week`,
    (n)=>`${n} launches aggressive media tour to boost name recognition`,
  ],
};

function getAIActionNarrative(actionName, aiName, stateName){
  const pool = AI_ACTION_NARRATIVES[actionName];
  if(!pool) return null;
  const fn = pool[Math.floor(Math.random()*pool.length)];
  return fn(aiName, stateName);
}

// ═══════════════════════════════════════════════
// GENERAL ELECTION HARDENING

// ═══════════════════════════════════════════════════════════════
// 🎬 TOUR MODE - Standalone Cinematic Feature Showcase
// Runs completely independently from game logic. No GS dependency.
// ═══════════════════════════════════════════════════════════════

const _TS = {
  timers: [],
  active: false,
  currentScene: null,
  // Total durations (ms) per scene (sum ≈ 150s)
  SCENES: [
    {id:'ts-s1',  dur:11500, label:'ACT I - THE PRIMARY'},
    {id:'ts-s2',  dur:17000, label:'ACT I - CAMPAIGN DECISIONS'},
    {id:'ts-s3',  dur:14000, label:'ACT I - IDEOLOGY'},
    {id:'ts-s4',  dur:16000, label:'ACT I - COALITION'},
    {id:'ts-s5',  dur:15000, label:'ACT I - COMPETITION'},
    {id:'ts-s6',  dur:14000, label:'ACT I - DEBATE NIGHT'},
    {id:'ts-s7',  dur:14000, label:'ACT II - THE CONVENTION'},
    {id:'ts-s8',  dur:20000, label:'ACT III - ELECTION NIGHT'},
    {id:'ts-s9',  dur:14000, label:'ACT III - VICTORY'},
    {id:'ts-s10', dur:8000,  label:'FIN'},
  ],
  totalMs: 143500,
};

function startTourMode(){
  _TS.active = true;
  _TS.timers.forEach(t=>clearTimeout(t)); _TS.timers = [];
  // Show tour screen
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('tour-screen').classList.add('active');
  // Reset progress
  _tsSetProgress(0);
  _tsSetChapter('');
  // Hide all scenes
  _TS.SCENES.forEach(s=>{ const el=document.getElementById(s.id); if(el){ el.classList.remove('ts-active','ts-show'); } });
  // Init maps & scene assets
  _tsInitMaps();
  _tsInitBlocRows();
  // Sequence
  _tsRunSequence();
}

function exitTourMode(){
  _TS.active = false;
  _TS.timers.forEach(t=>clearTimeout(t)); _TS.timers = [];
  document.getElementById('tour-screen').classList.remove('active');
  showScreen('setup-screen');
}

function _tsT(fn, ms){ _TS.timers.push(setTimeout(()=>{ if(_TS.active) fn(); }, ms)); }

function _tsSetProgress(pct){ const el=document.getElementById('ts-progress-fill'); if(el) el.style.width=pct+'%'; }

function _tsSetChapter(txt){
  const el=document.getElementById('ts-chapter');
  if(!el) return;
  el.style.opacity='0';
  _TS.timers.push(setTimeout(()=>{ if(el){el.textContent=txt;el.style.opacity='1';} }, 350));
}

function _tsShowScene(id){
  // Fade out current
  if(_TS.currentScene && _TS.currentScene!==id){
    const prev=document.getElementById(_TS.currentScene);
    if(prev){ prev.classList.remove('ts-active','ts-show'); }
  }
  _TS.currentScene = id;
  const el=document.getElementById(id);
  if(!el) return;
  el.classList.add('ts-active');
  // Stagger text reveals
  setTimeout(()=>{ if(el&&_TS.active) el.classList.add('ts-show'); }, 200);
}

// ── Map helpers (completely GS-free) ──
function _tsInitMaps(){
  // Opening map - partisan lean colours
  _tsBuildStaticMap('ts-map-s1', code => {
    const s = STATE_DATA.find(x=>x.code===code);
    if(!s) return '#2a3348';
    if(s.lean>20)  return '#1d4ed8';
    if(s.lean>8)   return '#3b82f6';
    if(s.lean>-8)  return '#4b5563';
    if(s.lean>-20) return '#dc2626';
    return '#991b1b';
  }, true);
  // Campaign scene map - primary leader colours
  const primaryColors = {
    CA:'#c8a84b',NY:'#c8a84b',IL:'#c8a84b',PA:'#c8a84b',MI:'#c8a84b',WI:'#c8a84b',
    MN:'#c8a84b',CO:'#c8a84b',VA:'#c8a84b',NM:'#c8a84b',OR:'#c8a84b',WA:'#c8a84b',
    MA:'#c8a84b',CT:'#c8a84b',RI:'#c8a84b',DE:'#c8a84b',MD:'#c8a84b',VT:'#c8a84b',
    IA:'#22d3ee',NH:'#22d3ee',NV:'#22d3ee',ME:'#22d3ee',NE:'#22d3ee',
    GA:'#f472b6',AZ:'#f472b6',NC:'#f472b6',FL:'#f472b6',
    TX:'#84cc16',OH:'#84cc16',IN:'#84cc16',MO:'#84cc16',
    AL:'#f97316',MS:'#f97316',AR:'#f97316',LA:'#f97316',SC:'#f97316',
  };
  _tsBuildStaticMap('ts-map-s2', code => primaryColors[code] || '#2a3348', false);
  // Election night map - starts with partisan lean
  _tsBuildStaticMap('ts-map-s8', code => {
    const s = STATE_DATA.find(x=>x.code===code);
    if(!s) return '#2a3348';
    return '#2a3348'; // all unknown at start of election night
  }, false);
}

function _tsBuildStaticMap(svgId, colorFn, addPulse){
  const svg=document.getElementById(svgId); if(!svg) return;
  svg.innerHTML='';
  const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','960');bg.setAttribute('height','600');bg.setAttribute('fill','#0d1117');svg.appendChild(bg);
  const addInset=(x,y,w,h)=>{const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('fill','none');r.setAttribute('stroke','#1e2535');r.setAttribute('stroke-width','1');svg.appendChild(r)};
  addInset(8,455,195,135);addInset(218,495,150,78);
  STATE_DATA.forEach(state=>{
    const d=PATHS[state.code]; if(!d) return;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);
    path.setAttribute('fill',colorFn(state.code));
    path.setAttribute('stroke','#0d1117');
    path.setAttribute('stroke-width','.7');
    path.setAttribute('stroke-linejoin','round');
    path.setAttribute('data-ts-code',state.code);
    path.style.transition='fill .45s ease';
    if(addPulse && Math.abs(state.lean)<8){
      path.classList.add('ts-swing-pulse');
      path.style.animationDelay=(Math.random()*.4)+'s';
    }
    svg.appendChild(path);
    // State label
    const c=pathCenter(d);
    const txt=document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',c.x);txt.setAttribute('y',c.y);txt.setAttribute('text-anchor','middle');
    txt.setAttribute('dominant-baseline','central');txt.setAttribute('font-size','7.5');
    txt.setAttribute('font-family','IBM Plex Mono,monospace');txt.setAttribute('fill','rgba(255,255,255,.55)');
    txt.setAttribute('pointer-events','none');txt.textContent=state.code;svg.appendChild(txt);
  });
}

function _tsColorMapState(svgId, code, color){
  const svg=document.getElementById(svgId); if(!svg) return;
  const path=svg.querySelector(`[data-ts-code="${code}"]`);
  if(path) path.setAttribute('fill',color);
}

function _tsInitBlocRows(){
  const blocs=[
    {name:'Urban Voters',   val:71, col:'#3b82f6'},
    {name:'Suburban Voters',val:54, col:'#22c55e'},
    {name:'Rural Voters',   val:34, col:'#f97316'},
    {name:'Youth (18-29)',  val:66, col:'#a78bfa'},
    {name:'Seniors (65+)',  val:48, col:'#c8a84b'},
  ];
  const c=document.getElementById('ts-bloc-rows'); if(!c) return;
  c.innerHTML=blocs.map((b,i)=>`
    <div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:3px">
        <span>${b.name}</span><span style="font-family:var(--font-mono);color:var(--text);font-weight:500">${b.val}%</span>
      </div>
      <div style="height:5px;background:var(--bg3);border-radius:2px;overflow:hidden">
        <div style="height:100%;background:${b.col};--tw:${b.val}%;width:0%;transition:width 1s ${.15+i*.18}s ease" class="ts-bar-fill"></div>
      </div>
    </div>`).join('');
}

// ── The main sequence ──
function _tsRunSequence(){
  let elapsed = 0;
  _TS.SCENES.forEach((scene, idx) => {
    const start = elapsed;
    const pctStart = (elapsed / _TS.totalMs * 100).toFixed(1);
    const pctEnd   = ((elapsed + scene.dur) / _TS.totalMs * 100).toFixed(1);

    _tsT(() => {
      _tsSetChapter(scene.label);
      _tsShowScene(scene.id);
      _tsSetProgress(parseFloat(pctStart));
      // Animate progress fill during scene
      setTimeout(()=>{ _tsSetProgress(parseFloat(pctEnd)); }, 200);
      // Run scene-specific animations
      _tsAnimateScene(scene.id);
    }, start);

    elapsed += scene.dur;
  });
  // Auto exit at end
  _tsT(() => exitTourMode(), _TS.totalMs + 1000);
}

function _tsAnimateScene(id){
  switch(id){

    case 'ts-s1': { // Opening - map with swing pulses, title reveal
      break; // CSS handles it, ts-show triggers the transitions
    }

    case 'ts-s2': { // Campaign loop - cursor, click, map reacts
      const cur=document.getElementById('ts-cursor');
      // Move cursor to Rally action after 2s
      _tsT(()=>{
        if(!cur) return;
        const act=document.getElementById('ts-s2-act-rally');
        if(!act) return;
        const r=act.getBoundingClientRect();
        cur.style.display='block'; cur.style.left=(r.left+r.width/2)+'px'; cur.style.top=(r.top+r.height/2-8)+'px';
      }, 2000);
      // Click it at 3.5s
      _tsT(()=>{
        const act=document.getElementById('ts-s2-act-rally');
        if(act){
          act.classList.add('ts-selected');
          if(cur) cur.classList.add('ts-cursor-click');
          setTimeout(()=>{ if(cur) cur.classList.remove('ts-cursor-click'); }, 300);
        }
      }, 3500);
      // Map reacts at 4.5s - Michigan brightens
      _tsT(()=>{
        _tsColorMapState('ts-map-s2','MI','#fbbf24');
        const stateInfo=document.getElementById('ts-s2-stateaction');
        if(stateInfo) stateInfo.textContent='📢 Rallying in Michigan +4%';
      }, 4500);
      // Fund/momentum update at 5s
      _tsT(()=>{
        const f=document.getElementById('ts-s2-funds'); if(f) f.textContent='$36M';
        const m=document.getElementById('ts-s2-mom'); if(m) m.textContent='⬆ +8.0';
      }, 5000);
      // Ohio reacts at 7s
      _tsT(()=>{
        _tsColorMapState('ts-map-s2','PA','#c8a84b');
        const stateInfo=document.getElementById('ts-s2-stateaction');
        if(stateInfo) stateInfo.textContent='PA flips to your column!';
      }, 7000);
      // Hide cursor at 10s
      _tsT(()=>{ if(cur) cur.style.display='none'; }, 10000);
      break;
    }

    case 'ts-s3': { // Political compass - animate dot through positions
      const svg=document.getElementById('ts-compass-svg');
      const lbl=document.getElementById('ts-compass-label');
      const POSITIONS = [
        {x:-0.6,y:0.2,  label:'Authoritarian Left', delay:0,    pols:{econ:'Progressive',health:'Public Option',fp:'Dovish',imm:'Reform',cli:'Aggressive'}},
        {x:-0.5,y:-0.4, label:'Libertarian Left',   delay:3200, pols:{econ:'Progressive',health:'Public Option',fp:'Dovish',imm:'Open',cli:'Aggressive'}},
        {x:0.55,y:0.35, label:'Authoritarian Right', delay:6500, pols:{econ:'Conservative',health:'Repeal',fp:'Hawkish',imm:'Strict',cli:'Minimal'}},
        {x:0.5,y:-0.3,  label:'Libertarian Right',  delay:9500, pols:{econ:'Conservative',health:'Private',fp:'Isolationist',imm:'Strict',cli:'Minimal'}},
        {x:-0.55,y:-.2, label:'Progressive Left',   delay:12000,pols:{econ:'Progressive',health:'Public Option',fp:'Dovish',imm:'Reform',cli:'Aggressive'}},
      ];
      const POL_IDS={econ:'ts-pol-econ-val',health:'ts-pol-health-val',fp:'ts-pol-fp-val',imm:'ts-pol-imm-val',cli:'ts-pol-cli-val'};
      const POL_COLS={Progressive:'#60a5fa','Public Option':'#22c55e',Dovish:'#a78bfa',Reform:'#fb923c',Aggressive:'#4ade80',
        Conservative:'#f87171',Repeal:'#ef4444',Hawkish:'#f97316',Strict:'#ef4444',Minimal:'#94a3b8',
        Private:'#94a3b8',Isolationist:'#a78bfa',Open:'#22c55e'};
      function _renderTourCompass(x,y){
        if(!svg) return;
        const cx=50+x*42, cy=50-y*42;
        svg.innerHTML=`
          <rect x="0" y="0" width="50" height="50" fill="#ef444406"/><rect x="50" y="0" width="50" height="50" fill="#ef44440c"/>
          <rect x="0" y="50" width="50" height="50" fill="#3b82f60e"/><rect x="50" y="50" width="50" height="50" fill="#a78bfa08"/>
          <line x1="50" y1="2" x2="50" y2="98" stroke="#2a3348" stroke-width=".8"/>
          <line x1="2" y1="50" x2="98" y2="50" stroke="#2a3348" stroke-width=".8"/>
          <text x="3" y="8" font-size="5" fill="#3b82f688" font-family="IBM Plex Mono">LEFT</text>
          <text x="72" y="8" font-size="5" fill="#ef444488" font-family="IBM Plex Mono">RIGHT</text>
          <text x="51" y="8" font-size="5" fill="#8a93a8" font-family="IBM Plex Mono">AUTH</text>
          <text x="51" y="97" font-size="5" fill="#8a93a8" font-family="IBM Plex Mono">LIB</text>
          <line x1="${cx}" y1="50" x2="${cx}" y2="${cy}" stroke="#c8a84b" stroke-width=".4" opacity=".3" stroke-dasharray="2,2"/>
          <line x1="50" y1="${cy}" x2="${cx}" y2="${cy}" stroke="#c8a84b" stroke-width=".4" opacity=".3" stroke-dasharray="2,2"/>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="#c8a84b" stroke="#fff" stroke-width="1.2" style="animation:compassPulse 2s ease-in-out infinite"/>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="none" stroke="#c8a84b" stroke-width=".6" opacity=".35"/>
          <text x="3" y="97" font-size="4" fill="#4a5568" font-family="IBM Plex Mono">E:${(x*100).toFixed(0)} S:${(y*100).toFixed(0)}</text>
        `;
      }
      POSITIONS.forEach(pos=>{
        _tsT(()=>{
          _renderTourCompass(pos.x, pos.y);
          if(lbl) lbl.textContent=pos.label;
          Object.entries(pos.pols).forEach(([k,v])=>{
            const el=document.getElementById(POL_IDS[k]); if(el){ el.textContent=v; el.style.color=POL_COLS[v]||'var(--text)'; }
          });
        }, pos.delay);
      });
      break;
    }

    case 'ts-s4': { // Voter blocs - animate poll bars
      _tsT(()=>{
        ['ts-poll-p','ts-poll-h','ts-poll-c','ts-poll-t','ts-poll-pk'].forEach((id,i)=>{
          const el=document.getElementById(id); if(!el) return;
          const widths=['38%','24%','19%','12%','7%'];
          el.parentElement.style.transition=`width 1s ${.3+i*.2}s ease`;
          el.parentElement.style.width=widths[i];
        });
        // Also trigger bloc bar animations
        document.querySelectorAll('#ts-bloc-rows .ts-bar-fill').forEach(b=>{ b.style.width=b.style.getPropertyValue('--tw')||'50%'; });
      }, 400);
      break;
    }

    case 'ts-s5': { // AI opponents - type in action log entries
      const ai1Logs=[
        {icon:'📢',text:'Wk8: Rally in Iowa - surprise surge, 9K attend'},
        {icon:'💰',text:'Wk8: Q3 fundraise - $9.2M raised in 48hrs'},
      ];
      const ai2Logs=[
        {icon:'📺',text:'Wk8: Attack ad vs Morgan - hits fav −2pts'},
        {icon:'🤝',text:'Wk8: Union coalition outreach in Midwest'},
      ];
      const newsItems=[
        {hl:'Hawkins surges in Iowa - Morgan lead narrows to 9pts', tag:'poll'},
        {hl:'Chen launches blistering negative ads - "Morgan\'s record exposed"', tag:'scandal'},
        {hl:'AI candidates ramp up spending ahead of critical stretch', tag:'campaign'},
      ];
      function renderLog(id, entries, delay){
        entries.forEach((e,i)=>{
          _tsT(()=>{
            const c=document.getElementById(id); if(!c) return;
            const div=document.createElement('div');
            div.className='ai-action-log ts-log-row';
            div.textContent=e.icon+' '+e.text;
            c.appendChild(div);
          }, delay + i*1400);
        });
      }
      renderLog('ts-ai1-log', ai1Logs, 1500);
      renderLog('ts-ai2-log', ai2Logs, 2400);
      _tsT(()=>{
        const c=document.getElementById('ts-news-feed'); if(!c) return;
        newsItems.forEach((n,i)=>{
          setTimeout(()=>{
            const d=document.createElement('div');
            d.style.cssText='padding:6px 0;border-bottom:1px solid var(--border);font-size:10px;line-height:1.4;opacity:0;transition:opacity .4s';
            d.innerHTML=`<span style="font-family:var(--font-mono);font-size:8px;padding:1px 4px;border-radius:2px;background:rgba(${n.tag==='poll'?'59,130,246':n.tag==='scandal'?'239,68,68':'200,168,75'},.2);color:${n.tag==='poll'?'#60a5fa':n.tag==='scandal'?'#f87171':'#d4aa5a'};margin-right:5px">${n.tag}</span>${n.hl}`;
            c.appendChild(d);
            setTimeout(()=>{ d.style.opacity='1'; }, 50);
          }, i*1600);
        });
      }, 1000);
      // AI approval ticks
      _tsT(()=>{ const el=document.getElementById('ts-ai1-pct'); if(el) el.textContent='26%'; }, 5000);
      _tsT(()=>{ const el=document.getElementById('ts-ai2-pct'); if(el) el.textContent='21%'; }, 7000);
      break;
    }

    case 'ts-s6': { // Debate - momentum bar surges
      _tsT(()=>{
        const bar=document.getElementById('ts-debate-mom');
        const lbl=document.getElementById('ts-debate-mom-lbl');
        if(bar) bar.style.width='78%';
        if(lbl){ lbl.textContent='+14.2'; lbl.style.color='#4ade80'; }
      }, 3000);
      break;
    }

    case 'ts-s7': { // Convention - delegate counter animates to clinch
      function countTo(target, duration, callback){
        const start=1312, fps=30, steps=duration/(1000/fps);
        const inc=(target-start)/steps;
        let cur=start, step=0;
        const iv=setInterval(()=>{
          step++;
          cur=Math.min(target, start+inc*step);
          const el=document.getElementById('ts-del-count'); if(el) el.textContent=Math.round(cur).toLocaleString();
          const elP=document.getElementById('ts-dr-p'); if(elP) elP.textContent=Math.round(cur).toLocaleString();
          const pct=Math.min(100,(cur/1991*100));
          const barEl=document.getElementById('ts-del-bar'); if(barEl) barEl.style.width=pct+'%';
          if(step>=steps){ clearInterval(iv); if(callback) callback(); }
        }, 1000/fps);
        _TS.timers.push(iv);
      }
      _tsT(()=>{
        // Animate bar from current %
        const startPct=(1312/1991*100).toFixed(1);
        const barEl=document.getElementById('ts-del-bar'); if(barEl) barEl.style.width=startPct+'%';
        countTo(2104, 5500, ()=>{
          const banner=document.getElementById('ts-nominated-banner');
          if(banner){
            banner.style.display='block';
            const wrap=document.getElementById('ts-convention-wrap');
            if(wrap) wrap.classList.add('ts-gold-flash');
          }
        });
      }, 2000);
      break;
    }

    case 'ts-s8': { // Election Night - states call in batches with EV counter + congress board
      // Animate congress scoreboard alongside EV results
      const CONGRESS_UPDATES = [
        {delay:1000, senate:{dem:47,rep:53}, house:{dem:210,rep:225}},
        {delay:4000, senate:{dem:48,rep:52}, house:{dem:213,rep:222}},
        {delay:8000, senate:{dem:49,rep:51}, house:{dem:215,rep:220}},
        {delay:12000, senate:{dem:50,rep:50}, house:{dem:216,rep:219}},
        {delay:16000, senate:{dem:51,rep:49}, house:{dem:218,rep:217}},
      ];
      CONGRESS_UPDATES.forEach(upd=>{
        _tsT(()=>{
          const el=id=>document.getElementById(id);
          if(el('ts-senate-dem')) el('ts-senate-dem').textContent=upd.senate.dem;
          if(el('ts-senate-rep')) el('ts-senate-rep').textContent=upd.senate.rep;
          if(el('ts-house-dem'))  el('ts-house-dem').textContent=upd.house.dem;
          if(el('ts-house-rep'))  el('ts-house-rep').textContent=upd.house.rep;
          if(el('ts-senate-bar-dem')) el('ts-senate-bar-dem').style.width=upd.senate.dem+'%';
          if(el('ts-senate-bar-rep')) el('ts-senate-bar-rep').style.width=upd.senate.rep+'%';
          if(el('ts-house-bar-dem')) el('ts-house-bar-dem').style.width=(upd.house.dem/435*100).toFixed(1)+'%';
          if(el('ts-house-bar-rep')) el('ts-house-bar-rep').style.width=(upd.house.rep/435*100).toFixed(1)+'%';
          // Update clock
          const clockEl=document.getElementById('ts-en-clock');
          const clocks=['7:00 PM','7:30 PM','8:00 PM','9:00 PM','10:00 PM','11:00 PM'];
          if(clockEl) clockEl.textContent=clocks[CONGRESS_UPDATES.indexOf(upd)]||'10:00 PM';
        }, upd.delay);
      });
      const ELECTION_CALLS = [
        // {code, demColor/repColor, playerEV, oppEV, ticker}
        {batch:[{c:'VT',col:'#1d4ed8'},{c:'MA',col:'#1d4ed8'},{c:'MD',col:'#1d4ed8'},{c:'CT',col:'#1d4ed8'},{c:'RI',col:'#1d4ed8'},{c:'NJ',col:'#1d4ed8'}], pEV:35, oEV:0, ticker:'📺 Morgan projected winner in VT, MA, MD, CT, RI, NJ'},
        {batch:[{c:'KY',col:'#991b1b'},{c:'IN',col:'#991b1b'},{c:'WV',col:'#991b1b'},{c:'TN',col:'#991b1b'},{c:'AL',col:'#991b1b'},{c:'MS',col:'#991b1b'}], pEV:35, oEV:37, ticker:'Thompson wins solid red states - KY, IN, WV, TN, AL, MS'},
        {batch:[{c:'IL',col:'#1d4ed8'},{c:'NY',col:'#1d4ed8'},{c:'ME',col:'#60a5fa'},{c:'NH',col:'#60a5fa'},{c:'DE',col:'#1d4ed8'}], pEV:88, oEV:37, ticker:'📺 Morgan projected: IL, NY, ME, NH, DE - EVs climbing'},
        {batch:[{c:'TX',col:'#991b1b'},{c:'KS',col:'#991b1b'},{c:'NE',col:'#991b1b'},{c:'OK',col:'#991b1b'},{c:'ND',col:'#991b1b'},{c:'SD',col:'#991b1b'},{c:'WY',col:'#991b1b'},{c:'MT',col:'#991b1b'},{c:'ID',col:'#991b1b'}], pEV:88, oEV:113, ticker:'Thompson takes Texas (+40 EV) and Plains states'},
        {batch:[{c:'CA',col:'#1d4ed8'},{c:'WA',col:'#1d4ed8'},{c:'OR',col:'#1d4ed8'},{c:'HI',col:'#1d4ed8'},{c:'MN',col:'#60a5fa'},{c:'NM',col:'#60a5fa'},{c:'CO',col:'#60a5fa'}], pEV:199, oEV:113, ticker:'West Coast closes - Morgan +111 EV on the night'},
        {batch:[{c:'FL',col:'#f87171'},{c:'OH',col:'#f87171'},{c:'IA',col:'#991b1b'},{c:'MO',col:'#991b1b'},{c:'SC',col:'#991b1b'},{c:'LA',col:'#991b1b'}], pEV:199, oEV:168, ticker:'⚠ Thompson wins FL, OH - race tightening'},
        {batch:[{c:'VA',col:'#60a5fa'},{c:'MI',col:'#60a5fa'},{c:'WI',col:'#60a5fa'},{c:'NV',col:'#60a5fa'}], pEV:254, oEV:168, ticker:'📺 Morgan flips Michigan and Wisconsin - 254 EV - very close to 270!'},
        {batch:[{c:'PA',col:'#60a5fa'}], pEV:274, oEV:168, ticker:'🚨 DECISION DESK: Morgan wins Pennsylvania - 274 EV - PROJECTED WINNER'},
        {batch:[{c:'AZ',col:'#f87171'},{c:'GA',col:'#f87171'},{c:'NC',col:'#991b1b'}], pEV:274, oEV:199, ticker:'Thompson wins AZ, GA - too little, too late'},
      ];
      let elapsed=0;
      ELECTION_CALLS.forEach((call, i)=>{
        _tsT(()=>{
          call.batch.forEach(s=>{ _tsColorMapState('ts-map-s8',s.c,s.col); });
          const demEl=document.getElementById('ts-ev-dem'); if(demEl){ demEl.textContent=call.pEV; if(call.pEV>=270) demEl.style.color='var(--accent)'; }
          const repEl=document.getElementById('ts-ev-rep'); if(repEl) repEl.textContent=call.oEV;
          const bDem=document.getElementById('ts-en-bar-dem'); if(bDem) bDem.style.width=(call.pEV/538*100)+'%';
          const bRep=document.getElementById('ts-en-bar-rep'); if(bRep) bRep.style.width=(call.oEV/538*100)+'%';
          const ticker=document.getElementById('ts-en-ticker'); if(ticker) ticker.textContent=call.ticker;
        }, elapsed);
        elapsed += (i < 5 ? 2000 : 2500);
      });
      break;
    }

    case 'ts-s9': { // Victory - elements stagger in
      ['ts-s9-win','ts-s9-name','ts-s9-stats','ts-s9-sub'].forEach((id,i)=>{
        _tsT(()=>{ const el=document.getElementById(id); if(el) el.style.opacity='1'; }, 200+i*400);
      });
      break;
    }

    case 'ts-s10': { // Outro - logo fades in
      _tsT(()=>{ const el=document.getElementById('ts-outro-logo'); if(el) el.style.opacity='1'; }, 400);
      _tsT(()=>{ const el=document.getElementById('ts-outro-sub'); if(el) el.style.opacity='1'; }, 800);
      _tsT(()=>{ const el=document.getElementById('ts-outro-cta'); if(el) el.style.opacity='1'; }, 1400);
      break;
    }
  }
}

// Clean up animation artifacts when re-entering a scene
function _tsClearSceneState(){
  // Clear AI logs
  ['ts-ai1-log','ts-ai2-log','ts-news-feed'].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=''; });
  // Reset poll bars
  ['ts-poll-p','ts-poll-h','ts-poll-c','ts-poll-t','ts-poll-pk'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    el.parentElement.style.width='0%';
  });
  // Reset delegate counter
  const dc=document.getElementById('ts-del-count'); if(dc) dc.textContent='1,312';
  const db=document.getElementById('ts-del-bar'); if(db) db.style.width='0%';
  const nb=document.getElementById('ts-nominated-banner'); if(nb) nb.style.display='none';
  const cw=document.getElementById('ts-convention-wrap'); if(cw) cw.classList.remove('ts-gold-flash');
  // Reset action cards
  document.querySelectorAll('.ts-action-card').forEach(c=>c.classList.remove('ts-selected'));
  // Reset compass
  const cl=document.getElementById('ts-compass-label'); if(cl) cl.textContent='Progressive Left';
  // Reset debate bar
  const dm=document.getElementById('ts-debate-mom'); if(dm) dm.style.width='45%';
  const dl=document.getElementById('ts-debate-mom-lbl'); if(dl){ dl.textContent='+6.5'; dl.style.color='var(--green)'; }
  // Reset victory elements
  ['ts-s9-win','ts-s9-name','ts-s9-stats','ts-s9-sub'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.opacity='0'; });
  ['ts-outro-logo','ts-outro-sub','ts-outro-cta'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.opacity='0'; });
}




// ═══════════════════════════════════════════════
function runGeneralOpponentAI(){
  if(GS.phase !== 'general' || !GS.opponent) return;
  const opp = GS.opponent;
  if(!opp.active) return;

  // ── State & context ──
  const weekInGeneral = GS.week - GS.primaryWeeks;
  const weekPct = weekInGeneral / GS.generalWeeks;           // 0→1 as election approaches
  const diff = GS.difficulty || 'normal';
  const diffMult = {easy:0.80, normal:1.20, hard:1.65}[diff] || 1.20;

  // National lead (+ means player leads)
  const playerLead = GS.favorability - (opp.approval || 45);
  const oppIsTrailing = playerLead > 3;
  const oppTrailingBadly = playerLead > 10;
  const oppWinningBig = playerLead < -8;
  const finalStretch = weekPct > 0.65;
  const earlyGame = weekPct < 0.3;

  // Electoral college status
  const playerEV = GS.states.filter(s => s.genLead > 0).reduce((s,x) => s + x.ev, 0);
  const totalEV   = GS.states.reduce((s,x) => s + x.ev, 0);
  const oppEV = totalEV - playerEV; // rough
  const oppNeedsEV = oppEV < 270;   // opponent needs to flip states

  // Swing states: genLead between -12 and +12
  const swingStates = GS.states
    .filter(s => Math.abs(s.genLead) <= 12)
    .sort((a, b) => b.ev - a.ev); // sort by EV

  // States where player has thin lead (prime flip targets)
  const flipTargets = GS.states
    .filter(s => s.genLead > 0 && s.genLead < 8)
    .sort((a, b) => a.genLead - b.genLead); // easiest to flip first

  // ── Prevent duplicate actions in same week ──
  if(!opp._actionsThisWeek) opp._actionsThisWeek = new Set();
  if(!opp._actionLog) opp._actionLog = [];

  // ── Action selection logic ──
  let actionPool = [];

  // Always consider fundraising if low on funds
  if(opp.funds < 8){
    actionPool.push({id:'fundraise', weight: 90 * (1 - opp.funds/8)});
  } else {
    actionPool.push({id:'fundraise', weight: 10 + (1-weekPct)*15});
  }

  // Attack ads - more valuable when trailing or late
  const attackW = 30
    + (oppIsTrailing ? 25 : 0)
    + (finalStretch ? 20 : 0)
    + (weekPct * 15);
  if(opp.funds >= 3) actionPool.push({id:'attack_ad', weight: attackW * diffMult});

  // Swing state rally
  const rallyW = 35
    + (oppNeedsEV ? 30 : 0)
    + (finalStretch ? 20 : 0)
    + (oppIsTrailing ? 15 : 0);
  if(opp.funds >= 2 && swingStates.length > 0){
    actionPool.push({id:'rally_swing', weight: rallyW * diffMult});
  }

  // Flip a state where player leads narrowly
  const flipW = 20
    + (oppNeedsEV ? 40 : 0)
    + (finalStretch ? 25 : 0);
  if(opp.funds >= 2 && flipTargets.length > 0){
    actionPool.push({id:'flip_state', weight: flipW * diffMult});
  }

  // Shore up own weak states
  const ownWeakStates = GS.states.filter(s => s.genLead < 0 && s.genLead > -6);
  const defendW = 20 + (oppWinningBig ? 10 : 0) + (ownWeakStates.length > 3 ? 15 : 0);
  if(opp.funds >= 2 && ownWeakStates.length > 0){
    actionPool.push({id:'defend_states', weight: defendW});
  }

  // Ground game blitz - builds up silent advantages
  if(opp.funds >= 3 && weekPct < 0.7){
    const ggW = 20 + (diff === 'hard' ? 20 : 0) + (earlyGame ? 15 : 0);
    actionPool.push({id:'ground_game', weight: ggW});
  }

  // Media blitz - boosts approval
  const mediaW = 15 + (1 - opp.approval/60) * 20 + (earlyGame ? 10 : 0);
  if(opp.funds >= 2) actionPool.push({id:'media_blitz', weight: mediaW});

  // Debate prep - only when debate is upcoming
  const nextDebateWeek = (GS._generalDebateWeeks || []).find(w => w > GS.week && w <= GS.week+2);
  if(nextDebateWeek && opp.funds >= 1){
    actionPool.push({id:'debate_prep', weight: 45 + (diff==='hard'?25:0)});
  }

  // NEW: Voter outreach (bloc targeting) - more valuable early/mid game
  const outreachW = 20 + (earlyGame ? 25 : 0) + (oppIsTrailing ? 15 : 0);
  if(opp.funds >= 1.5) actionPool.push({id:'voter_outreach', weight: outreachW});

  // NEW: Surrogate deployment - boosts multiple swing states softly
  const surrogateW = 15 + (swingStates.length > 3 ? 20 : 0) + (finalStretch ? 15 : 0);
  if(opp.funds >= 2 && swingStates.length > 0) actionPool.push({id:'surrogate_deploy', weight: surrogateW * diffMult});

  // NEW: Opposition research dump - targeted scandal/approval hit on player
  const oppoW = 10 + (oppTrailingBadly ? 35 : oppIsTrailing ? 20 : 0) + (weekPct > 0.5 ? 15 : 0);
  if(opp.funds >= 2.5) actionPool.push({id:'oppo_dump', weight: oppoW * diffMult});

  // NEW: Battleground bus tour (multi-stop swing push, expensive but powerful)
  const btW = 10 + (finalStretch ? 30 : 0) + (oppNeedsEV ? 25 : 0);
  if(opp.funds >= 5 && swingStates.length >= 3) actionPool.push({id:'battleground_tour', weight: btW * diffMult});

  // Filter out already-used actions this week + unavailable
  actionPool = actionPool.filter(a => !opp._actionsThisWeek.has(a.id));

  // Hard AI picks 2-3 actions; Normal 1-2; Easy 1
  const actionsToTake = diff === 'hard' ? (Math.random()<0.4?3:2) : (diff === 'normal' && Math.random() < 0.65 ? 2 : 1);

  for(let i = 0; i < actionsToTake && actionPool.length > 0; i++){
    const totalW = actionPool.reduce((s, a) => s + a.weight, 0);
    let roll = Math.random() * totalW;
    let chosen = actionPool[actionPool.length - 1];
    for(const a of actionPool){
      roll -= a.weight;
      if(roll <= 0){ chosen = a; break; }
    }
    actionPool = actionPool.filter(a => a.id !== chosen.id);
    opp._actionsThisWeek.add(chosen.id);
    _executeOpponentAction(chosen.id, opp, diffMult, flipTargets, swingStates, ownWeakStates, weekPct);
  }

  // Reset action tracking for next week
  opp._actionsThisWeek = new Set();

  // Passive weekly approval fluctuation - small drift
  opp.approval = cl(opp.approval + G(0, 0.6), 30, 72);

  // Trim action log to last 5 entries
  if(opp._actionLog.length > 5) opp._actionLog = opp._actionLog.slice(-5);
}

function _executeOpponentAction(actionId, opp, diffMult, flipTargets, swingStates, ownWeakStates, weekPct){
  const oppName = opp.name || 'Opponent';
  const shortName = oppName.split(' ').pop();
  // Queue a visible summary event for the player
  const oppEvent = (type, title, msg) => {
    if(!GS._oppSummaryEvents) GS._oppSummaryEvents = [];
    GS._oppSummaryEvents.push({type, title:`🎯 ${oppName}: ${title}`, msg});
  };

  switch(actionId){

    case 'fundraise': {
      const raised = G(4.5, 1.5) * (1/diffMult); // easy opp raises more → weaker effect
      opp.funds = cl(opp.funds + raised, 0, 120);
      opp._lastAction = `💰 Fundraiser - +${raised.toFixed(1)}M`;
      if(Math.random() < 0.3){
        addNews(`${oppName} reports major fundraising haul - campaign war chest growing`, 'campaign');
      }
      break;
    }

    case 'attack_ad': {
      const dmg = G(1.8, 0.9) * diffMult;
      GS.favorability = cl(GS.favorability - dmg, 20, 85);
      opp.funds = cl(opp.funds - 3, 0, 120);
      opp._lastAction = `📺 Attack Ad - −${dmg.toFixed(1)}% your fav`;
      const headlines = [
        `${oppName} drops blistering contrast ad - "Does ${GS.playerName.split(' ').pop()} have what it takes?"`,
        `${shortName} PAC floods airwaves with attack advertising in key markets`,
        `${oppName} campaign launches negative blitz - "Record. Character. Fitness."`,
        `New ${shortName} ad questions ${GS.playerName.split(' ').pop()}'s economic record`,
        `${shortName} super PAC spends $12M on swing-state negative ads this week`,
      ];
      addNews(headlines[Math.floor(Math.random()*headlines.length)], 'scandal');
      opp._actionLog.push({wk: GS.week, icon:'📺', text:`Attack ad - hit opponent −${dmg.toFixed(1)}pts`});
      oppEvent('negative', 'Attack Ads', `New attack ads hit your favorability −${dmg.toFixed(1)}%. Swing state airwaves flooded.`);
      break;
    }

    case 'rally_swing': {
      // Strategic: hard AI picks highest-EV swing; easy picks random
      let target;
      if(GS.difficulty === 'hard'){
        target = swingStates[0]; // highest EV first
      } else {
        target = swingStates[Math.floor(Math.random() * Math.min(swingStates.length, 4))];
      }
      if(!target) break;
      const push = G(1.5, 0.7) * diffMult;
      target.genLead = cl(target.genLead - push, -60, 60);
      opp.funds = cl(opp.funds - 2, 0, 120);
      opp.approval = cl(opp.approval + G(0.5, 0.3), 30, 72);
      opp._lastAction = `📢 Rally - ${target.code} (${target.ev} EV)`;
      const rallyLines = [
        `${oppName} holds massive rally in ${target.name} - record crowd turns out`,
        `${shortName} campaigns hard in ${target.name}: "We will not cede this ground"`,
        `${oppName} makes third visit this week to ${target.name} - aides call it critical`,
      ];
      if(Math.random() < 0.55) addNews(rallyLines[Math.floor(Math.random()*rallyLines.length)], 'campaign');
      opp._actionLog.push({wk: GS.week, icon:'📢', text:`Rally in ${target.name} (${target.ev} EV) - eroded lead by ${push.toFixed(1)}pts`});
      oppEvent('negative', `Rally in ${target.name}`, `${oppName} held a major rally in ${target.name} (${target.ev} EV). Your lead there narrowed by ${push.toFixed(1)}%.`);
      break;
    }

    case 'flip_state': {
      let target;
      if(GS.difficulty === 'hard'){
        // Strategic: pick state with highest EV among thin leads
        target = flipTargets.sort((a,b) => b.ev - a.ev)[0];
      } else {
        target = flipTargets[Math.floor(Math.random() * Math.min(flipTargets.length, 3))];
      }
      if(!target) break;
      const push = G(2.2, 1.0) * diffMult;
      target.genLead = cl(target.genLead - push, -60, 60);
      opp.funds = cl(opp.funds - 2.5, 0, 120);
      opp._lastAction = `🎯 Target ${target.code} - flip attempt`;
      const flippedMsg = target.genLead <= 0
        ? `🚨 POLLING SHIFT: ${target.name} now leans toward ${opp.name} - was previously in your column`
        : `${oppName} intensifies push in ${target.name} - your lead there is narrowing`;
      addNews(flippedMsg, target.genLead <= 0 ? 'poll' : 'campaign');
      opp._actionLog.push({wk: GS.week, icon:'🎯', text:`Targeted ${target.name} - ${target.genLead<=0?'⚠ FLIPPED!':'lead narrowed'}`});
      oppEvent(target.genLead <= 0 ? 'negative' : 'neutral', `${target.name} Under Pressure`,
        target.genLead <= 0
          ? `🚨 ${target.name} (${target.ev} EV) has FLIPPED - now polling for ${oppName}!`
          : `${oppName} poured resources into ${target.name}. Your +${target.genLead.toFixed(1)}% lead is shrinking.`);
      break;
    }

    case 'defend_states': {
      let consolidated = 0;
      ownWeakStates.forEach(s => {
        const shore = G(1.2, 0.5) * diffMult;
        s.genLead = cl(s.genLead - shore, -60, 60);
        consolidated++;
      });
      opp.funds = cl(opp.funds - 2, 0, 120);
      opp._lastAction = `🛡 Shore up ${consolidated} weak state${consolidated!==1?'s':''}`;
      if(Math.random() < 0.3){
        addNews(`${oppName} shifts resources to shore up vulnerable home states - internal polls show concern`, 'poll');
      }
      opp._actionLog.push({wk: GS.week, icon:'🛡', text:`Defended ${consolidated} weak state(s)`});
      break;
    }

    case 'ground_game': {
      // Silently moves multiple swing states slightly
      swingStates.slice(0, 4).forEach(s => {
        const nudge = G(0.6, 0.3) * diffMult;
        s.genLead = cl(s.genLead - nudge, -60, 60);
      });
      opp.funds = cl(opp.funds - 3, 0, 120);
      opp._lastAction = `🌐 Ground Game - 4-state push`;
      opp._actionLog.push({wk: GS.week, icon:'🌐', text:`Ground game blitz across 4 swing states`});
      break;
    }

    case 'media_blitz': {
      const boost = G(1.5, 0.6) * diffMult;
      opp.approval = cl(opp.approval + boost, 30, 72);
      opp.funds = cl(opp.funds - 2, 0, 120);
      opp._lastAction = `📡 Media Blitz - +${boost.toFixed(1)}% approval`;
      const mediaMsgs = [
        `${oppName} dominates cable news cycle with disciplined messaging push`,
        `${shortName} campaign rolls out aggressive earned-media strategy this week`,
        `Poll: ${oppName} favorability ticks up after strong TV appearances`,
      ];
      if(Math.random() < 0.4) addNews(mediaMsgs[Math.floor(Math.random()*mediaMsgs.length)], 'poll');
      opp._actionLog.push({wk: GS.week, icon:'📡', text:`Media blitz - approval +${boost.toFixed(1)}pts`});
      break;
    }

    case 'debate_prep': {
      opp._debateBonus = (opp._debateBonus || 0) + G(4, 1.5) * diffMult;
      opp.funds = cl(opp.funds - 1, 0, 120);
      opp._lastAction = `📚 Debate Prep - opponent ready`;
      opp._actionLog.push({wk: GS.week, icon:'📚', text:`Extensive debate prep - bonus banked`});
      break;
    }

    case 'voter_outreach': {
      // Boost opp approval + nudge swing states softly
      const boost = G(0.9, 0.5) * diffMult;
      opp.approval = cl(opp.approval + boost, 30, 72);
      swingStates.slice(0, 3).forEach(s => {
        s.genLead = cl(s.genLead - G(0.4, 0.2) * diffMult, -60, 60);
      });
      opp.funds = cl(opp.funds - 1.5, 0, 120);
      opp._lastAction = `🗣 Voter Outreach - 3-state coalition push`;
      const msgs = [
        `${oppName} launches major minority voter outreach drive in swing states`,
        `${shortName} campaign deploys grassroots volunteers in key communities`,
        `${oppName} targets suburban voters with new coalition-building tour`,
      ];
      if(Math.random() < 0.4) addNews(msgs[Math.floor(Math.random()*msgs.length)], 'campaign');
      opp._actionLog.push({wk: GS.week, icon:'🗣', text:`Voter outreach - approval +${boost.toFixed(1)}, swing states nudged`});
      break;
    }

    case 'surrogate_deploy': {
      // Multiple surrogates hit swing states simultaneously
      const targets = swingStates.slice(0, Math.min(5, swingStates.length));
      targets.forEach(s => {
        s.genLead = cl(s.genLead - G(0.5, 0.3) * diffMult, -60, 60);
      });
      opp.funds = cl(opp.funds - 2, 0, 120);
      opp._lastAction = `👥 Surrogates - ${targets.length} states covered`;
      const surMsgs = [
        `${oppName} deploys A-list surrogates across ${targets.length} battleground states`,
        `Former presidents, governors rally for ${shortName} in critical swing states`,
        `${shortName} campaign floods key markets with surrogate appearances this week`,
      ];
      if(Math.random() < 0.45) addNews(surMsgs[Math.floor(Math.random()*surMsgs.length)], 'campaign');
      opp._actionLog.push({wk: GS.week, icon:'👥', text:`Surrogates blanketed ${targets.length} swing states`});
      break;
    }

    case 'oppo_dump': {
      // Opposition research - hits player favorability and generates scandal-type news
      const dmg = G(1.2, 0.8) * diffMult;
      GS.favorability = cl(GS.favorability - dmg, 20, 85);
      // Small chance to also shift a swing state
      if(Math.random() < 0.35 && swingStates.length > 0){
        const t = swingStates[Math.floor(Math.random() * Math.min(3, swingStates.length))];
        t.genLead = cl(t.genLead - G(0.8, 0.4), -60, 60);
      }
      opp.funds = cl(opp.funds - 2.5, 0, 120);
      opp._lastAction = `🔎 Oppo Dump - your fav −${dmg.toFixed(1)}`;
      const oppoMsgs = [
        `BREAKING: ${oppName} campaign releases dossier on ${GS.playerName.split(' ').pop()}'s record`,
        `${shortName} oppo team drops opposition research targeting ${GS.playerName.split(' ').pop()} on healthcare`,
        `Leaked memos paint unflattering picture of ${GS.playerName.split(' ').pop()} - ${shortName} camp celebrates`,
        `${oppName} super PAC releases devastating biographical contrast ad this week`,
      ];
      addNews(oppoMsgs[Math.floor(Math.random()*oppoMsgs.length)], 'scandal');
      opp._actionLog.push({wk: GS.week, icon:'🔎', text:`Oppo research drop - hit opponent fav −${dmg.toFixed(1)}pts`});
      oppEvent('negative', 'Opposition Research Drop', `${oppName} released damaging research. Your favorability fell −${dmg.toFixed(1)}%.`);
      break;
    }

    case 'battleground_tour': {
      // Expensive multi-state tour - strong swing-state push
      const targets = swingStates.slice(0, Math.min(4, swingStates.length));
      let totalPush = 0;
      targets.forEach(s => {
        const push = G(1.8, 0.6) * diffMult;
        s.genLead = cl(s.genLead - push, -60, 60);
        totalPush += push;
      });
      opp.approval = cl(opp.approval + G(0.8, 0.4), 30, 72);
      opp.funds = cl(opp.funds - 5, 0, 120);
      opp._lastAction = `🚌 Battleground Tour - ${targets.length} states`;
      const tourNames = targets.map(s => s.code).join('-');
      const btMsgs = [
        `${oppName} launches grueling battleground bus tour: ${tourNames}`,
        `${shortName} hits ${targets.length} swing states in 48-hour blitz - drawing massive crowds`,
        `Momentum shift? ${oppName} battleground tour dominates cable news cycle`,
      ];
      addNews(btMsgs[Math.floor(Math.random()*btMsgs.length)], 'campaign');
      opp._actionLog.push({wk: GS.week, icon:'🚌', text:`Bus tour: ${tourNames} - avg push ${(totalPush/targets.length).toFixed(1)}pts/state`});
      oppEvent('negative', `Battleground Tour: ${tourNames}`, `${oppName} blitzed ${targets.length} swing states. Average movement: −${(totalPush/targets.length).toFixed(1)}% per state.`);
      break;
    }
  }
}

// ── Passive opponent weekly fundraising (happens regardless of action) ──
function opponentPassiveFundraise(){
  if(GS.phase !== 'general' || !GS.opponent) return;
  const diff = GS.difficulty || 'easy';
  const base = {easy:2.5, normal:3.5, hard:5.0}[diff] || 3.0;
  GS.opponent.funds = cl(GS.opponent.funds + G(base, 0.8), 0, 120);
}

// ═══════════════════════════════════════════════
// REPLAYABILITY: Dynamic scenario modifiers chosen at game start
// Each game gets a unique "Campaign Twist" that changes rules
// ═══════════════════════════════════════════════
const CAMPAIGN_TWISTS = [
  {id:'dark_horse', name:'Dark Horse Candidate', icon:'🐎',
   desc:'An unexpected AI candidate enters mid-race with an unconventional message. Nobody saw it coming.',
   apply:()=>{
     const dark = {id:'darkhorse',name:'M. Whitmore',party:GS.playerParty,approval:8,funds:12,
       delegates:0,active:true,color:'#06b6d4',archetype:'populist',ideology:G(25,8)};
     dark._portrait = {skin:'e8c47a',hair:'2d3748',eyes:'1e40af',suit:dark.color};
     GS.aiCandidates.push(dark);
     addNews('Surprise: Political newcomer M. Whitmore enters race - "Washington is broken, I will burn it down"','campaign');
   }},
  {id:'early_lead', name:'Frontrunner Target', icon:'🎯',
   desc:"Everyone's gunning for you from day one. The field unites against the frontrunner.",
   apply:()=>{
     GS.favorability = cl(GS.favorability + 8, 20, 85);
     GS.aiCandidates.forEach(a=>{ a.approval = cl(a.approval+5,0,80); a.funds = cl(a.funds+5,0,100); });
     addNews(`${GS.playerName} enters as clear frontrunner - rivals immediately begin coordinated attacks`,'poll');
   }},
  {id:'late_scandal', name:'Ticking Time Bomb', icon:'💣',
   desc:"There's a story buried in your past. It will surface at the worst possible moment.",
   apply:()=>{
     GS._scheduledScandal = GS.primaryWeeks - Math.floor(G(3,2));
     addNews('Rumour: Opposition researchers reportedly digging into your past - campaign denies any concerns','scandal');
   }},
  {id:'surprise_endorser', name:'Surprise Celebrity Endorsement', icon:'⭐',
   desc:"A famous face is about to back you publicly - but it will also energise your opponents.",
   apply:()=>{
     GS._surpriseEndorseWeek = 4 + Math.floor(Math.random()*5);
     addNews('Rumour: Major cultural figure reportedly considering high-profile endorsement','campaign');
   }},
  {id:'third_party', name:'Third Party Spoiler', icon:'🌀',
   desc:'An independent candidate is taking 4-6% nationally - mostly from your coalition.',
   apply:()=>{
     GS._thirdPartyDrain = G(4,1.5);
     GS.favorability = cl(GS.favorability - GS._thirdPartyDrain*.4, 20, 85);
     addNews('Independent candidate enters general election - draws support from both major parties','campaign');
   }},
  {id:'media_war', name:'Media Warfare', icon:'📡',
   desc:'A major network is hostile to you from day one. Media coverage starts skewed against you.',
   apply:()=>{
     GS.mediaBias = GS.playerParty==='dem' ? 40 : -40;
     addNews('Media analysis: Coverage patterns already show partisan tilt - your team signals concern','campaign');
   }},
  {id:'funding_crisis', name:'Funding Squeeze', icon:'💸',
   desc:"Your biggest donor bundler just had a legal problem. You start with half the usual war chest.",
   apply:()=>{
     const loss = GS.funds * 0.5;
     GS.funds = cl(GS.funds - loss, 2, 999);
     GS.totalRaised = cl(GS.totalRaised - loss, 2, 999);
     addNews('Breaking: Major campaign donor network reports financial irregularities - fundraising impacted','scandal');
   }},
  {id:'wave_election', name:'Historic Wave Building', icon:'🌊',
   desc:'Early signals suggest a wave election forming. Everything is amplified - wins and losses alike.',
   apply:()=>{
     GS.states.forEach(s=>{ s.vol = cl(s.vol + 0.15, 0.2, 1.0); });
     addNews('Election analysts: "Most volatile political environment in a generation" - all bets are off','poll');
   }},
];

function applyGameTwist(){
  // Pick a twist randomly - store it so players can see what they got
  const twist = CAMPAIGN_TWISTS[Math.floor(Math.random()*CAMPAIGN_TWISTS.length)];
  GS._twist = twist;
  try { twist.apply(); } catch(e){ console.warn('Twist apply error', e); }
}

function renderTwistBadge(){
  const t = GS._twist;
  if(!t) return;
  const el = document.getElementById('mood-display-inner');
  if(!el) return;
  const existing = document.getElementById('twist-badge');
  if(existing) return; // already shown
  const div = document.createElement('div');
  div.id = 'twist-badge';
  div.style.cssText = 'margin-top:6px;padding:7px 10px;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.3);border-radius:var(--radius)';
  div.innerHTML = `<div style="font-weight:700;font-size:11px;color:#a78bfa">${t.icon} ${t.name}</div>
    <div style="font-size:10px;color:var(--text2);margin-top:3px;line-height:1.4">${t.desc}</div>`;
  el.parentElement.appendChild(div);
}

// ═══════════════════════════════════════════════
// SCHEDULED EVENTS FROM TWISTS
// ═══════════════════════════════════════════════
function checkTwistEvents(){
  if(!GS._twist) return;
  // Ticking time bomb scandal
  if(GS._scheduledScandal && GS.week >= GS._scheduledScandal && !GS._scandalFired){
    GS._scandalFired = true;
    const severity = G(7,2);
    GS.favorability = cl(GS.favorability - severity, 20, 85);
    GS.momentum = cl(GS.momentum - 6, -20, 20);
    addNews(`🚨 BOMBSHELL: Long-buried story about ${GS.playerName} breaks nationwide - campaign in full crisis mode`,'scandal');
  }
  // Surprise endorsement
  if(GS._surpriseEndorseWeek && GS.week >= GS._surpriseEndorseWeek && !GS._endorseFired){
    GS._endorseFired = true;
    const boost = G(4,1);
    GS.favorability = cl(GS.favorability + boost, 20, 85);
    GS.momentum = cl(GS.momentum + 5, -20, 20);
    GS.demos.youth = cl(GS.demos.youth + 8, 20, 80);
    const celebs = ['Grammy-winning superstar','Hollywood A-lister','Tech billionaire','Olympic champion','Former president'];
    addNews(`${celebs[Math.floor(Math.random()*celebs.length)]} publicly endorses ${GS.playerName} - social media explodes`,'endorsement');
  }
}

// ═══════════════════════════════════════════════
// SHAREABLE SCORE CARD (for content creators)
// ═══════════════════════════════════════════════
function generateScoreCard(){
  const outcome = GS._electionResult?.won ? '🇺🇸 ELECTED' : '💔 DEFEATED';
  const pEV = GS._finalResult?.finalPlayerEV || 0;
  const oEV = GS._finalResult?.finalOppEV || 0;
  const mood = GS.nationalMood ? NATIONAL_MOODS[GS.nationalMood] : null;
  const twist = GS._twist;
  const compass = computeCompassPosition ? computeCompassPosition() : {x:0,y:0};
  const compassStr = compassLabel ? compassLabel(compass.x, compass.y) : 'Moderate';
  const diffLabel = {easy:'Rookie',normal:'Standard',hard:'Legend'}[GS.difficulty||'easy'];
  return `
<div class="score-card" id="generated-scorecard">
  <div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:${GS._electionResult?.won?'#c8a84b':'#ef4444'};margin-bottom:4px">${outcome}</div>
  <div style="font-family:var(--font-mono);font-size:11px;color:var(--text2);margin-bottom:16px">${GS.playerName} - ${GS.playerParty==='dem'?'Democrat':'Republican'} - ${diffLabel}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
    <div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:9px;color:var(--text3);font-family:var(--font-mono)">EV</div><div style="font-size:22px;font-weight:700;color:var(--accent)">${pEV}</div></div>
    <div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:9px;color:var(--text3);font-family:var(--font-mono)">FAV</div><div style="font-size:22px;font-weight:700">${GS.favorability.toFixed(0)}%</div></div>
    <div style="background:var(--bg3);padding:8px;border-radius:6px"><div style="font-size:9px;color:var(--text3);font-family:var(--font-mono)">RAISED</div><div style="font-size:16px;font-weight:700;color:var(--green)">${fm(GS.totalRaised)}</div></div>
  </div>
  <div style="font-size:10px;color:var(--text2);background:var(--bg3);padding:8px;border-radius:6px;margin-bottom:10px;line-height:1.6">
    <div>🧭 <strong>Political Compass:</strong> ${compassStr}</div>
    ${mood?`<div>${mood.icon} <strong>Election Climate:</strong> ${mood.name}</div>`:''}
    ${twist?`<div>${twist.icon} <strong>Campaign Twist:</strong> ${twist.name}</div>`:''}
    <div>📅 <strong>Weeks Played:</strong> ${GS.week-1} - 🗳 <strong>Delegates:</strong> ${GS.playerDelegates.toLocaleString()}</div>
  </div>
  <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">POTUS - Presidential Election Simulator</div>
</div>`;
}

// ═══════════════════════════════════════════════
// GAME DEV FUNCTIONS (in-game dev panel)
// ═══════════════════════════════════════════════
function showGameDevInfo(){
  const el = document.getElementById('game-dev-state-text');
  if(!el) return;
  if(!GS.phase){ el.innerHTML='<span style="color:#2a3040">No game active.</span>'; return; }
  const pEV = GS.states ? GS.states.filter(s=>s.genLead>0).reduce((s,x)=>s+x.ev,0) : 0;
  el.innerHTML = `Phase: ${GS.phase} - Week: ${GS.week}<br>Fav: ${GS.favorability.toFixed(1)}% - Mom: ${GS.momentum.toFixed(1)}<br>Funds: ${fm(GS.funds)} - Delegates: ${GS.playerDelegates}<br>EV projection: ${pEV} - ${538-pEV}<br>Mood: ${GS.nationalMood||'?'} - Twist: ${GS._twist?.name||'none'}`;
}
function devJumpWeekGame(){
  const t = parseInt(document.getElementById('game-dev-week-jump').value);
  if(isNaN(t)||t<1||!GS.week) return;
  GS.week = t; renderAll(); showGameDevInfo();
  document.getElementById('stat-week').textContent = GS.week;
}
function devSkipToGeneralInGame(){
  if(!GS.week){ alert('Start a game first.'); return; }
  // Fast-forward to general phase
  GS.phase = 'general';
  GS.week = GS.primaryWeeks + 1;
  GS.playerDelegates = GS.delegatesNeeded;
  // Give a VP if none
  if(!GS.vp){
    const vpOpts = GS.playerParty==='dem' ? VP_OPTIONS_DEM : VP_OPTIONS_REP;
    GS.vp = vpOpts[0];
  }
  // Give opponent if none
  if(!GS.opponent){
    GS.opponent = {name:'Gov. R. Thompson', party:GS.playerParty==='dem'?'rep':'dem', funds:38, approval:46, active:true,
      color:GS.playerParty==='dem'?'#ef4444':'#3b82f6', delegates:0};
  }
  GS.aiCandidates = [GS.opponent];
  document.getElementById('primary-content').style.display = 'none';
  document.getElementById('general-content').style.display = '';
  document.getElementById('battleground-section').style.display = 'block';
  document.getElementById('center-blocs-section').style.display = 'block';
  const congressEl2=document.getElementById('congress-tracker'); if(congressEl2) congressEl2.style.display='block';
  initCongressTracker();
  addNews('DEV: Skipped to general election phase', 'campaign');
  renderAll(); showGameDevInfo();
}

// ═══════════════════════════════════════════════
// CONGRESS TRACKER - Senate & House (General Election)
// ═══════════════════════════════════════════════
const SENATE_BASE = {
  dem: 47, rep: 53,
  tossups: ['AZ','MT','NV','OH','PA','WI'],
};
const HOUSE_BASE = {
  dem: 210, rep: 225,
  tossup_count: 30,
};
let _congressState = null;

function initCongressTracker(){
  // FIX: Use real historical seat data when set by game-historical.js,
  // otherwise derive from environment as before.
  let sBase, hBase;
  if(GS.houseSeats && GS.senateSeats){
    // Historical mode - use accurate pre-election seat counts
    sBase = { dem: GS.senateSeats.dem, rep: GS.senateSeats.rep };
    hBase = { dem: GS.houseSeats.dem,  rep: GS.houseSeats.rep  };
  } else {
    // Career mode - derive from player party & national mood
    const isBadEnv  = GS.nationalMood && ['recession','backlash','scandal_env'].includes(GS.nationalMood);
    const isGoodEnv = GS.nationalMood && ['wave','enthusiasm'].includes(GS.nationalMood);
    const partyFavour = (GS.playerParty==='dem' ? 1 : -1) * (isGoodEnv ? 2 : isBadEnv ? -2 : 0);
    sBase = { dem: 47 + partyFavour, rep: 53 - partyFavour };
    hBase = { dem: 210 + partyFavour * 2, rep: 225 - partyFavour * 2 };
  }

  _congressState = {
    senate: { ...sBase },
    house:  { ...hBase },
  };
  renderCongressTracker();
  GS._congressInitialized = true;
}

function updateCongressTracker(){
  if(!_congressState) return;
  // Shift senate/house based on player performance (lead)
  const playerEV = GS.states ? GS.states.filter(s=>s.genLead>0).reduce((s,x)=>s+x.ev,0) : 269;
  const isLeading = playerEV >= 270;
  const partyDir = GS.playerParty==='dem' ? 1 : -1;

  if(isLeading){
    // If player is doing well, coattail effect nudges congressional seats
    _congressState.senate.dem = Math.min(51, _congressState.senate.dem + partyDir * G(0.3,0.1));
    _congressState.senate.rep = 100 - _congressState.senate.dem;
    _congressState.house.dem = Math.min(218, _congressState.house.dem + partyDir * G(1.2,0.5));
    _congressState.house.rep = 435 - _congressState.house.dem;
  } else {
    // Opposition coattails
    _congressState.senate.dem = Math.max(43, _congressState.senate.dem - partyDir * G(0.3,0.1));
    _congressState.senate.rep = 100 - _congressState.senate.dem;
    _congressState.house.dem = Math.max(200, _congressState.house.dem - partyDir * G(1.2,0.5));
    _congressState.house.rep = 435 - _congressState.house.dem;
  }
  renderCongressTracker();
}

function renderCongressTracker(){
  if(!_congressState) return;
  const s = _congressState.senate;
  const h = _congressState.house;
  const sDem = Math.round(s.dem), sRep = Math.round(s.rep);
  const hDem = Math.round(h.dem), hRep = Math.round(h.rep);

  const el = id => document.getElementById(id);
  if(el('senate-dem-seats')) el('senate-dem-seats').textContent = sDem;
  if(el('senate-rep-seats')) el('senate-rep-seats').textContent = sRep;
  if(el('house-dem-seats'))  el('house-dem-seats').textContent  = hDem;
  if(el('house-rep-seats'))  el('house-rep-seats').textContent  = hRep;

  // Bar widths: show as share of decided seats only (no tossups displayed)
  const sDecided = Math.max(sDem + sRep, 1);
  if(el('senate-bar-dem')) el('senate-bar-dem').style.width = (sDem/sDecided*100).toFixed(1)+'%';
  if(el('senate-bar-rep')) el('senate-bar-rep').style.width = (sRep/sDecided*100).toFixed(1)+'%';

  const hDecided = Math.max(hDem + hRep, 1);
  if(el('house-bar-dem')) el('house-bar-dem').style.width = (hDem/hDecided*100).toFixed(1)+'%';
  if(el('house-bar-rep')) el('house-bar-rep').style.width = (hRep/hDecided*100).toFixed(1)+'%';
}

applyPolicyChange;

function applyPolicyToGame(){
  const boostStrength = 3; // pts added to genLead in boosted states
  const hurtStrength  = 3;
  const enthTotal = Object.entries(GS_POLICY).reduce((sum,[k,v])=>{
    return sum + (POLICY_DEFS[k]?.choices?.[v]?.enthusiasm||0);
  }, 0);
  const elecTotal = Object.entries(GS_POLICY).reduce((sum,[k,v])=>{
    return sum + (POLICY_DEFS[k]?.choices?.[v]?.electability||0);
  }, 0);
  GS._enthusiasm = cl((GS._enthusiasm||50) + enthTotal, 20, 90);
  GS.electability = cl((GS.electability||55) + elecTotal, 10, 100);

  // Boost/hurt states in the general election map
  const boostSet = {}, hurtSet = {};
  Object.entries(GS_POLICY).forEach(([k,v])=>{
    const ch = POLICY_DEFS[k]?.choices?.[v];
    if(!ch) return;
    ch.boostStates.forEach(code=>{ boostSet[code]=(boostSet[code]||0)+boostStrength; });
    ch.hurtStates.forEach(code=>{ hurtSet[code]=(hurtSet[code]||0)+hurtStrength; });
  });
  GS.states.forEach(s=>{
    if(boostSet[s.code]) s.genLead = cl(s.genLead + boostSet[s.code], -60, 60);
    if(hurtSet[s.code])  s.genLead = cl(s.genLead - hurtSet[s.code], -60, 60);
  });
  // Store for debate system
  GS._policyDebateBonus = Object.entries(GS_POLICY).reduce((sum,[k,v])=>{
    return sum + (POLICY_DEFS[k]?.choices?.[v]?.debateBonus||0);
  }, 0);
}

// Mid-game policy modal
function openPolicyModal(){
  // Allow during any phase
  _policyStaged = {...GS_POLICY};
  renderPolicyModal();
  document.getElementById('policy-modal').classList.add('active');
}
function renderPolicyModal(){
  const c = document.getElementById('policy-modal-content');
  if(!c) return;
  c.innerHTML = Object.entries(POLICY_DEFS).map(([key,pol])=>`
    <div class="policy-section">
      <div class="policy-label"><span>${pol.icon}</span> ${pol.label}</div>
      <div class="policy-choices">
        ${Object.entries(pol.choices).map(([ckey,ch])=>`
          <button class="policy-choice${(_policyStaged||GS_POLICY)[key]===ckey?' selected':''}"
            onclick="stagePolicyChange('${key}','${ckey}')"
            onmouseover="showPolicyPreview('${key}','${ckey}','policy-modal-preview')"
            onmouseout="clearPolicyPreview('policy-modal-preview')">
            <span class="policy-choice-name">${ch.name}</span>
            <span class="policy-choice-hint">${ch.hint}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');
}
function stagePolicyChange(category, choiceKey){
  if(!_policyStaged) _policyStaged = {...GS_POLICY};
  _policyStaged[category] = choiceKey;
  renderPolicyModal();
}
function applyPolicyChange(){
  if(!_policyStaged) return;
  const changed = Object.keys(GS_POLICY).filter(k=>GS_POLICY[k]!==_policyStaged[k]);
  if(changed.length === 0){ closeModal('policy-modal'); return; }
  const cost = 3 * changed.length;
  if(GS.funds < cost){
    alert(`Not enough funds. Need $${cost}M to change ${changed.length} stance${changed.length>1?'s':''}.`);
    return;
  }
  // Apply changes
  GS.funds -= cost;
  GS.totalRaised = Math.max(GS.totalRaised, GS.funds);
  // Reversal penalty: switching mid-campaign costs favorability
  const penalty = changed.length * G(2,1);
  GS.favorability = cl(GS.favorability - penalty, 20, 85);
  GS.momentum = cl(GS.momentum - 1.5, -20, 20);
  // Re-apply state effects for changed stances
  changed.forEach(k=>{
    const oldCh = POLICY_DEFS[k]?.choices?.[GS_POLICY[k]];
    const newCh = POLICY_DEFS[k]?.choices?.[_policyStaged[k]];
    if(oldCh){
      oldCh.boostStates.forEach(code=>{ const s=GS.states.find(x=>x.code===code); if(s) s.genLead=cl(s.genLead-3,-60,60); });
      oldCh.hurtStates.forEach(code=>{ const s=GS.states.find(x=>x.code===code); if(s) s.genLead=cl(s.genLead+3,-60,60); });
    }
    if(newCh){
      newCh.boostStates.forEach(code=>{ const s=GS.states.find(x=>x.code===code); if(s) s.genLead=cl(s.genLead+3,-60,60); });
      newCh.hurtStates.forEach(code=>{ const s=GS.states.find(x=>x.code===code); if(s) s.genLead=cl(s.genLead-3,-60,60); });
    }
  });
  GS_POLICY = {..._policyStaged};
  _policyStaged = null;
  addNews(`Campaign shifts stance on ${changed.map(k=>POLICY_DEFS[k].label).join(', ')} - media questions flip-flop`,'scandal');
  renderAll();
  closeModal('policy-modal');
}
