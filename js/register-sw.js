/* Registers the PhDnD service worker so the site is installable and works
   offline. Loaded on every top-level page. Registering 'sw.js' relatively
   keeps the scope at the site root and survives subpath hosting. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('PhDnD service worker registration failed:', err);
    });
  });
}
