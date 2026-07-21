// browser-shim.js
// Oferă un window.focusAPI atunci când aplicația rulează în browser
// (ex. GitHub Pages), unde Electron / preload.js NU există.
// Datele se salvează în localStorage în loc de electron-store.
// Dacă focusAPI există deja (rulăm în Electron), nu se schimbă nimic.

if (!window.focusAPI) {
  const PREFIX = 'focushub:';

  window.focusAPI = {
    // --- Persistență (aceeași semnătură async ca în Electron) ---
    get: (key) => {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        // electron-store returnează obiecte JS deja parsate,
        // deci reproducem același comportament.
        return Promise.resolve(raw == null ? undefined : JSON.parse(raw));
      } catch (e) {
        console.warn('focusAPI.get eșuat pentru', key, e);
        return Promise.resolve(undefined);
      }
    },

    set: (key, value) => {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) {
        console.warn('focusAPI.set eșuat pentru', key, e);
      }
      return Promise.resolve();
    },

    delete: (key) => {
      localStorage.removeItem(PREFIX + key);
      return Promise.resolve();
    },

    // --- Controale de fereastră: în browser nu au sens, deci sunt goale ---
    minimize: () => {},
    close: () => {},
    togglePin: () => {},
  };

  console.info('FocusHub rulează în browser (focusAPI pe localStorage).');
}