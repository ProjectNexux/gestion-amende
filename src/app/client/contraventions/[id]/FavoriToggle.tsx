"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavoriAction } from "../../actions";

export function FavoriToggle({ itemId, initialFavori }: { itemId: string; initialFavori: boolean }) {
  const [favori, setFavori] = useState(initialFavori);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !favori;
          setFavori(next);
          await toggleFavoriAction("contravention", itemId, next);
        })
      }
      title={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
      className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 disabled:opacity-50"
    >
      <Star size={18} className={favori ? "fill-amber-400 text-amber-500" : ""} />
    </button>
  );
}
