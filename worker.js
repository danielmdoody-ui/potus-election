// ═══════════════════════════════════════════════════════════════════════════════
// POTUS AI Advisor — Cloudflare Worker v4.0
//
// Architecture:
//   1. Parse & validate incoming request
//   2. Pre-compute a deterministic local answer (instant, zero cost, always works)
//   3. Try Groq LLM — 3 models in cascade if one is rate-limited or errors
//   4. If ALL Groq models fail → return local answer silently (never errors out)
//   5. Per-IP rate limiting via KV (optional — degrades gracefully if KV absent)
//
// Rate-limit strategy:
//   - 20 req/min per IP; above that → local fallback (still useful, never "overloaded")
//   - Groq cascade: llama-3.3-70b-versatile → llama-3.1-8b-instant → llama3-8b-8192
//   - 8s timeout per Groq model attempt
//
// Cloudflare bindings (set in dashboard → Workers → Settings → Variables):
//   GROQ_KEY  — Groq API key  (required for LLM answers)
//   POTUS_KV  — KV namespace  (optional — enables per-IP rate limiting)
// ═══════════════════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── Gemini fallback helper ────────────────────────────────────────────────────
async function tryGemini(userMessage, systemPrompt, geminiKey) {
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 1000 },
  };
  const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini empty response');
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// Model cascade — on 429 or timeout, automatically fall through to the next
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // primary — large, high quality, json_object supported
  'llama-3.1-8b-instant',      // secondary — fast, separate quota bucket
  'llama3-70b-8192',           // tertiary — legacy endpoint, still active, separate quota
];

// Models confirmed to support response_format: json_object
const JSON_MODE_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama-3.1-70b-versatile',
]);

// ── System prompt — tight, factual, small-model-friendly ─────────────────────
const SYSTEM_PROMPT = `You are a campaign strategist for POTUS, a US presidential election video game.

You receive a structured GAME STATE followed by the player's message.
You must return ONLY valid JSON — no markdown, no extra text outside the JSON object.

Required JSON schema:
{
  "advice": "2-3 sentences of direct strategic advice. Reference the exact numbers from the game state.",
  "type": "single best actionId or 'none'",
  "state": "2-letter US state code, or empty string if not applicable",
  "suggestions": [
    { "label": "4-6 word action phrase starting with a verb", "actionId": "string", "state": "string" }
  ]
}

Valid actionId values:
  ALWAYS AVAILABLE: visit*, speech, attack, fundraise, grass*, debate, coalition, adblitz, townhall*, surrogate, crisis, press_tour, fundraise_calls, roast
  GENERAL ONLY: union_speech, climate_push, crime_ad, econ_msg, college_push, rural_tour, national_address, attack_blitz, vp_announce, policy_pivot
  PRIMARY ONLY: canvass*, spin_room, oppo_rapid, delegate_push
  UNDERDOG (general, trailing badly): strategic_reset, rebrand_tour, hail_mary_msg
  (* = REQUIRES A STATE — always include a 2-letter state code for these)

ACTIONS REQUIRING STATE (always set "state" field): visit, grass, canvass, townhall
ACTIONS NOT REQUIRING STATE (leave "state" empty): all others

STATE FORMAT: States appear as FullName[CODE](YOU +N or OPPONENT +N, NEV). "Idaho[ID](YOU +4, 4EV)" means you lead Idaho by 4 points. "TIED" = exactly 0 margin.

CRITICAL READING RULES:
- The game state ALWAYS contains an "ALL STATES:" line with EVERY US state. Check it FIRST for any state question.
- Sections (BATTLEGROUNDS, YOUR SAFE STATES, OPPONENT LEADS, CLOSE RACES) highlight subsets — ALL STATES has everything.
- PHASE line = PRIMARY or GENERAL. Read first.
- Never invent numbers. All data is in the game state.
- NEVER say "I don't see that state" — it is ALWAYS in ALL STATES.
- SCANDAL RISK above 10/15 → recommend crisis immediately, no exceptions.
- BUDGET ALERT line present → NEVER recommend any action listed there (player can't afford it).
- Home state → player gets a large bonus visiting it. Mention this when relevant.

DEMOGRAPHICS RULES (Urban/Suburban/Rural/Youth/Seniors — scale 20–80):
- Below 35 = critically weak → flag it, recommend targeted action: union_speech/rural_tour for rural; climate_push/college_push for youth; crime_ad for suburban; coalition for urban.
- Above 65 = strong, no need to shore up further.
- Match to party: Dem weak in rural → rural_tour. Rep weak in suburban → crime_ad.

ANSWERING STATE QUESTIONS ("How am I doing in Idaho?"):
1. Find state in ALL STATES by full name or 2-letter code.
2. State the margin clearly: "You lead Idaho[ID] by +4 points (4 EV)."
3. Classify: battleground / safe / opponent territory / home state.
4. Give 1 concrete action. If visit/grass/townhall → always include state code in suggestion.
5. NEVER say state doesn't exist.

EXECUTING ACTIONS ("rally in Ohio" / "grassroots PA" / "do X in Florida"):
- type = exact actionId. For state-requiring actions always set state = 2-letter code.
- Confirm: "Setting up Campaign Rally in Ohio[OH] — hit End Week to execute."
- Include as first suggestion chip.

ANSWERING FACTUAL QUESTIONS:
- Funds → exact $ from CANDIDATE STATS. Flag if below $5M.
- Delegates → exact number from DELEGATES.
- EV → exact EV and WINNING/LOSING.
- Demographics → quote the numbers; flag any below 35.
- Numbers first, strategy second.

SUGGESTIONS: Always 2-3 specific clickable suggestions. State-requiring actions must include state code. Never leave empty.`;

// ── Minigame evaluation system prompt ────────────────────────────────────────
const MG_SYSTEM_PROMPT = `You are a political analyst evaluating a presidential candidate's live performance in POTUS, an election video game.

The player typed a real free-text response to a political situation (debate question, heckler, press question, donor pitch, etc.).
Your job is to evaluate how FIVE voter demographics respond to that answer, and give brief feedback.

Return ONLY valid JSON — no markdown, no extra text:
{
  "feedback": "2-sentence reaction from the room. Be vivid and specific to what they actually said.",
  "impacts": {
    "urban":    integer from -10 to +10,
    "suburban": integer from -10 to +10,
    "rural":    integer from -10 to +10,
    "youth":    integer from -8 to +8,
    "seniors":  integer from -8 to +8
  },
  "bonus": integer from 0 to 15
}

SCORING RULES — READ THESE CAREFULLY:
- A GOOD answer (specific, confident, substantive) should give mostly POSITIVE scores. Do NOT drag good answers down just to show "tradeoffs".
- A genuinely great answer can score +4 to +8 on most groups. Reserve penalties for groups that genuinely oppose the ideology.
- A vague, short, or evasive answer gets small negatives (-1 to -3) across the board.
- Ideological tradeoffs apply only when the answer takes a STRONG partisan stance:
  - Strong progressive stance: urban/youth +5 to +8, rural/seniors -2 to -4
  - Strong conservative stance: rural/seniors +5 to +8, urban/youth -2 to -4
  - Moderate/bipartisan answer: all groups +1 to +3 — no major penalties
  - Populist/anti-establishment: youth/rural +3 to +6, suburban -1 to -2
- DO NOT punish moderate, centrist, or competent answers. Those earn broad positive scores.
- A specific, confident, well-argued answer adds +1 to +2 across all groups on top of ideology.
- If the player mentions their opponent credibly (with a contrast), add +1 to most groups.
- bonus = reflect total quality: great answer = 12-15, solid = 7-11, okay = 3-6, weak = 0-2
- Never give ALL groups the same score — some variation is realistic, but avoid uniformly negative scores for good answers.
- The party context: Dem player's natural base is urban/youth; Rep player's base is rural/seniors. Give appropriate base support.

Context from SITUATION field tells you the scenario. PARTY tells you the player's party.`;

