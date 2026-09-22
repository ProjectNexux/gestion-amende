import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";

import { classifyDocument } from "./document-classifier";
import { groupScansByBundle, mergePdfBuffers } from "./scan-bundles";
import { getEmailScanRecordHref } from "./scan-record-href";

test("getEmailScanRecordHref returns courrier section path when present", () => {
  assert.equal(getEmailScanRecordHref({ contraventionId: null, courrierId: "abc123" }), "/courriers");
  assert.equal(getEmailScanRecordHref({ contraventionId: "c-1", courrierId: null }), "/contraventions/c-1");
  assert.equal(getEmailScanRecordHref({ contraventionId: null, courrierId: null }), "");
});

test("classifyDocument routes payment incident scans to retard_paiement", () => {
  assert.equal(classifyDocument("Incident de paiement - relance du 09/07/2026").type, "retard_paiement");
});

test("classifyDocument routes URSSAF cotisation notices to mise_en_demeure", () => {
  assert.equal(classifyDocument("Avis d'échéance de cotisation URSSAF - cotisations sociales").type, "mise_en_demeure");
});

test("groupScansByBundle groups split PDF parts into one ordered bundle", () => {
  const groups = groupScansByBundle([
    { messageId: "msg-1-p2-aaaabbbb", fileName: "courrier_part-02-sur-3_p3-4.pdf" },
    { messageId: "msg-1-p1-aaaabbbb", fileName: "courrier_part-01-sur-3_p1-2.pdf" },
    { messageId: "msg-1-p3-aaaabbbb", fileName: "courrier_part-03-sur-3_p5-6.pdf" },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].scans.length, 3);
  assert.deepEqual(groups[0].scans.map((scan) => scan.fileName), [
    "courrier_part-01-sur-3_p1-2.pdf",
    "courrier_part-02-sur-3_p3-4.pdf",
    "courrier_part-03-sur-3_p5-6.pdf",
  ]);
});

test("mergePdfBuffers concatenates pages from split PDF buffers", async () => {
  const first = await PDFDocument.create();
  first.addPage([200, 200]);
  const second = await PDFDocument.create();
  second.addPage([200, 200]);

  const merged = await mergePdfBuffers([
    Buffer.from(await first.save()),
    Buffer.from(await second.save()),
  ]);

  const document = await PDFDocument.load(merged);
  assert.equal(document.getPageCount(), 2);
});
