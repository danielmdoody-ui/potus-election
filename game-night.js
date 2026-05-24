// ── game-night.js ── Election Night Broadcast System
// ── ELECTION NIGHT BROADCAST ──
const EN_SCHEDULE = [
  // Real-life poll closing times.
  {t:'7:00 PM',  d:0,      states:['IN','KY','VT']},
  {t:'7:30 PM',  d:12000,  states:['SC','VA','WV']},
  {t:'8:00 PM',  d:26000,  states:['CT','DE','IL','MD','MA','ME','NJ','NH','RI','TN','AL','MS']},
  {t:'8:30 PM',  d:42000,  states:['FL','OH','NC']},
  {t:'9:00 PM',  d:60000,  states:['CO','KS','LA','MN','MO','NE','NM','NY','ND','SD','TX','WY','DC']},
  {t:'9:00 PM',  d:60000,  states:[]},
  {t:'9:30 PM',  d:80000,  states:['AR','OK','IA']},
  {t:'10:00 PM', d:100000, states:['GA','PA','MI','WI']},
  {t:'10:30 PM', d:120000, states:['UT','MT','ID','OR']},
  {t:'11:00 PM', d:138000, states:['CA','WA','AZ','NV','AK']},
  {t:'12:00 AM', d:155000, states:['HI']},
];

// Swing states that should often go "too close to call" first
const SWING_STATES = new Set(['FL','GA','PA','MI','WI','AZ','NV','NC','OH','VA','ME','NH','MN','CO']);
function _isSwingStateEN(code){
  if(typeof isSwingState === 'function'){
    try { return !!isSwingState(code); } catch(e) {}
  }
  return SWING_STATES.has(code);
}

let EN = { demEV:0, repEV:0, called:{}, ctc:new Set(), timers:[] };

function _safeColor(col, fallback){
  if(typeof col !== 'string') return fallback;
  const v = col.trim();
  // Accept hex/rgb/hsl/css vars to avoid style assignment failures.
  if(v.startsWith('#') || v.startsWith('rgb(') || v.startsWith('rgba(') || v.startsWith('hsl(') || v.startsWith('hsla(') || v.startsWith('var(')){
    return v;
  }
  return fallback;
}

function showResult(){
  // Compute final outcomes: genLead + hidden polling error (set at game start) + last-minute variance
  // The _pollError was baked in secretly - this is where the "surprise" happens
  GS.states.forEach(s=>{
    const pollErr = s._pollError || G(0, s.vol*3);
    const lastMinute = G(0, s.vol * 2.5); // small election-day variance on top
    // Apply mood turnout effect: high turnout moods boost close states for more-enthusiastic side
    const moodTurnout = (GS._turnoutMod||0) * 0.04; // e.g. +15% turnout = +0.6 pts in swing states
    const closeFactor = Math.max(0, 1 - Math.abs(s.genLead)/20); // only affects close states
    const turnoutLead = GS._enthusiasm>55 ? moodTurnout*closeFactor : -moodTurnout*closeFactor*0.5;
    s.finalLead = s.genLead + pollErr + lastMinute + turnoutLead;
  });
  _launchEN();
}

function _launchEN(){
  showScreen('electionnight-screen');
  EN = { demEV:0, repEV:0, indPlayerEV:0, thirdEV:0, called:{}, ctc:new Set(), timers:[], playerPop:0, oppPop:0, oppPopMap:{},
         queue:[], queueIndex:0, winnerShown:false, _ctcQueue:[], _retractionCandidates:[] };

  buildENMap();
  initENCongressBoard();
  _enAnchor = null; // reset anchor for new election night

  // Show early vote report immediately
  showEarlyVoteReport();

  const pName = GS.playerName.split(' ').slice(-1)[0];
  const oName = GS.opponent.name.split(' ').slice(-1)[0];
  const pLabel = GS.playerParty==='dem' ? `${pName} (D)` : GS.playerParty==='rep' ? `${pName} (R)` : `${pName} (${GS.playerPartyIcon||'⚡'})`;
  const oLabel = GS.playerParty==='dem' ? `${oName} (R)` : GS.playerParty==='rep' ? `${oName} (D)` : `${oName} (R)`;
  const thirdWrap = document.getElementById('en-third-wrap');
  const thirdNameEl = document.getElementById('en-third-name');
  const thirdEvEl = document.getElementById('en-ev-third');
  const demNameEl = document.getElementById('en-dem-name');
  const repNameEl = document.getElementById('en-rep-name');
  if(thirdEvEl){ thirdEvEl.textContent = '0'; thirdEvEl.style.textShadow = 'none'; }
  if(GS.playerParty==='dem'){
    if(demNameEl){ demNameEl.textContent = pLabel; demNameEl.style.color = '#3b82f6'; }
    if(repNameEl){ repNameEl.textContent = oLabel; repNameEl.style.color = '#ef4444'; }
    if(thirdWrap) thirdWrap.style.display = 'none';
  } else if(GS.playerParty==='rep'){
    if(demNameEl){ demNameEl.textContent = oLabel; demNameEl.style.color = '#3b82f6'; }
    if(repNameEl){ repNameEl.textContent = pLabel; repNameEl.style.color = '#ef4444'; }
    if(thirdWrap) thirdWrap.style.display = 'none';
  } else {
    // Ind/custom: show all 3 candidates directly in the top EV counter.
    if(thirdWrap) thirdWrap.style.display = 'flex';
    const playerColor = GS.playerPartyColor || '#a855f7';
    if(demNameEl){ demNameEl.textContent = pLabel; demNameEl.style.color = playerColor; }
    const repOppName = GS.opponent?.name?.split(' ').slice(-1)[0] || 'Republican';
    const demOppName = GS._indDemOpp?.name?.split(' ').slice(-1)[0] || 'Democrat';
    if(repNameEl){ repNameEl.textContent = `${demOppName} (D)`; repNameEl.style.color = '#3b82f6'; }
    if(thirdNameEl){ thirdNameEl.textContent = `${repOppName} (R)`; thirdNameEl.style.color = '#f87171'; }
    const remEl = document.getElementById('en-ev-remaining');
    if(remEl){
      remEl.textContent = `538 EV remaining`;
      remEl.style.color = '#a78bfa';
    }
  }
  const remElBase = document.getElementById('en-ev-remaining');
  if(remElBase && GS.playerParty!=='ind'){
    remElBase.textContent = '538 EV remaining';
    remElBase.style.color = '';
  }

  // Build the full ordered queue of state calls from the schedule
  EN_SCHEDULE.forEach(batch=>{
    batch.states.forEach(code=>{
      EN.queue.push({code, batchTime: batch.t});
    });
  });

  // Reset TTC queues
  EN._ctcQueue = [];
  // Show button immediately - player drives everything
  const nextBtn = document.getElementById('en-next-btn');
  nextBtn.style.display='flex';
  nextBtn.textContent = '▶ Call Next State';
  nextBtn.disabled = false;
  nextBtn.onclick = callNextState;
  _enBusy = false;
}

// ── ELECTION NIGHT: fully button-driven, no auto-resolution ──
// Each press of the button does EXACTLY one thing.
// TTC states are queued and resolved one per press AFTER the main queue clears.

let _enBusy = false; // debounce: prevent double-click cascades

