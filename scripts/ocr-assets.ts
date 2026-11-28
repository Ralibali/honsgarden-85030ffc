import type { Plugin } from "vite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const assets: Record<string, string> = {
  "worker.min.js": "tesseract.js/dist/worker.min.js",
  "tesseract-core-lstm.wasm.js":
    "tesseract.js-core/tesseract-core-lstm.wasm.js",
  "swe.traineddata.gz":
    "@tesseract.js-data/swe/4.0.0_best_int/swe.traineddata.gz",
};
export function receiptOcrAssets(): Plugin {
  return {
    name: "receipt-ocr-assets",
    configureServer(server) {
      server.middlewares.use("/ocr", (request, response, next) => {
        const name = (request.url ?? "").split("?")[0].slice(1);
        if (!Object.hasOwn(assets, name)) return next();
        response.setHeader(
          "Content-Type",
          name.endsWith(".js")
            ? "application/javascript"
            : "application/octet-stream"
        );
        response.end(readFileSync(require.resolve(assets[name])));
      });
    },
    generateBundle() {
      for (const [name, from] of Object.entries(assets)) {
        this.emitFile({
          type: "asset",
          fileName: "ocr/" + name,
          source: readFileSync(require.resolve(from)),
        });
      }
    },
  };
}
