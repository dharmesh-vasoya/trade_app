# backend/app/stocks/models.py
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class Stock:
    """Represents a stock tracked by the system."""
    symbol: str # Ticker symbol (e.g., RELIANCE)
    exchange: str = "NSE" # Default exchange
    instrument_key: Optional[str] = None # Broker specific key (e.g., Upstox)
    name: Optional[str] = None # Full name (e.g., Reliance Industries Limited)
    isin: Optional[str] = None # ISIN number

    # You might add other relevant fields later, like sector, industry, etc.

    def __post_init__(self):
        # Convert symbol and exchange to uppercase for consistency
        self.symbol = self.symbol.upper()
        self.exchange = self.exchange.upper()

# We will likely add ORM models here later if using SQLAlchemy,
# or functions to interact with DB tables if using direct SQL/DuckDB.
# For now, this dataclass defines the structure.

print("Stock model loaded") # Temporary check