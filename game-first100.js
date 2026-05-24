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
      advisorVoice:'chief_of_staff', advisorLine:'They have the votes. But giving in sets a precedent for every confirmation to come. What is the call?' },
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
      brief:'The Senate Minority Leader has privately requested an Oval Office meeting — no cameras, no staff, just the two of you. Intelligence says they are considering crossover support on two of your agenda priorities. But they will want something significant in return.',
      advisorVoice:'vp', advisorLine:'They would not ask for this meeting unless they wanted to deal. What are you willing to give?' },
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
      brief:'The ranking member of the Infrastructure Committee reached out privately. They will bring five crossover votes for your $1.2 trillion package if you drop the clean energy provision and publicly credit the bipartisan effort. Your base will call it a betrayal. But the deal closes today or it dies.',
      advisorVoice:'chief_of_staff', advisorLine:'They have the votes. But this is a real concession. What do you want to do?' },
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

  // Role-specific bio pools: [safe bios array, controversial bios array]
  const ROLE_BIOS={
    'Secretary of State':{
      safe:[
        `Career diplomat with 30 years at the State Department and four ambassadorships. Widely respected on both sides of the aisle. The Senate Foreign Relations Committee chair personally called to endorse this pick.`,
        `Former Deputy National Security Advisor who negotiated two landmark trade agreements. Known for quiet effectiveness — Senate allies describe them as "impossible to oppose in public."`,
        `Retired four-star general turned diplomat. Ran the NATO liaison office for six years and is personally known to 22 allied heads of state. A rare safe pick in a polarized town.`,
      ],
      controversial:[
        `Brilliant but polarising former UN Ambassador who clashed publicly with three allied governments. Hawkish on China and Russia. Will confirm on party-line vote — then shape foreign policy like few predecessors.`,
        `Academic turned ideologue who advised the campaign on an "America First" diplomatic reset. Progressive critics call the pick "reckless." Conservatives in your party quietly love it.`,
        `Billionaire tech CEO with zero diplomatic experience but massive campaign donor history. Opposition will call it a scandal. Allies privately admit the intelligence and drive are real.`,
      ]
    },
    'Secretary of the Treasury':{
      safe:[
        `Former Federal Reserve Vice Chair with a doctorate in macroeconomics and 20 years of bipartisan credibility. Wall Street immediately calmed after rumours of the pick leaked.`,
        `Two-term state governor who turned a $4B deficit into a surplus without raising income taxes. Moderate record will attract crossover Senate votes.`,
        `Career investment banker who served as Treasury Under-Secretary under both parties. Bland but unimpeachable. Markets will rally on the announcement.`,
      ],
      controversial:[
        `Heterodox economist and vocal critic of the Fed who has called for restructuring the central bank. Wall Street is furious. The base is electrified. Markets have already dropped 0.6%.`,
        `Crypto entrepreneur worth $12B who has argued for abolishing capital gains tax entirely. Fiscal hawks love it. Progressive caucus is threatening a floor fight.`,
        `Former hedge fund manager with a settled SEC inquiry on their record. The inquiry was dropped, but opposition research has already reached the press. A confirmation battle is guaranteed.`,
      ]
    },
    'Secretary of Defense':{
      safe:[
        `Retired four-star general who commanded US forces in Europe and co-authored the Pentagon's last major modernisation review. Joint Chiefs requested this pick directly.`,
        `Former Deputy Defense Secretary with 15 years running procurement and acquisitions. Not glamorous, but the military establishment will confirm quietly and efficiently.`,
        `Two-tour combat veteran and former Armed Services Committee chair. Respected across the entire Senate. This pick signals continuity and seriousness to allies.`,
      ],
      controversial:[
        `Civilian defence contractor CEO who wants to cut $200B from legacy weapons programmes and go all-in on autonomous systems. The Pentagon brass is openly alarmed. Silicon Valley is celebrating.`,
        `Former National Security Advisor who advocated pre-emptive strikes in three separate classified memos. Allies are nervous. Your hawkish base is calling it a masterstroke.`,
        `Decorated combat general with a documented history of insubordination toward civilian leadership. The last SecDef fired them. They are, by every account, the sharpest strategic mind in a generation.`,
      ]
    },
    'Attorney General':{
      safe:[
        `Former federal appeals judge with a universally praised record on civil liberties and law enforcement. The American Bar Association rated them "exceptionally well qualified."`,
        `State Attorney General who won re-election three times in a swing state. Prosecutorial record is clean, bipartisan, and boring — in exactly the right way.`,
        `DOJ veteran with 28 years of experience across six administrations. Low profile, deep relationships, zero ethics concerns. Senate Judiciary Committee chair privately blessed the pick.`,
      ],
      controversial:[
        `Firebrand prosecutor who ran on investigating the previous administration and has made no secret of the agenda. Opponents call it weaponising justice. The base calls it accountability.`,
        `Corporate defence lawyer who represented three Fortune 500 companies in antitrust cases the DOJ brought. Opponents say it's a conflict of interest. Allies say it signals pro-business reform.`,
        `Civil rights attorney who has sued local police departments in 14 states. Law enforcement unions are mobilising against the nomination. Progressive groups have donated $8M to the confirmation campaign.`,
      ]
    },
    'Sec. Health & Human Services':{
      safe:[
        `Former state health secretary who managed a Medicaid expansion for 3.2 million people with bipartisan support. A technocrat with genuine public health credentials and no political baggage.`,
        `Paediatrician and former hospital system CEO who worked across party lines on the opioid crisis. Personally popular in the Senate — three Republicans have already publicly endorsed.`,
        `Public health professor who ran the CDC's emergency response division during the last pandemic. Quiet competence in a role that demands it.`,
      ],
      controversial:[
        `Outspoken critic of pharmaceutical pricing who has promised price controls by executive order within 60 days. PhRMA has already launched a $30M opposition campaign.`,
        `Anti-vaccine-sceptic figure with a history of questioning several standard immunisation schedules. Public health community is alarmed. A segment of your base views them as a hero.`,
        `Tech entrepreneur proposing to "disrupt" Medicaid with a blockchain-based benefits system. Experts are divided between genuine innovation and dangerous experiment.`,
      ]
    },
    'Chief of Staff':{
      safe:[
        `Veteran campaign manager who has run three winning presidential campaigns and is feared and respected in equal measure throughout Washington. The West Wing will run like a machine.`,
        `Former Senate Majority Whip who knows every vote, every favour, and every fault line on Capitol Hill. Boring choice. Brilliant choice.`,
        `Deputy Chief of Staff in the last administration of your party with deep relationships across the Cabinet and press corps. A stabilising force from day one.`,
      ],
      controversial:[
        `Ideological firebrand from the campaign's inner circle with zero government experience. Loyal, brilliant, and has already made three enemies in the transition. The press will call it chaos.`,
        `Billionaire donor and close personal friend with no prior government role. The Senate has no confirmation vote — this is entirely yours to own.`,
        `Former talk-show host turned political operative who engineered three surprise congressional victories. The establishment is horrified. Your media strategy will be unlike anything Washington has seen.`,
      ]
    },
    'CIA Director':{
      safe:[
        `Career intelligence officer who rose to Deputy Director over 27 years. The Intelligence Community requested this pick. Senate Intelligence Committee will confirm with minimal friction.`,
        `Former NSA Director with a strong record on cybersecurity and a reputation for protecting sources above political pressure. Allies abroad are relieved.`,
        `Retired three-star general and former DIA chief. Not the most imaginative pick — but in intelligence, boring and competent saves lives.`,
      ],
      controversial:[
        `Tech billionaire with access to the world's most powerful private intelligence infrastructure. The intelligence community is deeply alarmed. The argument for: unprecedented resources and reach.`,
        `Former Congressman who publicly called for "radical restructuring" of CIA field operations and has been outspoken about surveillance overreach. Will face a brutal confirmation.`,
        `Academic who has published research critical of CIA covert operations in three allied nations. The agency's career staff are already briefing against the nomination off the record.`,
      ]
    },
    'Sec. Homeland Security':{
      safe:[
        `Former FEMA director who managed two Category 5 hurricane responses and earned rare bipartisan praise. Operational credibility from day one.`,
        `Two-term border state governor who built a bipartisan record on immigration enforcement and disaster response. Senate colleagues trust and respect the track record.`,
        `Former CBP Commissioner who reduced border incidents by 30% while working within a bipartisan framework. Pragmatic and processional — exactly what DHS needs.`,
      ],
      controversial:[
        `Hard-liner who has called for the largest deportation operation in US history and says the current border is "an invasion." Opponents are already fundraising against. Your base is energised.`,
        `Tech entrepreneur proposing to privatise TSA and automate 60% of border monitoring. Civil liberties groups are mobilising. Libertarian wing of your party is enthusiastic.`,
        `Former ICE director who was fired by the previous administration for exceeding their mandate. Opponents call them dangerous. Allies call the firing political and the record exemplary.`,
      ]
    },
  };

  const cabinet = CABINET_ROLES.map(r=>{
    const pSen=pIsDem?senateDem:senateRep;
    const bioPool=ROLE_BIOS[r.role]||{safe:[`Former senior official with deep policy expertise and bipartisan credibility.`],controversial:[`High-profile pick with strong views that will trigger a Senate battle.`]};
    const makeCand=(controversial)=>{
      const senFor=controversial?Math.min(57,Math.max(44,pSen+Math.floor(Math.random()*8)-4)):Math.min(88,Math.max(62,pSen+Math.floor(Math.random()*18)));
      const pool=controversial?bioPool.controversial:bioPool.safe;
      const bio=pool[Math.floor(Math.random()*pool.length)];
      return{name:genName(),bio,controversial,senateFor:senFor,senateAgainst:100-senFor};
    };
    // Always two candidates: one safe, one higher-risk
    const candA=makeCand(false);
    const candB=makeCand(Math.random()<0.6);
    return{...r,candidates:[candA,candB],confirmed:false,resolved:false,chosenCandidate:null};
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

  // Capture campaign backstory for personalised AI prompts
  const _bs = GS?.backstory || {};
  const careerLabels100 = {senator:'U.S. Senator',house:'House Rep.',governor:'Governor',mayor:'Mayor',
    military:'General',prosecutor:'Prosecutor',business:'Business Leader',academic:'Academic',
    activist:'Activist',diplomat:'Diplomat',celebrity:'Celebrity',outsider:'Outsider'};
  const playerCareerLabel = careerLabels100[_bs.career||'senator'] || 'Senator';
  const playerIdeologyDesc = _bs.ideologyDesc || (_bs.ideology>65?'progressive':_bs.ideology<35?'conservative':'moderate');
  const playerSlogan = _bs.slogan || '';
  const playerMoment = _bs.momentText || 'a record of public service';
  const campaignPolicies = (GS?.newsItems||[]).filter(n=>n.tag==='campaign').slice(-3).map(n=>n.hl).join('; ') || '';

  P100={
    playerName:name, lastName, playerPartyLabel:party, playerParty:GS?.playerParty??'dem',
    finalEV:ev, mandate:evLine,
    // Campaign backstory fields — used by AI prompts for personalisation
    career: playerCareerLabel,
    ideology: playerIdeologyDesc,
    slogan: playerSlogan,
    campaignMoment: playerMoment,
    senate:{dem:senateDem,rep:senateRep}, house:{dem:houseDem,rep:houseRep},
    playerSenate:pIsDem?senateDem:senateRep, playerHouse:pIsDem?houseDem:houseRep,
    hasSenate:(pIsDem?senateDem:senateRep)>=(pIsDem?50:51), hasHouse:(pIsDem?houseDem:houseRep)>=218,
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
          <div style="font-size:10px;color:${P100.hasSenate?'#22c55e':'#ef4444'};margin-top:2px">${P100.senate.dem===50&&P100.senate.rep===50&&P100.playerParty==='dem'?'MAJORITY (VP TIEBREAK)':P100.hasSenate?'MAJORITY':'MINORITY'}</div>
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
  // Always start the first event immediately
  setTimeout(_scheduleNextEvent, 400);
  // Show tutorial overlay on top (non-blocking — game runs underneath)
  if(!sessionStorage.getItem('p100TutShown')){
    setTimeout(()=>window.p100ShowTutorial(false), 800);
    sessionStorage.setItem('p100TutShown','1');
  }
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
  // Semi-circle arc: 100 seats arranged in 5 arcs radiating outward
  const dem=P100.senate.dem, rep=P100.senate.rep;
  const playerIsDem=P100.playerParty==='dem';
  const W=360, H=185, cx=W/2, cy=H-10;
  const rowCounts=[16,18,20,22,24];
  const rStart=44, rStep=16;
  let seats=[];
  for(let row=0;row<5;row++){
    const n=rowCounts[row];
    const r=rStart+row*rStep;
    for(let i=0;i<n;i++){
      const angle=Math.PI-(i/(n-1))*Math.PI;
      seats.push({x:cx+r*Math.cos(angle),y:cy-r*Math.sin(angle)});
    }
  }
  seats.sort((a,b)=>a.x-b.x);
  let svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:380px;height:auto;display:block;margin:0 auto">`;
  svg+=`<line x1="${cx}" y1="4" x2="${cx}" y2="${cy-11}" stroke="#c8a84b" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>`;
  seats.forEach((s,i)=>{
    const isDem=i<dem;
    const fill=isDem?'#3b82f6':'#ef4444';
    const isPlayer=(isDem&&playerIsDem)||(!isDem&&!playerIsDem);
    svg+=`<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="4.0" fill="${fill}" opacity="${isPlayer?'1':'0.45'}"/>`;
  });
  svg+=`<text x="${cx}" y="${H-2}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" fill="#c8a84b" opacity="0.7">50 — MAJORITY</text>`;
  svg+=`</svg>`;
  return svg;
}

function _renderSenateSummaryInline(){
  const dem=P100.senate.dem, rep=P100.senate.rep;
  const playerIsDem=P100.playerParty==='dem';
  const playerSeats=playerIsDem?dem:rep;
  const hasMaj=playerSeats>=(playerIsDem?50:51), hasSuperMaj=playerSeats>=60;
  const vpTie=dem===50&&rep===50&&playerIsDem;
  const majColor=hasSuperMaj?'#22c55e':hasMaj?'#c8a84b':'#ef4444';
  const majLabel=hasSuperMaj?'SUPERMAJORITY':vpTie?'MAJORITY (VP TIEBREAK)':hasMaj?'MAJORITY':'MINORITY';
  return `<div style="margin-top:14px;padding:14px 16px;background:#0a0c10;border:1px solid #1e2535;border-radius:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.12em">U.S. SENATE</span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:${majColor};letter-spacing:.08em;padding:1px 6px;border:1px solid ${majColor}44;border-radius:3px">${majLabel}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#3b82f6">${dem}<span style="font-size:9px;color:#4a5568;font-weight:400"> DEM</span></span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;color:#ef4444">${rep}<span style="font-size:9px;color:#4a5568;font-weight:400"> REP</span></span>
    </div>
        <div style="margin-top:4px">${_renderSenateCircles()}</div>
    <div style="display:flex;gap:12px;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568">
      <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#3b82f6;margin-right:3px;vertical-align:middle"></span>Democrat</span>
      <span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#ef4444;margin-right:3px;vertical-align:middle"></span>Republican</span>
      <span style="margin-left:auto">51 = majority · 60 = filibuster-proof</span>
    </div>
  </div>`;
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
          <span class="p100-suggestions-label" style="color:#c8a84b">🤖 AI STARTING POINTS</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.05em;display:flex;align-items:center;gap:5px" id="p100-ai-sug-loading"><span style="width:10px;height:10px;border:1.5px solid #2a3348;border-top-color:#c8a84b;border-radius:50%;animation:spin 1s linear infinite;display:inline-block;flex-shrink:0"></span>Generating options…</span>
        </div>
        <button id="p100-submit-btn" class="p100-submit-btn" onclick="p100SubmitResponse()" disabled style="opacity:.4;cursor:not-allowed">
          DELIVER YOUR RESPONSE <span style="opacity:.6;font-size:11px;margin-left:8px">Ctrl+Enter</span>
        </button>
      </div>
    </div>
    ${_renderSenateSummaryInline()}`;

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

async function _fetchAISuggestions(sit, phase, adv){
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
  if(P100._aiEvaluating)return; // guard against double-submit while AI is working
  P100._aiEvaluating=true;
  // Show spinner — for milestone cards without p100-response-area, show in the step2 area or event-area
  const respArea=document.getElementById('p100-response-area')
    || document.getElementById('p100-joint-step2')
    || document.getElementById('p100-event-area');
  if(respArea){respArea.innerHTML=`<div class="p100-evaluating-block"><div class="p100-eval-spinner"></div><div class="p100-eval-label">Evaluating your decision…</div><div class="p100-eval-quote">"${response.length>120?response.slice(0,120)+'…':response}"</div></div>`;}
  // Emergency escape: if spinner is still showing after 30s (AI hung), force procedural result
  const _spinnerEscapeTimer=setTimeout(()=>{
    if(P100._aiEvaluating){
      console.warn('[P100] Evaluation timeout — forcing procedural result');
      P100._aiEvaluating=false;
      (window._applyEvaluationResult||_applyEvaluationResult)(_proceduralEvaluate(response,P100._currentSituation||{headline:''},_currentPhase()),response);
    }
  },30000);
  {const sit_ctx=P100._currentSituation;const ctx=sit_ctx?`${sit_ctx.headline}. President ${P100.playerName} responded: "${response.slice(0,100)}"`:response;_generateXFeedPosts(ctx);}

  const sit=P100._currentSituation;
  const phase=_currentPhase();
  const weakest=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ');
  const govCtx=P100.unifiedGov?'unified government':P100.dividedGov?'divided government':'split Congress';
  const actorCtx=WORLD_ACTORS.map(a=>`${a.label}:${P100.actors[a.id]}`).join(', ');

  const prompt=`You are a senior political analyst evaluating a presidential decision in a political simulation.

PRESIDENT: ${P100.playerName} (${P100.playerPartyLabel}) — former ${P100.career||"Senator"} (now President — address as President only), ${P100.ideology||"moderate"}
CAMPAIGN: ${P100.slogan?"Slogan: \""+P100.slogan+"\"":""} ${P100.campaignMoment?"| Background: "+P100.campaignMoment:""}
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

  // Helper: race AI call against a 25s timeout to prevent permanent hang
  const _withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);

  try{
    if(window.isElectron&&window.localAI){
      try{
        // Use getAdvice (lighter channel) instead of respond to avoid OOM on large KV cache allocation
        const advText=await _withTimeout(window.localAI.getAdvice(prompt),25000);
        if(advText){
          const parsed=_parseJSONFromText(advText);
          if(parsed?.outcome&&parsed?.effects)result=parsed;
        }
      }catch(_){}
    }
    if(!result)result=_proceduralEvaluate(response,sit,phase);
  }finally{
    clearTimeout(_spinnerEscapeTimer);
    P100._aiEvaluating=false;
    (window._applyEvaluationResult||_applyEvaluationResult)(result||_proceduralEvaluate(response,sit,phase),response);
  }
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
  // Normalise effect keys that may have been mangled by the AI spacing fixer
  // e.g. "foreign Policy" -> "foreignPolicy", "nation Security" -> "nationSecurity"
  if(result.effects){
    const keyMap={'foreign policy':'foreignPolicy','nation security':'nationSecurity','media relations':'mediaRelations','foreign Policy':'foreignPolicy','nation Security':'nationSecurity','media Relations':'mediaRelations'};
    const fixedEffects={};
    for(const[k,v]of Object.entries(result.effects)){fixedEffects[keyMap[k]||k]=v;}
    result.effects=fixedEffects;
  }
  if(result.actorShifts){
    const fixedShifts={};
    for(const[k,v]of Object.entries(result.actorShifts)){fixedShifts[k.replace(/ /g,'_').replace(/([a-z]) ([A-Z])/g,(m,a,b)=>a+b.toLowerCase())]=v;}
    result.actorShifts=fixedShifts;
  }
  const gradeColor={A:'#22c55e',B:'#c8a84b',C:'#f59e0b',D:'#ef4444',F:'#7c3aed'}[result.grade||'C'];
  const appColor=(result.approvalDelta||0)>=0?'#22c55e':'#ef4444';
  const nextDay=Math.min(P100.day+_daysPerEvent(),100);
  // Some milestone cards (e.g. joint session) don't have p100-response-area —
  // fall back to replacing the whole event-area content
  let respArea=document.getElementById('p100-response-area');
  if(!respArea){
    const eventArea=document.getElementById('p100-event-area');
    if(eventArea){
      const fallback=document.createElement('div');
      fallback.id='p100-response-area';
      eventArea.innerHTML='';
      eventArea.appendChild(fallback);
      respArea=fallback;
    }
  }
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
        <button class="p100-next-btn" id="p100-continue-btn" onclick="p100ShowEndDay()">${P100.day>=97?'View Your Legacy →':'End Day →'}</button>
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
  const chosen=P100.cabinetMembers.filter(m=>m.resolved).length;
  const total=P100.cabinetMembers.length;
  const [cA,cB]=member.candidates;
  const riskLabel=(c)=>c.controversial
    ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#ef4444;letter-spacing:.08em">⚠ HIGH RISK · HIGH REWARD</span>`
    : `<span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#22c55e;letter-spacing:.08em">✓ SAFE PICK · SMOOTH CONFIRMATION</span>`;
  const voteBar=(c)=>{
    const col=c.senateFor>=60?'#22c55e':c.senateFor>=51?'#c8a84b':'#ef4444';
    return`<div style="margin-top:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">SENATE VOTE PROJECTION</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${col};font-weight:700">${c.senateFor}–${c.senateAgainst}</span>
      </div>
      <div style="height:4px;background:#1e2535;border-radius:2px;overflow:hidden">
        <div style="width:${c.senateFor}%;height:100%;background:${col};border-radius:2px"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:3px">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2a3348">0</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b">51 ← majority</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2a3348">100</span>
      </div>
    </div>`;
  };
  el.innerHTML=`
    <div class="p100-event-card" id="p100-active-card" style="border-left:3px solid #c8a84b">
      <div class="p100-event-header">
        <div class="p100-event-phase-tag" style="color:#c8a84b">🏛 CABINET SELECTION (${chosen}/${total} chosen)</div>
        <div class="p100-event-day-tag">DAY ${P100.day}</div>
      </div>
      <div class="p100-event-headline">${member.icon} Appoint Your ${member.role}</div>
      <div class="p100-event-situation">Your transition team has vetted two candidates. Read their backgrounds carefully — Senate vote projections reflect current political dynamics and your party's seat count.</div>
      <div class="p100-event-choices" id="p100-choices" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">
        <button class="p100-choice-btn" data-cab-idx="${idx}" data-cab-cand="0" onclick="p100CabinetPickHandler(this)" style="flex-direction:column;align-items:flex-start;gap:6px;padding:16px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b;letter-spacing:.14em;margin-bottom:4px">── CANDIDATE A ──</div>
          <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#e8ecf4;line-height:1.2">${cA.name}</div>
          <div style="font-size:12px;color:#8a93a8;line-height:1.65;flex:1;margin:8px 0">${cA.bio}</div>
          ${voteBar(cA)}
          <div style="margin-top:8px">${riskLabel(cA)}</div>
        </button>
        <button class="p100-choice-btn" data-cab-idx="${idx}" data-cab-cand="1" onclick="p100CabinetPickHandler(this)" style="flex-direction:column;align-items:flex-start;gap:6px;padding:16px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b;letter-spacing:.14em;margin-bottom:4px">── CANDIDATE B ──</div>
          <div style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#e8ecf4;line-height:1.2">${cB.name}</div>
          <div style="font-size:12px;color:#8a93a8;line-height:1.65;flex:1;margin:8px 0">${cB.bio}</div>
          ${voteBar(cB)}
          <div style="margin-top:8px">${riskLabel(cB)}</div>
        </button>
      </div>
    </div>
    ${_renderSenateSummaryInline()}`;
}

window.p100CabinetPickHandler=function(btn){
  p100CabinetPick(parseInt(btn.dataset.cabIdx,10),parseInt(btn.dataset.cabCand,10));
};

window.p100CabinetPick=function(idx,candIdx){
  const m=P100.cabinetMembers[idx];if(!m||m.resolved)return;
  const cand=m.candidates[candIdx];
  m.resolved=true;
  m.name=cand.name; m.bio=cand.bio;
  m.controversial=cand.controversial;
  m.senateFor=cand.senateFor; m.senateAgainst=cand.senateAgainst;
  let passes;
  if(cand.senateFor>=55){passes=true;}
  else if(cand.senateFor>=51){passes=Math.random()<0.82;}
  else{passes=Math.random()<0.15;}
  m.confirmed=passes;
  let headline,outcome,effects={},approvalDelta=0;
  if(passes){
    if(m.stat)P100.stats[m.stat]=Math.min(95,P100.stats[m.stat]+(cand.controversial?4:6));
    headline=`✅ ${cand.name} Confirmed as ${m.role}`;
    outcome=`Senate votes ${cand.senateFor}–${cand.senateAgainst}. ${cand.name} is sworn in immediately. ${cand.controversial?'The bold pick pays off.':'A smooth confirmation strengthens the administration.'}`;
    approvalDelta=cand.controversial?1:2;
    _adjustActors({gop_senate:cand.controversial?-2:2,dem_senate:cand.controversial?-1:3});
  }else{
    headline=`❌ ${cand.name} Rejected — ${m.role} Seat Vacant`;
    outcome=`The Senate votes against. An acting secretary will cover the role until a new nominee is confirmed.`;
    effects={mediaRelations:-4};approvalDelta=-3;
    _adjustActors({press_corps:-4,gop_senate:-3});
  }
  _applyEffects(effects,approvalDelta);
  const remaining=P100.cabinetMembers.filter(m2=>!m2.resolved);
  const choicesEl=document.getElementById('p100-choices');if(!choicesEl)return;
  const nextLabel=remaining.length>0?`Next: ${remaining[0].role} →`:'Complete Cabinet →';
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
          <span class="p100-char-count" id="p100-joint-speech-count">0 / 5000</span>
        </div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5568;margin-bottom:8px;letter-spacing:.05em">
          Your local AI drafted this from your topics. Edit freely before delivering to Congress.
        </div>
        <textarea id="p100-joint-speech" class="p100-response-textarea" maxlength="5000"
          style="min-height:200px"
          placeholder="Your address will appear here..."
          oninput="(function(l){const c=document.getElementById('p100-joint-speech-count');if(c)c.textContent=l+' / 5000';const b=document.getElementById('p100-joint-deliver-btn');if(b){b.disabled=l<40;b.style.opacity=l>=40?'1':'.4';b.style.cursor=l>=40?'pointer':'not-allowed';}})(this.value.length)"></textarea>
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
  const c=document.getElementById('p100-joint-speech-count');if(c)c.textContent=l+' / 5000';
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
    {key:'cabinet',day:1},
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
  if(window._p100_scheduleNext_withFollowup&&window._p100_scheduleNext_withFollowup!==_scheduleNextEvent){return window._p100_scheduleNext_withFollowup();}
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
  P100._eventCount=(P100._eventCount||0)+1;
  P100._pendingAI=true;_renderBriefingPlaceholder();
  const phase=_currentPhase();
  let situation=null;
  if(P100._aiFailCount<6)situation=await _fetchAISituation(phase);
  P100._pendingAI=false;
  if(situation){P100._aiFailCount=0;}else{P100._aiFailCount=(P100._aiFailCount||0)+1;situation=await _pickFallbackSituationWithMemory(phase.id);}
  P100._isMilestone=null;P100._currentSituation=situation;_renderBriefing();
}

async function _pickFallbackSituation(phaseId){
  const pool=SITUATION_POOL[phaseId]||SITUATION_POOL.first_acts;
  const used=P100._usedByPhase[phaseId]||[];
  let av=pool.filter(s=>!used.includes(s.id));
  // Once curated items are exhausted, switch to procedural briefings to avoid repetition.
  if(!av.length){
    P100._usedByPhase[phaseId]=[];
    return await _buildProceduralSituation(phaseId);
  }
  // Also inject some procedural variety during long runs.
  if(Math.random()<0.35)return await _buildProceduralSituation(phaseId);
  const pick=av[Math.floor(Math.random()*av.length)];
  (P100._usedByPhase[phaseId]=P100._usedByPhase[phaseId]||[]).push(pick.id);
  return JSON.parse(JSON.stringify(pick));
}


// Domain tags for every curated event — used by the rotation wheel
const EVENT_DOMAINS = {
  t1:'economy', t2:'foreign_policy', t3:'intelligence', t4:'media',
  t5:'congress', t6:'media', f1:'executive', f2:'foreign_policy',
  f3:'media', f4:'congress', f5:'military', f6:'economy',
  l1:'congress', l2:'budget', l3:'healthcare', l4:'infrastructure',
  l5:'economy', c1:'disaster', c2:'cybersecurity', c3:'military',
  c4:'intelligence', c5:'economy', c6:'security',
  lg1:'judiciary', lg2:'foreign_policy', lg3:'congress', lg4:'media',
};
// Full rotation wheel — every domain the AI can generate
const DOMAIN_WHEEL = [
  'economy','foreign_policy','congress','military','intelligence',
  'judiciary','disaster','cybersecurity','healthcare','budget',
  'infrastructure','media','security','party_politics','executive',
];
// Returns the domain the AI should generate next (least recently used, excluding continuations)
function _pickNextDomain(){
  if(!P100._domainHistory) P100._domainHistory=[];
  const recent=P100._domainHistory.slice(-6);
  // find first domain not in recent history
  const next=DOMAIN_WHEEL.find(d=>!recent.includes(d));
  return next||DOMAIN_WHEEL[Math.floor(Math.random()*DOMAIN_WHEEL.length)];
}
// Record a domain as used (call whenever any event fires)
function _recordDomain(domain){
  if(!domain)return;
  if(!P100._domainHistory) P100._domainHistory=[];
  P100._domainHistory.push(domain);
  if(P100._domainHistory.length>20) P100._domainHistory.shift();
}
// Infer domain from a headline string (fallback for AI-generated events)
function _inferDomain(headline){
  if(!headline)return null;
  const h=headline.toLowerCase();
  if(/nato|alliance|summit|diplomat|foreign|war|treaty|adversar|nuclear|missile|korea|china|russia|ukraine/.test(h)) return 'foreign_policy';
  if(/militar|troops|pentagon|general|defense|strike|attack|weapon|army|navy|air force|deploy/.test(h)) return 'military';
  if(/congress|senate|house|bill|vote|legislat|filibuster|caucus|speaker|majority|minority|senator|representative/.test(h)) return 'congress';
  if(/economy|market|dow|recession|jobs|gdp|inflation|trade|tariff|budget|debt|deficit|wall street|federal reserve/.test(h)) return 'economy';
  if(/health|hospital|medicare|medicaid|drug|pharma|pandemic|disease|vaccine|cdc/.test(h)) return 'healthcare';
  if(/intel|cia|nsa|fbi|classified|leak|spy|surveil|threat|brief/.test(h)) return 'intelligence';
  if(/court|justice|judge|supreme|constitutional|ruling|legal/.test(h)) return 'judiciary';
  if(/cyber|hack|breach|infra|grid|digital|ransomware/.test(h)) return 'cybersecurity';
  if(/hurricane|earthquake|flood|disaster|fema|emergency|storm/.test(h)) return 'disaster';
  if(/terror|domestic|extremi|plot|security|homeland|agent/.test(h)) return 'security';
  if(/press|media|scandal|leak|coverage|network|reporter|briefing room/.test(h)) return 'media';
  if(/infrastructure|highway|bridge|transit|broadband|energy grid/.test(h)) return 'infrastructure';
  if(/party|base|primary|caucus|coalition|poll|approval|fundrais/.test(h)) return 'party_politics';
  if(/executive order|veto|pardon|cabinet|nomination|appoint/.test(h)) return 'executive';
  if(/shutdown|appropriat|spending|tax|revenue|fiscal/.test(h)) return 'budget';
  return null;
}

async function _buildProceduralSituation(phaseId){
  const weak=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const topActor=[...WORLD_ACTORS].sort((a,b)=>(P100.actors[a.id]||0)-(P100.actors[b.id]||0))[0];
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean);
  const phaseLabel={transition:'Transition',first_acts:'First Acts',legislation:'Legislation',crisis:'Crisis',legacy:'Legacy'}[phaseId]||'Briefing';
  const voices=['chief_of_staff','press_sec','nsc_advisor','econ_advisor','vp'];
  const advisorVoice=voices[Math.floor(Math.random()*voices.length)];
  const adv=ADVISOR_BIOS[advisorVoice];

  // Try local AI to generate a unique event
  if(window.isElectron&&window.localAI){
    const procLogH=P100.decisionLog.slice(-8).map(d=>d.headline).filter(Boolean);
    const procAiH=(P100._aiGeneratedHeadlines||[]).slice(-8);
    const procRecent=[...new Set([...procAiH,...procLogH])].slice(-10);
    const procRecentH=procRecent.join('; ')||'none yet';
    const procBanned=[...new Set(procRecent.flatMap(h=>
      h.replace(/[^a-zA-Z ]/g,'').toLowerCase().split(' ')
       .filter(w=>w.length>4&&!['president','morgan','white','house','crisis','threat','calls','could','about','their','after','amid','tests','your','resolve','first','begin','today','makes','landfall','would','begin','leads','warns','emerges','under','press'].includes(w))
    ))].slice(0,12).join(', ');
    const procDomain=_pickNextDomain();
    const procDomainLabel=procDomain.replace(/_/g,' ');
    const procWeakestLine=weak&&_inferDomain(weak.label)===procDomain?`Weakest policy: ${weak.label}. `:'';
    const prompt=`Generate a unique US presidential crisis briefing for Day ${P100.day} of 100 (phase: ${phaseLabel}). President: ${P100.playerName}, ${P100.playerPartyLabel}. Approval: ${P100.approvalRating}%. ${procWeakestLine}Career background: ${P100.career||'Senator'}. Ideology: ${P100.ideology||'moderate'}. Hostile actor: ${topActor?.label||'an adversary'}. Recent events: ${procRecentH}.\n\nTHIS EVENT MUST BE ABOUT: ${procDomainLabel}. Write a crisis strictly in the ${procDomainLabel} domain. Do NOT mention healthcare or other policy areas unless they are directly part of a ${procDomainLabel} crisis. NEVER NATO cyber attacks.\nPRONOUN RULE: Never use he/she/his/her for the President.\nBANNED SPECIFICS (avoid these, already seen recently): ${procBanned||'none'}.\n\nRespond with ONLY a JSON object, no other text:\n{"headline":"Short dramatic headline under 10 words — must be about ${procDomainLabel}","brief":"Two to three urgent sentences about this ${procDomainLabel} crisis. Name real stakes.","advisorVoice":"${advisorVoice}","advisorLine":"One urgent question the ${adv?.title||'advisor'} asks. Under 20 words."}`;;
    try{
      const raw=await window.localAI.getEvent(prompt);
      if(raw?.headline&&raw?.brief&&raw?.advisorLine){
        raw.headline=_fixAISpacing(raw.headline);
        raw.brief=_fixAISpacing(raw.brief);
        raw.advisorLine=_fixAISpacing(raw.advisorLine);
        raw.advisorVoice=advisorVoice;
        raw.id=`proc_${phaseId}_${P100.day}_${Math.floor(Math.random()*1e6)}`;
        if(!P100._aiGeneratedHeadlines) P100._aiGeneratedHeadlines=[];
        const _normHP=h=>h.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
        if(P100._aiGeneratedHeadlines.some(h=>_normHP(h)===_normHP(raw.headline)))return null;
        P100._aiGeneratedHeadlines.push(raw.headline);
        if(P100._aiGeneratedHeadlines.length>30) P100._aiGeneratedHeadlines.shift();
        _recordDomain(_inferDomain(raw.headline));
        return raw;
      }
    }catch(_){}
    try{
      const advText=await window.localAI.getAdvice(prompt);
      if(advText){
        const parsed=_parseJSONFromText(advText);
        if(parsed?.headline&&parsed?.brief){
          parsed.headline=_fixAISpacing(parsed.headline);
          parsed.brief=_fixAISpacing(parsed.brief);
          parsed.advisorLine=_fixAISpacing(parsed.advisorLine||'What are your orders?');
          parsed.advisorVoice=advisorVoice;
          parsed.id=`proc_${phaseId}_${P100.day}_${Math.floor(Math.random()*1e6)}`;
          return parsed;
        }
      }
    }catch(_){}
  }

  // Final fallback: purely procedural (no static events, still unique)
  const topic=agenda.length?agenda[Math.floor(Math.random()*agenda.length)]:'your domestic agenda';
  const verbs=['under pressure','splitting your coalition','triggering market anxiety','drawing heavy media scrutiny','testing your congressional leverage'];
  const hooks=[
    `A senior delegation from ${topActor?.label||'Congress'} is demanding immediate clarity on ${topic}.`,
    `An overnight memo warns that inaction could further weaken your ${weak.label.toLowerCase()} standing.`,
    `Two influential allies are privately pushing opposite strategies and both expect your answer before tonight.`,
    `Cable networks are framing this as a leadership test for Day ${P100.day}.`
  ];
  const shuffled=[...hooks].sort(()=>Math.random()-.5).slice(0,3);
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

// Returns a compact player-context block for AI prompts
function _playerCtx(){
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ')||'not yet set';
  const lines=[
    `CURRENT TITLE: President of the United States — always address as "Mr./Madam President" or "the President", NEVER as Senator or by former career title`,
    `FORMER CAREER: ${P100.career||'Senator'} (background context only — they are now President)`,
    `IDEOLOGY: ${P100.ideology||'moderate'}`,
    P100.slogan?`CAMPAIGN SLOGAN: "${P100.slogan}"`:'',
    `DEFINING MOMENT: ${P100.campaignMoment||'public service'}`,
    `POLICY AGENDA: ${agenda}`,
    `MANDATE: ${P100.finalEV} electoral votes (${P100.mandate})`,
    `CONGRESS: Senate ${P100.senate.dem}D-${P100.senate.rep}R, House ${P100.house.dem}D-${P100.house.rep}R`,
    P100.filibusterProof?'NOTE: Filibuster-proof Senate majority':P100.unifiedGov?'NOTE: Unified government':'NOTE: '+( P100.dividedGov?'Divided government':'Split Congress'),
  ].filter(Boolean).join(' | ');
  return lines;
}

async function _fetchAISituation(phase){
  const weakest=[...P100_STATS].sort((a,b)=>P100.stats[a.id]-P100.stats[b.id])[0];
  const agenda=P100.selectedAgenda.map(id=>P100_AGENDA_OPTIONS.find(a=>a.id===id)?.label).filter(Boolean).join(', ');
  // Merge decisionLog headlines with AI-generated ones (AI events aren't in decisionLog until after player responds)
  const logH=P100.decisionLog.slice(-8).map(d=>d.headline).filter(Boolean);
  const aiH=(P100._aiGeneratedHeadlines||[]).slice(-8);
  const allRecent=[...new Set([...aiH,...logH])].slice(-10);
  const recentH=allRecent.join('; ')||'none yet';
  // Extract banned keyword fragments from recent headlines so the model has a concrete avoid-list
  const bannedTopics=[...new Set(allRecent.flatMap(h=>
    h.replace(/[^a-zA-Z ]/g,'').toLowerCase().split(' ')
     .filter(w=>w.length>4&&!['president','morgan','white','house','crisis','threat','calls','could','about','their','after','amid','tests','your','resolve','first','begin','today','makes','landfall','would','begin','leads','warns','emerges','under','press'].includes(w))
  ))].slice(0,12).join(', ');
  const advisors=['chief_of_staff','press_sec','nsc_advisor','econ_advisor','vp'];
  const advisor=advisors[Math.floor(Math.random()*advisors.length)];
  const adv=ADVISOR_BIOS[advisor];

  // Personalised prompt — incorporates player backstory so events feel earned
  const domain=_pickNextDomain();
  const domainLabel=domain.replace(/_/g,' ');
  // Only include agenda/weakest when they're relevant to this domain — prevents small model anchoring on e.g. "Healthcare Reform" for every event
  const agendaForDomain=P100_AGENDA_OPTIONS.filter(a=>P100.selectedAgenda.includes(a.id)&&_inferDomain(a.label)===domain||a.stat===domain.replace('_policy','Policy').replace(/_([a-z])/g,(_,c)=>c.toUpperCase())).map(a=>a.label).join(', ');
  const weakestLine=weakest&&_inferDomain(weakest.label)===domain?`Weakest policy: ${weakest.label}. `:'';
  const ctx=`President: ${P100.playerName}, ${P100.playerPartyLabel}. Career background: ${P100.career||'Senator'}. Ideology: ${P100.ideology||'moderate'}. Congress: Senate ${P100.senate.dem}D-${P100.senate.rep}R, House ${P100.house.dem}D-${P100.house.rep}R. ${P100.unifiedGov?'Unified government.':P100.dividedGov?'Divided government.':'Split Congress.'}${agendaForDomain?` Relevant agenda: ${agendaForDomain}.`:''}`;
  const prompt=`Create a US presidential crisis briefing for a political simulation game. Day ${P100.day} of 100. Phase: ${phase.label}. Approval: ${P100.approvalRating}%. ${weakestLine}Recent events: ${recentH}.
${ctx}

THIS EVENT MUST BE ABOUT: ${domainLabel}. Write a crisis strictly in the ${domainLabel} domain only. Do NOT mention healthcare, the agenda, or other policy areas unless they are directly part of a ${domainLabel} crisis.
PRONOUN RULE: Never use gendered pronouns (he/she/his/her) for the President.
BANNED SPECIFICS (avoid these, already seen recently): ${bannedTopics||'none'}.

Respond with ONLY a JSON object. No other text before or after. Use this exact format:
{"headline":"Short dramatic headline under 10 words — must be about ${domainLabel}","brief":"Two or three urgent sentences about this ${domainLabel} crisis. Be specific about the ${domainLabel} situation.","advisorVoice":"${advisor}","advisorLine":"One urgent question the ${adv.title} asks. Under 20 words."}`;

  // Local AI (Electron)
  if(window.isElectron&&window.localAI){
    try{
      const raw=await window.localAI.getEvent(prompt);
      if(raw?.headline&&raw?.brief&&raw?.advisorLine){
        // Track AI-generated headlines so recentH in the next call stays fresh
        // (decisionLog only gets the headline after the player submits a response)
        if(!P100._aiGeneratedHeadlines) P100._aiGeneratedHeadlines=[];
        raw.headline=_fixAISpacing(raw.headline);
        raw.brief=_fixAISpacing(raw.brief);
        raw.advisorLine=_fixAISpacing(raw.advisorLine);
        // Reject duplicate headline — return null so caller falls back to procedural
        const _normH=h=>h.toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
        if(P100._aiGeneratedHeadlines.some(h=>_normH(h)===_normH(raw.headline)))return null;
        P100._aiGeneratedHeadlines.push(raw.headline);
        if(P100._aiGeneratedHeadlines.length>30) P100._aiGeneratedHeadlines.shift();
        _recordDomain(_inferDomain(raw.headline));
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
          _recordDomain(_inferDomain(parsed.headline));
          return parsed;
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

// Shows the "End of Day" interstitial with the free-action input before the next event
window.p100ShowEndDay=function(){
  if(P100.day>=97){window.p100AdvanceDay();return;}
  const nextDay=Math.min(100,P100.day+_daysPerEvent());
  const el=document.getElementById('p100-event-area');
  if(!el)return;

  const flavours=[
    'The Oval Office is quiet. Staff have gone home. What else needs doing before tomorrow?',
    "The day's briefings are closed. The press pool has filed. Is there anything you want on the record?",
    "It's late in the West Wing. Your scheduler is already building tomorrow's briefing book.",
    'The situation room has cleared. Before the next crisis lands, is there anything you want to act on?',
    'Your chief of staff leaves a note: "Anything else before we close out the day?"',
  ];
  const flavour=flavours[P100.day%flavours.length];

  el.innerHTML=`
    <div class="p100-event-card" style="border-left:3px solid #1e2535">
      <div class="p100-event-header">
        <div class="p100-event-phase-tag" style="color:#c8a84b;opacity:.7">📅 END OF DAY ${P100.day}</div>
        <div class="p100-event-day-tag" style="color:#4a5568">NEXT: DAY ${nextDay}</div>
      </div>
      <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:900;color:#e8ecf4;margin:10px 0 6px;line-height:1.2">Day ${P100.day} — Close of Business</div>
      <div style="font-size:13px;color:#4a5568;line-height:1.7;margin-bottom:22px;font-style:italic">${flavour}</div>
      <div id="p100-free-action-area">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.18em;margin-bottom:10px">🗒 OFF-BRIEF ACTION <span style="color:#2a3348;letter-spacing:.05em;font-size:8px">— OPTIONAL</span></div>
        <div style="font-size:12px;color:#4a5568;line-height:1.6;margin-bottom:12px">Make a call. Issue a quiet order. Release a statement. Anything not on today's official schedule — it goes on the record and the press will notice.</div>
        <textarea id="p100-free-action-input"
          placeholder="e.g. Called Senator Harris to shore up support for the healthcare bill. Issued a quiet executive memo on border processing. Spoke to the Fed chair off the record about rate concerns."
          style="width:100%;box-sizing:border-box;min-height:90px;resize:vertical;background:#0a0c10;border:1px solid #1e2535;border-radius:6px;color:#e8ecf4;font-family:'IBM Plex Sans',sans-serif;font-size:13px;line-height:1.6;padding:10px 12px;outline:none;transition:border-color .2s"
          onfocus="this.style.borderColor='#c8a84b'" onblur="this.style.borderColor='#1e2535'"></textarea>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="p100-next-btn" style="flex:1;background:#0a0c10;color:#4a5568;border:1px solid #1e2535;font-size:10px" onclick="window.p100AdvanceDay()">Nothing today → Day ${nextDay}</button>
          <button class="p100-next-btn" style="flex:2" onclick="window.p100SubmitFreeAction()">File This Action →</button>
        </div>
      </div>
    </div>`;
};

window.p100SubmitFreeAction=async function(){
  const input=document.getElementById('p100-free-action-input');
  const text=input?input.value.trim():'';
  if(!text){window.p100AdvanceDay();return;}

  const nextDay=Math.min(100,P100.day+_daysPerEvent());
  const actionArea=document.getElementById('p100-free-action-area');
  if(!actionArea)return;

  // Show loading state — replace the form with a spinner card
  actionArea.innerHTML=`
    <div style="padding:20px 0;display:flex;align-items:center;gap:12px">
      <div style="width:14px;height:14px;border:2px solid #c8a84b;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;flex-shrink:0"></div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#4a5568;letter-spacing:.08em">Logging action to the presidential record…</span>
    </div>`;

  let outcome='';
  let headline='Presidential Action Logged';
  try{
    if(window.isElectron&&window.localAI&&typeof window.localAI.getAdvice==='function'){
      const ctx=_playerCtx();
      const prompt=`You are a senior White House correspondent covering the ${P100.playerPartyLabel} administration. President ${P100.playerName}, Day ${P100.day} of 100. Approval: ${P100.approvalRating}%. ${ctx}.

The president took this off-brief action today: "${text}"

Write a short news dispatch about this action — as if it just happened. Format your response as JSON:
{
  "headline": "A punchy news headline under 10 words describing what the president did",
  "dispatch": "Two to three sentences of AP-style news copy. Be specific and grounded. Describe the immediate reaction or consequence. Reference real Washington dynamics — what does this signal? Who benefits or loses? Do NOT repeat the action word for word — report its impact.",
  "tag": "one of: FOREIGN POLICY | DOMESTIC | ECONOMY | SECURITY | POLITICS | DIPLOMACY"
}
Return ONLY valid JSON, no other text.`;
      const raw=await window.localAI.getAdvice(prompt);
      const parsed=_parseJSONFromText(raw);
      if(parsed?.dispatch&&parsed.dispatch.length>20){
        outcome=_fixAISpacing(parsed.dispatch);
        if(parsed.headline) headline=_fixAISpacing(parsed.headline);
      }
    }
  }catch(e){console.warn('[p100 free action]',e);}

  if(!outcome||outcome.length<20){
    const fallbacks=[
      `The move landed quietly inside the West Wing but drew immediate notice on Capitol Hill. Senior aides described it as consistent with the president's campaign commitments — a signal that the administration intends to follow through on its promises.`,
      `The action drew measured praise from allied quarters and a sharp response from the opposition. Communications staff began preparing talking points within the hour, framing it as a demonstration of decisive executive leadership.`,
      `Reaction split largely along partisan lines. The president's base responded warmly; critics questioned the timing. The press office logged eleven follow-up requests before end of business.`,
    ];
    outcome=fallbacks[P100.day%fallbacks.length];
  }

  // Add to ticker
  P100.tickerItems.push(`PRESIDENT ${(P100.playerName||'').toUpperCase().split(' ').pop()}: "${text.slice(0,60)}${text.length>60?'…':''}"`);
  _updateTicker();

  // Render the result as a proper news dispatch card — player must click to continue
  actionArea.innerHTML=`
    <div style="border-top:1px solid #1e2535;padding-top:20px;margin-top:4px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#c8a84b;letter-spacing:.2em;margin-bottom:10px">📰 PRESS OFFICE DISPATCH</div>

      <div style="background:#060810;border:1px solid #1e2535;border-left:3px solid #c8a84b;border-radius:6px;padding:16px 18px;margin-bottom:16px">
        <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:#e8ecf4;line-height:1.3;margin-bottom:10px">${headline}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568;letter-spacing:.12em;margin-bottom:10px">
          THE WHITE HOUSE · DAY ${P100.day} OF 100 · ${P100.playerPartyLabel.toUpperCase()} ADMINISTRATION
        </div>
        <div style="font-size:13px;color:#8a93a8;line-height:1.8">${outcome}</div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #1e2535;font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a3348;font-style:italic">
          Your action: "${text.length>120?text.slice(0,120)+'…':text}"
        </div>
      </div>

      <button class="p100-next-btn" onclick="window.p100AdvanceDay()" style="width:100%">
        Start Day ${nextDay} →
      </button>
    </div>`;
};

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
// First 100 Days button is now in index.html and shown/hidden directly by showBreakdownScreen in game-night.js

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — FIRST 100 DAYS TUTORIAL
// ══════════════════════════════════════════════════════════════════════════════
const P100_TUT_STEPS = [
  { icon: '🏛', title: 'Welcome to the First 100 Days',
    body: `You've won the presidency. The next 100 days will define your legacy. Every decision shapes your approval rating, your relationships in Washington, and the country's future. This tutorial walks you through how it all works.` },
  { icon: '📋', title: 'Read Each Briefing Carefully',
    body: `Each day brings a new crisis or challenge. Read the headline, the situation brief, and your advisor's question. The briefing is tailored to your campaign background — your career, ideology, and promises will come back to haunt or reward you.` },
  { icon: '🇺🇸', title: 'Write Your Presidential Response',
    body: `Type your response in plain English — as if you're actually giving orders. The more specific and decisive you are, the better the outcome. Vague answers get mediocre grades. Bold, detailed orders get real results (and real risks).

Tip: Use Ctrl+Enter to submit quickly.` },
  { icon: '🤖', title: 'AI Starting Points',
    body: `Below the text box you'll see AI-suggested starting points. Click one to pre-fill a response — then edit it to make it your own. These are just prompts, not complete answers.` },
  { icon: '📊', title: 'Grades & Consequences',
    body: `After you respond, the AI evaluates your decision and gives you a grade (A–F). Your stats, approval rating, and relationships with Congress, NATO, Wall Street, and others all shift based on your choices. Check the right sidebar to track your performance.` },
  { icon: '📅', title: 'End of Day & Free Actions',
    body: `After seeing your grade, click "End Day →" to move forward. Before the next event starts, you'll get a chance to log a free presidential action — a call, statement, or order that happens off-brief. This is optional but can move relationships and generate press coverage.` },
  { icon: '🎯', title: 'Milestones',
    body: `At key points (Day 14, 42, 64, 72, 99…) you'll hit major milestones: picking your Cabinet, setting your agenda, pushing legislation, handling a peak crisis, and delivering your final address. These are the moments that make or break presidencies.` },
  { icon: '📈', title: 'Your Approval Rating',
    body: `Your approval rating (top-right) reflects how the country sees your presidency. It's driven by your policy stats. Keep all five stats healthy — ignoring any one area will eventually drag your approval down. A rating below 35% means a failed presidency.` },
  { icon: '🏆', title: 'Building Your Legacy',
    body: `At Day 100, your legacy is scored. Pass legislation, handle crises well, maintain strong relationships, and deliver a great final address. Your campaign background shapes how the country judges you — what you promised matters.

Good luck, Mr. President.` },
];

window.p100ShowTutorial = function() {
  if(document.getElementById('p100-tut-overlay')) return;
  let step = 0;

  function render() {
    const s = P100_TUT_STEPS[step];
    const dots = P100_TUT_STEPS.map((_,i) =>
      `<div style="width:6px;height:6px;border-radius:50%;background:${i===step?'#c8a84b':'#2a3348'};transition:background .2s"></div>`
    ).join('');
    const ov = document.getElementById('p100-tut-overlay');
    if(!ov) return;
    ov.querySelector('.p100-tut-card').innerHTML = `
      <div style="font-size:32px;margin-bottom:12px">${s.icon}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;letter-spacing:.2em;margin-bottom:10px">STEP ${step+1} OF ${P100_TUT_STEPS.length}</div>
      <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#e8ecf4;margin-bottom:14px;line-height:1.25">${s.title}</div>
      <div style="font-size:13px;color:#8a93a8;line-height:1.75;white-space:pre-line;margin-bottom:24px">${s.body}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <button onclick="document.getElementById('p100-tut-overlay').remove()" style="background:none;border:none;color:#4a5568;font-family:'IBM Plex Mono',monospace;font-size:10px;cursor:pointer;letter-spacing:.08em">Skip</button>
        <div style="display:flex;gap:6px;align-items:center">${dots}</div>
        <button id="p100-tut-next" style="background:linear-gradient(135deg,#b8962e,#c8a84b);border:none;border-radius:6px;color:#060810;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:900;letter-spacing:.08em;padding:10px 20px;cursor:pointer">
          ${step < P100_TUT_STEPS.length-1 ? 'Next →' : 'Got It →'}
        </button>
      </div>`;
    document.getElementById('p100-tut-next').onclick = function() {
      if(step < P100_TUT_STEPS.length-1){ step++; render(); }
      else { document.getElementById('p100-tut-overlay')?.remove(); }
    };
  }

  const ov = document.createElement('div');
  ov.id = 'p100-tut-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(6,8,16,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  ov.innerHTML = '<div class="p100-tut-card" style="background:#10141c;border:1px solid #2a3348;border-radius:12px;padding:32px 36px;max-width:520px;width:90%;box-shadow:0 24px 60px rgba(0,0,0,.7)"></div>';
  ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
  render();
};

// Auto-show tutorial on first visit each session
(function _p100AutoTut(){
  // We hook into initFirst100Days by patching _renderShell
  const _orig = window._p100AutoTutInstalled;
  if(_orig) return;
  window._p100AutoTutInstalled = true;
})();

window.initFirst100Days=initFirst100Days;
window._p100RenderShell=_renderShell;
window._p100StartClock=_startClock;
window._p100ScheduleNextEvent=_scheduleNextEvent;
window.P100_STATE=()=>P100;

window.p100ConfirmExitToMenu = function(){
  const msg='Return to main menu?<br><span style="font-size:11px;color:#8a93a8">Your game will be auto-saved first.</span>';
  if(typeof showConfirmDialog==='function'){
    showConfirmDialog(msg, ()=>window.p100ExitToMenu());
  } else {
    window.p100ExitToMenu();
  }
};

// Called on load — re-renders whatever event was active when the game was saved.
// Falls back to scheduling a fresh event if nothing was in progress.
window._p100RestoreEvent = function(){
  // If a milestone was active, re-render it directly
  if(P100._isMilestone){
    switch(P100._isMilestone){
      case 'cabinet_confirmations': return _renderCabinetMilestone();
      case 'agenda':                return _renderAgendaMilestone();
      case 'legislation':           return _renderLegislationMilestone();
      case 'congress_bill':         return _renderCongressBillMilestone();
      case 'state_of_union':        return _renderStateOfUnionMilestone();
      case 'crisis_peak':           return _renderCrisisMilestone();
      case 'address':               return _renderFinalAddressMilestone();
    }
  }
  // If a regular situation was active, re-render it
  if(P100._currentSituation){
    return _renderBriefing();
  }
  // Nothing was in progress — schedule a fresh event as normal
  _scheduleNextEvent();
};

window.p100ExitToMenu = function(){
  // Stop clock and pending timers before leaving
  if(P100 && P100._clockInterval){ clearInterval(P100._clockInterval); P100._clockInterval=null; }
  P100._pendingAI=false;
  P100._aiEvaluating=false;
  if(typeof autoSaveGame==='function') autoSaveGame();
  else if(typeof saveGame==='function') saveGame('auto');
  if(typeof showScreen==='function') showScreen('setup-screen');
};

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — EVENT MEMORY, RECURRING CHARACTERS & X (TWITTER) FEED
// ══════════════════════════════════════════════════════════════════════════════

// ── RECURRING CHARACTERS ─────────────────────────────────────────────────────
const RECURRING_CHARACTERS = [
  { id:'sen_malone',    name:'Senator Malone',       title:'Senate Minority Leader',    icon:'🔴', party:'opp',     personality:'shrewd dealmaker who rarely shows his hand early' },
  { id:'rep_chen',      name:'Rep. Julia Chen',      title:'House Progressive Caucus',  icon:'🔵', party:'ally',    personality:'principled idealist who punishes perceived betrayal' },
  { id:'gov_hartley',   name:'Governor Hartley',     title:'Governor, swing state',     icon:'🏛', party:'neutral', personality:'pragmatic centrist who tracks polls obsessively' },
  { id:'amb_reeves',    name:'Ambassador Reeves',    title:'US Ambassador to UN',       icon:'🌐', party:'neutral', personality:'meticulous multilateralist who despises unilateral moves' },
  { id:'dr_walsh',      name:'Dr. Walsh',            title:'Fed Chair',                 icon:'📈', party:'neutral', personality:'hawkish on inflation, deeply protective of Fed independence' },
  { id:'sec_okafor',    name:'Secretary Okafor',     title:'Treasury Secretary',        icon:'💵', party:'ally',    personality:'technocratic moderate who thinks in bond yields' },
  { id:'col_brooks',    name:'General Brooks',       title:'Chairman, Joint Chiefs',    icon:'🛡', party:'neutral', personality:'blunt, hates half-measures, loyal to the uniform not the party' },
  { id:'reporter_sato', name:'Dana Sato',            title:'White House Correspondent', icon:'📺', party:'press',   personality:'aggressive on access, fair on facts, hunting the next scoop' },
];

function _initRecurringChars(){
  if(!P100._charRelations) P100._charRelations = {};
  if(!P100._charHistory)   P100._charHistory   = {};
  RECURRING_CHARACTERS.forEach(c=>{
    if(P100._charRelations[c.id]===undefined) P100._charRelations[c.id]=50;
  });
}

// ── EVENT MEMORY ─────────────────────────────────────────────────────────────
const EVENT_FOLLOWUPS = {
  'c2': { minDaysLater:5, chancePerDay:0.15,
    headline:'Cyber Retaliation: Second Wave Detected',
    brief:'NSA reports the state actor behind last week\'s Treasury breach has returned — this time probing power grid SCADA systems in six states. Your earlier response shaped their calculus. They\'re testing whether the first answer was a bluff.',
    advisorVoice:'nsc_advisor', advisorLine:'They came back. What do you want to do now?' },
  'c5': { minDaysLater:4, chancePerDay:0.12,
    headline:'Recovery or Recession? Markets React to Your Policy',
    brief:'Three months after the initial economic shock, markets are reacting to your earlier decisions. Analysts are connecting your choices to where the Dow stands today.',
    advisorVoice:'econ_advisor', advisorLine:'The numbers are moving in response to what we did. Do we stay the course or correct?' },
  'l1': { minDaysLater:6, chancePerDay:0.20,
    headline:'Defectors Return — Flagship Bill Gets a Second Chance',
    brief:'Two of the three senators who blocked your signature bill have privately signalled they may be open to a modified version. The window could be days.',
    advisorVoice:'vp', advisorLine:'They\'re back at the table. What do we offer this time?' },
  'c3': { minDaysLater:8, chancePerDay:0.08,
    headline:'Alliance Tests Your Earlier Call',
    brief:'The NATO partners involved in your earlier decision are now asking for a follow-up call. Your original stance is being tested as the situation on the ground has evolved.',
    advisorVoice:'nsc_advisor', advisorLine:'They want to know if the first call still holds. Does it?' },
};

function _markEventCompleted(eventId){
  if(!eventId) return;
  if(!P100._completedEventIds) P100._completedEventIds=[];
  if(!P100._completedEventIds.includes(eventId)) P100._completedEventIds.push(eventId);
}

function _checkFollowUpEvent(){
  if(!P100._completedEventIds) return null;
  for(const [trigId, followup] of Object.entries(EVENT_FOLLOWUPS)){
    if(!P100._completedEventIds.includes(trigId)) continue;
    const followupId='followup_'+trigId;
    if(P100._completedEventIds.includes(followupId)) continue;
    if((P100.day - (P100._followupTriggerDay?.[trigId]||1)) < followup.minDaysLater) continue;
    if(Math.random() > followup.chancePerDay) continue;
    _markEventCompleted(followupId);
    return { id:followupId, headline:followup.headline, brief:followup.brief,
             advisorVoice:followup.advisorVoice, advisorLine:followup.advisorLine, _isContinuation:true };
  }
  return null;
}

// ── X FEED ───────────────────────────────────────────────────────────────────
const XFEED_HANDLES = [
  { handle:'@SenMaloneOff',      name:'Sen. Malone',           icon:'🔴', type:'politician', party:'opp'    },
  { handle:'@JuliaChenDC',       name:'Rep. Julia Chen',        icon:'🔵', type:'politician', party:'ally'   },
  { handle:'@GovHartleyPA',      name:'Gov. Hartley',           icon:'🏛', type:'politician', party:'neutral'},
  { handle:'@DanaSatoWH',        name:'Dana Sato',              icon:'📺', type:'press'                     },
  { handle:'@PoliticoBreaking',  name:'POLITICO',               icon:'📰', type:'press'                     },
  { handle:'@WashPostPolitics',  name:'Washington Post',        icon:'🗞', type:'press'                     },
  { handle:'@ConservativeDaily', name:'The Conservative Daily', icon:'🦅', type:'commentator', lean:'right'  },
  { handle:'@ProgressNow',       name:'Progress Now',           icon:'✊', type:'commentator', lean:'left'   },
  { handle:'@IndyVoterPoll',     name:'Independent Voter',      icon:'🗳', type:'commentator', lean:'center' },
  { handle:'@JustATexan1776',    name:'Randy B.',               icon:'🤠', type:'public'                    },
  { handle:'@MargaretFromOhio',  name:'Margaret K.',            icon:'👩', type:'public'                    },
  { handle:'@BrooklynPolitics',  name:'Carlos M.',              icon:'✌', type:'public'                    },
  { handle:'@NotMyPresident2024',name:'Dave from Accounting',   icon:'😤', type:'hater',   recurring:true   },
  { handle:'@JennyFromMapleton', name:'Jenny H.',               icon:'😍', type:'crush',   recurring:true   },
];

function _initXFeed(){
  if(!P100._xFeed) P100._xFeed={ posts:[], generating:false };
}

function _fmtNum(n){ return n>=1000?`${(n/1000).toFixed(1)}K`:String(n); }

function _addXPost(acct, text){
  _initXFeed();
  const mins=[1,2,3,5,7,12,18,24,31,45][Math.floor(Math.random()*10)];
  P100._xFeed.posts.unshift({
    handle:acct.handle, name:acct.name, icon:acct.icon,
    text, time:mins<60?`${mins}m ago`:`${Math.round(mins/60)}h ago`,
    day:P100.day, likes:Math.floor(Math.random()*4200)+50,
    retweets:Math.floor(Math.random()*900)+5,
  });
  if(P100._xFeed.posts.length>5) P100._xFeed.posts.length=5;
}

function _renderXFeedPanel(){
  const panel=document.getElementById('p100-xfeed-panel');
  if(!panel) return;
  _initXFeed();
  const posts=P100._xFeed.posts.slice(0,5);
  if(!posts.length){
    panel.innerHTML='<div class="p100-xfeed-empty">Feed updates after each decision</div>';
    return;
  }
  panel.innerHTML=posts.map(p=>`
    <div class="p100-xfeed-post">
      <div class="p100-xfeed-post-header">
        <span class="p100-xfeed-post-icon">${p.icon}</span>
        <div class="p100-xfeed-post-meta">
          <div class="p100-xfeed-post-name">${p.name}</div>
          <div class="p100-xfeed-post-handle">${p.handle} · ${p.time}</div>
        </div>
        <span class="p100-xfeed-post-day">Day ${p.day}</span>
      </div>
      <div class="p100-xfeed-post-text">${p.text}</div>
      <div class="p100-xfeed-post-stats">
        <span>♥ ${_fmtNum(p.likes)}</span>
        <span>⟳ ${_fmtNum(p.retweets)}</span>
      </div>
    </div>`).join('');
}

// Fallback post pools — varied per account type to avoid repeats
const _XFEED_FALLBACKS={
  hater:[
    `This is literally the worst thing any president has ever done. Yes I'm including ALL of them.`,
    `My blood pressure can't take this anymore. Unbelievable.`,
    `Called it. CALLED IT. Nobody listened and here we are.`,
    `I don't care what party you are — this is a disaster. Goodnight.`,
    `Every single day. Every single day something new. I can't.`,
    `I've been saying this for MONTHS and you all thought I was crazy.`,
    `Sir this is a Wendy's. (That's how presidential this decision is.)`,
    `Welp. There goes my weekend.`,
    `Wake me up when this is over. Actually don't. I need sleep more than I need news.`,
    `I have a stress ball shaped like the Capitol and it's been destroyed.`,
  ],
  crush:[
    `Not me refreshing the news just to see what they're up to today 😳`,
    `I sat next to them in 4th grade homeroom and I KNEW they were going places. (Hi if you see this 👋)`,
    `My mom STILL brings up that I used to have a crush on the president. Every. Thanksgiving.`,
    `Okay but can we talk about the podium walk?? The CONFIDENCE. I'm not okay.`,
    `I wrote their name on my folder in 4th grade. This is basically my fault.`,
    `Some people have fan accounts for singers. I have one for a sitting president and I will not be taking questions.`,
    `Childhood crush becomes Leader of the Free World. Normal day on this app.`,
    `My therapist says I need to "move on." My therapist doesn't understand.`,
    `The handshake at the summit. The EYE CONTACT. Someone check on me.`,
    `Fourth grade me knew. Fourth grade me ALWAYS knew.`,
  ],
  commentator_right:[`This is government overreach, plain and simple.`,`The silent majority sees exactly what's happening here.`,`Accountability starts NOW.`,`Freedom isn't free and neither is bad policy.`,`Main Street is watching while Washington plays games.`,`Our founders are rolling in their graves.`,],
  commentator_left:[`This is a gut punch to working families.`,`We didn't fight this hard to watch it happen again.`,`History will judge this moment.`,`The resistance is not tired.`,`Progress doesn't happen by accident — or by THIS.`,`People over profits. Always.`,],
  commentator_center:[`Both sides need to take a breath and look at the data.`,`Reasonable people can disagree. This is one of those times.`,`The polling on this will be interesting.`,`Independence means calling it when it matters. This matters.`,`Not everything is partisan — some things are just policy.`,],
  press:[`DEVELOPING: White House responds.`,`Sources on both sides of the aisle reacting tonight.`,`Press briefing expected within the hour.`,`The President's actions drawing scrutiny from multiple fronts.`,`Inside the room: what advisors are saying privately.`,`We've confirmed details independently. Developing.`,],
  politician_opp:[`This will not stand.`,`My constituents deserve better and they know it.`,`The administration has crossed a line today.`,`I'll be calling for answers first thing tomorrow.`,`We are watching. Closely.`,],
  politician_ally:[`Standing with this administration. The right call.`,`Leadership looks like this.`,`Proud to be part of a team making real decisions.`,`History will remember who showed up.`,`We move forward — together.`,],
  politician_neutral:[`The governors are watching the downstream effects carefully.`,`Bipartisan concern is worth taking seriously.`,`I've called the White House. We'll see.`,`My state needs answers before I can weigh in.`,`Cautious optimism is still optimism.`,],
  public:[
    [`Just woke up to this news. A lot to process over my coffee.`,`Government gonna government I guess.`,`My neighbor is going to have OPINIONS about this at the HOA meeting.`,`The group chat is on fire rn.`,`Fascinating times to be alive. Terrifying, but fascinating.`],
    [`Look I'm just a regular person but even I can see this matters.`,`Called my dad about this. He said "sounds about right." Helpful, dad.`,`Did anyone else just get a news alert or is it just me.`,`My dog doesn't care about any of this and I respect him for it.`,`I've refreshed the news 11 times in the last hour.`],
    [`Finally something to argue about at dinner that isn't sports.`,`This timeline never gets boring I'll give it that.`,`Alright which one of you predicted THIS in your 2025 bingo card.`,`Whatever happens I want it on record that I was paying attention.`,`Called my senator. Left a voicemail. Felt good.`],
  ],
};

// Track recently used handles to prevent back-to-back duplicates
if(!window._xFeedLastHandles) window._xFeedLastHandles=[];

function _getXFallback(acct){
  const p=acct.type==='hater'?_XFEED_FALLBACKS.hater
    :acct.type==='crush'?_XFEED_FALLBACKS.crush
    :acct.type==='commentator'?(_XFEED_FALLBACKS['commentator_'+(acct.lean||'center')]||_XFEED_FALLBACKS.commentator_center)
    :acct.type==='press'?_XFEED_FALLBACKS.press
    :acct.type==='politician'?(_XFEED_FALLBACKS['politician_'+(acct.party||'neutral')]||_XFEED_FALLBACKS.politician_neutral)
    :_XFEED_FALLBACKS.public[Math.floor(Math.random()*_XFEED_FALLBACKS.public.length)];
  return Array.isArray(p)?p[Math.floor(Math.random()*p.length)]:'';
}

// Occasionally add a creative flavour instruction to spice up tweets
const _TWEET_FLAVOURS=[
  null,null,null, // most tweets are plain — weight towards normal
  'Slip in a paraphrased movie quote that fits the moment.',
  'Write it like a sports commentator calling a big play.',
  'Reference a random historical president as comparison.',
  'Write it like someone who just woke up from a 10-year coma.',
  'Use a cooking metaphor.',
  'Sound like a nature documentary narrator.',
  null,null,
];
function _randFlavour(){ return _TWEET_FLAVOURS[Math.floor(Math.random()*_TWEET_FLAVOURS.length)]; }

// STRICT OUTPUT RULE appended to every prompt — stops phi-3 from leaking reasoning
const _TWEET_RULE=` OUTPUT RULE: Your entire response must be ONLY the tweet text. No (Note: ...), no explanations, no character counts, no parentheses commentary, no quotation marks around the tweet. Just the tweet.`;

function _buildXPrompt(acct,actionContext,presName,presParty){
  const flavour=_randFlavour();
  const flavourNote=flavour?` ${flavour}`:'';
  if(acct.type==='hater')
    return `You are Dave from Accounting (@NotMyPresident2024) — a chronically online guy who hates EVERYTHING the president does no matter what. React to: "${actionContext}". Write ONE tweet under 115 chars. Be dramatic, funny, specific. No hashtags.${flavourNote}${_TWEET_RULE}`;
  if(acct.type==='crush')
    return `You are Jenny H. (@JennyFromMapleton) — a woman who had a massive crush on ${presName} in 4th grade and never got over it. You post embarrassing earnest fan content about them. React to: "${actionContext}". Write ONE tweet under 115 chars. Be funny and self-aware.${flavourNote}${_TWEET_RULE}`;
  return `You are ${acct.name} (${acct.handle}) posting on X about: "${actionContext}". Account type: ${acct.type}, lean: ${acct.lean||acct.party||'neutral'}. President: ${presName} (${presParty}). Write ONE tweet under 125 chars, in character.${flavourNote}${_TWEET_RULE}`;
}

async function _generateXFeedPosts(actionContext){
  _initXFeed();
  if(P100._xFeed.generating) return;
  P100._xFeed.generating=true;
  const presName=P100.playerName||'the President';
  const presParty=P100.playerPartyLabel||'';

  // Scale post count to event importance: milestones get 4, normal events 2-3, minor 1-2
  const isMilestone=!!P100._isMilestone;
  const postCount=isMilestone?4:(Math.random()<0.5?3:2);
  const recurringCount=isMilestone?2:(Math.random()<0.4?1:0); // hater+crush always on milestones, sometimes on normal events
  const recurring=XFEED_HANDLES.filter(a=>a.recurring).slice(0,recurringCount);
  const regularNeeded=postCount-recurringCount;
  const eligible=XFEED_HANDLES.filter(a=>!a.recurring&&!window._xFeedLastHandles.includes(a.handle));
  const pool=eligible.length>=regularNeeded?eligible:XFEED_HANDLES.filter(a=>!a.recurring);
  const regularPicks=[...pool].sort(()=>Math.random()-.5).slice(0,regularNeeded);
  window._xFeedLastHandles=regularPicks.map(a=>a.handle);
  const picks=[...recurring,...regularPicks];

  if(window.isElectron&&window.localAI){
    for(const acct of picks){
      try{
        const prompt=_buildXPrompt(acct,actionContext,presName,presParty);
        const fn=window.localAI.getTweet||window.localAI.getAdvice;
        const raw=await fn.call(window.localAI,prompt);
        if(raw&&raw.trim().length>10){
          // Strip any leaked reasoning the model may have appended
          const cleaned=raw.trim()
            .replace(/\s*\(Note:[^)]*\)/gi,'')
            .replace(/\s*\(This tweet[^)]*\)/gi,'')
            .replace(/\s*\(The tweet[^)]*\)/gi,'')
            .replace(/\s*\(\d+ chars?\)/gi,'')
            .replace(/\s*\(under \d+[^)]*\)/gi,'')
            .replace(/^["']|["']$/g,'')
            .trim();
          const firstLine=cleaned.split('\n')[0].trim();
          const final=firstLine.length>10?firstLine:cleaned;
          if(final.length>10) _addXPost(acct,_fixAISpacing(final));
        }
      }catch(_){}
    }
  } else {
    picks.forEach(acct=>{ const t=_getXFallback(acct); if(t) _addXPost(acct,t); });
  }
  P100._xFeed.generating=false;
  _renderXFeedPanel();
}

function _seedInitialXFeed(){
  _initXFeed();
  [
    ['@DanaSatoWH',       `${P100.playerName} takes office. A new chapter begins. The press pool is ready.`],
    ['@PoliticoBreaking', `BREAKING: ${P100.playerPartyLabel} administration officially begins. Watch this space.`],
    ['@JustATexan1776',   `New president. Same swamp. Prove me wrong.`],
    ['@MargaretFromOhio', `Watched the inauguration with the kids. Whatever your politics, today matters.`],
    ['@IndyVoterPoll',    `First 100 days clock starts now. No excuses — just results.`],
  ].forEach(([handle,text])=>{
    const acct=XFEED_HANDLES.find(a=>a.handle===handle);
    if(acct) _addXPost(acct,text);
  });
  _renderXFeedPanel();
}

function _injectXFeedColumn(){
  if(document.getElementById('p100-xfeed-col')) return;
  const body=document.querySelector('.p100-body');
  if(!body) return;
  body.classList.add('has-xfeed');
  const sidebar=body.querySelector('.p100-sidebar');
  const col=document.createElement('div');
  col.id='p100-xfeed-col';
  col.innerHTML=`
    <div class="p100-xfeed-header">
      <div style="font-size:15px;font-weight:900;color:#e8ecf4;font-family:sans-serif;line-height:1">𝕏</div>
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;font-weight:700">PUBLIC REACTION</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#2a3348">Live Feed</div>
      </div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:4px">
        <div class="p100-xfeed-live-dot"></div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#22c55e">LIVE</span>
      </div>
    </div>
    <div id="p100-xfeed-panel"><div class="p100-xfeed-empty">Feed updates after each decision</div></div>`;
  // Insert BEFORE the event area so grid order is: [xfeed] [main] [sidebar]
  const eventArea=body.querySelector('#p100-event-area');
  if(eventArea) body.insertBefore(col,eventArea);
  else if(sidebar) body.insertBefore(col,sidebar);
  else body.appendChild(col);
}

// ── WIRE EVERYTHING IN via initFirst100Days ───────────────────────────────────
// We wrap the real initFirst100Days so our setup runs right after P100 state exists.
(function(){
  const _realInit = window.initFirst100Days || initFirst100Days;

  window.initFirst100Days = function(...args){
    _realInit.apply(this, args);
    // P100 state now exists — initialise our systems
    _initRecurringChars();
    _initXFeed();
    // Inject column and seed feed after the DOM settles
    setTimeout(()=>{
      _injectXFeedColumn();
      _seedInitialXFeed();
    }, 100);
  };

  // Patch _applyEvaluationResult via window so the reference is live
  window._p100_origApplyEval = _applyEvaluationResult;
  window._applyEvaluationResult = function(result, originalResponse){
    window._p100_origApplyEval(result, originalResponse);
    if(!P100) return;
    const sit=P100._currentSituation;
    // Mark event completed for memory (feed already generated during spinner)
    if(sit?.id) _markEventCompleted(sit.id);
  };

  // Patch p100SubmitFreeAction for tweet generation on free actions
  const _realFreeAction = window.p100SubmitFreeAction;
  window.p100SubmitFreeAction = async function(){
    const inputEl=document.getElementById('p100-free-action-input');
    const text=inputEl?inputEl.value.trim():'';
    if(_realFreeAction) await _realFreeAction.apply(this, arguments);
    if(text&&P100) setTimeout(()=>_generateXFeedPosts(`President ${P100.playerName} took off-brief action: "${text.slice(0,120)}"`),500);
  };

  // Patch _scheduleNextEvent to check follow-ups — done via window property
  window._p100_scheduleNext_withFollowup = async function(){
    if(!P100||P100.day>=100){_showEndScreen();return;}
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
    // Check for follow-up continuation
    const followUp=_checkFollowUpEvent();
    if(followUp){
      // Track headline so next AI call knows to avoid this topic
      // Continuations: record domain but don't block the domain for long (only 1 slot)
      if(!P100._aiGeneratedHeadlines) P100._aiGeneratedHeadlines=[];
      if(followUp.headline&&!P100._aiGeneratedHeadlines.includes(followUp.headline)){
        P100._aiGeneratedHeadlines.push(followUp.headline);
        if(P100._aiGeneratedHeadlines.length>20) P100._aiGeneratedHeadlines.shift();
      }
      _recordDomain(_inferDomain(followUp.headline));
      P100._pendingAI=false; P100._isMilestone=null; P100._currentSituation=followUp;
      _renderBriefing();
      setTimeout(()=>{
        const tag=document.querySelector('.p100-event-phase-tag');
        if(tag) tag.textContent='🔁 CONTINUATION — '+tag.textContent;
      },50);
      return;
    }
    // Normal flow
    P100._eventCount=(P100._eventCount||0)+1;
    P100._pendingAI=true; _renderBriefingPlaceholder();
    const phase=_currentPhase();
    let situation=null;
    if(P100._aiFailCount<6) situation=await _fetchAISituation(phase);
    P100._pendingAI=false;
    if(situation){ P100._aiFailCount=0; if(situation.id) _markEventCompleted(situation.id); }
    else{
      P100._aiFailCount=(P100._aiFailCount||0)+1;
      situation=await _pickFallbackSituationWithMemory(phase.id);
      // Track curated/procedural headline so AI avoids the same topic next turn
      if(situation?.headline){
        if(!P100._aiGeneratedHeadlines) P100._aiGeneratedHeadlines=[];
        if(!P100._aiGeneratedHeadlines.includes(situation.headline)){
          P100._aiGeneratedHeadlines.push(situation.headline);
          if(P100._aiGeneratedHeadlines.length>20) P100._aiGeneratedHeadlines.shift();
        }
        _recordDomain(EVENT_DOMAINS[situation.id]||_inferDomain(situation.headline));
      }
    }
    P100._isMilestone=null; P100._currentSituation=situation; _renderBriefing();
  };

  window._p100ScheduleNextEvent=window._p100_scheduleNext_withFollowup;

})();

// Fallback picker with memory (avoids repeats)
async function _pickFallbackSituationWithMemory(phaseId){
  const pool=SITUATION_POOL[phaseId]||SITUATION_POOL.first_acts;
  if(!P100._completedEventIds) P100._completedEventIds=[];
  const used=P100._usedByPhase[phaseId]||[];
  const globalUsed=P100._completedEventIds;
  let av=pool.filter(s=>!used.includes(s.id)&&!globalUsed.includes(s.id));
  if(!av.length){
    // All curated used — reset phase tracking and go procedural
    P100._usedByPhase[phaseId]=[];
    return await _buildProceduralSituation(phaseId);
  }
  if(Math.random()<0.25) return await _buildProceduralSituation(phaseId);
  const pick=av[Math.floor(Math.random()*av.length)];
  (P100._usedByPhase[phaseId]=P100._usedByPhase[phaseId]||[]).push(pick.id);
  _markEventCompleted(pick.id);
  return JSON.parse(JSON.stringify(pick));
}

