// ═══════════════════════════════════════════════════════════════════════════
// POTUS - AI Campaign Advisor  v7.0  (ai-command.js)
// Architecture: client owns action+state detection; LLM only writes advice text.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';



  // ── STATE LOOKUP ──────────────────────────────────────────────────────────
  // Sorted longest-first so "new hampshire" always matches before "new"
  const STATE_NAMES = [
    ['alabama','AL'],['alaska','AK'],['arizona','AZ'],['arkansas','AR'],
    ['california','CA'],['colorado','CO'],['connecticut','CT'],['delaware','DE'],
    ['florida','FL'],['georgia','GA'],['hawaii','HI'],['idaho','ID'],
    ['illinois','IL'],['indiana','IN'],['iowa','IA'],['kansas','KS'],
    ['kentucky','KY'],['louisiana','LA'],['maine','ME'],['maryland','MD'],
    ['massachusetts','MA'],['michigan','MI'],['minnesota','MN'],['mississippi','MS'],
    ['missouri','MO'],['montana','MT'],['nebraska','NE'],['nevada','NV'],
    ['new hampshire','NH'],['new jersey','NJ'],['new mexico','NM'],['new york','NY'],
    ['north carolina','NC'],['north dakota','ND'],['ohio','OH'],['oklahoma','OK'],
    ['oregon','OR'],['pennsylvania','PA'],['rhode island','RI'],['south carolina','SC'],
    ['south dakota','SD'],['tennessee','TN'],['texas','TX'],['utah','UT'],
    ['vermont','VT'],['virginia','VA'],['washington','WA'],['west virginia','WV'],
    ['wisconsin','WI'],['wyoming','WY'],
  ].sort((a, b) => b[0].length - a[0].length);

  const CODE_TO_NAME = Object.fromEntries(
    STATE_NAMES.map(([n, c]) => [c, n.replace(/\b\w/g, l => l.toUpperCase())])
  );
  const VALID_CODES = new Set(STATE_NAMES.map(([, c]) => c));

  // 2-letter codes that are also common English words.
  // Never auto-match these from lowercase text; only accept if player typed ALL-CAPS.
  const AMBIGUOUS = new Set([
    'IN','OR','ME','HI','OK','AL','DE','LA','OH','PA','MA','IA','ID',
    'AR','CO','MS','MO','AS','ND','SD','MT','VA','WA',
  ]);

  // ── ACTION KEYWORD MAP ────────────────────────────────────────────────────
  const ACTION_KEYWORDS = {
    'campaign rally':'visit','hold a rally':'visit','hold rally':'visit',
    'campaign stop':'visit','campaign event':'visit','campaign in':'visit',
    'stump speech':'visit','stump':'visit','rally':'visit','visit':'visit',
    'travel to':'visit','go to':'visit','fly to':'visit','head to':'visit',
    'grassroots org':'grass','ground game':'grass','grassroots':'grass',
    'field office':'grass','volunteer':'grass','volunteers':'grass',
    'mobilize':'grass','mobilise':'grass','organise':'grass','organize':'grass',
    'door to door':'canvass','door-to-door':'canvass','canvassing':'canvass','canvass':'canvass',
    'hold a town hall':'townhall','town hall':'townhall','townhall':'townhall',
    'policy address':'speech','policy speech':'speech','national address':'speech',
    'press statement':'speech','give a speech':'speech','give speech':'speech',
    'deliver speech':'speech','speak about':'speech','talk about':'speech',
    'statement':'speech','address':'speech','speak':'speech','speech':'speech',
    'opposition research':'attack','oppo research':'attack','attack ads':'attack',
    'attack ad':'attack','negative ad':'attack','go negative':'attack',
    'criticise':'attack','criticize':'attack','slam':'attack','blast':'attack',
    'oppo':'attack','attack':'attack',
    'fundraising drive':'fundraise','donor drive':'fundraise','donor event':'fundraise',
    'call donors':'fundraise','raise funds':'fundraise','raise money':'fundraise',
    'fundraiser':'fundraise','fundraising':'fundraise','fundraise':'fundraise',
    'call list':'fundraise_calls','donor calls':'fundraise_calls',
    'debate prep':'debate','debate preparation':'debate','prepare for debate':'debate',
    'practice debate':'debate','debate':'debate',
    'coalition building':'coalition','voter outreach':'coalition','voter bloc':'coalition',
    'build coalition':'coalition','endorsements':'coalition','coalition':'coalition',
    'advertising blitz':'adblitz','flood the airwaves':'adblitz','flood airwaves':'adblitz',
    'media blitz':'adblitz','television ads':'adblitz','tv ads':'adblitz',
    'buy ads':'adblitz','run ads':'adblitz','ad blitz':'adblitz','adblitz':'adblitz',
    'surrogate tour':'surrogate','deploy surrogates':'surrogate','send surrogates':'surrogate',
    'send allies':'surrogate','surrogate':'surrogate',
    'damage control':'crisis','scandal response':'crisis','crisis response':'crisis',
    'respond to crisis':'crisis','counter scandal':'crisis','crisis':'crisis',
    'media press tour':'press_tour','press conference':'press_tour','press tour':'press_tour',
    'media tour':'press_tour','media appearance':'press_tour','interview':'press_tour',
    'spin room':'spin_room','spin':'spin_room',
    'delegate courtship':'delegate_push','court delegates':'delegate_push',
    'union rally speech':'union_speech','union rally':'union_speech','union speech':'union_speech',
    'labor rally':'union_speech','labour rally':'union_speech','union':'union_speech',
    'climate town hall':'climate_push','climate push':'climate_push','climate':'climate_push',
    'tough on crime':'crime_ad','law and order':'crime_ad',
    'economic populism':'econ_msg','economic message':'econ_msg','populism':'econ_msg',
    'college outreach':'college_push','college push':'college_push','youth vote':'college_push',
    'rural outreach':'rural_tour','rural tour':'rural_tour','rural':'rural_tour',
    'strategic reset':'strategic_reset','reset strategy':'strategic_reset',
    'rebrand tour':'rebrand_tour','rebrand':'rebrand_tour',
    'hail mary':'hail_mary_msg','bold message':'hail_mary_msg',
    'attack blitz':'attack_blitz','massive attack':'attack_blitz',
    'vp reveal':'vp_announce','surprise vp':'vp_announce','announce vp':'vp_announce',
    'policy pivot':'policy_pivot','pivot':'policy_pivot',
    'roast the frontrunner':'roast','roast candidate':'roast','roast':'roast',
  };
  const SORTED_KW = Object.keys(ACTION_KEYWORDS).sort((a, b) => b.length - a.length);

  // ── DETECT STATE ──────────────────────────────────────────────────────────
  function detectState(text) {
    const lower = text.toLowerCase();

    // Pass 1: unambiguous ALL-CAPS 2-letter codes only
    for (const c of (text.match(/\b([A-Z]{2})\b/g) || [])) {
      if (VALID_CODES.has(c) && !AMBIGUOUS.has(c)) return c;
    }
    // Pass 2: full state name (longest first - "new hampshire" before "new")
    // Word-boundary check prevents "indiana" matching inside "indianapolis" etc.
    for (const [name, code] of STATE_NAMES) {
      const re = new RegExp(`\\b${name.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
      if (re.test(lower)) return code;
    }
    // Pass 3: ambiguous codes as last resort (ALL-CAPS only)
    for (const c of (text.match(/\b([A-Z]{2})\b/g) || [])) {
      if (VALID_CODES.has(c)) return c;
    }
    return null;
  }

  // ── DETECT ACTION ─────────────────────────────────────────────────────────
  function detectAction(text) {
    const lower = text.toLowerCase();
    for (const kw of SORTED_KW) {
      if (lower.includes(kw)) return ACTION_KEYWORDS[kw];
    }
    return null;
  }

  // ── GAME STATE ────────────────────────────────────────────────────────────
  function getGS() { return window.GS || null; }

  function buildGameContext() {
    const GS = getGS();
    if (!GS || !GS.week || !GS.states?.length) return null;
    const phase = GS.phase === 'primary' ? 'PRIMARY' : 'GENERAL';
    const isInd = GS.playerParty === 'ind';
    const party = isInd
      ? (GS.playerPartyLabel || 'Independent')
      : GS.playerParty === 'dem' ? 'Democratic' : 'Republican';
    const weeksLeft = GS.phase === 'primary'
      ? Math.max(0, (GS.primaryWeeks || 20) - GS.week)
      : Math.max(0, (GS.primaryWeeks || 20) + (GS.generalWeeks || 16) - GS.week);
    const mom = GS.momentum >= 0 ? `+${GS.momentum.toFixed(1)}` : GS.momentum.toFixed(1);

    // Race format line
    const raceFormat = isInd ? 'THREE-WAY INDEPENDENT RUN' : `TWO-PARTY RACE (${party})`;
    let ctx = `PHASE: ${phase} | Week ${GS.week} | ${weeksLeft} weeks left | Race: ${raceFormat}\n`;
    ctx += `CANDIDATE: ${GS.playerName || 'Unknown'} (${party}) | Home: ${GS.homeState || '?'}\n`;
    ctx += `STATS: Fav ${GS.favorability.toFixed(1)}% | Elect ${GS.electability.toFixed(1)}% | `;
    ctx += `Ground ${GS.groundGame.toFixed(1)}% | Media ${GS.mediaCoverage.toFixed(1)}% | `;
    ctx += `Momentum ${mom} | Funds $${GS.funds.toFixed(1)}M | Endorsements ${GS.endorsements || 0}\n`;
    if (GS._scandalRisk != null) {
      const r = GS._scandalRisk;
      ctx += `SCANDAL: ${r.toFixed(1)}/15 (${r > 10 ? 'CRITICAL' : r > 6 ? 'ELEVATED' : 'LOW'})\n`;
    }

    // Opponents — handle multi-opponent general race
    if (GS.phase === 'general') {
      const opps = GS.generalOpponents || (GS.opponent ? [GS.opponent] : []);
      if (isInd && opps.length >= 2) {
        const dem = opps.find(o => o.party === 'dem');
        const rep = opps.find(o => o.party === 'rep');
        if (dem) ctx += `DEM OPPONENT: ${dem.name} (Approval: ${dem.approval || '?'}%)\n`;
        if (rep) ctx += `REP OPPONENT: ${rep.name} (Approval: ${rep.approval || '?'}%)\n`;
        ctx += `CONTEXT: This is a three-way race. No candidate needs a majority of popular vote, but MUST win 270 electoral votes. Splitting the vote risks throwing it to the House. You must win states outright.\n`;
      } else if (opps.length === 1) {
        ctx += `OPPONENT: ${opps[0].name} (${opps[0].party?.toUpperCase() || '?'}, Approval: ${opps[0].approval || '?'}%)\n`;
      }
    }

    const fmt = (s, lead) => {
      const m = lead > 0.5 ? `YOU +${lead.toFixed(0)}` : lead < -0.5 ? `OPP +${Math.abs(lead).toFixed(0)}` : 'TIED';
      return `${s.name}[${s.code}](${m},${s.ev}EV)`;
    };

    if (GS.phase === 'primary') {
      const del = GS.states.reduce((s, st) => s + (st.primaryDelegatesWon || 0), 0);
      ctx += `DELEGATES: ${del} won | Need ${Math.max(0, 1991 - del)} more\n`;
      const sorted = [...GS.states].filter(s => s.primLead !== undefined)
        .sort((a, b) => Math.abs(a.primLead) - Math.abs(b.primLead));
      ctx += `ALL STATES: ${sorted.map(s => fmt(s, s.primLead)).join(' | ')}\n`;
    } else {
      const myEV  = GS.states.filter(s => s.genLead > 0.5).reduce((n, s) => n + s.ev, 0);
      const oppEV = GS.states.filter(s => s.genLead < -0.5).reduce((n, s) => n + s.ev, 0);
      const tiedEV = 538 - myEV - oppEV;
      if (isInd) {
        ctx += `EV: YOU ${myEV} | OPPONENTS ${oppEV} | CONTESTED ${tiedEV} | Need 270 to win outright\n`;
      } else {
        ctx += `EV: YOU ${myEV} | OPP ${oppEV} | Need 270\n`;
      }
      const sorted = [...GS.states].sort((a, b) => Math.abs(a.genLead) - Math.abs(b.genLead));
      ctx += `ALL STATES: ${sorted.map(s => fmt(s, s.genLead)).join(' | ')}\n`;
    }
    return ctx.trim();
  }

  // ── LOCAL AI HELPERS ──────────────────────────────────────────────────────
  // Tracks whether the local model has been used at least once this session.
  // The first inference is slow (model warm-up); subsequent ones are faster.
  let _localAIFirstMessage = true;

  /**
   * Fix missing spaces in local LLM output.
   * node-llama-cpp detokenizes each token chunk individually; joining them
   * can strip the leading space that many tokenizers encode on word-start
   * tokens (e.g. "▁hello" → "hello" with no space prepended).
   * This heuristic re-inserts spaces where a lowercase/uppercase letter
   * immediately follows another letter or digit without a space.
   */
  function fixLocalAISpacing(text) {
    if (!text) return text;
    // Insert a space before an uppercase letter that immediately follows a
    // lowercase letter or digit (catches most BPE token-boundary drops).
    let fixed = text.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    // Insert a space before a word character that immediately follows a
    // punctuation character that normally ends a sentence (. ! ?) when the
    // next char is a letter — catches "word.NextSentence".
    fixed = fixed.replace(/([.!?])([A-Za-z])/g, '$1 $2');
    // Collapse any double-spaces that might result.
    fixed = fixed.replace(/ {2,}/g, ' ');
    return fixed.trim();
  }

  // ── LOCAL ADVICE (always works, no API) ──────────────────────────────────
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function localAdvice(actionId, stateCode, text) {
    const GS = getGS();
    if (!GS) return "Start your campaign first.";
    const sn = stateCode ? (CODE_TO_NAME[stateCode] || stateCode) : null;
    const phase = GS.phase;
    const scanRisk = GS._scandalRisk || 0;
    if (scanRisk > 10 && actionId !== 'crisis')
      return pick([
        `You're sitting on a political time bomb — scandal risk at ${scanRisk.toFixed(1)}/15. Nothing else matters until you run Crisis Response.`,
        `Forget the rallies. At ${scanRisk.toFixed(1)}/15 scandal risk, one bad news cycle buries you. Crisis Response. Now.`,
        `The press is circling. Kill the scandal story (${scanRisk.toFixed(1)}/15) before it kills your campaign.`,
      ]);
    if ((actionId === 'visit' || actionId === 'grass' || actionId === 'townhall' || actionId === 'canvass') && sn) {
      const st = GS.states?.find(s => s.code === stateCode);
      const lead = st ? (phase === 'primary' ? st.primLead : st.genLead) : null;
      const ev = st?.ev || '?';
      const pd = st?.pd || '?';
      const homeBonus = stateCode === GS.homeState ? ' Home state — expect a crowd bonus.' : '';
      const actionName = actionId === 'visit' ? 'Rally' : actionId === 'grass' ? 'Grassroots push' : actionId === 'townhall' ? 'Town Hall' : 'Canvass';
      const stake = phase === 'primary' ? `${pd} delegates` : `${ev} EV`;
      if (lead == null) return `${actionName} in ${sn} — polling's murky here, but ${stake} is worth the trip.${homeBonus}`;
      if (lead > 5) return pick([
        `${sn} is already ${lead.toFixed(0)} points yours — ${stake} in the bag. A ${actionName.toLowerCase()} here shores up the base, but you might be leaving closer fights unattended.`,
        `You're up ${lead.toFixed(0)} in ${sn}. Solid state, but don't waste too many weeks on wins you already own — ${stake} isn't worth neglecting real battlegrounds.`,
      ]);
      if (lead < -5) return pick([
        `You're down ${Math.abs(lead).toFixed(0)} points in ${sn} (${stake}). This is a fight, not a formality — a ${actionName.toLowerCase()} here could shift momentum, but only if you can close the gap in time.`,
        `${sn} is hostile territory — trailing by ${Math.abs(lead).toFixed(0)} with ${stake} on the line. Worth the swing if you've got no softer targets.`,
      ]);
      return pick([
        `${sn} is a knife fight — ${lead > 0 ? `you lead by just ${lead.toFixed(0)}` : lead < 0 ? `trailing by ${Math.abs(lead).toFixed(0)}` : 'dead even'} with ${stake} at stake.${homeBonus} Best possible use of a week.`,
        `${stake} and essentially a coin flip in ${sn}. A ${actionName.toLowerCase()} here is textbook battleground strategy — get in front of those voters.${homeBonus}`,
        `This is exactly the kind of state that wins elections. ${sn}'s margin is razor-thin and those ${phase === 'primary' ? 'delegates' : 'electoral votes'} aren't going to win themselves.`,
      ]);
    }
    const funds = GS.funds;
    const lines = {
      fundraise: pick([
        `War chest is at $${funds.toFixed(1)}M.${funds < 5 ? ' That is dangerously thin — no ads, no surrogates, no options. Fill the coffers.' : funds < 15 ? ' Comfortable but not dominant. More money means more options down the stretch.' : ' You\'re flush — but campaigns always find ways to spend it.'}`,
        `$${funds.toFixed(1)}M in the bank.${funds < 5 ? ' You\'re running on fumes. Fundraise or start rationing every decision.' : ' Smart campaigns always raise when they can, spend when they must.'}`,
      ]),
      fundraise_calls: pick([
        `Pick up the phone — direct donor calls bring in cash fast with no overhead. Good triage when the budget's tight.`,
        `Old school but it works: donor calls are low-cost, high-trust. Good bridge move while you plan your next big swing.`,
      ]),
      attack: pick([
        `Opposition research — 65% chance to wound them, 35% chance it blows up in your face. Run it from a position of strength, not desperation.`,
        `Going negative can crater their numbers, but voters hate mudslinging when it feels desperate. At $${funds.toFixed(1)}M and ${GS.favorability.toFixed(1)}% favorability, judge carefully.`,
        `Oppo is a scalpel, not a sledgehammer. If the numbers support it, hit them where it hurts — just have a clean follow-up ready.`,
      ]),
      speech: pick([
        `A Policy Address is how you drive the conversation instead of reacting to it. Good for favorability and setting the week's media narrative.`,
        `Define yourself before your opponent defines you. A sharp speech at ${GS.favorability.toFixed(1)}% favorability can solidify your brand with voters.`,
        `Speeches move favorability and media coverage — use this when you need to reset the narrative or own a specific issue.`,
      ]),
      debate: pick([
        `Debate Prep is the unsexy move that wins debates. Every week you skip it is a week your opponent gets to look sharper than you.`,
        `You can't fake debate skills. Prep now — electability at ${GS.electability.toFixed(1)}% means there's room to climb if you show up sharp.`,
      ]),
      coalition: pick([
        `Coalition Building fills your demographic blind spots. Every endorsement is a signal to a voter bloc you haven't fully won yet.`,
        `Endorsements are trust proxies — voters follow leaders they already trust. Build the coalition before the final stretch.`,
      ]),
      adblitz: pick([
        `Ad Blitz saturates swing states simultaneously — surgical if you're competitive in multiple places, wasteful if you're not. At $${funds.toFixed(1)}M, ${funds >= 10 ? 'you can afford it' : 'run the numbers first'}.`,
        `Flood the airwaves and make them respond to you. Best when you have the funds and a clear message. Currently at $${funds.toFixed(1)}M.`,
      ]),
      surrogate: pick([
        `Surrogate Tour is a force multiplier — three swing states covered while you sleep. Invaluable when you can't be everywhere.`,
        `Send the allies in. Surrogates cover swing states at scale — smarter than flying yourself to every corner of the map.`,
      ]),
      crisis: pick([
        `Scandal risk at ${scanRisk.toFixed(1)}/15 — ${scanRisk > 10 ? 'this is a five-alarm fire. Run Crisis Response immediately.' : scanRisk > 6 ? 'getting uncomfortable. Address it before a slow leak becomes a burst pipe.' : 'manageable for now, but don\'t ignore it.'}`,
        `${scanRisk > 10 ? 'The story is already out there. Crisis Response is your only move.' : `At ${scanRisk.toFixed(1)}/15, you're not bleeding out yet — but don't let it fester.`}`,
      ]),
      press_tour: pick([
        `Media Press Tour reframes the narrative and drives favorability. Best when you want to control what voters are talking about this week.`,
        `Get in front of cameras on your terms. A good press tour shifts coverage and keeps opponents on defense.`,
      ]),
      union_speech: pick([
        `Union crowd, Rust Belt stakes. A Union Rally fires up working-class voters — the backbone of any Midwest coalition.`,
        `Labour vote is loyalty vote. Show up, speak plainly, and watch the Rust Belt numbers move.`,
      ]),
      climate_push: pick([
        `Climate Town Hall energises urban and youth blocs — expect a moderate dip with rural and older voters as the tradeoff.`,
        `Good for the youth vote, less popular in farm country. Know your map before leaning hard on this one.`,
      ]),
      crime_ad: pick([
        `Tough on Crime plays well in suburban districts — delivers there, generates some blowback in urban and youth areas. Net positive if the map supports it.`,
        `Law and order messaging moves suburban moderates. Just know you're trading some youth enthusiasm for it.`,
      ]),
      econ_msg: pick([
        `Economic Populism is Midwest catnip — strong in industrial and rural districts where voters feel left behind.`,
        `Pocket-book politics. This message resonates hardest where wages stagnated and factories left. Hit those states.`,
      ]),
      college_push: pick([
        `College Outreach drives the youth and educated vote — high ceiling, but turnout is the variable. Worth the investment early.`,
        `Young voters can swing a state, but they need to show up. This move builds the pipeline.`,
      ]),
      rural_tour: pick([
        `Rural Outreach — low-cost, high-trust, and often overlooked. Those small-county margins add up fast.`,
        `You can't win just cities and suburbs. Rural Outreach softens the opposition's margins in their home turf.`,
      ]),
      national_address: pick([
        `Prime-time gamble. A National Address can define your candidacy — or expose every weakness live on television. You're at ${GS.favorability.toFixed(1)}% favorability. Choose your moment.`,
        `This is the whole country watching. Nail it and you reframe the race. Blow it and you're on defense for weeks.`,
      ]),
      attack_blitz: pick([
        `Massive Attack Blitz — maximum damage potential, maximum backfire risk. Only deploy this when you can absorb the hit if it goes sideways.`,
        `Going scorched earth has consequences. At ${GS.favorability.toFixed(1)}% favorability, can you afford the blowback if this misfires?`,
      ]),
      vp_announce: pick([
        `VP Reveal is a one-shot map reshaper. The right pick energises a coalition; the wrong one introduces a liability. Use it when the timing maximises impact.`,
        `You only get to do this once. A VP announcement can flip a state, shore up a demographic, or steal a news cycle. Choose wisely.`,
      ]),
      policy_pivot: pick([
        `Major Policy Pivot — new lane, new voters, potentially alienated base. High risk, potentially decisive. Don't do this unless you're losing.`,
        `Pivots signal desperation or evolution. Make sure the voters read it as the latter.`,
      ]),
      roast: pick([
        `Roast the frontrunner — sharp, funny, low collateral damage to your own numbers. Great for earned media and the youth vote.`,
        `Political comedy is actually great strategy. Humanises you, wounds them, and the press covers it for free.`,
      ]),
      strategic_reset: pick([
        `Strategic Reset is the scorched-earth rebuild. New message, new energy, new direction. Radical — but sometimes radical is the only move left.`,
        `When nothing's working, blow it up and start clean. This is your 'break glass in emergency' option.`,
      ]),
      spin_room: pick([
        `Spin Room is damage mitigation at its finest. Control the post-event narrative before your opponent's team does.`,
        `Every bad debate or rough news cycle needs a spin. Get in there and shape the story.`,
      ]),
      oppo_rapid: pick([
        `Rapid Response — don't let an attack go unanswered. The 24-hour rule is real; counter it before it sticks.`,
        `Speed matters. A swift rebuttal defuses attacks before voters encode them as truth.`,
      ]),
      delegate_push: pick([
        `Delegate Courtship is the backroom play — efficient when you're close to the threshold and soft delegates are in reach.`,
        `Lock in uncommitted delegates directly. It's not glamorous, but winning the nomination is.`,
      ]),
    };
    if (lines[actionId]) return lines[actionId];
    // Generic best-move — third-party aware
    const isPrimary = phase === 'primary';
    const isInd3 = GS.playerParty === 'ind';
    const top = [...(GS.states || [])]
      .filter(s => Math.abs(isPrimary ? s.primLead : s.genLead) < 8 && s.ev >= 3)
      .sort((a, b) => Math.abs(a[isPrimary ? 'primLead' : 'genLead']) - Math.abs(b[isPrimary ? 'primLead' : 'genLead']))[0];
    if (isInd3 && !isPrimary) {
      const myEV = (GS.states || []).filter(s => s.genLead > 0.5).reduce((n,s) => n+s.ev, 0);
      const needed = 270 - myEV;
      return top
        ? `As an independent you need 270 EV outright — you're at ${myEV} with ${needed} still needed. ${top.name} (${top.ev} EV) is your tightest battleground right now — a rally there is your highest-impact move this week.`
        : `You need 270 electoral votes to win outright as an independent. Consolidate your strongest states then push into contested swing territory.`;
    }
    return top
      ? `Your most contested state right now is ${top.name} (${isPrimary ? `${top.pd || '?'} delegates` : `${top.ev} EV`}) - a rally or ground game push there has the highest payoff this week.`
      : `Focus on your most competitive states - that's where the race is won.`;
  }

  // ── BUILD THE ADVICE PROMPT (shared between local and worker paths) ──────
  function buildAdvicePrompt(actionId, stateCode, gameContext) {
    const GS = getGS();
    const isInd = GS?.playerParty === 'ind';
    const sn = stateCode ? (CODE_TO_NAME[stateCode] || stateCode) : null;
    const raceNote = isInd
      ? `IMPORTANT: This is a THREE-WAY RACE. The player is an independent candidate running against BOTH a Democrat and a Republican. They need 270 Electoral College votes to win outright. Advice must be specific to the independent strategy — avoiding splitting key states, finding wedge opportunities where both major parties are unpopular, and securing enough EV to prevent either opponent from reaching 270.`
      : `This is a standard two-party race.`;
    const directive = sn
      ? `The player asked to do: ${actionId} in ${sn} [${stateCode}]. Write your advice specifically and only about ${sn}.`
      : `The player asked to do: ${actionId || 'an unspecified action'}.`;
    return `You are a seasoned, sharp-tongued American political campaign advisor — think James Carville meets a war-room veteran. You speak in vivid, punchy language. You never hedge. You reference specific numbers. You vary your opening every time (never start with "I" or "You should"). Sometimes you use a memorable political metaphor. Sometimes you're blunt and urgent. Sometimes darkly humorous. Always confident.\n\n${raceNote}\n\n${directive}\n\nGAME STATE:\n${gameContext}\n\nWrite 2-3 sentences of direct, flavourful strategic advice. Reference actual numbers from the game state. Be specific to ${sn || 'this action'}. Vary your tone — urgent, wry, motivating, or tactical depending on the situation. Return ONLY the advice text - no JSON, no preamble, no bullet points, no state suggestions.`;
  }

  // ── ADVISOR CALL (advice text only) ──────────────────────────────────────
  // Priority order:
  //   1. Local bundled model via IPC (desktop .exe only, instant, no internet)
  //   2. localAdvice() hardcoded strings (always works, called by the send() wrapper)
  async function fetchAdvice(actionId, stateCode, text, gameContext) {
    const prompt = buildAdvicePrompt(actionId, stateCode, gameContext);

    // ── 1. Try local bundled model (desktop only) ──────────────────────────
    if (window.isElectron && window.localAI) {
      try {
        const localText = await window.localAI.getAdvice(prompt);
        if (localText && localText.length > 10) return fixLocalAISpacing(localText);
      } catch (_) {
        // Model not ready yet or failed — fall through to worker
      }
    }

    return null;
  }

  // ── QUEUE ACTION IN GAME ENGINE ───────────────────────────────────────────
  function queueAction(actionId, stateCode) {
    const allActions = [...(window.ACTIONS || []), ...(window.UNDERDOG_ACTIONS || [])];
    const action = allActions.find(a => a.id === actionId);
    if (!action) return false;
    const GS = getGS();
    const phase = GS?.phase;
    if (action.generalOnly && phase !== 'general') return false;
    if (action.primaryOnly  && phase !== 'primary') return false;
    if (action.cost > 0 && GS?.funds < action.cost) return false;

    // Set state on GS directly first, before calling selectAction
    if (action.needsState && stateCode && VALID_CODES.has(stateCode)) {
      if (GS) GS.targetState = stateCode;
      const sel = document.getElementById('target-state-select');
      if (sel) sel.value = stateCode;
    } else if (!action.needsState && GS) {
      GS.targetState = null;
    }

    // selectAction sets GS.selectedAction, highlights button, triggers minigame
    const sa = window.selectAction || (typeof selectAction !== 'undefined' ? selectAction : null);
    if (sa) sa(actionId);

    // For state actions, fire change event so UI updates (safe-state warning etc.)
    if (action.needsState && stateCode && VALID_CODES.has(stateCode)) {
      const sel = document.getElementById('target-state-select');
      if (sel && sel.value === stateCode) sel.dispatchEvent(new Event('change'));
    }

    // Light up End Week button
    const nwBtn = document.querySelector('.next-week-btn');
    if (nwBtn) nwBtn.classList.add('action-ready');

    return true;
  }

  // ── UI HELPERS ────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function addMsg(role, html, chips) {
    const log = document.getElementById('ai-chat-log');
    if (!log) return;
    const el = document.createElement('div');
    if (role === 'player') {
      el.style.cssText = 'display:flex;justify-content:flex-end';
      el.innerHTML = `<div style="background:#10141c;border:1px solid #1e2535;border-radius:8px 8px 2px 8px;padding:7px 11px;font-size:12px;color:#e8ecf4;max-width:85%;line-height:1.5;word-wrap:break-word">${esc(html)}</div>`;
    } else {
      let chipHtml = '';
      if (chips?.length) {
        chipHtml = `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">` +
          chips.map(c => `<button onclick="window._aiChipClick(${esc(JSON.stringify(c))})"
            style="padding:5px 11px;background:#0d1117;border:1px solid rgba(200,168,75,.3);border-radius:12px;color:#c8a84b;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer;transition:all .15s;white-space:nowrap"
            onmouseover="this.style.background='rgba(200,168,75,.12)';this.style.borderColor='#c8a84b'"
            onmouseout="this.style.background='#0d1117';this.style.borderColor='rgba(200,168,75,.3)'"
          >${esc(c.label)}</button>`).join('') + `</div>`;
      }
      el.style.cssText = 'display:flex;gap:8px;align-items:flex-start';
      el.innerHTML = `
        <div style="width:26px;height:26px;border-radius:50%;background:rgba(200,168,75,.12);border:1px solid rgba(200,168,75,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;margin-top:1px">✨</div>
        <div style="background:rgba(200,168,75,.04);border:1px solid rgba(200,168,75,.1);border-radius:2px 8px 8px 8px;padding:9px 12px;font-size:12px;color:#c8d0e0;max-width:92%;line-height:1.65;flex:0 1 auto;width:fit-content;word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap">${html}${chipHtml}</div>`;
    }
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function showThinking() {
    const log = document.getElementById('ai-chat-log');
    if (!log) return;
    const el = document.createElement('div');
    el.id = 'ai-thinking';
    el.style.cssText = 'display:flex;gap:8px;align-items:center';
    el.innerHTML = `<div style="width:26px;height:26px;border-radius:50%;background:rgba(200,168,75,.12);border:1px solid rgba(200,168,75,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px">✨</div>
      <div id="ai-dots" style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#4a5568">Thinking.</div>`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    let n = 0;
    el._t = setInterval(() => { const d = document.getElementById('ai-dots'); if (d) d.textContent = 'Thinking' + '.'.repeat((n++ % 3) + 1); }, 350);
  }

  function hideThinking() {
    const el = document.getElementById('ai-thinking');
    if (el) { clearInterval(el._t); el.remove(); }
  }

  function buildSuggestionChips() {
    const el = document.getElementById('ai-chat-chips');
    if (!el) return;
    const GS = getGS();
    const chips = [];
    if (!GS) {
      chips.push({ label: "Where should I focus?", query: "Where should I focus?" });
    } else {
      const scanRisk = GS._scandalRisk || 0;
      if (scanRisk > 10) chips.push({ label: '🚨 Crisis response now', actionId: 'crisis', state: '' });
      if (GS.funds < 4)  chips.push({ label: '💰 Fundraise - low funds', actionId: 'fundraise', state: '' });
      const isIndChips = GS.playerParty === 'ind';
      chips.push({ label: "What's my best move?", query: isIndChips ? "What's my best move as an independent?" : "What's my best move?" });
      const isPrimary = GS.phase === 'primary';
      const top = [...(GS.states || [])]
        .filter(s => Math.abs(isPrimary ? s.primLead : s.genLead) < 8 && s.ev >= 3)
        .sort((a, b) => Math.abs(a[isPrimary ? 'primLead' : 'genLead']) - Math.abs(b[isPrimary ? 'primLead' : 'genLead']))[0];
      if (top) chips.push({ label: `Rally in ${top.name}`, actionId: 'visit', state: top.code });
      if (GS.phase === 'primary') {
        chips.push({ label: '🎤 Debate Prep', actionId: 'debate', state: '' });
        chips.push({ label: '📜 Policy Address', actionId: 'speech', state: '' });
        chips.push({ label: '🤝 Coalition Building', actionId: 'coalition', state: '' });
      } else {
        chips.push({ label: '📡 Ad Blitz', actionId: 'adblitz', state: '' });
        chips.push({ label: '🗞 Press Tour', actionId: 'press_tour', state: '' });
        chips.push({ label: '🤝 Surrogate Tour', actionId: 'surrogate', state: '' });
      }
      if (isIndChips && GS.phase === 'general') {
        chips.push({ label: '⚡ How do I reach 270?', query: 'How do I reach 270 electoral votes as an independent?' });
      }
    }
    el.innerHTML = chips.slice(0, 5).map(c =>
      `<button onclick="window._aiQuickChip(${esc(JSON.stringify(c))})"
        style="padding:4px 9px;background:#0d1117;border:1px solid #1e2535;border-radius:12px;color:#8a93a8;font-family:'IBM Plex Mono',monospace;font-size:9px;cursor:pointer"
        onmouseover="this.style.borderColor='rgba(200,168,75,.4)';this.style.color='#c8a84b'"
        onmouseout="this.style.borderColor='#1e2535';this.style.color='#8a93a8'"
      >${esc(c.label)}</button>`
    ).join('');
  }

  // ── CHIP HANDLERS ─────────────────────────────────────────────────────────
  window._aiChipClick = function(chip) {
    if (chip.query) {
      const inp = document.getElementById('ai-chat-input');
      if (inp) { inp.value = chip.query; window._aiSend(); }
      return;
    }
    if (!chip.actionId) return;
    const ok = queueAction(chip.actionId, chip.state || '');
    const allActions = [...(window.ACTIONS || []), ...(window.UNDERDOG_ACTIONS || [])];
    const action = allActions.find(a => a.id === chip.actionId);
    if (ok && action) {
      const stateStr = chip.state ? ` in ${CODE_TO_NAME[chip.state] || chip.state}` : '';
      const needsStateStill = action.needsState && !chip.state;
      addMsg('advisor',
        `${action.icon} <strong>${action.name}${stateStr}</strong> queued.` +
        (needsStateStill ? ' Pick a state in the dropdown, then hit <em>End Week →</em>.' : ' Hit <em>End Week →</em> to execute.')
      );
      setTimeout(() => document.getElementById(`ab-${action.id}`)?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 150);
    } else if (action) {
      const GS = getGS();
      const note = action.generalOnly && GS?.phase !== 'general' ? ' (general only)'
        : action.primaryOnly && GS?.phase !== 'primary' ? ' (primary only)'
        : GS?.funds < action.cost ? ` (need $${action.cost}M - fundraise first)` : '';
      addMsg('advisor', `Can't queue ${action.name}${note}. Try selecting it manually.`);
    }
  };

  window._aiQuickChip = function(chip) {
    if (chip.query) { const inp = document.getElementById('ai-chat-input'); if (inp) { inp.value = chip.query; window._aiSend(); } }
    else window._aiChipClick(chip);
  };

  // ── MAIN SEND ─────────────────────────────────────────────────────────────
  async function send() {
    const inputEl = document.getElementById('ai-chat-input');
    const goBtn   = document.getElementById('ai-chat-go');
    const text    = (inputEl?.value || '').trim();
    if (!text) return;

    addMsg('player', text);
    if (inputEl) inputEl.value = '';
    if (goBtn)   { goBtn.textContent = '-'; goBtn.disabled = true; goBtn.style.opacity = '.5'; }
    if (inputEl) inputEl.disabled = true;
    showThinking();

    const gameContext = buildGameContext();
    if (!gameContext) {
      hideThinking();
      addMsg('advisor', "Start your campaign first, then I can help you strategise.");
      if (goBtn)   { goBtn.textContent = 'GO'; goBtn.disabled = false; goBtn.style.opacity = '1'; }
      if (inputEl) { inputEl.disabled = false; inputEl.focus(); }
      return;
    }

    try {
      // CLIENT detects action + state - LLM never touches this
      const actionId   = detectAction(text);
      const stateCode  = detectState(text);
      const stateName  = stateCode ? (CODE_TO_NAME[stateCode] || stateCode) : null;
      const allActions = [...(window.ACTIONS || []), ...(window.UNDERDOG_ACTIONS || [])];
      const action     = actionId ? allActions.find(a => a.id === actionId) : null;
      const GS         = getGS();

      // Get advice text - try LLM, fall back to local instantly
      let advice = null;
      // On the first message in the desktop app, the model may still be
      // warming up — show a heads-up so the user knows it hasn't frozen.
      if (window.isElectron && _localAIFirstMessage) {
        const warmUpEl = document.createElement('div');
        warmUpEl.id = 'ai-warmup-notice';
        warmUpEl.style.cssText = 'font-family:\'IBM Plex Mono\',monospace;font-size:10px;color:#4a5568;padding:4px 0 2px;';
        warmUpEl.textContent = '🖥 Local AI model warming up — first response may take a moment…';
        const log = document.getElementById('ai-chat-log');
        if (log) { log.appendChild(warmUpEl); log.scrollTop = log.scrollHeight; }
      }
      try {
        const raw = await fetchAdvice(actionId, stateCode, text, gameContext);
        if (raw && typeof raw === 'string' && raw.length > 10 && !raw.includes('{')) advice = raw;
        if (advice && window.isElectron) _localAIFirstMessage = false;
      } catch (_) {}
      // Remove warm-up notice regardless of outcome
      document.getElementById('ai-warmup-notice')?.remove();
      if (!advice) advice = localAdvice(actionId, stateCode, text);

      hideThinking();

      // Build chips - 100% client-side, no LLM
      const chips = [];
      if (action) {
        const isPrimary = GS?.phase === 'primary';
        const canAfford  = !action.cost || (GS?.funds >= action.cost);
        const rightPhase = (!action.generalOnly || GS?.phase === 'general') && (!action.primaryOnly || isPrimary);
        if (canAfford && rightPhase) {
          const labelState = (action.needsState && stateName) ? ` in ${stateName}` : '';
          chips.push({ label: `✓ Do it: ${action.icon} ${action.name}${labelState}`, actionId: action.id, state: stateCode || '' });
        }
        // If needs state but none mentioned, suggest top contested states
        if (action.needsState && !stateCode) {
          const isPrim = GS?.phase === 'primary';
          [...(GS?.states || [])]
            .filter(s => Math.abs(isPrim ? s.primLead : s.genLead) < 10 && s.ev >= 3)
            .sort((a, b) => Math.abs(a[isPrim ? 'primLead' : 'genLead']) - Math.abs(b[isPrim ? 'primLead' : 'genLead']))
            .slice(0, 3)
            .forEach(s => chips.push({ label: `${action.icon} ${action.name} in ${s.name}`, actionId: action.id, state: s.code }));
        }
      } else {
        // No action detected
        const isPrim = GS?.phase === 'primary';
        if (stateCode && stateName) {
          // Player mentioned a specific state — anchor chips to that state, not the global closest race
          chips.push({ label: `🗺 Rally in ${stateName}`, actionId: 'visit', state: stateCode });
          chips.push({ label: `🌱 Grassroots in ${stateName}`, actionId: 'grass', state: stateCode });
          chips.push({ label: `🏛 Town Hall in ${stateName}`, actionId: 'townhall', state: stateCode });
          chips.push({ label: '📜 Policy Address', actionId: 'speech', state: '' });
        } else {
          // No state mentioned — varied strategic options, not always the single tossup
          const competitive = [...(GS?.states || [])]
            .filter(s => Math.abs(isPrim ? s.primLead : s.genLead) < 10 && s.ev >= 3)
            .sort((a, b) => Math.abs(a[isPrim ? 'primLead' : 'genLead']) - Math.abs(b[isPrim ? 'primLead' : 'genLead']));
          const top = competitive[0];
          const second = competitive[1];
          const funds = GS?.funds || 0;
          const scanRisk = GS?._scandalRisk || 0;
          if (scanRisk > 8) chips.push({ label: '🔥 Crisis Response now', actionId: 'crisis', state: '' });
          if (top) chips.push({ label: `🗺 Rally in ${top.name}`, actionId: 'visit', state: top.code });
          if (funds < 6) {
            chips.push({ label: '💰 Fundraise — low funds', actionId: 'fundraise', state: '' });
          } else if (GS?.phase === 'general') {
            const nonState = [
              { label: '📡 Ad Blitz — hit all swings', actionId: 'adblitz', state: '' },
              { label: '🤝 Surrogate Tour', actionId: 'surrogate', state: '' },
              { label: '📜 Policy Address', actionId: 'speech', state: '' },
              { label: '🗞 Press Tour', actionId: 'press_tour', state: '' },
              { label: '🤝 Coalition Building', actionId: 'coalition', state: '' },
            ];
            chips.push(nonState[Math.floor(Math.random() * nonState.length)]);
          } else {
            const primaryNonState = [
              { label: '💰 Fundraise', actionId: 'fundraise', state: '' },
              { label: '🎤 Debate Prep', actionId: 'debate', state: '' },
              { label: '📜 Policy Address', actionId: 'speech', state: '' },
              { label: '🤝 Coalition Building', actionId: 'coalition', state: '' },
              { label: '📞 Call List Drive', actionId: 'fundraise_calls', state: '' },
            ];
            chips.push(primaryNonState[Math.floor(Math.random() * primaryNonState.length)]);
          }
          if (second && chips.length < 4) chips.push({ label: `🌱 Grassroots in ${second.name}`, actionId: 'grass', state: second.code });
        }
      }

      addMsg('advisor', advice, chips);
      buildSuggestionChips();

    } catch (err) {
      hideThinking();
      addMsg('advisor', `Something went wrong - try: "Rally in Ohio" or "Fundraise".`);
    } finally {
      if (goBtn)   { goBtn.textContent = 'GO'; goBtn.disabled = false; goBtn.style.opacity = '1'; }
      if (inputEl) { inputEl.disabled = false; inputEl.focus(); }
    }
  }

  // ── BUILD UI ──────────────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById('ai-advisor-box')) return;
    if ((window.POTUS_AI_MODE || 'buttons') === 'buttons') return;
    const mount = document.getElementById('ai-advisor-mount');
    if (!mount) return;
    document.getElementById('action-tabs')?.style.setProperty('display','none');
    document.getElementById('actions-grid')?.style.setProperty('display','none');
    const box = document.createElement('div');
    box.id = 'ai-advisor-box';
    box.style.cssText = 'background:var(--bg2);border:1px solid rgba(200,168,75,.28);border-radius:8px;padding:14px;margin-bottom:10px;';
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:11px">
        <span style="font-size:15px">✨</span>
        <div style="flex:1">
          <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#c8a84b">AI Campaign Advisor</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:8px;color:#4a5568;margin-top:1px">Reads your live map - Plans your strategy</div>
        </div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:8px;padding:2px 7px;border-radius:10px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.18);color:rgba(200,168,75,.55)">🖥 LOCAL AI</span>
      </div>
      <div id="ai-chat-log" style="max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:10px;padding-right:2px;scrollbar-width:thin;scrollbar-color:#1e2535 transparent;"></div>
      <div style="display:flex;gap:7px;align-items:flex-end">
        <textarea id="ai-chat-input" rows="2"
          placeholder="e.g. 'rally in California' or 'fundraise' or 'what\\'s my best move?'-"
          style="flex:1;background:#060a12;border:1px solid #1e2535;border-radius:6px;color:#e8ecf4;font-family:'IBM Plex Sans',sans-serif;font-size:12px;padding:8px 10px;resize:none;line-height:1.55;outline:none;box-sizing:border-box;min-height:52px;"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._aiSend()}"></textarea>
        <button id="ai-chat-go" onclick="window._aiSend()"
          style="padding:0 14px;height:52px;background:#c8a84b;border:none;border-radius:6px;color:#0a0c10;font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;">GO</button>
      </div>
      <div style="margin-top:9px"><div id="ai-chat-chips" style="display:flex;flex-wrap:wrap;gap:4px"></div></div>`;
    mount.appendChild(box);
    addMsg('advisor', "I'm watching your campaign live. Tell me what to do - e.g. <em>\"rally in California\"</em>, <em>\"fundraise\"</em>, or ask <em>\"what's my best move?\"</em>");
    buildSuggestionChips();
  }

  window._aiSend = send;

  // ── BOOT ──────────────────────────────────────────────────────────────────
  function tryBuild() {
    if ((window.POTUS_AI_MODE || 'buttons') === 'buttons') return;
    if (!document.getElementById('game-screen')?.classList.contains('active')) return;
    if (!document.getElementById('ai-advisor-mount')) return;
    buildUI();
  }
  new MutationObserver(tryBuild).observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });

  const hookTimer = setInterval(() => {
    if (typeof window.renderAll === 'function' && !window._aiHooked) {
      window._aiHooked = true;
      const orig = window.renderAll;
      window.renderAll = function() {
        orig.apply(this, arguments);
        if ((window.POTUS_AI_MODE || 'buttons') !== 'buttons') {
          document.getElementById('action-tabs')?.style.setProperty('display','none');
          document.getElementById('actions-grid')?.style.setProperty('display','none');
          if (!document.getElementById('ai-advisor-box')) buildUI();
          else buildSuggestionChips();
        }
      };
      clearInterval(hookTimer);
    }
  }, 100);

})();
