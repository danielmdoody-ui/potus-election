// ═══════════════════════════════════════════════════════════════════════════════
// POTUS — First 100 Days  v4.0 — YOU ARE THE PRESIDENT
//
// Core change: You TYPE your response as President. The AI reads your words,
// judges the decision in context, and narrates real consequences.
// No more multiple-choice. Every situation is a presidential briefing.
//
// Bug fixes vs v3.0:
//   [1] Template literal rendering bug → cabinet now uses data-attributes
//   [2] "No sequences left" → main.js creates fresh context per call (see main.js)
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

let P100 = null;

const P100_PHASES = [
  { id:'transition',  label:'Transition',  days:[1,14],  icon:'🏛', color:'#c8a84b' },
  { id:'first_acts',  label:'First Acts',  days:[15,35], icon:'📜', color:'#3b82f6' },
  { id:'legislation', label:'Legislation', days:[36,65], icon:'⚖️', color:'#a78bfa' },
  { id:'crisis',      label:'Crisis',      days:[66,88], icon:'🚨', color:'#ef4444' },
  { id:'legacy',      label:'Legacy',      days:[89,100],icon:'🇺🇸', color:'#22c55e' },
];

const P100_STATS = [
  { id:'economy',        label:'Economy',        icon:'📈', weight:0.30 },
  { id:'foreignPolicy',  label:'Foreign Policy', icon:'🌐', weight:0.20 },
  { id:'healthcare',     label:'Healthcare',     icon:'🏥', weight:0.18 },
  { id:'nationSecurity', label:'Nat. Security',  icon:'🛡',  weight:0.17 },
  { id:'mediaRelations', label:'Media',          icon:'📺', weight:0.15 },
];

const P100_AGENDA_OPTIONS = [
  { id:'economic_growth',   label:'Economic Growth',        icon:'📈', stat:'economy',        bonus:12, description:'Tax reform, infrastructure, deregulation.' },
  { id:'climate_action',    label:'Climate Action',         icon:'🌱', stat:'economy',         bonus:-4, description:'Bold climate legislation. Costly short-term.' },
  { id:'healthcare_reform', label:'Healthcare Reform',      icon:'🏥', stat:'healthcare',      bonus:12, description:'Expand coverage, reduce costs.' },
  { id:'border_security',   label:'Border & Immigration',   icon:'🛡', stat:'nationSecurity',  bonus:10, description:'Enforce immigration law, build coalitions.' },
  { id:'nato_strength',     label:'NATO & Alliances',       icon:'🌐', stat:'foreignPolicy',   bonus:12, description:'Rebuild alliances, reassert global leadership.' },
  { id:'tax_cuts',          label:'Tax Cut Package',        icon:'💰', stat:'economy',         bonus:10, description:'Across-the-board tax relief.' },
  { id:'criminal_justice',  label:'Criminal Justice Reform',icon:'⚖️', stat:'mediaRelations', bonus:8,  description:'Police reform and sentencing overhaul.' },
  { id:'tech_regulation',   label:'Tech Regulation',        icon:'💻', stat:'economy',         bonus:4,  description:'Antitrust action on big tech.' },
  { id:'military_rebuild',  label:'Military Modernization', icon:'🛡', stat:'nationSecurity',  bonus:12, description:'Defense spending, cyber capabilities.' },
  { id:'media_outreach',    label:'Press Engagement',       icon:'📺', stat:'mediaRelations',  bonus:14, description:'Open White House to media.' },
];

const CABINET_ROLES = [
  { role:'Secretary of State',           stat:'foreignPolicy',  icon:'🌐' },
  { role:'Secretary of the Treasury',    stat:'economy',        icon:'💰' },
  { role:'Secretary of Defense',         stat:'nationSecurity', icon:'🛡' },
  { role:'Attorney General',             stat:'mediaRelations', icon:'⚖️' },
  { role:'Sec. Health & Human Services', stat:'healthcare',     icon:'🏥' },
  { role:'Chief of Staff',               stat:null,             icon:'🏛' },
  { role:'CIA Director',                 stat:'nationSecurity', icon:'🔍' },
  { role:'Sec. Homeland Security',       stat:'nationSecurity', icon:'🔒' },
];

const WORLD_ACTORS = [
  { id:'gop_senate',  label:'Republican Senate', icon:'🔴', initial:50, party:'rep' },
  { id:'dem_senate',  label:'Democratic Senate', icon:'🔵', initial:50, party:'dem' },
  { id:'nato_allies', label:'NATO Allies',        icon:'🌐', initial:65, party:null  },
  { id:'wall_street', label:'Wall Street',        icon:'📈', initial:55, party:null  },
  { id:'press_corps', label:'Press Corps',        icon:'📺', initial:45, party:null  },
  { id:'military',    label:'Joint Chiefs',       icon:'🛡', initial:60, party:null  },
  { id:'labor_unions',label:'Labor Unions',       icon:'🔧', initial:50, party:null  },
  { id:'tech_sector', label:'Tech Sector',        icon:'💻', initial:50, party:null  },
];

const ADVISOR_BIOS = {
  chief_of_staff:{ title:'Chief of Staff',         icon:'🏛' },
  press_sec:     { title:'Press Secretary',        icon:'📺' },
  nsc_advisor:   { title:'NSC Advisor',            icon:'🛡' },
  econ_advisor:  { title:'Chief Economic Advisor', icon:'📈' },
  vp:            { title:'Vice President',         icon:'⭐' },
};

// ── Situation pool — briefs only, no multiple choice ─────────────────────────
const SITUATION_POOL = {
  transition:[
    { id:'t1', headline:'Markets Await Your Economic Signal',
      brief:'The Dow dropped 0.8% at open as investors await your first economic policy statement. Treasury briefed you at 7am: the Fed is watching your tone on monetary independence carefully. Three CEOs have requested urgent calls. The press corps is outside.',
      advisorVoice:'econ_advisor', advisorLine:'Every word you say today moves indices. What are we telling them?' },
    { id:'t2', headline:'NATO Ally Tests Your Foreign Policy Resolve',
      brief:'The Prime Minister of a key NATO partner called to congratulate you, then asked directly where you stand on Article 5 regarding a contested border region near their eastern flank. The call is still live. Your NSC advisor is in the room with you.',
      advisorVoice:'nsc_advisor', advisorLine:'This is not a courtesy call. They are testing you. What is your response?' },
    { id:'t3', headline:'First Classified Intelligence Brief Changes Everything',
      brief:'Your first PDB contained a section your predecessor deliberately downplayed — a credible threat from a state actor rated at 70% likelihood within 18 months. You are now the only person who can authorize the next step. Three intelligence chiefs are waiting.',
      advisorVoice:'nsc_advisor', advisorLine:'Three agencies, one assessment. The IC needs your authorization. What do you want to do?' },
    { id:'t4', headline:'Press Demanding First Statement on the Economy',
      brief:'The White House press pool has been camped outside for two hours. Unemployment ticked up 0.1% this morning. Your comms team says the story writes itself without a statement from you — and none of the drafts they have are good enough. This one needs your voice.',
      advisorVoice:'press_sec', advisorLine:'They are going to write this story with or without us. What do you want to say?' },
    { id:'t5', headline:'Senate Ally Demands Concession on Cabinet',
      brief:'Senator Rodriguez — whose vote you need for three confirmations — is privately demanding you drop a specific cabinet nominee she calls unconfirmable. She has four other senators in her pocket. Your Chief of Staff flagged this at breakfast. She wants an answer by 3pm.',
      advisorVoice:'chief_of_staff', advisorLine:'She has the votes. But giving in sets a precedent for every confirmation to come. What is the call?' },
    { id:'t6', headline:'Inaugural Address: Final Revisions Due Tonight',
      brief:'Your speechwriters have a draft. Your communications director loves it. Your VP thinks it is too bold. 45 million people will watch. The address in four days will define expectations for everything that follows. You have final edit authority and they need direction tonight.',
      advisorVoice:'press_sec', advisorLine:'It is your words, Mr. President. What is the central message you want Americans to carry with them?' },
  ],
  first_acts:[
    { id:'f1', headline:'First Executive Order — The Clock Is Ticking',
      brief:'Your legislative director says the window for maximum executive action is the first 30 days. Day 18 and you have not signed anything yet. Your policy team has a stack of drafts ready. The opposition is already preparing legal challenges. Your base is getting impatient.',
      advisorVoice:'chief_of_staff', advisorLine:'West Wing is asking what we are signing first. What is the priority?' },
    { id:'f2', headline:'NATO Summit — Your First Seat at the Table',
      brief:'You have been invited to Brussels for an emergency NATO summit. The situation on the eastern flank has deteriorated significantly. Three member states are invoking Article 4 consultations. Your NSC says your attendance — or absence — will be the defining signal of your first foreign policy chapter.',
      advisorVoice:'nsc_advisor', advisorLine:'The alliance is watching. Are you going, and what is the message when you arrive?' },
    { id:'f3', headline:'First Solo Press Conference — Briefing Room Packed',
      brief:'The briefing room is full for your first presidential press conference. You can see four correspondents who filed hostile pieces this week. Your Press Secretary is warming up the room. You have sixty seconds before you walk out. There is no script — just you.',
      advisorVoice:'press_sec', advisorLine:'Reuters has a question on the intelligence leak. Trade desk is going after tariffs. How do you want to handle the hostile ones?' },
    { id:'f4', headline:'Opposition Leader Wants a Private Meeting',
      brief:'The Senate Minority Leader has privately requested an Oval Office meeting — no cameras, no staff, just the two of you. Intelligence says she is considering crossover support on two of your agenda priorities. But she will want something significant in return.',
      advisorVoice:'vp', advisorLine:'She would not ask for this meeting unless she wanted to deal. What are you willing to give?' },
    { id:'f5', headline:'Key Ally Requests US Military Presence',
      brief:'South Korea formally requested increased US military presence in response to three consecutive missile tests. Joint Chiefs says it is operationally feasible within 72 hours. State says approve it. Treasury says it will cost $2.3 billion in the current fiscal year.',
      advisorVoice:'nsc_advisor', advisorLine:'Seoul is counting on a response. What is your answer?' },
    { id:'f6', headline:'Worse-Than-Expected Wage Report Triggers Pressure',
      brief:'A worse-than-expected monthly wage report triggered immediate bipartisan calls for emergency action. The progressive caucus wants a minimum wage executive order by end of week. The Business Roundtable sent a formal letter warning against any interference. Your economic team is split three different ways.',
      advisorVoice:'econ_advisor', advisorLine:'The numbers are not catastrophic but they are bad. Congress is moving. What is our policy response?' },
  ],
  legislation:[
    { id:'l1', headline:'Your Flagship Bill Is Stalling in the Senate',
      brief:'The Senate Majority Leader called at 6am. Your signature bill has three defectors from your own party. Your legislative director says there may be a path no one has tried yet, but it requires you personally to make the calls. The opposition is holding firm and watching how you respond to your own caucus breaking.',
      advisorVoice:'vp', advisorLine:'Three votes short. What do you want me to tell them?' },
    { id:'l2', headline:'Government Shutdown in 72 Hours',
      brief:'Funding runs out in three days. The Speaker will not move without concessions on discretionary spending. Your OMB director says a shutdown costs $600 million per day. Countdown clocks are already running on every network. Both sides are waiting to see who blinks first.',
      advisorVoice:'chief_of_staff', advisorLine:'72 hours. The Speaker\'s staff are in the building right now. What is your opening position?' },
    { id:'l3', headline:'Healthcare Vote: Progressive Wing Breaks at Critical Moment',
      brief:'Four progressive members of your party announced they are voting against your healthcare bill unless the public option is fully restored. Without them you lose the House. With them you lose three centrists. You have a call with the caucus chair in ten minutes.',
      advisorVoice:'vp', advisorLine:'You cannot have both. What do you tell the caucus chair?' },
    { id:'l4', headline:'Infrastructure Deal — Bipartisan Path Requires a Concession',
      brief:'The ranking member of the Infrastructure Committee reached out privately. She will bring five crossover votes for your $1.2 trillion package if you drop the clean energy provision and publicly credit the bipartisan effort. Your base will call it a betrayal. But the deal closes today or it dies.',
      advisorVoice:'chief_of_staff', advisorLine:'She has the votes. But this is a real concession. What do you want to do?' },
    { id:'l5', headline:'Tax Package Deadlocked in Conference Committee',
      brief:'The House and Senate tax package versions are irreconcilable at the committee level. The conference committee deadlock has landed on your desk. Both sides are waiting for you to break the stalemate. Whatever version you back, someone in your coalition will be furious.',
      advisorVoice:'econ_advisor', advisorLine:'Conference is gridlocked. This one is yours to solve.' },
  ],
  crisis:[
    { id:'c1', headline:'Category 5 Hurricane Makes Landfall — FEMA Overwhelmed',
      brief:'A category 5 hurricane made landfall in Louisiana at 3am. FEMA is overwhelmed. The governor — an opposition ally — is on every network blaming your administration\'s pre-storm positioning. 200,000 people without power. The Situation Room is full. Every senator from the affected states is calling.',
      advisorVoice:'chief_of_staff', advisorLine:'FEMA director on line one. The governor is on every channel. Where do you want to start?' },
    { id:'c2', headline:'State-Sponsored Cyberattack — NSA Confirms Attribution',
      brief:'NSA confirmed at midnight: a sophisticated state actor breached Treasury and Energy Department systems simultaneously. Attribution is 90 percent certain — your NSC named the state in a classified memo twenty minutes ago. You have a window to act before it leaks to the press.',
      advisorVoice:'nsc_advisor', advisorLine:'We know who did this. We have options ready. What is the response?' },
    { id:'c3', headline:'War Could Begin Today — Six Hours to Act',
      brief:'An adversarial state has mobilized forces along the border of a NATO partner. The UN Security Council is paralyzed by veto. Allies are calling every fifteen minutes. Your Secretary of Defense and Secretary of State have given you conflicting recommendations. NSC estimates six hours before deterrence fails.',
      advisorVoice:'nsc_advisor', advisorLine:'Mr. President. Six hours. What are your orders?' },
    { id:'c4', headline:'Classified Leak Triggers Firestorm — Goes Live in Eight Minutes',
      brief:'A classified memorandum detailing internal divisions on a sensitive military option has leaked to three major outlets simultaneously. Someone inside the White House did this. Every network is preparing to run it live in eight minutes. Your Press Secretary needs to know what to say right now.',
      advisorVoice:'press_sec', advisorLine:'Eight minutes. Do we confirm, deny, or get ahead of it? I need your decision now.' },
    { id:'c5', headline:'Markets Down 15% — Recession Confirmed',
      brief:'Two consecutive quarters of negative GDP growth. The Dow has shed 15 percent since your inauguration. Your approval is sliding badly. Congress is in emergency session demanding action. The Federal Reserve Chair is requesting an Oval Office meeting this afternoon.',
      advisorVoice:'econ_advisor', advisorLine:'The numbers are bad and getting worse every hour. We need to move. What is the play?' },
    { id:'c6', headline:'Domestic Terror Plot Stopped — Two Agents Killed',
      brief:'A coordinated attack on federal infrastructure across three cities was stopped — but not before two federal agents were killed. The attacker network has been linked to a domestic extremist organization. Every senator is calling for a response. The nation is frightened and watching you.',
      advisorVoice:'press_sec', advisorLine:'America needs to hear from you tonight. What do you say?' },
  ],
  legacy:[
    { id:'lg1', headline:'Supreme Court Vacancy — Your Historical Appointment',
      brief:'Justice Chen announced retirement effective at your convenience. The vacancy is yours to fill. Legal teams have shortlisted three candidates ranging from consensus builder to ideological heavyweight. This pick will shape American law for thirty years. Both parties are maneuvering before you say a word publicly.',
      advisorVoice:'chief_of_staff', advisorLine:'This is the one they will remember above everything else. Who do you nominate and how do you sell it?' },
    { id:'lg2', headline:'Historic Diplomatic Breakthrough — You Must Be in the Room',
      brief:'Back-channel negotiations — months in the making — have produced a stunning opening: two longstanding adversaries are prepared to sign a framework agreement, but only if you personally fly to the summit and stake your reputation on the deal. No President has achieved this before.',
      advisorVoice:'nsc_advisor', advisorLine:'This does not happen twice. They will only sign with you in the room. What is your decision?' },
    { id:'lg3', headline:'Three Holdout Senators — Final Legislative Push',
      brief:'Your legislative director says the votes are there for one final bill of the first 100 days if you personally call three holdout senators tonight. The whip has set 11pm as the last window. After this the political calendar shifts and this bill likely never passes. Your voice, not staff.',
      advisorVoice:'vp', advisorLine:'Three calls. Three senators. They will not move for anyone but you. Are you making these calls tonight?' },
    { id:'lg4', headline:'100th Day — Final Address to the Nation',
      brief:`Tomorrow is Day 100. Your speechwriters need final direction tonight. The nation will measure everything against your campaign promises. Your approval stands at ${()=>P100?.approvalRating||52}%. Whatever you say tonight becomes the first line of your political biography. What is your closing argument?`,
      advisorVoice:'press_sec', advisorLine:'The Oval Office is set. The cameras are ready. What do you tell America?' },
  ],
};

