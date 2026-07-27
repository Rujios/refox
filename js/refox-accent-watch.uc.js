// ==UserScript==
// @name           Refox Accent Watch
// @description    Watches Matugen/Pywal colors.json and hot-reloads Zen accent colors.
// @author         ADIOR-enigma (Sine port)
// @include        main
// @grant          none
// ==/UserScript==

(function () {
  const PREF_PATH = "refox.accent-watch.colors-path";
  const PREF_POLL = "refox.accent-watch.poll-ms";
  const PREF_OPACITY = "refox.accent-watch.opacity";
  const STYLE_ID = "wal-theme";

  let last = 0;
  let cache = {};
  let pollTimer = null;

  const CSS = `
:root {
  --zen-primary-color: var(--zen-accent-primary) !important;
}

// #navigator-toolbox {
//   background: color-mix(in srgb, var(--zen-background) var(--zen-opacity, 100%), transparent) !important;
// }

// #zen-appcontent-wrapper {
//   background: color-mix(in srgb, var(--zen-background) var(--zen-opacity, 100%), transparent) !important;
// }
#browser {
  background: color-mix(in srgb, var(--zen-background) var(--zen-opacity, 100%), transparent) !important;
}

#tabbrowser-tabs .tabbrowser-tab[selected] .tab-background {
  background: var(--zen-accent-secondary) !important;
}
zen-folder {
  --zen-folder-stroke: var(--zen-accent-color10) !important;
}

menu:is(:hover, [_moz-menuactive="true"]):not([disabled]),
menuitem:is(:hover, [_moz-menuactive="true"]):not([disabled]) {
  background-color: color-mix(in srgb, var(--zen-accent-primary) 20%, transparent) !important;
  color: var(--zen-accent-color10) !important;
}

menuitem {
  color: color-mix(in srgb, var(--zen-text) 40%, transparent) !important;
}

toolbar .toolbarbutton-1:not([disabled]):is([open], [checked]) {
  fill: var(--zen-accent-color10) !important;
}

toolbar .toolbarbutton-1 > .toolbarbutton-icon {
  fill: var(--zen-accent-color10) !important;
}

#PanelUI-menu-button .toolbarbutton-icon,
#downloads-button .toolbarbutton-icon,
#unified-extensions-button .toolbarbutton-icon {
  fill: var(--zen-accent-color10) !important;
  color: var(--zen-accent-color10) !important;
}
`;

  function defaultColorsPath() {
    try {
      const home = Services.dirsvc.get("Home", Ci.nsIFile).path;
      return PathUtils.join(home, ".cache", "wal", "colors.json");
    } catch {
      // Fallback for older platforms without PathUtils.join
      return "";
    }
  }

  function getColorsPath() {
    try {
      const custom = Services.prefs.getStringPref(PREF_PATH, "");
      if (custom && custom.trim()) return custom.trim();
    } catch {}
    return defaultColorsPath();
  }

  function getPollMs() {
    try {
      return Services.prefs.getIntPref(PREF_POLL, 800);
    } catch {
      return 800;
    }
  }

  function getOpacity() {
    try {
      return Services.prefs.getIntPref(PREF_OPACITY, 100);
    } catch {
      return 100;
    }
  }

  function ensureStyleElement() {
    let style = document.getElementById(STYLE_ID);

    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.documentElement.appendChild(style);
    }

    if (style.textContent !== CSS) {
      style.textContent = CSS;
    }
  }

  function applyTheme(c) {
    const root = document.documentElement;

    // Avoid redundant reapply
    if (
      cache.color0 === c.color0 &&
      cache.color3 === c.color3 &&
      cache.color5 === c.color5 &&
      cache.color10 === c.color10 &&
      cache.color15 === c.color15
    ) {
      return;
    }
    cache = { ...c };

    // Core mapping
    root.style.setProperty("--zen-accent-primary", c.color3, "important");
    root.style.setProperty("--zen-accent-secondary", c.color5, "important");
    root.style.setProperty("--zen-background", c.color0, "important");
    root.style.setProperty("--zen-text", c.color15, "important");
    root.style.setProperty("--zen-text-focus", "#ffffff", "important");
    root.style.setProperty("--zen-primary-color", c.color3, "important");
    root.style.setProperty("--zen-accent-color10", c.color10, "important");
    root.style.setProperty("--zen-opacity", getOpacity() + "%", "important");

    ensureStyleElement();
  }

  async function readTheme(force = false) {
    const path = getColorsPath();
    if (!path) return;

    try {
      const stat = await IOUtils.stat(path);

      if (!force && stat.lastModified === last) return;
      last = stat.lastModified;

      const data = JSON.parse(await IOUtils.readUTF8(path));
      if (!data.colors) return;

      applyTheme(data.colors);
    } catch {
      // File missing or unreadable — silently wait for it to appear.
    }
  }

  function restartPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => readTheme(), getPollMs());
  }

  // Wait for Zen UI
  function waitForZen() {
    const interval = setInterval(() => {
      if (
        document.querySelector("zen-workspace") ||
        document.querySelector("#zen-appcontent-wrapper")
      ) {
        clearInterval(interval);

        // Multi-pass apply (handles lazy UI)
        readTheme(true);
        setTimeout(() => readTheme(true), 300);
        setTimeout(() => readTheme(true), 1000);

        restartPolling();
      }
    }, 100);
  }

  waitForZen();

  // React live if the user changes settings in Sine's preferences panel.
  Services.prefs.addObserver(PREF_PATH, () => readTheme(true));
  Services.prefs.addObserver(PREF_POLL, restartPolling);
  Services.prefs.addObserver(PREF_OPACITY, () => readTheme(true));
})();
