// Current Session page, stored in Firestore.
//
// Data model: collection "Session", one document per session number, one
// field per answer:
//   Session/3 -> { recap: "...", quests: "...", notes: "..." }
//
// Every field in the document is rendered as an editable section. The three
// default fields get friendly headings; any extra field added in the Firebase
// console appears automatically with its own name as the heading.

import { db } from './firebase.js';
import {
  collection, doc, getDocs, onSnapshot, setDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const LABELS = {
  recap: 'Where we left off',
  quests: 'Open quests',
  notes: 'Notes & rumours'
};
const DEFAULT_FIELDS = ['recap', 'quests', 'notes'];

const titleEl = document.getElementById('session-title');
const statusEl = document.getElementById('session-status');
const fieldsEl = document.getElementById('session-fields');
const actionsEl = document.getElementById('session-actions');
const saveBtn = document.getElementById('save-btn');
const nextBtn = document.getElementById('new-session-btn');
const navEl = document.getElementById('session-nav');
const prevLink = document.getElementById('prev-session');
const nextLink = document.getElementById('next-session');

let sessionIds = []; // numbers, ascending
let current = null;
let unsubscribe = null;

function roman(n) {
  const table = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

function status(text) {
  statusEl.textContent = text;
  statusEl.hidden = !text;
}

function fieldLabel(name) {
  return LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

function renderFields(data) {
  const names = [
    ...DEFAULT_FIELDS,
    ...Object.keys(data).filter((k) => !DEFAULT_FIELDS.includes(k)).sort()
  ];

  for (const name of names) {
    let area = fieldsEl.querySelector(`textarea[data-field="${name}"]`);
    if (!area) {
      const h2 = document.createElement('h2');
      h2.textContent = fieldLabel(name);
      area = document.createElement('textarea');
      area.className = 'field-input';
      area.dataset.field = name;
      area.placeholder = 'To be inscribed…';
      fieldsEl.append(h2, area);
    }
    // don't clobber what someone is typing right now
    if (document.activeElement !== area) area.value = data[name] || '';
  }
}

function show(n) {
  current = n;
  if (unsubscribe) unsubscribe();
  fieldsEl.replaceChildren();
  titleEl.textContent = `Session ${roman(n)}`;
  status('Consulting the archive…');

  unsubscribe = onSnapshot(doc(db, 'Session', String(n)), (snap) => {
    status('');
    renderFields(snap.data() || {});
    actionsEl.hidden = false;
    updateNav();
  }, (err) => {
    console.error('Failed to load:', err);
    status('The archive is unreachable — check the Firestore setup.');
  });
}

function updateNav() {
  const i = sessionIds.indexOf(current);
  navEl.hidden = sessionIds.length < 2;
  prevLink.style.visibility = i > 0 ? 'visible' : 'hidden';
  nextLink.style.visibility = i >= 0 && i < sessionIds.length - 1 ? 'visible' : 'hidden';
  if (i > 0) prevLink.href = `#session-${sessionIds[i - 1]}`;
  if (i < sessionIds.length - 1) nextLink.href = `#session-${sessionIds[i + 1]}`;
  nextBtn.hidden = current !== sessionIds[sessionIds.length - 1];
}

async function save() {
  const data = {};
  for (const area of fieldsEl.querySelectorAll('textarea[data-field]')) {
    data[area.dataset.field] = area.value;
  }
  try {
    await setDoc(doc(db, 'Session', String(current)), data, { merge: true });
    status('Inscribed. ✦');
    setTimeout(() => { if (statusEl.textContent === 'Inscribed. ✦') status(''); }, 2500);
  } catch (err) {
    console.error('Failed to save:', err);
    status('The archive refused the entry — check the connection.');
  }
}

async function beginSession(n) {
  try {
    await setDoc(doc(db, 'Session', String(n)), { recap: '', quests: '', notes: '' }, { merge: true });
    if (!sessionIds.includes(n)) sessionIds.push(n);
    location.hash = `#session-${n}`;
  } catch (err) {
    console.error('Failed to create session:', err);
    status('The archive refused the new session — check the connection.');
  }
}

function route() {
  const m = location.hash.match(/^#session-(\d+)$/);
  if (m && sessionIds.includes(Number(m[1]))) show(Number(m[1]));
  else if (sessionIds.length > 0) show(sessionIds[sessionIds.length - 1]);
  else {
    titleEl.textContent = 'Current Session';
    status('No session has been recorded yet.');
    actionsEl.hidden = false;
    saveBtn.hidden = true;
    nextBtn.hidden = false;
    nextBtn.textContent = 'Begin Session I';
  }
}

saveBtn.addEventListener('click', save);
nextBtn.addEventListener('click', () => {
  const next = sessionIds.length > 0 ? sessionIds[sessionIds.length - 1] + 1 : 1;
  beginSession(next);
});
window.addEventListener('hashchange', route);

(async function init() {
  try {
    const snap = await getDocs(collection(db, 'Session'));
    sessionIds = snap.docs.map((d) => Number(d.id))
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => a - b);
  } catch (err) {
    console.error('Failed to list sessions:', err);
    status('The archive is unreachable — check the Firestore setup.');
    return;
  }
  route();
})();
