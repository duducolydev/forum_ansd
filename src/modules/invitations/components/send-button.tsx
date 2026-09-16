"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { sendInvitationAction } from "../actions";

export function SendButton({ invitationId, label }: { invitationId: string; label: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Bouton
        ton="discret"
        taille="petit"
        icone={Send}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await sendInvitationAction(invitationId);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {label}
      </Bouton>
      {error && <p className="text-danger-text text-xs">{error}</p>}
    </div>
  );
}