const RESPONSE_SUGGESTIONS = {
  transition: ['Issue a firm statement on our economic priorities today','Convene a private NSC meeting before any public announcement','Meet the Senate leader one-on-one to hear their concerns','Address the press corps directly and unscripted'],
  first_acts: ['Sign executive orders on our top three agenda items immediately','Go to Brussels personally — send an unmistakable signal','Hold firm — do not give the opposition any early wins','Reach across the aisle before the honeymoon period ends'],
  legislation: ['Call the holdouts myself tonight — make it personal','Accept a compromise — a partial win is still a win','Take this to the public and pressure Congress directly','Invoke reconciliation and bypass the filibuster'],
  crisis: ['Federalize the response — take personal command','Authorize an immediate classified counter-operation','Address the nation tonight with transparency and calm','Convene an emergency bipartisan session of Congress'],
  legacy: ['Nominate the boldest candidate — define the court for a generation','Fly to the summit myself — this deal needs my signature','Make the three calls tonight and close the last bill','Speak directly to the American people about what we built'],
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — INIT
// ══════════════════════════════════════════════════════════════════════════════
function initFirst100Days() {
  const GS     = window.GS;
  const pIsDem = GS?.playerParty === 'dem';
  // Use actual election night congress results if available
  const _cr = GS?._congressResult;
  const senateDem = _cr?.senate?.dem ?? (pIsDem?Math.floor(48+Math.random()*10):Math.floor(40+Math.random()*12));
  const _rawHouseRep = _cr ? (435 - (_cr.house?.dem ?? 0)) : null;
  const houseRep  = _rawHouseRep ?? (pIsDem?Math.floor(190+Math.random()*40):Math.floor(220+Math.random()*30));
  const senateRep = 100-senateDem, houseDem = 435-houseRep;
  const ev        = GS?._finalResult?.finalPlayerEV ?? GS?.playerEV  ?? 306;
  const evLine    = ev>=350?'landslide':ev>=310?'strong':ev>=270?'narrow':'close';
  const name      = GS?.playerName ?? 'President';
  const lastName  = name.split(' ').slice(-1)[0];
  const party     = pIsDem?'Democratic':'Republican';

  const fn=['James','Sarah','Michael','Patricia','Robert','Jennifer','William','Linda','David','Barbara','Elena','Marcus','Thomas','Angela','Priya','Devon','Carlos','Ngozi'];
  const ln=['Harrison','Mitchell','Chen','Rodriguez','Williams','Patel','Thompson','Anderson','Garcia','Kim','Okafor','Vasquez','Brooks','Jensen','Nakamura','Reeves','Osei'];
  const genName=()=>`${fn[Math.floor(Math.random()*fn.length)]} ${ln[Math.floor(Math.random()*ln.length)]}`;

  const cabinet = CABINET_ROLES.map(r=>{
    const controversial=Math.random()<0.3;
    const pSen=pIsDem?senateDem:senateRep;
    const senFor=controversial?Math.min(57,Math.max(44,pSen+Math.floor(Math.random()*8)-4)):Math.min(88,Math.max(62,pSen+Math.floor(Math.random()*18)));
    const bios=[`Former ${['governor','senator','CEO','general','diplomat'][Math.floor(Math.random()*5)]} with deep policy expertise.`,`Veteran ${party} ally with broad Senate relationships and strong credentials.`,`Respected technocrat known for cross-aisle deal-making.`,`High-profile pick with strong record and a polarising public history.`];
    return{...r,name:genName(),bio:bios[Math.floor(Math.random()*bios.length)],controversial,senateFor:senFor,senateAgainst:100-senFor,confirmed:false,resolved:false};
  });

  const actors={};
  WORLD_ACTORS.forEach(a=>{
    let init=a.initial;
    if(a.party==='dem'&&pIsDem)init+=15;if(a.party==='dem'&&!pIsDem)init-=15;
    if(a.party==='rep'&&!pIsDem)init+=15;if(a.party==='rep'&&pIsDem)init-=15;
    actors[a.id]=Math.min(95,Math.max(10,init));
  });

  const baseApproval=evLine==='landslide'?59:evLine==='strong'?54:evLine==='narrow'?50:47;
  const govBonus=(pIsDem?senateDem>=51:senateRep>=51)?3:0;

  P100={
    playerName:name, lastName, playerPartyLabel:party, playerParty:GS?.playerParty??'dem',
    finalEV:ev, mandate:evLine,
    senate:{dem:senateDem,rep:senateRep}, house:{dem:houseDem,rep:houseRep},
    playerSenate:pIsDem?senateDem:senateRep, playerHouse:pIsDem?houseDem:houseRep,
    hasSenate:(pIsDem?senateDem:senateRep)>=51, hasHouse:(pIsDem?houseDem:houseRep)>=218,
    filibusterProof:(pIsDem?senateDem:senateRep)>=60,
    unifiedGov:false, dividedGov:false,
    stats:{economy:52,foreignPolicy:48,healthcare:48,nationSecurity:50,mediaRelations:50},
    approvalRating:Math.min(72,Math.max(38,baseApproval+govBonus)),
    approvalHistory:[],
    actors, cabinetMembers:cabinet,
    selectedAgenda:[], agendaProgress:{},
    day:1, completedEvents:[], tickerItems:[],
    legislationPassed:[], executiveOrders:0,
    crisesHandled:0, diplomaticWins:0, decisionLog:[],
    milestoneDone:{},
    _currentSituation:null, _isMilestone:null,
    _pendingAI:false, _aiEvaluating:false,
    _clockInterval:null, _usedByPhase:{}, _aiFailCount:0,
    aiEvaluation:null,
    sotuDelivered:false,
    majorBillsAttempted:0,
  };
  P100.unifiedGov=P100.hasSenate&&P100.hasHouse;
  P100.dividedGov=!P100.hasSenate&&!P100.hasHouse;
  P100.approvalHistory.push({day:1,approval:P100.approvalRating});
  P100.tickerItems=_buildInitialTicker();

  showScreen('first100-screen');
  _renderShell();
  _startClock();
  setTimeout(()=>_showWelcomeOverlay(),350);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — WELCOME & AGENDA
// ══════════════════════════════════════════════════════════════════════════════
function _showWelcomeOverlay() {
  if(document.getElementById('p100-welcome-overlay'))return;
  const govTxt=P100.unifiedGov?'✅ Unified government — ambitious legislation is possible.':P100.dividedGov?'❌ Divided Congress — executive action and dealmaking will define your term.':'⚡ Mixed Congress — bipartisan coalitions required for major bills.';
  const ov=document.createElement('div');
  ov.id='p100-welcome-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(6,8,16,.96);display:flex;align-items:center;justify-content:center;overflow-y:auto;padding:20px;box-sizing:border-box';
  ov.innerHTML=`
    <div style="background:#0d1117;border:1px solid #c8a84b;border-radius:14px;max-width:720px;width:100%;padding:28px 32px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:2px">
        <div style="font-family:'Playfair Display',serif;font-size:28px;font-weight:900;color:#c8a84b">🏛 Welcome to the White House</div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;font-weight:700;color:#0a0c10;background:#c8a84b;padding:3px 7px;border-radius:3px;letter-spacing:.1em;flex-shrink:0">BETA</span>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5568;letter-spacing:.15em;margin-bottom:10px">${P100.playerName.toUpperCase()} · ${P100.playerPartyLabel.toUpperCase()} · ${P100.finalEV} EV</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8a84b;background:rgba(200,168,75,.07);border:1px solid rgba(200,168,75,.25);border-radius:6px;padding:8px 12px;margin-bottom:14px;line-height:1.6">
        🚧 <b>First 100 Days is in beta.</b> We're actively expanding it — the full four-year term and a re-election campaign are on the roadmap. Your feedback shapes what comes next.
      </div>
      <div style="font-size:13px;color:#8a93a8;line-height:1.7;margin-bottom:14px;padding:12px 14px;background:rgba(255,255,255,.02);border:1px solid #1e2535;border-radius:8px">
        <b style="color:#e8ecf4">This is not a quiz.</b> You are the President. Your advisors will brief you on real crises and decisions. You respond in your own words — as you would actually handle it as commander-in-chief. The AI reads your response and produces consequences based on what you said, how decisive you were, and whether it was politically realistic.
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        <div style="background:#10141c;border:1px solid #1e2535;border-radius:8px;padding:12px;text-align:center">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b;letter-spacing:.1em;margin-bottom:4px">MANDATE</div>
          <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:900;color:#e8ecf4">${P100.finalEV}</div>
          <div style="font-size:10px;color:#8a93a8">Electoral Votes</div>
        </div>
        <div style="background:#10141c;border:1px solid #1e2535;border-radius:8px;padding:12px;text-align:center">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b;letter-spacing:.1em;margin-bottom:4px">SENATE</div>
          <div style="font-size:14px;font-family:'IBM Plex Mono',monospace"><b style="color:#3b82f6">${P100.senate.dem}D</b> – <b style="color:#ef4444">${P100.senate.rep}R</b></div>
          <div style="font-size:10px;color:${P100.hasSenate?'#22c55e':'#ef4444'};margin-top:2px">${P100.hasSenate?'MAJORITY':'MINORITY'}</div>
        </div>
        <div style="background:#10141c;border:1px solid #1e2535;border-radius:8px;padding:12px;text-align:center">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b;letter-spacing:.1em;margin-bottom:4px">HOUSE</div>
          <div style="font-size:14px;font-family:'IBM Plex Mono',monospace"><b style="color:#3b82f6">${P100.house.dem}D</b> – <b style="color:#ef4444">${P100.house.rep}R</b></div>
          <div style="font-size:10px;color:${P100.hasHouse?'#22c55e':'#ef4444'};margin-top:2px">${P100.hasHouse?'MAJORITY':'MINORITY'}</div>
        </div>
      </div>
      <div style="font-size:11px;color:${P100.unifiedGov?'#22c55e':P100.dividedGov?'#ef4444':'#c8a84b'};margin-bottom:20px;padding:8px 12px;background:rgba(255,255,255,.02);border-radius:6px;border:1px solid rgba(255,255,255,.06)">${govTxt}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8a84b;letter-spacing:.15em;margin-bottom:8px">SET YOUR AGENDA — CHOOSE 3 PRIORITIES</div>
      <div style="font-size:12px;color:#8a93a8;margin-bottom:14px;line-height:1.6">These shape the situations you face, give stat bonuses, and give the AI context when evaluating your responses.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px" id="agenda-picker">
        ${P100_AGENDA_OPTIONS.map(a=>`
          <div class="agenda-opt" data-id="${a.id}" onclick="p100ToggleAgenda('${a.id}')"
            style="background:#10141c;border:1px solid #1e2535;border-radius:8px;padding:10px 12px;cursor:pointer;transition:all .2s;user-select:none">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
              <span style="font-size:15px">${a.icon}</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:#e8ecf4">${a.label}</span>
              <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:9px;color:${a.bonus>0?'#22c55e':'#ef4444'}">${a.bonus>0?'+':''}${a.bonus} ${P100_STATS.find(s=>s.id===a.stat)?.label||''}</span>
            </div>
            <div style="font-size:11px;color:#4a5568;line-height:1.5">${a.description}</div>
          </div>`).join('')}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5568;text-align:center;margin-bottom:16px" id="agenda-count-label">Select 3 priorities (0 selected)</div>
      <button id="agenda-start-btn" onclick="p100CommitAgenda()"
        style="width:100%;padding:14px;background:#2a3348;border:none;border-radius:8px;color:#4a5568;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:900;cursor:not-allowed;letter-spacing:.05em;transition:all .3s" disabled>
        BEGIN YOUR FIRST 100 DAYS →
      </button>
    </div>`;
  document.body.appendChild(ov);
}

window.p100ToggleAgenda=function(id){
  const idx=P100.selectedAgenda.indexOf(id);
  if(idx>-1)P100.selectedAgenda.splice(idx,1);
  else if(P100.selectedAgenda.length<3)P100.selectedAgenda.push(id);
  document.querySelectorAll('.agenda-opt').forEach(el=>{
    const sel=P100.selectedAgenda.includes(el.dataset.id);
    el.style.borderColor=sel?'#c8a84b':'#1e2535';
    el.style.background=sel?'rgba(200,168,75,.08)':'#10141c';
    el.style.boxShadow=sel?'0 0 0 1px rgba(200,168,75,.25)':'none';
  });
  const n=P100.selectedAgenda.length;
  const lbl=document.getElementById('agenda-count-label');
  const btn=document.getElementById('agenda-start-btn');
  if(lbl)lbl.textContent=`Select 3 priorities (${n} selected)`;
  if(btn){btn.disabled=n!==3;btn.style.background=n===3?'linear-gradient(135deg,#b8962e,#c8a84b)':'#2a3348';btn.style.color=n===3?'#060810':'#4a5568';btn.style.cursor=n===3?'pointer':'not-allowed';}
};

window.p100CommitAgenda=function(){
  if(P100.selectedAgenda.length!==3)return;
  P100.selectedAgenda.forEach(id=>{
    const ag=P100_AGENDA_OPTIONS.find(a=>a.id===id);
    if(ag?.stat)P100.stats[ag.stat]=Math.min(95,Math.max(10,P100.stats[ag.stat]+ag.bonus));
    P100.agendaProgress[id]=0;
  });
  _recalcApproval();
  document.getElementById('p100-welcome-overlay')?.remove();
  _renderShell();
  setTimeout(_scheduleNextEvent,400);
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — SHELL
// ══════════════════════════════════════════════════════════════════════════════
function _renderShell(){_renderNetworkBar();_renderMilestoneBar();_renderSidebar();_renderBriefingPlaceholder();_renderTicker();}

function _renderNetworkBar(){
  const phase=_currentPhase();
  const dayEl=document.getElementById('p100-day-badge');
  const hdEl=document.getElementById('p100-headline-main');
  const phEl=document.getElementById('p100-phase-badge');
  if(dayEl)dayEl.textContent=`DAY ${P100.day} OF 100`;
  if(hdEl)hdEl.textContent=`THE FIRST 100 DAYS — ${P100.playerPartyLabel.toUpperCase()} ADMINISTRATION`;
  if(phEl){phEl.textContent=`${phase.icon} ${phase.label.toUpperCase()} PHASE`;phEl.style.color=phase.color;}
}

function _renderMilestoneBar(){
  const bar=document.getElementById('p100-milestone-bar');
  if(!bar)return;
  bar.innerHTML=P100_PHASES.map((m,i)=>{
    const isActive=P100.day>=m.days[0]&&P100.day<=m.days[1];
    const isDone=P100.day>m.days[1];
    const cls=isActive?'p100-milestone active':isDone?'p100-milestone done':'p100-milestone';
    return`<div class="${cls}"><span class="p100-ms-icon">${m.icon}</span><span class="p100-ms-label">${m.label}</span><span class="p100-ms-days">Day ${m.days[0]}-${m.days[1]}</span>${isDone?'<span class="p100-ms-check">✓</span>':''}</div>${i<P100_PHASES.length-1?'<div class="p100-ms-arrow">›</div>':''}`;
  }).join('');
}

function _renderSidebar(){_renderApprovalGauge();_renderStatBars();_renderActorPanel();_renderAgendaPanel();}

function _renderApprovalGauge(){
  const el=document.getElementById('p100-approval-gauge');if(!el)return;
  const pct=P100.approvalRating;
  const color=pct>=55?'#22c55e':pct>=45?'#c8a84b':'#ef4444';
  const label=pct>=60?'Strong':pct>=52?'Steady':pct>=44?'Struggling':'Crisis';
  const hist=P100.approvalHistory;const maxH=32;
  const points=hist.length<2?'':hist.map((h,i)=>{const x=(i/(hist.length-1))*100;const y=maxH-((h.approval-20)/60)*maxH;return`${x.toFixed(1)},${Math.max(0,Math.min(maxH,y)).toFixed(1)}`;}).join(' ');
  el.innerHTML=`
    <div class="p100-gauge-label">APPROVAL RATING</div>
    <div class="p100-gauge-num" style="color:${color}">${pct}%</div>
    <div class="p100-gauge-status" style="color:${color}">${label}</div>
    <svg viewBox="0 0 100 ${maxH}" class="p100-sparkline">
      <line x1="0" y1="${(maxH-((50-20)/60*maxH)).toFixed(1)}" x2="100" y2="${(maxH-((50-20)/60*maxH)).toFixed(1)}" stroke="#1e2535" stroke-width=".5" stroke-dasharray="2,2"/>
      ${points?`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" opacity=".85"/>` : ''}
    </svg>
    <div class="p100-gauge-mandate"><span style="color:#c8a84b">${P100.finalEV} EV</span><span style="color:#4a5568">·</span><span style="color:#8a93a8">${P100.mandate.charAt(0).toUpperCase()+P100.mandate.slice(1)}</span></div>`;
}

function _renderStatBars(){
  const el=document.getElementById('p100-stat-bars');if(!el)return;
  el.innerHTML=P100_STATS.map(s=>{
    const val=P100.stats[s.id];const color=val>=60?'#22c55e':val>=40?'#c8a84b':'#ef4444';
    const inAg=P100.selectedAgenda.some(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.stat===s.id);
    const grade=_statGrade(val);
    return`<div class="p100-stat-row p100-stat-clickable" onclick="p100ShowStatDetail('${s.id}')" title="Click for details">
      <span class="p100-stat-icon">${s.icon}</span>
      <span class="p100-stat-label" style="font-size:11px;color:#c8d0e0">${s.label}${inAg?' ★':''}</span>
      <div class="p100-stat-bar-track"><div class="p100-stat-bar-fill" style="width:${val}%;background:${color}"></div></div>
      <span class="p100-stat-grade" style="color:${color};font-family:'IBM Plex Mono',monospace;font-size:9px;min-width:18px;text-align:right">${grade}</span>
      <span class="p100-stat-val" style="color:${color}">${val}</span>
    </div>`;
  }).join('');
}

window.p100ShowStatDetail=function(statId){
  const s=P100_STATS.find(x=>x.id===statId);if(!s||!P100)return;
  const val=P100.stats[statId];
  const color=val>=60?'#22c55e':val>=40?'#c8a84b':'#ef4444';
  const grade=_statGrade(val);
  // Relevant decisions
  const relDecs=P100.decisionLog.filter(d=>d.effects&&typeof d.effects[statId]==='number'&&d.effects[statId]!==0).slice(-5);
  // Agenda items affecting this stat
  const agItems=P100_AGENDA_OPTIONS.filter(a=>a.stat===statId);
  const activeAg=P100.selectedAgenda.filter(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.stat===statId);
  // Trend from history
  const hist=P100.approvalHistory;
  const trend=hist.length>=2?P100.stats[statId]-(P100.stats[statId]):'N/A';
  // Actor relationships relevant to this stat
  const relActors={economy:['wall_street','labor_unions','tech_sector'],foreignPolicy:['nato_allies','military'],healthcare:['labor_unions'],nationSecurity:['military','gop_senate'],mediaRelations:['press_corps','dem_senate','gop_senate']}[statId]||[];
  const ov=document.createElement('div');
  ov.id='p100-stat-detail-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(6,8,16,.92);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  ov.innerHTML=`
    <div style="background:#0d1117;border:1px solid ${color}44;border-radius:14px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.8)">
      <div style="padding:20px 22px;border-bottom:1px solid #1e2535;display:flex;align-items:center;gap:12px">
        <span style="font-size:28px">${s.icon}</span>
        <div style="flex:1">
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#e8ecf4">${s.label}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em;margin-top:2px">POLICY PERFORMANCE DETAIL</div>
        </div>
        <button onclick="document.getElementById('p100-stat-detail-overlay')?.remove()" style="background:none;border:1px solid #1e2535;border-radius:6px;color:#4a5568;font-size:16px;cursor:pointer;padding:4px 10px">✕</button>
      </div>
      <div style="padding:18px 22px;display:flex;flex-direction:column;gap:16px">
        <!-- Score -->
        <div style="display:flex;align-items:center;gap:18px;background:#10141c;border:1px solid #1e2535;border-radius:10px;padding:14px 18px">
          <div style="text-align:center">
            <div style="font-family:'Playfair Display',serif;font-size:44px;font-weight:900;color:${color};line-height:1">${val}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568;letter-spacing:.1em">/100</div>
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">SCORE</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${color}">${grade}</span>
            </div>
            <div style="height:8px;background:#1e2535;border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div style="width:${val}%;height:100%;background:${color};border-radius:4px;transition:width .7s ease"></div>
            </div>
            <div style="font-size:11px;color:#8a93a8;line-height:1.6">${_statDescription(statId,val)}</div>
          </div>
        </div>
        <!-- Agenda -->
        ${activeAg.length?`<div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.12em;margin-bottom:8px">★ YOUR AGENDA PRIORITIES</div>
          ${activeAg.map(id=>{const ag=P100_AGENDA_OPTIONS.find(a=>a.id===id);const prog=P100.agendaProgress[id]??0;const pc=prog>=70?'#22c55e':prog>=35?'#c8a84b':'#4a5568';return`<div style="padding:8px 10px;background:rgba(200,168,75,.05);border:1px solid rgba(200,168,75,.15);border-radius:7px;margin-bottom:6px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;color:#e8ecf4;font-weight:600">${ag?.icon} ${ag?.label}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${pc};font-weight:700">${prog}%</span></div><div style="height:4px;background:#1e2535;border-radius:2px;overflow:hidden"><div style="width:${prog}%;height:100%;background:${pc};border-radius:2px"></div></div></div>`;}).join('')}
        </div>`:''}
        <!-- Key decisions -->
        ${relDecs.length?`<div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.12em;margin-bottom:8px">RECENT DECISIONS AFFECTING THIS</div>
          ${relDecs.map(d=>{const v=d.effects[statId];const c=v>0?'#22c55e':'#ef4444';return`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#10141c;border-radius:6px;margin-bottom:4px"><span style="font-size:9px;color:#4a5568;min-width:42px;font-family:'IBM Plex Mono',monospace">Day ${d.day}</span><span style="flex:1;font-size:11px;color:#8a93a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.headline}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${c};flex-shrink:0">${v>0?'+':''}${v}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;flex-shrink:0">${d.grade}</span></div>`;}).join('')}
        </div>`:'<div style="font-size:11px;color:#4a5568;font-style:italic">No decisions recorded yet for this policy area.</div>'}
        <!-- Related actors -->
        ${relActors.length?`<div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.12em;margin-bottom:8px">RELATED RELATIONSHIPS</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${relActors.map(id=>{const a=WORLD_ACTORS.find(x=>x.id===id);if(!a)return'';const t=P100.actors[id];const c=t>=60?'#22c55e':t>=40?'#c8a84b':'#ef4444';return`<div style="background:#10141c;border:1px solid #1e2535;border-radius:7px;padding:8px 12px;text-align:center;flex:1;min-width:80px"><div style="font-size:16px;margin-bottom:3px">${a.icon}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568;margin-bottom:4px">${a.label}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:${c}">${t}</div></div>`;}).join('')}
          </div>
        </div>`:''}
      </div>
    </div>`;
  document.body.appendChild(ov);
};

function _statDescription(statId,val){
  const descs={
    economy:{high:'Markets are surging and consumer confidence is at historic highs. Your economic agenda is being called transformative.',mid:'The economy is stable but faces headwinds. Growth is modest and markets are cautiously optimistic.',low:'Economic indicators are alarming. Recession fears are mounting and your approval is taking direct hits.'},
    foreignPolicy:{high:'Your diplomatic standing abroad is formidable. Allies trust you and adversaries respect American power.',mid:'Relations are mixed. Some alliances are strengthening but critical partnerships remain strained.',low:'The US is increasingly isolated. Allies question your commitments and adversaries sense weakness.'},
    healthcare:{high:'Americans rate healthcare as a strength of your presidency. Coverage is up and costs are stabilising.',mid:'Healthcare remains a work in progress. Proposals are debated but implementation is slow.',low:'The healthcare system is straining. Your administration is facing political pressure from all sides.'},
    nationSecurity:{high:'The homeland is secure and the military is at peak readiness. Intelligence agencies are fully resourced.',mid:'Security footing is adequate. Some vulnerabilities persist but no imminent threats have materialised.',low:'Security gaps are emerging. Critics are questioning whether the administration is taking threats seriously.'},
    mediaRelations:{high:'Your relationship with the press is the envy of modern administrations. Coverage is broadly favourable.',mid:'Relations with media are transactional. Expect continued scrutiny but no open warfare.',low:'The press has turned hostile. Every announcement is contested and negative framing dominates coverage.'},
  };
  const tier=val>=60?'high':val>=40?'mid':'low';
  return(descs[statId]||{mid:''})[tier]||'';
}

function _renderSenateCircles(){
  // Build a 10×10 grid of circles (100 seats) representing the Senate
  const dem=P100.senate.dem, rep=P100.senate.rep;
  const playerIsDem=P100.playerParty==='dem';
  const playerDem=dem, playerRep=rep;
  // Sort: Dem seats left, Rep seats right
  const circles=[];
  for(let i=0;i<100;i++){
    const isDem=i<dem;
    const isPlayer=(isDem&&playerIsDem)||(!isDem&&!playerIsDem);
    circles.push({isDem,isPlayer});
  }
  // Render 10 rows × 10 cols, left=Dem, right=Rep
  const rows=10,cols=10;
  let svg=`<svg viewBox="0 0 108 60" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">`;
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const idx=r*cols+c; // left-to-right, top-to-bottom
      // Map cols so Dem seats fill from left, Rep from right
      // Actually: fill seats left→right for Dem, then Rep continues
      const seat=circles[idx];
      const cx=5+c*11, cy=4+r*5.5;
      const fill=seat.isDem?'#3b82f6':'#ef4444';
      const opacity=seat.isPlayer?'1':'0.55';
      svg+=`<circle cx="${cx}" cy="${cy}" r="3.8" fill="${fill}" opacity="${opacity}"/>`;
    }
  }
  // Majority line at seat 50 (between cols 9-10 of row containing seat 50)
  // Seat 50 = row 5, col 0 → x=5. The boundary between 50D/50R
  // For the majority marker, draw a vertical line between col 4 and 5 of any row,
  // adjusted for actual split. 50 seats each = boundary after col 4/5 in row 5.
  const splitRow=Math.floor(dem/cols), splitCol=dem%cols;
  const markerX=5+splitCol*11;
  if(dem!==100&&dem!==0){
    const markerY=4+splitRow*5.5;
    svg+=`<line x1="${markerX-1.5}" y1="${markerY-4}" x2="${markerX-1.5}" y2="${markerY+9}" stroke="#c8a84b" stroke-width="1.2" stroke-dasharray="1.5,1"/>`;
  }
  svg+=`</svg>`;
  return svg;
}

function _renderActorPanel(){
  const el=document.getElementById('p100-congress-panel');if(!el)return;
  const dem=P100.senate.dem, rep=P100.senate.rep;
  const playerIsDem=P100.playerParty==='dem';
  const playerSeats=playerIsDem?dem:rep;
  const hasMaj=playerSeats>=51, hasSuperMaj=playerSeats>=60;
  const majColor=hasSuperMaj?'#22c55e':hasMaj?'#c8a84b':'#ef4444';
  const majLabel=hasSuperMaj?'SUPERMAJORITY':hasMaj?'MAJORITY':'MINORITY';
  el.innerHTML=`
    <div class="p100-panel-title">U.S. SENATE</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#3b82f6">${dem}<span style="font-size:9px;color:#4a5568"> DEM</span></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${majColor};letter-spacing:.08em;padding:1px 5px;border:1px solid ${majColor}44;border-radius:3px">${majLabel}</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:#ef4444">${rep}<span style="font-size:9px;color:#4a5568"> REP</span></span>
    </div>
    <div style="margin-bottom:10px;background:#0a0c10;border-radius:5px;padding:4px 3px;border:1px solid #1e2535" title="${dem} Democratic seats · ${rep} Republican seats · Need 51 for majority · 60 for filibuster-proof">
      ${_renderSenateCircles()}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px;font-family:'IBM Plex Mono',monospace;font-size:9px">
      <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;display:inline-block"></span>Democrat</span>
      <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;display:inline-block"></span>Republican</span>
      <span style="color:#4a5568">│ 51 = majority · 60 = filibuster-proof</span>
    </div>
    <div class="p100-panel-title" style="margin-bottom:4px">RELATIONSHIPS <span style="font-size:8px;color:#2a3348;font-weight:400;letter-spacing:.05em">click for detail</span></div>
    ${WORLD_ACTORS.map(a=>{
      const trust=P100.actors[a.id];const color=trust>=60?'#22c55e':trust>=40?'#c8a84b':'#ef4444';
      const grade=trust>=80?'A':trust>=65?'B':trust>=50?'C':trust>=35?'D':'F';
      return`<div class="p100-stat-row p100-stat-clickable" onclick="p100ShowActorDetail('${a.id}')" title="Click for details" style="margin-bottom:3px"><span style="font-size:11px;flex-shrink:0">${a.icon}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8d0e0;flex:0 0 88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.label}</span><div class="p100-stat-bar-track"><div class="p100-stat-bar-fill" style="width:${trust}%;background:${color}"></div></div><span class="p100-stat-grade" style="color:${color}">${grade}</span><span class="p100-stat-val" style="color:${color}">${trust}</span></div>`;
    }).join('')}`;
}

window.p100ShowActorDetail=function(actorId){
  const a=WORLD_ACTORS.find(x=>x.id===actorId);if(!a||!P100)return;
  const trust=P100.actors[actorId];
  const color=trust>=60?'#22c55e':trust>=40?'#c8a84b':'#ef4444';
  const grade=trust>=80?'A':trust>=65?'B':trust>=50?'C':trust>=35?'D':'F';
  const status=trust>=70?'Strong Ally':trust>=55?'Supportive':trust>=45?'Neutral':trust>=30?'Skeptical':'Hostile';
  // history of decisions that affected this actor
  const relDecs=P100.decisionLog.filter(d=>d.effects&&d.actorShifts&&typeof d.actorShifts?.[actorId]==='number'&&d.actorShifts[actorId]!==0).slice(-5);
  const trend=trust>=60?'📈 Gaining influence with this group':trust>=40?'➡️ Relationship is stable but fragile':'📉 Relationship deteriorating — action needed';
  const advice=trust>=65?`Continue engaging ${a.label} on shared priorities.`:trust>=45?`${a.label} is watching carefully. A targeted gesture could shift their position.`:`${a.label} is opposed. Consider a direct outreach or policy concession to recover ground.`;
  const ov=document.createElement('div');
  ov.id='p100-actor-detail-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(6,8,16,.92);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  ov.innerHTML=`
    <div style="background:#0d1117;border:1px solid ${color}44;border-radius:14px;max-width:440px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.8)">
      <div style="padding:20px 22px;border-bottom:1px solid #1e2535;display:flex;align-items:center;gap:12px">
        <span style="font-size:32px">${a.icon}</span>
        <div style="flex:1">
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#e8ecf4">${a.label}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em;margin-top:2px">RELATIONSHIP DETAIL</div>
        </div>
        <button onclick="document.getElementById('p100-actor-detail-overlay')?.remove()" style="background:none;border:1px solid #1e2535;border-radius:6px;color:#4a5568;font-size:16px;cursor:pointer;padding:4px 10px">✕</button>
      </div>
      <div style="padding:18px 22px;display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:center;gap:18px;background:#10141c;border:1px solid #1e2535;border-radius:10px;padding:14px 18px">
          <div style="text-align:center">
            <div style="font-family:'Playfair Display',serif;font-size:44px;font-weight:900;color:${color};line-height:1">${trust}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568;letter-spacing:.1em">/100</div>
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">TRUST SCORE</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${color}">${grade} — ${status}</span>
            </div>
            <div style="height:8px;background:#1e2535;border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div style="width:${trust}%;height:100%;background:${color};border-radius:4px;transition:width .7s ease"></div>
            </div>
            <div style="font-size:11px;color:#8a93a8;line-height:1.6">${trend}</div>
          </div>
        </div>
        <div style="padding:10px 12px;background:rgba(255,255,255,.02);border:1px solid #1e2535;border-radius:8px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.1em;margin-bottom:6px">💡 ADVISOR INSIGHT</div>
          <div style="font-size:12px;color:#8a93a8;line-height:1.65">${advice}</div>
        </div>
        ${relDecs.length?`<div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.12em;margin-bottom:8px">DECISIONS THAT AFFECTED THIS RELATIONSHIP</div>
          ${relDecs.map(d=>{const v=d.actorShifts[actorId];const c=v>0?'#22c55e':'#ef4444';return`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#10141c;border-radius:6px;margin-bottom:4px"><span style="font-size:9px;color:#4a5568;min-width:42px;font-family:'IBM Plex Mono',monospace">Day ${d.day}</span><span style="flex:1;font-size:11px;color:#8a93a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.headline}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${c};flex-shrink:0">${v>0?'+':''}${v}</span></div>`;}).join('')}
        </div>`:'<div style="font-size:11px;color:#4a5568;font-style:italic">No decisions recorded affecting this group yet.</div>'}
      </div>
    </div>`;
  document.body.appendChild(ov);
};

function _renderAgendaPanel(){
  const el=document.getElementById('p100-cabinet-panel');if(!el)return;
  if(!P100.selectedAgenda.length){el.innerHTML='<div class="p100-panel-title">AGENDA</div>';return;}
  el.innerHTML=`<div class="p100-panel-title">PRESIDENTIAL AGENDA <span style="font-size:8px;color:#2a3348;font-weight:400;letter-spacing:.05em">click for detail</span></div>${P100.selectedAgenda.map(id=>{
    const ag=P100_AGENDA_OPTIONS.find(a=>a.id===id);if(!ag)return'';
    const prog=P100.agendaProgress[id]??0;const color=prog>=70?'#22c55e':prog>=35?'#c8a84b':'#4a5568';
    const stat=P100_STATS.find(s=>s.id===ag.stat);
    const grade=prog>=80?'A':prog>=65?'B':prog>=50?'C':prog>=35?'D':'F';
    return`<div class="p100-stat-row p100-stat-clickable" onclick="p100ShowAgendaDetail('${id}')" title="Click for details" style="flex-direction:column;align-items:stretch;gap:4px;padding:6px 8px;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:13px;flex-shrink:0">${ag.icon}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8d0e0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ag.label}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${color};flex-shrink:0;font-weight:700">${grade}</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:${color};min-width:32px;text-align:right;flex-shrink:0">${prog}%</span>
      </div>
      <div style="height:4px;background:#1e2535;border-radius:2px;overflow:hidden"><div style="width:${prog}%;height:100%;background:${color};border-radius:2px;transition:width .6s ease"></div></div>
    </div>`;
  }).join('')}`;
}

window.p100ShowAgendaDetail=function(agendaId){
  const ag=P100_AGENDA_OPTIONS.find(a=>a.id===agendaId);if(!ag||!P100)return;
  const prog=P100.agendaProgress[agendaId]??0;
  const color=prog>=70?'#22c55e':prog>=35?'#c8a84b':'#4a5568';
  const grade=prog>=80?'A':prog>=65?'B':prog>=50?'C':prog>=35?'D':'F';
  const stat=P100_STATS.find(s=>s.id===ag.stat);
  const statVal=P100.stats[ag.stat]??50;
  const relDecs=P100.decisionLog.filter(d=>d.effects&&typeof d.effects[ag.stat]==='number'&&d.effects[ag.stat]>0).slice(-5);
  const statusMsg=prog>=70?'Your agenda is delivering results on this priority.':prog>=35?'Progress is underway but legislation is moving slowly.':'This priority has seen limited progress so far.';
  const tip=prog>=70?'Keep momentum — push for a landmark bill before Day 100.':prog>=35?`Focus on ${stat?.label||'related policy'} decisions to accelerate progress.`:`You need decisive action on ${ag.label} — your base is watching.`;
  const ov=document.createElement('div');
  ov.id='p100-agenda-detail-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(6,8,16,.92);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  ov.onclick=e=>{if(e.target===ov)ov.remove();};
  ov.innerHTML=`
    <div style="background:#0d1117;border:1px solid ${color}44;border-radius:14px;max-width:440px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.8)">
      <div style="padding:20px 22px;border-bottom:1px solid #1e2535;display:flex;align-items:center;gap:12px">
        <span style="font-size:32px">${ag.icon}</span>
        <div style="flex:1">
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#e8ecf4">${ag.label}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em;margin-top:2px">AGENDA PROGRESS DETAIL</div>
        </div>
        <button onclick="document.getElementById('p100-agenda-detail-overlay')?.remove()" style="background:none;border:1px solid #1e2535;border-radius:6px;color:#4a5568;font-size:16px;cursor:pointer;padding:4px 10px">✕</button>
      </div>
      <div style="padding:18px 22px;display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;align-items:center;gap:18px;background:#10141c;border:1px solid #1e2535;border-radius:10px;padding:14px 18px">
          <div style="text-align:center">
            <div style="font-family:'Playfair Display',serif;font-size:44px;font-weight:900;color:${color};line-height:1">${prog}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568;letter-spacing:.1em">% PROGRESS</div>
          </div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">GRADE</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${color}">${grade}</span>
            </div>
            <div style="height:8px;background:#1e2535;border-radius:4px;overflow:hidden;margin-bottom:8px">
              <div style="width:${prog}%;height:100%;background:${color};border-radius:4px;transition:width .7s ease"></div>
            </div>
            <div style="font-size:11px;color:#8a93a8;line-height:1.6">${statusMsg}</div>
          </div>
        </div>
        <div style="padding:10px 12px;background:rgba(200,168,75,.04);border:1px solid rgba(200,168,75,.15);border-radius:8px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.1em;margin-bottom:5px">📋 DESCRIPTION</div>
          <div style="font-size:12px;color:#8a93a8;line-height:1.65;margin-bottom:8px">${ag.description}</div>
          <div style="font-size:11px;color:#c8d0e0">Linked to: ${stat?.icon||''} <b>${stat?.label||ag.stat}</b> (current: ${statVal}/100)</div>
        </div>
        <div style="padding:10px 12px;background:rgba(255,255,255,.02);border:1px solid #1e2535;border-radius:8px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em;margin-bottom:6px">💡 CHIEF OF STAFF ADVICE</div>
          <div style="font-size:12px;color:#8a93a8;line-height:1.65">${tip}</div>
        </div>
        ${relDecs.length?`<div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.12em;margin-bottom:8px">DECISIONS ADVANCING THIS AGENDA</div>
          ${relDecs.map(d=>{const v=d.effects[ag.stat];const c=v>0?'#22c55e':'#ef4444';return`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#10141c;border-radius:6px;margin-bottom:4px"><span style="font-size:9px;color:#4a5568;min-width:42px;font-family:'IBM Plex Mono',monospace">Day ${d.day}</span><span style="flex:1;font-size:11px;color:#8a93a8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.headline}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${c};flex-shrink:0">${v>0?'+':''}${v}</span></div>`;}).join('')}
        </div>`:'<div style="font-size:11px;color:#4a5568;font-style:italic">No decisions advancing this agenda recorded yet.</div>'}
      </div>
    </div>`;
  document.body.appendChild(ov);
};

function _renderBriefingPlaceholder(){
  const el=document.getElementById('p100-event-area');if(!el)return;
  if(P100._pendingAI){
    el.innerHTML=`<div class="p100-event-placeholder"><div style="width:32px;height:32px;border:2px solid #c8a84b;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 14px"></div><div class="p100-event-ph-title" style="color:#c8a84b">Preparing your briefing…</div><div style="font-size:11px;color:#4a5568;margin-top:6px">AI is reading your situation</div></div>`;
  }else{
    el.innerHTML=`<div class="p100-event-placeholder"><div class="p100-event-ph-icon">📋</div><div class="p100-event-ph-title">Preparing your briefing…</div></div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — BRIEFING RENDER
// ══════════════════════════════════════════════════════════════════════════════
function _renderBriefing(){
  const el=document.getElementById('p100-event-area');if(!el)return;
  const sit=P100._currentSituation;if(!sit)return;
  const phase=_currentPhase();
  const color=P100._isMilestone?'#22c55e':phase.color;
  const phaseLabel=P100._isMilestone?`🎯 MILESTONE — ${P100._isMilestone.replace(/_/g,' ').toUpperCase()}`:`${phase.icon} ${phase.label.toUpperCase()} PHASE — DAY ${P100.day}`;
  const adv=ADVISOR_BIOS[sit.advisorVoice]||ADVISOR_BIOS.chief_of_staff;
  const fallbackSuggestions=RESPONSE_SUGGESTIONS[phase.id]||RESPONSE_SUGGESTIONS.first_acts;

  el.innerHTML=`
    <div class="p100-event-card" id="p100-active-card" style="border-left:3px solid ${color}">
      <div class="p100-event-header">
        <div class="p100-event-phase-tag" style="color:${color}">${phaseLabel}</div>
        <div class="p100-event-day-tag">DAY ${P100.day}</div>
      </div>
      <div class="p100-event-headline">${sit.headline}</div>
      <div class="p100-event-situation">${sit.brief.replace(/\n/g,'<br><br>')}</div>
      <div class="p100-advisor-block">
        <div class="p100-advisor-avatar">${adv.icon}</div>
        <div class="p100-advisor-content">
          <div class="p100-advisor-name">${adv.title}</div>
          <div class="p100-advisor-line">"${sit.advisorLine}"</div>
        </div>
      </div>
      <div class="p100-response-area" id="p100-response-area">
        <div class="p100-response-label">
          <span>🇺🇸 YOUR RESPONSE, MR. PRESIDENT</span>
          <span class="p100-char-count" id="p100-char-count">0 / 500</span>
        </div>
        <textarea id="p100-response-input" class="p100-response-textarea" maxlength="500"
          placeholder="Type your response as President. The more specific and decisive, the better the outcome. What are your orders?"
          oninput="p100OnResponseInput(this)"
          onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter')p100SubmitResponse()"></textarea>
        <div class="p100-suggestions" id="p100-suggestions-bar">
          <span class="p100-suggestions-label">STARTING POINTS</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a3348;letter-spacing:.05em;display:flex;align-items:center;gap:5px" id="p100-ai-sug-loading"><span style="width:10px;height:10px;border:1.5px solid #2a3348;border-top-color:#c8a84b;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;flex-shrink:0"></span>AI thinking…</span>
          ${fallbackSuggestions.map((s,i)=>`<button class="p100-suggestion-chip" data-sug-idx="${i}" onclick="p100UseSuggestion(this,'${s.replace(/'/g,"&#39;")}')">${s}</button>`).join('')}
        </div>
        <button id="p100-submit-btn" class="p100-submit-btn" onclick="p100SubmitResponse()" disabled style="opacity:.4;cursor:not-allowed">
          DELIVER YOUR RESPONSE <span style="opacity:.6;font-size:11px;margin-left:8px">Ctrl+Enter</span>
        </button>
      </div>
    </div>`;

  setTimeout(()=>document.getElementById('p100-response-input')?.focus(),100);

  // Async: fetch AI suggestions and inject them above fallback chips
  _fetchAISuggestions(sit,phase,adv).then(aiSugs=>{
    const loadEl=document.getElementById('p100-ai-sug-loading');
    if(!loadEl)return; // card already gone
    if(aiSugs&&aiSugs.length){
      const bar=document.getElementById('p100-suggestions-bar');
      if(!bar)return;
      // Create AI chips using data-text to avoid quote-escaping issues in onclick
      const frag=document.createDocumentFragment();
      const aiLabel=document.createElement('span');
      aiLabel.className='p100-suggestions-label';
      aiLabel.style.color='#c8a84b';
      aiLabel.textContent='🤖 AI';
      frag.appendChild(aiLabel);
      aiSugs.forEach((s,i)=>{
        const fixed=_fixAISpacing(s)||s;
        // Skip if still looks spaceless (long word with no spaces is a broken suggestion)
        const words=fixed.trim().split(/\s+/).length;
        const chars=fixed.replace(/\s/g,'').length;
        if(chars>30&&words<3)return; // probably a spaceless blob — skip it
        const btn=document.createElement('button');
        btn.className='p100-suggestion-chip p100-ai-chip';
        btn.dataset.sugIdx='ai'+i;
        btn.dataset.text=fixed;
        btn.title='AI suggestion';
        btn.textContent=fixed;
        btn.addEventListener('click',function(){p100UseSuggestionEl(this);});
        frag.appendChild(btn);
      });
      const divider=document.createElement('span');
      divider.style.cssText='display:block;width:100%;height:1px;background:#1e2535;margin:2px 0';
      frag.appendChild(divider);
      const orLabel=document.createElement('span');
      orLabel.className='p100-suggestions-label';
      orLabel.textContent='OR';
      frag.appendChild(orLabel);
      loadEl.replaceWith(frag);
    } else {
      if(loadEl)loadEl.remove();
    }
  }).catch(()=>{
    const loadEl=document.getElementById('p100-ai-sug-loading');
    if(loadEl)loadEl.remove();
  });
}

function _isUsableSuggestion(s){
  if(!s||typeof s!=='string')return false;
  const clean=s.trim();
  if(clean.length<6||clean.length>100)return false;
  // Reject if it looks spaceless: >20 chars with no spaces or apostrophes as word boundaries
  const words=clean.split(/[\s]+/).length;
  const chars=clean.replace(/\s/g,'').length;
  if(chars>20&&words<2)return false;
  return true;
}
  const prompt=`You are briefing the US President in a political simulation. Generate 3 very short, distinct response starter phrases the President could use for this situation.

Situation: ${sit.headline}
Brief: ${sit.brief.slice(0,300)}
Advisor asks: "${sit.advisorLine}"
Phase: ${phase.label} | Day ${P100.day} of 100 | Approval: ${P100.approvalRating}%

Rules: Each phrase must be 6-10 words max, written in first person as the President. Make them meaningfully different — one assertive, one diplomatic, one unconventional. Do NOT include quotes or numbering.

Return ONLY valid JSON: {"suggestions":["phrase one","phrase two","phrase three"]}`;

  // Try local AI first
  if(window.isElectron&&window.localAI){
    try{const raw=await window.localAI.getQuestions(prompt);
      if(raw?.prompts&&Array.isArray(raw.prompts)){
        const good=raw.prompts.slice(0,3).map(_fixAISpacing).filter(_isUsableSuggestion);
        if(good.length>=2)return good;
      }
    }catch(_){}
    try{
      const advText=await window.localAI.getAdvice(prompt);
      if(advText){
        const parsed=_parseJSONFromText(advText);
        if(parsed?.suggestions?.length){
          const good=parsed.suggestions.slice(0,3).map(_fixAISpacing).filter(_isUsableSuggestion);
          if(good.length>=2)return good;
        }
        // fallback: split by newlines/bullets
        const lines=advText.split(/[\n•\-\d\.]+/).map(l=>_fixAISpacing(l.trim())).filter(_isUsableSuggestion);
        if(lines.length>=2)return lines.slice(0,3);
      }
    }catch(_){}
  }
  // Cloud worker
  if(window._POTUS_AI_WORKER_URL){
    try{
      const res=await fetch(window._POTUS_AI_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,suggestions:true}),signal:AbortSignal.timeout(8000)});
      if(res.ok){
        const data=await res.json();
        let raw=data.suggestions||data.advice||data.text;
        if(typeof raw==='string')raw=_parseJSONFromText(raw);
        if(raw?.suggestions?.length){const good=raw.suggestions.slice(0,3).map(_fixAISpacing).filter(_isUsableSuggestion);if(good.length>=2)return good;}
        if(Array.isArray(raw)){const good=raw.slice(0,3).map(_fixAISpacing).filter(_isUsableSuggestion);if(good.length>=2)return good;}
      }
    }catch(_){}
  }
  return null;
}

window.p100OnResponseInput=function(ta){
  const len=ta.value.length;
  const countEl=document.getElementById('p100-char-count');
  const btn=document.getElementById('p100-submit-btn');
  if(countEl)countEl.textContent=`${len} / 500`;
  if(btn){const ready=len>=15;btn.disabled=!ready;btn.style.opacity=ready?'1':'.4';btn.style.cursor=ready?'pointer':'not-allowed';}
};

window.p100UseSuggestion=function(btn,text){
  const ta=document.getElementById('p100-response-input');if(!ta)return;
  ta.value=ta.value.trim()?ta.value.trim()+' '+text:text;
  ta.dispatchEvent(new Event('input'));
  ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
  btn.classList.add('used');btn.disabled=true;
};

// Safe version for AI chips — reads text from data-text attribute to avoid quote issues
window.p100UseSuggestionEl=function(btn){
  const text=btn.dataset.text||btn.textContent;
  const ta=document.getElementById('p100-response-input');if(!ta)return;
  ta.value=ta.value.trim()?ta.value.trim()+' '+text:text;
  ta.dispatchEvent(new Event('input'));
  ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
  btn.classList.add('used');btn.disabled=true;
};

window.p100SubmitResponse=function(){
  const ta=document.getElementById('p100-response-input');
  if(!ta||ta.value.trim().length<15)return;
  _evaluatePresidentialResponse(ta.value.trim());
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — AI EVALUATION
// ══════════════════════════════════════════════════════════════════════════════
async function _evaluatePresidentialResponse(response){
  const el=document.getElementById('p100-event-area');if(!el)return;
  P100._aiEvaluating=true;
  const respArea=document.getElementById('p100-response-area');
  if(respArea){respArea.innerHTML=`<div class="p100-evaluating-block"><div class="p100-eval-spinner"></div><div class="p100-eval-label">Evaluating your decision…</div><div class="p100-eval-quote">"${response.length>120?response.slice(0,120)+'…':response}"</div></div>`;}

  const sit=P100._currentSituation;
  const phase=_currentPhase();
  const weakest=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ');
  const govCtx=P100.unifiedGov?'unified government':P100.dividedGov?'divided government':'split Congress';
  const actorCtx=WORLD_ACTORS.map(a=>`${a.label}:${P100.actors[a.id]}`).join(', ');

  const prompt=`You are a senior political analyst evaluating a presidential decision in a political simulation.

PRESIDENT: ${P100.playerName} (${P100.playerPartyLabel})
DAY: ${P100.day} of 100 | PHASE: ${phase.label}
APPROVAL: ${P100.approvalRating}% | MANDATE: ${P100.finalEV} electoral votes
CONGRESS: ${govCtx} — Senate ${P100.senate.dem}D/${P100.senate.rep}R, House ${P100.house.dem}D/${P100.house.rep}R
FILIBUSTER-PROOF: ${P100.filibusterProof?'YES':'NO'}
STATS: Economy ${P100.stats.economy}, ForeignPolicy ${P100.stats.foreignPolicy}, Healthcare ${P100.stats.healthcare}, NatSecurity ${P100.stats.nationSecurity}, Media ${P100.stats.mediaRelations}
WEAKEST: ${weakest.label} (${P100.stats[weakest.id]})
AGENDA: ${agenda}
RELATIONSHIPS: ${actorCtx}

BRIEFING SITUATION: ${sit.headline}
${sit.brief}

THE PRESIDENT'S RESPONSE: "${response}"

Evaluate this response as a presidential decision. Consider: Was it decisive? Specific? Politically realistic given their Congress? Did it address the core issue? Did it align with their agenda? What unintended consequences followed?

Bold, specific responses get high variance (big wins or big risks). Vague or evasive responses get mild penalties. Contradictory or politically unrealistic responses get penalized. A clever unexpected approach should be rewarded.

Return ONLY valid JSON, no markdown, no preamble:
{
  "outcome": "2-3 vivid sentences of exactly what happened as a consequence. Reference what they actually said. Make it feel real, earned, and specific to their words.",
  "analysis": "1 sentence of political analysis. What did this response signal to Washington?",
  "effects": { "economy": 0, "foreignPolicy": 0, "healthcare": 0, "nationSecurity": 0, "mediaRelations": 0 },
  "approvalDelta": 0,
  "actorShifts": { "gop_senate": 0, "dem_senate": 0, "nato_allies": 0, "wall_street": 0, "press_corps": 0, "military": 0, "labor_unions": 0, "tech_sector": 0 },
  "grade": "B",
  "gradeReason": "One short sentence explaining the grade.",
  "tickerLine": "BREAKING NEWS IN ALL CAPS — max 10 words"
}
Rules: effects integers -14 to +14. approvalDelta integer -10 to +10. actorShifts -12 to +12. grade A/B/C/D/F. Zero out unrelated stats.`;

  let result=null;

  if(window.isElectron&&window.localAI){
    try{const raw=await window.localAI.respond(prompt);if(raw?.outcome&&raw?.effects)result=raw;}catch(_){}
  }
  if(!result&&window._POTUS_AI_WORKER_URL){
    try{
      const res=await fetch(window._POTUS_AI_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,first100:true,respond:true}),signal:AbortSignal.timeout(12000)});
      if(res.ok){const data=await res.json();let raw=data.respond||data.evaluation||data.text;if(typeof raw==='string')raw=JSON.parse(raw.replace(/```json|```/g,'').trim());if(raw?.outcome&&raw?.effects)result=raw;}
    }catch(_){}
  }
  if(!result)result=_proceduralEvaluate(response,sit,phase);

  P100._aiEvaluating=false;
  _applyEvaluationResult(result,response);
}

function _proceduralEvaluate(response,sit,phase){
  const lower=response.toLowerCase();const words=response.split(/\s+/).length;
  const assertive=/\b(immediately|authorize|order|direct|command|will not|demand|deploy|sign|enforce|tonight|now)\b/.test(lower);
  const diplomatic=/\b(allies|coalition|partner|negotiate|diplomacy|bipartisan|congress|together)\b/.test(lower);
  const cautious=/\b(review|consider|assess|monitor|wait|careful|deliberate|study|options)\b/.test(lower);
  const publicPR=/\b(address|statement|press|public|nation|americans|transparency|announce)\b/.test(lower);
  let q=0;
  if(words>=20)q+=2;if(words>=40)q+=2;
  if(assertive)q+=3;if(diplomatic)q+=2;if(publicPR)q+=1;if(cautious)q-=1;
  const grade=q>=7?'A':q>=5?'B':q>=3?'C':q>=1?'D':'F';
  const m=q>=6?1:q>=3?0.5:-0.5;
  const pb={transition:{economy:3,mediaRelations:2},first_acts:{economy:2,foreignPolicy:2,mediaRelations:2},legislation:{economy:4,mediaRelations:1},crisis:{nationSecurity:5,mediaRelations:3},legacy:{foreignPolicy:3,mediaRelations:4}};
  const base=pb[phase.id]||pb.first_acts;
  const effects={};P100_STATS.forEach(s=>{effects[s.id]=Math.round((base[s.id]||0)*m);});
  const outcomes={A:'Your response hit exactly the right note. Washington moved quickly. Allies responded, opponents recalibrated, and your standing strengthened.',B:'A solid, credible response. Implementation was smooth. Critics found little to attack and the story moved on favorably.',C:'The response was adequate but lacked the sharpness the moment demanded. Staffers struggled with the vague direction.',D:'The response felt hesitant. The press filled the void with the worst interpretation available.',F:'The response missed the moment entirely. A damaging week followed.'};
  return{outcome:outcomes[grade],analysis:'The President\'s handling of this situation shaped perceptions in Washington.',effects,approvalDelta:Math.round((q-3)*1.5),actorShifts:{gop_senate:0,dem_senate:0,nato_allies:0,wall_street:0,press_corps:assertive?2:cautious?-1:0,military:assertive?3:0,labor_unions:0,tech_sector:0},grade,gradeReason:{A:'Decisive, specific, and politically savvy.',B:'Clear intent and solid direction.',C:'Adequate but lacked specificity.',D:'Too vague to produce strong outcomes.',F:'Response was unclear or counterproductive.'}[grade],tickerLine:`WHITE HOUSE RESPONDS TO ${(sit.headline||'BRIEFING').toUpperCase().slice(0,40)}`};
}

function _applyMilestoneSpecificOutcome(result, response){
  const milestone=P100._isMilestone;
  if(!milestone)return;
  const lower=String(response||'').toLowerCase();
  const gradeBoost={A:16,B:10,C:4,D:-6,F:-12}[result.grade||'C']||0;

  if(milestone==='congress_bill_push'){
    const bill=P100._pendingBill||{name:'Major Bill',stat:'economy',baseOdds:48};
    P100.majorBillsAttempted=(P100.majorBillsAttempted||0)+1;
    const bipartisan=/\b(bipartisan|across the aisle|compromise|moderate|coalition)\b/.test(lower);
    const whip=/\b(call|whip|count votes|vote|senator|representative|speaker|leader)\b/.test(lower);
    const concession=/\b(concession|amend|phase|pilot|offset|carve[- ]out)\b/.test(lower);
    const hardline=/\b(no compromise|no concession|take it or leave it|red line)\b/.test(lower);
    let chance=(bill.baseOdds||48)+gradeBoost+(bipartisan?8:0)+(whip?6:0)+(concession?4:0)-(hardline?6:0);
    chance=Math.max(8,Math.min(96,chance));
    const passed=Math.random()*100<chance;

    if(passed){
      P100.legislationPassed.push({day:P100.day,headline:bill.name,grade:result.grade||'C'});
      if(bill.stat&&P100.stats[bill.stat]!==undefined)P100.stats[bill.stat]=Math.min(95,P100.stats[bill.stat]+4);
      P100.approvalRating=Math.min(88,P100.approvalRating+2);
      result.outcome=`${result.outcome} Congress ultimately passes the ${bill.name} after your direct intervention, giving the White House a tangible governing win.`;
      result.analysis=`${result.analysis} The vote proved you can convert presidential messaging into legislative power.`;
      result.tickerLine=`CONGRESS PASSES ${bill.name.toUpperCase().slice(0,28)}`;
    }else{
      P100.approvalRating=Math.max(18,P100.approvalRating-2);
      if(P100.stats.mediaRelations!==undefined)P100.stats.mediaRelations=Math.max(10,P100.stats.mediaRelations-2);
      result.outcome=`${result.outcome} The ${bill.name} stalls on the floor, and both parties frame the defeat as a test of White House leverage.`;
      result.analysis=`${result.analysis} The failed push exposed limits in your congressional coalition.`;
      result.tickerLine=`FLAGSHIP BILL STALLS IN CONGRESS`;
    }
    P100._pendingBill=null;
  }

  if(milestone==='state_of_union'){
    P100.sotuDelivered=true;
    const unity=/\b(unity|together|american people|shared|common purpose)\b/.test(lower);
    const agenda=/\b(congress|jobs|health|security|economy|allies|reform)\b/.test(lower);
    const callToAction=/\b(ask|urge|call on|pass this|act now)\b/.test(lower);
    const sotuDelta=(unity?1:0)+(agenda?1:0)+(callToAction?1:0)+(gradeBoost>=10?1:0);
    if(sotuDelta>0){
      P100.approvalRating=Math.min(88,P100.approvalRating+sotuDelta);
      P100.stats.mediaRelations=Math.min(95,P100.stats.mediaRelations+sotuDelta);
    }
    result.outcome=`${result.outcome} Your State of the Union becomes the dominant story overnight and resets the tone in Washington for the next phase.`;
    result.analysis=`${result.analysis} Prime-time framing gave your administration a fresh narrative runway.`;
    result.tickerLine=`STATE OF UNION DRAWS STRONG NATIONAL REACTION`;
  }
}

function _applyEvaluationResult(result,originalResponse){
  if(result.effects){for(const[k,v]of Object.entries(result.effects)){if(P100.stats[k]!==undefined&&typeof v==='number')P100.stats[k]=Math.max(10,Math.min(95,P100.stats[k]+v));}}
  if(result.actorShifts){for(const[id,delta]of Object.entries(result.actorShifts)){if(P100.actors[id]!==undefined)P100.actors[id]=Math.max(5,Math.min(99,P100.actors[id]+(delta||0)));}}
  if(result.approvalDelta)P100.approvalRating=Math.max(18,Math.min(88,P100.approvalRating+result.approvalDelta));
  _recalcApproval();
  P100.approvalHistory.push({day:P100.day,approval:P100.approvalRating});
  P100.selectedAgenda.forEach(id=>{const ag=P100_AGENDA_OPTIONS.find(a=>a.id===id);if(ag?.stat&&result.effects?.[ag.stat]>0)P100.agendaProgress[id]=Math.min(100,(P100.agendaProgress[id]||0)+result.effects[ag.stat]*2);});
  // Count crises by phase (any resolved crisis-phase situation counts), not just stat threshold
  const currentPhaseId=_currentPhase().id;
  if(currentPhaseId==='crisis')P100.crisesHandled++;
  else if((result.effects?.nationSecurity||0)>4)P100.crisesHandled++; // also count surprise security crises in other phases
  // Diplomatic wins: lower threshold so it actually accumulates
  if((result.effects?.foreignPolicy||0)>=3)P100.diplomaticWins++;
  // Executive orders: any decision in transition/first_acts phases that earns B or better
  const goodGrade=(result.grade==='A'||result.grade==='B');
  if((currentPhaseId==='transition'||currentPhaseId==='first_acts')&&goodGrade)
    P100.executiveOrders++;
  // Laws signed: legislation phase decisions that earn C or better count as partial legislative wins
  if(currentPhaseId==='legislation'&&P100._isMilestone!=='congress_bill_push'&&(goodGrade||result.grade==='C'))
    P100.legislationPassed.push({day:P100.day,headline:P100._currentSituation?.headline||'Bill',grade:result.grade});
  const sit=P100._currentSituation;
  P100.decisionLog.push({day:P100.day,headline:sit?.headline||'',response:originalResponse,grade:result.grade,effects:result.effects,approvalDelta:result.approvalDelta});
  _applyMilestoneSpecificOutcome(result,originalResponse);
  _recalcApproval();
  if(P100.approvalHistory.length)P100.approvalHistory[P100.approvalHistory.length-1].approval=P100.approvalRating;
  if(result.tickerLine){P100.tickerItems.push(result.tickerLine);_updateTicker();}
  // Compute state reactions based on this decision's quality
  _computeStateReactions(result);
  _renderEvaluationResult(result);
}

// ── STATE REACTION MAP ────────────────────────────────────────────────────────
// Computes per-state sentiment delta based on decision quality and state lean
function _computeStateReactions(result){
  if(!window.GS?.states&&!window.STATE_DATA)return;
  const states=window.GS?.states||window.STATE_DATA||[];
  const gradeVal={A:1,B:0.6,C:0.2,D:-0.3,F:-0.6}[result.grade||'C']??0.2;
  const approvalMod=(result.approvalDelta||0)/10;
  const pIsDem=P100.playerParty==='dem';
  // Build a reaction map: stateCode -> delta (-1 to +1)
  if(!P100.stateReactions)P100.stateReactions={};
  states.forEach(s=>{
    const lean=s.lean??0; // positive = dem-leaning, negative = rep-leaning
    const playerLean=pIsDem?lean:-lean; // positive = player's coalition
    // Base reaction: player's base reacts positively to good decisions
    // Opposition reacts less/negatively
    const base=gradeVal+(approvalMod*0.5);
    // States that already lean toward player react more strongly
    const coalitionBoost=playerLean>0?(playerLean/40*0.4):0;
    // Swing states (close to 0) are more volatile
    const swingBoost=Math.abs(lean)<10?(0.2*gradeVal):0;
    // Opposition states dampen positive reactions
    const oppPenalty=playerLean<-15?(0.3):0;
    const delta=Math.max(-1,Math.min(1,(base+coalitionBoost+swingBoost-oppPenalty)));
    const prev=P100.stateReactions[s.code]||0;
    // Blend: 60% new, 40% accumulated history
    P100.stateReactions[s.code]=Math.max(-1,Math.min(1,prev*0.4+delta*0.6));
  });
}

function _renderStateMap(){
  const states=window.GS?.states||window.STATE_DATA||[];
  if(!states.length||typeof PATHS==='undefined'||typeof STATE_DATA==='undefined')return'';
  // Use a scaled-down version of the election night SVG map
  const pIsDem=P100.playerParty==='dem';
  const stateColors=states.map(s=>{
    const reaction=P100.stateReactions?.[s.code]??0;
    let fill;
    if(reaction>0.6)fill='rgba(34,197,94,0.85)';
    else if(reaction>0.3)fill='rgba(34,197,94,0.55)';
    else if(reaction>0.05)fill='rgba(34,197,94,0.28)';
    else if(reaction>-0.05)fill='rgba(100,110,130,0.5)';
    else if(reaction>-0.3)fill='rgba(239,68,68,0.28)';
    else if(reaction>-0.6)fill='rgba(239,68,68,0.55)';
    else fill='rgba(239,68,68,0.85)';
    return{code:s.code,fill};
  });
  const colorMap=Object.fromEntries(stateColors.map(x=>[x.code,x.fill]));
  const pathsHtml=STATE_DATA.map(st=>{
    const d=PATHS[st.code];if(!d)return'';
    const fill=colorMap[st.code]||'rgba(100,110,130,0.35)';
    return`<path d="${d}" fill="${fill}" stroke="#060810" stroke-width="0.8" opacity="1"/>`;
  }).join('');
  // Legend
  const legend=[
    {color:'rgba(34,197,94,0.85)',label:'Strong support'},
    {color:'rgba(34,197,94,0.45)',label:'Mild support'},
    {color:'rgba(100,110,130,0.5)',label:'Neutral'},
    {color:'rgba(239,68,68,0.45)',label:'Mild opposition'},
    {color:'rgba(239,68,68,0.85)',label:'Strong opposition'},
  ].map(x=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:${x.color};flex-shrink:0"></div><span style="font-size:9px;color:#4a5568;white-space:nowrap">${x.label}</span></div>`).join('');

  return`<div style="margin-top:16px;background:#080b12;border:1px solid #1e2535;border-radius:8px;overflow:hidden">
    <div style="padding:8px 12px;border-bottom:1px solid #1e2535;display:flex;align-items:center;justify-content:space-between">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.15em">🗺 PUBLIC REACTION BY STATE</span>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${legend}</div>
    </div>
    <div style="position:relative;width:100%;padding-bottom:62.5%;overflow:hidden">
      <svg viewBox="0 0 960 600" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;width:100%;height:100%">
        <rect width="960" height="600" fill="#060810"/>
        <rect x="8" y="455" width="195" height="135" fill="none" stroke="#1e2535" stroke-width="1"/>
        <rect x="218" y="495" width="150" height="78" fill="none" stroke="#1e2535" stroke-width="1"/>
        ${pathsHtml}
      </svg>
    </div>
  </div>`;
}

function _renderEvaluationResult(result){
  const gradeColor={A:'#22c55e',B:'#c8a84b',C:'#f59e0b',D:'#ef4444',F:'#7c3aed'}[result.grade||'C'];
  const appColor=(result.approvalDelta||0)>=0?'#22c55e':'#ef4444';
  const nextDay=Math.min(P100.day+_daysPerEvent(),100);
  const respArea=document.getElementById('p100-response-area');
  if(respArea){
    respArea.outerHTML=`
      <div class="p100-result-block" id="p100-result-block">
        <div class="p100-grade-badge" style="border-color:${gradeColor}">
          <div class="p100-grade-letter" style="color:${gradeColor}">${result.grade||'C'}</div>
          <div class="p100-grade-reason">${result.gradeReason||''}</div>
        </div>
        <div class="p100-result-narrative">
          <div class="p100-result-narrative-label">CONSEQUENCE</div>
          <div class="p100-result-narrative-text">${result.outcome||''}</div>
        </div>
        ${result.analysis?`<div class="p100-result-analysis">${result.analysis}</div>`:''}
        <div class="p100-result-effects">
          ${Object.entries(result.effects||{}).filter(([,v])=>v!==0).map(([k,v])=>{const s=P100_STATS.find(s=>s.id===k);const col=v>0?'#22c55e':'#ef4444';return`<div class="p100-result-effect-row"><span style="font-size:12px">${s?.icon||''}</span><span style="color:#8a93a8;font-size:11px">${s?.label||k}</span><span style="color:${col};font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;margin-left:auto">${v>0?'+':''}${v}</span></div>`;}).join('')}
          ${(result.approvalDelta||0)!==0?`<div class="p100-result-effect-row"><span style="font-size:12px">📊</span><span style="color:#8a93a8;font-size:11px">Approval</span><span style="color:${appColor};font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;margin-left:auto">${result.approvalDelta>0?'+':''}${result.approvalDelta}%</span></div>`:''}
        </div>
        <button class="p100-next-btn" id="p100-continue-btn" onclick="p100AdvanceDay()">${P100.day>=97?'View Your Legacy →':`Continue to Day ${nextDay} →`}</button>
        ${_renderStateMap()}
      </div>`;
  }
  _renderSidebar();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — MILESTONES (cabinet uses data-attributes — no template bug)
// ══════════════════════════════════════════════════════════════════════════════
function _renderCabinetMilestone(){
  const el=document.getElementById('p100-event-area');if(!el)return;
  P100._isMilestone='cabinet_confirmations';
  const unresolved=P100.cabinetMembers.filter(m=>!m.resolved);
  if(!unresolved.length){p100AdvanceDayFromCabinet();return;}
  const member=unresolved[0];
  const idx=P100.cabinetMembers.indexOf(member);
  const color=member.controversial?'#ef4444':'#c8a84b';
  const confirmed=P100.cabinetMembers.filter(m=>m.confirmed).length;
  const total=P100.cabinetMembers.length;
  // KEY FIX: data attributes only, no inline function calls with template expressions
  el.innerHTML=`
    <div class="p100-event-card" id="p100-active-card" style="border-left:3px solid ${color}">
      <div class="p100-event-header">
        <div class="p100-event-phase-tag" style="color:#c8a84b">🏛 MILESTONE — CABINET CONFIRMATIONS (${confirmed}/${total})</div>
        <div class="p100-event-day-tag">DAY ${P100.day}</div>
      </div>
      <div class="p100-event-headline">${member.icon} Nominate ${member.name} — ${member.role}</div>
      <div class="p100-event-situation">${member.bio}</div>
      <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px;margin:10px 0;font-family:'IBM Plex Mono',monospace;font-size:10px">
        <div style="margin-bottom:4px">Senate: <b style="color:#3b82f6">${member.senateFor}</b> for · <b style="color:#ef4444">${member.senateAgainst}</b> against</div>
        ${member.controversial?'<div style="color:#ef4444">⚠️ Controversial — political risk if floor fight occurs.</div>':'<div style="color:#22c55e">✅ Strong nominee — confirmation expected.</div>'}
      </div>
      <div class="p100-event-choices" id="p100-choices">
        <button class="p100-choice-btn" data-cab-idx="${idx}" data-cab-action="confirm" onclick="p100CabinetVoteHandler(this)">
          <span class="p100-choice-num">A</span>
          <div style="flex:1"><div class="p100-choice-text">Advance to the floor — call for a vote</div>
          <div style="font-size:11px;color:#4a5568;margin-top:3px">Win big or lose publicly.</div></div>
        </button>
        <button class="p100-choice-btn" data-cab-idx="${idx}" data-cab-action="withdraw" onclick="p100CabinetVoteHandler(this)">
          <span class="p100-choice-num">B</span>
          <div style="flex:1"><div class="p100-choice-text">Withdraw the nomination — cut losses</div>
          <div style="font-size:11px;color:#4a5568;margin-top:3px">Avoids a floor fight. An acting secretary fills the role.</div></div>
        </button>
      </div>
    </div>`;
}

window.p100CabinetVoteHandler=function(btn){p100CabinetVote(parseInt(btn.dataset.cabIdx,10),btn.dataset.cabAction);};

window.p100CabinetVote=function(idx,action){
  const m=P100.cabinetMembers[idx];if(!m||m.resolved)return;
  m.resolved=true;
  let headline,outcome,effects={},approvalDelta=0;
  if(action==='confirm'){
    // senateFor is the projected vote COUNT (e.g. 62 senators for, 38 against).
    // Simple majority = 51. If projected votes ≥51, nominee passes — always.
    // Only truly contested nominees (senateFor 44-54) have real uncertainty.
    let passes;
    if(m.senateFor>=55){passes=true;}                          // comfortable majority — always passes
    else if(m.senateFor>=51){passes=Math.random()<0.82;}       // slim majority — 18% upset chance
    else{passes=Math.random()<0.15;}                           // minority support — nearly always fails
    m.confirmed=passes;
    if(passes){if(m.stat)P100.stats[m.stat]=Math.min(95,P100.stats[m.stat]+(m.controversial?4:6));headline=`✅ ${m.name} Confirmed — ${m.role}`;outcome=`Senate votes ${m.senateFor}–${m.senateAgainst}. ${m.name} is sworn in immediately. ${m.controversial?'The controversy fades — for now.':'Smooth confirmation strengthens the administration.'}`;approvalDelta=m.controversial?1:2;_adjustActors({gop_senate:m.controversial?-2:2,dem_senate:m.controversial?-3:2});}
    else{headline=`❌ ${m.name} Rejected — ${m.role} Seat Vacant`;outcome=`The Senate votes against confirmation. An acting secretary will cover the role.`;effects={mediaRelations:-4};approvalDelta=-3;_adjustActors({press_corps:-4});}
  }else{m.confirmed=false;headline=`⚠️ Nomination Withdrawn — ${m.role}`;outcome=`You pull the nomination before the vote. ${m.controversial?'Relief in the caucus.':'Critics call it a retreat.'}`;effects={mediaRelations:m.controversial?2:-3};approvalDelta=m.controversial?1:-2;_adjustActors({press_corps:m.controversial?2:-3});}
  _applyEffects(effects,approvalDelta);
  const remaining=P100.cabinetMembers.filter(m2=>!m2.resolved);
  const choicesEl=document.getElementById('p100-choices');if(!choicesEl)return;
  const nextLabel=remaining.length>0?`Next: ${remaining[0].role} →`:'Complete Cabinet →';
  // Again: NO inline function expressions — use named global calls
  const nextCall=remaining.length>0?'_renderCabinetMilestone()':'p100AdvanceDayFromCabinet()';
  choicesEl.innerHTML=`
    <div class="p100-outcome-box">
      <div class="p100-outcome-header">${headline}</div>
      <div class="p100-outcome-text">${outcome}</div>
      ${_effectPills(effects,approvalDelta)}
    </div>
    <button class="p100-next-btn" onclick="${nextCall}">${nextLabel}</button>`;
  _renderSidebar();
};

window.p100AdvanceDayFromCabinet=function(){
  const c=P100.cabinetMembers.filter(c=>c.confirmed).length;
  P100.tickerItems.push(`SENATE CONFIRMS ${c} OF ${P100.cabinetMembers.length} CABINET NOMINEES`);_updateTicker();p100AdvanceDay();
};

function _renderAgendaMilestone(){
  P100._isMilestone='presidential_agenda';
  const items=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)).filter(Boolean);
  // Electron: two-step AI speech generation; Web: standard briefing
  if(window.isElectron&&window.localAI){
    _renderJointSessionAddressElectron(items);
  } else {
    P100._currentSituation={id:'ms_agenda',headline:'Address to a Joint Session of Congress',
      brief:`The chamber is packed. This is your first address to Congress as President \u2014 the moment where your agenda becomes official policy. Your three priorities: ${items.map(a=>`${a.icon} ${a.label}`).join(' \u00b7 ')}.\n\nWhat you say in the next thirty minutes will define the legislative program for your entire term. What is the central message? What is the first thing you are asking Congress to do?`,
      advisorVoice:'press_sec',advisorLine:"The chamber is ready. Cameras are live. What's the central message?"};
    _renderBriefing();
  }
}

