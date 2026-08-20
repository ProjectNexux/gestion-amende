import QRCode from "qrcode";

/** Renders a payment link as a QR code data URI (PNG) — purely a convenience for in-person scanning. */
export async function generatePaymentQrCode(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 1, width: 220 });
}
