import sharp from "sharp";

/** Process an uploaded photo to JPEG, cropped 3:4, <200KB, returns base64 data URL. */
export async function processPhoto(buffer: Buffer): Promise<string> {
  const out = sharp(buffer, { failOn: "none" }).rotate()
    .resize({ width: 600, height: 800, fit: "cover", position: sharp.gravity.center });

  let result: Buffer;
  for (const quality of [82, 70, 60, 50]) {
    const buf = await out.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (buf.length <= 200_000 || quality === 50) {
      result = buf;
      break;
    }
  }

  return `data:image/jpeg;base64,${result!.toString("base64")}`;
}