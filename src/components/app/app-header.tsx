import {
  ExternalLinkIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  Settings2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const appIconPath = "/icon.png";

type AppHeaderProps = {
  loading: boolean;
  refreshCooldownSeconds: number;
  onRefresh: () => void;
  onOpenMartpos: () => void;
  onOpenSettings: () => void;
};

export function AppHeader({
  loading,
  refreshCooldownSeconds,
  onRefresh,
  onOpenMartpos,
  onOpenSettings,
}: AppHeaderProps) {
  const { t } = useTranslation();

  return (
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
                onClick={onRefresh}
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
                onClick={onOpenMartpos}
              >
                <ExternalLinkIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>
              {t("common.openMartpos")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 cursor-pointer"
                onClick={onOpenSettings}
              >
                <Settings2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={8}>
              {t("common.settings")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
