"use client";

import { useState } from "react";
import { DocumentViewerModal } from "@/components/DocumentViewerModal";

/** Generic trigger that opens the shared document viewer for any file served by a fileUrl/downloadUrl pair. */
export function DocumentViewerTrigger({
  fileUrl,
  downloadUrl,
  fileName,
  fileMime,
  className,
  title,
  children,
}: {
  fileUrl: string;
  downloadUrl: string;
  fileName: string;
  fileMime: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} title={title}>
        {children}
      </button>
      {open && (
        <DocumentViewerModal
          open
          onClose={() => setOpen(false)}
          fileUrl={fileUrl}
          downloadUrl={downloadUrl}
          fileName={fileName}
          fileMime={fileMime}
          expanded={expanded}
          onToggleExpand={() => setExpanded((v) => !v)}
        />
      )}
    </>
  );
}
