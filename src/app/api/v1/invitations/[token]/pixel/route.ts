import { NextResponse } from "next/server";
import { markOpened } from "@/modules/invitations/service";

// GIF transparent 1×1 (brief §5.5 : pixel de suivi d'ouverture).
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await markOpened(token).catch(() => undefined);

  return new NextResponse(new Uint8Array(TRANSPARENT_GIF), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}
