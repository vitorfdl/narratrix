import { Book, Bot, BoxIcon, ChevronDown, ChevronsLeft, ChevronsRight, Heart, HelpCircle, LogOut, MessageCircle, MessageSquare, Monitor, Moon, Settings, Sun, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChatActions, useChatList, useCurrentChatId } from "@/hooks/chatStore";
import { useCurrentProfile, useProfileActions } from "@/hooks/ProfileStore";
import { type Theme, useThemeStore } from "@/hooks/ThemeContext";
import { useUIStore } from "@/hooks/UIStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { cn } from "@/lib/utils";
import { useLocalChatTabs } from "@/utils/local-storage";

const RECENT_LIMIT = 12;

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

interface RecentChat {
  id: string;
  name: string;
  updatedAt: Date;
}

const formatRelative = (date: Date): string => {
  const diffMs = Date.now() - date.getTime();
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diffMs < min) {
    return "now";
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / min)}m`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h`;
  }
  if (diffMs < 7 * day) {
    return `${Math.floor(diffMs / day)}d`;
  }
  if (diffMs < 30 * day) {
    return `${Math.floor(diffMs / (7 * day))}w`;
  }
  return `${Math.floor(diffMs / (30 * day))}mo`;
};

interface ProfileMenuProps {
  onSettings: () => void;
  onLogout: () => void;
}

const THEME_OPTIONS: Array<{ id: Theme; icon: React.ReactNode; label: string }> = [
  { id: "light", icon: <Sun className="w-3 h-3" />, label: "Light" },
  { id: "dark", icon: <Moon className="w-3 h-3" />, label: "Dark" },
  { id: "system", icon: <Monitor className="w-3 h-3" />, label: "Auto" },
];

const ProfileMenuContent: React.FC<ProfileMenuProps> = ({ onSettings, onLogout }) => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <DropdownMenuContent align="start" sideOffset={8} className="w-64 font-ui p-1 bg-accent border shadow-lg rounded-lg">
      <div className="px-2 pt-1.5 pb-1">
        <div className="font-display italic text-[10.5px] text-muted-foreground/60 lowercase pb-1.5">appearance</div>
        <div className="flex items-center rounded-md bg-muted/50 p-0.5 gap-0.5">
          {THEME_OPTIONS.map((opt) => {
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                aria-pressed={isSelected}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 h-6 rounded text-[11px] font-medium transition-colors",
                  isSelected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <DropdownMenuSeparator className="bg-border/50 my-1" />

      <DropdownMenuItem
        onClick={onSettings}
        className="font-ui text-[12.5px] gap-2.5 px-2 py-1.5 rounded-sm cursor-pointer [&>svg]:size-3.5 [&>svg]:text-muted-foreground/70 focus:[&>svg]:text-foreground"
      >
        <Settings strokeWidth={1.5} />
        <span>Settings</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        onClick={onLogout}
        className="font-ui text-[12.5px] gap-2.5 px-2 py-1.5 rounded-sm cursor-pointer text-muted-foreground/85 [&>svg]:size-3.5 [&>svg]:text-muted-foreground/60 focus:bg-destructive/10 focus:text-destructive focus:[&>svg]:text-destructive"
      >
        <LogOut strokeWidth={1.5} />
        <span>Sign out</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
};

interface ProfileTopProps {
  isCollapsed: boolean;
  name: string | undefined;
  avatarPath: string | null | undefined;
  onToggle: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

const ProfileTop: React.FC<ProfileTopProps> = ({ isCollapsed, name, avatarPath, onToggle, onSettings, onLogout }) => {
  const { url: avatarUrl } = useImageUrl(avatarPath);
  const initials = (name ?? "?").trim().slice(0, 1).toUpperCase();

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 pt-3 pb-3">
        <DropdownMenu>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-1 ring-border/50 hover:ring-primary/50 transition-all">
                  <Avatar className="h-8 w-8 rounded-full">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? ""} />}
                    <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-medium font-ui">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-ui">
              {name ?? "Profile"}
            </TooltipContent>
          </Tooltip>
          <ProfileMenuContent onSettings={onSettings} onLogout={onLogout} />
        </DropdownMenu>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button onClick={onToggle} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Expand sidebar">
              <ChevronsRight size={13} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-ui">
            Expand
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-1 flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-foreground/[0.04] data-[state=open]:bg-foreground/[0.05] transition-colors group">
            <Avatar className="h-7 w-7 rounded-full ring-1 ring-border/50 group-hover:ring-primary/40 transition-all shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? ""} />}
              <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-medium font-ui">{initials}</AvatarFallback>
            </Avatar>
            <span className="font-ui text-[13px] font-medium text-foreground truncate flex-1 text-left">{name ?? "Profile"}</span>
            <ChevronDown size={12} strokeWidth={1.75} className="text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
          </button>
        </DropdownMenuTrigger>
        <ProfileMenuContent onSettings={onSettings} onLogout={onLogout} />
      </DropdownMenu>
      <button
        onClick={onToggle}
        className="h-7 w-7 shrink-0 flex items-center justify-center rounded text-muted-foreground/45 hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
        aria-label="Collapse sidebar"
      >
        <ChevronsLeft size={13} strokeWidth={1.5} />
      </button>
    </div>
  );
};

