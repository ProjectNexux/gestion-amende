// Contenu du centre d'aide administrateur — texte statique uniquement (aucun appel réseau, aucun
// chatbot). Chaque guide décrit une fonctionnalité RÉELLE de l'application avec le nom EXACT des
// boutons tels qu'ils apparaissent à l'écran, pour qu'une personne qui n'a jamais utilisé l'outil
// puisse suivre les étapes à la lettre. À maintenir à jour si un libellé de bouton change ailleurs
// dans l'app (ex: src/app/admin/scans/page.tsx, src/components/TransmettreClientModal.tsx).

export type HelpProblem = { probleme: string; solution: string };

export type HelpGuide = {
  slug: string;
  title: string;
  /** Court libellé affiché sur la carte du centre d'aide. */
  summary: string;
  objectif: string;
  etapes: string[];
  resultatAttendu: string;
  problemes: HelpProblem[];
  pageLink: { label: string; href: string };
};

export const HELP_GUIDES: HelpGuide[] = [
  {
    slug: "bien-demarrer",
    title: "Bien démarrer",
    summary: "Repérer les grandes zones de l'application avant de l'utiliser au quotidien.",
    objectif: "Comprendre où se trouve chaque fonction principale avant de traiter un premier dossier.",
    etapes: [
      "Connectez-vous avec le compte administrateur (société + code d'accès, ou adresse e-mail + mot de passe).",
      "Repérez la barre latérale à gauche : Vue d'ensemble, Contraventions, Courriers, Comptabilité, Clients, puis Aide et assistance tout en bas.",
      "La page affichée juste après connexion est la « Vue d'ensemble » — elle résume ce qui nécessite votre attention aujourd'hui.",
      "Utilisez le champ « Rechercher… » en haut de l'écran pour retrouver rapidement un dossier, un client ou un document par son nom.",
      "Le bouton « Scanner un document » (en haut à droite) permet d'ajouter un nouveau document à tout moment.",
    ],
    resultatAttendu: "Vous savez où se trouve chaque grande fonction de l'application et comment revenir à la Vue d'ensemble.",
    problemes: [
      {
        probleme: "Je ne vois pas la rubrique « Clients » ni « Aide et assistance ».",
        solution: "Ces rubriques n'apparaissent que pour les comptes administrateur — un compte client ne les voit jamais, c'est normal.",
      },
    ],
    pageLink: { label: "Ouvrir la Vue d'ensemble", href: "/" },
  },
  {
    slug: "comprendre-le-tableau-de-bord",
    title: "Comprendre le tableau de bord",
    summary: "Lire les 5 cartes prioritaires, la liste « À traiter aujourd'hui » et les blocs du bas.",
    objectif: "Comprendre ce que chaque chiffre du tableau de bord signifie et où il vous emmène si vous cliquez dessus.",
    etapes: [
      "Les 5 cartes en haut (« Documents reçus », « Documents à classer », « Dossiers prêts à envoyer », « Dossiers urgents », « Échéances proches ») sont toutes cliquables : chacune ouvre la liste déjà filtrée correspondante.",
      "Le bloc « À traiter aujourd'hui » liste les dossiers les plus urgents, classés du plus prioritaire au moins prioritaire — cliquez sur une ligne pour ouvrir directement ce dossier.",
      "« Activité documentaire » affiche l'évolution des documents reçus/classés/restants sur 7 jours, 30 jours ou 12 mois (boutons en haut du graphique).",
      "En bas de page : « Documents récents », « Prochaines échéances », « Dossiers en retard » et « Activité récente » — chacun avec un lien « Tout voir » vers la liste complète.",
      "Survolez un badge de statut (ex. « En retard », « Payé ») pour afficher une explication au survol.",
    ],
    resultatAttendu: "Vous identifiez en un coup d'œil ce qui nécessite une action et vous savez cliquer pour l'ouvrir.",
    problemes: [
      {
        probleme: "Une carte affiche 0 alors que je m'attendais à un autre chiffre.",
        solution: "Chaque carte compte uniquement les dossiers réels correspondant à sa définition exacte (ex. « Documents à classer » ne compte que les 50 scans les plus récents non encore classés) — ouvrez la carte pour vérifier le détail.",
      },
    ],
    pageLink: { label: "Ouvrir la Vue d'ensemble", href: "/" },
  },
  {
    slug: "recevoir-un-scan",
    title: "Recevoir un scan",
    summary: "Comprendre comment un document arrive automatiquement, sans action manuelle.",
    objectif: "Comprendre le circuit automatique par lequel un document scanné (imprimante ou e-mail) arrive dans l'application.",
    etapes: [
      "Un document envoyé par e-mail ou déposé par un scanner réseau est récupéré automatiquement toutes les minutes, sans aucune action de votre part.",
      "Il apparaît dans « Courriers » → « Scans reçus » (menu de gauche) avec le statut « Reçu ».",
      "L'application lance ensuite l'analyse automatique du texte (statut « Analyse en cours »), puis tente de reconnaître le type de document.",
      "Si tout est reconnu avec certitude, un dossier est créé automatiquement (statut « Dossier créé »).",
      "Sinon, le document reste dans l'onglet « À classer » en attendant une classification manuelle (voir le guide « Classer un document »).",
    ],
    resultatAttendu: "Vous savez retrouver n'importe quel document reçu, même s'il n'a pas encore été transformé en dossier.",
    problemes: [
      {
        probleme: "Un document envoyé il y a plusieurs minutes n'apparaît toujours pas.",
        solution: "La récupération automatique tourne toutes les 60 secondes environ — rechargez la page « Scans reçus ». Si rien n'apparaît après quelques minutes, vérifiez avec votre équipe technique que la boîte e-mail de scan est bien active.",
      },
      {
        probleme: "Le document apparaît avec le statut « Erreur ».",
        solution: "Ouvrez la ligne et utilisez le bouton « Relancer l'analyse », ou classez-le manuellement avec le bouton « Classer ».",
      },
    ],
    pageLink: { label: "Ouvrir Scans reçus", href: "/admin/scans" },
  },
  {
    slug: "classer-un-document",
    title: "Classer un document",
    summary: "Transformer un scan reçu en dossier réel (contravention, mise en demeure, etc.).",
    objectif: "Terminer manuellement la classification d'un document que l'analyse automatique n'a pas pu reconnaître avec certitude.",
    etapes: [
      "Ouvrez « Courriers » → « Scans reçus », puis l'onglet « À classer ».",
      "Cliquez sur « Voir » pour prévisualiser le document si vous avez besoin de le relire.",
      "Cliquez sur le bouton « Classer » de la ligne concernée — la fenêtre « Classer le document » s'ouvre.",
      "Choisissez le « Type de document » dans la liste déroulante (Contravention, Mise en demeure, Retard de paiement, Certificat d'immatriculation, etc.).",
      "Cochez « Rendre visible dans le portail client » si le document doit être immédiatement transmis à la société concernée.",
      "Ajoutez une « Note (optionnelle) » si besoin, puis validez avec le bouton « Classer ».",
    ],
    resultatAttendu: "Le document quitte l'onglet « À classer » et un dossier réel est créé, ouvrable depuis « Tous les courriers » ou la liste correspondante.",
    problemes: [
      {
        probleme: "Le type exact du document ne figure pas dans la liste.",
        solution: "Choisissez « Autre » — le document reste consultable dans « Tous les courriers » sous l'étiquette « Document à classer », vous pourrez le reclasser plus tard.",
      },
    ],
    pageLink: { label: "Ouvrir les documents à classer", href: "/admin/scans?filter=to_review" },
  },
  {
    slug: "documents-a-classer",
    title: "Documents à classer",
    summary: "Comprendre à quoi correspond exactement cet onglet et cette carte du tableau de bord.",
    objectif: "Savoir exactement quels documents apparaissent dans « À classer » et pourquoi.",
    etapes: [
      "Un document apparaît dans « À classer » dans deux cas seulement : l'analyse automatique a échoué (statut « Erreur »), ou elle a réussi mais aucun dossier n'a encore été créé à partir de lui.",
      "Ce chiffre correspond exactement à celui affiché sur la carte « Documents à classer » du tableau de bord — cliquer sur la carte ouvre directement cette même liste.",
      "Une fois un document classé (voir le guide « Classer un document »), il quitte automatiquement cette liste.",
    ],
    resultatAttendu: "Vous savez que cette liste ne contient jamais de document déjà classé, et qu'elle se vide au fur et à mesure du traitement.",
    problemes: [
      {
        probleme: "La liste semble vide alors que des scans récents existent.",
        solution: "Seuls les scans encore « Reçu »/« Erreur »/« Analysé sans dossier » y figurent — les autres onglets (« Créés », « Erreurs », « Tous ») permettent de voir l'ensemble des scans.",
      },
    ],
    pageLink: { label: "Ouvrir les documents à classer", href: "/admin/scans?filter=to_review" },
  },
  {
    slug: "transmettre-un-document-au-client",
    title: "Transmettre un document au client",
    summary: "Rendre un dossier ou un document visible dans le portail de la société cliente.",
    objectif: "Partager un document ou un dossier avec la société cliente concernée, pour qu'elle le retrouve dans son propre portail.",
    etapes: [
      "Depuis « Tous les courriers », « Scans reçus » ou la fiche d'un dossier, cliquez sur le bouton « Transmettre au client ».",
      "Sélectionnez la « Société destinataire » dans la liste déroulante (la société détectée automatiquement est repérée par la mention « détectée »).",
      "Si besoin, ajustez la « Catégorie », le « Titre » et un « Message (facultatif) ».",
      "Cochez les destinataires souhaités dans « Destinataires (utilisateurs actifs) », ou cliquez sur « Sélectionner tous les utilisateurs actifs ».",
      "Laissez cochée l'option « Notifier par e-mail les destinataires sélectionnés » si vous voulez qu'ils reçoivent un e-mail (décochez pour un partage silencieux, visible seulement dans leur portail).",
      "Cliquez sur « Confirmer la transmission ».",
    ],
    resultatAttendu: "Le document devient « Visible » dans le portail de la société choisie, et les destinataires cochés reçoivent un e-mail de notification si l'option était activée.",
    problemes: [
      {
        probleme: "Aucun utilisateur actif ne s'affiche pour la société choisie.",
        solution: "La transmission reste possible sans notification e-mail — le document sera visible dès la prochaine connexion du client à son portail. Créez un compte utilisateur pour cette société via le guide « Créer et inviter un compte client » si vous souhaitez notifier quelqu'un.",
      },
      {
        probleme: "Une notification affiche « échec ».",
        solution: "Utilisez le bouton « Renvoyer aux destinataires en échec » — seuls les envois ayant échoué seront retentés.",
      },
    ],
    pageLink: { label: "Ouvrir Tous les courriers", href: "/courriers" },
  },
  {
    slug: "gerer-les-contraventions",
    title: "Gérer les contraventions",
    summary: "Suivre le cycle de vie d'un dossier : dénonciation, paiement, transmission au client.",
    objectif: "Faire avancer une contravention depuis sa réception jusqu'à son solde complet.",
    etapes: [
      "Ouvrez « Contraventions » puis cliquez sur le numéro de dossier concerné.",
      "Dans le bloc « Dénonciation », choisissez le statut réel : « À effectuer », « Effectuée » ou « Non applicable ».",
      "Dans le bloc « Paiement », choisissez : « En attente », « Payé », « En retard » ou « Contesté ».",
      "Utilisez « + Ajouter une note » pour consigner une information utile sur le dossier.",
      "Basculez « Visible par le client » / « Masqué au client » pour décider si la société cliente voit ce dossier dans son portail.",
    ],
    resultatAttendu: "Le statut affiché dans les listes (« À dénoncer », « Paiement en attente », « Payé », « En retard », « Terminé ») reflète toujours l'état réel du dossier.",
    problemes: [
      {
        probleme: "Le dossier reste marqué « En retard » alors que le paiement a été fait.",
        solution: "Le statut « En retard » disparaît automatiquement dès que vous passez le Paiement sur « Payé » — vérifiez que le changement a bien été enregistré (le bandeau se ferme après validation).",
      },
    ],
    pageLink: { label: "Ouvrir Contraventions", href: "/contraventions" },
  },
  {
    slug: "creer-un-client",
    title: "Créer un client",
    summary: "Ajouter une nouvelle société cliente à l'application.",
    objectif: "Créer la fiche d'une nouvelle société cliente en quelques étapes.",
    etapes: [
      "Ouvrez « Clients » (menu de gauche) puis cliquez sur « Créer un client ».",
      "Saisissez le SIRET pour un pré-remplissage automatique des informations légales, ou basculez en saisie manuelle.",
      "Cliquez sur « Continuer » pour passer à l'étape « Contact ».",
      "Renseignez le contact principal (prénom, nom, fonction, e-mail) puis « Continuer ».",
      "Vérifiez le récapitulatif puis cliquez sur « Créer le client ».",
      "Sur l'écran de confirmation, cliquez sur « Envoyer l'invitation par e-mail » si un e-mail de contact a été renseigné, ou copiez le lien avec le bouton de copie.",
    ],
    resultatAttendu: "La société apparaît dans « Clients » avec un portail actif ; l'invitation d'accès peut être envoyée immédiatement ou plus tard.",
    problemes: [
      {
        probleme: "Le message « Cette société existe déjà » s'affiche.",
        solution: "Un SIRET ne peut être utilisé que par une seule fiche société — ouvrez la fiche existante depuis le lien proposé au lieu d'en créer une nouvelle.",
      },
    ],
    pageLink: { label: "Créer un client", href: "/admin/clients/new" },
  },
  {
    slug: "creer-et-inviter-un-compte-client",
    title: "Créer et inviter un compte client",
    summary: "Donner à une personne chez le client son propre accès individuel (e-mail + mot de passe).",
    objectif: "Ajouter un utilisateur individuel pour une société cliente déjà créée, afin qu'il puisse se connecter avec son propre e-mail et mot de passe.",
    etapes: [
      "Ouvrez la fiche de la société cliente depuis « Clients », puis l'onglet « Utilisateurs ».",
      "Cliquez sur « Ajouter un utilisateur ».",
      "Renseignez « Prénom », « Nom » et « Adresse e-mail », cochez « Définir comme contact principal » si c'est la personne de référence.",
      "Cliquez sur « Ajouter et inviter » — un e-mail d'invitation est envoyé automatiquement.",
      "Le statut du compte affiche « Invitation en attente » tant que la personne n'a pas défini son mot de passe, puis passe à « Actif ».",
      "Utilisez « Renvoyer l'invitation » si l'e-mail n'a pas été reçu, ou « Réinitialiser le mot de passe » une fois le compte actif.",
    ],
    resultatAttendu: "La personne reçoit un e-mail avec un lien à usage unique pour choisir elle-même son mot de passe, puis peut se connecter avec son e-mail.",
    problemes: [
      {
        probleme: "La personne n'a pas reçu l'e-mail d'invitation.",
        solution: "Cliquez sur « Renvoyer l'invitation » sur sa ligne dans l'onglet Utilisateurs — pensez à vérifier ses courriers indésirables.",
      },
      {
        probleme: "Je veux retirer l'accès à quelqu'un sans perdre ses documents.",
        solution: "Utilisez « Désactiver » (réversible avec « Activer ») plutôt que la suppression — les documents et dossiers de la société ne sont jamais liés à un compte utilisateur, ils restent intacts.",
      },
    ],
    pageLink: { label: "Ouvrir Clients", href: "/admin/clients" },
  },
  {
    slug: "gerer-les-conducteurs-et-vehicules",
    title: "Gérer les conducteurs et véhicules",
    summary: "Enregistrer la flotte et le personnel pour les associer aux contraventions.",
    objectif: "Tenir à jour la liste des véhicules et des conducteurs afin de pouvoir les associer à une contravention.",
    etapes: [
      "Ouvrez « Contraventions » → « Véhicules », puis cliquez sur « + Ajouter un véhicule ».",
      "Renseignez au minimum l'« Immatriculation », puis cliquez sur « Créer ».",
      "Ouvrez « Contraventions » → « Conducteurs », puis cliquez sur « + Ajouter un conducteur ».",
      "Renseignez son identité, puis cliquez sur « Créer ».",
      "Depuis la fiche d'une contravention, sélectionnez le conducteur responsable pour l'associer au dossier.",
    ],
    resultatAttendu: "Les véhicules et conducteurs apparaissent dans les listes déroulantes lors du traitement d'une contravention.",
    problemes: [
      {
        probleme: "Je dois ajouter plusieurs dizaines de véhicules d'un coup.",
        solution: "Utilisez le bouton d'import Excel disponible en haut de la page « Véhicules » plutôt que de les saisir un par un.",
      },
    ],
    pageLink: { label: "Ouvrir Véhicules", href: "/vehicules" },
  },
  {
    slug: "resoudre-les-problemes-frequents",
    title: "Résoudre les problèmes fréquents",
    summary: "Solutions aux blocages les plus courants rencontrés par un administrateur.",
    objectif: "Retrouver rapidement la solution à un problème courant sans devoir contacter le support.",
    etapes: [],
    resultatAttendu: "Le blocage est résolu ou vous savez précisément quelle action tenter ensuite.",
    problemes: [
      { probleme: "Un document reste bloqué avec le statut « Erreur ».", solution: "Ouvrez « Scans reçus », utilisez le bouton « Relancer l'analyse » sur la ligne concernée, ou classez-le manuellement avec « Classer »." },
      { probleme: "Un dossier affiche « À vérifier ».", solution: "Les informations extraites automatiquement doivent être relues — ouvrez le dossier et corrigez les champs avant de le transmettre au client." },
      { probleme: "Le client ne voit pas un document que j'ai pourtant traité.", solution: "Vérifiez que le badge affiche « Visible » (et non « Masquée ») sur la ligne du document, et que le compte utilisateur du client est bien « Actif »." },
      { probleme: "Un lien d'invitation ou de création de compte a expiré.", solution: "Utilisez « Renvoyer l'invitation » (compte utilisateur) ou « Régénérer le lien » (ancien accès partagé société) pour en générer un nouveau." },
      { probleme: "Aucun nouveau document n'arrive automatiquement depuis un moment.", solution: "La récupération automatique tourne en tâche de fond toutes les minutes — rechargez « Scans reçus » ; si rien ne change après plusieurs minutes, contactez votre équipe technique pour vérifier la boîte e-mail de scan." },
      { probleme: "Je ne retrouve plus un client ou un dossier précis.", solution: "Utilisez la recherche globale en haut de l'écran (icône loupe) — elle cherche à la fois parmi les clients, contraventions et documents." },
    ],
    pageLink: { label: "Ouvrir Scans reçus", href: "/admin/scans" },
  },
];

