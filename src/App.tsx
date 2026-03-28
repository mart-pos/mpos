import { useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircleIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";

import { Text } from "@/components/Typography";
import { AppHeader } from "@/components/app/app-header";
import { DiagnosticsPanel } from "@/components/app/diagnostics-panel";
import { PrinterProfileDialog } from "@/components/app/printer-profile-dialog";
import { PrintersSection } from "@/components/app/printers-section";
import {
  buildPrinterDraft,
  type PrinterProfileDraft,
} from "@/components/app/printer-shared";
import { SettingsDialog } from "@/components/app/settings-dialog";
import { AuthVerification } from "@/components/auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import i18n, { normalizeLanguage } from "@/lib/i18n";
import { connectBridgeEvents } from "@/lib/martpos-bridge-sdk";
import { fallbackBootstrap } from "@/mocks/bootstrap";
import type {
  BootstrapPayload,
  BridgeRealtimeEvent,
  ResolvedPrinter,
  ThemeMode,
} from "@/types/bootstrap";

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

function explainPrintDetail(
  detail: string | null | undefined,
  fallback: string,
  t: TFunction,
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

function App() {
  const { setTheme } = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState<BootstrapPayload>(fallbackBootstrap);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [refreshCooldownSeconds, setRefreshCooldownSeconds] = useState(0);
  const [printCooldownActive, setPrintCooldownActive] = useState(false);
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
  const refreshInFlightRef = useRef(false);
  const printInFlightRef = useRef(false);

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
          setMartposIssue(t("messages.syncPairingError"));
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
        // Background sync only; keep silent.
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
        setMessage(
          explainPrintDetail(result.detail, t("messages.printTestSent"), t),
        );
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
      setMessage(
        explainError(error, t("messages.pairingPrepareMartposError"), t),
      );
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
      <AppHeader
        loading={loading}
        refreshCooldownSeconds={refreshCooldownSeconds}
        onRefresh={() => void refreshPrinters()}
        onOpenMartpos={() => void handleLaunchMartposPairing()}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-6">
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

        <PrintersSection
          printers={data.printers}
          defaultPrinterId={data.config.defaultPrinterId}
          loading={loading}
          refreshCooldownSeconds={refreshCooldownSeconds}
          printCooldownActive={printCooldownActive}
          printBusy={printInFlightRef.current}
          readyPrinters={readyPrinters}
          onRefresh={() => void refreshPrinters()}
          onOpenSettings={() => setSettingsOpen(true)}
          onSetDefault={(printerId) => void handleSetDefault(printerId)}
          onOpenProfile={openProfileDialog}
          onPrintTest={(printerId) => void handlePrintTest(printerId)}
          onPrintLastReceipt={(printer) => void handlePrintLastReceipt(printer)}
        />

        <DiagnosticsPanel
          socketConnected={socketConnected}
          martposConnected={data.bridge.connected}
          allowedOrigin={data.config.allowedOrigin}
          defaultPrinterName={defaultPrinter?.name ?? null}
          readyPrinters={readyPrinters}
          onlinePrinters={onlinePrinters.length}
          diagnosisItems={diagnosisItems}
        />
      </div>

      <SettingsDialog
        open={settingsOpen}
        locale={configDraft.locale}
        theme={configDraft.theme}
        onOpenChange={setSettingsOpen}
        onLocaleChange={(value) =>
          setConfigDraft((current) => ({ ...current, locale: value }))
        }
        onThemeChange={(value) => {
          setTheme(value);
          setConfigDraft((current) => ({ ...current, theme: value as ThemeMode }));
        }}
      />

      <PrinterProfileDialog
        printer={profileDialogPrinter}
        draft={printerDraft}
        open={profileDialogPrinter !== null && printerDraft !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProfileDialogPrinterId(null);
          }
        }}
        onDraftChange={setPrinterDraft}
        onReset={() => {
          if (profileDialogPrinter) {
            setPrinterDraft(buildPrinterDraft(profileDialogPrinter));
          }
        }}
        onSave={() => void handleSavePrinterProfile()}
      />
    </main>
  );
}

export default App;
