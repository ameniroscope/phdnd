// Inventory & spell lists for a character page, stored in Firestore.
// The page must set data-character="pip" (etc.) on <main>, and contain for
// each box: <ul data-box="inventory"> plus a <form data-box="inventory">.
//
// Data shape: one document per character —
//   characters/{character} -> { inventory: [...], spells: [...] }

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js';
import {
  getFirestore, doc, onSnapshot, setDoc
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBgk13iR_I0ID48WgoX9MBLg2PoTlrgg0s",
  authDomain: "phdnd-podcast.firebaseapp.com",
  projectId: "phdnd-podcast",
  storageBucket: "phdnd-podcast.firebasestorage.app",
  messagingSenderId: "80092982584",
  appId: "1:80092982584:web:f112fc160bde43abaee5cd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const character = document.querySelector('main[data-character]').dataset.character;
const charDoc = doc(db, 'characters', character);

const items = { inventory: [], spells: [] };
let loaded = false;

// ---- UI ------------------------------------------------------------------

function render(box) {
  const list = document.querySelector(`ul[data-box="${box}"]`);

  list.replaceChildren(...items[box].map((text, i) => {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.textContent = text;

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '✕';
    remove.title = 'Remove';
    remove.addEventListener('click', () => {
      items[box].splice(i, 1);
      save(box);
      render(box);
    });

    li.append(span, remove);
    return li;
  }));

  if (items[box].length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = loaded ? 'Nothing here yet…' : 'Consulting the archive…';
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

function save(box) {
  setDoc(charDoc, { [box]: items[box] }, { merge: true })
    .catch((err) => {
      console.error('Failed to save:', err);
      showError('The archive refused the entry — check the connection.');
    });
}

for (const form of document.querySelectorAll('form[data-box]')) {
  const box = form.dataset.box;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    items[box].push(text);
    save(box);
    input.value = '';
    render(box);
  });
  render(box);
}

// Live sync: re-render whenever the document changes (including changes
// made by the other player on their own device).
onSnapshot(charDoc, (snap) => {
  loaded = true;
  const data = snap.data() || {};
  items.inventory = data.inventory || [];
  items.spells = data.spells || [];
  render('inventory');
  render('spells');
}, (err) => {
  console.error('Failed to load:', err);
  showError('The archive is unreachable — check the Firestore setup.');
});