function callNextState(){
  if(_enBusy) return;
  _enBusy = true;
  setTimeout(()=>{ _enBusy=false; }, 350); // cooldown between calls

  const btn = document.getElementById('en-next-btn');
  const skipBtn = document.getElementById('en-skip-btn');

  // ── Retraction check: fire before next call if a close call is pending ──
  const retractionPool = EN._retractionCandidates || [];
  if(retractionPool.length > 0){
    const candidate = retractionPool.shift();
    EN._retractionCandidates = retractionPool;
    const { code, s } = candidate;
    // Only retract if the call is still standing, race is close, and random chance fires
    const totalDiff = Math.abs(EN.demEV - EN.repEV);
    if(EN.called[code] && totalDiff <= 40 &&
       Math.random() < (typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.retractionChance : 0.20)){
      maybeUncallState(code, s);
      _enBusy = false;
      return; // Show the retraction this press; player clicks again to continue
    }
  }

  // ── Phase 1: main queue still has uncalled states ──
  if(EN.queueIndex < EN.queue.length){
    // Advance index until we find a state not yet called (skip pre-resolved TTC)
    let entry = null;
    while(EN.queueIndex < EN.queue.length){
      const candidate = EN.queue[EN.queueIndex++];
      if(!EN.called[candidate.code]){
        entry = candidate;
        break;
      }
      // Already called (was TTC, now resolved) - update clock and continue
      document.getElementById('en-clock-time').textContent = candidate.batchTime;
    }
    if(!entry){
      // All non-TTC states processed - fall through to Phase 2
      // Use setTimeout to avoid call stack overflow when many states are pre-resolved
      _enBusy = false;
      setTimeout(callNextState, 0);
      return;
    }

    const {code, batchTime} = entry;
    document.getElementById('en-clock-time').textContent = batchTime;

    const s = GS.states.find(x=>x.code===code);
    if(!s){ _enBusy=false; setTimeout(callNextState, 0); return; }

    const lead = s.finalLead;
    const playerWins = lead > 0;
    const isSwing = _isSwingStateEN(code);
    const isDesignatedTossup = (typeof isDesignatedTossupState === 'function') ? isDesignatedTossupState(code) : Math.abs(s.lean) <= 2;
    const margin = Math.abs(lead);
    const _indPEV3 = EN.indPlayerEV || 0;
    const _isInd3  = (typeof isIndependentRun === 'function') ? isIndependentRun() : (GS.playerParty === 'ind');
    const _pEV3    = _isInd3 ? _indPEV3 : (GS.playerParty==='dem' ? EN.demEV : EN.repEV);
    const _oEV3    = _isInd3 ? Math.max(EN.demEV,EN.repEV) : (_pEV3===EN.demEV ? EN.repEV : EN.demEV);
    const bothClose = _pEV3 >= 230 && _oEV3 >= 230;
    const volAdj = Math.max(0, Math.min(2.2, (s.vol || 0.45) * 3.2));
    const swingAdj = isSwing ? 1.2 : 0;
    const ctcCut = (GAME_CONFIG.ctcMarginThreshold || 6) + volAdj + swingAdj + (isDesignatedTossup ? 2.5 : -2);
    const ctcBothCut = (GAME_CONFIG.ctcBothCloseThreshold || 10) + volAdj;
    const ctcQueueCount = (EN._ctcQueue||[]).length;
    const canAssignTossup = isDesignatedTossup && ctcQueueCount < 10;
    const useCtc = canAssignTossup && (margin < ctcCut || (bothClose && margin < ctcBothCut));

    if(useCtc && !EN.ctc.has(code)){
      // Mark TTC - visual only, queue for manual resolution later
      EN.ctc.add(code);
      addENFeedItem(code, s, 'ctc');
      paintENState(code, 'ctc');
      showTCTCPopup(code, s);
      EN._ctcQueue = EN._ctcQueue || [];
      EN._ctcQueue.push({code, s, playerWins});
    } else if(!EN.ctc.has(code)){
      // Normal call
      finalCallState(code, s, playerWins);
      // Show projected winner banner mid-race (not final yet)
      const _indPEV2 = EN.indPlayerEV || 0;
      const _isInd2  = GS.playerParty === 'ind';
      const _pEV2    = _isInd2 ? _indPEV2 : (GS.playerParty==='dem' ? EN.demEV : EN.repEV);
      const _oEV2    = _isInd2 ? Math.max(EN.demEV, EN.repEV) : (_pEV2===EN.demEV ? EN.repEV : EN.demEV);
      if(!EN.winnerShown && (_pEV2>=270 || _oEV2>=270)){
        EN.winnerShown = true;
        const playerClinched = _pEV2 >= 270;
        const clinchName = playerClinched ? GS.playerName.split(' ').slice(-1)[0] : GS.opponent.name.split(' ').slice(-1)[0];
        const clinchEV   = playerClinched ? _pEV2 : _oEV2;
        const overlay = document.getElementById('en-anchor-overlay');
        if(overlay){
          const anchor = getENAnchor();
          overlay.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;background:rgba(0,0,0,.9);border:1px solid rgba(255,255,255,.2);border-left:4px solid ${playerClinched?'#c8a84b':'#ef4444'};border-radius:8px;max-width:440px;box-shadow:0 4px 32px rgba(0,0,0,.6)">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#1e2535;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px">📺</div>
            <div>
              <div style="font-family:var(--font-mono);font-size:8px;color:#6b7280;letter-spacing:.12em;margin-bottom:4px">${anchor.network} - ${anchor.name}</div>
              <div style="font-size:13px;color:#e8ecf4;line-height:1.5;font-style:italic;font-weight:600">"${anchor.network} can now project - ${clinchName} will be the next President of the United States, with ${clinchEV} electoral votes."</div>
            </div>
          </div>`;
          overlay.style.display='block'; overlay.style.opacity='1';
          clearTimeout(EN._anchorTimer);
          EN._anchorTimer = setTimeout(()=>{ overlay.style.opacity='0'; setTimeout(()=>overlay.style.display='none', 400); }, 9000);
        }
        setTimeout(()=>showENWinner(false), 1200);
      }
    }

    // Update button for remaining main queue - never show "Final Results" until truly done
    const remaining = EN.queue.length - EN.queueIndex;
    const ctcCount = (EN._ctcQueue||[]).length;
    if(remaining > 0){
      btn.textContent = `▶ Call Next State (${remaining} left)`;
      btn.onclick = callNextState;
    } else if(ctcCount > 0){
      btn.textContent = `⚖️ Decide: Too Close to Call (${ctcCount} remaining)`;
      btn.onclick = callNextState;
    } else {
      // All states called - transition to single final button
      _showFinalButton(btn, skipBtn);
    }
    return;
  }

  // ── Phase 2: main queue exhausted - resolve TTC one at a time ──
  const ctcQueue = EN._ctcQueue || [];
  if(ctcQueue.length > 0){
    const {code, s, playerWins} = ctcQueue.shift();
    EN.ctc.delete(code);
    finalCallState(code, s, playerWins);
    const _indPEV5 = EN.indPlayerEV || 0;
    const _isInd5  = GS.playerParty==='ind';
    const _pEV5    = _isInd5 ? _indPEV5 : (GS.playerParty==='dem' ? EN.demEV : EN.repEV);
    const _oEV5    = _isInd5 ? Math.max(EN.demEV,EN.repEV) : (_pEV5===EN.demEV ? EN.repEV : EN.demEV);
    if(!EN.winnerShown && (_pEV5>=270 || _oEV5>=270)){
      EN.winnerShown = true;
      setTimeout(()=>showENWinner(false), 1200);
    }
    if(ctcQueue.length > 0){
      btn.textContent = `⚖️ Decide: Too Close to Call (${ctcQueue.length} remaining)`;
      btn.onclick = callNextState;
    } else {
      // All states resolved - show single final button
      _showFinalButton(btn, skipBtn);
    }
    return;
  }

  // ── Phase 3: everything resolved ──
  _showFinalButton(btn, skipBtn);
}

// ── Centralised "final state" button handler ──────────────────────────
// Called once all states are called. Shows ONE "See Final Results" button
// and hides the skip button (so there's never two buttons doing the same thing).
function _showFinalButton(btn, skipBtn){
  if(skipBtn) skipBtn.style.display = 'none';
  const bannerBtn = document.querySelector('#en-winner-banner .en-winner-btn');
  if(bannerBtn) bannerBtn.style.display = 'none';
  btn.disabled = false;
  btn.style.display = 'flex';
  _enBusy = false;
  btn.textContent = '🏁 View Final Results';
  btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';

  const sim = window._SIM;
  const thirdHasEV = (EN.thirdEV||0) > 0;
  const noMajority = thirdHasEV && EN.demEV < 270 && EN.repEV < 270;

  if(noMajority){
    // Override the button for contingent election
    btn.textContent = '🏛 No Majority - Contingent Election';
    btn.style.background = 'linear-gradient(135deg,#7c3aed,#4c1d95)';
    btn.onclick = () => { buildContingentModal(); showContingentElectionModal(sim); };
    if(!EN.winnerShown){
      EN.winnerShown = true;
      // Show "no majority" banner
      setTimeout(()=>{
        const banner = document.getElementById('en-winner-banner');
        const title = document.getElementById('en-winner-title');
        const sub = document.getElementById('en-winner-sub');
        const evEl = document.getElementById('en-winner-ev');
        if(banner && title){
          title.textContent = '🏛 NO MAJORITY REACHED';
          title.style.color = '#a78bfa';
          sub.textContent = 'No candidate won 270 electoral votes - Congress must decide';
          evEl.textContent = `${GS.playerName.split(' ').slice(-1)[0]}: ${sim?.demEV||EN.demEV} - ${GS.opponent.name.split(' ').slice(-1)[0]}: ${sim?.repEV||EN.repEV} - ${sim?.thirdName||'Independent'}: ${EN.thirdEV}`;
          evEl.style.color = '#a78bfa';
          banner.classList.add('show');
        }
      }, 800);
    }
  } else {
    btn.onclick = finishElectionNight;
    btn.setAttribute('onclick','finishElectionNight()');
    if(!EN.winnerShown){
      EN.winnerShown = true;
      setTimeout(()=>showENWinner(true), 800);
    }
  }
}

function callState(code){ callNextState(); } // legacy compat

function finalCallState(code, s, playerWins){
  // Track whether state flipped vs its HISTORICAL lean (not current poll lead)
  const playerIsDem = GS.playerParty === 'dem';
  const historicallyPlayerState  = playerIsDem ? s.lean > 5 : s.lean < -5;
  const historicallyOpponentState = playerIsDem ? s.lean < -5 : s.lean > 5;
  s._wasLeadingPlayer   = historicallyPlayerState;
  s._wasLeadingOpponent = historicallyOpponentState;

  if(EN.called[code]) return;

  // Check for third-party win BEFORE marking called
  const simState = window._SIM?.states?.find(st=>st.code===code);
  const isThirdWin = simState?.thirdWins || false;

  if(isThirdWin){
    EN.called[code] = 'third';
    EN.thirdEV = (EN.thirdEV||0) + s.ev;
    paintENState(code, 'third');
    addENFeedItem(code, s, 'third');
    updateENCounter();
    // Show a proper state call popup for third party
    showThirdPartyStatePopup(code, s);
    // Flash headline
    flashENHeadline(code, s, false, true);
    // Check if anchor commentary needed
      if(s.ev >= 10 || _isSwingStateEN(code)){
      const anchor = getENAnchor();
      const thirdName = window._SIM?.thirdName || 'Independent';
      const overlay = document.getElementById('en-anchor-overlay');
      if(overlay){
        overlay.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(0,0,0,.88);border:1px solid rgba(255,255,255,.15);border-left:3px solid #a78bfa;border-radius:8px;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.5)">
          <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#1e2535;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px">📺</div>
          <div>
            <div style="font-family:var(--font-mono);font-size:8px;color:#6b7280;letter-spacing:.12em;margin-bottom:3px">${anchor.network} - ${anchor.name}</div>
            <div style="font-size:12px;color:#e8ecf4;line-height:1.5;font-style:italic">"${s.name} goes to ${thirdName}. ${s.ev} electoral votes out of reach for both major parties. Remarkable night."</div>
          </div>
        </div>`;
        overlay.style.display='block'; overlay.style.opacity='1';
        clearTimeout(EN._anchorTimer);
        EN._anchorTimer = setTimeout(()=>{ overlay.style.opacity='0'; setTimeout(()=>overlay.style.display='none', 400); }, 5000);
      }
    }
    // Check for no-270 condition after every third party call
    const totalCalled = Object.keys(EN.called).length;
    const totalStates = GS.states.length;
    if(totalCalled >= totalStates - (EN._ctcQueue||[]).length){
      // All normal states called - check if no one has 270
      const _indPEV4 = EN.indPlayerEV || 0;
      const _noMajCheck = (GS.playerParty==='ind') ? (_indPEV4 < 270 && EN.demEV < 270 && EN.repEV < 270) : (EN.demEV < 270 && EN.repEV < 270 && (EN.thirdEV||0) > 0);
      if(_noMajCheck && !EN._noMajorityFlagged){
        EN._noMajorityFlagged = true;
        const ticker = document.getElementById('en-ticker-inner');
        if(ticker){
          const t = `⚡ NO CANDIDATE HAS REACHED 270 - CONTINGENT ELECTION POSSIBLE`;
          EN._tickerItems = EN._tickerItems || [];
          EN._tickerItems.unshift(t);
          ticker.textContent = EN._tickerItems.join('   -   DECISION DESK -   ');
        }
      }
    }
    return;
  }

  EN.called[code] = playerWins ? 'player' : 'opponent';
  const isInd = GS.playerParty === 'ind';

  let isDem, paintClass;
  if(isInd){
    if(playerWins){
      // Ind player wins state - track in dedicated counter
      EN.indPlayerEV = (EN.indPlayerEV || 0) + s.ev;
      isDem = false;
      paintClass = 'ind';
    } else {
      // Player loses - route to whichever opponent scores best for this state
      // getBestOpponent uses approval + partisan-lean affinity so this works for N candidates
      const bestOpp = (typeof getBestOpponent === 'function') ? getBestOpponent(s) : null;
      const demWins = bestOpp ? bestOpp.party === 'dem' : (s.lean >= 0);
      isDem = demWins;
      paintClass = demWins ? 'dem' : 'rep';
      if(demWins) EN.demEV += s.ev;
      else        EN.repEV += s.ev;
    }
  } else {
    isDem = (GS.playerParty==='dem') ? playerWins : !playerWins;
    if(isDem) EN.demEV += s.ev;
    else EN.repEV += s.ev;
    paintClass = isDem ? 'dem' : 'rep';
  }

  // Track popular vote
  const totalVotes = Math.round(s.ev * 260000 + Math.random()*s.ev*60000);
  const winPct = cl(50 + Math.abs(s.finalLead)/2, 50.1, 71);
  const winV = Math.round(totalVotes*winPct/100), loseV = totalVotes - winV;
  if(playerWins){
    EN.playerPop += winV; EN.oppPop += loseV;
  } else {
    EN.oppPop += winV; EN.playerPop += loseV;
    // Per-opponent popular vote tracking
    const oppWinner = (typeof getBestOpponent==='function') ? getBestOpponent(s) : null;
    if(oppWinner){
      const oppKey = oppWinner.id || oppWinner.name;
      EN.oppPopMap[oppKey] = (EN.oppPopMap[oppKey]||0) + winV;
    }
  }
  s._totalVotes = totalVotes; s._winPct = winPct;

  paintENState(code, paintClass);
  addENFeedItem(code, s, paintClass);
  updateENCounter();
  showStateCallPopup(code, s, isDem, playerWins);
  updateENCongressBoard(isDem, s.ev);

  // Update popular vote display
  const pvEl = document.getElementById('en-pop-vote');
  if(pvEl && (EN.playerPop+EN.oppPop)>0){
    const tot = EN.playerPop+EN.oppPop;
    const pPct = (EN.playerPop/tot*100).toFixed(1);
    const pName = GS.playerName.split(' ').slice(-1)[0];
    const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
    const isMulti = opps.length >= 2;
    if(isMulti){
      // Build a line per opponent using their individual oppPopMap bucket
      const oppLines = opps.map(o=>{
        const key = o.id || o.name;
        const votes = EN.oppPopMap[key] || 0;
        const pct = tot>0 ? (votes/tot*100).toFixed(1) : '0.0';
        const col = o.color || (o.party==='dem'?'#60a5fa':'#f87171');
        const label = o.name.split(' ').pop();
        return `<span style="color:${col}">${label}</span> <span style="color:#e8ecf4;font-weight:600">${votes.toLocaleString()}</span> (${pct}%)`;
      }).join('<br>');
      pvEl.innerHTML = `${pName} <span style="color:#e8ecf4;font-weight:600">${EN.playerPop.toLocaleString()}</span> (${pPct}%)<br>${oppLines}`;
    } else {
      const oPct = (EN.oppPop/tot*100).toFixed(1);
      const oName = (opps[0]||GS.opponent).name.split(' ').slice(-1)[0];
      pvEl.innerHTML = `${pName} <span style="color:#e8ecf4;font-weight:600">${EN.playerPop.toLocaleString()}</span> (${pPct}%)<br>${oName} <span style="color:#e8ecf4;font-weight:600">${EN.oppPop.toLocaleString()}</span> (${oPct}%)`;
    }
    pvEl.style.color = parseFloat(pPct)>50 ? (GS.playerParty==='dem'?'#60a5fa':'#f87171') : (GS.playerParty==='dem'?'#f87171':'#60a5fa');
  }

  // If winner banner is showing, update EV live
  if(EN.winnerShown){
    const _isIndW = GS.playerParty === 'ind';
    const playerIsDem = GS.playerParty==='dem';
    const pEV = _isIndW ? (EN.indPlayerEV||0) : (playerIsDem ? EN.demEV : EN.repEV);
    const oEV = _isIndW ? Math.max(EN.demEV,EN.repEV) : (playerIsDem ? EN.repEV : EN.demEV);
    const evEl = document.getElementById('en-winner-ev');
    if(evEl) evEl.textContent = `${pEV} - ${oEV} Electoral Votes`;
  }

  // Flash headline in news ticker
  flashENHeadline(code, s, playerWins);

  // Flag for potential retraction - will be checked on next button press (not a random timer)
  if(Math.abs(s.finalLead) < 0.8){
    EN._retractionCandidates = EN._retractionCandidates || [];
    EN._retractionCandidates.push({code, s});
  }
}

function flashENHeadline(code, s, playerWins, isThirdParty=false){
  const ticker = document.getElementById('en-news-ticker');
  const inner = document.getElementById('en-ticker-inner');
  if(!ticker || !inner) return;
  ticker.style.display='flex';
  const sim = window._SIM;
  const thirdName = sim?.thirdName || 'Independent';
  const winName = isThirdParty ? thirdName :
    playerWins ? GS.playerName.split(' ').slice(-1)[0] : GS.opponent.name.split(' ').slice(-1)[0];
  const margin = Math.abs(s.finalLead);
  const headlines = [
    `${winName.toUpperCase()} WINS ${s.name.toUpperCase()} - ${s.ev} ELECTORAL VOTES`,
    margin<2?`RAZOR-THIN MARGIN IN ${s.name.toUpperCase()} - VOTE-COUNTING CONTINUES`:
    margin<5?`NARROW VICTORY FOR ${winName.toUpperCase()} IN ${s.name.toUpperCase()}`:
    `${winName.toUpperCase()} CLAIMS ${s.name.toUpperCase()} WITH ${margin.toFixed(1)}% LEAD`,
  ];
  const h = headlines[~~(Math.random()*headlines.length)];
  // Update broadcast header headline - anchor commentary on big states
  const headlineEl = document.getElementById('en-headline-main');
  if(headlineEl){
    headlineEl.textContent = h;
    // For high-EV states, show anchor commentary overlay
  if(s.ev >= 15 || _isSwingStateEN(code)){
      showAnchorCommentary(code, s, playerWins);
    }
  }
  // Add to rotating ticker
  EN._tickerItems = EN._tickerItems || [];
  EN._tickerItems.push(h);
  if(EN._tickerItems.length > 8) EN._tickerItems.shift();
  inner.textContent = EN._tickerItems.join('   -   DECISION DESK -   ');
  // Reset animation
  inner.style.animation='none';
  inner.offsetHeight; // reflow
  inner.style.animation='ticker 30s linear infinite';
}

// ─── LIVE ANCHORS ────────────────────────────────────────────────────────────
const EN_ANCHORS = [
  { name: 'Dana Westbrook', network: 'CNN', style: 'analytical' },
  { name: 'Tom Rafferty',   network: 'NBC', style: 'dramatic'   },
  { name: 'Priya Shah',     network: 'ABC', style: 'measured'   },
  { name: 'Bill Hartwell',  network: 'FOX', style: 'conservative'},
  { name: 'Rachel Monroe',  network: 'MSNBC', style: 'progressive'},
];

// Pick anchor for tonight
let _enAnchor = null;
function getENAnchor(){
  if(!_enAnchor) _enAnchor = EN_ANCHORS[Math.floor(Math.random() * EN_ANCHORS.length)];
  return _enAnchor;
}

function showAnchorCommentary(code, s, playerWins){
  const anchor = getENAnchor();
  const pName = GS.playerName.split(' ').slice(-1)[0];
  const oName = GS.opponent.name.split(' ').slice(-1)[0];
  const winName = playerWins ? pName : oName;
  const loseName = playerWins ? oName : pName;
  const margin = Math.abs(s.finalLead);
  const isSwing = _isSwingStateEN(code);
  const isFlip = s._wasLeadingOpponent && playerWins; // surprise player flip
  const isFlipBad = s._wasLeadingPlayer && !playerWins; // surprise opponent flip

  const quotes = {
    analytical: [
      isFlipBad ? `"This is significant - ${s.name} was in the ${pName} column all night. A genuine surprise."` :
      isFlip    ? `"${s.name} flips to ${winName}. Our models did not see this coming."` :
      isSwing   ? `"${s.name} for ${winName} - ${s.ev} electoral votes. This is a crucial building block."` :
                  `"${s.name} goes to ${winName}, as expected. The night is still young."`,
    ],
    dramatic: [
      isFlipBad ? `"Oh my. ${s.name}. That is a SHOCK. ${pName} needed those ${s.ev} votes."` :
      isFlip    ? `"${s.name} flips! ${winName} takes it! This race just changed, folks!"` :
      isSwing   ? `"${s.name} to ${winName}! The crowd here at our desk is electric!"` :
                  `"${winName} wins ${s.name}. Let's see where this is going."`,
    ],
    measured: [
      isFlipBad ? `"Our projection shows ${s.name} going to ${loseName}. This was not anticipated."` :
      isFlip    ? `"${s.name} has flipped to ${winName}. A notable development we're watching closely."` :
      isSwing   ? `"${s.name} called for ${winName}. That's ${s.ev} electoral votes added to their column."` :
                  `"${s.name} called for ${winName}. No surprises there."`,
    ],
    conservative: [
      isFlipBad ? `"${pName} loses ${s.name}. That's a significant loss. The map is tightening."` :
      isFlip    ? `"${s.name} for ${winName}. Interesting. Let's see how that plays nationally."` :
      isSwing   ? `"${winName} wins ${s.name}. That's important for their path to 270."` :
                  `"${s.name} to ${winName}. The numbers are adding up."`,
    ],
    progressive: [
      isFlipBad ? `"${s.name} is called for ${loseName}. That is a gut punch. ${s.ev} votes gone."` :
      isFlip    ? `"${s.name} flips to ${winName}! That is huge. This changes the path."` :
      isSwing   ? `"${s.name} for ${winName}. Voters there have spoken. ${s.ev} more on the board."` :
                  `"${s.name} goes to ${winName} as projected. Building the coalition."`,
    ],
  };

  const styleQuotes = quotes[anchor.style] || quotes.measured;
  const quote = styleQuotes[0];

  const overlay = document.getElementById('en-anchor-overlay');
  if(!overlay) return;

  overlay.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(0,0,0,.85);border:1px solid rgba(255,255,255,.15);border-left:3px solid ${playerWins?'#3b82f6':'#ef4444'};border-radius:8px;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.5)">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#1e2535;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px">📺</div>
      <div>
        <div style="font-family:var(--font-mono);font-size:8px;color:#6b7280;letter-spacing:.12em;margin-bottom:3px">${anchor.network} - ${anchor.name}</div>
        <div style="font-size:12px;color:#e8ecf4;line-height:1.5;font-style:italic">${quote}</div>
      </div>
    </div>`;
  overlay.style.display = 'block';
  overlay.style.opacity = '1';
  clearTimeout(EN._anchorTimer);
  EN._anchorTimer = setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display='none', 400);
  }, 5000);
}

// ─── EARLY VOTE REPORTING ──────────────────────────────────────────────────
function showEarlyVoteReport(){
  // Called at election night start - show pre-election early vote totals
  const el = document.getElementById('en-early-vote-panel');
  if(!el) return;

  const pName = GS.playerName.split(' ').slice(-1)[0];
  const oName = GS.opponent.name.split(' ').slice(-1)[0];

  // Generate early vote data: player leads or trails depending on game state
  const playerFav = GS.favorability || 50;
  const oppApproval = GS.opponent?.approval || 45;
  const delta = playerFav - oppApproval;

  // Early vote typically leans toward the polling leader
  const earlyVoteAdv = cl(delta * 1.5 + G(0, 3), -15, 15);
  const pEV = cl(50 + earlyVoteAdv, 30, 70).toFixed(1);
  const oEV = (100 - parseFloat(pEV)).toFixed(1);

  const totalReported = (18 + Math.floor(Math.random() * 12)) + 'M';
  const leadingName = parseFloat(pEV) > 50 ? pName : oName;
  const trailName = parseFloat(pEV) > 50 ? oName : pName;
  const leadPct = parseFloat(pEV) > 50 ? pEV : oEV;

  el.innerHTML = `
    <div style="padding:10px 12px;background:#0d1117;border:1px solid #1e2535;border-radius:8px;margin-bottom:8px">
      <div style="font-family:var(--font-mono);font-size:8px;color:#c8a84b;letter-spacing:.15em;margin-bottom:6px">📬 EARLY VOTE - ${totalReported} BALLOTS REPORTED</div>
      <div style="font-size:11px;color:#8a93a8;margin-bottom:6px;font-style:italic">"Early and mail-in ballots have been tabulated. Election-day results still to come."</div>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <div style="flex:1;text-align:center;padding:6px;background:${GS.playerParty==='dem'?'rgba(59,130,246,.12)':'rgba(239,68,68,.12)'};border-radius:5px">
          <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:${GS.playerParty==='dem'?'#60a5fa':'#f87171'}">${pEV}%</div>
          <div style="font-size:9px;color:#6b7280">${pName}</div>
        </div>
        <div style="flex:1;text-align:center;padding:6px;background:${GS.playerParty==='rep'?'rgba(59,130,246,.12)':'rgba(239,68,68,.12)'};border-radius:5px">
          <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:${GS.playerParty==='rep'?'#60a5fa':'#f87171'}">${oEV}%</div>
          <div style="font-size:9px;color:#6b7280">${oName}</div>
        </div>
      </div>
      <div style="font-family:var(--font-mono);font-size:9px;color:#6b7280">⚠ Early votes only - election-day votes may shift the final result significantly</div>
    </div>`;
  el.style.display='block';
}

// ─── SURPRISE STATE FLIP (called then uncalled) ────────────────────────────
// In close elections, a state can be called then "retracted" dramatically
function maybeUncallState(code, s){
  if(!EN.called[code]) return;
  const margin = Math.abs(s.finalLead);
  // Only retract very close calls (under 0.6%) in close elections
  const _pEVret = (GS.playerParty==='ind') ? (EN.indPlayerEV||0) : (GS.playerParty==='dem' ? EN.demEV : EN.repEV);
  const _oEVret = (GS.playerParty==='ind') ? Math.max(EN.demEV,EN.repEV) : (GS.playerParty==='dem' ? EN.repEV : EN.demEV);
  const totalDiff = Math.abs(_pEVret - _oEVret);
  if(margin > 0.6 || totalDiff > 40) return;
  // 20% chance to retract a razor-thin call (configurable in GAME_CONFIG.retractionChance)
  if(Math.random() > (typeof GAME_CONFIG !== 'undefined' ? GAME_CONFIG.retractionChance : 0.20)) return;

  // Retract the call
  const wasPlayerWin = EN.called[code] === 'player';
  const isInd = GS.playerParty === 'ind';
  if(isInd){
    if(wasPlayerWin){ EN.indPlayerEV = Math.max(0, (EN.indPlayerEV||0) - s.ev); }
    else {
      // Was a dem or rep win based on lean
      if(s.lean >= 0) EN.demEV = Math.max(0, EN.demEV - s.ev);
      else            EN.repEV = Math.max(0, EN.repEV - s.ev);
    }
  } else {
    const isDem = (GS.playerParty==='dem') ? wasPlayerWin : !wasPlayerWin;
    if(isDem) EN.demEV = Math.max(0, EN.demEV - s.ev);
    else EN.repEV = Math.max(0, EN.repEV - s.ev);
  }

  delete EN.called[code];
  EN.ctc.add(code);
  EN._ctcQueue = EN._ctcQueue || [];
  EN._ctcQueue.push({code, s, playerWins: wasPlayerWin});

  // Dramatic visual retraction
  paintENState(code, 'ctc');
  updateENCounter();

  const anchor = getENAnchor();
  const retractMsg = `⚠ RETRACTION: ${s.name} has been UNCALLED - votes still being counted`;
  EN._tickerItems = EN._tickerItems || [];
  EN._tickerItems.unshift(retractMsg);
  const inner = document.getElementById('en-ticker-inner');
  if(inner){
    inner.textContent = EN._tickerItems.join('   -   DECISION DESK -   ');
    inner.style.color = '#f97316';
    setTimeout(()=>inner.style.color='', 3000);
  }

  // Anchor commentary
  const overlay = document.getElementById('en-anchor-overlay');
  if(overlay){
    overlay.innerHTML = `
      <div style="padding:12px 14px;background:rgba(249,115,22,.1);border:1px solid #f97316;border-left:3px solid #f97316;border-radius:8px;max-width:420px">
        <div style="font-family:var(--font-mono);font-size:8px;color:#f97316;letter-spacing:.12em;margin-bottom:4px">⚠ ${anchor.network} - ${anchor.name} - RETRACTION</div>
        <div style="font-size:12px;color:#e8ecf4;font-style:italic">"We are pulling back our call on ${s.name}. The margin is too thin. This one is going back to too-close-to-call."</div>
      </div>`;
    overlay.style.display='block'; overlay.style.opacity='1';
    clearTimeout(EN._anchorTimer);
    EN._anchorTimer = setTimeout(()=>{ overlay.style.opacity='0'; setTimeout(()=>overlay.style.display='none',400); }, 7000);
  }

  // Show popup
  showTCTCPopup(code, s);
  addENFeedItem(code, s, 'ctc');
}

// ─── CANDIDATE SPEECHES ───────────────────────────────────────────────────
function showCandidateSpeech(won){
  const speechEl = document.getElementById('en-speech-overlay');
  if(!speechEl) return;

  const pName = GS.playerName;
  const pLast = pName.split(' ').slice(-1)[0];
  const oName = GS.opponent.name;
  const oLast = oName.split(' ').slice(-1)[0];
  const isInd = GS.playerParty === 'ind';
  const pIsDem = GS.playerParty === 'dem';
  const playerColor = GS.playerPartyColor || (pIsDem ? '#60a5fa' : '#f87171');
  const playerEV = isInd ? (EN.indPlayerEV||0) : (pIsDem ? EN.demEV : EN.repEV);
  const oppEV    = isInd ? Math.max(EN.demEV,EN.repEV) : (pIsDem ? EN.repEV : EN.demEV);

  const winnerSpeeches = [
    `"Tonight, the American people have spoken. This is your victory - every volunteer, every donor, every voter who believed. We will not let you down."`,
    `"I want to be clear - I am humbled by this responsibility. We have more work to do, but tonight we celebrate what is possible in this country."`,
    `"They said it couldn't be done. The polls were wrong, the pundits were wrong. But the people - the people were right. Thank you, America."`,
    `"This is not a win for our party. This is a win for the idea that every voice matters, every vote counts. Let's get to work."`,
  ];
  const concessionSpeeches = [
    `"${pLast} ran a strong campaign. I wish the President-elect well - the work ahead demands nothing less than our full cooperation."`,
    `"Tonight is not the night we hoped for. But democracy is bigger than one race, one candidate. We will be back."`,
    `"We leave this campaign with no regrets. We fought for what we believe in. And we will continue that fight - in every state, every district, every community."`,
  ];

  const playerWonEl = won;
  const speech = won
    ? winnerSpeeches[Math.floor(Math.random()*winnerSpeeches.length)]
    : concessionSpeeches[Math.floor(Math.random()*concessionSpeeches.length)];
  const oppSpeech = won
    ? concessionSpeeches[Math.floor(Math.random()*concessionSpeeches.length)]
    : winnerSpeeches[Math.floor(Math.random()*winnerSpeeches.length)];

  speechEl.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="this.remove()">
      <div style="background:#0d1117;border:1px solid rgba(255,255,255,.12);border-radius:14px;max-width:520px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.7)">
        <div style="padding:14px 18px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:var(--font-mono);font-size:9px;color:#6b7280;letter-spacing:.15em">📺 LIVE BROADCAST</div>
          <div style="font-size:10px;color:#6b7280;font-family:var(--font-mono)">tap to dismiss</div>
        </div>
        <div style="padding:20px">
          <div style="margin-bottom:16px;padding:14px;background:rgba(${won?'34,197,94':'239,68,68'},.07);border-left:3px solid ${won?'#22c55e':'#ef4444'};border-radius:0 8px 8px 0">
            <div style="font-family:var(--font-mono);font-size:9px;color:${won?'#22c55e':'#ef4444'};letter-spacing:.12em;margin-bottom:6px">${pName.toUpperCase()} - ${won?'VICTORY SPEECH':'CONCESSION SPEECH'}</div>
            <div style="font-size:13px;color:#e8ecf4;line-height:1.6;font-style:italic">${speech}</div>
          </div>
          <div style="padding:14px;background:rgba(255,255,255,.03);border-left:3px solid #4a5568;border-radius:0 8px 8px 0">
            <div style="font-family:var(--font-mono);font-size:9px;color:#6b7280;letter-spacing:.12em;margin-bottom:6px">${oName.toUpperCase()} - ${won?'CONCESSION SPEECH':'VICTORY SPEECH'}</div>
            <div style="font-size:12px;color:#8a93a8;line-height:1.6;font-style:italic">${oppSpeech}</div>
          </div>
          <div style="margin-top:14px;text-align:center;font-family:var(--font-mono);font-size:10px;color:#c8a84b">
            Final: ${pLast} ${playerEV} EV - ${oLast} ${oppEV} EV
          </div>
        </div>
      </div>
    </div>`;
  speechEl.style.display='block';
}



