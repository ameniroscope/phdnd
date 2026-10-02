// Episode II finale: fishing (d6 each), secrets box, battle (3d20 summed),
// the Deep Ledger XP bar, and the closing riddle.
//
// Firestore, on Session/{SESSION_ID}:
//   fish_<char>: 1–6          battle_<char>: 1–20
//   secret_<char>: 'shared' | 'kept'   (status only — never the text)
//   riddle_<char>: answer text
// Secret texts go to Session/{SESSION_ID}-secrets, which this page writes but
// never reads, so they don't reach other players' screens. (Anyone with the
// Firebase console can still read them — that's the GM's copy.)
// A roll is final once saved; to redo one, delete its field in the console.

import { db } from './firebase.js';
import {
  doc, onSnapshot, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const SESSION_ID = '2';

const CHARS = ['pip', 'luna', 'lux'];
const CHAR_LABEL = { pip: '🍄 Pip', luna: '🌙 Luna', lux: '🐉 Lux' };

// ---- GM settings -------------------------------------------------------------

// Battle outcome by the sum of the d20s (thresholds are for 3 players; the sum
// is rescaled if the party size changes). DRAFT — awaiting Marine's final split.
const BATTLE_TIERS = [
  { max: 15, text: 'The monsters are unharmed. They jeer and mock the party.' },
  { max: 30, text: 'One monster dies — the other two attack and steal the party’s fish!' },
  { max: 45, text: 'Two monsters die; the last one flees into the deep.' },
  { max: Infinity, text: 'All three monsters die.' }
];

// The Deep Ledger. `earned` is what the party has inscribed so far (PLACEHOLDER
// values — fill in from the point-system app). The bar never fills past `cap`
// of the threshold this episode: the Archivon arc stays locked.
const LEDGER = {
  threshold: 500,
  cap: 0.92,
  earned: [
    { cat: 'encounters', label: 'Encounters', points: 175 },
    { cat: 'journey', label: 'Journey', points: 140 },
    { cat: 'journal', label: 'Journal', points: 120 }
  ],
  // Peasant → Legend; add the intermediate ranks with their point floors.
  ranks: [
    { min: 0, name: 'Peasant' },
    { min: 500, name: 'Legend' }
  ]
};

// TODO: riddle text still being written.
const RIDDLE = 'The riddle is still being inked…';

// ---- helpers -----------------------------------------------------------------

function rollDie(sides) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

const statusEl = document.getElementById('session-status');

function status(text) {
  statusEl.textContent = text;
  statusEl.hidden = !text;
}

function inscribed() {
  status('Inscribed. ✦');
  setTimeout(() => { if (statusEl.textContent === 'Inscribed. ✦') status(''); }, 2500);
}

async function save(fields, docId = SESSION_ID) {
  try {
    await setDoc(doc(db, 'Session', docId), fields, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save:', err);
    status('The archive refused the entry — check the connection.');
    return false;
  }
}

// latest snapshot of the session doc, so rolls can't overwrite one another
let data = {};

// ---- card routing --------------------------------------------------------------

const menu = document.getElementById('parts-menu');
const parts = [...document.querySelectorAll('.part')];

function route() {
  const m = location.hash.match(/^#part-(\d)$/);
  const target = m ? `part-${m[1]}` : null;
  menu.hidden = !!target;
  for (const p of parts) p.hidden = p.id !== target;
  window.scrollTo(0, 0);
  const paper = document.querySelector('main.page');
  if (paper) paper.scrollTop = 0;
  if (target === 'part-4') fillLedger();
}

window.addEventListener('hashchange', route);

parts.forEach((p, i) => {
  const nav = document.createElement('nav');
  nav.className = 'chapter-nav';

  const prev = document.createElement('a');
  prev.innerHTML = '<span aria-hidden="true">❮</span> Previous';
  prev.href = `#part-${i}`;
  prev.style.visibility = i > 0 ? 'visible' : 'hidden';

  const next = document.createElement('a');
  next.innerHTML = 'Next <span aria-hidden="true">❯</span>';
  next.href = `#part-${i + 2}`;
  next.style.visibility = i < parts.length - 1 ? 'visible' : 'hidden';

  nav.append(prev, next);
  p.appendChild(nav);
});

// ---- who is this? --------------------------------------------------------------

let whoResolve = null;

function chooseCharacter() {
  return new Promise((resolve) => {
    whoResolve = resolve;
    document.getElementById('who-scrim').hidden = false;
  });
}

const whoScrim = document.getElementById('who-scrim');

for (const btn of whoScrim.querySelectorAll('[data-char]')) {
  btn.addEventListener('click', () => {
    whoScrim.hidden = true;
    if (whoResolve) { whoResolve(btn.dataset.char); whoResolve = null; }
  });
}

whoScrim.addEventListener('click', (e) => {
  if (e.target !== whoScrim) return;
  whoScrim.hidden = true;
  if (whoResolve) { whoResolve(null); whoResolve = null; }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || whoScrim.hidden) return;
  whoScrim.hidden = true;
  if (whoResolve) { whoResolve(null); whoResolve = null; }
});

// ---- dice (fishing + battle) ---------------------------------------------------

// One row per character: name, die face, roll button. Rolls are shared live.
function buildDice(containerId, prefix, sides) {
  const rows = {};
  const container = document.getElementById(containerId);

  for (const c of CHARS) {
    const row = document.createElement('div');
    row.className = 'dice-row';

    const name = document.createElement('span');
    name.className = 'dice-name';
    name.textContent = CHAR_LABEL[c];

    const face = document.createElement('span');
    face.className = `die d${sides}`;
    face.textContent = '?';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ink-btn';
    btn.textContent = `Roll d${sides}`;

    btn.addEventListener('click', async () => {
      const key = `${prefix}_${c}`;
      if (data[key]) return;
      btn.disabled = true;
      // a short tumble before the real result lands
      face.classList.add('rolling');
      for (let t = 0; t < 10; t++) {
        face.textContent = rollDie(sides);
        await new Promise((r) => setTimeout(r, 55));
      }
      face.classList.remove('rolling');
      const value = rollDie(sides);
      face.textContent = value;
      if (!(await save({ [key]: value }))) {
        face.textContent = '?';
        btn.disabled = false;
      }
    });

    row.append(name, face, btn);
    container.appendChild(row);
    rows[c] = { face, btn };
  }

  return function render() {
    const values = [];
    for (const c of CHARS) {
      const v = data[`${prefix}_${c}`];
      const { face, btn } = rows[c];
      if (v) {
        face.textContent = v;
        face.classList.add('rolled');
        btn.disabled = true;
        btn.textContent = 'Rolled';
        values.push(v);
      } else if (!face.classList.contains('rolling')) {
        face.classList.remove('rolled');
        btn.disabled = false;
        btn.textContent = `Roll d${sides}`;
      }
    }
    return values;
  };
}

const renderFishDice = buildDice('fish-dice', 'fish', 6);
const renderBattleDice = buildDice('battle-dice', 'battle', 20);

const fishTotalEl = document.getElementById('fish-total');
const battleTotalEl = document.getElementById('battle-total');
const outcomeEl = document.getElementById('battle-outcome');

function fishCount() {
  const values = CHARS.map((c) => data[`fish_${c}`]).filter(Boolean);
  return values.length === CHARS.length ? values.reduce((a, b) => a + b, 0) : null;
}

function renderFishing() {
  const values = renderFishDice();
  const total = values.reduce((a, b) => a + b, 0);
  if (values.length === CHARS.length) {
    fishTotalEl.textContent = `🐟 ${total} fish caught!`;
  } else if (values.length) {
    fishTotalEl.textContent = `${total} fish so far… (${CHARS.length - values.length} still to cast)`;
  } else {
    fishTotalEl.textContent = '';
  }
}

function renderBattle() {
  const values = renderBattleDice();
  const sum = values.reduce((a, b) => a + b, 0);
  if (values.length < CHARS.length) {
    battleTotalEl.textContent = values.length
      ? `Sum so far: ${sum} (${CHARS.length - values.length} still to roll)`
      : '';
    outcomeEl.hidden = true;
    return;
  }
  battleTotalEl.textContent = `Total: ${sum}`;
  const scaled = sum * 3 / CHARS.length;
  const tier = BATTLE_TIERS.find((t) => scaled <= t.max);
  let text = tier.text;
  // the "steal the fish" tier names the catch, if the fishing is done
  const fish = fishCount();
  if (tier === BATTLE_TIERS[1] && fish !== null) text += ` (All ${fish} of them.)`;
  outcomeEl.textContent = text;
  outcomeEl.hidden = false;
}

// ---- secrets -------------------------------------------------------------------

const secretList = document.getElementById('secret-list');
const secretForm = document.getElementById('secret-form');
const secretInput = document.getElementById('secret-input');
const secretSpeaker = document.getElementById('secret-speaker');
const secretOpen = document.getElementById('secret-open');
let secretWho = null;

const SECRET_STATE = {
  shared: '✉ has sealed a secret',
  kept: '🤐 keeps their own counsel'
};

function renderSecrets() {
  secretList.replaceChildren(...CHARS.map((c) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${CHAR_LABEL[c]} `;
    li.append(strong, SECRET_STATE[data[`secret_${c}`]] || '… is still deciding');
    return li;
  }));
}

function closeSecretForm() {
  secretWho = null;
  secretInput.value = '';
  secretForm.hidden = true;
  secretOpen.hidden = false;
}

secretOpen.addEventListener('click', async () => {
  const c = await chooseCharacter();
  if (!c) return;
  secretWho = c;
  secretSpeaker.textContent = data[`secret_${c}`]
    ? `${CHAR_LABEL[c]} — sealing again replaces your earlier choice`
    : `For ${CHAR_LABEL[c]}'s eyes only`;
  secretForm.querySelector('input[value="shared"]').checked = true;
  secretInput.hidden = false;
  secretForm.hidden = false;
  secretOpen.hidden = true;
  secretInput.focus();
});

for (const radio of secretForm.querySelectorAll('input[name="secret-share"]')) {
  radio.addEventListener('change', () => {
    secretInput.hidden = secretForm.querySelector('input[name="secret-share"]:checked').value !== 'shared';
  });
}

document.getElementById('secret-cancel').addEventListener('click', closeSecretForm);

secretForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!secretWho) return;
  const choice = secretForm.querySelector('input[name="secret-share"]:checked').value;
  const text = secretInput.value.trim();
  if (choice === 'shared' && !text) { secretInput.focus(); return; }

  // the text goes to the GM-only doc first, then the public "sealed" status
  const ok = await save({
    [`secret_${secretWho}`]: { choice, text: choice === 'shared' ? text : '', at: serverTimestamp() }
  }, `${SESSION_ID}-secrets`)
    && await save({ [`secret_${secretWho}`]: choice });
  if (ok) {
    closeSecretForm();
    inscribed();
  }
});

