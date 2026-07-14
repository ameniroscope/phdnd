// Inventory & spell lists for a character page, stored in Firestore.
//
// Data model: one collection per box, one document per character, one field
// per item — the field value is a server timestamp used for ordering:
//   Inventory/{character} -> { "Smoking grimoire": <ts>, ... }
//   Spells/{character}    -> { "Soothing Spores": <ts>, ... }
//
// The page must set data-character="pip" (etc.) on <main>, and contain for
// each box: <ul data-box="inventory"> plus a <form data-box="inventory">.

import { db } from './firebase.js';
import {
  doc, onSnapshot, setDoc, deleteField, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const COLLECTIONS = { inventory: 'Inventory', spells: 'Spells' };

const character = document.querySelector('main[data-character]').dataset.character;

const items = { inventory: [], spells: [] };
const loaded = { inventory: false, spells: false };

function boxDoc(box) {
  return doc(db, COLLECTIONS[box], character);
}

// ---- UI ------------------------------------------------------------------

function render(box) {
  const list = document.querySelector(`ul[data-box="${box}"]`);

  list.replaceChildren(...items[box].map((text) => {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.textContent = text;

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '✕';
    remove.title = 'Remove';
    remove.addEventListener('click', () => {
      setDoc(boxDoc(box), { [text]: deleteField() }, { merge: true })
        .catch(showSaveError);
    });

    li.append(span, remove);
    return li;
  }));

  if (items[box].length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = loaded[box] ? 'Nothing here yet…' : 'Consulting the archive…';
    list.appendChild(li);
  }
}

function showError(message) {
  for (const box of ['inventory', 'spells']) {
    const list = document.querySelector(`ul[data-box="${box}"]`);
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = message;
    list.replaceChildren(li);
  }
}

function showSaveError(err) {
  console.error('Failed to save:', err);
  showError('The archive refused the entry — check the connection.');
}

for (const form of document.querySelectorAll('form[data-box]')) {
  const box = form.dataset.box;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    setDoc(boxDoc(box), { [text]: serverTimestamp() }, { merge: true })
      .catch(showSaveError);
    input.value = '';
  });
  render(box);
}

// Live sync: re-render whenever a document changes (including changes made
// by the other player on their own device). Items keep insertion order via
// their timestamp value; just-added items (timestamp still pending) go last.
for (const box of ['inventory', 'spells']) {
  onSnapshot(boxDoc(box), (snap) => {
    loaded[box] = !(snap.metadata.fromCache && !snap.exists());
    const data = snap.data() || {};
    items[box] = Object.entries(data)
      .sort((a, b) => {
        const ta = a[1] && a[1].seconds !== undefined ? a[1].seconds : Infinity;
        const tb = b[1] && b[1].seconds !== undefined ? b[1].seconds : Infinity;
        return ta - tb;
      })
      .map(([name]) => name);
    render(box);
  }, (err) => {
    console.error('Failed to load:', err);
    showError('The archive is unreachable — check the Firestore setup.');
  });
}
