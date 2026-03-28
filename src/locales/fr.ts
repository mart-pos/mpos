const fr = {
  common: {
    refresh: "Actualiser",
    settings: "Parametres",
    close: "Fermer",
    cancel: "Annuler",
    save: "Enregistrer",
    reset: "Reinitialiser",
    reviewPrinter: "Verifier l'imprimante",
    openMartpos: "Ouvrir MartPOS",
    undefined: "Non defini",
    noName: "Sans nom",
    noBrand: "Sans marque",
    notApplicable: "Non applicable",
    notRecorded: "Sans enregistrement",
    unknownBrand: "Marque inconnue",
    connected: "Connecte",
    reconnecting: "Reconnexion",
  },
  auth: {
    connectedTitle: "Connexion prete",
    connectedSubtitle: "Cet ordinateur est deja lie a Mart POS",
    linkedRecently: "Lie recemment",
    linkedSeconds: "Lie il y a quelques secondes",
    linkedSecondsExact: "Lie il y a {{count}} secondes",
    linkedMinutes: "Lie il y a {{count}} min",
    linkedHours: "Lie il y a {{count}} h",
    linkedDays: "Lie il y a {{count}} j",
    forgetConnection: "Oublier la connexion",
    forgetDialogTitle: "Oublier la connexion",
    forgetDialogDescription:
      "Cette action dissociera cet ordinateur de MartPOS. Vous devrez le reconnecter pour l'utiliser a nouveau.",
    forgetConfirm: "Oui, oublier",
    title: "Connecter a MartPOS",
    subtitle: "Choisissez comment lier cet ordinateur",
    automaticTab: "Automatique",
    manualTab: "Code manuel",
    manualTitle: "Code de liaison",
    manualDescription:
      "Copiez ce code et collez-le dans MartPOS si vous preferez terminer la liaison manuellement",
    generateCode: "Generer le code",
    copied: "Copie",
    copy: "Copier",
    codeExpiresIn: "Ce code expire dans {{time}}",
    generateCodeHint: "Generez un code pour lier cet ordinateur",
    automaticTitle: "Liaison automatique",
    automaticDescription:
      "Ouvrez MartPOS et terminez la liaison sans copier de codes",
    waitingConfirmation: "En attente de confirmation...",
  },
  printers: {
    title: "Imprimantes",
    manageConnected:
      "Gerez vos imprimantes connectees. {{ready}} sur {{total}} pretes.",
    defaultMissingTitle: "Une imprimante principale manque",
    defaultMissingDescription:
      "Choisissez une imprimante prete pour les recus avant d'imprimer depuis MartPOS.",
    useSuggested: "Utiliser la suggestion",
    emptyTitle: "Nous n'avons encore trouve aucune imprimante",
    emptyDescription:
      "Connectez l'imprimante, allumez-la puis actualisez la liste. Si elle est en USB, verifiez qu'elle est connectee directement a cet ordinateur.",
    emptyStep1: "1. Connectez l'imprimante et allumez-la.",
    emptyStep2: "2. Attendez quelques secondes que le systeme la detecte.",
    emptyStep3: "3. Appuyez sur actualiser.",
    openSupport: "Ouvrir l'assistance",
    primary: "Principale",
    useAsPrimary: "Utiliser comme principale",
    details: "Voir les details",
    printTestTicket: "Imprimer un ticket de test",
    reprintLastReceipt: "Reimprimer le dernier recu",
    status: {
      online: "Connectee",
      offline: "Deconnectee",
      unknown: "Non confirmee",
    },
    connection: {
      usb: "USB",
      system: "Systeme",
      network: "Reseau",
      bluetooth: "Bluetooth",
    },
    type: {
      thermal: "Thermique",
      inkjet: "Jet d'encre",
      laser: "Laser",
      label: "Etiquettes",
      unknown: "Non defini",
    },
    paper: {
      mm58: "58 mm",
      mm80: "80 mm",
      unknown: "Non defini",
    },
    diagnostics: {
      title: "Diagnostic guide",
      subtitle:
        "Ouvrez ceci si quelque chose ne se connecte pas, n'apparait pas ou n'imprime pas.",
      liveSocket: "Socket en direct",
      martposState: "Etat MartPOS",
      martposLinked: "Lie",
      martposPending: "Liaison en attente",
      allowedOrigin: "Origine autorisee",
      defaultPrinter: "Imprimante principale",
      readyPrinters: "Imprimantes pretes",
      onlineCount: "{{ready}} sur {{online}} en ligne",
      allGoodTitle: "Tout semble correct",
      allGoodDescription:
        "MartPOS, les imprimantes et le bridge local semblent prets.",
      whatIfNoPrintTitle: "Que faire si rien n'imprime",
      whatIfNoPrintDescription:
        "Verifiez l'imprimante principale, imprimez un test et ajustez le profil si necessaire.",
      whatIfMissingTitle: "Que faire si elle n'apparait pas",
      whatIfMissingDescription:
        "Connectez l'imprimante, attendez quelques secondes et verifiez si l'etat change tout seul.",
      issues: {
        bridgeTitle: "MartPOS n'est pas encore lie",
        bridgeDetail:
          "Ouvrez MartPOS depuis ici et terminez la liaison sur cet ordinateur.",
        noPrintersTitle: "Nous n'avons trouve aucune imprimante",
        noPrintersDetail:
          "Connectez l'imprimante et utilisez actualiser pour relancer la recherche.",
        notReceiptReadyTitle:
          "Des imprimantes ont ete detectees mais ne sont pas pretes pour les recus",
        notReceiptReadyDetail:
          "Verifiez l'imprimante principale ou ajustez le profil de recu.",
      },
    },
    profile: {
      title: "Ajuster {{name}}",
      description:
        "Ne changez que ce qu'il faut pour que le ticket s'imprime correctement.",
      info: "Informations",
      settings: "Parametres",
      advanced: "Avance",
      fields: {
        name: "Nom",
        brandModel: "Marque et modele",
        connection: "Connexion",
        status: "Etat",
        driver: "Pilote",
        systemQueue: "File systeme",
        vendorProduct: "Vendor / Product",
        series: "Serie",
        type: "Type",
        paper: "Papier",
        charsPerLine: "Texte par ligne",
        encoding: "Encodage",
        rawDevicePath: "Chemin du peripherique",
      },
      switches: {
        receiptReady: "Pret pour les recus",
        autoCut: "Coupe automatique",
        cashDrawer: "Ouvrir le tiroir-caisse",
        qrAndBarcode: "QR et code-barres",
        qrAndBarcodeHelp:
          "Activez ceci si l'imprimante gere les QR ou codes-barres sur les recus.",
        advancedUsb: "Impression USB avancee",
      },
      advancedTitle: "Support USB special",
      advancedDescription:
        "Utilisez ceci seulement si le support vous le demande pour une imprimante USB speciale.",
    },
  },
  settings: {
    title: "Parametres",
    description:
      "Parametres simples pour l'utilisation quotidienne. Ils sont enregistres automatiquement.",
    language: "Langue",
    theme: "Theme",
    selectTheme: "Selectionnez un theme",
    locales: {
      "es-EC": "Espagnol",
      "en-US": "Anglais",
      "fr-FR": "Francais",
      "pt-BR": "Portugais",
    },
    themes: {
      light: "Clair",
      dark: "Sombre",
      system: "Systeme",
    },
  },
  support: {
    martposNeedsAttention: "Mart POS requiert votre attention",
  },
  messages: {
    refreshPrintersSuccess: "La liste des imprimantes a ete actualisee.",
    refreshPrintersError: "Impossible d'actualiser la liste des imprimantes.",
    defaultPrinterUpdated: "Imprimante principale mise a jour.",
    defaultPrinterError: "Impossible d'enregistrer l'imprimante principale.",
    printTestSent: "Test envoye a l'imprimante.",
    printTestError: "Impossible d'imprimer le test.",
    printDirectFailed:
      "Impossible d'envoyer directement a l'imprimante. Un fichier d'assistance a ete genere avec {{driver}} dans {{path}}.",
    reprintDirectFailed:
      "Impossible de reimprimer directement. Un fichier d'assistance a ete genere avec {{driver}} dans {{path}}.",
    reprintSuccess: "Le dernier vrai recu a ete renvoye a l'impression.",
    reprintError: "Impossible de reimprimer le dernier recu.",
    configSaved: "Parametres enregistres.",
    configSaveError: "Impossible d'enregistrer les parametres.",
    printerProfileSaved: "Parametres de l'imprimante enregistres.",
    printerProfileError: "Impossible d'enregistrer cette imprimante.",
    pairingCodeReady: "Code pret pour lier MartPOS.",
    pairingPrepareError:
      "Impossible de preparer la liaison. Fermez et rouvr ez MPOS Core si le probleme continue.",
    pairingPrepareMartposError:
      "Impossible de preparer la liaison avec MartPOS.",
    pairingCodeCopied: "Code copie.",
    martposOpened: "MartPOS a ete ouvert pour terminer la liaison.",
    martposOpenError:
      "Nous n'avons pas pu ouvrir MartPOS ou terminer la liaison. Verifiez que MartPOS est installe et ouvert sur ce meme ordinateur.",
    martposOpenFallback: "Impossible d'ouvrir MartPOS.",
    bridgeForgotten:
      "MartPOS a ete dissocie sur cet ordinateur. Pour le reconnecter, refaites le pairing.",
    bridgeForgetError: "Impossible de dissocier MartPOS.",
    syncPairingError:
      "Nous n'avons pas pu confirmer la liaison avec MartPOS. Si MartPOS etait deja ouvert, essayez d'ouvrir a nouveau la liaison.",
    syncPairingStateError:
      "Impossible de mettre a jour la liaison avec MartPOS.",
    networkSuffix:
      "{{fallback}} Verifiez que MartPOS et MPOS Core sont ouverts sur ce meme ordinateur.",
    originNotAllowed:
      "MartPOS a tente de se connecter depuis une origine non autorisee. Verifiez l'environnement MartPOS actuel et ouvrez a nouveau la liaison.",
    pairingExpired:
      "La liaison a expire ou n'est plus valide. Generez un nouveau code et reessayez.",
    noDefaultPrinterConfigured:
      "Il n'y a pas encore d'imprimante principale. Choisissez une imprimante prete pour pouvoir imprimer.",
    printSent: "Impression envoyee correctement.",
    previewPrepared:
      "Un apercu d'assistance a ete prepare pour terminer l'impression.",
    queuedToSystem:
      "L'impression a ete envoyee a la file d'attente du systeme.",
  },
} as const;

export default fr;
