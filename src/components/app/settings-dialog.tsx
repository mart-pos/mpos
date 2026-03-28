import { useTranslation } from "react-i18next";

import { Text } from "@/components/Typography";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/types/bootstrap";

import { localeOptions, themeModes } from "./printer-shared";

type SettingsDialogProps = {
  open: boolean;
  locale: string;
  theme: ThemeMode;
  onOpenChange: (open: boolean) => void;
  onLocaleChange: (value: string) => void;
  onThemeChange: (value: ThemeMode) => void;
};

export function SettingsDialog({
  open,
  locale,
  theme,
  onOpenChange,
  onLocaleChange,
  onThemeChange,
}: SettingsDialogProps) {
  const { t } = useTranslation();
  const selectedLocaleOption =
    localeOptions.find((option) => option.value === locale) ?? localeOptions[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>{t("settings.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <Text asChild weight="medium">
              <label>{t("settings.language")}</label>
            </Text>
            <Select value={locale} onValueChange={onLocaleChange}>
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
              value={theme}
              onValueChange={(value) => onThemeChange(value as ThemeMode)}
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
            onClick={() => onOpenChange(false)}
          >
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
