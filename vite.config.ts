import { defineConfig, loadEnv } from "vite";
import { execFileSync } from "node:child_process";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
      { name: "owned-editorial-prerender", apply: "build" as const, enforce: "post" as const, closeBundle() {
        execFileSync(process.execPath, ["scripts/prerender-blog-posts.mjs"], { cwd: process.cwd(), stdio: "inherit" });
      } },
      mode === "development" && componentTagger(),
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
            // Do not isolate lucide-react. Each icon file is `export { Icon as default }`
            // and the barrel re-exports `export { default as Icon }`. Putting only the
            // package entry in vendor-icons makes the ui chunk read `undefined.default`
            // at runtime (QA crash on /app after signup).
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