// ── Electron: Joint Session Address with local-AI speech generation ──────────
function _renderJointSessionAddressElectron(agendaItems){
  const el=document.getElementById('p100-event-area');if(!el)return;
  const agendaLabels=agendaItems.map(a=>`${a.icon} ${a.label}`).join(' \u00b7 ');
  el.innerHTML=`
    <div class="p100-event-card" id="p100-active-card" style="border-left:3px solid #22c55e">
      <div class="p100-event-header">
        <div class="p100-event-phase-tag" style="color:#22c55e">\ud83c\udfaf MILESTONE \u2014 PRESIDENTIAL AGENDA</div>
        <div class="p100-event-day-tag">DAY ${P100.day}</div>
      </div>
      <div class="p100-event-headline">Address to a Joint Session of Congress</div>
      <div class="p100-event-situation">
        The chamber is packed. Members of Congress, the Cabinet, and the Supreme Court are present. This is your first address as President \u2014 the moment your agenda becomes official policy.<br><br>
        <b style="color:#c8a84b">Your agenda:</b> ${agendaLabels}<br><br>
        <b style="color:#22c55e">\u2756 Electron Edition</b> \u2014 Enter topics and your local AI speechwriter will draft the address. You can edit it before delivering.
      </div>
      <div class="p100-advisor-block">
        <div class="p100-advisor-avatar">\ud83d\udcfa</div>
        <div class="p100-advisor-content">
          <div class="p100-advisor-name">Press Secretary</div>
          <div class="p100-advisor-line">"Tell us what you want to say \u2014 we'll get the words right."</div>
        </div>
      </div>

      <div id="p100-joint-step1" style="margin-top:16px">
        <div class="p100-response-label">
          <span>\ud83d\udcdd WHAT SHOULD THE ADDRESS COVER?</span>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5568;margin-bottom:8px;letter-spacing:.05em">
          Enter 2\u20135 topics, themes, or key messages. Your local AI will draft the full address. You can then edit the draft before delivering it.
        </div>
        <textarea id="p100-joint-topics" class="p100-response-textarea" maxlength="400"
          placeholder="e.g. Infrastructure investment, restoring NATO alliances, cutting prescription drug costs, border security, call for unity"
          style="min-height:90px"
          oninput="(function(v){const b=document.getElementById('p100-joint-gen-btn');if(b){b.disabled=v.trim().length<10;b.style.opacity=v.trim().length>=10?'1':'.4';b.style.cursor=v.trim().length>=10?'pointer':'not-allowed';}})(this.value)"></textarea>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          <button id="p100-joint-gen-btn" class="p100-submit-btn" onclick="p100GenerateJointSpeech()" disabled style="opacity:.4;cursor:not-allowed">
            \u2756 GENERATE WITH LOCAL AI
          </button>
          <button class="p100-submit-btn" style="background:#1a2235;border-color:#2a3348;color:#8a93a8" onclick="p100OpenJointSpeechEditor('')">
            WRITE IT MYSELF
          </button>
        </div>
      </div>

      <div id="p100-joint-step2" style="display:none;margin-top:16px">
        <div class="p100-response-label">
          <span>\ud83c\uddfa\ud83c\uddf8 YOUR ADDRESS \u2014 EDIT BEFORE DELIVERING</span>
          <span class="p100-char-count" id="p100-joint-speech-count">0 / 1200</span>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5568;margin-bottom:8px;letter-spacing:.05em">
          Your local AI drafted this from your topics. Edit freely before delivering to Congress.
        </div>
        <textarea id="p100-joint-speech" class="p100-response-textarea" maxlength="1200"
          style="min-height:200px"
          placeholder="Your address will appear here..."
          oninput="(function(l){const c=document.getElementById('p100-joint-speech-count');if(c)c.textContent=l+' / 1200';const b=document.getElementById('p100-joint-deliver-btn');if(b){b.disabled=l<40;b.style.opacity=l>=40?'1':'.4';b.style.cursor=l>=40?'pointer':'not-allowed';}})(this.value.length)"></textarea>
        <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
          <button id="p100-joint-deliver-btn" class="p100-submit-btn" onclick="p100DeliverJointSpeech()" disabled style="opacity:.4;cursor:not-allowed">
            \ud83c\udfa4 DELIVER THE ADDRESS TO CONGRESS
          </button>
          <button class="p100-submit-btn" style="background:#1a2235;border-color:#2a3348;color:#8a93a8" onclick="document.getElementById('p100-joint-step1').style.display='';document.getElementById('p100-joint-step2').style.display='none'">
            \u2190 BACK
          </button>
        </div>
      </div>
    </div>`;
}

