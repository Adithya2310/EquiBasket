// Lightweight Custom Tabs Component

import { createContext, useContext, useState, ReactNode } from "react";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within Tabs");
  }
  return context;
}

interface TabsProps {
  defaultValue: string;
  children: ReactNode;
  onChange?: (value: string) => void;
  className?: string;
}

export function Tabs({ defaultValue, children, onChange, className = "" }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onChange?.(value);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = "" }: TabsListProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-1 p-1
        bg-slate-800/50 rounded-lg
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function Tab({ value, children, className = "" }: TabProps) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`
        px-4 py-2 text-sm font-medium rounded-md
        transition-all duration-200
        ${
          isActive
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-slate-700/50"
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className = "" }: TabPanelProps) {
  const { activeTab } = useTabs();

  if (activeTab !== value) return null;

  return (
    <div className={`mt-4 ${className}`}>
      {children}
    </div>
  );
}

export default Tabs;

