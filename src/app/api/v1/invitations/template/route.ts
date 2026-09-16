import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

// Modèle téléchargeable (brief §5.5). Aucune donnée sensible : accessible sans
// authentification (c'est un simple gabarit de colonnes).
export async function GET() {
  const worksheet = XLSX.utils.json_to_sheet([
    {
      email: "prenom.nom@institution.sn",
      prenom: "Prénom",
      nom: "Nom",
      organisation: "Organisation (optionnel)",
      pays: "Pays (optionnel)",
      categorie: "PARTICIPANT_INTERNATIONAL",
    },
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invitations");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-invitations.xlsx"',
    },
  });
}
