"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  className?: string;
};

/**
 * Password input with an accessible show/hide toggle — masked by default, never mutates the
 * field's value/selection when toggling (only the `type` attribute changes). Drop-in
 * replacement for `<input type="password" />` everywhere a password/code is entered.
 */
export function PasswordField({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  const describedById = useId();

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("field pr-10", className)}
        aria-describedby={describedById}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 transition hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      <span id={describedById} className="sr-only">
        {visible ? "Mot de passe visible" : "Mot de passe masqué"}
      </span>
    </div>
  );
}