// Congress scoreboard on election night - updates as states get called
let _enCongress = null;

// All Senate races on the ballot in an election cycle (~33-35 seats up)
// 'lean' = positive means Dem-leaning, negative = Rep-leaning (scale ~-10 to +10)
const SENATE_RACE_QUEUE = [
  // Safe Dem (early calls)
  {chamber:'S', state:'VT', name:'Vermont',        safe:true, lean:+9},
  {chamber:'S', state:'MA', name:'Massachusetts',  safe:true, lean:+8},
  {chamber:'S', state:'RI', name:'Rhode Island',   safe:true, lean:+7},
  {chamber:'S', state:'NJ', name:'New Jersey',     safe:true, lean:+6},
  {chamber:'S', state:'WA', name:'Washington',     safe:true, lean:+5},
  {chamber:'S', state:'OR', name:'Oregon',         safe:true, lean:+5},
  {chamber:'S', state:'MN', name:'Minnesota',      safe:true, lean:+4},
  {chamber:'S', state:'CO', name:'Colorado',       safe:true, lean:+3},
  {chamber:'S', state:'CT', name:'Connecticut',    safe:true, lean:+6},
  {chamber:'S', state:'HI', name:'Hawaii',         safe:true, lean:+9},
  {chamber:'S', state:'IL', name:'Illinois',       safe:true, lean:+5},
  {chamber:'S', state:'NM', name:'New Mexico',     safe:true, lean:+4},
  // Safe Rep (early calls)
  {chamber:'S', state:'TN', name:'Tennessee',      safe:true, lean:-8},
  {chamber:'S', state:'IN', name:'Indiana',        safe:true, lean:-7},
  {chamber:'S', state:'MS', name:'Mississippi',    safe:true, lean:-8},
  {chamber:'S', state:'TX', name:'Texas',          safe:true, lean:-6},
  {chamber:'S', state:'KY', name:'Kentucky',       safe:true, lean:-7},
  {chamber:'S', state:'WY', name:'Wyoming',        safe:true, lean:-9},
  {chamber:'S', state:'ND', name:'North Dakota',   safe:true, lean:-6},
  {chamber:'S', state:'ID', name:'Idaho',          safe:true, lean:-7},
  {chamber:'S', state:'SD', name:'South Dakota',   safe:true, lean:-6},
  {chamber:'S', state:'AL', name:'Alabama',        safe:true, lean:-8},
  {chamber:'S', state:'OK', name:'Oklahoma',       safe:true, lean:-7},
  {chamber:'S', state:'NE', name:'Nebraska',       safe:true, lean:-5},
  // Competitive (late calls)
  {chamber:'S', state:'AZ', name:'Arizona',        safe:false, lean:-1},
  {chamber:'S', state:'MT', name:'Montana',        safe:false, lean:-2},
  {chamber:'S', state:'NV', name:'Nevada',         safe:false, lean:+1},
  {chamber:'S', state:'OH', name:'Ohio',           safe:false, lean:-2},
  {chamber:'S', state:'PA', name:'Pennsylvania',   safe:false, lean:0},
  {chamber:'S', state:'WI', name:'Wisconsin',      safe:false, lean:0},
  {chamber:'S', state:'MI', name:'Michigan',       safe:false, lean:+1},
  {chamber:'S', state:'GA', name:'Georgia',        safe:false, lean:-1},
];

