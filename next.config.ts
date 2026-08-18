import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  serverExternalPackages: ["exceljs", "canvas", "sharp", "tesseract.js", "imapflow", "mailparser", "pdfjs-dist"],
};

export default nextConfig;
