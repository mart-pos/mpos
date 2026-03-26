import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  LifeBuoyIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  MoonStarIcon,
  PrinterIcon,
  RefreshCwIcon,
  Settings2Icon,
  SunIcon,
  ZapIcon,
  EyeIcon,
  StarIcon,
} from "lucide-react";

import { CardTitle, Text } from "@/components/Typography";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { fallbackBootstrap } from "./mocks/bootstrap";
import type {
  BootstrapPayload,
  PaperWidth,
  PrinterType,
  ResolvedPrinter,
  ThemeMode,
} from "./types/bootstrap";

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

function parseUnixTimestamp(value: string | null) {
  if (!value?.startsWith("unix:")) {
    return null;
  }

  const parsed = Number(value.replace("unix:", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPairingCountdown(expiresAt: string | null, nowMs: number) {
  const unix = parseUnixTimestamp(expiresAt);
  if (!unix) {
    return "sin expiracion";
  }

  const remaining = Math.max(0, unix * 1000 - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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
    return "Lista";
  }
  if (status === "offline") {
    return "Revisar";
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

  if (text.includes("invalid pairing code") || text.includes("pairing session")) {
    return "La vinculacion vencio o ya no es valida. Genera un codigo nuevo y vuelve a intentar.";
  }

  if (text.includes("no default printer configured")) {
    return "Todavia no hay una impresora principal. Elige una impresora lista para poder imprimir.";
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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 px-4 py-3">
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
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<BootstrapPayload>(fallbackBootstrap);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshCooldownSeconds, setRefreshCooldownSeconds] = useState(0);
  const [printCooldownActive, setPrintCooldownActive] = useState(false);
  const refreshInFlightRef = useRef(false);
  const printInFlightRef = useRef(false);
  const [pairingLiveMode, setPairingLiveMode] = useState(false);
  const [pairingNowMs, setPairingNowMs] = useState(() => Date.now());
  const [pairingCodeCopied, setPairingCodeCopied] = useState(false);
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

    const timer = window.setInterval(() => {
      setPairingNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [data.pairing.active, pairingLiveMode]);

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
      setMessage(explainError(error, "No se pudo guardar la impresora principal."));
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
        setMessage(result.detail || "Prueba enviada a la impresora.");
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
        setMessage(result.detail || "Ultimo recibo real reenviado a impresion.");
      }
    } catch (error) {
      setMessage(explainError(error, "No se pudo reimprimir el ultimo recibo."));
    } finally {
      printInFlightRef.current = false;
    }
  }

  async function handleSaveConfig() {
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
      setMessage("Ajustes guardados.");
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
      const pairing =
        await invoke<BootstrapPayload["pairing"]>("ensure_pairing_session");
      setData((current) => ({ ...current, pairing }));
      setPairingLiveMode(true);
      setMartposIssue(null);
      setMessage("Codigo listo para vincular MartPOS.");
    } catch (error) {
      setMartposIssue(
        "No se pudo preparar la vinculacion. Cierra y vuelve a abrir MPOS Core si el problema sigue.",
      );
      setMessage(explainError(error, "No se pudo preparar la vinculacion con MartPOS."));
    }
  }

  async function handleCopyPairingCode() {
    if (!data.pairing.code || !navigator?.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(data.pairing.code);
    setPairingCodeCopied(true);
    window.setTimeout(() => {
      setPairingCodeCopied(false);
    }, 1000);
    setMessage("Codigo copiado.");
  }

  async function handleLaunchMartposPairing() {
    try {
      const result = await invoke<{
        url: string;
        pairing: BootstrapPayload["pairing"];
      }>("launch_martpos_pairing");
      setData((current) => ({ ...current, pairing: result.pairing }));
      setPairingLiveMode(true);
      setMartposIssue(null);
      setMessage("MartPOS se abrio para terminar la vinculacion.");
    } catch (error) {
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
    data.printers.find((printer) => printer.id === profileDialogPrinterId) ?? null;

  const onlinePrinters = data.printers.filter((printer) => printer.status === "online");
  const readyPrinters = data.printers.filter(
    (printer) => printer.status === "online" && printer.receiptCapable,
  ).length;
  const firstReadyPrinter = data.printers.find(
    (printer) => printer.status === "online" && printer.receiptCapable,
  );
  const setupSteps = [
    {
      label: "Vincular MartPOS",
      done: data.bridge.connected,
      detail: data.bridge.connected
        ? "Listo"
        : "Abre MartPOS y termina la vinculacion.",
    },
    {
      label: "Detectar impresoras",
      done: data.printers.length > 0,
      detail:
        data.printers.length > 0
          ? `${data.printers.length} detectadas`
          : "Conecta la impresora y refresca la lista.",
    },
    {
      label: "Elegir impresora principal",
      done: Boolean(defaultPrinter),
      detail: defaultPrinter
        ? defaultPrinter.name
        : "Elige una impresora lista para recibos.",
    },
  ];

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
                  {loading ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
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

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6">
        {(!data.bridge.connected || data.printers.length === 0 || !defaultPrinter) ? (
          <Card className="order-0">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Primeros pasos</CardTitle>
              <Text variant="muted">
                Deja esta computadora lista en tres pasos simples.
              </Text>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {setupSteps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex size-6 items-center justify-center rounded-full ${step.done ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {step.done ? <CheckIcon className="size-4" /> : <span className="text-xs font-semibold">•</span>}
                    </div>
                    <div>
                      <Text weight="medium">{step.label}</Text>
                      <Text variant="caption" className="mt-0.5">
                        {step.detail}
                      </Text>
                    </div>
                  </div>
                  {!step.done && step.label === "Vincular MartPOS" ? (
                    <Button type="button" variant="outline" onClick={handleLaunchMartposPairing}>
                      Abrir MartPOS
                    </Button>
                  ) : null}
                  {!step.done && step.label === "Detectar impresoras" ? (
                    <Button type="button" variant="outline" onClick={refreshPrinters} disabled={loading || refreshCooldownSeconds > 0}>
                      Refrescar
                    </Button>
                  ) : null}
                  {!step.done && step.label === "Elegir impresora principal" && firstReadyPrinter ? (
                    <Button type="button" variant="outline" onClick={() => void handleSetDefault(firstReadyPrinter.id)}>
                      Usar {firstReadyPrinter.name}
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className={data.bridge.connected ? "order-2" : "order-1"}>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">Conectar con MartPOS</CardTitle>
                <Text variant="muted">{data.bridge.connected ? "Esta app ya esta vinculada con MartPOS." : data.pairing.active ? "Hay una vinculacion activa lista para completar." : "Usa el boton automatico. El codigo solo queda como respaldo."}</Text>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" size="lg" onClick={handleLaunchMartposPairing}>
                  <ExternalLinkIcon />
                  {data.bridge.connected ? "Abrir MartPOS" : "Pair con MartPOS"}
                </Button>
                <Button type="button" size="lg" variant="outline" onClick={handleForgetBridge}>
                  Olvidar bridge
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {martposIssue && !data.bridge.connected ? (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-200">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <div>
                  <Text weight="medium">MartPOS necesita atencion</Text>
                  <Text variant="caption" className="mt-1">
                    {martposIssue}
                  </Text>
                </div>
              </div>
            ) : null}

            {!data.bridge.connected ? (
              <div className="rounded-lg bg-secondary/50 p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                      data.pairing.active ? "bg-accent/10" : "bg-primary/10"
                    }`}
                  >
                    {data.pairing.active ? (
                      <CheckCircle2Icon className="size-4 text-accent" />
                    ) : (
                      <ZapIcon className="size-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Text weight="medium">
                      {data.pairing.active
                        ? "Lista para conectar"
                        : "Vinculacion automatica"}
                    </Text>
                    <Text variant="caption" className="mt-2">
                      {data.pairing.active
                        ? "El codigo actual esta listo para vincular MartPOS en este equipo."
                        : "Abre MartPOS y termina la conexion sin copiar rutas ni direcciones."}
                    </Text>
                  </div>
                </div>
              </div>
            ) : null}

            {!data.bridge.connected ? (
            <div className="rounded-lg bg-secondary/50 p-4">
              <Text weight="medium">Codigo de respaldo</Text>
              <Text variant="caption" className="mt-0.5">
                Si la vinculacion automatica falla, usa este codigo una sola vez en MartPOS.
              </Text>
              <div className="mt-3 flex items-center gap-4">
                <Text className="font-mono text-2xl font-semibold">
                  {data.pairing.code ?? "------"}
                </Text>
              </div>
              <Text variant="caption" className="mt-2">
                {data.pairing.active
                  ? `Disponible por ${formatPairingCountdown(data.pairing.expiresAt, pairingNowMs)}.`
                  : "Abre una nueva vinculacion para generar un codigo."}
              </Text>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="lg" variant="outline" onClick={handleOpenPairing}>
                  Generar codigo
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  onClick={() => void handleCopyPairingCode()}
                  disabled={!data.pairing.code}
                >
                  {pairingCodeCopied ? (
                    <CheckIcon className="text-emerald-600 transition-all animate-in zoom-in-95" />
                  ) : (
                    <CopyIcon />
                  )}
                  Copiar
                </Button>
              </div>
            </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={data.bridge.connected ? "order-1" : "order-2"}>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Impresoras</CardTitle>
                <Text variant="muted">
                  Gestiona tus impresoras conectadas. {readyPrinters} de {data.printers.length} listas.
                </Text>
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => handlePrintLastReceipt(defaultPrinter)}
                disabled={!defaultPrinter || printInFlightRef.current || printCooldownActive}
              >
                <PrinterIcon />
                Reimprimir ultimo recibo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {data.printers.length > 0 && !defaultPrinter ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                <div>
                  <Text weight="medium">Falta una impresora principal</Text>
                  <Text variant="caption" className="mt-1">
                    Elige una impresora lista para recibos antes de imprimir desde MartPOS.
                  </Text>
                </div>
                {firstReadyPrinter ? (
                  <Button type="button" variant="outline" onClick={() => void handleSetDefault(firstReadyPrinter.id)}>
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
                      Conecta la impresora, enciendela y luego refresca la lista. Si es USB, revisa que este conectada directo a esta computadora.
                    </Text>
                    <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                      <span>1. Conecta la impresora y enciendela.</span>
                      <span>2. Espera unos segundos para que el sistema la detecte.</span>
                      <span>3. Pulsa refrescar.</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="lg" onClick={refreshPrinters} disabled={loading || refreshCooldownSeconds > 0}>
                      <RefreshCwIcon />
                      Refrescar
                    </Button>
                    <Button type="button" size="lg" variant="outline" onClick={() => setSettingsOpen(true)}>
                      <Settings2Icon />
                      Abrir soporte
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {data.printers.map((printer) => (
              <div key={printer.id} className="rounded-lg border border-border p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                      <PrinterIcon className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <Text weight="medium">{printer.name}</Text>
                      <Text variant="caption">
                        {printer.manufacturer ?? "Marca no identificada"}
                        {printer.model ? ` · ${printer.model}` : ""}
                      </Text>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {printer.isDefault ? (
                      <Badge variant="secondary" className="text-xs">
                        Principal
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className={`text-xs ${statusTone(printer.status)}`}>
                      {statusText(printer.status)}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[250px]">
                        <DropdownMenuItem onClick={() => handleSetDefault(printer.id)}>
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
                          disabled={printInFlightRef.current || printCooldownActive}
                        >
                          <PrinterIcon />
                          Imprimir ticket de prueba
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePrintLastReceipt(printer)}
                          disabled={printInFlightRef.current || printCooldownActive}
                        >
                          <RefreshCwIcon />
                          Reimprimir ultimo recibo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm md:grid-cols-3 xl:grid-cols-6">
                  <div>
                    <Text variant="caption" className="mb-1">
                      Tipo
                    </Text>
                    <Text weight="medium">{typeLabel(printer.type)}</Text>
                  </div>
                  <div>
                    <Text variant="caption" className="mb-1">
                      Papel
                    </Text>
                    <Text weight="medium">{paperLabel(printer.paperWidthMm)}</Text>
                  </div>
                  <div>
                    <Text variant="caption" className="mb-1">
                      Conexion
                    </Text>
                    <Text weight="medium">{connectionLabel(printer.connectionType)}</Text>
                  </div>
                  <div>
                    <Text variant="caption" className="mb-1">
                      Driver
                    </Text>
                    <Text weight="medium">
                      {printer.driver}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption" className="mb-1">
                      Cola
                    </Text>
                    <Text weight="medium">
                      {printer.systemQueue ?? "No aplica"}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption" className="mb-1">
                      Soporte
                    </Text>
                    <Text weight="medium">
                      {printer.receiptCapable ? "Recibos" : "General"}
                    </Text>
                  </div>
                  <div>
                    <Text variant="caption" className="mb-1">
                      Corte / QR
                    </Text>
                    <Text weight="medium">
                      {printer.profile.supportsCut ? "Corte" : "Sin corte"} ·{" "}
                      {printer.profile.supportsQr || printer.profile.supportsBarcode
                        ? "QR/Barras"
                        : "Basico"}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <details className="order-3 rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3">
              <LifeBuoyIcon className="size-4 text-muted-foreground" />
              <div>
                <Text weight="medium">Diagnostico y soporte</Text>
                <Text variant="caption">
                  Solo abre esto si necesitas revisar conexion o impresoras.
                </Text>
              </div>
            </div>
            <Text variant="caption">Abrir</Text>
          </summary>
          <div className="grid gap-3 border-t border-border px-5 py-4 text-sm md:grid-cols-2">
            <div>
              <Text variant="caption">Estado MartPOS</Text>
              <Text className="mt-1">
                {data.bridge.connected ? "Vinculado" : "Pendiente de vinculacion"}
              </Text>
            </div>
            <div>
              <Text variant="caption">API local</Text>
              <Text className="mt-1">{data.apiServer.baseUrl}</Text>
            </div>
            <div>
              <Text variant="caption">Origen permitido</Text>
              <Text className="mt-1">{data.config.allowedOrigin ?? "Sin definir"}</Text>
            </div>
            <div>
              <Text variant="caption">Impresora principal</Text>
              <Text className="mt-1">{defaultPrinter?.name ?? "Sin definir"}</Text>
            </div>
            <div>
              <Text variant="caption">Impresoras listas</Text>
              <Text className="mt-1">{readyPrinters} de {onlinePrinters.length} en linea</Text>
            </div>
            <div>
              <Text variant="caption">Logs</Text>
              <Text className="mt-1 break-all">{data.storage.logs.directory}</Text>
            </div>
          </div>
        </details>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuracion</DialogTitle>
            <DialogDescription>
              Ajustes simples para el uso diario.
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

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  setConfigDraft((current) => ({ ...current, theme: next }));
                }}
              >
                {theme === "dark" ? <MoonStarIcon /> : <SunIcon />}
                Cambiar tema rapido
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" size="lg" variant="outline" onClick={() => setSettingsOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={async () => {
                await handleSaveConfig();
                setSettingsOpen(false);
              }}
            >
              Guardar ajustes
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Ajustar {profileDialogPrinter?.name ?? "impresora"}
            </DialogTitle>
            <DialogDescription>
              Cambia solo lo que necesites para que el ticket salga bien.
            </DialogDescription>
          </DialogHeader>

          {printerDraft ? (
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
                        current ? { ...current, kind: value as PrinterType } : current,
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
                          ? { ...current, paperWidthMm: value as PaperWidth }
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
                              charsPerLineNormal: Number(event.target.value),
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
                  <Input value={printerDraft.encoding} disabled readOnly />
                  <Text variant="caption">
                    Se detecta automaticamente. Solo deberia cambiarse desde soporte.
                  </Text>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <SwitchRow
                  label="Lista para recibos"
                  checked={printerDraft.receiptCapable}
                  onCheckedChange={(checked) =>
                    setPrinterDraft((current) =>
                      current ? { ...current, receiptCapable: checked } : current,
                    )
                  }
                />

                <SwitchRow
                  label="Corte automatico"
                  checked={printerDraft.supportsCut}
                  onCheckedChange={(checked) =>
                    setPrinterDraft((current) =>
                      current ? { ...current, supportsCut: checked } : current,
                    )
                  }
                />

                <SwitchRow
                  label="Abrir cajon"
                  checked={printerDraft.supportsCashDrawer}
                  onCheckedChange={(checked) =>
                    setPrinterDraft((current) =>
                      current ? { ...current, supportsCashDrawer: checked } : current,
                    )
                  }
                />

                <SwitchRow
                  label="QR y barras"
                  helper="Activa si esta impresora maneja QR o codigos de barras en recibos."
                  checked={printerDraft.supportsQr || printerDraft.supportsBarcode}
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

              <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border/80 px-4 py-4">
                <div>
                  <Text weight="medium">Soporte USB especial</Text>
                  <Text variant="caption" className="mt-1">
                    Solo usa esto si soporte te lo pide para una impresora USB especial.
                  </Text>
                </div>

                <SwitchRow
                  label="Impresion USB avanzada"
                  checked={printerDraft.rawSupport}
                  onCheckedChange={(checked) =>
                    setPrinterDraft((current) =>
                      current ? { ...current, rawSupport: checked } : current,
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
                          ? { ...current, rawDevicePath: event.target.value }
                          : current,
                      )
                    }
                  />
                </div>
              </div>
            </div>
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