interface SectionKickerProps {
  children: React.ReactNode;
  delay?: number;
}

const SectionKicker: React.FC<SectionKickerProps> = ({ children, delay = 0 }) => (
  <div className="px-5 pt-4 pb-1.5 flex items-center gap-2.5 animate-in fade-in slide-in-from-left-1 fill-mode-both" style={{ animationDelay: `${delay}ms`, animationDuration: "500ms" }}>
    <span className="font-display italic text-[12px] leading-none text-muted-foreground/65 tracking-wide lowercase">{children}</span>
    <div className="h-px flex-1 bg-border/30" />
  </div>
);

interface NavGroupProps {
  navItems: NavItem[];
  activeSection: string;
  onItemClick: (section: string) => void;
  isCollapsed: boolean;
  startDelay?: number;
}

const NavGroup: React.FC<NavGroupProps> = ({ navItems, activeSection, onItemClick, isCollapsed, startDelay = 0 }) => {
  const buttonRefs = useRef<(HTMLElement | null)[]>([]);
  const [markerTop, setMarkerTop] = useState<number | null>(null);

  useEffect(() => {
    const activeIndex = navItems.findIndex((item) => item.id === activeSection);
    const node = buttonRefs.current[activeIndex];
    if (activeIndex !== -1 && node) {
      setMarkerTop(node.offsetTop + node.offsetHeight / 2);
    } else {
      setMarkerTop(null);
    }
  }, [activeSection, navItems]);

  return (
    <div className="relative">
      {!isCollapsed && markerTop !== null && (
        <span
          aria-hidden
          className="absolute left-2 w-1 h-1 rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ top: markerTop - 2, boxShadow: "0 0 8px color-mix(in oklab, var(--primary) 60%, transparent)" }}
        />
      )}
      <div className={cn("flex flex-col", isCollapsed ? "items-center gap-0.5" : "gap-px")}>
        {navItems.map((item, index) => {
          const isActive = activeSection === item.id;

          const expandedClasses = cn(
            "group relative flex items-center w-full gap-3 pl-5 pr-4 py-2 transition-all duration-150",
            "animate-in fade-in slide-in-from-left-2 fill-mode-both",
            isActive ? "text-foreground" : "text-muted-foreground/75 hover:text-foreground",
          );

          const collapsedClasses = cn(
            "group relative flex items-center justify-center h-9 w-9 rounded transition-all duration-150",
            "animate-in fade-in fill-mode-both",
            isActive ? "text-foreground" : "text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]",
          );

          const itemDelay = startDelay + index * 35;

          const inner = isCollapsed ? (
            <>
              {isActive && <span aria-hidden className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary" />}
              <span className={cn("transition-transform", isActive && "[&>svg]:stroke-[1.75]")}>{item.icon}</span>
            </>
          ) : (
            <>
              <span className={cn("transition-transform duration-200", isActive ? "[&>svg]:stroke-[1.75] text-foreground" : "text-muted-foreground/65 group-hover:text-foreground")}>{item.icon}</span>
              <span className={cn("font-ui text-[14.5px] tracking-tight select-none", isActive && "font-medium")}>{item.label}</span>
              {isActive && (
                <span aria-hidden className="ml-auto font-display italic text-primary text-sm leading-none">
                  ·
                </span>
              )}
            </>
          );

          const node = item.href ? (
            <a
              key={item.id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={isCollapsed ? collapsedClasses : expandedClasses}
              style={{ animationDelay: `${itemDelay}ms`, animationDuration: "400ms" }}
            >
              {inner}
            </a>
          ) : (
            <button
              key={item.id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onItemClick(item.id)}
              className={isCollapsed ? collapsedClasses : expandedClasses}
              style={{ animationDelay: `${itemDelay}ms`, animationDuration: "400ms" }}
            >
              {inner}
            </button>
          );

          if (!isCollapsed) {
            return node;
          }

          return (
            <Tooltip key={item.id} delayDuration={150}>
              <TooltipTrigger asChild>{node}</TooltipTrigger>
              <TooltipContent side="right" className="font-ui">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

interface RecentSessionsProps {
  recent: RecentChat[];
  activeSection: string;
  selectedChatId: string | undefined;
  onOpen: (chatId: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  startDelay?: number;
}

const RecentSessions: React.FC<RecentSessionsProps> = ({ recent, activeSection, selectedChatId, onOpen, isExpanded, onToggle, startDelay = 0 }) => {
  if (recent.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="group w-full px-5 pt-4 pb-1.5 flex items-center gap-2.5 animate-in fade-in slide-in-from-left-1 fill-mode-both"
        style={{ animationDelay: `${startDelay}ms`, animationDuration: "500ms" }}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse recent threads" : "Expand recent threads"}
      >
        <span className="font-display italic text-[12px] leading-none text-muted-foreground/65 group-hover:text-foreground tracking-wide lowercase transition-colors">recent threads</span>
        <div className="h-px flex-1 bg-border/30" />
        <ChevronDown size={11} strokeWidth={1.75} className={cn("text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-all duration-300", !isExpanded && "-rotate-90")} />
      </button>
      <div className={cn("overflow-hidden transition-[max-height,opacity] duration-300 ease-out", isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0")} aria-hidden={!isExpanded}>
        <div className="flex flex-col">
          {recent.map((chat, index) => {
            const isActive = activeSection === "chat" && selectedChatId === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => onOpen(chat.id)}
                title={chat.name}
                tabIndex={isExpanded ? 0 : -1}
                className={cn(
                  "group w-full flex items-baseline gap-2.5 pl-5 pr-4 py-1 transition-colors duration-150",
                  "animate-in fade-in slide-in-from-left-1 fill-mode-both",
                  isActive ? "text-foreground" : "text-muted-foreground/65 hover:text-foreground",
                )}
                style={{ animationDelay: `${startDelay + 60 + index * 35}ms`, animationDuration: "400ms" }}
              >
                <span aria-hidden className={cn("font-mono text-[10px] leading-none translate-y-px", isActive ? "text-primary" : "text-muted-foreground/40 group-hover:text-muted-foreground/70")}>
                  {isActive ? "◆" : "·"}
                </span>
                <span className="truncate text-left text-[13.5px] font-ui">{chat.name}</span>
                <span className="ml-auto font-mono text-[9.5px] text-muted-foreground/40 tabular-nums shrink-0 translate-y-px">{formatRelative(chat.updatedAt)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Sidebar: React.FC = () => {
  const { activeSection, setActiveSection, sidebarCollapsed: isCollapsed, toggleSidebar, recentThreadsExpanded, toggleRecentThreads } = useUIStore();
  const currentProfile = useCurrentProfile();
  const profileId = currentProfile?.id;
  const { logout } = useProfileActions();

  const chatList = useChatList();
  const selectedChatId = useCurrentChatId();
  const { setSelectedChatById } = useChatActions();
  const [openTabIds, setOpenTabIds] = useLocalChatTabs(profileId ?? "");

  const recentChats: RecentChat[] = useMemo(
    () =>
      [...chatList]
        .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
        .slice(0, RECENT_LIMIT)
        .map((chat) => ({ id: chat.id, name: chat.name, updatedAt: chat.updated_at })),
    [chatList],
  );

  const mainNavItems: NavItem[] = [
    { id: "models", label: "Models", icon: <BoxIcon className="w-[18px] h-[18px]" strokeWidth={1.5} /> },
    { id: "characters", label: "Characters", icon: <Users className="w-[18px] h-[18px]" strokeWidth={1.5} /> },
    { id: "agents", label: "Agents", icon: <Bot className="w-[18px] h-[18px]" strokeWidth={1.5} /> },
    { id: "lorebooks", label: "Lorebooks", icon: <Book className="w-[18px] h-[18px]" strokeWidth={1.5} /> },
    { id: "chat", label: "Chat / Worlds", icon: <MessageSquare className="w-[18px] h-[18px]" strokeWidth={1.5} /> },
  ];

  const externalLinks: NavItem[] = [
    { id: "patreon", label: "Patreon", icon: <Heart className="w-3.5 h-3.5" strokeWidth={1.5} />, href: "https://www.patreon.com/NarratrixAI" },
    { id: "discord", label: "Discord", icon: <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />, href: "https://discord.gg/Q69R4aWCFR" },
    { id: "documentation", label: "Documentation", icon: <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />, href: "https://github.com/vitorfdl/narratrix/wiki" },
  ];

  const handleRecentOpen = async (chatId: string) => {
    if (!profileId) {
      return;
    }
    if (!openTabIds.includes(chatId)) {
      setOpenTabIds([...openTabIds, chatId]);
    }
    await setSelectedChatById(profileId, chatId);
    setActiveSection("chat");
  };

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-sidebar sidebar-codex-atmosphere",
        "border-r border-border/40",
        "transition-[width] duration-300 ease-out",
        isCollapsed ? "w-[60px]" : "w-[248px]",
      )}
    >
      {!isCollapsed && <div aria-hidden className="absolute left-3 top-20 bottom-16 w-px bg-border/25 pointer-events-none" />}

      <ProfileTop
        isCollapsed={isCollapsed}
        name={currentProfile?.name}
        avatarPath={currentProfile?.avatar_path}
        onToggle={toggleSidebar}
        onSettings={() => setActiveSection("settings")}
        onLogout={logout}
      />

      {!isCollapsed && <SectionKicker delay={60}>the workspace</SectionKicker>}
      <NavGroup navItems={mainNavItems} activeSection={activeSection} onItemClick={setActiveSection} isCollapsed={isCollapsed} startDelay={100} />

      {!isCollapsed && profileId && (
        <RecentSessions
          recent={recentChats}
          activeSection={activeSection}
          selectedChatId={selectedChatId}
          onOpen={handleRecentOpen}
          isExpanded={recentThreadsExpanded}
          onToggle={toggleRecentThreads}
          startDelay={300}
        />
      )}

      <div className="flex-1" />

      {isCollapsed ? (
        <div className="flex flex-col items-center gap-1 pt-1 pb-3">
          {externalLinks.map((item) => (
            <Tooltip key={item.id} delayDuration={150}>
              <TooltipTrigger asChild>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground/55 hover:text-foreground transition-colors"
                >
                  {item.icon}
                </a>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-ui">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : (
        <div className="px-5 pt-3 pb-3.5">
          <div className="flex items-center gap-2.5 pb-2.5">
            <span className="font-display italic text-[11px] leading-none text-muted-foreground/55 lowercase tracking-wide">elsewhere</span>
            <div className="h-px flex-1 bg-border/25" />
          </div>
          <div className="flex items-stretch">
            {externalLinks.map((item) => (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex-1 flex flex-col items-center gap-1.5 py-1 text-muted-foreground/45 hover:text-foreground transition-colors duration-200"
              >
                <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 transition-transform duration-200 group-hover:-translate-y-0.5">{item.icon}</span>
                <span className="font-mono text-[8.5px] uppercase tracking-[0.22em] text-muted-foreground/35 group-hover:text-muted-foreground transition-colors">{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
