export async function compactPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 18000000)
    throw new Error("Välj en bild under 18 MB.");
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 720 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Bilden kunde inte läsas.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.75, 0.55, 0.35]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= 260000) return data;
    }
    throw new Error("Välj en mindre bild.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
