import { useUIStore } from "@/hooks/UIStore"; // Import the store
import {
  Book,
  BoxIcon, // for Models
  Heart, // for Patreon
  Menu,
  MessageCircle, // for Discord
  MessageSquare,
  NotebookTabs,
  RabbitIcon, // for Chat/Worlds
  Settings, // for Settings
  Users,
} from "lucide-react";
// src/components/layout/Sidebar.tsx
import { useEffect, useRef, useState } from "react";

interface SidebarProps {
  // Remove props: setActiveSection and activeSection
  // setActiveSection: (section: string) => void;
  // activeSection: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  isMainNav?: boolean;
  href?: string; // Add href for external links
}

interface NavGroupProps {
  navItems: NavItem[];
  activeSection: string;
  onItemClick: (section: string) => void;
  isCollapsed: boolean;
  containerClassName?: string;
  indicatorClassName?: string;
  wrapIcon?: boolean;
}

const NavGroup: React.FC<NavGroupProps> = ({
  navItems,
  activeSection,
  onItemClick,
  isCollapsed,
  containerClassName = "",
  indicatorClassName = "",
  wrapIcon = false,
}) => {
  const buttonRefs = useRef<(HTMLElement | null)[]>([]);
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
  const [indicatorHeight, setIndicatorHeight] = useState<number | null>(null);

  useEffect(() => {
    const activeIndex = navItems.findIndex((item) => item.id === activeSection);
    if (activeIndex !== -1 && buttonRefs.current[activeIndex]) {
      setIndicatorTop(buttonRefs.current[activeIndex]!.offsetTop);
      setIndicatorHeight(buttonRefs.current[activeIndex]!.offsetHeight);
    } else {
      setIndicatorTop(null);
      setIndicatorHeight(null);
    }
  }, [activeSection, navItems]);

  return (
    <div className={containerClassName}>
      {navItems.map((item, index) => {
        const commonClasses = `w-full flex items-center gap-2 text-sm px-2 py-3 transition-colors relative ${
          activeSection === item.id ? "bg-zinc-800/50 text-white" : "hover:bg-zinc-800/30 text-muted-foreground"
        }`;

        const content = (
          <>
            {wrapIcon ? (
              <div key={`icon-${item.id}`} className={`${activeSection === item.id ? "ml-1" : ""}`}>
                {item.icon}
              </div>
            ) : (
              item.icon
            )}
            {!isCollapsed && <span className="select-none">{item.label}</span>}
          </>
        );

        return item.href ? (
          <a
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={commonClasses}
          >
            {content}
          </a>
        ) : (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => onItemClick(item.id)}
            className={commonClasses}
          >
            {content}
          </button>
        );
      })}
      {indicatorTop !== null && indicatorHeight !== null && (
        <div style={{ top: `${indicatorTop}px`, height: `${indicatorHeight}px` }} className={indicatorClassName} />
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Use the store
  const { activeSection, setActiveSection } = useUIStore();

  const mainNavItems: NavItem[] = [
    { id: "models", label: "Models", icon: <BoxIcon className="w-5 h-5" />, isMainNav: true },
    {
      id: "inference",
      label: "Formatting Templates",
      icon: <NotebookTabs className="w-5 h-5" />,
      isMainNav: true,
    },
    {
      id: "chat",
      label: "Chat / Worlds",
      icon: <MessageSquare className="w-5 h-5" />,
      isMainNav: true,
    },
    {
      id: "characters",
      label: "Characters",
      icon: <Users className="w-5 h-5" />,
      isMainNav: true,
    },
    {
      id: "agents",
      label: "Agents",
      icon: <RabbitIcon className="w-5 h-5" />,
      isMainNav: true,
    },
    { id: "lorebooks", label: "Lorebooks", icon: <Book className="w-5 h-5" />, isMainNav: true },
  ];

  const bottomNavItems: NavItem[] = [
    {
      id: "patreon",
      label: "Become a Patreon",
      icon: <Heart className="w-5 h-5" />,
      href: "https://www.patreon.com/NarratrixAI",
    },
    {
      id: "discord",
      label: "Join Discord Server",
      icon: <MessageCircle className="w-5 h-5" />,
      href: "https://discord.gg/Q69R4aWCFR",
    },
    { id: "settings", label: "Settings", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className={`flex flex-col h-screen shadow-lg bg-sidebar ${isCollapsed ? "w-10" : "w-52"}`}>
      {/* Top Header */}
      <div className="p-1 flex justify-between items-center">
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="hover:bg-gray-800 p-2 rounded-md">
          <Menu size={15} />
        </button>
      </div>

      {/* Main Navigation */}
      <NavGroup
        navItems={mainNavItems}
        activeSection={activeSection}
        onItemClick={setActiveSection}
        isCollapsed={isCollapsed}
        containerClassName="relative flex-1"
        indicatorClassName="absolute left-0 w-1 bg-primary transition-all duration-300 ease-out"
      />

      {/* Bottom Navigation */}
      <NavGroup
        navItems={bottomNavItems}
        activeSection={activeSection}
        onItemClick={setActiveSection}
        isCollapsed={isCollapsed}
        containerClassName="relative border-t border-gray-800"
        indicatorClassName="absolute left-0 w-1 bg-primary transition-all duration-300 ease-out"
        wrapIcon={true}
      />
    </div>
  );
};

export default Sidebar;
