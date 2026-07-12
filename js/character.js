// Inventory & spell lists for a character page.
// The page must set data-character="pip" (etc.) on <main>, and contain for
// each box: <ul data-box="inventory"> plus a <form data-box="inventory">.

// ---- Storage layer -------------------------------------------------------
// Currently localStorage (per-browser). To move to Firebase, replace these
// two functions with Firestore reads/writes, e.g. a document per character:
//   characters/{character} -> { inventory: [...], spells: [...] }
// and call render() again after the data arrives.

function loadItems(character, box) {
  try {
    return JSON.parse(localStorage.getItem(`phdnd-${character}-${box}`)) || [];
  } catch {
    return [];
  }
}

function saveItems(character, box, items) {
  localStorage.setItem(`phdnd-${character}-${box}`, JSON.stringify(items));
}

// ---- UI ------------------------------------------------------------------

const character = document.querySelector('main[data-character]').dataset.character;

function render(box) {
  const list = document.querySelector(`ul[data-box="${box}"]`);
  const items = loadItems(character, box);

  list.replaceChildren(...items.map((text, i) => {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.textContent = text;

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '✕';
    remove.title = 'Remove';
    remove.addEventListener('click', () => {
      items.splice(i, 1);
      saveItems(character, box, items);
      render(box);
    });

    li.append(span, remove);
    return li;
  }));

  if (items.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Nothing here yet…';
    list.appendChild(li);
  }
}

for (const form of document.querySelectorAll('form[data-box]')) {
  const box = form.dataset.box;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    const items = loadItems(character, box);
    items.push(text);
    saveItems(character, box, items);
    input.value = '';
    render(box);
  });
  render(box);
}
