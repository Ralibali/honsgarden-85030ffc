import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const root = new URL("../packages/app-foundation/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", root), "utf8"),
);
for (const [file, expected] of Object.entries(manifest.files)) {
  const actual = createHash("sha256").update(
    await readFile(new URL(file, root)),
  ).digest("hex");
  if (actual !== expected) {
    throw new Error(
      `Shared component drift: ${file}. Update the common package in both repositories.`,
    );
  }
}
console.log(`app-foundation ${manifest.version}: shared components verified`);
