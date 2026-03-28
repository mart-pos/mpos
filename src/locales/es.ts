const es = {
  common: {
    refresh: "Refrescar",
    settings: "Configuracion",
    close: "Cerrar",
    cancel: "Cancelar",
    save: "Guardar",
    reset: "Resetear",
    reviewPrinter: "Revisar impresora",
    openMartpos: "Abrir MartPOS",
    undefined: "Sin definir",
    noName: "Sin nombre",
    noBrand: "Sin marca",
    notApplicable: "No aplica",
    notRecorded: "Sin registro",
    unknownBrand: "Marca no identificada",
    connected: "Conectado",
    reconnecting: "Reconectando",
  },
  auth: {
    connectedTitle: "Conexion lista",
    connectedSubtitle: "Este equipo ya esta vinculado con Mart POS",
    linkedRecently: "Vinculado hace poco",
    linkedSeconds: "Vinculado hace unos segundos",
    linkedSecondsExact: "Vinculado hace {{count}} segundos",
    linkedMinutes: "Vinculado hace {{count}} min",
    linkedHours: "Vinculado hace {{count}} h",
    linkedDays: "Vinculado hace {{count}} d",
    forgetConnection: "Olvidar conexion",
    forgetDialogTitle: "Olvidar conexion",
    forgetDialogDescription:
      "Esta accion desvinculara este equipo de MartPOS. Tendras que volver a conectarlo para usarlo otra vez.",
    forgetConfirm: "Si, olvidar",
    title: "Conecta con MartPOS",
    subtitle: "Elige como quieres vincular este equipo",
    automaticTab: "Automatico",
    manualTab: "Codigo manual",
    manualTitle: "Codigo de vinculacion",
    manualDescription:
      "Copia este codigo y pegalo en MartPOS si prefieres completar la vinculacion manualmente",
    generateCode: "Generar codigo",
    copied: "Copiado",
    copy: "Copiar",
    codeExpiresIn: "Este codigo vence en {{time}}",
    generateCodeHint: "Genera un codigo para vincular este equipo",
    automaticTitle: "Vinculacion automatica",
    automaticDescription:
      "Abre MartPOS y completa la vinculacion sin copiar codigos",
    waitingConfirmation: "Esperando confirmacion...",
  },
  printers: {
    title: "Impresoras",
    manageConnected: "Gestiona tus impresoras conectadas. {{ready}} de {{total}} listas.",
    defaultMissingTitle: "Falta una impresora principal",
    defaultMissingDescription:
      "Elige una impresora lista para recibos antes de imprimir desde MartPOS.",
    useSuggested: "Usar sugerida",
    emptyTitle: "Todavia no encontramos impresoras",
    emptyDescription:
      "Conecta la impresora, enciendela y luego refresca la lista. Si es USB, revisa que este conectada directo a esta computadora.",
    emptyStep1: "1. Conecta la impresora y enciendela.",
    emptyStep2: "2. Espera unos segundos para que el sistema la detecte.",
    emptyStep3: "3. Pulsa refrescar.",
    openSupport: "Abrir soporte",
    primary: "Principal",
    useAsPrimary: "Usar como principal",
    details: "Ver detalles",
    printTestTicket: "Imprimir ticket de prueba",
    reprintLastReceipt: "Reimprimir ultimo recibo",
    status: {
      online: "Conectada",
      offline: "Desconectada",
      unknown: "Sin confirmar",
    },
    connection: {
      usb: "USB",
      system: "Sistema",
      network: "Red",
      bluetooth: "Bluetooth",
    },
    type: {
      thermal: "Termica",
      inkjet: "Inyeccion",
      laser: "Laser",
      label: "Etiquetas",
      unknown: "Sin definir",
    },
    paper: {
      mm58: "58 mm",
      mm80: "80 mm",
      unknown: "Sin definir",
    },
    diagnostics: {
      title: "Diagnostico guiado",
      subtitle: "Abre esto si algo no conecta, no aparece o no imprime.",
      liveSocket: "Socket en vivo",
      martposState: "Estado MartPOS",
      martposLinked: "Vinculado",
      martposPending: "Pendiente de vinculacion",
      allowedOrigin: "Origen permitido",
      defaultPrinter: "Impresora principal",
      readyPrinters: "Impresoras listas",
      onlineCount: "{{ready}} de {{online}} en linea",
      allGoodTitle: "Todo se ve bien",
      allGoodDescription:
        "MartPOS, impresoras y bridge local parecen estar listos.",
      whatIfNoPrintTitle: "Que hacer si no imprime",
      whatIfNoPrintDescription:
        "Revisa la principal, imprime una prueba y ajusta el perfil si hace falta.",
      whatIfMissingTitle: "Que hacer si no aparece",
      whatIfMissingDescription:
        "Conecta la impresora, espera unos segundos y verifica si el estado cambia solo.",
      issues: {
        bridgeTitle: "MartPOS todavia no esta vinculado",
        bridgeDetail:
          "Abre MartPOS desde aqui y termina la vinculacion en este equipo.",
        noPrintersTitle: "No encontramos impresoras",
        noPrintersDetail:
          "Conecta la impresora y usa refrescar para volver a buscarla.",
        notReceiptReadyTitle:
          "Hay impresoras detectadas pero no listas para recibos",
        notReceiptReadyDetail:
          "Revisa la impresora principal o ajusta el perfil para recibos.",
      },
    },
    profile: {
      title: "Ajustar {{name}}",
      description:
        "Cambia solo lo que necesites para que el ticket salga bien.",
      info: "Informacion",
      settings: "Ajustes",
      advanced: "Avanzado",
      fields: {
        name: "Nombre",
        brandModel: "Marca y modelo",
        connection: "Conexion",
        status: "Estado",
        driver: "Driver",
        systemQueue: "Cola del sistema",
        vendorProduct: "Vendor / Product",
        series: "Serie",
        type: "Tipo",
        paper: "Papel",
        charsPerLine: "Texto por linea",
        encoding: "Encoding",
        rawDevicePath: "Ruta del dispositivo",
      },
      switches: {
        receiptReady: "Lista para recibos",
        autoCut: "Corte automatico",
        cashDrawer: "Abrir cajon",
        qrAndBarcode: "QR y barras",
        qrAndBarcodeHelp:
          "Activa si esta impresora maneja QR o codigos de barras en recibos.",
        advancedUsb: "Impresion USB avanzada",
      },
      advancedTitle: "Soporte USB especial",
      advancedDescription:
        "Solo usa esto si soporte te lo pide para una impresora USB especial.",
    },
  },
  settings: {
    title: "Configuracion",
    description:
      "Ajustes simples para el uso diario. Se guardan automaticamente.",
    language: "Idioma",
    theme: "Tema",
    selectTheme: "Selecciona un tema",
    locales: {
      "es-EC": "Español",
      "en-US": "English",
      "fr-FR": "Frances",
      "pt-BR": "Portugues",
    },
    themes: {
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
    },
  },
  support: {
    martposNeedsAttention: "Mart POS necesita atencion",
  },
  messages: {
    refreshPrintersSuccess: "Lista de impresoras actualizada.",
    refreshPrintersError: "No se pudo actualizar la lista de impresoras.",
    defaultPrinterUpdated: "Impresora principal actualizada.",
    defaultPrinterError: "No se pudo guardar la impresora principal.",
    printTestSent: "Prueba enviada a la impresora.",
    printTestError: "No se pudo imprimir la prueba.",
    printDirectFailed:
      "No se pudo enviar directo a la impresora. Se genero un archivo de apoyo con {{driver}} en {{path}}.",
    reprintDirectFailed:
      "No se pudo reimprimir directo. Se genero un archivo de apoyo con {{driver}} en {{path}}.",
    reprintSuccess: "Ultimo recibo real reenviado a impresion.",
    reprintError: "No se pudo reimprimir el ultimo recibo.",
    configSaved: "Ajustes guardados.",
    configSaveError: "No se pudieron guardar los ajustes.",
    printerProfileSaved: "Ajustes de impresora guardados.",
    printerProfileError: "No se pudo guardar esta impresora.",
    pairingCodeReady: "Codigo listo para vincular MartPOS.",
    pairingPrepareError:
      "No se pudo preparar la vinculacion. Cierra y vuelve a abrir MPOS Core si el problema sigue.",
    pairingPrepareMartposError:
      "No se pudo preparar la vinculacion con MartPOS.",
    pairingCodeCopied: "Codigo copiado.",
    martposOpened: "MartPOS se abrio para terminar la vinculacion.",
    martposOpenError:
      "No pudimos abrir MartPOS o terminar la vinculacion. Revisa que MartPOS este instalado y abierto en este mismo equipo.",
    martposOpenFallback: "No se pudo abrir MartPOS.",
    bridgeForgotten:
      "Se desvinculo MartPOS en este equipo. Para volver a conectarlo, haz pairing de nuevo.",
    bridgeForgetError: "No se pudo desvincular MartPOS.",
    syncPairingError:
      "No pudimos confirmar la vinculacion con MartPOS. Si MartPOS ya estaba abierto, intenta abrir la vinculacion otra vez.",
    syncPairingStateError: "No se pudo actualizar la vinculacion con MartPOS.",
    networkSuffix:
      "{{fallback}} Revisa que MartPOS y MPOS Core esten abiertos en este mismo equipo.",
    originNotAllowed:
      "MartPOS intento conectar desde un origen no permitido. Revisa el entorno actual de MartPOS y vuelve a abrir la vinculacion.",
    pairingExpired:
      "La vinculacion vencio o ya no es valida. Genera un codigo nuevo y vuelve a intentar.",
    noDefaultPrinterConfigured:
      "Todavia no hay una impresora principal. Elige una impresora lista para poder imprimir.",
    printSent: "Impresion enviada correctamente.",
    previewPrepared: "Se preparo una vista de apoyo para completar la impresion.",
    queuedToSystem: "La impresion fue enviada a la cola del sistema.",
  },
} as const;

export default es;
