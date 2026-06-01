"use client";

import Link from "next/link";
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
  href,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
}) {
  const cls = cn(
    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
    active
      ? "bg-[var(--ink)] text-[var(--bg)]"
      : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
  );

  // Navigation uses a real Link (reliable + prefetched); actions use a button.
  const trigger = href ? (
    <Link href={href} prefetch className={cls} aria-label={label}>
      {icon}
    </Link>
  ) : (
    <button onClick={onClick} className={cls} aria-label={label}>
      {icon}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function IconSidebar({ onFolderClick, folderActive }: IconSidebarProps) {
  const clearMessages = useChatStore((s) => s.clearMessages);

  return (
    <aside className="relative z-10 flex flex-col items-center w-[60px] shrink-0 py-4 gap-1 bg-[var(--surface)] border-r border-[var(--line)]">
      {/* Logo — brand mark */}
      <Link href="/" aria-label="Mutex home" className="flex h-9 w-9 items-center justify-center mb-3 shrink-0">
        <svg viewBox="0 0 120 80" className="w-7 text-[var(--ink)]" fill="currentColor">
          <path d="M8 72 L8 40 C8 28 19 18 34 18 C49 18 60 28 60 40 L60 72 L46 72 L46 41 C46 35 41 31 34 31 C27 31 22 35 22 41 L22 72 Z" />
          <path d="M68 72 L68 40 L112 12 L112 72 L98 72 L98 34 L82 44 L82 72 Z" />
        </svg>
      </Link>

      {/* Nav icons */}
      <SidebarIcon
        icon={<Plus className="h-4 w-4" />}
        label="New chat"
        onClick={clearMessages}
      />
      <SidebarIcon
        icon={<Home className="h-4 w-4" />}
        label="Home"
        href="/"
        active
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
        href="/admin"
      />
    </aside>
  );
}
