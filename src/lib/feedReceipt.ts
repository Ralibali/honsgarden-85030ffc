import { isIsoDay } from "./isoDay";

export function readReceiptFields(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const product = lines.find((line) =>
    /foder|värppellets|värpmjöl|kycklingstart/i.test(line)
  );
  const kg = product?.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)?.[1];
  const costLine = lines.find((line) =>
    /^(?:total(?:t)?(?:\s+(?:sek|kr))?|att betala|summa att betala)\b/i.test(
      line
    )
  );
  const cost = costLine?.match(
    /(\d[\d\s]*[,.]\d{2}|\d+)\s*(?:kr|sek)?\s*$/i
  )?.[1];
  const day = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  return {
    name: product?.slice(0, 160),
    kg: kg?.replace(",", "."),
    cost: cost?.replace(/\s/g, "").replace(",", "."),
    day: day && isIsoDay(day) ? day : undefined,
  };
}

export async function scanFeedReceipt(file: File) {
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Välj en kvittobild mindre än 15 MB.");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("swe", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-lstm.wasm.js",
    langPath: "/ocr",
    workerBlobURL: false,
  });
  try {
    const result = await worker.recognize(file);
    return readReceiptFields(result.data.text);
  } finally {
    await worker.terminate();
  }
}
