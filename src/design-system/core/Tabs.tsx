import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  density?: 'compact' | 'comfortable';
  variant?: 'segmented' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  density = 'compact',
  variant = 'segmented',
}) => {
  if (variant === 'segmented') {
    return (
      <div className="inline-flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 select-none cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-indigo-300 shadow-sm border border-slate-700/80 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
              } ${density === 'compact' ? 'text-[11px] py-0.5 px-2' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1 py-0.2 rounded text-[10px] font-mono tabular-nums ${
                    isActive ? 'bg-indigo-950/80 text-indigo-300' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 border-b border-slate-800">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-2 pb-2 text-xs font-medium transition-colors border-b-2 select-none cursor-pointer ${
              isActive
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-slate-800 text-slate-400">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
