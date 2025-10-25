import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TabNavigation = ({ tabs, activeTab, onTabChange }: TabNavigationProps) => {
  return (
    <div className="mb-4 border-b border-border">
      <nav className="flex space-x-4" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "whitespace-nowrap py-2 px-4 font-medium text-sm rounded-md transition-colors",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};