// House races - 435 total. Safe seats trickle in continuously each state call.
// Only competitive districts show individually in the congress feed.
const HOUSE_COMPETITIVE = [
  {chamber:'H', dist:'FL-13',  name:'FL-13th',  lean:-1},
  {chamber:'H', dist:'VA-02',  name:'VA-2nd',   lean:+1},
  {chamber:'H', dist:'NC-01',  name:'NC-1st',   lean:0},
  {chamber:'H', dist:'OH-09',  name:'OH-9th',   lean:-1},
  {chamber:'H', dist:'PA-07',  name:'PA-7th',   lean:0},
  {chamber:'H', dist:'AZ-06',  name:'AZ-6th',   lean:-1},
  {chamber:'H', dist:'WI-03',  name:'WI-3rd',   lean:0},
  {chamber:'H', dist:'MI-08',  name:'MI-8th',   lean:+1},
  {chamber:'H', dist:'NC-13',  name:'NC-13th',  lean:-1},
  {chamber:'H', dist:'NV-03',  name:'NV-3rd',   lean:0},
  {chamber:'H', dist:'ME-02',  name:'ME-2nd',   lean:-2},
  {chamber:'H', dist:'IA-01',  name:'IA-1st',   lean:-1},
  {chamber:'H', dist:'CA-41',  name:'CA-41st',  lean:+2},
  {chamber:'H', dist:'TX-28',  name:'TX-28th',  lean:-1},
  {chamber:'H', dist:'CO-08',  name:'CO-8th',   lean:+1},
  {chamber:'H', dist:'NM-02',  name:'NM-2nd',   lean:-1},
  {chamber:'H', dist:'KS-03',  name:'KS-3rd',   lean:-1},
  {chamber:'H', dist:'IL-17',  name:'IL-17th',  lean:0},
];
const SENATE_TOSSUP_CODES = new Set(
  [...SENATE_RACE_QUEUE].sort((a,b)=>Math.abs(a.lean)-Math.abs(b.lean)).slice(0,6).map(r=>r.state)
);
const HOUSE_TOSSUP_CODES = new Set(
  [...HOUSE_COMPETITIVE].sort((a,b)=>Math.abs(a.lean)-Math.abs(b.lean)).slice(0,8).map(r=>r.dist)
);

function _resolveCongressRace(lean, envBonus){
  const combined = lean + envBonus;
  const prob = 0.5 + combined * 0.07;
  return Math.random() < Math.max(0.05, Math.min(0.95, prob));
}
function _congressLeanLabel(displayLean, race){
  if(race?.isTossup) return 'Toss-Up';
  const absLean = Math.abs(displayLean);
  if(absLean <= 4.2) return 'Toss-Up';
  if(absLean >= 6.2) return displayLean > 0 ? 'Safe D' : 'Safe R';
  return displayLean > 0 ? 'Lean D' : 'Lean R';
}

function initENCongressBoard(){
  let demEnvBonus = 0;

  if(window._SIM){
    const preset = SIM_PRESETS[window._SIM.envKey] || SIM_PRESETS.neutral;
    demEnvBonus = preset.envShift * 0.5;
    const strDiff = (window._SIM.demStr - window._SIM.repStr) / 20;
    demEnvBonus += strDiff;
  } else {
    const isPlayerDem = GS.playerParty === 'dem';
    // Use favorability vs opponent approval as national lead proxy
    const playerFav = GS.favorability || 50;
    const oppFav = GS.opponent?.approval || 45;
    const natLead = (playerFav - oppFav);
    const momBonus = (GS.momentum || 0) * 0.12;

    // ── COATTAIL EFFECT: tie Congress to actual state-level electoral performance ──
    // Count how many states the player is winning and their margin average.
    // This ensures sweeping the electoral map actually moves Congress.
    let statesWon = 0, statesLost = 0, totalMarginWon = 0, totalMarginLost = 0, totalEVWon = 0;
    GS.states.forEach(s => {
      const lead = s.finalLead !== undefined ? s.finalLead : s.genLead;
      if(lead > 0){ statesWon++; totalMarginWon += lead; totalEVWon += (s.ev || 0); }
      else { statesLost++; totalMarginLost += Math.abs(lead); }
    });
    const totalStates = statesWon + statesLost || 1;
    const winShare = statesWon / totalStates; // 0.0–1.0
    // Map win share to a bonus: 0.5 (tie) = 0, 1.0 (all states) = +4, 0.0 (no states) = -4
    const electoralBonus = (winShare - 0.5) * 8;
    // Also factor average winning margin (landslide = bigger coattails)
    const avgMarginWon = statesWon > 0 ? totalMarginWon / statesWon : 0;
    const marginBonus = Math.min(avgMarginWon * 0.06, 1.5); // up to +1.5 for massive margins
    // EV bonus: winning 300+ EV = big coattail signal
    const evBonus = Math.min((totalEVWon - 270) / 100, 1.2); // up to +1.2 for big EV win

    const rawBonus = natLead * 0.08 + momBonus + electoralBonus + marginBonus + (evBonus > 0 ? evBonus : 0);
    demEnvBonus = isPlayerDem ? rawBonus : -rawBonus;
  }

  // Senate holdovers (not up this election) give the baseline majority context
  const holdoverDem = 33;
  const holdoverRep = 30;

  // Resolve all individual race outcomes up front
  const sQueue = SENATE_RACE_QUEUE.map(r => {
    const isTossup = SENATE_TOSSUP_CODES.has(r.state) || (!r.safe && Math.abs(r.lean)<=2);
    const adjustedLean = r.safe ? (r.lean + (r.lean > 0 ? 2 : -2)) : r.lean;
    const raceLean = isTossup ? adjustedLean * 0.35 : adjustedLean;
    const raceEnv = isTossup ? demEnvBonus * 0.35 : demEnvBonus;
    const dem = _resolveCongressRace(raceLean, raceEnv);
    const rawDisplayLean = r.lean + (isTossup ? demEnvBonus * 0.04 : demEnvBonus * 0.1);
    const displayLean = isTossup ? cl(rawDisplayLean, -3.8, 3.8) : rawDisplayLean;
    return {...r, dem, displayLean, isTossup};
  });
  const hQueue = HOUSE_COMPETITIVE.map(r => {
    const isTossup = HOUSE_TOSSUP_CODES.has(r.dist) || Math.abs(r.lean)<=1;
    const raceLean = isTossup ? r.lean * 0.4 : r.lean;
    const raceEnv = isTossup ? demEnvBonus * 0.3 : demEnvBonus;
    const rawDisplayLean = r.lean + (isTossup ? demEnvBonus * 0.04 : demEnvBonus * 0.1);
    const displayLean = isTossup ? cl(rawDisplayLean, -3.8, 3.8) : rawDisplayLean;
    return {...r, dem: _resolveCongressRace(raceLean, raceEnv), displayLean, isTossup};
  });

  // Pre-determine the FINAL house result (wave-adjusted split of all 435 seats)
  // Baseline 218 = bare majority. waveSeatShift: each +1 demEnvBonus ≈ 6 extra Dem seats
  const waveSeatShift = Math.round(demEnvBonus * 6);
  const compSwing = hQueue.filter(r=>r.dem).length - hQueue.filter(r=>!r.dem).length;
  const finalHouseDem = Math.max(170, Math.min(265, 218 + waveSeatShift + compSwing));
  const finalHouseRep = 435 - finalHouseDem;

  // Build individual race call queue (senate + competitive house show in feed)
  const safeS = sQueue.filter(r=>r.safe);
  const compS = sQueue.filter(r=>!r.safe);
  const congressQueue = [];
  safeS.forEach((r,i) => congressQueue.push({...r, callAfterState: Math.round(i * 0.7)}));
  hQueue.forEach((r,i) => congressQueue.push({...r, callAfterState: 4 + i}));
  compS.forEach((r,i) => congressQueue.push({...r, callAfterState: 15 + i * 2}));

  // Add the 5 remaining senate seats not in the named queue (100 - 32 named - 63 holdovers = 5)
  // These are late-called or non-contested seats shown as projections
  const SYNTHETIC_SENATE = [
    {chamber:'S', name:'California', state:'CA', lean:+8, safe:true},
    {chamber:'S', name:'New York',   state:'NY', lean:+7, safe:true},
    {chamber:'S', name:'Florida',    state:'FL', lean:-3, safe:false},
    {chamber:'S', name:'Missouri',   state:'MO', lean:-4, safe:true},
    {chamber:'S', name:'Kansas',     state:'KS', lean:-5, safe:true},
  ];
  SYNTHETIC_SENATE.forEach((r, i) => {
    const isTossup = Math.abs(r.lean) <= 3;
    const dem = _resolveCongressRace(isTossup ? r.lean * 0.35 : r.lean, isTossup ? demEnvBonus * 0.35 : demEnvBonus);
    const rawDisplayLean = r.lean + (isTossup ? demEnvBonus * 0.04 : demEnvBonus * 0.1);
    const displayLean = isTossup ? cl(rawDisplayLean, -3.8, 3.8) : rawDisplayLean;
    congressQueue.push({...r, dem, displayLean, isTossup, callAfterState: 30 + i * 3});
  });

  congressQueue.sort((a,b) => a.callAfterState - b.callAfterState);

  _enCongress = {
    senate: { dem: holdoverDem, rep: holdoverRep, called: holdoverDem + holdoverRep, calledTonight: 0, total: 100 },
    house:  { dem: 0, rep: 0, called: 0, total: 435,
              finalDem: finalHouseDem, finalRep: finalHouseRep },
    queue: congressQueue,
    queueIndex: 0,
    stateCallCount: 0,
    totalStates: 51, // total presidential state calls expected
    pendingCalls: [],
    demEnvBonus,
  };
  renderENCongressBoard();
}

function updateENCongressBoard(isDem, ev){
  if(!_enCongress) return;
  _enCongress.stateCallCount++;
  const sc = _enCongress.stateCallCount;
  const total = _enCongress.totalStates;
  const h = _enCongress.house;

  // ── House trickle ── (house has no named individual races beyond competitive ones, mostly trickled)
  const targetHouseCalled = Math.min(435, Math.round((sc / total) * 435));
  const newHouseCalled = targetHouseCalled - h.called;
  if(newHouseCalled > 0){
    const demFrac = h.finalDem / 435;
    const repFrac = h.finalRep / 435;
    const newDem = Math.round(newHouseCalled * demFrac);
    const newRep = newHouseCalled - newDem;
    h.dem = Math.min(h.finalDem, h.dem + newDem);
    h.rep = Math.min(h.finalRep, h.rep + newRep);
    h.called = Math.min(435, h.called + newHouseCalled);
    // Generate a synthetic house feed item every ~8 seats called
    if(Math.floor(h.called / 8) > Math.floor((h.called - newHouseCalled) / 8)){
      const syntheticRaces = [
        'FL-07','TX-15','NC-06','VA-10','GA-06','AZ-01','NV-04',
        'MI-07','PA-08','WI-01','OH-01','MN-03','CO-07','OR-05'
      ];
      const idx = Math.floor(Math.random() * syntheticRaces.length);
      const isDemSeat = Math.random() < (h.finalDem / 435);
      const tossBias = _enCongress?.demEnvBonus || 0;
      const displayLean = cl((Math.random() * 4 - 2) + tossBias * 0.35, -8, 8);
      setTimeout(() => addCongressFeedItem(
        {chamber:'H', name: syntheticRaces[idx], lean: isDemSeat ? 1 : -1, displayLean, isTossup: Math.abs(displayLean)<=3.8}, isDemSeat
      ), 600);
    }
  }

  // On the last state call, snap house to exact final values
  if(sc >= total){
    h.dem = h.finalDem; h.rep = h.finalRep; h.called = 435;
  }

  renderENCongressBoard();

  // Queue individual race calls due at this state count
  const q = _enCongress.queue;
  while(_enCongress.queueIndex < q.length &&
        q[_enCongress.queueIndex].callAfterState <= sc){
    _enCongress.pendingCalls.push(q[_enCongress.queueIndex]);
    _enCongress.queueIndex++;
  }

  // Drain ALL pending calls with staggered visual timing
  const toFire = _enCongress.pendingCalls.splice(0);
  toFire.forEach((race, i) => {
    setTimeout(() => fireCongressCall(race), 400 + i * 350);
  });
}

