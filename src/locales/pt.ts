const pt = {
  common: {
    refresh: "Atualizar",
    settings: "Configuracoes",
    close: "Fechar",
    cancel: "Cancelar",
    save: "Salvar",
    reset: "Redefinir",
    reviewPrinter: "Revisar impressora",
    openMartpos: "Abrir MartPOS",
    undefined: "Nao definido",
    noName: "Sem nome",
    noBrand: "Sem marca",
    notApplicable: "Nao se aplica",
    notRecorded: "Sem registro",
    unknownBrand: "Marca desconhecida",
    connected: "Conectado",
    reconnecting: "Reconectando",
  },
  auth: {
    connectedTitle: "Conexao pronta",
    connectedSubtitle: "Este computador ja esta vinculado ao Mart POS",
    linkedRecently: "Vinculado recentemente",
    linkedSeconds: "Vinculado ha alguns segundos",
    linkedSecondsExact: "Vinculado ha {{count}} segundos",
    linkedMinutes: "Vinculado ha {{count}} min",
    linkedHours: "Vinculado ha {{count}} h",
    linkedDays: "Vinculado ha {{count}} d",
    forgetConnection: "Esquecer conexao",
    forgetDialogTitle: "Esquecer conexao",
    forgetDialogDescription:
      "Esta acao desvinculara este computador do MartPOS. Voce precisara conecta-lo novamente para usa-lo outra vez.",
    forgetConfirm: "Sim, esquecer",
    title: "Conectar ao MartPOS",
    subtitle: "Escolha como deseja vincular este computador",
    automaticTab: "Automatico",
    manualTab: "Codigo manual",
    manualTitle: "Codigo de vinculacao",
    manualDescription:
      "Copie este codigo e cole no MartPOS se preferir concluir a vinculacao manualmente",
    generateCode: "Gerar codigo",
    copied: "Copiado",
    copy: "Copiar",
    codeExpiresIn: "Este codigo expira em {{time}}",
    generateCodeHint: "Gere um codigo para vincular este computador",
    automaticTitle: "Vinculacao automatica",
    automaticDescription:
      "Abra o MartPOS e conclua a vinculacao sem copiar codigos",
    waitingConfirmation: "Aguardando confirmacao...",
  },
  printers: {
    title: "Impressoras",
    manageConnected:
      "Gerencie suas impressoras conectadas. {{ready}} de {{total}} prontas.",
    defaultMissingTitle: "Falta uma impressora padrao",
    defaultMissingDescription:
      "Escolha uma impressora pronta para recibos antes de imprimir pelo MartPOS.",
    useSuggested: "Usar sugerida",
    emptyTitle: "Ainda nao encontramos impressoras",
    emptyDescription:
      "Conecte a impressora, ligue-a e depois atualize a lista. Se for USB, verifique se esta conectada diretamente a este computador.",
    emptyStep1: "1. Conecte a impressora e ligue-a.",
    emptyStep2: "2. Aguarde alguns segundos para o sistema detecta-la.",
    emptyStep3: "3. Pressione atualizar.",
    openSupport: "Abrir suporte",
    primary: "Principal",
    useAsPrimary: "Usar como principal",
    details: "Ver detalhes",
    printTestTicket: "Imprimir ticket de teste",
    reprintLastReceipt: "Reimprimir ultimo recibo",
    status: {
      online: "Conectada",
      offline: "Desconectada",
      unknown: "Nao confirmada",
    },
    connection: {
      usb: "USB",
      system: "Sistema",
      network: "Rede",
      bluetooth: "Bluetooth",
    },
    type: {
      thermal: "Termica",
      inkjet: "Jato de tinta",
      laser: "Laser",
      label: "Etiquetas",
      unknown: "Nao definido",
    },
    paper: {
      mm58: "58 mm",
      mm80: "80 mm",
      unknown: "Nao definido",
    },
    diagnostics: {
      title: "Diagnostico guiado",
      subtitle:
        "Abra isto se algo nao conectar, nao aparecer ou nao imprimir.",
      liveSocket: "Socket ao vivo",
      martposState: "Estado do MartPOS",
      martposLinked: "Vinculado",
      martposPending: "Vinculacao pendente",
      allowedOrigin: "Origem permitida",
      defaultPrinter: "Impressora principal",
      readyPrinters: "Impressoras prontas",
      onlineCount: "{{ready}} de {{online}} online",
      allGoodTitle: "Tudo parece bem",
      allGoodDescription:
        "MartPOS, impressoras e bridge local parecem estar prontos.",
      whatIfNoPrintTitle: "O que fazer se nao imprimir",
      whatIfNoPrintDescription:
        "Revise a principal, imprima um teste e ajuste o perfil se necessario.",
      whatIfMissingTitle: "O que fazer se nao aparecer",
      whatIfMissingDescription:
        "Conecte a impressora, aguarde alguns segundos e verifique se o estado muda sozinho.",
      issues: {
        bridgeTitle: "MartPOS ainda nao esta vinculado",
        bridgeDetail:
          "Abra o MartPOS daqui e conclua a vinculacao neste computador.",
        noPrintersTitle: "Nao encontramos impressoras",
        noPrintersDetail:
          "Conecte a impressora e use atualizar para procurar novamente.",
        notReceiptReadyTitle:
          "Foram detectadas impressoras, mas elas nao estao prontas para recibos",
        notReceiptReadyDetail:
          "Revise a impressora principal ou ajuste o perfil de recibo.",
      },
    },
    profile: {
      title: "Ajustar {{name}}",
      description:
        "Altere apenas o necessario para que o ticket saia corretamente.",
      info: "Informacoes",
      settings: "Configuracoes",
      advanced: "Avancado",
      fields: {
        name: "Nome",
        brandModel: "Marca e modelo",
        connection: "Conexao",
        status: "Estado",
        driver: "Driver",
        systemQueue: "Fila do sistema",
        vendorProduct: "Vendor / Product",
        series: "Serie",
        type: "Tipo",
        paper: "Papel",
        charsPerLine: "Texto por linha",
        encoding: "Encoding",
        rawDevicePath: "Caminho do dispositivo",
      },
      switches: {
        receiptReady: "Pronta para recibos",
        autoCut: "Corte automatico",
        cashDrawer: "Abrir gaveta",
        qrAndBarcode: "QR e codigo de barras",
        qrAndBarcodeHelp:
          "Ative isto se a impressora lidar com QR ou codigos de barras em recibos.",
        advancedUsb: "Impressao USB avancada",
      },
      advancedTitle: "Suporte USB especial",
      advancedDescription:
        "Use isto somente se o suporte solicitar para uma impressora USB especial.",
    },
  },
  settings: {
    title: "Configuracoes",
    description:
      "Ajustes simples para o uso diario. Eles sao salvos automaticamente.",
    language: "Idioma",
    theme: "Tema",
    selectTheme: "Selecione um tema",
    locales: {
      "es-EC": "Espanhol",
      "en-US": "Ingles",
      "fr-FR": "Frances",
      "pt-BR": "Portugues",
    },
    themes: {
      light: "Claro",
      dark: "Escuro",
      system: "Sistema",
    },
  },
  support: {
    martposNeedsAttention: "Mart POS precisa de atencao",
  },
  messages: {
    refreshPrintersSuccess: "Lista de impressoras atualizada.",
    refreshPrintersError: "Nao foi possivel atualizar a lista de impressoras.",
    defaultPrinterUpdated: "Impressora principal atualizada.",
    defaultPrinterError: "Nao foi possivel salvar a impressora principal.",
    printTestSent: "Teste enviado para a impressora.",
    printTestError: "Nao foi possivel imprimir o teste.",
    printDirectFailed:
      "Nao foi possivel enviar diretamente para a impressora. Um arquivo auxiliar foi gerado com {{driver}} em {{path}}.",
    reprintDirectFailed:
      "Nao foi possivel reimprimir diretamente. Um arquivo auxiliar foi gerado com {{driver}} em {{path}}.",
    reprintSuccess: "Ultimo recibo real reenviado para impressao.",
    reprintError: "Nao foi possivel reimprimir o ultimo recibo.",
    configSaved: "Configuracoes salvas.",
    configSaveError: "Nao foi possivel salvar as configuracoes.",
    printerProfileSaved: "Configuracoes da impressora salvas.",
    printerProfileError: "Nao foi possivel salvar esta impressora.",
    pairingCodeReady: "Codigo pronto para vincular o MartPOS.",
    pairingPrepareError:
      "Nao foi possivel preparar a vinculacao. Feche e abra novamente o MPOS Core se o problema continuar.",
    pairingPrepareMartposError:
      "Nao foi possivel preparar a vinculacao com o MartPOS.",
    pairingCodeCopied: "Codigo copiado.",
    martposOpened: "MartPOS foi aberto para concluir a vinculacao.",
    martposOpenError:
      "Nao foi possivel abrir o MartPOS ou concluir a vinculacao. Verifique se o MartPOS esta instalado e aberto neste mesmo computador.",
    martposOpenFallback: "Nao foi possivel abrir o MartPOS.",
    bridgeForgotten:
      "MartPOS foi desvinculado neste computador. Para conecta-lo novamente, faca o pareamento outra vez.",
    bridgeForgetError: "Nao foi possivel desvincular o MartPOS.",
    syncPairingError:
      "Nao foi possivel confirmar a vinculacao com o MartPOS. Se o MartPOS ja estava aberto, tente abrir a vinculacao novamente.",
    syncPairingStateError:
      "Nao foi possivel atualizar a vinculacao com o MartPOS.",
    networkSuffix:
      "{{fallback}} Verifique se o MartPOS e o MPOS Core estao abertos neste mesmo computador.",
    originNotAllowed:
      "MartPOS tentou conectar a partir de uma origem nao permitida. Verifique o ambiente atual do MartPOS e abra a vinculacao novamente.",
    pairingExpired:
      "A vinculacao expirou ou nao e mais valida. Gere um novo codigo e tente novamente.",
    noDefaultPrinterConfigured:
      "Ainda nao ha uma impressora principal. Escolha uma impressora pronta para poder imprimir.",
    printSent: "Impressao enviada com sucesso.",
    previewPrepared:
      "Uma visualizacao auxiliar foi preparada para concluir a impressao.",
    queuedToSystem:
      "A impressao foi enviada para a fila do sistema.",
  },
} as const;

export default pt;