window.p100GenerateJointSpeech=async function(){
  const topicsEl=document.getElementById('p100-joint-topics');
  const genBtn=document.getElementById('p100-joint-gen-btn');
  if(!topicsEl||!genBtn)return;
  const topics=topicsEl.value.trim();
  if(topics.length<10)return;
  genBtn.disabled=true;genBtn.innerHTML='\u2756 GENERATING\u2026';genBtn.style.opacity='.6';

  const name=P100.playerName||'the President';
  const party=P100.playerPartyLabel||'';
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ');
  const senateSit=P100.hasSenate?`Your party holds the Senate (${P100.playerSenate} seats)`:
    `Your party is in the minority in the Senate (${P100.playerSenate} seats)`;
  const houseSit=P100.hasHouse?`and controls the House (${P100.playerHouse} seats)`:
    `and does not control the House (${P100.playerHouse} seats)`;

  const prompt=`You are a White House speechwriter drafting a presidential address to a Joint Session of Congress. Write in first person as President ${name}, a ${party} president on Day ${P100.day}. Approval: ${P100.approvalRating}%. ${senateSit} ${houseSit}. Policy agenda: ${agenda}.\n\nThe president wants this address to cover: "${topics}"\n\nWrite a compelling presidential address. Open with a greeting to Congress, cover the key topics listed, include a specific ask to Congress, and close with a patriotic message. 4-6 paragraphs. Write ONLY the speech text, no stage directions, no title, no quotes around the text.`;

  try{
    const speech=await window.localAI.generateSpeech(prompt);
    if(speech&&speech.length>40){
      p100OpenJointSpeechEditor(_fixAISpacing(speech));
    }else{
      genBtn.disabled=false;genBtn.innerHTML='\u2756 GENERATE WITH LOCAL AI';genBtn.style.opacity='1';
      alert('The AI speechwriter is still loading. Try again or write the address yourself.');
    }
  }catch(err){
    genBtn.disabled=false;genBtn.innerHTML='\u2756 GENERATE WITH LOCAL AI';genBtn.style.opacity='1';
    console.warn('[JointSession] speech gen failed:',err);
    alert('Speech generation unavailable. Write the address yourself.');
  }
};