function fireCongressCall(race){
  if(!_enCongress) return;
  const isDem = race.dem;
  const s = _enCongress.senate;
  const h = _enCongress.house;
  const prevSenWinner = s.dem>=51 ? 'dem' : s.rep>=51 ? 'rep' : null;
  const prevHseWinner = h.dem>=218 ? 'dem' : h.rep>=218 ? 'rep' : null;

  if(race.chamber === 'S'){
    if(isDem) _enCongress.senate.dem = Math.min(100, _enCongress.senate.dem + 1);
    else      _enCongress.senate.rep = Math.min(100, _enCongress.senate.rep + 1);
    _enCongress.senate.called = Math.min(100, (_enCongress.senate.dem + _enCongress.senate.rep));
    _enCongress.senate.calledTonight = (_enCongress.senate.calledTonight||0) + 1;
  } else {
    if(isDem) _enCongress.house.dem = Math.min(435, _enCongress.house.dem + 1);
    else      _enCongress.house.rep = Math.min(435, _enCongress.house.rep + 1);
    _enCongress.house.called = Math.min(435, _enCongress.house.called + 1);
  }
  renderENCongressBoard();
  addCongressFeedItem(race, isDem);

  // Check if a chamber just crossed the majority threshold for the first time
  const newSenWinner = _enCongress.senate.dem>=51 ? 'dem' : _enCongress.senate.rep>=51 ? 'rep' : null;
  const newHseWinner = _enCongress.house.dem>=218 ? 'dem' : _enCongress.house.rep>=218 ? 'rep' : null;

  if(newSenWinner && newSenWinner !== prevSenWinner){
    const pName = GS.playerName.split(' ').slice(-1)[0];
    const oName = GS.opponent.name.split(' ').slice(-1)[0];
    const playerPartyWins = (GS.playerParty==='dem') === (newSenWinner==='dem');
    _showCongressAnchorCommentary('senate', newSenWinner, playerPartyWins, pName, oName);
  }
  if(newHseWinner && newHseWinner !== prevHseWinner){
    const pName = GS.playerName.split(' ').slice(-1)[0];
    const oName = GS.opponent.name.split(' ').slice(-1)[0];
    const playerPartyWins = (GS.playerParty==='dem') === (newHseWinner==='dem');
    _showCongressAnchorCommentary('house', newHseWinner, playerPartyWins, pName, oName);
  }
}

