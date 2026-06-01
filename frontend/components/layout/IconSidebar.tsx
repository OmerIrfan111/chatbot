"use client";

import { Plus, Search, Home, Folder, Clock, MoreHorizontal, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      <SidebarIcon icon={<Plus className="h-4 w-4" />} label="New chat" />
      <SidebarIcon icon={<Search className="h-4 w-4" />} label="Search" />
      <SidebarIcon icon={<Home className="h-4 w-4" />} label="Home" active />
      <SidebarIcon
        icon={<Folder className="h-4 w-4" />}
        label="Documents"
        onClick={onFolderClick}
        active={folderActive}
      />
      <SidebarIcon icon={<Clock className="h-4 w-4" />} label="History" />

      {/* Dot divider */}
      <div className="my-1 flex flex-col gap-[3px] items-center">
        {[0,1,2].map(i => <div key={i} className="h-[3px] w-[3px] rounded-full bg-[#CCCCCC]" />)}
      </div>

      <SidebarIcon icon={<MoreHorizontal className="h-4 w-4" />} label="More" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom */}
      <SidebarIcon icon={<Settings className="h-4 w-4" />} label="Settings" />
      <button
        className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden border-2 border-[#DCDCDC] hover:border-[#BBBBBB] transition-colors mt-1"
        aria-label="Profile"
      >
        <div className="h-full w-full bg-gradient-to-br from-[#7134C9] to-[#C960D4] flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">U</span>
        </div>
      </button>
    </aside>
  );
}