window.p100OpenJointSpeechEditor=function(speechText){
  const s1=document.getElementById('p100-joint-step1');
  const s2=document.getElementById('p100-joint-step2');
  const ta=document.getElementById('p100-joint-speech');
  if(!s1||!s2||!ta)return;
  if(speechText)ta.value=speechText;
  const l=ta.value.length;
  const c=document.getElementById('p100-joint-speech-count');if(c)c.textContent=l+' / 1200';
  const b=document.getElementById('p100-joint-deliver-btn');
  if(b){b.disabled=l<40;b.style.opacity=l>=40?'1':'.4';b.style.cursor=l>=40?'pointer':'not-allowed';}
  s1.style.display='none';s2.style.display='';
  ta.focus();
};

window.p100DeliverJointSpeech=function(){
  const ta=document.getElementById('p100-joint-speech');
  if(!ta||ta.value.trim().length<40)return;
  const items=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)).filter(Boolean);
  P100._currentSituation={
    id:'ms_agenda',
    headline:'Address to a Joint Session of Congress',
    brief:`The chamber is packed. Agenda: ${items.map(a=>a.label).join(', ')}.`,
    advisorVoice:'press_sec',
    advisorLine:"Cameras are live."
  };
  _evaluatePresidentialResponse(ta.value.trim());
};