function _showCongressAnchorCommentary(chamber, winner, playerPartyWins, pName, oName){
  const anchor = getENAnchor();
  const winParty = winner === 'dem' ? 'Democrats' : 'Republicans';
  const chamberLabel = chamber === 'senate' ? 'Senate' : 'House';
  const seats = chamber === 'senate' ? 51 : 218;
  const playerWinStr = playerPartyWins ? `${pName}'s party` : `${oName}'s party`;

  const quotes = {
    analytical: `"We can now project: ${winParty} will control the ${chamberLabel}. That's ${seats} seats. ${playerWinStr} has the majority - this is significant for the next Congress."`,
    dramatic: `"THIS IS IT - the ${chamberLabel} is CALLED for the ${winParty}! ${playerWinStr} controls the ${chamberLabel}! An enormous development tonight!"`,
    measured: `"Our decision desk is projecting ${winParty} control of the ${chamberLabel}. ${playerWinStr} has crossed the threshold. We will watch to see if this holds."`,
    conservative: `"${winParty} take the ${chamberLabel}. ${playerWinStr} has the votes. A clear result from tonight's balloting."`,
    progressive: `"The ${chamberLabel} goes to ${winParty}. ${playerWinStr} now has a governing majority - this matters enormously for what comes next."`,
  };

  const quote = quotes[anchor.style] || quotes.measured;
  const overlay = document.getElementById('en-anchor-overlay');
  if(!overlay) return;

  const borderCol = winner === 'dem' ? '#3b82f6' : '#ef4444';
  overlay.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(0,0,0,.9);border:1px solid rgba(255,255,255,.15);border-left:3px solid ${borderCol};border-radius:8px;max-width:440px;box-shadow:0 4px 24px rgba(0,0,0,.6)">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#1e2535;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px">🏛</div>
      <div>
        <div style="font-family:var(--font-mono);font-size:8px;color:#c8a84b;letter-spacing:.12em;margin-bottom:3px">${anchor.network} - ${anchor.name} - ${chamberLabel.toUpperCase()} CALL</div>
        <div style="font-size:12px;color:#e8ecf4;line-height:1.5;font-style:italic">${quote}</div>
      </div>
    </div>`;
  overlay.style.display = 'block';
  overlay.style.opacity = '1';
  clearTimeout(EN._anchorTimer);
  EN._anchorTimer = setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display='none', 400);
  }, 6000);
}

function renderENCongressBoard(){
  if(!_enCongress) return;
  const s = _enCongress.senate;
  const h = _enCongress.house;
  const el = id => document.getElementById(id);

  // Senate
  if(el('en-senate-dem')) el('en-senate-dem').textContent = s.dem;
  if(el('en-senate-rep')) el('en-senate-rep').textContent = s.rep;
  if(el('en-senate-called')) el('en-senate-called').textContent = s.calledTonight || 0;
  if(el('en-senate-bar-dem')) el('en-senate-bar-dem').style.width = (s.dem / 100 * 100) + '%';
  if(el('en-senate-bar-rep')) el('en-senate-bar-rep').style.width = (s.rep / 100 * 100) + '%';

  // House
  if(el('en-house-dem')) el('en-house-dem').textContent = h.dem;
  if(el('en-house-rep')) el('en-house-rep').textContent = h.rep;
  if(el('en-house-called')) el('en-house-called').textContent = h.called;
  if(el('en-house-bar-dem')) el('en-house-bar-dem').style.width = (h.dem / 435 * 100) + '%';
  if(el('en-house-bar-rep')) el('en-house-bar-rep').style.width = (h.rep / 435 * 100) + '%';

  // Status - each chamber independently
  // Senate: if 50-50 AND a presidential winner has reached 270 EV,
  // the winning VP casts the tie-breaking vote in favour of their party
  let senWinner;
  if(s.dem >= 51){
    senWinner = '🔵 DEM SENATE';
  } else if(s.rep >= 51){
    senWinner = '🔴 REP SENATE';
  } else if(s.dem === 50 && s.rep === 50){
    // Check whether a presidential winner is already decided
    if(EN.demEV >= 270){
      senWinner = '🔵 DEM SENATE (VP tiebreak)';
    } else if(EN.repEV >= 270){
      senWinner = '🔴 REP SENATE (VP tiebreak)';
    } else {
      senWinner = '⚖ SEN TBD';
    }
  } else {
    senWinner = '⚖ SEN TBD';
  }
  const hseWinner = h.dem >= 218 ? '🔵 DEM HOUSE'  : h.rep >= 218 ? '🔴 REP HOUSE'  : '⚖ HSE TBD';
  if(el('en-congress-status')) el('en-congress-status').textContent = `${senWinner} - ${hseWinner}`;

  // ── Announce when a chamber majority is newly clinched ──
  if(!_enCongress._senMajorityAnnounced && (s.dem >= 51 || s.rep >= 51 || (s.dem===50&&s.rep===50&&(EN.demEV>=270||EN.repEV>=270)))){
    _enCongress._senMajorityAnnounced = true;
    const senParty = s.dem >= 51 ? 'Democrats' : 'Republicans';
    const senPartyShort = s.dem >= 51 ? 'DEM' : 'REP';
    const playerControlsSenate = (senPartyShort==='DEM'&&GS.playerParty==='dem')||(senPartyShort==='REP'&&GS.playerParty==='rep');
    const overlay = document.getElementById('en-anchor-overlay');
    if(overlay){
      const anchor = getENAnchor();
      overlay.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(0,0,0,.88);border:1px solid rgba(255,255,255,.15);border-left:3px solid ${playerControlsSenate?'#22c55e':'#ef4444'};border-radius:8px;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.5)">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#1e2535;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px">📺</div>
        <div>
          <div style="font-family:var(--font-mono);font-size:8px;color:#6b7280;letter-spacing:.12em;margin-bottom:3px">${anchor.network} - ${anchor.name}</div>
          <div style="font-size:12px;color:#e8ecf4;line-height:1.5;font-style:italic">"${senParty} have clinched a Senate majority. ${s.dem} Democrats, ${s.rep} Republicans - a major development tonight."</div>
        </div>
      </div>`;
      overlay.style.display='block'; overlay.style.opacity='1';
      clearTimeout(EN._anchorTimer);
      EN._anchorTimer = setTimeout(()=>{ overlay.style.opacity='0'; setTimeout(()=>overlay.style.display='none', 400); }, 6000);
    }
  }
  if(!_enCongress._hseMajorityAnnounced && (h.dem >= 218 || h.rep >= 218)){
    _enCongress._hseMajorityAnnounced = true;
    const hseParty = h.dem >= 218 ? 'Democrats' : 'Republicans';
    const playerControlsHouse = (h.dem>=218&&GS.playerParty==='dem')||(h.rep>=218&&GS.playerParty==='rep');
    const overlay = document.getElementById('en-anchor-overlay');
    if(overlay){
      const anchor = getENAnchor();
      overlay.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(0,0,0,.88);border:1px solid rgba(255,255,255,.15);border-left:3px solid ${playerControlsHouse?'#22c55e':'#ef4444'};border-radius:8px;max-width:420px;box-shadow:0 4px 24px rgba(0,0,0,.5)">
        <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:#1e2535;border:2px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:16px">📺</div>
        <div>
          <div style="font-family:var(--font-mono);font-size:8px;color:#6b7280;letter-spacing:.12em;margin-bottom:3px">${anchor.network} - ${anchor.name}</div>
          <div style="font-size:12px;color:#e8ecf4;line-height:1.5;font-style:italic">"${hseParty} will control the House of Representatives. ${h.dem} Democratic seats, ${h.rep} Republican seats. A House majority is secured."</div>
        </div>
      </div>`;
      overlay.style.display='block'; overlay.style.opacity='1';
      clearTimeout(EN._anchorTimer);
      EN._anchorTimer = setTimeout(()=>{ overlay.style.opacity='0'; setTimeout(()=>overlay.style.display='none', 400); }, 6000);
    }
  }

  // Pulse the numbers if just updated
  ['en-senate-dem','en-senate-rep','en-house-dem','en-house-rep'].forEach(id=>{
    const e = el(id);
    if(e){ e.style.transform='scale(1.25)'; setTimeout(()=>e.style.transform='scale(1)',350); }
  });
}

// Individual congressional race feed item - goes in the dedicated congress feed
function addCongressFeedItem(race, isDem){
  const feed = document.getElementById('en-congress-feed');
  if(!feed) return;
  const isSenate = race.chamber === 'S';
  const chamberLabel = isSenate ? 'SENATE' : 'HOUSE';
  const raceName = isSenate ? `${race.name} Senate` : `${race.name}`;
  // Show lean context
  const lean = race.lean || 0;
  const env = _enCongress?.demEnvBonus || 0;
  const displayLean = typeof race.displayLean === 'number' ? race.displayLean : (lean + env * 0.1);
  const leanStr = _congressLeanLabel(displayLean, race);
  const upset = (isDem && lean < 0) || (!isDem && lean > 0);
  const div = document.createElement('div');
  div.className = 'en-congress-call';
  div.innerHTML = `
    <span class="race-label">${chamberLabel}</span>
    <span class="race-name">${raceName} <span style="font-size:8px;opacity:.5">(${leanStr})</span></span>
    <span class="race-winner" style="color:${isDem?'#60a5fa':'#f87171'}">${isDem?'DEM WINS':'REP WINS'}${upset?' ⚡':''}</span>
    <span class="en-call-badge ${isDem?'dem':'rep'}" style="font-size:8px">${isDem?'D':'R'}</span>`;
  feed.insertBefore(div, feed.firstChild);
}

function showTCTCPopup(code, s){
  const popup = document.getElementById('en-state-popup');
  popup.innerHTML = `
    <div class="enp-alert" style="background:#2d1b6e">
      <div class="enp-kra" style="background:#6d28d9">TOO<br>CLOSE</div>
      <div class="enp-state">${s.name.toUpperCase()}</div>
      <div class="enp-ev-badge">${s.ev} EV</div>
    </div>
    <div class="enp-body" style="padding:14px 16px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#a78bfa;letter-spacing:.1em">⚠ TOO CLOSE TO CALL - Votes still being counted</div>
      <div style="font-size:12px;color:#8a93a8;margin-top:6px">${s.name} is a key battleground. Decision Desk unable to project a winner at this time.</div>
    </div>`;
  popup.classList.add('show');
  clearTimeout(EN._popupTimer);
  EN._popupTimer = setTimeout(()=>popup.classList.remove('show'), 5000);
}

function showStateCallPopup(code, s, isDem, playerWins){
  const totalVotes = s._totalVotes || Math.round(s.ev * 180000);
  const winPct = s._winPct || 55;
  const losePct = 100 - winPct;
  const winVotes = Math.round(totalVotes * winPct/100);
  const loseVotes = totalVotes - winVotes;
  const diff = winVotes - loseVotes;
  const pctReport = cl(55 + Math.random()*40, 60, 99);

  const winColor = isDem ? '#1d4ed8' : '#991b1b';
  const loseColor = isDem ? '#991b1b' : '#1d4ed8';
  const winName = playerWins ? GS.playerName.split(' ').slice(-1)[0].toUpperCase() : GS.opponent.name.split(' ').slice(-1)[0].toUpperCase();
  const loseName = playerWins ? GS.opponent.name.split(' ').slice(-1)[0].toUpperCase() : GS.playerName.split(' ').slice(-1)[0].toUpperCase();
  const isSwing2 = _isSwingStateEN(code);

  const popup = document.getElementById('en-state-popup');
  popup.innerHTML = `
    <div class="enp-alert" style="background:${isSwing2?'#dc2626':'#1a1a2e'}">
      ${isSwing2?`<div class="enp-kra"><span>KEY</span><span>RACE</span><span>ALERT</span></div>`:`<div class="enp-called">CALLED</div>`}
      <div class="enp-state">${s.name.toUpperCase()}</div>
      <div class="enp-ev-badge">${s.ev} EV</div>
    </div>
    <div class="enp-body">
      <div class="enp-candidates">
        <div class="enp-cand win" style="background:${winColor}">
          <div class="enp-pct">${winPct.toFixed(1)}%</div>
          <div class="enp-name">${winName}</div>
          <div class="enp-votes">${winVotes.toLocaleString()}</div>
        </div>
        <div class="enp-cand lose" style="background:${loseColor}">
          <div class="enp-pct">${losePct.toFixed(1)}%</div>
          <div class="enp-name">${loseName}</div>
          <div class="enp-votes">${loseVotes.toLocaleString()}</div>
        </div>
      </div>
      <div class="enp-footer">
        <span>DIFFERENCE: ${diff.toLocaleString()}</span>
        <span>${pctReport.toFixed(0)}% REPORTING</span>
      </div>
    </div>`;

  popup.classList.add('show');
  clearTimeout(EN._popupTimer);
  EN._popupTimer = setTimeout(()=>popup.classList.remove('show'), 6000);
}

function showThirdPartyStatePopup(code, s){
  const thirdName = (window._SIM?.thirdName || 'Independent').split(' ').slice(-1)[0].toUpperCase();
  const totalVotes = Math.round(s.ev * 190000 + Math.random()*s.ev*50000);
  const winPct = cl(38 + Math.random()*8, 35, 48); // typically plurality, not majority
  const winVotes = Math.round(totalVotes * winPct/100);
  const pctReport = cl(60 + Math.random()*35, 60, 99);

  const popup = document.getElementById('en-state-popup');
  popup.innerHTML = `
    <div class="enp-alert" style="background:#4c1d95">
      <div class="enp-kra" style="background:#7c3aed;font-size:9px;letter-spacing:.08em"><span>3RD</span><span>PARTY</span><span>WIN</span></div>
      <div class="enp-state">${s.name.toUpperCase()}</div>
      <div class="enp-ev-badge">${s.ev} EV</div>
    </div>
    <div class="enp-body">
      <div style="padding:12px 14px;text-align:center">
        <div style="font-size:32px;font-weight:900;color:#a78bfa;font-family:var(--font-mono)">${winPct.toFixed(1)}%</div>
        <div style="font-weight:700;font-size:14px;color:#c4b5fd;margin:4px 0">${thirdName}</div>
        <div style="font-size:11px;color:#8a93a8">${winVotes.toLocaleString()} votes - plurality winner</div>
      </div>
      <div class="enp-footer">
        <span style="color:#a78bfa">⚡ THIRD PARTY WINS ${s.ev} EV</span>
        <span>${pctReport.toFixed(0)}% REPORTING</span>
      </div>
    </div>`;
  popup.classList.add('show');
  clearTimeout(EN._popupTimer);
  EN._popupTimer = setTimeout(()=>popup.classList.remove('show'), 7000);
}

// ═══════════════════════════════════════════════════════════════════════
// 🎨 ELECTION NIGHT MAP COLOURS - Edit to change called-state colours
// ═══════════════════════════════════════════════════════════════════════
const EN_MAP_COLORS = {
  dem: '#1d4ed8',   // Called Democrat  - blue
  rep: '#c0392b',   // Called Republican - red
  ctc: '#5b21b6',   // Too Close to Call - purple
  third: '#7c3aed', // Third party win - violet
  ind: '#a855f7',   // Custom/independent party win - purple
  uncalled: '#1e2535', // Not yet reported - dark
};
// ═══════════════════════════════════════════════════════════════════════

function paintENState(code, status){
  const path = document.getElementById(`en-path-${code}`);
  if(!path) return;
  // For ind/custom use the player's configured party colour if available
  let fillColor = EN_MAP_COLORS[status] || EN_MAP_COLORS.uncalled;
  if(status==='ind' && GS.playerPartyColor) fillColor = GS.playerPartyColor;
  fillColor = _safeColor(fillColor, EN_MAP_COLORS.uncalled);
  path.style.fill = fillColor;
  path.style.transition = 'fill 0.5s ease';
  // Flash effect
  path.setAttribute('class','state-path en-flash');
  setTimeout(()=>path.setAttribute('class','state-path'), 700);
}

function addENFeedItem(code, s, status){
  const feed = document.getElementById('en-feed');
  const div = document.createElement('div');
  div.className = 'en-call';

  const indBadgeColor = (GS.playerPartyColor||'#a855f7');
  const indBadgeLabel = GS.playerPartyIcon ? `${GS.playerPartyIcon} ${(GS.playerPartyLabel||'IND').substring(0,4).toUpperCase()}` : 'IND';
  const labels = {
    dem: `<span class="en-call-badge dem">DEM</span>`,
    rep: `<span class="en-call-badge rep">REP</span>`,
    ctc: `<span class="en-call-badge ctc">TOO CLOSE</span>`,
    third: `<span class="en-call-badge" style="background:#7c3aed">3RD</span>`,
    ind: `<span class="en-call-badge" style="background:${indBadgeColor};color:#fff">${indBadgeLabel}</span>`,
  };

  const pWins = (GS.playerParty==='dem') ? status==='dem' : status==='rep';
  const evText = status==='ctc' ? `${s.ev} EV` : `+${s.ev} EV`;

  div.innerHTML = `
    <div class="en-call-state">${code}</div>
    <div class="en-call-name">${s.name}</div>
    <div class="en-call-ev" style="color:${status==='dem'?'#60a5fa':status==='rep'?'#f87171':'#a78bfa'}">${evText}</div>
    ${labels[status]}`;

  // Prepend so newest is at top
  feed.insertBefore(div, feed.firstChild);

  // Add time labels periodically
  if(Object.keys(EN.called).length % 5 === 0 || EN.ctc.size > 0){
    const clock = document.getElementById('en-clock-time').textContent;
    const lbl = document.createElement('div');
    lbl.className = 'en-time-label';
    lbl.textContent = clock;
    feed.insertBefore(lbl, feed.firstChild);
  }
}

function updateENCounter(){
  const isInd = GS.playerParty === 'ind';
  const indPEV = EN.indPlayerEV || 0;
  const thirdWrap = document.getElementById('en-third-wrap');
  const thirdEl = document.getElementById('en-ev-third');

  if(isInd){
    // 3-way race: left=player, middle-right=Dem, far-right=Rep
    if(thirdWrap) thirdWrap.style.display = 'flex';
    document.getElementById('en-ev-dem').textContent = indPEV;
    document.getElementById('en-ev-rep').textContent = EN.demEV;
    if(thirdEl) thirdEl.textContent = EN.repEV;
    const demEl = document.getElementById('en-ev-dem');
    if(demEl) demEl.style.color = GS.playerPartyColor || '#a855f7';
    const repEl = document.getElementById('en-ev-rep');
    if(repEl) repEl.style.color = '#60a5fa';
    if(thirdEl) thirdEl.style.color = '#f87171';
    const remaining = 538 - indPEV - EN.demEV - EN.repEV;
    const remEl = document.getElementById('en-ev-remaining');
    if(remEl){
      remEl.textContent = `${remaining} EV remaining`;
      remEl.style.color = '#a78bfa';
    }
    document.getElementById('en-prog-dem').style.width = (indPEV/538*100) + '%';
    document.getElementById('en-prog-rep').style.width = ((EN.demEV+EN.repEV)/538*100) + '%';
    const demProgEl = document.getElementById('en-prog-dem');
    if(demProgEl) demProgEl.style.background = GS.playerPartyColor || '#a855f7';
  } else {
    if(thirdWrap) thirdWrap.style.display = 'none';
    if(thirdEl) thirdEl.textContent = '0';
    document.getElementById('en-ev-dem').textContent = EN.demEV;
    document.getElementById('en-ev-rep').textContent = EN.repEV;
    const repEl = document.getElementById('en-ev-rep');
    if(repEl) repEl.style.color = '#ef4444';
    const thirdEV = EN.thirdEV || 0;
    const remaining = 538 - EN.demEV - EN.repEV - thirdEV;
    const remEl = document.getElementById('en-ev-remaining');
    if(remEl){
      if(thirdEV > 0){
        const sim = window._SIM;
        remEl.textContent = `${remaining} EV remaining - ${sim?.thirdName||'Ind'}: ${thirdEV} EV`;
        remEl.style.color = '#a78bfa';
      } else {
        remEl.textContent = `${remaining} EV remaining`;
        remEl.style.color = '';
      }
    }
    document.getElementById('en-prog-dem').style.width = (EN.demEV/538*100) + '%';
    document.getElementById('en-prog-rep').style.width = (EN.repEV/538*100) + '%';
  }

  // States called counter
  const calledVals = Object.values(EN.called);
  const playerStates = calledVals.filter(v=>v==='player').length;
  const oppStates = calledVals.filter(v=>v==='opponent').length;
  const thirdStates = calledVals.filter(v=>v==='third').length;
  const remainStates = STATE_DATA.length - playerStates - oppStates - thirdStates;
  const pLabel = isInd ? (GS.playerPartyIcon||'⚡') : (GS.playerParty==='dem' ? 'D' : 'R');
  const oLabel = isInd ? 'Opp' : (GS.playerParty==='dem' ? 'R' : 'D');
  const scEl = document.getElementById('en-states-called');
  if(scEl){
    const thirdPart = thirdStates > 0 ? ` - ${thirdStates} Ind` : '';
    scEl.textContent = `${playerStates} ${pLabel} - ${oppStates} ${oLabel}${thirdPart} - ${remainStates} to call`;
  }

  // Pulse counter when getting close
  const demEl2 = document.getElementById('en-ev-dem');
  const repEl2 = document.getElementById('en-ev-rep');
  const thirdEl2 = document.getElementById('en-ev-third');
  const pEVcheck = isInd ? indPEV : EN.demEV;
  const oEVcheck = isInd ? Math.max(EN.demEV,EN.repEV) : EN.repEV;
  if(demEl2) demEl2.style.textShadow = pEVcheck>=250 ? `0 0 30px ${isInd?(GS.playerPartyColor||'#a855f7')+'99':'rgba(59,130,246,.6)'}` : 'none';
  if(isInd){
    if(repEl2) repEl2.style.textShadow = EN.demEV>=250 ? '0 0 30px rgba(59,130,246,.6)' : 'none';
    if(thirdEl2) thirdEl2.style.textShadow = EN.repEV>=250 ? '0 0 30px rgba(239,68,68,.6)' : 'none';
  } else {
    if(repEl2) repEl2.style.textShadow = oEVcheck>=250 ? '0 0 30px rgba(239,68,68,.6)' : 'none';
    if(thirdEl2) thirdEl2.style.textShadow = 'none';
  }
}

function showENWinner(isFinal=false){
  const isInd = GS.playerParty==='ind';
  const playerEV = isInd ? (EN.indPlayerEV||0) : (GS.playerParty==='dem' ? EN.demEV : EN.repEV);
  const oppEV    = isInd ? Math.max(EN.demEV,EN.repEV) : (GS.playerParty==='dem' ? EN.repEV : EN.demEV);
  const playerWon = playerEV >= 270;

  const banner = document.getElementById('en-winner-banner');
  const title = document.getElementById('en-winner-title');
  const sub = document.getElementById('en-winner-sub');
  const evEl = document.getElementById('en-winner-ev');

  if(playerWon){
    title.textContent = isFinal ? '🇺🇸 ELECTED PRESIDENT' : '🇺🇸 PROJECTED WINNER';
    title.style.color = '#c8a84b';
    sub.textContent = `${GS.playerName} has won the 2024 Presidential Election`;
  } else {
    title.textContent = isFinal ? '💔 ELECTION CALLED' : '💔 PROJECTED WINNER';
    title.style.color = '#ef4444';
    sub.textContent = `${GS.opponent.name} has won the 2024 Presidential Election`;
  }
  evEl.textContent = `${playerEV} - ${oppEV} Electoral Votes${isFinal?'':' - more states still coming in-'}`;
  evEl.style.color = playerWon ? '#c8a84b' : '#f87171';

  banner.classList.add('show');
  GS._electionResult = { won: playerWon };

  // Show candidate speeches when final result is confirmed
  if(isFinal) setTimeout(() => showCandidateSpeech(playerWon), 2000);
}

function finishElectionNight(){
  EN.timers.forEach(t=>clearTimeout(t));
  // Force-finish any remaining congressional races immediately
  if(_enCongress){
    // Fire all remaining individual queue items
    const q = _enCongress.queue;
    while(_enCongress.queueIndex < q.length){
      fireCongressCall(q[_enCongress.queueIndex]);
      _enCongress.queueIndex++;
    }
    // Drain any pending calls
    while(_enCongress.pendingCalls.length > 0){
      fireCongressCall(_enCongress.pendingCalls.shift());
    }
    // Snap house to final predetermined values
    _enCongress.house.dem = _enCongress.house.finalDem;
    _enCongress.house.rep = _enCongress.house.finalRep;
    _enCongress.house.called = 435;
    // Senate is already correct from individual race calls
    renderENCongressBoard();
    // Store final congress result on GS for end screen
    // Use the election-night tallied senate seats and predetermined house wave result directly.
    // The senate dem/rep counts already reflect envBonus coattails via _resolveCongressRace().
    // The house finalDem/finalRep already reflect the wave via waveSeatShift + compSwing.
    // No additional bonus is applied — it was double-counting and producing impossible totals.
    GS._congressResult = {
      senate: {
        dem: Math.min(_enCongress.senate.dem, 100 - _enCongress.senate.rep),
        rep: Math.min(_enCongress.senate.rep, 100 - _enCongress.senate.dem)
      },
      house: {
        dem: _enCongress.house.finalDem,
        rep: _enCongress.house.finalRep
      },
    };
  }
  const _isIndFin2 = GS.playerParty === 'ind';
  const _pIsDem2   = GS.playerParty === 'dem';
  const finalPlayerEV = _isIndFin2 ? (EN.indPlayerEV||0) : (_pIsDem2 ? EN.demEV : EN.repEV);
  const finalOppEV    = _isIndFin2 ? Math.max(EN.demEV,EN.repEV) : (_pIsDem2 ? EN.repEV : EN.demEV);
  const won = finalPlayerEV >= 270;
  // Store for later
  GS._finalResult = {won, finalPlayerEV, finalOppEV, popVote:{player:EN.playerPop, opp:EN.oppPop}};
  showBreakdownScreen(won, finalPlayerEV, finalOppEV);
}

function proceedToEndScreen(){
  const r = GS._finalResult || (()=> {
    const isInd = GS.playerParty === 'ind';
    const pIsDem = GS.playerParty === 'dem';
    const finalPlayerEV = isInd ? (EN.indPlayerEV||0) : (pIsDem ? EN.demEV : EN.repEV);
    const finalOppEV = isInd ? Math.max(EN.demEV,EN.repEV) : (pIsDem ? EN.repEV : EN.demEV);
    const won = finalPlayerEV >= 270;
    const fallback = {won, finalPlayerEV, finalOppEV, popVote:{player:EN.playerPop||0, opp:EN.oppPop||0}};
    GS._finalResult = fallback;
    return fallback;
  })();
  showEndScreen(r.won, 'general', r.finalPlayerEV, r.finalOppEV, r.popVote);
}

function showBreakdownScreen(won, pEV, oEV){
  showScreen('breakdown-screen');
  document.getElementById('bk-result-title').textContent = won ? '🇺🇸 Victory - Post-Election Analysis' : '💔 Defeat - Post-Election Analysis';
  document.getElementById('bk-result-title').style.color = won ? 'var(--accent)' : 'var(--rep)';

  // Build breakdown cards
  const playerParty = GS.playerParty;
  const isInd = playerParty === 'ind';
  const playerColor = isInd ? (GS.playerPartyColor||'#a855f7') : (playerParty==='dem' ? 'var(--dem)' : 'var(--rep)');
  const oppColor = playerParty==='dem' ? 'var(--rep)' : 'var(--dem)';
  const playerLabel = isInd ? (GS.playerPartyIcon||'⚡') : (playerParty==='dem'?'D':'R');
  const oppLabel = playerParty==='dem' ? 'R' : (playerParty==='rep' ? 'D' : 'R');

  // Helper: get bloc support in player's terms (positive = bloc favors player)
  const playerBloc = (key) => GS.playerParty === 'dem' ? GS_BLOCS[key].support : -GS_BLOCS[key].support;

  // 1) Swing state margins with poll vs reality
  const swingStates = GS.states
    .filter(s=>(typeof isSwingState === 'function') ? isSwingState(s.code) : Math.abs(s.lean)<=8)
    .sort((a,b)=>Math.abs(a.genLead)-Math.abs(b.genLead));
  const swingRows = swingStates.slice(0,8).map(s=>{
    const margin = s.genLead; // actual
    const pollMargin = s.genLead - (s._pollError||0); // poll was this
    const barW = Math.min(Math.abs(margin)*3, 46);
    const side = margin>0 ? playerColor : oppColor;
    const label = margin>0 ? `+${margin.toFixed(1)}%` : `${margin.toFixed(1)}%`;
    const pollLabel = pollMargin>0?`Poll: +${pollMargin.toFixed(1)}%`:`Poll: ${pollMargin.toFixed(1)}%`;
    const pollMatch = Math.sign(margin)===Math.sign(pollMargin);
    return `<div class="bk-swing-row">
      <span class="bk-swing-state">${s.code}</span>
      <div class="bk-swing-bar">
        <div class="bk-swing-fill" style="width:${barW}%;background:${side};${margin<0?'margin-left:auto':''}"></div>
      </div>
      <span class="bk-swing-val" style="color:${side}">${label}</span>
    </div>`;
  }).join('');

  // 1b) Poll vs Reality reveal - the "OH GOD" moment
  const pollRevealRows = swingStates.slice(0,8).map(s=>{
    const actual = s.genLead;
    const polled = actual - (s._pollError||0);
    const err = s._pollError || 0;
    const wasWrong = Math.sign(actual) !== Math.sign(polled) && Math.abs(actual)>0.5;
    const errStr = Math.abs(err)>0.5 ? (err>0?`+${err.toFixed(1)}% 📈`:`${err.toFixed(1)}% 📉`) : '~Accurate ✓';
    const rowColor = wasWrong ? '#ef4444' : Math.abs(err)>2 ? '#fb923c' : '#4ade80';
    return `<div class="bk-swing-row" style="${wasWrong?'background:rgba(239,68,68,.07);border-radius:4px;padding:2px 4px;':''}">
      <span class="bk-swing-state">${s.code}</span>
      <div style="flex:1;display:flex;flex-direction:column;gap:1px">
        <span style="font-size:9px;color:var(--text3)">Poll: ${polled>0?'+':''}${polled.toFixed(1)}%</span>
        <span style="font-size:10px;font-weight:600;color:${actual>0?playerColor:oppColor}">Result: ${actual>0?'+':''}${actual.toFixed(1)}%${wasWrong?' 🔴':''}</span>
      </div>
      <span style="font-family:var(--font-mono);font-size:9px;color:${rowColor};text-align:right;width:80px">${errStr}</span>
    </div>`;
  }).join('');

  // Calculate avg polling error and biggest miss
  const swingWithErr = swingStates.filter(s=>s._pollError!==undefined);
  const avgErr = swingWithErr.length ? (swingWithErr.reduce((s,x)=>s+Math.abs(x._pollError||0),0)/swingWithErr.length).toFixed(1) : '-';
  const biggestMiss = swingWithErr.sort((a,b)=>Math.abs(b._pollError||0)-Math.abs(a._pollError||0))[0];
  const wrongCallCount = swingStates.filter(s=>{
    const actual=s.genLead, polled=actual-(s._pollError||0);
    return Math.sign(actual)!==Math.sign(polled)&&Math.abs(actual)>0.5;
  }).length;

  // 2) Turnout by bloc
  const blocRows = Object.entries(GS_BLOCS).map(([k,b])=>{
    const playerSup = playerBloc(k); // positive = favors player
    const label = playerSup>5?`Fav +${Math.round(playerSup)}`:playerSup<-5?`Against −${Math.round(Math.abs(playerSup))}`:'~Neutral';
    const col = playerSup>8?'var(--green)':playerSup>2?'#86efac':playerSup<-8?'var(--rep)':playerSup<-2?'#fca5a5':'var(--text3)';
    return `<div class="bk-bloc-row">
      <span>${b.icon} ${b.name}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:${col}">${label}</span>
    </div>`;
  }).join('');

  // 3) Biggest mistake analysis
  const lostSwings = swingStates.filter(s=>s.genLead<0);
  const wonSwings = swingStates.filter(s=>s.genLead>0);
  let mistakeText = '';
  if(!won && lostSwings.length>0){
    // Find the closest state we lost - that was the critical mistake
    const closest = lostSwings.reduce((a,b)=>Math.abs(a.genLead)<Math.abs(b.genLead)?a:b);
    const wcFavor = playerBloc('wc');
    const swFavor = playerBloc('sw');
    if(wcFavor < 2 && ['PA','MI','WI','OH'].some(c=>lostSwings.find(s=>s.code===c))){
      mistakeText = `Your coalition with working class voters was weak in the Rust Belt. More labor-focused messaging could have secured key states - most critically ${closest.name} by ${Math.abs(closest.genLead).toFixed(1)}%.`;
    } else if(swFavor < 5 && ['AZ','GA','NC'].some(c=>lostSwings.find(s=>s.code===c))){
      mistakeText = `Suburban women broke against you in Sun Belt suburbs. Safety and economic stability messaging was insufficient - ${closest.name} slipped by ${Math.abs(closest.genLead).toFixed(1)}%.`;
    } else {
      mistakeText = `${closest.name} was the decisive loss - a margin of just ${Math.abs(closest.genLead).toFixed(1)}%. Better targeting of ${lostSwings.length>1?lostSwings.slice(0,2).map(s=>s.name).join(' and '):closest.name} could have changed the outcome.`;
    }
  } else if(won){
    const keyWin = wonSwings.length>0 ? wonSwings.reduce((a,b)=>Math.abs(a.genLead)<Math.abs(b.genLead)?a:b) : null;
    mistakeText = keyWin
      ? `The race was decided in ${keyWin.name} - won by just ${Math.abs(keyWin.genLead).toFixed(1)}%. Despite tight margins elsewhere, strong ${GS_BLOCS[pEV>290?'up':'sw'].name} support carried the night.`
      : `A dominant performance. Broad coalition support across voter blocs secured a decisive victory.`;
  } else {
    mistakeText = 'Unclear - the race was heavily contested across multiple states.';
  }

  // 4) Closest state
  const allDecided = GS.states.filter(s=>s.ev>0);
  const closestState = allDecided.reduce((a,b)=>Math.abs(a.genLead)<Math.abs(b.genLead)?a:b, allDecided[0]);
  const closestResult = closestState ? (closestState.genLead>0
    ? `${closestState.name} (${closestState.ev} EV) - won by ${Math.abs(closestState.genLead).toFixed(1)}%`
    : `${closestState.name} (${closestState.ev} EV) - lost by ${Math.abs(closestState.genLead).toFixed(1)}%`) : '-';

  // 5) Path to 270 recap
  const playerWonStates = GS.states.filter(s=>s.genLead>0).sort((a,b)=>b.ev-a.ev);
  const keyWins = playerWonStates.slice(0,6).map(s=>`${s.name} (${s.ev})`).join(', ');
  const path270 = pEV>=270
    ? `${pEV} EV secured via: ${keyWins}${playerWonStates.length>6?` +${playerWonStates.length-6} more states`:'.'}`
    : `Fell short at ${pEV} EV. The path required winning states that slipped: ${lostSwings.slice(0,3).map(s=>s.name).join(', ')}.`;

  // Render all cards
  document.getElementById('bk-grid').innerHTML = `
    <div class="bk-card">
      <div class="bk-card-title">Swing State Margins</div>
      <div class="bk-card-headline">Final Results by State</div>
      ${swingRows}
    </div>
    <div class="bk-card" style="border-color:${wrongCallCount>0?'rgba(239,68,68,.4)':'rgba(34,197,94,.25)'}">
      <div class="bk-card-title" style="color:${wrongCallCount>2?'#ef4444':'var(--text3)'}">📊 POLL vs REALITY REVEAL</div>
      <div class="bk-card-headline" style="color:${wrongCallCount>2?'#ef4444':'var(--text)'}">
        ${wrongCallCount>2?`😱 The Polls Were Catastrophically Wrong`
          :wrongCallCount>0?`🤔 Polls Missed ${wrongCallCount} State${wrongCallCount>1?'s':''}`
          :'✓ Polls Were Reasonably Accurate'}
      </div>
      <div style="display:flex;gap:12px;margin:6px 0 10px;font-family:var(--font-mono);font-size:11px">
        <span>Avg error: <b style="color:${parseFloat(avgErr)>3?'#ef4444':'#86efac'}">${avgErr}%</b></span>
        <span>Wrong calls: <b style="color:${wrongCallCount>0?'#ef4444':'#86efac'}">${wrongCallCount}</b></span>
      </div>
      ${pollRevealRows}
      ${biggestMiss?`<div style="margin-top:8px;padding:6px;background:rgba(200,168,75,.06);border-radius:4px;font-size:10px;color:var(--text3)">📌 Biggest miss: <b style="color:var(--accent)">${biggestMiss.name}</b> off by <b>${Math.abs(biggestMiss._pollError||0).toFixed(1)}%</b></div>`:''}
    </div>
    <div class="bk-card">
      <div class="bk-card-title">Voter Bloc Final Standings</div>
      <div class="bk-card-headline">Where Each Group Landed</div>
      ${blocRows}
    </div>
    <div class="bk-card">
      <div class="bk-card-title">${won?'Decisive Moment':'Biggest Mistake'}</div>
      <div class="bk-card-headline">${won?'What Won It':'Where It Was Lost'}</div>
      <div class="bk-card-body">${mistakeText}</div>
    </div>
    <div class="bk-card">
      <div class="bk-card-title">Closest State</div>
      <div class="bk-card-headline">Razor-Thin Margins</div>
      <div class="bk-card-body" style="font-size:14px;font-weight:600;color:var(--accent)">${closestResult}</div>
      ${closestState?`<div class="bk-card-body" style="margin-top:4px">${closestState.ev} electoral votes. A swing of ${(Math.abs(closestState.genLead)/2).toFixed(1)}% in turnout could have flipped this state.</div>`:''}
    </div>
    ${(()=>{
      const m=NATIONAL_MOODS[GS.nationalMood];
      if(!m) return '';
      const mCol=GS.nationalMood==='angry'?'#ef4444':GS.nationalMood==='change'?'#60a5fa':GS.nationalMood==='prosperity'?'#22c55e':GS.nationalMood==='fatigued'?'#8a93a8':'#a78bfa';
      const interpretation = GS.nationalMood==='change'
        ? (won ? 'The change wave was real - and you rode it perfectly.' : 'The change wave swept the field, but not in your direction.')
        : GS.nationalMood==='angry'
        ? (won ? 'The angry electorate found their champion in you.' : 'The fury in the country was too powerful to overcome.')
        : GS.nationalMood==='stability'
        ? (won ? 'Voters wanted steady hands - you delivered exactly that.' : 'The call for stability ultimately favoured the other side.')
        : GS.nationalMood==='fatigued'
        ? (won ? 'In a low-turnout race, your ground game made the difference.' : 'Voter apathy suppressed your coalition more than theirs.')
        : (won ? 'Economic optimism created a favourable climate for your message.' : 'Even prosperity couldn\'t stop the fundamentals from running against you.');
      return `<div class="bk-card" style="border-color:${mCol}44">
        <div class="bk-card-title" style="color:${mCol}">NATIONAL MOOD - REVEALED</div>
        <div class="bk-card-headline">${m.icon} ${m.name}</div>
        <div class="bk-card-body">${m.desc}</div>
        <div class="bk-card-body" style="margin-top:6px;padding:8px;background:${mCol}12;border-radius:6px;border-left:3px solid ${mCol};font-style:italic">"${interpretation}"</div>
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          <span style="font-size:9px;font-family:var(--font-mono);padding:2px 7px;border-radius:3px;background:${mCol}15;color:${mCol}">TURNOUT ${m.turnoutMod>0?'+':''}${m.turnoutMod}%</span>
          <span style="font-size:9px;font-family:var(--font-mono);padding:2px 7px;border-radius:3px;background:${mCol}15;color:${mCol}">RISK ${m.riskTolerance>0.7?'HIGH':m.riskTolerance<0.5?'LOW':'MODERATE'}</span>
          <span style="font-size:9px;font-family:var(--font-mono);padding:2px 7px;border-radius:3px;background:${mCol}15;color:${mCol}">DEBATE ${m.debateExpect==='high'||m.debateExpect==='combative'?'CHARGED':'SUBDUED'}</span>
        </div>
      </div>`;
    })()}
    <div class="bk-card" style="grid-column:1/-1">
      <div class="bk-card-title">Path to 270 Recap</div>
      <div class="bk-card-headline">${pEV} Electoral Votes ${won?'✓':'✗'}</div>
      <div class="bk-card-body">${path270}</div>
      <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">
        <div style="font-family:var(--font-mono);font-size:11px;padding:4px 10px;background:rgba(59,130,246,.15);border-radius:4px;color:#60a5fa">${playerLabel} ${pEV} EV</div>
        <div style="font-family:var(--font-mono);font-size:11px;padding:4px 10px;background:rgba(239,68,68,.15);border-radius:4px;color:#f87171">${oppLabel} ${oEV} EV</div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text3);margin-left:auto">538 total - 270 to win</div>
      </div>
    </div>

    ${(()=>{
      // ── HISTORICAL COMPARISON ──────────────────────────────────────────
      const historicalMaps = [
        { year:1964, name:'LBJ 1964', party:'dem', ev:486, desc:'A historic landslide. Near-unanimous coalition of urban, suburban and rural voters.',
          match: p => p>440 },
        { year:2008, name:'Obama 2008', party:'dem', ev:365, desc:'A change wave fuelled by historic youth and urban turnout. Carried traditional swing states with ease.',
          match: (p,won,mood) => won && p>=340 && p<=400 },
        { year:1992, name:'Clinton 1992', party:'dem', ev:370, desc:'A three-way race that delivered a moderate Democrat to the White House on economic anxiety.',
          match: (p,won,mood) => won && p>=340 && p<=400 && mood==='angry' },
        { year:2012, name:'Obama 2012', party:'dem', ev:332, desc:'A steady incumbent held on through strong urban turnout and a fractured opposition coalition.',
          match: (p,won) => won && p>=310 && p<=345 },
        { year:2020, name:'Biden 2020', party:'dem', ev:306, desc:'A narrow but decisive victory in the Rust Belt, flipping key states by single-digit margins.',
          match: (p,won) => won && p>=290 && p<=315 },
        { year:2000, name:'Gore 2000', party:'dem', ev:266, desc:'An agonisingly close election decided in a single state, ultimately falling just short.',
          match: (p,won) => !won && p>=240 && p<=270 },
        { year:1948, name:'Truman 1948', party:'dem', ev:303, desc:'The ultimate underdog comeback. Polls showed defeat - the voters said otherwise.',
          match: (p,won,mood) => won && mood==='angry' && p>=270 && p<=320 },
        { year:1984, name:'Reagan 1984', party:'rep', ev:525, desc:'A landslide built on prosperity and sunny optimism. An electorate that felt good voted big.',
          match: p => p>440 },
        { year:2016, name:'Trump 2016', party:'rep', ev:306, desc:'The polling upset of a generation. Rust Belt voters broke decisively against expectations.',
          match: (p,won,mood) => won && mood==='angry' && p>=270 && p<=320 },
        { year:1980, name:'Reagan 1980', party:'rep', ev:489, desc:'A wave election fuelled by economic discontent and a desire for change swept the incumbent out.',
          match: (p,won,mood) => won && p>=380 && mood==='change' },
        { year:2004, name:'Bush 2004', party:'rep', ev:286, desc:'A wartime incumbent squeaked through on national security and a narrow base coalition.',
          match: (p,won) => won && p>=270 && p<=295 },
        { year:1960, name:'Kennedy 1960', party:'dem', ev:303, desc:'One of the narrowest presidential contests ever - decided by a handful of key industrial states.',
          match: (p,won) => won && p>=270 && p<=305 },
      ];

      const mood = GS.nationalMood || 'change';
      const party = playerParty;
      const matches = historicalMaps.filter(h =>
        h.party === party && h.match(pEV, won, mood)
      );
      const best = matches.length
        ? matches.reduce((a,b) => Math.abs(a.ev - pEV) < Math.abs(b.ev - pEV) ? a : b)
        : historicalMaps.filter(h=>h.party===party).reduce((a,b) => Math.abs(a.ev-pEV)<Math.abs(b.ev-pEV)?a:b, historicalMaps.find(h=>h.party===party));

      const similarity = best ? Math.max(60, 100 - Math.abs(best.ev - pEV) * 0.8).toFixed(0) : '-';
      const histColor = won ? 'var(--accent)' : '#f87171';

      return best ? `
      <div class="bk-card" style="border-color:${histColor}44">
        <div class="bk-card-title" style="color:${histColor}">📚 HISTORICAL COMPARISON</div>
        <div class="bk-card-headline" style="color:${histColor}">Your victory map most closely resembles ${best.name}</div>
        <div style="display:flex;align-items:center;gap:12px;margin:8px 0 6px">
          <div style="background:${histColor}15;border:1px solid ${histColor}44;border-radius:6px;padding:8px 14px;text-align:center;flex-shrink:0">
            <div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:${histColor}">${best.ev}</div>
            <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3)">HISTORICAL EV</div>
          </div>
          <div style="background:var(--accent)15;border:1px solid var(--accent)44;border-radius:6px;padding:8px 14px;text-align:center;flex-shrink:0">
            <div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:var(--accent)">${pEV}</div>
            <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3)">YOUR EV</div>
          </div>
          <div style="flex:1">
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);margin-bottom:4px">MAP SIMILARITY</div>
            <div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:5px">
              <div style="height:100%;background:${histColor};width:${similarity}%;transition:width .8s ease"></div>
            </div>
            <div style="font-family:var(--font-mono);font-size:10px;color:${histColor}">${similarity}% match</div>
          </div>
        </div>
        <div class="bk-card-body" style="font-style:italic;color:var(--text2)">"${best.desc}"</div>
      </div>` : '';
    })()}
    ${(()=>{
      // ── CONGRESSIONAL CONTROL ──────────────────────────────────────────
      const cr = GS._congressResult;
      if(!cr) return '';

      const sDem = cr.senate.dem, sRep = cr.senate.rep;
      const hDem = cr.house.dem, hRep = cr.house.rep;
      const playerIsDem = playerParty === 'dem';
      const playerSenate = playerIsDem ? sDem : sRep;
      const playerHouse  = playerIsDem ? hDem : hRep;
      const senMajority  = playerSenate >= 51;
      const hseMajority  = playerHouse >= 218;
      const filibusterProof = playerSenate >= 60;
      const unifiedGov   = won && senMajority && hseMajority;

      let govLabel, govDesc, govColor, govIcon;
      if (!won) {
        govLabel = 'Opposition Government';
        govDesc  = 'You lost the White House. Congressional results are largely academic - expect gridlock and investigations.';
        govColor = '#f87171';
        govIcon  = '🔴';
      } else if (filibusterProof && hseMajority) {
        govLabel = 'Filibuster-Proof Supermajority';
        govDesc  = 'A historic mandate. With 60+ Senate seats and a House majority, your party can pass any legislation without compromise. Your legacy is limited only by ambition.';
        govColor = '#22c55e';
        govIcon  = '🏛';
      } else if (unifiedGov) {
        govLabel = 'Unified Government';
        govDesc  = 'You control both chambers. Major legislation is achievable, but you\'ll need to hold every vote - and the filibuster still threatens the Senate.';
        govColor = '#60a5fa';
        govIcon  = '⚖️';
      } else if (won && (senMajority || hseMajority)) {
        govLabel = 'Partial Majority';
        govDesc  = `You won the White House but face a split Congress. ${senMajority ? 'You hold the Senate but lost the House.' : 'You hold the House but lack a Senate majority.'} Expect legislative compromises and executive actions.`;
        govColor = '#c8a84b';
        govIcon  = '🤝';
      } else {
        govLabel = 'Divided Government';
        govDesc  = 'You won the presidency but face a hostile Congress. Executive orders will be your primary tool. Major legislation requires bipartisan negotiation - or goes nowhere.';
        govColor = '#c8a84b';
        govIcon  = '⚔️';
      }

      // Legacy projections
      const legacyItems = [];
      if (filibusterProof && won)   legacyItems.push({ icon:'✅', text:'Can pass sweeping legislation without Republican votes' });
      else if (unifiedGov && won)   legacyItems.push({ icon:'⚠️', text:'Major bills need every Senate Democrat - filibuster looms' });
      else if (won && !unifiedGov)  legacyItems.push({ icon:'🚫', text:'Major legislation will require bipartisan deals' });
      if (sDem >= 51 && won)        legacyItems.push({ icon:'✅', text:'Senate judiciary committee confirms your nominees' });
      if (hDem < 218 && won)        legacyItems.push({ icon:'⚠️', text:'House investigations likely to dominate news cycles' });
      if (won)                       legacyItems.push({ icon: pEV >= 330 ? '🌊' : '📋', text: pEV >= 330 ? 'Landslide mandate amplifies legislative leverage' : 'Narrow win - mandate is contested, build coalitions' });

      const deepStateBonus = (()=>{
        if(!GS.states) return 0;
        const deepPlayerStates = GS.states.filter(s => {
          const isPlayerSafe = playerIsDem ? s.lean > 18 : s.lean < -18;
          return isPlayerSafe && s.genLead > 12;
        });
        return deepPlayerStates.length;
      })();
      const deepNote = deepStateBonus >= 8
        ? 'Strong performance in safe states boosted coattail effects in Congressional races.'
        : deepStateBonus >= 5
        ? 'Moderate coattail effects - safe-state margins helped some down-ballot races.'
        : 'Limited coattail effects from safe states this cycle.';

      return `
      <div class="bk-card" style="grid-column:1/-1;border-color:${govColor}44">
        <div class="bk-card-title" style="color:${govColor}">🏛 CONGRESSIONAL CONTROL & GOVERNING MANDATE</div>
        <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px">
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 18px;text-align:center;min-width:110px">
              <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3);letter-spacing:.15em;margin-bottom:6px">SENATE</div>
              <div style="display:flex;gap:8px;align-items:center;justify-content:center">
                <div><div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:#3b82f6;line-height:1">${sDem}</div><div style="font-family:var(--font-mono);font-size:8px;color:#3b82f6">DEM</div></div>
                <div style="color:var(--text3);font-size:11px">-</div>
                <div><div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:#ef4444;line-height:1">${sRep}</div><div style="font-family:var(--font-mono);font-size:8px;color:#ef4444">REP</div></div>
              </div>
              ${filibusterProof && playerIsDem ? '<div style="font-family:var(--font-mono);font-size:8px;color:#22c55e;margin-top:5px">🔓 FILIBUSTER-PROOF</div>' : sDem>=51 ? '<div style="font-family:var(--font-mono);font-size:8px;color:#60a5fa;margin-top:5px">🔵 DEM MAJORITY</div>' : '<div style="font-family:var(--font-mono);font-size:8px;color:#ef4444;margin-top:5px">🔴 REP MAJORITY</div>'}
            </div>
            <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 18px;text-align:center;min-width:110px">
              <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3);letter-spacing:.15em;margin-bottom:6px">HOUSE</div>
              <div style="display:flex;gap:8px;align-items:center;justify-content:center">
                <div><div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:#3b82f6;line-height:1">${hDem}</div><div style="font-family:var(--font-mono);font-size:8px;color:#3b82f6">DEM</div></div>
                <div style="color:var(--text3);font-size:11px">-</div>
                <div><div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:#ef4444;line-height:1">${hRep}</div><div style="font-family:var(--font-mono);font-size:8px;color:#ef4444">REP</div></div>
              </div>
              ${hDem>=218 ? '<div style="font-family:var(--font-mono);font-size:8px;color:#60a5fa;margin-top:5px">🔵 DEM MAJORITY</div>' : '<div style="font-family:var(--font-mono);font-size:8px;color:#ef4444;margin-top:5px">🔴 REP MAJORITY</div>'}
            </div>
          </div>
          <div style="flex:1;min-width:200px">
            <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;background:${govColor}14;border:1px solid ${govColor}44;border-radius:6px;margin-bottom:10px">
              <span style="font-size:18px">${govIcon}</span>
              <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:${govColor};letter-spacing:.05em">${govLabel}</span>
            </div>
            <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:10px">${govDesc}</div>
            ${legacyItems.map(li=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);margin-bottom:4px"><span>${li.icon}</span><span>${li.text}</span></div>`).join('')}
          </div>
        </div>
        <div style="padding:8px 12px;background:rgba(200,168,75,.05);border-radius:5px;border-left:3px solid var(--accent);font-size:11px;color:var(--text3);font-style:italic">${deepNote}</div>
      </div>`;
    })()}
  `;
  // Show/hide the First 100 Days button based on whether the player won
  const _p100btn = document.getElementById('bk-presidency-btn');
  const _p100sub = document.getElementById('bk-presidency-sub');
  if(_p100btn) _p100btn.style.display = won ? 'flex' : 'none';
  if(_p100sub) _p100sub.style.display = won ? 'block' : 'none';
}

function buildENMap(){
  const svg = document.getElementById('en-map');
  svg.innerHTML = '';
  const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','960');bg.setAttribute('height','600');bg.setAttribute('fill','#060810');svg.appendChild(bg);
  // Inset borders for AK and HI
  const addRect=(x,y,w,h)=>{const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('fill','none');r.setAttribute('stroke','#1e2535');r.setAttribute('stroke-width','1');svg.appendChild(r)};
  addRect(8,455,195,135);addRect(218,495,150,78);
  STATE_DATA.forEach(state=>{
    const d = PATHS[state.code]; if(!d) return;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);
    path.setAttribute('class','state-path');
    path.setAttribute('id',`en-path-${state.code}`);
    path.style.fill = '#1e2535';
    path.style.stroke = '#060810';
    path.style.strokeWidth = '0.8';
    svg.appendChild(path);
    // State label
    const c = pathCenter(d);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',c.x);txt.setAttribute('y',c.y);
    txt.setAttribute('text-anchor','middle');txt.setAttribute('dominant-baseline','central');
    txt.setAttribute('font-size','7');txt.setAttribute('font-family','IBM Plex Mono,monospace');
    txt.setAttribute('fill','rgba(255,255,255,.5)');txt.setAttribute('pointer-events','none');
    txt.textContent = state.code;
    svg.appendChild(txt);
    // EV label (slightly below state code)
    const evTxt = document.createElementNS('http://www.w3.org/2000/svg','text');
    evTxt.setAttribute('x',c.x);evTxt.setAttribute('y',c.y+8);
    evTxt.setAttribute('text-anchor','middle');evTxt.setAttribute('dominant-baseline','central');
    evTxt.setAttribute('font-size','5.5');evTxt.setAttribute('font-family','IBM Plex Mono,monospace');
    evTxt.setAttribute('fill','rgba(255,255,255,.35)');evTxt.setAttribute('pointer-events','none');
    evTxt.textContent = state.ev;
    svg.appendChild(evTxt);
  });
}

// Export for game.js stub
window.launchElectionNight = _launchEN;
