import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  serverExternalPackages: ["exceljs", "canvas", "sharp", "tesseract.js", "imapflow", "mailparser", "pdfjs-dist", "nodemailer"],
  // Factures/Impôts moved out of "Courriers" into their own "Comptabilité" section.
  async redirects() {
    return [
      { source: "/courriers/factures", destination: "/comptabilite/factures", permanent: true },
      { source: "/courriers/impots-comptabilite", destination: "/comptabilite/impots", permanent: true },
    ];
  },
};

export default nextConfig;