export function getHelpGuide(slug: string): HelpGuide | undefined {
  return HELP_GUIDES.find((g) => g.slug === slug);
}

export type StatusGlossaryEntry = {
  label: string;
  meaning: string;
  appliesTo: string;
};

// Les 14 statuts demandés, dans l'ordre du cahier des charges — texte simple, sans jargon.
export const STATUS_GLOSSARY: StatusGlossaryEntry[] = [
  { label: "Reçu", meaning: "Le document vient d'arriver (scan imprimante ou e-mail) et n'a pas encore été analysé.", appliesTo: "Scans reçus" },
  { label: "Analyse en cours", meaning: "L'application est en train d'extraire automatiquement les informations du document (OCR).", appliesTo: "Scans reçus" },
  { label: "Classé", meaning: "Le document a été transformé avec succès en dossier (contravention, mise en demeure...) — affiché « Dossier créé » sur la page Scans reçus.", appliesTo: "Scans reçus" },
  { label: "À classer", meaning: "Le document n'a pas pu être classé automatiquement (erreur ou type incertain) et attend une action manuelle.", appliesTo: "Scans reçus" },
  { label: "À vérifier", meaning: "Les informations extraites automatiquement sont incertaines et doivent être relues avant validation.", appliesTo: "Courriers, transmission" },
  { label: "Prêt à transmettre", meaning: "Le dossier est complet mais n'a pas encore été partagé avec le client — c'est le moment d'utiliser « Transmettre au client ».", appliesTo: "Contraventions, courriers" },
  { label: "Transmis", meaning: "Le document ou le dossier est désormais visible par la société cliente dans son propre portail (badge « Visible »).", appliesTo: "Contraventions, courriers" },
  { label: "Lu", meaning: "Le client a ouvert ce document depuis son portail.", appliesTo: "Documents transmis" },
  { label: "À dénoncer", meaning: "La contravention doit encore être dénoncée à l'ANTAI (désigner le conducteur responsable).", appliesTo: "Contraventions" },
  { label: "Paiement en attente", meaning: "L'amende n'a pas encore été réglée.", appliesTo: "Contraventions" },
  { label: "Payé", meaning: "Le paiement de l'amende a été confirmé.", appliesTo: "Contraventions" },
  { label: "En retard", meaning: "La date limite de paiement ou de dénonciation est dépassée sans qu'aucune action n'ait été faite.", appliesTo: "Contraventions, courriers" },
  { label: "Terminé", meaning: "Le dossier est entièrement soldé : dénonciation effectuée et paiement réglé.", appliesTo: "Contraventions" },
  { label: "Erreur de traitement", meaning: "L'analyse automatique du document a échoué (texte illisible, format non reconnu...) — une reprise manuelle est nécessaire.", appliesTo: "Scans reçus" },
];

export function getStatusHint(label: string): string | undefined {
  return STATUS_GLOSSARY.find((s) => s.label.toLowerCase() === label.toLowerCase())?.meaning;
}
