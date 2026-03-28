import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertCircleIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  PrinterIcon,
  RefreshCwIcon,
  Settings2Icon,
  EyeIcon,
  StarIcon,
  ChevronDown,
} from "lucide-react";

import { SectionTitle, Text } from "@/components/Typography";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { connectBridgeEvents } from "./lib/martpos-bridge-sdk";
import i18n, { normalizeLanguage } from "./lib/i18n";
import { fallbackBootstrap } from "./mocks/bootstrap";
import { cn } from "./lib/utils";
import type {
  BootstrapPayload,
  BridgeRealtimeEvent,
  PaperWidth,
  PrinterType,
  ResolvedPrinter,
  ThemeMode,
} from "./types/bootstrap";
import { AuthVerification } from "./components/auth";

const appIconPath = "/icon.png";

const printerTypes: PrinterType[] = [
  "thermal",
  "inkjet",
  "laser",
  "label",
  "unknown",
];

const paperWidths: PaperWidth[] = ["mm58", "mm80", "unknown"];
const themeModes: ThemeMode[] = ["light", "dark", "system"];

type PrinterProfileDraft = {
  printerId: string;
  kind: PrinterType;
  paperWidthMm: PaperWidth;
  receiptCapable: boolean;
  charsPerLineNormal: number;
  charsPerLineCompressed: number;
  encoding: string;
  supportsCut: boolean;
  supportsCashDrawer: boolean;
  supportsQr: boolean;
  supportsBarcode: boolean;
  rawSupport: boolean;
  rawDevicePath: string;
};

function buildPrinterDraft(printer: ResolvedPrinter): PrinterProfileDraft {
  return {
    printerId: printer.id,
    kind: printer.type,
    paperWidthMm: printer.profile.paperWidthMm,
    receiptCapable: printer.receiptCapable,
    charsPerLineNormal: printer.profile.charsPerLineNormal,
    charsPerLineCompressed: printer.profile.charsPerLineCompressed,
    encoding: printer.profile.encoding,
    supportsCut: printer.profile.supportsCut,
    supportsCashDrawer: printer.profile.supportsCashDrawer,
    supportsQr: printer.profile.supportsQr,
    supportsBarcode: printer.profile.supportsBarcode,
    rawSupport: printer.profile.rawSupport,
    rawDevicePath: printer.profile.rawDevicePath ?? "",
  };
}

function statusTone(status: ResolvedPrinter["status"]) {
  if (status === "online") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "offline") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return "border-border bg-muted text-muted-foreground";
}

function statusText(status: ResolvedPrinter["status"], t: TFunction) {
  if (status === "online") {
    return t("printers.status.online");
  }
  if (status === "offline") {
    return t("printers.status.offline");
  }
  return t("printers.status.unknown");
}

function connectionLabel(value: string, t: TFunction) {
  switch (value) {
    case "usb":
      return "USB";
    case "system":
      return t("printers.connection.system");
    case "network":
      return t("printers.connection.network");
    case "bluetooth":
      return "Bluetooth";
    default:
      return value;
  }
}

function typeLabel(value: PrinterType, t: TFunction) {
  switch (value) {
    case "thermal":
      return t("printers.type.thermal");
    case "inkjet":
      return t("printers.type.inkjet");
    case "laser":
      return t("printers.type.laser");
    case "label":
      return t("printers.type.label");
    default:
      return t("printers.type.unknown");
  }
}

function paperLabel(value: PaperWidth, t: TFunction) {
  switch (value) {
    case "mm58":
      return "58 mm";
    case "mm80":
      return "80 mm";
    default:
      return t("printers.paper.unknown");
  }
}

