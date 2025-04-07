// frontend/src/components/StockSelector.jsx
// Uses Shadcn Combobox for searching/selecting stocks

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react"; // Icons

// Import Shadcn UI Components
import { cn } from "@/lib/utils";
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
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Fetch the list of stocks for the current exchange
  // Replace the existing useEffect hook that fetches the stock list
// inside frontend/src/components/StockSelector.jsx

  useEffect(() => {
  // Use the exchange passed via props to fetch the relevant list
  const listUrl = `http://127.0.0.1:5000/api/stocks/list?exchange=${currentExchange}`;
  console.log("StockSelector: Fetching stock list from:", listUrl);
  setIsLoadingList(true);
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
           // --- Ensure these lines are clean template literals ---
           value: `${stock.symbol}|${stock.exchange}`,
           label: `${stock.symbol} (${stock.name || 'N/A'})`,
           // --- End clean lines ---
           symbol: stock.symbol, // Store original symbol
           exchange: stock.exchange // Store original exchange
       }));
       setStockList(formattedList);
       setFilteredList(formattedList); // Initially show all
       console.log(`StockSelector: Loaded ${formattedList.length} stocks for ${currentExchange}.`);
    })
    .catch(error => {
        console.error("StockSelector: Error fetching stock list:", error);
        setStockList([]); // Set empty on error
        setFilteredList([]);
    })
    .finally(() => {
        setIsLoadingList(false);
    });
}, [currentExchange]); // Re-fetch only if the exchange prop changes


  // Filter list based on search input
  useEffect(() => {
    if (!searchValue) {
      setFilteredList(stockList); return; // Show all if search empty
    }
    const lowerSearch = searchValue.toLowerCase();
    const newlyFiltered = Array.isArray(stockList)
        ? stockList.filter((stock) =>
            stock.label && typeof stock.label === 'string' && stock.label.toLowerCase().includes(lowerSearch)
          )
        : [];
    setFilteredList(newlyFiltered);
  }, [searchValue, stockList]);


  // Handler when user selects an item
  const handleSelect = (selectedValue) => { // e.g., "TCS|NSE"
    const selectedStock = stockList.find((stock) => stock.value === selectedValue);
    if (selectedStock) {
       console.log("StockSelector: Selected:", selectedStock);
       // Check if selection actually changed before calling back
       if (selectedStock.symbol !== currentSymbol || selectedStock.exchange !== currentExchange) {
            onStockSelect(selectedStock.symbol, selectedStock.exchange);
       }
    }
    setSearchValue(""); // Clear search input
    setOpen(false); // Close popover
  };

  // Calculate the label for the trigger button safely
  const currentSelectionDetails = Array.isArray(stockList)
         ? stockList.find(stock => stock.symbol === currentSymbol && stock.exchange === currentExchange)
         : null;
  const buttonLabel = currentSelectionDetails?.label || `<span class="math-inline">\{currentSymbol\} \(</span>{currentExchange})`;


  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between h-9 text-xs md:text-sm" // Adjust styling
        >
          {buttonLabel.length > 28 ? buttonLabel.substring(0,28)+"..." : buttonLabel}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false} className="rounded-lg border shadow-md">
          <CommandInput
             placeholder="Search stock..."
             value={searchValue}
             onValueChange={setSearchValue} // Update search state
          />
          <CommandList>
            {/* Use ScrollArea for potentially long lists */}
            <ScrollArea className="h-[300px]">
              {isLoadingList && <div className="p-4 text-center text-sm">Loading list...</div>}
              {!isLoadingList && filteredList.length === 0 && <CommandEmpty>No stock found.</CommandEmpty>}
              {!isLoadingList && filteredList.length > 0 && (
                 <CommandGroup>
                    {filteredList.map((stock) => (
                      <CommandItem
                        key={stock.value}
                        value={stock.value} // Use unique value
                        onSelect={() => handleSelect(stock.value)} // Pass value on select
                      >
                        <Check className={cn("mr-2 h-4 w-4", (stock.symbol === currentSymbol && stock.exchange === currentExchange) ? "opacity-100" : "opacity-0")}/>
                        {stock.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default StockSelector;