function _renderLegislationMilestone(){
  P100._isMilestone='flagship_legislation';
  const isHealth=P100.selectedAgenda.includes('healthcare_reform');
  const billName=isHealth?'American Health Expansion Act':'Economic Opportunity and Renewal Act';
  const passOdds=Math.round((P100.hasSenate?60:25)*0.5+(P100.hasHouse?65:25)*0.5+(P100.mandate==='landslide'?10:0));
  P100._currentSituation={id:'ms_legislation',headline:`${billName}: Vote in 48 Hours`,
    brief:`Your signature legislation — the ${billName} — goes to the floor in 48 hours. Three members of your own party are wavering. Congressional math: Senate ${P100.senate.dem}D/${P100.senate.rep}R, House ${P100.house.dem}D/${P100.house.rep}R${P100.filibusterProof?' (filibuster-proof)':''}.\n\nBase passage odds: ${passOdds}%. Your Majority Leader says personal calls from you could move the holdouts. What is your strategy for these final 48 hours?`,
    advisorVoice:'vp',advisorLine:"48 hours. Three holdouts. What's the play?"};
  _renderBriefing();
}

function _renderCongressBillMilestone(){
  P100._isMilestone='congress_bill_push';
  const agendaItems=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)).filter(Boolean);
  const primaryAgenda=agendaItems[0]||P100_AGENDA_OPTIONS.find(a=>a.id==='economic_growth');
  const billNames={
    economy:'American Jobs and Investment Act',
    healthcare:'Affordable Care Expansion Act',
    foreignPolicy:'Allied Security and Readiness Act',
    nationSecurity:'National Security Modernization Act',
    mediaRelations:'Government Transparency and Access Act',
  };
  const billName=billNames[primaryAgenda?.stat]||'American Renewal Act';
  const houseNeed=Math.max(0,218-P100.playerHouse);
  const senateNeed=Math.max(0,51-P100.playerSenate);
  const baseOdds=Math.max(22,Math.min(86,
    42 + (P100.hasHouse?14:-8) + (P100.hasSenate?12:-10) + (P100.filibusterProof?8:0) + (P100.approvalRating>=55?4:0)
  ));

  P100._pendingBill={ name:billName, stat:primaryAgenda?.stat||'economy', baseOdds };

  // Electron: richer congress bill UI with vote math + negotiation tools
  if(window.isElectron){
    _renderCongressBillElectron(billName,houseNeed,senateNeed,baseOdds,primaryAgenda);
  } else {
    P100._currentSituation={
      id:'ms_congress_bill',
      headline:`Pass the ${billName}`,
      brief:`Your legislative director has scheduled your top bill for a high-risk vote window. This is the cleanest shot you'll get in the first 100 days.\n\nCongress math: Senate ${P100.senate.dem}D/${P100.senate.rep}R, House ${P100.house.dem}D/${P100.house.rep}R. You are currently ${senateNeed} votes short in the Senate and ${houseNeed} votes short in the House before persuasion and crossovers. Base passage odds: ${baseOdds}%.\n\nType your whip strategy to Congress: who you call, what concessions you offer, and your red lines.`,
      advisorVoice:'vp',
      advisorLine:'Members are waiting for your call sheet. What is your strategy?'
    };
    _renderBriefing();
  }
}

