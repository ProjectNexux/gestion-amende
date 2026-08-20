import { classifyDocument } from "../src/lib/document-classifier";

function check(label: string, text: string, expected: string) {
  const r = classifyDocument(text);
  const ok = r.type === expected;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}: got "${r.type}" (expected "${expected}")`);
}

check("Cas 1 - pub claire", "Grande OPÉRATION COMMERCIALE ! Découvrez notre catalogue et notre offre promotionnelle exceptionnelle. Prospectus valable ce mois-ci.", "pub");
check("Cas 3 - ambigu (pub + montant dû)", "Offre promotionnelle valable jusqu'au 30/09. Montant dû: 42,00 €.", "inconnu");
check("Cas 4a - mise en demeure", "Mise en demeure de payer sous 8 jours.", "mise_en_demeure");
check("Cas 4b - URSSAF (sans mot mise en demeure)", "URSSAF Île-de-France - Appel de cotisations sociales - régularisation demandée.", "inconnu");
check("Cas 4c - facture", "Facture n°123 - merci de régler avant le 30/09. Catalogue de nos services joint.", "inconnu");
check("Cas 4d - contravention", "AVIS DE CONTRAVENTION - Excès de vitesse constaté.", "contravention");
check("Cas 4e - certificat immatriculation mention", "Certificat d'immatriculation - brochure commerciale jointe pour information", "inconnu");