// ── AI Minigame Question Generator — generates contextual questions from game state ──
const MG_QUESTION_PROMPT = `You are a political scenario writer for POTUS, a US presidential election video game.

Given the current game state (week, national mood, phase, player stats, scandals, etc.), generate 3 unique, specific scenario prompts for a campaign minigame.

Each prompt should feel RELEVANT to the current political environment described in the game state. Reference:
- The national mood (change/stability/angry/fatigued/prosperity) to set the tone
- Any active scandals or crisis (scandal risk > 6)
- The election phase (primary vs general)
- Current leading issues (economy, war, social issues) based on national mood
- The player's party (dem/rep/ind) and any custom party name

Return ONLY valid JSON — no markdown, no extra text:
{
  "situation": "Max 10 words — scene only (e.g. 'Town hall — swing state, voters furious about economy')",
  "prompts": [
    "ONE sentence, max 20 words — hostile voter, press question, debate jab, heckler, or donor demand",
    "ONE sentence, max 20 words — different type from prompt 1",
    "ONE sentence, max 20 words — different type from prompts 1 and 2"
  ]
}

RULES:
- HARD LIMIT: each prompt is ONE sentence, maximum 20 words. No sub-clauses, no "given that", no "wondering how".
- Good: "A union leader demands to know why you haven't backed the rail strike."
- Bad (too long): "A young voter asks how you plan to address student debt and make college affordable, given the rising costs."
- Each prompt must be a different challenge type: hostile voter / press question / debate jab / donor demand / heckler
- Reference THIS election's mood and phase — not generic boilerplate
- If scandal risk > 8, at least one prompt must mention the scandal directly
- For independent players, at least one prompt must challenge third-party viability
- situation field: max 12 words, scene only`;



