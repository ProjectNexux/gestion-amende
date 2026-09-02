"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/**
 * Confirmation dialog shown before any manual "Transmettre à la comptabilité" / "Renvoyer" send —
 * nothing is sent until the user explicitly clicks "Envoyer" inside the modal (Annuler just closes
 * it, no server call at all). `action` is a bound Server Action (the same one used everywhere
 * else for this send), so the actual e-mail sending always stays server-side.
 */
export function ComptabiliteSendModal({
  triggerLabel,
  documentLabel,
  recipients,
  subject,
  message,
  attachmentName,
  action,
}: {
  triggerLabel: string;
  documentLabel: string;
  recipients: string[];
  subject: string;
  message: string;
  attachmentName: string;
  action: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary">
        <Send size={15} /> {triggerLabel}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Transmettre à la comptabilité"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Annuler
            </button>
            <form action={action}>
              <button type="submit" className="btn-primary">
                Envoyer
              </button>
            </form>
          </>
        }
      >
        <div className="space-y-3">
          <div><span className="font-medium text-slate-500">Document : </span>{documentLabel}</div>
          <div>
            <span className="font-medium text-slate-500">Destinataires :</span>
            <ul className="mt-1 list-disc pl-5 text-slate-800">
              {recipients.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <div><span className="font-medium text-slate-500">Objet : </span>{subject}</div>
          <div>
            <span className="font-medium text-slate-500">Message :</span>
            <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-xs text-slate-700">{message}</pre>
          </div>
          <div><span className="font-medium text-slate-500">Pièce jointe : </span>{attachmentName}</div>
        </div>
      </Modal>
    </>
  );
}
