const en = {
  common: {
    refresh: "Refresh",
    settings: "Settings",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    reset: "Reset",
    reviewPrinter: "Review printer",
    openMartpos: "Open MartPOS",
    undefined: "Undefined",
    noName: "No name",
    noBrand: "No brand",
    notApplicable: "Not applicable",
    notRecorded: "Not recorded",
    unknownBrand: "Unknown brand",
    connected: "Connected",
    reconnecting: "Reconnecting",
  },
  auth: {
    connectedTitle: "Connection ready",
    connectedSubtitle: "This computer is already linked to Mart POS",
    linkedRecently: "Linked recently",
    linkedSeconds: "Linked a few seconds ago",
    linkedSecondsExact: "Linked {{count}} seconds ago",
    linkedMinutes: "Linked {{count}} min ago",
    linkedHours: "Linked {{count}} h ago",
    linkedDays: "Linked {{count}} d ago",
    forgetConnection: "Forget connection",
    forgetDialogTitle: "Forget connection",
    forgetDialogDescription:
      "This action will unlink this computer from MartPOS. You will need to connect it again to use it.",
    forgetConfirm: "Yes, forget it",
    title: "Connect to MartPOS",
    subtitle: "Choose how you want to link this computer",
    automaticTab: "Automatic",
    manualTab: "Manual code",
    manualTitle: "Linking code",
    manualDescription:
      "Copy this code and paste it into MartPOS if you prefer to complete the link manually",
    generateCode: "Generate code",
    copied: "Copied",
    copy: "Copy",
    codeExpiresIn: "This code expires in {{time}}",
    generateCodeHint: "Generate a code to link this computer",
    automaticTitle: "Automatic linking",
    automaticDescription:
      "Open MartPOS and complete the link without copying codes",
    waitingConfirmation: "Waiting for confirmation...",
  },
  printers: {
    title: "Printers",
    manageConnected: "Manage your connected printers. {{ready}} of {{total}} ready.",
    defaultMissingTitle: "A default printer is missing",
    defaultMissingDescription:
      "Choose a receipt-ready printer before printing from MartPOS.",
    useSuggested: "Use suggested",
    emptyTitle: "We still have not found any printers",
    emptyDescription:
      "Connect the printer, turn it on, and then refresh the list. If it is USB, check that it is connected directly to this computer.",
    emptyStep1: "1. Connect the printer and turn it on.",
    emptyStep2: "2. Wait a few seconds for the system to detect it.",
    emptyStep3: "3. Press refresh.",
    openSupport: "Open support",
    primary: "Primary",
    useAsPrimary: "Use as primary",
    details: "View details",
    printTestTicket: "Print test ticket",
    reprintLastReceipt: "Reprint last receipt",
    status: {
      online: "Connected",
      offline: "Disconnected",
      unknown: "Unconfirmed",
    },
    connection: {
      usb: "USB",
      system: "System",
      network: "Network",
      bluetooth: "Bluetooth",
    },
    type: {
      thermal: "Thermal",
      inkjet: "Inkjet",
      laser: "Laser",
      label: "Label",
      unknown: "Undefined",
    },
    paper: {
      mm58: "58 mm",
      mm80: "80 mm",
      unknown: "Undefined",
    },
    diagnostics: {
      title: "Guided diagnostics",
      subtitle: "Open this if something does not connect, appear, or print.",
      liveSocket: "Live socket",
      martposState: "MartPOS status",
      martposLinked: "Linked",
      martposPending: "Pending link",
      allowedOrigin: "Allowed origin",
      defaultPrinter: "Default printer",
      readyPrinters: "Ready printers",
      onlineCount: "{{ready}} of {{online}} online",
      allGoodTitle: "Everything looks good",
      allGoodDescription:
        "MartPOS, printers, and the local bridge all seem ready.",
      whatIfNoPrintTitle: "What to do if it does not print",
      whatIfNoPrintDescription:
        "Check the default printer, print a test, and adjust the profile if needed.",
      whatIfMissingTitle: "What to do if it does not appear",
      whatIfMissingDescription:
        "Connect the printer, wait a few seconds, and check whether the status changes on its own.",
      issues: {
        bridgeTitle: "MartPOS is not linked yet",
        bridgeDetail:
          "Open MartPOS from here and finish linking on this computer.",
        noPrintersTitle: "We did not find any printers",
        noPrintersDetail:
          "Connect the printer and use refresh to search again.",
        notReceiptReadyTitle:
          "Printers were detected but are not ready for receipts",
        notReceiptReadyDetail:
          "Check the default printer or adjust the receipt profile.",
      },
    },
    profile: {
      title: "Adjust {{name}}",
      description: "Change only what you need so the ticket prints correctly.",
      info: "Information",
      settings: "Settings",
      advanced: "Advanced",
      fields: {
        name: "Name",
        brandModel: "Brand and model",
        connection: "Connection",
        status: "Status",
        driver: "Driver",
        systemQueue: "System queue",
        vendorProduct: "Vendor / Product",
        series: "Serial",
        type: "Type",
        paper: "Paper",
        charsPerLine: "Text per line",
        encoding: "Encoding",
        rawDevicePath: "Device path",
      },
      switches: {
        receiptReady: "Receipt ready",
        autoCut: "Auto cut",
        cashDrawer: "Open cash drawer",
        qrAndBarcode: "QR and barcode",
        qrAndBarcodeHelp:
          "Enable this if the printer supports QR or barcodes on receipts.",
        advancedUsb: "Advanced USB printing",
      },
      advancedTitle: "Special USB support",
      advancedDescription:
        "Only use this if support asks for it for a special USB printer.",
    },
  },
  settings: {
    title: "Settings",
    description: "Simple settings for daily use. They are saved automatically.",
    language: "Language",
    theme: "Theme",
    selectTheme: "Select a theme",
    locales: {
      "es-EC": "Spanish",
      "en-US": "English",
      "fr-FR": "French",
      "pt-BR": "Portuguese",
    },
    themes: {
      light: "Light",
      dark: "Dark",
      system: "System",
    },
  },
  support: {
    martposNeedsAttention: "Mart POS needs attention",
  },
  messages: {
    refreshPrintersSuccess: "Printer list updated.",
    refreshPrintersError: "Could not update the printer list.",
    defaultPrinterUpdated: "Default printer updated.",
    defaultPrinterError: "Could not save the default printer.",
    printTestSent: "Test sent to the printer.",
    printTestError: "Could not print the test.",
    printDirectFailed:
      "Could not send directly to the printer. A helper file was generated with {{driver}} at {{path}}.",
    reprintDirectFailed:
      "Could not reprint directly. A helper file was generated with {{driver}} at {{path}}.",
    reprintSuccess: "Last real receipt sent to print again.",
    reprintError: "Could not reprint the last receipt.",
    configSaved: "Settings saved.",
    configSaveError: "Could not save the settings.",
    printerProfileSaved: "Printer settings saved.",
    printerProfileError: "Could not save this printer.",
    pairingCodeReady: "Code ready to link MartPOS.",
    pairingPrepareError:
      "Could not prepare the link. Close and reopen MPOS Core if the problem continues.",
    pairingPrepareMartposError:
      "Could not prepare the MartPOS link.",
    pairingCodeCopied: "Code copied.",
    martposOpened: "MartPOS was opened to finish the link.",
    martposOpenError:
      "We could not open MartPOS or finish the link. Check that MartPOS is installed and open on this same computer.",
    martposOpenFallback: "Could not open MartPOS.",
    bridgeForgotten:
      "MartPOS was unlinked on this computer. To connect it again, pair again.",
    bridgeForgetError: "Could not unlink MartPOS.",
    syncPairingError:
      "We could not confirm the link with MartPOS. If MartPOS was already open, try opening the link again.",
    syncPairingStateError: "Could not update the link with MartPOS.",
    networkSuffix:
      "{{fallback}} Make sure MartPOS and MPOS Core are open on this same computer.",
    originNotAllowed:
      "MartPOS tried to connect from an origin that is not allowed. Check the current MartPOS environment and open the link again.",
    pairingExpired:
      "The link expired or is no longer valid. Generate a new code and try again.",
    noDefaultPrinterConfigured:
      "There is no default printer yet. Choose a ready printer to be able to print.",
    printSent: "Print sent successfully.",
    previewPrepared: "A helper preview was prepared to complete the print.",
    queuedToSystem: "The print was sent to the system queue.",
  },
} as const;

export default en;
