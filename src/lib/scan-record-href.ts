export function getEmailScanRecordHref(scan: { contraventionId?: string | null; courrierId?: string | null; courrierType?: string | null }): string {
  if (scan.contraventionId) return `/contraventions/${scan.contraventionId}`;

  if (scan.courrierId) {
    if (!scan.courrierType) return "/courriers";

    const detailPath: Record<string, (id: string) => string> = {
      certificat_immatriculation: (id) => `/courriers/certificats-immatriculation/${id}`,
      mise_en_demeure: (id) => `/courriers/mise-en-demeure/${id}`,
      pub: () => `/courriers/pub`,
      retard_paiement: (id) => `/courriers/retards-paiement/${id}`,
      facture: (id) => `/comptabilite/factures/${id}`,
      impot: (id) => `/comptabilite/impots/${id}`,
      sinistre: (id) => `/courriers/sinistres/${id}`,
      permis_conduire: (id) => `/courriers/${id}`,
      carte_identite: (id) => `/courriers/${id}`,
      cession_creance: (id) => `/courriers/${id}`,
      satd: (id) => `/courriers/${id}`,
      avis_cotisation: (id) => `/courriers/${id}`,
      urssaf: (id) => `/courriers/${id}`,
      document: (id) => `/courriers/${id}`,
      client_envoi: (id) => `/courriers/${id}`,
    };

    return detailPath[scan.courrierType]?.(scan.courrierId) ?? "/courriers";
  }

  return "";
}
