// src/components/layout/Sidebar.tsx
import { useState, useEffect, useRef } from 'react';
import {
    Dog, // for Models
    Brain, // for Inference Templates
    MessageSquare, // for Chat/Worlds
    Users, // for Character and Agents
    Book, // for Lorebooks
    Heart, // for Patreon
    MessageCircle, // for Discord
    Settings, // for Settings
    Menu
} from 'lucide-react';

interface SidebarProps {
    setActiveSection: (section: string) => void;
    activeSection: string;
}

export interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    isMainNav?: boolean;
    href?: string;  // Add href for external links
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
    containerClassName = '',
    indicatorClassName = '',
    wrapIcon = false
}) => {
    const buttonRefs = useRef<(HTMLElement | null)[]>([]);
    const [indicatorTop, setIndicatorTop] = useState<number | null>(null);
    const [indicatorHeight, setIndicatorHeight] = useState<number | null>(null);

    useEffect(() => {
        const activeIndex = navItems.findIndex(item => item.id === activeSection);
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
                const commonClasses = `w-54 flex items-center gap-2 text-sm px-2 py-3 transition-colors relative ${
                    activeSection === item.id
                        ? 'bg-zinc-800/50 text-white'
                        : 'hover:bg-zinc-800/30 text-zinc-400'
                }`;

                const content = (
                    <>
                        {wrapIcon ? (
                            <div className={`${activeSection === item.id ? 'ml-1' : ''}`}>
                                {item.icon}
                            </div>
                        ) : (
                            item.icon
                        )}
                        {!isCollapsed && <span className='select-none'>{item.label}</span>}
                    </>
                );

                return item.href ? (
                    <a
                        key={item.id}
                        ref={el => (buttonRefs.current[index] = el)}
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
                        ref={el => (buttonRefs.current[index] = el)}
                        onClick={() => onItemClick(item.id)}
                        className={commonClasses}
                    >
                        {content}
                    </button>
                );
            })}
            {indicatorTop !== null && indicatorHeight !== null && (
                <div
                    style={{ top: `${indicatorTop}px`, height: `${indicatorHeight}px` }}
                    className={indicatorClassName}
                />
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ setActiveSection, activeSection }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const mainNavItems: NavItem[] = [
        { id: 'models', label: 'Models', icon: <Dog className="w-5 h-5" />, isMainNav: true },
        { id: 'inference', label: 'Inference Templates', icon: <Brain className="w-5 h-5" />, isMainNav: true },
        { id: 'chat', label: 'Chat / Worlds', icon: <MessageSquare className="w-5 h-5" />, isMainNav: true },
        { id: 'characters', label: 'Character and Agents', icon: <Users className="w-5 h-5" />, isMainNav: true },
        { id: 'lorebooks', label: 'Lorebooks', icon: <Book className="w-5 h-5" />, isMainNav: true },
    ];

    const bottomNavItems: NavItem[] = [
        { 
            id: 'patreon', 
            label: 'Become a Patreon', 
            icon: <Heart className="w-5 h-5" />,
            href: 'https://www.patreon.com/narratrix'
        },
        { 
            id: 'discord', 
            label: 'Join Discord Server', 
            icon: <MessageCircle className="w-5 h-5" />,
            href: 'https://discord.gg/Q69R4aWCFR'
        },
        { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
    ];

    return (
        <div className={`flex flex-col h-screen shadow-lg bg-black text-white ${isCollapsed ? 'w-10' : 'w-52'}`}>
            {/* Top Header */}
            <div className="p-1 flex justify-between items-center">
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hover:bg-gray-800 p-2 rounded-md"
                >
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
                indicatorClassName="absolute left-0 w-1 bg-purple-500 transition-all duration-300 ease-out"
            />

            {/* Bottom Navigation */}
            <NavGroup
                navItems={bottomNavItems}
                activeSection={activeSection}
                onItemClick={setActiveSection}
                isCollapsed={isCollapsed}
                containerClassName="relative border-t border-gray-800"
                indicatorClassName="absolute left-0 w-1 bg-purple-500 transition-all duration-300 ease-out"
                wrapIcon={true}
            />
        </div>
    );
};

export default Sidebar;
