import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { generateTotpSecret, totpKeyUri } from "@/lib/totp";
import { generateQrDataUrl } from "@/lib/qr";
import { EnrollForm } from "./enroll-form";

export default async function TotpEnrollPage() {
  const session = await auth();
  // Le middleware redirige déjà les visiteurs non connectés ; cette page ne le
  // suppose pas pour autant. Une page d'authentification qui part du principe
  // qu'une garde en amont a bien fonctionné plante en 500 le jour où elle
  // s'applique mal — c'est exactement ce qui est arrivé.
  const email = session?.user?.email;
  if (!email) redirect("/connexion");
  // Un second facteur actif ne se remplace pas ici, même depuis une session
  // valide : c'est un gestionnaire des comptes qui le réinitialise (§18).
  // `totpEnabled` est relu en base par la revalidation de la session.
  if (session.user.totpEnabled) redirect("/admin");
  const secret = generateTotpSecret();
  const qrDataUrl = await generateQrDataUrl(totpKeyUri(email, secret));

  return (
    <div className="border-border bg-surface mx-auto max-w-md rounded-xl border p-6">
      <h2 className="mb-2 text-2xl">Activer la vérification en deux étapes</h2>
      <p className="text-text-2 mb-6">
        Obligatoire pour votre rôle (brief §7). Scannez ce code avec une application
        d&apos;authentification (Google Authenticator, Authy…) puis saisissez le code à 6 chiffres
        généré.
      </p>
      {/* Image générée localement (data URI) : next/image n'apporte rien ici. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="QR code d'activation TOTP" className="mx-auto mb-4 h-48 w-48" />
      <p className="text-text-3 mb-4 text-center text-sm break-all">{secret}</p>
      <EnrollForm secret={secret} />
    </div>
  );
}
