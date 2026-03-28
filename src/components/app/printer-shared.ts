import type { TFunction } from "i18next";

import type {
  PaperWidth,
  PrinterType,
  ResolvedPrinter,
  ThemeMode,
} from "@/types/bootstrap";

export const printerTypes: PrinterType[] = [
  "thermal",
  "inkjet",
  "laser",
  "label",
  "unknown",
];

export const paperWidths: PaperWidth[] = ["mm58", "mm80", "unknown"];
export const themeModes: ThemeMode[] = ["light", "dark", "system"];
export const localeOptions = [
  { value: "es-EC", country: "es" },
  { value: "en-US", country: "us" },
  { value: "fr-FR", country: "fr" },
  { value: "pt-BR", country: "br" },
] as const;

export type PrinterProfileDraft = {
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

export function buildPrinterDraft(
  printer: ResolvedPrinter,
): PrinterProfileDraft {
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

export function statusTone(status: ResolvedPrinter["status"]) {
  if (status === "online") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "offline") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }

  return "border-border bg-muted text-muted-foreground";
}

export function statusText(status: ResolvedPrinter["status"], t: TFunction) {
  if (status === "online") {
    return t("printers.status.online");
  }
  if (status === "offline") {
    return t("printers.status.offline");
  }
  return t("printers.status.unknown");
}

export function connectionLabel(value: string, t: TFunction) {
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

export function typeLabel(value: PrinterType, t: TFunction) {
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

export function paperLabel(value: PaperWidth, t: TFunction) {
  switch (value) {
    case "mm58":
      return "58 mm";
    case "mm80":
      return "80 mm";
    default:
      return t("printers.paper.unknown");
  }
}
