// frontend/src/components/IndicatorSelector.jsx
import React from 'react';
// Import a suitable icon from lucide-react (make sure you installed it: npm install lucide-react or yarn add lucide-react)
import { SlidersHorizontal } from 'lucide-react'; // Using SlidersHorizontal as an example icon

// Import Shadcn/UI components (assuming default path alias '@')
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
            checked: checked,   // The new boolean checked state
            type: 'checkbox'
        }
    });
  };

  // Calculate count for potential badge later, not used on icon button now
  // const selectedCount = Object.values(selectedIndicators).filter(Boolean).length;

  return (
    <div className="indicator-selector"> {/* No extra layout classes needed here usually */}
      <DropdownMenu>
        {/* Use an Icon Button as the trigger */}
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon"> {/* Use size="icon" for square button */}
             <SlidersHorizontal className="h-4 w-4" /> {/* Render the icon */}
             <span className="sr-only">Indicators</span> {/* For screen readers */}
          </Button>
        </DropdownMenuTrigger>

        {/* The content of the dropdown menu */}
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Available Indicators</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Show loading message or map indicators to checkbox items */}
          {availableIndicators.length === 0 && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading...</div>
          )}

          {availableIndicators.map((ind) => (
            <DropdownMenuCheckboxItem
              key={ind.id}
              checked={selectedIndicators[ind.id] || false}
              // Pass the adapter function to onCheckedChange
              onCheckedChange={(checked) => handleCheckedChange(checked, ind.id)}
            >
              {ind.name} {/* Display the descriptive indicator name */}
              {/* Example placeholder for showing format - customize later */}
              {/* <span className="ml-auto text-xs tracking-widest opacity-60">{ind.example_format}</span> */}
            </DropdownMenuCheckboxItem>
          ))}
          {/* Add message if backend returns empty list */}
          {availableIndicators.length > 0 && availableIndicators.every(ind => !ind.id) && (
             <div className="px-2 py-1.5 text-sm text-muted-foreground">No indicators available.</div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default IndicatorSelector;