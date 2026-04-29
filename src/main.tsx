import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./mobile.css";
import { installGlobalErrorHandlers } from "@/lib/errorLogger";

// Restore theme preference before render to avoid flash
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

// Fånga oinfångade fel och unhandled promise-rejections innan render
installGlobalErrorHandlers();

const root = document.getElementById("root")!;

if (root.hasChildNodes()) {
  hydrateRoot(root, <App />);
} else {
  createRoot(root).render(<App />);
}
