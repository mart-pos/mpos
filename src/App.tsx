import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BadgeCheckIcon,
  CopyIcon,
  InfoIcon,
  LinkIcon,
  LoaderCircleIcon,
  MoonStarIcon,
  PrinterIcon,
  ReceiptTextIcon,
  RefreshCwIcon,
  Settings2Icon,
  SunIcon,
} from "lucide-react";

import { CardTitle, PageTitle, SectionTitle, Text } from "@/components/Typography";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { fallbackBootstrap } from "./mocks/bootstrap";
import type {
  BootstrapPayload,
  PaperWidth,
  PrinterType,
  ResolvedPrinter,
  ThemeMode,
} from "./types/bootstrap";

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
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
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
        const pairing = pairingLiveMode
          ? await invoke<BootstrapPayload["pairing"]>("ensure_pairing_session")
          : await invoke<BootstrapPayload["pairing"]>("get_pairing_status");

        if (!cancelled) {
          setData((current) => ({ ...current, pairing }));
        }
      } catch {
        if (!cancelled) {
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
    setSelectedPrinterId((current) => current ?? payload.printers[0]?.id ?? null);
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
      setMessage(String(error));
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
      setMessage(String(error));
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
      setMessage(String(error));
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
      setMessage(String(error));
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
      setMessage(String(error));
    }
  }

  function openProfileDialog(printer: ResolvedPrinter) {
    setSelectedPrinterId(printer.id);
    setPrinterDraft(buildPrinterDraft(printer));
    setProfileDialogPrinterId(printer.id);
  }

  async function handleOpenPairing() {
    try {
      const pairing =
        await invoke<BootstrapPayload["pairing"]>("ensure_pairing_session");
      setData((current) => ({ ...current, pairing }));
      setPairingLiveMode(true);
      setMessage("Codigo listo para vincular MartPOS.");
    } catch (error) {
      setMessage(String(error));
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
      const result = await invoke<{
        url: string;
        pairing: BootstrapPayload["pairing"];
      }>("launch_martpos_pairing");
      setData((current) => ({ ...current, pairing: result.pairing }));
      setPairingLiveMode(true);
      setMessage("MartPOS se abrio para terminar la vinculacion.");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function handleForgetBridge() {
    try {
      const payload = await invoke<BootstrapPayload>("regenerate_api_token");
      syncBootstrap(payload);
      setPairingLiveMode(false);
      setMessage(
        "Se desvinculo MartPOS en este equipo. Para volver a conectarlo, haz pairing de nuevo.",
      );
    } catch (error) {
      setMessage(String(error));
    }
  }

  const defaultPrinter = data.printers.find(
    (printer) => printer.id === data.config.defaultPrinterId,
  );

  const selectedPrinter = useMemo(
    () =>
      data.printers.find((printer) => printer.id === selectedPrinterId) ??
      data.printers[0],
    [data.printers, selectedPrinterId],
  );

  const profileDialogPrinter =
    data.printers.find((printer) => printer.id === profileDialogPrinterId) ?? null;

  const readyPrinters = data.printers.filter(
    (printer) => printer.status === "online" && printer.receiptCapable,
  ).length;
  const bridgeReady = data.printers.some((printer) => printer.status === "online");

  return (
    <main className="min-h-svh bg-transparent">
      <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
        <section className="rounded-[28px] border border-border/70 bg-background/90 p-5 shadow-sm backdrop-blur-xl lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Text variant="caption">
                MPOS Core
              </Text>
              <PageTitle className="mt-2">
                {bridgeReady ? "Todo listo para cobrar" : "Preparemos la impresion"}
              </PageTitle>
              <Text variant="muted" className="mt-2 max-w-2xl">
                Conecta MartPOS, elige la impresora principal y haz una prueba. Esta
                app debe resolverse desde una sola pantalla.
              </Text>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={refreshPrinters}
                disabled={loading || refreshCooldownSeconds > 0}
              >
                {loading ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
                {refreshCooldownSeconds > 0
                  ? `Refrescar en ${refreshCooldownSeconds}s`
                  : "Refrescar"}
              </Button>
              <Button type="button" variant="outline" onClick={handleLaunchMartposPairing}>
                <LinkIcon />
                Conectar MartPOS
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePrintTest(defaultPrinter?.id)}
                disabled={printInFlightRef.current || printCooldownActive}
              >
                <PrinterIcon />
                Imprimir prueba
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const next = theme === "dark" ? "light" : "dark";
                  setTheme(next);
                  setConfigDraft((current) => ({ ...current, theme: next }));
                }}
                aria-label="Cambiar tema"
              >
                {theme === "dark" ? <MoonStarIcon /> : <SunIcon />}
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label="Como funciona">
                    <InfoIcon />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Como funciona</DialogTitle>
                    <DialogDescription>
                      Lo importante
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <CardTitle>1. Conectar MartPOS</CardTitle>
                      <Text variant="muted" className="mt-2">
                        Vincula la tienda web en un clic o usando el codigo.
                      </Text>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <CardTitle>2. Elegir impresora principal</CardTitle>
                      <Text variant="muted" className="mt-2">
                        Marca una impresora como principal y deja la caja lista.
                      </Text>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <CardTitle>3. Probar impresion</CardTitle>
                      <Text variant="muted" className="mt-2">
                        Imprime una prueba y verifica corte, ancho y claridad.
                      </Text>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
              <CardHeader>
                <CardDescription>Impresora principal</CardDescription>
                <SectionTitle>{defaultPrinter?.name ?? "Sin seleccionar"}</SectionTitle>
              </CardHeader>
              <CardContent>
                <Text variant="muted">
                  {defaultPrinter
                    ? `${typeLabel(defaultPrinter.type)} · ${paperLabel(defaultPrinter.paperWidthMm)}`
                    : "Selecciona una impresora para que la caja imprima sin preguntar."}
                </Text>
              </CardContent>
            </Card>

            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
              <CardHeader>
                <CardDescription>Impresoras listas</CardDescription>
                <SectionTitle>{String(readyPrinters)}</SectionTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <BadgeCheckIcon className="size-4 text-primary" />
                  <Text variant="muted">
                    {readyPrinters > 0
                      ? "Hay al menos una impresora lista para trabajar."
                      : "No encontramos una impresora lista todavia."}
                  </Text>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
              <CardHeader>
                <CardDescription>Vinculacion con MartPOS</CardDescription>
                <SectionTitle>
                  {data.pairing.active ? "Lista para conectar" : "Pendiente"}
                </SectionTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Text variant="muted">
                  {data.pairing.active
                    ? `Codigo activo por ${formatPairingCountdown(
                        data.pairing.expiresAt,
                        pairingNowMs,
                      )}.`
                    : "Abre la vinculacion cuando quieras conectar la tienda web."}
                </Text>
                <div className="group relative rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <Text variant="caption">
                    Codigo
                  </Text>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Text className="font-mono text-lg font-semibold">
                      {data.pairing.code ?? "------"}
                    </Text>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void handleCopyPairingCode()}
                      disabled={!data.pairing.code}
                      aria-label="Copiar codigo"
                    >
                      <CopyIcon />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
            <CardHeader>
              <SectionTitle>Conectar con MartPOS</SectionTitle>
              <CardDescription>
                Usa el boton automatico. El codigo solo queda como respaldo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                <CardTitle>Vinculacion automatica</CardTitle>
                <Text variant="muted" className="mt-2">
                  Abre MartPOS y termina la conexion sin copiar rutas ni direcciones.
                </Text>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" onClick={handleLaunchMartposPairing}>
                    <LinkIcon />
                    Pair con MartPOS
                  </Button>
                  <Button type="button" variant="outline" onClick={handleForgetBridge}>
                    Olvidar bridge
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <CardTitle>Codigo de respaldo</CardTitle>
                <Text variant="muted" className="mt-2">
                  Si la vinculacion automatica falla, usa este codigo una sola vez en
                  MartPOS.
                </Text>
                <Text className="mt-4 text-4xl font-semibold">
                  {data.pairing.code ?? "------"}
                </Text>
                <Text variant="muted" className="mt-3">
                  {data.pairing.active
                    ? `Disponible por ${formatPairingCountdown(
                        data.pairing.expiresAt,
                        pairingNowMs,
                      )}.`
                    : "Abre una nueva vinculacion para generar un codigo."}
                </Text>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleOpenPairing}>
                    Generar codigo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleCopyPairingCode()}
                    disabled={!data.pairing.code}
                  >
                    <CopyIcon />
                    Copiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
              <CardHeader>
                <SectionTitle>Impresora principal</SectionTitle>
                <CardDescription>
                  Elige la impresora que MPOS usara por defecto.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {defaultPrinter ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                    <SectionTitle>{defaultPrinter.name}</SectionTitle>
                    <Text variant="muted" className="mt-2">
                      {typeLabel(defaultPrinter.type)} · {paperLabel(defaultPrinter.paperWidthMm)} ·{" "}
                      {connectionLabel(defaultPrinter.connectionType)}
                    </Text>
                  </div>
                ) : (
                  <Text variant="muted">
                    Aun no has seleccionado una impresora principal.
                  </Text>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handlePrintLastReceipt(defaultPrinter)}
                  disabled={!defaultPrinter || printInFlightRef.current || printCooldownActive}
                >
                  <ReceiptTextIcon />
                  Reimprimir ultimo recibo
                </Button>
              </CardContent>
            </Card>

            {data.printers.length === 0 ? (
              <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
                <CardContent className="py-10 text-center">
                  <SectionTitle>Aun no encontramos impresoras</SectionTitle>
                  <Text variant="muted" className="mt-2">
                    Revisa la conexion y usa el boton Refrescar.
                  </Text>
                </CardContent>
              </Card>
            ) : null}

            {data.printers.map((printer) => (
              <Card
                key={printer.id}
                className="border-none bg-card/90 shadow-none ring-1 ring-border/70"
              >
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <SectionTitle className="flex items-center gap-2">
                        <PrinterIcon className="size-4" />
                        {printer.name}
                      </SectionTitle>
                      <Text variant="muted">
                        {printer.manufacturer ?? "Marca no identificada"}
                        {printer.model ? ` · ${printer.model}` : ""}
                      </Text>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {printer.isDefault ? (
                        <span className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          Principal
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(printer.status)}`}
                      >
                        {statusText(printer.status)}
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <Text variant="caption">
                        Tipo
                      </Text>
                      <Text className="mt-1">{typeLabel(printer.type)}</Text>
                    </div>
                    <div>
                      <Text variant="caption">
                        Papel
                      </Text>
                      <Text className="mt-1">{paperLabel(printer.paperWidthMm)}</Text>
                    </div>
                    <div>
                      <Text variant="caption">
                        Conexion
                      </Text>
                      <Text className="mt-1">{connectionLabel(printer.connectionType)}</Text>
                    </div>
                    <div>
                      <Text variant="caption">
                        Uso
                      </Text>
                      <Text className="mt-1">
                        {printer.receiptCapable ? "Lista para recibos" : "Uso general"}
                      </Text>
                    </div>
                  </div>

                  <ButtonGroup className="flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedPrinterId(printer.id)}
                    >
                      Ver detalle
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSetDefault(printer.id)}
                    >
                      Usar como principal
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handlePrintTest(printer.id)}
                      disabled={printInFlightRef.current || printCooldownActive}
                    >
                      Probar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handlePrintLastReceipt(printer)}
                      disabled={printInFlightRef.current || printCooldownActive}
                    >
                      Reimprimir ultimo recibo
                    </Button>
                  </ButtonGroup>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
              <CardHeader>
                <SectionTitle>Detalle rapido</SectionTitle>
                <CardDescription>
                  Ajustes comunes para la impresora seleccionada.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {selectedPrinter ? (
                  <>
                    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                      <SectionTitle>{selectedPrinter.name}</SectionTitle>
                      <Text variant="muted" className="mt-1">
                        {selectedPrinter.isDefault
                          ? "Es la impresora principal"
                          : "Aun no es la principal"}
                      </Text>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-xl border border-border/70 p-3">
                        <Text variant="caption">
                          Papel recomendado
                        </Text>
                        <Text className="mt-1">
                          {paperLabel(selectedPrinter.profile.paperWidthMm)}
                        </Text>
                      </div>
                      <div className="rounded-xl border border-border/70 p-3">
                        <Text variant="caption">
                          Corte automatico
                        </Text>
                        <Text className="mt-1">
                          {selectedPrinter.profile.supportsCut ? "Si" : "No"}
                        </Text>
                      </div>
                      <div className="rounded-xl border border-border/70 p-3">
                        <Text variant="caption">
                          QR y codigo de barras
                        </Text>
                        <Text className="mt-1">
                          {selectedPrinter.profile.supportsQr ||
                          selectedPrinter.profile.supportsBarcode
                            ? "Disponible"
                            : "No disponible"}
                        </Text>
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => openProfileDialog(selectedPrinter)}
                    >
                      Ajustar impresora
                    </Button>
                  </>
                ) : (
                  <Text variant="muted">
                    Selecciona una impresora para ver sus detalles.
                  </Text>
                )}
              </CardContent>
            </Card>

            <Card className="border-none bg-card/90 shadow-none ring-1 ring-border/70">
              <CardHeader>
                <SectionTitle>Preferencias</SectionTitle>
                <CardDescription>
                  Ajustes simples para el uso diario.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSaveConfig}>
                    <Settings2Icon />
                    Guardar ajustes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

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
              variant="outline"
              onClick={() => setProfileDialogPrinterId(null)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSavePrinterProfile}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default App;
