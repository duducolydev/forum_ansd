import QRCode from "qrcode";

/**
 * Génération du visuel QR. La construction du token signé (publicId + HMAC,
 * brief §5.4) relève du module `modules/badges` (PLAN.md 3.6) : ce module ne
 * fait qu'encoder une chaîne en image, il ne connaît pas le format du token.
 */
export async function generateQrPngBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 512 });
}

export async function generateQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { errorCorrectionLevel: "M", margin: 1 });
}
