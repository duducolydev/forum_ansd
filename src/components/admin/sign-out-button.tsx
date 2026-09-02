"use client";

import { signOutAction } from "./actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-dark-panel-muted w-full rounded-lg px-2.5 py-2.5 text-left text-[0.88rem] hover:bg-white/8 hover:text-white"
      >
        Se déconnecter
      </button>
    </form>
  );
}
