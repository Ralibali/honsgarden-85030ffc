import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./mobile.css";
import "./landing-hero.css";
import "./honsgarden-home-v2.css";
import "./honsgarden-home-v2-component.css";
import "./honsgarden-app-v2.css";
import "./honsgarden-core-v3.css";
import "./honsgarden-yard-v3.css";
import "./honsgarden-egg-v3.css";
import "./honsgarden-delight-v4.css";
import "./honsgarden-sales-v4.css";
import "./honsgarden-agda-v4.css";
import "./honsgarden-insights-v4.css";
import "./honsgarden-conversion-v5.css";
import "./honsgarden-routines-v5.css";
import "./honsgarden-settings-v5.css";
import "./i18n"; // initierar i18next (sv + en) före render
import { installGlobalErrorHandlers } from "@/lib/errorLogger";
import { isStandalonePwa, recoverStalePwaShell } from "@/lib/pwaUpdate";

// Restore theme preference before render to avoid flash
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const key = 'chunk_reload_attempted_v1';
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, Date.now().toString());
    if (isStandalonePwa()) {
      void recoverStalePwaShell('preload-error');
    } else {
      window.location.reload();
    }
  }
});

// Rensa flaggan efter lyckad mount så nästa session inte tror att
// det redan reloadats
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem('chunk_reload_attempted_v1'), 5000);
});

// Fånga oinfångade fel och unhandled promise-rejections innan render
installGlobalErrorHandlers();

const root = document.getElementById("root")!;

if (root.hasChildNodes()) {
  hydrateRoot(root, <App />);
} else {
  createRoot(root).render(<App />);
}
