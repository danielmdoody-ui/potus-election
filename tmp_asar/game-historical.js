// ═══════════════════════════════════════════════════════════════════
// HISTORICAL ELECTIONS MODE  -  game-historical.js
//
// Completely self-contained. Does NOT set or read _historicalMode on
// GS, and does NOT touch showSummary / closeSummary in game.js.
// All week-advancing logic lives in hist_nextWeek() and
// hist_closeSummary() defined here.
//
// CRISIS SYSTEM REMOVED - Clean end week flow guaranteed
// ═══════════════════════════════════════════════════════════════════

// ── Data ────────────────────────────────────────────────────────────

const HISTORICAL_ELECTIONS = [
  {
    year: 1980, label: '1980 - Reagan vs Carter', videoSrc:'1980Election.mp4',
    sides: [
      {
        party:'rep', name:'Ronald Reagan', vp:'George H.W. Bush',
        tag:'Republican Nominee - Former Governor of California',
        incumbentOpponent: true,
        opponentName:'Jimmy Carter', opponentParty:'dem',
        nationalMood:'change',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:277,rep:158}, senateSeats:{dem:58,rep:41},
        startFavorability:48, startFunds:40, startElectability:64,
        stateLeanOverrides:{
          PA:4, OH:8, MI:6, IL:6, NY:-6, CA:3, TX:28, FL:18,
          GA:2, NC:14, VA:18, TN:22, AL:32, MS:28, IA:8, WI:2,
          WA:4, OR:3, NE:30, KS:25, MO:12, IN:20, KY:15
        },
        context:'The country is reeling from stagflation and the Iran hostage crisis. Carter\'s approval is at historic lows. Your "Morning in America" message is resonating.',
        congressNote:'Democrats control both chambers, but your coattail effect could flip the Senate.',
        icon:'🦅',
      },
      {
        party:'dem', name:'Jimmy Carter', vp:'Walter Mondale',
        tag:'Democratic Incumbent President',
        incumbentPlayer: true,
        opponentName:'Ronald Reagan', opponentParty:'rep',
        nationalMood:'angry',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:277,rep:158}, senateSeats:{dem:58,rep:41},
        startFavorability:38, startFunds:35, startElectability:44,
        stateLeanOverrides:{
          PA:-4, OH:-8, MI:-6, IL:-6, NY:6, CA:-3, TX:-28, FL:-18,
          GA:-2, NC:-14, VA:-18, TN:-22, AL:-32, MS:-28, IA:-8, WI:-2,
          WA:-4, OR:-3, NE:-30, KS:-25, MO:-12, IN:-20, KY:-15
        },
        context:'You\'re fighting against 12% inflation, 21% interest rates, and 52 Americans held hostage in Tehran. This is the hardest defence in modern political history.',
        congressNote:'Democrats hold Congress but the wave against you threatens the Senate.',
        icon:'🕊️',
      },
    ],
  },
  {
    year: 1988, label: '1988 - Bush vs Dukakis', videoSrc:'1988Election.mp4',
    sides: [
      {
        party:'rep', name:'George H.W. Bush', vp:'Dan Quayle',
        tag:'Republican Nominee - Vice President',
        opponentName:'Michael Dukakis', opponentParty:'dem',
        nationalMood:'stability',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:258,rep:177}, senateSeats:{dem:55,rep:45},
        startFavorability:46, startFunds:46, startElectability:60,
        stateLeanOverrides:{
          TX:28, FL:20, OH:12, PA:4, MI:4, IL:3, CA:3,
          NY:-12, MA:-18, MN:-8, WI:-2, IA:1, MO:14,
          TN:15, NC:16, VA:14, KY:16, IN:22
        },
        context:'Reagan\'s approval is strong. You\'re running as continuity. The "Willie Horton" attack and the Pledge of Allegiance issue have rattled your opponent.',
        congressNote:'Democrats hold Congress. No coattail effect expected.',
        icon:'🦅',
      },
      {
        party:'dem', name:'Michael Dukakis', vp:'Lloyd Bentsen',
        tag:'Democratic Nominee - Governor of Massachusetts',
        opponentName:'George H.W. Bush', opponentParty:'rep',
        nationalMood:'stability',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:258,rep:177}, senateSeats:{dem:55,rep:45},
        startFavorability:42, startFunds:38, startElectability:52,
        stateLeanOverrides:{
          TX:-28, FL:-20, OH:-12, PA:-4, MI:-4, IL:-3, CA:-3,
          NY:12, MA:18, MN:8, WI:2, IA:-1, MO:-14,
          TN:-15, NC:-16, VA:-14, KY:-16, IN:-22
        },
        context:'You started the general 17 points ahead. Then the Republicans defined you. Now you\'re playing defence on "Massachusetts liberal." Can you claw back the lead?',
        congressNote:'Democrats hold Congress solidly.',
        icon:'🏛️',
      },
    ],
  },
  {
    year: 1992, label: '1992 - Clinton vs Bush', videoSrc:'1992Election.mp4',
    sides: [
      {
        party:'dem', name:'Bill Clinton', vp:'Al Gore',
        tag:'Democratic Nominee - Governor of Arkansas',
        opponentName:'George H.W. Bush', opponentParty:'rep',
        nationalMood:'change',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:267,rep:167}, senateSeats:{dem:57,rep:43},
        startFavorability:44, startFunds:42, startElectability:58,
        stateLeanOverrides:{
          PA:5, OH:-2, MI:7, WI:8, MN:10, CO:4, GA:-5, TN:4,
          TX:-18, FL:-4, CA:16, NY:20, IL:10, NJ:6,
          NH:2, ME:6, CT:10, VT:15, LA:-6, AR:0, KY:-4, IN:-15, MO:-2
        },
        context:'"It\'s the economy, stupid." Recession, 7.5% unemployment, and a third-party challenger in Ross Perot. Your "Man from Hope" story is cutting through.',
        congressNote:'Democrats hold Congress. A wave year for your party.',
        icon:'🌊',
      },
      {
        party:'rep', name:'George H.W. Bush', vp:'Dan Quayle',
        tag:'Republican Incumbent President',
        incumbentPlayer: true,
        opponentName:'Bill Clinton', opponentParty:'dem',
        nationalMood:'change',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:267,rep:167}, senateSeats:{dem:57,rep:43},
        startFavorability:37, startFunds:45, startElectability:48,
        stateLeanOverrides:{
          PA:-5, OH:2, MI:-7, WI:-8, MN:-10, CO:-4, GA:5, TN:-4,
          TX:18, FL:4, CA:-16, NY:-20, IL:-10, NJ:-6,
          NH:-2, ME:-6, CT:-10, VT:-15, LA:6, AR:0, KY:4, IN:15, MO:2
        },
        context:'You won the Gulf War 91-9 in the Senate. Your approval hit 89%. Now it\'s crashed to the low 30s. Ross Perot is eating your coalition. Can you hold on?',
        congressNote:'Democrats dominate Congress. You need a miracle.',
        icon:'🦅',
      },
    ],
  },
  {
    year: 2000, label: '2000 - Bush vs Gore', videoSrc:'2000Election.mp4',
    sides: [
      {
        party:'rep', name:'George W. Bush', vp:'Dick Cheney',
        tag:'Republican Nominee - Governor of Texas',
        opponentName:'Al Gore', opponentParty:'dem',
        nationalMood:'stability',
        houseControl:'rep', senateControl:'rep',
        houseSeats:{dem:211,rep:222}, senateSeats:{dem:45,rep:55},
        startFavorability:44, startFunds:48, startElectability:54,
        stateLeanOverrides:{
          FL:1, PA:-3, OH:4, MI:-4, WI:-2, MN:-4, IA:-1, NM:-2, NV:3, NH:1,
          TN:5, AR:3, WV:3, MO:4, NV:3, LA:5, KY:12, VA:10,
          TX:20, CA:-12, NY:-18, IL:-10, NJ:-9, MA:-22
        },
        context:'"Compassionate conservatism" and the "Texas Miracle." Gore is tied to Clinton fatigue. Florida could decide everything. Don\'t squander the lead.',
        congressNote:'Republicans hold Congress - defend it.',
        icon:'🤠',
      },
      {
        party:'dem', name:'Al Gore', vp:'Joe Lieberman',
        tag:'Democratic Nominee - Vice President',
        opponentName:'George W. Bush', opponentParty:'rep',
        nationalMood:'stability',
        houseControl:'rep', senateControl:'rep',
        houseSeats:{dem:211,rep:222}, senateSeats:{dem:45,rep:55},
        startFavorability:43, startFunds:45, startElectability:53,
        stateLeanOverrides:{
          FL:-1, PA:3, OH:-4, MI:4, WI:2, MN:4, IA:1, NM:2, NV:-3, NH:-1,
          TN:-5, AR:-3, WV:-3, MO:-4, LA:-5, KY:-12, VA:-10,
          TX:-20, CA:12, NY:18, IL:10, NJ:9, MA:22
        },
        context:'The economy is booming. Clinton\'s approval is 60%. But the Monica shadow is on you. Florida is a knife\'s edge. Win it and win the presidency.',
        congressNote:'Republicans narrowly hold Congress.',
        icon:'🌿',
      },
    ],
  },
  {
    year: 2008, label: '2008 - Obama vs McCain', videoSrc:'2008Election.mp4',
    sides: [
      {
        party:'dem', name:'Barack Obama', vp:'Joe Biden',
        tag:'Democratic Nominee - Senator from Illinois',
        opponentName:'John McCain', opponentParty:'rep',
        nationalMood:'change',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:235,rep:199}, senateSeats:{dem:49,rep:49},
        startFavorability:50, startFunds:58, startElectability:62,
        stateLeanOverrides:{
          IN:-1, NC:0, VA:5, FL:-2, OH:-3, PA:8, MI:10, WI:12,
          CO:7, NM:10, NV:5, MO:-5, IA:8, NH:8,
          TX:-12, AL:-22, MS:-20, GA:-8, SC:-16,
          NY:22, CA:20, IL:22, MA:25, VT:35
        },
        context:'Lehman Brothers has collapsed. The financial crisis is in full swing. "Change we can believe in." You are the historic candidate America is hungry for.',
        congressNote:'A Democratic wave is coming. You can carry Congress to a supermajority.',
        icon:'🌅',
      },
      {
        party:'rep', name:'John McCain', vp:'Sarah Palin',
        tag:'Republican Nominee - Senator from Arizona',
        opponentName:'Barack Obama', opponentParty:'dem',
        nationalMood:'change',
        houseControl:'dem', senateControl:'dem',
        houseSeats:{dem:235,rep:199}, senateSeats:{dem:49,rep:49},
        startFavorability:42, startFunds:38, startElectability:50,
        stateLeanOverrides:{
          IN:1, NC:0, VA:-5, FL:2, OH:3, PA:-8, MI:-10, WI:-12,
          CO:-7, NM:-10, NV:-5, MO:5, IA:-8, NH:-8,
          TX:12, AL:22, MS:20, GA:8, SC:16,
          NY:-22, CA:-20, IL:-22, MA:-25, VT:-35
        },
        context:'The financial collapse happened on Bush\'s watch. Palin energized the base but the moderate voter is slipping away. This is an uphill battle.',
        congressNote:'Democrats have momentum everywhere. Hold the line.',
        icon:'🦅',
      },
    ],
  },
  {
    year: 2016, label: '2016 - Trump vs Clinton', videoSrc:'2016Election.mp4',
    sides: [
      {
        party:'rep', name:'Donald Trump', vp:'Mike Pence',
        tag:'Republican Nominee - Businessman',
        opponentName:'Hillary Clinton', opponentParty:'dem',
        nationalMood:'change',
        houseControl:'rep', senateControl:'rep',
        houseSeats:{dem:188,rep:247}, senateSeats:{dem:44,rep:54},
        startFavorability:40, startFunds:38, startElectability:56,
        stateLeanOverrides:{
          PA:0, OH:8, MI:0, WI:-1, FL:2, NC:2, IA:8, NV:-2, AZ:4, GA:7,
          MN:-2, NH:-1,
          TX:12, AL:26, MS:22, TN:22, KY:24, WV:35, ND:30,
          CA:-26, NY:-20, MA:-26, VT:-36, MD:-28
        },
        context:'You\'re an outsider in the ultimate insider\'s race. The Rust Belt is crumbling under globalization. "Make America Great Again." Can you flip the Blue Wall?',
        congressNote:'Republicans hold Congress. Complete the sweep.',
        icon:'🔴',
      },
      {
        party:'dem', name:'Hillary Clinton', vp:'Tim Kaine',
        tag:'Democratic Nominee - Former Secretary of State',
        opponentName:'Donald Trump', opponentParty:'rep',
        nationalMood:'change',
        houseControl:'rep', senateControl:'rep',
        houseSeats:{dem:188,rep:247}, senateSeats:{dem:44,rep:54},
        startFavorability:44, startFunds:52, startElectability:60,
        stateLeanOverrides:{
          PA:0, OH:-8, MI:0, WI:1, FL:-2, NC:-2, IA:-8, NV:2, AZ:-4, GA:-7,
          MN:2, NH:1,
          TX:-12, AL:-26, MS:-22, TN:-22, KY:-24, WV:-35, ND:-30,
          CA:26, NY:20, MA:26, VT:36, MD:28
        },
        context:'You\'re the most qualified candidate in modern history. But "emails," Comey, and 30 years of baggage weigh you down. Don\'t lose the Blue Wall.',
        congressNote:'Republicans hold Congress. Flip the Senate.',
        icon:'🟦',
      },
    ],
  },
  {
    year: 2020, label: '2020 - Biden vs Trump', videoSrc:'2020Election.mp4',
    sides: [
      {
        party:'dem', name:'Joe Biden', vp:'Kamala Harris',
        tag:'Democratic Nominee - Former Vice President',
        opponentName:'Donald Trump', opponentParty:'rep',
        nationalMood:'change',
        houseControl:'dem', senateControl:'rep',
        houseSeats:{dem:232,rep:197}, senateSeats:{dem:45,rep:53},
        startFavorability:48, startFunds:54, startElectability:62,
        stateLeanOverrides:{
          PA:3, OH:-5, MI:5, WI:3, FL:-4, NC:-2, AZ:2, GA:0, NV:5, MN:8,
          IA:-4, TX:-8, ME:8, NH:6,
          NY:22, CA:28, IL:18, VT:34, MA:28,
          AL:-25, MS:-22, WV:-38, ND:-32, WY:-42
        },
        context:'COVID-19 has killed 200,000 Americans. The economy is in shambles. You represent a return to normalcy. Win back the Blue Wall and you win.',
        congressNote:'You hold the House. Flip the Senate and complete the sweep.',
        icon:'🔵',
      },
      {
        party:'rep', name:'Donald Trump', vp:'Mike Pence',
        tag:'Republican Incumbent President',
        incumbentPlayer: true,
        opponentName:'Joe Biden', opponentParty:'dem',
        nationalMood:'change',
        houseControl:'dem', senateControl:'rep',
        houseSeats:{dem:232,rep:197}, senateSeats:{dem:45,rep:53},
        startFavorability:42, startFunds:48, startElectability:54,
        stateLeanOverrides:{
          PA:-3, OH:5, MI:-5, WI:-3, FL:4, NC:2, AZ:-2, GA:0, NV:-5, MN:-8,
          IA:4, TX:8, ME:-8, NH:-6,
          NY:-22, CA:-28, IL:-18, VT:-34, MA:-28,
          AL:25, MS:22, WV:38, ND:32, WY:42
        },
        context:'COVID hit hard. The base is energized but swing voters are drifting. Defend the Rust Belt. Hold Florida and North Carolina. You can still win.',
        congressNote:'The Senate is yours. Defend it and retake the House.',
        icon:'🔴',
      },
    ],
  },
  {
    year: 2024, label: '2024 - Harris vs Trump',
    videoSrc: '2024Election.mp4',
    sides: [
      {
        party:'dem', name:'Kamala Harris', vp:'Tim Walz',
        tag:'Democratic Nominee - Vice President',
        opponentName:'Donald Trump', opponentParty:'rep',
        nationalMood:'fatigued',
        houseControl:'rep', senateControl:'dem',
        houseSeats:{dem:213,rep:222}, senateSeats:{dem:48,rep:49},
        startFavorability:46, startFunds:52, startElectability:54,
        stateLeanOverrides:{
          PA:-2, MI:-1, WI:-1, GA:-5, AZ:-5, NV:-3, NC:-8, FL:-14, TX:-16, OH:-12,
          MN:4, NH:5, ME:6, CO:8,
          CA:28, NY:20, IL:18, VT:35, MA:28, MD:28,
          AL:-26, MS:-22, WV:-38, ND:-32, ID:-32
        },
        context:'"Freedom." A late entry after Biden stepped aside. You\'ve energised the base but the economic headwinds and immigration message are cutting against you in key states.',
        congressNote:'Defend the Senate majority. The House is a stretch.',
        icon:'🌸',
        videoSrc:'2024Election.mp4',
      },
      {
        party:'rep', name:'Donald Trump', vp:'JD Vance',
        tag:'Republican Nominee - Former President',
        opponentName:'Kamala Harris', opponentParty:'dem',
        nationalMood:'fatigued',
        houseControl:'rep', senateControl:'dem',
        houseSeats:{dem:213,rep:222}, senateSeats:{dem:48,rep:49},
        startFavorability:44, startFunds:50, startElectability:58,
        stateLeanOverrides:{
          PA:2, MI:1, WI:1, GA:5, AZ:5, NV:3, NC:8, FL:14, TX:16, OH:12,
          MN:-4, NH:-5, ME:-6, CO:-8,
          CA:-28, NY:-20, IL:-18, VT:-35, MA:-28, MD:-28,
          AL:26, MS:22, WV:38, ND:32, ID:32
        },
        context:'You\'re running to reclaim the White House. Inflation, immigration, and a base hungry for retribution are your engine. Hold the Sun Belt and crack the Blue Wall.',
        congressNote:'Republicans hold the House. Flip the Senate.',
        icon:'🔴',
        videoSrc:'2024Election.mp4',
      },
    ],
  },
];