function explainError(error: unknown, fallback: string, t: TFunction) {
  const text = String(error ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (
    text.includes("Failed to fetch") ||
    text.includes("network") ||
    text.includes("timed out")
  ) {
    return t("messages.networkSuffix", { fallback });
  }

  if (text.includes("origin not allowed")) {
    return t("messages.originNotAllowed");
  }

  if (
    text.includes("invalid pairing code") ||
    text.includes("pairing session")
  ) {
    return t("messages.pairingExpired");
  }

  if (text.includes("no default printer configured")) {
    return t("messages.noDefaultPrinterConfigured");
  }

  return text;
}

function explainPrintDetail(detail: string | null | undefined, fallback: string, t: TFunction) {
  const text = (detail ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (
    text.includes("usb bulk endpoint") ||
    text.includes("sent ") ||
    text.includes("bytes via")
  ) {
    return t("messages.printSent");
  }

  if (text.includes("preview") || text.includes("html")) {
    return t("messages.previewPrepared");
  }

  if (text.includes("spool") || text.includes("queue")) {
    return t("messages.queuedToSystem");
  }

  return text;
}

function SwitchRow({
  label,
  helper,
  checked,
  onCheckedChange,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1">
        <Text weight="medium">{label}</Text>
        {helper ? (
          <Text variant="caption" className="mt-1">
            {helper}
          </Text>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function App() {
  const { setTheme } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<BootstrapPayload>(fallbackBootstrap);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [refreshCooldownSeconds, setRefreshCooldownSeconds] = useState(0);
  const [printCooldownActive, setPrintCooldownActive] = useState(false);
  const refreshInFlightRef = useRef(false);
  const printInFlightRef = useRef(false);
  const [pairingLiveMode, setPairingLiveMode] = useState(false);
  const [pairingLaunchPending, setPairingLaunchPending] = useState(false);
  const [martposIssue, setMartposIssue] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileDialogPrinterId, setProfileDialogPrinterId] = useState<
    string | null
  >(null);
  const [configDraft, setConfigDraft] = useState({
    locale: fallbackBootstrap.config.locale,
    theme: fallbackBootstrap.config.theme,
  });
  const [printerDraft, setPrinterDraft] = useState<PrinterProfileDraft | null>(
    null,
  );
  const localeOptions = [
    { value: "es-EC", country: "es" },
    { value: "en-US", country: "us" },
    { value: "fr-FR", country: "fr" },
    { value: "pt-BR", country: "br" },
  ] as const;
  const selectedLocaleOption =
    localeOptions.find((option) => option.value === configDraft.locale) ??
    localeOptions[0];

  useEffect(() => {
    void i18n.changeLanguage(normalizeLanguage(data.config.locale));
  }, [data.config.locale]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const payload = await invoke<BootstrapPayload>("get_bootstrap_state");
        if (mounted) {
          syncBootstrap(payload);
        }
      } catch {
        if (mounted) {
          syncBootstrap(fallbackBootstrap);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!pairingLiveMode && !data.pairing.active) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        const payload = await invoke<BootstrapPayload>("get_bootstrap_state");

        if (!cancelled) {
          syncBootstrap(payload);
          if (payload.bridge.connected) {
            setMartposIssue(null);
            setPairingLaunchPending(false);
          }
          if (!payload.pairing.active) {
            setPairingLiveMode(false);
          }
        }
      } catch {
        if (!cancelled) {
          setMartposIssue(
            t("messages.syncPairingError"),
          );
          setMessage(t("messages.syncPairingStateError"));
        }
      }
    };

    void sync();
    const interval = window.setInterval(() => {
      void sync();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [data.pairing.active, pairingLiveMode, t]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        const url = await invoke<string>("get_realtime_socket_url");
        if (cancelled) {
          return;
        }

        socket = connectBridgeEvents(url, {
          onOpen: () => {
            if (!cancelled) {
              setSocketConnected(true);
            }
          },
          onClose: () => {
            if (!cancelled) {
              setSocketConnected(false);
              reconnectTimer = window.setTimeout(() => {
                void connect();
              }, 2000);
            }
          },
          onError: () => {
            if (!cancelled) {
              setSocketConnected(false);
            }
          },
          onEvent: (event: BridgeRealtimeEvent) => {
            if (cancelled) {
              return;
            }

            syncBootstrap(event.payload);

            if (event.event === "bridge.connected") {
              setMartposIssue(null);
              setPairingLiveMode(false);
              setPairingLaunchPending(false);
            }

            if (event.event === "bridge.forgotten") {
              setPairingLaunchPending(false);
            }
          },
        });
      } catch {
        if (!cancelled) {
          setSocketConnected(false);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      setSocketConnected(false);
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      socket?.close();
    };
  }, []);

  useEffect(() => {
    if (settingsOpen || profileDialogPrinterId) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      if (refreshInFlightRef.current || loading || socketConnected) {
        return;
      }

      try {
        const payload = await invoke<BootstrapPayload>("get_bootstrap_state");

        if (!cancelled) {
          syncBootstrap(payload);
        }
      } catch {
        // Silent on purpose. This runs in the background only to keep the UI fresh.
      }
    };

    const interval = window.setInterval(() => {
      void sync();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loading, profileDialogPrinterId, settingsOpen, socketConnected]);

  useEffect(() => {
    if (!message) {
      return;
    }

    if (/no se pudo|failed|invalid|could not/i.test(message)) {
      toast.error(message);
    } else {
      toast.success(message);
    }

    setMessage(null);
  }, [message]);

  useEffect(() => {
    if (refreshCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setRefreshCooldownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [refreshCooldownSeconds]);

  useEffect(() => {
    if (!printCooldownActive) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPrintCooldownActive(false);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [printCooldownActive]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    if (
      configDraft.locale === data.config.locale &&
      configDraft.theme === data.config.theme
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleSaveConfig(true);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    configDraft.locale,
    configDraft.theme,
    data.config.locale,
    data.config.theme,
    settingsOpen,
  ]);

  function syncBootstrap(payload: BootstrapPayload) {
    setData(payload);
    setConfigDraft({
      locale: payload.config.locale,
      theme: payload.config.theme,
    });
    setTheme(payload.config.theme);
    setPrinterDraft((current) => {
      if (!current) {
        return null;
      }

      const updated = payload.printers.find(
        (printer) => printer.id === current.printerId,
      );

      return updated ? buildPrinterDraft(updated) : null;
    });
  }

  async function refreshPrinters() {
    if (refreshInFlightRef.current || refreshCooldownSeconds > 0) {
      return;
    }

    refreshInFlightRef.current = true;
    setRefreshCooldownSeconds(30);
    setLoading(true);
    try {
      const payload = await invoke<BootstrapPayload>("refresh_printers");
      syncBootstrap(payload);
      setMessage(t("messages.refreshPrintersSuccess"));
    } catch {
      setMessage(t("messages.refreshPrintersError"));
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function handleSetDefault(printerId: string) {
    try {
      const payload = await invoke<BootstrapPayload>("set_default_printer", {
        payload: { printerId },
      });
      syncBootstrap(payload);
      setMessage(t("messages.defaultPrinterUpdated"));
    } catch (error) {
      setMessage(explainError(error, t("messages.defaultPrinterError"), t));
    }
  }

  async function handlePrintTest(printerId?: string) {
    if (printInFlightRef.current || printCooldownActive) {
      return;
    }

    printInFlightRef.current = true;
    setPrintCooldownActive(true);
    try {
      const result = await invoke<{
        detail: string;
        previewPath?: string | null;
        submitted: boolean;
        driver: string;
      }>("print_test_ticket", {
        payload: { printerId },
      });

      if (result.previewPath) {
        setMessage(
          t("messages.printDirectFailed", {
            driver: result.driver,
            path: result.previewPath,
          }),
        );
      } else {
        setMessage(explainPrintDetail(result.detail, t("messages.printTestSent"), t));
      }
    } catch (error) {
      setMessage(explainError(error, t("messages.printTestError"), t));
    } finally {
      printInFlightRef.current = false;
    }
  }

  async function handlePrintLastReceipt(printer?: ResolvedPrinter) {
    if (printInFlightRef.current || printCooldownActive) {
      return;
    }

    printInFlightRef.current = true;
    setPrintCooldownActive(true);
    try {
      const result = await invoke<{
        detail: string;
        previewPath?: string | null;
        submitted: boolean;
        driver: string;
      }>("reprint_last_receipt", {
        payload: { printerId: printer?.id },
      });

      if (result.previewPath) {
        setMessage(
          t("messages.reprintDirectFailed", {
            driver: result.driver,
            path: result.previewPath,
          }),
        );
      } else {
        setMessage(
          explainPrintDetail(result.detail, t("messages.reprintSuccess"), t),
        );
      }
    } catch (error) {
      setMessage(explainError(error, t("messages.reprintError"), t));
    } finally {
      printInFlightRef.current = false;
    }
  }

  async function handleSaveConfig(silent = false) {
    try {
      const payload = await invoke<BootstrapPayload>("update_runtime_config", {
        payload: {
          locale: configDraft.locale,
          theme: configDraft.theme,
          apiPort: data.config.apiPort,
          requestTimeoutMs: data.config.requestTimeoutMs,
          fallbackPolicy: data.config.fallbackPolicy,
          autoDefault: true,
          allowRawPrinting: true,
          allowedOrigin: data.config.allowedOrigin,
        },
      });
      syncBootstrap(payload);
      if (!silent) {
        setMessage(t("messages.configSaved"));
      }
    } catch (error) {
      setMessage(explainError(error, t("messages.configSaveError"), t));
    }
  }

  async function handleSavePrinterProfile() {
    if (!printerDraft) {
      return;
    }

    try {
      const payload = await invoke<BootstrapPayload>("update_printer_profile", {
        payload: {
          printerId: printerDraft.printerId,
          kind: printerDraft.kind,
          paperWidthMm: printerDraft.paperWidthMm,
          receiptCapable: printerDraft.receiptCapable,
          charsPerLineNormal: Number(printerDraft.charsPerLineNormal),
          charsPerLineCompressed: Number(printerDraft.charsPerLineCompressed),
          encoding: printerDraft.encoding,
          supportsCut: printerDraft.supportsCut,
          supportsCashDrawer: printerDraft.supportsCashDrawer,
          supportsQr: printerDraft.supportsQr,
          supportsBarcode: printerDraft.supportsBarcode,
          rawSupport: printerDraft.rawSupport,
          rawDevicePath: printerDraft.rawDevicePath,
        },
      });
      syncBootstrap(payload);
      const updated = payload.printers.find(
        (printer) => printer.id === printerDraft.printerId,
      );
      if (updated) {
        setPrinterDraft(buildPrinterDraft(updated));
      }
      setMessage(t("messages.printerProfileSaved"));
      setProfileDialogPrinterId(null);
    } catch (error) {
      setMessage(explainError(error, t("messages.printerProfileError"), t));
    }
  }

  function openProfileDialog(printer: ResolvedPrinter) {
    setPrinterDraft(buildPrinterDraft(printer));
    setProfileDialogPrinterId(printer.id);
  }

  async function handleOpenPairing() {
    try {
      const pairing = await invoke<BootstrapPayload["pairing"]>(
        "ensure_pairing_session",
      );
      setData((current) => ({ ...current, pairing }));
      setPairingLiveMode(true);
      setMartposIssue(null);
      setMessage(t("messages.pairingCodeReady"));
    } catch (error) {
      setMartposIssue(t("messages.pairingPrepareError"));
      setMessage(explainError(error, t("messages.pairingPrepareMartposError"), t));
    }
  }

  async function handleCopyPairingCode() {
    if (!data.pairing.code || !navigator?.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(data.pairing.code);
    setMessage(t("messages.pairingCodeCopied"));
  }

  async function handleLaunchMartposPairing() {
    try {
      setPairingLaunchPending(true);
      const result = await invoke<{
        url: string;
        pairing: BootstrapPayload["pairing"];
      }>("launch_martpos_pairing");
      setData((current) => ({ ...current, pairing: result.pairing }));
      setPairingLiveMode(true);
      setMartposIssue(null);
      setMessage(t("messages.martposOpened"));
    } catch (error) {
      setPairingLaunchPending(false);
      setMartposIssue(t("messages.martposOpenError"));
      setMessage(explainError(error, t("messages.martposOpenFallback"), t));
    }
  }

  async function handleForgetBridge() {
    try {
      const payload = await invoke<BootstrapPayload>("regenerate_api_token");
      syncBootstrap(payload);
      setPairingLiveMode(false);
      setPairingLaunchPending(false);
      setMartposIssue(null);
      setMessage(t("messages.bridgeForgotten"));
    } catch (error) {
      setMessage(explainError(error, t("messages.bridgeForgetError"), t));
    }
  }

  const defaultPrinter = data.printers.find(
    (printer) => printer.id === data.config.defaultPrinterId,
  );

  const profileDialogPrinter =
    data.printers.find((printer) => printer.id === profileDialogPrinterId) ??
    null;

  const onlinePrinters = data.printers.filter(
    (printer) => printer.status === "online",
  );
  const readyPrinters = data.printers.filter(
    (printer) => printer.status === "online" && printer.receiptCapable,
  ).length;
  const firstReadyPrinter = data.printers.find(
    (printer) => printer.status === "online" && printer.receiptCapable,
  );
  const diagnosisItems = [
    !data.bridge.connected
      ? {
          title: t("printers.diagnostics.issues.bridgeTitle"),
          detail: t("printers.diagnostics.issues.bridgeDetail"),
          action: (
            <Button
              type="button"
              variant="outline"
              onClick={handleLaunchMartposPairing}
            >
              {t("common.openMartpos")}
            </Button>
          ),
        }
      : null,
    data.printers.length === 0
      ? {
          title: t("printers.diagnostics.issues.noPrintersTitle"),
          detail: t("printers.diagnostics.issues.noPrintersDetail"),
          action: (
            <Button
              type="button"
              variant="outline"
              onClick={refreshPrinters}
              disabled={loading || refreshCooldownSeconds > 0}
            >
              {t("common.refresh")}
            </Button>
          ),
        }
      : null,
    data.printers.length > 0 && readyPrinters === 0
      ? {
          title: t("printers.diagnostics.issues.notReceiptReadyTitle"),
          detail: t("printers.diagnostics.issues.notReceiptReadyDetail"),
          action: firstReadyPrinter ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={() => openProfileDialog(data.printers[0])}
            >
              {t("common.reviewPrinter")}
            </Button>
          ),
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    detail: string;
    action: ReactNode | null;
  }>;
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={appIconPath}
              alt="MPOS Core"
              className="size-10 rounded-lg object-cover"
            />
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 cursor-pointer"
                  onClick={refreshPrinters}
                  disabled={loading || refreshCooldownSeconds > 0}
                >
                  {loading ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <RefreshCwIcon />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>
                {refreshCooldownSeconds > 0
                  ? `${t("common.refresh")} ${t("common.reconnecting").toLowerCase()} ${refreshCooldownSeconds}s`
                  : t("common.refresh")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 cursor-pointer"
                  onClick={handleLaunchMartposPairing}
                >
                  <ExternalLinkIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>{t("common.openMartpos")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 cursor-pointer"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>{t("common.settings")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl gap-4 flex-col px-6 py-6">
        {martposIssue && !data.bridge.connected ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <Text weight="medium">{t("support.martposNeedsAttention")}</Text>
              <Text variant="caption" className="mt-1">
                {martposIssue}
              </Text>
            </div>
          </div>
        ) : null}
        {!data.bridge.connected && (
          <AuthVerification
            connected={data.bridge.connected}
            pairingCode={data.pairing.code}
            pairingExpiresAt={data.pairing.expiresAt}
            pairingActive={data.pairing.active}
            autoLinkPending={pairingLaunchPending}
            browserName={data.bridge.clientBrowser}
            machineName={data.bridge.clientMachine}
            pairedAt={data.bridge.pairedAt}
            onAutoLink={() => void handleLaunchMartposPairing()}
            onGenerateCode={() => void handleOpenPairing()}
            onCopyCode={() => handleCopyPairingCode()}
            onDisconnect={() => void handleForgetBridge()}
          />
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle>{t("printers.title")}</SectionTitle>
              <Text variant="muted">
                {t("printers.manageConnected", {
                  ready: readyPrinters,
                  total: data.printers.length,
                })}
              </Text>
            </div>
          </div>
          {data.printers.length > 0 &&
          !defaultPrinter &&
          !data.config.defaultPrinterId ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <div>
                <Text weight="medium">{t("printers.defaultMissingTitle")}</Text>
                <Text variant="caption" className="mt-1">
                  {t("printers.defaultMissingDescription")}
                </Text>
              </div>
              {firstReadyPrinter ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSetDefault(firstReadyPrinter.id)}
                >
                  {t("printers.useSuggested")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {data.printers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Text weight="medium">{t("printers.emptyTitle")}</Text>
                  <Text variant="caption" className="mt-1">
                    {t("printers.emptyDescription")}
                  </Text>
                  <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>{t("printers.emptyStep1")}</span>
                    <span>{t("printers.emptyStep2")}</span>
                    <span>{t("printers.emptyStep3")}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="lg"
                    onClick={refreshPrinters}
                    disabled={loading || refreshCooldownSeconds > 0}
                  >
                    <RefreshCwIcon />
                    {t("common.refresh")}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings2Icon />
                    {t("printers.openSupport")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border overflow-hidden">
            {data.printers.map((printer) => (
              <div
                key={printer.id}
                className="not-last:border-b not-last:border-border p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 border items-center justify-center rounded-full bg-secondary">
                      <PrinterIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Text weight="normal">{printer.name}</Text>
                      <Text variant="caption">
                        {printer.manufacturer ?? t("common.unknownBrand")}
                        {printer.model} - {printer.profile.paperWidthMm}
                      </Text>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {printer.isDefault ? (
                      <Badge variant="secondary" className="text-xs">
                        {t("printers.primary")}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusTone(printer.status)}`}
                    >
                      {statusText(printer.status, t)}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-lg"
                          className="h-8 cursor-pointer w-8"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-62.5">
                        <DropdownMenuItem
                          onClick={() => handleSetDefault(printer.id)}
                        >
                          <StarIcon />
                          {t("printers.useAsPrimary")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openProfileDialog(printer)}
                        >
                          <EyeIcon />
                          {t("printers.details")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePrintTest(printer.id)}
                          disabled={
                            printInFlightRef.current || printCooldownActive
                          }
                        >
                          <PrinterIcon />
                          {t("printers.printTestTicket")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePrintLastReceipt(printer)}
                          disabled={
                            printInFlightRef.current || printCooldownActive
                          }
                        >
                          <RefreshCwIcon />
                          {t("printers.reprintLastReceipt")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.bridge.connected && (
          <AuthVerification
            connected={data.bridge.connected}
            pairingCode={data.pairing.code}
            pairingExpiresAt={data.pairing.expiresAt}
            pairingActive={data.pairing.active}
            autoLinkPending={pairingLaunchPending}
            browserName={data.bridge.clientBrowser}
            machineName={data.bridge.clientMachine}
            pairedAt={data.bridge.pairedAt}
            onAutoLink={() => void handleLaunchMartposPairing()}
            onGenerateCode={() => void handleOpenPairing()}
            onCopyCode={() => handleCopyPairingCode()}
            onDisconnect={() => void handleForgetBridge()}
          />
        )}
        <details className="order-3 rounded-2xl border border-border ">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 border items-center justify-center rounded-full bg-secondary">
                <LifeBuoyIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <Text weight="medium">{t("printers.diagnostics.title")}</Text>
                <Text variant="caption">
                  {t("printers.diagnostics.subtitle")}
                </Text>
              </div>
            </div>
            <div className="px-2">
              <ChevronDown className="size-4 text-muted-foreground" />
            </div>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-5 py-4 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Text variant="caption">{t("printers.diagnostics.liveSocket")}</Text>
                <Text className="mt-1">
                  {socketConnected ? t("common.connected") : t("common.reconnecting")}
                </Text>
              </div>
              <div>
                <Text variant="caption">{t("printers.diagnostics.martposState")}</Text>
                <Text className="mt-1">
                  {data.bridge.connected
                    ? t("printers.diagnostics.martposLinked")
                    : t("printers.diagnostics.martposPending")}
                </Text>
              </div>
              <div>
                <Text variant="caption">{t("printers.diagnostics.allowedOrigin")}</Text>
                <Text className="mt-1">
                  {data.config.allowedOrigin ?? t("common.undefined")}
                </Text>
              </div>
              <div>
                <Text variant="caption">{t("printers.diagnostics.defaultPrinter")}</Text>
                <Text className="mt-1">
                  {defaultPrinter?.name ?? t("common.undefined")}
                </Text>
              </div>
              <div>
                <Text variant="caption">{t("printers.diagnostics.readyPrinters")}</Text>
                <Text className="mt-1">
                  {t("printers.diagnostics.onlineCount", {
                    ready: readyPrinters,
                    online: onlinePrinters.length,
                  })}
                </Text>
              </div>
            </div>

            {diagnosisItems.length > 0 ? (
              <div className="flex flex-col gap-3">
                {diagnosisItems.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
                  >
                    <div>
                      <Text weight="medium">{item.title}</Text>
                      <Text variant="caption" className="mt-1">
                        {item.detail}
                      </Text>
                    </div>
                    {item.action}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                <Text weight="medium">{t("printers.diagnostics.allGoodTitle")}</Text>
                <Text variant="caption" className="mt-1">
                  {t("printers.diagnostics.allGoodDescription")}
                </Text>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Text variant="caption">{t("printers.diagnostics.whatIfNoPrintTitle")}</Text>
                <Text className="mt-1">
                  {t("printers.diagnostics.whatIfNoPrintDescription")}
                </Text>
              </div>
              <div>
                <Text variant="caption">{t("printers.diagnostics.whatIfMissingTitle")}</Text>
                <Text className="mt-1">
                  {t("printers.diagnostics.whatIfMissingDescription")}
                </Text>
              </div>
            </div>
          </div>
        </details>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("settings.title")}</DialogTitle>
            <DialogDescription>
              {t("settings.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Text asChild weight="medium">
                <label>{t("settings.language")}</label>
              </Text>
              <Select
                value={configDraft.locale}
                onValueChange={(value) =>
                  setConfigDraft((current) => ({ ...current, locale: value }))
                }
              >
                <SelectTrigger
                  aria-label={t("settings.language")}
                  className="w-full min-w-0 cursor-pointer gap-2 sm:min-w-37"
                >
                  <SelectValue>
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "fi rounded-xs shrink-0",
                          `fi-${selectedLocaleOption.country}`,
                        )}
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {t(`settings.locales.${selectedLocaleOption.value}`)}
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {localeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "fi rounded-xs shrink-0",
                            `fi-${option.country}`,
                          )}
                          aria-hidden="true"
                        />
                        <span>{t(`settings.locales.${option.value}`)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Text asChild weight="medium">
                <label>{t("settings.theme")}</label>
              </Text>
              <Select
                value={configDraft.theme}
                onValueChange={(value) => {
                  const next = value as ThemeMode;
                  setTheme(next);
                  setConfigDraft((current) => ({ ...current, theme: next }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("settings.selectTheme")} />
                </SelectTrigger>
                <SelectContent>
                  {themeModes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`settings.themes.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setSettingsOpen(false)}
            >
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={profileDialogPrinter !== null && printerDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProfileDialogPrinterId(null);
          }
        }}
      >
        <DialogContent className="flex h-125 max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle>
              {t("printers.profile.title", {
                name: profileDialogPrinter?.name ?? t("common.undefined"),
              })}
            </DialogTitle>
            <DialogDescription>
              {t("printers.profile.description")}
            </DialogDescription>
          </DialogHeader>

          {printerDraft ? (
            <Tabs
              defaultValue="info"
              className="flex min-h-0 flex-1 flex-col gap-5"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">{t("printers.profile.info")}</TabsTrigger>
                <TabsTrigger value="settings">{t("printers.profile.settings")}</TabsTrigger>
                <TabsTrigger value="advanced">{t("printers.profile.advanced")}</TabsTrigger>
              </TabsList>

              <ScrollArea className="min-h-0 flex-1 pr-4">
                <TabsContent value="info" className="mt-0">
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.name")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.name ?? t("common.noName")}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.brandModel")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.manufacturer ?? t("common.noBrand")}
                        {profileDialogPrinter?.model
                          ? ` · ${profileDialogPrinter.model}`
                          : ""}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.connection")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter
                          ? connectionLabel(profileDialogPrinter.connectionType, t)
                          : t("common.undefined")}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.status")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter
                          ? statusText(profileDialogPrinter.status, t)
                          : t("common.undefined")}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.driver")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.driver ?? t("common.undefined")}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.systemQueue")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.systemQueue ?? t("common.notApplicable")}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.vendorProduct")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.vendorId ?? "--"} /{" "}
                        {profileDialogPrinter?.productId ?? "--"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">{t("printers.profile.fields.series")}</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.serialNumber ?? t("common.notRecorded")}
                      </Text>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="mt-0">
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>{t("printers.profile.fields.type")}</label>
                        </Text>
                        <Select
                          value={printerDraft.kind}
                          onValueChange={(value) =>
                            setPrinterDraft((current) =>
                              current
                                ? { ...current, kind: value as PrinterType }
                                : current,
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {printerTypes.map((value) => (
                              <SelectItem key={value} value={value}>
                                {typeLabel(value, t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>{t("printers.profile.fields.paper")}</label>
                        </Text>
                        <Select
                          value={printerDraft.paperWidthMm}
                          onValueChange={(value) =>
                            setPrinterDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    paperWidthMm: value as PaperWidth,
                                  }
                                : current,
                            )
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paperWidths.map((value) => (
                              <SelectItem key={value} value={value}>
                                {paperLabel(value, t)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>{t("printers.profile.fields.charsPerLine")}</label>
                        </Text>
                        <Input
                          type="number"
                          value={String(printerDraft.charsPerLineNormal)}
                          onChange={(event) =>
                            setPrinterDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    charsPerLineNormal: Number(
                                      event.target.value,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>{t("printers.profile.fields.encoding")}</label>
                        </Text>
                        <Input
                          value={printerDraft.encoding}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <SwitchRow
                        label={t("printers.profile.switches.receiptReady")}
                        checked={printerDraft.receiptCapable}
                        onCheckedChange={(checked) =>
                          setPrinterDraft((current) =>
                            current
                              ? { ...current, receiptCapable: checked }
                              : current,
                          )
                        }
                      />

                      <SwitchRow
                        label={t("printers.profile.switches.autoCut")}
                        checked={printerDraft.supportsCut}
                        onCheckedChange={(checked) =>
                          setPrinterDraft((current) =>
                            current
                              ? { ...current, supportsCut: checked }
                              : current,
                          )
                        }
                      />

                      <SwitchRow
                        label={t("printers.profile.switches.cashDrawer")}
                        checked={printerDraft.supportsCashDrawer}
                        onCheckedChange={(checked) =>
                          setPrinterDraft((current) =>
                            current
                              ? { ...current, supportsCashDrawer: checked }
                              : current,
                          )
                        }
                      />

                      <SwitchRow
                        label={t("printers.profile.switches.qrAndBarcode")}
                        helper={t("printers.profile.switches.qrAndBarcodeHelp")}
                        checked={
                          printerDraft.supportsQr ||
                          printerDraft.supportsBarcode
                        }
                        onCheckedChange={(checked) =>
                          setPrinterDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  supportsQr: checked,
                                  supportsBarcode: checked,
                                }
                              : current,
                          )
                        }
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="mt-0">
                  <div className="flex flex-col gap-4">
                    <div>
                      <Text weight="medium">{t("printers.profile.advancedTitle")}</Text>
                      <Text variant="caption" className="mt-1">
                        {t("printers.profile.advancedDescription")}
                      </Text>
                    </div>

                    <SwitchRow
                      label={t("printers.profile.switches.advancedUsb")}
                      checked={printerDraft.rawSupport}
                      onCheckedChange={(checked) =>
                        setPrinterDraft((current) =>
                          current
                            ? { ...current, rawSupport: checked }
                            : current,
                        )
                      }
                    />

                    <div className="space-y-2">
                      <Text asChild weight="medium">
                        <label>{t("printers.profile.fields.rawDevicePath")}</label>
                      </Text>
                      <Input
                        value={printerDraft.rawDevicePath}
                        onChange={(event) =>
                          setPrinterDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  rawDevicePath: event.target.value,
                                }
                              : current,
                          )
                        }
                      />
                    </div>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                if (profileDialogPrinter) {
                  setPrinterDraft(buildPrinterDraft(profileDialogPrinter));
                }
              }}
              disabled={!profileDialogPrinter}
            >
              {t("common.reset")}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setProfileDialogPrinterId(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" size="lg" onClick={handleSavePrinterProfile}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default App;
