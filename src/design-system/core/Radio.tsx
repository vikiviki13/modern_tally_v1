import React from 'react';

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: string;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  disabled?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  orientation = 'vertical',
  disabled = false,
}) => {
  return (
    <div
      className={`flex ${
        orientation === 'horizontal' ? 'flex-row gap-4' : 'flex-col gap-2'
      }`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={`inline-flex items-start gap-2 cursor-pointer select-none ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className="pt-0.5">
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isSelected}
                onChange={() => !disabled && onChange(opt.value)}
                disabled={disabled}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-slate-900'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-200">{opt.label}</span>
              {opt.description && (
                <span className="text-[11px] text-slate-400">{opt.description}</span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
};