// Pure deterministic logic — parses the structured game state text and produces
// sensible, personalised advice with zero external calls. Used when:
//   (a) All Groq models are rate-limited / erroring
//   (b) No GROQ_KEY is configured
//   (c) Request is rate-limited at the worker level
// ═══════════════════════════════════════════════════════════════════════════════
function localFallback(playerText, ctx) {
  ctx = ctx || '';
  const msg = (playerText || '').toLowerCase();

  // ── Phase detection ─────────────────────────────────────────────────────────
  const isPrimary = ctx.includes('PHASE: PRIMARY');
  const isGeneral = ctx.includes('PHASE: GENERAL');
  const isWinning = ctx.includes('— WINNING');
  const isLosing  = ctx.includes('— LOSING');

  // ── Parse delegates (primary) ───────────────────────────────────────────────
  const myDelsMatch = ctx.match(/You:\s*([\d,]+)\s*delegates won so far/);
  const myDels      = myDelsMatch ? parseInt(myDelsMatch[1].replace(/,/g, ''), 10) : null;
  const stillNeedM  = ctx.match(/Still need:\s*([\d,]+)\s*more to reach\s*([\d,]+)/);
  const stillNeed   = stillNeedM ? parseInt(stillNeedM[1].replace(/,/g, ''), 10) : null;
  const threshold   = stillNeedM ? parseInt(stillNeedM[2].replace(/,/g, ''), 10) : 1991;

  // ── Parse EV (general) ──────────────────────────────────────────────────────
  const myEVMatch = ctx.match(/YOU:\s*(\d+)\s*EV\s*—/);
  const myEV      = myEVMatch ? parseInt(myEVMatch[1], 10) : null;
  const evNeeded  = myEV != null && isLosing ? (270 - myEV) : null;

  // ── Parse funds ─────────────────────────────────────────────────────────────
  const fundsMatch = ctx.match(/Funds:\s*\$([\d.]+)M/);
  const funds      = fundsMatch ? parseFloat(fundsMatch[1]) : null;
  const fundsLow   = funds != null && funds < 5;
  const fundsMed   = funds != null && funds >= 5 && funds < 12;

  // ── Parse scandal risk ──────────────────────────────────────────────────────
  // Context now sends: "SCANDAL RISK: 7.3/15 (ELEVATED)"
  const scanMatch = ctx.match(/SCANDAL RISK:\s*([\d.]+)\/15/);
  const scandal   = scanMatch ? parseFloat(scanMatch[1]) : null;
  const scandalHigh = scandal != null && scandal > 10;
  const scandalMed  = scandal != null && scandal > 6 && scandal <= 10;

  // ── Parse momentum ──────────────────────────────────────────────────────────
  const momMatch  = ctx.match(/Momentum:\s*([+-]?[\d.]+)/);
  const momentum  = momMatch ? parseFloat(momMatch[1]) : null;

  // ── Parse opponent ──────────────────────────────────────────────────────────
  const oppMatch = ctx.match(/OPPONENT:\s*([^\n(—]+)/);
  const oppName  = oppMatch ? oppMatch[1].trim().replace(/\s+$/, '') : 'your opponent';

  // ── Parse home state ────────────────────────────────────────────────────────
  const homeMatch = ctx.match(/Home state:\s*([A-Z]{2})/);
  const homeState = homeMatch ? homeMatch[1] : null;

  // ── Parse best contested state (primary) ────────────────────────────────────
  // Section format: "CLOSE RACES (...): StateName[CODE](margin, NEV) | ..."
  // Extract first state from CLOSE RACES section inline list
  function extractFirstStateFromSection(sectionName) {
    const re = new RegExp(`${sectionName}[^\\n]*:\\s*([A-Za-z .]+)\\[([A-Z]{2})\\]`);
    const m = ctx.match(re);
    if (m) return { name: m[1].trim(), code: m[2] };
    return null;
  }

  let bestState = null, bestStateName = null;
  const closeRaceFirst = extractFirstStateFromSection('CLOSE RACES');
  if (closeRaceFirst) { bestStateName = closeRaceFirst.name; bestState = closeRaceFirst.code; }

  // ── Parse best tossup state (general) ───────────────────────────────────────
  let tossupState = null, tossupStateName = null;
  const battleFirst = extractFirstStateFromSection('BATTLEGROUNDS');
  if (battleFirst) { tossupStateName = battleFirst.name; tossupState = battleFirst.code; }

  // If no battleground, try opponent leads (closest = most flippable)
  if (!tossupState) {
    const oppLeadsFirst = extractFirstStateFromSection('OPPONENT LEADS');
    if (oppLeadsFirst) { tossupStateName = oppLeadsFirst.name; tossupState = oppLeadsFirst.code; }
  }

  // ── Player intent detection ──────────────────────────────────────────────────
  const wantsFunds     = /\b(fund|money|cash|broke|raise|donor)\b/.test(msg);
  const wantsScandal   = /\b(scandal|crisis|risk|damage|bad press)\b/.test(msg);
  const wantsStatus    = /\b(how.*doing|winning|losing|ahead|behind|status|where.*stand)\b/.test(msg);
  const wantsFocus     = /\b(where|focus|target|which state|best move|what should|priority)\b/.test(msg);
  const wantsAttack    = /\b(attack|oppo|negative|hit|blast|criticis)\b/.test(msg);
  const wantsDebate    = /\bdebate\b/.test(msg);
  const wantsFundraise = /\b(fundrais|raise money|donor)\b/.test(msg);
  const wantsSurrogate = /\b(surrogate|ally|allies|send.*help)\b/.test(msg);
  // State-specific query: "how am I doing in X" / "what's my position in X" / "campaign in X"
  const wantsStateInfo = /\b(how.*in|doing in|position in|perform|campaign in|rally in|go to|visit|what.*in)\b/.test(msg);

  // ── State override: did player mention a specific state in their message? ────
  const STATE_NAMES = {
    'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
    'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
    'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA',
    'kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
    'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO',
    'montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ',
    'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH',
    'oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
    'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
    'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
  };
  // Reverse map: code → full name
  const CODE_TO_NAME = Object.fromEntries(Object.entries(STATE_NAMES).map(([n,c])=>[c,n.replace(/\b\w/g,l=>l.toUpperCase())]));
  const VALID_CODES = new Set(Object.values(STATE_NAMES));
  let mentionedState = null;
  // Ambiguous 2-letter codes that are also common English words
  const AMBIGUOUS_LOCAL = new Set(['IN','OR','ME','HI','OK','AL','DE','LA','OH','PA','MA','IA','ID','AR','CO','MS','MO']);
  // Pass 1: unambiguous uppercase codes only (original case, not uppercased — "in" stays "in")
  const codeMatches = playerText.match(/\b([A-Z]{2})\b/g) || [];
  for (const c of codeMatches) { if (VALID_CODES.has(c) && !AMBIGUOUS_LOCAL.has(c)) { mentionedState = c; break; } }
  // Pass 2: full state name (most reliable — catches "california", "indiana" etc.)
  // Use word-boundary regex to avoid "indiana" matching inside "indianapolis" etc.
  if (!mentionedState) {
    const sortedNames = Object.keys(STATE_NAMES).sort((a,b) => b.length - a.length);
    for (const name of sortedNames) {
      const re = new RegExp(`\\b${name.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
      if (re.test(msg)) { mentionedState = STATE_NAMES[name]; break; }
    }
  }
  // Pass 3: ambiguous codes only as last resort — only match tokens already
  // uppercase in the original text; never upcase the whole string or "in",
  // "me", "or" etc. will be misread as state codes.
  if (!mentionedState) {
    const rawUpperCodes = playerText.match(/\b([A-Z]{2})\b/g) || [];
    for (const c of rawUpperCodes) { if (VALID_CODES.has(c)) { mentionedState = c; break; } }
  }

  // ── Parse state polling data from context ────────────────────────────────────
  // Format: StateName[CODE](YOU +N, NEV) | (OPPONENT +N, NEV) | (TIED, NEV)
  // The ALL STATES line guarantees every state is present.
  function parseStateData(code) {
    if (!code || !ctx) return null;
    const re = new RegExp(
      `[A-Za-z .]+\\[${code}\\]\\((YOU \\+?([\\d.]+)|OPPONENT \\+?([\\d.]+)|TIED),\\s*(\\d+)EV\\)`,
      'i'
    );
    const m = ctx.match(re);
    if (m) {
      let leader, margin;
      if (m[0].includes('TIED')) {
        leader = 'tied'; margin = 0;
      } else if (m[2] !== undefined) {
        leader = 'player'; margin = parseFloat(m[2]);
      } else {
        leader = 'opponent'; margin = parseFloat(m[3]);
      }
      const ev = parseInt(m[4]);
      return { code, name: CODE_TO_NAME[code] || code, leader, margin, ev };
    }
    return null;
  }

  // ── Build response ───────────────────────────────────────────────────────────
  let advice = '';
  let type   = 'none';
  let state  = '';
  const sug  = [];

  // ── Shared warning prefix ────────────────────────────────────────────────────
  const warningPrefix = scandalHigh
    ? `⚠️ Scandal risk is at ${scandal.toFixed(1)}/15 — run crisis management immediately. `
    : fundsLow
    ? `⚠️ Funds are critically low ($${funds.toFixed(1)}M) — fundraise first. `
    : '';

  if (isPrimary) {
    // ── Delegate progress string ──────────────────────────────────────────────
    const delStr = myDels != null
      ? (myDels >= threshold
          ? `You've clinched the nomination with ${myDels.toLocaleString()} delegates.`
          : `You have ${myDels.toLocaleString()} delegates and need ${stillNeed?.toLocaleString() ?? '?'} more of ${threshold.toLocaleString()}.`)
      : 'The delegate race is ongoing.';

    if (mentionedState && VALID_CODES.has(mentionedState)) {
      // Data-driven state analysis — always look up actual polling data first
      const sd = parseStateData(mentionedState);
      const sName = CODE_TO_NAME[mentionedState] || mentionedState;
      const isHome = homeState === mentionedState;
      if (sd) {
        const statusStr = sd.leader === 'tied'
          ? `${sName} is an exact tie`
          : sd.leader === 'player'
          ? `you are leading ${sName} by +${sd.margin.toFixed(0)} points`
          : `you are trailing ${sName} by ${sd.margin.toFixed(0)} points`;
        const homeNote = isHome ? ' Your home state — big visit bonus here.' : '';
        const actionStr = sd.leader === 'tied'
          ? 'Exact tossup — rally immediately to take the lead.'
          : sd.leader === 'player' && sd.margin > 10
          ? 'Your lead is solid — a grassroots visit will lock it in.'
          : sd.leader === 'player'
          ? 'Narrow lead — rally there to widen the margin and secure those delegates.'
          : sd.margin > 15
          ? 'You\'re far behind here — consider whether this is worth your time vs. contested states.'
          : 'You\'re within striking distance — a rally or ground game push could flip it.';
        advice = `${warningPrefix}In ${sName}, ${statusStr} (${sd.ev} EV).${homeNote} ${actionStr} ${delStr}`;
      } else {
        advice = `${warningPrefix}${sName} — rally or build ground game there to shift the polling margin. ${delStr}`;
      }
      type = wantsStateInfo && sd?.leader === 'player' && sd?.margin > 10 ? 'grass' : 'visit';
      state = mentionedState;
      sug.push({ label: `Rally in ${sName}`, actionId: 'visit', state: mentionedState });
      sug.push({ label: `Ground game in ${sName}`, actionId: 'grass', state: mentionedState });
    } else if (wantsAttack) {
      advice = `${warningPrefix}Opposition research is high-risk in the primary — it can backfire and hurt your favorability with your own base. Only use it if you're significantly trailing and need to shake up the race.`;
      type = 'attack'; state = '';
      sug.push({ label: 'Launch opposition research', actionId: 'attack', state: '' });
      if (bestState) sug.push({ label: `Rally in ${bestStateName || bestState}`, actionId: 'visit', state: bestState });
    } else if (wantsDebate) {
      advice = `${warningPrefix}Debate prep raises your electability — useful before any scheduled debate. ${bestState ? `But if there's no debate imminent, ${bestStateName || bestState} is your most contested race and will yield more delegates.` : 'Check your schedule to see if a debate is coming up.'}`;
      type = 'debate'; state = '';
      sug.push({ label: 'Debate preparation', actionId: 'debate', state: '' });
      if (bestState) sug.push({ label: `Rally in ${bestStateName || bestState}`, actionId: 'visit', state: bestState });
    } else if (wantsFundraise || (wantsFunds && funds != null)) {
      const fundsVerdict = funds == null ? 'Check your cash position.' :
        funds < 5  ? `You're at $${funds.toFixed(1)}M — dangerously low, fundraise now.` :
        funds < 15 ? `You have $${funds.toFixed(1)}M — tight but manageable.` :
                     `You have $${funds.toFixed(1)}M — solid. More won't hurt but delegates are the priority.`;
      advice = `${warningPrefix}${fundsVerdict} Fundraising gives you ammo for ad buys and ground game later in the primary.`;
      type = 'fundraise'; state = '';
      sug.push({ label: 'Fundraising drive', actionId: 'fundraise', state: '' });
      if (bestState) sug.push({ label: `Rally in ${bestStateName || bestState}`, actionId: 'visit', state: bestState });
    } else if (wantsScandal || scandalHigh) {
      advice = `Scandal risk is at ${scandal?.toFixed(1) ?? '?'}/15. ${scandal > 10 ? 'That\'s critical — run crisis management this week before it erupts into a news cycle that tanks your polling.' : 'Elevated but not critical. A press tour or coalition event can help defuse it before it gets worse.'}`;
      type = scandalHigh ? 'crisis' : 'press_tour'; state = '';
      sug.push({ label: scandalHigh ? 'Crisis management' : 'Press tour', actionId: scandalHigh ? 'crisis' : 'press_tour', state: '' });
      if (bestState) sug.push({ label: `Rally in ${bestStateName || bestState}`, actionId: 'visit', state: bestState });
    } else if (wantsSurrogate) {
      advice = `${warningPrefix}Sending surrogates amplifies your ground game across multiple states simultaneously — great for building momentum when you can\'t be everywhere. ${bestState ? `Combine with a personal rally in ${bestStateName || bestState} for maximum impact.` : ''}`;
      type = 'surrogate'; state = '';
      sug.push({ label: 'Deploy surrogates', actionId: 'surrogate', state: '' });
      if (bestState) sug.push({ label: `Rally in ${bestStateName || bestState}`, actionId: 'visit', state: bestState });
    } else {
      // Default: point to best contested state
      const contestedVerb = bestState
        ? `${bestStateName || bestState} is your most contested race — a rally there has the highest delegate return right now.`
        : 'Hit your contested states hard — that\'s where nominations are won.';
      advice = `${warningPrefix}${contestedVerb} ${delStr}`;
      type = 'visit'; state = bestState || '';
      if (bestState) {
        sug.push({ label: `Rally in ${bestStateName || bestState}`, actionId: 'visit', state: bestState });
        sug.push({ label: `Ground game in ${bestStateName || bestState}`, actionId: 'grass', state: bestState });
      }
      sug.push({ label: 'Fundraising drive', actionId: 'fundraise', state: '' });
    }

  } else if (isGeneral) {
    // ── EV status string ──────────────────────────────────────────────────────
    const evStr = myEV != null
      ? (isWinning ? `at ${myEV} EV — ${myEV - 270} above 270` : `at ${myEV} EV — ${evNeeded} short of 270`)
      : 'in the electoral college race';
    const statusWord = isWinning ? 'ahead' : isLosing ? 'behind' : 'in a dead heat';

    if (mentionedState && VALID_CODES.has(mentionedState)) {
      const sd = parseStateData(mentionedState);
      const sName = CODE_TO_NAME[mentionedState] || mentionedState;
      const isHome = homeState === mentionedState;
      if (sd) {
        const statusStr = sd.leader === 'tied'
          ? `${sName} is an exact tossup (${sd.ev} EV)`
          : sd.leader === 'player'
          ? `you lead ${sName} by +${sd.margin.toFixed(0)} points (${sd.ev} EV)`
          : `you trail ${sName} by ${sd.margin.toFixed(0)} points (${sd.ev} EV)`;
        const homeNote = isHome ? ' This is your home state — visits get a big bonus here.' : '';
        const actionStr = sd.leader === 'tied'
          ? 'Dead heat — this is your highest priority. Rally immediately.'
          : sd.leader === 'player' && sd.margin > 12
          ? 'Strong lead — deploy ground game to bank those votes.'
          : sd.leader === 'player'
          ? 'Narrow lead — rally to solidify it before election night.'
          : sd.margin > 15
          ? 'You\'re far behind here. Only target it if you have surplus resources after locking tossups.'
          : 'Winnable — within range of a rally or ad blitz push.';
        advice = `${warningPrefix}Currently ${statusStr}.${homeNote} ${actionStr} You\'re ${evStr} overall.`;
      } else {
        advice = `${warningPrefix}${sName} — rally or run ads to move the polling margin. Every EV matters. You\'re ${evStr}.`;
      }
      type = wantsStateInfo && sd?.leader === 'player' && sd?.margin > 10 ? 'grass' : 'visit';
      state = mentionedState;
      sug.push({ label: `Rally in ${sName}`, actionId: 'visit', state: mentionedState });
      sug.push({ label: `Ground game in ${sName}`, actionId: 'grass', state: mentionedState });
      sug.push({ label: 'National ad blitz', actionId: 'adblitz', state: '' });
    } else if (wantsAttack) {
      advice = `${warningPrefix}Attacking ${oppName} drives down their approval and can shift swing state polling — higher reward in the general than in the primary. There\'s still a backfire risk, especially in tossup states.`;
      type = 'attack'; state = '';
      sug.push({ label: 'Opposition research', actionId: 'attack', state: '' });
      if (tossupState) sug.push({ label: `Rally in ${tossupStateName || tossupState}`, actionId: 'visit', state: tossupState });
    } else if (wantsDebate) {
      advice = `${warningPrefix}Debate prep boosts electability — critical if a general election debate is scheduled. A strong debate performance can shift 2-4 points in every swing state simultaneously.`;
      type = 'debate'; state = '';
      sug.push({ label: 'Debate preparation', actionId: 'debate', state: '' });
      if (tossupState) sug.push({ label: `Rally in ${tossupStateName || tossupState}`, actionId: 'visit', state: tossupState });
    } else if (wantsFundraise || (wantsFunds && funds != null)) {
      const fundsVerdict = funds == null ? '' :
        funds < 5  ? `You\'re at $${funds.toFixed(1)}M — critically low. Fundraise before buying any swing state ads.` :
        funds < 15 ? `You\'re at $${funds.toFixed(1)}M — enough to operate but thin for a general election ad push.` :
                     `You\'re at $${funds.toFixed(1)}M — healthy war chest.`;
      advice = `${warningPrefix}${fundsVerdict} In the general, money matters for swing state ad buys — but your time is short, so weigh it against rally visits.`;
      type = funds != null && funds < 8 ? 'fundraise' : 'adblitz'; state = '';
      sug.push({ label: funds != null && funds < 8 ? 'Fundraising drive' : 'National ad blitz', actionId: funds != null && funds < 8 ? 'fundraise' : 'adblitz', state: '' });
      if (tossupState) sug.push({ label: `Rally in ${tossupStateName || tossupState}`, actionId: 'visit', state: tossupState });
    } else if (wantsScandal || scandalHigh) {
      advice = `Scandal risk is at ${scandal?.toFixed(1) ?? '?'}/15. ${scandal > 10 ? 'One bad news cycle in the general can flip a swing state. Run crisis management this week — it\'s not optional.' : 'Keep it managed. A press tour helps defuse it before it becomes a story during the general campaign.'}`;
      type = scandalHigh ? 'crisis' : 'press_tour'; state = '';
      sug.push({ label: scandalHigh ? 'Crisis management' : 'Press tour', actionId: scandalHigh ? 'crisis' : 'press_tour', state: '' });
      if (tossupState) sug.push({ label: `Rally in ${tossupStateName || tossupState}`, actionId: 'visit', state: tossupState });
    } else if (wantsStatus || wantsFocus) {
      if (isWinning && myEV != null) {
        advice = `${warningPrefix}You\'re ${evStr} — currently winning. ${tossupState ? `${tossupStateName || tossupState} is your most vulnerable tossup; shore it up.` : 'Protect your leads in lean states and keep hammering tossups.'} Don\'t get complacent — the map can shift quickly.`;
      } else if (isLosing && myEV != null) {
        advice = `${warningPrefix}You\'re ${evStr} — you need to flip states urgently. ${tossupState ? `${tossupStateName || tossupState} is your most achievable flip — focus everything there.` : 'You need to flip leaning-opponent states. Start with the smallest deficit.'}`;
      } else {
        advice = `${warningPrefix}${tossupState ? `${tossupStateName || tossupState} is your most critical tossup — whoever wins it likely wins the election.` : 'Focus on every tossup state you can reach in the time left.'} You\'re in a tight race.`;
      }
      type = 'visit'; state = tossupState || '';
      if (tossupState) {
        sug.push({ label: `Rally in ${tossupStateName || tossupState}`, actionId: 'visit', state: tossupState });
        sug.push({ label: `Ground game in ${tossupStateName || tossupState}`, actionId: 'grass', state: tossupState });
      }
      sug.push({ label: 'National ad blitz', actionId: 'adblitz', state: '' });
    } else {
      // Default general — varied, non-repetitive advice based on context
      const evAdvice = myEV != null
        ? (isWinning
            ? `You hold ${myEV} EV — ${myEV - 270} above 270. Don't coast.`
            : isLosing
            ? `You're at ${myEV} EV, ${270 - myEV} short of 270. Every battleground matters.`
            : `The race is dead even. Whoever blinks first loses.`)
        : '';
      const tossupAdvice = tossupState
        ? [
            `${tossupStateName || tossupState} is your tightest battleground — get there before your opponent does.`,
            `All roads to 270 run through ${tossupStateName || tossupState} right now. Make it count.`,
            `${tossupStateName || tossupState} is effectively a coin flip. Rally, grind, or buy ads — but don't ignore it.`,
            `The electoral math points to ${tossupStateName || tossupState} as your most leveraged play this week.`,
            `Don't let ${tossupStateName || tossupState} slip — it's the difference between victory and a very long night.`,
          ][Math.floor(Math.random() * 5)]
        : 'Solidify your leads and keep pressing on every contested state in range.';
      advice = `${warningPrefix}${evAdvice ? evAdvice + ' ' : ''}${tossupAdvice}`;
      type = 'visit'; state = tossupState || '';
      if (tossupState) sug.push({ label: `Rally in ${tossupStateName || tossupState}`, actionId: 'visit', state: tossupState });
      sug.push({ label: 'National ad blitz', actionId: 'adblitz', state: '' });
      if (tossupState) sug.push({ label: `Ground game in ${tossupStateName || tossupState}`, actionId: 'grass', state: tossupState });
    }

  } else {
    // Game not started or unknown phase — only show this if context is truly empty
    if (!ctx || ctx.trim().length < 20) {
      advice = 'Start your campaign first — set up your candidate on the main screen, then I can help you strategise.';
    } else {
      // Context exists but phase not detected — give generic advice
      advice = `I can see your campaign is running. Try asking "Where should I focus?", "What's my best move this week?", or name a specific action like "Rally in Ohio".`;
    }
    sug.push({ label: 'Where should I focus?', actionId: null, state: '' });
    sug.push({ label: "What's my best move?", actionId: null, state: '' });
  }

  // Fallback: ensure at least 1 suggestion
  if (!sug.length) {
    sug.push({ label: 'Ask for best move', actionId: 'visit', state: '' });
  }

  return {
    advice:      advice.trim(),
    type,
    state,
    suggestions: sug.slice(0, 3),
    _source:     'local',
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// GROQ LLM CALL — single model attempt with timeout
// ═══════════════════════════════════════════════════════════════════════════════
async function tryGroqModel(model, userMessage, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(Object.assign({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage   },
        ],
        temperature:     0.15,
        max_tokens:      500,
      }, JSON_MODE_MODELS.has(model) ? { response_format: { type: 'json_object' } } : {})),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  // 429 = rate limited; caller will try next model
  if (res.status === 429) {
    throw new Error('rate_limited');
  }

  if (!res.ok) {
    throw new Error(`groq_http_${res.status}`);
  }

  const data = await res.json();
  const raw  = (data.choices?.[0]?.message?.content || '').trim();

  // Strip accidental markdown fences (some models ignore response_format)
  const clean  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const parsed = JSON.parse(clean); // throws if invalid JSON → caller catches

  // Sanitise & normalise
  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
    .slice(0, 3)
    .map(s => ({
      label:    String(s.label    || '').trim().slice(0, 60),
      actionId: String(s.actionId || '').toLowerCase().trim(),
      state:    String(s.state    || '').toUpperCase().trim().slice(0, 2),
    }))
    .filter(s => s.label && s.actionId);

  return {
    advice:      String(parsed.advice || '').trim().slice(0, 600),
    type:        String(parsed.type   || 'none').toLowerCase().trim(),
    state:       String(parsed.state  || '').toUpperCase().trim().slice(0, 2),
    suggestions,
    _source:     model,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// PER-IP RATE LIMITER (KV-backed, optional)
// ═══════════════════════════════════════════════════════════════════════════════
async function checkRateLimit(ip, kv) {
  if (!kv || !ip) return false; // no KV → no rate limiting → allow all
  const key      = `rl:${ip}`;
  const now      = Date.now();
  const windowMs = 60_000; // 1 minute window
  const maxReqs  = 20;     // max 20 requests per window per IP

  let data;
  try {
    const raw = await kv.get(key);
    data = raw ? JSON.parse(raw) : { count: 0, windowStart: now };
  } catch {
    return false; // KV read error → allow
  }

  if (now - data.windowStart > windowMs) {
    data = { count: 1, windowStart: now };
  } else {
    data.count++;
  }

  // Non-blocking write — don't let KV latency slow the response
  kv.put(key, JSON.stringify(data), { expirationTtl: 120 }).catch(() => {});

  return data.count > maxReqs;
}



// ═══════════════════════════════════════════════════════════════════════════════
// MINIGAME EVALUATOR — called when body.minigame is set
// Evaluates the player's free-text response and returns demographic impacts
// ═══════════════════════════════════════════════════════════════════════════════
async function evaluateMinigame(situation, playerAnswer, party, apiKey) {
  const userMessage = `SITUATION: ${situation}\nPARTY: ${party}\nPLAYER ANSWERED: "${playerAnswer}"`;

  // Try each model in cascade
  for (const model of GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(Object.assign({
            model,
            messages: [
              { role: 'system', content: MG_SYSTEM_PROMPT },
              { role: 'user',   content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 300,
          }, JSON_MODE_MODELS.has(model) ? { response_format: { type: 'json_object' } } : {})),
          signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }

      if (res.status === 429) continue; // try next model
      if (!res.ok) continue;

      const data   = await res.json();
      const raw    = (data.choices?.[0]?.message?.content || '').trim();
      const clean  = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(clean);

      // Sanitise impacts
      const impacts = {};
      for (const k of ['urban','suburban','rural','youth','seniors']) {
        const v = parseInt(parsed.impacts?.[k] ?? 0, 10);
        impacts[k] = Math.max(-10, Math.min(10, isNaN(v) ? 0 : v));
      }
      const bonus = Math.max(0, Math.min(15, parseInt(parsed.bonus ?? 5, 10)));

      return {
        feedback: String(parsed.feedback || 'The room reacts to your answer.').slice(0, 300),
        impacts,
        bonus,
      };
    } catch { continue; }
  }

  // All models failed — return a sensible default so the game never breaks
  return localMinigameFallback(playerAnswer, party);
}

// Local minigame fallback — zero API calls, deterministic scoring
function localMinigameFallback(answer, party) {
  const a = (answer || '').toLowerCase();
  const isDem = party === 'dem';

  // Detect ideological lean from keywords
  const progKW  = /medicare|climate|green|equity|inequality|tax the|wealth|affordable|union|worker|free college|student debt|social security|medicare/i;
  const conKW   = /border|second amendment|gun|tax cut|deregulat|freedom|small business|energy independ|coal|oil|drill|law and order|crime/i;
  const modKW   = /balance|bipartisan|both sides|pragmatic|compromise|middle|centrist|common sense/i;
  const popKW   = /establishment|corrupt|billionaire|corporate|wall street|elite|rigged|working class/i;
  const vague   = a.length < 40;
  const hasOpp  = /opponent|they|their record|rival/i.test(a);
  const specific = a.length > 120 && /because|therefore|specifically|data|percent|million|billion/i.test(a);

  let impacts = { urban: 0, suburban: 0, rural: 0, youth: 0, seniors: 0 };

  if (vague) {
    impacts = { urban: -1, suburban: -1, rural: -1, youth: -2, seniors: -1 };
  } else if (progKW.test(a)) {
    impacts = { urban: isDem?6:4, suburban: isDem?2:0, rural: isDem?-2:-4, youth: isDem?7:5, seniors: isDem?2:-1 };
  } else if (conKW.test(a)) {
    impacts = { urban: isDem?-2:-4, suburban: isDem?2:4, rural: isDem?5:8, youth: isDem?-2:-4, seniors: isDem?3:6 };
  } else if (popKW.test(a)) {
    impacts = { urban: 3, suburban: 1, rural: 4, youth: 6, seniors: 1 };
  } else if (modKW.test(a)) {
    impacts = { urban: 3, suburban: 5, rural: 3, youth: 2, seniors: 4 };
  } else {
    // Solid answer with no strong lean — broadly positive
    impacts = { urban: 3, suburban: 3, rural: 2, youth: 3, seniors: 2 };
  }

  if (hasOpp)  { Object.keys(impacts).forEach(k => impacts[k] += 1); }
  if (specific) { Object.keys(impacts).forEach(k => impacts[k] = Math.min(10, impacts[k]+1)); }

  const total = Object.values(impacts).reduce((s,v) => s+Math.abs(v), 0);
  const bonus = total < 6 ? 2 : total < 16 ? 5 : total < 26 ? 9 : 13;

  return {
    feedback: vague
      ? 'A short answer that leaves the room wanting more detail. People aren not sure where you stand.'
      : specific
      ? 'Your specific, detailed answer impresses voters looking for substance. The room responds.'
      : 'A solid answer. Different parts of the room react differently based on the message.',
    impacts,
    bonus,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI MINIGAME QUESTION GENERATOR — generates contextual questions from game state
// Called when body.generateQuestions is set
// ═══════════════════════════════════════════════════════════════════════════════
async function generateMinigameQuestions(actionId, gameContext, party, apiKey) {
  const userMessage = `ACTION TYPE: ${actionId}\nPARTY: ${party}\nGAME STATE:\n${gameContext}`;
  const debugLog = [];

  for (const model of GROQ_MODELS) {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        // Only use json_object mode for models known to support it;
        // gemma2 and some others return 400 with it enabled.
        const useJsonMode = JSON_MODE_MODELS.has(model);
        const bodyObj = {
          model,
          messages: [
            { role: 'system', content: MG_QUESTION_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.75,
          max_tokens: 700,
        };
        if (useJsonMode) bodyObj.response_format = { type: 'json_object' };
        res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(bodyObj),
          signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }
    } catch (err) {
      debugLog.push({ model, stage: 'network', error: err.message });
      continue;
    }

    if (res.status === 429) { debugLog.push({ model, stage: 'http', error: '429 rate limited' }); continue; }
    if (!res.ok) { debugLog.push({ model, stage: 'http', error: `HTTP ${res.status}` }); continue; }

    let raw = '', parsed;
    try {
      const data  = await res.json();
      raw   = (data.choices?.[0]?.message?.content || '').trim();
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch (err) {
      debugLog.push({ model, stage: 'parse', error: err.message, raw: raw.slice(0, 300) });
      continue;
    }

    const promptArr = Array.isArray(parsed.prompts)
                    ? parsed.prompts
                    : Array.isArray(parsed.questions)
                    ? parsed.questions
                    : null;

    if (parsed.situation && promptArr && promptArr.length >= 2) {
      return {
        situation: String(parsed.situation).slice(0, 200),
        prompts:   promptArr.slice(0, 3).map(p => String(p).trim().slice(0, 150)),
      };
    }

    debugLog.push({ model, stage: 'shape', error: 'unexpected response shape', keys: Object.keys(parsed), raw: JSON.stringify(parsed).slice(0, 300) });
    continue;
  }

  return { _failed: true, _log: debugLog }; // all models failed — caller uses static pool
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {

    // ── CORS preflight ────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // ── DEBUG endpoint — GET /?action=townhall&party=dem ──────────────────────
    if (request.method === 'GET') {
      const url    = new URL(request.url);
      const action = url.searchParams.get('action') || 'townhall';
      const party  = url.searchParams.get('party')  || 'dem';
      const fakeCtx = `PHASE: GENERAL | Week 8 | 8 weeks left\nNATIONAL MOOD: Change\nPLAYER: Test Candidate (${party})\nFAVORABILITY: 48.0% | MOMENTUM: 1.2\nSCANDAL RISK: 3.0/15\nACTION: ${action}`;

      const out = {
        providers: {
          groq_key_1:  !!env.GROQ_KEY,
          groq_key_2:  !!env.GROQ_KEY_2,
          gemini_key:  !!env.GEMINI_KEY,
        },
        action,
        party,
        results: {},
        timestamp: new Date().toISOString(),
      };

      // Test Groq key 1
      if (env.GROQ_KEY) {
        const r = await generateMinigameQuestions(action, fakeCtx, party, env.GROQ_KEY);
        out.results.groq_key_1 = r?._failed ? { status: 'failed', log: r._log } : { status: 'ok', sample: r };
      } else {
        out.results.groq_key_1 = { status: 'skipped', reason: 'GROQ_KEY not set' };
      }

      // Test Groq key 2
      if (env.GROQ_KEY_2) {
        const r = await generateMinigameQuestions(action, fakeCtx, party, env.GROQ_KEY_2);
        out.results.groq_key_2 = r?._failed ? { status: 'failed', log: r._log } : { status: 'ok', sample: r };
      } else {
        out.results.groq_key_2 = { status: 'skipped', reason: 'GROQ_KEY_2 not set' };
      }

      // Test Gemini (small delay to avoid burst 429 from back-to-back provider tests)
      if (env.GEMINI_KEY) {
        await new Promise(r => setTimeout(r, 500));
        try {
          const testMsg = `ACTION TYPE: ${action}\nPARTY: ${party}\nGAME STATE:\n${fakeCtx}`;
          const r = await tryGemini(testMsg, MG_QUESTION_PROMPT, env.GEMINI_KEY);
          out.results.gemini = { status: 'ok', sample: r };
        } catch (err) {
          out.results.gemini = { status: 'failed', error: err.message };
        }
      } else {
        out.results.gemini = { status: 'skipped', reason: 'GEMINI_KEY not set' };
      }

      // Overall verdict
      const anyOk = Object.values(out.results).some(r => r.status === 'ok');
      out.overall = anyOk ? '✅ At least one provider working' : '❌ All providers failed — local fallback only';

      return new Response(JSON.stringify(out, null, 2), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return jsonRes({ error: 'Method not allowed' }, 405);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonRes({ error: 'Invalid JSON body' }, 400);
    }

    const playerText  = String(body.text    || '').trim().slice(0, 600);
    const gameContext = String(body.context || '').trim().slice(0, 8000);
    const minigameCtx = body.minigame ? String(body.minigame).trim().slice(0, 200) : null;

    if (!playerText && !body.generateQuestions) return jsonRes({ error: 'No text provided' }, 400);

    // ── Question generation mode ───────────────────────────────────────────────
    if (body.generateQuestions) {
      const actionId = String(body.actionId || 'townhall').trim();
      const party = String(body.party || 'dem');
      if (!env.GROQ_KEY && !env.GROQ_KEY_2 && !env.GEMINI_KEY) return jsonRes({ questions: null });
      const groqKey = env.GROQ_KEY || env.GROQ_KEY_2;
      const result = await generateMinigameQuestions(actionId, gameContext, party, groqKey);
      return jsonRes({ questions: result?._failed ? null : result });
    }

    if (!playerText) return jsonRes({ error: 'No text provided' }, 400);

    // ── Minigame evaluation mode ───────────────────────────────────────────────
    if (minigameCtx) {
      const party = String(body.party || 'dem');
      const groqKey = env.GROQ_KEY || env.GROQ_KEY_2;
      if (!groqKey) {
        return jsonRes(localMinigameFallback(playerText, party));
      }
      const result = await evaluateMinigame(minigameCtx, playerText, party, groqKey);
      return jsonRes(result);
    }

    // ── adviceOnly mode — client sends its own rich prompt, wants plain text back ──
    // Called by fetchAdvice() in ai-command.js. Uses the vivid Carville-style
    // prose prompt the client built rather than the structured JSON system prompt.
    if (body.adviceOnly && body.prompt) {
      const ip      = request.headers.get('CF-Connecting-IP') || '';
      const limited = await checkRateLimit(ip, env.POTUS_KV);
      if (limited || !env.GROQ_KEY) {
        // Fall back to local advice text (still useful, never blank)
        return jsonRes({ advice: localFallback(playerText, gameContext).advice, _source: 'local' });
      }
      const clientPrompt = String(body.prompt).trim().slice(0, 3000);
      // Try Groq key 1
      for (const model of GROQ_MODELS) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          let res;
          try {
            res = await fetch(GROQ_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GROQ_KEY}` },
              body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: clientPrompt }],
                temperature: 0.55,
                max_tokens: 200,
              }),
              signal: controller.signal,
            });
          } finally { clearTimeout(timeout); }
          if (res.status === 429) continue;
          if (!res.ok) continue;
          const data = await res.json();
          const text = (data.choices?.[0]?.message?.content || '').trim();
          if (text.length > 10) return jsonRes({ advice: text, _source: model });
        } catch { continue; }
      }
      // Try Groq key 2
      if (env.GROQ_KEY_2) {
        for (const model of GROQ_MODELS) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            let res;
            try {
              res = await fetch(GROQ_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GROQ_KEY_2}` },
                body: JSON.stringify({
                  model,
                  messages: [{ role: 'user', content: clientPrompt }],
                  temperature: 0.55,
                  max_tokens: 200,
                }),
                signal: controller.signal,
              });
            } finally { clearTimeout(timeout); }
            if (res.status === 429) continue;
            if (!res.ok) continue;
            const data = await res.json();
            const text = (data.choices?.[0]?.message?.content || '').trim();
            if (text.length > 10) return jsonRes({ advice: text, _source: `groq2_${model}` });
          } catch { continue; }
        }
      }
      // Try Gemini
      if (env.GEMINI_KEY) {
        try {
          const gemRes = await tryGemini(clientPrompt, '', env.GEMINI_KEY);
          const gemText = typeof gemRes === 'string' ? gemRes : (gemRes.advice || JSON.stringify(gemRes));
          if (gemText.length > 10) return jsonRes({ advice: gemText, _source: 'gemini' });
        } catch { /* fall through */ }
      }
      // All providers failed — return local text
      return jsonRes({ advice: localFallback(playerText, gameContext).advice, _source: 'local_groq_exhausted' });
    }

    // ── Always pre-compute local fallback (instant, zero cost) ────────────────
    const fallback = localFallback(playerText, gameContext);

    // ── Rate limit check ──────────────────────────────────────────────────────
    const ip      = request.headers.get('CF-Connecting-IP') || '';
    const limited = await checkRateLimit(ip, env.POTUS_KV);
    if (limited) {
      // Never tell the user they're rate limited — just return local answer
      const resp = { ...fallback, _source: 'local_ratelimit' };
      return jsonRes(resp);
    }

    // ── No API key configured at all → return local answer ───────────────────
    if (!env.GROQ_KEY && !env.GROQ_KEY_2 && !env.GEMINI_KEY) {
      return jsonRes(fallback);
    }

    // ── Build Groq message ────────────────────────────────────────────────────
    // NOTE: _detectedState is computed below — we build a final message after detection.
    // Placeholder; real message built after state detection.
    let userMessage = gameContext
      ? `GAME STATE:\n${gameContext}\n\nPLAYER MESSAGE: "${playerText}"`
      : `PLAYER MESSAGE: "${playerText}"`;

    // ── Pre-detect mentioned state from player message (for post-Groq correction) ──
    const STATE_NAMES_MAIN = {
      'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
      'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
      'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA',
      'kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
      'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO',
      'montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ',
      'new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH',
      'oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
      'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
      'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY',
    };
    const VALID_CODES_MAIN = new Set(Object.values(STATE_NAMES_MAIN));
    let _detectedState = null;
    // Check 2-letter code in player text first — only match tokens that are
    // ALREADY uppercase in the original text (e.g. "CA", "OH") so that common
    // lowercase words like "in", "me", "to" are never misread as state codes.
    // Codes that are also common English words — skip these in pass 1
    const AMBIGUOUS_CODES_MAIN = new Set(['IN','OR','ME','HI','OK','AL','DE','LA','OH','PA','MA','IA','ID','AR','CO','MS','MO']);
    const _codeHits = (playerText.match(/\b([A-Z]{2})\b/g) || []);
    // Pass 1: unambiguous codes only (e.g. "CA", "TX", "NY" — not "IN", "OR", "ME")
    for (const c of _codeHits) {
      if (VALID_CODES_MAIN.has(c) && !AMBIGUOUS_CODES_MAIN.has(c)) { _detectedState = c; break; }
    }
    // Pass 2: full state name — most reliable, catches "california", "indiana" etc.
    if (!_detectedState) {
      const _msgLower = playerText.toLowerCase();
      const _sorted = Object.keys(STATE_NAMES_MAIN).sort((a,b) => b.length - a.length);
      for (const name of _sorted) {
        const _re = new RegExp(`\\b${name.replace(/[-\s]/g, '[-\\s]')}\\b`, 'i');
        if (_re.test(_msgLower)) { _detectedState = STATE_NAMES_MAIN[name]; break; }
      }
    }
    // Pass 3: ambiguous codes as last resort only
    if (!_detectedState) {
      for (const c of _codeHits) {
        if (VALID_CODES_MAIN.has(c)) { _detectedState = c; break; }
      }
    }
    // Detect whether player asked for a state-requiring action
    const _wantsStateAction = /\b(grassroot|grass|ground game|volunteer|rally|visit|campaign|canvass|town\s*hall|organis|organiz|mobiliz)\b/i.test(playerText);

    // ── Rebuild userMessage with explicit state directive if player named one ──
    // This is the strongest possible signal to the LLM — it appears right before
    // the model generates its response, so it can't be "forgotten".
    if (_detectedState && _wantsStateAction) {
      const CODE_TO_FULLNAME_MSG = Object.fromEntries(
        Object.entries(STATE_NAMES_MAIN).map(([name, code]) => [
          code,
          name.replace(/\b\w/g, l => l.toUpperCase()),
        ])
      );
      const fullName = CODE_TO_FULLNAME_MSG[_detectedState] || _detectedState;
      const stateDirective = `\n\nCRITICAL INSTRUCTION: The player explicitly named ${fullName} [${_detectedState}]. ` +
        `You MUST write your advice about ${fullName} specifically. ` +
        `Set "state": "${_detectedState}" in your JSON. ` +
        `All suggestion chips for state-requiring actions must also use "${_detectedState}". ` +
        `Do NOT mention any other state as the primary focus.`;
      userMessage = gameContext
        ? `GAME STATE:\n${gameContext}\n\nPLAYER MESSAGE: "${playerText}"${stateDirective}`
        : `PLAYER MESSAGE: "${playerText}"${stateDirective}`;
    }

    // ── Try Groq key 1 ────────────────────────────────────────────────────────
    for (const model of GROQ_MODELS) {
      try {
        const result = await tryGroqModel(model, userMessage, env.GROQ_KEY);

        // ── POST-GROQ CORRECTION: enforce player's explicit state intent ────────
        // If the player named a specific state AND asked for a state action,
        // the Groq result must use that state — never a hallucinated substitute.
        if (_detectedState && _wantsStateAction) {
          const stateActions = new Set(['visit','grass','canvass','townhall']);
          const CODE_TO_FULLNAME_FIX = Object.fromEntries(
            Object.entries(STATE_NAMES_MAIN).map(([name, code]) => [
              code, name.replace(/\b\w/g, l => l.toUpperCase()),
            ])
          );
          const correctName = CODE_TO_FULLNAME_FIX[_detectedState] || _detectedState;
          // Find the wrong state: first check the state field, then scan the advice text itself.
          // The model sometimes sets state='CA' correctly but still writes the advice about Indiana
          // (the most contested state). In that case wrongCode would be null and the text fix is skipped.
          let wrongCode = (result.state && result.state !== _detectedState) ? result.state : null;
          const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (!wrongCode && result.advice) {
            // Scan advice text for any state name/code that isn't the correct one
            for (const [wCode, wName] of Object.entries(CODE_TO_FULLNAME_FIX)) {
              if (wCode === _detectedState) continue;
              if (
                new RegExp(`\\b${esc(wName)}\\b`, 'i').test(result.advice) ||
                new RegExp(`\\b${esc(wCode)}\\b`).test(result.advice)
              ) {
                wrongCode = wCode;
                break;
              }
            }
          }
          const wrongName = wrongCode ? (CODE_TO_FULLNAME_FIX[wrongCode] || wrongCode) : null;

          // Fix the state field
          result.state = _detectedState;

          // Fix advice text — replace wrong state name/code with correct ones
          if (wrongCode && result.advice) {
            result.advice = result.advice
              .replace(new RegExp(`\\b${esc(wrongName)}\\b`, 'gi'), correctName)
              .replace(new RegExp(`\\b${esc(wrongCode)}\\b`, 'g'), _detectedState)
              .replace(new RegExp(`\\[${esc(wrongCode)}\\]`, 'g'), `[${_detectedState}]`);
          }

          // Fix suggestion chips — state field AND label text
          if (result.suggestions) {
            result.suggestions = result.suggestions.map(s => {
              let fixed = { ...s };
              // Fix state code
              if (stateActions.has(s.actionId)) {
                fixed.state = _detectedState;
              }
              // Fix label text that mentions the wrong state
              if (wrongCode && fixed.label) {
                fixed.label = fixed.label
                  .replace(new RegExp(`\\b${esc(wrongName)}\\b`, 'gi'), correctName)
                  .replace(new RegExp(`\\b${esc(wrongCode)}\\b`, 'g'), _detectedState);
              }
              return fixed;
            });
          }
        }
        // Strip any state codes that aren't valid US state abbreviations
        if (result.state && !VALID_CODES_MAIN.has(result.state)) {
          result.state = _detectedState || '';
        }
        if (result.suggestions) {
          result.suggestions = result.suggestions.map(s => ({
            ...s,
            state: (s.state && VALID_CODES_MAIN.has(s.state)) ? s.state : '',
          }));
        }

        return jsonRes(result);
      } catch (err) {
        // 429, timeout, bad JSON, HTTP error → fall through to next model
        console.warn(`[POTUS AI] Groq1 ${model} failed: ${err.message}`);
        continue;
      }
    }

    // ── Try Groq key 2 (second account, separate quota) ───────────────────────
    if (env.GROQ_KEY_2) {
      for (const model of GROQ_MODELS) {
        try {
          const result = await tryGroqModel(model, userMessage, env.GROQ_KEY_2);
          // Apply same state correction logic
          if (_detectedState && _wantsStateAction) {
            result.state = _detectedState;
          }
          if (result.state && !VALID_CODES_MAIN.has(result.state)) {
            result.state = _detectedState || '';
          }
          if (result.suggestions) {
            result.suggestions = result.suggestions.map(s => ({
              ...s,
              state: (s.state && VALID_CODES_MAIN.has(s.state)) ? s.state : '',
            }));
          }
          return jsonRes({ ...result, _source: `groq2_${model}` });
        } catch (err) {
          console.warn(`[POTUS AI] Groq2 ${model} failed: ${err.message}`);
          continue;
        }
      }
    }

    // ── Try Gemini 1.5 Flash ──────────────────────────────────────────────────
    if (env.GEMINI_KEY) {
      try {
        const result = await tryGemini(userMessage, SYSTEM_PROMPT, env.GEMINI_KEY);
        if (_detectedState && _wantsStateAction) {
          result.state = _detectedState;
        }
        if (result.state && !VALID_CODES_MAIN.has(result.state)) {
          result.state = _detectedState || '';
        }
        if (result.suggestions) {
          result.suggestions = result.suggestions.map(s => ({
            ...s,
            state: (s.state && VALID_CODES_MAIN.has(s.state)) ? s.state : '',
          }));
        }
        return jsonRes({ ...result, _source: 'gemini' });
      } catch (err) {
        console.warn(`[POTUS AI] Gemini failed: ${err.message}`);
      }
    }

    // ── All providers exhausted — silently return local answer ────────────────
    // User never sees "overloaded" — they get a real answer, always.
    return jsonRes({ ...fallback, _source: 'local_groq_exhausted' });
  },
};

// ── Helper ────────────────────────────────────────────────────────────────────
function jsonRes(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