// ── Electron: Enhanced congress bill passing UI ─────────────────────────────
function _renderCongressBillElectron(billName,houseNeed,senateNeed,baseOdds,primaryAgenda){
  const el=document.getElementById('p100-event-area');if(!el)return;

  // Senate vote visualizer — 10 columns of 10
  const dem=P100.senate.dem, rep=P100.senate.rep;
  const playerIsDem=P100.playerParty==='dem';
  let circles='';
  for(let i=0;i<100;i++){
    const isDem=i<dem;
    const isPlayerParty=playerIsDem?isDem:!isDem;
    const base=isDem?'#3b82f6':'#ef4444';
    const col=isPlayerParty?base:'#2a3348';
    circles+=`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col};margin:1px;border:1px solid ${isPlayerParty?base+'88':'#1e2535'}"></span>`;
    if((i+1)%10===0)circles+='<br>';
  }

  const govStatus=P100.hasSenate&&P100.hasHouse?'<span style="color:#22c55e">✅ Unified Government</span>':
    !P100.hasSenate&&!P100.hasHouse?'<span style="color:#ef4444">❌ Divided Congress</span>':
    '<span style="color:#c8a84b">⚡ Split Congress</span>';
  const filColor=P100.filibusterProof?'#22c55e':'#ef4444';
  const filLabel=P100.filibusterProof?'✅ Filibuster-proof':'❌ Filibuster risk';
  const oddsColor=baseOdds>=60?'#22c55e':baseOdds>=40?'#c8a84b':'#ef4444';
  const prevBills=P100.legislationPassed.length;

  // Negotiation strategy chips
  const strategies=[
    {label:'📞 Personal Calls to Holdouts',text:'I will personally call the three holdout senators tonight. This is a direct appeal — no staff, just me.'},
    {label:'🤝 Offer Committee Chairmanship',text:'I am offering a committee chairmanship to the key swing vote in exchange for their support on this bill.'},
    {label:'💰 Add Pork-Barrel Amendment',text:'We add a targeted infrastructure project in the holdout districts. It costs $200M but secures the votes.'},
    {label:'📺 Go Public — Pressure Campaign',text:'I am taking this directly to the American people. Prime-time address tonight to build pressure on Congress.'},
    {label:'🔧 Drop the Controversial Provision',text:'We remove Section 4 — the provision they object to. A narrower bill is better than no bill.'},
    {label:'⚖️ Invoke Reconciliation',text:'We use budget reconciliation to bypass the filibuster. 51 votes is enough. Move now.'},
  ];

  el.innerHTML=`
    <div class="p100-event-card" id="p100-active-card" style="border-left:3px solid #a78bfa">
      <div class="p100-event-header">
        <div class="p100-event-phase-tag" style="color:#a78bfa">🎯 MILESTONE — CONGRESS VOTE</div>
        <div class="p100-event-day-tag">DAY ${P100.day}</div>
      </div>
      <div class="p100-event-headline">Pass the ${billName}</div>
      <div class="p100-event-situation">
        Your legislative director has scheduled the bill for a high-risk vote. This is the cleanest window you'll get in the first 100 days.<br><br>
        ${govStatus} &nbsp;|&nbsp; Senate ${P100.senate.dem}D / ${P100.senate.rep}R &nbsp;|&nbsp; House ${P100.house.dem}D / ${P100.house.rep}R
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0">
        <div style="background:#0d1117;border:1px solid #1e2535;border-radius:8px;padding:12px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em;margin-bottom:8px">SENATE SEATS</div>
          <div style="line-height:1">${circles}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;margin-top:8px;color:${filColor}">${filLabel}</div>
        </div>
        <div style="background:#0d1117;border:1px solid #1e2535;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em">VOTES NEEDED</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:${senateNeed>0?'#ef4444':'#22c55e'}">${senateNeed>0?'+'+senateNeed+' Senate':'\u2714 Senate'}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;color:${houseNeed>0?'#c8a84b':'#22c55e'};margin-top:2px">${houseNeed>0?'+'+houseNeed+' House':'\u2714 House'}</div>
          </div>
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em">BASE PASSAGE ODDS</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:24px;font-weight:700;color:${oddsColor}">${baseOdds}%</div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">Bills passed so far: ${prevBills}</div>
        </div>
      </div>

      <div class="p100-advisor-block">
        <div class="p100-advisor-avatar">\u2605</div>
        <div class="p100-advisor-content">
          <div class="p100-advisor-name">Vice President</div>
          <div class="p100-advisor-line">"Members are waiting for your call sheet. What is your strategy?"</div>
        </div>
      </div>

      <div style="margin-top:14px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.1em;margin-bottom:8px">STRATEGY OPTIONS \u2014 click to add to your response</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          ${strategies.map((s,i)=>`<button class="p100-suggestion-chip" data-text="${s.text.replace(/"/g,'&quot;')}" onclick="p100UseSuggestionEl(this)" title="${s.text}">${s.label}</button>`).join('')}
        </div>
      </div>

      <div class="p100-response-area" id="p100-response-area">
        <div class="p100-response-label">
          <span>\ud83c\uddfa\ud83c\uddf8 YOUR WHIP STRATEGY, MR. PRESIDENT</span>
          <span class="p100-char-count" id="p100-char-count">0 / 500</span>
        </div>
        <textarea id="p100-response-input" class="p100-response-textarea" maxlength="500"
          placeholder="Who do you call? What do you offer? What are your red lines? Be specific — the AI will judge every detail of your strategy."
          oninput="p100OnResponseInput(this)"
          onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter')p100SubmitResponse()"></textarea>
        <button id="p100-submit-btn" class="p100-submit-btn" onclick="p100SubmitResponse()" disabled style="opacity:.4;cursor:not-allowed">
          EXECUTE STRATEGY <span style="opacity:.6;font-size:11px;margin-left:8px">Ctrl+Enter</span>
        </button>
      </div>
    </div>`;

  setTimeout(()=>document.getElementById('p100-response-input')?.focus(),100);
}

function _renderStateOfUnionMilestone(){
  P100._isMilestone='state_of_union';
  const top=[...P100_STATS].sort((a,b)=>P100.stats[b.id]-P100.stats[a.id])[0];
  const weak=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const laws=P100.legislationPassed.length;
  P100._currentSituation={
    id:'ms_state_union',
    headline:'State of the Union Tonight',
    brief:`Joint session begins in 90 minutes. This will be your defining national speech of the first 100 days.\n\nCurrent position: Approval ${P100.approvalRating}%. Laws signed ${laws}. Strongest lane: ${top.label} (${P100.stats[top.id]}). Vulnerability: ${weak.label} (${P100.stats[weak.id]}).\n\nType your key SOTU message. Focus on achievements, your plan for Congress, and a closing line for the country.`,
    advisorVoice:'press_sec',
    advisorLine:'Prime-time audience is locked in. What do you want ringing in their ears?'
  };
  _renderBriefing();
}

function _renderCrisisMilestone(){
  P100._isMilestone='major_crisis';
  const weakest=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const cm={
    economy:{h:'Market Crash — Recession Confirmed',b:`The Dow has dropped 19% since your inauguration. Two consecutive quarters of negative growth. Treasury briefed you at 5am: the Federal Reserve Chair is requesting an emergency meeting. Congress is in session with cameras running. Your economic weaknesses (${P100.stats.economy}/100) have been exposed.`},
    foreignPolicy:{h:'War Could Begin Today',b:`A US ally is under imminent military threat. The UN is paralyzed by veto. NATO partners calling every twenty minutes. Your Secretary of Defense and Secretary of State have given contradictory recommendations. NSC gives you six hours before the deterrence window closes. Foreign policy rating: ${P100.stats.foreignPolicy}/100.`},
    healthcare:{h:'Public Health Emergency — Hospitals Overwhelmed',b:`A fast-moving pathogen has overwhelmed hospitals in nine states. CDC requesting emergency powers. Opposition governors blaming your administration on every channel. Healthcare policy weakness (${P100.stats.healthcare}/100) is now the story.`},
    nationSecurity:{h:'Intelligence Failure — Incident Stopped, Barely',b:`A major domestic security incident — stopped at the last moment — revealed a fundamental failure in your intelligence apparatus. Senate Intelligence Committee called an emergency session. NSA, CIA, and FBI are blaming each other. Security rating: ${P100.stats.nationSecurity}/100.`},
    mediaRelations:{h:'White House Leak — National Scandal',b:`A classified memorandum detailing internal divisions has leaked simultaneously to three networks. Someone inside the building. Every outlet running it live. Your press relationships (${P100.stats.mediaRelations}/100) are already strained. You have minutes.`},
  };
  const crisis=cm[weakest.id];
  P100._currentSituation={id:'ms_crisis_peak',headline:crisis.h,brief:crisis.b+'\n\n⚠️ This crisis targets your weakest policy area. The stakes are maximum. What are your orders?',advisorVoice:'nsc_advisor',advisorLine:'The Situation Room is full. The nation is watching. What are your orders?'};
  _renderBriefing();
}

function _renderFinalAddressMilestone(){
  P100._isMilestone='final_address';
  const score=_calcLegacyScore();
  P100._currentSituation={id:'ms_address',headline:'Day 100 — Address to the Nation',
    brief:`Tomorrow is Day 100. Your speechwriters need final direction tonight.\n\nYour approval: ${P100.approvalRating}%. Legacy score: ${score}/100. Laws signed: ${P100.legislationPassed.length}. Executive orders: ${P100.executiveOrders}. Crises handled: ${P100.crisesHandled}.\n\nWhatever you say tonight becomes the first line of your political biography. What is your closing argument to the American people?`,
    advisorVoice:'press_sec',advisorLine:"The Oval Office is ready. Cameras are set. What do you tell America?"};
  _renderBriefing();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — EVENT ENGINE
// ══════════════════════════════════════════════════════════════════════════════
function _daysPerEvent(){const phase=_currentPhase();return Math.max(3,Math.min(10,Math.floor((phase.days[1]-phase.days[0]+1)/5)));}
function _currentPhase(){return P100_PHASES.find(m=>P100.day>=m.days[0]&&P100.day<=m.days[1])||P100_PHASES[4];}

function _checkMilestone(){
  const checks=[
    {key:'cabinet',day:8},
    {key:'agenda',day:14},
    {key:'legislation',day:42},
    {key:'congress_bill',day:58},
    {key:'state_of_union',day:64},
    {key:'crisis_peak',day:72},
    {key:'address',day:99}
  ];
  for(const{key,day}of checks){if(!P100.milestoneDone[key]&&P100.day>=day)return key;}
  return null;
}

async function _scheduleNextEvent(){
  if(P100.day>=100){_showEndScreen();return;}
  const milestone=_checkMilestone();
  if(milestone){
    P100.milestoneDone[milestone]=true;
    switch(milestone){
      case'cabinet':return _renderCabinetMilestone();
      case'agenda':return _renderAgendaMilestone();
      case'legislation':return _renderLegislationMilestone();
      case'congress_bill':return _renderCongressBillMilestone();
      case'state_of_union':return _renderStateOfUnionMilestone();
      case'crisis_peak':return _renderCrisisMilestone();
      case'address':return _renderFinalAddressMilestone();
    }
  }
  // Reset fail counter every 2 events so AI is always retried
  if((P100._eventCount||0)%2===0)P100._aiFailCount=0;
  P100._eventCount=(P100._eventCount||0)+1;
  P100._pendingAI=true;_renderBriefingPlaceholder();
  const phase=_currentPhase();
  let situation=null;
  if(P100._aiFailCount<6)situation=await _fetchAISituation(phase);
  P100._pendingAI=false;
  if(situation){P100._aiFailCount=0;}else{P100._aiFailCount=(P100._aiFailCount||0)+1;situation=_pickFallbackSituation(phase.id);}
  P100._isMilestone=null;P100._currentSituation=situation;_renderBriefing();
}

function _pickFallbackSituation(phaseId){
  const pool=SITUATION_POOL[phaseId]||SITUATION_POOL.first_acts;
  const used=P100._usedByPhase[phaseId]||[];
  let av=pool.filter(s=>!used.includes(s.id));
  // Once curated items are exhausted, switch to procedural briefings to avoid repetition.
  if(!av.length){
    P100._usedByPhase[phaseId]=[];
    return _buildProceduralSituation(phaseId);
  }
  // Also inject some procedural variety during long runs.
  if(Math.random()<0.35)return _buildProceduralSituation(phaseId);
  const pick=av[Math.floor(Math.random()*av.length)];
  (P100._usedByPhase[phaseId]=P100._usedByPhase[phaseId]||[]).push(pick.id);
  return JSON.parse(JSON.stringify(pick));
}

function _buildProceduralSituation(phaseId){
  const weak=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const topActor=[...WORLD_ACTORS].sort((a,b)=>(P100.actors[a.id]||0)-(P100.actors[b.id]||0))[0];
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean);
  const topic=agenda.length?agenda[Math.floor(Math.random()*agenda.length)]:'your domestic agenda';
  const phaseLabel={transition:'Transition',first_acts:'First Acts',legislation:'Legislation',crisis:'Crisis',legacy:'Legacy'}[phaseId]||'Briefing';
  const verbs=['under pressure','splitting your coalition','triggering market anxiety','drawing heavy media scrutiny','testing your congressional leverage'];
  const hooks=[
    `A senior delegation from ${topActor?.label||'Congress'} is demanding immediate clarity on ${topic}.`,
    `An overnight memo warns that inaction could further weaken your ${weak.label.toLowerCase()} standing.`,
    `Two influential allies are privately pushing opposite strategies and both expect your answer before tonight.`,
    `Cable networks are framing this as a leadership test for Day ${P100.day}.`
  ];
  const shuffled=[...hooks].sort(()=>Math.random()-.5).slice(0,3);
  const voices=['chief_of_staff','press_sec','nsc_advisor','econ_advisor','vp'];
  const advisorVoice=voices[Math.floor(Math.random()*voices.length)];
  const adv=ADVISOR_BIOS[advisorVoice];
  return{
    id:`proc_${phaseId}_${P100.day}_${Math.floor(Math.random()*1e6)}`,
    headline:`${phaseLabel} Flashpoint: ${topic}`,
    brief:`${shuffled[0]} ${shuffled[1]} ${shuffled[2]} The issue is now ${verbs[Math.floor(Math.random()*verbs.length)]}.`,
    advisorVoice,
    advisorLine:`${adv?.title||'Senior advisor'}: What's your direct order?`
  };
}

// Robust text post-processor — fixes phi-3 mini spacing issues including spaceless output
function _fixAISpacing(text){
  if(!text)return text;
  // Contractions run together: we'llovercome -> we'll overcome
  text=text.replace(/((?:we'll|I'll|they'll|you'll|it'll|we're|they're|you're|I'm|can't|won't|don't|I've|we've|they've|isn't|aren't|wasn't|weren't|let's|that's|there's|what's|he's|she's|it's))([A-Za-z])/g,'$1 $2');
  // camelCase seams
  text=text.replace(/([a-z])([A-Z])/g,'$1 $2');
  // punctuation run-on: word.Next -> word. Next
  text=text.replace(/([.,!?;:])([A-Za-z\d])/g,'$1 $2');
  // word-number: day14 -> day 14
  text=text.replace(/([a-z]{2})(\d)/g,'$1 $2');
  // number-word: 14senators -> 14 senators
  text=text.replace(/(\d)([A-Za-z])/g,'$1 $2');
  // small words glued after another word: togetherwe -> together we
  text=text.replace(/([a-z])\b(the|our|we|to|for|and|in|of|a|is|it|on|at|by)([a-z])/g,'$1 $2 $3');
  // collapse double spaces & trim
  return text.replace(/ {2,}/g,' ').trim();
}

async function _fetchAISituation(phase){
  const weakest=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ');
  const recentH=P100.decisionLog.slice(-4).map(d=>d.headline).join('; ')||'none yet';
  const advisors=['chief_of_staff','press_sec','nsc_advisor','econ_advisor','vp'];
  const advisor=advisors[Math.floor(Math.random()*advisors.length)];
  const adv=ADVISOR_BIOS[advisor];

  // Simplified prompt tuned for phi-3 mini — shorter, cleaner JSON schema, no nested templates
  const prompt=`Create a US presidential crisis briefing for a political simulation game. Day ${P100.day} of 100. Phase: ${phase.label}. President: ${P100.playerName}, ${P100.playerPartyLabel}. Approval: ${P100.approvalRating}%. Weakest policy: ${weakest.label}. Agenda: ${agenda}. Recent events: ${recentH}.

Write a briefing the president must respond to in their own words. Make it specific to the current situation, different from recent events, and create real tension around ${weakest.label}.

Respond with ONLY a JSON object. No other text before or after. Use this exact format:
{"headline":"Short dramatic headline under 10 words","brief":"Two or three sentences describing the crisis. Be specific and urgent.","advisorVoice":"${advisor}","advisorLine":"One urgent question the ${adv.title} asks the president. Under 20 words."}`;

  // Local AI (Electron)
  if(window.isElectron&&window.localAI){
    try{
      const raw=await window.localAI.getEvent(prompt);
      if(raw?.headline&&raw?.brief&&raw?.advisorLine){
        raw.headline=_fixAISpacing(raw.headline);
        raw.brief=_fixAISpacing(raw.brief);
        raw.advisorLine=_fixAISpacing(raw.advisorLine);
        return raw;
      }
    }catch(_){}
    // Fallback: try advice channel which returns plain text — parse manually
    try{
      const advText=await window.localAI.getAdvice(prompt);
      if(advText){
        const parsed=_parseJSONFromText(advText);
        if(parsed?.headline&&parsed?.brief){
          parsed.headline=_fixAISpacing(parsed.headline);
          parsed.brief=_fixAISpacing(parsed.brief);
          parsed.advisorLine=_fixAISpacing(parsed.advisorLine||'What are your orders?');
          parsed.advisorVoice=parsed.advisorVoice||advisor;
          return parsed;
        }
      }
    }catch(_){}
  }

  // Cloud worker
  if(window._POTUS_AI_WORKER_URL){
    try{
      const res=await fetch(window._POTUS_AI_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,first100:true,situationOnly:true}),signal:AbortSignal.timeout(9000)});
      if(res.ok){
        const data=await res.json();
        let raw=data.event||data.advice||data.text;
        if(typeof raw==='string')raw=_parseJSONFromText(raw);
        if(raw?.headline&&raw?.brief){
          raw.headline=_fixAISpacing(raw.headline);
          raw.brief=_fixAISpacing(raw.brief);
          raw.advisorLine=_fixAISpacing(raw.advisorLine||'What are your orders?');
          return raw;
        }
      }
    }catch(_){}
  }
  return null;
}

