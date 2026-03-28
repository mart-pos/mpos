"use client";

import * as React from "react";
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
  Loader2,
  Check,
  Copy,
  RefreshCw,
  Unlink,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { SectionTitle, Text } from "./Typography";

function parseUnixTimestamp(value: string | null) {
  if (!value?.startsWith("unix:")) {
    return null;
  }

  const parsed = Number(value.replace("unix:", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCountdown(expiresAt: string | null, nowMs: number) {
  const unix = parseUnixTimestamp(expiresAt);
  if (!unix) {
    return "5 minutos";
  }

  const remaining = Math.max(0, unix * 1000 - nowMs);
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatLinkedAgo(value: string | null, nowMs: number) {
  const unix = parseUnixTimestamp(value);
  if (!unix) {
    return "Vinculado hace poco";
  }

  const diffSeconds = Math.max(0, Math.floor(nowMs / 1000) - unix);
  if (diffSeconds < 10) {
    return "Vinculado hace unos segundos";
  }
  if (diffSeconds < 60) {
    return `Vinculado hace ${diffSeconds} segundos`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `Vinculado hace ${diffMinutes} min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `Vinculado hace ${diffHours} h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `Vinculado hace ${diffDays} d`;
}

type AuthVerificationProps = {
  connected: boolean;
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  pairingActive: boolean;
  autoLinkPending: boolean;
  browserName: string | null;
  machineName: string | null;
  pairedAt: string | null;
  onAutoLink: () => void;
  onGenerateCode: () => void;
  onCopyCode: () => Promise<void> | void;
  onDisconnect: () => void;
};

export function AuthVerification({
  connected,
  pairingCode,
  pairingExpiresAt,
  pairingActive,
  autoLinkPending,
  browserName,
  machineName,
  pairedAt,
  onAutoLink,
  onGenerateCode,
  onCopyCode,
  onDisconnect,
}: AuthVerificationProps) {
  const [copied, setCopied] = React.useState(false);
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [disconnectDialogOpen, setDisconnectDialogOpen] = React.useState(false);

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    await onCopyCode();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = () => {
    setCopied(false);
    onGenerateCode();
  };

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // Card de conexión exitosa
  if (connected) {
    return (
      <div className="w-full">
        <div className="w-full space-y-4 ">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle>Conexion lista</SectionTitle>
              <Text variant="muted">
                Este equipo ya esta vinculado con Mart POS
              </Text>
            </div>
          </div>

          {/* Device info */}
          <div className="p-4 rounded-2xl border border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <img
                  src="src/assets/logo-light.svg"
                  width={100}
                  height={100}
                  alt="Mart POS Logo"
                  className="invert dark:invert-0 w-8 h-8"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">
                  {(browserName ?? "Mart POS") +
                    " en " +
                    (machineName ?? "este equipo")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatLinkedAgo(pairedAt, nowMs)}
                </p>
              </div>
              <Button
                variant="destructive"
                size={"lg"}
                className="w-fit"
                onClick={() => setDisconnectDialogOpen(true)}
              >
                <Unlink className="w-4 h-4 mr-2" />
                Olvidar conexion
              </Button>
            </div>
          </div>

          {/* Disconnect button */}
        </div>
        <Dialog
          open={disconnectDialogOpen}
          onOpenChange={setDisconnectDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Olvidar conexion</DialogTitle>
              <DialogDescription>
                Esta accion desvinculara este equipo de MartPOS. Tendras que
                volver a conectarlo para usarlo otra vez.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisconnectDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setDisconnectDialogOpen(false);
                  onDisconnect();
                }}
              >
                Si, olvidar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Card de verificación pendiente
  return (
    <div className="w-full">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
          <div className="w-full justify-center flex">
            <img
              src="src/assets/logo-light.svg"
              width={100}
              height={100}
              alt="Mart POS Logo"
              className="invert dark:invert-0  w-10 h-10"
            />
          </div>
          <h1 className="text-lg font-semibold text-foreground text-center mb-1">
            Conecta con MartPOS
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Elige como quieres vincular este equipo
          </p>
        </div>

        {/* Divider */}

        <Tabs defaultValue="2">
          <TabsList className="w-full" variant="line">
            <TabsTrigger className="w-full h-10 cursor-pointer" value="2">
              Automatico
            </TabsTrigger>
            <TabsTrigger className="w-full h-10 cursor-pointer" value="1">
              Codigo manual
            </TabsTrigger>
          </TabsList>
          <div className="border-t border-border" />

          <TabsContent value="1">
            <div className="pt-10 pb-5 sm:px-8">
              <div className="flex justify-center items-center mb-1 gap-2">
                <span className="text-sm font-medium text-foreground">
                  Codigo de vinculacion
                </span>
              </div>

              <p className="text-xs text-center text-muted-foreground mb-4">
                Copia este codigo y pegalo en MartPOS si prefieres completar la
                vinculacion manualmente
              </p>

              {/* Código */}
              <div
                className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4"
                suppressHydrationWarning
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="w-10 h-12 sm:w-11 sm:h-13 flex items-center justify-center rounded-lg bg-secondary border border-border text-xl sm:text-2xl font-mono font-semibold text-foreground"
                    suppressHydrationWarning
                  >
                    {pairingCode ? pairingCode[index] : "-"}
                  </div>
                ))}
              </div>

              {/* Acciones código */}
              <div className="flex w-full justify-center gap-2">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-fit"
                  onClick={handleRegenerateCode}
                  disabled={pairingActive}
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Generar codigo
                </Button>
                <Button size="lg" className="w-30" onClick={handleCopyCode}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1.5" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <p className="text-center text-xs text-muted-foreground">
                {pairingCode
                  ? `Este codigo vence en ${formatCountdown(pairingExpiresAt, nowMs)}`
                  : "Genera un codigo para vincular este equipo"}
              </p>
            </div>
          </TabsContent>
          <TabsContent value="2">
            <div className="p-6 flex justify-between sm:px-8">
              <div>
                <div className="flex items-center mb-1 gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Vinculacion automatica
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mb-4">
                  Abre MartPOS y completa la vinculacion sin copiar codigos
                </p>
              </div>
              {!autoLinkPending && (
                <Button
                  variant="default"
                  className="w-fit"
                  size={"lg"}
                  onClick={onAutoLink}
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir MartPOS
                </Button>
              )}

              {autoLinkPending && (
                <div className="flex items-center justify-center gap-3 h-11 px-4 rounded-lg bg-secondary border border-border">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Esperando confirmacion...
                  </span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
      </div>
    </div>
  );
}
