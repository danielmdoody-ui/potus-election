// -----------------------------------------------

// POTUS v2.2 — Game Engine (Core Logic)
// Depends on: game-data.js, game-night.js, game-tour.js
// -----------------------------------------------

// ╔----------------------------------------------------------------------╗
// ║  🛠  GAME CONFIG — All easy-to-tweak knobs in one place             ║
// ╠----------------------------------------------------------------------╣
// ║  Edit values here to change game feel without hunting through code. ║
// ╚-----------------------------------------------------------------------
const GAME_CONFIG = {

  // ── ECONOMY ─────────────────────────────────────────────────────────
  startingFunds: 45,          // Starting campaign funds ($M)
  weeklyBurnRate: 1.2,        // Funds spent per week passively ($M)
  fundraiseCap: 200,          // Max total funds that can be raised ($M)

  // ── TIMING ──────────────────────────────────────────────────────────
  primaryWeeks: 14,           // Number of primary weeks
  generalWeeks: 16,           // Number of general election weeks

  // ── POLLING & VARIANCE ──────────────────────────────────────────────
  pollErrorScale: 1.0,        // Multiplier on hidden polling error (1 = default, 2 = chaotic)
  swingStateVolatility: 1.2,  // How volatile swing states are vs safe states

  // ── ACTIONS ─────────────────────────────────────────────────────────
  rallyBaseEffect: 4.5,       // Base polling boost from a rally (pts)
  grassrootsBaseEffect: 4.5,  // Base polling boost from grassroots (pts)
  adBlitzCost: 3,             // Cost of Ad Blitz action ($M) — change here AND in ACTIONS array
  safeStateCapGeneral: 0.6,   // Max pts a safe state can be moved per rally in the general

  // ── AI DIFFICULTY ────────────────────────────────────────────────────
  aiScandalChance: 0.08,      // Probability (0-1) per week of AI candidate scandal
  aiActionEfficiency: 0.85,   // How effective AI actions are vs player (1 = equal)

  // ── ELECTION NIGHT ───────────────────────────────────────────────────
  ctcMarginThreshold: 4,      // States within this margin (pts) go "Too Close to Call"
  ctcBothCloseThreshold: 8,   // If both candidates near 270, this margin triggers TTC
  retractionChance: 0.20,     // Probability a razor-thin call gets retracted (drama!)
};
// -----------------------------------------------------------------------


const ACTIONS=[
  {id:'visit',   name:'Campaign Rally',      icon:'🗺',desc:'Big rally in target state. Best in swing states.',outcomes:'Polling +3–6% in state · Ground game ↑ · Momentum ↑',cost:1.5,needsState:true,
    fx:s=>{const st=GS.states.find(x=>x.code===s);if(!st)return[];
      // Ground game and enthusiasm amplify the rally effect
      const groundMult = 1 + GS.groundGame/150;
      const enthusiasmMult = 1 + ((GS._enthusiasm||50)-50)/120;
      const homeBonus = s===GS.homeState ? 1.6 : 1;
      // Partisan resistance: in the general phase, hostile states resist your rally hard.
      // rawLean > 0 means the state leans YOUR way, < 0 means it's hostile territory.
      // ind/custom party: rawLean=0 — no inherent partisan lean, all states equally accessible.
      const rawLean = GS.phase==='general' ? (GS.playerParty==='rep' ? -st.lean : GS.playerParty==='ind' ? 0 : st.lean) : 0;
      // BUG FIX: Strengthened resistance formula. Floor at 0.06x for deeply hostile states.
      // States leaning 20+ pts against you barely move even with perfect conditions.
      const partisanResist = rawLean < -8 ? Math.max(0.06, 1 + rawLean / 18) : 1.0;
      // Hard cap by state safety tier — in the general election only.
      // Safe (|lean|>20): max 0.5pts, Likely (|lean|12-20): max 1.5pts, Lean (|lean|6-12): max 2.5pts, Toss-up: uncapped.
      const _absL = Math.abs(st.lean);
      const safeStateCap = (GS.phase==='general') ? (_absL > 20 ? 0.5 : _absL > 12 ? 1.5 : _absL > 6 ? 2.5 : Infinity) : Infinity;
      const rawEffect = G(4.5, 1.2) * groundMult * enthusiasmMult * homeBonus * partisanResist;
      const b = Math.min(rawEffect, safeStateCap);
      // VP home-state bonus also scales with partisan resistance — even star VPs can't override local politics
      const vpBonus = GS.vp && GS.vp.stateCode===s ? Math.min(3.5 * partisanResist, safeStateCap * 0.5) : 0;
      if(GS.phase==='primary') st.primLead=cl(st.primLead+b,-60,60);
      else st.genLead=cl(st.genLead+b+vpBonus,-60,60);
      GS.groundGame=cl(GS.groundGame+G(2.5,1),0,100);GS.momentum=cl(GS.momentum+2.5,-20,20);GS.favorability=cl(GS.favorability+G(1.5,.6),20,85);
      const resistNote = partisanResist < 0.6 ? ` (deeply hostile turf — only ${(partisanResist*100).toFixed(0)}% effective)` :
                         partisanResist < 0.85 ? ` (hostile turf — ${(partisanResist*100).toFixed(0)}% effective)` : '';
      const safeNote = (GS.phase==='general' && Math.abs(st.lean) > 18) ? ` 🔒 Safe state — gains capped.` : '';
      return[{type: partisanResist < 0.3 ? 'neutral' : 'positive',title:`Rally in ${st.name}`,msg:`${partisanResist<0.3?'Sparse crowd in hostile territory':'Massive crowd'} — polling ${b>0?'+':''}${b.toFixed(1)}%.${vpBonus>0.05?' VP regional bonus +'+vpBonus.toFixed(1)+'%!':''}${resistNote}${safeNote}`}]}},
  {id:'fundraise',name:'Fundraising Drive',  icon:'💰',desc:'Fill the war chest. Slight momentum dip.',outcomes:'Raise $1.5–4M · Momentum slightly ↓',cost:0,needsState:false,
    fx:()=>{const r=G(2.5,1.0)*(1+GS.favorability/350);GS.funds=Math.min(GS.funds+r, GAME_CONFIG.fundraiseCap);GS.totalRaised+=r;GS.momentum=cl(GS.momentum-1,-20,20);return[{type:'positive',title:'Fundraising Drive',msg:`Raised ${fm(r)}. Cash on hand: ${fm(GS.funds)}. (Momentum −1 — time spent off the trail.)`}]}},
  {id:'speech',  name:'Policy Address',      icon:'📜',desc:'Deliver a policy speech. Boosts favorability & media.',outcomes:'Favorability +2–5% · Media +3–7% · Momentum ↑',cost:.5,needsState:false,
    fx:()=>{const f=G(3,1.5),m=G(5,2);GS.favorability=cl(GS.favorability+f,20,85);GS.mediaCoverage=cl(GS.mediaCoverage+m,0,100);GS.momentum=cl(GS.momentum+1.5,-20,20);return[{type:'positive',title:'Policy Speech',msg:`Favorability +${f.toFixed(1)}%, media +${m.toFixed(1)}%.`}]}},
  {id:'attack',  name:'Opposition Research', icon:'📺',desc:'Run attack ads on frontrunner. 65% land, 35% backfire.',outcomes:'Success: opponent approval −6% · Fail: your favorability −3%',cost:2.5,needsState:false,
    fx:()=>{if(Math.random()<.65){const t=GS.aiCandidates.filter(a=>a.active).sort((a,b)=>b.delegates-a.delegates)[0]||GS.aiCandidates[0];if(t){t.approval=cl(t.approval-G(6,2),0,80);GS.momentum=cl(GS.momentum+3,-20,20);return[{type:'positive',title:'Attack Lands',msg:`Ads against ${t.name} hurt their numbers badly.`}]}}
      GS.favorability=cl(GS.favorability-G(3,1),20,85);GS.momentum=cl(GS.momentum-2,-20,20);return[{type:'negative',title:'Attack Backfires',msg:'Negative ads draw backlash. Favorability drops.'}]}},
  {id:'coalition',name:'Coalition Building', icon:'-',desc:'MINIGAME — Target a voter bloc. Earn endorsements and shift key demographics.',outcomes:'Target bloc +4% · Endorsement earned · Favorability ↑',cost:1,needsState:false,
    fx:()=>{const B=['urban','suburban','rural','youth','seniors'];const t=B[~~(Math.random()*B.length)];const g=G(4,1.5);GS.demos[t]=cl(GS.demos[t]+g,20,80);GS.endorsements++;GS.favorability=cl(GS.favorability+G(1.5,.5),20,85);
      if(GS.phase==='general'){GS.states.filter(s=>Math.abs(s.genLead)<10).forEach(s=>s.genLead=cl(s.genLead+G(.4,.2),-60,60))}
      const N={urban:'Urban',suburban:'Suburban',rural:'Rural',youth:'Youth',seniors:'Seniors'};return[{type:'positive',title:`Coalition — ${N[t]}`,msg:`${N[t]} support +${g.toFixed(1)}%. Endorsement earned.`}]}},
  {id:'debate',  name:'Debate Prep',         icon:'🎤',desc:'Boost electability. Crucial before debate weeks.',outcomes:'Electability +3–7% · Debate performance bonus',cost:.8,needsState:false,
    fx:()=>{const e=G(5,2);GS.electability=cl(GS.electability+e,0,100);GS.mediaCoverage=cl(GS.mediaCoverage+3,0,100);GS.favorability=cl(GS.favorability+1,20,85);return[{type:'positive',title:'Debate Ready',msg:`Electability +${e.toFixed(1)}%.`}]}},
  {id:'grass',   name:'Grassroots Org.',     icon:'📋',desc:'Expand volunteer network in target state. Builds long-term ground game.',outcomes:'Ground game +4% · State polling +3–5% · Momentum ↑',cost:.5,needsState:true,
    fx:s=>{const st=GS.states.find(x=>x.code===s);if(!st)return[];const g=G(4.5,1.2);GS.groundGame=cl(GS.groundGame+g,0,100);
      const rawLean2 = GS.phase==='general' ? (GS.playerParty==='rep' ? -st.lean : GS.playerParty==='ind' ? 0 : st.lean) : 0;
      const grassResist = rawLean2 < -8 ? Math.max(0.08, 1 + rawLean2 / 18) : 1.0;
      const safeCapGrass = (GS.phase==='general' && Math.abs(st.lean) > 18) ? 0.5 : Infinity;
      const stateGain = Math.min(G(2.8,0.8)*grassResist, safeCapGrass);
      if(GS.phase==='primary')st.primLead=cl(st.primLead+G(2.5,0.8),-60,60);
      else st.genLead=cl(st.genLead+stateGain,-60,60);
      const grassNote = grassResist < 0.5 ? ` Deeply hostile territory — org limited to ${(grassResist*100).toFixed(0)}% effectiveness.` :
                        grassResist < 0.85 ? ` Tough terrain — ${(grassResist*100).toFixed(0)}% effective.` : '';
      const safeNote = (Math.abs(st.lean) > 18 && GS.phase==='general') ? ' 🔒 Safe state — limited gains.' : '';
      return[{type:'positive',title:`Ground Game — ${st.name}`,msg:`Volunteers mobilised. State polling +${stateGain.toFixed(1)}%. Ground game +${g.toFixed(1)}%.${grassNote}${safeNote}`}]}},
  {id:'adblitz', name:'Ad Blitz',            icon:'📡',desc:'MINIGAME — Choose your ad strategy: attack, contrast, or inspire. Hits all swing states.',outcomes:'Swing states polling +0.5–2% · Media coverage ↑↑',cost:3,needsState:false,
    fx:()=>{
      // Use designated swing states so battleground targeting stays stable all game.
      const swingPool = getSwingStates();
      const swing = swingPool.filter(s=>{
        const lead = GS.phase==='primary' ? s.primLead : s.genLead;
        if(GS.phase==='primary') return Math.abs(lead) < 14;
        return Math.abs(s.lean) <= 18 && Math.abs(lead) < 18;
      });
      const targets = swing.length ? swing : swingPool.slice(0, 8);
      const b=G(1,.4);
      targets.forEach(s=>{if(GS.phase==='primary')s.primLead=cl(s.primLead+b*.5,-60,60);else s.genLead=cl(s.genLead+b*.7,-60,60)});
      GS.mediaCoverage=cl(GS.mediaCoverage+10,0,100);return[{type:'positive',title:'Ad Blitz',msg:`${targets.length} swing states flooded with ads. +${b.toFixed(1)}% in close races. Safe states stay mostly stable.`}]}},
  {id:'townhall', name:'Town Hall',           icon:'--',desc:'MINIGAME — Local Q&A. Answer voter questions to shift blocs & earn a state bonus.',outcomes:'State polling +2–5% · Favorability ↑ · Electability ↑',cost:.8,needsState:true,
    fx:s=>{const st=GS.states.find(x=>x.code===s);if(!st)return[];
      const rawLean3 = GS.phase==='general' ? (GS.playerParty==='rep' ? -st.lean : GS.playerParty==='ind' ? 0 : st.lean) : 0;
      const townResist = rawLean3 < -10 ? Math.max(0.08, 1 + rawLean3 / 16) : 1.0;
      const safeCapTH = (GS.phase==='general' && Math.abs(st.lean) > 18) ? 0.7 : Infinity;
      const boost = Math.min(G(3.5,1.0)*(1+GS.electability/180)*townResist, safeCapTH);
      GS.favorability=cl(GS.favorability+G(2,.8),20,85);
      GS.electability=cl(GS.electability+G(2,1),0,100);
      if(GS.phase==='primary')st.primLead=cl(st.primLead+boost,-60,60);
      else st.genLead=cl(st.genLead+boost,-60,60);
      const resistNote = townResist < 0.5 ? ` (hostile crowd — ${(townResist*100).toFixed(0)}% receptiveness)` :
                         townResist < 0.85 ? ` (tough crowd — ${(townResist*100).toFixed(0)}% receptiveness)` : '';
      const safeNote = Math.abs(st.lean) > 18 && GS.phase==='general' ? ' 🔒 Safe state — limited impact.' : '';
      return[{type:'positive',title:`Town Hall — ${st.name}`,msg:`Authentic Q&A earns voter trust. +${boost.toFixed(1)}% in state.${resistNote}${safeNote}`}]}},
  {id:'surrogate',name:'Surrogate Tour',      icon:'-',desc:'Send allies to campaign in 3 swing states simultaneously.',outcomes:'3 swing states polling +0.5–1.5% each · Ground game ↑',cost:2,needsState:false,
    fx:()=>{
      const swing = getSwingStates()
        .filter(s=>Math.abs(s.lean)<=16)
        .sort((a,b)=>Math.abs(a.genLead)-Math.abs(b.genLead))
        .slice(0,3);
      const b=G(.8,.4);
      swing.forEach(s=>{if(GS.phase==='primary')s.primLead=cl(s.primLead+b,-60,60);else s.genLead=cl(s.genLead+b,-60,60)});
      GS.groundGame=cl(GS.groundGame+G(1.5,.7),0,100);
      const names=swing.map(s=>s.code).join(', ')||'no reachable states';
      return[{type:'positive',title:'Surrogate Blitz',msg:`Allies hit ${names}. +${b.toFixed(1)}% each. Ground game grows.`}]}},
  {id:'crisis',   name:'Crisis Response',     icon:'🛡',desc:'Counter a scandal or opponent attack. Restores momentum.',outcomes:'Favorability recovers · Momentum +2–4 · Opponent weakened',cost:1.5,needsState:false,
    fx:()=>{const rec=G(5,2);GS.favorability=cl(GS.favorability+rec*.3,20,85);GS.momentum=cl(GS.momentum+rec*.4,-20,20);
      GS.mediaCoverage=cl(GS.mediaCoverage+8,0,100);
      // If opponent is attacking, weaken their attack
      const opp=GS.aiCandidates.find(a=>a.active);if(opp)opp.approval=cl(opp.approval-G(2,1),0,80);
      return[{type:'positive',title:'Crisis Contained',msg:`Rapid response neutralises coverage. Momentum +${(rec*.4).toFixed(1)}, favorability recovers.`}]}},
  {id:'press_tour',name:'Media Press Tour',   icon:'📰',desc:'MINIGAME — Fast Q&A gauntlet with hostile reporters. High media & favorability if you nail it.',outcomes:'Media +3–6% · Favorability +2–4%',cost:1,needsState:false,
    fx:()=>{const m=G(4,1.5);GS.mediaCoverage=cl(GS.mediaCoverage+m,0,100);GS.favorability=cl(GS.favorability+G(2.5,1),20,85);return[{type:'positive',title:'Press Tour',msg:`Media coverage +${m.toFixed(1)}%.`}]}},
  {id:'fundraise_calls',name:'Call List Drive',icon:'📞',desc:'MINIGAME — Work the donor rolodex. Match ask to donor type for maximum fundraising.',outcomes:'Raise $1–3M additional',cost:0,needsState:false,
    fx:()=>{const r=G(1.8,0.7);GS.funds=Math.min(GS.funds+r, GAME_CONFIG.fundraiseCap);GS.totalRaised+=r;return[{type:'positive',title:'Call List Done',msg:`Raised additional ${fm(r)}.`}]}},
  // ── BLOC-SHIFTING ACTIONS (available in general phase) ──
  {id:'union_speech',name:'Union Rally Speech', icon:'✊',desc:'Energise working class voters. Big gains in Rust Belt.',outcomes:'Working class +2.5% · Suburban women slightly −',cost:1.5,needsState:false,generalOnly:true,
    fx:()=>{
      shiftBloc('wc', G(2.5,0.8)); shiftBloc('sw', G(-0.8,0.3));
      GS.momentum=cl(GS.momentum+2,-20,20);
      GS_ACTION_LOG.push({week:GS.week,action:'union_speech',blocs:{wc:'+~2.5',sw:'-~0.8'}});
      return[{type:'positive',title:'Union Rally',msg:'Working class voters surge. Rust Belt states shift. Suburban women slightly cooler.'}]}},
  {id:'climate_push',name:'Climate Town Hall', icon:'🌿',desc:'Bold climate agenda fires up urban & young voters.',outcomes:'Urban progs +3% · Youth +2% · Seniors −1.5%',cost:1.5,needsState:false,generalOnly:true,
    fx:()=>{
      shiftBloc('up', G(3,0.8)); shiftBloc('yv', G(2,0.6)); shiftBloc('sr', G(-1.5,0.5));
      GS.demos.youth=cl(GS.demos.youth+G(3,1),20,80);
      GS_ACTION_LOG.push({week:GS.week,action:'climate_push',blocs:{up:'+~3',yv:'+~2',sr:'-~1.5'}});
      return[{type:'positive',title:'Climate Push',msg:'Urban progressives and young voters rally. Seniors more skeptical.'}]}},
  {id:'crime_ad',  name:'Tough on Crime Ad',   icon:'🔒',desc:'Plays to suburban safety concerns. Young & urban voters push back.',outcomes:'Suburban women +2% · Independents +1.2% · Youth −1.5%',cost:2.5,needsState:false,generalOnly:true,
    fx:()=>{
      shiftBloc('sw', G(2,0.7)); shiftBloc('in', G(1.2,0.5)); shiftBloc('yv', G(-1.5,0.6)); shiftBloc('up', G(-1,0.5));
      GS_ACTION_LOG.push({week:GS.week,action:'crime_ad',blocs:{sw:'+~2',in:'+~1.2',yv:'-~1.5',up:'-~1'}});
      return[{type:'positive',title:'Crime Ad',msg:'Suburban women and independents respond well. Young voters and urban progressives are turned off.'}]}},
  {id:'econ_msg',  name:'Economic Populism',   icon:'📊',desc:'Working & middle class appeal. May conflict with college-educated bloc.',outcomes:'Working class +2% · Independents +1.5% · College-educated −1%',cost:1.5,needsState:false,generalOnly:true,
    fx:()=>{
      shiftBloc('wc', G(2,0.8)); shiftBloc('in', G(1.5,0.6)); shiftBloc('ce', G(-1,0.5));
      GS_ACTION_LOG.push({week:GS.week,action:'econ_msg',blocs:{wc:'+~2',in:'+~1.5',ce:'-~1'}});
      return[{type:'positive',title:'Economic Populism',msg:'Working class and independents move your way. College-educated voters slightly less enthusiastic.'}]}},
  {id:'college_push',name:'College Outreach',  icon:'🎓',desc:'Drive college-educated & young voter turnout.',outcomes:'College-educated +2.5% · Youth +2% · Suburban women +1%',cost:1.5,needsState:false,generalOnly:true,
    fx:()=>{
      shiftBloc('ce', G(2.5,0.8)); shiftBloc('yv', G(2,0.7)); shiftBloc('sw', G(1,0.5));
      GS.demos.youth=cl(GS.demos.youth+G(2,1),20,80);
      GS_ACTION_LOG.push({week:GS.week,action:'college_push',blocs:{ce:'+~2.5',yv:'+~2',sw:'+~1'}});
      return[{type:'positive',title:'College Outreach',msg:'Educated voters and the youth bloc energized. Suburban women also respond positively.'}]}},
  {id:'rural_tour', name:'Rural Outreach Tour',icon:'🌾',desc:'Swing rural voters and win back independents in small-town America.',outcomes:'Rural +2% · Working class +1.5% · Independents +1.2%',cost:2,needsState:false,generalOnly:true,
    fx:()=>{
      shiftBloc('rc', G(2,0.8)); shiftBloc('wc', G(1.5,0.6)); shiftBloc('in', G(1.2,0.5));
      GS_ACTION_LOG.push({week:GS.week,action:'rural_tour',blocs:{rc:'+~2',wc:'+~1.5',in:'+~1.2'}});
      return[{type:'positive',title:'Rural Tour',msg:'Rural conservatives softened. Working class and independents shift. Sun Belt less affected than Rust Belt.'}]}},

  // ── PRIMARY-ONLY ACTIONS ─────────────────────────────────────────────────
  {id:'canvass',      name:'Door-to-Door Canvassing', icon:'🚪',desc:'MINIGAME — Match your pitch to each voter type. Ground game in target state surges.',outcomes:'State polling +2–5% · Ground game ↑↑ · Momentum ↑',cost:1.2,needsState:true,primaryOnly:true,
    fx:s=>{const st=GS.states.find(x=>x.code===s);if(!st)return[];
      const base=G(3.5,1.0);
      GS.groundGame=cl(GS.groundGame+G(3.5,1),0,100);
      st.primLead=cl(st.primLead+base,-60,60);
      GS.momentum=cl(GS.momentum+1.5,-20,20);
      return[{type:'positive',title:`Canvassing — ${st.name}`,msg:`Volunteers knocked ${Math.floor(G(800,200))} doors. Polling +${base.toFixed(1)}%. Ground game building.`}]}},
  {id:'spin_room',    name:'Spin Room Session',       icon:'🎙-',desc:'MINIGAME — Control the primary narrative. Handle hostile talking points from party insiders.',outcomes:'Media +3–6% · Favorability +2% · Momentum ↑',cost:0.8,needsState:false,primaryOnly:true,
    fx:()=>{const m=G(4,1.5);GS.mediaCoverage=cl(GS.mediaCoverage+m,0,100);GS.favorability=cl(GS.favorability+G(2,0.8),20,85);GS.momentum=cl(GS.momentum+2,-20,20);
      return[{type:'positive',title:'Spin Room',msg:`Media narrative improved. Coverage +${m.toFixed(1)}%.`}]}},
  {id:'oppo_rapid',   name:'Rapid Response',          icon:'⚡',desc:'MINIGAME — Counter a primary opponent attack in real time. Speed matters.',outcomes:'Favorability recovered · Momentum ↑ · Opponent approval −',cost:1,needsState:false,primaryOnly:true,
    fx:()=>{const rec=G(4,1.5);GS.favorability=cl(GS.favorability+rec*.4,20,85);GS.momentum=cl(GS.momentum+rec*.35,-20,20);
      const opp=GS.aiCandidates.find(a=>a.active);if(opp)opp.approval=cl(opp.approval-G(2.5,1),0,80);
      return[{type:'positive',title:'Rapid Response',msg:`Attack neutralised. Favorability +${(rec*.4).toFixed(1)}%.`}]}},
  {id:'delegate_push',name:'Delegate Courtship',      icon:'🗳-',desc:'Work the phones and private dinners. Court uncommitted delegates directly.',outcomes:'+10–25 delegates secured',cost:2,needsState:false,primaryOnly:true,
    fx:()=>{const gain=Math.floor(G(18,6));GS.playerDelegates=cl(GS.playerDelegates+gain,0,4000);GS.favorability=cl(GS.favorability+G(1,0.5),20,85);
      return[{type:'positive',title:'Delegate Courtship',msg:`Backroom diplomacy pays off. +${gain} uncommitted delegates secured.`}]}},




  {id:'national_address',name:'National Address',icon:'📺',desc:'⚠- RISKY — Prime-time address to the nation. Could redefine your campaign — or expose you.',cost:3,needsState:false,generalOnly:true,risk:true,
    fx:()=>{
      const moodMod = window._moodRiskRoll || 0.65;
      const roll = Math.random();
      if(roll < 0.45*moodMod/0.65){ // mood adjusts triumph threshold
        const boost = G(5,1.5);
        GS.states.forEach(s=>s.genLead=cl(s.genLead+G(1.2,0.5),-60,60));
        GS.favorability=cl(GS.favorability+boost,20,85);GS.momentum=cl(GS.momentum+5,-20,20);
        shiftBloc('in',G(3,0.8)); shiftBloc('sw',G(2,0.8));
        return[{type:'positive',title:'National Address — TRIUMPH',msg:`Your prime-time address moved the needle. Approval jumped +${boost.toFixed(0)} points. Independents and suburban women swung hard. Pundits call it a "defining moment."`}];
      } else if(roll < 0.78) { // 33% neutral
        GS.states.forEach(s=>s.genLead=cl(s.genLead+G(0.3,0.4),-60,60));
        GS.favorability=cl(GS.favorability+G(1,0.5),20,85); GS.momentum=cl(GS.momentum+1,-20,20);
        return[{type:'neutral',title:'National Address — Mixed Reviews',msg:'Your address landed without major impact. Some praised the substance; critics found it flat. The nation remains divided.'}];
      } else { // 22% disaster
        const drop = G(-4,1);
        GS.favorability=cl(GS.favorability+drop,20,85); GS.momentum=cl(GS.momentum-4,-20,20);
        GS.states.filter(s=>Math.abs(s.lean)<=8).forEach(s=>s.genLead=cl(s.genLead-G(1.2,0.5),-60,60));
        return[{type:'negative',title:'🔥 National Address — BACKFIRE',msg:`Disaster. A stumble on live television, an awkward moment that went viral. Favorability fell ${drop.toFixed(0)} points. Swing states tightened overnight.`}];
      }}},

  {id:'attack_blitz',name:'Massive Attack Ad',icon:'💣',desc:'⚠- RISKY — Carpet bomb opponent with attack ads. Bruising. Could destroy them — or backfire on you.',cost:4,needsState:false,generalOnly:true,risk:true,
    fx:()=>{
      const roll = Math.random();
      if(roll < 0.5){ // 50% effective
        const dmg = G(4,1.2);
        GS.opponent.favorability = cl((GS.opponent.favorability||45)-dmg,10,85);
        GS.states.filter(s=>Math.abs(s.lean)<=10).forEach(s=>s.genLead=cl(s.genLead+G(1.5,0.4),-60,60));
        GS.momentum=cl(GS.momentum+3,-20,20);
        return[{type:'positive',title:'Attack Blitz — EFFECTIVE',msg:`The ads landed. Opponent approval sank ${dmg.toFixed(0)} points. Swing-state polls shifted. The media calls it "the most brutal ad campaign in years."`}];
      } else if(roll<0.75){ // 25% backfire
        const drop = G(-3,1);
        GS.favorability=cl(GS.favorability+drop,20,85); GS.momentum=cl(GS.momentum-3,-20,20);
        shiftBloc('sw',G(-2,0.5)); shiftBloc('in',G(-1.5,0.5));
        return[{type:'negative',title:'🔥 Attack Blitz — BACKFIRE',msg:`The attacks were deemed too negative. Suburban women and independents recoiled. Your favorability fell ${drop.toFixed(0)} points — and the opponent raised $12M off your ads.`}];
      } else { // 25% mixed
        GS.opponent.favorability = cl((GS.opponent.favorability||45)-G(1.5,0.5),10,85);
        return[{type:'neutral',title:'Attack Blitz — Wash',msg:'The ads ran, the opponent took some damage, but your negatives also ticked up. A costly draw.'}];
      }}},

  {id:'vp_announce',name:'Surprise VP Reveal',icon:'-',desc:'⚠- RISKY — Drop a surprise VP announcement mid-race. Game-changing — if the pick lands well.',cost:3,needsState:false,generalOnly:true,risk:true,
    fx:()=>{
      const picks=[
        {name:'Senator from Ohio',effect:'rust',blocs:{wc:3,in:2.5},states:['OH','PA','MI','WI'],msg:'The Ohio pick dominates coverage. Rust Belt polling moves immediately. Momentum surges.',type:'positive'},
        {name:'Governor from Georgia',effect:'sunbelt',blocs:{sw:3.5,up:1.5,in:2},states:['GA','NC','AZ'],msg:'The Georgia pick turns Sun Belt into battleground. Suburban women go from lean-opponent to coin-flip.',type:'positive'},
        {name:'Rising star Senator',effect:'viral',blocs:{yv:4,up:2.5,ce:2},states:[],msg:'An unexpected viral pick. Young voters exploded on social media. Gen Z registration surged 18% overnight.',type:'positive'},
        {name:'Controversial figure',effect:'risky',blocs:{rc:3,in:-2,sw:-2.5},states:['TX','FL'],msg:'A bold, divisive pick. Core base loved it. Independents and suburban women were alarmed. A true gamble.',type:'neutral'},
      ];
      const pick = picks[Math.floor(Math.random()*picks.length)];
      Object.entries(pick.blocs).forEach(([k,v])=>shiftBloc(k,v));
      pick.states.forEach(code=>{const s=GS.states.find(x=>x.code===code);if(s)s.genLead=cl(s.genLead+G(2.5,0.8),-60,60);});
      GS.momentum=cl(GS.momentum+4,-20,20);
      return[{type:pick.type,title:`VP Surprise: ${pick.name}`,msg:pick.msg}];}},

  {id:'policy_pivot',name:'Major Policy Pivot',icon:'🔄',desc:'⚠- RISKY — Radically shift your platform. Alienate the base or pick up critical swing votes?',cost:3,needsState:false,generalOnly:true,risk:true,
    fx:()=>{
      const pivots=[
        {title:'Moved Right on Border',fx:()=>{shiftBloc('in',G(3,0.8));shiftBloc('rc',G(2,0.8));shiftBloc('up',G(-3.5,0.8));shiftBloc('yv',G(-2,0.8));return{type:'neutral',msg:'Independents and rural conservatives moved toward you. Your progressive base is furious — donations dropped 22%.'};}},
        {title:'Moved Left on Healthcare',fx:()=>{shiftBloc('up',G(3,0.8));shiftBloc('yv',G(3,0.8));shiftBloc('in',G(-2.5,0.8));shiftBloc('se',G(-1.5,0.8));return{type:'neutral',msg:'Urban progressives and young voters surged. Seniors and independents skeptical. The media declared it "a new campaign."'};}},
        {title:'Endorsed Major Tax Cut',fx:()=>{shiftBloc('in',G(2.5,0.8));shiftBloc('sw',G(2,0.8));shiftBloc('up',G(-2,0.8));GS.momentum=cl(GS.momentum+3,-20,20);return{type:'positive',msg:'Suburban and independent voters responded warmly. Biggest fundraising day of the cycle followed. Critics say it\'s a flip-flop.'};}},
        {title:'Cancelled Major Event Appearance',fx:()=>{GS.favorability=cl(GS.favorability-G(3,1),20,85);GS.momentum=cl(GS.momentum-4,-20,20);GS.states.filter(s=>Math.abs(s.lean)<=8).forEach(s=>s.genLead=cl(s.genLead-G(1,0.5),-60,60));return{type:'negative',msg:'🔥 Confusion in the campaign. Cancelling the appearance looked like panic. Pundits declared "the wheels are coming off."'};}},
      ];
      const pivot = pivots[Math.floor(Math.random()*pivots.length)];
      const res = pivot.fx();
      return[{type:res.type,title:`Policy Pivot: ${pivot.title}`,msg:res.msg}];}},
  // ── ROAST ACTION ──────────────────────────────────────────────────────────
  // Unlike traditional attacks, the Roast targets opponents with humour.
  // Net effect: favourability is neutral to slightly positive, but youth bloc
  // and media surge. Backfire risk is tone-dependent (mild / savage / bomb).
  {id:'roast', name:'Roast the Frontrunner', icon:'🎤',
   desc:'Deploy sharp political humour against the frontrunner. Boosts youth vote & media. Won\'t hurt overall favourability.',
   outcomes:'Youth +4–8% · Media ↑↑ · Momentum ↑ · Small backfire risk',
   cost:1.5, needsState:false,
   fx:()=>{
    const target = GS.phase==='primary'
      ? (GS.aiCandidates.filter(a=>a.active).sort((a,b)=>b.delegates-a.delegates)[0]
         || GS.aiCandidates.filter(a=>a.active).sort((a,b)=>b.approval-a.approval)[0])
      : GS.opponent;
    if(!target) return [{type:'neutral',title:'No Target',msg:'No one to roast right now.'}];

    const tName = target.name || 'your opponent';
    const tLast = tName.split(' ').slice(-1)[0];

    // Three outcome tiers:
    //   savage (35%) — perfect delivery, big youth / media boost, tiny backfire risk
    //   landed  (45%) — solid joke, meaningful boost, no blowback
    //   bombed  (20%) — crowd groans, small media bump but own fav dips
    const roll = Math.random();

    const SAVAGE_LINES = [
      `"${tLast} says they have all the answers. I agree — unfortunately, none of them are right."`,
      `"I asked ${tLast}'s campaign what their healthcare plan was. They said 'thoughts and prayers.' Mine actually has a budget."`,
      `"${tLast} has a long record of public service — most of it spent explaining why the last thing didn't work."`,
      `"${tLast} told me this race isn't about personality. That's great news — because I checked and they don't have one."`,
      `"${tLast} called me yesterday to say I was running a negative campaign. I told them I was just fact-checking their speeches."`,
    ];
    const LANDED_LINES = [
      `"${tLast} and I agree on one thing — someone needs to win this election. We just disagree on the obvious choice."`,
      `"I want to be kind to ${tLast}. So I'll just say their campaign is... ambitious."`,
      `"${tLast} says they'll bring fresh ideas to Washington. Bless them — they're going to need a map."`,
      `"${tLast} is a serious candidate. Very, very serious. Almost no fun at all, actually."`,
      `"I looked at ${tLast}'s policy platform. It's well-formatted. I'll give them that."`,
    ];
    const BOMBED_LINES = [
      `"I had a great line about ${tLast}... but it turns out it was already their campaign slogan."`,
      `"${tLast} told me to stop making jokes at their expense. I told them to stop giving me material."`,
    ];

    if(roll < 0.35){
      // SAVAGE — viral moment
      const line = SAVAGE_LINES[Math.floor(Math.random()*SAVAGE_LINES.length)];
      const youthBoost = G(7,1.5);
      const mediaBoost = G(14,3);
      const momBoost = G(3.5,1);
      GS.demos.youth = cl(GS.demos.youth + youthBoost, 10, 90);
      GS.mediaCoverage = cl(GS.mediaCoverage + mediaBoost, 0, 100);
      GS.momentum = cl(GS.momentum + momBoost, -20, 20);
      // Roast doesn't hit overall fav — the crowd laughs WITH you
      if(GS.phase==='primary'){
        // Tiny approval dent to target
        target.approval = cl(target.approval - G(1.5,0.8), 0, 80);
      } else {
        target.favorability = cl((target.favorability||45) - G(2,0.8), 10, 85);
      }
      addNews(`${GS.playerName} lands devastating political roast — ${tLast} camp furious, social media explodes`,'campaign');
      return [{type:'positive',title:'🎤 ROAST — VIRAL MOMENT',
        msg:`${line} The crowd erupts. Gen Z Twitter goes wild. Media coverage +${mediaBoost.toFixed(0)}%, youth support +${youthBoost.toFixed(1)}%. Momentum surges. ${tLast}'s team issues a stiff press release — which makes it funnier.`}];

    } else if(roll < 0.80){
      // LANDED — solid bit
      const line = LANDED_LINES[Math.floor(Math.random()*LANDED_LINES.length)];
      const youthBoost = G(4.5,1);
      const mediaBoost = G(8,2);
      const momBoost = G(2,0.8);
      GS.demos.youth = cl(GS.demos.youth + youthBoost, 10, 90);
      GS.mediaCoverage = cl(GS.mediaCoverage + mediaBoost, 0, 100);
      GS.momentum = cl(GS.momentum + momBoost, -20, 20);
      GS.favorability = cl(GS.favorability + G(0.8,0.4), 20, 85); // slight fav bump — likability
      addNews(`${GS.playerName} draws laughs at ${tLast}'s expense — crowd loves it`,'campaign');
      return [{type:'positive',title:'🎤 Roast Lands',
        msg:`${line} The room laughs. Even some of ${tLast}'s people cracked a smile. Media coverage +${mediaBoost.toFixed(0)}%, youth support +${youthBoost.toFixed(1)}%, favorability ticks up. Humour is a weapon — and today it landed clean.`}];

    } else {
      // BOMBED — joke fell flat or backfired on tone
      const line = BOMBED_LINES[Math.floor(Math.random()*BOMBED_LINES.length)];
      const mediaBoost = G(5,1.5); // still got coverage, just not great
      const favDip = G(1.8,0.6);
      GS.mediaCoverage = cl(GS.mediaCoverage + mediaBoost, 0, 100);
      GS.favorability = cl(GS.favorability - favDip, 20, 85);
      GS.momentum = cl(GS.momentum - 1, -20, 20);
      addNews(`${GS.playerName} roast attempt falls flat — pundits call it "trying too hard"`,'campaign');
      return [{type:'negative',title:'🎤 Roast — Bombed',
        msg:`${line} Silence. Then an awkward cough. The clip plays on cable news, but not in the way you wanted. Favorability −${favDip.toFixed(1)}%. Comedy, it turns out, is harder than it looks. ${tLast}'s team is delighted.`}];
    }
  }},

];

window.ACTIONS = ACTIONS; // expose for ai-command.js (const is not auto-global)
// getBestOpponent is a regular hoisted function — no window alias needed,
// hoisted globals are already accessible on window in browsers.
// FRONTRUNNER_ACTIONS is used by game-historical.js as the standard general-election action pool.
// It is intentionally the same set as ACTIONS — historical mode picks from it when the player
// is ahead, and falls back to UNDERDOG_ACTIONS when trailing.
const FRONTRUNNER_ACTIONS = ACTIONS;
window.FRONTRUNNER_ACTIONS = FRONTRUNNER_ACTIONS;

// ── UNDERDOG ACTIONS — unlocked when trailing 5+ points nationally ──────────
const UNDERDOG_ACTIONS = [
  {id:'strategic_reset', name:'Strategic Reset', icon:'-', desc:'Overhaul your entire campaign strategy. New message, new team, new energy. Could reverse momentum — or reveal internal chaos.', cost:2, needsState:false,
    fx:()=>{
      const roll=Math.random();
      if(roll<0.55){
        const favGain=G(5,1.5), momGain=G(6,2);
        GS.favorability=cl(GS.favorability+favGain,20,85); GS.momentum=cl(GS.momentum+momGain,-20,20);
        GS.mediaCoverage=cl(GS.mediaCoverage+15,0,100);
        GS.states.filter(s=>Math.abs(s.lean)<=10).forEach(s=>s.genLead=cl(s.genLead+G(1.5,0.5),-60,60));
        return[{type:'positive',title:'- Strategic Reset — Campaign Reborn',msg:`The shakeup worked. New messaging landed clean. Favorability +${favGain.toFixed(0)}%, momentum surged. Political reporters calling it "the comeback launch."`}];
      } else {
        const drop=G(-4,1);
        GS.favorability=cl(GS.favorability+drop,20,85); GS.momentum=cl(GS.momentum-3,-20,20);
        return[{type:'negative',title:'- Strategic Reset — Leaked Bad',msg:`Internal turmoil got to the press. Staffers gave damaging quotes. Favorability fell ${drop.toFixed(0)} points. "Campaign in chaos" dominated the week.`}];
      }}},
  {id:'rebrand_tour', name:'Rebrand Tour', icon:'🌟', desc:'30-day cross-country image overhaul. High investment, potential to redefine how voters see you in final weeks.', cost:3, needsState:false,
    fx:()=>{
      shiftBloc('in',G(3,1)); shiftBloc('sw',G(2.5,0.8)); shiftBloc('yv',G(2,0.8));
      GS.favorability=cl(GS.favorability+G(4,1.5),20,85);
      GS.momentum=cl(GS.momentum+G(4.5,1.5),-20,20);
      GS.mediaCoverage=cl(GS.mediaCoverage+20,0,100);
      ['PA','MI','WI','AZ','GA','NV'].forEach(c=>{const s=GS.states.find(x=>x.code===c);if(s)s.genLead=cl(s.genLead+G(2,0.7),-60,60);});
      return[{type:'positive',title:'🌟 Rebrand Tour Complete',msg:'A relentless 30-day media offensive. Swing state polls shifted. Narrative flipped from "struggling" to "surging underdog." This is the race now.'}];}},
  {id:'hail_mary_msg', name:'High-Risk Messaging Shift', icon:'💥', desc:"Throw out the playbook entirely. New radical message that could electrify your base — or permanently fracture it.", cost:2.5, needsState:false,
    fx:()=>{
      const roll=Math.random();
      if(roll<0.4){
        const topBloc=['up','yv','wc'][Math.floor(Math.random()*3)];
        shiftBloc(topBloc,G(7,2)); shiftBloc('in',G(2,0.8));
        GS.momentum=cl(GS.momentum+7,-20,20);
        GS.states.filter(s=>Math.abs(s.genLead)<12).forEach(s=>s.genLead=cl(s.genLead+G(2.5,0.8),-60,60));
        return[{type:'positive',title:'💥 Messaging Shift — VIRAL',msg:`The message went viral overnight. Organic social sharing exploded. Battleground state energy is electric. This could be the turning point.`}];
      } else if(roll<0.7){
        shiftBloc('up',G(3,1)); shiftBloc('sw',G(-2,0.8));
        return[{type:'neutral',title:'💥 Messaging Shift — Split Decision',msg:'Your base loved it. Moderates recoiled. Net-neutral trade — but the campaign feels alive again.'}];
      } else {
        GS.favorability=cl(GS.favorability-G(5,2),20,85); GS.momentum=cl(GS.momentum-5,-20,20);
        shiftBloc('sw',G(-3,1)); shiftBloc('in',G(-2.5,1));
        return[{type:'negative',title:'💥 Messaging Shift — COLLAPSE',msg:'🔥 Catastrophic. Moderates and independents fled immediately. The party is calling for a return to the original message. Donors are spooked.'}];
      }}},
];

window.UNDERDOG_ACTIONS = UNDERDOG_ACTIONS; // expose for ai-command.js

// ── EVENTS ──
const EVENTS=[
  {w:8,tag:'economy',hl:'Strong Jobs Report Boosts Economy',fx:gs=>{
    const sh=gs.playerParty==='dem'?1.5:-1.5;
    if(gs.phase==='primary')gs.states.forEach(s=>s.primLead=cl(s.primLead+sh,-60,60));
    else gs.states.forEach(s=>s.genLead=cl(s.genLead+sh,-60,60));
    return{type:'neutral',msg:'Strong jobs data reshapes economic messaging.'}}},
  {w:5,tag:'economy',hl:'Economic Slowdown Worries Voters',fx:gs=>{
    const sh=gs.playerParty==='rep'?1.5:-1.5;
    if(gs.phase==='primary')gs.states.forEach(s=>s.primLead=cl(s.primLead+sh,-60,60));
    else gs.states.forEach(s=>s.genLead=cl(s.genLead+sh,-60,60));
    return{type:'negative',msg:'Slowdown data hurts the incumbent-friendly party.'}}},
  {w:6,tag:'economy',hl:'Inflation Ticks Up — Voters Feel the Pinch',fx:gs=>{
    const sh=gs.playerParty==='dem'?-1.2:1.2;
    gs.favorability=cl(gs.favorability+sh*.5,20,85);
    if(gs.phase==='primary')gs.states.forEach(s=>s.primLead=cl(s.primLead+sh,-60,60));
    else gs.states.forEach(s=>s.genLead=cl(s.genLead+sh,-60,60));
    return{type:'negative',msg:'Grocery and gas prices dominate kitchen-table conversations.'}}},
  {w:5,tag:'economy',hl:'Stock Market Hits Record High',fx:gs=>{
    const sh=gs.playerParty==='dem'?1.2:-1.2;
    gs.favorability=cl(gs.favorability+sh*.4,20,85);gs.momentum=cl(gs.momentum+1.5,-20,20);
    return{type:'positive',msg:'Markets surge — economic confidence lifts the incumbent party\'s candidate.'}}},
  {w:10,tag:'event',hl:'Viral Moment Changes Race Dynamics',fx:gs=>{const ok=Math.random()<.5+(gs.electability-50)/200;if(ok){gs.favorability=cl(gs.favorability+4,20,85);gs.momentum=cl(gs.momentum+5,-20,20);return{type:'positive',msg:'Viral moment goes in your favour — momentum surges.'}}gs.favorability=cl(gs.favorability-3,20,85);gs.momentum=cl(gs.momentum-3,-20,20);return{type:'negative',msg:'Fumble dominates the news cycle. Momentum dips.'}}},
  {w:6,tag:'event',hl:'Major Newspaper Endorses a Candidate',fx:gs=>{
    const ok=Math.random()<.45+(gs.favorability-42)*.005;
    if(ok){gs.favorability=cl(gs.favorability+3,20,85);gs.momentum=cl(gs.momentum+3,-20,20);gs.endorsements++;addNews('Major newspaper endorses your campaign','endorsement');return{type:'positive',msg:'A major editorial board endorses your campaign — a significant credibility boost.'}}
    const rival=gs.aiCandidates.find(a=>a.active);if(rival)rival.approval=cl(rival.approval+4,0,80);
    return{type:'negative',msg:'The editorial endorsement goes to a rival. They get a bump in credibility.'}}},
  {w:8,tag:'scandal',hl:'Opponent Faces Damaging Allegations',fx:gs=>{const act=gs.aiCandidates.filter(a=>a.active);if(act.length){const t=act[~~(Math.random()*act.length)];t.approval=cl(t.approval-G(8,3),0,80);return{type:'positive',msg:`${t.name} faces damaging allegations. Numbers crater.`}}return{type:'neutral',msg:'Opposition faces scrutiny.'}}},
  {w:4,tag:'scandal',hl:'Campaign Faces Damaging Allegations',fx:gs=>{gs.favorability=cl(gs.favorability-G(6,2),20,85);gs.momentum=cl(gs.momentum-5,-20,20);return{type:'negative',msg:'Allegations dominate headlines. Damage control needed.'}}},
  {w:4,tag:'scandal',hl:'Former Aide Goes Public With Criticism',fx:gs=>{gs.favorability=cl(gs.favorability-G(4,1.5),20,85);gs.mediaCoverage=cl(gs.mediaCoverage+6,0,100);return{type:'negative',msg:'A disgruntled former aide gives a damaging interview. Favorability takes a hit.'}}},
  {w:7,tag:'campaign',hl:'Major Endorsement Shakes Up Race',fx:gs=>{gs.endorsements++;gs.favorability=cl(gs.favorability+3,20,85);gs.momentum=cl(gs.momentum+4,-20,20);gs.funds+=G(1.5,.5);gs.totalRaised+=1.5;return{type:'positive',msg:'Major party figure endorses your campaign.'}}},
  {w:9,tag:'campaign',hl:'Record Rally Crowd Energizes Base',fx:gs=>{gs.momentum=cl(gs.momentum+4,-20,20);gs.groundGame=cl(gs.groundGame+3,0,100);return{type:'positive',msg:'Massive rally draws record crowds and volunteer sign-ups.'}}},
  {w:5,tag:'scandal',hl:'Candidate Gaffe Creates News Storm',fx:gs=>{gs.favorability=cl(gs.favorability-G(4,1.5),20,85);gs.momentum=cl(gs.momentum-3,-20,20);return{type:'negative',msg:'Off-script comment dominates news for days.'}}},
  {w:6,tag:'campaign',hl:'Youth Voter Registration Surge',fx:gs=>{gs.demos.youth=cl(gs.demos.youth+5,20,80);gs.momentum=cl(gs.momentum+2,-20,20);return{type:'positive',msg:'Youth registration surge reshapes electorate.'}}},
  {w:4,tag:'event',hl:'Foreign Policy Crisis Tests Candidates',fx:gs=>{const b=gs.electability>55?2.5:-2;gs.favorability=cl(gs.favorability+b,20,85);return{type:'neutral',msg:'International tensions test foreign policy credentials.'}}},
  {w:5,tag:'event',hl:'Supreme Court Ruling Energizes Activists',fx:gs=>{gs.demos.youth=cl(gs.demos.youth+4,20,80);gs.momentum=cl(gs.momentum+3,-20,20);return{type:'positive',msg:'High-profile ruling drives donations and volunteer sign-ups.'}}},
  {w:5,tag:'event',hl:'Natural Disaster Dominates News Cycle',fx:gs=>{
    gs.mediaCoverage=cl(gs.mediaCoverage-8,0,100);gs.momentum=cl(gs.momentum-2,-20,20);
    const credibility=gs.electability>58?2:-1;gs.favorability=cl(gs.favorability+credibility,20,85);
    return{type:'neutral',msg:'Hurricane response shifts focus. Leadership credibility tested — empathetic candidates gain.'}}},
  {w:6,tag:'campaign',hl:'Celebrity Megadonor Backs Your Campaign',fx:gs=>{
    const boost=G(3,1.2);gs.funds+=boost;gs.totalRaised+=boost;gs.demos.youth=cl(gs.demos.youth+3,20,80);
    gs.momentum=cl(gs.momentum+2,-20,20);
    return{type:'positive',msg:`High-profile celebrity backing floods campaign coffers with $${boost.toFixed(1)}M and drives youth engagement.`}}},
  {w:4,tag:'poll',hl:'New National Poll Shows Tightening Race',fx:gs=>{
    const shift=G(0,2);gs.momentum=cl(gs.momentum+shift,-20,20);
    const act=gs.aiCandidates.filter(a=>a.active);if(act.length){const t=act[~~(Math.random()*act.length)];t.approval=cl(t.approval-shift*.5,0,80);}
    return{type:shift>0?'positive':'negative',msg:shift>0?'New poll shows your lead widening — campaign momentum building.':'New poll tightens the field. Opponents close the gap.'}}},
  {w:4,tag:'campaign',hl:'Rival Campaign Struggles With Internal Chaos',fx:gs=>{
    const act=gs.aiCandidates.filter(a=>a.active);if(act.length){const t=act[~~(Math.random()*act.length)];t.approval=cl(t.approval-G(5,2),0,80);t.funds=cl(t.funds-G(2,1),0,100);return{type:'positive',msg:`${t.name}'s campaign implodes — staff shake-up and messaging collapse.`}}return{type:'neutral',msg:'Rival campaign faces internal turmoil.'}}},
  {w:5,tag:'event',hl:'Third-Party Candidate Enters the Race',fx:gs=>{
    const drain=G(2,1);gs.favorability=cl(gs.favorability-drain*.3,20,85);
    const act=gs.aiCandidates.filter(a=>a.active);if(act.length){act.forEach(a=>a.approval=cl(a.approval-drain*.2,0,80));}
    return{type:'negative',msg:'A prominent independent entry steals protest votes from the whole field.'}}},
  {w:4,tag:'scandal',hl:'Leaked Opposition Research Stirs Controversy',fx:gs=>{
    if(Math.random()<.5){gs.favorability=cl(gs.favorability+G(2,1),20,85);return{type:'positive',msg:'Leaked oppo research backfires on whoever planted it — you benefit from the chaos.'}}
    gs.favorability=cl(gs.favorability-G(3,1),20,85);return{type:'negative',msg:'Leaked research paints an unflattering picture. Spin room in overdrive.'}}},
  {w:6,tag:'event',hl:'Major Union Endorsement Up For Grabs',fx:gs=>{
    const chance=cl(.4+gs.demos.rural*.004+gs.favorability*.003,.1,.9);
    if(Math.random()<chance){gs.endorsements++;gs.demos.urban=cl(gs.demos.urban+4,20,80);gs.funds+=G(1.5,.5);gs.totalRaised+=1.5;return{type:'positive',msg:'Major union backs your campaign — labor vote solidifies and $1.5M flows in.'}}
    const act=gs.aiCandidates.find(a=>a.active);if(act){act.approval=cl(act.approval+4,0,80);}
    return{type:'negative',msg:'The union endorsement goes to a rival. Working-class voters shift toward them.'}}},
];


// Primary debate weeks (1-indexed), general debate weeks (from week 21+)
const PRIMARY_DEBATE_WEEKS=[3,7,12];
const GENERAL_DEBATE_WEEKS=[22,26,30];

// ── GAME STATE ──
const GS={
  playerName:'Alex Morgan',playerParty:'dem',playerPartyLabel:'Democratic',
  playerPartyColor:'#3b82f6',playerPartyIcon:'🔵',
  homeState:'PA',difficulty:'easy',
  playerIdeology:50,funds:25,totalRaised:25,totalSpent:0,
  momentum:0,favorability:42,electability:55,groundGame:30,mediaCoverage:40,
  demos:{urban:52,suburban:45,rural:28,youth:38,seniors:41},
  phase:'primary',week:1,primaryWeeks:14,generalWeeks:16,
  playerDelegates:0,delegatesNeeded:1991,
  states:[],aiCandidates:[],newsItems:[],
  endorsements:0,selectedAction:null,targetState:null,
  vp:null,opponent:null,targetedStates:new Set(),
  tossupStateCodes:new Set(),swingStateCodes:new Set(),
  phaseTransitioning:false,
  favHistory:[],
  mediaBias:0,
  _recentActions:[],
  _historicalYearData:null,
};
window.GS = GS; // expose for ai-command.js (const is not auto-global)

// ── UTILITIES ──
function G(m,sd){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return m+sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function cl(v,mn,mx){return Math.max(mn,Math.min(mx,v))}
function fm(v){return`$${Math.abs(v).toFixed(1)}M`}
function wr(pool){let t=pool.reduce((s,e)=>s+e.w,0),r=Math.random()*t;for(const i of pool){r-=i.w;if(r<=0)return i}return pool[pool.length-1]}

const MIN_DESIGNATED_TOSSUPS = 5;
const MAX_DESIGNATED_TOSSUPS = 10;
const DEFAULT_DESIGNATED_TOSSUPS = 8;
const SWING_BUFFER_STATES = 8;

function _setFromAny(v){
  if(v instanceof Set) return new Set(v);
  if(Array.isArray(v)) return new Set(v);
  return new Set();
}
function _sortedByLeanCompetitiveness(states){
  return [...(states||[])].sort((a,b)=>{
    const da = Math.abs((a?.lean||0) + (a?.leanMod||0));
    const db = Math.abs((b?.lean||0) + (b?.leanMod||0));
    if(da!==db) return da-db;
    if((b?.ev||0)!==(a?.ev||0)) return (b?.ev||0)-(a?.ev||0);
    return String(a?.code||'').localeCompare(String(b?.code||''));
  });
}
function ensureBattlegroundSets(force=false){
  if(!GS?.states?.length) return { tossups:new Set(), swings:new Set() };
  const pool = _sortedByLeanCompetitiveness(GS.states.filter(s=>s && s.code!=='DC'));
  const validCodes = new Set(pool.map(s=>s.code));
  if(!force && GS.tossupStateCodes && _setFromAny(GS.tossupStateCodes).size){
    const existingTossups = new Set([..._setFromAny(GS.tossupStateCodes)].filter(code=>validCodes.has(code)));
    const existingSwings = new Set([..._setFromAny(GS.swingStateCodes)].filter(code=>validCodes.has(code)));
    const tossupsLookValid =
      existingTossups.size >= MIN_DESIGNATED_TOSSUPS &&
      existingTossups.size <= Math.min(MAX_DESIGNATED_TOSSUPS, pool.length);
    const swingsLookValid =
      existingSwings.size >= existingTossups.size &&
      existingSwings.size <= Math.min(pool.length, Math.max(existingTossups.size + SWING_BUFFER_STATES, 12));
    if(tossupsLookValid && swingsLookValid){
      existingTossups.forEach(code=>existingSwings.add(code));
      GS.tossupStateCodes = existingTossups;
      GS.swingStateCodes = existingSwings;
      return { tossups:existingTossups, swings:existingSwings };
    }
  }
  const tossupCount = Math.max(MIN_DESIGNATED_TOSSUPS, Math.min(MAX_DESIGNATED_TOSSUPS, DEFAULT_DESIGNATED_TOSSUPS));
  const swingCount = Math.min(pool.length, Math.max(tossupCount + SWING_BUFFER_STATES, 12));
  const tossups = new Set(pool.slice(0, tossupCount).map(s=>s.code));
  const swings = new Set(pool.slice(0, swingCount).map(s=>s.code));
  tossups.forEach(code=>swings.add(code));
  GS.tossupStateCodes = tossups;
  GS.swingStateCodes = swings;
  return { tossups, swings };
}
function isDesignatedTossupState(stateOrCode){
  const code = typeof stateOrCode==='string' ? stateOrCode : stateOrCode?.code;
  if(!code) return false;
  const { tossups } = ensureBattlegroundSets(false);
  return tossups.has(code);
}
function isSwingState(stateOrCode){
  const code = typeof stateOrCode==='string' ? stateOrCode : stateOrCode?.code;
  if(!code) return false;
  const { swings } = ensureBattlegroundSets(false);
  return swings.has(code);
}
function getSwingStates(){
  ensureBattlegroundSets(false);
  const swings = _setFromAny(GS.swingStateCodes);
  return (GS.states||[])
    .filter(s=>swings.has(s.code))
    .sort((a,b)=>Math.abs(a.genLead)-Math.abs(b.genLead));
}

// ── HISTORICAL MODE SUPPORT FUNCTIONS ───────────────────────────────────────
// Called by game-historical.js to initialise GS.states from STATE_DATA with
// general-election leads based on the player's party and a small random variance.
function loadDefaultStates(){
  GS.states = STATE_DATA.map(s => {
    const rawLean  = GS.playerParty === 'rep' ? -s.lean : s.lean;
    const pollError = G(0, s.vol * 5.5);
    return { ...s, primLead:0, genLead: rawLean + G(0,4),
             enthusiasm:55, primaryDelegatesWon:0, _pollError: pollError, leanMod:0 };
  });
  ensureBattlegroundSets(true);
}

// Recalculates each state's genLead after historical leanMod overrides are applied.
function calculateNationalPolls(){
  GS.states.forEach(s => {
    const rawLean = GS.playerParty === 'rep' ? -s.lean : s.lean;
    s.genLead = rawLean + (s.leanMod || 0) + G(0, s.vol * 2);
  });
}

// Resets any map pan/zoom to the default USA view.
// No-op when no pan/zoom library is active.
function centerUSA(){ /* map reset placeholder */ }

// ── Minigame question tracking — prevents repeat questions within a run ──────
const _mgUsedQuestions = {};
function _mgPickQuestions(id, pool, count){
  if(!_mgUsedQuestions[id]) _mgUsedQuestions[id] = new Set();
  const used = _mgUsedQuestions[id];
  if(used.size >= pool.length) used.clear();
  const available = pool.map((_,i)=>i).filter(i=>!used.has(i));
  const shuffled = available.sort(()=>Math.random()-0.5).slice(0, Math.min(count, available.length));
  shuffled.forEach(i=>used.add(i));
  return shuffled.map(i=>pool[i]);
}
// ── DYNAMIC NEWS SYSTEM ──────────────────────────────────────────────────────
// -------------------------------------------------------
//  RICH NEWS FRAMING SYSTEM — Party-aware, high variety
// -------------------------------------------------------
// Each tag has 3 pools of headlines:
//   favored   = shown by the outlet that leans toward the player's party
//   neutral   = centrist/wire framing
//   hostile   = shown by the outlet that leans against the player's party
//
// When party=dem: LEFT=favored, CENTER=neutral, RIGHT=hostile
// When party=rep: RIGHT=favored, CENTER=neutral, LEFT=hostile

const NEWS_POOL = {
  campaign:{
    favored:[
      hl=>`Grassroots energy building across key districts — volunteers mobilize in record numbers`,
      hl=>`Strong reception on the trail — base activists see a historic opportunity ahead`,
      hl=>`Momentum building — coalition expands as fundraising spikes`,
      hl=>`Community leaders rally around the campaign platform`,
      hl=>`Early supporters energized as the message resonates in battleground areas`,
      hl=>`Ground game intensifies — field offices opening in three new states`,
    ],
    neutral:[
      hl=>`${hl}`,
      hl=>`Campaign update: ${hl}`,
      hl=>`On the trail: ${hl}`,
      hl=>`Political notebook: ${hl}`,
    ],
    hostile:[
      hl=>`Questions linger — critics demand transparency on key issues`,
      hl=>`Skeptics unconvinced — analysts warn of unforced errors`,
      hl=>`Mixed reception in key counties as the campaign struggles for traction`,
      hl=>`Editorial board calls for more specifics on policy direction`,
      hl=>`Voters in swing districts remain unmoved by recent messaging`,
    ],
  },
  poll:{
    favored:[
      hl=>`New polling shows surging support — trend lines are favorable in key states`,
      hl=>`Voter enthusiasm gap narrows rapidly — numbers moving in the right direction`,
      hl=>`Poll tracker: favorable demographic shifts detected across the coalition`,
      hl=>`Survey shows voters rewarding the campaign on core economic issues`,
      hl=>`Internal modeling shows path to victory widening in battleground states`,
    ],
    neutral:[
      hl=>`${hl}`,
      hl=>`Polling update: ${hl}`,
      hl=>`Survey says: ${hl}`,
      hl=>`New numbers: ${hl}`,
    ],
    hostile:[
      hl=>`Deeper analysis reveals troubling cracks beneath favorable headline numbers`,
      hl=>`Polling memo: favorable headline masks softening internals in key blocs`,
      hl=>`Strategists warn numbers may be misleading — cross-tabs tell a different story`,
      hl=>`Independent analysts flag methodological concerns with recent survey data`,
      hl=>`Swing state numbers remain stubbornly resistant despite national improvement`,
    ],
  },
  scandal:{
    favored:[
      hl=>`Campaign calls allegations baseless — supporters stand firm and donors hold steady`,
      hl=>`Fact-checkers push back on opposition attacks as timeline does not hold up`,
      hl=>`Allies say the smear is coordinated by special interest groups`,
      hl=>`Legal experts: no wrongdoing found after independent review`,
      hl=>`Opposition narrative falls apart under scrutiny as key claims are debunked`,
    ],
    neutral:[
      hl=>`${hl}`,
      hl=>`Developing: ${hl}`,
      hl=>`Campaign facing questions — ${hl}`,
    ],
    hostile:[
      hl=>`EXCLUSIVE: sources say the pattern goes deeper than initially reported`,
      hl=>`Editorial: serious character questions voters deserve answers on`,
      hl=>`Calls grow for accountability as the story continues to widen`,
      hl=>`Watchdog group demands independent investigation into the matter`,
      hl=>`Ethics experts say the standard is clear — the campaign falls short`,
      hl=>`Damning new details emerge as the situation worsens`,
    ],
  },
  endorsement:{
    favored:[
      hl=>`Landmark backing secured — seismic shift in race dynamics as major figures align`,
      hl=>`Endorsement seen as decisive validation of the campaign vision`,
      hl=>`Strong signal sent to the party establishment as key allies commit`,
      hl=>`Organizers call it game-changing for key battleground outreach`,
    ],
    neutral:[
      hl=>`${hl}`,
      hl=>`Endorsement news: ${hl}`,
      hl=>`Notable backing: ${hl}`,
    ],
    hostile:[
      hl=>`Critics say the endorsement reflects insider horse-trading, not grassroots support`,
      hl=>`Contested backing sparks dissent within parts of the coalition`,
      hl=>`Grassroots activists question whether the establishment is hijacking the race`,
      hl=>`Not everyone is cheering — pushback from unexpected corners of the party`,
    ],
  },
  economy:{
    favored:[
      hl=>`Economic experts back the campaign vision — working families see a real solution`,
      hl=>`Economists: bold agenda needed to address root causes of inequality`,
      hl=>`New study: proposed economic policies would add millions of jobs`,
      hl=>`Small business owners in key states cautiously optimistic about the economic platform`,
      hl=>`Labor leaders endorse the approach as a historic investment in workers`,
    ],
    neutral:[
      hl=>`${hl}`,
      hl=>`Economy watch: ${hl}`,
      hl=>`Markets and politics: ${hl}`,
    ],
    hostile:[
      hl=>`Economists warn proposed spending plan risks ballooning the deficit`,
      hl=>`Business community alarmed — analysts signal concern over the economic agenda`,
      hl=>`Tax and spend approach raises red flags for fiscal conservatives`,
      hl=>`Chamber of Commerce warns proposed policies would hurt small businesses nationwide`,
      hl=>`Markets uneasy as uncertainty clouds the economic outlook`,
    ],
  },
  event:{
    favored:[
      hl=>`Response praised as decisive and empathetic leadership in a difficult moment`,
      hl=>`Progressive coalition sees an opening — the contrast with the opponent is stark`,
      hl=>`Crisis moment reveals character: calm, decisive, and prepared`,
      hl=>`Handling of the situation wins rare bipartisan praise`,
    ],
    neutral:[
      hl=>`${hl}`,
      hl=>`Breaking: ${hl}`,
      hl=>`Developing story: ${hl}`,
    ],
    hostile:[
      hl=>`Critics say the response was tone-deaf and dangerously delayed`,
      hl=>`Leadership test failed — opposition hammers the campaign for the handling`,
      hl=>`Voters take note — fitness-for-office questions raised by multiple analysts`,
      hl=>`Inadequate response draws sharp criticism from across the political spectrum`,
    ],
  },
};

// Generate party-aware framings for a headline
function generateFramings(hl, tag){
  const pool = NEWS_POOL[tag] || NEWS_POOL.event;
  const party = typeof GS !== 'undefined' ? (GS.playerParty||'dem') : 'dem';

  // Pick random variant from each pool
  const pick = (arr) => {
    const fn = arr[Math.floor(Math.random()*arr.length)];
    return typeof fn === 'function' ? fn(hl) : hl;
  };

  const favoredText = pick(pool.favored);
  const neutralText = pick(pool.neutral);
  const hostileText = pick(pool.hostile);

  // For Dem player: LEFT=favored, RIGHT=hostile
  // For Rep player: RIGHT=favored, LEFT=hostile
  if(party === 'dem'){
    return { left: favoredText, neutral: neutralText, right: hostileText };
  } else {
    return { left: hostileText, neutral: neutralText, right: favoredText };
  }
}


function addNews(hl, tag){
  const framings = generateFramings(hl, tag);
  GS.newsItems.push({
    hl,         // neutral headline (canonical)
    tag,
    wk:`Wk ${GS.week}`,
    framings,   // {left, neutral, right}
    frame: 1,   // 0=left 1=neutral 2=right — default neutral
  });
  if(GS.newsItems.length>60) GS.newsItems.shift();
}

function cycleNewsFrame(idx){
  const item=GS.newsItems[GS.newsItems.length-1-idx]; // reversed display order
  if(!item||!item.framings)return;
  item.frame=(item.frame+1)%3;
  renderNews();
}


// Called once per week turn to compute and cache who leads each state in the primary.
// Never called during render — prevents color flicker.
function computePrimaryLeaders(){
  GS.states.forEach(s=>{
    const active=GS.aiCandidates.filter(a=>a.active);
    const playerScore = GS.favorability + (s.primLead||0);
    const regional = (GS._aiRegional||{})[s.code]||{};
    const pool=[
      {score: playerScore, id:'player', color:'#c8a84b'},
      ...active.map(a=>{
        const regionBonus = (regional[a.id]||0) * (a.approval/40);
        return {score: a.approval + regionBonus, id:a.id, color: a.color};
      })
    ];
    pool.sort((a,b)=>b.score-a.score);
    const rawMargin = pool[0].score - (pool[1] ? pool[1].score : 0);
    const prevLeader = s._primaryLeader;

    // INERTIA: challenger needs a meaningful margin to flip a held state.
    // First turn (no prevLeader) → assign freely.
    // To flip: challenger's lead must exceed threshold (harder on low-volatility states).
    const flipThreshold = 9 + (1 - (s.vol||0.5)) * 6; // 9–15 pts depending on state volatility
    if(!prevLeader){
      // First assignment — no inertia
      s._primaryLeader = pool[0].id;
      s._primaryLeaderColor = pool[0].color;
    } else if(pool[0].id === prevLeader){
      // Incumbent stays — no threshold needed
      s._primaryLeader = pool[0].id;
      s._primaryLeaderColor = pool[0].color;
    } else {
      // Challenger trying to flip — only succeeds if margin exceeds threshold
      if(rawMargin >= flipThreshold){
        s._primaryLeader = pool[0].id;
        s._primaryLeaderColor = pool[0].color;
      }
      // else: incumbent silently holds, even if technically behind
    }
    s._primaryMargin = rawMargin; // always store raw for display
  });
}

// Primary map: always reads stable cached color — zero randomness during render
function primFillColor(stateCode){
  const s=GS.states.find(x=>x.code===stateCode);
  if(!s) return '#2d3748';
  // _primaryLeaderColor is computed by computePrimaryLeaders() each turn from actual scores
  // gold (#c8a84b) = player leading; AI colour = that AI is leading
  return s._primaryLeaderColor || '#2d3748';
}
// General map colour = player's lead (positive = player winning)
// We use player-party-aware labels so blue = player winning when Dem, red = player winning when Rep
// Returns a direct hex color so there is NEVER confusion about player vs opponent
// -----------------------------------------------------------------------
// 🎨 MAP COLOUR CONFIGURATION — Edit these hex values to change map colours
// -----------------------------------------------------------------------
const MAP_COLORS = {
  // ── REPUBLICAN (Red) shades ──────────────────────────────────────────
  rep_safe: '#c0392b',      // Safe R   — solid red (>15pt lead)     [was #7f1d1d]
  rep_lean: '#f0a0a0',      // Lean R   — light rose (5–15pt lead)   [was #fca5a5]
  // ── DEMOCRAT (Blue) shades ───────────────────────────────────────────
  dem_safe: '#1e3a8a',      // Safe D   — dark navy blue (>15pt lead)
  dem_lean: '#93c5fd',      // Lean D   — light blue (5–15pt lead)
  // ── TOSS-UP ──────────────────────────────────────────────────────────
  tossup:   '#6b7280',      // Toss-up  — neutral gray (within ±5pts)
};
// -----------------------------------------------------------------------

// Helper: darken a hex color by a percentage (0-100)
function darkenColor(hex, percent){
  // Parse hex to RGB
  let r = parseInt(hex.slice(1,3), 16);
  let g = parseInt(hex.slice(3,5), 16);
  let b = parseInt(hex.slice(5,7), 16);
  // Darken by reducing brightness
  const factor = 1 - (percent / 100);
  r = Math.round(r * factor);
  g = Math.round(g * factor);
  b = Math.round(b * factor);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function genMapColor(lead, playerParty, stateLean, stateCode){
  // positive lead = player winning, negative = opponent winning
  const isDem = playerParty === 'dem';
  const isInd = playerParty === 'ind';
  const baseColor = GS.playerPartyColor || '#a855f7';
  const designatedTossup = isDesignatedTossupState(stateCode);
  const safeBand = 15;
  const leanBand = 4;
  // Generate darker (safe) and lighter (lean) shades from the base custom color
  const indSafe = isInd ? darkenColor(baseColor, 25) : MAP_COLORS.dem_safe;
  const indLean = isInd ? baseColor : MAP_COLORS.dem_lean;
  if(isInd){
    if(designatedTossup && Math.abs(lead) < 6) return MAP_COLORS.tossup;
    if(lead >=  safeBand) return indSafe;
    if(lead >=  leanBand) return indLean;
    if(lead >  -leanBand){
      const lean = stateLean || 0;
      if(Math.abs(lean) <= 2) return MAP_COLORS.tossup;
      return lean > 0 ? MAP_COLORS.dem_lean : MAP_COLORS.rep_lean;
    }
    const lean = stateLean || 0;
    if(lead <= -safeBand) return lean >= 0 ? MAP_COLORS.dem_safe : MAP_COLORS.rep_safe;
    return lean >= 0 ? MAP_COLORS.dem_lean : MAP_COLORS.rep_lean;
  }
  // Dem/Rep: gray only for designated tossup states that are genuinely close.
  if(designatedTossup && Math.abs(lead) < 6) return MAP_COLORS.tossup;
  if(lead >= safeBand) return isDem ? MAP_COLORS.dem_safe : MAP_COLORS.rep_safe;
  if(lead >= leanBand) return isDem ? MAP_COLORS.dem_lean : MAP_COLORS.rep_lean;
  if(lead > -leanBand){
    // Non-designated states in tiny margins still show their underlying partisan pull.
    if(stateLean > 2) return MAP_COLORS.dem_lean;
    if(stateLean < -2) return MAP_COLORS.rep_lean;
    return isDem ? MAP_COLORS.dem_lean : MAP_COLORS.rep_lean;
  }
  if(lead > -safeBand) return isDem ? MAP_COLORS.rep_lean : MAP_COLORS.dem_lean;
  return isDem ? MAP_COLORS.rep_safe : MAP_COLORS.dem_safe;
}
function genMapClass(lead,playerParty){ return ''; } // unused — kept for compat
function leanLabel(lead,playerParty){
  const isInd = playerParty==='ind';
  const pParty=playerParty==='dem'?'D':playerParty==='rep'?'R':'Ind';
  const oParty=playerParty==='dem'?'R':'D';
  if(lead>15)  return isInd?'Safe Ind':`Safe ${pParty}`;
  if(lead>5)   return isInd?'Lean Ind':`Lean ${pParty}`;
  if(lead>-5)  return'Toss-Up';
  if(lead>-15) return isInd?'Lean Opp':`Lean ${oParty}`;
  return isInd?'Safe Opp':`Safe ${oParty}`;
}
function pathCenter(d){
  // Use the largest sub-path (for multi-body states like MI) 
  // then compute polygon centroid (area-weighted centre of mass)
  const subpaths = d.split('M').filter(Boolean).map(s=>'M'+s);
  // pick biggest subpath by char length
  const main = subpaths.sort((a,b)=>b.length-a.length)[0];
  const ns = main.match(/-?\d+\.?\d*/g)||[];
  const pts=[];
  for(let i=0;i+1<ns.length;i+=2) pts.push([+ns[i],+ns[i+1]]);
  if(pts.length<3) return{x:0,y:0};
  // Shoelace centroid
  let A=0,cx=0,cy=0;
  for(let i=0,n=pts.length;i<n;i++){
    const [x0,y0]=pts[i],[x1,y1]=pts[(i+1)%n];
    const cross=x0*y1-x1*y0;
    A+=cross; cx+=(x0+x1)*cross; cy+=(y0+y1)*cross;
  }
  A/=2;
  if(Math.abs(A)<1e-6){
    // degenerate — fall back to bounding-box centre
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
  }
  return{x:cx/(6*A),y:cy/(6*A)};
}

// ── SETUP ──
let selParty='dem',selDiff='easy',selCareer='senator';

// ------------------------------------------------------------------
//  HISTORICAL YEAR DATA — Real primary competitors + general winner
//  Used when player picks a specific election year at game setup.
// ------------------------------------------------------------------
const ELECTION_YEAR_DATA = {
  '1980': {
    label:'1980 — Reagan vs. Carter',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'Pres. J. Carter',      approval:48,funds:45,color:'#f97316',delegates:0,active:true}, // incumbent = favourite
        {id:'ai1',name:'Sen. E. Kennedy',       approval:54,funds:38,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Gov. J. Brown',         approval:36,funds:22,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'VP W. Mondale',         approval:31,funds:18,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Gov. R. Reagan',    party:'rep',funds:75,approval:55,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Gov. R. Reagan',        approval:58,funds:55,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Gov. G. H. W. Bush',   approval:48,funds:32,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Sen. H. Baker',         approval:38,funds:22,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Rep. J. Anderson',      approval:33,funds:18,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. J. Carter',   party:'dem',funds:60,approval:41,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '1984': {
    label:'1984 — Reagan vs. Mondale',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'VP W. Mondale',         approval:52,funds:42,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. G. Hart',          approval:48,funds:28,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Rev. J. Jackson',       approval:40,funds:20,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Sen. J. Glenn',         approval:32,funds:18,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. R. Reagan',   party:'rep',funds:90,approval:58,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [],
      generalOpponent:{name:'VP W. Mondale',      party:'dem',funds:55,approval:43,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '1988': {
    label:'1988 — Bush vs. Dukakis',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'Gov. M. Dukakis',       approval:50,funds:38,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Rev. J. Jackson',       approval:46,funds:26,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Sen. R. Gephardt',      approval:36,funds:22,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Sen. P. Simon',         approval:28,funds:15,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'VP G. H. W. Bush',  party:'rep',funds:80,approval:54,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'VP G. H. W. Bush',     approval:54,funds:42,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. B. Dole',          approval:46,funds:30,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Rev. P. Robertson',     approval:34,funds:20,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Rep. J. Kemp',          approval:28,funds:16,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Gov. M. Dukakis',   party:'dem',funds:58,approval:45,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '1992': {
    label:'1992 — Clinton vs. Bush',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'Gov. B. Clinton',       approval:46,funds:36,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. P. Tsongas',       approval:44,funds:24,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Sen. B. Kerrey',        approval:36,funds:20,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Ex-Gov. J. Brown',      approval:32,funds:14,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. G. H. W. Bush',party:'rep',funds:68,approval:41,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Pres. G. H. W. Bush',  approval:52,funds:55,color:'#f97316',delegates:0,active:true}, // incumbent winner
        {id:'ai1',name:'P. Buchanan',           approval:42,funds:22,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'D. Duke',               approval:24,funds:10,color:'#f472b6',delegates:0,active:true},
      ],
      generalOpponent:{name:'Gov. B. Clinton',   party:'dem',funds:62,approval:50,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '1996': {
    label:'1996 — Clinton vs. Dole',
    dem: {
      primaryRivals: [],
      generalOpponent:{name:'Sen. B. Dole',       party:'rep',funds:70,approval:46,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Sen. B. Dole',          approval:52,funds:42,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'P. Buchanan',           approval:42,funds:22,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Gov. L. Alexander',     approval:34,funds:18,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Rep. S. Forbes',        approval:30,funds:28,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. B. Clinton',  party:'dem',funds:78,approval:55,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2000': {
    label:'2000 — Bush vs. Gore',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'VP A. Gore',            approval:52,funds:48,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. B. Bradley',       approval:44,funds:28,color:'#22d3ee',delegates:0,active:true},
      ],
      generalOpponent:{name:'Gov. G. W. Bush',   party:'rep',funds:80,approval:50,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Gov. G. W. Bush',       approval:56,funds:60,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. J. McCain',        approval:50,funds:30,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Ex-Amb. A. Keyes',      approval:26,funds:10,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'P. Buchanan',           approval:22,funds:12,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'VP A. Gore',        party:'dem',funds:72,approval:49,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2004': {
    label:'2004 — Bush vs. Kerry',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'Sen. J. Kerry',         approval:50,funds:42,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. J. Edwards',       approval:46,funds:28,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Gov. H. Dean',          approval:44,funds:32,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Rep. D. Kucinich',      approval:22,funds:8, color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. G. W. Bush',  party:'rep',funds:90,approval:50,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [],
      generalOpponent:{name:'Sen. J. Kerry',     party:'dem',funds:68,approval:47,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2008': {
    label:'2008 — Obama vs. McCain',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'Sen. B. Obama',         approval:52,funds:52,color:'#f97316',delegates:0,active:true}, // winner
      ],
      generalOpponent:{name:'Sen. J. McCain',    party:'rep',funds:74,approval:46,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Sen. J. McCain',        approval:52,funds:38,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Gov. M. Romney',        approval:48,funds:42,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Gov. M. Huckabee',      approval:40,funds:18,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Rep. R. Paul',          approval:28,funds:20,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Sen. B. Obama',     party:'dem',funds:88,approval:52,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2012': {
    label:'2012 — Obama vs. Romney',
    dem: {
      primaryRivals: [],
      generalOpponent:{name:'Gov. M. Romney',    party:'rep',funds:82,approval:48,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Gov. M. Romney',        approval:52,funds:48,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. R. Santorum',      approval:42,funds:16,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Rep. N. Gingrich',      approval:40,funds:20,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Rep. R. Paul',          approval:30,funds:18,color:'#84cc16',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. B. Obama',    party:'dem',funds:88,approval:51,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2016': {
    label:'2016 — Trump vs. Clinton',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'Sec. H. Clinton',       approval:55,funds:52,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. B. Sanders',       approval:52,funds:38,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Gov. M. O\'Malley',    approval:24,funds:10,color:'#f472b6',delegates:0,active:true},
      ],
      generalOpponent:{name:'D. Trump',          party:'rep',funds:70,approval:44,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'D. Trump',              approval:48,funds:38,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. T. Cruz',          approval:46,funds:32,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Sen. M. Rubio',         approval:42,funds:30,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Gov. J. Bush',          approval:38,funds:45,color:'#84cc16',delegates:0,active:true},
        {id:'ai4',name:'Gov. J. Kasich',        approval:32,funds:16,color:'#fb923c',delegates:0,active:true},
      ],
      generalOpponent:{name:'Sec. H. Clinton',   party:'dem',funds:80,approval:48,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2020': {
    label:'2020 — Biden vs. Trump',
    dem: {
      primaryRivals: [
        {id:'ai0',name:'VP J. Biden',           approval:52,funds:46,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Sen. B. Sanders',       approval:50,funds:40,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Sen. E. Warren',        approval:44,funds:30,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'Mayor P. Buttigieg',    approval:34,funds:22,color:'#84cc16',delegates:0,active:true},
        {id:'ai4',name:'Sen. K. Harris',        approval:32,funds:20,color:'#fb923c',delegates:0,active:true},
      ],
      generalOpponent:{name:'Pres. D. Trump',    party:'rep',funds:90,approval:46,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'Pres. D. Trump',        approval:72,funds:80,color:'#f97316',delegates:0,active:true}, // incumbent winner
        {id:'ai1',name:'Gov. W. Weld',          approval:28,funds:8, color:'#22d3ee',delegates:0,active:true},
      ],
      generalOpponent:{name:'VP J. Biden',       party:'dem',funds:75,approval:51,color:'#3b82f6',delegates:0,active:true},
    },
  },
  '2024': {
    label:'2024 — Harris vs. Trump',
    dem: {
      primaryRivals: [],
      generalOpponent:{name:'D. Trump',          party:'rep',funds:90,approval:47,color:'#ef4444',delegates:0,active:true},
    },
    rep: {
      primaryRivals: [
        {id:'ai0',name:'D. Trump',              approval:62,funds:72,color:'#f97316',delegates:0,active:true}, // winner
        {id:'ai1',name:'Gov. R. DeSantis',      approval:48,funds:40,color:'#22d3ee',delegates:0,active:true},
        {id:'ai2',name:'Amb. N. Haley',         approval:40,funds:28,color:'#f472b6',delegates:0,active:true},
        {id:'ai3',name:'VP M. Pence',           approval:32,funds:18,color:'#84cc16',delegates:0,active:true},
        {id:'ai4',name:'Sen. T. Scott',         approval:26,funds:14,color:'#fb923c',delegates:0,active:true},
      ],
      generalOpponent:{name:'VP K. Harris',      party:'dem',funds:72,approval:47,color:'#3b82f6',delegates:0,active:true},
    },
  },
};

// Returns year data for the currently selected election year, or null for custom/future
function getSelectedYearData(){
  const yearEl = document.getElementById('election-year');
  if(!yearEl) return null;
  const val = yearEl.value;
  if(val==='custom') return null;
  return ELECTION_YEAR_DATA[val] || null;
}

function onElectionYearChange(){
  const yearEl = document.getElementById('election-year');
  const customYearRow = document.getElementById('custom-year-row');
  const noteEl = document.getElementById('year-opponent-note');
  if(!yearEl) return;
  const val = yearEl.value;
  // Show/hide custom year input
  if(customYearRow) customYearRow.style.display = (val==='custom') ? 'block' : 'none';
  if(!noteEl) return;
  const yd = ELECTION_YEAR_DATA[val];
  if(!yd){
    noteEl.textContent = val==='custom'
      ? '⚡ Custom year — generic opponents. Write your own history.'
      : '';
    return;
  }
  // Custom party skips the primary entirely — show a special note
  if(selParty==='custom'){
    noteEl.innerHTML = `<span style="color:var(--accent)">📅 ${yd.label}</span><br><span style="color:#a855f7">⚡ Custom party — skips primary. You enter the <b>General Election</b> directly facing both the Democratic and Republican nominees.</span>`;
    return;
  }
  // Show party-specific note based on current selParty
  const partyKey = (selParty==='rep') ? 'rep' : 'dem';
  const pd = yd[partyKey];
  const rivals = pd.primaryRivals;
  const opp = pd.generalOpponent;
  let rivalStr;
  if(rivals.length){
    rivalStr = `Primary vs: ${rivals.map(r=>r.name).join(', ')}`;
  } else {
    rivalStr = `⚔- Primary challenge vs: <b>${opp.name}</b> (heavily favoured)`;
  }
  noteEl.innerHTML = `<span style="color:var(--accent)">📅 ${yd.label}</span><br>${rivalStr}<br>General opponent: <b>${opp.name}</b>`;
}



// ── POTUS EASTER EGG — 5 clicks on the P reveals dev console ──
let _potusClicks=0,_potusTimer=null;
function potusClick(){
  // Dev panel now opens with F7 x5
  const p=document.getElementById('potus-p');
  if(p){p.style.opacity='0.4';setTimeout(()=>p.style.opacity='1',120);}
}

function selectSimPreset(btn, env){
  document.getElementById('sim-env').value = env;
  document.querySelectorAll('.sim-preset-btn').forEach(b=>{
    b.style.border='1px solid var(--border)';
    b.style.background='transparent';
    b.style.color='var(--text2)';
    b.classList.remove('active');
  });
  btn.style.border='1px solid var(--accent)';
  btn.style.background='rgba(200,168,75,.1)';
  btn.style.color='var(--accent)';
  btn.classList.add('active');
}

// ── QUICK ELECTION SIMULATOR ──────────────────────────────────────────────────
// ── ELECTION SIMULATOR PRESET PACKAGES ─────────────────────────────────────
const SIM_PRESETS = {
  neutral:   { envShift:0,   volatility:1.0, turnoutM:150, label:'Neutral Environment' },
  dem:       { envShift:3,   volatility:0.7, turnoutM:158, label:'Democratic Wave' },
  rep:       { envShift:-3,  volatility:0.7, turnoutM:142, label:'Republican Wave' },
  volatile:  { envShift:0,   volatility:2.2, turnoutM:148, label:'Volatile/Unpredictable' },
  wave2008:  { envShift:5,   volatility:0.5, turnoutM:163, label:'2008-style Wave' },
  upset2016: { envShift:-1,  volatility:2.5, turnoutM:138, label:'2016-style Upset Climate' },
  econ:      { envShift:-2.5,volatility:1.4, turnoutM:145, label:'Economic Crisis' },
  fatigue:   { envShift:-1.8,volatility:1.6, turnoutM:140, label:'Incumbent Fatigue' },
};

// Photo cycling for quick sim
const SIM_PHOTOS = ['midage-white-female.jpg','old-white-man.jpg','young-black-man.jpg','young-asian-female.jpg','midage-white-man.png'];
var _simDemPhotoIdx = 0, _simRepPhotoIdx = 4;

function updateSimIncumbent(changed){
  // Mutual exclusivity
  if(changed === 'dem' && document.getElementById('sim-dem-incumbent').checked){
    document.getElementById('sim-rep-incumbent').checked = false;
  } else if(changed === 'rep' && document.getElementById('sim-rep-incumbent').checked){
    document.getElementById('sim-dem-incumbent').checked = false;
  }
  const anyIncumbent = document.getElementById('sim-dem-incumbent').checked || document.getElementById('sim-rep-incumbent').checked;
  document.getElementById('sim-incumbent-panel').style.display = anyIncumbent ? 'block' : 'none';
  if(anyIncumbent) updateSimApprovalLabel();
}

function updateSimApprovalLabel(){
  const val = parseInt(document.getElementById('sim-incumbent-approval').value);
  document.getElementById('sim-approval-val').textContent = val + '%';
  let ctx;
  if(val >= 55) ctx = 'Strong approval — incumbent has clear advantage';
  else if(val >= 50) ctx = 'Above water — slight incumbent advantage';
  else if(val >= 46) ctx = 'Underwater — challenger has wind at back';
  else if(val >= 40) ctx = 'Struggling — significant headwinds for incumbent';
  else ctx = 'Deeply unpopular — historically unfavorable position';
  document.getElementById('sim-approval-context').textContent = ctx;
}

function updateSimThirdStrLabel(){
  const v = parseInt(document.getElementById('sim-third-strength').value);
  document.getElementById('sim-third-str-val').textContent = v+'%';
  const note = v >= 30 ? '⚡ At this level they could deny both major parties 270 — contingent election possible.' :
               v >= 20 ? '🗺- Strong enough to win multiple states. Could play kingmaker.' :
               v >= 14 ? 'Could flip a swing state or two.' :
               'Minor spoiler — drains votes from both sides.';
  const el = document.getElementById('sim-third-note');
  if(el) el.textContent = note;
}

function updateSimThirdParty(){
  const on = document.getElementById('sim-third-toggle').checked;
  document.getElementById('sim-third-panel').style.display = on ? 'block' : 'none';
}

function runElectionSimulator(){
  const demName=document.getElementById('sim-dem-name').value.trim()||'Democrat';
  const repName=document.getElementById('sim-rep-name').value.trim()||'Republican';
  const demStr=parseInt(document.getElementById('sim-dem-strength').value)||50;
  const repStr=parseInt(document.getElementById('sim-rep-strength').value)||50;
  const envKey=document.getElementById('sim-env').value;
  const preset = SIM_PRESETS[envKey] || SIM_PRESETS.neutral;

  // Incumbent settings
  const demIncumbent = document.getElementById('sim-dem-incumbent')?.checked || false;
  const repIncumbent = document.getElementById('sim-rep-incumbent')?.checked || false;
  const incumbApproval = parseInt(document.getElementById('sim-incumbent-approval')?.value || 47);
  const incumbMod = (demIncumbent || repIncumbent) ? (incumbApproval - 50) * 0.14 : 0;
  const incumbShift = demIncumbent ? incumbMod : (repIncumbent ? -incumbMod : 0);

  // Third party — popularity model, not vote share
  const thirdEnabled = document.getElementById('sim-third-toggle')?.checked || false;
  const thirdName = document.getElementById('sim-third-name')?.value.trim() || 'Independent';
  const thirdPop = parseInt(document.getElementById('sim-third-strength')?.value || 8);
  // Popularity translates to competitiveness: at 35% they can win states in their strong regions
  // Impact on major parties: drains from both, slightly more from stronger candidate
  const thirdDemDrain = thirdEnabled ? -(thirdPop * 0.015 * (demStr >= repStr ? 1.15 : 0.85)) : 0;
  const thirdRepDrain = thirdEnabled ? -(thirdPop * 0.015 * (repStr > demStr ? 1.15 : 0.85)) : 0;
  // Third party can WIN a state if popularity ≥ 15 — chance scales with popularity
  const thirdCanWin = thirdEnabled && thirdPop >= 15;
  // The threshold is how close the major-party margin must be for the third party to steal it.
  // At 15% pop: only wins if margin < ~2 (razor-thin races only)
  // At 25% pop: wins if margin < ~9 (genuine swing states)
  // At 35% pop: wins if margin < ~16 (many competitive states)
  const thirdWinThreshold = thirdCanWin ? Math.max(0, (thirdPop - 12) * 0.7) : -999;

  // Candidate photos from library
  const demPhoto = (_photoLibrary[_simDemPhotoIdx] || _photoLibrary[0]).url;
  const repPhoto = (_photoLibrary[_simRepPhotoIdx] || _photoLibrary[0]).url;

  const {envShift, volatility, turnoutM} = preset;
  const totalEnvShift = envShift + incumbShift;

  // Compute state results — three-way race
  const simStates = STATE_DATA.map(s=>{
    const demAdvantage = ((demStr-repStr)*0.35) + totalEnvShift + thirdDemDrain - thirdRepDrain;
    const stateMargin  = s.lean*0.38 + demAdvantage + G(0, s.vol*13*volatility);
    const stateVotes = Math.round((s.ev/538) * turnoutM * 1000000 * (0.8+Math.random()*0.4));

    // Third party win logic — swing states and close races are most vulnerable
    let winner = stateMargin > 0 ? 'dem' : 'rep';
    let finalMargin = stateMargin;
    if(thirdCanWin && Math.abs(stateMargin) < thirdWinThreshold + G(0,4)){
      // Contested state — third party grabs it
      winner = 'third';
      finalMargin = 0;
    }

    const demWins = winner === 'dem';
    const thirdWins = winner === 'third';
    const winPct = cl(50 + Math.abs(finalMargin)*0.42, 50.2, 74);
    const winV   = Math.round(stateVotes * winPct/100);
    const loseV  = stateVotes - winV;
    return { ...s, finalLead: stateMargin, demWins, thirdWins,
      _simVotes: stateVotes, _simWinPct: winPct,
      _simDemV: demWins ? winV : loseV, _simRepV: demWins ? loseV : winV };
  });

  const demEV  = simStates.filter(s=>s.demWins).reduce((a,s)=>a+s.ev,0);
  const repEV  = simStates.filter(s=>!s.demWins&&!s.thirdWins).reduce((a,s)=>a+s.ev,0);
  const thirdEV= simStates.filter(s=>s.thirdWins).reduce((a,s)=>a+s.ev,0);
  const noMajority = thirdEnabled && (demEV < 270 && repEV < 270);

  // Store sim context globally
  window._SIM = { demName, repName, states: simStates,
    preset, active: true, envKey, demStr, repStr,
    demIncumbent, repIncumbent, incumbApproval,
    thirdEnabled, thirdName, thirdPop, thirdEV,
    demEV, repEV, noMajority,
    demPhoto, repPhoto };

  launchSimElectionNight();
}

function launchSimElectionNight(){
  const sim = window._SIM;
  if(!sim) return;

  // Temporarily patch GS enough for EN to render
  const savedPhase = GS.phase;
  const savedOpponent = GS.opponent;
  const savedStates = GS.states;
  const savedPlayerParty = GS.playerParty;
  const savedPlayerName = GS.playerName;

  GS.playerParty = 'dem'; // Dem name always on left in sim
  GS.playerName  = sim.demName;
  GS.opponent    = { name: sim.repName, approval: 44 };
  GS.phase       = 'general';
  GS.states      = sim.states.map(s=>({...s})); // shallow copy

  showScreen('electionnight-screen');
  EN = { demEV:0, repEV:0, indPlayerEV:0, thirdEV:0, called:{}, ctc:new Set(), timers:[], playerPop:0, oppPop:0, oppPopMap:{},
         queue:[], queueIndex:0, winnerShown:false, _ctcQueue:[], _retractionCandidates:[] };

  buildENMap();
  initENCongressBoard();
  document.getElementById('en-dem-name').textContent = sim.demName.split(' ').slice(-1)[0]+' (D)';
  document.getElementById('en-rep-name').textContent = sim.repName.split(' ').slice(-1)[0]+' (R)';

  // Update broadcast headline for sim mode
  const headlineMain = document.getElementById('en-headline-main');
  if(headlineMain){
    let extra = '';
    if(sim.demIncumbent) extra = ` · ${sim.demName.split(' ').pop()} (Incumbent)`;
    else if(sim.repIncumbent) extra = ` · ${sim.repName.split(' ').pop()} (Incumbent)`;
    if(sim.thirdEnabled) extra += ` · ${sim.thirdName} (${sim.thirdPop}% popular)`;
    headlineMain.textContent = `${sim.demName} vs ${sim.repName}${extra} · ${sim.preset.label}`;
  }

  // Add preset label to EN header
  const clock = document.getElementById('en-clock');
  if(clock) clock.innerHTML = `<b>${sim.preset.label}</b> &nbsp;·&nbsp; Quick Simulator`;

  // Build queue from schedule
  EN_SCHEDULE.forEach(batch=>{
    batch.states.forEach(code=>{
      EN.queue.push({code, batchTime: batch.t});
    });
  });

  // Button-driven — no auto start
  const snb = document.getElementById('en-next-btn');
  snb.style.display='flex'; snb.textContent='▶ Call Next State';
  snb.disabled=false; snb.onclick=callNextState;
  _enBusy=false; EN._ctcQueue=[];

  // No auto-start — player presses button
}

function selectParty(p){
  selParty=p;
  const customRow = document.getElementById('custom-party-row');
  // Remove active from all party buttons
  document.querySelectorAll('.party-btn').forEach(b=>{
    b.classList.remove('active');
    b.style.outline='';
    b.style.boxShadow='';
  });
  if(p==='dem'||p==='rep'){
    // Highlight by explicit class
    const btn = document.querySelector(`.party-btn.${p}`);
    if(btn) btn.classList.add('active');
    if(customRow) customRow.style.display='none';
  } else {
    // Custom party — find button by data-party attribute first, then text fallback
    let customBtn = document.querySelector('.party-btn[data-party="custom"]');
    if(!customBtn) customBtn = document.querySelector('.party-btn[onclick*="custom"]');
    if(!customBtn){
      document.querySelectorAll('.party-btn').forEach(b=>{
        if(b.textContent.toLowerCase().includes('custom')||b.textContent.includes('⚡')) customBtn=b;
      });
    }
    if(customBtn){
      customBtn.classList.add('active');
      // Extra visual indicator so it's unmistakable
      customBtn.style.outline='2px solid var(--accent)';
      customBtn.style.boxShadow='0 0 8px rgba(200,168,75,.4)';
    }
    if(customRow) customRow.style.display='block';
  }
  // Update ideology labels — custom acts like independent (neutral labels)
  const isCustom = p==='custom';
  document.getElementById('ideology-left-label').textContent = isCustom?'Left-Populist':(p==='dem'?'Progressive':'Moderate');
  document.getElementById('ideology-right-label').textContent = isCustom?'Right-Populist':(p==='dem'?'Conservative':'MAGA/Populist');
  updateIdeologyLabel(document.getElementById('ideology-slider')?.value||50);
  // Refresh year note so rivals shown match the newly selected party
  if(typeof onElectionYearChange === 'function') onElectionYearChange();
}
function selectDiff(d){selDiff=d;document.querySelectorAll('.diff-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll(`[data-diff="${d}"]`).forEach(b=>b.classList.add('active'))}

// ── Career-specific defining moment options ──────────────────────────────────
// Every career has a "No defining moment" option at the end.
const _NO_MOMENT = { value:'none', label:'No defining moment — a fresh face' };

const CAREER_MOMENTS = {
  senator: [
    { value:'healthcare',   label:'Passed landmark healthcare reform' },
    { value:'civil_rights', label:'Championed major civil rights legislation' },
    { value:'corruption',   label:'Exposed a major corruption scandal in Congress' },
    { value:'climate',      label:'Led landmark climate agreement across party lines' },
    { value:'crisis',       label:'Guided the nation through a major crisis' },
    _NO_MOMENT,
  ],
  house: [
    { value:'corruption',   label:'Blew the whistle on congressional corruption' },
    { value:'civil_rights', label:'Championed a landmark civil rights bill' },
    { value:'healthcare',   label:'Authored the most-read healthcare reform bill' },
    { value:'economy',      label:'Passed major job creation legislation' },
    { value:'crisis',       label:'Led the House response to a national crisis' },
    _NO_MOMENT,
  ],
  governor: [
    { value:'crisis',       label:'Led state through a major natural disaster' },
    { value:'economy',      label:'Built a thriving state economy' },
    { value:'healthcare',   label:'Enacted universal healthcare in your state' },
    { value:'corruption',   label:'Cleaned up a deeply corrupt state government' },
    { value:'civil_rights', label:'Signed landmark civil rights protections into law' },
    _NO_MOMENT,
  ],
  mayor: [
    { value:'economy',      label:'Revitalised a declining city and created jobs' },
    { value:'crisis',       label:'Led city through a catastrophic emergency' },
    { value:'corruption',   label:'Exposed and dismantled a corrupt city machine' },
    { value:'civil_rights', label:'Made your city a national model for civil rights' },
    { value:'healthcare',   label:'Built city-wide public health infrastructure' },
    _NO_MOMENT,
  ],
  military: [
    { value:'military_hero',label:'Decorated combat veteran — multiple tours of duty' },
    { value:'crisis',       label:'Led military response to a humanitarian disaster' },
    { value:'corruption',   label:'Exposed Pentagon waste and contractor fraud' },
    { value:'economy',      label:'Managed a massive military modernisation program' },
    { value:'civil_rights', label:'Fought to integrate and modernise the armed forces' },
    _NO_MOMENT,
  ],
  ceo: [
    { value:'economy',      label:'Built a company that created 200,000 American jobs' },
    { value:'outsider',     label:'Never held office — true Washington outsider' },
    { value:'corruption',   label:'Blew the whistle on industry-wide corruption' },
    { value:'climate',      label:'Led your industry\'s transition to clean energy' },
    { value:'crisis',       label:'Steered a major company through a financial crisis' },
    _NO_MOMENT,
  ],
  prosecutor: [
    { value:'corruption',   label:'Prosecuted landmark political corruption case' },
    { value:'civil_rights', label:'Won landmark civil rights convictions' },
    { value:'crisis',       label:'Managed a major public safety emergency' },
    { value:'healthcare',   label:'Took down criminal healthcare fraud networks' },
    { value:'economy',      label:'Dismantled cartels strangling the local economy' },
    _NO_MOMENT,
  ],
  vp: [
    { value:'crisis',       label:'Managed a presidential crisis with steady leadership' },
    { value:'healthcare',   label:'Championed the administration\'s healthcare legacy' },
    { value:'civil_rights', label:'Broke barriers as a historic Vice President' },
    { value:'economy',      label:'Steered the economic recovery as VP' },
    { value:'corruption',   label:'Stood firm when the White House faced scandal' },
    _NO_MOMENT,
  ],
  activist: [
    { value:'civil_rights', label:'Led a historic national civil rights movement' },
    { value:'climate',      label:'Built the largest environmental movement in a generation' },
    { value:'healthcare',   label:'Campaigned for universal healthcare for 20 years' },
    { value:'corruption',   label:'Exposed systemic corruption through grassroots pressure' },
    { value:'economy',      label:'Organised the biggest labour action in modern history' },
    _NO_MOMENT,
  ],
  celebrity: [
    { value:'civil_rights', label:'Used your platform to champion civil rights globally' },
    { value:'climate',      label:'Became the face of climate action worldwide' },
    { value:'crisis',       label:'Led a major humanitarian relief effort' },
    { value:'outsider',     label:'Never held office — Hollywood outsider shaking up politics' },
    { value:'economy',      label:'Built a business empire that created thousands of jobs' },
    _NO_MOMENT,
  ],
  doctor: [
    { value:'healthcare',   label:'Pioneered a breakthrough in public health policy' },
    { value:'crisis',       label:'Led the national response to a public health emergency' },
    { value:'civil_rights', label:'Fought for healthcare equity in underserved communities' },
    { value:'corruption',   label:'Exposed corruption in the pharmaceutical industry' },
    { value:'climate',      label:'Published landmark research on climate and public health' },
    _NO_MOMENT,
  ],
  none: [
    { value:'outsider',     label:'Total outsider — no political record to attack' },
    { value:'economy',      label:'Built a successful local business from scratch' },
    { value:'crisis',       label:'Led a community through a local disaster' },
    { value:'civil_rights', label:'Community organiser turned first-time candidate' },
    _NO_MOMENT,
  ],
};

const CAREER_DESCRIPTIONS = {
  senator:    { bonus:'Electability +3',              tag:'Establishment',  desc:'Deep legislative relationships and national name recognition. Strong with party donors and media. Slightly less outsider appeal.' },
  house:      { bonus:'Ground Game +2, Media +2',     tag:'Legislator',     desc:'House experience means gritty district-level politics. Less national name recognition but strong on constituent service and coalition building.' },
  governor:   { bonus:'Ground Game +5',               tag:'Executive',      desc:'Proven executive record running a state. Strong ground game from years of statewide elections. Clear outsider bonus vs Washington.' },
  mayor:      { bonus:'Ground Game +3, Media +2',     tag:'Urban',          desc:'City hall experience signals pragmatism and grit. Urban coalition strength, strong on local issues and retail politics.' },
  military:   { bonus:'Favorability +4, Electability +2', tag:'Outsider',   desc:'Four-star credibility and a hero narrative. Commands respect across demographics. No legislative baggage — pure outsider appeal.' },
  ceo:        { bonus:'Funds +$8M',                   tag:'Outsider',       desc:'Deep pockets and boardroom decisiveness. Business record can cut both ways — your wealth is an asset and a target.' },
  prosecutor: { bonus:'Favorability +2, Electability +3', tag:'Fighter',    desc:'Law-and-order credentials and a reputation for taking on the powerful. Strong among suburban moderates and independents.' },
  vp:         { bonus:'Electability +4, Favorability +2', tag:'Insider',    desc:'White House experience and a ready-made national network. High name recognition but tied to the previous administration\'s record.' },
  activist:   { bonus:'Ground Game +6, Favorability +1', tag:'Grassroots',  desc:'Built from the bottom up — strongest ground game of any background. Energises youth and base voters. Weak with party establishment.' },
  celebrity:  { bonus:'Media +8, Favorability +3',    tag:'Wild Card',      desc:'Massive media presence and instant name recognition. But political credibility must be earned fast — opponents will call it a stunt.' },
  doctor:     { bonus:'Favorability +3, Electability +2', tag:'Expert',     desc:'Credibility on healthcare and public health. Seen as trustworthy and non-partisan. Weak on economic messaging and foreign policy.' },
  none:       { bonus:'Favorability +1 (sympathy)',   tag:'True Outsider',  desc:'No record to attack, no favours owed to anyone. Pure Washington outsider. Hardest path — you must build everything from zero.' },
};

function updateMomentOptions(career){
  const moments = CAREER_MOMENTS[career] || CAREER_MOMENTS.senator;
  const sel = document.getElementById('moment-select');
  if(!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = moments.map(m=>`<option value="${m.value}"${m.value===currentVal?' selected':''}>${m.label}</option>`).join('');
  if(!moments.find(m=>m.value===currentVal)) sel.value = moments[0].value;
  // Update career description box
  const desc = CAREER_DESCRIPTIONS[career];
  const descEl = document.getElementById('career-desc');
  if(descEl && desc){
    descEl.style.display = 'block';
    descEl.innerHTML = `<span style="color:var(--accent);font-weight:700">${desc.tag}</span> &nbsp;·&nbsp; <span style="color:#22c55e">${desc.bonus}</span><br>${desc.desc}`;
  }
}

function selectBackstory(type, el, val){
  if(type==='career'){
    selCareer=val;
    document.querySelectorAll('#career-grid .backstory-btn').forEach(b=>b.classList.remove('active'));
    el.classList.add('active');
    updateMomentOptions(val);
  }
}

function updateIdeologyLabel(v){
  v=+v;
  let label;
  if(selParty==='dem'){
    if(v<20) label='Democratic Socialist';
    else if(v<40) label='Progressive';
    else if(v<60) label='Moderate Democrat';
    else if(v<80) label='Center-Left';
    else label='Blue Dog Democrat';
  } else if(selParty==='rep'){
    if(v<20) label='Libertarian-Leaning';
    else if(v<40) label='Traditional Conservative';
    else if(v<60) label='Moderate Republican';
    else if(v<80) label='MAGA Populist';
    else label='Hardline MAGA';
  } else {
    // Custom / independent spectrum
    if(v<20) label='Left Populist';
    else if(v<40) label='Progressive Independent';
    else if(v<60) label='Centrist Independent';
    else if(v<80) label='Right-Leaning Independent';
    else label='Right Populist';
  }
  document.getElementById('ideology-label').textContent=label;
}

function goToStep2(){
  const name = document.getElementById('player-name').value||'Alex Morgan';
  const partyLabel = selParty==='dem'?'Democratic':selParty==='rep'?'Republican':(document.getElementById('custom-party-name')?.value.trim()||'Independent');
  document.getElementById('step2-eyebrow').textContent = partyLabel + ' Candidate for President';
  document.getElementById('step2-name').textContent = name;
  document.getElementById('setup-step1').style.display='none';
  document.getElementById('setup-step2').style.display='';
  document.getElementById('setup-step2').classList.add('animate-in');
  updateIdeologyLabel(50);
  // Populate moment options and career desc for current career (default: senator)
  updateMomentOptions(selCareer||'senator');
}

function goToStep1(){
  document.getElementById('setup-step2').style.display='none';
  document.getElementById('setup-step1').style.display='';
}

// ── HISTORICAL ELECTIONS — open year picker directly, skip intro videos ──
// Called by the "Historical Elections" button on the main menu.
// game-historical.js may not be present; this stub handles the full flow
// gracefully without requiring video files.
function openHistoricalElections(){
  // If the dedicated historical module is loaded, hand off to it.
  if(typeof _histActive !== 'undefined' && typeof initHistoricalMode === 'function'){
    initHistoricalMode();
    return;
  }
  // Fallback: just open the normal setup screen with the election-year
  // dropdown pre-focused so the player picks a real year, then plays
  // a full career-mode game against the real historical field.
  const setupEl = document.getElementById('setup-screen') ||
                  document.getElementById('setup-step1')?.closest('.screen');
  if(setupEl){
    // Show the setup screen
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    setupEl.classList.add('active');
    // Make sure step 1 is visible
    const s1 = document.getElementById('setup-step1');
    const s2 = document.getElementById('setup-step2');
    const s3 = document.getElementById('setup-step3');
    const s4 = document.getElementById('setup-step4');
    if(s1){ s1.style.display=''; }
    if(s2){ s2.style.display='none'; }
    if(s3){ s3.style.display='none'; }
    if(s4){ s4.style.display='none'; }
  }
  // Focus and highlight the election-year dropdown so it's obvious
  const yearEl = document.getElementById('election-year');
  if(yearEl){
    // Default to first real historical year instead of 'custom'
    if(yearEl.value==='custom'||!yearEl.value){
      // Pick the earliest option that's a real year
      const firstReal = Array.from(yearEl.options).find(o=>o.value!=='custom'&&o.value);
      if(firstReal) yearEl.value = firstReal.value;
    }
    setTimeout(()=>{
      yearEl.focus();
      yearEl.style.outline='2px solid var(--accent)';
      yearEl.style.boxShadow='0 0 8px rgba(200,168,75,.5)';
      setTimeout(()=>{ yearEl.style.outline=''; yearEl.style.boxShadow=''; }, 2500);
    }, 120);
    onElectionYearChange();
  }
  // Show a brief banner so the player knows historical mode is active
  const banner = document.createElement('div');
  banner.style.cssText='position:fixed;top:18px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid var(--accent);border-radius:8px;padding:10px 20px;color:var(--accent);font-family:var(--font-mono);font-size:12px;z-index:9999;letter-spacing:.05em;box-shadow:0 4px 20px rgba(0,0,0,.5);pointer-events:none';
  banner.textContent='📅 HISTORICAL ELECTIONS — Pick a year and write your own history';
  document.body.appendChild(banner);
  setTimeout(()=>banner.remove(), 3000);
}

function _buildThirdPartyNewsArticle({name, firstName, lastName, sName, party, careerLabel, ideologyDesc, momentText, slogan, sloganLine, customPartyName, customPartyColor, customPartyIcon}){
  const partyDisplayName = customPartyName || 'Independence Party';
  const partyIcon = customPartyIcon || '⚡';
  const dateStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric'});
  const byline = `By Staff Reporter | Washington Bureau  ·  ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`;

  const headlineVariants = [
    `${name} Launches Third-Party Bid — Two-Party System Under Threat`,
    `${name} Announces ${partyDisplayName} Run — Washington Shaken`,
    `${name} Goes Independent — \"Both Parties Have Failed You\"`,
    `${partyDisplayName} Is Here: ${name} Throws Down Gauntlet to Major Parties`,
    `${name} Breaks From Both Parties — The Race Just Got Unpredictable`,
  ];
  const headline = headlineVariants[Math.floor(Math.random()*headlineVariants.length)];
  const kicker = `🔴 BREAKING — ${partyDisplayName.toUpperCase()} PRESIDENTIAL ANNOUNCEMENT`;

  const col1Variants = [
    `<p><strong>${name.toUpperCase()}</strong>, the ${careerLabel} from ${sName}, formally launched a presidential campaign under the banner of the <strong>${partyDisplayName}</strong> on ${dateStr}, declaring that the American two-party system has failed ordinary voters.</p>
<p style="margin-top:12px">Standing before a crowd that included disillusioned former Democrats and Republicans alike, ${lastName} — described by allies as a ${ideologyDesc} — made clear the race will not be ceded to the major parties. The moment that crystallised the decision was ${momentText}, insiders say.</p>`,
    `<p>In a move that political operatives on both sides have privately dreaded, <strong>${name.toUpperCase()}</strong> announced a presidential run under the <strong>${partyDisplayName}</strong> flag on ${dateStr} — upending calculations that had shaped the race for months.</p>
<p style="margin-top:12px">\"Washington is broken. Both parties know it. Only one of us is willing to say it,\" ${lastName} told a packed arena in ${sName}. The ${careerLabel}, a ${ideologyDesc}, has been building toward this since ${momentText} brought them to national attention.</p>`,
    `<p>The establishment has a new problem. <strong>${name.toUpperCase()}</strong> — the ${careerLabel} from ${sName} — filed paperwork with the FEC on ${dateStr} to run for president under the <strong>${partyDisplayName}</strong>, becoming the most credible independent candidate in a generation.</p>
<p style="margin-top:12px">${lastName}, who allies describe as a ${ideologyDesc}, cited ${momentText} as the defining moment that made a third-party run not just possible, but necessary. Party strategists on both sides cancelled meetings to watch the announcement.</p>`,
  ];
  const col1 = col1Variants[Math.floor(Math.random()*col1Variants.length)];

  const col2Variants = [
    `<p>The historic challenge: no third-party candidate has won the presidency since Abraham Lincoln in 1860. ${lastName} will need to reach 270 Electoral College votes without the infrastructure of either major party — a feat most analysts consider nearly impossible, but not all.</p>
<p style="margin-top:12px">\"We have the data. We have the path,\" a senior campaign adviser said. \"There are enough voters in enough states who are done with both options that 270 is not a fantasy.\" First fundraising numbers are expected within days.</p>`,
    `<p>Rival campaigns reacted with a mixture of alarm and calculated dismissal. Privately, at least three senior operatives admitted the entry of ${lastName} could scramble the electoral map in four to six states currently considered locked.</p>
<p style="margin-top:12px">The ${partyDisplayName} has already secured ballot access in 22 states, with litigation ongoing in 14 more. ${lastName}'s team says full 50-state access is the baseline, not the goal. Donors are reportedly already circling.</p>`,
    `<p>Political scientists note that even without winning, a strong third-party showing by ${lastName} could deny both major candidates the 270 Electoral College votes needed — throwing the election to the House of Representatives for the first time since 1825.</p>
<p style="margin-top:12px">That scenario, once unthinkable, is now being war-gamed by both major campaigns. The ${partyDisplayName}'s initial polling numbers show surprising support among voters aged 18–34 and independent-registered suburban voters.</p>`,
  ];
  const col2 = col2Variants[Math.floor(Math.random()*col2Variants.length)];

  const pullquoteVariants = slogan ? [
    `\"${slogan}\" — The ${partyDisplayName}'s rallying cry, unveiled today in ${sName}`,
    `${lastName}: \"${slogan}\" — the line that silenced every pundit who said this couldn't happen`,
    `The ${partyDisplayName} manifesto in four words: \"${slogan}\"`,
  ] : [
    `\"Both parties have had their chance. Today, ${sName}'s voice joins the rest of America's: enough.\" — ${name}`,
    `\"They told us this was impossible. They said the same thing about every movement that ever changed this country.\" — ${name}`,
    `\"I'm not running against one party. I'm running against a system that stopped working for you a long time ago.\" — ${lastName}`,
  ];
  const pullquote = pullquoteVariants[Math.floor(Math.random()*pullquoteVariants.length)];

  const tickers = [
    `📡 ${lastName} campaign raises $1.8M in first hour — donors overwhelm the website`,
    `📊 Flash poll: ${lastName} enters at ${9+Math.floor(Math.random()*12)}% nationally — enough to complicate both major-party paths`,
    `🗣- Major party strategists: \"We've seen this before\" — but internal memos suggest genuine alarm`,
    `⚡ ${partyDisplayName} ballot access filings confirmed in ${22+Math.floor(Math.random()*8)} states as of today`,
    `🔔 Social media: #${partyDisplayName.replace(/\s/g,'')} trends nationally within 20 minutes`,
    `📣 Both major-party campaigns issue rapid-response statements within the hour`,
    `- Prediction markets: ${lastName} currently at ${4+Math.floor(Math.random()*9)}% — up from near-zero yesterday`,
  ];

  document.getElementById('intro-kicker').textContent=kicker;
  document.getElementById('intro-headline').textContent=headline;
  document.getElementById('intro-byline').textContent=byline;
  document.getElementById('intro-col1').innerHTML=col1;
  document.getElementById('intro-col2').innerHTML=col2;
  document.getElementById('intro-pullquote').textContent=pullquote.replace(/<[^>]*>/g,'');
  document.getElementById('intro-date').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'}).toUpperCase();

  let ti=0;
  const tickerEl = document.getElementById('intro-ticker');
  tickerEl.textContent = tickers[0];
  const tickInterval = setInterval(()=>{ ti=(ti+1)%tickers.length; tickerEl.style.opacity=0; setTimeout(()=>{tickerEl.textContent=tickers[ti];tickerEl.style.opacity=1;},300); },2800);
  tickerEl.style.transition='opacity .3s';
  window._introTickerInterval = tickInterval;

  window._pendingBackstory = {career:selCareer, moment:'', slogan, ideology:50, momentText, ideologyDesc, sloganLine,
    customPartyName, customPartyColor, customPartyIcon};

  document.getElementById('setup-step2').style.display='none';
  document.getElementById('setup-step4').style.display='none';
  document.getElementById('setup-step3').style.display='';
  document.getElementById('setup-step3').classList.add('animate-in');
}

function launchIntro(){
  // Build intro data
  const name   = document.getElementById('player-name').value||'Alex Morgan';
  const state  = document.getElementById('home-state').value||'PA';
  const moment = document.getElementById('moment-select').value;
  const slogan = document.getElementById('slogan-input').value;
  const ideo   = +document.getElementById('ideology-slider').value;

  const stateNames={PA:'Pennsylvania',OH:'Ohio',MI:'Michigan',FL:'Florida',TX:'Texas',
    CA:'California',NY:'New York',GA:'Georgia',AZ:'Arizona',WI:'Wisconsin',
    MN:'Minnesota',CO:'Colorado',VA:'Virginia',NC:'North Carolina',IL:'Illinois'};
  const sName = stateNames[state]||state;

  const careerLabels={senator:'U.S. Senator',governor:'Governor',mayor:'Mayor',
    military:'Retired Four-Star General',ceo:'Business Executive',prosecutor:'State Attorney General'};
  const careerLabel = careerLabels[selCareer]||'Senator';

  // Capture custom party details if applicable
  const customPartyName  = selParty==='custom' ? (document.getElementById('custom-party-name').value.trim()||'Independence Party') : null;
  const customPartyColor = selParty==='custom' ? (document.getElementById('custom-party-color').value||'#a855f7') : null;
  const customPartyIcon  = selParty==='custom' ? (document.getElementById('custom-party-icon').value||'⚡') : null;

  const party = selParty==='dem'?'Democratic': selParty==='rep'?'Republican': (customPartyName||'Independence');
  const partyAdj = selParty==='dem'?'liberal': selParty==='rep'?'conservative':'independent';

  const momentTexts={
    healthcare:`${name}'s landmark healthcare bill, which expanded coverage to 4 million uninsured residents`,
    crisis:`${name}'s decisive leadership during the 2022 ${sName} flooding disaster`,
    corruption:`${name}'s successful prosecution of the landmark ${sName} state contracting scandal`,
    military_hero:`${name}'s three combat tours and Distinguished Service Medal`,
    economy:`${name}'s record of creating over 200,000 jobs in ${sName}`,
    civil_rights:`${name}'s passage of the ${sName} Equal Rights and Dignity Act`,
    climate:`${name}'s landmark Clean Future Initiative, the nation's most ambitious climate law`,
    outsider:`${name}'s outsider status as a political newcomer who has never held elected office`,
  };
  const momentText = momentTexts[moment]||`${name}'s record of public service`;

  let ideologyDesc;
  if(selParty==='dem'){
    ideologyDesc = ideo<30?'firebrand progressive' : ideo<55?'pragmatic centrist Democrat' : 'conservative Democrat who has worked across the aisle';
  } else if(selParty==='rep'){
    ideologyDesc = ideo<30?'traditional Reagan conservative' : ideo<55?'mainstream Republican' : 'populist America-First Republican';
  } else {
    ideologyDesc = ideo<30?'uncompromising outsider who refuses to play by either party\'s rules' : ideo<55?'pragmatic independent who rejects both party establishments' : 'movement leader challenging the two-party duopoly';
  }

  // Custom/independent party gets a special third-party breaking news article
  const firstLast = name.trim().split(' ');
  const lastName = firstLast[firstLast.length-1];
  const firstName = firstLast[0];
  const sloganLine = slogan ? `<strong>"${slogan}"</strong>` : `<strong>"A New Direction for America"</strong>`;

  if(selParty==='custom' || selParty==='ind'){
    _buildThirdPartyNewsArticle({name, firstName, lastName, sName, party, careerLabel, ideologyDesc, momentText, slogan, sloganLine, customPartyName, customPartyColor, customPartyIcon});
    return;
  }

  // Build newspaper content — pick one of several article templates for variety
  const kicker = '🔴 BREAKING — ' + party.toUpperCase() + ' PRESIDENTIAL RACE';
  const byline = `By Staff Reporter | Washington Bureau  ·  ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`;
  const dateStr = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric'});

  // Multiple headline variants
  const headlineVariants = [
    `${name} Enters ${party} Primary, Shaking Up 2024 Race`,
    `${name} Launches ${party} Bid — The Race Just Changed`,
    `${name} Announces Presidential Run — ${party} Field Expands`,
    `${name} Is In: ${party} Race Gets Its Newest Contender`,
    `${name} Joins 2024 ${party} Primary — Stakes Raised Immediately`,
  ];
  const headline = headlineVariants[Math.floor(Math.random()*headlineVariants.length)];

  // Multiple col1 variants
  const col1Variants = [
    `<p><strong>${name.toUpperCase()}</strong>, the ${careerLabel} from ${sName}, formally entered the ${party} presidential primary on ${dateStr}, delivering an announcement speech to a crowd of thousands that drew comparisons to the party's most galvanizing moments.</p>
<p style="margin-top:12px">The announcement confirms months of speculation that ${lastName} — long regarded as a ${ideologyDesc} — would mount a campaign. Allies say the decision crystallised following ${momentText}, which raised ${lastName} national profile dramatically.</p>`,
    `<p><strong>${name.toUpperCase()}</strong> made it official on ${dateStr}, filing paperwork with the Federal Election Commission before delivering a defiant announcement speech in ${sName} that left supporters electrified and rivals shaken.</p>
<p style="margin-top:12px">Political veterans have watched ${lastName} — a ${ideologyDesc} — for years. The moment that finally pushed the ${careerLabel} into the race was ${momentText}, sources close to the campaign confirm.</p>`,
    `<p>In a moment weeks in the making, <strong>${name.toUpperCase()}</strong> stood before a packed arena in ${sName} on ${dateStr} and formally launched a presidential campaign that insiders say could redefine the ${party} primary.</p>
<p style="margin-top:12px">The ${careerLabel}, seen by many as a ${ideologyDesc}, has been building toward this since ${momentText} put the name on the national map last year.</p>`,
  ];
  const col1 = col1Variants[Math.floor(Math.random()*col1Variants.length)];

  // Multiple col2 variants
  const col2Variants = [
    `<p>The crowded ${party} field now faces a formidable new entrant. Early internal polling suggests ${lastName} enters with strong name recognition in ${sName} and competitive numbers in key early states.</p>
<p style="margin-top:12px">"I have spent my career fighting for the people of ${sName}," ${lastName} told supporters. "Today I bring that fight to every corner of this country." The campaign has already begun organising in Iowa and New Hampshire.</p>`,
    `<p>Rivals immediately took notice. Two ${party} campaigns privately acknowledged the entrance reshapes the race. ${lastName} is expected to file in Iowa, New Hampshire, and Nevada within 48 hours.</p>
<p style="margin-top:12px">In the announcement, ${firstName} ${lastName} leaned hard on the theme of ${momentText}, telling the crowd: "The stakes have never been higher. That is why I am in this race." Applause shook the rafters.</p>`,
    `<p>The field has been waiting. Now ${lastName} has arrived — and observers say early polling data out of Iowa and New Hampshire already places the new candidate in the top tier.</p>
<p style="margin-top:12px">Party insiders point to deep donor networks and ${momentText} as the foundation of what they expect will be a well-funded, disciplined campaign. First fundraising numbers are expected within the week.</p>`,
  ];
  const col2 = col2Variants[Math.floor(Math.random()*col2Variants.length)];

  // Pullquote variants
  const pullquoteVariants = slogan ? [
    `"${slogan}" — ${name} campaign motto, unveiled today in ${sName}`,
    `${lastName}: "${slogan}" — the line that brought the crowd to its feet in ${sName}`,
    `The new rallying cry from ${sName}: "${slogan}"`,
  ] : [
    `"I have spent my career fighting for the people of ${sName}. Today I bring that fight to every corner of this country." — ${name}`,
    `"The moment I decided was clear. The American people deserve better — and I intend to deliver it." — ${name}`,
    `"Every race has a turning point. This campaign will be that turning point for our party." — ${lastName}, ${dateStr}`,
  ];
  const pullquote = pullquoteVariants[Math.floor(Math.random()*pullquoteVariants.length)];

  // Live ticker lines
  const tickers = [
    `📡 ${lastName} campaign raises $2.1M in first hour of fundraising`,
    `📊 Early poll: ${lastName} enters at ${12+Math.floor(Math.random()*8)}% support in crowded field`,
    `🗣- ${party} establishment figures react with mixture of excitement and concern`,
    `- International media: "${firstName} ${lastName} joins increasingly crowded ${party} field"`,
    `📌 Campaign office opens in Des Moines, Iowa — first primary state`,
    `🔔 Donors react: ${lastName} bundler network activated within minutes of announcement`,
    `📣 Rival campaigns issue statements — race dynamics shift immediately`,
  ];

  document.getElementById('intro-kicker').textContent=kicker;
  document.getElementById('intro-headline').textContent=headline;
  document.getElementById('intro-byline').textContent=byline;
  document.getElementById('intro-col1').innerHTML=col1;
  document.getElementById('intro-col2').innerHTML=col2;
  document.getElementById('intro-pullquote').textContent=pullquote.replace(/<[^>]*>/g,'');
  document.getElementById('intro-date').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'}).toUpperCase();

  // Animated ticker
  let ti=0;
  const tickerEl = document.getElementById('intro-ticker');
  tickerEl.textContent = tickers[0];
  const tickInterval = setInterval(()=>{ ti=(ti+1)%tickers.length; tickerEl.style.opacity=0; setTimeout(()=>{tickerEl.textContent=tickers[ti];tickerEl.style.opacity=1;},300); },2800);
  tickerEl.style.transition='opacity .3s';
  window._introTickerInterval = tickInterval;

  // Store backstory in GS for use in game
  window._pendingBackstory = {career:selCareer, moment, slogan, ideology:ideo, momentText, ideologyDesc, sloganLine,
    customPartyName, customPartyColor, customPartyIcon};

  document.getElementById('setup-step2').style.display='none';
  document.getElementById('setup-step4').style.display='none';
  document.getElementById('setup-step3').style.display='';
  document.getElementById('setup-step3').classList.add('animate-in');
}

// -----------------------------------------------------------
// NATIONAL MOOD SYSTEM — Hidden variable set at game start
// Shapes the entire election environment. Players feel it
// immediately but don't know the name until the breakdown.
// -----------------------------------------------------------
const NATIONAL_MOODS = {
  change: {
    name: 'Change Election',
    icon: '🌊',
    desc: 'Voters are hungry for something new. Incumbents and establishment figures face headwinds.',
    // Mechanical effects (all relative to baseline)
    incumbentMod: -0.25,       // Incumbent approval and AI strength debuffed
    debateExpect: 'high',       // Voters want bold contrasts — rewards aggressive debaters
    riskTolerance: 0.8,         // Aggressive actions succeed more often
    turnoutMod: +8,             // High turnout — change elections bring people out
    momentumDecayMod: 0.85,     // Momentum is stickier (change narrative amplifies)
    scandalMod: 0.8,            // Scandals hurt incumbents more, challengers less
    outsiderBonus: 3,           // Bonus for non-senator backgrounds (governor, CEO, military)
    newsTheme: ['Voters demand change', 'Anti-establishment sentiment surges', 'Status quo under fire'],
  },
  stability: {
    name: 'Stability Election',
    icon: '⚖-',
    desc: 'Voters want steady hands. Radical proposals backfire. Experience and reassurance win.',
    incumbentMod: +0.2,
    debateExpect: 'low',        // Reward safe answers — no stumbles
    riskTolerance: 0.4,         // Risky actions more likely to backfire
    turnoutMod: -5,             // Lower turnout — comfortable voters stay home
    momentumDecayMod: 1.2,      // Momentum fades faster — no viral moments
    scandalMod: 1.3,            // Scandals hit harder in stability elections
    outsiderBonus: -2,          // Outsider candidates seen as risky
    newsTheme: ['Voters prioritize steady leadership', 'Anxiety about disruption', 'Establishment candidates consolidate'],
  },
  angry: {
    name: 'Angry Electorate',
    icon: '🔥',
    desc: 'The country is furious. Both parties\' establishments are targets. Populists thrive, moderates struggle.',
    incumbentMod: -0.35,
    debateExpect: 'combative',  // Punchy attacks rewarded; mealy-mouthed answers punished
    riskTolerance: 1.0,         // All bets are off — chaos election
    turnoutMod: +15,            // Rage drives historic turnout
    momentumDecayMod: 0.7,      // Anger sustains momentum
    scandalMod: 0.6,            // Voters already assume everyone is corrupt — scandals numbing
    outsiderBonus: 5,           // Outsiders thrive on anger
    volatilityBoost: 0.3,       // All states are more volatile
    newsTheme: ['Voter anger at record levels', 'Protest movement energises base', 'Anti-establishment wave building'],
  },
  fatigued: {
    name: 'Fatigued Electorate',
    icon: '😴',
    desc: 'Voters are checked out. Enthusiasm is hard to generate. The candidate who breaks through the noise wins.',
    incumbentMod: +0.05,
    debateExpect: 'low',
    riskTolerance: 0.6,
    turnoutMod: -12,            // Low turnout — enthusiasm gap is decisive
    momentumDecayMod: 1.4,      // Very hard to sustain momentum
    scandalMod: 0.5,            // Nothing sticks — voters are numbed
    outsiderBonus: 0,
    enthusiasmBoost: -15,       // Everyone starts with lower enthusiasm
    newsTheme: ['Voter enthusiasm at decade low', 'Apathy dominates the trail', 'Campaign struggles to cut through fatigue'],
  },
  prosperity: {
    name: 'Prosperity Election',
    icon: '📈',
    desc: 'The economy is booming. The in-party has a natural advantage. Bold economic arguments cut through.',
    incumbentMod: +0.3,
    debateExpect: 'economic',   // Economic answers rewarded; security/social issues deprioritised
    riskTolerance: 0.5,         // Comfortable voters punish disruption
    turnoutMod: +3,             // Mild turnout boost from feel-good mood
    momentumDecayMod: 1.1,
    scandalMod: 1.2,            // High standards when things are going well
    outsiderBonus: -3,
    newsTheme: ['Economy soars — good news for incumbents', 'Prosperity shapes voter mood', 'Candidates compete on economic vision'],
  },
};

function pickNationalMood(){
  const keys=Object.keys(NATIONAL_MOODS);
  return keys[Math.floor(Math.random()*keys.length)];
}

function applyNationalMood(){
  const m=NATIONAL_MOODS[GS.nationalMood];
  if(!m) return;
  // Apply to AI candidates: incumbentMod buffs/debuffs their starting approval
  GS.aiCandidates.forEach(c=>{
    c.approval=cl(c.approval*(1+m.incumbentMod),15,80);
  });
  // Apply turnout modifier to stored turnout baseline
  GS._turnoutMod = m.turnoutMod||0;
  // Volatility boost
  if(m.volatilityBoost){
    GS.states.forEach(s=>{ s._moodVolBoost = m.volatilityBoost; });
  }
  // Enthusiasm seed
  if(m.enthusiasmBoost){
    GS._enthusiasm = cl((GS._enthusiasm||50)+m.enthusiasmBoost,15,90);
  }
  // Outsider bonus to player if applicable
  const careerOutsider=['governor','military','ceo','mayor','prosecutor'];
  if(m.outsiderBonus && careerOutsider.includes(GS.backstory?.career)){
    GS.favorability=cl(GS.favorability+m.outsiderBonus,20,85);
  }
  // Mood announcement
  m.newsTheme.slice(0,2).forEach(n=>addNews(n,'event'));
}

function getMoodRiskMod(){
  const m=NATIONAL_MOODS[GS.nationalMood];
  return m ? m.riskTolerance : 0.65;
}
function getMoodMomentumDecay(){
  const m=NATIONAL_MOODS[GS.nationalMood];
  return m ? m.momentumDecayMod : 1.0;
}
function getMoodScandalMod(){
  const m=NATIONAL_MOODS[GS.nationalMood];
  return m ? m.scandalMod : 1.0;
}

function startGame(){
  if(window._introTickerInterval){ clearInterval(window._introTickerInterval); }
  // Reset minigame question tracker so each new game gets fresh question pools
  Object.keys(_mgUsedQuestions).forEach(k=>delete _mgUsedQuestions[k]);
  // Reset voter blocs to baseline so stale values from a previous game don't carry over
  const _BLOCS_DEFAULTS = {wc:5,ce:15,sr:-8,yv:25,sw:10,rc:-35,up:55,in:0};
  Object.entries(_BLOCS_DEFAULTS).forEach(([k,v])=>{ if(GS_BLOCS[k]) GS_BLOCS[k].support=v; GS_BLOCS[k]?.history?.splice(0); });
  // Reset action log so breakdown screen shows only this game's actions
  GS_ACTION_LOG.splice(0);
  // Reset ALL session flags that may be stuck from a previous game
  GS.phaseTransitioning = false;
  GS.phase = 'primary';
  GS._crisisArmed = false;
  GS._pendingNegotiation = null;
  GS._lastCrisisWeek = 0;
  GS._crisisCountThisPhase = 0;
  GS._actionStreak = 0;
  GS._playerDebateBonus = 0;
  GS._trailedInPolls = false;
  GS._vpShortlist = null;
  GS._vpScandalBuffer = 0;
  GS._compassHistory = [];
  GS._oppSummaryEvents = null;
  GS._electionResult = null;
  GS._finalResult    = null;
  GS._uniqueActionsUsed = new Set(); // tracks action variety
  GS._boringCampaignFired = false;   // boring campaign event fires at most once per phase
  if(typeof _firedCrisisIds !== 'undefined' && _firedCrisisIds) _firedCrisisIds.clear();
  GS.playerName=document.getElementById('player-name').value||'Alex Morgan';
  // Custom party: treat as 'ind' internally but carry display name/color/icon
  GS.playerParty = selParty==='custom' ? 'ind' : selParty;
  GS.playerPartyLabel = selParty==='custom'
    ? (document.getElementById('custom-party-name').value.trim()||'Independence Party')
    : (selParty==='dem' ? 'Democratic' : 'Republican');
  GS.playerPartyColor = selParty==='custom'
    ? (document.getElementById('custom-party-color').value||'#a855f7')
    : (selParty==='dem' ? '#3b82f6' : '#ef4444');
  GS.playerPartyIcon = selParty==='custom'
    ? (document.getElementById('custom-party-icon').value||'⚡')
    : (selParty==='dem' ? '🔵' : '🔴');
  GS.homeState=document.getElementById('home-state').value;GS.difficulty=selDiff;
  const mod={easy:1.0,normal:0.88,hard:0.60}[GS.difficulty];
  GS.funds=25*mod;GS.totalRaised=GS.funds;GS.favorability=42+(mod>1?5:mod<1?-5:0);
  // Custom party starts harder — no established base, must win over all blocs
  if(selParty==='custom'){ GS.favorability=cl(GS.favorability-6,20,85); GS.funds=cl(GS.funds-8,5,999); }
  // For AI candidate generation, custom party runs in the dem primary field by default
  const aiParty = (selParty==='custom') ? 'dem' : selParty;
  // Use real historical primary rivals if a known year is selected
  const yearData = getSelectedYearData();
  const yearPartyData = yearData ? yearData[aiParty==='rep'?'rep':'dem'] : null;
  if(yearPartyData && yearPartyData.primaryRivals && yearPartyData.primaryRivals.length > 0){
    // Use real rivals — assign portraits/photos for visual consistency
    GS.aiCandidates = yearPartyData.primaryRivals.map(r=>({
      ...r,
      endorsedBy:[],
      _portrait: generatePortraitData(),
      _photoFile: getNextCandidatePhoto ? getNextCandidatePhoto().file : null,
    }));
    GS._historicalYearData = yearPartyData; // store for general election opponent lookup
    GS._uncontested = false;
  } else if(yearPartyData && yearPartyData.primaryRivals && yearPartyData.primaryRivals.length === 0){
    // Uncontested year: no meaningful primary opposition, skip straight to convention.
    GS.aiCandidates = [];
    GS._historicalYearData = yearPartyData;
    GS._uncontested = true;
  } else {
    GS.aiCandidates=randomisedAICandidates(aiParty).map(c=>({...c,endorsedBy:[]}));
    GS._historicalYearData = yearPartyData || null;
    GS._uncontested = false;
  }
  // Apply backstory first so ideology is set before initFactions
  const bs = window._pendingBackstory||{career:'senator',moment:'healthcare',ideology:50,slogan:'',ideologyDesc:'moderate',momentText:'public service record'};
  GS.playerIdeology = bs.ideology||50;
  GS.backstory = bs;
  initFactions(); // now runs with correct ideology
  // Apply selected portrait photo
  setTimeout(applyPlayerPhoto, 200);
  // Career bonus: minor stat boosts depending on background
  const careerBonus = {
    senator:    {electability:3},
    house:      {groundGame:2, mediaCoverage:2},
    governor:   {groundGame:5},
    mayor:      {groundGame:3, mediaCoverage:2},
    military:   {favorability:4, electability:2},
    ceo:        {funds:8},
    prosecutor: {favorability:2, electability:3},
    vp:         {electability:4, favorability:2},
    activist:   {groundGame:6, favorability:1},
    celebrity:  {mediaCoverage:8, favorability:3},
    doctor:     {favorability:3, electability:2},
    none:       {favorability:1},
  };
  const cb = careerBonus[bs.career]||{};
  if(cb.electability) GS.electability=(GS.electability||55)+cb.electability;
  if(cb.groundGame)   GS.groundGame=(GS.groundGame||30)+cb.groundGame;
  if(cb.mediaCoverage)GS.mediaCoverage=(GS.mediaCoverage||40)+cb.mediaCoverage;
  if(cb.favorability) GS.favorability=cl(GS.favorability+cb.favorability,20,85);
  if(cb.funds)        { GS.funds+=cb.funds; GS.totalRaised+=cb.funds; }
  // Assign each AI candidate regional "stronghold" states — balanced so primary is competitive
  // but winnable. Player starts with real advantages in ~15-20 states.
  const allCodes = STATE_DATA.map(s=>s.code);
  const shuffled = [...allCodes].sort(()=>Math.random()-.5);
  const aiList = GS.aiCandidates;
  GS._aiRegional = {};
  shuffled.forEach((code,i)=>{
    if(aiList.length===0) return;
    // Only 3 of 4 AIs get a stronghold bonus per state (leave some uncontested for player)
    if(i % 5 === 0) return; // skip ~20% of states — player's base states
    const aiIdx = i % aiList.length;
    if(!GS._aiRegional[code]) GS._aiRegional[code]={};
    GS._aiRegional[code][aiList[aiIdx].id] = G(14,4); // moderate regional advantage
  });

  const diffMod={easy:0.85,normal:0.75,hard:0.50}[GS.difficulty];
  GS.states=STATE_DATA.map(s=>{
    // Player starts in better shape on easy mode, harder on legend
    const primLead=G(2,10)*diffMod+(s.code===GS.homeState?20:0);
    // ind/custom: rawLean=0 — states overwritten by startIndependentGeneral anyway,
    // but set neutral here so any pre-render doesn't show partisan-skewed colours.
    const rawLean=GS.playerParty==='rep'?-s.lean:GS.playerParty==='ind'?0:s.lean;
    const genLead=rawLean+G(0,4)+(s.code===GS.homeState?5:0);
    // Hidden polling error: secret offset applied only on election night.
    const pollError = G(0, s.vol * 5.5);
    return{...s,primLead,genLead,enthusiasm:50+G(0,10),primaryDelegatesWon:0,_pollError:pollError};
  });
  ensureBattlegroundSets(true);
  const bsl = GS.backstory?.momentText||'record of public service';
  const sl  = GS.backstory?.slogan?`Campaign motto: "${GS.backstory.slogan}"`:null;
  GS.newsItems=[];
  GS.week=1;
  GS.minigamesThisWeek=0;
  GS.mediaBias = GS.playerParty==='dem' ? G(-10,15) : G(10,15);

  // ── CUSTOM / INDEPENDENT PARTY — skip primary, go straight to general ──
  if(GS.playerParty==='ind'){
    startIndependentGeneral();
    return;
  }

  if(GS._uncontested && GS.aiCandidates.length===0){
    addNews(`${GS.playerName} enters as the presumptive nominee — no serious primary opposition emerges.`,'campaign');
    addNews(`Party leaders move directly to convention planning as the nomination is effectively settled.`,'poll');
    showScreen('game-screen');
    setupUI();
    const _nwBtnUncontested = document.querySelector('.next-week-btn');
    if(_nwBtnUncontested) _nwBtnUncontested.onclick = nextWeek;
    const _sumBtnUncontested = document.querySelector('#summary-modal .modal-btn.primary');
    if(_sumBtnUncontested) _sumBtnUncontested.onclick = closeSummary;
    GS.playerDelegates = GS.delegatesNeeded;
    GS.favHistory = [GS.favorability];
    GS._scandalRisk = G(1,0.5);
    GS._enthusiasm = 50 + G(0,5);
    GS.nationalMood = pickNationalMood();
    applyNationalMood();
    applyPolicyToGame();
    renderAll();
    showConvention();
    return;
  }

  addNews(`${GS.playerName} officially enters the ${GS.playerPartyLabel} primary race`,'campaign');
  addNews(`Early buzz: ${GS.playerName}'s ${bsl} draws media spotlight`,'poll');
  if(sl) addNews(sl,'campaign');
  addNews('Early polls: crowded field, no clear frontrunner in national surveys','poll');
  showScreen('game-screen');
  setupUI();
  // Wire buttons for career mode (inline onclick removed from HTML so historical
  // mode can safely re-wire them without fighting hardcoded attributes)
  const _nwBtnCareer = document.querySelector('.next-week-btn');
  if(_nwBtnCareer) _nwBtnCareer.onclick = nextWeek;
  const _sumBtnCareer = document.querySelector('#summary-modal .modal-btn.primary');
  if(_sumBtnCareer) _sumBtnCareer.onclick = closeSummary;
  GS.favHistory = [GS.favorability];
  computePrimaryLeaders();
  GS._scandalRisk=G(1,0.5);
  GS._enthusiasm=50+G(0,5);
  // ── NATIONAL MOOD — set once, shapes the whole campaign ──
  GS.nationalMood = pickNationalMood();
  applyNationalMood();
  applyPolicyToGame();  // apply policy platform state boosts
  renderAll();
  maybeLaunchTutorial();
}

// ----------------------------------------------------------------------
//  INDEPENDENT / CUSTOM PARTY GENERAL ELECTION
//  Skips the primary entirely. Player faces BOTH major party nominees.
//  Much harder — no established base, no party machinery, low starting
//  approval in most states. Mirrors how third-party runs actually work.
// ----------------------------------------------------------------------
function startIndependentGeneral(){
  GS.phase = 'general';
  GS.week  = GS.primaryWeeks + 1; // skip straight past primary weeks
  GS._crisisCountThisPhase = 0; GS._lastCrisisWeek = 0; GS._crisisArmed = false;
  GS._uniqueActionsUsed = new Set();
  GS._boringCampaignFired = false;
  GS._recentActions = [];
  GS.nationalMood = pickNationalMood();

  // Pull both major-party opponents from year data, or use generic pool
  const diffModGen = {easy:0.85,normal:1.05,hard:1.45}[GS.difficulty]||1.05;
  const yd = GS._historicalYearData;

  // Build two opponents: dem nominee + rep nominee
  let demOpp, repOpp;
  if(yd){
    const yearEl = document.getElementById('election-year');
    const yearKey = yearEl ? yearEl.value : null;
    const yearRoot = yearKey ? ELECTION_YEAR_DATA[yearKey] : null;
    if(yearRoot){
      // FIX: yearRoot.rep.generalOpponent is the DEMOCRAT (runs against the rep nominee)
      // yearRoot.dem.generalOpponent is the REPUBLICAN (runs against the dem nominee)
      // So swap: demOpp = rep branch's generalOpponent (the dem), repOpp = dem branch's (the rep)
      demOpp = {...yearRoot.rep.generalOpponent, funds: yearRoot.rep.generalOpponent.funds * diffModGen, approval: yearRoot.rep.generalOpponent.approval * diffModGen};
      repOpp = {...yearRoot.dem.generalOpponent, funds: yearRoot.dem.generalOpponent.funds * diffModGen, approval: yearRoot.dem.generalOpponent.approval * diffModGen};
    }
  }
  // Fallbacks if no year data
  if(!demOpp) demOpp = {id:'opp_dem',name:'Gov. C. Beaumont',  party:'dem',funds:65*diffModGen,approval:50*diffModGen,color:'#3b82f6',delegates:0,active:true};
  if(!repOpp) repOpp = {id:'opp_rep',name:'Gov. R. Thompson',  party:'rep',funds:68*diffModGen,approval:49*diffModGen,color:'#ef4444',delegates:0,active:true};

  // Independent penalty: all states start deeply unfavourable
  const indShift = -18; // brutal starting deficit against established parties
  GS.states.forEach(s=>{
    s.genLead = G(indShift, 5); // centred around -18, high variance
  });
  // Tiny home-state boost
  const homeSt = GS.states.find(s=>s.code===GS.homeState);
  if(homeSt) homeSt.genLead = cl(homeSt.genLead + 12, -60, 60);
  ensureBattlegroundSets(true);

  // Store both opponents — game engine uses aiCandidates for AI turns
  GS.opponent   = repOpp;  // primary opponent slot (backward compat)
  GS._indDemOpp = demOpp;  // second opponent (backward compat)
  GS.aiCandidates    = [repOpp, demOpp];
  // Unified N-candidate list — EV / poll rendering loops this instead of hardcoded slots
  GS.generalOpponents = [demOpp, repOpp];

  const bsl = GS.backstory?.momentText||'record of public service';
  const sl  = GS.backstory?.slogan?`Campaign motto: "${GS.backstory.slogan}"`:null;
  addNews(`${GS.playerName} launches ${GS.playerPartyLabel} independent bid — shaking up the race`,'campaign');
  addNews(`Pundits skeptical: "Third-party candidates face enormous structural barriers"`, 'poll');
  addNews(`${demOpp.name} (D) and ${repOpp.name} (R) are both on the ballot — ${GS.playerName} faces an uphill fight`,'poll');
  if(sl) addNews(sl,'campaign');

  showScreen('game-screen');
  setupUI();
  const _nwBtn = document.querySelector('.next-week-btn');
  if(_nwBtn) _nwBtn.onclick = nextWeek;
  const _sumBtn = document.querySelector('#summary-modal .modal-btn.primary');
  if(_sumBtn) _sumBtn.onclick = closeSummary;

  // Jump UI straight to general phase display
  document.getElementById('topbar-phase').textContent = `${GS.playerPartyIcon} General Election`;
  document.getElementById('phase-primary').className   = 'phase-step done';
  document.getElementById('phase-convention').className= 'phase-step done';
  document.getElementById('phase-general').className   = 'phase-step current';
  document.getElementById('primary-content').style.display  = 'none';
  document.getElementById('general-content').style.display  = 'block';
  const bgsEl = document.getElementById('battleground-section'); if(bgsEl) bgsEl.style.display='block';
  const cgEl  = document.getElementById('congress-tracker');     if(cgEl)  cgEl.style.display='block';
  initCongressTracker();
  document.getElementById('polls-title').textContent = `National ${GS.generalOpponents.length+1}-Way Poll`;
  document.getElementById('stat-delegates').textContent='—';
  document.getElementById('stat-delegates-wrap').style.display='none';
  renderActionGrid();

  GS.favHistory = [GS.favorability];
  GS._scandalRisk = G(1,0.5);
  GS._enthusiasm  = 40 + G(0,5); // lower enthusiasm — no primary base built
  applyNationalMood();
  applyPolicyToGame();
  // Reset EV bar before first render so it animates in correctly
  const _evBarDemIndReset = document.getElementById('ev-bar-dem');
  const _evBarRepIndReset = document.getElementById('ev-bar-rep');
  const _evBarTssIndReset = document.getElementById('ev-bar-toss');
  if(_evBarDemIndReset) _evBarDemIndReset.style.width = '0%';
  if(_evBarRepIndReset) _evBarRepIndReset.style.width = '0%';
  if(_evBarTssIndReset) _evBarTssIndReset.style.width = '100%';
  renderAll();
  try { renderEV(); } catch(e) {}
}

function setupUI(){
  document.getElementById('cand-name').textContent=GS.playerName;
  const careerLabels2={senator:'Senator',house:'Rep.',governor:'Governor',mayor:'Mayor',military:'General (Ret.)',
    ceo:'CEO',prosecutor:'Attorney General',vp:'Former VP',activist:'Organiser',celebrity:'Celebrity',doctor:'Dr.',none:'Independent'};
  const careerTitle = careerLabels2[GS.backstory?.career||'senator']||'Senator';
  // Show national mood
  const moodEl = document.getElementById('mood-display-inner');
  const moodInner = moodEl;
  if(moodEl && GS.nationalMood){
    moodEl.style.display='block';
    const m=NATIONAL_MOODS[GS.nationalMood];
    const mCol=GS.nationalMood==='angry'?'#ef4444':GS.nationalMood==='change'?'#60a5fa':GS.nationalMood==='prosperity'?'#22c55e':GS.nationalMood==='fatigued'?'#8a93a8':'#a78bfa';
    moodInner.innerHTML=`<div style="padding:8px 10px;background:var(--bg3);border:1px solid ${mCol}33;border-radius:var(--radius)">
      <div style="font-weight:700;font-size:12px;color:${mCol}">${m.icon} ${m.name}</div>
      <div style="font-size:10px;color:var(--text2);margin-top:4px;line-height:1.4">${m.desc}</div>
      <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:3px">
        ${m.turnoutMod!==0?`<span style="font-size:8px;font-family:var(--font-mono);padding:2px 5px;border-radius:3px;background:${m.turnoutMod>0?'rgba(34,197,94,.12)':'rgba(239,68,68,.12)'};color:${m.turnoutMod>0?'#22c55e':'#f87171'}">TURNOUT ${m.turnoutMod>0?'+':''}${m.turnoutMod}%</span>`:''}
        ${m.riskTolerance>0.7?`<span style="font-size:8px;font-family:var(--font-mono);padding:2px 5px;border-radius:3px;background:rgba(200,168,75,.12);color:#c8a84b">RISK ↑</span>`:''}
        ${m.riskTolerance<0.55?`<span style="font-size:8px;font-family:var(--font-mono);padding:2px 5px;border-radius:3px;background:rgba(239,68,68,.12);color:#f87171">RISK ↓</span>`:''}
        ${m.scandalMod>1.1?`<span style="font-size:8px;font-family:var(--font-mono);padding:2px 5px;border-radius:3px;background:rgba(239,68,68,.12);color:#f87171">SCANDALS HURT</span>`:''}
        ${m.scandalMod<0.7?`<span style="font-size:8px;font-family:var(--font-mono);padding:2px 5px;border-radius:3px;background:rgba(100,100,100,.12);color:#8a93a8">SCANDALS MUTED</span>`:''}
      </div>
    </div>`;
  }
  const partyTagEl = document.getElementById('cand-party-tag');
  if(partyTagEl){
    partyTagEl.textContent=`${GS.playerPartyLabel||'Democratic'} · ${careerTitle}`;
    if(GS.playerPartyColor) partyTagEl.style.color = GS.playerPartyColor;
  }
  const sel=document.getElementById('target-state-select');
  if(sel){
    sel.innerHTML = '<option value="">— Select state —</option>';
    GS.states.forEach(s=>{const o=document.createElement('option');o.value=s.code;o.textContent=`${s.name} (${s.ev} EV)`;sel.appendChild(o)});
  }
  if(sel) sel.onchange=()=>{
    GS.targetState=sel.value;
    // Light up End Week button when a state is selected
    const nwBtn = document.querySelector('.next-week-btn');
    if(nwBtn) nwBtn.classList.toggle('action-ready', !!GS.targetState && !!GS.selectedAction);
    // Trigger the minigame for ALL state-requiring minigame actions once a state is chosen
    const stateMinigameActions = new Set(['townhall','town_hall','visit','grass','canvass']);
    if(GS.targetState && stateMinigameActions.has(GS.selectedAction) && MINIGAME_ACTIONS.has(GS.selectedAction)){
      setTimeout(()=>openMinigame(GS.selectedAction), 120);
    }
    // Safe state warning: show notice if targeting a deeply partisan state in general
    const notice=document.getElementById('safe-state-notice');
    const noticeText=document.getElementById('safe-state-notice-text');
    if(notice && GS.phase==='general' && GS.targetState){
      const tgt=GS.states.find(s=>s.code===GS.targetState);
      if(tgt && Math.abs(tgt.lean)>18){
        const oppParty=GS.playerParty==='dem'?'Republican':'Democratic';
        const safeLabel=Math.abs(tgt.lean)>25?'Solidly':Math.abs(tgt.lean)>18?'Safely':'';
        const partyLabel=tgt.lean>0?'Democratic':'Republican';
        const effectPct=Math.round(Math.max(6, 100 + (-Math.abs(tgt.lean)+18) / 0.18));
        notice.style.display='block';
        noticeText.textContent=`${tgt.name} is ${safeLabel} ${partyLabel} (lean: ${Math.abs(tgt.lean)} pts). Campaign actions here are only ~${Math.min(effectPct,20)}% effective and the state will snap back quickly. Prioritize battlegrounds.`;
      } else {
        notice.style.display='none';
      }
    } else if(notice){
      notice.style.display='none';
    }
  };
  const grid=document.getElementById('actions-grid');
  renderActionGrid(grid);
  buildMap('us-map-primary');
  buildMap('us-map-general');
  // Update primary legend to match actual candidate names & colours
  const leg=document.getElementById('primary-legend');
  if(leg){
    leg.innerHTML=`<div class="legend-item"><div class="legend-dot" style="background:#c8a84b"></div>You</div>`+
      GS.aiCandidates.map(a=>`<div class="legend-item"><div class="legend-dot" style="background:${a.color}"></div>${a.name.split(' ').slice(-1)[0]}</div>`).join('');
  }
}

// ── SVG MAP BUILDER ──
function buildMap(svgId){
  const svg=document.getElementById(svgId);svg.innerHTML='';
  const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width','960');bg.setAttribute('height','600');bg.setAttribute('fill','#0d1117');svg.appendChild(bg);
  const addInset=(x,y,w,h)=>{const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('fill','none');r.setAttribute('stroke','#1e2535');r.setAttribute('stroke-width','1');svg.appendChild(r)};
  addInset(8,455,195,135);addInset(218,495,150,78);
  const isPrimary=svgId.includes('primary');
  STATE_DATA.forEach(state=>{
    const d=PATHS[state.code];if(!d)return;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',d);path.setAttribute('class','state-path');path.setAttribute('id',`${isPrimary?'p':'g'}-path-${state.code}`);
    path.addEventListener('mousemove',e=>showTT(e,state.code,isPrimary));
    path.addEventListener('mouseleave',hideTT);
    path.addEventListener('click',()=>openStateModal(state.code));
    svg.appendChild(path);
    const c=pathCenter(d);
    const txt=document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',c.x);txt.setAttribute('y',c.y);txt.setAttribute('text-anchor','middle');txt.setAttribute('dominant-baseline','central');
    txt.setAttribute('font-size','7.5');txt.setAttribute('font-family','IBM Plex Mono,monospace');txt.setAttribute('fill','rgba(255,255,255,.7)');txt.setAttribute('pointer-events','none');
    txt.textContent=state.code;svg.appendChild(txt);
  });
}

function showTT(e,code,isPrimary){
  const s=GS.states.find(x=>x.code===code);if(!s)return;
  const tt=document.getElementById('map-tooltip');
  document.getElementById('tt-name').textContent=s.name;
  document.getElementById('tt-ev').textContent=`${s.ev} EV · ${s.pd} primary delegates`;
  if(isPrimary){
    const isPlayer = s._primaryLeader==='player';
    const margin = (s._primaryMargin||0).toFixed(1);
    const leaderAI = GS.aiCandidates.find(a=>a.id===s._primaryLeader);
    const leaderName = isPlayer ? 'You' : (leaderAI?.name?.split(' ').slice(-1)[0]||'Opponent');
    document.getElementById('tt-lead').textContent = isPlayer
      ? `You leading: +${margin}%`
      : `${leaderName} leading: +${margin}%`;
    const leanStr=s.lean>8?'Dem-leaning':s.lean<-8?'Rep-leaning':'True battleground';
    document.getElementById('tt-lead2').textContent=`${leanStr} in general`;
  } else {
    const lead=s.genLead||0;
    document.getElementById('tt-lead').textContent=leanLabel(lead,GS.playerParty);
    document.getElementById('tt-lead2').textContent=`${lead>0?'+':''}${lead.toFixed(1)}% · ${s.ev} EV`;
  }
  // ── Tooltip positioning: account for CSS zoom on body ──────────────────────
  // document.body.style.zoom scales the visual page but clientX/Y are in raw
  // viewport pixels. Dividing by the zoom factor converts to scaled coordinates.
  const zoom = parseFloat(document.body.style.zoom) || 1;
  const x = e.clientX / zoom;
  const y = e.clientY / zoom;
  // Clamp so tooltip never overflows the right/bottom edge of the viewport
  const ttW = 180, ttH = 80;
  const vpW = window.innerWidth  / zoom;
  const vpH = window.innerHeight / zoom;
  tt.style.left = Math.min(x + 14, vpW - ttW - 8) + 'px';
  tt.style.top  = Math.min(y - 10, vpH - ttH - 8) + 'px';
  tt.style.display='block';
}
function hideTT(){document.getElementById('map-tooltip').style.display='none'}

// Actions with minigames — clicking opens a minigame, result feeds into nextWeek
const MINIGAME_ACTIONS = new Set(['debate','fundraise','fundraise_calls','speech','attack','crisis','town_hall','townhall','press_tour','canvass','spin_room','oppo_rapid','coalition','adblitz','visit','grass','roast']);

function selectAction(id){
  GS.selectedAction=id;
  document.querySelectorAll('.action-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById(`ab-${id}`)?.classList.add('selected');
  const a=ACTIONS.find(x=>x.id===id)||UNDERDOG_ACTIONS.find(x=>x.id===id);
  document.getElementById('state-target-section').style.display=a.needsState?'block':'none';
  if(!a.needsState)GS.targetState=null;

  // Light up the End Week button when an action (that doesn't need a state) is ready
  const nwBtn = document.querySelector('.next-week-btn');
  if(nwBtn) nwBtn.classList.toggle('action-ready', !a.needsState);

  // Open minigame immediately for eligible actions
  if(MINIGAME_ACTIONS.has(id)){
    // Show a notice if the weekly minigame cap is already reached
    if((GS.minigamesThisWeek||0) >= 2){
      showMGCapNotice();
    }
    // visit, grass, townhall all need a state selected first — minigame fires after state pick
    if(id==='visit'||id==='grass'||id==='townhall'||id==='canvass'){
      // Show a hint that state selection is needed to start the minigame
      const stateSection = document.getElementById('state-target-section');
      if(stateSection){
        stateSection.style.boxShadow='0 0 0 2px #c8a84b88';
        // Update the state section title with a prompt
        const stateTitle = stateSection.querySelector('.panel-title');
        if(stateTitle && !stateTitle._origText){ stateTitle._origText = stateTitle.textContent; }
        if(stateTitle){ stateTitle.innerHTML = `Target State <span style="color:var(--accent);font-size:9px">- Select to launch minigame</span>`; }
        setTimeout(()=>{
          stateSection.style.boxShadow='';
          if(stateTitle && stateTitle._origText){ stateTitle.textContent = stateTitle._origText; delete stateTitle._origText; }
        }, 2500);
      }
      return;
    }
    setTimeout(()=>openMinigame(id), 150);
  }
}

// Show a small notice banner when the 2-per-week minigame cap is hit
window.selectAction = selectAction; // expose for ai-command.js
// openMinigame is a hoisted global — accessible on window automatically in browsers.
function showMGCapNotice(){
  const existing = document.getElementById('mg-cap-notice');
  if(existing) return; // already showing
  const notice = document.createElement('div');
  notice.id = 'mg-cap-notice';
  notice.style.cssText = [
    'position:fixed','bottom:80px','left:50%','transform:translateX(-50%)',
    'z-index:8000','background:#10141c','border:1px solid rgba(200,168,75,.45)',
    'border-radius:8px','padding:10px 18px','font-family:var(--font-mono)',
    'font-size:11px','color:#c8a84b','white-space:nowrap',
    'box-shadow:0 4px 24px rgba(0,0,0,.7)','pointer-events:none',
    'animation:mgCapFadeIn .25s ease'
  ].join(';');
  notice.innerHTML = '-- Minigame limit reached for this week (max 2) — action will still execute normally';
  // Add keyframe if not yet present
  if(!document.getElementById('mg-cap-style')){
    const st = document.createElement('style');
    st.id = 'mg-cap-style';
    st.textContent = '@keyframes mgCapFadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(st);
  }
  document.body.appendChild(notice);
  setTimeout(()=>{ if(notice.parentNode) notice.remove(); }, 3000);
}


// -------------------------------------------------------------------------------
// AI MINIGAME ENGINE
// In AI mode (POTUS_AI_MODE !== 'buttons'), all minigames are replaced with
// free-text AI-evaluated scenes. Player types their answer, the worker scores
// how each voter demographic reacts based on the exact words used.
// -------------------------------------------------------------------------------

const AI_MG_SCENARIOS = {
  debate:[
    {situation:'Presidential primary debate',prompts:[
      'The moderator asks: Will you cut Social Security or Medicare benefits to reduce the deficit?',
      'Your opponent just said your healthcare plan will cost $3 trillion. Respond directly.',
      'The moderator asks: Should the US provide more military aid to Ukraine?',
      'A moderator question: Climate change or energy costs — which is your first-term priority?',
      'Your opponent calls your immigration plan "open borders." Hit back.',
    ]},
  ],
  visit:[
    {situation:'Campaign rally — hostile crowd member interrupts',prompts:[
      'A protester shouts: "You\'re just another politician — all talk, no action!"',
      'Someone yells: "My factory closed last year. What are YOU going to do about it?"',
      'A heckler holds a sign reading "LIAR" and chants during your speech.',
      'An angry voter shouts: "My health insurance costs doubled! Answer for that!"',
    ]},
  ],
  speech:[
    {situation:'National policy address to voters',prompts:[
      'Give your opening statement on your economic vision for America.',
      'Explain your healthcare position in plain language — what will actually change for families?',
      'Make the case for your foreign policy approach in one clear paragraph.',
      'Address voters who feel left behind and forgotten by Washington.',
    ]},
  ],
  fundraise:[
    {situation:'High-dollar donor fundraising dinner',prompts:[
      'A tech billionaire asks: "Why should I back you over your opponent?"',
      'A union leader says: "Convince me you\'re actually on workers\' side — not just saying it."',
      'A small business coalition asks: "What do you do for Main Street, not Wall Street?"',
      'A major donor says: "How do you win swing states? Give me the actual strategy."',
    ]},
  ],
  fundraise_calls:[
    {situation:'Phone banking — one-on-one donor calls',prompts:[
      'A former donor says: "I gave last cycle and felt let down. Why should I give again?"',
      'A first-time potential donor asks: "Where does my money actually go?"',
      'A donor considering your opponent says: "Make your case in 60 seconds."',
    ]},
  ],
  attack:[
    {situation:'Opposition research and attack messaging',prompts:[
      'Write the core attack line on your opponent\'s economic record.',
      'Your opponent flip-flopped on healthcare twice. Write the press release.',
      'Draft the sharpest line of attack on your opponent\'s missed Senate votes.',
    ]},
  ],
  crisis:[
    {situation:'Press conference — responding to a damaging news story',prompts:[
      'The press asks about a leaked memo showing internal campaign disagreements. Your statement?',
      'A former staffer is claiming you misrepresented your policy record. Respond.',
      'A video surfaced of you making an off-colour remark at a private event. Address it.',
      'Your campaign finance filings are being questioned by reporters. What do you say?',
    ]},
  ],
  town_hall:[
    {situation:'Town hall — live voter questions on stage',prompts:[
      'A senior citizen asks: "Will you protect my Medicare and Social Security? Straight answer, no spin."',
      'A teacher says: "Education funding has been cut for a decade. What specifically will you do?"',
      'A veteran asks: "What is your actual plan for veterans\' healthcare and housing?"',
      'A young voter asks: "Do you actually care about climate change or is it just a talking point?"',
    ]},
  ],
  townhall:[
    {situation:'Town hall — live voter questions on stage',prompts:[
      'A senior citizen asks: "Will you protect my Medicare and Social Security? Straight answer, no spin."',
      'A teacher says: "Education funding has been cut for a decade. What specifically will you do?"',
      'A veteran asks: "What is your actual plan for veterans\' healthcare and housing?"',
      'A young voter asks: "Do you actually care about climate change or is it just a talking point?"',
    ]},
  ],
  press_tour:[
    {situation:'Press gauntlet — rapid-fire journalist questions',prompts:[
      'Reporter: "You\'ve changed your position on trade deals three times. Which do you actually believe?"',
      'Reporter: "Your approval is down 6 points this week. Is your campaign struggling?"',
      'Reporter: "Will you commit right now to releasing your complete tax returns?"',
      'Reporter: "Your opponent says you\'re soft on crime. How do you respond?"',
    ]},
  ],
  canvass:[
    {situation:'Door-to-door canvassing — voter conversations',prompts:[
      'A homeowner says: "I don\'t vote — nothing ever changes. Convince me it\'s worth it."',
      'A voter says: "I like parts of your platform but your immigration stance loses me."',
      'A young person answers the door: "Why should I trust any politician?"',
      'An older couple says: "We always vote the other party. What would make us switch?"',
    ]},
  ],
  grass:[
    {situation:'Grassroots organising — training campaign volunteers',prompts:[
      'Your lead organiser asks: "What\'s our core message for undecided voters this week?"',
      'A volunteer asks: "How do I answer voters who say both parties are the same?"',
      'Your field director says: "Turnout in key precincts is low. What\'s our closing argument?"',
    ]},
  ],
  coalition:[
    {situation:'Coalition building — pitching to key voter blocs',prompts:[
      'A Latino community leader asks: "What have you actually done for our community — not what you plan to do?"',
      'An LGBTQ+ advocacy group asks: "Will you make our rights a first-term legislative priority?"',
      'A suburban women\'s group asks: "Why should we trust you specifically on healthcare and childcare costs?"',
      'A labour union says: "Name one specific policy you\'ll fight for in your first 100 days. One."',
    ]},
  ],
  adblitz:[
    {situation:'Ad strategy session — campaign messaging decisions',prompts:[
      'Your media consultant asks: "What\'s the one line that should define this entire campaign?"',
      'Your team asks: "Positive bio ad or contrast attack on the opponent — which do we run first?"',
      'A pollster says: "Swing voters don\'t understand your economic plan. Explain it in 30 seconds."',
    ]},
  ],
  spin_room:[
    {situation:'Spin room — rapid media and party insider questions',prompts:[
      'A strategist says: "Your debate performance was flat. How do we spin it in the next 24 hours?"',
      'A journalist asks: "Your opponent clearly won that exchange on healthcare. Do you agree?"',
      'A party official says: "Some major donors are nervous after last night. What do I tell them?"',
    ]},
  ],
  oppo_rapid:[
    {situation:'Rapid response — your opponent just attacked you on live TV',prompts:[
      'Your opponent just said: "My rival has never kept a single campaign promise." Hit back now.',
      'Your opponent accused you of flip-flopping on taxes in a live press conference. Respond immediately.',
      'Breaking: your opponent is running an attack ad saying you voted to defund police. Your response?',
    ]},
  ],
};

const AI_MG_GENERIC = {
  situation:'Campaign appearance — voters and press watching closely',
  prompts:[
    'Make your closing argument to undecided voters in one paragraph.',
    'What is the single most important thing voters need to know about your campaign?',
  ],
};

const AI_MG_META = {
  debate:        {icon:'🎙-',label:'PRESIDENTIAL DEBATE',   color:'#6366f1'},
  visit:         {icon:'📣', label:'CAMPAIGN RALLY',        color:'#f59e0b'},
  speech:        {icon:'📜', label:'POLICY ADDRESS',        color:'#c8a84b'},
  fundraise:     {icon:'💰', label:'DONOR DINNER',          color:'#22c55e'},
  fundraise_calls:{icon:'📞',label:'DONOR CALLS',           color:'#22c55e'},
  attack:        {icon:'⚔-', label:'OPPOSITION RESEARCH',  color:'#ef4444'},
  crisis:        {icon:'🔥', label:'CRISIS RESPONSE',       color:'#ef4444'},
  town_hall:     {icon:'---', label:'TOWN HALL',             color:'#c8a84b'},
  townhall:      {icon:'---', label:'TOWN HALL',             color:'#c8a84b'},
  press_tour:    {icon:'📰', label:'PRESS GAUNTLET',        color:'#60a5fa'},
  canvass:       {icon:'🚪', label:'CANVASSING',            color:'#a78bfa'},
  grass:         {icon:'🌱', label:'GRASSROOTS',            color:'#34d399'},
  coalition:     {icon:'-', label:'COALITION BUILDING',   color:'#60a5fa'},
  adblitz:       {icon:'📺', label:'AD STRATEGY SESSION',  color:'#f472b6'},
  spin_room:     {icon:'🎭', label:'SPIN ROOM',             color:'#a78bfa'},
  oppo_rapid:    {icon:'⚡', label:'RAPID RESPONSE',        color:'#ef4444'},
};

function _aiMGChip(label, v){
  const col = v>0?'#4ade80':v<0?'#f87171':'#8a93a8';
  const bg  = v>0?'rgba(74,222,128,.10)':v<0?'rgba(248,113,113,.10)':'rgba(255,255,255,.04)';
  const bdr = v>0?'#4ade8033':v<0?'#f8717133':'#2a3348';
  return `<span style="padding:4px 10px;border-radius:12px;font-family:'IBM Plex Mono',monospace;font-size:10px;background:${bg};border:1px solid ${bdr};color:${col}">${label} ${v>0?'+':''}${v}</span>`;
}

function renderAIMinigame(el, actionId){
  const scenPool = AI_MG_SCENARIOS[actionId] || [AI_MG_GENERIC];
  const meta     = AI_MG_META[actionId] || {icon:'🗣-',label:'CAMPAIGN EVENT',color:'#c8a84b'};
  const WORKER   = window._POTUS_AI_WORKER_URL || 'https://potus-ai.danielmdoody.workers.dev/';
  const party    = GS.playerParty || 'dem';

  // Show loading state while we try to fetch AI-generated questions
  el.innerHTML = `
    <div style="${MG_STYLE.header}">
      <div style="${MG_STYLE.eyebrow(meta.color)}">${meta.icon} ${meta.label} · PREPARING</div>
      <div style="${MG_STYLE.headline}">Setting the scene...</div>
      <div style="${MG_STYLE.sub}">Generating questions based on your campaign environment</div>
    </div>
    <div style="padding:32px 20px;text-align:center">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4a5568" id="ai-mg-prep-dots">Analysing the political landscape.</div>
    </div>`;

  let dotN = 0;
  const dotInt = setInterval(() => {
    const d = document.getElementById('ai-mg-prep-dots');
    if (d) d.textContent = 'Analysing the political landscape' + '.'.repeat((dotN++ % 3) + 1);
  }, 400);

  // Build game context for question generation
  let gameCtx = '';
  if (GS) {
    const mood = GS.nationalMood || 'change';
    const moodObj = typeof NATIONAL_MOODS !== 'undefined' ? NATIONAL_MOODS[mood] : null;
    const moodName = moodObj ? moodObj.name : mood;
    const phase = GS.phase === 'primary' ? 'PRIMARY' : 'GENERAL';
    const weeksLeft = GS.phase === 'primary'
      ? Math.max(0, (GS.primaryWeeks || 20) - GS.week)
      : Math.max(0, (GS.primaryWeeks || 20) + (GS.generalWeeks || 16) - GS.week);
    const isInd = GS.playerParty === 'ind';
    const partyLabel = isInd ? (GS.playerPartyLabel || 'Independent') : GS.playerParty === 'dem' ? 'Democratic' : 'Republican';
    const scanRisk = GS._scandalRisk || 0;
    gameCtx = `PHASE: ${phase} | Week ${GS.week} | ${weeksLeft} weeks left
NATIONAL MOOD: ${moodName}${moodObj ? ' — ' + moodObj.desc : ''}
PLAYER: ${GS.playerName || 'Candidate'} (${partyLabel})${isInd ? ' — INDEPENDENT/THIRD PARTY RUN' : ''}
FAVORABILITY: ${(GS.favorability||50).toFixed(1)}% | MOMENTUM: ${GS.momentum||0}
SCANDAL RISK: ${scanRisk.toFixed(1)}/15${scanRisk > 6 ? ' (ELEVATED — active controversy in the news)' : ''}
ACTION: ${actionId}`;
  }

  // Try to get AI-generated questions; prefer local model on desktop, fall back to worker, then static pool
  const _mgQPrompt = `You are a political scenario writer for POTUS, a US presidential election video game.\nGiven the current game state, generate 3 unique, specific scenario prompts for a campaign minigame.\nReturn ONLY valid JSON — no markdown, no extra text:\n{\n  "situation": "Max 10 words scene description",\n  "prompts": [\n    "ONE sentence max 20 words — hostile voter, press question, debate jab, heckler, or donor demand",\n    "ONE sentence max 20 words — different challenge type",\n    "ONE sentence max 20 words — different challenge type again"\n  ]\n}\nEach prompt: ONE sentence, max 20 words. Reference national mood and phase. Scandal risk > 8 = mention scandal in one prompt.\nGAME STATE:\n${gameCtx}`;

  const _tryLocalQuestions = async () => {
    if (window.isElectron && window.localAI) {
      try {
        const r = await window.localAI.getQuestions(_mgQPrompt);
        if (r && r.situation && Array.isArray(r.prompts) && r.prompts.length >= 2) return r;
      } catch (_) {}
    }
    return null;
  };

  Promise.resolve()
    .then(_tryLocalQuestions)
    .then(local => {
      if (local) return local;
      return fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'generate', generateQuestions: true, actionId, context: gameCtx, party }),
      })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(data => data?.questions?.situation ? data.questions : null);
    })
    .then(questions => {
    clearInterval(dotInt);
    let scen;
    if (questions && questions.situation && questions.prompts?.length >= 2) {
      scen = { situation: questions.situation, prompts: questions.prompts };
    } else {
      const pool = AI_MG_SCENARIOS[actionId] || [AI_MG_GENERIC];
      scen = pool[Math.floor(Math.random() * pool.length)];
    }
    const prompts = [...scen.prompts].sort(() => Math.random() - 0.5).slice(0, 3);
    _runAIMinigameRounds(el, actionId, meta, scen, prompts, party, WORKER);
  });
}

function _runAIMinigameRounds(el, actionId, meta, scen, prompts, party, WORKER) {
  let qIdx = 0;
  let totalBonus = 0;
  const totalImpacts = {urban:0,suburban:0,rural:0,youth:0,seniors:0};
  const rounds = [];

  function renderQuestion(){
    if(qIdx >= prompts.length){ showAIMGResult(); return; }
    const prompt = prompts[qIdx];
    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="${MG_STYLE.eyebrow(meta.color)}">${meta.icon} ${meta.label} · QUESTION ${qIdx+1} OF ${prompts.length}</div>
        <div style="${MG_STYLE.headline}">${prompt}</div>
        <div style="${MG_STYLE.sub}">Type your answer — the AI evaluates how each voter group reacts to your exact words.</div>
      </div>
      <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 20px 4px;display:flex;flex-direction:column;gap:8px;min-height:0">
        <textarea id="ai-mg-input" rows="4"
          placeholder="Type your response here…"
          style="width:100%;background:#060a12;border:1px solid #1e2535;border-radius:7px;
            color:#e8ecf4;font-family:'IBM Plex Sans',sans-serif;font-size:13px;
            padding:10px 12px;resize:none;line-height:1.6;outline:none;box-sizing:border-box;
            transition:border-color .2s;flex-shrink:0;"
          onfocus="this.style.borderColor='${meta.color}55'"
          onblur="this.style.borderColor='#1e2535'"
          onkeydown="if(event.ctrlKey&&event.key==='Enter'){event.preventDefault();window._aiMGSubmit()}"
        ></textarea>
        ${qIdx>0?`<div style="padding:9px 12px;background:#0a0e16;border:1px solid #1e2535;border-radius:7px;flex-shrink:0">
          ${rounds.map((r,i)=>`<div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;margin-bottom:${i<rounds.length-1?'6px':'0'}">Q${i+1}: ${r.feedback}</div>`).join('')}
        </div>`:''}
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;display:flex;justify-content:flex-end;align-items:center;gap:8px;background:#080c14">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#2a3348">Ctrl+Enter to submit</span>
        <button id="ai-mg-btn" onclick="window._aiMGSubmit()" style="
          padding:9px 22px;background:${meta.color};border:none;border-radius:7px;
          color:#0a0c10;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;
          cursor:pointer;letter-spacing:.05em;">Submit →</button>
      </div>`;
    document.getElementById('ai-mg-input').focus();


    window._aiMGSubmit = async ()=>{
      const inp = document.getElementById('ai-mg-input');
      const btn = document.getElementById('ai-mg-btn');
      const text = (inp?.value||'').trim();
      if(!text||text.length<5){
        if(inp){inp.style.borderColor='#ef4444';setTimeout(()=>{if(inp)inp.style.borderColor='#1e2535';},1200);}
        return;
      }
      if(btn){btn.textContent='Evaluating…';btn.disabled=true;btn.style.opacity='.5';}
      if(inp) inp.disabled=true;

      el.innerHTML=`
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow(meta.color)}">${meta.icon} ${meta.label} · EVALUATING</div>
          <div style="${MG_STYLE.headline}">${prompt}</div>
        </div>
        <div style="padding:24px 20px;text-align:center">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#4a5568" id="ai-mg-dots">The room is reacting.</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#2a3348;margin-top:8px;font-style:italic">"${text.slice(0,90)}${text.length>90?'…':''}"</div>
        </div>`;

      let dotN=0;
      const dotInt=setInterval(()=>{
        const d=document.getElementById('ai-mg-dots');
        if(d) d.textContent='The room is reacting'+'.'.repeat((dotN++%3)+1);
      },420);

      let data={feedback:'The crowd reacts to your answer.',impacts:{urban:1,suburban:1,rural:1,youth:1,seniors:1},bonus:5};
      try{
        // Build evaluation prompt for local model
        const _evalPrompt = `You are a political analyst evaluating a presidential candidate's answer in a campaign event.\nSITUATION: ${scen.situation} — ${prompt}\nPARTY: ${party}\nPLAYER ANSWERED: "${text}"\nReturn ONLY valid JSON, no markdown:\n{\n  "feedback": "2-sentence vivid reaction from the room",\n  "impacts": {"urban": 0, "suburban": 0, "rural": 0, "youth": 0, "seniors": 0},\n  "bonus": 5\n}\nimpacts are integers -10 to +10. bonus 0-15. Good specific answers score positive. Ideological tradeoffs apply.`;

        let localResult = null;
        if (window.isElectron && window.localAI) {
          try { localResult = await window.localAI.evaluate(_evalPrompt); } catch (_) {}
        }

        if (localResult && localResult.feedback && localResult.impacts) {
          data = localResult;
          clearInterval(dotInt);
        } else {
          const res=await fetch(WORKER,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({text,minigame:scen.situation+' — '+prompt,party}),
          });
          clearInterval(dotInt);
          if(res.ok) try{data=await res.json();}catch(e){}
        }
      }catch(e){ clearInterval(dotInt); }

      const imp=data.impacts||{};
      for(const k of ['urban','suburban','rural','youth','seniors'])
        totalImpacts[k]=(totalImpacts[k]||0)+(typeof imp[k]==='number'?imp[k]:0);
      totalBonus+=(typeof data.bonus==='number'?data.bonus:5);
      rounds.push({prompt,answer:text,feedback:data.feedback||'The crowd responds.'});

      const chips=['👥 Urban','-- Suburban','🌾 Rural','🎓 Youth','👴 Seniors']
        .map((l,i)=>_aiMGChip(l,[imp.urban,imp.suburban,imp.rural,imp.youth,imp.seniors][i]||0))
        .join('');

      el.innerHTML=`
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow(meta.color)}">${meta.icon} ${meta.label} · REACTION</div>
          <div style="font-size:12px;color:#8a93a8;font-style:italic;margin-top:4px">"${text.slice(0,110)}${text.length>110?'…':''}"</div>
        </div>
        <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 20px;min-height:0">
          <div style="font-size:13px;color:#c8d0e0;line-height:1.6;margin-bottom:12px">${data.feedback||'The room responds.'}</div>
          <div style="display:flex;flex-wrap:wrap;gap:7px">${chips}</div>
        </div>
        <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
          <button onclick="window._aiMGNext()" style="padding:11px;width:100%;background:${meta.color};border:none;border-radius:7px;color:#0a0c10;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer">
            ${qIdx<prompts.length-1?'Next Question →':'See Your Results →'}
          </button>
        </div>`;
      window._aiMGNext=()=>{qIdx++;renderQuestion();};
    };
  }

  function showAIMGResult(){
    const cap=(v,mn,mx)=>Math.max(mn,Math.min(mx,v));
    for(const k of ['urban','suburban','rural','youth','seniors'])
      if(GS.demos&&GS.demos[k]!==undefined)
        GS.demos[k]=cap(GS.demos[k]+(totalImpacts[k]||0)*0.45,10,90);
    const cappedBonus=cap(Math.round(totalBonus),0,14);
    MG.bonus=cappedBonus;

    const totalNet=Object.values(totalImpacts).reduce((s,v)=>s+v,0);
    const grade=totalNet>=18?'-- Commanding Performance'
      :totalNet>=8?'✅ Strong Showing'
      :totalNet>=0?'- Mixed Reception'
      :'-- Rough Outing';

    const chips=['👥 Urban','-- Suburban','🌾 Rural','🎓 Youth','👴 Seniors']
      .map((l,i)=>_aiMGChip(l,[totalImpacts.urban,totalImpacts.suburban,totalImpacts.rural,totalImpacts.youth,totalImpacts.seniors][i]||0))
      .join('');

    el.innerHTML=`
      <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px;min-height:0;background:#060a12">
        <div style="${MG_STYLE.eyebrow(meta.color)}">${meta.icon} ${meta.label} — FINAL VERDICT</div>
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#e8ecf4;margin:8px 0">${grade}</div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px">${chips}</div>
        <div style="border-top:1px solid #1e2535;padding-top:12px">
          ${rounds.map((r,i)=>`
            <div style="margin-bottom:10px">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;margin-bottom:3px">Q${i+1}: ${r.prompt.slice(0,65)}…</div>
              <div style="font-size:11px;color:#8a93a8;font-style:italic">${r.feedback}</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#060a12">
        ${MG_STYLE.cta('Back to Campaign HQ →', cappedBonus)}
      </div>`;
  }

  renderQuestion();
}

// ── MINIGAME ENGINE ──
let MG = {}; // minigame state

function openMinigame(actionId){
  const modal = document.getElementById('minigame-modal');
  const inner = document.getElementById('minigame-inner');

  // ── Per-week cap: max 2 minigames ──
  if((GS.minigamesThisWeek||0) >= 2){
    // Silently skip — action still executes at base value
    MG = { actionId, bonus:0, complete:true };
    if(typeof showMGCapNotice === 'function') showMGCapNotice();
    return;
  }

  GS.minigamesThisWeek = (GS.minigamesThisWeek||0) + 1;
  MG = { actionId, bonus:0, complete:false };

  // AI mode: replace all button minigames with free-text AI evaluation
  if((window.POTUS_AI_MODE||'buttons')!=='buttons'){
    renderAIMinigame(inner, actionId);
    modal.classList.add('active');
    const closeBtn=document.getElementById('minigame-close-btn');
    if(closeBtn) closeBtn.style.display='none';
    return;
  }

  if(actionId==='debate') renderDebateMinigame(inner);
  else if(actionId==='fundraise') renderFundraiseMinigame(inner);
  else if(actionId==='fundraise_calls') renderFundraiseCallMinigame(inner);
  else if(actionId==='speech') renderSpeechMinigame(inner);
  else if(actionId==='attack') renderAttackMinigame(inner);
  else if(actionId==='crisis') renderCrisisMinigame(inner);
  else if(actionId==='town_hall' || actionId==='townhall') renderTownHallMinigame(inner);
  else if(actionId==='press_tour') renderPressTourMinigame(inner);
  else if(actionId==='canvass') renderCanvassMinigame(inner);
  else if(actionId==='spin_room') renderSpinRoomMinigame(inner);
  else if(actionId==='oppo_rapid') renderRapidResponseMinigame(inner);
  else if(actionId==='coalition') renderFocusGroupMinigame(inner);
  else if(actionId==='adblitz') renderEndorsementInterviewMinigame(inner);
  else if(actionId==='visit') renderRallyHecklerMinigame(inner);
  else if(actionId==='grass') renderDebatePrepMinigame(inner);
  else { modal.classList.remove('active'); return; }

  modal.classList.add('active');
  const closeBtn = document.getElementById('minigame-close-btn');
  if(closeBtn) { closeBtn.style.display='none'; }
}

function closeMG(bonus=0){
  MG.bonus = bonus;
  MG.complete = true;
  document.getElementById('minigame-modal').classList.remove('active');
  const closeBtn = document.getElementById('minigame-close-btn');
  if(closeBtn) closeBtn.style.display='none';
}

// Show close button — pinned inside the modal top-right corner
function showMGCloseBtn(){
  const closeBtn = document.getElementById('minigame-close-btn');
  if(!closeBtn) return;
  // Reposition to top-right of the modal container
  closeBtn.style.top  = '10px';
  closeBtn.style.right = '10px';
  closeBtn.style.left = '';
  closeBtn.style.display = 'flex';
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MINIGAME STYLE — apply consistently across all minigames
// ─────────────────────────────────────────────────────────────────────────────
const MG_STYLE = {
  shell: 'background:#080c14;display:flex;flex-direction:column;min-height:0',
  header: 'background:linear-gradient(135deg,#080c14,#0e1520);padding:16px 20px;border-bottom:2px solid #1e2535;flex-shrink:0',
  eyebrow: (col='#c8a84b')=>`font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px;color:${col}`,
  headline: 'font-size:14px;font-weight:700;color:#e8ecf4;line-height:1.45',
  sub: 'font-size:10px;font-family:"IBM Plex Mono",monospace;color:#4a5568;margin-top:5px',
  body: 'padding:14px 20px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;-webkit-overflow-scrolling:touch',
  btn: (accent='#c8a84b')=>`padding:11px 14px;background:#0d1117;border:1px solid #253047;border-radius:7px;color:#c8d0e0;font-size:12px;text-align:left;cursor:pointer;line-height:1.45;width:100%;transition:border-color .15s,background .15s`,
  btnHover: (accent='#c8a84b')=>`this.style.borderColor='${accent}';this.style.background='#141c2a'`,
  btnOut: `this.style.borderColor='#253047';this.style.background='#0d1117'`,
  chip: (v)=>`<span style="padding:3px 8px;border-radius:12px;font-family:'IBM Plex Mono',monospace;font-size:9px;background:${v>0?'rgba(34,197,94,.10)':v<0?'rgba(239,68,68,.10)':'rgba(255,255,255,.04)'};border:1px solid ${v>0?'#22c55e33':v<0?'#ef444433':'#2a3348'};color:${v>0?'#4ade80':v<0?'#f87171':'#8a93a8'}">${v>0?'+':''}${v}</span>`,
  result: 'background:#060a12;padding:24px 20px;overflow-y:auto;-webkit-overflow-scrolling:touch',
  statBox: (v)=>`<div style="background:#0d1117;border:1px solid #1e2535;border-radius:7px;padding:10px 12px"><div style="font-size:9px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px;text-transform:uppercase"></div><div style="font-size:18px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:${v>0?'#4ade80':v<0?'#f87171':'#8a93a8'}">${v>0?'+':''}${v}</div></div>`,
  cta: (label, bonus)=>`<button onclick="showMGCloseBtn();closeMG(${bonus})" style="padding:12px;width:100%;background:#c8a84b;border:none;border-radius:7px;color:#0a0c10;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.05em;margin-top:12px">${label}</button>`,
};

// Helper: render a 2×2 grid of demographic impact boxes
function _mgDemoGrid(impacts){
  const labels = {urban:'👥 Urban', rural:'🌾 Rural', suburban:'-- Suburban', seniors:'👴 Seniors', youth:'🎓 Youth'};
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:14px 0">
    ${Object.entries(impacts).map(([k,v])=>`
      <div style="background:#0d1117;border:1px solid #1e2535;border-radius:7px;padding:9px 11px">
        <div style="font-size:9px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">${labels[k]||k.toUpperCase()}</div>
        <div style="font-size:17px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:${v>0?'#4ade80':v<0?'#f87171':'#8a93a8'}">${v>0?'+':''}${v}</div>
      </div>`).join('')}
  </div>`;
}

// ─── CRISIS MANAGEMENT MINIGAME ───
// A scandal hits. The player chooses their response strategy across three decision points.
// Each choice has consequences — no universally "right" answer.
const CRISIS_SCENARIOS = [
  {
    headline: "🚨 Breaking: Your campaign manager is linked to a foreign lobbying firm.",
    steps: [
      {
        prompt: "Step 1 — Immediate response (next 4 hours):",
        opts: [
          { text: "Get ahead of it. Hold an emergency press conference, announce the manager's resignation, express full confidence in your campaign's integrity.", fx:{fav:+2,mom:+1,media:+5}, risk:"Low" },
          { text: "Say nothing yet — your legal team is reviewing. Buy 24 hours before any statement.", fx:{fav:-1,mom:-2,media:-3}, risk:"Medium" },
          { text: "Go on the offensive immediately: this is opposition research, this is a smear, you will not dignify it with a response.", fx:{fav:-3,mom:+1,media:+8}, risk:"High" },
        ]
      },
      {
        prompt: "Step 2 — Media strategy:",
        opts: [
          { text: "Give an exclusive sit-down interview to a respected anchor — full transparency, controlled environment.", fx:{fav:+3,mom:+2,media:+3}, risk:"Low" },
          { text: "Send surrogates to all the Sunday shows. Keep yourself off-camera.", fx:{fav:+1,mom:0,media:+1}, risk:"Low" },
          { text: "Hold a town hall open to press — demonstrate you have nothing to hide.", fx:{fav:+4,mom:+2,media:+6}, risk:"Medium" },
        ]
      },
      {
        prompt: "Step 3 — Long-term damage control:",
        opts: [
          { text: "Announce a new campaign ethics policy and an independent ethics compliance officer.", fx:{fav:+3,mom:+1,media:+2}, risk:"Low" },
          { text: "Pivot aggressively to policy. Flood the news cycle with a new healthcare plan announcement.", fx:{fav:+2,mom:+3,media:+4}, risk:"Medium" },
          { text: "Let it die naturally. Over-responding keeps it in the headlines.", fx:{fav:0,mom:-1,media:-4}, risk:"Low" },
        ]
      }
    ]
  },
  {
    headline: "🚨 Breaking: Leaked audio of you dismissing rural voters at a private fundraiser.",
    steps: [
      {
        prompt: "Step 1 — Acknowledge or deny?",
        opts: [
          { text: "Immediately acknowledge the audio is real. Take full responsibility — Those words do not reflect who I am or what I believe.", fx:{fav:+3,mom:+2,media:+2}, risk:"Low" },
          { text: "Question the audio's authenticity — demand verification. Stall until context can be established.", fx:{fav:-2,mom:-1,media:-2}, risk:"Medium" },
          { text: "Admit it, but provide full context of the evening — the quote was taken out of a longer nuanced statement.", fx:{fav:+1,mom:+1,media:+3}, risk:"Medium" },
        ]
      },
      {
        prompt: "Step 2 — How do you connect with rural America?",
        opts: [
          { text: "Fly to a rural state immediately. Spend two full days touring farms, diners, and town halls.", fx:{fav:+5,mom:+3,media:+5}, risk:"Low" },
          { text: "Release a new rural economic plan with concrete commitments. Make policy the story.", fx:{fav:+3,mom:+2,media:+4}, risk:"Low" },
          { text: "Record a direct-to-camera apology video for social media — unscripted, personal.", fx:{fav:+4,mom:+2,media:+3}, risk:"Medium" },
        ]
      },
      {
        prompt: "Step 3 — Opponent is hammering you on this. How do you respond?",
        opts: [
          { text: "Rise above it: I have already apologised to the American people. My opponent is more interested in attack ads than solutions.", fx:{fav:+2,mom:+2,media:+2}, risk:"Low" },
          { text: "Counter-attack: dig up a similar moment from your opponent's record.", fx:{fav:-1,mom:+3,media:+5}, risk:"High" },
          { text: "Refuse to engage — every response amplifies the story. Stay disciplined on your positive message.", fx:{fav:+1,mom:-1,media:-3}, risk:"Low" },
        ]
      }
    ]
  },
  {
    headline: "🚨 Breaking: A major newspaper endorses your opponent — citing concerns about your electability.",
    steps: [
      {
        prompt: "Step 1 — How do you respond to the editorial?",
        opts: [
          { text: "Politely disagree in a measured statement — cite your polling numbers and broad coalition.", fx:{fav:+1,mom:+1,media:+2}, risk:"Low" },
          { text: "Ignore it entirely. Endorsements do not win elections — voter contact does.", fx:{fav:0,mom:0,media:-2}, risk:"Low" },
          { text: "Call the editorial board directly, request a follow-up meeting, and make your case in person.", fx:{fav:+2,mom:+1,media:+3}, risk:"Medium" },
        ]
      },
      {
        prompt: "Step 2 — Your campaign needs a momentum jolt. What's your move?",
        opts: [
          { text: "Announce a major policy flagship — something big enough to dominate the news cycle for 48 hours.", fx:{fav:+3,mom:+4,media:+6}, risk:"Medium" },
          { text: "Line up your own endorsements from prominent figures — show the editorial is out of step.", fx:{fav:+2,mom:+3,media:+4}, risk:"Low" },
          { text: "Double down on ground game — ignore the pundit class entirely and organise.", fx:{fav:+1,mom:+1,media:-1}, risk:"Low" },
        ]
      },
      {
        prompt: "Step 3 — Electability concerns persist in the media. How do you address them?",
        opts: [
          { text: "Release your internal polling data showing strong head-to-head numbers against the general election opponent.", fx:{fav:+3,mom:+2,media:+3}, risk:"Medium" },
          { text: "Hold a nationally televised town hall in a purple district — prove you can win over persuadable voters.", fx:{fav:+4,mom:+3,media:+5}, risk:"Medium" },
          { text: "Lean into the grassroots. Publish volunteer sign-up numbers — frame electability as enthusiasm, not pundit approval.", fx:{fav:+2,mom:+2,media:+2}, risk:"Low" },
        ]
      }
    ]
  },
];

function renderCrisisMinigame(el){
  const scenario = CRISIS_SCENARIOS[~~(Math.random()*CRISIS_SCENARIOS.length)];
  let step = 0;
  let totals = {fav:0, mom:0, media:0};

  const renderStep = ()=>{
    if(step >= scenario.steps.length){ showCrisisResult(el, scenario, totals); return; }
    const s = scenario.steps[step];
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#140a0a,#1a0a0f);padding:18px 22px;border-bottom:1px solid #2a1010">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#ef4444;letter-spacing:.15em;margin-bottom:8px">🚨 CRISIS WAR ROOM · STEP ${step+1} OF ${scenario.steps.length}</div>
        <div style="font-size:13px;color:#fca5a5;font-weight:600;line-height:1.4;margin-bottom:4px">${scenario.headline}</div>
      </div>
      <div style="padding:14px 20px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0;display:flex;flex-direction:column;gap:10px">
        <div style="font-size:13px;color:#c8d0e0;font-weight:600">${s.prompt}</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${s.opts.map((o,i)=>{
            const riskColor = o.risk==='Low'?'#22c55e':o.risk==='Medium'?'#fb923c':'#ef4444';
            return `<button onclick="crisisChoice(${i})" style="background:#151c2c;border:1px solid #253047;border-radius:8px;padding:12px 15px;cursor:pointer;text-align:left;transition:border-color .2s;width:100%" onmouseover="this.style.borderColor='#3b6fd4'" onmouseout="this.style.borderColor='#253047'">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <div style="font-size:11px;font-weight:600;color:#c8d0e0">${o.text}</div>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:${riskColor};white-space:nowrap;margin-left:10px">Risk: ${o.risk}</span>
              </div>
            </button>`;
          }).join('')}
        </div>
      </div>`;

    window.crisisChoice = (i)=>{
      const o = s.opts[i];
      totals.fav += o.fx.fav; totals.mom += o.fx.mom; totals.media += o.fx.media;
      step++;
      renderStep();
    };
  };
  renderStep();
}

function showCrisisResult(el, scenario, totals){
  const score = totals.fav + totals.mom + totals.media;
  const grade = score >= 18 ? {label:'Masterclass',color:'#22c55e',icon:'--'} :
                score >= 12 ? {label:'Well Handled',color:'#84cc16',icon:'✅'} :
                score >= 6  ? {label:'Damage Limited',color:'#fb923c',icon:'⚠-'} :
                              {label:'PR Disaster',color:'#ef4444',icon:'💥'};
  // Apply fav/momentum/media DIRECTLY — do NOT pass raw score to closeMG as a fav bonus.
  // Raw score of 18-54 was being added straight to GS.favorability causing the 80% surge bug.
  GS.favorability  = cl(GS.favorability  + cl(totals.fav,  -8, 6), 20, 85);
  GS.momentum      = cl(GS.momentum      + cl(totals.mom,  -6, 5), -20, 20);
  GS.mediaCoverage = cl(GS.mediaCoverage + cl(totals.media,-6, 6),   0, 100);
  const mgBonus = score >= 18 ? 10 : score >= 12 ? 7 : score >= 6 ? 4 : 0;
  el.innerHTML = `
    <div style="padding:20px 22px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">${grade.icon}</div>
      <div style="font-size:18px;font-weight:700;color:${grade.color};margin-bottom:4px">${grade.label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text3);margin-bottom:18px">Crisis Response Score: ${score}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div style="background:#151c2c;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:var(--text3)">Favorability</div>
          <div style="font-size:16px;font-weight:700;color:${totals.fav>=0?'#22c55e':'#ef4444'}">${totals.fav>=0?'+':''}${totals.fav}</div>
        </div>
        <div style="background:#151c2c;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:var(--text3)">Momentum</div>
          <div style="font-size:16px;font-weight:700;color:${totals.mom>=0?'#22c55e':'#ef4444'}">${totals.mom>=0?'+':''}${totals.mom}</div>
        </div>
        <div style="background:#151c2c;border-radius:8px;padding:10px">
          <div style="font-size:10px;color:var(--text3)">Media</div>
          <div style="font-size:16px;font-weight:700;color:${totals.media>=0?'#22c55e':'#ef4444'}">${totals.media>=0?'+':''}${totals.media}</div>
        </div>
      </div>
    </div>
    <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #2a1010;background:#0a0608">
      <button onclick="showMGCloseBtn();closeMG(${mgBonus})" style="background:#1d4ed8;color:#fff;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;width:100%">Return to Campaign HQ</button>
    </div>`;
}

// ─── DEBATE MINIGAME ───
// No "correct" answer — every position helps some voter groups and hurts others
// Each answer has demographic consequences tracked and shown at end
const DEBATE_QUESTIONS = [
  {
    q: "The moderator asks: Should the US significantly increase spending on renewable energy, even if it raises energy costs short-term?",
    issue: "Climate & Energy",
    opts: [
      { text: "Absolutely. Climate change is an existential crisis — we must act boldly now, cost be damned.",
        fx: {urban:+5, youth:+7, seniors:-4, rural:-6, suburban:-2} },
      { text: "We support clean energy but must balance it with economic reality and energy security.",
        fx: {urban:+1, youth:+2, seniors:+1, rural:-1, suburban:+3} },
      { text: "Energy independence matters more right now. American coal, gas and oil first.",
        fx: {urban:-5, youth:-6, seniors:+3, rural:+7, suburban:-2} },
      { text: "Let the free market decide — subsidies just distort prices and pick winners.",
        fx: {urban:-3, youth:-4, seniors:+2, rural:+4, suburban:+1} },
    ]
  },
  {
    q: "On gun control, your position is:",
    issue: "Gun Rights & Safety",
    opts: [
      { text: "Universal background checks, red flag laws, and an assault weapons ban — now.",
        fx: {urban:+6, youth:+4, seniors:-2, rural:-9, suburban:+2} },
      { text: "Enforce existing laws better. Legal gun owners should not be punished for criminals.",
        fx: {urban:-4, youth:-3, seniors:+4, rural:+8, suburban:+2} },
      { text: "Mental health is the real problem. Let's invest there instead of restricting rights.",
        fx: {urban:-1, youth:+1, seniors:+2, rural:+4, suburban:+3} },
      { text: "Local communities should decide their own gun policies. No federal mandates.",
        fx: {urban:-2, youth:-2, seniors:+1, rural:+3, suburban:+1} },
    ]
  },
  {
    q: "Your opponent says your immigration plan would be too costly. You respond:",
    issue: "Immigration",
    opts: [
      { text: "We must open our doors — immigrants built this country and enrichen our communities.",
        fx: {urban:+5, youth:+4, seniors:-3, rural:-7, suburban:-1} },
      { text: "Secure the border first, then build a fair legal path for those already here.",
        fx: {urban:-2, youth:-1, seniors:+4, rural:+5, suburban:+4} },
      { text: "The costs of inaction are higher. Immigrants grow our economy and fill crucial jobs.",
        fx: {urban:+3, youth:+3, seniors:-2, rural:-4, suburban:+1} },
      { text: "A merit-based system — attract the best and brightest, limit low-skill migration.",
        fx: {urban:-1, youth:0, seniors:+2, rural:+2, suburban:+4} },
    ]
  },
  {
    q: "On healthcare, what do you tell voters who cannot afford their prescriptions?",
    issue: "Healthcare",
    opts: [
      { text: "Medicare for All — healthcare is a right, not a privilege. Full stop.",
        fx: {urban:+6, youth:+7, seniors:+2, rural:-3, suburban:-2} },
      { text: "Cap drug prices now. Big pharma is price-gouging families while CEOs get rich.",
        fx: {urban:+4, youth:+4, seniors:+5, rural:+2, suburban:+3} },
      { text: "Increase market competition and transparency to drive prices down naturally.",
        fx: {urban:-2, youth:-1, seniors:+1, rural:+2, suburban:+4} },
      { text: "Expand healthcare savings accounts and high-deductible plans for flexibility.",
        fx: {urban:-4, youth:-4, seniors:-1, rural:+1, suburban:+2} },
    ]
  },
  {
    q: "With inflation still a concern, your economic plan prioritizes:",
    issue: "The Economy",
    opts: [
      { text: "Tax the wealthy and corporations — use the revenue to invest in the middle class.",
        fx: {urban:+5, youth:+5, seniors:0, rural:-2, suburban:-1} },
      { text: "Cut government spending and reduce the deficit to stabilise the dollar long-term.",
        fx: {urban:-3, youth:-3, seniors:+3, rural:+4, suburban:+4} },
      { text: "Big infrastructure investment — jobs, roads, broadband. Growth is the answer.",
        fx: {urban:+3, youth:+2, seniors:+1, rural:+3, suburban:+2} },
      { text: "Deregulate business, slash red tape, and let entrepreneurs drive growth.",
        fx: {urban:-3, youth:-2, seniors:+2, rural:+3, suburban:+5} },
    ]
  },
  {
    q: "On policing and criminal justice reform, your position is:",
    issue: "Criminal Justice",
    opts: [
      { text: "Defund the police — redirect money to education, housing, and mental health services.",
        fx: {urban:+6, youth:+7, seniors:-5, rural:-8, suburban:-4} },
      { text: "Comprehensive reform: end mandatory minimums, invest in body cameras and de-escalation training.",
        fx: {urban:+4, youth:+5, seniors:-1, rural:-2, suburban:+1} },
      { text: "Back the blue. Police are underfunded and under-appreciated — they need our full support.",
        fx: {urban:-5, youth:-5, seniors:+5, rural:+7, suburban:+3} },
      { text: "Community policing — officers embedded in neighbourhoods, building trust with residents.",
        fx: {urban:+2, youth:+2, seniors:+2, rural:+1, suburban:+3} },
    ]
  },
  {
    q: "On abortion rights, you tell voters:",
    issue: "Abortion & Rights",
    opts: [
      { text: "Abortion access is a constitutional right and I will codify Roe v. Wade into federal law.",
        fx: {urban:+7, youth:+8, seniors:-2, rural:-6, suburban:+2} },
      { text: "This is a deeply personal issue that should be left to the states, not federal government.",
        fx: {urban:-2, youth:-3, seniors:+2, rural:+4, suburban:+2} },
      { text: "Life begins at conception. I will protect the unborn with strong federal protections.",
        fx: {urban:-6, youth:-7, seniors:+3, rural:+6, suburban:-2} },
      { text: "Safe, legal, and rare — with sensible restrictions and full access to healthcare.",
        fx: {urban:+3, youth:+3, seniors:+1, rural:-2, suburban:+3} },
    ]
  },
  {
    q: "On education policy, your priority is:",
    issue: "Education",
    opts: [
      { text: "Cancel all student debt and make public college tuition-free for every American.",
        fx: {urban:+5, youth:+9, seniors:-3, rural:-2, suburban:+1} },
      { text: "Expand school choice — vouchers empower parents to pick the best school for their kids.",
        fx: {urban:-3, youth:-2, seniors:+3, rural:+5, suburban:+4} },
      { text: "Double teacher pay and invest massively in public schools — the foundation of our democracy.",
        fx: {urban:+4, youth:+3, seniors:+2, rural:+2, suburban:+2} },
      { text: "Focus on vocational training and apprenticeships — college is not the only path.",
        fx: {urban:+1, youth:+3, seniors:+2, rural:+6, suburban:+3} },
    ]
  },
  {
    q: "On trade policy — your approach to China:",
    issue: "Trade & China",
    opts: [
      { text: "Aggressive tariffs and decoupling — we cannot trust China with our supply chains.",
        fx: {urban:-1, youth:-2, seniors:+3, rural:+4, suburban:+2} },
      { text: "Tough but smart diplomacy — compete fiercely while keeping communication channels open.",
        fx: {urban:+3, youth:+2, seniors:+2, rural:+1, suburban:+4} },
      { text: "Multilateral coalitions — work with allies to present a unified front against China.",
        fx: {urban:+4, youth:+3, seniors:+1, rural:-1, suburban:+3} },
      { text: "Free trade benefits American consumers. Tariffs are just taxes on ordinary people.",
        fx: {urban:+1, youth:0, seniors:0, rural:-2, suburban:+2} },
    ]
  },
  {
    q: "The moderator asks about Social Security — your plan to protect it:",
    issue: "Social Security & Seniors",
    opts: [
      { text: "Lift the payroll tax cap entirely so the wealthy pay their fair share and we fully fund benefits forever.",
        fx: {urban:+4, youth:+3, seniors:+7, rural:+1, suburban:+1} },
      { text: "Gradually raise the retirement age to 68 to reflect longer lifespans — responsible reform now prevents collapse later.",
        fx: {urban:-1, youth:-2, seniors:-5, rural:+1, suburban:+3} },
      { text: "Social Security is a sacred promise. I will not cut benefits, full stop.",
        fx: {urban:+3, youth:+2, seniors:+8, rural:+2, suburban:+2} },
      { text: "Allow younger workers to invest a portion in personal retirement accounts for better long-term returns.",
        fx: {urban:-2, youth:+2, seniors:-4, rural:+2, suburban:+4} },
    ]
  },
  {
    q: "On housing costs — millions cannot afford to rent or buy. Your response:",
    issue: "Housing Affordability",
    opts: [
      { text: "We need 3 million new housing units. I'll slash federal red tape, fund affordable housing, and reform zoning laws.",
        fx: {urban:+5, youth:+7, seniors:+1, rural:+2, suburban:+2} },
      { text: "Rent control and expanded Section 8 vouchers — immediate relief for families struggling right now.",
        fx: {urban:+5, youth:+5, seniors:+2, rural:-2, suburban:-2} },
      { text: "Zoning reform is a local issue. The federal government should not be telling cities what to build.",
        fx: {urban:-1, youth:-1, seniors:+1, rural:+3, suburban:+3} },
      { text: "The housing crisis is a symptom of inflation caused by reckless government spending. Fix the economy, fix housing.",
        fx: {urban:-3, youth:-3, seniors:+2, rural:+3, suburban:+4} },
    ]
  },
  {
    q: "On artificial intelligence and technology — how should the US respond?",
    issue: "Technology & AI",
    opts: [
      { text: "The US must lead the global AI race — heavy regulation will hand that advantage to China.",
        fx: {urban:+2, youth:+2, seniors:+1, rural:+1, suburban:+5} },
      { text: "We need strong guardrails on AI right now. These tools are reshaping jobs, privacy, and democracy.",
        fx: {urban:+3, youth:+4, seniors:+2, rural:-1, suburban:+2} },
      { text: "Break up Big Tech monopolies. No company should have this much power over our information and economy.",
        fx: {urban:+4, youth:+5, seniors:+1, rural:+2, suburban:+1} },
      { text: "The market will self-regulate AI. Government intervention always lags behind and makes things worse.",
        fx: {urban:-2, youth:-1, seniors:-1, rural:+2, suburban:+4} },
    ]
  },
  {
    q: "A veteran asks you directly: what will you do about care at the VA?",
    issue: "Veterans Affairs",
    opts: [
      { text: "I will fully fund the VA, double the mental health workforce, and guarantee same-week appointments for every veteran.",
        fx: {urban:+3, youth:+2, seniors:+5, rural:+6, suburban:+4} },
      { text: "Give veterans full choice — let them use any doctor, funded by the VA. The government monopoly has failed them.",
        fx: {urban:+1, youth:+1, seniors:+4, rural:+5, suburban:+5} },
      { text: "End the backlog first. I'll fire the bureaucrats responsible and bring in accountability — fast.",
        fx: {urban:+2, youth:+1, seniors:+5, rural:+6, suburban:+4} },
      { text: "The private sector can deliver faster, better care. Public-private partnerships are the answer.",
        fx: {urban:-1, youth:-1, seniors:+2, rural:+3, suburban:+4} },
    ]
  },
];

function renderDebateMinigame(el){
  // ── DEBATE PERSONA PICKER ─────────────────────────────────────────────────
  const mood = GS.nationalMood || 'change';
  const moodName = (NATIONAL_MOODS[mood] || {}).name || mood;
  const personas = [
    {
      id:'firebrand',
      icon:'🔥',
      name:'The Firebrand',
      desc:'Punchy, aggressive, combative. Connects with angry voters and change elections.',
      bonusMood:['angry','change'],
      penaltyMood:['stability','prosperity'],
      fx:(impacts)=>{
        const isBonusMood = ['angry','change'].includes(mood);
        const isPenaltyMood = ['stability','prosperity'].includes(mood);
        const mult = isBonusMood ? 1.4 : isPenaltyMood ? 0.6 : 1.0;
        Object.keys(impacts).forEach(k=>{ impacts[k] = Math.round(impacts[k] * mult); });
        if(isBonusMood){ impacts.rural += 4; GS.momentum = cl(GS.momentum+4,-20,20); }
        if(isPenaltyMood){ GS.electability = cl(GS.electability-6,0,100); }
        return isBonusMood ? '🔥 Firebrand mode landed perfectly — the angry crowd loved the fight.' :
               isPenaltyMood ? '😬 Firebrand approach backfired — stability-seeking voters were alarmed.' :
               'Firebrand persona performed as expected in a mixed climate.';
      },
      tagColor:'#ef4444',
      moodHint: ['angry','change'].includes(mood) ? `✅ ${moodName} — IDEAL MATCH` : ['stability','prosperity'].includes(mood) ? `⚠- ${moodName} — HIGH RISK` : `➡- ${moodName} — NEUTRAL`
    },
    {
      id:'wonk',
      icon:'📚',
      name:'The Policy Wonk',
      desc:'Detailed, credible, substance-heavy. Boosts electability — but falls flat with fatigued audiences.',
      bonusMood:['prosperity','stability'],
      penaltyMood:['fatigued','angry'],
      fx:(impacts)=>{
        const isBonusMood = ['prosperity','stability'].includes(mood);
        const isPenaltyMood = ['fatigued','angry'].includes(mood);
        GS.electability = cl(GS.electability + (isBonusMood ? 9 : isPenaltyMood ? 2 : 5), 0, 100);
        if(isPenaltyMood){ GS.momentum = cl(GS.momentum+0,-20,20); /* zero momentum */ }
        else { GS.momentum = cl(GS.momentum+2,-20,20); }
        if(isBonusMood){ impacts.suburban += 5; impacts.seniors += 4; }
        return isBonusMood ? '📚 Policy depth cut through — credibility soared with suburban and senior voters.' :
               isPenaltyMood ? '😴 Detailed answers lost a fatigued audience. Zero momentum generated.' :
               'Wonk persona landed adequately in a mixed political climate.';
      },
      tagColor:'#a78bfa',
      moodHint: ['prosperity','stability'].includes(mood) ? `✅ ${moodName} — IDEAL MATCH` : ['fatigued','angry'].includes(mood) ? `⚠- ${moodName} — RISKY` : `➡- ${moodName} — NEUTRAL`
    },
    {
      id:'empath',
      icon:'-',
      name:'The Empathizer',
      desc:'Warm, human, relatable. Consistent performer — no huge upside but avoids catastrophic misses.',
      bonusMood:['fatigued'],
      penaltyMood:[],
      fx:(impacts)=>{
        impacts.urban += 2; impacts.suburban += 2; impacts.youth += 2; impacts.seniors += 2;
        GS.favorability = cl(GS.favorability+3,20,85);
        GS.momentum = cl(GS.momentum+1.5,-20,20);
        return mood==='fatigued' ? '- The empathizer cut through fatigue — voters appreciated the humanity.' : 'Steady empathetic performance. No fireworks, but no stumbles either.';
      },
      tagColor:'#22c55e',
      moodHint: mood==='fatigued' ? `✅ ${moodName} — IDEAL MATCH` : `➡- ${moodName} — RELIABLE`
    },
  ];

  let selectedPersona = null;
  let _personaBonus = null;

  // Show persona picker first
  el.innerHTML = `
    <div style="background:#080c14;padding:20px 22px">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:4px">🎤 PRE-DEBATE STRATEGY</div>
      <div style="font-family:'Playfair Display',serif;font-size:16px;font-weight:700;margin-bottom:4px">Choose Your Debate Persona</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px">National Mood: <span style="color:#c8a84b;font-weight:600">${(NATIONAL_MOODS[mood]||{}).icon||''} ${moodName}</span> — your persona choice matters.</div>
      <div style="font-size:11px;color:#4a5568;margin-bottom:16px">Different styles play better or worse depending on how the country feels tonight.</div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${personas.map(p=>`
          <button onclick="window._pickPersona('${p.id}')" style="padding:13px 15px;background:#10141c;border:1px solid ${p.tagColor}44;border-radius:7px;color:var(--text);text-align:left;cursor:pointer;transition:all .2s" onmouseover="this.style.background='${p.tagColor}11';this.style.borderColor='${p.tagColor}'" onmouseout="this.style.background='#10141c';this.style.borderColor='${p.tagColor}44'">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">
              <span style="font-size:22px">${p.icon}</span>
              <span style="font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:#e8ecf4">${p.name}</span>
              <span style="margin-left:auto;font-family:'IBM Plex Mono',monospace;font-size:8px;padding:2px 7px;border-radius:3px;background:${p.tagColor}18;color:${p.tagColor}">${p.moodHint}</span>
            </div>
            <div style="font-size:11px;color:#6b7280;line-height:1.5">${p.desc}</div>
          </button>
        `).join('')}
      </div>
    </div>`;

  window._pickPersona = (id) => {
    selectedPersona = personas.find(p=>p.id===id);
    startDebateQuestions();
  };

  // ── ACTUAL DEBATE QUESTIONS ───────────────────────────────────────────────
  function startDebateQuestions(){
  // Pick 4 random questions each debate
  const qs = _mgPickQuestions('debate', DEBATE_QUESTIONS, 4);
  let qi = 0, timer = 20, timerInt = null;
  // Track total demographic impacts
  const impacts = {urban:0, youth:0, seniors:0, rural:0, suburban:0};

  const renderQ = ()=>{
    if(qi >= qs.length){ showDebateResult(el, impacts); return; }
    const q = qs[qi];
    // Shuffle opts so "good" option isn't always first
    const shuffled = [...q.opts].sort(()=>Math.random()-.5);

    clearInterval(timerInt);
    timer = 20;

    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#080c14,#0f1625);padding:18px 22px;border-bottom:1px solid #1e2535">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em">🎤 PRESIDENTIAL DEBATE · ${qi+1}/${qs.length} · ${q.issue.toUpperCase()}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#e8ecf4" id="mg-timer">${timer}</div>
        </div>
        <div style="font-size:14px;font-weight:600;color:#e8ecf4;line-height:1.45">${q.q}</div>
        <div style="margin-top:8px;display:flex;gap:12px;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#4a5568">
          <span>👥 URBAN: ${impacts.urban>=0?'+':''}${impacts.urban}</span>
          <span>🌾 RURAL: ${impacts.rural>=0?'+':''}${impacts.rural}</span>
          <span>-- SUBURBAN: ${impacts.suburban>=0?'+':''}${impacts.suburban}</span>
          <span>🎓 YOUTH: ${impacts.youth>=0?'+':''}${impacts.youth}</span>
          <span>👴 SENIORS: ${impacts.seniors>=0?'+':''}${impacts.seniors}</span>
        </div>
      </div>
      <div style="padding:14px 22px;display:flex;flex-direction:column;gap:7px">
        ${shuffled.map((o,i)=>`
          <button onclick="debatePick(${i})" data-idx="${i}" style="padding:11px 14px;background:#10141c;border:1px solid #1e2535;border-radius:6px;color:#c8d0e0;font-size:12px;text-align:left;cursor:pointer;transition:border-color .15s;line-height:1.4" onmouseover="this.style.borderColor='#c8a84b'" onmouseout="this.style.borderColor='#1e2535'">${o.text}</button>
        `).join('')}
      </div>`;

    timerInt = setInterval(()=>{
      timer--;
      const te = document.getElementById('mg-timer');
      if(te){ te.textContent=timer; te.style.color=timer<6?'#ef4444':timer<11?'#fb923c':'#e8ecf4'; }
      if(timer<=0){ clearInterval(timerInt); debatePick(Math.floor(Math.random()*4)); }
    },1000);

    window.debatePick = (si)=>{
      clearInterval(timerInt);
      const chosen = shuffled[si];
      if(!chosen) { qi++; renderQ(); return; }
      // Apply demographic effects
      Object.keys(impacts).forEach(k=>{ if(chosen.fx[k]) impacts[k]+=chosen.fx[k]; });
      // Show brief feedback then move on
      el.innerHTML = `
        <div style="background:#080c14;padding:28px 22px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">YOUR ANSWER</div>
          <div style="font-size:14px;color:#e8ecf4;font-style:italic;margin-bottom:18px;line-height:1.5">"${chosen.text}"</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px">
            ${Object.entries(chosen.fx).map(([k,v])=>`<div style="padding:5px 10px;background:${v>0?'rgba(34,197,94,.12)':v<0?'rgba(239,68,68,.12)':'rgba(255,255,255,.05)'};border:1px solid ${v>0?'#22c55e':v<0?'#ef4444':'#2a3348'};border-radius:20px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:${v>0?'#22c55e':v<0?'#f87171':'#8a93a8'}">${k.toUpperCase()} ${v>0?'+':''}${v}%</div>`).join('')}
          </div>
          <button onclick="debateNext()" style="padding:10px 28px;background:#1e2535;border:1px solid #2a3348;border-radius:6px;color:#e8ecf4;font-size:13px;cursor:pointer">Next Question →</button>
        </div>`;
      window.debateNext = ()=>{ qi++; renderQ(); };
    };
  };

  window.showDebateResult = (el, impacts)=>{
    const totalImpact = Object.values(impacts).reduce((s,v)=>s+v,0);
    const favBonus = Math.round(totalImpact / 12);
    // Apply demographic changes to GS
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v,10,90); });
    const grade = totalImpact>15?'🌟 Commanding':totalImpact>5?'✅ Solid':totalImpact>-5?'↔- Mixed':totalImpact>-15?'😬 Rough':'💔 Damaging';
    el.innerHTML = `
      <div style="background:#080c14;padding:20px 22px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">🎤 DEBATE COMPLETE — AUDIENCE REACTION</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;margin-bottom:6px">${grade}</div>
        <div style="color:#8a93a8;font-size:12px;margin-bottom:18px">Overall impact: ${totalImpact>0?'+':''}${totalImpact} pts · Favorability ${favBonus>=0?'+':''}${favBonus}%</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${Object.entries(impacts).map(([k,v])=>`
            <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px">
              <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">${k.toUpperCase()}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:${v>0?'#22c55e':v<0?'#ef4444':'#8a93a8'}">${v>0?'+':''}${v}%</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
        <button onclick="showMGCloseBtn();closeMG(${favBonus})" style="padding:12px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;cursor:pointer;width:100%">Apply Results →</button>
      </div>`;
    // Apply persona bonus/penalty
    if(selectedPersona && selectedPersona.fx) {
      const personaMsg = selectedPersona.fx(impacts);
      // Re-calc total after persona adjustments
      const totalImpact2 = Object.values(impacts).reduce((s,v)=>s+v,0);
      const favBonus2 = Math.round(totalImpact2/8);
      const personaCol = selectedPersona.tagColor || '#c8a84b';
      el.innerHTML += `<div style="margin:0 22px 16px;padding:10px 12px;background:${personaCol}11;border:1px solid ${personaCol}33;border-radius:6px;font-size:11px;color:${personaCol};font-style:italic">${selectedPersona.icon} ${selectedPersona.name}: ${personaMsg}</div>`;
    }
    MG.bonus = favBonus;
    MG.demoImpacts = impacts;
  };

  renderQ();
  } // end startDebateQuestions
}

// ─── FUNDRAISING MINIGAME ───
function renderFundraiseMinigame(el){
  // Pitch meeting fundraising: 5 big donors, 3 pitches each.
  // Match your pitch angle to the donor's known interests.
  // Party-aware donor pool — each donor tagged with parties that make sense for them
  const ALL_DONOR_MEETINGS = [
    { name:'Silicon Valley CEO', icon:'💻', interests:'innovation, deregulation, immigration reform', parties:['dem','rep','custom'],
      rounds:[
        { prompt:'She opens: \"I\\have given to both parties. Why should my money go to you?\"',
          opts:[
            {t:'\"Because I\\am the only candidate who\\will actually pass the immigration bill that lets you keep your talent.\"', pts:3},
            {t:'\"I believe in the private sector as an engine of growth.\"', pts:1},
            {t:'\"Because I need your help.\"', pts:0},
          ]},
        { prompt:'Her chief of staff mentions their AI regulation concerns.',
          opts:[
            {t:'\"I\\have hired four former tech executives to advise on AI policy. Here\\is our framework.\"', pts:3},
            {t:'\"We\\are open to working with the industry.\"', pts:1},
            {t:'\"I support innovation.\"', pts:0},
          ]},
        { prompt:'She asks the ask amount.',
          opts:[
            {t:'\"The maximum: $3,300. And I\\would ask you to bundle ten of your colleagues.\"', pts:3},
            {t:'\"Whatever you feel comfortable with.\"', pts:1},
            {t:'\"Even $500 would be helpful.\"', pts:0},
          ]},
      ]},
    { name:'Union President (Steel Workers)', icon:'⚒-', interests:'jobs, tariffs, worker protections', parties:['dem','custom'],
      rounds:[
        { prompt:'He leans in: \"Prove you\\are not just using us for photo ops.\"',
          opts:[
            {t:'\"I voted against the trade deal in 2019. Lost four corporate donors. I\\would do it again.\"', pts:3},
            {t:'\"I have a strong record supporting workers.\"', pts:1},
            {t:'\"I need your endorsement.\"', pts:0},
          ]},
        { prompt:'He brings up the plant closings in his district.',
          opts:[
            {t:'\"Name the plant. I\\will visit it this week. We\\will make that the face of my manufacturing plan.\"', pts:3},
            {t:'\"That\\is a tragedy and I\\will fight for those workers.\"', pts:2},
            {t:'\"I understand your concerns.\"', pts:0},
          ]},
        { prompt:'He asks what you need from him.',
          opts:[
            {t:'\"Mobilize your locals in PA, OH, and MI. Knock doors. I\\will do the same.\"', pts:3},
            {t:'\"Your endorsement would be tremendous.\"', pts:1},
            {t:'\"Any support you can give.\"', pts:0},
          ]},
      ]},
    { name:'Hollywood Bundler', icon:'🎬', interests:'arts funding, social issues, climate', parties:['dem'],
      rounds:[
        { prompt:'She says: \"My Hollywood network wants to know where you actually stand — no spin.\"',
          opts:[
            {t:'\"I\\have marched. I\\have voted. I\\have lost donors over it. Ask anyone who was there.\"', pts:3},
            {t:'\"I\\am fully committed to the causes this community cares about.\"', pts:1},
            {t:'\"I\\am pragmatic, but my heart is with you.\"', pts:0},
          ]},
        { prompt:'She brings up arts funding being cut in the last budget.',
          opts:[
            {t:'\"I proposed the amendment to restore it. It failed by three votes. I have the bill ready for day one.\"', pts:3},
            {t:'\"That was a mistake I\\will correct.\"', pts:2},
            {t:'\"Arts are important to me personally.\"', pts:0},
          ]},
        { prompt:'She offers to host a fundraiser.',
          opts:[
            {t:'\"Yes — invite your network, I\\will do 90 minutes, no scripts, real conversation. That\\is how we move numbers.\"', pts:3},
            {t:'\"That would be wonderful. Thank you.\"', pts:1},
            {t:'\"We\\will coordinate with my team.\"', pts:0},
          ]},
      ]},
    { name:'Hedge Fund Manager', icon:'📈', interests:'tax policy, regulatory environment, fiscal responsibility', parties:['dem','rep','custom'],
      rounds:[
        { prompt:'He opens with: \"What\\is your position on carried interest?\"',
          opts:[
            {t:'\"I\\will be direct: I\\will close the loophole. But I\\will not come after capital gains for long-term investments.\"', pts:3},
            {t:'\"Tax reform is complex. There are many stakeholders.\"', pts:1},
            {t:'\"I support fair taxation.\"', pts:0},
          ]},
        { prompt:'He says he\\is worried about deficit spending.',
          opts:[
            {t:'\"My plan cuts $400B in defense procurement waste before it asks anything of markets. Here\\is the line item.\"', pts:3},
            {t:'\"Fiscal discipline is a priority.\"', pts:1},
            {t:'\"We need to grow our way out.\"', pts:0},
          ]},
        { prompt:'He asks why he should donate instead of supporting the opponent.',
          opts:[
            {t:'\"Because I\\am the only one in this race who will actually implement — not just promise. My record shows it.\"', pts:3},
            {t:'\"I\\would be a better president.\"', pts:1},
            {t:'\"I appreciate your consideration.\"', pts:0},
          ]},
      ]},
    { name:'Evangelical Pastor & Coalition Leader', icon:'⛪', interests:'religious liberty, family values, school choice', parties:['rep'],
      rounds:[
        { prompt:'He says: \"A lot of candidates court us and then forget us. Why should we believe you?\"',
          opts:[
            {t:'\"My record on religious liberty legislation speaks louder than promises. Here are three votes.\"', pts:3},
            {t:'\"Faith is a cornerstone of who I am, not a campaign prop.\"', pts:2},
            {t:'\"I respect your community deeply.\"', pts:0},
          ]},
        { prompt:'He raises school choice and parental rights in education.',
          opts:[
            {t:'\"I\\will expand school choice nationally. Every parent deserves an option, not just the wealthy ones.\"', pts:3},
            {t:'\"I support parental rights and local control — the federal government should step back.\"', pts:2},
            {t:'\"Education is a top priority for me.\"', pts:0},
          ]},
        { prompt:'He asks what you\\will do for his community on day one.',
          opts:[
            {t:'\"Sign an executive order protecting religious organizations from government compulsion. Day one, not day 100.\"', pts:3},
            {t:'\"I\\will make sure your voice is heard in this administration.\"', pts:1},
            {t:'\"We share the same values.\"', pts:0},
          ]},
      ]},
    { name:'Defense Industry Executive', icon:'🛡-', interests:'military spending, national security, veterans', parties:['rep','custom'],
      rounds:[
        { prompt:'He opens: \"The last administration gutted our modernization budget. Where do you stand?\"',
          opts:[
            {t:'\"I\\will restore the defense budget and fast-track the next-gen fighter program. America must lead.\"', pts:3},
            {t:'\"Strong defense is non-negotiable. I\\will work with Congress to rebuild readiness.\"', pts:2},
            {t:'\"National security is a priority.\"', pts:0},
          ]},
        { prompt:'He asks about China and Taiwan.',
          opts:[
            {t:'\"Strategic ambiguity is over. We make clear that Taiwan\\is defended — and we back it with real assets in the Pacific.\"', pts:3},
            {t:'\"We\\will maintain our alliances and posture in the Indo-Pacific.\"', pts:1},
            {t:'\"We need a strong China policy.\"', pts:0},
          ]},
        { prompt:'He wants to know about your veterans agenda.',
          opts:[
            {t:'\"Veterans Choice expansion, fast VA reform, and a commitment to never sending troops in without a clear mission and exit.\"', pts:3},
            {t:'\"Veterans come first. Full stop.\"', pts:2},
            {t:'\"I deeply respect our service members.\"', pts:0},
          ]},
      ]},
    { name:'Small Business Coalition Chair', icon:'--', interests:'tax cuts, deregulation, local economy', parties:['rep','custom'],
      rounds:[
        { prompt:'She says: \"Washington keeps piling on regulations. We\\are drowning. What changes?\"',
          opts:[
            {t:'\"I\\will sign a two-for-one rollback order on day one — every new reg requires cutting two existing ones.\"', pts:3},
            {t:'\"Reducing the regulatory burden is one of my top priorities.\"', pts:1},
            {t:'\"I hear you and I want to help.\"', pts:0},
          ]},
        { prompt:'She raises the corporate tax rate.',
          opts:[
            {t:'\"The big guys can handle it. I\\am cutting the small business pass-through rate and leaving it there.\"', pts:3},
            {t:'\"I support tax relief that actually reaches Main Street, not just multinationals.\"', pts:2},
            {t:'\"I support lower taxes.\"', pts:0},
          ]},
        { prompt:'She asks what makes you different from the establishment.',
          opts:[
            {t:'\"I\\have built a business. I have made payroll. I know what it costs when government gets it wrong.\"', pts:3},
            {t:'\"I\\am not a career politician — I actually understand what you\\are going through.\"', pts:2},
            {t:'\"I\\will always put small businesses first.\"', pts:0},
          ]},
      ]},
    { name:'Environmental Philanthropist', icon:'🌿', interests:'climate policy, clean energy, conservation', parties:['dem','custom'],
      rounds:[
        { prompt:'He says: \"We\\have heard promises before. Give me something concrete.\"',
          opts:[
            {t:'\"Net-zero by 2045, $500B in clean energy investment, and I\\will re-enter the Paris Agreement on day one.\"', pts:3},
            {t:'\"Climate is my generation\\is defining challenge and I\\will treat it that way.\"', pts:1},
            {t:'\"I care deeply about the environment.\"', pts:0},
          ]},
        { prompt:'He asks about fossil fuel subsidies.',
          opts:[
            {t:'\"Gone. Every dollar redirected to clean energy transition and worker retraining. Here\\is the legislative text.\"', pts:3},
            {t:'\"We need to phase them out responsibly while protecting workers.\"', pts:2},
            {t:'\"I\\will review the subsidy structure.\"', pts:0},
          ]},
        { prompt:'He wants to know your position on nuclear power.',
          opts:[
            {t:'\"Modern nuclear is part of the bridge. I support next-gen small modular reactors as part of a clean grid.\"', pts:3},
            {t:'\"I\\am open to all proven clean options — the science guides my policy.\"', pts:2},
            {t:'\"I support renewable energy.\"', pts:0},
          ]},
      ]},
  ];

  const party = (GS.playerParty || 'dem');
  const DONOR_MEETINGS = ALL_DONOR_MEETINGS.filter(d => d.parties.includes(party));
  const meeting = _mgPickQuestions('fundraise', DONOR_MEETINGS, 1)[0];
  let round=0, totalPts=0;

  const renderRound=()=>{
    if(round>=meeting.rounds.length){ showFundraiseResult(el,totalPts,meeting); return; }
    const r=meeting.rounds[round];
    const opts=[...r.opts].sort(()=>Math.random()-0.5);

    el.innerHTML=`
      <div style="background:linear-gradient(135deg,#08100c,#0b1410);padding:18px 22px;border-bottom:1px solid #1e2535">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em">💰 PITCH MEETING · EXCHANGE ${round+1}/${meeting.rounds.length}</div>
          <div style="font-size:16px">${meeting.icon}</div>
        </div>
        <div style="font-size:11px;font-weight:600;color:#c8a84b;margin-bottom:4px">${meeting.name}</div>
        <div style="font-size:13px;font-style:italic;color:#e8ecf4;line-height:1.45">"${r.prompt.replace(/^.*?:\s*/,'')}"</div>
        <div style="margin-top:6px;font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace">Interests: ${meeting.interests}</div>
      </div>
      <div style="padding:14px 22px;display:flex;flex-direction:column;gap:7px">
        ${opts.map((o,i)=>`
          <button onclick="fmPick(${i})" style="padding:11px 14px;background:#10141c;border:1px solid #1e2535;border-radius:6px;color:#c8d0e0;font-size:12px;text-align:left;cursor:pointer;transition:border-color .15s;line-height:1.4" onmouseover="this.style.borderColor='#22c55e'" onmouseout="this.style.borderColor='#1e2535'">${o.t}</button>`).join('')}
      </div>`;

    window.fmPick=(si)=>{
      const opt=opts[si]; if(!opt){round++;renderRound();return;}
      totalPts+=opt.pts;
      const icon=opt.pts>=3?'💎':opt.pts>=2?'✅':opt.pts>=1?'-':'--';
      const msg=opt.pts>=3?'They lean forward. Strong pitch.':opt.pts>=2?'Decent answer — they stay engaged.':opt.pts>=1?'Tepid. Not losing them yet.':'They check their phone.';
      el.innerHTML=`
        <div style="background:#080c14;padding:28px 22px;text-align:center">
          <div style="font-size:36px;margin-bottom:10px">${icon}</div>
          <div style="font-size:15px;font-weight:600;color:${opt.pts>=3?'#22c55e':opt.pts>=2?'#c8a84b':opt.pts>=1?'#8a93a8':'#ef4444'};margin-bottom:8px">${msg}</div>
          <div style="font-size:11px;color:#4a5568;font-family:'IBM Plex Mono',monospace">+${opt.pts} impression pts</div>
        </div>`;
      setTimeout(()=>{round++;renderRound();},900);
    };
  };

  const showFundraiseResult=(el,pts,meeting)=>{
    const maxPts=meeting.rounds.length*3;
    const pct=pts/maxPts;
    const fundRaised=pct>=0.9?5:pct>=0.7?3:pct>=0.5?1.8:pct>=0.3?0.8:0;
    const grade=pct>=0.9?'💎 Locked In':pct>=0.7?'✅ They\\are In':pct>=0.5?'- Soft Commit':'-- Cold Pass';
    el.innerHTML=`
      <div style="background:#080c14;padding:28px 22px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">💰 PITCH MEETING — RESULT</div>
        <div style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;margin-bottom:6px">${grade}</div>
        <div style="color:#8a93a8;font-size:12px;margin-bottom:20px">${pts}/${maxPts} impression points · ${meeting.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px">
          <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px">
            <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">RAISED</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#22c55e">$${fundRaised}M</div>
          </div>
          <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px">
            <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">WAR CHEST</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#c8a84b">+$${fundRaised}M</div>
          </div>
        </div>
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
        <button onclick="closeMGFund(${fundRaised})" style="padding:12px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;cursor:pointer;width:100%">Bank It →</button>
      </div>`;
    window.closeMGFund=(f)=>{GS.funds=cl(GS.funds+f,0,999);GS.totalRaised+=f;MG.fundBonus=f;showMGCloseBtn();closeMG(f);}
  };

  renderRound();
}


// ─── SPEECH WRITER MINIGAME ───
// Write a major policy speech paragraph by paragraph — each choice shifts demographic support
const SPEECH_TOPICS = [
  {
    title: "The Economy & Working Families",
    icon: "💼",
    paragraphs: [
      {
        prompt: "Opening — frame the economic challenge:",
        opts: [
          { text: "For too long, the gains of economic growth have flowed upward while working families are left behind. That ends now.", fx:{urban:+4,youth:+3,rural:-2,suburban:+1,seniors:+2} },
          { text: "America's economic engine is the envy of the world — but we must ensure every American can participate in that prosperity.", fx:{urban:+1,youth:0,rural:+1,suburban:+4,seniors:+3} },
          { text: "Free markets made America great. The answer is less government interference, not more.", fx:{urban:-3,youth:-3,rural:+5,suburban:+3,seniors:+2} },
        ]
      },
      {
        prompt: "The solution — your policy approach:",
        opts: [
          { text: "I will raise the minimum wage, guarantee paid leave, and make childcare affordable for every American family.", fx:{urban:+5,youth:+5,rural:0,suburban:+1,seniors:+2} },
          { text: "My plan cuts taxes for small businesses, removes red tape, and invests in apprenticeship programs to build skills.", fx:{urban:-1,youth:-1,rural:+4,suburban:+5,seniors:+3} },
          { text: "We'll rebuild American manufacturing with smart trade deals and direct investment in industrial communities.", fx:{urban:+1,youth:+1,rural:+5,suburban:+2,seniors:+4} },
        ]
      },
      {
        prompt: "Closing call to action:",
        opts: [
          { text: "Together we will build an economy that works for the many, not just the wealthy few. This is our moment.", fx:{urban:+3,youth:+4,rural:-1,suburban:+1,seniors:+2} },
          { text: "The American dream is not dead — but it needs champions. I will be yours in the Oval Office.", fx:{urban:+2,youth:+2,rural:+2,suburban:+3,seniors:+4} },
          { text: "Hard work should always be rewarded. I believe in you, and I'll fight every day to prove it.", fx:{urban:+1,youth:+1,rural:+4,suburban:+3,seniors:+5} },
        ]
      }
    ]
  },
  {
    title: "National Security & Foreign Policy",
    icon: "-",
    paragraphs: [
      {
        prompt: "Opening — America's role in the world:",
        opts: [
          { text: "America must lead the free world — pulling back from alliances only emboldens authoritarian powers who threaten our values.", fx:{urban:+3,youth:-1,rural:-2,suburban:+3,seniors:+5} },
          { text: "We have spent too much blood and treasure on other nations problems. America First is not isolationism — it is wisdom.", fx:{urban:-3,youth:-1,rural:+6,suburban:+2,seniors:+3} },
          { text: "Diplomacy first. Military force is the last resort, not the first. Strong alliances are America's greatest security asset.", fx:{urban:+4,youth:+5,rural:-3,suburban:+1,seniors:0} },
        ]
      },
      {
        prompt: "On military spending and strength:",
        opts: [
          { text: "We'll increase the defense budget, modernize our arsenal, and ensure America's military remains second to none.", fx:{urban:-2,youth:-3,rural:+5,suburban:+2,seniors:+5} },
          { text: "We can be strong and smart — smarter use of existing resources beats endless blank checks to the Pentagon.", fx:{urban:+3,youth:+3,rural:-1,suburban:+1,seniors:-1} },
          { text: "True security means investing in diplomacy, intelligence, and cyber defense — not just more aircraft carriers.", fx:{urban:+4,youth:+4,rural:-2,suburban:+1,seniors:-2} },
        ]
      },
      {
        prompt: "The vision for peace:",
        opts: [
          { text: "We will forge strong alliances, stand with our democratic partners, and project American strength — always.", fx:{urban:+2,youth:0,rural:+1,suburban:+3,seniors:+4} },
          { text: "I will end the era of endless wars and bring our troops home — focused, strategic, and dignified.", fx:{urban:+3,youth:+4,rural:+3,suburban:+2,seniors:+3} },
          { text: "Peace through strength: adversaries must know that any threat to America or her allies will be met with overwhelming resolve.", fx:{urban:-1,youth:-2,rural:+4,suburban:+3,seniors:+5} },
        ]
      }
    ]
  }
];

SPEECH_TOPICS.push(
  {
    title: "Healthcare & the American Family",
    icon: "--",
    paragraphs: [
      {
        prompt: "Opening — frame the healthcare crisis:",
        opts: [
          { text: "No family should go bankrupt because someone got sick. Healthcare is a basic human right in the wealthiest nation on Earth.", fx:{urban:+5,youth:+5,rural:+1,suburban:+2,seniors:+4} },
          { text: "Our healthcare system is world-class — but skyrocketing costs and bureaucracy are failing too many families.", fx:{urban:+1,youth:0,rural:+1,suburban:+4,seniors:+3} },
          { text: "Government-run healthcare destroyed quality. Free market competition is the only sustainable answer.", fx:{urban:-3,youth:-3,rural:+3,suburban:+4,seniors:+1} },
        ]
      },
      {
        prompt: "Your specific plan:",
        opts: [
          { text: "I'll lower the Medicare eligibility age to 55 and create a robust public option that competes with private insurers.", fx:{urban:+4,youth:+4,rural:+1,suburban:+2,seniors:+6} },
          { text: "Cap insulin at $35, allow Medicare to negotiate drug prices, and end surprise medical billing once and for all.", fx:{urban:+4,youth:+3,rural:+3,suburban:+4,seniors:+6} },
          { text: "Expand Health Savings Accounts, deregulate across state lines, and trust Americans to make their own choices.", fx:{urban:-2,youth:-2,rural:+3,suburban:+5,seniors:+2} },
        ]
      },
      {
        prompt: "Closing emotional appeal:",
        opts: [
          { text: "I have met the families. I have heard the stories. I will not stop until every American can see a doctor without fear.", fx:{urban:+4,youth:+3,rural:+3,suburban:+3,seniors:+5} },
          { text: "This is not a political issue — it is a moral one. And I have a plan that will finally deliver.", fx:{urban:+3,youth:+3,rural:+2,suburban:+3,seniors:+4} },
          { text: "We can cut costs, protect choice, and keep government out of your exam room. That's my promise.", fx:{urban:-1,youth:-1,rural:+4,suburban:+5,seniors:+3} },
        ]
      }
    ]
  },
  {
    title: "Democracy & Restoring Trust",
    icon: "🗳-",
    paragraphs: [
      {
        prompt: "Opening — the state of our democracy:",
        opts: [
          { text: "Democracy itself is on the ballot. When people stop believing their votes count, the whole system unravels.", fx:{urban:+6,youth:+7,rural:-2,suburban:+2,seniors:+1} },
          { text: "Americans are losing faith in institutions — and frankly, some of that distrust is earned. We have to rebuild it.", fx:{urban:+3,youth:+3,rural:+2,suburban:+4,seniors:+3} },
          { text: "The system works — but career politicians and media elites have corrupted it. It's time for outsiders to take it back.", fx:{urban:-4,youth:-1,rural:+7,suburban:+2,seniors:+3} },
        ]
      },
      {
        prompt: "On elections and voting rights:",
        opts: [
          { text: "Automatic voter registration, national early voting, and same-day registration — make voting as easy as possible.", fx:{urban:+6,youth:+8,rural:-3,suburban:+1,seniors:-1} },
          { text: "Voter ID and robust audit systems protect the integrity of every legitimate vote cast.", fx:{urban:-4,youth:-4,rural:+7,suburban:+3,seniors:+5} },
          { text: "End gerrymandering with independent redistricting commissions. Let voters choose their politicians, not the other way round.", fx:{urban:+4,youth:+4,rural:+2,suburban:+4,seniors:+3} },
        ]
      },
      {
        prompt: "Closing vision for institutions:",
        opts: [
          { text: "I will restore the independence of the Justice Department, the Fed, and every agency — no more politicisation of the civil service.", fx:{urban:+5,youth:+4,rural:+1,suburban:+4,seniors:+3} },
          { text: "We need term limits, a lobbying ban for former officials, and full transparency on campaign finance.", fx:{urban:+4,youth:+5,rural:+4,suburban:+4,seniors:+3} },
          { text: "The people should run this country — not think tanks, not donors, not the media. I'll answer only to you.", fx:{urban:-1,youth:+2,rural:+6,suburban:+2,seniors:+3} },
        ]
      }
    ]
  },
  {
    title: "Climate & the Environment",
    icon: "🌱",
    paragraphs: [
      {
        prompt: "Opening — set the stakes:",
        opts: [
          { text: "The science is unambiguous: we have one decade to fundamentally transform our energy system or face irreversible consequences.", fx:{urban:+6,youth:+9,rural:-5,suburban:+1,seniors:-2} },
          { text: "Clean air and clean water are not partisan issues. Every American deserves to pass on a livable planet to their children.", fx:{urban:+4,youth:+5,rural:+2,suburban:+3,seniors:+3} },
          { text: "I believe in a clean environment — but radical climate policy will kill jobs and destroy rural economies.", fx:{urban:-3,youth:-4,rural:+6,suburban:+2,seniors:+3} },
        ]
      },
      {
        prompt: "Your energy policy:",
        opts: [
          { text: "A 100% clean electricity standard by 2035, massive investment in solar, wind, and battery storage — and millions of new jobs.", fx:{urban:+5,youth:+7,rural:-3,suburban:+2,seniors:-1} },
          { text: "All of the above: invest in renewables but keep nuclear, natural gas, and clean coal in the mix for reliability.", fx:{urban:+1,youth:+1,rural:+4,suburban:+5,seniors:+4} },
          { text: "American energy dominance — drill more, export more, and lead the world from a position of strength.", fx:{urban:-4,youth:-5,rural:+7,suburban:+2,seniors:+4} },
        ]
      },
      {
        prompt: "On jobs and the energy transition:",
        opts: [
          { text: "The clean energy transition is the greatest job-creation opportunity since World War Two. I'll make sure America leads it.", fx:{urban:+5,youth:+6,rural:-1,suburban:+3,seniors:+2} },
          { text: "We will invest in communities affected by the energy transition — no coal miner, no oil worker gets left behind.", fx:{urban:+3,youth:+3,rural:+5,suburban:+3,seniors:+3} },
          { text: "Government should not pick energy winners. Let the market innovate and let consumers choose.", fx:{urban:-3,youth:-3,rural:+4,suburban:+4,seniors:+3} },
        ]
      }
    ]
  }
);

function renderSpeechMinigame(el){
  // Pick a random speech topic
  const topic = SPEECH_TOPICS[~~(Math.random()*SPEECH_TOPICS.length)];
  let para = 0;
  const impacts = {urban:0,youth:0,rural:0,suburban:0,seniors:0};
  const chosen = [];

  const renderPara = ()=>{
    if(para >= topic.paragraphs.length){ showSpeechResult(el, topic, chosen, impacts); return; }
    const p = topic.paragraphs[para];
    // Shuffle options
    const opts = [...p.opts].sort(()=>Math.random()-.5);

    el.innerHTML=`
      <div style="background:linear-gradient(135deg,#080c14,#0a0f1e);padding:18px 22px;border-bottom:1px solid #1e2535">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:4px">${topic.icon} ${topic.title.toUpperCase()} · PARAGRAPH ${para+1}/${topic.paragraphs.length}</div>
        <div style="font-size:13px;font-weight:600;color:#e8ecf4">${p.prompt}</div>
        ${chosen.length>0?`<div style="margin-top:10px;padding:10px 12px;background:#0d1117;border-left:3px solid #c8a84b;border-radius:0 4px 4px 0;font-size:11px;color:#8a93a8;font-style:italic;line-height:1.5">${chosen.map(c=>'"'+c.text.substring(0,80)+'..."').join('<br>')}</div>`:''}
      </div>
      <div style="padding:14px 22px;display:flex;flex-direction:column;gap:8px">
        ${opts.map((o,i)=>`
          <button onclick="speechPick(${i})" style="padding:13px 16px;background:#10141c;border:1px solid #1e2535;border-radius:8px;color:#c8d0e0;font-size:12px;text-align:left;cursor:pointer;transition:border-color .15s;line-height:1.5" onmouseover="this.style.borderColor='#c8a84b'" onmouseout="this.style.borderColor='#1e2535'">
            <div style="font-style:italic">"${o.text}"</div>
          </button>`).join('')}
      </div>`;

    window.speechPick = (si)=>{
      const pick = opts[si];
      chosen.push(pick);
      Object.keys(impacts).forEach(k=>{ if(pick.fx[k]) impacts[k]+=pick.fx[k]; });
      para++;
      renderPara();
    };
  };

  window.showSpeechResult = (el, topic, chosen, impacts)=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const favBonus = Math.round(total/9);
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v,10,90); });
    el.innerHTML=`
      <div style="background:#080c14;padding:22px">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">📜 ${topic.icon} SPEECH DELIVERED — AUDIENCE REACTION</div>
        <div style="background:#0d1117;border:1px solid #1e2535;border-radius:8px;padding:16px;margin-bottom:16px;font-size:11px;color:#8a93a8;line-height:1.8;font-style:italic">
          ${chosen.map(c=>'"'+c.text+'"').join('<br><br>')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:18px">
          ${Object.entries(impacts).map(([k,v])=>`
            <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace">${k.toUpperCase()}</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:700;color:${v>0?'#22c55e':v<0?'#ef4444':'#8a93a8'}">${v>0?'+':''}${v}%</span>
            </div>`).join('')}
        </div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:16px;text-align:center">Overall impact: ${total>0?'+':''}${total} · Favorability ${favBonus>=0?'+':''}${favBonus}%</div>
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
        <button onclick="showMGCloseBtn();closeMG(${favBonus})" style="padding:12px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;cursor:pointer;width:100%">Deliver Speech →</button>
      </div>`;
    MG.bonus = favBonus;
  };

  renderPara();
}

// ─── ATTACK MINIGAME: Opposition Research War Room ───
// No "correct" attack — each approach hits different groups differently
const ATTACK_SCENARIOS = [
  {
    headline: "- File discovered: Opponent took $2M from health insurance lobby then voted against drug price caps.",
    issue: "Healthcare Corruption",
    tactics: [
      { text: "Release a detailed fact-based report comparing their votes to their donations.", fx:{urban:+4,youth:+3,rural:+2,suburban:+3,seniors:+4}, backfire:5 },
      { text: "Run emotional TV ads: 'While you paid more, they pocketed $2 million.'", fx:{urban:+2,youth:+2,rural:+4,suburban:+2,seniors:+5}, backfire:15 },
      { text: "Call a press conference with families who could not afford medicine.", fx:{urban:+5,youth:+4,rural:+3,suburban:+4,seniors:+6}, backfire:8 },
      { text: "Leak it to investigative reporters and let them run with it.", fx:{urban:+3,youth:+2,rural:+1,suburban:+3,seniors:+2}, backfire:20 },
    ]
  },
  {
    headline: "- File discovered: Opponent misused campaign funds for personal travel in 2019.",
    issue: "Campaign Finance",
    tactics: [
      { text: "File an FEC complaint and hold a press conference with the evidence.", fx:{urban:+4,youth:+3,rural:+3,suburban:+4,seniors:+4}, backfire:5 },
      { text: "Run social media clips mocking their 'luxury campaign jets'.", fx:{urban:+2,youth:+4,rural:+1,suburban:+1,seniors:-1}, backfire:22 },
      { text: "Mention it during the next debate as a pointed contrast.", fx:{urban:+3,youth:+2,rural:+3,suburban:+3,seniors:+4}, backfire:12 },
      { text: "Say nothing — voters will find out eventually.", fx:{urban:-2,youth:-1,rural:-2,suburban:-2,seniors:-1}, backfire:0 },
    ]
  },
  {
    headline: "- File discovered: Opponent voted against veterans' benefits three times while claiming to 'support the troops.'",
    issue: "Veterans & Military",
    tactics: [
      { text: "Hold a rally at a VA hospital. Let the veterans speak for themselves.", fx:{urban:+3,youth:+2,rural:+6,suburban:+4,seniors:+6}, backfire:6 },
      { text: "Cut a 30-second ad contrasting their words vs. their voting record.", fx:{urban:+2,youth:+2,rural:+5,suburban:+3,seniors:+5}, backfire:10 },
      { text: "Challenge them publicly to debate veterans' issues at the next forum.", fx:{urban:+3,youth:+3,rural:+4,suburban:+3,seniors:+4}, backfire:8 },
      { text: "Pass the file to veterans' organisations and let them lead the charge.", fx:{urban:+2,youth:+1,rural:+4,suburban:+2,seniors:+3}, backfire:14 },
    ]
  },
  {
    headline: "- File discovered: Opponent received payments from a foreign-linked PAC routed through shell companies.",
    issue: "Foreign Influence",
    tactics: [
      { text: "Demand a federal investigation. Hold a press conference with campaign finance lawyers.", fx:{urban:+4,youth:+3,rural:+3,suburban:+5,seniors:+4}, backfire:8 },
      { text: "Leak to the press and let investigative journalists do the work.", fx:{urban:+3,youth:+3,rural:+2,suburban:+3,seniors:+3}, backfire:18 },
      { text: "Hit them in debate: 'Whose side are you really on?'", fx:{urban:+2,youth:+2,rural:+4,suburban:+3,seniors:+4}, backfire:15 },
      { text: "Hold off — the evidence may be circumstantial, and a failed attack would devastate us.", fx:{urban:-1,youth:-1,rural:-1,suburban:-1,seniors:-1}, backfire:0 },
    ]
  },
  {
    headline: "- File discovered: Opponent was absent for 60% of congressional votes last year while fundraising.",
    issue: "Dereliction of Duty",
    tactics: [
      { text: "Release a simple infographic: their voting record vs. their travel itinerary.", fx:{urban:+4,youth:+4,rural:+3,suburban:+4,seniors:+4}, backfire:5 },
      { text: "Run ads in their home district. Make their own constituents ask questions.", fx:{urban:+3,youth:+3,rural:+3,suburban:+3,seniors:+4}, backfire:10 },
      { text: "Use the stat in every speech. Grind them down with repetition.", fx:{urban:+2,youth:+2,rural:+3,suburban:+2,seniors:+3}, backfire:8 },
      { text: "Challenge them to a weekly work log comparison.", fx:{urban:+2,youth:+1,rural:+2,suburban:+2,seniors:+2}, backfire:5 },
    ]
  },
  {
    headline: "- File discovered: Opponent privately told a donor the border is not actually a priority — audio exists.",
    issue: "Immigration Hypocrisy",
    tactics: [
      { text: "Release the audio clip with full context. Let voters decide.", fx:{urban:+1,youth:+1,rural:+6,suburban:+3,seniors:+4}, backfire:12 },
      { text: "Share only the key quote. Make it go viral.", fx:{urban:+1,youth:+3,rural:+5,suburban:+2,seniors:+3}, backfire:25 },
      { text: "Call a press conference: 'The voters deserve to hear this.'", fx:{urban:+2,youth:+2,rural:+5,suburban:+3,seniors:+4}, backfire:10 },
      { text: "Keep it in reserve — use it only if the race tightens.", fx:{urban:-2,youth:-2,rural:-2,suburban:-2,seniors:-2}, backfire:0 },
    ]
  },
];

function renderAttackMinigame(el){
  const scenario = ATTACK_SCENARIOS[~~(Math.random()*ATTACK_SCENARIOS.length)];
  const tactics = [...scenario.tactics].sort(()=>Math.random()-.5);
  let chosen = false;

  el.innerHTML=`
    <div style="background:linear-gradient(135deg,#140808,#1a0f0f);padding:18px 22px;border-bottom:1px solid #2a1818">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#ef4444;letter-spacing:.15em;margin-bottom:8px">- OPPOSITION RESEARCH WAR ROOM · ${scenario.issue.toUpperCase()}</div>
      <div style="background:#0d0909;border:1px solid #2a1818;border-radius:6px;padding:12px;font-size:13px;color:#e8c8c8;font-family:'IBM Plex Mono',monospace;line-height:1.5">${scenario.headline}</div>
      <div style="margin-top:8px;font-size:12px;color:#8a7070">How do you play this? Choose your attack strategy — each has risks.</div>
    </div>
    <div style="padding:14px 22px;display:flex;flex-direction:column;gap:7px">
      ${tactics.map((t,i)=>`
        <button onclick="attackPick(${i})" style="padding:12px 14px;background:#100c0c;border:1px solid #2a1818;border-radius:6px;color:#e0c8c8;font-size:12px;text-align:left;cursor:pointer;transition:border-color .15s;line-height:1.4" onmouseover="this.style.borderColor='#ef4444'" onmouseout="this.style.borderColor='#2a1818'">
          ${t.text}
          <div style="font-size:10px;color:#4a3a3a;margin-top:3px;font-family:'IBM Plex Mono',monospace">Backfire risk: ${'▮'.repeat(Math.ceil(t.backfire/7))}${'▯'.repeat(3-Math.ceil(t.backfire/7))} ${t.backfire<10?'LOW':t.backfire<20?'MEDIUM':'HIGH'}</div>
        </button>`).join('')}
    </div>`;

  window.attackPick = (si)=>{
    if(chosen) return;
    chosen=true;
    const t = tactics[si];
    const backfired = Math.random()*100 < t.backfire;
    let impacts, headline;
    if(backfired){
      // Backfire: negative across the board
      impacts={urban:-3,youth:-2,rural:-3,suburban:-3,seniors:-2};
      headline='💥 BACKFIRE! The attack was seen as desperate and overplayed. Media turns on your campaign.';
    } else {
      impacts=t.fx;
      headline='✅ ATTACK LANDS. Your campaign dominates the news cycle.';
    }
    const total=Object.values(impacts).reduce((s,v)=>s+v,0);
    const bonus=backfired?-4:Math.round(total/14);
    // Apply to opp's approval
    if(!backfired && GS.opponent) GS.opponent.approval=cl(GS.opponent.approval-Math.abs(total)/10,20,80);
    el.innerHTML=`<div style="background:#080c14;padding:20px 22px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0;text-align:center">
      <div style="font-size:36px;margin-bottom:10px">${backfired?'💥':'🎯'}</div>
      <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:8px">${headline}</div>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:12px">
        ${Object.entries(impacts).map(([k,v])=>`<div style="padding:5px 10px;background:${v>0?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};border:1px solid ${v>0?'#22c55e':'#ef4444'};border-radius:20px;font-size:11px;font-family:'IBM Plex Mono',monospace;color:${v>0?'#22c55e':'#f87171'}">${k} ${v>0?'+':''}${v}%</div>`).join('')}
      </div>
    </div>
    <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
      <button onclick="showMGCloseBtn();closeMG(${bonus})" style="padding:12px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;cursor:pointer;width:100%">Continue →</button>
    </div>`;
    MG.bonus=bonus;
  };
}

// Apply minigame bonus to next week's action results
function applyMinigameBonus(events){
  if(!MG.complete) return events;
  const diffScale = {easy:0.55, normal:0.42, hard:0.28}[GS.difficulty] || 0.42;
  const bonus = Math.round((MG.bonus || 0) * diffScale);
  if(MG.actionId==='fundraise' && MG.fundBonus){
    GS.funds += MG.fundBonus; GS.totalRaised += MG.fundBonus;
    events.push({type:'positive',title:'💰 Fundraising Haul',msg:`War chest grows by $${MG.fundBonus.toFixed(1)}M from the fundraising blitz.`});
  } else if((MG.actionId==='townhall'||MG.actionId==='town_hall') && MG.blocImpacts){
    // Town hall returns per-bloc impacts from the Q&A minigame
    const shifts = [];
    Object.entries(MG.blocImpacts).forEach(([k,v])=>{
      if(v && Math.abs(v)>0.1){ shiftBloc(k, v*0.22); shifts.push(`${k} ${v>0?'+':''}${(v*0.22).toFixed(1)}`); }
    });
    if(bonus > 0){ GS.favorability = cl(GS.favorability + bonus*0.28, 20, 85); }
    const shiftStr = shifts.length>0 ? ` Blocs: ${shifts.join(', ')}.` : '';
    if(bonus > 0) events.push({type:'positive',title:'-- Town Hall — Great Performance',msg:`Voters responded well to your answers.${shiftStr} Favorability +${(bonus*0.5).toFixed(1)}%.`});
    else if(bonus < 0) events.push({type:'negative',title:'-- Town Hall — Rocky Night',msg:`Some answers missed the mark.${shiftStr}`});
    else events.push({type:'neutral',title:'-- Town Hall — Decent Performance',msg:`A solid showing.${shiftStr}`});
  } else if(MG.actionId==='visit' && MG.rallyImpacts){
    // Rally minigame: crowd performance boosts the target state directly
    const tgt = GS.states.find(s=>s.code===GS.targetState);
    const total = MG.rallyTotal || 0;
    const diffScale2 = {easy:0.85, normal:0.75, hard:0.50}[GS.difficulty] || 0.75;
    if(tgt){
      // Each point of total crowd impact = ~0.18 pts of state polling, scaled by difficulty
      const stateBoost = cl(total * 0.09 * diffScale2, -3, 4);
      if(GS.phase==='primary') tgt.primLead = cl(tgt.primLead + stateBoost, -60, 60);
      else tgt.genLead = cl(tgt.genLead + stateBoost, -60, 60);
      const boostStr = stateBoost > 0 ? `+${stateBoost.toFixed(1)}` : stateBoost.toFixed(1);
      const label = total>=16?'Legendary — crowd momentum surges':total>=9?'Crowd won over — polling ticks up':total>=3?'Decent showing — modest gains':'Rough night — minimal impact';
      events.push({
        type: total>=9?'positive':total>=3?'neutral':'negative',
        title:`📣 Rally in ${tgt.name}`,
        msg:`${label}. State polling: ${boostStr}%.`
      });
    }
    if(bonus > 0) GS.favorability = cl(GS.favorability + bonus * 0.22, 20, 85);
  } else if(bonus !== 0){
    // Cap generic bonus to ±12 to prevent runaway favorability spikes
    const safebonus = Math.sign(bonus) * Math.min(Math.abs(bonus), 7);
    GS.favorability = cl(GS.favorability + safebonus, 20, 85);
    if(safebonus > 0) events.push({type:'positive',title:'📈 Public Response',msg:`Strong performance moves favorability +${safebonus}%. Demographic shifts applied.`});
    else events.push({type:'negative',title:'📉 Public Backlash',msg:`Performance hurt your image. Favorability ${safebonus}%. Some groups turned off.`});
  }
  MG = {};
  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIGAME: TOWN HALL Q&A
// Five voter questions. Each answer choice affects a specific voter bloc.
// Final score determines bonus.
// ─────────────────────────────────────────────────────────────────────────────
const TOWN_HALL_QUESTIONS = [
  {
    voter:'👷 Bob, 52, Ohio factory worker',
    q:'My plant just closed. What are you going to do for people like me?',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"We\'re going to bring manufacturing back with targeted tariffs and retraining funds."', bloc:'wc', val:3, risk:'medium'},
      {text:'"The economy is more complex than any one policy. We need a long-term strategy."', bloc:'wc', val:0.5, risk:'low'},
      {text:'"I\'ve already proposed a $300B infrastructure bill that creates millions of jobs."', bloc:'wc', val:2, risk:'low'},
    ]
  },
  {
    voter:'--- Priya, 34, suburban mom from Phoenix',
    q:'I\'m worried about school safety. What\'s your actual plan?',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"Expand mental health resources in every school in America. That\'s the root of this."', bloc:'sw', val:2.5, risk:'low'},
      {text:'"We need more resource officers and hardened school buildings."', bloc:'sw', val:1.5, risk:'medium'},
      {text:'"Universal background checks, red-flag laws, and a ban on assault weapons."', bloc:'up', val:2, risk:'high'},
    ]
  },
  {
    voter:'🎓 Jordan, 22, college student',
    q:'Student loan debt is crushing my generation. Will you actually do something about it?',
    parties:['dem','custom'],
    opts:[
      {text:'"Full cancellation for loans under $50,000. Your generation deserves a fair start."', bloc:'yv', val:4, risk:'high'},
      {text:'"Income-based relief targeted at low-income borrowers and public servants."', bloc:'yv', val:2, risk:'medium'},
      {text:'"Forgiveness has to go through Congress. I can\'t make promises I can\'t keep."', bloc:'in', val:1.5, risk:'low'},
    ]
  },
  {
    voter:'🎓 Tyler, 22, college student',
    q:'College is too expensive and I\'m graduating into a tough job market. Where\'s the plan?',
    parties:['rep'],
    opts:[
      {text:'"Deregulate accreditation so trade schools and online degrees compete on a level playing field."', bloc:'yv', val:3, risk:'medium'},
      {text:'"We need to cut university bureaucracy and tie federal funding to graduate employment rates."', bloc:'yv', val:2.5, risk:'medium'},
      {text:'"I support expanding vocational training so a four-year degree isn\'t the only path."', bloc:'yv', val:2, risk:'low'},
    ]
  },
  {
    voter:'👴 Gerald, 71, retired from Boca Raton',
    q:'Social Security cuts — yes or no? Simple answer.',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"No cuts. Full stop. I will veto any bill that reduces Social Security benefits."', bloc:'se', val:4, risk:'low'},
      {text:'"We need to have an honest conversation about the long-term solvency of the program."', bloc:'se', val:-1, risk:'high'},
      {text:'"I support strengthening Social Security by making the wealthy pay more in."', bloc:'se', val:2.5, risk:'medium'},
    ]
  },
  {
    voter:'🌾 Melissa, 43, Iowa farmer',
    q:'Trade policy killed our markets. China, tariffs, subsidies — what\'s your play?',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"I\'m renegotiating trade deals to put American farmers first. We open those markets."', bloc:'rc', val:3, risk:'medium'},
      {text:'"I support the farm subsidies and will expand crop insurance for small operations."', bloc:'rc', val:2, risk:'low'},
      {text:'"Free trade has long-run benefits even when short-run transitions are painful."', bloc:'in', val:1, risk:'low'},
    ]
  },
  {
    voter:'🩺 Sandra, 48, nurse from Nashville',
    q:'I have three jobs and can\'t afford my own insurance. What does that say about this country?',
    parties:['dem','custom'],
    opts:[
      {text:'"It says we\'ve failed you. I\'ll expand Medicaid and create a public option in my first year."', bloc:'wc', val:3, risk:'medium'},
      {text:'"You shouldn\'t have to work three jobs. I\'m proposing a living wage and affordable coverage."', bloc:'wc', val:3.5, risk:'medium'},
      {text:'"The market is part of the solution — competition drives costs down if we remove barriers."', bloc:'in', val:0.5, risk:'low'},
    ]
  },
  {
    voter:'🩺 Gary, 52, nurse from Tennessee',
    q:'Healthcare costs are out of control. The government\'s solution is always more bureaucracy. What\'s yours?',
    parties:['rep'],
    opts:[
      {text:'"Price transparency, cross-state insurance competition, and cutting the middlemen. Free market fixes this."', bloc:'in', val:3, risk:'medium'},
      {text:'"I\'ll let people keep their employer plans and expand Health Savings Accounts so individuals have real control."', bloc:'sw', val:2.5, risk:'low'},
      {text:'"We need to tackle pharmaceutical monopolies — that\'s the real cost driver."', bloc:'wc', val:2, risk:'low'},
    ]
  },
  {
    voter:'----🌈 Marcus, 27, teacher from Atlanta',
    q:'What will you do to protect LGBTQ+ rights, especially for kids in schools?',
    parties:['dem'],
    opts:[
      {text:'"I will sign the Equality Act in my first 100 days. No exceptions."', bloc:'up', val:4, risk:'high'},
      {text:'"Every kid deserves safety. I oppose discrimination while believing in local school decisions."', bloc:'sw', val:1.5, risk:'medium'},
      {text:'"Parents and teachers should decide what\'s taught — not the federal government."', bloc:'rc', val:2, risk:'high'},
    ]
  },
  {
    voter:'👨-👩-👧 Lisa, 41, parent from suburban Georgia',
    q:'I\'m worried about what my kids are being taught in school. Who\'s in charge — parents or the government?',
    parties:['rep'],
    opts:[
      {text:'"Parents. Full stop. I\'ll sign a Parents\' Bill of Rights and let states take back curriculum control."', bloc:'sw', val:4, risk:'medium'},
      {text:'"Local school boards should answer to parents, not federal mandates. I\'ll cut the strings."', bloc:'rc', val:3, risk:'low'},
      {text:'"I believe in transparency — parents have a right to see every lesson plan and textbook."', bloc:'sw', val:2.5, risk:'low'},
    ]
  },
  {
    voter:'⛽ Roy, 58, oil worker from Texas',
    q:'Your climate plan would cost people like me our jobs. How do you sleep at night?',
    parties:['dem','custom'],
    opts:[
      {text:'"I have a $50B workforce transition fund. Your skills will build the clean energy economy."', bloc:'wc', val:2, risk:'medium'},
      {text:'"I will not sacrifice American energy jobs on the altar of ideology."', bloc:'rc', val:3, risk:'low'},
      {text:'"The climate crisis is real and doing nothing costs more jobs in the long run."', bloc:'up', val:1.5, risk:'high'},
    ]
  },
  {
    voter:'⛽ Roy, 58, oil worker from Texas',
    q:'The other party wants to kill our industry. What\'s your energy plan for people like me?',
    parties:['rep'],
    opts:[
      {text:'"American energy dominance — we drill, we export, we stop apologizing for it. I\'ll open federal lands."', bloc:'rc', val:4, risk:'medium'},
      {text:'"Energy independence is national security. I\'ll fast-track permits and roll back the green regulations."', bloc:'in', val:3, risk:'low'},
      {text:'"I support an all-of-the-above strategy — oil, gas, and next-gen nuclear."', bloc:'sw', val:2.5, risk:'low'},
    ]
  },
  {
    voter:'💼 Dana, 38, small business owner from Charlotte',
    q:'Taxes and regulations are killing my business. Why should I vote for you?',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"I\'ll cut taxes on small businesses and gut unnecessary regulations. Big corps pay more."', bloc:'in', val:3, risk:'medium'},
      {text:'"Because my opponent represents the corporations that undercut you with cheap labor."', bloc:'wc', val:2, risk:'high'},
      {text:'"I\'ll simplify the tax code so you spend less time filing and more time growing."', bloc:'in', val:2.5, risk:'low'},
    ]
  },
  {
    voter:'--- Teresa, 44, Chicago, unhoused formerly',
    q:'Homelessness has gotten worse every year. What\'s the actual plan?',
    parties:['dem','custom'],
    opts:[
      {text:'"Housing First. I will fund 500,000 supportive housing units. Period."', bloc:'up', val:4, risk:'medium'},
      {text:'"We need mental health treatment and addiction recovery alongside housing."', bloc:'sw', val:3, risk:'low'},
      {text:'"Safe cities start with enforcing existing laws. I\'ll fund shelters, not free apartments."', bloc:'rc', val:1.5, risk:'high'},
    ]
  },
  {
    voter:'--- Jim, 55, former small-town resident',
    q:'Crime is through the roof and nothing ever gets done. What are you actually going to do?',
    parties:['rep'],
    opts:[
      {text:'"Stop the catch-and-release policies. Fund the police. Lock up repeat offenders. No more soft-on-crime prosecutors."', bloc:'rc', val:4, risk:'medium'},
      {text:'"I\'ll give law enforcement the resources and the legal backing they need — and hold criminals accountable."', bloc:'sw', val:3, risk:'low'},
      {text:'"Tough enforcement and strong communities — both matter. But first we restore order."', bloc:'in', val:2.5, risk:'low'},
    ]
  },
  {
    voter:'🎖- Hector, 35, Iraq veteran from San Antonio',
    q:'The VA failed me. What are you going to do differently?',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"I\'ll double VA funding, hire more doctors, and guarantee same-week appointments."', bloc:'wc', val:4, risk:'low'},
      {text:'"I served. I know the bureaucracy is broken. I\'m bringing private sector management in."', bloc:'rc', val:3, risk:'medium'},
      {text:'"Veterans can see any doctor in America on the VA\'s dime. We expand the Mission Act."', bloc:'in', val:2.5, risk:'low'},
    ]
  },
  {
    voter:'📱 Aisha, 19, first-time voter from Miami',
    q:'Why should I trust any politician? You all say the same things and nothing changes.',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"That cynicism is earned. I promise you one thing: I\'ll show up every day."', bloc:'yv', val:4, risk:'low'},
      {text:'"I\'m not a politician. I\'m a person who got fed up and decided to fight."', bloc:'yv', val:3.5, risk:'medium'},
      {text:'"Change takes time. The system is designed to move slowly, but it does move."', bloc:'ce', val:1, risk:'low'},
    ]
  },
  {
    voter:'--- Congressman James, 64, local official',
    q:'You\'ve attacked Washington insiders your whole campaign. Aren\'t you one of us now?',
    parties:['dem','rep','custom'],
    opts:[
      {text:'"I went to Washington to fight for you, not to become part of the problem."', bloc:'in', val:3, risk:'medium'},
      {text:'"The difference is whose side you\'re on when the votes are cast."', bloc:'wc', val:2.5, risk:'low'},
      {text:'"You\'re right — I\'ve learned from the inside how broken it is. That\'s why I know how to fix it."', bloc:'ce', val:2, risk:'low'},
    ]
  },
  {
    voter:'🧱 Carl, 49, construction foreman from Pennsylvania',
    q:'The border is wide open and it\'s driving down wages for guys like me. Fix it.',
    parties:['rep','custom'],
    opts:[
      {text:'"Finish the wall, deport illegal workers, and prosecute employers who undercut American labor."', bloc:'rc', val:4, risk:'medium'},
      {text:'"I\'ll secure the border, enforce E-Verify, and crack down on the cartels. No more looking the other way."', bloc:'in', val:3, risk:'low'},
      {text:'"Legal immigration built this country. Illegal immigration undercuts it. I\'ll fix the difference."', bloc:'sw', val:2.5, risk:'low'},
    ]
  },
  {
    voter:'🧱 Maria, 47, construction worker from Nevada',
    q:'My wages are getting squeezed and corporations keep getting richer. Who\'s fighting for me?',
    parties:['dem'],
    opts:[
      {text:'"I\'m raising the federal minimum wage, strengthening union rights, and taxing corporations that offshore jobs."', bloc:'wc', val:4, risk:'medium'},
      {text:'"The PRO Act will make it easier to organize. I\'ll sign it week one."', bloc:'wc', val:3, risk:'medium'},
      {text:'"Stronger enforcement of existing labor laws and a tax credit for companies that raise wages."', bloc:'in', val:2, risk:'low'},
    ]
  },
];


function renderTownHallMinigame(el){
  // Filter questions to those appropriate for the player's party
  const party = GS.playerParty || 'dem';
  const partyFiltered = TOWN_HALL_QUESTIONS.filter(q => !q.parties || q.parties.includes(party));
  // Pick 3 questions, avoiding repeats across sessions
  const questions = _mgPickQuestions('townhall', partyFiltered, 3);
  let qi=0, score=0, timer=25, timerInt=null;
  const impacts={urban:0,youth:0,rural:0,suburban:0,seniors:0};

  const renderQ=()=>{
    if(qi>=questions.length){ showTownHallResult(el,impacts,score); return; }
    const q=questions[qi];
    const opts=[...q.opts].sort(()=>Math.random()-0.5);

    clearInterval(timerInt); timer=25;

    el.innerHTML=`
      <div style="background:linear-gradient(135deg,#080c14,#0e1420);padding:18px 22px;border-bottom:1px solid #1e2535">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em">-- TOWN HALL · Q${qi+1}/${questions.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:700;color:#e8ecf4" id="mg-timer">${timer}</div>
        </div>
        <div style="font-size:11px;font-weight:600;color:#a78bfa;margin-bottom:4px">${q.voter}</div>
        <div style="font-size:14px;font-weight:600;color:#e8ecf4;line-height:1.45">"${q.q}"</div>
        <div style="margin-top:8px;display:flex;gap:12px;font-size:10px;font-family:'IBM Plex Mono',monospace;color:#4a5568">
          <span>👥 URB: ${impacts.urban>=0?'+':''}${impacts.urban}</span>
          <span>🌾 RUR: ${impacts.rural>=0?'+':''}${impacts.rural}</span>
          <span>-- SUB: ${impacts.suburban>=0?'+':''}${impacts.suburban}</span>
          <span>🎓 YTH: ${impacts.youth>=0?'+':''}${impacts.youth}</span>
          <span>👴 SEN: ${impacts.seniors>=0?'+':''}${impacts.seniors}</span>
        </div>
      </div>
      <div style="padding:14px 22px;display:flex;flex-direction:column;gap:7px">
        ${opts.map((o,i)=>`
          <button onclick="thAnswer(${i})" data-idx="${i}" style="padding:11px 14px;background:#10141c;border:1px solid #1e2535;border-radius:6px;color:#c8d0e0;font-size:12px;text-align:left;cursor:pointer;transition:border-color .15s;line-height:1.4" onmouseover="this.style.borderColor='#c8a84b'" onmouseout="this.style.borderColor='#1e2535'">
            ${o.text}
            <div style="font-size:9px;color:#4a5568;margin-top:3px;font-family:'IBM Plex Mono',monospace">${o.risk==='safe'?'LOW RISK':o.risk==='medium'?'MEDIUM RISK':'HIGH RISK'}</div>
          </button>`).join('')}
      </div>`;

    timerInt=setInterval(()=>{
      timer--;
      const te=document.getElementById('mg-timer');
      if(te){te.textContent=timer;te.style.color=timer<6?'#ef4444':timer<11?'#fb923c':'#e8ecf4';}
      if(timer<=0){clearInterval(timerInt);thAnswer(Math.floor(Math.random()*opts.length));}
    },1000);

    window.thAnswer=(si)=>{
      clearInterval(timerInt);
      const opt=opts[si]; if(!opt){qi++;renderQ();return;}
      score+=opt.val;
      if(opt.bloc){shiftBloc(opt.bloc,opt.val*0.6);}
      // Apply demo impacts from option
      const demoMap={wc:'rural',ce:'suburban',sw:'suburban',yv:'youth',up:'urban',se:'seniors',in:'suburban'};
      const dk=demoMap[opt.bloc]||'urban';
      impacts[dk]=(impacts[dk]||0)+opt.val;
      const feedIcon=opt.val>=3?'✅':opt.val>=1.5?'-':'-';
      el.innerHTML=`
        <div style="background:#080c14;padding:28px 22px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">YOUR ANSWER</div>
          <div style="font-size:14px;color:#e8ecf4;font-style:italic;margin-bottom:18px;line-height:1.5">"${opt.text}"</div>
          <div style="font-size:20px;margin-bottom:6px">${feedIcon}</div>
          <div style="font-size:12px;color:${opt.val>=3?'#22c55e':opt.val>=1.5?'#c8a84b':'#8a93a8'}">${opt.val>=3?'Strong answer — crowd responds well':opt.val>=1.5?'Decent answer — no damage done':'Weak answer — voters unconvinced'}</div>
        </div>`;
      setTimeout(()=>{qi++;renderQ();},900);
    };
  };

  window.showTownHallResult=(el,impacts,score)=>{
    const total=Object.values(impacts).reduce((s,v)=>s+v,0);
    const favBonus=Math.round(total/10);
    Object.entries(impacts).forEach(([k,v])=>{if(GS.demos[k]!==undefined)GS.demos[k]=cl(GS.demos[k]+v,10,90);});
    const grade=score>=9?'🌟 Standing Ovation':score>=6?'✅ Solid Performance':score>=3?'↔- Mixed Reviews':'💔 Rough Crowd';
    el.innerHTML=`
      <div style="background:#080c14;padding:20px 22px;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">-- TOWN HALL — VOTER REACTION</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;margin-bottom:6px">${grade}</div>
        <div style="color:#8a93a8;font-size:12px;margin-bottom:18px">Total impact: ${total>0?'+':''}${total} pts · Favorability ${favBonus>=0?'+':''}${favBonus}%</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${Object.entries(impacts).map(([k,v])=>`
            <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px">
              <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">${k.toUpperCase()}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:16px;font-weight:700;color:${v>0?'#22c55e':v<0?'#ef4444':'#8a93a8'}">${v>0?'+':''}${v}%</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
        <button onclick="showMGCloseBtn();closeMG(${favBonus})" style="padding:12px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;cursor:pointer;width:100%">Apply Results →</button>
      </div>`;
    // Store bloc impacts for applyMinigameBonus — map demo labels back to bloc keys
    const demoToBloc={urban:'up',youth:'yv',rural:'rc',suburban:'sw',seniors:'se'};
    MG.blocImpacts={};
    Object.entries(impacts).forEach(([k,v])=>{ MG.blocImpacts[demoToBloc[k]||k]=v; });
    MG.bonus=favBonus; MG.demoImpacts=impacts;
  };

  renderQ();
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIGAME: RAPID-FIRE PRESS GAUNTLET
// Six tough press questions in 30 seconds. Fast choices affect media/fav.
// ─────────────────────────────────────────────────────────────────────────────
// PRESS TOUR: Each question has TWO answers — neither is obviously "correct."
// One plays well with urban/base voters; the other with rural/swing voters.
// The tradeoff is the game.
const PRESS_QUESTIONS=[
  {q:'Did you shift your position on healthcare last year?',reporter:'CNN White House Correspondent',
   opts:[
     {t:'I evolved on this — listening to constituents and new evidence changed my view. That is what good leaders do.',  urban:+3,rural:-2,suburban:+1,seniors:+1},
     {t:'My core position has been consistent. The specific policy mechanism changed, not the principle.',                 urban:-1,rural:+3,suburban:+2,seniors:+2},
   ]},
  {q:'Your opponent says you\'re weak on crime. Response?',reporter:'NBC News Political Reporter',
   opts:[
     {t:'My record shows a 30% drop in violent crime in areas I represented. Facts matter.',                             urban:+2,rural:+1,suburban:+3,seniors:+2},
     {t:'I believe in both public safety and civil rights — communities need funding for both police and services.',       urban:+4,rural:-2,suburban:+1,seniors:-1},
   ]},
  {q:'Your poll numbers are down 5 points nationally. Are you worried?',reporter:'Washington Post',
   opts:[
     {t:'Not at all. I am focused on the voters, not the pundits. Polls don\'t cast ballots.',                          urban:+1,rural:+2,suburban:+1,seniors:+1},
     {t:'We take all data seriously. We\'re adjusting our strategy in key states where we need to do better.',            urban:-1,rural:-1,suburban:+3,seniors:+2},
   ]},
  {q:'Will you raise taxes on families earning $75,000 a year?',reporter:'Fox News',
   opts:[
     {t:'No. Full stop. Families under $400,000 will not see a penny of new tax.',                                       urban:+2,rural:+3,suburban:+4,seniors:+2},
     {t:'The real tax burden on working families comes from healthcare and housing — that\'s what I\'m cutting.',         urban:+4,rural:+1,suburban:+2,seniors:+1},
   ]},
  {q:'A senator in your own party publicly criticized your plan. Your reaction?',reporter:'AP Political Desk',
   opts:[
     {t:'We have a big tent. Internal debate makes our policy stronger — and I welcome it.',                              urban:+3,rural:+1,suburban:+2,seniors:+1},
     {t:'I\'d invite them to a direct conversation. I believe I can bring them around.',                                  urban:+1,rural:+2,suburban:+3,seniors:+3},
   ]},
  {q:'Will you commit to accepting the election results, regardless of outcome?',reporter:'ABC News',
   opts:[
     {t:'I will always honor the democratic process. That commitment is absolute.',                                       urban:+3,rural:+2,suburban:+3,seniors:+3},
     {t:'I commit to accepting any result from a free and fair election — and I\'ll be watching closely to ensure it is.', urban:+1,rural:+3,suburban:+2,seniors:+2},
   ]},
  {q:'Critics say your climate plan will destroy energy jobs.',reporter:'Reuters',
   opts:[
     {t:'The clean energy transition creates more jobs than it eliminates. Ask the wind turbine workers in Iowa.',         urban:+3,rural:+1,suburban:+2,seniors:0},
     {t:'I have a $50B transition fund specifically for energy communities. No worker gets left behind.',                  urban:+1,rural:+4,suburban:+3,seniors:+2},
   ]},
  {q:'Your VP pick made a controversial statement 10 years ago. Do you stand by them?',reporter:'Politico',
   opts:[
     {t:'People grow. I have spoken with them personally about this. I vouch for who they are today.',                    urban:+3,rural:+1,suburban:+2,seniors:+1},
     {t:'Those words were wrong when said and they\'ve acknowledged that clearly. The record since then speaks louder.',  urban:+2,rural:+2,suburban:+3,seniors:+2},
   ]},
  {q:'You missed several key congressional votes while campaigning. How do you justify that?',reporter:'The Hill',
   opts:[
     {t:'Campaigning is how I hear directly from the people I serve. Both matter — and I vote on everything that\'s close.', urban:+2,rural:+2,suburban:+1,seniors:0},
     {t:'Fair criticism. I\'ve committed to pairing absences with a proxy vote system. I\'m addressing it.',               urban:-1,rural:+1,suburban:+3,seniors:+3},
   ]},
  {q:'Is America heading in the right direction?',reporter:'CBS Evening News',
   opts:[
     {t:'We\'ve made real progress — but the work isn\'t finished, and I\'m not here to take a victory lap.',        urban:+2,rural:+1,suburban:+3,seniors:+3},
     {t:'Not fast enough. The urgency of this moment demands we go further — and we will.',                          urban:+4,youth:+4,suburban:-1,seniors:-1},
   ]},
  {q:'Your campaign accepted a large donation from a controversial donor.',reporter:'NPR Politics',
   opts:[
     {t:'We vet every donor. If there\'s a specific concern, name it — and I\'ll address it on the record.',         urban:+3,suburban:+3,rural:+2,seniors:+2},
     {t:'We returned it the moment questions arose. Transparency is non-negotiable for this campaign.',               suburban:+4,seniors:+4,rural:+3,urban:+2},
   ]},
  {q:'A new report says your economic plan will increase the deficit.',reporter:'Bloomberg',
   opts:[
     {t:'The CBO score we commissioned shows the opposite. I\'d encourage every voter to read both analyses.',       suburban:+4,seniors:+3,urban:+3,rural:+2},
     {t:'Deficits rose under the last administration\'s tax cuts too — the question is what you\'re buying.',        urban:+4,youth:+3,suburban:-1,seniors:-1},
   ]},
  {q:'Do you think your opponent is a good person?',reporter:'USA Today',
   opts:[
     {t:'I think they\'re wrong on the issues. That\'s what matters to voters watching right now.',                  suburban:+3,seniors:+3,rural:+3,urban:+2},
     {t:'I\'ll leave character judgements to the voters. My focus is on the policies — and they\'re failing.',       urban:+3,youth:+3,suburban:+2,rural:+1},
   ]},
  {q:'Your crowd sizes have been smaller recently. Are you losing momentum?',reporter:'New York Times',
   opts:[
     {t:'Quality over quantity. I\'ll take a room of committed volunteers over a spectacle any day.',                rural:+3,seniors:+3,suburban:+2,urban:+2},
     {t:'Our early-vote programme has us knocking 40,000 doors a week. The real crowds are at the polls.',          urban:+4,youth:+3,suburban:+3,rural:+2},
   ]},
  {q:'Should the president have the power to pardon themselves?',reporter:'Wall Street Journal',
   opts:[
     {t:'No. No president should be above the law — and I\'d sign legislation ending that ambiguity.',              urban:+4,youth:+3,suburban:+3,seniors:+3},
     {t:'The Constitution is clear. What isn\'t clear is why this keeps getting asked of candidates and not of the current officeholder.',  urban:+5,youth:+4,suburban:+1,seniors:0},
   ]},
  {q:'You haven\'t released your full tax returns. Why?',reporter:'ProPublica',
   opts:[
     {t:'They\'re filed, reviewed, and publicly available on our campaign website. Every year, going back twelve.',  suburban:+4,seniors:+4,rural:+3,urban:+3},
     {t:'They\'ve been on our website since day one. What I\'d like to talk about is my opponent\'s refusal to do the same.',  urban:+4,youth:+3,suburban:+2,rural:+2},
   ]},
];

function renderPressTourMinigame(el){
  // ── SHARED MINIGAME SHELL ──────────────────────────────────────────────────
  const MG_STYLE = {
    header: 'background:linear-gradient(135deg,#080c14,#0e1520);padding:16px 20px;border-bottom:2px solid #1e2535',
    eyebrow: 'font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px',
    headline: 'font-size:14px;font-weight:700;color:#e8ecf4;line-height:1.45',
    sub: 'font-size:10px;font-family:"IBM Plex Mono",monospace;color:#4a5568;margin-top:5px',
    body: 'padding:14px 20px;display:flex;flex-direction:column;gap:8px',
    btn: 'padding:11px 14px;background:#0d1117;border:1px solid #253047;border-radius:7px;color:#c8d0e0;font-size:12px;text-align:left;cursor:pointer;transition:border-color .15s,background .15s;line-height:1.45',
    btnHover: '#1e2d45',
    result: 'background:#060a12;padding:24px 20px',
  };

  const qs=_mgPickQuestions('press_tour', PRESS_QUESTIONS, 5);
  let qi=0;
  const totalImpact={urban:0,rural:0,suburban:0,seniors:0};

  const render=()=>{
    if(qi>=qs.length){ showPressResult(); return; }
    const q=qs[qi];
    const shuffled=[...q.opts].sort(()=>Math.random()-0.5);

    el.innerHTML=`
      <div style="${MG_STYLE.header}">
        <div style="${MG_STYLE.eyebrow};color:#60a5fa">📰 PRESS GAUNTLET · Q${qi+1}/${qs.length}</div>
        <div style="${MG_STYLE.headline}">"${q.q}"</div>
        <div style="${MG_STYLE.sub}">Reporter: ${q.reporter} &nbsp;·&nbsp; Each answer plays differently with different voters</div>
      </div>
      <div style="${MG_STYLE.body}">
        ${shuffled.map((o,i)=>`
          <button onclick="pgAnswer(${i})"
            style="${MG_STYLE.btn}"
            onmouseover="this.style.borderColor='#60a5fa';this.style.background='${MG_STYLE.btnHover}'"
            onmouseout="this.style.borderColor='#253047';this.style.background='#0d1117'">
            ${o.t}
          </button>`).join('')}
      </div>`;

    window.pgAnswer=(si)=>{
      const chosen=shuffled[si];
      // Accumulate demographic impacts
      Object.keys(totalImpact).forEach(k=>{ totalImpact[k]+=(chosen[k]||0); });
      // Show which demographics were helped/hurt
      const impacts=Object.entries({Urban:chosen.urban||0,'Suburban':chosen.suburban||0,'Rural':chosen.rural||0,'Seniors':chosen.seniors||0});
      const bestK=impacts.reduce((a,b)=>b[1]>a[1]?b:a);
      const worstK=impacts.reduce((a,b)=>b[1]<a[1]?b:a);
      el.innerHTML=`
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow};color:#60a5fa">📰 PRESS GAUNTLET · Q${qi+1}/${qs.length} — YOUR ANSWER</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">"${chosen.t}"</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
            ${impacts.map(([k,v])=>v!==0?`<span style="padding:4px 10px;border-radius:14px;font-family:'IBM Plex Mono',monospace;font-size:10px;background:${v>0?'rgba(34,197,94,.1)':'rgba(239,68,68,.1)'};border:1px solid ${v>0?'#22c55e33':'#ef444433'};color:${v>0?'#4ade80':'#f87171'}">${k} ${v>0?'+':''}${v}</span>`:'').join('')}
          </div>
          <div style="font-size:12px;color:#8a93a8;margin-bottom:16px">
            ${bestK[1]>0?`✓ Resonated with ${bestK[0]} voters.`:''} ${worstK[1]<0?`⚠ Lost ground with ${worstK[0]} voters.`:''}
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">Next question loading…</div>
        </div>`;
      setTimeout(()=>{ qi++; render(); },1000);
    };
  };

  const showPressResult=()=>{
    const total=Object.values(totalImpact).reduce((s,v)=>s+v,0);
    const bonus=total>=18?6:total>=10?3:total>=2?1:0;
    const grade=total>=18?'🎙- Masterful':total>=10?'✅ Sharp':total>=2?'- Shaky':'🔥 Train Wreck';
    // Apply demographic effects
    if(GS.demos){
      ['urban','suburban','rural','seniors'].forEach(k=>{
        if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+(totalImpact[k]||0)*0.4,10,90);
      });
    }
    GS.mediaCoverage=cl((GS.mediaCoverage||50)+bonus,0,100);
    el.innerHTML=`
      <div style="${MG_STYLE.result}">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#60a5fa;letter-spacing:.15em;margin-bottom:14px">📰 PRESS GAUNTLET — DEBRIEF</div>
        <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:900;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:20px">Net demographic impact: ${total>=0?'+':''}${total} pts · Media coverage ${bonus>0?'+'+bonus:bonus}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
          ${Object.entries({Urban:totalImpact.urban,Suburban:totalImpact.suburban,Rural:totalImpact.rural,Seniors:totalImpact.seniors}).map(([k,v])=>`
            <div style="background:#0d1117;border:1px solid #1e2535;border-radius:7px;padding:10px 12px">
              <div style="font-size:9px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">${k.toUpperCase()}</div>
              <div style="font-size:18px;font-weight:700;font-family:'IBM Plex Mono',monospace;color:${v>0?'#4ade80':v<0?'#f87171':'#8a93a8'}">${v>0?'+':''}${v}</div>
            </div>`).join('')}
        </div>
      </div>
      <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#060a12">
        <button onclick="showMGCloseBtn();closeMG(${bonus})" style="padding:12px;width:100%;background:#c8a84b;border:none;border-radius:7px;color:#0a0c10;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.05em">Leave the Podium →</button>
      </div>`;
  };
  render();
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIGAME: FUNDRAISING CALL LIST (NEW)
// Speed-dial donors. Pick the right ask amount to match donor type.
// ─────────────────────────────────────────────────────────────────────────────
const DONOR_CARDS=[
  {name:'Small-biz owner, Dallas',wealth:2,ideal:500},
  {name:'Tech exec, San Francisco',wealth:5,ideal:3300},
  {name:'Union leader, Pittsburgh',wealth:1,ideal:250},
  {name:'Retired teacher, Florida',wealth:1,ideal:50},
  {name:'Hedge fund manager, NYC',wealth:5,ideal:3300},
  {name:'Farmer, rural Iowa',wealth:2,ideal:500},
  {name:'Young activist, Austin',wealth:1,ideal:25},
  {name:'Hollywood producer, LA',wealth:4,ideal:2000},
];
const DONOR_OPTS=[25,50,250,500,1000,2000,3300];

function renderFundraiseCallMinigame(el){
  const donors=_mgPickQuestions('fundraise_calls', DONOR_CARDS, 4);
  let di=0, raised=0;
  const maxRaise=donors.reduce((s,d)=>s+d.ideal,0);

  const render=()=>{
    if(di>=donors.length){
      const pct=maxRaise?raised/maxRaise:0;
      const bonus=pct>=0.8?9:pct>=0.5?5:pct>=0.25?2:0;
      const extra=Math.round(bonus*0.3*10)/10;
      const grade=pct>=0.8?'💎 Masterful Pitch':pct>=0.5?'✅ Solid Haul':pct>=0.25?'📉 Below Target':'💸 Rough Day';
      el.innerHTML=`
        <div style="background:#080c14;padding:28px 22px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">📞 DONOR CALLS — SUMMARY</div>
          <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;margin-bottom:6px">${grade}</div>
          <div style="color:#8a93a8;font-size:12px;margin-bottom:18px">$${raised.toLocaleString()} of $${maxRaise.toLocaleString()} raised</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px">
            <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px">
              <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">RAISED</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#22c55e">$${raised.toLocaleString()}</div>
            </div>
            <div style="background:#10141c;border:1px solid #1e2535;border-radius:6px;padding:10px 12px">
              <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace;margin-bottom:3px">WAR CHEST +</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700;color:#c8a84b">+$${extra.toFixed(1)}M</div>
            </div>
          </div>
        </div>
        <div style="padding:10px 20px 14px;flex-shrink:0;border-top:1px solid #1e2535;background:#080c14">
          <button onclick="closeMGFunds(${bonus},${extra})" style="padding:12px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'Playfair Display',serif;font-size:16px;font-weight:700;cursor:pointer;width:100%">Bank It →</button>
        </div>`;
      window.closeMGFunds=(bonus,extra)=>{GS.funds=cl(GS.funds+extra,0,100);showMGCloseBtn();closeMG(bonus);};
      return;
    }
    const d=donors[di];
    const stars='★'.repeat(d.wealth)+'☆'.repeat(5-d.wealth);

    el.innerHTML=`
      <div style="background:linear-gradient(135deg,#08100c,#0b1410);padding:18px 22px;border-bottom:1px solid #1e2535">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em">📞 DONOR CALL · ${di+1}/${donors.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#22c55e">$${raised.toLocaleString()} raised</div>
        </div>
        <div style="font-size:14px;font-weight:600;color:#e8ecf4;margin-bottom:4px">${d.name}</div>
        <div style="font-size:13px;color:#c8a84b;letter-spacing:.05em">${stars}</div>
        <div style="margin-top:8px;font-size:11px;color:#4a5568;font-family:'IBM Plex Mono',monospace">Estimated capacity: ${d.wealth>=4?'$2,000–$3,300':d.wealth>=3?'$500–$2,000':d.wealth>=2?'$250–$500':'$25–$250'}</div>
      </div>
      <div style="padding:14px 22px">
        <div style="font-size:11px;color:#8a93a8;margin-bottom:12px">What do you ask for?</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${DONOR_OPTS.map((amt,i)=>`
            <button onclick="donorPick(${amt})" style="flex:1;min-width:68px;padding:10px 6px;background:#10141c;border:1px solid #1e2535;border-radius:6px;color:#c8d0e0;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='#c8a84b'" onmouseout="this.style.borderColor='#1e2535'">$${amt.toLocaleString()}</button>`).join('')}
        </div>
      </div>`;

    window.donorPick=(amt)=>{
      const diff=Math.abs(amt-d.ideal)/d.ideal;
      const got=diff<0.15?d.ideal:diff<0.5?Math.round(d.ideal*0.6):amt>d.ideal*1.5?0:Math.round(d.ideal*0.3);
      raised+=got;
      const isHungUp=amt>d.ideal*1.5;
      el.innerHTML=`
        <div style="background:#080c14;padding:28px 22px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.15em;margin-bottom:12px">CALL RESULT</div>
          <div style="font-size:24px;margin-bottom:12px">${isHungUp?'📵':got===d.ideal?'💎':got>0?'📲':'📉'}</div>
          <div style="font-size:14px;font-weight:600;color:#e8ecf4;margin-bottom:8px">${isHungUp?'They hung up.':diff<0.15?'Perfect read.':got>0?'Got something.':'Awkward silence.'}</div>
          <div style="display:flex;gap:10px;margin-bottom:22px">
            <div style="padding:6px 14px;border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:11px;background:${got===d.ideal?'rgba(34,197,94,.12)':got>0?'rgba(200,168,75,.1)':'rgba(239,68,68,.1)'};border:1px solid ${got===d.ideal?'#22c55e':got>0?'#c8a84b':'#ef4444'};color:${got===d.ideal?'#22c55e':got>0?'#c8a84b':'#f87171'}">
              ${isHungUp?'Asked too much':'You asked: $'+amt.toLocaleString()}
            </div>
            <div style="padding:6px 14px;border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:11px;background:rgba(34,197,94,.08);border:1px solid #1e2535;color:#22c55e">
              Got: $${got.toLocaleString()}
            </div>
          </div>
        </div>`;
      setTimeout(()=>{di++;render();},900);
    };
  };
  render();
}

// ─────────────────────────────────────────────────────────────────────────────
// MINIGAME: DOOR-TO-DOOR CANVASSING (Primary)
// You knock on 5 doors. Each voter has a type — match your opening line to convert them.
// ─────────────────────────────────────────────────────────────────────────────
// -----------------------------------------------------------------------------
// MINIGAME: CANVASS — Neighbourhood Conversations
// Each door has a voter with a REAL concern. Answers trade off:
// empathetic vs. factual, local vs. national, firm vs. flexible.
// -----------------------------------------------------------------------------
const CANVASS_SCENARIOS = [
  { type:'-- Laid-off factory worker', concern:'Trade & jobs',
    q:'"My plant closed two years ago. I don\'t care about your big-picture talk — what are you doing for ME?"',
    opts:[
      { t:'"I\'m proposing a $40B reshoring fund with union-wage guarantees. Your plant closure is exactly why."',
        fx:{rural:+4, urban:-1, seniors:+2, suburban:+1}, fb:'Specific plan lands well. They write down the number.' },
      { t:'"I\'m angry about it too. I\'ll fight every trade deal that ships American jobs overseas."',
        fx:{rural:+5, urban:-2, suburban:-1, seniors:+1}, fb:'Passion resonates — but some wonder if you\'re oversimplifying.' },
      { t:'"Our economic package includes retraining, expanded EITC, and community investment zones."',
        fx:{rural:-1, urban:+3, suburban:+3, seniors:0}, fb:'Policy-heavy. They nod slowly. Not quite what they needed.' },
    ]},
  { type:'-- Suburban mom, 3 kids', concern:'Schools & safety',
    q:'"My kids\' school has had three lockdown drills this year. What are you actually going to do about guns?"',
    opts:[
      { t:'"Universal background checks, red flag laws, and a buyback program — I\'ll push all three."',
        fx:{urban:+4, youth:+3, rural:-3, suburban:+2}, fb:'Base loves it. Rural doors ahead may be tougher.' },
      { t:'"Red flag laws and school security funding. Both sides can agree on protecting kids."',
        fx:{suburban:+4, seniors:+2, urban:+1, rural:+1}, fb:'Moderate and concrete — earns a real nod.' },
      { t:'"Mental health services, school counselors, and community intervention programs."',
        fx:{urban:+3, youth:+4, suburban:+1, rural:-1}, fb:'Progressive framing — thoughtful but not decisive for this voter.' },
    ]},
  { type:'🌾 Small farmer, 4th generation', concern:'Agriculture & land',
    q:'"The big ag corporations are squeezing us out. My grandfather built this farm. You people never talk about us."',
    opts:[
      { t:'"I\'ve been to 12 farm counties this cycle. I\'m proposing anti-monopoly rules on ag conglomerates."',
        fx:{rural:+6, urban:-1, suburban:0, seniors:+2}, fb:'They blink. "That\'s specific." A strong connection.' },
      { t:'"Strengthen the USDA, expand crop insurance, and ban meatpacker price-fixing."',
        fx:{rural:+4, suburban:+2, urban:+1, seniors:+2}, fb:'Policy-clear. They\'re listening.' },
      { t:'"Family farms are the backbone of America. I\'ll fight for fair prices."',
        fx:{rural:+2, suburban:+1, urban:+1, seniors:+1}, fb:'Nice rhetoric — nothing concrete. They half-smile.' },
    ]},
  { type:'🎓 First-gen college student, 22', concern:'Debt & housing',
    q:'"I owe $80K and can\'t afford rent. Why should I bother voting for anyone?"',
    opts:[
      { t:'"Broad forgiveness up to $50K, free community college, and a renter\'s tax credit."',
        fx:{youth:+6, seniors:-2, suburban:-1, rural:-1}, fb:'Eyes light up. Enthusiasm confirmed — turnout likely.' },
      { t:'"Income-based repayment reform and housing vouchers tied to local median income."',
        fx:{youth:+3, suburban:+3, seniors:+1, urban:+2}, fb:'Wonky but credible. They appreciate the detail.' },
      { t:'"The system failed your generation. I want you angry — and I want that anger at the ballot box."',
        fx:{youth:+5, suburban:-2, seniors:-3, urban:+2}, fb:'Mobilizes youth, alienates moderates. Double-edged.' },
    ]},
  { type:'👴 Conservative-leaning retiree', concern:'Inflation & savings',
    q:'"My savings are worth 20% less than three years ago. Everything costs more. What\'s your plan?"',
    opts:[
      { t:'"Cutting deficit spending, energy investment to lower utility bills, and drug price caps to ease household costs."',
        fx:{seniors:+4, suburban:+3, rural:+2, urban:+1}, fb:'Balanced answer. They want specifics but this works.' },
      { t:'"Corporations are driving inflation with record profits. I\'ll tax price-gouging."',
        fx:{urban:+3, youth:+3, seniors:-1, suburban:-1}, fb:'Populist framing — fires up some, unsettles others.' },
      { t:'"Inflation hit every country. The real question is who has the plan to bring it down — and I do."',
        fx:{suburban:+2, seniors:+2, rural:+1, urban:+1}, fb:'Pivot is smooth. They\'re partially convinced.' },
    ]},
];

function renderCanvassMinigame(el){
  const doors = _mgPickQuestions('canvass', CANVASS_SCENARIOS, 4);
  let di=0;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderDoor = ()=>{
    if(di >= doors.length){ showCanvassResult(); return; }
    const d = doors[di];
    const opts = [...d.opts].sort(()=>Math.random()-0.5);

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="${MG_STYLE.eyebrow('#a78bfa')}">🚪 CANVASSING · DOOR ${di+1} OF ${doors.length}</div>
        <div style="font-size:11px;font-weight:700;color:#c4b5fd;margin-bottom:6px">${d.type} · ${d.concern}</div>
        <div style="${MG_STYLE.headline}">${d.q}</div>
        <div style="${MG_STYLE.sub}">Each answer plays differently with different voter groups</div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._cvPick(${i})"
            style="${MG_STYLE.btn('#a78bfa')}"
            onmouseover="${MG_STYLE.btnHover('#a78bfa')}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.t}
          </button>`).join('')}
      </div>`;

    window._cvPick = (si)=>{
      const opt = opts[si];
      Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k] += opt.fx[k]; });
      const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow('#a78bfa')}">🚪 DOOR ${di+1} — YOUR RESPONSE</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">${opt.t}</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
          <div style="font-size:12px;color:#8a93a8;font-style:italic;margin-bottom:16px">${opt.fb}</div>
          <button onclick="window._cvNext()" style="${MG_STYLE.btn()}">Next Door →</button>
        </div>`;
      window._cvNext = ()=>{ di++; renderDoor(); };
    };
  };

  const showCanvassResult = ()=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const bonus = total>=16?6:total>=8?3:total>=2?1:0;
    const grade = total>=16?'-- Organiser of the Year':total>=8?'✅ Solid Ground Game':total>=2?'- Lukewarm Reception':'-- Rough Neighbourhood';
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.5,10,90); });
    GS.groundGame=cl(GS.groundGame+bonus*.4,0,100);
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow('#a78bfa')}">🚪 CANVASSING COMPLETE</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Net demographic impact: ${total>=0?'+':''}${total}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Back to HQ →', bonus)}
      </div>`;
    MG.bonus = bonus;
  };

  renderDoor();
}

// -----------------------------------------------------------------------------
// MINIGAME: SPIN ROOM — Party Insider Gauntlet
// No binary good/bad. Each response plays differently with different audiences.
// Strong with one group = weaker with another.
// -----------------------------------------------------------------------------
const SPIN_CHALLENGES = [
  { from:'DNC/RNC Strategist', claimFn:()=>`Your polling in rural counties is terrible. Why should we risk the ticket on you?`,
    opts:[
      { t:'"Because I\'ve flipped three rural seats. Rural voters respond to authenticity — not to consultants who\'ve never left the Beltway."',
        fx:{urban:-1,rural:+4,suburban:+1,seniors:+2}, fb:'Room goes quiet. That one landed.' },
      { t:'"Our rural numbers reflect a gap in outreach, not persuasion. We\'re opening 12 field offices there next month."',
        fx:{urban:+2,rural:+2,suburban:+3,seniors:+1}, fb:'Operational answer. Credible. Slightly dry.' },
      { t:'"We\'re investing $8M in rural media buys. The numbers will move."',
        fx:{urban:+3,rural:-1,suburban:+2,seniors:0}, fb:'Money talk reassures donors. Rural strategists roll their eyes.' },
    ]},
  { from:'Party Establishment Figure', claimFn:()=>`You're too far to the ${GS.playerParty==='dem'?'left':'right'}. You will alienate the center.`,
    opts:[
      { t:'"The center isn\'t an ideology — it\'s a destination. My policies poll above 55% in purple districts. That is the center."',
        fx:{urban:+2,rural:+1,suburban:+3,seniors:+2}, fb:'Data-backed. Shuts down the framing cleanly.' },
      { t:'"With respect, the party lost last time by chasing the center with no message. Bold wins."',
        fx:{urban:+4,rural:-1,suburban:-2,youth:+3}, fb:'Base applauds. Moderates in the room shift uncomfortably.' },
      { t:'"I\'ve governed from the center my whole career. My record speaks for itself."',
        fx:{urban:0,rural:+2,suburban:+3,seniors:+3}, fb:'Steady. Doesn\'t excite anyone, but doesn\'t hurt.' },
    ]},
  { from:'Cable News Producer', claimFn:()=>'Your candidate had a bad week. Are they still viable?',
    opts:[
      { t:'"We raised $4M this week alone. Viability is determined by voters — and our ground game is the strongest in the race."',
        fx:{urban:+3,rural:+1,suburban:+2,seniors:+1}, fb:'Strong pivot. They want to use it.' },
      { t:'"Every campaign has rough patches. What matters is the fundamentals — and ours are solid."',
        fx:{urban:+1,rural:+2,suburban:+2,seniors:+3}, fb:'Measured. Less quotable, but nothing to regret.' },
      { t:'"Define \'bad week.\' We won a state primary, earned two major endorsements, and led every battleground poll."',
        fx:{urban:+4,rural:-1,suburban:+1,youth:+2}, fb:'Aggressive counter. Good TV. Slightly combative.' },
    ]},
  { from:'Newspaper Editorial Board', claimFn:()=>'Your signature plan will cost $2 trillion. How do you pay for it?',
    opts:[
      { t:'"Sixty percent is offset by the corporate minimum tax. The rest pays for itself in healthcare savings inside a decade. Here\'s the CBO score."',
        fx:{urban:+3,suburban:+4,seniors:+3,rural:+1}, fb:'They print it verbatim. Detail wins editorial boards.' },
      { t:'"We fund it the same way we funded two wars and a bank bailout — except this time it goes to Americans."',
        fx:{urban:+4,youth:+4,rural:+2,suburban:-1}, fb:'Populist framing. Energises base, slightly alarms moderates.' },
      { t:'"No serious economist expects a plan this size to be fully paid for upfront. The question is ROI — and mine is positive."',
        fx:{urban:+2,suburban:+2,seniors:0,rural:-1}, fb:'Academically sound. A bit evasive for a general audience.' },
    ]},
  { from:'Opposition Researcher', claimFn:()=>'Your opponent will hit you on the 2017 vote. What\'s your answer?',
    opts:[
      { t:'"I voted no because the bill buried a $14B bailout for insurance companies in Section 4. I\'ll say that on stage, word for word."',
        fx:{urban:+3,suburban:+3,rural:+2,seniors:+2}, fb:'Specific. Hard to attack. Prep paid off.' },
      { t:'"My opponent voted the same way on two similar bills. If they bring it up, I bring those up."',
        fx:{urban:+2,rural:+2,suburban:+2,youth:+2}, fb:'Counter-attack strategy. Risky but solid.' },
      { t:'"I\'ll handle it when it comes up. The vote was defensible."',
        fx:{urban:-1,rural:+1,suburban:-1,seniors:-1}, fb:'Unprepared energy. They write a memo: "needs more prep."' },
    ]},
  { from:'Senior Party Official', claimFn:()=>'Debate prep team says you\'re coming across as robotic. Too scripted.',
    opts:[
      { t:'"Then we change the prep format. I\'m going into that debate as myself — if the prep is making me worse, we tear it up."',
        fx:{urban:+3,youth:+4,rural:+1,suburban:+1}, fb:'Bold and quotable. Shows confidence.' },
      { t:'"I\'ll take that on board. I\'d like to see the specific moments they flagged."',
        fx:{suburban:+3,seniors:+3,urban:+1,rural:+2}, fb:'Measured. Shows you listen. Less exciting but trustworthy.' },
      { t:'"I disagree. Preparation isn\'t robotic — it\'s respect for the voters watching."',
        fx:{seniors:+4,suburban:+2,urban:0,rural:+2}, fb:'Makes a real point. Split reaction.' },
    ]},
];

function renderSpinRoomMinigame(el){
  const rounds = _mgPickQuestions('spin_room', SPIN_CHALLENGES, 4);
  let ri=0, timer=20, timerInt=null;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderRound = ()=>{
    if(ri>=rounds.length){ showSpinResult(); return; }
    const r = rounds[ri];
    const opts = [...r.opts].sort(()=>Math.random()-0.5);
    clearInterval(timerInt); timer=20;
    const claimText = r.claimFn ? r.claimFn() : r.claim;

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="${MG_STYLE.eyebrow('#a78bfa')}">🎙- SPIN ROOM · ROUND ${ri+1}/${rounds.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#e8ecf4" id="sr-timer">${timer}</div>
        </div>
        <div style="font-size:10px;color:#8a7aa8;font-family:'IBM Plex Mono',monospace;margin-bottom:6px">${r.from}</div>
        <div style="${MG_STYLE.headline}">"${claimText}"</div>
        <div style="margin-top:8px;height:2px;background:#1e1535;border-radius:2px"><div id="sr-prog" style="width:100%;height:100%;background:#a78bfa;border-radius:2px;transition:width 1s linear"></div></div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._spinPick(${i})"
            style="${MG_STYLE.btn('#a78bfa')}"
            onmouseover="${MG_STYLE.btnHover('#a78bfa')}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.t}
          </button>`).join('')}
      </div>`;

    let elapsed=0;
    timerInt=setInterval(()=>{
      timer--; elapsed++;
      const te=document.getElementById('sr-timer'), pb=document.getElementById('sr-prog');
      if(te){te.textContent=timer; te.style.color=timer<6?'#ef4444':timer<10?'#fb923c':'#e8ecf4';}
      if(pb) pb.style.width=Math.max(0,(1-elapsed/20)*100)+'%';
      if(timer<=0){clearInterval(timerInt); window._spinPick(Math.floor(Math.random()*opts.length));}
    },1000);

    window._spinPick = (si)=>{
      clearInterval(timerInt);
      const opt = opts[si]; if(!opt){ri++;renderRound();return;}
      Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k]+=opt.fx[k]; });
      const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow('#a78bfa')}">🎙- YOUR LINE</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">${opt.t}</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
          <div style="font-size:12px;color:#8a93a8;font-style:italic;margin-bottom:14px">${opt.fb}</div>
          <button onclick="window._spinNext()" style="${MG_STYLE.btn()}">Next Round →</button>
        </div>`;
      window._spinNext = ()=>{ ri++; renderRound(); };
    };
  };

  const showSpinResult = ()=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const bonus = total>=14?6:total>=8?3:total>=2?1:0;
    const grade = total>=14?'🎙- Bulletproof':total>=8?'✅ On Message':total>=2?'- Wobbly':'💥 Contradicted';
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.5,10,90); });
    GS.favorability=cl(GS.favorability+bonus*.5,20,85);
    GS.mediaCoverage=cl(GS.mediaCoverage+bonus*.4,0,100);
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow('#a78bfa')}">🎙- SPIN ROOM — VERDICT</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Net demographic impact: ${total>=0?'+':''}${total}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Exit Spin Room →', bonus)}
      </div>`;
    MG.bonus = bonus;
  };

  renderRound();
}

// -----------------------------------------------------------------------------
// MINIGAME: RAPID RESPONSE
// Your opponent attacked. Each response angle targets a different coalition.
// Speed bonus still applies. No universally right answer.
// -----------------------------------------------------------------------------
const RAPID_ATTACKS = [
  { attack:'BREAKING: Opponent says you misrepresented your military service record.',
    exchanges:[
      { prompt:'Campaign manager: First 60 minutes response?',
        opts:[
          { t:'"Get our veterans\' coalition chairs on every cable network now. Let them speak — their words matter more than mine."',
            fx:{rural:+5,seniors:+4,suburban:+2,urban:+1}, pts:3 },
          { t:'"Post the discharge papers and citation immediately. Primary documents beat talking points."',
            fx:{suburban:+4,urban:+3,seniors:+3,rural:+2}, pts:3 },
          { t:'"Say nothing for now — let\'s see if the story gets traction before we amplify it."',
            fx:{urban:-2,rural:-2,suburban:-2,seniors:-2}, pts:0 },
        ]},
      { prompt:'It\'s trending. How do we hit back?',
        opts:[
          { t:'"Call a press conference with service records projected on screen. Lawyers present."',
            fx:{suburban:+4,seniors:+4,rural:+3,urban:+2}, pts:3 },
          { t:'"Ask opponents what their record is. Turn it around."',
            fx:{urban:+4,youth:+3,rural:+2,suburban:+1}, pts:2 },
          { t:'"Tweet: Shameful and desperate. Move on."',
            fx:{youth:+3,urban:+2,rural:-1,seniors:-2}, pts:1 },
        ]},
    ]},
  { attack:'BREAKING: Video surfaces of you losing your temper with a voter two years ago.',
    exchanges:[
      { prompt:'Chief of staff: Two hours before evening news. What\'s the plan?',
        opts:[
          { t:'"Call the voter directly. Apologise personally. Ask if they\'d be willing to speak publicly."',
            fx:{suburban:+5,seniors:+4,urban:+3,rural:+3}, pts:3 },
          { t:'"Get in front of cameras. Own it completely. No hedging."',
            fx:{urban:+4,youth:+4,suburban:+2,rural:+1}, pts:2 },
          { t:'"Have comms draft a careful written statement. Minimise the moment."',
            fx:{seniors:+2,suburban:+1,urban:-1,rural:-1}, pts:1 },
        ]},
      { prompt:'Debate moderator brings it up. Live on national TV.',
        opts:[
          { t:'"That moment taught me something — about the pressure voters face every single day. I\'m grateful for it."',
            fx:{suburban:+5,seniors:+4,youth:+3,urban:+3}, pts:3 },
          { t:'"I apologised then. I apologise again now. And I\'ve moved on to serving the people in front of me."',
            fx:{seniors:+4,rural:+3,suburban:+3,urban:+2}, pts:3 },
          { t:'"I\'d like to focus on the issues the voters actually came here to discuss."',
            fx:{urban:+1,youth:+1,suburban:-1,seniors:-2}, pts:1 },
        ]},
    ]},
  { attack:'BREAKING: Opponent hits you with a new attack ad — claims your healthcare vote will raise premiums.',
    exchanges:[
      { prompt:'Comms director: Do we respond or let it sit?',
        opts:[
          { t:'"Respond immediately — in the same ad market. Counter with the actual premium data from the CBO."',
            fx:{suburban:+4,seniors:+5,urban:+2,rural:+2}, pts:3 },
          { t:'"Run a positive contrast: our plan caps premiums, theirs repeals protections. Let voters decide."',
            fx:{suburban:+3,seniors:+4,youth:+2,urban:+3}, pts:3 },
          { t:'"Ads answer ads. Let the surrogates take it. We stay positive."',
            fx:{youth:+1,urban:+1,suburban:-1,seniors:-2}, pts:1 },
        ]},
      { prompt:'Reporter asks you directly at a campaign stop:',
        opts:[
          { t:'"The independent analysis shows premiums fall 8% under my plan. I\'d encourage voters to read the full CBO report."',
            fx:{suburban:+4,seniors:+4,urban:+3,rural:+2}, pts:3 },
          { t:'"My opponent\'s plan would strip coverage from 14 million people. That\'s the real question."',
            fx:{urban:+4,youth:+3,suburban:+2,rural:+1}, pts:2 },
          { t:'"Healthcare is complicated. Our teams have different analyses."',
            fx:{urban:-1,suburban:-2,seniors:-3,rural:-1}, pts:0 },
        ]},
    ]},
];

function renderRapidResponseMinigame(el){
  const scenario = RAPID_ATTACKS[~~(Math.random()*RAPID_ATTACKS.length)];
  let ex=0, total=0, timer=14, timerInt=null;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderExchange = ()=>{
    if(ex>=scenario.exchanges.length){ showRapidResult(); return; }
    const e = scenario.exchanges[ex];
    const opts = [...e.opts].sort(()=>Math.random()-0.5);
    clearInterval(timerInt); timer=14;

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="${MG_STYLE.eyebrow('#ef4444')}">⚡ RAPID RESPONSE · STEP ${ex+1}/${scenario.exchanges.length}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:#e8ecf4" id="rr-timer">${timer}</div>
        </div>
        <div style="background:#0d0707;border:1px solid #2a1010;border-radius:6px;padding:10px 14px;font-size:12px;color:#fca5a5;font-family:'IBM Plex Mono',monospace;margin-bottom:10px">${scenario.attack}</div>
        <div style="${MG_STYLE.headline}">${e.prompt}</div>
        <div style="margin-top:8px;height:2px;background:#200808;border-radius:2px"><div id="rr-prog" style="width:100%;height:100%;background:#ef4444;border-radius:2px;transition:width 1s linear"></div></div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._rrPick(${i})"
            style="${MG_STYLE.btn('#ef4444')}"
            onmouseover="${MG_STYLE.btnHover('#ef4444')}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.t}
          </button>`).join('')}
      </div>`;

    let elapsed=0;
    timerInt=setInterval(()=>{
      timer--; elapsed++;
      const te=document.getElementById('rr-timer'), pb=document.getElementById('rr-prog');
      if(te){te.textContent=timer; te.style.color=timer<5?'#ef4444':timer<9?'#fb923c':'#e8ecf4';}
      if(pb) pb.style.width=Math.max(0,(1-elapsed/14)*100)+'%';
      if(timer<=0){clearInterval(timerInt); window._rrPick(~~(Math.random()*opts.length));}
    },1000);

    window._rrPick = (si)=>{
      clearInterval(timerInt);
      const opt = opts[si]; if(!opt){ex++;renderExchange();return;}
      const speedBonus = timer>9 ? 1 : 0;
      total += opt.pts + speedBonus;
      Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k]+=opt.fx[k]; });
      const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow('#ef4444')}">⚡ RESPONSE SENT ${speedBonus?'· ⚡ SPEED BONUS':''}</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">${opt.t}</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
          <button onclick="window._rrNext()" style="${MG_STYLE.btn()}">Next Step →</button>
        </div>`;
      window._rrNext = ()=>{ ex++; renderExchange(); };
    };
  };

  const showRapidResult = ()=>{
    const maxPts = scenario.exchanges.reduce((s,e)=>s+e.opts[0].pts*1.1,0);
    const pct = Math.min(total/maxPts,1);
    const bonus = pct>=0.8?7:pct>=0.6?4:pct>=0.4?2:0;
    const grade = pct>=0.8?'⚡ Crisis Crushed':pct>=0.6?'✅ Attack Blunted':pct>=0.4?'- Damage Limited':'💥 Narrative Lost';
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.4,10,90); });
    GS.favorability=cl(GS.favorability+bonus*.5,20,85);
    GS.momentum=cl(GS.momentum+bonus*.3,-20,20);
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow('#ef4444')}">⚡ RAPID RESPONSE — RESULT</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Net demographic impact: ${Object.values(impacts).reduce((s,v)=>s+v,0)>=0?'+':''}${Object.values(impacts).reduce((s,v)=>s+v,0)}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Back to War Room →', bonus)}
      </div>`;
    MG.bonus = bonus;
  };

  renderExchange();
}

// -----------------------------------------------------------------------------
// MINIGAME: VOTER FOCUS GROUP (Coalition Building)
// Each voter type cares about tradeoffs — no single perfect answer.
// The "3-point" answer with one group often costs you another.
// -----------------------------------------------------------------------------
function renderFocusGroupMinigame(el){
  const VOTERS = [
    { type:'👴 Senior Retiree', concern:'Healthcare & Social Security',
      q:'"I need to know: will you protect Medicare and Social Security, even if it means tough budget choices?"',
      options:[
        { text:'"Full stop — I will never cut Medicare or Social Security benefits. If anything, I\'ll expand them."',
          fx:{seniors:+6, youth:-1, suburban:-1, urban:0}, fb:'Standing ovation from the seniors. Budget hawks in the room shift.' },
        { text:'"I\'ll protect the programmes while ensuring long-term solvency — means-testing above $250K income."',
          fx:{seniors:+3, suburban:+3, urban:+2, youth:+1}, fb:'Moderate answer — most appreciate it. No fireworks.' },
        { text:'"We need a bipartisan commission to review entitlement solvency before we make promises."',
          fx:{seniors:-3, suburban:+1, urban:+1, youth:0}, fb:'Sounds like a dodge. Seniors visibly deflate.' },
      ]},
    { type:'🔧 Factory Worker', concern:'Trade & manufacturing jobs',
      q:'"Companies keep shipping jobs overseas. Do you have the guts to actually do something about it, or just talk?"',
      options:[
        { text:'"I\'ll put tariffs on any company that ships jobs overseas and gives executives bonuses for doing it."',
          fx:{rural:+5, urban:-1, suburban:-1, youth:+2}, fb:'Fists in the air. This is exactly what they want.' },
        { text:'"A $60B reshoring fund with worker ownership provisions, and union-wage requirements on all federal contracts."',
          fx:{rural:+3, urban:+2, suburban:+2, youth:+2}, fb:'Substantive and serious. Room leans forward.' },
        { text:'"Free trade ultimately creates more jobs than it destroys — but we need better transition support."',
          fx:{rural:-4, urban:+3, suburban:+2, youth:-1}, fb:'Hostile reaction. This voter is done with globalist framing.' },
      ]},
    { type:'🎓 College Student', concern:'Student debt & housing',
      q:'"I owe $90K and can\'t afford a one-bedroom. What specifically changes if you win?"',
      options:[
        { text:'"Broad cancellation up to $50K, free community college, and a first-generation homebuyer credit."',
          fx:{youth:+7, seniors:-3, suburban:-2, rural:-1}, fb:'Eruption of enthusiasm. Seniors in back of room look skeptical.' },
        { text:'"Income-based repayment capped at 5% of income, forgiveness after 10 years, and housing vouchers."',
          fx:{youth:+4, suburban:+2, urban:+3, seniors:+1}, fb:'Liked by everyone — bold enough to excite, stable enough to reassure.' },
        { text:'"We need to address the root cause — runaway tuition costs — before expanding forgiveness."',
          fx:{youth:-2, suburban:+3, seniors:+2, urban:+1}, fb:'This voter visibly deflates. Moderates in the room nod.' },
      ]},
    { type:'-- Suburban Parent', concern:'Crime & public safety',
      q:'"Crime is up in my area. My neighbour was robbed last month. I need a real answer, not talking points."',
      options:[
        { text:'"More officers in neighbourhoods, but also community violence intervention programmes — both work better together."',
          fx:{suburban:+5, urban:+3, rural:+2, seniors:+3}, fb:'Balanced answer hits the sweet spot. Room relaxes.' },
        { text:'"We need more police, period. Every neighbourhood deserves to feel safe."',
          fx:{suburban:+3, rural:+4, seniors:+4, urban:-2}, fb:'Half the room nods vigorously. The other half looks uncomfortable.' },
        { text:'"The real driver of crime is economic despair — we have to address root causes."',
          fx:{urban:+4, youth:+3, suburban:-2, seniors:-2}, fb:'Tone-deaf for this specific audience. They came for safety, not sociology.' },
      ]},
    { type:'🌾 Farmer, 3rd generation', concern:'Agriculture & rural investment',
      q:'"Washington forgets we exist until election season. Why is this time any different?"',
      options:[
        { text:'"I\'ve been to 14 farm counties this cycle. I\'m proposing anti-monopoly rules on ag conglomerates — by name."',
          fx:{rural:+7, suburban:+1, urban:-1, seniors:+3}, fb:'They sit up. Specific and personal. Strong connection.' },
        { text:'"Expanded crop insurance, rural broadband funding, and a farm-to-school programme."',
          fx:{rural:+4, suburban:+2, urban:+1, seniors:+2}, fb:'Concrete policy. Appreciated across the room.' },
        { text:'"Family farms are the backbone of America. I\'ll fight for fair commodity prices."',
          fx:{rural:+1, suburban:+1, urban:+1, seniors:+1}, fb:'Nice rhetoric, no specifics. They\'ve heard it before.' },
      ]},
  ];

  const shuffled = [...VOTERS].sort(()=>Math.random()-0.5).slice(0,4);
  let idx=0;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderQ = ()=>{
    if(idx >= shuffled.length){ showFGResult(); return; }
    const v = shuffled[idx];
    const opts = [...v.options].sort(()=>Math.random()-0.5);

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="${MG_STYLE.eyebrow('#60a5fa')}">📊 FOCUS GROUP · VOTER ${idx+1} OF ${shuffled.length}</div>
        <div style="display:flex;align-items:center;gap:10px;margin:8px 0">
          <span style="font-size:24px">${v.type.split(' ')[0]}</span>
          <div>
            <div style="font-weight:700;color:#e8ecf4;font-size:13px">${v.type.replace(v.type.split(' ')[0],'').trim()}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568">Concern: ${v.concern}</div>
          </div>
        </div>
        <div style="${MG_STYLE.headline}">${v.q}</div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._fgPick(${i})"
            style="${MG_STYLE.btn('#60a5fa')}"
            onmouseover="${MG_STYLE.btnHover('#60a5fa')}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.text}
          </button>`).join('')}
      </div>`;

    window._fgPick = (i)=>{
      const opt = opts[i];
      Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k]+=opt.fx[k]; });
      const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow('#60a5fa')}">📊 VOTER ${idx+1} — REACTION</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">${opt.text}</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
          <div style="font-size:12px;color:#8a93a8;font-style:italic;margin-bottom:14px">${opt.fb}</div>
          <button onclick="window._fgNext()" style="${MG_STYLE.btn()}">Next Voter →</button>
        </div>`;
      window._fgNext = ()=>{ idx++; renderQ(); };
    };
  };

  const showFGResult = ()=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const bonus = total>=18?6:total>=10?3:total>=3?1:0;
    const grade = total>=18?'📊 Message Mastered':total>=10?'✅ Strong Resonance':total>=3?'- Mixed Signals':'-- Message Not Landing';
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.4,10,90); });
    GS.favorability=cl(GS.favorability+total*.3,20,85);
    GS.electability=cl((GS.electability||50)+total*.2,30,90);
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow('#60a5fa')}">📊 FOCUS GROUP — RESULTS</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Net demographic impact: ${total>=0?'+':''}${total}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Continue →', bonus)}
      </div>`;
    MG.bonus = bonus;
  };

  renderQ();
}

// -----------------------------------------------------------------------------
// MINIGAME: AD BLITZ — Ad Strategy Session
// Target a voter segment. Each creative choice favours one group over another.
// -----------------------------------------------------------------------------
function renderEndorsementInterviewMinigame(el){
  const PANELS = [
    { name:'Swing-State Blue-Collar Workers', icon:'🔨', color:'#f97316', desc:'OH, PA, MI, WI — skeptical of both parties. Value authenticity over polish.',
      questions:[
        { q:'Your ad opens with — which image lands best?',
          options:[
            { text:'A factory floor at dawn. Your voice: "They shipped your job overseas. I\'m bringing it back."', fx:{rural:+4,urban:-1,suburban:+1,seniors:+2} },
            { text:'A family at a kitchen table opening bills — silence, then your face on the radio.', fx:{suburban:+3,seniors:+3,urban:+1,rural:+2} },
            { text:'Aerial shot of an empty plant, then a thriving one after your policy.', fx:{urban:+3,suburban:+2,rural:+1,youth:+2} },
          ]},
        { q:'Your tagline for this audience?',
          options:[
            { text:'"Fighting for the forgotten middle."', fx:{rural:+4,urban:+1,suburban:+2,seniors:+2} },
            { text:'"Real jobs. Real wages. Real America."', fx:{rural:+5,urban:-1,suburban:+1,seniors:+3} },
            { text:'"An economy that works for everyone."', fx:{urban:+3,suburban:+3,rural:-1,youth:+2} },
          ]},
        { q:'Your ad closes with:',
          options:[
            { text:'Your face, to camera: "I grew up like you. This is personal."', fx:{rural:+5,seniors:+3,suburban:+2,urban:+1} },
            { text:'A union leader: "This candidate fought for us when no one else did."', fx:{rural:+3,urban:+3,suburban:+2,youth:+2} },
            { text:'A montage of policy wins with your voice-over narrating the numbers.', fx:{suburban:+4,urban:+3,seniors:+1,rural:0} },
          ]},
      ]},
    { name:'Suburban Moderate Voters', icon:'--', color:'#60a5fa', desc:'College-educated suburbs, especially women — pragmatic, wary of extremes.',
      questions:[
        { q:'Ad tone for suburban moderates?',
          options:[
            { text:'Hopeful and solutions-focused. Competence over anger.', fx:{suburban:+5,seniors:+3,urban:+2,rural:+1} },
            { text:'Direct contrast with opponent\'s most divisive positions.', fx:{suburban:+2,urban:+3,youth:+2,rural:-1} },
            { text:'Heavy on endorsements from respected local figures.', fx:{suburban:+3,seniors:+4,urban:+1,rural:+2} },
          ]},
        { q:'Which issue leads in the ad?',
          options:[
            { text:'Education and childcare — universal suburban concerns.', fx:{suburban:+5,seniors:+2,urban:+2,youth:+2} },
            { text:'Healthcare costs and prescription drug prices.', fx:{suburban:+4,seniors:+5,urban:+2,rural:+2} },
            { text:'Public safety and community stability.', fx:{suburban:+3,seniors:+4,rural:+3,urban:0} },
          ]},
        { q:'Your ad format?',
          options:[
            { text:'30-second biographical spot. Humanise yourself first.', fx:{suburban:+5,seniors:+3,urban:+2,rural:+2} },
            { text:'60-second policy ad: three specific commitments with price tags.', fx:{suburban:+3,urban:+3,seniors:+2,youth:+2} },
            { text:'Contrast ad: their record vs. your plan, side by side.', fx:{urban:+4,youth:+3,suburban:+1,seniors:0} },
          ]},
      ]},
    { name:'Youth & First-Time Voters', icon:'🎓', color:'#a78bfa', desc:'Under-30, digital-first, values-driven. High upside if activated — very high dropout risk.',
      questions:[
        { q:'How do you reach Gen Z voters?',
          options:[
            { text:'Short-form video, authentic and unscripted. Go where they are.', fx:{youth:+7,urban:+2,suburban:+1,rural:-1} },
            { text:'Grassroots events at college campuses — meet in person first.', fx:{youth:+5,urban:+3,suburban:+2,rural:+1} },
            { text:'Radio and cable TV — same as every other demographic.', fx:{youth:-3,seniors:+2,suburban:+1,rural:+1} },
          ]},
        { q:'The issue that fires up young voters most?',
          options:[
            { text:'Climate, housing, and student debt — in that order. No hedging.', fx:{youth:+7,seniors:-2,suburban:+1,rural:-1} },
            { text:'Economic opportunity and entrepreneurship.', fx:{youth:+4,suburban:+3,urban:+3,seniors:+1} },
            { text:'Healthcare and mental health access.', fx:{youth:+5,seniors:+2,suburban:+3,urban:+2} },
          ]},
        { q:'Your call to action for youth turnout?',
          options:[
            { text:'"Register. Vote. Change it." Simple. Urgent. Shareable.', fx:{youth:+7,urban:+2,suburban:+1,rural:0} },
            { text:'"Your generation is the largest voting bloc in history — use it."', fx:{youth:+5,urban:+3,suburban:+1,rural:0} },
            { text:'"Make an informed choice about your future."', fx:{youth:-2,suburban:+2,seniors:+2,rural:+1} },
          ]},
      ]},
    { name:'Rural & Small-Town Voters', icon:'🌾', color:'#22c55e', desc:'Often overlooked. Value authenticity and direct presence — not ads, but proximity.',
      questions:[
        { q:'Ad setting for rural outreach?',
          options:[
            { text:'Farmland at dawn. Flat-brim cap. "I\'ve been to your county — not just flown over it."', fx:{rural:+7,seniors:+3,suburban:0,urban:-1} },
            { text:'A local diner. Real conversation with a real farmer. No script.', fx:{rural:+6,seniors:+3,suburban:+1,urban:+1} },
            { text:'Washington D.C. skyline. "I know how power works — and I\'ll use it for you."', fx:{rural:-2,suburban:+2,urban:+3,seniors:+1} },
          ]},
        { q:'Core message for rural voters?',
          options:[
            { text:'"Broadband, hospitals, and roads. You deserve what cities take for granted."', fx:{rural:+7,seniors:+4,suburban:+2,urban:+1} },
            { text:'"A farmer\'s tax credit and anti-monopoly rules on the big ag corporations."', fx:{rural:+6,seniors:+3,suburban:+1,urban:0} },
            { text:'"Economic development zones and innovation hubs in rural America."', fx:{rural:+1,suburban:+2,urban:+3,youth:+2} },
          ]},
        { q:'Close of ad?',
          options:[
            { text:'Local faces. Local names. "Tell Washington you\'re still here."', fx:{rural:+7,seniors:+4,suburban:+1,urban:0} },
            { text:'Your voice: "I\'m coming back. This isn\'t the last time you\'ll see me."', fx:{rural:+5,seniors:+3,suburban:+2,urban:+1} },
            { text:'National anthem. Flag. Emotional swell.', fx:{rural:+2,seniors:+3,suburban:+2,urban:+1} },
          ]},
      ]},
  ];

  const panel = _mgPickQuestions('adblitz', PANELS, 1)[0];
  let qIdx=0;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderQ = ()=>{
    if(qIdx >= panel.questions.length){ showAdResult(); return; }
    const q = panel.questions[qIdx];
    const opts = [...q.options].sort(()=>Math.random()-0.5);

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:22px">${panel.icon}</span>
          <div>
            <div style="${MG_STYLE.eyebrow(panel.color)}">📡 AD STRATEGY · ${panel.name.toUpperCase()}</div>
            <div style="font-size:10px;color:#4a5568">${panel.desc}</div>
          </div>
        </div>
        <div style="${MG_STYLE.headline}">${q.q}</div>
        <div style="${MG_STYLE.sub}">Decision ${qIdx+1} of ${panel.questions.length} · Each choice resonates differently</div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._adPick(${i})"
            style="${MG_STYLE.btn(panel.color)}"
            onmouseover="${MG_STYLE.btnHover(panel.color)}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.text}
          </button>`).join('')}
      </div>`;

    window._adPick = (i)=>{
      const opt = opts[i];
      // Show editable version of chosen ad text before locking in
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow(panel.color)}">📡 AD DECISION ${qIdx+1} — EDIT YOUR AD</div>
          <div style="font-size:11px;color:#8a93a8;margin-top:4px">${q.q}</div>
        </div>
        <div style="padding:14px 20px;display:flex;flex-direction:column;gap:10px">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.1em;margin-bottom:2px">YOUR AD — EDIT BEFORE RUNNING</div>
          <textarea id="ad-edit-input" rows="4"
            style="width:100%;background:#060a12;border:1px solid rgba(200,168,75,.3);border-radius:7px;
              color:#e8ecf4;font-family:'IBM Plex Sans',sans-serif;font-size:13px;
              padding:10px 12px;resize:none;line-height:1.6;outline:none;box-sizing:border-box;"
            onfocus="this.style.borderColor='${panel.color}88'"
            onblur="this.style.borderColor='rgba(200,168,75,.3)'"
          >${opt.text}</textarea>
          <div style="font-size:10px;color:#4a5568;font-family:'IBM Plex Mono',monospace">Edit the copy above — your changes affect the demographic reaction.</div>
          <div style="display:flex;gap:8px">
            <button onclick="window._adBack()" style="flex:1;padding:10px;background:#0d1117;border:1px solid #1e2535;border-radius:7px;color:#8a93a8;font-family:'IBM Plex Mono',monospace;font-size:11px;cursor:pointer;">- Back</button>
            <button onclick="window._adConfirm(${i})" style="flex:2;padding:10px;background:${panel.color};border:none;border-radius:7px;color:#0a0c10;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.05em;">Run This Ad →</button>
          </div>
        </div>`;
      window._adBack = ()=>renderQ();
      window._adConfirm = (idx)=>{
        const editedText = document.getElementById('ad-edit-input')?.value || opt.text;
        Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k]+=opt.fx[k]; });
        const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
        el.innerHTML = `
          <div style="${MG_STYLE.header}">
            <div style="${MG_STYLE.eyebrow(panel.color)}">📡 AD RUNNING · DECISION ${qIdx+1}</div>
            <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">"${editedText.slice(0,140)}${editedText.length>140?'…':''}"</div>
          </div>
          <div style="padding:14px 20px">
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
            <button onclick="window._adNext()" style="${MG_STYLE.btn()}">Next Decision →</button>
          </div>`;
        window._adNext = ()=>{ qIdx++; renderQ(); };
      };
    };
  };

  const showAdResult = ()=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const bonus = Math.round(total * 0.55);
    const effective = total >= 10;
    const grade = total>=18?'📡 Viral Campaign':total>=10?'✅ Ads Landing':total>=3?'- Weak Signal':'-- Message Missed';
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.4,10,90); });
    if(effective){
      GS.states.filter(s=>Math.abs(s.genLead)<12).slice(0,5).forEach(s=>{ s.genLead=cl(s.genLead+G(0.9,0.4),-60,60); });
      GS.mediaCoverage=cl(GS.mediaCoverage+12,0,100);
      GS.favorability=cl(GS.favorability+2,20,85);
    } else {
      GS.mediaCoverage=cl(GS.mediaCoverage+5,0,100);
    }
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow(panel.color)}">📡 AD CAMPAIGN — ${effective?'LAUNCHED':'REVIEW'}</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Target: ${panel.name} · Net impact: ${total>=0?'+':''}${total}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Continue →', Math.max(0,bonus))}
      </div>`;
    MG.bonus = Math.max(0,bonus);
  };

  renderQ();
}

// -----------------------------------------------------------------------------
// MINIGAME: HANDLE THE HECKLER (Campaign Rally)
// Tradeoff: confrontational = momentum, empathetic = favourability.
// No universally right answer — depends on what you need.
// -----------------------------------------------------------------------------
function renderRallyHecklerMinigame(el){
  const SCENARIOS = [];
  SCENARIOS.push({ setup:'Mid-speech, a protester rushes the stage shouting your opponent\'s name.', icon:'😡',
    exchanges:[
      { prompt:'The heckler shouts: "You\'re just like the rest of them!"',
        options:[
          { text:'"Security will handle this. To everyone else — THIS is what they fear. Your vote."',
            fx:{urban:+3,youth:+4,rural:+1,suburban:+1}, fb:'Crowd erupts. You turned disruption into a rally moment. Edgy on TV.' },
          { text:'Pause. Let the silence build. Then: "Let\'s keep going. They can\'t silence this crowd."',
            fx:{urban:+2,suburban:+3,seniors:+3,rural:+2}, fb:'Presidential calm. Broad appeal. Less viral but more trusted.' },
          { text:'"Everyone\'s entitled to their view. Now let me tell you mine."',
            fx:{suburban:+4,seniors:+4,rural:+3,urban:+1}, fb:'Grace under pressure. Moderates love it. Base slightly deflated.' },
        ]},
      { prompt:'A second heckler: "What about your vote on [controversial bill]?"',
        options:[
          { text:'"Great question — I voted that way because [specific reason]. Want to know what my opponent did? Nothing."',
            fx:{urban:+4,youth:+3,suburban:+2,rural:+2}, fb:'Pivot to offense. Crowd loves the fight.' },
          { text:'"My record is clear and public. Every vote I\'ve cast is on my website."',
            fx:{suburban:+3,seniors:+4,rural:+3,urban:+1}, fb:'Steady and factual. Doesn\'t generate a clip but doesn\'t hurt.' },
          { text:'"That\'s a fair challenge. I\'ll answer it right now, in full."',
            fx:{suburban:+5,seniors:+4,youth:+2,urban:+2}, fb:'Confidence and directness. Wins the room.' },
        ]},
      { prompt:'Both hecklers chanting now. The room is tense.',
        options:[
          { text:'Smile. Let it play for 10 seconds. Then: "They know we\'re winning."',
            fx:{urban:+5,youth:+5,rural:+2,suburban:+1}, fb:'Legendary moment. Clip goes viral. Some moderates wince.' },
          { text:'Walk to the front of the stage. Hands up, quiet. "Let them speak. Now let ME speak."',
            fx:{suburban:+4,seniors:+4,rural:+3,urban:+3}, fb:'Command of the room. Broad appeal.' },
          { text:'Call for a moment of calm, then refocus on the closing message.',
            fx:{seniors:+5,suburban:+4,rural:+4,urban:+1}, fb:'Elder statesman energy. Mature. Not viral, but respected.' },
        ]},
    ]});
  // Only show "voted for you last time" if player has previously held elected office
  if(['senator','governor','mayor','prosecutor'].includes(GS.backstory && GS.backstory.career)){
    SCENARIOS.push({ setup:'A visibly emotional supporter rushes forward: "You promised us change. What happened?"', icon:'😢',
      exchanges:[
        { prompt:'"I voted for you last time. My factory still closed."',
          options:[
            { text:'"I hear you — and I\'m not going to give you statistics. I\'m going to tell you exactly what I\'m changing."',
              fx:{rural:+5,urban:+3,youth:+3,suburban:+2}, fb:'Raw authenticity. Room goes quiet, then applause.' },
            { text:'"You\'re right to be angry. And that anger is the reason I\'m still fighting."',
              fx:{urban:+5,youth:+5,rural:+3,suburban:+1}, fb:'Emotional resonance. Base energised. Some moderates uncertain.' },
            { text:'"I understand your frustration — our package created 2 million jobs but I know it didn\'t reach everyone."',
              fx:{suburban:+4,seniors:+3,urban:+2,rural:+1}, fb:'Factual. Somewhat cold for the moment, but credible.' },
          ]},
        { prompt:'"Same old promises. We\'ve heard it all before."',
          options:[
            { text:'"Then hold me to it. I\'ll give you my personal cell number. Call me in six months."',
              fx:{urban:+5,youth:+6,rural:+2,suburban:+2}, fb:'Extraordinary moment. Crowd gasps, then cheers.' },
            { text:'"Then I understand if you don\'t believe me. But I\'m asking for the chance to prove you wrong."',
              fx:{rural:+4,suburban:+4,seniors:+4,urban:+3}, fb:'Humble and direct. Disarming even for sceptics.' },
            { text:'"The difference this time is that I\'m naming the specific votes I\'ll take in the first 90 days."',
              fx:{suburban:+4,seniors:+3,youth:+2,urban:+3}, fb:'Policy-specific. Convinces the undecideds.' },
          ]},
      ]});
  }

  const scenario = SCENARIOS[~~(Math.random()*SCENARIOS.length)];
  let eIdx=0;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderExchange = ()=>{
    if(eIdx >= scenario.exchanges.length){ showRallyResult(); return; }
    const ex = scenario.exchanges[eIdx];
    const opts = [...ex.options].sort(()=>Math.random()-0.5);

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="${MG_STYLE.eyebrow('#fb923c')}">📣 HANDLE THE HECKLER · EXCHANGE ${eIdx+1}/${scenario.exchanges.length}</div>
        ${eIdx===0?`<div style="padding:8px 12px;background:rgba(239,68,68,.07);border-left:3px solid #ef4444;border-radius:0 6px 6px 0;margin:8px 0;font-size:12px;color:#c8d0e0">${scenario.icon} ${scenario.setup}</div>`:''}
        <div style="${MG_STYLE.headline}">${ex.prompt}</div>
        <div style="${MG_STYLE.sub}">Different responses build different coalitions</div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._rhPick(${i})"
            style="${MG_STYLE.btn('#fb923c')}"
            onmouseover="${MG_STYLE.btnHover('#fb923c')}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.text}
          </button>`).join('')}
      </div>`;

    window._rhPick = (i)=>{
      const opt = opts[i];
      Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k]+=opt.fx[k]; });
      const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow('#fb923c')}">📣 CROWD REACTION</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">"${opt.text}"</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
          <div style="font-size:12px;color:#8a93a8;font-style:italic;margin-bottom:14px">${opt.fb}</div>
          <button onclick="window._rhNext()" style="${MG_STYLE.btn()}">Continue →</button>
        </div>`;
      window._rhNext = ()=>{ eIdx++; renderExchange(); };
    };
  };

  const showRallyResult = ()=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const bonus = total>=16?6:total>=9?3:total>=3?1:0;
    const grade = total>=16?'📣 Legendary Rally':total>=9?'✅ Crowd Won Over':total>=3?'- Held Your Ground':'-- Rough Night';
    // Store demographic impacts on MG so applyMinigameBonus can push them to the target state
    MG.rallyImpacts = {...impacts};
    MG.rallyTotal = total;
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.5,10,90); });
    GS.momentum=cl(GS.momentum+total*.25,-20,20);
    GS.mediaCoverage=cl(GS.mediaCoverage+total*.4,0,100);
    if(total>=16) GS.favorability=cl(GS.favorability+2,20,85);
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow('#fb923c')}">📣 RALLY WRAP-UP</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Net demographic impact: ${total>=0?'+':''}${total}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Back to Campaign →', bonus)}
      </div>`;
    MG.bonus = bonus;
  };

  renderExchange();
}

// -----------------------------------------------------------------------------
// MINIGAME: DEBATE PREP (Grassroots — Grass action)
// Questions have real tradeoffs. Bold answer = base mobilised, moderates alienated.
// Safe answer = broad appeal, no enthusiasm.
// -----------------------------------------------------------------------------
const DEBATE_PREP_QUESTIONS = [
    { category:'Record Defence', icon:'🛡', q:'"Your opponent says you raised taxes on middle-class families. How do you respond?"',
      options:[
        { text:'"That\'s false — I cut middle-class taxes by $2,000 per family on average. The record is clear and public."',
          fx:{suburban:+4,seniors:+4,rural:+3,urban:+2}, fb:'Clean, specific rebuttal. Hard to attack.' },
        { text:'"My opponent is cherry-picking one provision from a complex bill that also expanded the EITC."',
          fx:{urban:+4,youth:+3,suburban:+2,rural:+1}, fb:'Nuanced. Works well in educated circles, less so elsewhere.' },
        { text:'"I\'d invite voters to look at the full bill. I stand by every vote."',
          fx:{seniors:+3,rural:+3,suburban:+2,urban:+1}, fb:'Principled. Slightly defensive but not damaging.' },
      ]},
    { category:'Gotcha Question', icon:'🎯', q:'"Name three things you\'d cut from the federal budget."',
      options:[
        { text:'"Pentagon cost overruns, corporate welfare programmes, and duplicative administrative overhead."',
          fx:{urban:+4,youth:+3,suburban:+2,rural:+2}, fb:'Specific and sharp. The prep paid off.' },
        { text:'"I believe in investing in America — the question is what we\'re investing in, not just cutting."',
          fx:{urban:+3,youth:+4,suburban:+1,seniors:-1}, fb:'Ideological pivot. Fires up base, slightly evasive.' },
        { text:'"Foreign aid that doesn\'t serve American interests, outdated programmes, and agency redundancy."',
          fx:{rural:+5,seniors:+4,suburban:+3,urban:+1}, fb:'Plays broad. Will be quoted in rural papers approvingly.' },
      ]},
    { category:'Counter-Attack', icon:'⚔-', q:'"Your opponent calls you \'out of touch with working Americans.\'"',
      options:[
        { text:'"Let\'s talk about who\'s out of touch — their last fundraiser had a $50,000 ticket price. Mine was free."',
          fx:{rural:+5,urban:+4,youth:+4,suburban:+2}, fb:'Perfect counter. Opponent stammers.' },
        { text:'"My entire career was built representing working-class districts. The record disagrees with them."',
          fx:{rural:+4,seniors:+4,suburban:+3,urban:+2}, fb:'Credible and grounded. Broad appeal.' },
        { text:'"I don\'t think personal attacks serve voters. Let\'s talk about the economy."',
          fx:{suburban:+5,seniors:+4,rural:+2,urban:+1}, fb:'Presidential. Moderate voters love it. Base slightly frustrated.' },
      ]},
    { category:'Closing Message', icon:'🎤', q:'"30 seconds. Final statement. Make it count."',
      options:[
        { text:'"This is a choice between fear and hope. I choose hope — and I believe you do too. Let\'s go win this."',
          fx:{urban:+5,youth:+5,suburban:+3,seniors:+2}, fb:'Simple, soaring, memorable. Will be quoted tomorrow.' },
        { text:'"My three commitments: healthcare protected, wages raised, climate acted on. On day one. Binding."',
          fx:{urban:+4,youth:+4,suburban:+4,seniors:+3}, fb:'Concrete. Voters who want specifics are satisfied.' },
        { text:'"I ask for your vote, your trust, and your partnership — and I won\'t let this country down."',
          fx:{rural:+4,seniors:+5,suburban:+3,urban:+2}, fb:'Traditional, dignified. Strong with older voters.' },
      ]},
    { category:'Healthcare', icon:'--', q:'"Would you support Medicare for All?"',
      options:[
        { text:'"A robust public option — compete with private insurance, drive costs down, cover everyone who falls through the cracks."',
          fx:{suburban:+5,seniors:+4,rural:+3,urban:+3}, fb:'Smart hedge — wins across the coalition.' },
        { text:'"Fully — healthcare is a human right and we need to say it without hedging."',
          fx:{urban:+6,youth:+6,suburban:-2,seniors:-1}, fb:'Base electrified. Moderates noticeably shift.' },
        { text:'"We need to protect the ACA, add a public option, and negotiate drug prices — in that order."',
          fx:{seniors:+5,suburban:+4,rural:+3,urban:+2}, fb:'Systematic and defensible. Less exciting, very electable.' },
      ]},
    { category:'Foreign Policy', icon:'-', q:'"North Korea tests a missile. What do you do in the first 48 hours?"',
      options:[
        { text:'"Convene allies, issue a joint statement, authorise a UN Security Council session, and review contingency options."',
          fx:{suburban:+5,seniors:+4,urban:+3,rural:+2}, fb:'Presidential and calibrated. Hard to attack.' },
        { text:'"Make clear — clearly — that there will be consequences. Then line up the allies to enforce them."',
          fx:{rural:+4,seniors:+4,suburban:+3,urban:+2}, fb:'Strength-forward. Plays broadly.' },
        { text:'"Diplomacy first. We do not escalate unless we have to. That\'s how you avoid wars."',
          fx:{urban:+5,youth:+5,suburban:+1,rural:-1}, fb:'Anti-war coalition engaged. Hawks concerned.' },
      ]},
  ];

function renderDebatePrepMinigame(el){
  const selected = _mgPickQuestions('debate_prep', DEBATE_PREP_QUESTIONS, 4);
  let qIdx=0;
  const impacts = {urban:0, rural:0, suburban:0, youth:0, seniors:0};

  const renderQ = ()=>{
    if(qIdx >= selected.length){ showPrepResult(); return; }
    const q = selected[qIdx];
    const opts = [...q.options].sort(()=>Math.random()-0.5);

    el.innerHTML = `
      <div style="${MG_STYLE.header}">
        <div style="${MG_STYLE.eyebrow('#c8a84b')}">📚 DEBATE PREP · ${q.category.toUpperCase()} · Q${qIdx+1}/${selected.length}</div>
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
          <span style="font-size:22px">${q.icon}</span>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#c8a84b">${q.category}</div>
        </div>
        <div style="${MG_STYLE.headline}">${q.q}</div>
        <div style="${MG_STYLE.sub}">Choose your answer — each plays differently with different voter groups</div>
      </div>
      <div style="${MG_STYLE.body}">
        ${opts.map((o,i)=>`
          <button onclick="window._dpPick(${i})"
            style="${MG_STYLE.btn()}"
            onmouseover="${MG_STYLE.btnHover()}"
            onmouseout="${MG_STYLE.btnOut}">
            ${o.text}
          </button>`).join('')}
      </div>`;

    window._dpPick = (i)=>{
      const opt = opts[i];
      Object.keys(impacts).forEach(k=>{ if(opt.fx[k]) impacts[k]+=opt.fx[k]; });
      const chips = Object.entries(opt.fx).map(([k,v])=>`${MG_STYLE.chip(v)} ${k}`).join(' ');
      el.innerHTML = `
        <div style="${MG_STYLE.header}">
          <div style="${MG_STYLE.eyebrow('#c8a84b')}">📚 ${q.category.toUpperCase()} — YOUR ANSWER</div>
          <div style="font-size:13px;color:#e8ecf4;font-style:italic;line-height:1.5;margin-top:4px">"${opt.text}"</div>
        </div>
        <div style="padding:14px 20px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">${chips}</div>
          <div style="font-size:12px;color:#8a93a8;font-style:italic;margin-bottom:14px">${opt.fb}</div>
          <button onclick="window._dpNext()" style="${MG_STYLE.btn()}">Next Question →</button>
        </div>`;
      window._dpNext = ()=>{ qIdx++; renderQ(); };
    };
  };

  const showPrepResult = ()=>{
    const total = Object.values(impacts).reduce((s,v)=>s+v,0);
    const debateBonus = Math.round(total * 0.85);
    GS._playerDebateBonus = (GS._playerDebateBonus||0) + debateBonus * 0.1;
    Object.entries(impacts).forEach(([k,v])=>{ if(GS.demos[k]!==undefined) GS.demos[k]=cl(GS.demos[k]+v*.3,10,90); });
    GS.favorability=cl(GS.favorability+total*.25,20,85);
    const grade = total>=18?'📚 Razor Sharp':total>=10?'✅ Well Prepared':total>=3?'- A Few Gaps':'-- More Work Needed';
    el.innerHTML = `
      <div style="${MG_STYLE.result}">
        <div style="${MG_STYLE.eyebrow('#c8a84b')}">📚 PREP SESSION COMPLETE</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#e8ecf4;margin-bottom:6px">${grade}</div>
        <div style="font-size:12px;color:#8a93a8;margin-bottom:4px">Net demographic impact: ${total>=0?'+':''}${total} · Debate bonus banked: +${(debateBonus*0.1).toFixed(1)}</div>
        ${_mgDemoGrid(impacts)}
        ${MG_STYLE.cta('Done →', debateBonus)}
      </div>`;
    MG.bonus = debateBonus;
  };

  renderQ();
}



// ── TURN ENGINE ──
function nextWeek(){
  if(GS.phaseTransitioning)return;
  const action=ACTIONS.find(a=>a.id===GS.selectedAction)||UNDERDOG_ACTIONS.find(a=>a.id===GS.selectedAction);
  let events=[];
  // Track action streak
  if(!GS._actionStreak) GS._actionStreak = 0;
  if(!GS._uniqueActionsUsed) GS._uniqueActionsUsed = new Set();
  // ── SPAM TRACKING — rolling history of last 5 action IDs ──
  if(!GS._recentActions) GS._recentActions = [];
  if(action){
    GS._actionStreak++;
    GS._uniqueActionsUsed.add(action.id);
    GS._recentActions.push(action.id);
    if(GS._recentActions.length > 5) GS._recentActions.shift();
    // Streak bonus at 3, 5, 7 weeks
    if(GS._actionStreak===3){ GS.momentum=cl(GS.momentum+1,0,20); addNews('3-week campaign streak! Momentum boost.','campaign'); }
    else if(GS._actionStreak===5){ GS.momentum=cl(GS.momentum+2,0,20); GS.funds+=1; addNews('5-week streak! Momentum +2, bonus fundraising.','campaign'); }
    else if(GS._actionStreak>0 && GS._actionStreak%7===0){ GS.momentum=cl(GS.momentum+3,0,20); addNews(`${GS._actionStreak}-week streak! Voters notice your relentless campaigning.`,'campaign'); }
  } else {
    GS._actionStreak = 0;
    GS._recentActions = [];
  }

  // ── MINIGAME SPAM PENALTY ────────────────────────────────────────────────────
  // Minigames are the high-reward actions. Spamming the same one signals a
  // one-trick campaign: donors get nervous, voters tune out, media mocks it.
  // The minigame actions that can be spammed:
  const MINIGAME_IDS = new Set(['coalition','adblitz','townhall','town_hall','canvass','press','debate']);
  if(action && MINIGAME_IDS.has(action.id) && GS._recentActions.length >= 3){
    // Count how many of the last N actions were this exact action
    const last3 = GS._recentActions.slice(-3);
    const last5 = GS._recentActions.slice(-5);
    const sameInLast3 = last3.filter(id=>id===action.id).length;
    const sameInLast5 = last5.filter(id=>id===action.id).length;

    // Tier 1 penalty: same minigame 3× in a row
    if(sameInLast3 === 3 && last3.every(id=>id===action.id)){
      const penMom = G(2.5, 0.8);
      const penFav = G(1.5, 0.5);
      GS.momentum     = cl(GS.momentum - penMom, -20, 20);
      GS.favorability = cl(GS.favorability - penFav, 20, 85);
      const actionName = action.name;
      addNews(`Pundits: ${GS.playerName}'s campaign looks one-dimensional — same play every week`,'scandal');
      events.push({
        type:'negative',
        title:`📉 Campaign Fatigue — ${actionName} Overload`,
        msg:`Your campaign has run the same "${actionName}" play three weeks in a row. Donors are questioning your strategy, media is bored, and voters are switching off. Momentum −${penMom.toFixed(1)}, favorability −${penFav.toFixed(1)}. Mix it up before the story hardens.`,
      });
    }
    // Tier 2 penalty: same minigame 4+ of the last 5 weeks — significantly worse
    else if(sameInLast5 >= 4){
      const penMom  = G(4.5, 1.0);
      const penFav  = G(3.0, 0.8);
      const penAppr = G(2.0, 0.6); // hits swing state leads too
      GS.momentum     = cl(GS.momentum - penMom, -20, 20);
      GS.favorability = cl(GS.favorability - penFav, 20, 85);
      // Bleed a few battleground states
      GS.states
        .filter(s => Math.abs(GS.phase==='primary' ? s.primLead : s.genLead) < 15)
        .slice(0, 4)
        .forEach(s => {
          if(GS.phase==='primary') s.primLead = cl(s.primLead - G(penAppr, 0.5), -60, 60);
          else s.genLead = cl(s.genLead - G(penAppr, 0.5), -60, 60);
        });
      const actionName = action.name;
      addNews(`Editorial: "${GS.playerName}'s campaign strategy is embarrassingly predictable" — donors alarmed`,'scandal');
      events.push({
        type:'negative',
        title:`🚨 One-Trick Campaign — Momentum Collapse`,
        msg:`${sameInLast5} of your last 5 weeks have been pure "${actionName}". Your campaign has become a laughingstock among political strategists. The narrative is set: no message, no vision, just the same lever pulled again and again. Momentum −${penMom.toFixed(1)}, favorability −${penFav.toFixed(1)}, battleground leads eroding. Only a wave election or complete opponent collapse can save a 60%+ finish now.`,
      });
    }
  }

  // ── BORING CAMPAIGN EVENT ────────────────────────────────────────────────────
  // Fires once per phase if the player used ≤2 distinct action types by the midpoint
  // of that phase. A repetitive campaign loses narrative oxygen and punishes complacency.
  {
    const weeksInPhase = GS.phase==='primary' ? GS.primaryWeeks : GS.generalWeeks;
    const weekInPhase  = GS.phase==='primary' ? GS.week : GS.week - GS.primaryWeeks;
    const midpoint     = Math.floor(weeksInPhase * 0.55); // slightly past halfway
    const uniqueCount  = GS._uniqueActionsUsed.size;
    if(!GS._boringCampaignFired && weekInPhase >= midpoint && uniqueCount <= 2){
      GS._boringCampaignFired = true;
      const penFav   = G(5, 1.5);
      const penMom   = G(4, 1.2);
      const penMedia = G(8, 2);
      const penFunds = G(2, 0.8);
      GS.favorability  = cl(GS.favorability  - penFav,  20, 85);
      GS.momentum      = cl(GS.momentum      - penMom, -20, 20);
      GS.mediaCoverage = cl(GS.mediaCoverage - penMedia, 0, 100);
      GS.funds         = cl(GS.funds         - penFunds, 0, 9999);
      // Hit swing states slightly too — the drone of a predictable campaign loses ground
      GS.states.filter(s => Math.abs(GS.phase==='primary' ? s.primLead : s.genLead) < 12)
               .forEach(s => {
                 if(GS.phase==='primary') s.primLead = cl(s.primLead - G(1,0.5), -60, 60);
                 else s.genLead = cl(s.genLead - G(1,0.5), -60, 60);
               });
      const uniqueNames = [...GS._uniqueActionsUsed].map(id=>{
        const a = [...ACTIONS,...UNDERDOG_ACTIONS].find(x=>x.id===id);
        return a ? a.name : id;
      }).join(' & ');
      addNews(`Pundits slam ${GS.playerName}'s "one-note" campaign — voters tuning out`, 'scandal');
      events.push({
        type:'negative',
        title:'📉 Boring Campaign — Voters Switching Off',
        msg:`Your campaign has relied almost entirely on ${uniqueNames} for ${weekInPhase} weeks. Pundits are calling it "the most predictable race in decades." Donors are nervous. Favorability −${penFav.toFixed(1)}%, momentum −${penMom.toFixed(1)}, media coverage −${penMedia.toFixed(0)}%, war chest −${fm(penFunds)}. Shake up your strategy before it's too late.`,
      });
    }
    // Reset tracker at phase boundary (handled by startGeneral resetting GS flags)
  }
  if(!action){
    addNews('A quiet week on the trail — the campaign loses ground while rivals stay active.','campaign');
    // Idle penalty: momentum and media coverage drop, favorability drifts back toward mean
    GS.momentum = cl(GS.momentum * 0.75 - 1, -20, 20);
    GS.mediaCoverage = cl(GS.mediaCoverage - 3, 0, 100);
    if(GS.phase==='general') GS.favorability = cl(GS.favorability - 0.5, 20, 85);
  } else {
    if(action.needsState&&!GS.targetState){alert('Please select a target state for this action.');return}
    if(GS.funds<action.cost){alert('Not enough funds! Fundraise first.');return}
    GS.funds-=action.cost;GS.totalSpent+=action.cost;
    // Mark targeted state as campaigned (reveals it on primary map)
    if(GS.targetState){ const ts=GS.states.find(s=>s.code===GS.targetState); if(ts) ts._campaigned=true; }
    // Apply national mood risk modifier to risky actions
    if(action.risk && GS.nationalMood){
      window._moodRiskRoll = getMoodRiskMod(); // fx functions can read this
    } else {
      window._moodRiskRoll = null;
    }
    events=action.fx(GS.targetState)||[];
    events=applyMinigameBonus(events);
  }

  // ─ Debate weeks ─
  const isDebateWeek=
    (GS.phase==='primary'&&PRIMARY_DEBATE_WEEKS.includes(GS.week))||
    (GS.phase==='general'&&GENERAL_DEBATE_WEEKS.includes(GS.week));
  if(isDebateWeek){
    const de=resolveDebate();events.push(de);addNews(de.title,'event');
  }

  passiveDecay();
  opponentPassiveFundraise();
  const dropEvs=runAI();events.push(...dropEvs);

  if(Math.random()<(isDebateWeek?.25:.62)){
    const ev=wr(EVENTS),res=ev.fx(GS);
    addNews(ev.hl,ev.tag);events.push({type:res.type,title:ev.hl,msg:res.msg});
  }

  // ── CRISIS EVENTS — arm on random weeks, fire after summary closes ──
  // Primary: random week between 4-18, every ~5-7 weeks at most 2 per phase
  // General: random week between 3-14, every ~4-6 weeks at most 2 per phase
  if(!GS._crisisArmed && !GS._lastCrisisWeek){
    GS._lastCrisisWeek = 0; GS._crisisCountThisPhase = 0;
  }
  const weekInPhase = GS.phase==='primary' ? GS.week : GS.week - GS.primaryWeeks;
  const sinceLastCrisis = weekInPhase - (GS._lastCrisisWeek||0);
  const maxCrises = GS.phase==='primary' ? 2 : 2;
  const minGap = GS.phase==='primary' ? 5 : 4;
  const crisisWindow = GS.phase==='primary' ? (weekInPhase>=3&&weekInPhase<=12) : (weekInPhase>=3&&weekInPhase<=14);
  if(crisisWindow && sinceLastCrisis>=minGap && (GS._crisisCountThisPhase||0)<maxCrises){
    if(Math.random()<0.28){
      armCrisisEvent();
      GS._lastCrisisWeek = weekInPhase;
      GS._crisisCountThisPhase = (GS._crisisCountThisPhase||0)+1;
    }
  }

  if(GS.phase==='primary') { allocateDelegates(); computePrimaryLeaders(); }
  else if(action) applyMomentumToGeneral(); // only apply momentum boost if player acted — idle weeks get no free state movement

  GS.week++;
  GS.minigamesThisWeek=0;
  GS.selectedAction=null;GS.targetState=null;
  GS.targetedStates.clear(); // Clear after each week — targeting is turn-by-turn, not persistent
  document.querySelectorAll('.action-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('state-target-section').style.display='none';
  document.getElementById('target-state-select').value='';
  const _nwBtn = document.querySelector('.next-week-btn');
  if(_nwBtn) _nwBtn.classList.remove('action-ready');
  GS.favHistory.push(GS.favorability);
  // Media bias drifts slowly toward center each week, with small random noise
  GS.mediaBias=cl(GS.mediaBias*0.92+G(0,4),-100,100);
  // Party-specific drift: Dem players attract more left-wing coverage, Rep more right-wing
  const partyDrift=GS.playerParty==='dem'?-2:2;
  GS.mediaBias=cl(GS.mediaBias+partyDrift*0.5,-100,100);
  autoSaveGame(); // auto-save every week
  renderAll();
  showSummary(events);

  // Phase transitions — handled in closeSummary to avoid double-fire
  // (summary modal must be closed first so screens don't overlap)
}

function resolveDebate(){
  const prep=(GS.electability-50)/50; // -1 to +1
  const vpDebateBonus = GS.vp ? (GS.vp.debateDefense - 5) * 0.06 : 0;
  // Mood adjusts debate — angry/change electorates punish bland performances
  const moodDebateBonus = GS.nationalMood==='angry'?0.15:GS.nationalMood==='change'?0.1:GS.nationalMood==='stability'?-0.1:GS.nationalMood==='fatigued'?-0.15:0;
  const roll=G(0,1)+prep*.7+vpDebateBonus+moodDebateBonus;
  const vpNote = GS.vp && GS.vp.debateDefense >= 8 ? ` ${GS.vp.name} was particularly sharp on the trail.` : '';
  const moodNote = GS.nationalMood==='angry' ? ' Angry voters reward fighters.' : GS.nationalMood==='fatigued' ? ' Fatigued viewers barely watching.' : '';
  if(roll>0.6){
    GS.favorability=cl(GS.favorability+G(4,1.5),20,85);GS.momentum=cl(GS.momentum+5,-20,20);GS.electability=cl(GS.electability+2,0,100);
    const opp=GS.aiCandidates.find(a=>a.active);if(opp)opp.approval=cl(opp.approval-G(3,1),0,80);
    return{type:'debate',title:'🎤 Debate Victory!',msg:`Strong performance tonight. Favorability surges and momentum builds.${GS.phase==='general'?' Opponent looked rattled.':''}${vpNote}${moodNote}`};
  } else if(roll<-0.3){
    GS.favorability=cl(GS.favorability-G(4,1.5)*(GS.vp?1-GS.vp.debateDefense*.02:1),20,85);GS.momentum=cl(GS.momentum-4,-20,20);
    const opp=GS.aiCandidates.find(a=>a.active);if(opp)opp.approval=cl(opp.approval+G(2,1),0,80);
    const vpDefenseNote=GS.vp&&GS.vp.debateDefense>=7?` ${GS.vp.name}'s post-debate spin helped contain the damage.`:'';
    return{type:'negative',title:'🎤 Rough Debate Night',msg:`A stumble on key policy dominates coverage. Consider more Debate Prep.${vpDefenseNote}`};
  }
  GS.momentum=cl(GS.momentum+1,-20,20);
  return{type:'neutral',title:'🎤 Debate: Even Draw',msg:'A well-matched debate. Both campaigns claim victory in the spin room.'};
}

// ── STATE CORRELATION GROUPS ──
// States in the same group move together when national polling shifts
const STATE_CORRELATION_GROUPS=[
  ['PA','MI','WI','OH','MN'],   // Rust Belt / Great Lakes
  ['GA','NC','VA','SC'],         // New South
  ['AZ','NV','CO','NM'],         // Sun Belt West
  ['TX','FL'],                   // Big Sun Belt
  ['ME','NH','VT','MA'],         // New England
  ['IA','MO','IN','KY'],         // Heartland
];
function getCorrelationGroup(code){
  for(const g of STATE_CORRELATION_GROUPS) if(g.includes(code)) return g;
  return null;
}

function passiveDecay(){
  const moodDecay = getMoodMomentumDecay();
  GS.momentum*=(.82*moodDecay);
  GS.mediaCoverage=cl(GS.mediaCoverage-1,0,100);
  // Favorability slow mean-reversion to baseline
  GS.favorability=cl(GS.favorability+(42-GS.favorability)*.015,20,85);

  // Track if player has ever trailed in the polls (for Comeback Kid achievement)
  if(GS.phase==='general' && GS.opponent){
    const { pEV: playerEVCount } = getEV();
    if(playerEVCount < 230) GS._trailedInPolls = true;
  }

  // ── HIDDEN PLAYER SCANDAL RISK ──
  // Builds up quietly; high media coverage and low favorability increase it
  GS._scandalRisk=(GS._scandalRisk||0);
  GS._scandalRisk+=G(0.3,0.15)+(GS.mediaCoverage-50)*.008;
  GS._scandalRisk=cl(GS._scandalRisk,0,15);
  // Trigger scandal if risk crests — severity scales with how high it got
  // VP scandal buffer reduces chance and severity
  const vpBuff = GS._vpScandalBuffer || 0;
  const moodScandalMod = getMoodScandalMod();
  const diffScandalModPlayer = {easy:0.65, normal:1.15, hard:2.50}[GS.difficulty] || 1.15;
  const scandalChance = Math.max(0.05, 0.3 - vpBuff*0.04) * moodScandalMod * diffScandalModPlayer;
  if(GS._scandalRisk>11&&Math.random()<scandalChance){
    const severity=G(4,2)*(GS._scandalRisk/11)*(1-vpBuff*0.08);
    GS.favorability=cl(GS.favorability-severity,20,85);
    GS.momentum=cl(GS.momentum-severity*.4,-20,20);
    GS._scandalRisk=G(2,1); // resets but not to zero — scandal trail lingers
    const vpNote = vpBuff>=4 ? ` ${GS.vp?.name||'Your VP'}'s credibility helped contain the fallout.` : '';
    addNews('Damaging story emerges — campaign scrambles for damage control'+vpNote,'scandal');
  }

  // ── HIDDEN ENTHUSIASM VARIABLE ──
  // VP enthusiasm amplifier passively boosts base enthusiasm every week
  const vpEnthBoost = GS.vp ? (GS.vp.enthusiasmAmp - 5) * 0.02 : 0; // -0.1 to +0.1 per week
  GS._enthusiasm=(GS._enthusiasm||50);
  GS._enthusiasm=cl(GS._enthusiasm+(GS.momentum*.12)+G(0,1.5)+(42-GS.favorability)*.008+vpEnthBoost,20,90);
  // Enthusiasm above 65 passively buffs ground game; below 35 drains it
  if(GS._enthusiasm>65) GS.groundGame=cl(GS.groundGame+.4,0,100);
  else if(GS._enthusiasm<35) GS.groundGame=cl(GS.groundGame-.3,0,100);

  // ── NATIONAL POLLING DRIFT ──
  // Each week a national wind blows — slightly correlated with economic events and momentum
  const nationalDrift=G(0,1.2)*(1+Math.abs(GS.momentum)*.04);

  // ── STATE CORRELATION LAYER ──
  // Pre-compute per-group shock so states in same region move together
  const groupShock={};
  STATE_CORRELATION_GROUPS.forEach((g,i)=>{
    groupShock[i]=G(0,0.35); // reduced regional shock — was 1.0, now 0.35 so neighbours do not wildly shift
  });

  GS.states.forEach(s=>{
    // Primary: tiny dampened drift
    s.primLead=cl(s.primLead+G(0,s.vol*.7)*.1,-60,60);

    // General: partisan lean pull + national drift + regional correlation
    // ind/custom party: safe states still resist being flipped (they snap back toward
    // their partisan baseline), but competitive states have no inherent pull — earned
    // leads are stable. Dem/Rep: full partisan lean reversion as normal.
    const rawLean = GS.playerParty==='rep' ? -s.lean : s.lean;
    const absLean = Math.abs(s.lean);
    // Tiered mean reversion by state safety:
    //   Safe   (|lean| > 20): very strong snap-back — nearly impossible to hold
    //   Likely (|lean| 12-20): strong reversion — hard to flip, stays lean
    //   Lean   (|lean| 6-12):  moderate reversion — competitive but tilted
    //   Toss-up(|lean| < 6):   weak reversion — genuinely contestable
    const leanStrength = absLean > 20 ? 0.22 : absLean > 12 ? 0.14 : absLean > 6 ? 0.07 : 0.04;
    // ind/custom: only safe states pull back toward their partisan baseline;
    // lean/tossup states have no pull so leads earned via campaigning are stable.
    const isInd = GS.playerParty !== 'dem' && GS.playerParty !== 'rep';
    const pullTarget = isInd ? (absLean > 12 ? -Math.abs(s.lean) * 0.5 : s.genLead) : rawLean;
    const pull=(pullTarget-s.genLead)*leanStrength;

    // Find group shock for this state
    let regionalShock=0;
    STATE_CORRELATION_GROUPS.forEach((g,i)=>{
      if(g.includes(s.code)) regionalShock=groupShock[i];
    });

    // National winds and regional shocks are damped for safer states —
    // a national wave moves toss-ups a lot, lean states a little, safe states almost nothing.
    const safetyDamp = absLean > 20 ? 0.10 : absLean > 12 ? 0.30 : absLean > 6 ? 0.65 : 1.0;

    // Enthusiasm bonus: high enthusiasm slightly protects swing states
    const enthBonus=(GS._enthusiasm-50)*.008;

    // Total state drift = pull + (damped) national wind + (damped) regional correlation + enthusiasm
    const drift=G(0,s.vol*1.0)*.15+pull+nationalDrift*.06*safetyDamp+regionalShock*.06*safetyDamp+enthBonus;
    s.genLead=cl(s.genLead+drift,-60,60);

    // Enthusiasm feeds into per-state hidden factor
    s.enthusiasm=cl((s.enthusiasm||50)+(GS._enthusiasm-50)*.05+G(0,2),20,90);
  });
}

function applyMomentumToGeneral(){
  // Base momentum effect on battlegrounds
  const momEffect=GS.momentum*.06;
  // Enthusiasm amplifier: high enthusiasm makes momentum translate better
  const enthMult=cl(0.7+(GS._enthusiasm||50)*.006,0.7,1.5);
  GS.states.filter(s=>Math.abs(s.genLead)<15).forEach(s=>{
    s.genLead=cl(s.genLead+momEffect*enthMult,-60,60);
  });
  // Ground game hidden effect: high ground game protects narrow leads
  if(GS.groundGame>60){
    const protection=( GS.groundGame-60)*.015;
    GS.states.filter(s=>s.genLead>0&&s.genLead<8).forEach(s=>{
      s.genLead=cl(s.genLead+protection,-60,60);
    });
  }
}

// ── AI LOGIC (ARCHETYPE-AWARE) ──

// Pick a state biased toward the archetype's preferred territory
function aiPickTargetState(ai,arch){
  const reg=GS._aiRegional||{};
  let pool;
  if(arch.stateTarget==='rural')       pool=GS.states.filter(s=>s.lean<-5||s.vol<0.45);
  else if(arch.stateTarget==='urban')  pool=GS.states.filter(s=>s.lean>5||s.vol>0.55);
  else if(arch.stateTarget==='swing')  pool=GS.states.filter(s=>Math.abs(s.lean)<=8);
  if(!pool||!pool.length) pool=GS.states;
  // Weighted: prefer states where AI already has regional presence
  let tot=0;
  const wp=pool.map(s=>{const w=1+(reg[s.code]?.[ai.id]||0)/8;tot+=w;return{s,w};});
  let r=Math.random()*tot;
  for(const {s,w} of wp){r-=w;if(r<=0)return s;}
  return pool[~~(Math.random()*pool.length)];
}

function runAI(){
  const events=[];
  const active=GS.aiCandidates.filter(a=>a.active);
  if(!active.length)return events;

  // Difficulty affects: AI action effectiveness, scandal chance, AI fundraising, AI attack damage
  const diffMult = {easy:0.90, normal:1.35, hard:2.20}[GS.difficulty] || 1.35;
  const diffAttackMult = {easy:0.80, normal:1.45, hard:2.60}[GS.difficulty] || 1.45;
  const diffScandalMult = {easy:0.70, normal:1.25, hard:2.40}[GS.difficulty] || 1.25;
  const diffFundMult = {easy:0.85, normal:1.30, hard:2.00}[GS.difficulty] || 1.30;

  const totApproval=active.reduce((s,a)=>s+Math.max(a.approval,0),0)+Math.max(GS.favorability,0);
  active.forEach(ai=>{
    if(ai.funds<=0.4){const ev=dropAI(ai);if(ev)events.push(ev);return}
    const arch=ARCHETYPES[ai.archetype]||ARCHETYPES.moderate;
    const w=arch.w;
    const aiShare=totApproval>0?ai.approval/totApproval*100:20;
    const deficit=GS.playerDelegates-ai.delegates;
    const risk=cl(.3+(deficit/500)*.5,.2,.9)*arch.aggressionBias;

    const scored=[
      {n:'fundraise',s:w.fundraise*(1-Math.min(ai.funds/35,1)),            c:0},
      {n:'rally',    s:w.rally*risk*(ai.approval/80),                       c:1.5},
      {n:'attack',   s:w.attack*risk*(aiShare<25?1.8:1),                    c:2},
      {n:'media',    s:w.media*(1-ai.approval/80),                          c:0.5},
      {n:'coalition',s:w.coalition*(1-ai.approval/70),                      c:1},
    ].filter(x=>ai.funds>=x.c).sort((a,b)=>b.s-a.s);

    const best=scored[0];if(!best){ai.funds=0;return}
    ai.funds-=best.c;

    if(best.n==='fundraise'){
      ai.funds+=G(3.5,1.2)*arch.fundraiseMult*diffFundMult;
      // Occasionally announce a fundraising milestone
      if(Math.random()<0.25) addNews(`${ai.name} reports strong fundraising quarter — war chest growing`,'campaign');
    } else if(best.n==='attack'&&Math.random()<.55){
      // Scandal resist: populists can spin attacks into momentum; moderates take blowback
      const dmg=G(3,1.5)*(1-arch.scandalResist*.5)*diffAttackMult;
      GS.favorability=cl(GS.favorability-dmg,20,85);
      // Populists and law&order candidates get a small self-boost from attacking
      if(arch.scandalResist>0) ai.approval=cl(ai.approval+G(1,0.5),0,80);
      const adjectve=ai.archetype==='populist'?'populist ':ai.archetype==='laworder'?'tough-on-crime ':ai.archetype==='progressive'?'progressive ':'';
      addNews(`${ai.name} launches ${adjectve}attack ads against ${GS.playerName}`,'scandal');
    } else if(best.n==='rally'){
      ai.approval=cl(ai.approval+G(2.5,1)*arch.rallyMult*diffMult,0,80);
      // Campaign in archetype-appropriate state
      const tgt=aiPickTargetState(ai,arch);
      if(tgt){
        if(!GS._aiRegional[tgt.code])GS._aiRegional[tgt.code]={};
        GS._aiRegional[tgt.code][ai.id]=cl((GS._aiRegional[tgt.code][ai.id]||0)+G(3.5,1.5),0,40);
        // Show AI activity in news (20% chance to make it newsworthy)
        if(Math.random()<0.3){
          const narrative = getAIActionNarrative('rally', ai.name, tgt.name);
          if(narrative) addNews(narrative,'campaign');
        }
        // Add visible badge to AI card
        ai._lastAction = `📢 Rally in ${tgt.code}`;
      }
    } else if(best.n==='coalition'){
      ai.approval=cl(ai.approval+G(2,0.8),0,80);
      // Each archetype chips into different demographic blocks
      if(ai.archetype==='progressive') GS.demos.youth=cl(GS.demos.youth-G(1.2,.5),20,80);
      else if(ai.archetype==='moderate') GS.demos.suburban=cl(GS.demos.suburban-G(1,.4),20,80);
      else if(ai.archetype==='laworder') GS.demos.seniors=cl(GS.demos.seniors-G(1,.4),20,80);
      else if(ai.archetype==='populist') GS.demos.rural=cl(GS.demos.rural-G(1.2,.5),20,80);
      ai._lastAction = `- Coalition Building`;
      if(Math.random()<0.2){
        const narrative = getAIActionNarrative('coalition', ai.name);
        if(narrative) addNews(narrative,'campaign');
      }
    } else {
      ai.approval=cl(ai.approval+G(2,0.8),0,80);
      ai._lastAction = `📺 Media Tour`;
      if(Math.random()<0.2){
        const narrative = getAIActionNarrative('media', ai.name);
        if(narrative) addNews(narrative,'campaign');
      }
    }

    // Hidden scandal risk: builds up each week, occasionally fires
    ai._scandalRisk=(ai._scandalRisk||0)+G(0.4,0.2);
    if(ai._scandalRisk>10&&Math.random()<0.25){
      const hit=G(4,2)*(1-arch.scandalResist*.4);
      ai.approval=cl(ai.approval-hit,0,80);
      ai._scandalRisk=0;
      addNews(`${ai.name} faces damaging internal controversy — campaign scrambles`,'scandal');
    }

    ai.approval=cl(ai.approval+G(0,1.2)+GS.momentum*-.07,0,80);
    if(aiShare<7&&ai.funds<2&&GS.week>4){const ev=dropAI(ai);if(ev)events.push(ev)}
  });

  // Run general opponent AI if in general phase — collect events for summary
  if(GS.phase==='general'){
    GS._oppSummaryEvents = [];
    runGeneralOpponentAI();
    if(GS._oppSummaryEvents && GS._oppSummaryEvents.length > 0){
      events.push(...GS._oppSummaryEvents);
    }
    GS._oppSummaryEvents = null;
  }

  return events;
}

function dropAI(ai){
  ai.active=false;
  // Clear this candidate's regional advantages so their held states become contested
  if(GS._aiRegional){
    Object.keys(GS._aiRegional).forEach(code=>{
      if(GS._aiRegional[code][ai.id]){
        delete GS._aiRegional[code][ai.id];
      }
    });
  }
  // Also reset any state where this AI was the primary leader — force recompute
  GS.states.forEach(s=>{
    if(s._primaryLeader===ai.id){
      s._primaryLeader=null; // open election — recomputed next turn
      s._primaryLeaderColor=null;
    }
  });
  // Find ideologically closest remaining candidate
  const remaining=[
    {id:'player',ideology:GS.playerIdeology,name:GS.playerName},
    ...GS.aiCandidates.filter(a=>a.active&&a.id!==ai.id).map(a=>({id:a.id,ideology:a.ideology,name:a.name}))
  ].sort((a,b)=>Math.abs(a.ideology-ai.ideology)-Math.abs(b.ideology-ai.ideology));
  const naturalPick=remaining[0];
  const ideoDist=Math.abs(naturalPick.ideology - ai.ideology);
  const cab=CABINET[~~(Math.random()*CABINET.length)];

  addNews(`${ai.name} suspends campaign — endorsement pending`,'campaign');

  // Queue negotiate modal — shown after week summary closes
  GS._pendingNegotiation={ai, naturalPick, ideoDist, cab};

  return{type:'endorsement',title:`⚖- ${ai.name} Drops Out`,msg:`${ai.name} has suspended their campaign with ${ai.delegates.toLocaleString()} delegates. They're weighing their options. You'll need to negotiate for their support.`};
}

function openNegotiateModal(){
  if(!GS._pendingNegotiation)return;
  const {ai, naturalPick, ideoDist, cab}=GS._pendingNegotiation;
  GS._pendingNegotiation=null;

  const modal=document.getElementById('negotiate-modal');
  document.getElementById('neg-title').textContent=`📞 ${ai.name} Is On The Line`;
  document.getElementById('neg-cand').textContent=ai.name;
  document.getElementById('neg-delegates').textContent=ai.delegates.toLocaleString();
  document.getElementById('neg-natural').textContent=naturalPick.name;

  const baseOdds=cl(42 - ideoDist*1.8 + GS.favorability*.10 + GS.momentum*1.0, 8, 72);
  const oddsEl=document.getElementById('neg-odds');
  if(oddsEl){ oddsEl.textContent=baseOdds.toFixed(0)+'%'; oddsEl.style.color=baseOdds>60?'#22c55e':baseOdds>35?'#fb923c':'#ef4444'; }
  document.getElementById('neg-ideo-note').textContent=ideoDist<10?'Ideologically close — they may come around.'
    :ideoDist<25?'Some ideological distance — a concrete offer helps.'
    :'Far apart ideologically — you need a bold pitch.';

  const inp=document.getElementById('neg-call-input');
  if(inp){ inp.value=''; setTimeout(()=>inp.focus(),150); }

  modal._baseOdds=baseOdds;
  modal._ai=ai;
  modal._naturalPick=naturalPick;
  modal._cab=cab;
  modal.classList.add('active');
}

// Called by the free-text call UI — parses player's words to detect offer type
function submitNegotiateCall(forceOffer){
  if(forceOffer==='nothing'){ negotiateChoice('nothing'); return; }
  const inp=document.getElementById('neg-call-input');
  const text=(inp?.value||'').trim();
  if(!text||text.length<4){
    if(inp){ inp.style.borderColor='#ef4444'; setTimeout(()=>{ if(inp) inp.style.borderColor='var(--border)'; },1200); }
    return;
  }
  const t=text.toLowerCase();
  let offer='persuade';
  if(/vp|vice.?president|running mate|ticket together|second in command/.test(t)) offer='vp';
  else if(/cabinet|secretary|attorney general|chief of staff|role|administration|appoint|position in my/.test(t)) offer='cabinet';
  negotiateChoice(offer);
}

function negotiateChoice(offer){
  const modal=document.getElementById('negotiate-modal');
  const ai=modal._ai;
  const naturalPick=modal._naturalPick;
  const cab=modal._cab;
  let odds=modal._baseOdds;

  if(offer==='cabinet') odds=cl(odds+14,0,86);
  if(offer==='vp') odds=cl(odds+22,0,90);
  if(offer==='nothing') odds=cl(odds-20,0,65);

  modal.classList.remove('active');

  const success=Math.random()*100 < odds;
  let resultEvent;

  if(success){
    // Only 55–85% of delegates actually follow their candidate's endorsement
    const transferRate = cl(0.55 + Math.random()*0.30, 0.55, 0.85);
    const transferred = Math.round(ai.delegates * transferRate);
    GS.playerDelegates += transferred;
    GS.favorability=cl(GS.favorability+ai.approval*.06,20,85);
    GS.endorsements++;
    const pct = Math.round(transferRate*100);
    const offerStr=offer==='vp'?`promised the VP slot`:offer==='cabinet'?`offered the ${cab} role`:`persuaded without concessions`;
    addNews(`${ai.name} endorses ${GS.playerName} — ${offerStr}`,'endorsement');
    resultEvent={type:'endorsement',title:`✅ Endorsement Secured!`,msg:`${ai.name} backs you, ${offerStr}. ${pct}% of their delegates (${transferred.toLocaleString()} of ${ai.delegates.toLocaleString()}) transfer — the rest remain uncommitted.`};
  } else {
    // On failure, find a rival AI (never the player) for the endorsement
    const rivals = GS.aiCandidates.filter(a=>a.active);
    const fallback = rivals.length
      ? rivals.sort((a,b)=>Math.abs(a.ideology-(modal._ai?.ideology||50))-Math.abs(b.ideology-(modal._ai?.ideology||50)))[0]
      : null;
    if(fallback){
      fallback.delegates += ai.delegates;
      fallback.approval = cl(fallback.approval + ai.approval*.06, 0, 80);
      addNews(`${ai.name} endorses ${fallback.name} over ${GS.playerName}`,'campaign');
      resultEvent={type:'negative',title:`-- Negotiation Failed`,msg:`${ai.name} declined and backed ${fallback.name} instead. Their ${ai.delegates.toLocaleString()} delegates go to a rival.`};
    } else {
      addNews(`${ai.name}'s delegates remain uncommitted`,'campaign');
      resultEvent={type:'negative',title:`-- Negotiation Failed`,msg:`${ai.name} declined your offer. Their ${ai.delegates.toLocaleString()} delegates remain uncommitted.`};
    }
  }

  // Show result as a mini flash summary
  showNegotiateResult(resultEvent);
}

function showNegotiateResult(ev){
  const r=document.getElementById('neg-result-modal');
  document.getElementById('neg-result-title').textContent=ev.title;
  document.getElementById('neg-result-msg').textContent=ev.msg;
  document.getElementById('neg-result-modal').className=`modal-overlay active`;
  document.getElementById('neg-result-inner').className=`modal summary-event ${ev.type}`;
  r.classList.add('active');
  renderAll();
}

function allocateDelegates(){
  // Each week, states hold their "primary" proportionally.
  // Winner-take-most: whoever leads gets a bonus on top of proportional.
  const regional = GS._aiRegional||{};
  GS.states.forEach(state=>{
    const all=[
      {id:'player', score: Math.max(0, GS.favorability + state.primLead)},
      ...GS.aiCandidates.filter(a=>a.active).map(a=>{
        const rb = (regional[state.code]&&regional[state.code][a.id]||0)*(a.approval/40);
        return {id:a.id, score: Math.max(0, a.approval + rb)};
      })
    ];
    const tot = all.reduce((s,c)=>s+c.score, 0);
    if(tot<=0) return;
    // Weekly delegate drip: state gives out pd/primaryWeeks delegates per week
    const weeklyPD = Math.max(1, Math.round(state.pd / GS.primaryWeeks));
    // Sort to find leader for winner-take-most bonus
    all.sort((a,b)=>b.score-a.score);
    const leaderShare = all[0].score/tot;
    all.forEach((c,i)=>{
      let share = c.score/tot;
      // Leader gets slight bonus (winner-take-most primary)
      if(i===0) share = Math.min(share * 1.3, 0.85);
      const won = Math.round(weeklyPD * share);
      if(c.id==='player'){GS.playerDelegates+=won; state.primaryDelegatesWon=(state.primaryDelegatesWon||0)+won;}
      else{const ai=GS.aiCandidates.find(a=>a.id===c.id); if(ai) ai.delegates+=won;}
    });
  });
}

// ── CONVENTION ──
function showConvention(){
  showScreen('convention-screen');
  const total=GS.playerDelegates+GS.aiCandidates.reduce((s,a)=>s+a.delegates,0);
  const needed=GS.delegatesNeeded;
  const won=GS.playerDelegates>=needed;
  let html=`<div class="convention-title animate-in">${won?'🎉 Nomination Won!':'⚔- Contested Convention'}</div>`;
  html+=`<div class="convention-msg animate-in">${won
    ?`You secured <strong>${GS.playerDelegates.toLocaleString()}</strong> delegates — above the ${needed.toLocaleString()} threshold. The party rallies behind you.`
    :`You enter with <strong>${GS.playerDelegates.toLocaleString()}</strong> delegates — short of ${needed.toLocaleString()} needed. Backroom deals will decide.`}</div>`;
  html+=`<div class="delegate-tally animate-in">
    <div class="tally-row" style="border-color:var(--accent)"><div class="tally-name">-- ${GS.playerName}</div><div class="tally-count">${GS.playerDelegates.toLocaleString()}</div><div class="tally-pct">${((GS.playerDelegates/Math.max(total,1))*100).toFixed(1)}%</div></div>`;
  GS.aiCandidates.forEach(ai=>{html+=`<div class="tally-row"><div class="tally-name">${ai.active?'':'🚫 '}${ai.name}</div><div class="tally-count">${ai.delegates.toLocaleString()}</div><div class="tally-pct">${((ai.delegates/Math.max(total,1))*100).toFixed(1)}%</div></div>`});
  html+=`</div>`;
  if(!won){
    const total=GS.playerDelegates+GS.aiCandidates.reduce((s,a)=>s+a.delegates,0);
    const playerShare = GS.playerDelegates / Math.max(total,1);
    // Second-place rival
    const rivalDels = Math.max(...GS.aiCandidates.map(a=>a.delegates), 0);
    const leadMargin = GS.playerDelegates - rivalDels;
    // Base: delegate share + endorsements. Big lead means party coalesces.
    // If player has >40% and leads rival by >500 delegates, almost certain to win.
    const leadBonus = cl(leadMargin / 800, 0, 0.35); // up to +35% for big lead
    const chance = cl(playerShare * 0.85 + GS.endorsements * 0.04 + leadBonus, 0.05, 0.97);
    if(Math.random()<chance){
      GS.playerDelegates=needed;
      const leadDesc = leadMargin > 600 ? `With a commanding ${leadMargin.toLocaleString()}-delegate lead, the party had no choice.`
        : leadMargin > 200 ? `Your ${leadMargin.toLocaleString()}-delegate margin gave you leverage in backroom negotiations.`
        : `Your ${GS.endorsements} endorsement(s) swung the pivotal delegates.`;
      html+=`<div style="background:rgba(200,168,75,.1);border:1px solid var(--accent);border-radius:8px;padding:14px;max-width:440px;font-size:13px;color:var(--text2)">- ${leadDesc} <strong style="color:var(--accent)">You win the nomination!</strong></div>`;
    } else {
      html+=`<div style="background:rgba(239,68,68,.1);border:1px solid var(--rep);border-radius:8px;padding:14px;max-width:400px;font-size:13px;color:var(--text2)">-- The convention does not consolidate around your candidacy. <strong style="color:var(--rep)">Your campaign ends here.</strong></div><button class="start-btn" style="margin-top:14px" onclick="showEndScreen(false,'convention')">View Results</button>`;
      document.getElementById('convention-content').innerHTML=html;return;
    }
  }
  html+=`<button class="start-btn" style="margin-top:12px" onclick="showVPSelection()">Choose Running Mate →</button>`;
  document.getElementById('convention-content').innerHTML=html;
}

// ── VP SELECTION ──
function showVPSelection(){
  showScreen('vp-screen');
  const allOpts=GS.playerParty==='dem'?VP_OPTIONS_DEM:VP_OPTIONS_REP;
  // Pick 4 random VP options — avoid the two picked last run for variety
  if(!GS._vpShortlist){
    const allOpts=GS.playerParty==='dem'?VP_OPTIONS_DEM:VP_OPTIONS_REP;
    const lastVPs = (()=>{ try{ return JSON.parse(localStorage.getItem('potus_last_vps')||'[]'); }catch(e){ return []; } })();
    const fresh = allOpts.filter(v=>!lastVPs.includes(v.name));
    const pool = fresh.length >= 4 ? fresh : allOpts;
    const shuffled=[...pool].sort(()=>Math.random()-.5);
    GS._vpShortlist = shuffled.slice(0,4);
    try{ localStorage.setItem('potus_last_vps', JSON.stringify(GS._vpShortlist.map(v=>v.name))); }catch(e){}
  }
  const opts = GS._vpShortlist;
  const pCol = GS.playerParty==='dem' ? 'var(--dem)' : 'var(--rep)';
  let html=`<div class="convention-title animate-in">- Choose Your Running Mate</div>
  <div class="convention-msg animate-in">Your VP choice shapes coalition strategy, debate performance, and scandal defense. Each pick has distinct strengths — choose what your campaign needs most.</div>
  <div class="delegate-tally animate-in" style="max-width:600px;gap:12px">`;
  opts.forEach((vp,i)=>{
    const regionStates = (vp.region||'').split(',').filter(Boolean).slice(0,4);
    const traitTags = (vp.traits||[]).map(t=>`<span style="display:inline-block;font-size:8px;background:rgba(200,168,75,.1);color:var(--accent);border:1px solid rgba(200,168,75,.2);border-radius:3px;padding:1px 5px;margin:1px">${t}</span>`).join('');
    html+=`<div class="vp-option" onclick="selectVP(${i})" style="padding:16px;gap:0">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div class="vp-name" style="font-size:15px">${vp.name} <span style="font-size:11px;color:var(--text3);font-weight:400">· ${vp.state}</span></div>
          <div style="font-size:11px;font-weight:700;color:${pCol};margin-top:2px">${vp.tag}</div>
        </div>
        <div style="text-align:right;font-family:var(--font-mono)">
          <div style="font-size:9px;color:var(--text3)">Fav boost</div>
          <div style="font-size:13px;font-weight:700;color:var(--green)">+${vp.approval}%</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:10px;line-height:1.5;font-style:italic">"${vp.personality}"</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
        <div style="background:var(--bg3);border-radius:4px;padding:6px 4px;text-align:center">
          <div style="font-size:8px;color:var(--text3);font-family:var(--font-mono);margin-bottom:2px">DEBATE</div>
          <div style="font-size:14px;font-weight:700;color:${vp.debateDefense>=7?'var(--green)':vp.debateDefense>=5?'var(--accent)':'var(--rep)'}">${'★'.repeat(Math.round(vp.debateDefense/2))}${'☆'.repeat(5-Math.round(vp.debateDefense/2))}</div>
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:6px 4px;text-align:center">
          <div style="font-size:8px;color:var(--text3);font-family:var(--font-mono);margin-bottom:2px">SCANDAL</div>
          <div style="font-size:14px;font-weight:700;color:${vp.scandalBuffer>=4?'var(--green)':vp.scandalBuffer>=2?'var(--accent)':'var(--rep)'}">${'★'.repeat(vp.scandalBuffer)}${'☆'.repeat(5-vp.scandalBuffer)}</div>
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:6px 4px;text-align:center">
          <div style="font-size:8px;color:var(--text3);font-family:var(--font-mono);margin-bottom:2px">ENERGY</div>
          <div style="font-size:14px;font-weight:700;color:${vp.enthusiasmAmp>=7?'var(--green)':vp.enthusiasmAmp>=4?'var(--accent)':'var(--rep)'}">${'★'.repeat(Math.round(vp.enthusiasmAmp/2))}${'☆'.repeat(5-Math.round(vp.enthusiasmAmp/2))}</div>
        </div>
        <div style="background:var(--bg3);border-radius:4px;padding:6px 4px;text-align:center">
          <div style="font-size:8px;color:var(--text3);font-family:var(--font-mono);margin-bottom:2px">REGIONAL</div>
          <div style="font-size:11px;font-weight:700;color:${pCol}">${regionStates.join(' ')}</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text2);background:rgba(200,168,75,.06);padding:7px 9px;border-radius:4px;margin-bottom:8px">📌 ${vp.bonus}</div>
      <div>${traitTags}</div>
    </div>`;
  });
  html+=`</div>`;
  document.getElementById('vp-content').innerHTML=html;
}

function selectVP(idx){
  const opts = GS._vpShortlist || (GS.playerParty==='dem'?VP_OPTIONS_DEM:VP_OPTIONS_REP);
  GS.vp=opts[idx];
  // Favorability boost from VP excitement
  GS.favorability=cl(GS.favorability+GS.vp.approval,20,85);
  // VP enthusiasm amplifier seeds initial momentum
  GS.momentum=cl(GS.momentum+(GS.vp.enthusiasmAmp*.4),-20,20);
  // VP scandal buffer stored on GS for event processing
  GS._vpScandalBuffer = GS.vp.scandalBuffer || 0;
  addNews(`${GS.playerName} names ${GS.vp.name} as running mate — general election begins`,'campaign');
  startGeneral();
}

// ── GENERAL ELECTION START ──
function startGeneral(){
  GS.phase='general';GS.week=GS.primaryWeeks+1;
  GS._crisisCountThisPhase = 0; GS._lastCrisisWeek = 0; GS._crisisArmed = false;
  GS._uniqueActionsUsed = new Set(); // reset variety tracker for general phase
  GS._boringCampaignFired = false;
  GS._recentActions = []; // reset spam tracker for new phase
  // Large randomised pool — prevents seeing the same opponent every run
  const opNamesRep=['Gov. R. Thompson','Sen. W. Harrison','VP D. Callahan','Gov. M. Reyes',
    'Sen. C. Blackwell','Gov. T. Hargrove','VP J. Sinclair','Rep. D. Whitfield',
    'Gov. L. Prescott','Sen. B. Malone','Rep. K. Stafford','Gov. A. Thorne'];
  const opNamesDem=['Gov. C. Beaumont','Sen. L. Okafor','VP A. Castillo','Gov. R. Nakamura',
    'Sen. P. Donovan','Rep. M. Osei','Gov. T. Castellano','Sen. F. Obara',
    'VP H. Kowalski','Gov. B. Tremblay','Sen. J. Adeyemi','Rep. S. Petrova'];
  // Custom party runs against the Rep opponent by default
  const diffModGen={easy:0.92,normal:1.10,hard:1.65}[GS.difficulty]||1.10;
  const oppParty = (GS.playerParty==='dem') ? 'rep' : (GS.playerParty==='rep') ? 'dem' : 'rep';

  // Use the real historical general opponent if we have year data
  if(GS._historicalYearData && GS._historicalYearData.generalOpponent){
    const ho = GS._historicalYearData.generalOpponent;
    GS.opponent = {
      ...ho,
      funds: ho.funds * diffModGen,
      approval: ho.approval * diffModGen,
    };
  } else {
    // Generic randomised opponent
    const opPool = (GS.playerParty==='dem'||GS.playerParty==='ind') ? opNamesRep : opNamesDem;
    const lastOp = (()=>{ try{ return localStorage.getItem('potus_last_opponent')||''; }catch(e){ return ''; } })();
    const freshPool = opPool.filter(n=>n!==lastOp);
    const chosenOp = freshPool[~~(Math.random()*freshPool.length)] || opPool[0];
    try{ localStorage.setItem('potus_last_opponent', chosenOp); }catch(e){}
    GS.opponent={
      name:chosenOp,
      party:oppParty,
      funds:(50+Math.random()*25)*diffModGen,
      approval:(50+Math.random()*8)*diffModGen,
      active:true,
      color:oppParty==='rep'?'#ef4444':'#3b82f6',
      delegates:0,
    };
  }
  GS.aiCandidates=[GS.opponent];
  // Unified multi-candidate list for EV / poll rendering (works for 2-party and N-way races)
  GS.generalOpponents = [GS.opponent];

  // Initialize genLead from partisan lean — so the map shows realistic starting positions.
  // The EV counter starts at 0-0 and animates in after a beat (see setTimeout below).
  // diffShift: on easy the map starts favouring you; on hard the opponent starts with structural advantages
  const diffShift={easy:2,normal:-2,hard:-16}[GS.difficulty]||0;
  // Custom/independent starts from scratch — no lean advantage, all states contested
  const indPenalty = GS.playerParty==='ind' ? -8 : 0;
  GS.states.forEach(s=>{
    // ind/custom: rawLean=0 so genLead is purely difficulty-based, no partisan skew
    const rawLean = GS.playerParty==='rep' ? -s.lean : GS.playerParty==='ind' ? 0 : s.lean;
    s.genLead = rawLean + diffShift + indPenalty + G(0,4);
  });

  // Apply VP home state + regional boosts
  if(GS.vp){
    if(GS.vp.stateCode&&GS.vp.bVal){
      const vpSt=GS.states.find(s=>s.code===GS.vp.stateCode);
      if(vpSt) vpSt.genLead=cl(vpSt.genLead+GS.vp.bVal,-60,60);
    }
    // Regional boost — smaller but covers more states
    if(GS.vp.region&&GS.vp.regionBoost){
      const regionCodes=(GS.vp.region).split(',').filter(Boolean);
      regionCodes.forEach(code=>{
        const s=GS.states.find(x=>x.code===code);
        if(s) s.genLead=cl(s.genLead+(GS.vp.regionBoost*.6),-60,60);
      });
    }
  }
  ensureBattlegroundSets(true);

  showScreen('game-screen');
  document.getElementById('topbar-phase').textContent='General Election';
  document.getElementById('phase-primary').className='phase-step done';
  document.getElementById('phase-convention').className='phase-step done';
  document.getElementById('phase-general').className='phase-step current';
  document.getElementById('opponent-panel-title').textContent='General Opponent';
  document.getElementById('primary-content').style.display='none';
  document.getElementById('general-content').style.display='block';
  document.getElementById('battleground-section').style.display='block';
  const congressEl=document.getElementById('congress-tracker'); if(congressEl) congressEl.style.display='block';
  initCongressTracker();
  document.getElementById('polls-title').textContent='National General Poll';
  // win-prob-bar-wrap is always visible now (shows primary odds during primary phase)
  document.getElementById('stat-delegates').textContent='—';
  document.getElementById('stat-delegates-wrap').style.display='none';
  renderActionGrid(); // refresh to show bloc-themed actions

  // Show VP in left panel
  if(GS.vp){
    document.getElementById('vp-display-inner').style.display='block';
    const pCol = GS.playerParty==='dem' ? '#60a5fa' : '#f87171';
    const vpBars = v=>`${'█'.repeat(Math.round(v/2))}${'░'.repeat(5-Math.round(v/2))}`;
    document.getElementById('vp-display-inner').innerHTML=`<div style="padding:8px 10px;background:var(--bg3);border:1px solid var(--accent);border-radius:var(--radius)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
        <div style="font-weight:700;font-size:12px;color:var(--accent)">${GS.vp.name}</div>
        <div style="font-size:9px;color:${pCol};font-weight:600">${GS.vp.tag||''}</div>
      </div>
      <div style="font-size:9px;color:var(--text2);margin-bottom:6px">${GS.vp.bonus}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;font-family:var(--font-mono);font-size:8px">
        <div style="color:var(--text3)">⚔ ${vpBars(GS.vp.debateDefense||5)}</div>
        <div style="color:var(--text3)">🛡 ${vpBars((GS.vp.scandalBuffer||2)*2)}</div>
        <div style="color:var(--text3)">⚡ ${vpBars(GS.vp.enthusiasmAmp||5)}</div>
        <div style="color:var(--text3);font-size:7px">DEBATE</div>
        <div style="color:var(--text3);font-size:7px">SCANDAL</div>
        <div style="color:var(--text3);font-size:7px">ENERGY</div>
      </div>
    </div>`;
  }

  // EV tracker — at the start of general, only show "safe" states (lean > 15 pts).
  // As weeks pass, renderEV() reveals more based on how settled the race looks.
  // This mirrors real life: networks don't project 300+ EVs before voting begins.
  GS._evRevealThreshold = 15; // Start: only states with |lead| > 15 pts count

  // Add polling disclaimer to EV display
  const evWrap = document.getElementById('ev-section') || document.getElementById('ev-bar-wrap');
  const existingNote = document.getElementById('ev-polling-note');
  if(!existingNote){
    const note = document.createElement('div');
    note.id = 'ev-polling-note';
    note.style.cssText = 'font-family:var(--font-mono);font-size:8px;color:var(--text3);text-align:center;margin-top:3px;letter-spacing:.05em;opacity:.7';
    note.textContent = '📊 PROJECTED — designated tossup states stay uncalled until they break';
    if(evWrap) evWrap.appendChild(note);
  }

  // Reset EV bar to blank slate so it animates in correctly from renderEV()
  const _evBarDemReset = document.getElementById('ev-bar-dem');
  const _evBarRepReset = document.getElementById('ev-bar-rep');
  const _evBarTssReset = document.getElementById('ev-bar-toss');
  if(_evBarDemReset) _evBarDemReset.style.width = '0%';
  if(_evBarRepReset) _evBarRepReset.style.width = '0%';
  if(_evBarTssReset) _evBarTssReset.style.width = '100%';

  renderAll();
  // Explicitly call renderEV after renderAll to ensure EV bar reflects map on first render
  try { renderEV(); } catch(e) {}
}

// ── ACHIEVEMENTS SYSTEM ──────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'pres_270',      icon:'--',  title:'270 Club',          desc:'Win the presidency.',                                   check:(won,pEV,oEV,pv,gs)=> won },
  { id:'landslide',     icon:'🌊',  title:'Landslide',         desc:'Win 400+ electoral votes.',                             check:(won,pEV)=> won && pEV>=400 },
  { id:'popular_60',    icon:'-',  title:'Unity President',   desc:'Win 60%+ of the popular vote.',                        check:(won,pEV,oEV,pv)=>{ if(!won||!pv) return false; const tot=pv.player+pv.opp; return tot>0&&(pv.player/tot)>=0.60; }},
  { id:'comeback',      icon:'📈',  title:'Comeback Kid',      desc:'Win after trailing in the polls.',                     check:(won,pEV,oEV,pv,gs)=> won && (gs._trailedInPolls===true) },
  { id:'clean_sweep',   icon:'🗺',  title:'Clean Sweep',       desc:'Win all swing states (FL, PA, MI, WI, AZ, NV, NC, GA).', check:(won,pEV,oEV,pv,gs)=>{ if(!won) return false; const swing=['FL','PA','MI','WI','AZ','NV','NC','GA']; return swing.every(code=>{ const s=gs.states.find(x=>x.code===code); return s && s.finalLead>0; }); }},
  { id:'no_money',      icon:'💸',  title:'Grassroots Hero',   desc:'Win spending under $30M total.',                       check:(won,pEV,oEV,pv,gs)=> won && (gs.totalRaised||0)<30 },
  { id:'senate_house',  icon:'--',  title:'Trifecta',          desc:'Win presidency + Senate + House majority.',            check:(won,pEV,oEV,pv,gs)=>{ const cr=gs._congressResult; return won&&cr&&cr.senate.dem>=51&&cr.house.dem>=218&&gs.playerParty==='dem' || won&&cr&&cr.senate.rep>=51&&cr.house.rep>=218&&gs.playerParty==='rep'; }},
  { id:'big_state_dem', icon:'🗽',  title:'Empire Builder',    desc:'Win New York, California, and Texas.',                  check:(won,pEV,oEV,pv,gs)=>{ if(!won) return false; return ['NY','CA','TX'].every(c=>{ const s=gs.states.find(x=>x.code===c); return s&&s.finalLead>0; }); }},
  { id:'incumbent_win', icon:'🔑',  title:'Four More Years',   desc:'Win re-election as incumbent.',                        check:(won,pEV,oEV,pv,gs)=> won && gs._playerWasIncumbent },
  { id:'close_call',    icon:'😅',  title:'Squeaker',          desc:'Win with exactly 270-280 electoral votes.',            check:(won,pEV)=> won && pEV>=270 && pEV<=280 },
  { id:'opposition_win',icon:'🔴',  title:'Hostile Takeover',  desc:'Win as Republican, flipping normally-blue states.',    check:(won,pEV,oEV,pv,gs)=>{ if(!won||gs.playerParty!=='rep') return false; return ['PA','MI','WI','MN','CO'].some(c=>{ const s=gs.states.find(x=>x.code===c); return s&&s.finalLead>0; }); }},
  { id:'hard_win',      icon:'💪',  title:'Iron Candidate',    desc:'Win on Hard difficulty.',                              check:(won,pEV,oEV,pv,gs)=> won && gs.difficulty==='hard' },
];

function _checkAchievementsCore(won, pEV, oEV, popVote){
  if(!GS._unlocked) GS._unlocked = {};
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a=>{
    if(GS._unlocked[a.id]) return; // already earned
    try {
      if(a.check(won, pEV, oEV, popVote, GS)){
        GS._unlocked[a.id] = true;
        newlyUnlocked.push(a);
      }
    } catch(e){}
  });
  return newlyUnlocked;
}

function renderAchievementsPanel(won, pEV, oEV, popVote){
  const newUnlocked = checkAchievements(won, pEV, oEV, popVote);
  const allUnlocked = Object.keys(GS._unlocked||{});
  if(allUnlocked.length === 0 && newUnlocked.length === 0) return '';

  const achievHtml = ACHIEVEMENTS.map(a=>{
    const isNew = newUnlocked.find(x=>x.id===a.id);
    const isEarned = GS._unlocked?.[a.id];
    if(!isEarned) return '';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:${isNew?'rgba(200,168,75,.12)':'rgba(255,255,255,.04)'};border:1px solid ${isNew?'rgba(200,168,75,.4)':'rgba(255,255,255,.08)'};border-radius:7px;transition:all .3s">
      <div style="font-size:20px;flex-shrink:0">${a.icon}</div>
      <div>
        <div style="font-weight:700;font-size:12px;color:${isNew?'#c8a84b':'#e8ecf4'}">${a.title}${isNew?' <span style="font-size:8px;color:#c8a84b;font-family:var(--font-mono);letter-spacing:.1em">NEW!</span>':''}</div>
        <div style="font-size:10px;color:#6b7280">${a.desc}</div>
      </div>
    </div>`;
  }).filter(Boolean).join('');

  if(!achievHtml) return '';

  return `<div style="margin-top:20px;padding:16px 20px;background:rgba(200,168,75,.05);border:1px solid rgba(200,168,75,.2);border-radius:10px;max-width:440px;width:100%">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;color:#c8a84b;text-transform:uppercase;margin-bottom:10px">-- Achievements</div>
    <div style="display:flex;flex-direction:column;gap:6px">${achievHtml}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#4a5568;margin-top:10px;text-align:right">${allUnlocked.length} / ${ACHIEVEMENTS.length} unlocked</div>
  </div>`;
}

function showAchievementToast(achievement){
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:9999;padding:12px 16px;background:#1a1400;border:1px solid #c8a84b;border-radius:10px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:slideInRight .4s ease;max-width:280px';
  toast.innerHTML = `<div style="font-size:24px">${achievement.icon}</div><div><div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#c8a84b;letter-spacing:.1em;margin-bottom:2px">ACHIEVEMENT UNLOCKED</div><div style="font-weight:700;font-size:13px;color:#e8ecf4">${achievement.title}</div><div style="font-size:10px;color:#8a93a8">${achievement.desc}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(()=>{ toast.style.opacity='0'; toast.style.transition='opacity .5s'; setTimeout(()=>toast.remove(), 500); }, 4000);
}

function showEndScreen(won,reason,pEV=0,oEV=0,popVote=null){
  showScreen('end-screen');
  // Clear any previously appended congress result panel
  const oldCr = document.querySelector('#end-screen .end-congress-result');
  if(oldCr) oldCr.remove();
  document.getElementById('end-title').textContent=won?'🇺🇸 Madam / Mr. President':'💔 Defeat';
  document.getElementById('end-title').className=`end-title ${won?'win':'lose'}`;
  document.getElementById('end-message').textContent=
    won?`${GS.playerName} wins the presidency with ${pEV} electoral votes. The American people have spoken.`
    :reason==='convention'?`${GS.playerName} failed to secure the party nomination. A historic run comes to an end.`
    :`${GS.playerName} fought hard but fell short — ${pEV} to ${oEV} electoral votes. The opposition claims the White House.`;
  const popTotal = popVote ? (popVote.player + popVote.opp) : 0;
  const popPct = popTotal > 0 ? (popVote.player/popTotal*100).toFixed(1) : '—';
  const oppPct = popTotal > 0 ? (popVote.opp/popTotal*100).toFixed(1) : '—';
  const popStr = popTotal > 0 ? `${popVote.player.toLocaleString()} (${popPct}%)` : '—';
  const oppPopStr = popTotal > 0 ? `${popVote.opp.toLocaleString()} (${oppPct}%)` : '—';
  const isSim = !!window._SIM;
  const favStr = GS.favorability != null ? GS.favorability.toFixed(0)+'%' : '—';
  const raisedStr = GS.totalRaised != null ? fm(GS.totalRaised) : '—';
  const endStr = GS.endorsements != null ? GS.endorsements : '—';
  const delegStr = GS.playerDelegates != null ? GS.playerDelegates.toLocaleString() : '—';
  document.getElementById('end-stats').innerHTML=`
    <div class="end-stat"><div class="end-stat-label">Electoral Votes</div><div class="end-stat-value" style="color:var(--accent)">${pEV}</div></div>
    <div class="end-stat"><div class="end-stat-label">Opp. EV</div><div class="end-stat-value">${oEV}</div></div>
    <div class="end-stat"><div class="end-stat-label">Your Popular Vote</div><div class="end-stat-value" style="font-size:16px;color:${won?'var(--green)':'var(--rep)'}">${popStr}</div></div>
    <div class="end-stat"><div class="end-stat-label">Opp. Popular Vote</div><div class="end-stat-value" style="font-size:16px">${oppPopStr}</div></div>
    ${!isSim?`<div class="end-stat"><div class="end-stat-label">Favorability</div><div class="end-stat-value">${favStr}</div></div>`:''}
    ${!isSim?`<div class="end-stat"><div class="end-stat-label">Total Raised</div><div class="end-stat-value" style="font-size:18px">${raisedStr}</div></div>`:''}
    ${!isSim?`<div class="end-stat"><div class="end-stat-label">Endorsements</div><div class="end-stat-value">${endStr}</div></div>`:''}
    ${!isSim&&!(typeof _histActive!=='undefined'&&_histActive)?`<div class="end-stat"><div class="end-stat-label">Delegates Won</div><div class="end-stat-value">${delegStr}</div></div>`:''}
    ${isSim?`<div class="end-stat"><div class="end-stat-label">Environment</div><div class="end-stat-value" style="font-size:13px">${(SIM_PRESETS[window._SIM?.envKey]||SIM_PRESETS.neutral).label}</div></div>`:''}
    ${isSim?`<div class="end-stat"><div class="end-stat-label">Dem Strength</div><div class="end-stat-value">${window._SIM?.demStr ?? '—'}</div></div>`:''}
    ${isSim?`<div class="end-stat"><div class="end-stat-label">Rep Strength</div><div class="end-stat-value">${window._SIM?.repStr ?? '—'}</div></div>`:''}
    `;
  // Add congress results below if available
  const cr = GS._congressResult;
  if(cr){
    const sDem=cr.senate.dem, sRep=cr.senate.rep;
    const hDem=cr.house.dem,  hRep=cr.house.rep;
    const senCtrl = sDem>=51?'Dem':'Rep';
    const hseCtrl = hDem>=218?'Dem':'Rep';
    const senColor = sDem>=51?'#3b82f6':'#ef4444';
    const hseColor = hDem>=218?'#3b82f6':'#ef4444';
    const unified = senCtrl===hseCtrl;
    const govType = unified ? (senCtrl==='Dem'?'Unified Democratic Government':'Unified Republican Government') : 'Divided Government';
    const govColor = unified?(senCtrl==='Dem'?'#3b82f6':'#ef4444'):'#c8a84b';
    const congressEl = document.createElement('div');
    congressEl.className='end-congress-result';
    congressEl.style.cssText='margin-top:20px;padding:16px 20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:10px;max-width:440px;width:100%';
    congressEl.innerHTML=`
      <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.2em;color:#6b7280;text-transform:uppercase;margin-bottom:10px">Congressional Results</div>
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
        <div style="text-align:center">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#6b7280;letter-spacing:.15em;margin-bottom:4px">SENATE (100 seats)</div>
          <div style="display:flex;gap:10px;align-items:center;justify-content:center">
            <div style="text-align:right"><div style="font-size:22px;font-weight:900;color:#3b82f6;font-family:'Playfair Display',serif">${sDem}</div><div style="font-size:9px;color:#3b82f6;font-family:'IBM Plex Mono',monospace">DEM</div></div>
            <div style="font-size:11px;color:#4a5568;font-family:'IBM Plex Mono',monospace">–</div>
            <div style="text-align:left"><div style="font-size:22px;font-weight:900;color:#ef4444;font-family:'Playfair Display',serif">${sRep}</div><div style="font-size:9px;color:#ef4444;font-family:'IBM Plex Mono',monospace">REP</div></div>
          </div>
          <div style="font-size:11px;font-weight:700;color:${senColor};font-family:'IBM Plex Mono',monospace;margin-top:4px">${senCtrl==='Dem'?'🔵 DEM MAJORITY':'🔴 REP MAJORITY'}</div>
        </div>
        <div style="width:1px;background:rgba(255,255,255,.08)"></div>
        <div style="text-align:center">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:#6b7280;letter-spacing:.15em;margin-bottom:4px">HOUSE (435 seats)</div>
          <div style="display:flex;gap:10px;align-items:center;justify-content:center">
            <div style="text-align:right"><div style="font-size:22px;font-weight:900;color:#3b82f6;font-family:'Playfair Display',serif">${hDem}</div><div style="font-size:9px;color:#3b82f6;font-family:'IBM Plex Mono',monospace">DEM</div></div>
            <div style="font-size:11px;color:#4a5568;font-family:'IBM Plex Mono',monospace">–</div>
            <div style="text-align:left"><div style="font-size:22px;font-weight:900;color:#ef4444;font-family:'Playfair Display',serif">${hRep}</div><div style="font-size:9px;color:#ef4444;font-family:'IBM Plex Mono',monospace">REP</div></div>
          </div>
          <div style="font-size:11px;font-weight:700;color:${hseColor};font-family:'IBM Plex Mono',monospace;margin-top:4px">${hseCtrl==='Dem'?'🔵 DEM MAJORITY':'🔴 REP MAJORITY'}</div>
        </div>
      </div>
      <div style="text-align:center;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:${govColor};letter-spacing:.08em;padding-top:8px;border-top:1px solid rgba(255,255,255,.07)">${govType}</div>`;
    document.getElementById('end-screen').appendChild(congressEl);
  }

  // ── ACHIEVEMENTS ──
  // renderAchievementsPanel internally calls checkAchievements (which marks + saves).
  // Capture the newly-unlocked list from it so toasts fire correctly without a second check.
  const _newlyForToasts = [];
  const _origCore = _checkAchievementsCore;
  // Temporarily wrap core to capture newly unlocked during renderAchievementsPanel call
  window._checkAchievementsCore = function(w,p,o,pv){
    const r = _origCore(w,p,o,pv);
    _newlyForToasts.push(...r);
    return r;
  };
  const achievHtml = renderAchievementsPanel(won, pEV, oEV, popVote);
  window._checkAchievementsCore = _origCore; // restore
  if(achievHtml){
    const achievEl = document.createElement('div');
    achievEl.className = 'end-achievements-wrap';
    achievEl.innerHTML = achievHtml;
    document.getElementById('end-screen').appendChild(achievEl);
  }
  // Show toast popups for newly unlocked achievements
  _newlyForToasts.forEach((a, i) => setTimeout(() => showAchievementToast(a), 800 + i * 1200));
}

// ── RENDER LOOP ──
function renderSituationRoom(){
  const el = document.getElementById('situation-room');
  if(!el) return;
  // Only show in general phase (or late primary)
  const show = GS.phase==='primary' && GS.week >= 8; // Hidden in general election
  el.style.display = show ? 'block' : 'none';
  if(!show) return;

  const inner = document.getElementById('situation-room-inner');
  if(!inner) return;

  const sections = [];

  // ── NATIONAL MOOD CARD ──
  if(GS.nationalMood && NATIONAL_MOODS){
    const m = NATIONAL_MOODS[GS.nationalMood];
    if(m){
      const mCol = GS.nationalMood==='angry'?'#ef4444':GS.nationalMood==='change'?'#60a5fa':GS.nationalMood==='prosperity'?'#22c55e':GS.nationalMood==='fatigued'?'#a78bfa':'#c8a84b';
      sections.push(`<div style="padding:8px 10px;background:${mCol}0f;border:1px solid ${mCol}33;border-radius:6px;margin-bottom:6px">
        <div style="font-size:9px;font-family:var(--font-mono);color:${mCol};letter-spacing:.1em;margin-bottom:4px">NATIONAL MOOD</div>
        <div style="font-size:12px;font-weight:700;color:#e8ecf4">${m.icon} ${m.name}</div>
        <div style="font-size:10px;color:var(--text2);margin-top:2px;line-height:1.4">${m.desc}</div>
      </div>`);
    }
  }

  // ── MOMENTUM STATUS ──
  const mom = GS.momentum || 0;
  const momColor = mom>5?'#22c55e':mom>0?'#c8a84b':mom>-5?'#fb923c':'#ef4444';
  const momLabel = mom>8?'🔥 Hot Streak':mom>3?'📈 Momentum Rising':mom>0?'➡- Steady':mom>-3?'📉 Cooling':mom>-8?'--- Cold Spell':'💀 Freefall';
  const momTip = mom>5?'Keep it going — now is the time for big plays':mom>0?'Maintain with speeches or rallies in swing states':mom<-5?'Emergency: Crisis Response or Strategic Reset urgently needed':'Use a Policy Address or Coalition Building to stop the slide';
  sections.push(`<div style="padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:9px;font-family:var(--font-mono);color:var(--text3);letter-spacing:.1em">MOMENTUM</div>
      <div style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${momColor}">${mom.toFixed(1)} ${momLabel}</div>
    </div>
    <div style="font-size:10px;color:var(--text2);margin-top:4px;line-height:1.4">⚡ ${momTip}</div>
  </div>`);

  if(GS.phase === 'general'){
    // Update congress tracker
    if(GS._congressInitialized) updateCongressTracker();
    // ── ELECTORAL MAP SNAPSHOT ──
    // Use canonical getEV() so sidebar always matches the main counter
    const { pEV, oEV, tossEV: tossupTotal } = getEV();
    const evColor = pEV>=270?'#22c55e':pEV>=240?'#c8a84b':'#ef4444';
    sections.push(`<div style="padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
      <div style="font-size:9px;font-family:var(--font-mono);color:var(--text3);letter-spacing:.1em;margin-bottom:6px">ELECTORAL MAP</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
        <div style="font-family:var(--font-mono);font-size:26px;font-weight:800;color:${evColor}">${pEV}</div>
        <div style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">vs</div>
        <div style="font-family:var(--font-mono);font-size:26px;font-weight:800;color:#8a93a8">${oEV}</div>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);margin-left:auto">/ 538</div>
      </div>
      ${tossupTotal>0?`<div style="font-size:9px;color:#a78bfa;font-family:var(--font-mono);margin-bottom:3px">⚖ ${tossupTotal} EV in tossup range — not yet projected</div>`:''}
      <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono)">${pEV>=270?'✅ ABOVE 270 — Projected to win':'⚠- BELOW 270 — Need to flip '+Math.max(0,270-pEV)+' more EV'}</div>
    </div>`);

    // ── FLIP OPPORTUNITIES ──
    const flips = GS.states.filter(s=>s.genLead<0&&s.genLead>-8).sort((a,b)=>b.ev-a.ev).slice(0,3);
    if(flips.length>0){
      sections.push(`<div style="padding:8px 10px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.25);border-radius:6px;margin-bottom:6px">
        <div style="font-size:9px;font-family:var(--font-mono);color:#22c55e;letter-spacing:.1em;margin-bottom:5px">🎯 FLIP TARGETS</div>
        ${flips.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;color:#e8ecf4;font-weight:600">${s.name}</span>
          <span style="font-family:var(--font-mono);font-size:10px">
            <span style="color:#fb923c">${s.genLead.toFixed(1)}%</span>
            <span style="color:var(--text3);margin-left:4px">${s.ev}EV</span>
          </span>
        </div>`).join('')}
      </div>`);
    }

    // ── STATES AT RISK ──
    const atRisk = GS.states.filter(s=>s.genLead>0&&s.genLead<5&&s.ev>=10).sort((a,b)=>a.genLead-b.genLead).slice(0,3);
    if(atRisk.length>0){
      sections.push(`<div style="padding:8px 10px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);border-radius:6px;margin-bottom:6px">
        <div style="font-size:9px;font-family:var(--font-mono);color:#ef4444;letter-spacing:.1em;margin-bottom:5px">🔴 NARROW LEADS AT RISK</div>
        ${atRisk.map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:11px;color:#e8ecf4;font-weight:600">${s.name}</span>
          <span style="font-family:var(--font-mono);font-size:10px">
            <span style="color:#22c55e">+${s.genLead.toFixed(1)}%</span>
            <span style="color:var(--text3);margin-left:4px">${s.ev}EV</span>
          </span>
        </div>`).join('')}
      </div>`);
    }

    // ── DEBATE WARNING ──
    if(GENERAL_DEBATE_WEEKS){
      const nextDebate = GENERAL_DEBATE_WEEKS.find(w=>w>=GS.week);
      if(nextDebate && nextDebate-GS.week<=3){
        const urgency = nextDebate===GS.week ? 'THIS WEEK' : nextDebate-GS.week===1 ? 'NEXT WEEK' : `IN ${nextDebate-GS.week} WEEKS`;
        const elec = GS.electability||50;
        const elecColor = elec>=60?'#22c55e':elec>=45?'#c8a84b':'#ef4444';
        sections.push(`<div style="padding:8px 10px;background:rgba(167,139,250,.08);border:1px solid rgba(167,139,250,.35);border-radius:6px;margin-bottom:6px">
          <div style="font-size:9px;font-family:var(--font-mono);color:#a78bfa;letter-spacing:.1em;margin-bottom:4px">🎤 DEBATE — ${urgency}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-size:10px;color:var(--text2)">Electability score</div>
            <div style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${elecColor}">${elec.toFixed(0)}</div>
          </div>
          <div style="font-size:10px;color:var(--text2);margin-top:3px">${elec<50?'⚠- Do Debate Prep before this debate or risk losing ground.':elec<65?'Good shape — consider one more Debate Prep to ensure a win.':'💪 Well prepared. Play aggressive.'}</div>
        </div>`);
      }
    }

    // ── FACTION ALERTS ──
    if(GS._blocs){
      const alerts = Object.entries(GS._blocs).filter(([k,v])=>v<32);
      if(alerts.length>0){
        const blocNames = {wc:'Working Class',ce:'College-Edu',sw:'Suburban ♀',yv:'Young Voters',up:'Urban Prog',rc:'Rural Cons',se:'Seniors',in:'Independents'};
        sections.push(`<div style="padding:8px 10px;background:rgba(251,146,60,.06);border:1px solid rgba(251,146,60,.3);border-radius:6px;margin-bottom:6px">
          <div style="font-size:9px;font-family:var(--font-mono);color:#fb923c;letter-spacing:.1em;margin-bottom:5px">⚠- BASE EROSION</div>
          ${alerts.map(([k,v])=>`<div style="font-size:10px;color:#c8d0e0;margin-bottom:2px">
            ${blocNames[k]||k}: <span style="color:#ef4444;font-family:var(--font-mono)">${v.toFixed(0)}%</span> — risk of stay-home voters
          </div>`).join('')}
        </div>`);
      }
    }
  }

  // ── PRIMARY: DELEGATE MATH ──
  if(GS.phase === 'primary'){
    const needed = Math.ceil(GS.totalDelegates * 0.5);
    const pct = GS.totalDelegates>0 ? (GS.delegates/GS.totalDelegates*100).toFixed(1) : '0';
    const pctColor = GS.delegates>=needed?'#22c55e':GS.delegates>=needed*.75?'#c8a84b':'#fb923c';
    sections.push(`<div style="padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
      <div style="font-size:9px;font-family:var(--font-mono);color:var(--text3);letter-spacing:.1em;margin-bottom:4px">DELEGATE MATH</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:${pctColor}">${GS.delegates||0}</div>
        <div style="flex:1;height:6px;background:#1e2535;border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${pctColor};transition:width .4s;border-radius:3px"></div>
        </div>
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">${needed} needed</div>
      </div>
      <div style="font-size:9px;color:var(--text3);font-family:var(--font-mono);margin-top:3px">${GS.delegates>=needed?'✅ ON PATH to nomination':'⚠- Need '+(needed-GS.delegates)+' more delegates'}</div>
    </div>`);
  }

  if(sections.length === 0){
    inner.innerHTML = '<div style="font-size:10px;color:var(--text3);padding:4px 0">No intel available yet. Check back as the race develops.</div>';
  } else {
    inner.innerHTML = sections.join('');
  }
}

function renderAll(){
  renderFactions();
  renderTopBar();renderCandStats();renderMaps();renderPolls();
  renderDelegates();renderAI();renderNews();renderDemos();renderFinance();
  renderDebateAlert();renderAdvisor();renderBlocs();renderCenterBlocs();
  renderSituationRoom();
  try{
    renderCompass();
  }catch(err){
    console.warn('renderCompass failed', err);
    const econEl = document.getElementById('compass-econ-text');
    const socEl  = document.getElementById('compass-social-text');
    if(econEl) econEl.textContent = 'Unavailable';
    if(socEl) socEl.textContent = 'Unavailable';
  }
  renderActionTabs();
  if(GS.phase==='general'){
    try{
      renderEV();
    }catch(err){
      console.warn('renderEV failed', err);
    }
  }
  else renderWinProbability(0,0); // show primary odds in prob meter
}

function renderCenterBlocs(){
  const el=document.getElementById('center-blocs-section');
  const grid=document.getElementById('center-blocs-grid');
  if(!el||!grid) return;
  // Only show during general phase
  if(GS.phase!=='general'){el.style.display='none';return;}
  el.style.display='block';
  const isDem=GS.playerParty==='dem';
  grid.innerHTML=Object.entries(GS_BLOCS).map(([key,b])=>{
    const playerSup = isDem ? b.support : -b.support;
    const barPct=Math.round(cl(50+playerSup*.6,5,95));
    const col=playerSup>5?'var(--dem)':playerSup<-5?'var(--rep)':'#6d28d9';
    const arrow=playerSup>5?'▲':playerSup<-5?'▼':'≈';
    const arrowCol=playerSup>5?'#60a5fa':playerSup<-5?'#f87171':'#8a93a8';
    return`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:7px 9px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:10px;color:var(--text2)">${b.icon} ${b.name}</span>
        <span style="font-family:var(--font-mono);font-size:10px;color:${arrowCol}">${arrow} ${playerSup>0?'+':''}${playerSup.toFixed(0)}</span>
      </div>
      <div style="height:3px;background:var(--bg2);border-radius:2px;overflow:hidden">
        <div style="width:${barPct}%;height:100%;background:${col};border-radius:2px;transition:width .4s"></div>
      </div>
    </div>`;
  }).join('');
}

function renderAdvisor(){
  const el=document.getElementById('advisor-panel');
  if(!el)return;
  const tips=[];
  if(GS.phase==='primary'){
    if(GS.funds<5) tips.push({icon:'💸',col:'#ef4444',msg:'Critical cash shortage — fundraise immediately.'});
    if(GS.electability<40) tips.push({icon:'🎤',col:'#fb923c',msg:'Debate readiness is weak. Do Debate Prep before debate weeks.'});
    if(GS.momentum<-3) tips.push({icon:'📉',col:'#ef4444',msg:'Negative spiral. A Policy Address can reset the narrative.'});
    if(GS.groundGame<35) tips.push({icon:'🌿',col:'#fb923c',msg:'Ground game lagging. Rally or canvass to build support networks.'});
    const topAI=GS.aiCandidates.filter(a=>a.active).sort((a,b)=>b.approval-a.approval)[0];
    if(topAI&&topAI.approval>GS.favorability+5) tips.push({icon:'⚠-',col:'#f59e0b',msg:topAI.name+' leads you nationally. Attack or invade their stronghold states.'});
    const wLeft=GS.primaryWeeks-GS.week;
    if(wLeft>=0&&wLeft<=4) tips.push({icon:'-',col:'#c8a84b',msg:'Primary ends in '+wLeft+' weeks. Every delegate matters now.'});
    if(tips.length===0) tips.push({icon:'✅',col:'#22c55e',msg:'Campaign on track. Maintain momentum and build your war chest.'});
  } else {
    const swings=GS.states.filter(s=>Math.abs(s.lean)<=5);
    const losing=swings.filter(s=>s.genLead<0);
    const winning=swings.filter(s=>s.genLead>=0);
    if(GS.funds<8) tips.push({icon:'💸',col:'#ef4444',msg:'Funds critical. Fundraise now — you need ad buys in swing states.'});
    if(losing.length>0) tips.push({icon:'🎯',col:'#ef4444',msg:'Trailing in: '+losing.map(s=>s.code).join(', ')+'. Must campaign here urgently.'});
    if(winning.length>0&&losing.length===0) tips.push({icon:'🛡-',col:'#22c55e',msg:'Leading all swings: '+winning.map(s=>s.code).join(', ')+'. Protect with ground game.'});
    const _genOpps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
    const _strongOpp = _genOpps.find(o=>o.approval>52);
    if(_strongOpp) tips.push({icon:'📺',col:'#fb923c',msg:_strongOpp.name.split(' ').pop()+' polling above 52%. Launch opposition research to define them negatively.'});
    const { pEV: tipsPEV, tossEV: tipsTossEV } = getEV();
    if(tipsPEV<250) tips.push({icon:'⚡',col:'#a78bfa',msg:'Projected '+tipsPEV+' EV — below 270. Flip at least one more battleground. ('+tipsTossEV+' EV still in tossup range)'});
    else tips.push({icon:'🗳-',col:'#22c55e',msg:'Projected '+tipsPEV+' EV — above 270. Protect your leads and lock battlegrounds.'});
    if(tips.length===0) tips.push({icon:'📊',col:'#22c55e',msg:'Race is tight but manageable. Keep surging in the battlegrounds.'});
  }
  el.innerHTML=tips.slice(0,2).map(t=>'<div style="display:flex;gap:8px;align-items:flex-start;padding:8px;border-left:2px solid '+t.col+';border-radius:0 4px 4px 0;font-size:11px;line-height:1.5;color:#c8d0e0;margin-bottom:2px"><span style="flex-shrink:0;font-size:13px">'+t.icon+'</span><span>'+t.msg+'</span></div>').join('');
}

function renderSparkline(){
  const canvas = document.getElementById('fav-sparkline');
  if(!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const data = GS.favHistory;
  if(data.length < 2) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const mn=Math.min(...data)-3, mx=Math.max(...data)+3;
  const scx = w/(data.length-1), scy = h/(mx-mn);
  ctx.beginPath();
  data.forEach((v,i)=>{
    const x=i*scx, y=h-(v-mn)*scy;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.strokeStyle='#c8a84b';ctx.lineWidth=1.5;ctx.stroke();
  // Fill under
  ctx.lineTo((data.length-1)*scx,h);ctx.lineTo(0,h);ctx.closePath();
  ctx.fillStyle='rgba(200,168,75,.12)';ctx.fill();
  // Current value dot
  const lx=(data.length-1)*scx, ly=h-(data[data.length-1]-mn)*scy;
  ctx.beginPath();ctx.arc(lx,ly,3,0,Math.PI*2);ctx.fillStyle='#c8a84b';ctx.fill();
}

function renderTopBar(){
  document.getElementById('stat-week').textContent=GS.week;
  // Show weeks remaining in the current phase
  const weeksLeftEl = document.getElementById('stat-weeks-left');
  const weeksLeftStat = document.getElementById('weeks-left-stat');
  if(weeksLeftEl && weeksLeftStat){
    const phaseTotal = GS.phase==='primary' ? GS.primaryWeeks : GS.generalWeeks;
    const phaseWeek = GS.phase==='primary' ? GS.week : GS.week - GS.primaryWeeks;
    const wLeft = Math.max(0, phaseTotal - phaseWeek + 1);
    weeksLeftEl.textContent = wLeft;
    weeksLeftEl.className = 'value' + (wLeft<=3?' weeks-critical':wLeft<=6?' weeks-urgent':'');
    weeksLeftStat.style.display = '';
  }
  const fundsEl=document.getElementById('stat-funds');
  fundsEl.textContent=fm(GS.funds);
  fundsEl.style.color=GS.funds<3?'var(--rep)':GS.funds<8?'#fb923c':'var(--accent)';
  const mom=GS.momentum;
  const mEl=document.getElementById('stat-momentum');
  mEl.textContent=(mom>=0?'▲ +':'▼ ')+Math.abs(mom).toFixed(1);
  mEl.style.color=mom>5?'#22c55e':mom>2?'#86efac':mom<-5?'#ef4444':mom<-2?'#fca5a5':'var(--text2)';
  mEl.style.fontWeight=Math.abs(mom)>3?'700':'400';
  const trend = GS.favHistory.length>=2 ? GS.favorability - GS.favHistory[GS.favHistory.length-2] : 0;
  const trendArrow = trend > 0.5 ? ' ↑' : trend < -0.5 ? ' ↓' : '';
  const approvalEl = document.getElementById('stat-approval');
  approvalEl.textContent = GS.favorability.toFixed(0)+'%'+trendArrow;
  approvalEl.style.color = trend > 0.5 ? '#22c55e' : trend < -0.5 ? '#ef4444' : '';
  if(GS.phase==='primary')document.getElementById('stat-delegates').textContent=GS.playerDelegates.toLocaleString();
  // Streak
  const streakWrap = document.getElementById('stat-streak-wrap');
  const streakEl = document.getElementById('stat-streak');
  if(streakWrap && GS._actionStreak !== undefined){
    streakWrap.style.display = GS._actionStreak > 0 ? '' : 'none';
    if(GS._actionStreak > 0){
      const s = GS._actionStreak;
      streakEl.textContent = (s>=5?'🔥':'⚡')+s;
      streakEl.style.color = s>=5?'#fb923c':s>=3?'var(--accent)':'var(--text2)';
    }
  }
}

function renderCandStats(){
  const sb=(id,fi,v)=>{document.getElementById(id).textContent=Math.round(v)+'%';document.getElementById(fi).style.width=cl(v,0,100)+'%'};
  sb('bar-fav','fill-fav',GS.favorability);sb('bar-elec','fill-elec',GS.electability);sb('bar-ground','fill-ground',GS.groundGame);sb('bar-media','fill-media',GS.mediaCoverage);
}

function renderMaps(){
  // Pre-calculate max margin across all primary states for normalisation
  const allMargins = GS.states.map(s=>s._primaryMargin||0);
  const maxMargin = Math.max(...allMargins, 1);

  GS.states.forEach(s=>{
    const pp=document.getElementById(`p-path-${s.code}`);
    const gp=document.getElementById(`g-path-${s.code}`);
    const targeted=GS.targetedStates.has(s.code);
    if(pp){
      pp.setAttribute('class',`state-path${targeted?' targeted':''}`);
      pp.style.fill=primFillColor(s.code);
      // Opacity: always lead-based — never override with flat 1 (that was the color-override bug)
      const margin = s._primaryMargin || 0;
      const normMargin = Math.min(margin / Math.max(maxMargin * 0.6, 12), 1);
      const op = cl(0.28 + normMargin * 0.67, 0.28, 0.95);
      pp.style.opacity=String(op);
      pp.style.stroke=targeted?'#c8a84b':'#0d1117';
      pp.style.strokeWidth=targeted?'2.5':'0.6';
    }
    if(gp){
      gp.setAttribute('class',`state-path${targeted?' targeted':''}`);
      gp.style.fill=genMapColor(s.genLead,GS.playerParty,(s.lean||0)+(s.leanMod||0),s.code);
      gp.style.opacity=targeted?'1':'0.9';
      gp.style.stroke=targeted?'#c8a84b':'#0d1117';
      gp.style.strokeWidth=targeted?'2':'0.6';
    }
  });
}

function renderDebateAlert(){
  const el=document.getElementById('debate-alert');
  const isDebate=
    (GS.phase==='primary'&&PRIMARY_DEBATE_WEEKS.includes(GS.week))||
    (GS.phase==='general'&&GENERAL_DEBATE_WEEKS.includes(GS.week));
  if(isDebate){
    el.style.display='block';
    el.innerHTML=`<span class="debate-dot"></span><b>Debate Night!</b> Electability (${GS.electability.toFixed(0)}%) determines your performance. Consider Debate Prep before ending the week.`;
  } else {
    el.style.display='none';
  }
}

function renderPolls(){
  const c=document.getElementById('national-polls');
  if(GS.phase==='primary'){
    const active=GS.aiCandidates.filter(a=>a.active);
    const all=[{name:GS.playerName,approval:GS.favorability,color:'var(--accent)'},...active.map(a=>({name:a.name.split(' ').slice(-1)[0],approval:a.approval,color:a.color}))];
    const tot=all.reduce((s,a)=>s+Math.max(a.approval,0),1);
    c.innerHTML=all.map(a=>{const p=Math.max(a.approval,0)/tot*100;return`<div class="poll-row"><div class="poll-name">${a.name.split(' ').slice(-1)[0]}</div><div class="poll-bar-bg"><div style="width:${p.toFixed(1)}%;height:100%;background:${a.color};display:flex;align-items:center;justify-content:center;transition:width .4s"><span class="poll-fill-label">${p.toFixed(0)}%</span></div></div></div>`}).join('');
  } else {
    const pCol = GS.playerParty==='dem'?'var(--dem)':GS.playerParty==='rep'?'var(--rep)':(GS.playerPartyColor||'#a855f7');
    const rawOpps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
    const opps = (rawOpps||[]).filter(o=>o && typeof o === 'object');

    // Build national poll with player + all opponents
    const baseP = GS.favorability + GS.momentum*0.4;
    // Gather raw approval numbers for all candidates
    const candList = [
      { name: GS.playerName, approval: baseP, color: pCol, isPlayer: true },
      ...opps.map(o=>({
        name: o.name || 'Opponent',
        approval: o.approval || 44,
        color: o.color || (o.party==='dem'?'var(--dem)':o.party==='rep'?'var(--rep)':'#a855f7'),
        isPlayer: false,
        party: o.party,
      }))
    ];
    const totalApproval = candList.reduce((s,c)=>s+Math.max(c.approval,1),0);
    // Clamp player to realistic 3-way range if ind
    const isInd = GS.playerParty==='ind';
    const pRaw = baseP/totalApproval*100;
    const pPct = isInd ? cl(pRaw,5,60) : cl(pRaw,35,65);

    // Redistribute remainder to opponents proportionally
    const oppTotal = candList.slice(1).reduce((s,c)=>s+Math.max(c.approval,1),0);
    let pollHTML = '';
    let usedPct = pPct;
    candList.forEach((cand,i)=>{
      let pct;
      if(i===0){
        pct = pPct;
      } else if(i===candList.length-1){
        pct = Math.max(5, 100-usedPct);
      } else {
        pct = cl((cand.approval/Math.max(oppTotal,1))*(100-pPct), 5, 85);
        usedPct += pct;
      }
      const lastName = cand.name.split(' ').pop();
      const label = cand.isPlayer ? lastName : `${lastName}${cand.party?` (${cand.party.charAt(0).toUpperCase()})`:' (I)'}`;
      pollHTML += `<div class="poll-row"><div class="poll-name">${label}</div><div class="poll-bar-bg"><div style="width:${pct.toFixed(1)}%;height:100%;background:${cand.color};display:flex;align-items:center;justify-content:center;transition:width .4s"><span class="poll-fill-label">${pct.toFixed(0)}%</span></div></div></div>`;
    });
    c.innerHTML = pollHTML;

    // Battleground state bars — for ind show player lead with custom colour
    const bg = getSwingStates().slice(0,8);
    document.getElementById('battleground-polls').innerHTML = bg.map(s=>{
      const pp = cl(50+s.genLead*.8,18,82), op = 100-pp;
      const moe = (s.vol*4.5).toFixed(0);
      const isTossup = isDesignatedTossupState(s);
      const oppWeightTotal = Math.max(opps.reduce((sum,o)=>sum+Math.max(o.approval||0,1),0),1);
      const oppSegments = opps.length<=1
        ? [{ pct: op, color: (opps[0]?.color || (opps[0]?.party==='dem'?'var(--dem)':'var(--rep)') || '#4a5568') }]
        : opps.map((o,idx)=>{
            const weight = Math.max(o.approval||0,1);
            const pct = idx===opps.length-1
              ? Math.max(0, op-opps.slice(0,idx).reduce((sum,p)=>sum + (Math.max(p.approval||0,1)/oppWeightTotal)*op, 0))
              : cl((weight/oppWeightTotal)*op,0,100);
            return { pct, color: o.color || (o.party==='dem'?'var(--dem)':'var(--rep)') || '#4a5568' };
          });
      const marginLabel = isTossup
        ? `<span style="color:#a78bfa;font-size:9px;font-family:var(--font-mono)">-${moe} TOSS-UP</span>`
        : `<span style="color:${s.genLead>0?'var(--green)':'var(--rep)'};font-size:10px;font-family:var(--font-mono)">${s.genLead>0?'+':''}${s.genLead.toFixed(0)} -${moe}</span>`;
      return `<div class="poll-row"><div class="poll-name">${s.code}</div><div class="poll-bar-bg"><div style="width:${pp}%;height:100%;background:${pCol};display:flex;align-items:center;justify-content:center;transition:width .4s"><span class="poll-fill-label">${pp.toFixed(0)}%</span></div>${oppSegments.map((seg,idx)=>`<div style="width:${seg.pct}%;height:100%;background:${seg.color};display:flex;align-items:center;justify-content:center">${idx===oppSegments.length-1?`<span class="poll-fill-label">${op.toFixed(0)}%</span>`:''}</div>`).join('')}</div>${marginLabel}</div>`;
    }).join('');
  }
  // Favorability sparkline — shows last 8 weeks of trend
  renderFavSparkline();
}

function renderFavSparkline(){
  const el = document.getElementById('fav-sparkline');
  if(!el || !GS.favHistory || GS.favHistory.length < 2) return;
  const hist = GS.favHistory.slice(-10);
  const W=200, H=36, pad=4;
  const mn=Math.min(...hist)-3, mx=Math.max(...hist)+3;
  const xS=(i)=>pad + i*(W-pad*2)/(hist.length-1);
  const yS=(v)=>H-pad - (v-mn)/(mx-mn)*(H-pad*2);
  const pts=hist.map((v,i)=>`${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(' ');
  const first=hist[0], last=hist[hist.length-1];
  const trend=last-first;
  const trendColor=trend>0?'#22c55e':trend<0?'#ef4444':'#94a3b8';
  const trendArrow=trend>1?'↑':trend<-1?'↓':'→';
  el.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-family:var(--font-mono);font-size:9px;color:var(--text3)">FAVORABILITY TREND</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:${trendColor}">${trendArrow} ${trend>=0?'+':''}${trend.toFixed(1)}% (${hist.length}w)</span>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:36px;overflow:visible">
      <polyline points="${pts}" fill="none" stroke="${trendColor}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
      <circle cx="${xS(hist.length-1)}" cy="${yS(last)}" r="2.5" fill="${trendColor}"/>
      <text x="${xS(hist.length-1)+4}" y="${yS(last)+1}" font-size="7" fill="${trendColor}" font-family="IBM Plex Mono,monospace" dominant-baseline="middle">${last.toFixed(0)}%</text>
    </svg>`;
}

function renderDelegates(){
  if(GS.phase!=='primary')return;
  const needed = document.getElementById('delegates-needed');
  if(needed) needed.textContent=GS.delegatesNeeded.toLocaleString();
  const all=[
    {name:GS.playerName, delegates:GS.playerDelegates, color:'#c8a84b', active:true},
    ...GS.aiCandidates.map(a=>({name:a.name,delegates:a.delegates,color:a.color,active:a.active}))
  ];
  const tot = Math.max(all.reduce((s,c)=>s+c.delegates,0), GS.delegatesNeeded);
  const bar = document.getElementById('delegate-bar');
  if(bar){
    // Always show bar — even at 0 delegates, show equal placeholder stripes
    if(tot <= GS.delegatesNeeded && all.every(c=>c.delegates===0)){
      // Game start: equal grey segments
      bar.innerHTML=all.map(c=>`<div style="width:${(1/all.length*100).toFixed(1)}%;background:${c.color};height:100%;opacity:0.3;transition:width .5s"></div>`).join('');
    } else {
      bar.innerHTML=all.map(c=>`<div style="width:${(c.delegates/tot*100).toFixed(1)}%;background:${c.color};height:100%;transition:width .5s"></div>`).join('');
    }
    // Threshold line at 1991 delegates
    bar.style.position='relative';
  }
  const cands = document.getElementById('delegate-candidates');
  if(cands){
    cands.innerHTML=all.map(c=>`<div class="delegate-row">
      <div class="delegate-name" style="color:${c.active===false?'var(--text3)':'var(--text)'}">${c.active===false?'🚫 ':''}${c.name}</div>
      <div class="delegate-count" style="color:${c.color}">${c.delegates.toLocaleString()}</div>
    </div>`).join('');
  }
}

function renderAI(){
  document.getElementById('ai-candidates-list').innerHTML=GS.aiCandidates.map(ai=>{
    const arch=ARCHETYPES[ai.archetype];
    const scanRisk=(ai._scandalRisk||0);
    const scanWarn=scanRisk>7?`<span style="font-size:8px;color:#f87171;font-family:var(--font-mono);margin-left:4px">⚠ volatile</span>`:'';
    const archBadge=arch?`<div style="font-size:8px;font-family:var(--font-mono);color:var(--text3);margin-bottom:2px">${arch.icon} ${arch.label}${scanWarn}</div>`:'';
    const portrait = ai._photoFile
      ? renderCandidatePhoto(ai._photoFile, 34)
      : (ai._portrait ? renderPortraitSVG(ai._portrait, 34) : '');

    // General election action log (last 3 entries)
    let actionLogHtml = '';
    if(GS.phase === 'general' && ai._actionLog && ai._actionLog.length > 0){
      const recentLogs = ai._actionLog.slice(-3).reverse();
      actionLogHtml = `<div style="margin-top:5px;border-top:1px solid var(--border);padding-top:5px">
        <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3);letter-spacing:.1em;margin-bottom:3px">RECENT ACTIONS</div>
        ${recentLogs.map(l=>`<div class="ai-action-log">${l.icon} Wk${l.wk}: ${l.text}</div>`).join('')}
      </div>`;
    } else if(GS.phase === 'general' && ai._lastAction){
      actionLogHtml = `<div class="ai-action-log" style="margin-top:4px">${ai._lastAction}</div>`;
    }

    // Funds display
    const fundsDisplay = GS.phase === 'general'
      ? `<span style="color:var(--accent)">${fm(ai.funds || 0)}</span>`
      : fm(ai.funds);

    // ── No direct call button — delegate negotiations only happen when a candidate drops out ──

    return`<div class="ai-card ${ai.active?'':'eliminated'}">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
        ${portrait?`<div class="ai-portrait-wrap">${portrait}</div>`:''}
        <div style="flex:1;min-width:0">
          <div class="ai-card-header"><div class="ai-name" style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ai.name}</div><div class="ai-status ${ai.active?'active':'dropped'}">${ai.active?'Active':'Dropped'}</div></div>
          ${archBadge}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text2);margin-bottom:2px"><span>${ai.approval.toFixed(0)}%</span>${fundsDisplay}</div>
      <div class="ai-poll-bar"><div class="ai-poll-fill" style="width:${cl(ai.approval,0,80)}%;background:${ai.color||'#60a5fa'}"></div></div>
      ${GS.phase==='primary'?`<div style="font-family:var(--font-mono);font-size:10px;color:${ai.color||'#60a5fa'};margin-top:3px">${ai.delegates.toLocaleString()} delegates</div>`:''}
      ${!ai.active?'<div class="endorsement-badge">✓ Campaign Suspended</div>':''}
      ${actionLogHtml}
    </div>`;
  }).join('');
}


function renderNews(){
  const items=GS.newsItems.slice(-14).reverse();
  const party = GS.playerParty || 'dem';
  const FRAME_LABELS=[
    {label: party==='dem'?'PROGRESSIVE':'CONSERVATIVE', icon:'📰', color: party==='dem'?'#60a5fa':'#f87171', bg: party==='dem'?'rgba(59,130,246,.1)':'rgba(239,68,68,.1)', tip: party==='dem'?'Left-leaning framing (favors Dems)':'Right-leaning framing (favors Reps)'},
    {label:'WIRE SERVICE', icon:'📋', color:'#94a3b8', bg:'rgba(148,163,184,.08)', tip:'Neutral / wire-service'},
    {label: party==='dem'?'CONSERVATIVE':'PROGRESSIVE', icon:'📰', color: party==='dem'?'#f87171':'#60a5fa', bg: party==='dem'?'rgba(239,68,68,.1)':'rgba(59,130,246,.1)', tip: party==='dem'?'Right-leaning framing (hostile to Dems)':'Left-leaning framing (hostile to Reps)'},
  ];

  // Compute overall media bias from GS.mediaBias (clamped -100 to 100)
  const bias=cl(GS.mediaBias||0,-100,100);
  const biasLabel=bias<-30?'Left-leaning':bias>30?'Right-leaning':'Centrist';
  const biasColor=bias<-30?'#60a5fa':bias>30?'#f87171':'#94a3b8';
  const biasBarPct=((bias+100)/200*100).toFixed(1);

  document.getElementById('news-feed').innerHTML=`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 8px;background:var(--bg3);border-radius:5px;border:1px solid var(--border)">
      <span style="font-family:var(--font-mono);font-size:8px;color:var(--text3);letter-spacing:.1em;white-space:nowrap">MEDIA CLIMATE</span>
      <div style="flex:1;height:4px;background:#1a2035;border-radius:2px;position:relative;overflow:visible">
        <div style="position:absolute;left:0;top:0;width:${biasBarPct}%;height:100%;background:linear-gradient(90deg,#3b82f6,#94a3b8 50%,#ef4444);border-radius:2px"></div>
        <div style="position:absolute;left:${biasBarPct}%;top:-3px;width:2px;height:10px;background:#fff;border-radius:1px;transform:translateX(-50%)"></div>
      </div>
      <span style="font-family:var(--font-mono);font-size:8px;color:${biasColor};white-space:nowrap">${biasLabel}</span>
    </div>
    ${items.map((n,idx)=>{
      const frame=typeof n.frame==='number'?n.frame:1;
      const f=FRAME_LABELS[frame];
      const headlines=n.framings||{left:n.hl,neutral:n.hl,right:n.hl};
      const frameKeys=['left','neutral','right'];
      const displayHl=headlines[frameKeys[frame]]||n.hl;
      return `<div class="news-item" style="cursor:pointer;transition:background .15s" onclick="cycleNewsFrame(${idx})" title="Click to cycle framing">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-family:var(--font-mono);font-size:8px;color:${f.color};letter-spacing:.1em;background:${f.bg};padding:1px 5px;border-radius:3px">${f.icon} ${f.label}</span>
          <span style="font-family:var(--font-mono);font-size:8px;color:var(--text3)">${n.wk||`Wk ${GS.week}`}</span>
        </div>
        <div class="news-headline" style="color:${frame===0?'#93c5fd':frame===2?'#fca5a5':'var(--text)'}">${displayHl}</div>
        <div class="news-meta"><span class="news-tag ${n.tag}">${n.tag}</span><span style="color:var(--text3);font-size:9px">tap to cycle framing →</span></div>
      </div>`;
    }).join('')}`;
}


function renderDemos(){
  const sb=(id,fi,v)=>{document.getElementById(id).textContent=Math.round(v)+'%';document.getElementById(fi).style.width=cl(v,0,100)+'%'};
  sb('demo-urban','fill-urban',GS.demos.urban);sb('demo-suburban','fill-suburban',GS.demos.suburban);sb('demo-rural','fill-rural',GS.demos.rural);sb('demo-youth','fill-youth',GS.demos.youth);sb('demo-seniors','fill-seniors',GS.demos.seniors);
}

function renderFinance(){
  document.getElementById('total-raised').textContent=fm(GS.totalRaised);
  document.getElementById('total-spent').textContent=fm(GS.totalSpent);
  document.getElementById('cash-on-hand').textContent=fm(GS.funds);
}

// ── EV PROJECTION THRESHOLD ────────────────────────────────────────────────────
// Returns the minimum lead (in pts) a state must have before it is "projected"
// for either candidate. States below this threshold sit in tossEV and are shown
// as battleground — NOT awarded to whoever happens to be leading.
//
// Week 1  → threshold ≈ 14 pts  (only deep-safe states count → EV ~100–180 each)
// Week 8  → threshold ≈ 9 pts   (leaning states start coming in)
// Week 16 → threshold = 4 pts   (near-tossups remain uncalled right to election day)
function getEVThreshold(){
  if(GS.phase !== 'general') return 0;
  const weeksIn      = Math.max(0, GS.week - (GS.primaryWeeks || 0) - 1);
  const totalGenWeeks = GS.generalWeeks || 16;
  const progress     = Math.min(weeksIn / totalGenWeeks, 1); // 0 → 1
  return Math.max(4, 14 - progress * 10);                    // 14 → 4
}

function renderEV(){
  const threshold = getEVThreshold();
  GS._evRevealThreshold = threshold;
  ensureBattlegroundSets(false);
  const tossCount = _setFromAny(GS.tossupStateCodes).size;

  const { pEV, oEV, tossEV, demOEV, repOEV, oppEVMap } = getEV();
  const isInd = GS.playerParty === 'ind';
  const rawOpps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
  const opps  = (rawOpps||[]).filter(o=>o && typeof o==='object');

  const weeksIn   = Math.max(0, GS.week - (GS.primaryWeeks||0) - 1);
  const weeksLeft = Math.max(0, (GS.generalWeeks||16) - weeksIn);

  if(isInd){
    // ── N-way race: left=player, centre=Dem opponent, right=Rep opponent ──
    // demOEV / repOEV from getEV() track each side's EVs separately.
    const pColor = GS.playerPartyColor || '#a855f7';
    const evDemEl = document.getElementById('ev-dem');
    const evRepEl = document.getElementById('ev-rep');
    const evThirdDivEl = document.getElementById('ev-divider-third');
    const evThirdEl = document.getElementById('ev-third');
    if(evDemEl){ evDemEl.textContent = pEV; evDemEl.style.color = pColor; }
    if(evRepEl){ evRepEl.textContent = demOEV; evRepEl.style.color = '#60a5fa'; }
    if(evThirdDivEl) evThirdDivEl.style.display = '';
    if(evThirdEl){ evThirdEl.style.display = ''; evThirdEl.textContent = repOEV; evThirdEl.style.color = '#f87171'; }

    const evBarDem = document.getElementById('ev-bar-dem');
    if(evBarDem){ evBarDem.style.width = (pEV/538*100)+'%'; evBarDem.style.background = pColor; }
    const evBarToss = document.getElementById('ev-bar-toss');
    if(evBarToss) evBarToss.style.width = (tossEV/538*100)+'%';
    const evBarRep = document.getElementById('ev-bar-rep');
    if(evBarRep){
      evBarRep.style.width = (oEV/538*100)+'%';
      evBarRep.style.background = 'linear-gradient(90deg,#3b82f6,#ef4444)';
    }

    // Build per-opponent breakdown row below EV bar (injected into ev-polling-note)
    const note = document.getElementById('ev-polling-note');
    if(note){
      const oppParts = opps.map(o=>{
        const ev = oppEVMap[o.id||o.name]||0;
        const col = o.color||(o.party==='dem'?'#60a5fa':'#f87171');
        const label = o.name.split(' ').pop()+(o.party?` (${o.party.charAt(0).toUpperCase()})`:' (I)');
        return `<span style="color:${col}">${label} ~${ev}</span>`;
      }).join(' · ');
      note.innerHTML = `${opps.length}-WAY RACE · ${oppParts} · <span style="color:#6b7280">${weeksLeft} week${weeksLeft===1?'':'s'} remaining</span>`;
    }
    renderWinProbability(pEV, oEV);
    return;
  }

  // ── Standard 2-party display (dem or rep player) ──
  const demEV = GS.playerParty==='dem' ? pEV : oEV;
  const repEV = GS.playerParty==='dem' ? oEV : pEV;
  // Fix: cache elements + null-guard every write so a missing element can't throw
  // (renderAll wraps renderEV in try/catch, so an uncaught TypeError silently leaves 0-0)
  const _evDem    = document.getElementById('ev-dem');
  const _evRep    = document.getElementById('ev-rep');
  const _evBarDem = document.getElementById('ev-bar-dem');
  const _evBarRep = document.getElementById('ev-bar-rep');
  const _evBarTss = document.getElementById('ev-bar-toss');
  if(_evDem)    { _evDem.textContent = demEV;    _evDem.style.color = ''; }
  if(_evRep)    { _evRep.textContent = repEV; }
  if(_evBarDem) { _evBarDem.style.width = (demEV/538*100)+'%'; _evBarDem.style.background = ''; }
  if(_evBarRep) { _evBarRep.style.width = (repEV/538*100)+'%'; _evBarRep.style.background = ''; }
  if(_evBarTss) { _evBarTss.style.width = (tossEV/538*100)+'%'; }

  // ── Handle 3+ party races (dem/rep player with third party opponent) ──
  const thirdDivider = document.getElementById('ev-divider-third');
  const thirdCount = document.getElementById('ev-third');
  if(opps.length >= 2 && thirdDivider && thirdCount){
    // Find the third party opponent (not the main opponent)
    const mainOppParty = GS.playerParty==='dem' ? 'rep' : 'dem';
    const thirdOpp = opps.find(o => o.party !== mainOppParty);
    if(thirdOpp){
      const thirdEV = oppEVMap[thirdOpp.id||thirdOpp.name] || 0;
      thirdDivider.style.display = '';
      thirdCount.style.display = '';
      thirdCount.textContent = thirdEV;
      thirdCount.style.color = thirdOpp.color || '#a78bfa';
    } else {
      thirdDivider.style.display = 'none';
      thirdCount.style.display = 'none';
    }
  } else if(thirdDivider && thirdCount){
    thirdDivider.style.display = 'none';
    thirdCount.style.display = 'none';
  }

  const note = document.getElementById('ev-polling-note');
  if(note){
    note.textContent = `🗺 CURRENT MAP — ${538-pEV-oEV} EV exactly tied · ${weeksLeft} week${weeksLeft===1?'':'s'} remaining`;
  }
  renderWinProbability(pEV, oEV);
}

// ── MULTI-CANDIDATE EV HELPERS ────────────────────────────────────────────────

// Returns the opponent most likely to win a state the player is losing.
// Scores each opponent by: base approval + partisan-lean affinity + home-state bonus.
// Works for 2-party (falls back to GS.opponent) and N-way races.
function getBestOpponent(s){
  const opps = GS.generalOpponents;
  if(!opps || opps.length === 0) return GS.opponent;
  if(opps.length === 1) return opps[0];
  let best = null, bestScore = -Infinity;
  for(const opp of opps){
    const partyAffinity = opp.party==='dem' ? s.lean : opp.party==='rep' ? -s.lean : 0;
    const homeBonus = (opp.homeState && opp.homeState===s.code) ? 12 : 0;
    const score = (opp.approval||45) + partyAffinity*0.6 + homeBonus;
    if(score > bestScore){ bestScore=score; best=opp; }
  }
  return best || opps[0];
}

// ── CANONICAL EV GETTER ────────────────────────────────────────────────────────
// Single source of truth for every EV display.
// During the campaign phase (primary/general): counts directly from each state's
// current genLead — positive = player EV, negative = opponent EV, no tossup bucket.
// This keeps the bar in sync with exactly what the map is showing.
// During election night: uses the designated tossupStateCodes bucket so close
// states remain uncalled until results come in.
// Handles N opponents via GS.generalOpponents — works for 2-party and custom races.
function getEV(){
  const isInd = GS.playerParty === 'ind';
  const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
  ensureBattlegroundSets(false);
  // Per-opponent EV bucket keyed by id/name
  const oppEVMap = {};
  opps.forEach(o=>{ oppEVMap[o.id||o.name]=0; });
  let pEV=0, oEV=0, tossEV=0, demOEV=0, repOEV=0;

  const _routeLoss = (s)=>{
    const winner = getBestOpponent(s);
    oEV += s.ev;
    if(winner){
      const key = winner.id||winner.name;
      oppEVMap[key] = (oppEVMap[key]||0) + s.ev;
      if(winner.party==='dem') demOEV += s.ev;
      else if(winner.party==='rep') repOEV += s.ev;
    } else {
      if(s.lean>=0) demOEV+=s.ev; else repOEV+=s.ev;
    }
  };

  const isCampaignPhase = GS.phase === 'primary' || GS.phase === 'general';

  if(isCampaignPhase){
    // Campaign phase: mirror the map exactly — every state counted by its current genLead.
    // No tossup bucket, no threshold gating. Works for all party modes including custom.
    GS.states.forEach(s=>{
      // Fix: guard against undefined/NaN genLead (e.g. state not yet initialised)
      const _gl = s.genLead;
      if(_gl == null || (typeof _gl === 'number' && isNaN(_gl))){
        const _bl = (s.lean||0)+(s.leanMod||0);
        const _nl = GS.playerParty==='rep' ? -_bl : GS.playerParty==='dem' ? _bl : 0;
        if(_nl >= 0) pEV += (s.ev||0); else _routeLoss(s);
        return;
      }
      if(_gl > 0){
        pEV += s.ev;
      } else if(_gl < 0){
        _routeLoss(s);
      } else {
        // Exactly zero: allocate by natural partisan lean (or to player if neutral/ind)
        const baseLean = (s.lean||0) + (s.leanMod||0);
        const naturalLean = GS.playerParty==='rep' ? -baseLean : GS.playerParty==='dem' ? baseLean : 0;
        if(naturalLean >= 0) pEV += s.ev;
        else _routeLoss(s);
      }
    });
  } else {
    // Election night: use designated tossup bucket so close states stay uncalled.
    const tossSet = _setFromAny(GS.tossupStateCodes);
    const callLine = 0.75;
    GS.states.forEach(s=>{
      if(tossSet.has(s.code)){
        tossEV += s.ev;
        return;
      }
      if(s.genLead > callLine){
        pEV += s.ev;
      } else if(s.genLead < -callLine){
        _routeLoss(s);
      } else if(isInd && Math.abs(s.lean)>12 && s.genLead<=1){
        // Deep partisan state barely contested — allocate to its natural home
        _routeLoss(s);
      } else {
        const baseLean = (s.lean||0) + (s.leanMod||0);
        const naturalLean = GS.playerParty==='rep' ? -baseLean : GS.playerParty==='dem' ? baseLean : 0;
        if(naturalLean >= 0) pEV += s.ev;
        else _routeLoss(s);
      }
    });
  }

  return { pEV, oEV, tossEV, demOEV, repOEV, oppEVMap };
}

function renderWinProbability(pEV, oEV){
  const probWrap = document.getElementById('win-prob-bar-wrap');
  const probPct  = document.getElementById('win-prob-pct');
  const probFill = document.getElementById('win-prob-fill');
  const breakdown = document.getElementById('win-prob-breakdown');
  const label = document.getElementById('win-prob-label');
  if(!probWrap) return;

  if(GS.phase==='primary'){
    // Primary: estimate chance of winning nomination
    label.textContent = 'Primary Victory Odds';
    const active = GS.aiCandidates.filter(a=>a.active);
    const totalDel = GS.playerDelegates + active.reduce((s,a)=>s+a.delegates,0);
    const needed = GS.delegatesNeeded;
    // How far ahead of rivals? Key driver.
    const rival1Del = active.length ? Math.max(...active.map(a=>a.delegates)) : 0;
    const delegateLead = GS.playerDelegates - rival1Del;
    const shareRemaining = Math.max(needed - GS.playerDelegates, 0) / (needed || 1);
    // Simulate 300 primary outcomes
    let wins = 0;
    for(let i=0;i<300;i++){
      const simDel = GS.playerDelegates + G(delegateLead*0.3, delegateLead*0.4 + 80);
      if(simDel >= needed) wins++;
    }
    const wp = cl(wins/3, 2, 97);
    probPct.textContent = wp.toFixed(0)+'%';
    probPct.style.color = wp>65?'var(--green)':wp>40?'var(--accent)':'var(--rep)';
    probFill.style.width = wp+'%';
    probFill.style.background = wp>65?'linear-gradient(90deg,var(--accent),#22c55e)':wp>40?'linear-gradient(90deg,var(--accent),#f59e0b)':'linear-gradient(90deg,#991b1b,#ef4444)';
    const momentumNote = GS.momentum>3?'↑ Momentum building':GS.momentum<-3?'↓ Momentum fading':'→ Stable';
    breakdown.innerHTML = `Delegates: ${GS.playerDelegates.toLocaleString()} / ${needed.toLocaleString()} needed &nbsp;·&nbsp; ${momentumNote}<br>Lead over rival: ${delegateLead>0?'+':''}${delegateLead.toLocaleString()} &nbsp;·&nbsp; Endorsements: ${GS.endorsements}`;
  } else {
    // General: Monte Carlo over state outcomes
    label.textContent = 'General Election Odds';
    let wins=0;
    for(let i=0;i<300;i++){
      let simEV=0;
      GS.states.forEach(s=>{if(s.genLead+G(0,s.vol*8)>0)simEV+=s.ev});
      if(simEV>=270)wins++;
    }
    const wp=cl(wins/3,2,98);
    probPct.textContent = wp.toFixed(0)+'%';
    probPct.style.color = wp>65?'var(--green)':wp>40?'var(--accent)':'var(--rep)';
    probFill.style.width=wp+'%';
    probFill.style.background=wp>60?'linear-gradient(90deg,#1d4ed8,#22c55e)':wp<40?'linear-gradient(90deg,#991b1b,#ef4444)':'linear-gradient(90deg,#1d4ed8,#7c3aed)';
    const { pEV: rawPEV, oEV: rawOEV, tossEV: tossupEV } = getEV();
    // For N-way races describe the field more clearly
    const _genOpps2 = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
    const momentumNote = GS.momentum>3?'↑ Momentum favours you':GS.momentum<-3?`↓ ${_genOpps2.length>1?'Opponents gaining':'Opponent gaining'}`:'→ Stable';
    breakdown.innerHTML=`EV projection: ${rawPEV} – ${rawOEV} &nbsp;·&nbsp; ${tossupEV} EV in toss-up range<br>${momentumNote} &nbsp;·&nbsp; Fav: ${GS.favorability.toFixed(0)}%`;
  }
}

// ── STATE MODAL ──
function openStateModal(code){
  const s=GS.states.find(x=>x.code===code);if(!s)return;
  document.getElementById('state-modal-name').textContent=s.name;
  document.getElementById('state-modal-sub').textContent=`${s.ev} Electoral Votes · ${s.pd} Primary Delegates`;
  const isPrimary=GS.phase==='primary';
  const lead=isPrimary?s.primLead:s.genLead;
  const partisanLabel=s.lean>8?'🔵 Dem-leaning':s.lean<-8?'🔴 Rep-leaning':'⚪ True Battleground';
  // Primary: use same _primaryLeader/_primaryMargin the hover tooltip uses, so numbers match
  const primIsPlayer = s._primaryLeader==='player';
  const primLeaderAI = isPrimary ? GS.aiCandidates.find(a=>a.id===s._primaryLeader) : null;
  const primLeaderName = isPrimary ? (primIsPlayer ? 'You' : (primLeaderAI?.name?.split(' ').slice(-1)[0]||'Opponent')) : '';
  const primMargin = isPrimary ? (s._primaryMargin||0) : 0;
  const primLeadStr = isPrimary
    ? (primIsPlayer ? `You +${primMargin.toFixed(1)}%` : `${primLeaderName} +${primMargin.toFixed(1)}%`)
    : `${lead>=0?'+':''}${lead.toFixed(1)}%`;
  const primLeadColor = isPrimary ? (primIsPlayer ? 'var(--green)' : 'var(--rep)') : (lead>=0?'var(--green)':'var(--rep)');
  const primStatus = isPrimary
    ? (primIsPlayer ? (primMargin>10?'Dominant':'Leading') : `${primLeaderName} leads by ${primMargin.toFixed(1)}pts`)
    : leanLabel(lead,GS.playerParty);
  document.getElementById('state-modal-body').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono);margin-bottom:2px">${isPrimary?'Race Leader':'Your Lead'}</div><div style="font-size:16px;font-weight:600;color:${primLeadColor}">${primLeadStr}</div></div>
      <div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono);margin-bottom:2px">Status</div><div style="font-size:12px;font-weight:600">${primStatus}</div></div>
      <div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono);margin-bottom:2px">Partisan Lean</div><div style="font-size:12px">${partisanLabel}</div></div>
      <div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono);margin-bottom:2px">Volatility</div><div style="font-size:14px;font-weight:600">${(s.vol*100).toFixed(0)}%</div></div>
      <div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono);margin-bottom:2px">Delegates Won</div><div style="font-size:14px;font-weight:600;color:var(--accent)">${s.primaryDelegatesWon}/${s.pd}</div></div>
      <div><div style="font-size:10px;color:var(--text2);font-family:var(--font-mono);margin-bottom:2px">Electoral Votes</div><div style="font-size:14px;font-weight:600">${s.ev} EV</div></div>
    </div>
    <div style="height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:10px">
      <div style="height:100%;width:${cl(50+lead*2,0,100)}%;background:${lead>0?'var(--green)':'var(--rep)'};border-radius:2px;transition:width .4s"></div>
    </div>
    ${GS.homeState===code?'<div style="font-size:11px;color:var(--green);padding:7px;background:rgba(34,197,94,.1);border-radius:4px;margin-bottom:5px">-- Your home state — +10% primary bonus</div>':''}
    ${GS.vp&&GS.vp.stateCode===code?`<div style="font-size:11px;color:var(--accent);padding:7px;background:rgba(200,168,75,.1);border-radius:4px;margin-bottom:5px">- Running mate's home state — bonus applied</div>`:''}
    ${GS.targetedStates.has(code)?'<div style="font-size:11px;color:var(--accent);padding:7px;background:rgba(200,168,75,.1);border-radius:4px">🎯 Currently targeted</div>':''}`;
  document.getElementById('state-modal-target-btn').onclick=()=>{
    GS.targetedStates.add(code);
    document.getElementById('target-state-select').value=code;
    GS.targetState=code;
    closeModal('state-modal');renderMaps();
  };
  document.getElementById('state-modal').classList.add('active');
}
function closeModal(id){document.getElementById(id).classList.remove('active')}

// ── Share / copy result ──────────────────────────────────────
function shareResult(){
  const title = document.getElementById('end-title')?.textContent || '';
  const stats = [...document.querySelectorAll('#end-stats .end-stat')].map(el=>{
    const lbl = el.querySelector('.end-stat-label')?.textContent || '';
    const val = el.querySelector('.end-stat-value')?.textContent || '';
    return `${lbl}: ${val}`;
  }).join(' · ');
  
  const party = GS?.playerParty==='dem' ? '🔵 Democrat' : '🔴 Republican';
  const streak = GS?._actionStreak > 0 ? ` | Streak: ${GS._actionStreak}wks` : '';
  
  // Updated to always use the Itch.io URL
  const gameURL = 'https://dackers-studios.itch.io/potus-2024';
  const text = `POTUS — Presidential Election Simulator\n${title}\n${party} | ${GS?.candidateName||''}\n${stats}${streak}\nPlay at: ${gameURL}`;
  
  navigator.clipboard?.writeText(text).then(()=>{
    const el = document.getElementById('end-share-confirm');
    if(el){ el.style.display='block'; setTimeout(()=>el.style.display='none', 2500); }
  }).catch(()=>{
    prompt('Copy this result:', text);
  });
}


function openSettingsModal(){
  document.getElementById('settings-modal').classList.add('active');
}

function setUIScale(scale, btn){
  // Use zoom — scales ALL elements uniformly, not just --ui-scale consumers
  document.body.style.zoom = scale;
  document.querySelectorAll('.ui-scale-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  // Sync main-menu display scale buttons
  const scaleToMode = {'0.78':'mobile','0.92':'tablet','1':'desktop','1.12':'large'};
  const mode = scaleToMode[String(scale)];
  ['mobile','tablet','desktop'].forEach(m=>{
    const b = document.getElementById('dscale-'+m);
    if(b) b.classList.toggle('active', m===mode);
  });
  try{ localStorage.setItem('potus_ui_scale', scale);
       if(mode) localStorage.setItem('potus_display_scale', mode); }catch(e){}
}

/* ── Display Scale (main menu + settings) ── */
const DISPLAY_SCALES = {
  mobile:  { scale: 0.72, label: 'Mobile'  },
  tablet:  { scale: 0.88, label: 'Tablet'  },
  desktop: { scale: 1.00, label: 'Desktop' }
};

function setDisplayScale(mode, _btn){
  const cfg = DISPLAY_SCALES[mode];
  if(!cfg) return;
  // CSS zoom scales EVERYTHING — fonts, padding, widths, grid columns
  document.body.style.zoom = cfg.scale;
  // Sync main-menu buttons
  ['mobile','tablet','desktop'].forEach(m=>{
    const b = document.getElementById('dscale-'+m);
    if(b) b.classList.toggle('active', m===mode);
  });
  // Sync in-game settings modal buttons
  document.querySelectorAll('.ui-scale-btn').forEach(b=>{
    b.classList.toggle('active', parseFloat(b.dataset.scale)===cfg.scale);
  });
  // Update hint
  const hint = document.getElementById('dscale-hint');
  const labels = {mobile:'📱 Mobile layout applied',tablet:'⬜ Tablet layout applied',desktop:'🖥 Desktop layout applied'};
  if(hint) hint.textContent = labels[mode] || '';
  // Persist
  try{ localStorage.setItem('potus_display_scale', mode); localStorage.setItem('potus_ui_scale', cfg.scale); }catch(e){}
}

function initDisplayScale(){
  const w = window.screen.width || window.innerWidth;
  let auto = w <= 480 ? 'mobile' : w <= 900 ? 'tablet' : 'desktop';
  let saved;
  try{ saved = localStorage.getItem('potus_display_scale'); }catch(e){}
  const mode = (saved && DISPLAY_SCALES[saved]) ? saved : auto;
  setDisplayScale(mode, null);
  const hint = document.getElementById('dscale-hint');
  if(hint) hint.textContent = saved
    ? {mobile:'📱 Mobile',tablet:'⬜ Tablet',desktop:'🖥 Desktop'}[mode]+' (saved preference)'
    : 'Auto-detected: '+{mobile:'Mobile',tablet:'Tablet',desktop:'Desktop'}[mode];
}

// ── Political Compass Tooltip ──────────────────────────────────
function showCompassTooltip(){
  const t = document.getElementById('compass-tooltip');
  if(t) t.classList.add('visible');
}
function hideCompassTooltip(){
  const t = document.getElementById('compass-tooltip');
  if(t) t.classList.remove('visible');
}

function showSummary(events){
  // Close minigame if open
  const mg = document.getElementById('minigame-modal');
  if(mg) mg.classList.remove('active');

  // Election over check (primary or general)
  if(GS.phase==='general' && GS.week > GS.primaryWeeks + GS.generalWeeks && !GS.phaseTransitioning){
    GS.phaseTransitioning = true;
    setTimeout(showResult, 400);
    return;
  }

  // Crisis check for general phase before showing modal
  if(GS.phase==='general' && GS._crisisArmed){
    const crisisEvent = maybeFireCrisisEvent();
    if(crisisEvent){ setTimeout(()=>showCrisisModal(crisisEvent), 200); return; }
  }

  // Build and show summary modal (primary or general)
  const wkNum = GS.week - 1;
  if(GS.phase==='general'){
    const genWk = wkNum - GS.primaryWeeks;
    const totalGenWk = GS.generalWeeks;
    document.getElementById('summary-title').textContent = `📅 General Election — Week ${genWk} Summary`;
    document.getElementById('summary-subtitle').textContent =
      `General Election · Week ${genWk} of ${totalGenWk} · ${fm(GS.funds)}`;
  } else {
    document.getElementById('summary-title').textContent = `📅 Week ${wkNum} Summary`;
    document.getElementById('summary-subtitle').textContent =
      `Primary · Week ${wkNum} of ${GS.primaryWeeks} · ${fm(GS.funds)} · ${GS.playerDelegates.toLocaleString()} delegates`;
  }
  const ev = events.length ? events : [{type:'neutral',title:'Quiet Week',msg:'A calm week on the trail. No major developments.'}];
  document.getElementById('summary-events').innerHTML =
    ev.map(e=>`<div class="summary-event ${e.type}"><div class="summary-title">${e.title}</div><div>${e.msg}</div></div>`).join('');
  document.getElementById('summary-modal').classList.add('active');
}
function closeSummary(){
  document.getElementById('summary-modal').classList.remove('active');
  // Fire any pending crisis event
  if(GS._crisisArmed){
    const crisisEvent = maybeFireCrisisEvent();
    if(crisisEvent){
      setTimeout(()=>showCrisisModal(crisisEvent), 350);
      return;
    }
  }
  // Pending negotiation
  if(GS._pendingNegotiation){
    setTimeout(openNegotiateModal, 300);
    return;
  }
  // Primary → Convention
  if(GS.phase==='primary'&&GS.week>GS.primaryWeeks&&!GS.phaseTransitioning){
    GS.phaseTransitioning=true;
    setTimeout(()=>{GS.phaseTransitioning=false;showConvention();},400);
    return;
  }
  // General election over
  if(GS.phase==='general'&&GS.week>GS.primaryWeeks+GS.generalWeeks&&!GS.phaseTransitioning){
    GS.phaseTransitioning=true;
    setTimeout(showResult,400);
    return;
  }
  // Mid-game general: re-render for next week
  if(GS.phase==='general') renderAll();
}

function closeNegResult(){
  document.getElementById('neg-result-modal').classList.remove('active');

  // Historical mode uses different end-condition math (no primaryWeeks)
  if(typeof _histActive !== 'undefined' && _histActive){
    if(GS.week > GS.generalWeeks && !GS.phaseTransitioning){
      GS.phaseTransitioning = true;
      setTimeout(showResult, 400);
      return;
    }
    renderAll();
    return;
  }

  // Career mode
  if(GS.phase==='general'&&GS.week>GS.primaryWeeks+GS.generalWeeks&&!GS.phaseTransitioning){
    GS.phaseTransitioning=true;
    setTimeout(showResult,400);
    return;
  }
  if(GS.phase==='general') renderAll();
}

function devSkipToElection(nailbiter=false){
  // Initialize game state with defaults
  GS.playerName=document.getElementById('player-name').value||'Alex Morgan';
  GS.playerParty=selParty; GS.homeState=document.getElementById('home-state').value; GS.difficulty='easy';
  GS.funds=40; GS.totalRaised=40; GS.favorability=52; GS.electability=60; GS.groundGame=50; GS.mediaCoverage=55;
  GS.aiCandidates=[]; GS.playerDelegates=2200; GS.endorsements=3; GS.playerIdeology=50;
  GS.states=STATE_DATA.map(s=>{
    const rawLean=selParty==='rep'?-s.lean:s.lean;
    return{...s,primLead:G(5,8),genLead:rawLean+G(0,5),enthusiasm:55,primaryDelegatesWon:0};
  });
  // Assign a VP
  const vpOpts=selParty==='dem'?VP_OPTIONS_DEM:VP_OPTIONS_REP;
  GS.vp=vpOpts[0];
  // Assign opponent
  GS.opponent={name:'Gov. R. Thompson',party:selParty==='dem'?'rep':'dem',funds:38,approval:46,active:true,color:selParty==='dem'?'#ef4444':'#3b82f6',delegates:0};
  GS.phase='general'; GS.week=GS.primaryWeeks+1;
  GS.aiCandidates=[GS.opponent];
  GS.newsItems=[{hl:'DEV MODE: Skipped to election night',tag:'campaign',wk:'Dev'}];
  // Apply VP bonus
  if(GS.vp&&GS.vp.stateCode){const vs=GS.states.find(s=>s.code===GS.vp.stateCode);if(vs)vs.genLead=cl(vs.genLead+GS.vp.bVal,-60,60);}
  // Compute final leads
  GS.states.forEach(s=>{ s.finalLead=s.genLead+G(0,s.vol*4); });

  if(nailbiter){
    // Force a 269-269 or 270-268 scenario — it all comes down to PA (19 EV)
    // Set most states firmly, make PA the decisive state with <1% margin
    GS.states.forEach(s=>{
      if(s.lean>8)  s.finalLead = Math.abs(G(12,3));   // safe dem
      else if(s.lean<-8) s.finalLead = -Math.abs(G(12,3)); // safe rep
      else s.finalLead = G(0, 2); // true toss-ups stay close
    });
    // Force PA to be the closest state decided last
    const pa = GS.states.find(s=>s.code==='PA');
    if(pa) pa.finalLead = G(0.3, 0.1) * (Math.random()>.5?1:-1);
    // Force some swing states to go one way to create 269-269 tension
    const forceRep = ['FL','OH','NC','TX'];
    const forceDem = ['MI','WI','MN','CO'];
    forceRep.forEach(c=>{ const st=GS.states.find(s=>s.code===c); if(st) st.finalLead=-Math.abs(G(6,2)); });
    forceDem.forEach(c=>{ const st=GS.states.find(s=>s.code===c); if(st) st.finalLead=Math.abs(G(6,2)); });
    addNews('📊 POLLS CLOSE IN FIRST STATES — Race too close to call nationally','campaign');
    addNews('⚡ Analysts: No clear path to 270 without Pennsylvania','campaign');
  }

  startElectionNight();
}

// ─── ADDITIONAL DEV TOOLS ────────────────────────────────────────
function devAddFunds(){if(!GS.week){alert('Start a game first.');return;} GS.funds=cl(GS.funds+10,0,999);GS.totalRaised+=10;renderAll();showDevInfo();}
function devBoostFav(){if(!GS.week){alert('Start a game first.');return;} GS.favorability=cl(GS.favorability+10,20,85);renderAll();showDevInfo();}
function devMaxMomentum(){if(!GS.week){alert('Start a game first.');return;} GS.momentum=20;GS._enthusiasm=90;renderAll();showDevInfo();}
function devFlipSwing(){
  if(!GS.states){alert('Start a game first.');return;}
  GS.states.filter(s=>Math.abs(s.lean)<=8).forEach(s=>{s.genLead=Math.abs(G(4,2));});
  renderAll();showDevInfo();
}
function devNukeOpponent(){
  if(!GS.opponent){alert('Start a game first.');return;}
  GS.opponent.approval=cl((GS.opponent.approval||45)-20,5,80);
  GS.opponent.funds=cl((GS.opponent.funds||30)-15,0,200);
  GS.momentum=cl(GS.momentum+8,-20,20);
  addNews('Opponent campaign in freefall — major internal crisis reported','scandal');
  renderAll();showDevInfo();
}
function devTriggerScandal(){
  if(!GS.week){alert('Start a game first.');return;}
  GS.favorability=cl(GS.favorability-8,20,85);
  GS.momentum=cl(GS.momentum-5,-20,20);
  GS._scandalRisk=12;
  addNews('🚨 BREAKING: Major scandal hits campaign — scrambling to respond','scandal');
  renderAll();showDevInfo();
}
function devUnderdogMode(){
  if(!GS.week){alert('Start a game first.');return;}
  GS.favorability=cl(GS.favorability-12,20,85);
  GS.momentum=cl(GS.momentum-8,-20,20);
  if(GS.opponent) GS.opponent.approval=cl((GS.opponent.approval||45)+8,20,85);
  if(GS.states) GS.states.filter(s=>Math.abs(s.lean)<=10).forEach(s=>s.genLead=cl(s.genLead-6,-60,60));
  addNews('Poll: Campaign trails by 8 points nationally with 6 weeks to go','poll');
  renderActionGrid();renderAll();showDevInfo();
}
function devWinEvery(){
  if(!GS.states){alert('Start a game first.');return;}
  GS.states.forEach(s=>{s.genLead=Math.abs(G(15,5));s.finalLead=s.genLead;});
  renderAll();showDevInfo();
}
function devJumpWeek(){
  const t=parseInt(document.getElementById('dev-week-jump').value);
  if(isNaN(t)||t<1||!GS.week){return;}
  GS.week=t; document.getElementById('stat-week').textContent=GS.week;
  renderAll();showDevInfo();
}

// FIX: In-game dev panel — skip to general election from within a running primary
function devSkipToGeneralInGame(){
  if(!GS.week){ alert('Start a game first.'); return; }
  if(GS.phase==='general'){ alert('Already in general election.'); return; }
  GS.playerDelegates = GS.delegatesNeeded + 1;
  GS.phase = 'general';
  GS.week  = GS.primaryWeeks + 1;
  GS._crisisCountThisPhase = 0; GS._lastCrisisWeek = 0; GS._crisisArmed = false;
  GS._uniqueActionsUsed = new Set();
  GS._boringCampaignFired = false;
  GS._recentActions = [];
  const oppParty = GS.playerParty==='dem' ? 'rep' : 'dem';
  if(!GS.opponent){
    GS.opponent = { name:'Gov. R. Thompson', party:oppParty, funds:38, approval:46,
                    active:true, color:oppParty==='rep'?'#ef4444':'#3b82f6', delegates:0 };
  }
  GS.aiCandidates = [GS.opponent];
  GS.generalOpponents = [GS.opponent]; // Fix: required for renderEV/getEV
  if(!GS.vp){
    const vpOpts = GS.playerParty==='dem' ? VP_OPTIONS_DEM : VP_OPTIONS_REP;
    GS.vp = vpOpts[0];
  }
  const diffShift = {easy:2, normal:-2, hard:-16}[GS.difficulty] || 0;
  GS.states.forEach(s=>{
    const rawLean = GS.playerParty==='rep' ? -s.lean : s.lean;
    s.genLead = rawLean + diffShift + G(0,4);
    if(!s._pollError) s._pollError = G(0, s.vol*5.5);
  });
  if(GS.vp && GS.vp.stateCode){
    const vs = GS.states.find(s=>s.code===GS.vp.stateCode);
    if(vs) vs.genLead = cl(vs.genLead + (GS.vp.bVal||0), -60, 60);
  }
  showScreen('game-screen');
  document.getElementById('topbar-phase').textContent = 'General Election';
  document.getElementById('phase-primary').className  = 'phase-step done';
  document.getElementById('phase-convention').className = 'phase-step done';
  document.getElementById('phase-general').className  = 'phase-step current';
  document.getElementById('opponent-panel-title').textContent = 'General Opponent';
  document.getElementById('primary-content').style.display = 'none';
  document.getElementById('general-content').style.display = 'block';
  document.getElementById('battleground-section').style.display = 'block';
  const _ce = document.getElementById('congress-tracker'); if(_ce) _ce.style.display = 'block';
  initCongressTracker();
  document.getElementById('polls-title').textContent = 'National General Poll';
  document.getElementById('stat-delegates').textContent = '—';
  document.getElementById('stat-delegates-wrap').style.display = 'none';
  GS._evRevealThreshold = 15;
  addNews('DEV: Skipped to general election', 'campaign');
  renderActionGrid();
  renderAll();
  showGameDevInfo();
}

// FIX: In-game dev panel week-jump (different from setup-screen devJumpWeek)
function devJumpWeekGame(){
  const inp = document.getElementById('game-dev-week-jump');
  const t = inp ? parseInt(inp.value) : NaN;
  if(isNaN(t) || t < 1 || !GS.week){ return; }
  const maxWeek = GS.primaryWeeks + GS.generalWeeks + 1;
  GS.week = Math.max(1, Math.min(t, maxWeek));
  renderAll();
  showGameDevInfo();
}
function showDevInfo(){
  const el=document.getElementById('dev-state-text');
  if(!el) return;
  if(!GS.phase){el.innerHTML='<span style="color:#2a3040">No game active. Click items above to cheat!</span>';return;}
  const pEV=GS.states?GS.states.filter(s=>s.genLead>0).reduce((a,s)=>a+s.ev,0):0;
  const oEV=GS.states?GS.states.filter(s=>s.genLead<=0).reduce((a,s)=>a+s.ev,0):0;
  const pPct=GS.opponent?cl(50+(GS.favorability-GS.opponent.approval)*.3+GS.momentum*.4,30,70).toFixed(1):'—';
  const closestSwing=GS.states?[...GS.states].filter(s=>Math.abs(s.lean)<=8).sort((a,b)=>Math.abs(a.genLead)-Math.abs(b.genLead))[0]:null;
  el.innerHTML=`<span style="color:#4a5060">Phase:</span> <b style="color:#6a7080">${GS.phase||'—'}</b> · <span style="color:#4a5060">Wk:</span> <b style="color:#6a7080">${GS.week}</b><br>`
    +`<span style="color:#4a5060">Funds:</span> <b style="color:#4ade80">${fm(GS.funds||0)}</b> · <span style="color:#4a5060">Fav:</span> <b style="color:var(--accent)">${(GS.favorability||0).toFixed(1)}%</b> · <span style="color:#4a5060">Mom:</span> <b style="color:#a78bfa">${(GS.momentum||0).toFixed(1)}</b><br>`
    +`<span style="color:#4a5060">EV:</span> Player <b style="color:#c8a84b">${pEV}</b> – <b style="color:#c8a84b">${oEV}</b> Opp · National: <b>${pPct}%</b><br>`
    +`<span style="color:#4a5060">Scandal risk:</span> <b style="color:${(GS._scandalRisk||0)>8?'#ef4444':'#4a5060'}">${(GS._scandalRisk||0).toFixed(1)}</b> · VP buff: <b>${GS._vpScandalBuffer||0}</b> · Enth: <b>${(GS._enthusiasm||50).toFixed(0)}</b><br>`
    +`<span style="color:#4a5060">Closest swing:</span> <b>${closestSwing?closestSwing.code+' (+'+closestSwing.genLead.toFixed(1)+'%)':'—'}</b><br>`
    +`<span style="color:#4a5060">VP:</span> <b style="color:var(--accent)">${GS.vp?GS.vp.tag+' — '+GS.vp.name:'None'}</b><br>`
    +`<span style="color:#4a5060">Mood:</span> <b style="color:#60a5fa">${GS.nationalMood?NATIONAL_MOODS[GS.nationalMood]?.icon+' '+NATIONAL_MOODS[GS.nationalMood]?.name:'—'}</b><br>`
    +`<span style="color:#4a5060">Blocs (Dem lean):</span> WC:${GS_BLOCS?.wc?.support?.toFixed(0)||0} CE:${GS_BLOCS?.ce?.support?.toFixed(0)||0} SW:${GS_BLOCS?.sw?.support?.toFixed(0)||0} IN:${GS_BLOCS?.in?.support?.toFixed(0)||0} UP:${GS_BLOCS?.up?.support?.toFixed(0)||0}`;
}


// FIX: In-game dev panel state display (separate from setup-screen showDevInfo)
function showGameDevInfo(){
  const el = document.getElementById('game-dev-state-text');
  if(!el) return;
  if(!GS.phase){ el.innerHTML = '<span style="color:#2a3040">No game active.</span>'; return; }
  const pEV = GS.states ? GS.states.filter(s=>s.genLead>0).reduce((a,s)=>a+s.ev,0) : 0;
  const oEV = GS.states ? GS.states.filter(s=>s.genLead<=0).reduce((a,s)=>a+s.ev,0) : 0;
  const pPct = GS.opponent ? cl(50+(GS.favorability-GS.opponent.approval)*.3+GS.momentum*.4,30,70).toFixed(1) : '—';
  const cs = GS.states ? [...GS.states].filter(s=>Math.abs(s.lean)<=8).sort((a,b)=>Math.abs(a.genLead)-Math.abs(b.genLead))[0] : null;
  el.innerHTML = `Phase: <b>${GS.phase}</b> · Wk: <b>${GS.week}</b> · `
    + `Fav: <b>${(GS.favorability||0).toFixed(1)}%</b> · Mom: <b>${(GS.momentum||0).toFixed(1)}</b><br>`
    + `Funds: <b>${fm(GS.funds||0)}</b> · EV: <b>${pEV}</b>–<b>${oEV}</b> · National: <b>${pPct}%</b><br>`
    + `Scandal: <b>${(GS._scandalRisk||0).toFixed(1)}</b> · Enth: <b>${(GS._enthusiasm||50).toFixed(0)}</b><br>`
    + `Closest swing: <b>${cs ? cs.code+' ('+cs.genLead.toFixed(1)+'%)' : '—'}</b>`;
}

// ---------------------------------------------------------------
//  RANDOMISED AI CANDIDATE NAMES
// ---------------------------------------------------------------
const NAME_POOL_DEM = [
  {first:'James',last:'Hawkins'},{first:'Rachel',last:'Chen'},{first:'David',last:'Torres'},
  {first:'Linda',last:'Park'},{first:'Marcus',last:'Webb'},{first:'Sofia',last:'Reyes'},
  {first:'Kevin',last:'Okafor'},{first:'Priya',last:'Nair'},{first:'Daniel',last:'Flores'},
  {first:'Ava',last:'Kim'},{first:'Ethan',last:'Brooks'},{first:'Mia',last:'Patel'},
  {first:'Omar',last:'Hassan'},{first:'Claire',last:'Dupont'},{first:'Jerome',last:'Williams'},
];
const NAME_POOL_REP = [
  {first:'Michael',last:'Walsh'},{first:'Thomas',last:'Reeves'},{first:'Katherine',last:'Stone'},
  {first:'Edward',last:'Grant'},{first:'Barbara',last:'Holt'},{first:'Richard',last:'Lane'},
  {first:'Carol',last:'Bishop'},{first:'Frank',last:'Russo'},{first:'Helen',last:'Marsh'},
  {first:'George',last:'Crawford'},{first:'Patricia',last:'Kane'},{first:'Robert',last:'Vance'},
  {first:'Susan',last:'Ford'},{first:'Donald',last:'Briggs'},{first:'Nancy',last:'Harper'},
];
const TITLE_POOL = ['Sen.','Gov.','Rep.','Dr.','Mayor','Sec.','Lt. Gov.'];

// ── REAL CANDIDATE PHOTOS ──────────────────────────────────────────────────
// Photos matched to archetype/gender heuristics when possible
const REAL_CANDIDATE_PHOTOS = [
  { file: 'midage-white-female.jpg', gender: 'f', age: 'mid',  race: 'white'  },
  { file: 'old-white-man.jpg',       gender: 'm', age: 'old',  race: 'white'  },
  { file: 'young-black-man.jpg',     gender: 'm', age: 'young',race: 'black'  },
  { file: 'young-asian-female.jpg',  gender: 'f', age: 'young',race: 'asian'  },
  { file: 'midage-white-man.png',    gender: 'm', age: 'mid',  race: 'white'  },
];
let _photoIndex = 0;
function getNextCandidatePhoto(){ return REAL_CANDIDATE_PHOTOS[_photoIndex++ % REAL_CANDIDATE_PHOTOS.length]; }

function renderCandidatePhoto(photoFile, size=34){
  return `<img src="${photoFile}" width="${size}" height="${size}" style="border-radius:50%;object-fit:cover;object-position:top center;display:block" alt="candidate">`;
}

function randomisedAICandidates(party){
  _photoIndex = 0; // reset so each game gets a fresh rotation
  const pool = party==='dem' ? [...NAME_POOL_DEM] : [...NAME_POOL_REP];
  const base  = party==='dem' ? DEM_AI : REP_AI;
  // Shuffle pool
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return base.map((b,i)=>{
    const n = pool[i] || pool[0];
    const title = TITLE_POOL[Math.floor(Math.random()*TITLE_POOL.length)];
    const photo = getNextCandidatePhoto();
    return {...b, name:`${title} ${n.first[0]}. ${n.last}`, _firstName:n.first, _lastName:n.last,
            _portrait:generatePortraitData(), _photoFile:photo.file};
  });
}

// ---------------------------------------------------------------
//  SVG CANDIDATE PORTRAIT GENERATOR
// ---------------------------------------------------------------
const PORTRAIT_SKIN = ['#f5c5a3','#e8a87c','#c68642','#8d5524','#4a2c17','#ffe0bd','#ffcd94'];
const PORTRAIT_HAIR = ['#1a0a00','#3b1f0a','#6b3a2a','#8b6914','#c4a35a','#d4d4d4','#f0f0f0','#e63030'];
const PORTRAIT_SUIT = ['#1e3a5f','#0f2d40','#2d1f3d','#1a2d1a','#3d1a1a','#2a2a2a','#1f3d2d'];
const PORTRAIT_TIE  = ['#c8a84b','#ef4444','#3b82f6','#22c55e','#a78bfa','#f97316'];

function generatePortraitData(){
  return {
    skin: PORTRAIT_SKIN[Math.floor(Math.random()*PORTRAIT_SKIN.length)],
    hair: PORTRAIT_HAIR[Math.floor(Math.random()*PORTRAIT_HAIR.length)],
    suit: PORTRAIT_SUIT[Math.floor(Math.random()*PORTRAIT_SUIT.length)],
    tie:  PORTRAIT_TIE[Math.floor(Math.random()*PORTRAIT_TIE.length)],
    gender: Math.random()>0.45?'m':'f',
    face: Math.floor(Math.random()*4), // 0-3 face shape variants
  };
}

function renderPortraitSVG(pd, size=34){
  if(!pd) pd = generatePortraitData();
  const {skin,hair,suit,tie,gender,face} = pd;
  const isFem = gender==='f';
  // Face width variants
  const fw = [22,20,24,21][face];
  const fh = [26,28,25,27][face];
  const cx = 17, cy = 19;
  // Suit collar Y
  const collarY = cy + fh/2 - 1;

  const hairStyles = isFem ? [
    // fem style 0: shoulder length
    `<ellipse cx="${cx}" cy="${cy-fh/2+2}" rx="${fw/2+5}" ry="8" fill="${hair}"/>
     <rect x="${cx-fw/2-4}" y="${cy-fh/2-1}" width="5" height="18" rx="2" fill="${hair}"/>
     <rect x="${cx+fw/2-1}" y="${cy-fh/2-1}" width="5" height="18" rx="2" fill="${hair}"/>`,
    // fem style 1: bun
    `<ellipse cx="${cx}" cy="${cy-fh/2+1}" rx="${fw/2+3}" ry="6" fill="${hair}"/>
     <circle cx="${cx}" cy="${cy-fh/2-5}" r="5" fill="${hair}"/>`,
    // fem style 2: short
    `<ellipse cx="${cx}" cy="${cy-fh/2+2}" rx="${fw/2+2}" ry="7" fill="${hair}"/>`,
  ] : [
    // male style 0: parted
    `<ellipse cx="${cx-1}" cy="${cy-fh/2+1}" rx="${fw/2+1}" ry="6" fill="${hair}"/>`,
    // male style 1: receding
    `<ellipse cx="${cx}" cy="${cy-fh/2+3}" rx="${fw/2-1}" ry="4" fill="${hair}"/>`,
    // male style 2: full
    `<ellipse cx="${cx}" cy="${cy-fh/2+1}" rx="${fw/2+2}" ry="7" fill="${hair}"/>`,
  ];
  const hairSVG = hairStyles[face % hairStyles.length];

  // Neck/shoulders/suit
  const shoulders = `
    <rect x="${cx-16}" y="${collarY+4}" width="32" height="16" rx="3" fill="${suit}"/>
    <rect x="${cx-4}" y="${collarY}" width="8" height="8" fill="${skin}"/>
    ${isFem
      ? `<polygon points="${cx},${collarY+5} ${cx-5},${collarY+2} ${cx+5},${collarY+2}" fill="${suit}" opacity=".8"/>`
      : `<polygon points="${cx},${collarY+8} ${cx-4},${collarY+1} ${cx-7},${collarY+4}" fill="white" opacity=".9"/>
         <polygon points="${cx},${collarY+8} ${cx+4},${collarY+1} ${cx+7},${collarY+4}" fill="white" opacity=".9"/>
         <polygon points="${cx-1},${collarY+3} ${cx+1},${collarY+3} ${cx},${collarY+10}" fill="${tie}"/>`
    }`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34" width="${size}" height="${size}">
    <rect width="34" height="34" fill="#161b26"/>
    ${shoulders}
    ${hairSVG}
    <ellipse cx="${cx}" cy="${cy}" rx="${fw/2}" ry="${fh/2}" fill="${skin}"/>
    <ellipse cx="${cx-5}" cy="${cy-1}" rx="2.5" ry="2" fill="white"/>
    <ellipse cx="${cx+5}" cy="${cy-1}" rx="2.5" ry="2" fill="white"/>
    <circle cx="${cx-5}" cy="${cy-1}" r="1.2" fill="#2a1a0a" opacity=".85"/>
    <circle cx="${cx+5}" cy="${cy-1}" r="1.2" fill="#2a1a0a" opacity=".85"/>
    ${isFem
      ? `<path d="M${cx-3},${cy+5} q3,3 6,0" stroke="#c47a7a" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
      : `<path d="M${cx-3},${cy+5} q3,2 6,0" stroke="#a05050" stroke-width="1" fill="none" stroke-linecap="round"/>`
    }
    <line x1="${cx-2}" y1="${cy+1}" x2="${cx+2}" y2="${cy+1}" stroke="${skin}" stroke-width="2.5" opacity=".6"/>
  </svg>`;
}

// ---------------------------------------------------------------
//  FACTION BLOCS SYSTEM
// ---------------------------------------------------------------
const FACTION_DEFS = {
  dem: [
    { id:'progressives', icon:'✊', name:'Progressives',
      desc:'Demand bold action on climate, healthcare, and inequality.',
      color:'#22d3ee',
      loyaltyBase:72, turnoutBase:68,
      likeActions:['rally','coalition','media'],
      dislikeActions:['fundraise','negotiate'],
      stayHomeThreshold:40, // loyalty below this → risk staying home
      stayHomeEffect:-0.08, // general turnout multiplier when they stay home
      boostOnMax:['favorability',2], // bonus when loyalty ≥ 85
    },
    { id:'moderates', icon:'-', name:'Moderates',
      desc:'Prioritise electability. Spooked by radical-seeming moves.',
      color:'#60a5fa',
      loyaltyBase:65, turnoutBase:72,
      likeActions:['fundraise','negotiate','ads'],
      dislikeActions:['rally'],
      stayHomeThreshold:35, stayHomeEffect:-0.06,
      boostOnMax:['electability',3],
    },
    { id:'suburban', icon:'---', name:'Suburban Voters',
      desc:'Swing-heavy. Respond to kitchen-table economic issues.',
      color:'#a78bfa',
      loyaltyBase:55, turnoutBase:75,
      likeActions:['ads','fundraise','targetState'],
      dislikeActions:['coalition'],
      stayHomeThreshold:30, stayHomeEffect:-0.07,
      boostOnMax:['electability',2],
    },
    { id:'youth', icon:'🎓', name:'Young Voters',
      desc:'High enthusiasm but low turnout unless energised.',
      color:'#84cc16',
      loyaltyBase:60, turnoutBase:45,
      likeActions:['rally','media','coalition'],
      dislikeActions:['fundraise'],
      stayHomeThreshold:45, stayHomeEffect:-0.10,
      boostOnMax:['groundGame',3],
    },
  ],
  rep: [
    { id:'maga', icon:'🔥', name:'MAGA Base',
      desc:'Energetic core. Demands loyalty. Punishes moderation harshly.',
      color:'#ef4444',
      loyaltyBase:80, turnoutBase:82,
      likeActions:['rally','media'],
      dislikeActions:['negotiate','fundraise'],
      stayHomeThreshold:55, stayHomeEffect:-0.12,
      boostOnMax:['favorability',3],
    },
    { id:'fiscal', icon:'💰', name:'Fiscal Conservatives',
      desc:'Want tax cuts and spending discipline. Cold to culture wars.',
      color:'#38bdf8',
      loyaltyBase:65, turnoutBase:70,
      likeActions:['fundraise','ads','negotiate'],
      dislikeActions:['rally'],
      stayHomeThreshold:38, stayHomeEffect:-0.06,
      boostOnMax:['electability',2],
    },
    { id:'evangelical', icon:'--', name:'Evangelicals',
      desc:'Mobilise en masse when values are affirmed. Sit out if ignored.',
      color:'#c084fc',
      loyaltyBase:75, turnoutBase:78,
      likeActions:['rally','coalition'],
      dislikeActions:['ads','media'],
      stayHomeThreshold:50, stayHomeEffect:-0.09,
      boostOnMax:['groundGame',4],
    },
    { id:'subRepublican', icon:'---', name:'Suburban Republicans',
      desc:'Moderate GOPers. Repelled by extreme rhetoric.',
      color:'#fb923c',
      loyaltyBase:58, turnoutBase:74,
      likeActions:['ads','negotiate','fundraise'],
      dislikeActions:['rally','media'],
      stayHomeThreshold:32, stayHomeEffect:-0.05,
      boostOnMax:['electability',3],
    },
  ],
};

// GS.factions = { progressives:{loyalty:72, turnout:68}, ... }
// Faction ideal ideology (0=far left, 100=far right):
const FACTION_IDEAL_IDEOLOGY = {
  // DEM factions: 0=progressive, 100=conservative
  progressives: 15,   // far left
  moderates:    60,   // centre-left to moderate
  suburban:     55,   // centre
  youth:        25,   // left-leaning
  // REP factions: 0=moderate, 100=MAGA
  maga:         90,   // populist/far right
  fiscal:       45,   // moderate conservative
  evangelical:  70,   // socially conservative
  subRepublican:35,   // moderate GOP
};

function initFactions(){
  const defs = FACTION_DEFS[GS.playerParty] || FACTION_DEFS.dem;
  const playerIdeo = GS.playerIdeology || 50;
  GS.factions = {};
  defs.forEach(f=>{
    const idealIdeo = FACTION_IDEAL_IDEOLOGY[f.id] ?? 50;
    // Distance from faction's ideal ideology (0-100 scale)
    const ideoDist = Math.abs(playerIdeo - idealIdeo);
    // Scale loyalty: max dist=70+ means very low loyalty, dist=0 means full base loyalty
    const ideoPenalty = Math.min(ideoDist / 70, 1) * 35; // up to -35 pts from loyalty base
    const adjustedBase = cl(f.loyaltyBase - ideoPenalty, 20, 95);
    GS.factions[f.id] = {
      loyalty:  adjustedBase + G(0,4),
      turnout:  cl(f.turnoutBase - ideoPenalty * 0.5 + G(0,4), 20, 100),
    };
  });
}

function getFactionDefs(){ return FACTION_DEFS[GS.playerParty] || FACTION_DEFS.dem; }

function renderFactions(){
  const panel = document.getElementById('faction-panel');
  const list  = document.getElementById('faction-list');
  const turnoutEl = document.getElementById('faction-turnout-label');
  if(!panel || !list) return;

  if(!GS.factions){ panel.style.display='none'; return; }
  panel.style.display='';

  const defs = getFactionDefs();
  let totalTurnoutEffect = 0;
  let atRiskCount = 0;

  list.innerHTML = defs.map(def=>{
    const fs = GS.factions[def.id] || {loyalty:def.loyaltyBase, turnout:def.turnoutBase};
    const loyalty = Math.round(cl(fs.loyalty, 0, 100));
    const turnout = Math.round(cl(fs.turnout, 0, 100));
    const atRisk = loyalty < def.stayHomeThreshold;
    const riskLevel = loyalty < def.stayHomeThreshold*0.7 ? 'high'
                    : loyalty < def.stayHomeThreshold     ? 'med' : 'low';
    if(atRisk) atRiskCount++;
    totalTurnoutEffect += (turnout - 60) * 0.005; // net effect on general

    const loyaltyColor = loyalty >= 70 ? '#22c55e' : loyalty >= 50 ? '#fb923c' : '#ef4444';

    return `<div class="faction-item${atRisk?' warning':''}">
      <div class="fi-header">
        <span class="fi-icon">${def.icon}</span>
        <span class="fi-name">${def.name}</span>
        <span class="fi-loyalty" style="color:${loyaltyColor}">${loyalty}%</span>
      </div>
      <div class="fi-bars">
        <div class="fi-bar-row">
          <span class="fi-bar-label">Loyalty</span>
          <div class="fi-bar-track"><div class="fi-bar-fill" style="width:${loyalty}%;background:${loyaltyColor}"></div></div>
        </div>
        <div class="fi-bar-row">
          <span class="fi-bar-label">Turnout</span>
          <div class="fi-bar-track"><div class="fi-bar-fill" style="width:${turnout}%;background:${def.color}"></div></div>
        </div>
      </div>
      ${atRisk ? `<span class="fi-risk-tag ${riskLevel}">⚠ Risk: staying home</span>` : `<span class="fi-risk-tag low">✓ Engaged</span>`}
    </div>`;
  }).join('');

  // Turnout summary label
  const sign = totalTurnoutEffect >= 0 ? '+' : '';
  if(turnoutEl) turnoutEl.textContent = `Turnout: ${sign}${(totalTurnoutEffect*100).toFixed(1)}%`;
}

// Called each week — factions shift based on action taken
function updateFactions(actionId){
  if(!GS.factions) return;
  const defs = getFactionDefs();
  defs.forEach(def=>{
    const fs = GS.factions[def.id];
    if(!fs) return;
    // Natural drift toward base ±noise
    const drift = (def.loyaltyBase - fs.loyalty) * 0.07 + G(0, 2);
    fs.loyalty = cl(fs.loyalty + drift, 10, 100);
    // Action effect
    if(def.likeActions.includes(actionId))    fs.loyalty = cl(fs.loyalty + G(5,2), 10, 100);
    if(def.dislikeActions.includes(actionId)) fs.loyalty = cl(fs.loyalty - G(4,2), 10, 100);
    // Turnout tracks loyalty with lag
    fs.turnout = cl(fs.turnout + (fs.loyalty - fs.turnout)*0.12 + G(0,1.5), 20, 100);
    // At-max bonus
    if(fs.loyalty >= 85 && def.boostOnMax){
      const [stat, bonus] = def.boostOnMax;
      if(stat==='favorability') GS.favorability = cl(GS.favorability+bonus*0.15, 20, 85);
      if(stat==='electability') GS.electability = cl(GS.electability+bonus*0.15, 20, 100);
      if(stat==='groundGame')   GS.groundGame   = cl(GS.groundGame  +bonus*0.15, 0,  100);
    }
  });
}

// Compute faction turnout penalty applied to general election final EV
function getFactionTurnoutMultiplier(){
  if(!GS.factions) return 1;
  const defs = getFactionDefs();
  let mult = 1;
  defs.forEach(def=>{
    const fs = GS.factions[def.id];
    if(!fs) return;
    if(fs.loyalty < def.stayHomeThreshold){
      mult += def.stayHomeEffect; // negative: reduces overall turnout
    }
  });
  return cl(mult, 0.6, 1.15);
}

// ---------------------------------------------------------------
//  POLITICAL AD GENERATOR
// ---------------------------------------------------------------
const AD_TYPES = [
  { id:'bio',    label:'🧑 Bio Spot',      cost:4, tag:'biography' },
  { id:'attack', label:'⚔- Attack Ad',     cost:5, tag:'attack'    },
  { id:'issue',  label:'📋 Issue Ad',      cost:4, tag:'issue'     },
  { id:'fear',   label:'😨 Fear Appeal',   cost:5, tag:'fear'      },
  { id:'hope',   label:'🌅 Hope Spot',     cost:3, tag:'hope'      },
  { id:'record', label:'📜 Record Ad',     cost:4, tag:'record'    },
];

let _currentAdType = null;
let _currentAdScript = null;

function openAdModal(){
  _currentAdType = null;
  _currentAdScript = null;
  const grid = document.getElementById('ad-type-grid');
  if(grid){
    grid.innerHTML = AD_TYPES.map(a=>`
      <button class="ad-type-btn" onclick="selectAdType('${a.id}')" id="ad-btn-${a.id}">${a.label}<br><span style="color:var(--text3);font-size:8px">−$${a.cost}M</span></button>
    `).join('');
  }
  document.getElementById('ad-script-box').textContent = 'Select an ad type above to generate a script.';
  document.getElementById('ad-cost-label').textContent = '';
  const runBtn = document.getElementById('ad-run-btn');
  if(runBtn) runBtn.style.display = 'none';
  document.getElementById('ad-modal').classList.add('active');
}

function selectAdType(typeId){
  _currentAdType = AD_TYPES.find(a=>a.id===typeId);
  document.querySelectorAll('.ad-type-btn').forEach(b=>b.classList.remove('sel'));
  const btn = document.getElementById(`ad-btn-${typeId}`);
  if(btn) btn.classList.add('sel');
  generateAdScript();
}

function generateAdScript(){
  if(!_currentAdType) return;
  const name    = GS.playerName || 'Alex Morgan';
  const party   = GS.playerPartyLabel || (GS.playerParty==='dem' ? 'Democratic' : 'Republican');
  const opp     = (GS.opponent?.name) || 'the opponent';
  const oppLast = opp.split(' ').slice(-1)[0];
  const last    = name.split(' ').slice(-1)[0];
  const state   = GS.targetState || (GS.homeState ? getStateName(GS.homeState) : 'America');
  const issue   = ['healthcare','the economy','education','national security','immigration','climate change'][Math.floor(Math.random()*6)];
  const flaw    = ['failed record','broken promises','special interest donors','Washington insiders','weak leadership','reckless spending'][Math.floor(Math.random()*6)];
  const value   = ['hardworking families','veterans','small business owners','our children','the middle class','working Americans'][Math.floor(Math.random()*6)];

  const scripts = {
    bio: [
      `[SOFT MUSIC]\n\nNarrator: "${name} didn't come from privilege. Growing up in ${state}, they learned early that nothing comes easy.\n\nBut ${last} never stopped fighting — for ${value}, for a better future, and for the America we know is possible.\n\n${name} for President. A leader who knows what it means to earn it.\n\n[FADE TO FLAG]"`,
      `[ACOUSTIC GUITAR]\n\nNeighbour: "I have known ${last} for years. The thing about them is they actually listen. They came to our town hall, sat down, and heard us out."\n\nNarrator: "${name}. A leader for ${value}. Paid for by ${name} for America."`,
    ],
    attack: [
      `[OMINOUS DRUMS]\n\nNarrator: "${oppLast} voted against ${value}. Eleven times.\n\n${oppLast} took millions from ${flaw}.\n\nNow ${oppLast} wants your vote. The same people who funded ${oppLast} career funded by special interests — that debt comes due on day one.\n\nAmerica cannot afford ${oppLast}.\n\n[PHOTO FADES TO BLACK]"`,
      `[TENSE MUSIC]\n\nOn-screen text scrolls: "${oppLast}'s ${flaw}..."\n\nNarrator: "When ${oppLast} had the chance to stand with ${value}, they chose their donors. Every single time. Can we really trust ${oppLast} with the Oval Office?\n\nPaid for by ${name} for America."`,
    ],
    issue: [
      `[UPBEAT PIANO]\n\nNarrator: "The cost of ${issue} is rising. ${value} are being squeezed.\n\nBut ${name} has a plan: transparent, achievable, and built for real people — not lobbyists.\n\n${last}'s plan on ${issue}: already supported by leading experts, and it will not cost ${value} a penny more.\n\n${name} for America."`,
      `[MONTAGE OF FAMILIES]\n\nVoice of ${last}: "When I talk to people in ${state} about ${issue}, I hear the same thing: we need action, not excuses.\n\nHere's my commitment to you: real reform on ${issue} in my first 100 days. Or I haven't done my job.\n\n[END CARD: ${name} for President]"`,
    ],
    fear: [
      `[STORM SOUNDS]\n\nNarrator: "The world is more dangerous than it has been in decades. Our adversaries are watching. Our allies are waiting.\n\nCan we afford a president who blinks?\n\nOnly ${name} has the experience — and the backbone — to keep America safe.\n\nDo not gamble with your family security.\n\n[LOGO]"`,
      `[SLOW HEARTBEAT]\n\nNarrator: "If ${oppLast} wins: ${flaw} in the White House. Decisions made by people who do not share your values.\n\nOr — you could choose a leader who will fight for ${value} every single day.\n\nThe choice is yours. Make it count. Vote ${last}."`,
    ],
    hope: [
      `[SUNRISE VISUALS]\n\nNarrator: "Somewhere in ${state}, a family is sitting around the kitchen table, wondering if tomorrow can be better than today.\n\n${name} believes the answer is yes.\n\nBecause when ${value} are given a real shot, there is nothing — nothing — we cannot achieve together.\n\n${name} for President. A brighter tomorrow, starting now."`,
      `[CHILDREN PLAYING]\n\nVoice of ${last}: "I am running for president because I still believe in the America my parents told me about — where if you work hard and play by the rules, you get a fair shot.\n\nLet's build that America again. Together.\n\n[LOGO: ${name} for America]"`,
    ],
    record: [
      `[ARCHIVE FOOTAGE B-ROLL]\n\nNarrator: "Seventeen years in public service. Three major bills signed into law. Named one of the most effective legislators by non-partisan watchdogs.\n\nThat's not a promise. That's a record.\n\n${name}: results, not rhetoric."`,
      `[TESTIMONIALS]\n\nVoter 1: "When ${last} said they'd fix it, they actually fixed it."\nVoter 2: "I was sceptical. Then I saw what they did for our community."\n\nNarrator: "Talk is cheap. ${name}'s record speaks for itself.\n\nPaid for by ${name} for America."`,
    ],
  };

  const pool = scripts[_currentAdType.id] || scripts.bio;
  _currentAdScript = pool[Math.floor(Math.random()*pool.length)];
  document.getElementById('ad-script-box').textContent = _currentAdScript;
  document.getElementById('ad-cost-label').textContent = `Cost to run: $${_currentAdType.cost}M`;
  const runBtn = document.getElementById('ad-run-btn');
  if(runBtn){
    runBtn.style.display = GS.funds >= _currentAdType.cost ? 'block' : 'none';
    runBtn.textContent = `▶ Run This Ad (−$${_currentAdType.cost}M)`;
  }
}

function getStateName(code){
  const m = {'PA':'Pennsylvania','OH':'Ohio','MI':'Michigan','FL':'Florida','TX':'Texas','CA':'California','NY':'New York','GA':'Georgia','AZ':'Arizona','WI':'Wisconsin','MN':'Minnesota','CO':'Colorado','VA':'Virginia','NC':'North Carolina','NV':'Nevada'};
  return m[code] || code;
}

function runGeneratedAd(){
  if(!_currentAdType || GS.funds < _currentAdType.cost) return;
  GS.funds -= _currentAdType.cost;
  GS.totalSpent = (GS.totalSpent||0) + _currentAdType.cost;
  // Apply ad effects
  const t = _currentAdType.tag;
  if(t==='biography' || t==='hope')   { GS.favorability=cl(GS.favorability+G(2,1.2),20,85); GS.electability=cl(GS.electability+G(1,0.8),20,100); }
  if(t==='attack')                    { GS.momentum=cl(GS.momentum+G(1,0.5),-20,20); GS.mediaCoverage=cl(GS.mediaCoverage+G(3,1.5),0,100); }
  if(t==='issue')                     { GS.favorability=cl(GS.favorability+G(1.5,1),20,85); updateFactions(GS.selectedAction||'ads'); }
  if(t==='fear')                      { GS.momentum=cl(GS.momentum+G(1.5,0.8),-20,20); }
  if(t==='record')                    { GS.electability=cl(GS.electability+G(2,1),20,100); }
  addNews(`${GS.playerName} launches new "${AD_TYPES.find(a=>a.tag===t)?.label.replace(/[^a-zA-Z ]/g,'').trim()}" campaign ad`,'campaign');
  renderAll();
  closeModal('ad-modal');
}

function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active')}

// -------------------------------------------------------
//  AUDIO CONTROLLER
// -------------------------------------------------------
let _muted = false;
let _musicStarted = false;

function startMusic(){
  if(_musicStarted) return;
  const bgm = document.getElementById('bg-music');
  if(!bgm) return;
  bgm.volume = 0.12;
  bgm.play().then(()=>{ _musicStarted=true; }).catch(()=>{});
}
function toggleMute(){
  _muted = !_muted;
  const bgm = document.getElementById('bg-music');
  if(bgm) bgm.muted = _muted;
  const icon = _muted ? '🔇' : '🔊';
  ['mute-btn','mute-btn-conv','mute-btn-vp','mute-btn-en'].forEach(id=>{
    const el=document.getElementById(id); if(el){ el.textContent=icon; el.classList.toggle('muted',_muted); }
  });
}
document.addEventListener('click',   startMusic, {once:true});
document.addEventListener('touchend', startMusic, {once:true});

// -------------------------------------------------------
//  TUTORIAL SYSTEM  (mode-aware: Buttons vs AI Advisor)
//  Steps are built fresh each time startTutorial() fires,
//  reading window.POTUS_AI_MODE at that moment.
// -------------------------------------------------------

function getTutSteps(){
  const isAI = (window.POTUS_AI_MODE || 'buttons') !== 'buttons';

  // ── AI ADVISOR MODE TUTORIAL ──────────────────────────────────────────────
  if(isAI) return [
    {
      title: '🇺🇸 Welcome, Candidate',
      body:  'You\'re running for President of the United States. Every week you\'ll make strategic decisions, react to events, and battle opponents — all the way to Election Night.',
      target: null,
      wide: true,
    },
    {
      title: '✨ You Have an AI Campaign Advisor',
      body:  'In this mode, your AI Campaign Advisor runs strategy for you through a chat interface. It reads your live polling numbers, map, and stats — and turns plain English into campaign actions.',
      target: '#ai-advisor-box',
      side:  'left',
      highlight: true,
    },
    {
      title: '💬 How to Give Orders — Type in the Box',
      body:  'See the text box at the bottom of the advisor panel? Type what you want to do there and press GO or Enter. The advisor understands natural language — you don\'t need to memorise commands.',
      target: '#ai-chat-input',
      side:  'left',
      highlight: true,
    },
    {
      title: '📣 Example: Do a Campaign Rally',
      body:  'Try typing: "Rally in Pennsylvania" or "Campaign in Ohio" — the advisor will read your map, give strategy advice, and show you a ✓ Do it chip. Click the chip to queue the action.',
      target: '#ai-chat-log',
      side:  'left',
      tip: '💡 Tip: Always name a state for rallies, grassroots, and town halls.',
    },
    {
      title: '💰 Example: Fundraise or Ask for Advice',
      body:  'You can also type "Fundraise", "What\'s my best move?", or "Where should I focus?" — the advisor gives you clickable suggestion chips for the top actions it recommends right now.',
      target: '#ai-chat-chips',
      side:  'left',
      tip: '💡 Fundraising is slower than it looks — don\'t over-rely on it. Mix up your strategy.',
    },
    {
      title: '✅ Confirm With End Week →',
      body:  'Once you click a ✓ Do it chip, the action lights up. Then press "End Week →" to execute it. Events fire, your opponent campaigns, polls shift, and the week advances.',
      target: '.next-week-btn',
      side:  'right',
      highlight: true,
    },
    {
      title: '⚠- Variety Matters — Don\'t Get Boring',
      body:  'If you repeat the same 1–2 actions the whole campaign, voters and donors switch off. Pundits will slam your "one-note campaign" and you\'ll take real polling hits. Mix it up.',
      target: null,
      wide: true,
    },
    {
      title: '📊 Your Four Core Stats',
      body:  'Favorability, Electability, Ground Game, and Media Coverage update each week. Ask the advisor about any of them — it reads the live numbers and tells you what\'s most urgent.',
      target: '.stat-bars',
      side:  'right',
    },
    {
      title: '🗺 The Electoral Map',
      body:  'The map shows your polling lead vs the opponent in every state. Gold = you winning, grey = tossup. Focus your actions on the grey states — deep safe states barely move no matter what.',
      target: '.map-container',
      side:  'below',
    },
    {
      title: '💵 Topbar — Keep an Eye on Funds',
      body:  'Week, Funds, Momentum, and Approval live up here. Momentum multiplies every action — keep it positive. Funds run out faster than you expect, especially in the general.',
      target: '.topbar-stats',
      side:  'below',
    },
    {
      title: '-- Primary → Convention → General',
      body:  'Win enough primary delegates, survive the convention, choose your VP running mate, then battle the other party\'s nominee. You need 270 Electoral Votes to win the White House.',
      target: '.phase-indicator',
      side:  'below',
    },
    {
      title: '🎯 Start Your First Week',
      body:  'Ask the advisor "What\'s my best move?" to get personalised suggestions, or go straight to "Rally in [state]" to get on the board. Good luck, Candidate.',
      target: '#ai-advisor-box',
      side:  'left',
      highlight: true,
    },
  ];

  // ── CLASSIC / BUTTONS MODE TUTORIAL ──────────────────────────────────────
  return [
    {
      title: '🇺🇸 Welcome to POTUS',
      body:  'You\'re running for President of the United States. Each week you pick one action from the grid, press End Week, and react to what happens — all the way to Election Night.',
      target: null,
      wide: true,
    },
    {
      title: '📊 Your Four Core Stats',
      body:  'Watch these bars carefully. Favorability determines if voters like you. Electability shows how presidential you seem. Ground Game drives turnout. Media Coverage stops you being forgotten.',
      target: '.stat-bars',
      side:  'right',
    },
    {
      title: '⚡ Pick One Action Per Week',
      body:  'The action grid is your weekly decision. Each card shows cost, effect, and outcomes. Hover over a card to read what it does before clicking. Some trigger minigames — quick skill tests that boost results.',
      target: '.actions-grid',
      side:  'right',
      highlight: true,
    },
    {
      title: '🎯 Variety Is Essential',
      body:  'If you repeat the same action every week — say, Fundraise and Rally on repeat — a "Boring Campaign" event fires at the halfway point. It hits your favorability, momentum, media, and war chest hard. Mix it up.',
      target: '.actions-grid',
      side:  'right',
      tip: '💡 Use at least 3 different action types per phase to avoid the penalty.',
    },
    {
      title: '- State Target Actions',
      body:  'Actions with a state icon - need you to pick a target state from this dropdown. Focus on tossup states within ±5–14 points — deep-safe states barely move even with perfect campaigning.',
      target: '#state-target-section',
      side:  'right',
    },
    {
      title: '-- End Week → Execute',
      body:  'Press "End Week →" to lock in your choice. Your opponent campaigns, events fire, and polls shift. You cannot undo — choose carefully. Press N as a keyboard shortcut.',
      target: '.next-week-btn',
      side:  'right',
      highlight: true,
    },
    {
      title: '🗺 The Electoral Map',
      body:  'Gold states = you leading. Grey = tossup. Red/blue = opponent leading. In the General, projected EV starts low — only safe states count early. Tossups don\'t get called until election night.',
      target: '.map-container',
      side:  'below',
    },
    {
      title: '💵 Topbar — Critical Numbers',
      body:  'Keep Funds above $10M going into the general or you\'ll struggle to afford key actions. Momentum is a force multiplier — let it go deeply negative and every action gets weaker.',
      target: '.topbar-stats',
      side:  'below',
    },
    {
      title: '💰 Fundraising Is Slower Now',
      body:  'Fundraising drives bring in $1.5–4M — not the easy money it once was. Don\'t burn weeks fundraising when you should be moving states. Balance your war chest against your polling needs.',
      target: null,
      wide: true,
      tip: '💡 Use the Call List Drive minigame for a quick boost without sacrificing as much momentum.',
    },
    {
      title: '- Primary Opponents',
      body:  'Each AI rival has an archetype — Populist, Progressive, Moderate, Law & Order — shaping who they target. Attack the frontrunner early. Protect your base states. Win delegates, not just polls.',
      target: '.ai-candidates',
      side:  'right',
    },
    {
      title: '-- Primary → Convention → General',
      body:  'First: win your party primary by collecting delegates. Then: survive the convention and pick your VP. Finally: beat the other party nominee to 270 Electoral Votes on Election Night.',
      target: '.phase-indicator',
      side:  'below',
    },
    {
      title: '🎯 Ready to Run',
      body:  'Start with a Campaign Rally in a competitive state or a Fundraising Drive if funds are low. Check your map, pick your action, and press End Week. America is watching.',
      target: '.next-week-btn',
      side:  'right',
      highlight: true,
    },
  ];
}

// Active tutorial steps for the current session (set when tutorial starts)
let _activeTutSteps = [];
let _tutStep = 0;
let _tutActive = false;
let _tutPending = false;

function hasDoneTutorial(){
  try { return !!localStorage.getItem('potus_tut_done'); } catch(e){ return false; }
}
function setTutDone(){
  try { localStorage.setItem('potus_tut_done','1'); } catch(e){}
}

function updateTutInfoBox(){
  const box = document.getElementById('tut-info-box');
  if(!box) return;
  const done = hasDoneTutorial();
  const isAI = (window.POTUS_AI_MODE || 'buttons') !== 'buttons';
  document.getElementById('tut-info-text').textContent = done
    ? 'Tutorial completed. Reset to show it again on your next new game.'
    : `Tutorial will play automatically on your first new game (${isAI ? 'AI Advisor' : 'Classic'} mode).`;
  const resetBtn = document.getElementById('tut-reset-btn');
  const skipBtn2 = document.getElementById('tut-skip-perm-btn');
  if(resetBtn) resetBtn.style.display = done ? 'block' : 'none';
  if(skipBtn2) skipBtn2.style.display = done ? 'none' : 'block';
}
function resetTutorial(){
  try { localStorage.removeItem('potus_tut_done'); } catch(e){}
  updateTutInfoBox();
}
function skipTutorialPermanently(){
  setTutDone();
  updateTutInfoBox();
}

function startTutorial(){
  _activeTutSteps = getTutSteps(); // build steps NOW, so mode is read at game-start time
  _tutStep   = 0;
  _tutActive = true;
  document.getElementById('tut-overlay').classList.add('active');
  positionTutCard();
}
function endTutorial(){
  _tutActive = false;
  document.getElementById('tut-overlay').classList.remove('active');
  document.getElementById('tut-spotlight').style.display = 'none';
  setTutDone();
  updateTutInfoBox();
}
function tutNext(){
  _tutStep++;
  if(_tutStep >= _activeTutSteps.length){ endTutorial(); return; }
  positionTutCard();
}

// Core positioning — called on render AND on scroll/resize
function positionTutCard(){
  if(!_tutActive) return;
  const step  = _activeTutSteps[_tutStep];
  const total = _activeTutSteps.length;
  const card  = document.getElementById('tut-card');
  const spot  = document.getElementById('tut-spotlight');

  // Update text content
  document.getElementById('tut-eyebrow').textContent = `Step ${_tutStep+1} of ${total}`;
  document.getElementById('tut-title').textContent   = step.title;
  document.getElementById('tut-body').textContent    = step.body;
  document.getElementById('tut-next-btn').textContent = _tutStep === total-1 ? '✓ Start Playing' : 'Next →';
  document.getElementById('tut-dots').innerHTML =
    _activeTutSteps.map((_,i) => `<div class="tut-dot${i===_tutStep?' on':''}"></div>`).join('');

  // Tip line (optional)
  let tipEl = document.getElementById('tut-tip');
  if(step.tip){
    if(!tipEl){
      tipEl = document.createElement('div');
      tipEl.id = 'tut-tip';
      tipEl.style.cssText = 'margin-top:10px;padding:8px 10px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.25);border-radius:6px;font-family:var(--font-mono,monospace);font-size:10px;color:#c8a84b;line-height:1.5';
      document.getElementById('tut-body').after(tipEl);
    }
    tipEl.textContent = step.tip;
    tipEl.style.display = 'block';
  } else if(tipEl){
    tipEl.style.display = 'none';
  }

  if(!step.target){
    spot.style.display = 'none';
    const w = step.wide ? '440px' : '380px';
    card.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:${w}`;
    return;
  }

  const el = document.querySelector(step.target);
  if(!el){ spot.style.display='none'; card.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:380px'; return; }

  el.scrollIntoView({ behavior:'smooth', block:'center', inline:'nearest' });

  // Pulse highlight on the target element
  if(step.highlight){
    el.style.transition = 'box-shadow .3s';
    el.style.boxShadow = '0 0 0 3px rgba(200,168,75,.6), 0 0 20px rgba(200,168,75,.3)';
    setTimeout(()=>{ if(el) el.style.boxShadow = ''; }, 2000);
  }

  setTimeout(()=>{
    if(!_tutActive) return;
    _positionTutSpotlight(el, step, card, spot);
  }, 350);
}

// Inner positioning logic — separated so scroll can settle first
function _positionTutSpotlight(el, step, card, spot){
  const r   = el.getBoundingClientRect();
  const pad = 7;
  const vw  = window.innerWidth, vh = window.innerHeight;

  spot.style.cssText = `
    display:block;position:fixed;
    left:${r.left-pad}px;top:${r.top-pad}px;
    width:${r.width+pad*2}px;height:${r.height+pad*2}px;
    z-index:8901;border-radius:8px;
    border:2px solid var(--accent);
    box-shadow:0 0 0 9999px rgba(0,0,0,.72);
    pointer-events:none;
  `;

  const cardW = step.wide ? 380 : 310, cardH = 240;
  card.style.transform = '';
  card.style.position  = 'fixed';
  card.style.maxWidth  = cardW+'px';

  if(step.side === 'right'){
    const left = Math.min(r.right + 14, vw - cardW - 10);
    const top  = Math.max(Math.min(r.top - 4, vh - cardH - 10), 10);
    card.style.left = left+'px';
    card.style.top  = top+'px';
  } else if(step.side === 'left'){
    // Card appears to the LEFT of the target (used when target is on the right side of screen)
    const left = Math.max(r.left - cardW - 14, 10);
    const top  = Math.max(Math.min(r.top - 4, vh - cardH - 10), 10);
    card.style.left = left+'px';
    card.style.top  = top+'px';
  } else {
    // 'below' — default
    const top  = Math.min(r.bottom + 14, vh - cardH - 10);
    const left = Math.max(Math.min(r.left, vw - cardW - 10), 10);
    card.style.top  = top+'px';
    card.style.left = left+'px';
  }
}

// Re-position spotlight on scroll or resize so it never drifts
window.addEventListener('scroll', ()=>{ if(_tutActive) positionTutCard(); }, {passive:true});
window.addEventListener('resize', ()=>{ if(_tutActive) positionTutCard(); }, {passive:true});
document.addEventListener('scroll', ()=>{ if(_tutActive) positionTutCard(); }, {passive:true, capture:true});

function maybeLaunchTutorial(){
  if(!hasDoneTutorial()){
    setTimeout(startTutorial, 700);
  }
}

// Init info box once DOM ready
document.addEventListener('DOMContentLoaded', ()=>{ updateTutInfoBox(); initDisplayScale(); });

// ── DEV PANEL: Press F7 five times quickly to toggle ──────────────────────
let _f7Count=0, _f7Timer=null;
document.addEventListener('keydown', e=>{
  // ── Escape: close any open modal ──
  if(e.key==='Escape'){
    document.querySelectorAll('.modal-overlay.active').forEach(m=>{
      if(m.id !== 'summary-modal') m.classList.remove('active');
    });
  }
  // ── N: end week shortcut — career mode only (historical mode owns its own listener) ──
  if(e.key==='n' || e.key==='N'){
    if(typeof _histActive !== 'undefined' && _histActive) return; // handled by game-historical.js
    const gameScreenEl = document.getElementById('game-screen');
    const anyModal = document.querySelector('.modal-overlay.active');
    if(gameScreenEl && gameScreenEl.classList.contains('active') && !anyModal && !e.target.matches('input,select,textarea')){
      nextWeek();
    }
  }
  if(e.key==='F7'){
    e.preventDefault();
    _f7Count++;
    clearTimeout(_f7Timer);
    _f7Timer=setTimeout(()=>{ _f7Count=0; }, 2500);
    if(_f7Count>=5){
      _f7Count=0;
      clearTimeout(_f7Timer);
      // Toggle dev panel in whichever screen is active
      const setupDev = document.getElementById('dev-panel');
      const gameDev  = document.getElementById('game-dev-panel');
      const gameScreenEl = document.getElementById('game-screen');
      // Use computed style to reliably detect if game screen is visible
      const gameActive = gameScreenEl && (gameScreenEl.classList.contains('active') || getComputedStyle(gameScreenEl).display !== 'none');
      if(gameActive && gameDev){
        gameDev.style.display = gameDev.style.display==='none'?'block':'none';
        if(gameDev.style.display!=='none') showGameDevInfo();
      } else if(setupDev){
        setupDev.style.display = setupDev.style.display==='none'?'block':'none';
        if(setupDev.style.display!=='none') showDevInfo();
      }
      const p=document.getElementById('potus-p');
      if(p){p.style.opacity='0.3';setTimeout(()=>p.style.opacity='1',200);}
    }
  }
});

// -------------------------------------------------------
//  POLICY PLATFORM SYSTEM
// -------------------------------------------------------
const POLICY_DEFS = {
  economy:{
    label:'Economy', icon:'💵',
    choices:{
      progressive:{
        name:'Progressive',
        hint:'Tax the wealthy · Worker protections · Climate jobs',
        boostStates:['MI','WI','PA','MN','OH'],
        hurtStates:['TX','FL','AZ','GA'],
        enthusiasm:+5, electability:-2,
        debateBonus:2, // vs progressive AI
        desc:'Boosts Rust Belt workers, hurts Sun Belt business voters.',
      },
      moderate:{
        name:'Moderate',
        hint:'Balanced growth · Fiscal discipline · Job creation',
        boostStates:['PA','VA','CO','AZ','NH'],
        hurtStates:[],
        enthusiasm:0, electability:+3,
        debateBonus:1,
        desc:'Broadly acceptable. Strong with suburban swing voters.',
      },
      conservative:{
        name:'Conservative',
        hint:'Tax cuts · Deregulation · Free market',
        boostStates:['TX','FL','OH','IN','MO'],
        hurtStates:['CA','NY','MA','WA'],
        enthusiasm:+3, electability:-1,
        debateBonus:2,
        desc:'Strong with business voters, weaker in blue strongholds.',
      },
    }
  },
  healthcare:{
    label:'Healthcare', icon:'--',
    choices:{
      publicOption:{
        name:'Public Option',
        hint:'Government insurance alongside private plans',
        boostStates:['MI','WI','PA','MN','CO','NV'],
        hurtStates:['TX','FL','OH'],
        enthusiasm:+4, electability:+1,
        debateBonus:2,
        desc:'Popular in Midwest swing states, unpopular in deep South.',
      },
      privateReform:{
        name:'Private Reform',
        hint:'Lower costs, keep private insurance',
        boostStates:['VA','CO','AZ','PA','NH'],
        hurtStates:[],
        enthusiasm:-1, electability:+4,
        debateBonus:1,
        desc:'Highest electability — satisfies moderates on both sides.',
      },
      repeal:{
        name:'Full Repeal',
        hint:'Repeal ACA, return to markets',
        boostStates:['TX','FL','IN','MO','TN'],
        hurtStates:['MI','WI','PA','MN'],
        enthusiasm:+5, electability:-4,
        debateBonus:2,
        desc:'Energises base but damages swing state support significantly.',
      },
    }
  },
  immigration:{
    label:'Immigration', icon:'-',
    choices:{
      open:{
        name:'Open Reform',
        hint:'Pathway to citizenship · DACA protection',
        boostStates:['CA','NY','TX','FL','NV','AZ','CO'],
        hurtStates:['WI','IA','OH','IN'],
        enthusiasm:+5, electability:-2,
        debateBonus:2,
        desc:'Boosts urban Latino voters, hurts rural Midwest.',
      },
      reform:{
        name:'Balanced Reform',
        hint:'Secure borders + legal pathway',
        boostStates:['PA','MI','AZ','CO','VA'],
        hurtStates:[],
        enthusiasm:+1, electability:+3,
        debateBonus:1,
        desc:'Widely acceptable. Slight edge in mixed border-state districts.',
      },
      strict:{
        name:'Strict Enforcement',
        hint:'Border wall · Reduce legal immigration',
        boostStates:['TX','FL','OH','IN','AZ','GA'],
        hurtStates:['CA','NY','NV','CO'],
        enthusiasm:+6, electability:-3,
        debateBonus:3,
        desc:'Strong base motivator. Costs badly in diverse metro states.',
      },
    }
  },
  climate:{
    label:'Climate', icon:'-',
    choices:{
      aggressive:{
        name:'Aggressive Action',
        hint:'Green New Deal · Carbon tax · 100% clean energy',
        boostStates:['CA','WA','CO','MA','MN'],
        hurtStates:['WV','KY','TX','OK','WY'],
        enthusiasm:+6, electability:-2,
        debateBonus:2,
        desc:'Galvanises youth and coastal voters. Costs energy-state support.',
      },
      balanced:{
        name:'Balanced Transition',
        hint:'Gradual clean energy shift, keep jobs',
        boostStates:['PA','MI','WI','CO','VA','NH'],
        hurtStates:[],
        enthusiasm:+2, electability:+3,
        debateBonus:1,
        desc:'Best all-around — wins the climate debate without losing workers.',
      },
      minimal:{
        name:'Minimal Action',
        hint:'Energy independence · Oppose costly mandates',
        boostStates:['TX','WV','KY','IN','OK'],
        hurtStates:['CA','WA','CO','MA'],
        enthusiasm:+3, electability:-2,
        debateBonus:2,
        desc:'Strong in energy-dependent states. Major weakness on coasts.',
      },
    }
  },
  foreignPolicy:{
    label:'Foreign Policy', icon:'🦅',
    choices:{
      hawk:{
        name:'Hawk',
        hint:'Strong military · NATO leadership · Confront adversaries',
        boostStates:['VA','FL','GA','TX','NC'],
        hurtStates:['VT','MA','OR'],
        enthusiasm:+3, electability:+1,
        debateBonus:3,
        desc:'Dominant in debates. Strong with veterans and southern military communities.',
      },
      dovish:{
        name:'Dovish',
        hint:'Diplomacy first · Reduce military spending',
        boostStates:['VT','MA','OR','WA','MN'],
        hurtStates:['VA','FL','TX'],
        enthusiasm:+3, electability:-2,
        debateBonus:1,
        desc:'Energises progressive base but is a liability in hawkish swing states.',
      },
      isolationist:{
        name:'Isolationist',
        hint:'America First · End foreign entanglements',
        boostStates:['IA','OH','WI','MI','WV'],
        hurtStates:['VA','NY','CA','MA'],
        enthusiasm:+5, electability:-1,
        debateBonus:2,
        desc:'Populist appeal in Rust Belt. Seen as weak on global leadership.',
      },
    }
  },
};

// Player's current platform (keys = policy category, value = choice key)
let GS_POLICY = {
  economy:'moderate',
  healthcare:'privateReform',
  immigration:'reform',
  climate:'balanced',
  foreignPolicy:'hawk',
};
// For mid-game modal — staged changes before applying
let _policyStaged = null;

// -----------------------------------------------
// VOTER BLOCS SYSTEM
// 8 hidden national voter blocs — each with a support score (-80 = very Rep, +80 = very Dem)
// Campaign actions shift these blocs; each state has a different % mix.
// -----------------------------------------------
const GS_BLOCS = {
  wc: {name:'Working Class',      icon:'--', support:  5, history:[]},
  ce: {name:'College Educated',   icon:'🎓', support: 15, history:[]},
  sr: {name:'Seniors',            icon:'👴', support: -8, history:[]},
  yv: {name:'Young Voters',       icon:'🧑', support: 25, history:[]},
  sw: {name:'Suburban Women',     icon:'--', support: 10, history:[]},
  rc: {name:'Rural Conservatives',icon:'🌾', support:-35, history:[]},
  up: {name:'Urban Progressives', icon:'🌆', support: 55, history:[]},
  in: {name:'Independents',       icon:'⚖',  support:  0, history:[]},
};

// Per-state bloc weights — % of state electorate each bloc represents
// Rust Belt: high working class; Sun Belt: high suburban women & independents
// Deep South: high rural conservatives & seniors; Pacific: high urban & college
const DEFAULT_BLOC = {wc:17,ce:14,sr:18,yv:12,sw:13,rc:11,up:9,in:6};
const STATE_BLOC_WEIGHTS = {
  // Rust Belt
  PA:{wc:23,ce:14,sr:17,yv:11,sw:13,rc:8,up:9,in:5},
  MI:{wc:24,ce:13,sr:16,yv:13,sw:12,rc:9,up:8,in:5},
  WI:{wc:22,ce:14,sr:18,yv:12,sw:13,rc:10,up:6,in:5},
  OH:{wc:26,ce:12,sr:19,yv:10,sw:11,rc:13,up:5,in:4},
  // Sun Belt swing
  GA:{wc:16,ce:15,sr:15,yv:13,sw:17,rc:8,up:10,in:6},
  AZ:{wc:17,ce:16,sr:18,yv:12,sw:16,rc:9,up:6,in:6},
  FL:{wc:16,ce:14,sr:23,yv:10,sw:14,rc:11,up:7,in:5},
  NC:{wc:19,ce:14,sr:18,yv:12,sw:15,rc:10,up:7,in:5},
  NV:{wc:20,ce:13,sr:15,yv:13,sw:14,rc:7,up:10,in:8},
  // Deep South
  AL:{wc:18,ce:10,sr:21,yv:9,sw:11,rc:20,up:5,in:6},
  MS:{wc:17,ce:9,sr:22,yv:9,sw:11,rc:22,up:5,in:5},
  SC:{wc:18,ce:12,sr:20,yv:10,sw:13,rc:16,up:6,in:5},
  TN:{wc:20,ce:11,sr:21,yv:10,sw:12,rc:17,up:5,in:4},
  KY:{wc:22,ce:10,sr:21,yv:9,sw:11,rc:18,up:4,in:5},
  // Northeast
  NY:{wc:14,ce:19,sr:17,yv:14,sw:14,rc:4,up:14,in:4},
  MA:{wc:13,ce:22,sr:17,yv:15,sw:14,rc:3,up:13,in:3},
  NJ:{wc:15,ce:19,sr:17,yv:13,sw:15,rc:4,up:12,in:5},
  CT:{wc:14,ce:20,sr:18,yv:13,sw:15,rc:4,up:12,in:4},
  MD:{wc:14,ce:20,sr:16,yv:14,sw:14,rc:4,up:14,in:4},
  VA:{wc:15,ce:18,sr:17,yv:13,sw:16,rc:6,up:11,in:4},
  // Pacific
  CA:{wc:13,ce:20,sr:15,yv:15,sw:14,rc:3,up:16,in:4},
  WA:{wc:14,ce:20,sr:16,yv:14,sw:14,rc:5,up:14,in:3},
  OR:{wc:15,ce:18,sr:17,yv:14,sw:13,rc:7,up:12,in:4},
  // Mountain West swing
  CO:{wc:15,ce:18,sr:17,yv:14,sw:15,rc:8,up:10,in:3},
  // Plains/Mountain
  MT:{wc:18,ce:12,sr:20,yv:10,sw:11,rc:20,up:4,in:5},
  ND:{wc:17,ce:11,sr:21,yv:10,sw:10,rc:23,up:3,in:5},
  SD:{wc:18,ce:11,sr:21,yv:10,sw:10,rc:22,up:3,in:5},
  WY:{wc:17,ce:11,sr:20,yv:10,sw:9,rc:25,up:3,in:5},
  ID:{wc:17,ce:12,sr:20,yv:10,sw:10,rc:22,up:4,in:5},
  KS:{wc:18,ce:13,sr:21,yv:10,sw:12,rc:18,up:4,in:4},
  NE:{wc:18,ce:13,sr:21,yv:10,sw:12,rc:18,up:4,in:4},
  // Midwest mix
  MN:{wc:20,ce:15,sr:18,yv:12,sw:13,rc:10,up:8,in:4},
  IA:{wc:23,ce:13,sr:20,yv:10,sw:12,rc:14,up:5,in:3},
  MO:{wc:22,ce:12,sr:20,yv:10,sw:11,rc:15,up:6,in:4},
  IN:{wc:23,ce:12,sr:20,yv:10,sw:11,rc:15,up:5,in:4},
  // Southwest
  TX:{wc:17,ce:15,sr:17,yv:12,sw:15,rc:12,up:7,in:5},
  NM:{wc:18,ce:14,sr:18,yv:13,sw:14,rc:10,up:7,in:6},
};

// Track actions taken for breakdown analysis
const GS_ACTION_LOG = [];

// Apply a bloc shift — amount is in "player's direction" (positive = good for player)
// Updates absolute Dem lean in GS_BLOCS for the breakdown display
function shiftBloc(blocKey, amount, stateCodes=null) {
  const bloc = GS_BLOCS[blocKey];
  if(!bloc) return;
  // Track in absolute Dem lean terms
  const demAmount = GS.playerParty === 'dem' ? amount : -amount;
  bloc.support = cl(bloc.support + demAmount, -80, 80);
  // Apply to state polling — amount is always in player's favor direction
  const states = stateCodes ? GS.states.filter(s=>stateCodes.includes(s.code)) : GS.states;
  states.forEach(s => {
    const weights = STATE_BLOC_WEIGHTS[s.code] || DEFAULT_BLOC;
    const w = (weights[blocKey] || 10) / 100;
    const stateEffect = w * amount * 1.8;
    if(GS.phase==='general') s.genLead = cl(s.genLead + stateEffect, -60, 60);
    else s.primLead = cl(s.primLead + stateEffect * 0.5, -60, 60);
  });
}

function renderActionGrid(grid){
  if(!grid) grid=document.getElementById('actions-grid');
  if(!grid) return;
  grid.innerHTML='';
  const phase=GS.phase;
  const tab = _activeActionTab || 'all';
  const normalActions=ACTIONS.filter(a=>!a.risk);
  const riskActions=ACTIONS.filter(a=>a.risk);

  // Helper to check if action passes tab filter
  const inTab = (a)=>{
    if(tab==='all') return true;
    if(tab==='risky') return false; // risky actions handled separately
    return getActionTab(a.id) === tab;
  };

  // Primary-specific tactics section
  if(phase==='primary' && (tab==='all'||tab==='field')){
    const primActions=normalActions.filter(a=>a.primaryOnly&&inTab(a));
    if(primActions.length>0){
      const sep=document.createElement('div');
      sep.style.cssText='margin:0 0 2px;padding:4px 8px;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:#a78bfa;font-family:var(--font-mono);display:flex;align-items:center;gap:6px';
      sep.innerHTML='🗳 Primary Tactics <span style="flex:1;height:1px;background:rgba(167,139,250,.2)"></span>';
      grid.appendChild(sep);
      primActions.forEach(a=>{
        const btn=document.createElement('button');btn.className='action-btn';btn.id=`ab-${a.id}`;
        const isMG=MINIGAME_ACTIONS.has(a.id);
        btn.innerHTML=`<span class="action-icon">${a.icon}</span><div class="action-info"><div class="action-name" style="color:#c4b5fd">${a.name}${isMG?` <span style="font-size:7px;background:rgba(167,139,250,.2);color:#a78bfa;border-radius:3px;padding:1px 4px;vertical-align:middle">MG</span>`:''}</div><div class="action-desc">${a.desc}</div>${a.outcomes?`<div class="action-outcomes">${a.outcomes}</div>`:''}</div>${a.cost>0?`<span class="action-cost" style="color:#a78bfa">${fm(a.cost)}</span>`:''}`;
        btn.addEventListener('click',()=>selectAction(a.id));
        grid.appendChild(btn);
      });
      if(tab==='all'){
        const sep2=document.createElement('div');
        sep2.style.cssText='margin:4px 0 2px;padding:4px 8px;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);font-family:var(--font-mono);display:flex;align-items:center;gap:6px';
        sep2.innerHTML='📋 Standard Actions <span style="flex:1;height:1px;background:var(--border)"></span>';
        grid.appendChild(sep2);
      }
    }
  }

  normalActions.forEach(a=>{
    if(a.generalOnly && phase!=='general') return;
    if(a.primaryOnly) return;
    if(!inTab(a)) return;
    const btn=document.createElement('button');btn.className='action-btn';btn.id=`ab-${a.id}`;
    const isMG=MINIGAME_ACTIONS.has(a.id);
    btn.innerHTML=`<span class="action-icon">${a.icon}</span><div class="action-info"><div class="action-name">${a.name}${isMG?` <span style="font-size:7px;background:rgba(200,168,75,.15);color:#c8a84b;border-radius:3px;padding:1px 4px;vertical-align:middle">MG</span>`:''}</div><div class="action-desc">${a.desc}</div>${a.outcomes?`<div class="action-outcomes">${a.outcomes}</div>`:''}</div>${a.cost>0?`<span class="action-cost">${fm(a.cost)}</span>`:''}`;
    btn.addEventListener('click',()=>selectAction(a.id));
    grid.appendChild(btn);
  });

  if(phase==='general' && riskActions.length>0 && (tab==='all'||tab==='risky')){
    if(tab==='all'){
      const sep=document.createElement('div');
      sep.style.cssText='grid-column:1/-1;margin:4px 0 2px;padding:4px 8px;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:var(--rep);font-family:var(--font-mono);display:flex;align-items:center;gap:6px;opacity:.9';
      sep.innerHTML='⚠ High-Risk Plays <span style="flex:1;height:1px;background:rgba(239,68,68,.2)"></span>';
      grid.appendChild(sep);
    }
    riskActions.forEach(a=>{
      // Hide "Surprise VP Reveal" if a VP has already been selected
      if(a.id === 'vp_announce' && GS.vp) return;
      const btn=document.createElement('button');
      btn.className='action-btn risk-action';btn.id=`ab-${a.id}`;
      btn.innerHTML=`<span class="action-icon">${a.icon}</span><div class="action-info"><div class="action-name" style="color:#fca5a5">${a.name} <span style="font-size:7px;background:rgba(239,68,68,.2);color:#f87171;border-radius:3px;padding:1px 4px;vertical-align:middle">RISKY</span></div><div class="action-desc">${a.desc}</div>${a.outcomes?`<div class="action-outcomes" style="color:#f87171">${a.outcomes}</div>`:''}</div><span class="action-cost" style="color:#f87171">${fm(a.cost)}</span>`;
      btn.addEventListener('click',()=>selectAction(a.id));
      grid.appendChild(btn);
    });
  }
  // ── UNDERDOG MODE: trailing 5+ nationally ──
  if(phase==='general' && (tab==='all'||tab==='risky')){
    // For N-way race use best opponent's approval; for 2-party use opponent approval directly
    const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
    const bestOppApproval = opps.length ? Math.max(...opps.map(o=>o.approval||44)) : 44;
    const pPct = cl(50+(GS.favorability-bestOppApproval)*.3+GS.momentum*.4,30,70);
    const isUnderdog = pPct < 45;
    if(isUnderdog){
      const sep2=document.createElement('div');
      sep2.style.cssText='grid-column:1/-1;margin:6px 0 2px;padding:5px 8px;font-size:8px;letter-spacing:.15em;text-transform:uppercase;color:#f59e0b;font-family:var(--font-mono);display:flex;align-items:center;gap:6px;background:rgba(245,158,11,.05);border-radius:4px;border:1px solid rgba(245,158,11,.2)';
      sep2.innerHTML='🔥 UNDERDOG MODE UNLOCKED <span style="flex:1;height:1px;background:rgba(245,158,11,.2)"></span>';
      grid.appendChild(sep2);
      UNDERDOG_ACTIONS.forEach(a=>{
        const btn=document.createElement('button');
        btn.className='action-btn underdog-action';btn.id=`ab-${a.id}`;
        btn.innerHTML=`<span class="action-icon">${a.icon}</span><div class="action-info"><div class="action-name" style="color:#fde68a">${a.name} <span style="font-size:7px;background:rgba(245,158,11,.2);color:#f59e0b;border-radius:3px;padding:1px 4px;vertical-align:middle">UNDERDOG</span></div><div class="action-desc">${a.desc}</div>${a.outcomes?`<div class="action-outcomes" style="color:#f59e0b">${a.outcomes}</div>`:''}</div><span class="action-cost" style="color:#f59e0b">${fm(a.cost)}</span>`;
        btn.addEventListener('click',()=>selectAction(a.id));
        grid.appendChild(btn);
      });
    }
  }
  // If no actions shown in this tab, show helpful message
  if(grid.children.length === 0){
    grid.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text3);font-size:11px">No actions available in this category right now.<br><span style="font-size:9px;font-family:var(--font-mono)">Try a different tab or phase.</span></div>';
  }
}

// Render voter blocs in the right panel
function renderBlocs() {
  const el = document.getElementById('blocs-list');
  if(!el) return;
  const isDem = GS.playerParty === 'dem';
  const isInd = GS.playerParty === 'ind';
  el.innerHTML = Object.entries(GS_BLOCS).map(([key,b])=>{
    const sup = b.support; // absolute Dem lean (positive = Dem-friendly)
    // Player-relative: for ind/custom, blocs near 0 are most accessible (centrist framing)
    // Show how far each bloc is from neutral — less partisan = more reachable for an independent
    const playerSup = isDem ? sup : isInd ? -Math.abs(sup) * 0.4 : -sup;
    // Bar: shows absolute dem lean (useful reference regardless of player party)
    const barPct = Math.round((sup + 80) / 160 * 100);
    const fillColor = isInd
      ? (Math.abs(sup) < 15 ? (GS.playerPartyColor||'#a855f7') : sup > 0 ? 'var(--dem)' : 'var(--rep)')
      : sup > 0 ? 'var(--dem)' : 'var(--rep)';
    // For ind: show how reachable the bloc is (the closer to neutral, the more accessible)
    const reachability = isInd ? Math.max(0, 30 - Math.abs(sup)) : playerSup;
    const shiftTag = isInd
      ? (Math.abs(sup) < 10 ? `<span class="bloc-shift dem">✓ Reachable</span>`
       : Math.abs(sup) < 20 ? `<span class="bloc-shift neu">~ Contested</span>`
       : `<span class="bloc-shift rep">⚠ Partisan</span>`)
      : (playerSup > 5 ? `<span class="bloc-shift dem">▲ +${Math.round(playerSup)}</span>`
       : playerSup < -5 ? `<span class="bloc-shift rep">▼ ${Math.round(playerSup)}</span>`
       : `<span class="bloc-shift neu">~0</span>`);
    const borderColor = isInd
      ? (Math.abs(sup)<10 ? `rgba(168,85,247,.3)` : Math.abs(sup)<20 ? 'rgba(200,168,75,.2)' : 'var(--border)')
      : (playerSup>5 ? 'rgba(59,130,246,.25)' : playerSup<-5 ? 'rgba(239,68,68,.25)' : 'var(--border)');
    return `<div class="bloc-item" style="border-color:${borderColor}">
      <div class="bloc-header">
        <span class="bloc-icon">${b.icon}</span>
        <span class="bloc-name" style="color:${isInd?(Math.abs(sup)<15?'var(--text)':'var(--text2)'):(playerSup>3?'var(--text)':'var(--text2)')}">${b.name}</span>
        ${shiftTag}
      </div>
      <div class="bloc-bar-bg">
        <div class="bloc-bar-fill" style="width:${barPct}%;background:${fillColor}"></div>
      </div>
    </div>`;
  }).join('');
}

function goToPolicyStep(){
  // Read backstory before showing policy
  const name = document.getElementById('player-name').value||'Alex Morgan';
  document.getElementById('setup-step2').style.display='none';
  document.getElementById('setup-step4').style.display='';
  document.getElementById('setup-step4').classList.add('animate-in');
  renderPolicySetupStep();
}
function goToStep3FromPolicy(){
  document.getElementById('setup-step4').style.display='none';
  document.getElementById('setup-step2').style.display='';
}

function renderPolicySetupStep(){
  const container = document.getElementById('policy-step-content');
  if(!container) return;
  container.innerHTML = Object.entries(POLICY_DEFS).map(([key,pol])=>`
    <div class="policy-section">
      <div class="policy-label"><span>${pol.icon}</span> ${pol.label}</div>
      <div class="policy-choices">
        ${Object.entries(pol.choices).map(([ckey,ch])=>`
          <button class="policy-choice${GS_POLICY[key]===ckey?' selected':''}"
            onclick="setPolicySetup('${key}','${ckey}')"
            onmouseover="showPolicyPreview('${key}','${ckey}','policy-preview')"
            onmouseout="clearPolicyPreview('policy-preview')">
            <span class="policy-choice-name">${ch.name}</span>
            <span class="policy-choice-hint">${ch.hint}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');
}

function setPolicySetup(category, choiceKey){
  GS_POLICY[category] = choiceKey;
  // Refresh buttons in setup step
  renderPolicySetupStep();
  showPolicyPreview(category, choiceKey, 'policy-preview');
}
function showPolicyPreview(category, choiceKey, previewId){
  const el = document.getElementById(previewId);
  if(!el) return;
  const ch = POLICY_DEFS[category]?.choices?.[choiceKey];
  if(!ch){ el.textContent=''; return; }
  const boostTxt = ch.boostStates.length ? `📈 Boosts: ${ch.boostStates.join(', ')}` : '';
  const hurtTxt  = ch.hurtStates.length  ? `📉 Costs: ${ch.hurtStates.join(', ')}`  : '';
  const enthTxt  = ch.enthusiasm !== 0 ? `⚡ Enthusiasm ${ch.enthusiasm>0?'+':''}${ch.enthusiasm}` : '';
  const elecTxt  = ch.electability !== 0 ? `🗳 Electability ${ch.electability>0?'+':''}${ch.electability}` : '';
  el.innerHTML = `<b>${POLICY_DEFS[category].label}: ${ch.name}</b> — ${ch.desc}<br>
    <span style="font-size:10px;color:var(--text3);">${[boostTxt,hurtTxt,enthTxt,elecTxt].filter(Boolean).join(' · ')}</span>`;
}
function clearPolicyPreview(previewId){
  const el = document.getElementById(previewId);
  if(el) el.textContent = 'Hover a stance to see state effects.';
}

// -----------------------------------------------
// POLITICAL COMPASS SYSTEM
// Tracks the player's position on two axes:
//   X = Economic (left=progressive, right=conservative)
//   Y = Social   (up=authoritarian, down=libertarian)
// -----------------------------------------------
function computeCompassPosition(){
  // ── ECONOMIC AXIS (x): negative = left/progressive, positive = right/conservative ──
  // Max absolute sum = 75 points → normalised to ±1
  const ECON_W = {
    economy:     {progressive:-30, moderate:0,  conservative:30},
    healthcare:  {publicOption:-25, privateReform:0, repeal:25},
    climate:     {aggressive:-15, balanced:0, minimal:15},
    immigration: {open:-5, reform:0, strict:5},
    education:   {publicInvestment:-10, moderateReform:0, schoolChoice:10},
  };
  // ── SOCIAL AXIS (y): negative = libertarian, positive = authoritarian ──
  // Max absolute sum = 105 points → normalised to ±1
  const SOC_W = {
    immigration:   {open:-25, reform:0,  strict:32},
    foreignPolicy: {hawk:28,  dovish:-28, isolationist:10},
    healthcare:    {repeal:-15, privateReform:-5, publicOption:10},
    economy:       {progressive:8,  moderate:0, conservative:-8},
    gunControl:    {strictControl:-20, moderateReform:0, secondAmendment:22},
    socialPolicy:  {progressive:-25, moderate:0, traditionalist:28},
  };
  const ECON_MAX = 85;
  const SOC_MAX  = 105;
  const policyState = (typeof GS_POLICY === 'object' && GS_POLICY) ? GS_POLICY : {};

  let rawEcon = 0;
  Object.entries(ECON_W).forEach(([k,m]) => { rawEcon += (m[policyState[k]] || 0); });
  let rawSoc = 0;
  Object.entries(SOC_W).forEach(([k,m]) => { rawSoc  += (m[policyState[k]] || 0); });

  // Ideology slider (0–100): contributes up to ±0.30 econ, ±0.15 social
  const ideoBias = ((GS.playerIdeology || 50) - 50) / 50; // −1 to +1
  const x = cl(rawEcon / ECON_MAX + ideoBias * 0.30, -1, 1);
  const y = cl(rawSoc  / SOC_MAX  + ideoBias * 0.15, -1, 1);
  return { x, y };
}

function compassLabel(x, y){
  // x: ±1 economic (left/right), y: ±1 social (lib/auth)
  const isLeft  = x < -0.18;
  const isRight = x >  0.18;
  const isAuth  = y >  0.18;
  const isLib   = y < -0.18;
  if(isLeft  && isLib)  return 'Libertarian Left';
  if(isLeft  && isAuth) return 'Authoritarian Left';
  if(isRight && isLib)  return 'Libertarian Right';
  if(isRight && isAuth) return 'Authoritarian Right';
  if(Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return 'Centrist';
  if(isLeft)  return 'Centre-Left';
  if(isRight) return 'Centre-Right';
  if(isAuth)  return 'Soft Authoritarian';
  if(isLib)   return 'Soft Libertarian';
  return 'Moderate';
}

function renderCompass(){
  const svg = document.getElementById('compass-svg');
  const labelEl = document.getElementById('compass-label');
  if(!svg) return;
  const {x, y} = computeCompassPosition();
  // Map ±1 to canvas: centre=50, radius=42 (leaves 8px margin)
  const cx = 50 + x*42, cy = 50 - y*42; // y inverted: auth=top
  const dotCol = GS.playerParty === 'dem' ? '#60a5fa' : GS.playerParty === 'rep' ? '#f87171' : (GS.playerPartyColor||'#a855f7');

  // Opponent dots — handles 2-party and 3-way races
  let oppDots = '';
  if(GS.phase === 'general'){
    const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
    // Canonical compass positions by party
    const PARTY_POS = {
      rep: {x:0.58, y:0.38, col:'#f87171'},
      dem: {x:-0.52, y:-0.22, col:'#60a5fa'},
    };
    oppDots = opps.map(opp => {
      const pos = PARTY_POS[opp.party] || {x:0, y:0, col:'#a78bfa'};
      const ocx = 50 + pos.x*42, ocy = 50 - pos.y*42;
      const oppLast = (opp.name || 'Opponent').split(' ').pop();
      return `<circle cx="${ocx.toFixed(1)}" cy="${ocy.toFixed(1)}" r="3.5" fill="${pos.col}" opacity="0.55" stroke="#fff" stroke-width="0.6"/>
        <text x="${(ocx+4.5).toFixed(1)}" y="${(ocy+1.5).toFixed(1)}" font-size="4.5" fill="${pos.col}" opacity="0.7" font-family="IBM Plex Mono">${oppLast}</text>`;
    }).join('');
  }

  svg.innerHTML = `
    <!-- quadrant backgrounds with radial gradient centres -->
    <defs>
      <radialGradient id="qg-tl" cx="0" cy="0" r="1"><stop offset="0%" stop-color="#a78bfa" stop-opacity="0.12"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
      <radialGradient id="qg-tr" cx="1" cy="0" r="1"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.12"/><stop offset="100%" stop-color="#ef4444" stop-opacity="0"/></radialGradient>
      <radialGradient id="qg-bl" cx="0" cy="1" r="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.12"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
      <radialGradient id="qg-br" cx="1" cy="1" r="1"><stop offset="0%" stop-color="#a78bfa" stop-opacity="0.08"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/></radialGradient>
    </defs>
    <rect x="0" y="0" width="50" height="50" fill="url(#qg-tl)"/>
    <rect x="50" y="0" width="50" height="50" fill="url(#qg-tr)"/>
    <rect x="0" y="50" width="50" height="50" fill="url(#qg-bl)"/>
    <rect x="50" y="50" width="50" height="50" fill="url(#qg-br)"/>
    <!-- grid lines -->
    <line x1="25" y1="1" x2="25" y2="99" stroke="#1e2535" stroke-width="0.4" stroke-dasharray="3,3"/>
    <line x1="75" y1="1" x2="75" y2="99" stroke="#1e2535" stroke-width="0.4" stroke-dasharray="3,3"/>
    <line x1="1" y1="25" x2="99" y2="25" stroke="#1e2535" stroke-width="0.4" stroke-dasharray="3,3"/>
    <line x1="1" y1="75" x2="99" y2="75" stroke="#1e2535" stroke-width="0.4" stroke-dasharray="3,3"/>
    <!-- main axes -->
    <line x1="50" y1="1" x2="50" y2="99" stroke="#2a3348" stroke-width="1"/>
    <line x1="1" y1="50" x2="99" y2="50" stroke="#2a3348" stroke-width="1"/>
    <!-- axis arrow heads -->
    <polygon points="50,1 47.5,5 52.5,5" fill="#a78bfa" opacity="0.5"/>
    <polygon points="50,99 47.5,95 52.5,95" fill="#22c55e" opacity="0.5"/>
    <polygon points="1,50 5,47.5 5,52.5" fill="#3b82f6" opacity="0.5"/>
    <polygon points="99,50 95,47.5 95,52.5" fill="#ef4444" opacity="0.5"/>
    <!-- axis labels -->
    <text x="3"  y="7.5" font-size="4.8" fill="#3b82f699" font-family="IBM Plex Mono" letter-spacing="-0.3">LEFT</text>
    <text x="71" y="7.5" font-size="4.8" fill="#ef444499" font-family="IBM Plex Mono" letter-spacing="-0.3">RIGHT</text>
    <text x="51.5" y="7.5"  font-size="4.8" fill="#a78bfa99" font-family="IBM Plex Mono">AUTH</text>
    <text x="51.5" y="98.5" font-size="4.8" fill="#22c55e99" font-family="IBM Plex Mono">LIB</text>
    <!-- tick marks on axes -->
    <line x1="25" y1="48.5" x2="25" y2="51.5" stroke="#2a3348" stroke-width="0.7"/>
    <line x1="75" y1="48.5" x2="75" y2="51.5" stroke="#2a3348" stroke-width="0.7"/>
    <line x1="48.5" y1="25" x2="51.5" y2="25" stroke="#2a3348" stroke-width="0.7"/>
    <line x1="48.5" y1="75" x2="51.5" y2="75" stroke="#2a3348" stroke-width="0.7"/>
    <!-- history trail -->
    ${(GS._compassHistory||[]).slice(-12).map((p,i,arr)=>`<circle cx="${p.cx}" cy="${p.cy}" r="${1.2 + 0.8*(i/arr.length)}" fill="#c8a84b" opacity="${0.06 + 0.1*(i/arr.length)}"/>`).join('')}
    <!-- history trail line -->
    ${(GS._compassHistory||[]).length > 1 ? `<polyline points="${(GS._compassHistory||[]).slice(-12).map(p=>`${p.cx},${p.cy}`).join(' ')}" fill="none" stroke="#c8a84b" stroke-width="0.5" opacity="0.2"/>` : ''}
    <!-- crosshair lines to current dot -->
    <line x1="${cx.toFixed(1)}" y1="50" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${dotCol}" stroke-width="0.5" opacity="0.35" stroke-dasharray="2,2"/>
    <line x1="50" y1="${cy.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${dotCol}" stroke-width="0.5" opacity="0.35" stroke-dasharray="2,2"/>
    <!-- opponent dot -->
    ${oppDots}
    <!-- player dot glow -->
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9" fill="${dotCol}" opacity="0.08"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="6" fill="${dotCol}" opacity="0.12"/>
    <!-- player dot -->
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${dotCol}" stroke="#fff" stroke-width="1.2" style="animation:compassPulse 2s ease-in-out infinite"/>
    <!-- centre dot -->
    <circle cx="50" cy="50" r="1.5" fill="#2a3348"/>
    <!-- score readout -->
    <text x="3" y="97" font-size="4" fill="#4a5568" font-family="IBM Plex Mono">E:${(x*100).toFixed(0)} S:${(y*100).toFixed(0)}</text>
  `;

  // Update trail
  if(!GS._compassHistory) GS._compassHistory = [];
  const lastPt = GS._compassHistory[GS._compassHistory.length-1];
  if(!lastPt || Math.abs(lastPt.cx-cx)>0.8 || Math.abs(lastPt.cy-cy)>0.8){
    GS._compassHistory.push({cx, cy});
    if(GS._compassHistory.length > 20) GS._compassHistory.shift();
  }
  if(labelEl) labelEl.textContent = compassLabel(x, y);

  // Update readout panel
  const econEl = document.getElementById('compass-econ-text');
  const socEl  = document.getElementById('compass-social-text');
  if(econEl){
    const ev = Math.abs(x*100).toFixed(0);
    econEl.textContent = x < -0.1 ? `${ev}% Left` : x > 0.1 ? `${ev}% Right` : 'Centrist';
    econEl.style.color = x < -0.1 ? '#60a5fa' : x > 0.1 ? '#f87171' : 'var(--text2)';
  }
  if(socEl){
    const sv = Math.abs(y*100).toFixed(0);
    socEl.textContent = y > 0.1 ? `${sv}% Authoritarian` : y < -0.1 ? `${sv}% Libertarian` : 'Centrist';
    socEl.style.color = y > 0.1 ? '#a78bfa' : y < -0.1 ? '#22c55e' : 'var(--text2)';
  }
}

// -----------------------------------------------
// ACTION TAB SYSTEM
// Categorize actions so the list isn't overwhelming
// -----------------------------------------------
const ACTION_TABS_CONFIG = [
  {id:'all',   label:'All',      icon:'📋'},
  {id:'field', label:'Field',    icon:'🗺'},
  {id:'media', label:'Media',    icon:'📺'},
  {id:'money', label:'Finance',  icon:'💰'},
  {id:'bloc',  label:'Coalition',icon:'🧩'},
  {id:'risky', label:'High Risk',icon:'🔥'},
];
const ACTION_TAB_MAP = {
  // field
  rally:'field', canvass:'field', surrogate:'field', townhall:'field', delegate_push:'field',
  // media
  speech:'media', press_tour:'media', spin_room:'media', oppo_rapid:'media', crisis:'media',
  // money
  fundraise:'money', fundraise_calls:'money', ad_blitz:'money',
  // bloc
  union_speech:'bloc', climate_push:'bloc', crime_ad:'bloc', econ_msg:'bloc',
  college_push:'bloc', rural_tour:'bloc',
  // risky
  national_address:'risky', attack_blitz:'risky', vp_announce:'risky', policy_pivot:'risky',
  // underdog
  strategic_reset:'risky', rebrand_tour:'risky', hail_mary_msg:'risky',
};
function getActionTab(id){ return ACTION_TAB_MAP[id] || 'field'; }

let _activeActionTab = 'all';
function setActionTab(tabId){
  _activeActionTab = tabId;
  renderActionGrid();
  document.querySelectorAll('.action-tab').forEach(t=>{
    t.classList.toggle('active', t.dataset.tab===tabId);
    if(tabId==='risky') t.classList.toggle('red', t.dataset.tab===tabId);
  });
}

function renderActionTabs(){
  const el = document.getElementById('action-tabs');
  if(!el) return;
  const phase = GS.phase;
  el.innerHTML = ACTION_TABS_CONFIG.map(t=>`
    <button class="action-tab${_activeActionTab===t.id?' active':''}${t.id==='risky'&&_activeActionTab==='risky'?' red':''}"
      data-tab="${t.id}" onclick="setActionTab('${t.id}')">${t.icon} ${t.label}</button>
  `).join('');
}

// -----------------------------------------------
// ENHANCED AI VISIBILITY — AIs now announce actions in news
// -----------------------------------------------

function getAIActionNarrative(type, name, stateName){
  const rallyLines = [
    `${name} holds major rally — drawing large crowds in ${stateName||'key districts'}`,
    `${name} campaigns hard in ${stateName||'battleground territory'} — ground game intensifies`,
    `${name} barnstorms through ${stateName||'swing territory'} with packed events`,
    `Fired-up supporters greet ${name} at ${stateName||'campaign'} stop`,
  ];
  const coalitionLines = [
    `${name} courts new voter blocs in targeted outreach push`,
    `${name} expands coalition with focused community engagement`,
    `${name} builds grassroots network — volunteers mobilizing`,
    `${name} announces new endorsements from key interest groups`,
  ];
  const mediaLines = [
    `${name} dominates the news cycle with aggressive media tour`,
    `${name} hits airwaves across major markets — visibility rising`,
    `${name} goes on offense with a string of high-profile interviews`,
    `${name} team launches new ad buy in battleground states`,
  ];
  const pool = type==='rally'?rallyLines:type==='coalition'?coalitionLines:mediaLines;
  return pool[Math.floor(Math.random()*pool.length)];
}

// ---------------------------------------------------------------
//  CUSTOM MEDIA UPLOADS
// ---------------------------------------------------------------

// ---------------------------------------------------------------
//  PHOTO LIBRARY SYSTEM
// ---------------------------------------------------------------

// Library = default bundled photos + any user-uploaded ones
const _defaultPhotos = [
  { url:'midage-white-female.jpg', label:'Photo 1', isDefault:true },
  { url:'old-white-man.jpg',       label:'Photo 2', isDefault:true },
  { url:'young-black-man.jpg',     label:'Photo 3', isDefault:true },
  { url:'young-asian-female.jpg',  label:'Photo 4', isDefault:true },
  { url:'midage-white-man.png',    label:'Photo 5', isDefault:true },
];
let _photoLibrary = [..._defaultPhotos];
let _playerPhotoIdx = 0;  // which library photo the player is using

function loadCustomMusic(input){
  const file = input.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  const bgm = document.getElementById('bg-music');
  if(bgm){ bgm.src=url; bgm.load(); bgm.play().catch(()=>{}); }
  const lbl = input.parentElement;
  if(lbl){ const orig=lbl.innerHTML; lbl.innerHTML=lbl.innerHTML.replace('Upload Music','✓ Music Loaded'); setTimeout(()=>lbl.innerHTML=orig,2000); }
}

function loadCustomCandidatePhoto(input){
  const file = input.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  const label = file.name.replace(/\.[^.]+$/,'').slice(0,20);
  // Add to library
  _photoLibrary.push({ url, label, isDefault:false });
  // Select the new photo
  _playerPhotoIdx = _photoLibrary.length - 1;
  applyPlayerPhoto();
  renderPhotoLibraryPicker();
  renderSimPhotoPicker('dem');
  renderSimPhotoPicker('rep');
}

function addSimPhoto(side, input){
  // Upload a photo specifically for a sim candidate slot
  const file = input.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  const label = file.name.replace(/\.[^.]+$/,'').slice(0,16);
  _photoLibrary.push({ url, label, isDefault:false });
  if(side==='dem') _simDemPhotoIdx = _photoLibrary.length-1;
  else             _simRepPhotoIdx = _photoLibrary.length-1;
  renderSimPhotoPicker(side);
  applySimPhotos();
}

function applyPlayerPhoto(){
  const photo = _photoLibrary[_playerPhotoIdx];
  if(!photo) return;
  const portrait = document.getElementById('cand-portrait');
  const placeholder = document.getElementById('cand-portrait-placeholder');
  if(portrait){ portrait.src=photo.url; portrait.style.display='block'; }
  if(placeholder) placeholder.style.display='none';
}

function applySimPhotos(){
  const demImg = document.getElementById('sim-dem-photo');
  const repImg = document.getElementById('sim-rep-photo');
  const demPhoto = _photoLibrary[_simDemPhotoIdx];
  const repPhoto = _photoLibrary[_simRepPhotoIdx];
  if(demImg && demPhoto) demImg.src = demPhoto.url;
  if(repImg && repPhoto) repImg.src = repPhoto.url;
}

// Render the photo picker strip in the campaign setup
function renderPhotoLibraryPicker(){
  const container = document.getElementById('photo-library-picker');
  if(!container) return;
  container.innerHTML = _photoLibrary.map((p,i)=>`
    <div onclick="selectPlayerPhoto(${i})" title="${p.label}" style="
      width:44px;height:44px;border-radius:50%;overflow:hidden;cursor:pointer;flex-shrink:0;
      border:2px solid ${i===_playerPhotoIdx?'var(--accent)':'var(--border)'};
      transition:border-color .15s,transform .15s;
      transform:${i===_playerPhotoIdx?'scale(1.12)':'scale(1)'}" 
      onmouseover="this.style.borderColor='var(--accent)'" 
      onmouseout="this.style.borderColor='${i===_playerPhotoIdx?'var(--accent)':'var(--border)'}'">
      <img src="${p.url}" style="width:100%;height:100%;object-fit:cover;object-position:center" alt="${p.label}">
    </div>`).join('');
}

function selectPlayerPhoto(idx){
  _playerPhotoIdx = idx;
  applyPlayerPhoto();
  renderPhotoLibraryPicker();
}

// Sim photo pickers
// _simDemPhotoIdx and _simRepPhotoIdx declared at top of file (var)

function renderSimPhotoPicker(side){
  const container = document.getElementById(`sim-${side}-photo-picker`);
  if(!container) return;
  const currentIdx = side==='dem' ? _simDemPhotoIdx : _simRepPhotoIdx;
  container.innerHTML = _photoLibrary.map((p,i)=>`
    <div onclick="selectSimPhoto('${side}',${i})" title="${p.label}" style="
      width:36px;height:36px;border-radius:50%;overflow:hidden;cursor:pointer;flex-shrink:0;
      border:2px solid ${i===currentIdx?'var(--'+(side==='dem'?'dem':'rep')+')':'var(--border)'};
      transition:border-color .15s">
      <img src="${p.url}" style="width:100%;height:100%;object-fit:cover;object-position:center">
    </div>`).join('');
}

function selectSimPhoto(side, idx){
  if(side==='dem') _simDemPhotoIdx = idx;
  else             _simRepPhotoIdx = idx;
  applySimPhotos();
  renderSimPhotoPicker(side);
}

// Legacy cycle functions (kept for backward compat, now step through library)
function cycleDemPhoto(){
  _simDemPhotoIdx = (_simDemPhotoIdx+1) % _photoLibrary.length;
  applySimPhotos(); renderSimPhotoPicker('dem');
}
function cycleRepPhoto(){
  _simRepPhotoIdx = (_simRepPhotoIdx+1) % _photoLibrary.length;
  applySimPhotos(); renderSimPhotoPicker('rep');
}

// ---------------------------------------------------------------
//  ACHIEVEMENTS — PERSISTENCE VIA localStorage
// ---------------------------------------------------------------
const ACHIEVEMENTS_LS_KEY = 'potus_achievements_v1';

function loadPersistedAchievements(){
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_LS_KEY);
    if(raw){
      const saved = JSON.parse(raw);
      if(!GS._unlocked) GS._unlocked = {};
      Object.assign(GS._unlocked, saved);
    }
  } catch(e){}
  updateAchievementsBadge();
}

function saveAchievements(){
  try {
    localStorage.setItem(ACHIEVEMENTS_LS_KEY, JSON.stringify(GS._unlocked||{}));
  } catch(e){}
  updateAchievementsBadge();
}

// checkAchievements: runs checks then persists any new unlocks to localStorage
function checkAchievements(won, pEV, oEV, popVote){
  const newlyUnlocked = _checkAchievementsCore(won, pEV, oEV, popVote);
  if(newlyUnlocked.length > 0) saveAchievements();
  return newlyUnlocked;
}

function updateAchievementsBadge(){
  const saved = (() => { try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_LS_KEY)||'{}'); } catch(e){ return {}; } })();
  const count = Object.keys(saved).length;
  const badge = document.getElementById('achievements-count-badge');
  if(badge) badge.textContent = `${count} / ${ACHIEVEMENTS.length}`;
}

function openAchievementsModal(){
  const modal = document.getElementById('achievements-modal');
  if(!modal) return;
  // Load persisted achievements
  const saved = (() => { try { return JSON.parse(localStorage.getItem(ACHIEVEMENTS_LS_KEY)||'{}'); } catch(e){ return {}; } })();
  const earned = Object.keys(saved);
  const countEl = document.getElementById('ach-modal-count');
  if(countEl) countEl.textContent = `${earned.length} of ${ACHIEVEMENTS.length} unlocked`;

  const list = document.getElementById('ach-modal-list');
  if(list){
    list.innerHTML = ACHIEVEMENTS.map(a => {
      const isEarned = !!saved[a.id];
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${isEarned?'rgba(200,168,75,.08)':'var(--bg3)'};border:1px solid ${isEarned?'rgba(200,168,75,.3)':'var(--border)'};border-radius:8px;opacity:${isEarned?1:0.45}">
        <div style="font-size:22px;flex-shrink:0;filter:${isEarned?'none':'grayscale(1)'}">${a.icon}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;color:${isEarned?'#c8a84b':'var(--text2)'}">${a.title}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${a.desc}</div>
        </div>
        ${isEarned ? '<div style="font-size:10px;color:#22c55e;font-family:var(--font-mono)">✓</div>' : '<div style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">🔒</div>'}
      </div>`;
    }).join('');
  }
  modal.style.display = 'flex';
}

function closeAchievementsModal(){
  const modal = document.getElementById('achievements-modal');
  if(modal) modal.style.display = 'none';
}

// Load achievements on startup
document.addEventListener('DOMContentLoaded', ()=>{
  loadPersistedAchievements();
  updateAchievementsBadge();
  // Initialize photo pickers
  renderPhotoLibraryPicker();
  renderSimPhotoPicker('dem');
  renderSimPhotoPicker('rep');
  applySimPhotos();
});

// ---------------------------------------------------------------
//  RANDOM CRISIS EVENTS — Primary + General
// ---------------------------------------------------------------

const CRISIS_EVENTS_PRIMARY = [
  {
    id:'viral_gaffe', title:'🎤 Viral Gaffe',
    intro:'A clip from your campaign event goes viral — you misspoke about a key policy position. Cable news is running it on loop.',
    icon:'📱',
    choices:[
      { label:'Issue a full clarification immediately', desc:'Transparent — kills the story fast. Small favorability hit.', fx:gs=>{ gs.favorability=cl(gs.favorability-2,20,85); gs.mediaCoverage=cl(gs.mediaCoverage+5,0,100); gs.momentum=cl(gs.momentum-1,-20,20); return {type:'neutral',msg:'You clarified quickly. Media cycle moves on within days.'}; }},
      { label:'Double down — reframe it as taken out of context', desc:'Risky. Rallies base but might extend the story.', fx:gs=>{ const r=Math.random(); if(r>.5){gs.favorability=cl(gs.favorability+2,20,85);gs.momentum=cl(gs.momentum+2,-20,20);return{type:'positive',msg:'Your supporters defend you loudly. The story fades — framed as a media hit job.'}}else{gs.favorability=cl(gs.favorability-6,20,85);gs.mediaCoverage=cl(gs.mediaCoverage+8,0,100);return{type:'negative',msg:'The doubling down backfires. Headlines get worse.'}}; }},
      { label:'Stay silent and let surrogates handle it', desc:'Safe but passive.', fx:gs=>{ gs.mediaCoverage=cl(gs.mediaCoverage-3,0,100); gs.electability=cl(gs.electability-2,20,100); return{type:'neutral',msg:'Surrogates do their best. The story lingers a few extra days.'}; }},
    ],
  },
  {
    id:'rival_dropout', title:'-- Rival Drops Out — And Endorses Your Foe',
    intro:'A major rival candidate has suspended their campaign and thrown their full support behind your biggest opponent. Their donor network follows.',
    icon:'💔',
    choices:[
      { label:'Launch an immediate counter-rally in their home state', desc:'Fight for their voters on their turf.', fx:gs=>{ gs.favorability=cl(gs.favorability+1,20,85); gs.electability=cl(gs.electability+3,20,100); gs.funds=cl(gs.funds-3,0,9999); return{type:'positive',msg:'You put on a packed rally. Several of their local leaders come on stage with you.'}; }},
      { label:'Reach out privately to their top donors', desc:'Quiet coalition building.', fx:gs=>{ gs.funds=cl(gs.funds+4,0,9999); gs.totalRaised+=4; gs.endorsements++; return{type:'positive',msg:'Three bundlers switch to your campaign. $4M and counting.'}; }},
      { label:'Stay the course — don\'t react to rivals', desc:'Disciplined but cedes ground.', fx:gs=>{ const a=gs.aiCandidates.find(a=>a.active); if(a) a.approval=cl(a.approval+5,0,80); return{type:'negative',msg:'Your rival\'s consolidation shows in the next poll. The field is narrowing against you.'}; }},
    ],
  },
  {
    id:'scandal_leak', title:'🗞- Opposition Research Dump',
    intro:'An anonymous source has leaked damaging old financial records to a national newspaper. A story drops tomorrow morning.',
    icon:'💣',
    choices:[
      { label:'Get ahead of it — release a full statement tonight', desc:'Controlled disclosure. Limits damage.', fx:gs=>{ gs.favorability=cl(gs.favorability-3,20,85); gs.electability=cl(gs.electability-1,20,100); return{type:'neutral',msg:'You control the narrative. The story drops with your statement already dominating. Media notes your transparency.'}; }},
      { label:'Attack the credibility of the leak — this is dirty politics', desc:'Base loves it. Moderates may not.', fx:gs=>{ const r=Math.random(); if(r>.45){gs.favorability=cl(gs.favorability+2,20,85);gs.momentum=cl(gs.momentum+2,-20,20);return{type:'positive',msg:'Your supporters rally hard. \'Witch hunt\' framing dominates the news cycle.'}}else{gs.favorability=cl(gs.favorability-5,20,85);gs.electability=cl(gs.electability-3,20,100);return{type:'negative',msg:'Media pushes back. The defensive posture makes you look guilty.'}}} },
      { label:'Hire a top-tier crisis PR firm immediately', desc:'Costs money. Buys professionalism.', fx:gs=>{ gs.funds=cl(gs.funds-5,0,9999); gs.totalSpent+=5; gs.favorability=cl(gs.favorability-1,20,85); return{type:'neutral',msg:'The firm earns their fee. Story is managed cleanly. Costs $5M.'}; }},
    ],
  },
  {
    id:'debate_ambush', title:'🎯 Debate Ambush Incoming',
    intro:'Your campaign is tipped off: your opponent plans a coordinated ambush attack on your healthcare record at the next debate. You have one week to prepare.',
    icon:'🥊',
    choices:[
      { label:'Run intensive mock debates — drill the counter-argument', desc:'Electability +boost.', fx:gs=>{ gs.electability=cl(gs.electability+6,20,100); gs.funds=cl(gs.funds-2,0,9999); return{type:'positive',msg:'You walk into the debate ice-cold. Every ambush lands flat. Your poll numbers tick up.'}; }},
      { label:'Pre-empt it — release your own healthcare plan today', desc:'Steals their thunder.', fx:gs=>{ gs.mediaCoverage=cl(gs.mediaCoverage+6,0,100); gs.favorability=cl(gs.favorability+2,20,85); return{type:'positive',msg:'Your plan drops and dominates pre-debate coverage. They pivot to another attack line.'}; }},
      { label:'Ignore the tip — don\'t let opponents dictate your strategy', desc:'Free but risky.', fx:gs=>{ const r=Math.random(); if(r>.4){return{type:'neutral',msg:'The ambush fizzled — they overplayed their hand. You handled it well.'}}else{gs.electability=cl(gs.electability-4,20,100);gs.favorability=cl(gs.favorability-3,20,85);return{type:'negative',msg:'The attack landed hard and clean. Post-debate headlines are rough.'}}} },
    ],
  },
  {
    id:'celebrity_endorsement', title:'- Celebrity Moment',
    intro:'A major cultural figure with tens of millions of followers has publicly announced their support for your campaign — and wants to appear at your next event.',
    icon:'🎬',
    choices:[
      { label:'Welcome them to your biggest upcoming rally', desc:'Youth and cultural voter boom.', fx:gs=>{ gs.favorability=cl(gs.favorability+4,20,85); gs.mediaCoverage=cl(gs.mediaCoverage+8,0,100); gs.momentum=cl(gs.momentum+2,-20,20); if(gs.factions?.youth) gs.factions.youth.loyalty=cl(gs.factions.youth.loyalty+8,10,100); return{type:'positive',msg:'The event trends nationally. Youth voter registration spikes in key states.'}; }},
      { label:'Accept privately but keep some distance publicly', desc:'Less risk if they become controversial.', fx:gs=>{ gs.funds=cl(gs.funds+2,0,9999); gs.totalRaised+=2; gs.favorability=cl(gs.favorability+1,20,85); return{type:'neutral',msg:'A quieter but safe boost. They fundraise and post, you stay at arm\'s length.'}; }},
      { label:'Politely decline — focus on political credibility', desc:'Some voters distrust celebrity politics.', fx:gs=>{ gs.electability=cl(gs.electability+2,20,100); return{type:'neutral',msg:'You stay focused. Some pundits praise the discipline. The endorsement goes to a rival instead.'}; }},
    ],
  },
  {
    id:'fundraising_drought', title:'💸 Fundraising Drought',
    intro:'Your campaign\'s Q1 filing shows you significantly behind rivals in cash-on-hand. Donors are nervous. You have 48 hours before reporters file the story.',
    icon:'📉',
    choices:[
      { label:'Emergency small-dollar email blast to your donor list', desc:'Cheap but requires goodwill.', fx:gs=>{ const raised=G(5,2); gs.funds+=raised; gs.totalRaised+=raised; gs.momentum=cl(gs.momentum+1,-20,20); return{type:'positive',msg:`Grassroots donors respond. $${raised.toFixed(1)}M raised in 48 hours.`}; }},
      { label:'Host a high-dollar bundler dinner tonight', desc:'Big money, but looks insider-y.', fx:gs=>{ const raised=G(8,3); gs.funds+=raised; gs.totalRaised+=raised; gs.favorability=cl(gs.favorability-1,20,85); return{type:'positive',msg:`$${raised.toFixed(1)}M raised. Critics note the donor list.`}; }},
      { label:'Announce a dramatic policy proposal to generate buzz', desc:'Free media coverage drives donations.', fx:gs=>{ gs.mediaCoverage=cl(gs.mediaCoverage+10,0,100); const raised=G(3,1.5); gs.funds+=raised; gs.totalRaised+=raised; return{type:'neutral',msg:`Policy splash earns coverage and $${raised.toFixed(1)}M in organic donations.`}; }},
    ],
  },
];

const CRISIS_EVENTS_GENERAL = [
  {
    id:'nat_security_crisis', title:'- International Crisis',
    intro:'A sudden international incident dominates the news. The sitting president is calling emergency briefings. Reporters are camped outside your campaign office demanding a statement.',
    icon:'🚨',
    choices:[
      { label:'Issue a measured, bipartisan statement calling for unity', desc:'Broad appeal. Boosts electability.', fx:gs=>{ gs.electability=cl(gs.electability+5,20,100); gs.favorability=cl(gs.favorability+2,20,85); gs.mediaCoverage=cl(gs.mediaCoverage+5,0,100); return{type:'positive',msg:'Your statesmanlike response earns rare praise across the aisle. National security credential builds.'}; }},
      { label:'Attack the current administration\'s handling directly', desc:'Partisan but energises base.', fx:gs=>{ const r=Math.random(); if(r>.5){gs.favorability=cl(gs.favorability+3,20,85);gs.momentum=cl(gs.momentum+3,-20,20);return{type:'positive',msg:'Base is fired up. The attack resonates in swing states hit by the fallout.'}}else{gs.electability=cl(gs.electability-4,20,100);gs.favorability=cl(gs.favorability-2,20,85);return{type:'negative',msg:'Critics call it opportunistic. Independent voters recoil. Electability drops.'}}} },
      { label:'Stay silent for 24 hours — get fully briefed first', desc:'Looks cautious, but responsible.', fx:gs=>{ gs.electability=cl(gs.electability+2,20,100); return{type:'neutral',msg:'Your deliberateness is noted by serious commentators. Some say you were too slow.'}; }},
    ],
  },
  {
    id:'economic_shock', title:'📉 Economic Shock',
    intro:'A surprise negative jobs report drops. Markets fall sharply. Your opponent immediately pivots all messaging to the economy.',
    icon:'💹',
    choices:[
      { label:'Release a detailed 5-point economic recovery plan', desc:'Substance first. Strengthens credibility.', fx:gs=>{ gs.electability=cl(gs.electability+4,20,100); gs.mediaCoverage=cl(gs.mediaCoverage+6,0,100); gs.momentum=cl(gs.momentum+2,-20,20); if(gs.factions?.moderates) gs.factions.moderates.loyalty=cl(gs.factions.moderates.loyalty+5,10,100); if(gs.factions?.fiscal) gs.factions.fiscal.loyalty=cl(gs.factions.fiscal.loyalty+5,10,100); return{type:'positive',msg:'Your plan gets serious coverage. Economists praise the detail. Swing voters take notice.'}; }},
      { label:'Host a town hall in a swing state hit hardest by job losses', desc:'Empathy play — connects with workers.', fx:gs=>{ gs.favorability=cl(gs.favorability+4,20,85); gs.groundGame=cl(gs.groundGame+3,0,100); const st=gs.states.filter(s=>Math.abs(s.lean)<=8); if(st.length){ const t=st[~~(Math.random()*st.length)]; t.genLead=cl(t.genLead+2,-60,60); } return{type:'positive',msg:'Images of you on the factory floor dominate the evening news. Real voters, real pain, real empathy.'}; }},
      { label:'Hammer the incumbent\'s economic record with a major ad buy', desc:'Attack mode — costly but high-impact.', fx:gs=>{ gs.funds=cl(gs.funds-5,0,9999); gs.totalSpent+=5; const opp=gs.opponent; if(opp) opp.approval=cl(opp.approval-4,10,85); return{type:'positive',msg:'Ad buy saturates battleground markets. Opponent\'s economic approval rating sinks.'}; }},
    ],
  },
  {
    id:'vp_controversy', title:'🔥 VP Under Fire',
    intro:'Your running mate made controversial comments at a private fundraiser. A recording has leaked. The press is demanding you address it.',
    icon:'💬',
    choices:[
      { label:'Stand by your VP fully and publicly', desc:'Loyal — base approves.', fx:gs=>{ const r=Math.random(); if(r>.45){gs.favorability=cl(gs.favorability+2,20,85);gs.momentum=cl(gs.momentum+1,-20,20);return{type:'positive',msg:'Loyalty plays well. Base respect goes up. The story dies within the week.'}}else{gs.favorability=cl(gs.favorability-4,20,85);gs.electability=cl(gs.electability-2,20,100);return{type:'negative',msg:'The controversy sticks to both of you. Moderates wince.'}}; }},
      { label:'Make your VP issue a direct personal apology', desc:'Damage-limits fast.', fx:gs=>{ gs.favorability=cl(gs.favorability-1,20,85); gs.electability=cl(gs.electability+2,20,100); return{type:'neutral',msg:'The apology drops the story quickly. A clean but slightly uncomfortable week.'}; }},
      { label:'Pivot hard to a major policy announcement today', desc:'Change the subject entirely.', fx:gs=>{ gs.mediaCoverage=cl(gs.mediaCoverage+8,0,100); gs.favorability=cl(gs.favorability+1,20,85); return{type:'neutral',msg:'The pivot works — barely. News cycle shifts within 24 hours.'}; }},
    ],
  },
  {
    id:'swing_state_disaster', title:'🌪- Natural Disaster in a Swing State',
    intro:'A severe storm has devastated a key battleground state. Relief efforts are underway. Both campaigns are watching — and so are millions of voters.',
    icon:'⛈-',
    choices:[
      { label:'Fly there immediately — tour the affected area and announce federal aid support', desc:'Costly in time and money. But human.', fx:gs=>{ gs.funds=cl(gs.funds-2,0,9999); gs.favorability=cl(gs.favorability+5,20,85); gs.momentum=cl(gs.momentum+3,-20,20); const swingStates=['PA','MI','WI','AZ','NV','NC','GA','FL']; const affected=swingStates[~~(Math.random()*swingStates.length)]; const st=gs.states.find(s=>s.code===affected); if(st) st.genLead=cl(st.genLead+4,-60,60); return{type:'positive',msg:`Your presence in the disaster zone earns universal praise. ${affected} moves toward you on the map.`}; }},
      { label:'Announce a major fundraiser for disaster relief', desc:'Helps but feels political.', fx:gs=>{ const raised=G(3,1); gs.funds+=raised; gs.totalRaised+=raised; gs.favorability=cl(gs.favorability+2,20,85); return{type:'positive',msg:'$3M raised for relief efforts. Critics say it\'s political, but voters note the action.'}; }},
      { label:'Pause all campaign advertising in the state as a sign of respect', desc:'Optics of decency.', fx:gs=>{ gs.electability=cl(gs.electability+3,20,100); gs.mediaCoverage=cl(gs.mediaCoverage+4,0,100); return{type:'positive',msg:'A quiet but powerful gesture. Local editors praise it. Opponent keeps running ads — looks tone-deaf.'}; }},
    ],
  },
  {
    id:'major_endorsement_lost', title:'📰 Newspaper Endorses Your Opponent',
    intro:'A major newspaper that has endorsed your party for 40 years has just endorsed your opponent. Their editorial is devastating — and widely shared.',
    icon:'🗞-',
    choices:[
      { label:'Call out the newspaper\'s editorial board directly', desc:'Fires up base. High risk/reward.', fx:gs=>{ const r=Math.random(); if(r>.5){gs.momentum=cl(gs.momentum+3,-20,20);gs.mediaCoverage=cl(gs.mediaCoverage+5,0,100);return{type:'positive',msg:'Your pushback gets traction. Supporters see media bias. Momentum builds.'}}else{gs.favorability=cl(gs.favorability-3,20,85);gs.electability=cl(gs.electability-2,20,100);return{type:'negative',msg:'Attacking the press backfires with independents. Electability takes a hit.'}}} },
      { label:'Hold a press conference — rebut each point calmly and directly', desc:'Looks presidential.', fx:gs=>{ gs.electability=cl(gs.electability+3,20,100); gs.mediaCoverage=cl(gs.mediaCoverage+4,0,100); return{type:'positive',msg:'Your methodical rebuttal earns respect. Fact-checkers give you the edge. Narrative pivots back.'}; }},
      { label:'Ignore it — focus on grassroots voter outreach', desc:'Discipline pays off.', fx:gs=>{ gs.groundGame=cl(gs.groundGame+4,0,100); const swingCodes=gs.states.filter(s=>Math.abs(s.lean)<=8); swingCodes.slice(0,3).forEach(s=>s.genLead=cl(s.genLead+1,-60,60)); return{type:'neutral',msg:'You invest the week in turnout. Three battleground states tick your way.'}; }},
    ],
  },
  {
    id:'debate_wildcard', title:'🎲 Debate Wild Card',
    intro:'An unexpected question at the debate forces you to choose between two positions your coalition fundamentally disagrees on. The moderator presses for a direct answer — no dodging.',
    icon:'🎙-',
    choices:[
      { label:'Give a direct answer — take the politically riskier position', desc:'Authentic. Some voters rewarded, some lost.', fx:gs=>{ const prog = gs.playerIdeology<50; if(prog){ gs.favorability=cl(gs.favorability+4,20,85); if(gs.factions?.progressives) gs.factions.progressives.loyalty=cl(gs.factions.progressives.loyalty+8,10,100); if(gs.factions?.moderates) gs.factions.moderates.loyalty=cl(gs.factions.moderates.loyalty-5,10,100); }else{ gs.favorability=cl(gs.favorability+4,20,85); if(gs.factions?.maga) gs.factions.maga.loyalty=cl(gs.factions.maga.loyalty+8,10,100); if(gs.factions?.subRepublican) gs.factions.subRepublican.loyalty=cl(gs.factions.subRepublican.loyalty-5,10,100); } return{type:'positive',msg:'You answer clearly. The internet divides. Your base is electric. Your swing voters aren\'t sure.'}; }},
      { label:'Bridge the divide — offer a nuanced "third way" answer', desc:'Balanced. Safe. Maybe forgettable.', fx:gs=>{ gs.electability=cl(gs.electability+3,20,100); gs.momentum=cl(gs.momentum+1,-20,20); return{type:'neutral',msg:'The bridge answer satisfies nobody fully and nobody badly. Pundits call it presidential. Others say wishy-washy.'}; }},
      { label:'Turn the question back on the moderator and your opponent', desc:'Bold deflection — might fire the room.', fx:gs=>{ const r=Math.random(); if(r>.45){gs.momentum=cl(gs.momentum+4,-20,20);gs.favorability=cl(gs.favorability+3,20,85);return{type:'positive',msg:'The room erupts. Clip goes viral. You\'ve framed the debate entirely on your terms.'}}else{gs.electability=cl(gs.electability-3,20,100);return{type:'negative',msg:'The moderator pushes back. It looks evasive. You lose the moment.'}}} },
    ],
  },
];

// Track which events have fired this session to avoid repeats
let _firedCrisisIds = new Set();

function maybeFireCrisisEvent(){
  if(!GS._crisisArmed) return null;
  GS._crisisArmed = false;

  const pool = GS.phase==='primary' ? CRISIS_EVENTS_PRIMARY : CRISIS_EVENTS_GENERAL;
  const available = pool.filter(e=>!_firedCrisisIds.has(e.id));
  if(!available.length){ _firedCrisisIds.clear(); return null; } // reset when exhausted
  const event = available[~~(Math.random()*available.length)];
  _firedCrisisIds.add(event.id);
  return event;
}

function armCrisisEvent(){
  GS._crisisArmed = true;
}

// Show the crisis event modal
function showCrisisModal(event){
  const modal = document.getElementById('crisis-event-modal');
  if(!modal) return;

  document.getElementById('crisis-modal-icon').textContent = event.icon;
  document.getElementById('crisis-modal-title').textContent = event.title;
  document.getElementById('crisis-modal-intro').textContent = event.intro;

  const choicesEl = document.getElementById('crisis-modal-choices');
  choicesEl.innerHTML = event.choices.map((c,i)=>`
    <button class="crisis-choice-btn" onclick="resolveCrisis(${i})" data-idx="${i}"
      style="width:100%;text-align:left;padding:14px 16px;margin-bottom:8px;background:#0a0f1a;border:1px solid #1e2535;border-radius:6px;cursor:pointer;transition:all .2s;color:var(--text);display:flex;align-items:flex-start;gap:12px;position:relative;overflow:hidden"
      onmouseover="this.style.borderColor='#dc2626';this.style.background='rgba(220,38,38,.07)';this.style.transform='translateX(3px)'"
      onmouseout="this.style.borderColor='#1e2535';this.style.background='#0a0f1a';this.style.transform='translateX(0)'">
      <div style="width:24px;height:24px;border-radius:50%;background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--font-mono);font-size:11px;font-weight:700;color:#dc2626;margin-top:1px">${String.fromCharCode(64+i+1)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:4px;line-height:1.3">${c.label}</div>
        <div style="font-size:11px;color:#64748b;font-family:var(--font-mono)">${c.desc}</div>
      </div>
    </button>`).join('');

  modal.classList.add('active');
  window._activeCrisisEvent = event;
}

function resolveCrisis(choiceIdx){
  const modal = document.getElementById('crisis-event-modal');
  const event = window._activeCrisisEvent;
  if(!event) return;
  const choice = event.choices[choiceIdx];
  if(!choice) return;

  // Disable buttons immediately to prevent double-click
  modal.querySelectorAll('.crisis-choice-btn').forEach(b=>{ b.disabled=true; b.style.opacity='.5'; });

  const result = choice.fx(GS);

  // Show result inline before closing
  const choicesEl = document.getElementById('crisis-modal-choices');
  const isPos = result.type==='positive';
  const isNeg = result.type==='negative';
  const accentColor = isPos ? '#22c55e' : isNeg ? '#ef4444' : '#c8a84b';
  const bgColor = isPos ? 'rgba(34,197,94,.06)' : isNeg ? 'rgba(239,68,68,.06)' : 'rgba(200,168,75,.06)';
  const borderColor = isPos ? 'rgba(34,197,94,.25)' : isNeg ? 'rgba(239,68,68,.25)' : 'rgba(200,168,75,.2)';
  const resultIcon = isPos ? '✅' : isNeg ? '⚠-' : '📋';
  const resultLabel = isPos ? 'POSITIVE OUTCOME' : isNeg ? 'NEGATIVE OUTCOME' : 'OUTCOME';
  choicesEl.innerHTML = `
    <div style="padding:16px;background:${bgColor};border:1px solid ${borderColor};border-radius:6px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:18px">${resultIcon}</span>
        <span style="font-family:var(--font-mono);font-size:9px;color:${accentColor};letter-spacing:.18em;font-weight:700">${resultLabel}</span>
      </div>
      <div style="font-size:13px;color:#e2e8f0;line-height:1.7">${result.msg}</div>
    </div>
    <button onclick="closeCrisisModal()" style="width:100%;padding:12px;background:#dc2626;border:none;border-radius:6px;color:#fff;font-family:var(--font-mono);font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.08em;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px" onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
      Continue Campaign <span style="font-size:14px">→</span>
    </button>`;

  addNews(`Crisis handled: ${choice.label.slice(0,40)}…`, 'event');
  renderAll();
}

function closeCrisisModal(){
  const modal = document.getElementById('crisis-event-modal');
  if(modal) modal.classList.remove('active');
  window._activeCrisisEvent = null;

  // Historical mode uses different end-condition math (no primaryWeeks)
  if(typeof _histActive !== 'undefined' && _histActive){
    if(GS._pendingNegotiation){
      if(typeof _histWaiting !== 'undefined') _histWaiting = true;
      setTimeout(()=>{ if(typeof _histWaiting !== 'undefined') _histWaiting = false; openNegotiateModal(); }, 300);
      return;
    }
    if(GS.week > GS.generalWeeks && !GS.phaseTransitioning){
      GS.phaseTransitioning = true;
      setTimeout(showResult, 400);
      return;
    }
    renderAll();
    return;
  }

  // Career mode routing
  if(GS._pendingNegotiation){
    setTimeout(openNegotiateModal, 300);
    return;
  }
  if(GS.phase==='primary'&&GS.week>GS.primaryWeeks&&!GS.phaseTransitioning){
    GS.phaseTransitioning=true;
    setTimeout(()=>{GS.phaseTransitioning=false;showConvention();},400);
    return;
  }
  if(GS.phase==='general'&&GS.week>GS.primaryWeeks+GS.generalWeeks&&!GS.phaseTransitioning){
    GS.phaseTransitioning=true;
    setTimeout(showResult,400);
    return;
  }
  if(GS.phase==='general') renderAll();
}

// ---------------------------------------------------------------
//  CONTINGENT ELECTION SIMULATION
// ---------------------------------------------------------------

function devForceContingentElection(){
  // Force the sim states so neither major party hits 270
  if(!window._SIM){ alert('Launch a Quick Simulation first, then force contingent election.'); return; }
  const sim = window._SIM;
  // Give 3rd party 50 EV from swing states to deny 270
  let evGiven = 0;
  const swing = [...sim.states].sort((a,b)=>Math.abs(a.lean)-Math.abs(b.lean));
  for(const s of swing){
    if(evGiven >= 50) break;
    s.thirdWins = true; s.demWins = false;
    evGiven += s.ev;
  }
  sim.thirdEnabled = true;
  if(!sim.thirdName || sim.thirdName==='Independent') sim.thirdName = 'Independent';
  sim.noMajority = true;
  sim.thirdEV = evGiven;
  showContingentElectionModal(sim);
}

function checkSimContingentElection(){
  const sim = window._SIM;
  if(!sim || !sim.noMajority) return;
  showContingentElectionModal(sim);
}

function showContingentElectionModal(sim){
  // Compute final EVs from live EN state
  const demEV = EN.demEV;
  const repEV = EN.repEV;
  const thirdEV = EN.thirdEV || 0;
  const thirdName = sim?.thirdName || 'Independent';
  const demName = GS.playerParty==='dem' ? GS.playerName : GS.opponent?.name || 'Democrat';
  const repName = GS.playerParty==='rep' ? GS.playerName : GS.opponent?.name || 'Republican';

  // House simulation — each state delegation 1 vote, 26 needed
  // Lean of each sim state determines partisan control of delegation
  const stateLeans = sim?.states || GS.states || [];
  let houseDem = 0, houseRep = 0;
  stateLeans.forEach(s=>{
    // Majority-Rep delegation if rep-leaning, else Dem
    if(s.lean < 0) houseRep++; else houseDem++;
  });
  // Cap to 50 total state delegations
  const totalDels = houseDem + houseRep;
  houseDem = Math.round(houseDem / totalDels * 50);
  houseRep = 50 - houseDem;
  const houseWinner = houseRep >= 26 ? 'rep' : houseDem >= 26 ? 'dem' : null;
  const presName = houseWinner==='dem' ? demName : houseWinner==='rep' ? repName : 'Deadlocked';
  const presParty = houseWinner;

  // Senate simulation
  const senDem = 47 + Math.floor(Math.random()*8);
  const senRep = 100 - senDem;
  const vpParty = senDem > 50 ? 'dem' : 'rep';
  const vpName = vpParty==='dem' ? demName : repName;

  const splitGovt = presParty && presParty !== vpParty;

  // Remove old modal if exists
  const old = document.getElementById('contingent-election-modal');
  if(old) old.remove();

  // Build fresh modal
  const modal = document.createElement('div');
  modal.id = 'contingent-election-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'z-index:9200;background:rgba(0,0,0,.92)';
  modal.innerHTML = `
  <div style="max-width:580px;width:95%;background:#0a0c14;border:1px solid rgba(167,139,250,.5);border-radius:16px;overflow:hidden;box-shadow:0 0 80px rgba(124,58,237,.3)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1a0a3a,#0d0618);padding:24px 24px 20px;text-align:center;border-bottom:1px solid rgba(167,139,250,.2)">
      <div style="font-size:40px;margin-bottom:10px">--</div>
      <div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:#a78bfa;letter-spacing:-0.5px">Contingent Election</div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text3);letter-spacing:.15em;margin-top:6px">NO CANDIDATE REACHED 270 ELECTORAL VOTES</div>
    </div>

    <!-- EV Summary -->
    <div id="cont-ev-row" style="display:grid;grid-template-columns:1fr auto 1fr;gap:0;padding:20px 24px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(167,139,250,.15);opacity:0;transition:opacity .6s">
      <div style="text-align:center">
        <div style="font-family:var(--font-mono);font-size:9px;color:#60a5fa;letter-spacing:.1em;margin-bottom:4px">${demName.split(' ').slice(-1)[0].toUpperCase()}</div>
        <div style="font-family:var(--font-mono);font-size:36px;font-weight:900;color:#60a5fa">${demEV}</div>
        <div style="font-size:9px;color:#4a5568;font-family:var(--font-mono)">ELECTORAL VOTES</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 16px;gap:4px">
        <div style="width:1px;flex:1;background:rgba(167,139,250,.2)"></div>
        <div style="font-size:10px;color:#a78bfa;font-family:var(--font-mono);white-space:nowrap">${thirdName.split(' ').slice(-1)[0]}: ${thirdEV} EV</div>
        <div style="width:1px;flex:1;background:rgba(167,139,250,.2)"></div>
      </div>
      <div style="text-align:center">
        <div style="font-family:var(--font-mono);font-size:9px;color:#f87171;letter-spacing:.1em;margin-bottom:4px">${repName.split(' ').slice(-1)[0].toUpperCase()}</div>
        <div style="font-family:var(--font-mono);font-size:36px;font-weight:900;color:#f87171">${repEV}</div>
        <div style="font-size:9px;color:#4a5568;font-family:var(--font-mono)">ELECTORAL VOTES</div>
      </div>
    </div>

    <!-- Constitution clause -->
    <div id="cont-clause" style="padding:16px 24px;border-bottom:1px solid rgba(167,139,250,.1);opacity:0;transition:opacity .6s">
      <div style="font-style:italic;font-size:12px;color:#6b7280;line-height:1.7;text-align:center;padding:0 8px">
        "…the House of Representatives shall choose immediately, by ballot, the President. But in choosing the President, the votes shall be taken by States, the representation from each State having one vote…"
        <div style="font-family:var(--font-mono);font-size:9px;color:#4a5568;margin-top:6px;letter-spacing:.1em">— CONSTITUTION OF THE UNITED STATES · 12TH AMENDMENT</div>
      </div>
    </div>

    <!-- House vote -->
    <div id="cont-house-section" style="padding:18px 24px;border-bottom:1px solid rgba(167,139,250,.1);opacity:0;transition:opacity .6s">
      <div style="font-family:var(--font-mono);font-size:9px;color:var(--accent);letter-spacing:.15em;margin-bottom:12px">-- HOUSE OF REPRESENTATIVES VOTE — PRESIDENT</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px">Each state delegation casts one vote. 26 of 50 state delegations needed.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="padding:12px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;text-align:center">
          <div style="font-family:var(--font-mono);font-size:11px;color:#60a5fa">DEMOCRATIC STATES</div>
          <div style="font-family:var(--font-mono);font-size:32px;font-weight:900;color:#60a5fa">${houseDem}</div>
        </div>
        <div style="padding:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;text-align:center">
          <div style="font-family:var(--font-mono);font-size:11px;color:#f87171">REPUBLICAN STATES</div>
          <div style="font-family:var(--font-mono);font-size:32px;font-weight:900;color:#f87171">${houseRep}</div>
        </div>
      </div>
    </div>

    <!-- President result -->
    <div id="cont-pres-result" style="padding:18px 24px;border-bottom:1px solid rgba(167,139,250,.1);background:${presParty==='dem'?'rgba(59,130,246,.05)':presParty==='rep'?'rgba(239,68,68,.05)':'rgba(167,139,250,.05)'};opacity:0;transition:opacity .6s">
      <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);letter-spacing:.15em;margin-bottom:8px">🇺🇸 HOUSE ELECTS PRESIDENT</div>
      <div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:${presParty==='dem'?'#60a5fa':presParty==='rep'?'#f87171':'#a78bfa'}">${presName}</div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text3);margin-top:4px">${houseRep >= 26 ? houseRep+' Republican state delegations prevail' : houseDem >= 26 ? houseDem+' Democratic state delegations prevail' : 'No majority — House deadlocked'}</div>
    </div>

    <!-- Senate VP -->
    <div id="cont-senate-section" style="padding:18px 24px;border-bottom:1px solid rgba(167,139,250,.1);opacity:0;transition:opacity .6s">
      <div style="font-family:var(--font-mono);font-size:9px;color:#a78bfa;letter-spacing:.15em;margin-bottom:12px">-- SENATE VOTE — VICE PRESIDENT</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px">Simple majority of 100 senators (51 needed). Senate chooses VP from top two VP finishers.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="padding:12px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:8px;text-align:center">
          <div style="font-family:var(--font-mono);font-size:11px;color:#60a5fa">DEM SENATORS</div>
          <div style="font-family:var(--font-mono);font-size:32px;font-weight:900;color:#60a5fa">${senDem}</div>
        </div>
        <div style="padding:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;text-align:center">
          <div style="font-family:var(--font-mono);font-size:11px;color:#f87171">REP SENATORS</div>
          <div style="font-family:var(--font-mono);font-size:32px;font-weight:900;color:#f87171">${senRep}</div>
        </div>
      </div>
      <div style="font-family:var(--font-display);font-size:20px;font-weight:700;color:${vpParty==='dem'?'#60a5fa':'#f87171'}">VP Elect: ${vpName.split(' ').slice(-1)[0]}</div>
    </div>

    <!-- Final outcome + split govt warning -->
    <div id="cont-final" style="padding:18px 24px;opacity:0;transition:opacity .6s">
      ${splitGovt ? `<div style="padding:10px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:8px;margin-bottom:12px;font-size:11px;color:#f87171;line-height:1.6">
        ⚠- <strong>Split Government</strong> — The President and Vice President are from different parties. This has not happened since 1796–1800. Expect constitutional tension.
      </div>` : `<div style="padding:10px 12px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:8px;margin-bottom:12px;font-size:11px;color:#22c55e;line-height:1.6">
        ✅ Same party President and Vice President — government can function normally.
      </div>`}
      <button onclick="document.getElementById('contingent-election-modal').classList.remove('active')" style="width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#4c1d95);border:none;border-radius:var(--radius);color:#fff;font-family:var(--font-display);font-size:15px;font-weight:700;cursor:pointer;letter-spacing:.02em">Close</button>
    </div>

  </div>`;

  document.body.appendChild(modal);
  modal.classList.add('active');

  // Staged dramatic reveal — each section fades in with delay
  const stages = [
    { id:'cont-ev-row',          delay: 400 },
    { id:'cont-clause',          delay: 1200 },
    { id:'cont-house-section',   delay: 2400 },
    { id:'cont-pres-result',     delay: 3800 },
    { id:'cont-senate-section',  delay: 5200 },
    { id:'cont-final',           delay: 6600 },
  ];
  stages.forEach(({id, delay})=>{
    setTimeout(()=>{
      const el = document.getElementById(id);
      if(el){ el.style.opacity='1'; el.scrollIntoView({behavior:'smooth',block:'nearest'}); }
    }, delay);
  });
}

function buildContingentModal(){
  // No longer needed — showContingentElectionModal builds its own modal
}

// ----------------------------------------------------------------------------
//  SAVE / LOAD SYSTEM
//  Serialises the entire GS object to localStorage with a timestamp.
//  Three save slots. Auto-save on every End Week.
// ----------------------------------------------------------------------------
const SAVE_PREFIX = 'potus_save_';
const AUTO_SAVE_KEY = 'potus_autosave';
const MAX_SAVE_SLOTS = 3;

// Fields that can't be JSON-serialised cleanly — we convert them before save
function _gsToSaveObj(){
  const obj = JSON.parse(JSON.stringify(GS, (key,val)=>{
    if(val instanceof Set) return {__type:'Set', values:[...val]};
    if(typeof val === 'function') return undefined;
    return val;
  }));
  return obj;
}
function _saveObjToGs(obj){
  return JSON.parse(JSON.stringify(obj), (key,val)=>{
    if(val && val.__type === 'Set') return new Set(val.values);
    return val;
  });
}

function saveGame(slot){
  try{
    const key = slot==='auto' ? AUTO_SAVE_KEY : `${SAVE_PREFIX}${slot}`;
    const saveData = {
      version: 3,
      timestamp: Date.now(),
      phase: GS.phase,
      week: GS.week,
      playerName: GS.playerName,
      playerParty: GS.playerParty,
      playerPartyLabel: GS.playerPartyLabel||'',
      gs: _gsToSaveObj(),
      selParty, selDiff, selCareer,
    };
    localStorage.setItem(key, JSON.stringify(saveData));
    return true;
  } catch(e){
    console.error('Save failed:', e);
    return false;
  }
}

function loadGame(slot){
  try{
    const key = slot==='auto' ? AUTO_SAVE_KEY : `${SAVE_PREFIX}${slot}`;
    const raw = localStorage.getItem(key);
    if(!raw) return false;
    const saveData = JSON.parse(raw);
    if(!saveData || !saveData.gs) return false;
    // Restore global setup vars so UI reflects saved state
    selParty = saveData.selParty || saveData.playerParty || 'dem';
    selDiff  = saveData.selDiff  || 'normal';
    selCareer= saveData.selCareer|| 'senator';
    // Restore GS
    const restored = _saveObjToGs(saveData.gs);
    Object.assign(GS, restored);
    // Re-hydrate non-serialisable items
    if(!(GS._uniqueActionsUsed instanceof Set)) GS._uniqueActionsUsed = new Set(GS._uniqueActionsUsed||[]);
    if(!(GS.targetedStates instanceof Set))    GS.targetedStates    = new Set(GS.targetedStates||[]);
    if(!Array.isArray(GS._recentActions))      GS._recentActions    = [];
    if(!GS.playerPartyLabel) GS.playerPartyLabel = GS.playerParty==='dem'?'Democratic':GS.playerParty==='rep'?'Republican':'Independent';
    // Re-wire UI
    showScreen('game-screen');
    setupUI();
    const _nwBtn = document.querySelector('.next-week-btn');
    if(_nwBtn) _nwBtn.onclick = nextWeek;
    const _sumBtn = document.querySelector('#summary-modal .modal-btn.primary');
    if(_sumBtn) _sumBtn.onclick = closeSummary;
    // Restore phase UI state
    if(GS.phase==='general'){
      document.getElementById('topbar-phase').textContent='General Election';
      document.getElementById('phase-primary').className='phase-step done';
      document.getElementById('phase-convention').className='phase-step done';
      document.getElementById('phase-general').className='phase-step current';
      document.getElementById('primary-content').style.display='none';
      document.getElementById('general-content').style.display='block';
      const bgsEl=document.getElementById('battleground-section'); if(bgsEl) bgsEl.style.display='block';
      const cgEl=document.getElementById('congress-tracker'); if(cgEl) cgEl.style.display='block';
      initCongressTracker();
      ensureBattlegroundSets(true);
    }
    renderAll();
    closeSaveLoadModal();
    // Show confirmation toast
    const toast = document.createElement('div');
    toast.textContent = '✅ Game loaded successfully';
    toast.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a2535;border:1px solid rgba(200,168,75,.4);color:#c8a84b;font-family:var(--font-mono);font-size:11px;padding:8px 16px;border-radius:6px;z-index:99999;pointer-events:none';
    document.body.appendChild(toast);
    setTimeout(()=>toast.remove(), 2200);
    return true;
  } catch(e){
    console.error('Load failed:', e);
    return false;
  }
}

function deleteSave(slot){
  try{
    localStorage.removeItem(slot==='auto' ? AUTO_SAVE_KEY : `${SAVE_PREFIX}${slot}`);
    renderSaveLoadModal();
  } catch(e){}
}

function getSaveInfo(slot){
  try{
    const key = slot==='auto' ? AUTO_SAVE_KEY : `${SAVE_PREFIX}${slot}`;
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const d = JSON.parse(raw);
    return {
      timestamp: d.timestamp,
      phase: d.phase,
      week: d.week,
      playerName: d.playerName,
      playerParty: d.playerParty,
      playerPartyLabel: d.playerPartyLabel||d.playerParty,
      dateStr: new Date(d.timestamp).toLocaleString(),
    };
  } catch(e){ return null; }
}

function openSaveLoadModal(mode){
  // mode: 'save' or 'load'
  let modal = document.getElementById('saveload-modal');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'saveload-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    modal.onclick = e=>{ if(e.target===modal) closeSaveLoadModal(); };
    document.body.appendChild(modal);
  }
  modal._mode = mode || 'save';
  modal.style.display='flex';
  renderSaveLoadModal();
}

function closeSaveLoadModal(){
  const modal = document.getElementById('saveload-modal');
  if(modal) modal.style.display='none';
}

function renderSaveLoadModal(){
  const modal = document.getElementById('saveload-modal');
  if(!modal) return;
  const mode = modal._mode || 'save';
  const isInGame = GS.phase==='primary'||GS.phase==='general';
  const autoInfo = getSaveInfo('auto');

  // Build slot rows
  const slotRows = [1,2,3].map(slot=>{
    const info = getSaveInfo(slot);
    const partyColor = !info ? 'var(--text3)' : info.playerParty==='dem'?'#60a5fa':info.playerParty==='rep'?'#ef4444':info.playerPartyLabel?'#a78bfa':'var(--text3)';
    const partyLabel = !info ? '' : (info.playerPartyLabel||info.playerParty||'').toUpperCase();
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px">
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text3);margin-bottom:2px">SLOT ${slot}</div>
          ${info
            ? `<div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${info.playerName}</div>
               <div style="font-family:var(--font-mono);font-size:9px;color:${partyColor}">${partyLabel} · ${info.phase==='primary'?'Primary':'General'} · Wk ${info.week}</div>
               <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3);margin-top:1px">${info.dateStr}</div>`
            : `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);font-style:italic">Empty slot</div>`
          }
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          ${mode==='save' && isInGame
            ? `<button onclick="saveGame(${slot});renderSaveLoadModal()" style="padding:6px 10px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.35);border-radius:5px;color:#c8a84b;font-family:var(--font-mono);font-size:10px;cursor:pointer" onmouseover="this.style.background='rgba(200,168,75,.2)'" onmouseout="this.style.background='rgba(200,168,75,.1)'">💾 Save</button>`
            : ''
          }
          ${info && mode==='load'
            ? `<button onclick="loadGame(${slot})" style="padding:6px 10px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.35);border-radius:5px;color:#60a5fa;font-family:var(--font-mono);font-size:10px;cursor:pointer" onmouseover="this.style.background='rgba(59,130,246,.2)'" onmouseout="this.style.background='rgba(59,130,246,.1)'">▶ Load</button>`
            : ''
          }
          ${info
            ? `<button onclick="if(confirm('Delete this save?'))deleteSave(${slot})" style="padding:6px 8px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:5px;color:#f87171;font-family:var(--font-mono);font-size:10px;cursor:pointer" onmouseover="this.style.background='rgba(239,68,68,.18)'" onmouseout="this.style.background='rgba(239,68,68,.08)'">🗑</button>`
            : ''
          }
        </div>
      </div>`;
  }).join('');

  const autoRow = `
    <div style="padding:10px 12px;background:rgba(200,168,75,.05);border:1px solid rgba(200,168,75,.2);border-radius:8px;display:flex;align-items:center;gap:10px">
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--accent);margin-bottom:2px">AUTO-SAVE</div>
        ${autoInfo
          ? `<div style="font-size:12px;color:var(--text)">${autoInfo.playerName} · ${autoInfo.phase==='primary'?'Primary':'General'} Wk ${autoInfo.week}</div>
             <div style="font-family:var(--font-mono);font-size:8px;color:var(--text3)">${autoInfo.dateStr}</div>`
          : `<div style="font-family:var(--font-mono);font-size:11px;color:var(--text3);font-style:italic">No auto-save yet</div>`
        }
      </div>
      ${autoInfo && mode==='load'
        ? `<button onclick="loadGame('auto')" style="padding:6px 10px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.35);border-radius:5px;color:#60a5fa;font-family:var(--font-mono);font-size:10px;cursor:pointer" onmouseover="this.style.background='rgba(59,130,246,.2)'" onmouseout="this.style.background='rgba(59,130,246,.1)'">▶ Load</button>`
        : ''
      }
    </div>`;

  modal.innerHTML = `
    <div style="width:min(460px,95vw);background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px 22px;font-family:var(--font-mono)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:var(--text)">${mode==='save'?'💾 Save Game':'📂 Load Game'}</div>
        <button onclick="closeSaveLoadModal()" style="padding:4px 10px;background:transparent;border:1px solid var(--border2);border-radius:5px;color:var(--text2);cursor:pointer;font-size:16px">×</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${autoRow}
        ${slotRows}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="closeSaveLoadModal()" style="flex:1;padding:9px;background:transparent;border:1px solid var(--border2);border-radius:6px;color:var(--text2);cursor:pointer;font-size:11px">Cancel</button>
        ${mode==='save'
          ? `<button onclick="openSaveLoadModal('load')" style="padding:9px 14px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.3);border-radius:6px;color:#60a5fa;cursor:pointer;font-size:11px">📂 Switch to Load</button>`
          : isInGame ? `<button onclick="openSaveLoadModal('save')" style="padding:9px 14px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.3);border-radius:6px;color:#c8a84b;cursor:pointer;font-size:11px">💾 Switch to Save</button>` : ''
        }
      </div>
    </div>`;
}

// ── Auto-save hook — called at end of every nextWeek ──
function autoSaveGame(){
  if(GS.phase==='primary'||GS.phase==='general') saveGame('auto');
}

// ── Slider fill helper — keeps CSS gradient in sync with value ──
function initSliderFills(){
  document.querySelectorAll('input[type="range"]').forEach(slider=>{
    const update = () => {
      const min = +slider.min || 0, max = +slider.max || 100, val = +slider.value;
      const pct = ((val-min)/(max-min)*100).toFixed(1)+'%';
      slider.style.setProperty('--pct', pct);
    };
    update();
    slider.addEventListener('input', update);
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  initSliderFills();
  // Re-init when panels appear (e.g. sim panel toggles)
  const obs = new MutationObserver(()=>initSliderFills());
  obs.observe(document.body, {childList:true, subtree:true});
});

// ── MISSING FUNCTION STUBS (restored) ─────────────────────────────────────────

// Apply the player's policy platform to the game state.
// Each chosen policy boosts primLead/genLead in target states and tweaks
// GS.electability and GS._enthusiasm slightly.
function applyPolicyToGame(){
  if(!GS.states || !GS_POLICY) return;
  const BOOST = 2.5;  // pts added to state leads for boosted states
  const HURT  = 1.8;  // pts removed for hurt states
  Object.entries(GS_POLICY).forEach(([cat, choiceKey])=>{
    const polDef = POLICY_DEFS[cat];
    if(!polDef) return;
    const choice = polDef.choices[choiceKey];
    if(!choice) return;
    // Apply enthusiasm and electability modifiers (additive, capped)
    if(choice.enthusiasm)    GS._enthusiasm   = cl((GS._enthusiasm||50)  + choice.enthusiasm,  20, 90);
    if(choice.electability)  GS.electability  = cl((GS.electability||50) + choice.electability, 20, 85);
    // Shift state leads
    (choice.boostStates||[]).forEach(code=>{
      const s = GS.states.find(x=>x.code===code);
      if(!s) return;
      s.primLead = cl((s.primLead||0) + BOOST, -60, 60);
      s.genLead  = cl((s.genLead ||0) + BOOST, -60, 60);
    });
    (choice.hurtStates||[]).forEach(code=>{
      const s = GS.states.find(x=>x.code===code);
      if(!s) return;
      s.primLead = cl((s.primLead||0) - HURT, -60, 60);
      s.genLead  = cl((s.genLead ||0) - HURT, -60, 60);
    });
  });
}

// Passive weekly fundraise for general-election opponent(s).
// Keeps opponent war chests alive so funding-based AI logic stays meaningful.
function opponentPassiveFundraise(){
  const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
  opps.forEach(opp=>{
    if(!opp || !opp.active) return;
    const raise = G(1.8, 0.6);
    opp.funds = cl((opp.funds||0) + raise, 0, 300);
  });
  // Also let any active primary AI fundraise a little (mirrors runAI fundraise path)
  if(GS.phase === 'primary'){
    (GS.aiCandidates||[]).filter(a=>a.active).forEach(ai=>{
      if(ai.funds < 5) ai.funds = cl(ai.funds + G(0.8, 0.3), 0, 100);
    });
  }
}

// General-election opponent AI: each opponent campaigns, attacks, or fundraises.
// Called once per week during the general phase inside runAI().
function runGeneralOpponentAI(){
  const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
  if(!opps.length) return;

  const diffMult       = {easy:0.70, normal:1.10, hard:1.80}[GS.difficulty] || 1.10;
  const diffAttackMult = {easy:0.60, normal:1.20, hard:2.00}[GS.difficulty] || 1.20;

  opps.forEach(opp=>{
    if(!opp || opp.active === false) return;

    const roll = Math.random();

    if((opp.funds||0) < 3 || roll < 0.20){
      // Fundraise
      opp.funds = cl((opp.funds||0) + G(2.5, 0.8), 0, 300);

    } else if(roll < 0.50){
      // Campaign: boost approval + shift states against player, weighted by competitiveness
      const bump = G(1.2, 0.5) * diffMult;
      opp.approval = cl((opp.approval||44) + bump, 20, 75);

      // Tiered targeting: toss-ups first, then lean, then likely — safe states ignored
      const allTargets = GS.states
        .filter(s => Math.abs(s.lean) <= 20)  // exclude truly safe states
        .sort((a, b) => Math.abs(a.genLead) - Math.abs(b.genLead)); // most competitive first
      // Pick up to 3: 1 toss-up + 1 lean + 1 likely
      const picked = allTargets.slice(0, 3);
      picked.forEach(s => {
        const absL = Math.abs(s.lean);
        // Effect scales down for safer states
        const tierMult = absL > 12 ? 0.35 : absL > 6 ? 0.70 : 1.0;
        s.genLead = cl(s.genLead - G(0.8, 0.3) * diffMult * tierMult, -60, 60);
      });
      opp.funds = cl((opp.funds||0) - 1.0, 0, 300);
      if(opp._actionLog) opp._actionLog.push({wk: GS.week, icon:'📢', text:'Campaigning in competitive states'});
      opp._lastAction = '📢 Campaign Push';

    } else if(roll < 0.75){
      // Attack player
      const dmg = G(1.5, 0.7) * diffAttackMult;
      GS.favorability = cl(GS.favorability - dmg, 20, 85);
      opp.funds = cl((opp.funds||0) - 1.5, 0, 300);
      const lastName = (opp.name||'Opponent').split(' ').pop();
      addNews(`${lastName} campaign launches new attack ad against ${GS.playerName}`, 'scandal');
      if(opp._actionLog) opp._actionLog.push({wk: GS.week, icon:'⚔', text:'Attack ads on player'});
      opp._lastAction = '⚔ Attack Ads';
      // Push summary event if we have a collector
      if(Array.isArray(GS._oppSummaryEvents)){
        GS._oppSummaryEvents.push({
          type:'negative',
          title:`📺 ${lastName} Goes Negative`,
          msg:`${opp.name} launched attack ads this week. Favorability −${dmg.toFixed(1)}%.`
        });
      }

    } else {
      // Media blitz: mostly boosts their own approval
      const bump = G(0.8, 0.4) * diffMult;
      opp.approval = cl((opp.approval||44) + bump, 20, 75);
      opp.funds = cl((opp.funds||0) - 0.5, 0, 300);
      if(opp._actionLog) opp._actionLog.push({wk: GS.week, icon:'📺', text:'Media blitz'});
      opp._lastAction = '📺 Media Blitz';
    }

    // Natural approval drift toward 44 baseline
    opp.approval = cl(opp.approval + (44 - opp.approval) * 0.03 + G(0, 0.5), 20, 75);
  });
}

// Initialise the Congress tracker sidebar widget.
// Sets up GS senate/house seat counts and renders the bars.
function initCongressTracker(){
  // Starting composition (current real-world approximation)
  if(!GS._senateD) GS._senateD = 47;
  if(!GS._senateR) GS._senateR = 53;
  if(!GS._houseD)  GS._houseD  = 213;
  if(!GS._houseR)  GS._houseR  = 222;
  GS._congressInitialized = true;
  updateCongressTracker();
}

// Update the Congress tracker bars and seat counts.
function updateCongressTracker(){
  // Drift seat counts slightly based on player's national momentum
  if(GS.phase === 'general'){
    const drift = Math.round(GS.momentum * 0.05);
    GS._senateD = cl((GS._senateD||47) + drift, 40, 60);
    GS._senateR = 100 - GS._senateD;
    GS._houseD  = cl((GS._houseD||213) + drift * 3, 180, 255);
    GS._houseR  = 435 - GS._houseD;
  }
  const sd = GS._senateD||47, sr = GS._senateR||53;
  const hd = GS._houseD||213, hr = GS._houseR||222;
  const sdEl = document.getElementById('senate-dem-seats'); if(sdEl) sdEl.textContent = sd;
  const srEl = document.getElementById('senate-rep-seats'); if(srEl) srEl.textContent = sr;
  const hdEl = document.getElementById('house-dem-seats');  if(hdEl) hdEl.textContent = hd;
  const hrEl = document.getElementById('house-rep-seats');  if(hrEl) hrEl.textContent = hr;
  const sbD = document.getElementById('senate-bar-dem'); if(sbD) sbD.style.width = (sd/100*100)+'%';
  const sbR = document.getElementById('senate-bar-rep'); if(sbR) sbR.style.width = (sr/100*100)+'%';
  const hbD = document.getElementById('house-bar-dem');  if(hbD) hbD.style.width = (hd/435*100)+'%';
  const hbR = document.getElementById('house-bar-rep');  if(hbR) hbR.style.width = (hr/435*100)+'%';
}

// Initialise the election-night congress scoreboard.
// Kick off the election-night sequence.
// game-night.js owns the full EN engine; this stub delegates to it if available,
// otherwise falls back to showing the result screen directly.
function startElectionNight(){
  if(typeof window.launchElectionNight === 'function'){
    window.launchElectionNight();
  } else {
    // Fallback: skip straight to result
    showResult();
  }
}
