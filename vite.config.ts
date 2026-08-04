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

// These values are intentionally public client configuration. Supabase anon keys
// are shipped to every browser; security is enforced by RLS, not by hiding them.
// The fallback prevents a blank production app if the hosting build omits Vite envs.
const DEFAULT_SUPABASE_URL = "https://sikbymtrbhrofysgkqsj.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa2J5bXRyYmhyb2Z5c2drcXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQ0MjAsImV4cCI6MjA4ODI0MDQyMH0.SlgJoYwkD5GWeZ2mK-GihDvEWpt8noKWE8xulzSOqaU";
const DEFAULT_SUPABASE_PROJECT_ID = "sikbymtrbhrofysgkqsj";

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const env: Record<string, string> = {
    ...fileEnv,
    ...Object.fromEntries(
      Object.entries(process.env).filter(([, value]) => typeof value === "string") as [string, string][]
    ),
  };

  if (mode === "production") {
    const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !env[key]?.trim());
    if (missing.length > 0) {
      console.warn(
        `[vite] Missing build-time variables: ${missing.join(", ")}. ` +
          "Using the public Hönsgården Supabase client fallback to keep the app bootable."
      );
    }
  }

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const supabaseProjectId =
    env.VITE_SUPABASE_PROJECT_ID?.trim() || DEFAULT_SUPABASE_PROJECT_ID;

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
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
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