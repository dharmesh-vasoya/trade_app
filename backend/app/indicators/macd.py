import pandas as pd
import pandas_ta as ta
from typing import Optional
from . import register_indicator

print("MACD indicator module loaded.")

class MACDIndicator:
    """Moving Average Convergence Divergence"""
    indicator_name = "MACD"

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        if fast <= 0 or slow <= 0 or signal <= 0:
            raise ValueError("MACD parameters must be positive.")
        self.fast = fast
        self.slow = slow
        self.signal = signal
        self.column_name = f"{self.indicator_name}_{self.fast}_{self.slow}_{self.signal}"

    def calculate(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if df is None or 'close' not in df.columns: return None
        try:
            macd = df.ta.macd(fast=self.fast, slow=self.slow, signal=self.signal)
            if macd is not None:
                macd.columns = [f"{self.column_name}_MACD", f"{self.column_name}_SIGNAL", f"{self.column_name}_HISTO"]
                return macd
        except Exception as e:
            print(f"Error calculating {self.column_name}: {e}")
        return None

    def get_column_name(self) -> str:
        return self.column_name

register_indicator(
    id="MACD",
    cls=MACDIndicator,
    name="MACD (Moving Average Convergence Divergence)",
    example_format="MACD_12_26_9",
    default_params="MACD_12_26_9"
)