// ---- the Deep Ledger -----------------------------------------------------------

const ledgerEl = document.getElementById('ledger');
const ledgerTotal = LEDGER.earned.reduce((a, e) => a + e.points, 0);
const ledgerShown = Math.min(ledgerTotal, Math.floor(LEDGER.threshold * LEDGER.cap));
const ledgerRank = [...LEDGER.ranks].reverse().find((r) => ledgerShown >= r.min);
const ledgerSegments = [];

(function buildLedger() {
  const rank = document.createElement('p');
  rank.className = 'ledger-rank';
  rank.textContent = `Rank: ${ledgerRank.name}`;

  const bar = document.createElement('div');
  bar.className = 'ledger-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-valuemin', 0);
  bar.setAttribute('aria-valuemax', LEDGER.threshold);
  bar.setAttribute('aria-valuenow', ledgerShown);

  // each category gets its share of the visible fill, in order
  let remaining = ledgerShown;
  for (const e of LEDGER.earned) {
    const pts = Math.min(e.points, remaining);
    remaining -= pts;
    const seg = document.createElement('span');
    seg.className = `ledger-seg ${e.cat}`;
    seg.dataset.width = `${(pts / LEDGER.threshold) * 100}%`;
    bar.appendChild(seg);
    ledgerSegments.push(seg);
  }

  const lock = document.createElement('span');
  lock.className = 'ledger-lock';
  lock.textContent = '🔒';
  lock.title = 'Archivon';
  bar.appendChild(lock);

  const count = document.createElement('p');
  count.className = 'ledger-count';
  count.textContent = `${ledgerShown} / ${LEDGER.threshold} — the way to Archivon is not yet open`;

  const legend = document.createElement('ul');
  legend.className = 'ledger-legend';
  for (const e of LEDGER.earned) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = `ledger-dot ${e.cat}`;
    li.append(dot, `${e.label} — ${e.points}`);
    legend.appendChild(li);
  }

  ledgerEl.append(rank, bar, count, legend);
})();

