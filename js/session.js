// Session page: three cards (Introduction / Discoveries / The Road Ahead),
// each with a podcast player; part 2 has six object tiles, part 3 has the
// map and the "where should we go?" answers.
//
// Firestore: answers land on Session/{SESSION_ID} as fields
// whereto_luna / whereto_pip.

import { db } from './firebase.js';
import {
  doc, onSnapshot, setDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const SESSION_ID = '1';

// The six discovery tiles — each image is a self-contained item card.
// Put images in images/objects/ (a missing image shows an ornament instead).
const OBJECTS = [
  { image: 'images/objects/1.png' },
  { image: 'images/objects/2.png' },
  { image: 'images/objects/3.png' },
  { image: 'images/objects/4.png' },
  { image: 'images/objects/5.png' },
  { image: 'images/objects/6.png' }
];

const MAP_IMAGE = 'images/fullmap_annotated.png';

function roman(n) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

// ---- card routing ----------------------------------------------------------

const menu = document.getElementById('parts-menu');
const parts = [...document.querySelectorAll('.part')];

function route() {
  const m = location.hash.match(/^#part-(\d)$/);
  const target = m ? `part-${m[1]}` : null;
  menu.hidden = !!target;
  for (const p of parts) p.hidden = p.id !== target;
  pauseAllPlayers();
  window.scrollTo(0, 0);
  const paper = document.querySelector('main.page');
  if (paper) paper.scrollTop = 0;
}

window.addEventListener('hashchange', route);

// "mark as read" + previous / next at the end of each part
const readInfoEls = [];
const cardBadgeEls = [];

document.querySelectorAll('.session-parts .chapter-card').forEach((card) => {
  const badge = document.createElement('span');
  badge.className = 'card-badges';
  card.appendChild(badge);
  cardBadgeEls.push(badge);
});

parts.forEach((p, i) => {
  // previous / next line first
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

  // mark-as-read + "read by" beneath the line
  const readRow = document.createElement('p');
  readRow.className = 'read-row';

  const readBtn = document.createElement('button');
  readBtn.type = 'button';
  readBtn.className = 'ink-btn';
  readBtn.textContent = 'Mark as read';
  readBtn.addEventListener('click', async () => {
    const c = await chooseCharacter();
    if (!c) return;
    try {
      await setDoc(doc(db, 'Session', SESSION_ID),
        { [`read_part${i + 1}_${c}`]: true }, { merge: true });
    } catch (err) {
      console.error('Failed to mark as read:', err);
      status('The archive refused the mark — check the connection.');
    }
  });

  readRow.append(readBtn);
  p.appendChild(readRow);

  const readInfo = document.createElement('span');
  readInfo.className = 'read-info';
  readInfoEls.push(readInfo);
  p.appendChild(readInfo);
});

// ---- podcast players -------------------------------------------------------

const players = [];

function pauseAllPlayers() {
  for (const a of players) a.pause();
}

for (const el of document.querySelectorAll('.player')) {
  const audio = new Audio(el.dataset.audio);
  audio.preload = 'metadata';
  players.push(audio);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ink-btn play-btn';
  btn.textContent = '▶ Listen';

  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'seek';
  seek.min = 0;
  seek.max = 100;
  seek.step = 0.1;
  seek.value = 0;
  seek.setAttribute('aria-label', 'Position in the recording');

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = '0:00';

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  btn.addEventListener('click', () => {
    if (audio.paused) {
      for (const other of players) if (other !== audio) other.pause();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', () => { btn.textContent = '⏸ Pause'; });
  audio.addEventListener('pause', () => { btn.textContent = '▶ Listen'; });

  audio.addEventListener('loadedmetadata', () => {
    time.textContent = `0:00 / ${fmt(audio.duration)}`;
  });

  let dragging = false;
  let seekPending = false;
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    // don't fight the user's thumb while dragging or mid-seek
    if (!dragging && !seekPending) seek.value = (audio.currentTime / audio.duration) * 100;
    time.textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
  });
  audio.addEventListener('seeked', () => { seekPending = false; });

  // dragging the slider seeks; playback state is left untouched
  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('pointerup', () => { dragging = false; });
  seek.addEventListener('input', () => {
    if (!audio.duration) return;
    seekPending = true;
    audio.currentTime = (seek.value / 100) * audio.duration;
  });

  audio.addEventListener('error', () => {
    btn.disabled = true;
    btn.textContent = 'Not yet recorded…';
    seek.disabled = true;
  });

  el.append(btn, seek, time);
}

// ---- overlays --------------------------------------------------------------

function openScrim(id) { document.getElementById(id).hidden = false; }
function closeScrim(id) { document.getElementById(id).hidden = true; }

for (const scrim of document.querySelectorAll('.scrim')) {
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.classList.contains('close-btn')) scrim.hidden = true;
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') for (const s of document.querySelectorAll('.scrim')) s.hidden = true;
});

// ---- part 2: object tiles --------------------------------------------------

const tileGrid = document.getElementById('tile-grid');
const tileEls = [];

OBJECTS.forEach((obj, i) => {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile';
  tile.textContent = roman(i + 1);

  // owner badge (who has taken this object) sits in the corner
  const badge = document.createElement('span');
  badge.className = 'tile-badge';
  tile.appendChild(badge);

  // clicking a tile previews the card in the popup (claim button lives there)
  tile.addEventListener('click', () => {
    openObject(i);
  });

  tile.badgeEl = badge;
  tileEls.push(tile);
  tileGrid.appendChild(tile);
});

// the object currently shown in the popup, so its claim button knows which
let currentObject = null;

function openObject(i) {
  currentObject = i;
  const art = document.getElementById('object-art');
  art.replaceChildren();
  const img = document.createElement('img');
  img.alt = '';
  img.src = OBJECTS[i].image;
  img.addEventListener('error', () => {
    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = '❦';
    img.replaceWith(glyph);
  });
  art.appendChild(img);
  openScrim('object-scrim');
}

// ---- part 3: the map -------------------------------------------------------

document.getElementById('open-map-btn').addEventListener('click', () => {
  const holder = document.getElementById('map-holder');
  holder.replaceChildren();
  const img = document.createElement('img');
  img.alt = 'The map';
  img.src = MAP_IMAGE;
  img.addEventListener('error', () => {
    const p = document.createElement('p');
    p.className = 'empty-note';
    p.textContent = 'The map has not been drawn yet…';
    img.replaceWith(p);
  });
  holder.appendChild(img);
  openScrim('map-scrim');
});

// ---- part 3: where should we go? -------------------------------------------

const CHAR_LABEL = { luna: '🌙 Luna', pip: '🍄 Pip' };

const answersEl = document.getElementById('whereto-answers');
const speakerEl = document.getElementById('whereto-speaker');
const inputEl = document.getElementById('whereto-input');
const saveBtn = document.getElementById('whereto-save');
const statusEl = document.getElementById('session-status');

let who = null;

function status(text) {
  statusEl.textContent = text;
  statusEl.hidden = !text;
}

// ask "who is this?" and resolve with 'luna', 'pip', or null if dismissed
let whoResolve = null;

function chooseCharacter() {
  return new Promise((resolve) => {
    whoResolve = resolve;
    openScrim('who-scrim');
  });
}

for (const btn of document.querySelectorAll('#who-scrim [data-char]')) {
  btn.addEventListener('click', () => {
    closeScrim('who-scrim');
    if (whoResolve) { whoResolve(btn.dataset.char); whoResolve = null; }
  });
}

document.getElementById('who-scrim').addEventListener('click', (e) => {
  if (e.target.id === 'who-scrim' && whoResolve) { whoResolve(null); whoResolve = null; }
});

// "Mark as taken" inside the object popup: the object is known, so just
// ask who, then save it (shared, live).
document.getElementById('claim-in-popup').addEventListener('click', async () => {
  if (currentObject === null) return;
  const n = currentObject + 1;
  const c = await chooseCharacter();
  if (!c) return;
  try {
    await setDoc(doc(db, 'Session', SESSION_ID), { [`object${n}_${c}`]: true }, { merge: true });
    closeScrim('object-scrim');
    status('Inscribed. ✦');
    setTimeout(() => { if (statusEl.textContent === 'Inscribed. ✦') status(''); }, 2500);
  } catch (err) {
    console.error('Failed to save object claim:', err);
    status('The archive refused the entry — check the connection.');
  }
});

inputEl.addEventListener('click', async () => {
  if (who) return;
  const c = await chooseCharacter();
  if (!c) return;
  who = c;
  speakerEl.textContent = `Answering as ${CHAR_LABEL[who]}`;
  speakerEl.hidden = false;
  inputEl.readOnly = false;
  saveBtn.hidden = false;
  inputEl.focus();
});

document.getElementById('whereto-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!who) { openScrim('who-scrim'); return; }
  const text = inputEl.value.trim();
  if (!text) return;
  try {
    await setDoc(doc(db, 'Session', SESSION_ID), { [`whereto_${who}`]: text }, { merge: true });
    inputEl.value = '';
    status('Inscribed. ✦');
    setTimeout(() => { if (statusEl.textContent === 'Inscribed. ✦') status(''); }, 2500);
  } catch (err) {
    console.error('Failed to save:', err);
    status('The archive refused the entry — check the connection.');
  }
});

