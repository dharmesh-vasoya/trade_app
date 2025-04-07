// frontend/src/components/IndicatorSelector.jsx
import React from 'react';
// Import a suitable icon from lucide-react (make sure you installed it: npm install lucide-react or yarn add lucide-react)
import { SlidersHorizontal } from 'lucide-react';

// Import Shadcn/UI components
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function IndicatorSelector({ availableIndicators, selectedIndicators, onIndicatorChange }) {

  // Adapter function for Shadcn Checkbox item change to match event structure
  const handleCheckedChange = (checked, indicatorId) => {
    console.log(`IndicatorSelector: ${indicatorId} checked state changed to: ${checked}`);
    // Create a synthetic event object expected by the handler in StockDataViewer
    onIndicatorChange({
      target: {
        name: indicatorId,    // The ID of the indicator (e.g., "SMA")
        checked: checked,     // The new boolean checked state
        type: 'checkbox'
      }
    });
  };

  // Check if indicators are missing despite non-empty list
  const indicatorsMissing = availableIndicators.length > 0 &&
                            availableIndicators.every(ind => !ind?.id);

  return (
    <div className="indicator-selector">
      <DropdownMenu>
        {/* Icon Button as the trigger */}
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="sr-only">Indicators</span> {/* For screen readers */}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Available Indicators</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Show loading message if list is empty */}
          {availableIndicators.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
          )}

          {/* Render checkbox items */}
          {availableIndicators.map((ind) => (
            <DropdownMenuCheckboxItem
              key={ind.id}
              checked={selectedIndicators[ind.id] || false}
              onCheckedChange={(checked) => handleCheckedChange(checked, ind.id)}
            >
              {ind.name}
            </DropdownMenuCheckboxItem>
          ))}

          {/* Show fallback message if no valid indicators */}
          {indicatorsMissing && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No indicators available.</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default IndicatorSelector;