// ── State ────────────────────────────────────────────────────────────
let _histActive  = false;
let _histWaiting = false;
let _histConfig  = null;

// ── Main launch ──────────────────────────────────────────────────────
function openHistoricalElections(){
  renderHistCarousel();
  showScreen('hist-screen');
}

function closeHistoricalScreen(){
  const existing = document.getElementById('hist-inline-confirm');
  if(existing) existing.remove();
  showScreen('setup-screen');
}

const _MOOD_DISPLAY = {
  change:    { icon:'🌊', label:'Change Election' },
  stability: { icon:'⚖️', label:'Stability Election' },
  angry:     { icon:'🔥', label:'Angry Electorate' },
  fatigued:  { icon:'😴', label:'Fatigued Electorate' },
  prosperity:{ icon:'📈', label:'Prosperity Election' },
};

let _pendingHistYear = null, _pendingHistSide = null;

function renderHistCarousel(){
  const grid = document.getElementById('hist-grid');
  grid.innerHTML = HISTORICAL_ELECTIONS.map((elec)=>{
    const yr  = elec.year;
    const s0  = elec.sides[0], s1 = elec.sides[1];
    const lastName0 = s0.name.split(' ').pop();
    const lastName1 = s1.name.split(' ').pop();
    const col0 = s0.party==='dem' ? 'var(--dem)' : 'var(--rep)';
    const col1 = s1.party==='dem' ? 'var(--dem)' : 'var(--rep)';
    const lbl0 = s0.party==='dem' ? 'PLAY AS DEMOCRAT' : 'PLAY AS REPUBLICAN';
    const lbl1 = s1.party==='dem' ? 'PLAY AS DEMOCRAT' : 'PLAY AS REPUBLICAN';
    return `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px 18px">
        <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:var(--text3);text-transform:uppercase;margin-bottom:6px">${yr} Presidential Election</div>
        <div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:var(--text);margin-bottom:12px">${lastName0} vs ${lastName1}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="hist-side-btn" data-year="${yr}" data-side="0" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:left;cursor:pointer;color:var(--text)">
            <div style="font-size:24px;margin-bottom:6px">${s0.icon}</div>
            <div style="font-family:var(--font-display);font-size:14px;font-weight:700;color:${col0};margin-bottom:2px">${s0.name}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);margin-bottom:8px">VP: ${s0.vp}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:${col0};letter-spacing:.05em">${lbl0} →</div>
          </button>
          <button class="hist-side-btn" data-year="${yr}" data-side="1" style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:left;cursor:pointer;color:var(--text)">
            <div style="font-size:24px;margin-bottom:6px">${s1.icon}</div>
            <div style="font-family:var(--font-display);font-size:14px;font-weight:700;color:${col1};margin-bottom:2px">${s1.name}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);margin-bottom:8px">VP: ${s1.vp}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:${col1};letter-spacing:.05em">${lbl1} →</div>
          </button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.hist-side-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      histShowConfirm(+btn.dataset.year, +btn.dataset.side);
    });
  });
}

function histShowConfirm(year, sideIdx){
  const elec = HISTORICAL_ELECTIONS.find(e=>e.year===year);
  if(!elec) return;
  const cfg = elec.sides[sideIdx];
  if(!cfg) return;

  _pendingHistYear = year;
  _pendingHistSide = sideIdx;

  const mood = _MOOD_DISPLAY[cfg.nationalMood] || { icon:'🗳️', label: cfg.nationalMood };

  const confirmEl = document.getElementById('hist-confirm');
  const innerEl   = document.getElementById('hist-confirm-inner');
  if(!confirmEl || !innerEl) return;

  innerEl.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:#a78bfa;text-transform:uppercase;margin-bottom:10px">${year} - ${cfg.name.toUpperCase()}</div>
    <p style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:14px">${cfg.context}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px">
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:5px">Running Mate</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${cfg.vp}</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px">
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:5px">Opponent</div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${cfg.opponentName}</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px">
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:5px">National Mood</div>
        <div style="font-size:13px;font-weight:600;color:var(--accent)">${mood.icon} ${mood.label}</div>
      </div>
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px">
        <div style="font-family:var(--font-mono);font-size:9px;color:var(--text3);letter-spacing:.15em;text-transform:uppercase;margin-bottom:5px">Congress</div>
        <div style="font-size:12px;font-weight:600;color:var(--text);line-height:1.4">${cfg.congressNote||'-'}</div>
      </div>
    </div>
    <div style="background:rgba(200,168,75,.07);border:1px solid rgba(200,168,75,.2);border-radius:8px;padding:11px 14px;margin-bottom:14px;font-size:12px;color:var(--text2);line-height:1.6">
      ⚡ You start directly in the <strong style="color:var(--accent)">General Election</strong> - no primary. The map is pre-set to historical conditions. Play the campaign your way.
    </div>
    <div style="display:flex;gap:10px">
      <button id="hist-back-btn" style="padding:12px 18px;background:transparent;border:1px solid var(--border2);border-radius:var(--radius);color:var(--text2);font-family:var(--font-mono);font-size:11px;cursor:pointer">← Back</button>
      <button id="hist-launch-btn" style="flex:1;padding:12px;background:var(--accent);border:none;border-radius:var(--radius);color:#0a0c10;font-family:var(--font-display);font-size:15px;font-weight:700;cursor:pointer">Begin ${year} Campaign →</button>
    </div>
  `;

  confirmEl.style.display = '';
  confirmEl.scrollIntoView({ behavior:'smooth', block:'nearest' });

  document.getElementById('hist-back-btn').addEventListener('click', ()=>{
    confirmEl.style.display = 'none';
  });
  document.getElementById('hist-launch-btn').addEventListener('click', ()=>{
    confirmEl.style.display = 'none';
    startHistoricalGame(_pendingHistYear, _pendingHistSide);
  });
}


// ── Start historical game ────────────────────────────────────────────
function startHistoricalGame(year,sideIdx){
  const elec = HISTORICAL_ELECTIONS.find(e=>e.year===year);
  if(!elec){ console.error('No election for year',year); return; }
  const cfg  = elec.sides[sideIdx];
  if(!cfg){  console.error('No side',sideIdx,'in',year); return; }

  _histActive  = true;
  _histWaiting = false;
  _histConfig  = cfg;

  // Reset voter blocs to baseline
  const _HIST_BLOCS_DEFAULTS = {wc:5,ce:15,sr:-8,yv:25,sw:10,rc:-35,up:55,in:0};
  if(typeof GS_BLOCS !== 'undefined'){
    Object.entries(_HIST_BLOCS_DEFAULTS).forEach(([k,v])=>{
      if(GS_BLOCS[k]){ GS_BLOCS[k].support=v; if(GS_BLOCS[k].history) GS_BLOCS[k].history.splice(0); }
    });
  }

  GS.phase            = 'general';
  GS.generalWeeks     = 16;
  GS.week             = 1;
  GS.playerParty      = cfg.party;

  // FIX: Set all party display fields so setupUI, renderPolls, startElectionNight work correctly
  GS.playerPartyLabel = cfg.party === 'dem' ? 'Democratic' : 'Republican';
  GS.playerPartyColor = cfg.party === 'dem' ? '#3b82f6' : '#ef4444';
  GS.playerPartyIcon  = cfg.party === 'dem' ? '🔵' : '🔴';

  GS.playerName       = cfg.name;
  GS.playerVP         = cfg.vp;
  GS.playerTag        = cfg.tag;
  GS.opponentParty    = cfg.opponentParty;
  GS.opponentName     = cfg.opponentName;

  GS.nationalMood          = cfg.nationalMood;
  GS.houseControl          = cfg.houseControl;
  GS.senateControl         = cfg.senateControl;
  GS.houseSeats            = cfg.houseSeats  || {dem:218,rep:217};
  GS.senateSeats           = cfg.senateSeats || {dem:51, rep:49};
  GS.incumbentPlayer       = !!cfg.incumbentPlayer;
  GS.incumbentOpponent     = !!cfg.incumbentOpponent;

  GS.funds            = cfg.startFunds         || 50;
  GS.favorability     = cfg.startFavorability  || 50;
  GS.electability     = cfg.startElectability  || 60;
  GS.momentum         = 0;
  GS.mediaCoverage    = 50;
  GS.mediaBias        = (GS.playerParty==='dem'?-5:5);
  // FIX: Always reset totalSpent to 0 so renderFinance shows correct value
  GS.totalSpent       = 0;
  GS.totalRaised      = cfg.startFunds || 50;
  GS.minigamesThisWeek= 0;
  GS.favHistory       = [GS.favorability];
  GS.newsItems        = [];
  GS.groundGame       = 30;
  GS.endorsements     = 0;
  GS.difficulty       = GS.difficulty || 'normal';
  GS._enthusiasm      = 50;
  GS._vpScandalBuffer = 0;
  GS._actionStreak    = 0;
  GS._recentActions   = [];
  GS._uniqueActionsUsed = new Set();
  GS._boringCampaignFired = false;
  GS.homeState        = null;
  GS.demos            = { urban:50, suburban:45, rural:30, youth:40, seniors:45 };

  // FIX: Set backstory so setupUI career-title lookup doesn't show stale career from previous game
  GS.backstory = { career: cfg.incumbentPlayer ? 'vp' : 'senator', moment:'healthcare',
                   ideology:50, slogan:'', ideologyDesc:'moderate', momentText:'record of public service' };

  GS.opponent = {
    name:    cfg.opponentName,
    party:   cfg.opponentParty,
    funds:   (cfg.startFunds || 50) * 0.9,
    approval: 100 - (cfg.startFavorability || 50),
    active:  true,
    color:   cfg.opponentParty === 'dem' ? '#3b82f6' : '#ef4444',
    delegates: 0,
    archetype: 'moderate',
  };
  GS.aiCandidates = [GS.opponent];

  GS.vp = {
    name:           cfg.vp || '',
    stateCode:      null,
    bVal:           0,
    debateDefense:  6,
    enthusiasmAmp:  5,
    scandalBuffer:  2,
    regionBoost:    0,
  };

  // primaryWeeks=0 so all week-in-general calculations are correct
  GS.primaryWeeks     = 0;

  GS._aiRegional      = {};
  GS.playerDelegates  = 0;
  GS.delegatesNeeded  = 1991;

  GS._congressInitialized = false;
  GS._electionResult = null;
  GS._finalResult    = null;
  GS._compassHistory = [];
  GS._oppSummaryEvents = null;
  GS._pendingNegotiation = null;
  GS._lastCrisisWeek  = 0;
  GS._crisisCountThisPhase = 0;
  GS._crisisArmed     = false;
  GS._scandalRisk     = G(1,0.5);

  GS.selectedAction   = null;
  GS.targetState      = null;
  GS.targetedStates   = new Set();
  GS.phaseTransitioning = false;
  GS._histYear        = year;

  loadDefaultStates();
  if(cfg.stateLeanOverrides){
    Object.entries(cfg.stateLeanOverrides).forEach(([code,mod])=>{
      const st = GS.states.find(s=>s.code===code);
      if(st) st.leanMod = mod;
    });
  }
  if(typeof ensureBattlegroundSets === 'function') ensureBattlegroundSets(true);

  calculateNationalPolls();

  document.removeEventListener('keydown', _hist_keydown, true);
  document.addEventListener('keydown', _hist_keydown, true);

  const nwBtn = document.querySelector('.next-week-btn');
  if(nwBtn) nwBtn.onclick = hist_nextWeek;

  // Play intro video then launch game
  const elecData = HISTORICAL_ELECTIONS.find(e=>e.year===year);
  const videoSrc = (elecData && elecData.videoSrc) ? elecData.videoSrc : null;
  const videoOverlay = document.getElementById('hist-video-overlay');
  const vid = document.getElementById('hist-intro-video');
  const label = document.getElementById('hist-video-label');

  if(videoOverlay && vid && videoSrc){
    if(label) label.textContent = year + ' - ' + cfg.name;
    vid.src = videoSrc;
    videoOverlay.style.display = 'flex';
    const bgMusic = document.getElementById('bg-music');
    if(bgMusic && !bgMusic.paused){ bgMusic.volume = 0; }
    vid.play().catch(()=>{ _histLaunchGame(); });
    vid.onended = _histLaunchGame;
  } else {
    _histLaunchGame();
  }
}

function _histLaunchGame(){
  const videoOverlay = document.getElementById('hist-video-overlay');
  const vid = document.getElementById('hist-intro-video');
  if(vid){ vid.onended = null; }
  if(videoOverlay) videoOverlay.style.display = 'none';
  const bgMusic = document.getElementById('bg-music');
  if(bgMusic) bgMusic.volume = 1;
  showScreen('game-screen');
  if(typeof setupUI === 'function') setupUI();

  document.getElementById('topbar-phase').textContent = 'General Election';
  document.getElementById('phase-primary').className  = 'phase-step done';
  document.getElementById('phase-convention').className = 'phase-step done';
  document.getElementById('phase-general').className  = 'phase-step current';
  document.getElementById('opponent-panel-title').textContent = 'General Opponent';
  document.getElementById('primary-content').style.display = 'none';
  document.getElementById('general-content').style.display = 'block';
  document.getElementById('battleground-section').style.display = 'block';
  const congressEl = document.getElementById('congress-tracker');
  if(congressEl) congressEl.style.display = 'block';
  document.getElementById('polls-title').textContent = 'National General Poll';
  document.getElementById('stat-delegates').textContent = '-';
  document.getElementById('stat-delegates-wrap').style.display = 'none';
  GS._evRevealThreshold = 15;

  // FIX: initCongressTracker then override with real historical seat counts
  if(typeof initCongressTracker === 'function') initCongressTracker();
  _histApplyCongressSeats();

  renderAll();
  const nwBtn = document.querySelector('.next-week-btn');
  if(nwBtn) nwBtn.onclick = hist_nextWeek;
  const summaryBtn = document.querySelector('#summary-modal .modal-btn.primary');
  if(summaryBtn) summaryBtn.onclick = hist_closeSummary;
  setTimeout(()=>centerUSA(), 50);
}

// FIX: Override congress tracker display with real historical seat data
function _histApplyCongressSeats(){
  const cfg = _histConfig;
  if(!cfg) return;
  const hs = cfg.houseSeats  || {dem:218,rep:217};
  const ss = cfg.senateSeats || {dem:51, rep:49};

  // Update the _congressState object used by renderCongressTracker (in game-tour.js)
  if(typeof _congressState !== 'undefined' && _congressState){
    _congressState.senate.dem = ss.dem;
    _congressState.senate.rep = ss.rep;
    _congressState.house.dem  = hs.dem;
    _congressState.house.rep  = hs.rep;
  }

  // Also update the HTML elements directly as a fallback
  const sD = document.getElementById('senate-dem-seats');
  const sR = document.getElementById('senate-rep-seats');
  const hD = document.getElementById('house-dem-seats');
  const hR = document.getElementById('house-rep-seats');
  if(sD) sD.textContent = ss.dem;
  if(sR) sR.textContent = ss.rep;
  if(hD) hD.textContent = hs.dem;
  if(hR) hR.textContent = hs.rep;

  const sBD = document.getElementById('senate-bar-dem');
  const sBR = document.getElementById('senate-bar-rep');
  const hBD = document.getElementById('house-bar-dem');
  const hBR = document.getElementById('house-bar-rep');
  if(sBD) sBD.style.width = (ss.dem/100*100)+'%';
  if(sBR) sBR.style.width = (ss.rep/100*100)+'%';
  if(hBD) hBD.style.width = (hs.dem/435*100)+'%';
  if(hBR) hBR.style.width = (hs.rep/435*100)+'%';
}

function skipHistIntroVideo(){
  const vid = document.getElementById('hist-intro-video');
  if(vid){ vid.pause(); vid.src = ''; }
  const bgMusic = document.getElementById('bg-music');
  if(bgMusic) bgMusic.volume = 1;
  _histLaunchGame();
}

// ── Next week ────────────────────────────────────────────────────────
function hist_nextWeek(){
  if(_histWaiting) return;
  const mg = document.getElementById('minigame-modal');
  if(mg && mg.classList.contains('active')) return;

  const action = FRONTRUNNER_ACTIONS.find(a=>a.id===GS.selectedAction)
              || UNDERDOG_ACTIONS.find(a=>a.id===GS.selectedAction);
  let events = [];

  if(action){
    if(action.needsState && !GS.targetState){
      alert('Please select a target state for this action.');
      return;
    }
    if(GS.funds < action.cost){
      alert('Not enough funds! Fundraise first.');
      return;
    }
  }

  if(!GS._actionStreak) GS._actionStreak = 0;
  if(action){
    GS._actionStreak++;
    if(GS._actionStreak===3){ GS.momentum=cl(GS.momentum+1,0,20); addNews('3-week campaign streak! Momentum boost.','campaign'); }
    else if(GS._actionStreak===5){ GS.momentum=cl(GS.momentum+2,0,20); GS.funds+=2; addNews('5-week streak! Momentum +2, bonus $2M fundraising.','campaign'); }
    else if(GS._actionStreak>0 && GS._actionStreak%7===0){ GS.momentum=cl(GS.momentum+3,0,20); addNews(`${GS._actionStreak}-week streak! Voters notice your relentless campaigning.`,'campaign'); }
  } else {
    GS._actionStreak = 0;
    addNews('A quiet week on the trail - the campaign loses ground while rivals stay active.','campaign');
    GS.momentum      = cl(GS.momentum * 0.75 - 1, -20, 20);
    GS.mediaCoverage = cl(GS.mediaCoverage - 3, 0, 100);
    GS.favorability  = cl(GS.favorability - 0.5, 20, 85);
  }

  if(action){
    GS.funds      -= action.cost;
    GS.totalSpent += action.cost;
    if(GS.targetState){ const ts=GS.states.find(s=>s.code===GS.targetState); if(ts) ts._campaigned=true; }
    if(action.risk && GS.nationalMood) window._moodRiskRoll = getMoodRiskMod();
    else window._moodRiskRoll = null;
    events = action.fx(GS.targetState) || [];
    events = applyMinigameBonus(events);
  }

  const HIST_DEBATE_WEEKS = [4, 9, 14];
  if(HIST_DEBATE_WEEKS.includes(GS.week)){
    const de = resolveDebate();
    events.push(de);
    addNews(de.title, 'event');
  }

  passiveDecay();
  opponentPassiveFundraise();
  const dropEvs = runAI();
  events.push(...dropEvs);

  if(Math.random() < 0.62){
    const ev = wr(EVENTS), res = ev.fx(GS);
    addNews(ev.hl, ev.tag);
    events.push({type:res.type, title:ev.hl, msg:res.msg});
  }

  if(action) applyMomentumToGeneral();

  GS.week++;
  GS.minigamesThisWeek = 0;
  GS.selectedAction = null;
  GS.targetState    = null;
  GS.targetedStates.clear();
  document.querySelectorAll('.action-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('state-target-section').style.display='none';
  document.getElementById('target-state-select').value='';
  const nwBtn = document.querySelector('.next-week-btn');
  if(nwBtn) nwBtn.classList.remove('action-ready');
  GS.favHistory.push(GS.favorability);
  GS.mediaBias = cl(GS.mediaBias*0.92 + G(0,4), -100, 100);
  GS.mediaBias = cl(GS.mediaBias + (GS.playerParty==='dem'?-1:1), -100, 100);

  renderAll();
  hist_showSummary(events);
}

// ── Summary modal ────────────────────────────────────────────────────
function hist_showSummary(events){
  const mg = document.getElementById('minigame-modal');
  if(mg) mg.classList.remove('active');

  const isLastWeek = GS.week > GS.generalWeeks;
  const genWk      = GS.week - 1;

  document.getElementById('summary-title').textContent = isLastWeek
    ? '📅 Final Week Summary - Election Day Approaches'
    : `📅 General Election - Week ${genWk} of ${GS.generalWeeks} Summary`;
  document.getElementById('summary-subtitle').textContent = isLastWeek
    ? `The votes are about to be counted - ${fm(GS.funds)} remaining`
    : `${GS.generalWeeks - genWk} week${GS.generalWeeks-genWk===1?'':'s'} remaining - ${fm(GS.funds)}`;

  const ev = events.length ? events
    : [{type:'neutral', title:'Quiet Week', msg:'A calm week on the trail. No major developments.'}];
  document.getElementById('summary-events').innerHTML =
    ev.map(e=>`<div class="summary-event ${e.type}"><div class="summary-title">${e.title}</div><div>${e.msg}</div></div>`).join('');

  const summaryBtn = document.querySelector('#summary-modal .modal-btn.primary');
  if(summaryBtn){
    summaryBtn.textContent = isLastWeek ? '🗳️ To Election Night →' : 'Continue →';
    summaryBtn.onclick = hist_closeSummary;
  }

  document.getElementById('summary-modal').classList.add('active');
}

// ── Summary close ────────────────────────────────────────────────────
function hist_closeSummary(){
  document.getElementById('summary-modal').classList.remove('active');

  const summaryBtn = document.querySelector('#summary-modal .modal-btn.primary');
  if(summaryBtn) summaryBtn.textContent = 'Continue →';

  if(GS._pendingNegotiation){
    _histWaiting = true;
    setTimeout(()=>{ _histWaiting = false; openNegotiateModal(); }, 300);
    return;
  }

  if(GS.week > GS.generalWeeks && !GS.phaseTransitioning){
    GS.phaseTransitioning = true;
    setTimeout(showResult, 400);
    return;
  }

  renderAll();
}

// ── N-key listener ───────────────────────────────────────────────────
function _hist_keydown(e){
  if(!_histActive) return;
  if(e.key !== 'n' && e.key !== 'N') return;
  if(e.target.matches('input,select,textarea')) return;
  const gameScreenEl = document.getElementById('game-screen');
  const anyModal     = document.querySelector('.modal-overlay.active');
  if(gameScreenEl && gameScreenEl.classList.contains('active') && !anyModal){
    e.stopImmediatePropagation();
    hist_nextWeek();
  }
}

// ── Restore career mode ──────────────────────────────────────────────
function hist_restoreNormalMode(){
  _histActive  = false;
  _histWaiting = false;
  _histConfig  = null;
  document.removeEventListener('keydown', _hist_keydown, true);
  const nwBtn = document.querySelector('.next-week-btn');
  if(nwBtn) nwBtn.onclick = nextWeek;
  const summaryBtn = document.querySelector('#summary-modal .modal-btn.primary');
  if(summaryBtn) summaryBtn.onclick = closeSummary;
}

// ── Patch startGame to restore career mode cleanly ───────────────────
(function(){
  const _orig = window.startGame;
  if(typeof _orig === 'function'){
    window.startGame = function(){
      hist_restoreNormalMode();
      return _orig.apply(this, arguments);
    };
  }
})();