// live view of both answers and of who has read each part
const CHAR_EMOJI = { luna: '🌙', pip: '🍄' };

function renderRead(data) {
  parts.forEach((_, i) => {
    const readers = ['luna', 'pip'].filter((c) => data[`read_part${i + 1}_${c}`]);
    readInfoEls[i].textContent = readers.length
      ? `Read by ${readers.map((c) => CHAR_LABEL[c]).join(' & ')}`
      : '';
    cardBadgeEls[i].textContent = readers.length
      ? `✓ ${readers.map((c) => CHAR_EMOJI[c]).join(' ')}`
      : '';
  });
}

function renderTiles(data) {
  tileEls.forEach((tile, i) => {
    const owners = ['luna', 'pip'].filter((c) => data[`object${i + 1}_${c}`]);
    tile.badgeEl.textContent = owners.map((c) => CHAR_EMOJI[c]).join('');
    tile.classList.toggle('taken', owners.length > 0);
  });
}

onSnapshot(doc(db, 'Session', SESSION_ID), (snap) => {
  const data = snap.data() || {};
  renderRead(data);
  renderTiles(data);
  answersEl.replaceChildren(...['luna', 'pip']
    .filter((c) => data[`whereto_${c}`])
    .map((c) => {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = `${CHAR_LABEL[c]}: `;
      p.append(strong, data[`whereto_${c}`]);
      return p;
    }));
}, (err) => {
  console.error('Failed to load answers:', err);
  status('The archive is unreachable — check the Firestore setup.');
});

route();
