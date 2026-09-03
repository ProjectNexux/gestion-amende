import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  serverExternalPackages: ["exceljs", "canvas", "sharp", "tesseract.js", "imapflow", "mailparser", "pdfjs-dist", "nodemailer"],
  // pdfjs-dist dynamically loads its own worker file (pdf.worker.mjs) at runtime — Vercel's
  // file-tracing can't discover that via static analysis, so without this the worker file is
  // silently dropped from the deployed function and every PDF OCR/text-extraction call fails
  // with "Setting up fake worker failed: Cannot find module '.../pdf.worker.mjs'" in production
  // (while working fine locally, where the full node_modules tree is always present).
  outputFileTracingIncludes: {
    "/api/documents/import": ["./node_modules/pdfjs-dist/legacy/build/*.mjs"],
    "/api/scan-email/process": ["./node_modules/pdfjs-dist/legacy/build/*.mjs"],
    "/api/scan-email/poll": ["./node_modules/pdfjs-dist/legacy/build/*.mjs"],
  },
  // Factures/Impôts moved out of "Courriers" into their own "Comptabilité" section.
  async redirects() {
    return [
      { source: "/courriers/factures", destination: "/comptabilite/factures", permanent: true },
      { source: "/courriers/impots-comptabilite", destination: "/comptabilite/impots", permanent: true },
    ];
  },
};

export default nextConfig;
