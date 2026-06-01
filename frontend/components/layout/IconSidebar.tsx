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
                ? "bg-[#1A1A1A] text-white"
                : "text-[#888888] hover:bg-[#E2E2E2] hover:text-[#1A1A1A]"
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
    <aside className="flex flex-col items-center w-[60px] shrink-0 py-4 gap-1 bg-[#EBEBEB] border-r border-[#DCDCDC]">
      {/* Logo */}
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A1A1A] mb-3 shrink-0">
        <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
          <circle cx="6"  cy="6"  r="2.2" fill="white" />
          <circle cx="14" cy="6"  r="2.2" fill="white" />
          <circle cx="6"  cy="14" r="2.2" fill="white" />
          <circle cx="14" cy="14" r="2.2" fill="white" />
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
