import { ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE } from "../media.schema";
import { getImageDimensions } from "./image-dimensions";

/** 校验真实图片头，拒绝伪装成图片的文本、SVG 和截断文件。 */
export async function validateImage(file: File) {
  if (file.size === 0 || file.size > MAX_FILE_SIZE)
    throw new Error("INVALID_IMAGE_SIZE");
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type))
    throw new Error("UNSUPPORTED_IMAGE_TYPE");
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const header = String.fromCharCode(...bytes.slice(0, 12));
  const matches =
    (file.type === "image/png" && header.startsWith("\x89PNG\r\n\x1a\n")) ||
    (file.type === "image/gif" &&
      (header.startsWith("GIF87a") || header.startsWith("GIF89a"))) ||
    (file.type === "image/webp" &&
      header.startsWith("RIFF") &&
      header.slice(8) === "WEBP") ||
    ((file.type === "image/jpeg" || file.type === "image/jpg") &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff);
  if (!matches) throw new Error("INVALID_IMAGE_CONTENT");
  const dimensions = getImageDimensions(buffer);
  if (
    !dimensions ||
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    dimensions.width * dimensions.height > 100_000_000
  )
    throw new Error("INVALID_IMAGE_DIMENSIONS");
  return dimensions;
}
