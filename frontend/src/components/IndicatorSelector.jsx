import React from 'react';
import './IndicatorSelector.css';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function IndicatorSelector({
  availableIndicators = [],
  selectedIndicators = {},
  onToggle = () => {},
  onParamChange = () => {},
}) {
  const indicatorsMissing =
    availableIndicators.length > 0 &&
    availableIndicators.every((ind) => !ind?.id);

  return (
    <div className="indicator-selector">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="indicator-trigger-btn"
            title="Select Indicators"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="sr-only">Indicators</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="indicator-dropdown w-72 max-h-[400px] overflow-y-auto">
          <DropdownMenuLabel className="dropdown-header">
            Available Indicators
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableIndicators.length === 0 && (
            <div className="dropdown-empty">Loading...</div>
          )}

          {availableIndicators.map((ind) => (
            <div key={ind.id} className="indicator-item px-2 py-1">
              <DropdownMenuCheckboxItem
                checked={selectedIndicators?.[ind.id]?.enabled || false}
                onCheckedChange={(checked) => onToggle(ind.id, checked)}
                disabled={!ind?.id}
              >
                {ind.name || 'Unnamed Indicator'}
              </DropdownMenuCheckboxItem>

              {/* Optional: Show parameter inputs */}
              {selectedIndicators?.[ind.id]?.enabled &&
                ind?.default_params &&
                Object.entries(ind.default_params).map(([paramKey, defaultVal]) => (
                  <div key={paramKey} className="param-input px-4 py-1 text-xs">
                    <label>
                      {paramKey}:{' '}
                      <input
                        type="number"
                        defaultValue={
                          selectedIndicators[ind.id]?.params?.[paramKey] ?? defaultVal
                        }
                        onChange={(e) =>
                          onParamChange(ind.id, paramKey, e.target.value)
                        }
                        className="w-16 ml-2 text-right border rounded px-1"
                      />
                    </label>
                  </div>
                ))}
            </div>
          ))}

          {indicatorsMissing && (
            <div className="dropdown-empty">No indicators available.</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default IndicatorSelector;