// animate from empty each time the page is opened
function fillLedger() {
  for (const seg of ledgerSegments) seg.style.width = '0';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const seg of ledgerSegments) seg.style.width = seg.dataset.width;
  }));
}

// ---- the riddle ----------------------------------------------------------------

document.getElementById('riddle-text').textContent = RIDDLE;

const riddleAnswers = document.getElementById('riddle-answers');
const riddleSpeaker = document.getElementById('riddle-speaker');
const riddleInput = document.getElementById('riddle-input');
const riddleSave = document.getElementById('riddle-save');
let riddleWho = null;

riddleInput.addEventListener('click', async () => {
  if (riddleWho) return;
  const c = await chooseCharacter();
  if (!c) return;
  riddleWho = c;
  riddleSpeaker.textContent = `Answering as ${CHAR_LABEL[c]}`;
  riddleSpeaker.hidden = false;
  riddleInput.readOnly = false;
  riddleSave.hidden = false;
  riddleInput.focus();
});

document.getElementById('riddle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!riddleWho) return;
  const text = riddleInput.value.trim();
  if (!text) return;
  if (await save({ [`riddle_${riddleWho}`]: text })) {
    riddleInput.value = '';
    inscribed();
  }
});

function renderRiddle() {
  riddleAnswers.replaceChildren(...CHARS
    .filter((c) => data[`riddle_${c}`])
    .map((c) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${CHAR_LABEL[c]}: `;
      p.append(strong, data[`riddle_${c}`]);
      return p;
    }));
}

// ---- live sync -----------------------------------------------------------------

function renderAll() {
  renderFishing();
  renderBattle();
  renderSecrets();
  renderRiddle();
}

renderAll();

onSnapshot(doc(db, 'Session', SESSION_ID), (snap) => {
  data = snap.data() || {};
  renderAll();
}, (err) => {
  console.error('Failed to load the episode:', err);
  status('The archive is unreachable — check the Firestore setup.');
});

route();
