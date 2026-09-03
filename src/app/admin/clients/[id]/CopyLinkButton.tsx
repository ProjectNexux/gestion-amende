"use client";

import { Copy } from "lucide-react";

export function CopyLinkButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(url);
        (e.currentTarget as HTMLButtonElement).innerText = "Lien copié";
        setTimeout(() => { (e.currentTarget as HTMLButtonElement).innerText = "Copier le lien"; }, 1500);
      }}
    >
      <Copy size={14} /> Copier le lien
    </button>
  );
}
