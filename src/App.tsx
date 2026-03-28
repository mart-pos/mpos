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
import { connectBridgeEvents } from "./lib/martpos-bridge-sdk";
import { fallbackBootstrap } from "./mocks/bootstrap";
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

function statusText(status: ResolvedPrinter["status"]) {
  if (status === "online") {
    return "Conectada";
  }
  if (status === "offline") {
    return "Desconectada";
  }
  return "Sin confirmar";
}

function connectionLabel(value: string) {
  switch (value) {
    case "usb":
      return "USB";
    case "system":
      return "Sistema";
    case "network":
      return "Red";
    case "bluetooth":
      return "Bluetooth";
    default:
      return value;
  }
}

function typeLabel(value: PrinterType) {
  switch (value) {
    case "thermal":
      return "Termica";
    case "inkjet":
      return "Inyeccion";
    case "laser":
      return "Laser";
    case "label":
      return "Etiquetas";
    default:
      return "Sin definir";
  }
}

function paperLabel(value: PaperWidth) {
  switch (value) {
    case "mm58":
      return "58 mm";
    case "mm80":
      return "80 mm";
    default:
      return "Sin definir";
  }
}

function explainError(error: unknown, fallback: string) {
  const text = String(error ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (
    text.includes("Failed to fetch") ||
    text.includes("network") ||
    text.includes("timed out")
  ) {
    return `${fallback} Revisa que MartPOS y MPOS Core esten abiertos en este mismo equipo.`;
  }

  if (text.includes("origin not allowed")) {
    return "MartPOS intento conectar desde un origen no permitido. Revisa el entorno actual de MartPOS y vuelve a abrir la vinculacion.";
  }

  if (
    text.includes("invalid pairing code") ||
    text.includes("pairing session")
  ) {
    return "La vinculacion vencio o ya no es valida. Genera un codigo nuevo y vuelve a intentar.";
  }

  if (text.includes("no default printer configured")) {
    return "Todavia no hay una impresora principal. Elige una impresora lista para poder imprimir.";
  }

  return text;
}

function explainPrintDetail(
  detail: string | null | undefined,
  fallback: string,
) {
  const text = (detail ?? "").trim();
  if (!text) {
    return fallback;
  }

  if (
    text.includes("usb bulk endpoint") ||
    text.includes("sent ") ||
    text.includes("bytes via")
  ) {
    return "Impresion enviada correctamente.";
  }

  if (text.includes("preview") || text.includes("html")) {
    return "Se preparo una vista de apoyo para completar la impresion.";
  }

  if (text.includes("spool") || text.includes("queue")) {
    return "La impresion fue enviada a la cola del sistema.";
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
            "No pudimos confirmar la vinculacion con MartPOS. Si MartPOS ya estaba abierto, intenta abrir la vinculacion otra vez.",
          );
          setMessage("No se pudo actualizar la vinculacion con MartPOS.");
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
  }, [data.pairing.active, pairingLiveMode]);

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

    if (
      message.includes("No se pudo") ||
      message.includes("failed") ||
      message.includes("invalid")
    ) {
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
      setMessage("Lista de impresoras actualizada.");
    } catch {
      setMessage("No se pudo actualizar la lista de impresoras.");
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
      setMessage("Impresora principal actualizada.");
    } catch (error) {
      setMessage(
        explainError(error, "No se pudo guardar la impresora principal."),
      );
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
          `No se pudo enviar directo a la impresora. Se genero un archivo de apoyo con ${result.driver} en ${result.previewPath}.`,
        );
      } else {
        setMessage(
          explainPrintDetail(result.detail, "Prueba enviada a la impresora."),
        );
      }
    } catch (error) {
      setMessage(explainError(error, "No se pudo imprimir la prueba."));
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
          `No se pudo reimprimir directo. Se genero un archivo de apoyo con ${result.driver} en ${result.previewPath}.`,
        );
      } else {
        setMessage(
          explainPrintDetail(
            result.detail,
            "Ultimo recibo real reenviado a impresion.",
          ),
        );
      }
    } catch (error) {
      setMessage(
        explainError(error, "No se pudo reimprimir el ultimo recibo."),
      );
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
        setMessage("Ajustes guardados.");
      }
    } catch (error) {
      setMessage(explainError(error, "No se pudieron guardar los ajustes."));
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
      setMessage("Ajustes de impresora guardados.");
      setProfileDialogPrinterId(null);
    } catch (error) {
      setMessage(explainError(error, "No se pudo guardar esta impresora."));
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
      setMessage("Codigo listo para vincular MartPOS.");
    } catch (error) {
      setMartposIssue(
        "No se pudo preparar la vinculacion. Cierra y vuelve a abrir MPOS Core si el problema sigue.",
      );
      setMessage(
        explainError(error, "No se pudo preparar la vinculacion con MartPOS."),
      );
    }
  }

  async function handleCopyPairingCode() {
    if (!data.pairing.code || !navigator?.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(data.pairing.code);
    setMessage("Codigo copiado.");
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
      setMessage("MartPOS se abrio para terminar la vinculacion.");
    } catch (error) {
      setPairingLaunchPending(false);
      setMartposIssue(
        "No pudimos abrir MartPOS o terminar la vinculacion. Revisa que MartPOS este instalado y abierto en este mismo equipo.",
      );
      setMessage(explainError(error, "No se pudo abrir MartPOS."));
    }
  }

  async function handleForgetBridge() {
    try {
      const payload = await invoke<BootstrapPayload>("regenerate_api_token");
      syncBootstrap(payload);
      setPairingLiveMode(false);
      setPairingLaunchPending(false);
      setMartposIssue(null);
      setMessage(
        "Se desvinculo MartPOS en este equipo. Para volver a conectarlo, haz pairing de nuevo.",
      );
    } catch (error) {
      setMessage(explainError(error, "No se pudo desvincular MartPOS."));
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
          title: "MartPOS todavia no esta vinculado",
          detail:
            "Abre MartPOS desde aqui y termina la vinculacion en este equipo.",
          action: (
            <Button
              type="button"
              variant="outline"
              onClick={handleLaunchMartposPairing}
            >
              Abrir MartPOS
            </Button>
          ),
        }
      : null,
    data.printers.length === 0
      ? {
          title: "No encontramos impresoras",
          detail:
            "Conecta la impresora y usa refrescar para volver a buscarla.",
          action: (
            <Button
              type="button"
              variant="outline"
              onClick={refreshPrinters}
              disabled={loading || refreshCooldownSeconds > 0}
            >
              Refrescar
            </Button>
          ),
        }
      : null,
    data.printers.length > 0 && readyPrinters === 0
      ? {
          title: "Hay impresoras detectadas pero no listas para recibos",
          detail:
            "Revisa la impresora principal o ajusta el perfil para recibos.",
          action: firstReadyPrinter ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={() => openProfileDialog(data.printers[0])}
            >
              Revisar impresora
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
                  ? `Refrescar en ${refreshCooldownSeconds}s`
                  : "Refrescar"}
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
              <TooltipContent sideOffset={8}>Abrir MartPOS</TooltipContent>
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
              <TooltipContent sideOffset={8}>Configuracion</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl gap-4 flex-col px-6 py-6">
        {martposIssue && !data.bridge.connected ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <Text weight="medium">Mart POS necesita atencion</Text>
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
              <SectionTitle>Impresoras</SectionTitle>
              <Text variant="muted">
                Gestiona tus impresoras conectadas. {readyPrinters} de{" "}
                {data.printers.length} listas.
              </Text>
            </div>
          </div>
          {data.printers.length > 0 &&
          !defaultPrinter &&
          !data.config.defaultPrinterId ? (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <div>
                <Text weight="medium">Falta una impresora principal</Text>
                <Text variant="caption" className="mt-1">
                  Elige una impresora lista para recibos antes de imprimir desde
                  MartPOS.
                </Text>
              </div>
              {firstReadyPrinter ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSetDefault(firstReadyPrinter.id)}
                >
                  Usar sugerida
                </Button>
              ) : null}
            </div>
          ) : null}

          {data.printers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Text weight="medium">Todavia no encontramos impresoras</Text>
                  <Text variant="caption" className="mt-1">
                    Conecta la impresora, enciendela y luego refresca la lista.
                    Si es USB, revisa que este conectada directo a esta
                    computadora.
                  </Text>
                  <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>1. Conecta la impresora y enciendela.</span>
                    <span>
                      2. Espera unos segundos para que el sistema la detecte.
                    </span>
                    <span>3. Pulsa refrescar.</span>
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
                    Refrescar
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings2Icon />
                    Abrir soporte
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
                        {printer.manufacturer ?? "Marca no identificada"}
                        {printer.model} - {printer.profile.paperWidthMm}
                      </Text>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {printer.isDefault ? (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className={`text-xs ${statusTone(printer.status)}`}
                    >
                      {statusText(printer.status)}
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
                          Usar como principal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openProfileDialog(printer)}
                        >
                          <EyeIcon />
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePrintTest(printer.id)}
                          disabled={
                            printInFlightRef.current || printCooldownActive
                          }
                        >
                          <PrinterIcon />
                          Imprimir ticket de prueba
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePrintLastReceipt(printer)}
                          disabled={
                            printInFlightRef.current || printCooldownActive
                          }
                        >
                          <RefreshCwIcon />
                          Reimprimir ultimo recibo
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
                <Text weight="medium">Diagnostico guiado</Text>
                <Text variant="caption">
                  Abre esto si algo no conecta, no aparece o no imprime.
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
                <Text variant="caption">Socket en vivo</Text>
                <Text className="mt-1">
                  {socketConnected ? "Conectado" : "Reconectando"}
                </Text>
              </div>
              <div>
                <Text variant="caption">Estado MartPOS</Text>
                <Text className="mt-1">
                  {data.bridge.connected
                    ? "Vinculado"
                    : "Pendiente de vinculacion"}
                </Text>
              </div>
              <div>
                <Text variant="caption">Origen permitido</Text>
                <Text className="mt-1">
                  {data.config.allowedOrigin ?? "Sin definir"}
                </Text>
              </div>
              <div>
                <Text variant="caption">Impresora principal</Text>
                <Text className="mt-1">
                  {defaultPrinter?.name ?? "Sin definir"}
                </Text>
              </div>
              <div>
                <Text variant="caption">Impresoras listas</Text>
                <Text className="mt-1">
                  {readyPrinters} de {onlinePrinters.length} en linea
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
                <Text weight="medium">Todo se ve bien</Text>
                <Text variant="caption" className="mt-1">
                  MartPOS, impresoras y bridge local parecen estar listos.
                </Text>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Text variant="caption">Que hacer si no imprime</Text>
                <Text className="mt-1">
                  Revisa la principal, imprime una prueba y ajusta el perfil si
                  hace falta.
                </Text>
              </div>
              <div>
                <Text variant="caption">Que hacer si no aparece</Text>
                <Text className="mt-1">
                  Conecta la impresora, espera unos segundos y verifica si el
                  estado cambia solo.
                </Text>
              </div>
            </div>
          </div>
        </details>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuracion</DialogTitle>
            <DialogDescription>
              Ajustes simples para el uso diario. Se guardan automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Text asChild weight="medium">
                <label>Idioma</label>
              </Text>
              <Input
                value={configDraft.locale}
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    locale: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Text asChild weight="medium">
                <label>Tema</label>
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
                  <SelectValue placeholder="Selecciona un tema" />
                </SelectTrigger>
                <SelectContent>
                  {themeModes.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
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
              Cerrar
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
              Ajustar {profileDialogPrinter?.name ?? "impresora"}
            </DialogTitle>
            <DialogDescription>
              Cambia solo lo que necesites para que el ticket salga bien.
            </DialogDescription>
          </DialogHeader>

          {printerDraft ? (
            <Tabs
              defaultValue="info"
              className="flex min-h-0 flex-1 flex-col gap-5"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Informacion</TabsTrigger>
                <TabsTrigger value="settings">Ajustes</TabsTrigger>
                <TabsTrigger value="advanced">Avanzado</TabsTrigger>
              </TabsList>

              <ScrollArea className="min-h-0 flex-1 pr-4">
                <TabsContent value="info" className="mt-0">
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    <div>
                      <Text variant="caption">Nombre</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.name ?? "Sin nombre"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Marca y modelo</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.manufacturer ?? "Sin marca"}
                        {profileDialogPrinter?.model
                          ? ` · ${profileDialogPrinter.model}`
                          : ""}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Conexion</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter
                          ? connectionLabel(profileDialogPrinter.connectionType)
                          : "Sin definir"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Estado</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter
                          ? statusText(profileDialogPrinter.status)
                          : "Sin definir"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Driver</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.driver ?? "Sin definir"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Cola del sistema</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.systemQueue ?? "No aplica"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Vendor / Product</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.vendorId ?? "--"} /{" "}
                        {profileDialogPrinter?.productId ?? "--"}
                      </Text>
                    </div>
                    <div>
                      <Text variant="caption">Serie</Text>
                      <Text className="mt-1" weight="medium">
                        {profileDialogPrinter?.serialNumber ?? "Sin registro"}
                      </Text>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="mt-0">
                  <div className="flex flex-col gap-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>Tipo</label>
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
                                {typeLabel(value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>Papel</label>
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
                                {paperLabel(value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Text asChild weight="medium">
                          <label>Texto por linea</label>
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
                          <label>Encoding</label>
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
                        label="Lista para recibos"
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
                        label="Corte automatico"
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
                        label="Abrir cajon"
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
                        label="QR y barras"
                        helper="Activa si esta impresora maneja QR o codigos de barras en recibos."
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
                      <Text weight="medium">Soporte USB especial</Text>
                      <Text variant="caption" className="mt-1">
                        Solo usa esto si soporte te lo pide para una impresora
                        USB especial.
                      </Text>
                    </div>

                    <SwitchRow
                      label="Impresion USB avanzada"
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
                        <label>Ruta del dispositivo</label>
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
              Resetear
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setProfileDialogPrinterId(null)}
            >
              Cancelar
            </Button>
            <Button type="button" size="lg" onClick={handleSavePrinterProfile}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default App;
