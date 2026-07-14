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

// The six discovery tiles. Fill these in as objects get revealed:
// put images in assets/objects/ (a missing image shows an ornament instead).
const OBJECTS = [
  { name: 'A first curiosity', image: 'assets/objects/1.png', text: 'To be revealed…' },
  { name: 'A second curiosity', image: 'assets/objects/2.png', text: 'To be revealed…' },
  { name: 'A third curiosity', image: 'assets/objects/3.png', text: 'To be revealed…' },
  { name: 'A fourth curiosity', image: 'assets/objects/4.png', text: 'To be revealed…' },
  { name: 'A fifth curiosity', image: 'assets/objects/5.png', text: 'To be revealed…' },
  { name: 'A sixth curiosity', image: 'assets/objects/6.png', text: 'To be revealed…' }
];

const MAP_IMAGE = 'assets/map.jpg';

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

  const track = document.createElement('div');
  track.className = 'track';
  const fill = document.createElement('div');
  fill.className = 'fill';
  track.appendChild(fill);

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
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) fill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
  });
  audio.addEventListener('error', () => {
    btn.disabled = true;
    btn.textContent = 'Not yet recorded…';
  });

  track.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const r = track.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  el.append(btn, track);
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

OBJECTS.forEach((obj, i) => {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'tile';
  tile.textContent = roman(i + 1);
  tile.addEventListener('click', () => {
    const art = document.getElementById('object-art');
    art.replaceChildren();
    const img = document.createElement('img');
    img.alt = '';
    img.src = obj.image;
    img.addEventListener('error', () => {
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = '❦';
      img.replaceWith(glyph);
    });
    art.appendChild(img);
    document.getElementById('object-title').textContent = obj.name;
    document.getElementById('object-text').textContent = obj.text;
    openScrim('object-scrim');
  });
  tileGrid.appendChild(tile);
});

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

inputEl.addEventListener('click', () => {
  if (!who) openScrim('who-scrim');
});

for (const btn of document.querySelectorAll('#who-scrim [data-char]')) {
  btn.addEventListener('click', () => {
    who = btn.dataset.char;
    speakerEl.textContent = `Answering as ${CHAR_LABEL[who]}`;
    speakerEl.hidden = false;
    inputEl.readOnly = false;
    saveBtn.hidden = false;
    closeScrim('who-scrim');
    inputEl.focus();
  });
}

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

// live view of both answers
onSnapshot(doc(db, 'Session', SESSION_ID), (snap) => {
  const data = snap.data() || {};
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
