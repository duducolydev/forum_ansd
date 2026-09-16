"use client";

import { Crown } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDelegationHeadAction } from "../actions";

export function SetHeadButton({
  delegationId,
  participantId,
  isHead,
}: {
  delegationId: string;
  participantId: string;
  isHead: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (isHead) {
    return <span className="text-accent-text text-xs font-semibold">Chef de délégation</span>;
  }

  return (
    <Bouton
      ton="discret"
      taille="petit"
      icone={Crown}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setDelegationHeadAction(delegationId, participantId);
          router.refresh();
        })
      }
    >
      Désigner chef
    </Bouton>
  );
}
