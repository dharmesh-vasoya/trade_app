// frontend/src/components/StockSelector.jsx
// FINAL Version with fix for stockList.find error

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react"; // Icons

// Import Shadcn UI Components (ensure these were added via `npx shadcn@latest add ...`)
import { cn } from "@/lib/utils"; // Utility for merging Tailwind classes
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";


function StockSelector({ currentSymbol, currentExchange, onStockSelect }) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(""); // Input field value
  const [stockList, setStockList] = useState([]); // Holds full list from backend {value, label, symbol, exchange}
  const [filteredList, setFilteredList] = useState([]); // List filtered by search

  // Fetch the list of stocks for the current exchange (e.g., NSE)
  useEffect(() => {
    // Use the exchange passed via props to fetch the relevant list
    const listUrl = `http://127.0.0.1:5000/api/stocks/list?exchange=${currentExchange}`;
    console.log("StockSelector: Fetching stock list from:", listUrl);
    setStockList([]); // Clear previous list
    setFilteredList([]);

    fetch(listUrl)
      .then(res => {
        if (!res.ok) { throw new Error(`HTTP ${res.status} fetching stock list`); }
        return res.json();
       })
      .then(data => {
         // Format data for Combobox: value should be unique, label is display text
         const formattedList = data.map(stock => ({
             value: `${stock.symbol}|${stock.exchange}`, // Unique value combining symbol and exchange
             label: `${stock.symbol} (${stock.name || 'N/A'})`, // Display text
             symbol: stock.symbol, // Store original symbol
             exchange: stock.exchange // Store original exchange
         }));
         setStockList(formattedList);
         setFilteredList(formattedList); // Initially show all
         console.log(`StockSelector: Loaded ${formattedList.length} stocks for ${currentExchange}.`);
         // console.log("DEBUG StockSelector: stockList state set (first 5):", formattedList.slice(0, 5));
      })
      .catch(error => {
          console.error("StockSelector: Error fetching stock list:", error);
          setStockList([]); // Set empty on error
          setFilteredList([]);
      });
  }, [currentExchange]); // Re-fetch only if the exchange prop changes


  // Filter list based on search input
  useEffect(() => {
    // console.log("DEBUG StockSelector: Filtering Effect. Search:", searchValue, "StockList Length:", stockList.length);
    if (!searchValue) {
      setFilteredList(stockList); // Show all if search is empty
      // console.log("DEBUG StockSelector: No search value, showing full list. Filtered Length:", stockList.length);
      return;
    }
    const lowerSearch = searchValue.toLowerCase();
    // Ensure stockList is an array before filtering
    const newlyFiltered = Array.isArray(stockList)
        ? stockList.filter((stock) =>
            stock.label && typeof stock.label === 'string' && stock.label.toLowerCase().includes(lowerSearch)
          )
        : []; // Default to empty array if stockList isn't ready
    setFilteredList(newlyFiltered);
    // console.log("DEBUG StockSelector: Filtered list updated. Filtered Length:", newlyFiltered.length);
  }, [searchValue, stockList]); // Depend on search value and the full list


  // Handler when user selects an item from the list
  const handleSelect = (selectedValue) => { // selectedValue is the 'value' prop from CommandItem (e.g., "TCS|NSE")
    const selectedStock = stockList.find((stock) => stock.value === selectedValue);
    if (selectedStock) {
       console.log("StockSelector: Selected:", selectedStock);
       onStockSelect(selectedStock.symbol, selectedStock.exchange); // Callback to parent with symbol & exchange
    } else {
        console.warn("StockSelector: Could not find selected stock details for value:", selectedValue);
    }
    setSearchValue(""); // Clear search input
    setOpen(false); // Close popover
  };

  // --- FIX FOR RENDER ERROR ---
  // Calculate the label for the trigger button safely
  const currentSelectionDetails = Array.isArray(stockList) // Check if stockList is an array
         ? stockList.find(stock => stock.symbol === currentSymbol && stock.exchange === currentExchange)
         : null; // If not an array yet, default to null
  const buttonLabel = currentSelectionDetails?.label || `${currentSymbol} (${currentExchange})`; // Use found label or fallback to props
  // --- END FIX ---


  // console.log("DEBUG StockSelector: Rendering CommandList with filteredList length:", filteredList.length);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between h-9 text-xs md:text-sm" // Adjust styling as needed
        >
          {/* Display the calculated button label (truncate if too long) */}
          {buttonLabel.length > 28 ? buttonLabel.substring(0,28)+"..." : buttonLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0"> {/* Adjust width */}
        <Command shouldFilter={false} className="rounded-lg border shadow-md"> {/* We handle filtering manually */}
          <CommandInput
             placeholder="Search stock..."
             value={searchValue}
             onValueChange={setSearchValue} // Update search state
          />
          <CommandList>
            {/* Use ScrollArea for long lists */}
            <ScrollArea className="h-[300px]">
              <CommandEmpty>No stock found.</CommandEmpty>
              <CommandGroup>
                {filteredList.map((stock) => (
                  <CommandItem
                    key={stock.value} // Use unique value (symbol|exchange) as key
                    value={stock.value} // Use unique value for selection tracking
                    onSelect={() => handleSelect(stock.value)} // Pass value to handler on select
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        (stock.symbol === currentSymbol && stock.exchange === currentExchange) ? "opacity-100" : "opacity-0" // Show checkmark for current selection
                      )}
                    />
                    {stock.label} {/* Display the formatted label */}
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default StockSelector;