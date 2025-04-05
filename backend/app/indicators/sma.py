# backend/app/indicators/sma.py
import pandas as pd
import pandas_ta as ta
from typing import Optional

# --- IMPORTANT: Import the registry function ---
from . import register_indicator

print("SMA indicator module loaded (Class-based)")

class SMAIndicator:
    # ... (Keep the class definition exactly as before) ...
    """Calculates the Simple Moving Average (SMA) indicator."""
    indicator_name = "SMA"

    def __init__(self, length: int = 20):
        if length <= 0:
            raise ValueError("SMA length must be positive.")
        self.length = length
        self.column_name = f"{self.indicator_name}_{self.length}"

    def calculate(self, df: pd.DataFrame) -> Optional[pd.Series]:
        # ... (calculation logic) ...
        if df is None or not isinstance(df, pd.DataFrame): return None
        if 'close' not in df.columns: return None
        if len(df) < self.length: print(f"Warning calculating {self.column_name}...")
        try:
            sma_series = df.ta.sma(length=self.length)
            if sma_series is None: return None
            if sma_series.name != self.column_name: sma_series.rename(self.column_name, inplace=True)
            print(f"{self.column_name} calculation successful.")
            return sma_series
        except Exception as e:
            print(f"Error calculating {self.column_name}: {e}")
            return None

    def get_column_name(self) -> str:
        return self.column_name

# --- Add Registration Call at the end ---
register_indicator(
    id="SMA",
    cls=SMAIndicator,
    name="Simple Moving Average",
    example_format="SMA_<length>",
    default_params="SMA_20"
)
# -----------------------------------------