// Robust JSON extractor — handles markdown fences, leading text, trailing text
function _parseJSONFromText(text){
  if(!text)return null;
  try{return JSON.parse(text.trim());}catch(_){}
  const cleaned=text.replace(/```json|```/gi,'').trim();
  try{return JSON.parse(cleaned);}catch(_){}
  const match=cleaned.match(/\{[\s\S]*\}/);
  if(match){try{return JSON.parse(match[0]);}catch(_){}}
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — ADVANCE DAY
// ══════════════════════════════════════════════════════════════════════════════
window.p100AdvanceDay=function(){
  P100.day=Math.min(100,P100.day+_daysPerEvent());
  P100._currentSituation=null;P100._isMilestone=null;
  _renderNetworkBar();_renderMilestoneBar();_renderSidebar();
  if(P100.day>=100)setTimeout(_showEndScreen,600);
  else{_renderBriefingPlaceholder();_scheduleNextEvent();}
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — EFFECTS
// ══════════════════════════════════════════════════════════════════════════════
function _applyEffects(effects,approvalDelta){
  for(const[k,v]of Object.entries(effects)){if(P100.stats[k]!==undefined)P100.stats[k]=Math.max(10,Math.min(95,P100.stats[k]+v));}
  if(approvalDelta){P100.approvalRating=Math.max(18,Math.min(88,P100.approvalRating+approvalDelta));P100.approvalHistory.push({day:P100.day,approval:P100.approvalRating});}
  _recalcApproval();
}
function _adjustActors(changes){for(const[id,delta]of Object.entries(changes)){if(P100.actors[id]!==undefined)P100.actors[id]=Math.max(5,Math.min(99,P100.actors[id]+delta));}}
function _recalcApproval(){const w=P100_STATS.reduce((s,st)=>s+P100.stats[st.id]*st.weight,0);P100.approvalRating=Math.round(Math.min(84,Math.max(25,20+w*0.55)));P100.approvalHistory.push({day:P100.day,approval:P100.approvalRating});}
function _effectPills(effects,approvalDelta){const pills=[];for(const[k,v]of Object.entries(effects)){if(!v)continue;const lbl=P100_STATS.find(s=>s.id===k)?.label||k;const col=v>0?'#22c55e':'#ef4444';pills.push(`<span class="p100-effect-pill" style="color:${col}">${v>0?'+':''}${v} ${lbl}</span>`);}if(approvalDelta){const col=approvalDelta>0?'#22c55e':'#ef4444';pills.push(`<span class="p100-effect-pill" style="color:${col}">${approvalDelta>0?'+':''}${approvalDelta} Approval</span>`);}return pills.length?`<div class="p100-outcome-effects">${pills.join('')}</div>`:'';}


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — END SCREEN
// ══════════════════════════════════════════════════════════════════════════════
async function _showEndScreen(){
  const el=document.getElementById('p100-event-area');if(!el)return;
  if(P100._clockInterval)clearInterval(P100._clockInterval);
  const score=_calcLegacyScore();
  const grade=score>=85?'A':score>=70?'B':score>=55?'C':score>=40?'D':'F';
  const gradeColor={A:'#22c55e',B:'#c8a84b',C:'#f59e0b',D:'#ef4444',F:'#7c3aed'}[grade];
  const gradeLabel={A:'Historic Presidency',B:'Strong Foundation',C:'Mixed Record',D:'Troubled Start',F:'Crisis Administration'}[grade];
  const hist=P100.approvalHistory;
  const avgAppr=Math.round(hist.reduce((s,h)=>s+h.approval,0)/Math.max(1,hist.length));
  const inaugA=hist[0]?.approval||P100.approvalRating;const finalA=P100.approvalRating;const delta=finalA-inaugA;
  const best=[...P100_STATS].sort((a,b)=>P100.stats[b.id]-P100.stats[a.id])[0];
  const worst=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const confirmed=P100.cabinetMembers.filter(c=>c.confirmed).length;
  const svgW=360,svgH=100;
  const pts=hist.length<2?'':hist.map((h,i)=>{const x=(i/(hist.length-1))*svgW;const y=svgH-((h.approval-18)/70)*svgH;return`${x.toFixed(1)},${Math.max(0,Math.min(svgH,y)).toFixed(1)}`;}).join(' ');
  const bestDec=P100.decisionLog.length?[...P100.decisionLog].sort((a,b)=>({'A':4,'B':3,'C':2,'D':1,'F':0}[b.grade]||0)-({'A':4,'B':3,'C':2,'D':1,'F':0}[a.grade]||0))[0]:null;

  el.innerHTML=`
    <div class="p100-end-card">
      <div class="p100-end-header"><div class="p100-end-title">🇺🇸 FIRST 100 DAYS COMPLETE</div><div class="p100-end-sub">${P100.playerName} · ${P100.playerPartyLabel} · ${P100.finalEV} EV</div></div>
      <div class="p100-end-grade-row">
        <div class="p100-end-grade" style="color:${gradeColor}">${grade}</div>
        <div><div class="p100-end-grade-label" style="color:${gradeColor}">${gradeLabel}</div><div class="p100-end-grade-sub">Legacy score: ${score}/100 · Avg approval: ${avgAppr}%</div></div>
      </div>
      <div class="p100-end-spark-wrap">
        <div class="p100-end-spark-label">APPROVAL RATING — 100 DAYS</div>
        <svg viewBox="0 0 ${svgW} ${svgH}" class="p100-end-sparkline">
          ${[30,40,50,60,70].map(p=>{const y=(svgH-((p-18)/70)*svgH).toFixed(1);return`<line x1="0" y1="${y}" x2="${svgW}" y2="${y}" stroke="#1e2535" stroke-width=".5"/><text x="4" y="${(parseFloat(y)-2).toFixed(1)}" fill="#2a3348" font-size="7" font-family="IBM Plex Mono">${p}%</text>`;}).join('')}
          <line x1="0" y1="${(svgH-((50-18)/70)*svgH).toFixed(1)}" x2="${svgW}" y2="${(svgH-((50-18)/70)*svgH).toFixed(1)}" stroke="#c8a84b" stroke-width=".8" stroke-dasharray="4,3" opacity=".5"/>
          ${pts?`<polyline points="${pts}" fill="none" stroke="${gradeColor}" stroke-width="2" stroke-linejoin="round"/>` : ''}
        </svg>
        <div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;margin-top:3px"><span>Day 1: ${inaugA}%</span><span style="color:${delta>=0?'#22c55e':'#ef4444'}">${delta>=0?'▲':'▼'} ${Math.abs(delta)}pts</span><span>Day 100: <b style="color:${gradeColor}">${finalA}%</b></span></div>
      </div>
      <div><div class="p100-end-spark-label" style="margin-bottom:8px">PRESIDENTIAL SCORECARD</div>
        ${P100_STATS.map(s=>{const v=P100.stats[s.id];const g=_statGrade(v);const c=v>=65?'#22c55e':v>=50?'#c8a84b':'#ef4444';const inAg=P100.selectedAgenda.some(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.stat===s.id);return`<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px"><span style="font-size:13px">${s.icon}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#8a93a8;flex:0 0 100px">${s.label}${inAg?' ★':''}</span><div style="flex:1;height:5px;background:#1e2535;border-radius:3px;overflow:hidden"><div style="width:${v}%;height:100%;background:${c};border-radius:3px"></div></div><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${c};min-width:24px;text-align:right">${v}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${c};min-width:22px">${g}</span></div>`;}).join('')}
      </div>
      <div class="p100-end-stats-grid">
        <div class="p100-end-stat"><span>📋 Laws Signed</span><span style="color:#22c55e;font-weight:700">${P100.legislationPassed.length}</span></div>
        <div class="p100-end-stat"><span>✍️ Exec Orders</span><span style="color:#c8a84b;font-weight:700">${P100.executiveOrders}</span></div>
        <div class="p100-end-stat"><span>🏛 Cabinet</span><span style="color:${confirmed===P100.cabinetMembers.length?'#22c55e':'#c8a84b'};font-weight:700">${confirmed}/${P100.cabinetMembers.length}</span></div>
        <div class="p100-end-stat"><span>🛡 Crises</span><span style="color:#c8a84b;font-weight:700">${P100.crisesHandled}</span></div>
        <div class="p100-end-stat"><span>🌐 Diplomatic Wins</span><span style="color:#3b82f6;font-weight:700">${P100.diplomaticWins}</span></div>
        <div class="p100-end-stat"><span>📊 Avg Approval</span><span style="color:${avgAppr>=52?'#22c55e':'#ef4444'};font-weight:700">${avgAppr}%</span></div>
      </div>
      ${bestDec?`<div style="padding:12px 14px;background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.15);border-radius:8px"><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#22c55e;letter-spacing:.12em;margin-bottom:8px">🏆 BEST DECISION — Day ${bestDec.day} (Grade: ${bestDec.grade})</div><div style="font-size:12px;color:#e8ecf4;margin-bottom:6px;font-style:italic">"${(bestDec.response||'').slice(0,180)}${(bestDec.response||'').length>180?'…':''}"</div><div style="font-size:11px;color:#8a93a8">${bestDec.headline}</div></div>`:''}
      <div style="padding:10px 14px;background:#10141c;border:1px solid #1e2535;border-radius:6px"><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.12em;margin-bottom:8px">RELATIONSHIPS AT DAY 100</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${WORLD_ACTORS.map(a=>{const t=P100.actors[a.id];const c=t>=60?'#22c55e':t>=40?'#c8a84b':'#ef4444';return`<div style="display:flex;align-items:center;gap:5px"><span>${a.icon}</span><span style="font-size:10px;color:#8a93a8;flex:1">${a.label}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${c};font-weight:700">${t}</span></div>`;}).join('')}</div></div>
      <div id="p100-ai-assessment" style="padding:14px 16px;background:rgba(200,168,75,.04);border:1px solid rgba(200,168,75,.18);border-radius:8px"><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.12em;margin-bottom:8px">📜 HISTORICAL ASSESSMENT</div><div style="display:flex;align-items:center;gap:10px;color:#4a5568;font-size:12px"><div style="width:16px;height:16px;border:2px solid #c8a84b;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0"></div>Generating historical assessment…</div></div>
      <div class="p100-end-notes"><span>💪 Strongest: <b style="color:#22c55e">${best.label}</b> (${P100.stats[best.id]})</span><span>⚠️ Weakest: <b style="color:#ef4444">${worst.label}</b> (${P100.stats[worst.id]})</span></div>
      <div class="p100-end-btns"><button class="p100-next-btn" onclick="location.reload()" style="flex:1;background:#1e2535;color:#e8ecf4">🔄 Play Again</button><button class="p100-next-btn" onclick="typeof proceedToEndScreen==='function'&&proceedToEndScreen()" style="flex:1">View Election Results →</button></div>
    </div>`;

  const dayEl=document.getElementById('p100-day-badge');
  if(dayEl)dayEl.textContent='DAY 100 — LEGACY SECURED';

  const eval_=await _fetchAIEvaluation();
  const assessEl=document.getElementById('p100-ai-assessment');
  if(assessEl){
    if(eval_?.paragraph1){assessEl.innerHTML=`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.12em;margin-bottom:12px">📜 HISTORICAL ASSESSMENT — AI GENERATED</div><div style="font-size:12px;color:#c8d0e0;line-height:1.75;margin-bottom:10px">${eval_.paragraph1}</div><div style="font-size:12px;color:#c8d0e0;line-height:1.75;margin-bottom:10px">${eval_.paragraph2}</div><div style="font-size:12px;color:#c8d0e0;line-height:1.75;margin-bottom:12px">${eval_.paragraph3}</div><div style="border-top:1px solid rgba(200,168,75,.2);padding-top:10px;font-family:'Playfair Display',serif;font-size:13px;font-style:italic;color:#c8a84b;line-height:1.6">"${eval_.verdict}"</div>`;}
    else{assessEl.innerHTML=`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.12em;margin-bottom:12px">📜 HISTORICAL ASSESSMENT</div><div style="font-size:12px;color:#c8d0e0;line-height:1.75">${_buildFallbackNarrative(grade,score)}</div>`;}
  }
}

async function _fetchAIEvaluation(){
  const score=_calcLegacyScore();
  const decisions=P100.decisionLog.slice(-6).map(d=>`Day ${d.day} (${d.grade}): "${(d.response||'').slice(0,80)}"`).join('\n');
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ');
  const prompt=`You are a presidential historian evaluating the first 100 days of a political simulation.

President ${P100.lastName} (${P100.playerPartyLabel}) | Final approval: ${P100.approvalRating}% | Legacy score: ${score}/100
Stats: Economy ${P100.stats.economy}, ForeignPolicy ${P100.stats.foreignPolicy}, Healthcare ${P100.stats.healthcare}, NatSecurity ${P100.stats.nationSecurity}, Media ${P100.stats.mediaRelations}
Agenda: ${agenda} | Laws signed: ${P100.legislationPassed.length} | Exec orders: ${P100.executiveOrders}
Congress: Senate ${P100.senate.dem}D/${P100.senate.rep}R | Mandate: ${P100.finalEV} EV

KEY DECISIONS (player's actual words):
${decisions}

Write a 3-paragraph historical assessment in the tone of a serious political biography. Reference their actual decisions and words. Give a one-sentence historical verdict.

Return ONLY valid JSON: {"paragraph1":"...","paragraph2":"...","paragraph3":"...","verdict":"One memorable sentence."}`;
  if(window.isElectron&&window.localAI){try{const raw=await window.localAI.evaluate(prompt);if(raw?.paragraph1&&raw?.verdict)return raw;}catch(_){}}
  if(window._POTUS_AI_WORKER_URL){try{const res=await fetch(window._POTUS_AI_WORKER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,evaluation:true}),signal:AbortSignal.timeout(14000)});if(res.ok){const data=await res.json();let raw=data.evaluation||data.advice||data.text;if(typeof raw==='string')raw=JSON.parse(raw.replace(/```json|```/g,'').trim());if(raw?.paragraph1&&raw?.verdict)return raw;}}catch(_){}}
  return null;
}

function _buildFallbackNarrative(grade,score){
  const n=P100.playerName.split(' ').slice(-1)[0];
  const best=[...P100_STATS].sort((a,b)=>P100.stats[b.id]-P100.stats[a.id])[0];
  const worst=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const m={A:`The ${n} administration's first 100 days will be studied in political science courses for decades. With approval at ${P100.approvalRating}% and strength in ${best.label.toLowerCase()}, this president demonstrated that bold leadership builds rather than erodes capital.`,B:`Historians will characterize the ${n} presidency's opening chapter as a period of solid, purposeful progress. Strong ${best.label.toLowerCase()} policy offset early challenges in ${worst.label.toLowerCase()}.`,C:`The ${n} administration produced a mixed but adequate record. The public is still making up its mind — which at this stage is itself a kind of verdict.`,D:`The opening 100 days tested this administration's resilience. With approval at ${P100.approvalRating}%, serious course correction is required.`,F:`Few modern presidencies have faced the sustained difficulties of the ${n} White House in its first 100 days. Urgent course correction is needed on nearly every front.`};
  return m[grade]||m.C;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — UTILS, CLOCK, TICKER
// ══════════════════════════════════════════════════════════════════════════════
function _calcLegacyScore(){const w=P100_STATS.reduce((s,st)=>s+P100.stats[st.id]*st.weight,0);return Math.round(Math.min(100,Math.max(0,20+w*0.55)));}
function _statGrade(v){if(v>=90)return'A+';if(v>=85)return'A';if(v>=80)return'A-';if(v>=75)return'B+';if(v>=70)return'B';if(v>=65)return'B-';if(v>=60)return'C+';if(v>=55)return'C';if(v>=50)return'C-';if(v>=45)return'D+';if(v>=40)return'D';return'F';}
function _startClock(){function _tick(){const cl=document.getElementById('p100-clock');if(cl){const n=new Date();cl.textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');}}_tick();P100._clockInterval=setInterval(_tick,1000);}
function _buildInitialTicker(){const last=P100.playerName.split(' ').slice(-1)[0].toUpperCase();const party=P100.playerPartyLabel.toUpperCase();return[`PRESIDENT-ELECT ${last} PREPARES FOR TRANSITION · ${party} WINS ${P100.finalEV} ELECTORAL VOTES`,`SENATE ${P100.senate.dem}D–${P100.senate.rep}R · HOUSE ${P100.house.dem}D–${P100.house.rep}R`,P100.unifiedGov?`${party} CONTROLS BOTH CHAMBERS`:P100.dividedGov?`DIVIDED CONGRESS — ${last} FACES LEGISLATIVE BATTLE`:`MIXED CONGRESS — BIPARTISAN COALITIONS REQUIRED`,`MARKETS REACT TO INCOMING ${party} ADMINISTRATION`];}
function _updateTicker(){const inner=document.getElementById('p100-ticker-inner');if(inner&&P100.tickerItems.length)inner.textContent=P100.tickerItems.join('  ·  ');}
function _renderTicker(){const t=document.getElementById('p100-news-ticker');const i=document.getElementById('p100-ticker-inner');if(!t||!i)return;i.textContent=P100.tickerItems.join('  ·  ');t.style.display='flex';}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — ENTRY HOOKS
// ══════════════════════════════════════════════════════════════════════════════
function injectBreakdownButton(won){
  if(!won||!window.isElectron||document.getElementById('bk-presidency-btn'))return;
  const cta=document.querySelector('#breakdown-screen .bk-cta');if(!cta)return;
  const btn=document.createElement('button');btn.id='bk-presidency-btn';btn.className='bk-btn primary';
  btn.style.cssText='background:linear-gradient(135deg,#b8962e,#c8a84b);color:#060810;font-weight:900;letter-spacing:.05em;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;width:100%';
  btn.innerHTML='🏛 BEGIN YOUR FIRST 100 DAYS &nbsp;→';btn.onclick=initFirst100Days;
  const sub=document.createElement('div');sub.style.cssText='font-family:"IBM Plex Mono",monospace;font-size:9px;color:rgba(200,168,75,.6);text-align:center;letter-spacing:.08em;margin-top:4px';
  sub.textContent='Type your responses as President — AI evaluates every decision';
  cta.appendChild(btn);cta.appendChild(sub);
}
(function(){function _try(){if(typeof showBreakdownScreen!=='undefined'){const _o=showBreakdownScreen;window.showBreakdownScreen=function(won,pEV,oEV){_o(won,pEV,oEV);if(won)setTimeout(()=>injectBreakdownButton(won),300);};}else setTimeout(_try,100);}document.readyState==='loading'?document.addEventListener('DOMContentLoaded',_try):_try();})();

window.initFirst100Days=initFirst100Days;
window.P100_STATE=()=>P100;
