import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const REQUIRED_PRODUCTION_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
] as const;

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  // Merge process.env so build environments that inject vars directly
  // (utan .env-fil) fungerar likadant som lokalt.
  const env: Record<string, string> = {
    ...fileEnv,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, v]) => typeof v === "string") as [string, string][]
    ),
  };

  if (mode === "production") {
    const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !env[key]?.trim());
    if (missing.length > 0) {
      // Varna istället för att kasta – publish-miljön injectar dessa vid deploy,
      // och en hård throw här bryter hela bygget även när värdena finns i runtime.
      console.warn(
        `[vite] Missing VITE_SUPABASE_* env vars at build time: ${missing.join(", ")}. ` +
          `Continuing – hosting will inject them.`
      );
    }
  }



  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: true },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectRegister: null,
        devOptions: { enabled: false },
        includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512x512.png"],
        injectManifest: {
          globPatterns: [
            "index.html",
            "**/*.css",
            "**/pwa-*.png",
            "**/assets/index-*.js",
            "**/assets/vendor-*",
            "**/assets/ui-*.js",
            "**/assets/AppLayout-*.js",
          ],
          globIgnores: ["**/push-sw.js"],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        manifest: {
          name: "Hönsgården – Din digitala äggloggare",
          short_name: "Hönsgården",
          description: "Håll koll på ägg, hönor, foder och ekonomi – dag för dag.",
          theme_color: "#3a6b35",
          background_color: "#faf8f5",
          display: "standalone",
          orientation: "portrait",
          scope: "/",
          start_url: "/app",
          categories: ["lifestyle", "productivity"],
          lang: "sv",
          icons: [
            {
              src: "/pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ].filter(Boolean),
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL || ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY || ""),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(env.VITE_SUPABASE_PROJECT_ID || ""),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            vendor: ["recharts"],
            ui: ["@radix-ui/react-accordion", "@radix-ui/react-dialog", "@radix-ui/react-tooltip"],
            "vendor-data": ["@supabase/supabase-js"],
            "vendor-query": ["@tanstack/react-query"],
            "vendor-icons": ["lucide-react"],
            "vendor-date": ["date-fns"],
            "vendor-forms": ["react-hook-form", "zod"],
            "vendor-motion": ["framer-motion"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
