// frontend/src/components/IntervalSelector.jsx
// Updated to use Shadcn Select component

import React from 'react';

// Import the Shadcn/UI Select components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define the display order (optional)
const INTERVAL_ORDER = ['1D', '1W', '1M', '1H', '15M', '5M'];

function IntervalSelector({ supportedIntervals = ['1D'], selectedInterval, onIntervalChange }) {

  // Handler for Select's onValueChange - passes the new value directly
  const handleValueChange = (value) => {
    if (value) {
        console.log("IntervalSelector: Select value changed to:", value);
        onIntervalChange(value);
    }
  };

  // Filter and sort supported intervals based on desired order
  const displayIntervals = INTERVAL_ORDER.filter(interval => supportedIntervals.includes(interval));
  console.log("IntervalSelector: Displaying intervals:", displayIntervals);

  return (
    <div className="interval-selector flex items-center space-x-2">
      <span className="text-sm font-medium text-gray-700">Interval:</span>
      <Select
          value={selectedInterval}
          onValueChange={handleValueChange}
      >
        {/* Use Shadcn Button styling via asChild is possible, or style trigger directly */}
        <SelectTrigger className="w-[70px] h-9 text-xs md:text-sm"> {/* Adjust width */}
          <SelectValue placeholder="Select Interval" />
        </SelectTrigger>
        <SelectContent>
          {/* Map the displayed interval keys to SelectItem options */}
           {displayIntervals.length > 0 ? (
              displayIntervals.map(interval => (
                <SelectItem key={interval} value={interval} className="text-xs md:text-sm">
                  {interval}
                </SelectItem>
              ))
           ) : (
              <div className="px-2 py-1.5 text-xs text-muted-foreground italic">N/A</div>
           )}
        </SelectContent>
      </Select>
    </div>
  );
}

export default IntervalSelector;