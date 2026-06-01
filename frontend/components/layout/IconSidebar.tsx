"use client";

import { useRouter } from "next/navigation";
import { Plus, Home, Folder, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChatStore } from "@/store/chat";

interface IconSidebarProps {
  onFolderClick: () => void;
  folderActive: boolean;
}

function SidebarIcon({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            onClick={onClick}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              active
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            )}
            aria-label={label}
          >
            {icon}
          </button>
        }
      />
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function IconSidebar({ onFolderClick, folderActive }: IconSidebarProps) {
  const router = useRouter();
  const clearMessages = useChatStore((s) => s.clearMessages);

  return (
    <aside className="relative z-10 flex flex-col items-center w-[60px] shrink-0 py-4 gap-1 bg-[var(--surface)] border-r border-[var(--line)]">
      {/* Logo — 4-point star motif (ties to the hero) */}
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ink)] mb-3 shrink-0">
        <svg viewBox="0 0 20 20" className="h-4 w-4">
          <path
            d="M10 1 C 11 6 14 9 19 10 C 14 11 11 14 10 19 C 9 14 6 11 1 10 C 6 9 9 6 10 1 Z"
            fill="var(--accent)"
          />
        </svg>
      </div>

      {/* Nav icons */}
      <SidebarIcon
        icon={<Plus className="h-4 w-4" />}
        label="New chat"
        onClick={clearMessages}
      />
      <SidebarIcon
        icon={<Home className="h-4 w-4" />}
        label="Home"
        active
        onClick={() => router.push("/")}
      />
      <SidebarIcon
        icon={<Folder className="h-4 w-4" />}
        label="Documents"
        onClick={onFolderClick}
        active={folderActive}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom */}
      <SidebarIcon
        icon={<Settings className="h-4 w-4" />}
        label="Admin dashboard"
        onClick={() => router.push("/admin")}
      />
    </aside>
  );
}
