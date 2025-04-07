import pandas as pd
import pandas_ta as ta
from typing import Optional
from . import register_indicator

print("RSI indicator module loaded.")

class RSIIndicator:
    """Relative Strength Index"""
    indicator_name = "RSI"

    def __init__(self, length: int = 14):
        if length <= 0:
            raise ValueError("RSI length must be positive.")
        self.length = length
        self.column_name = f"{self.indicator_name}_{self.length}"

    def calculate(self, df: pd.DataFrame) -> Optional[pd.Series]:
        if df is None or 'close' not in df.columns: return None
        try:
            rsi_series = df.ta.rsi(length=self.length)
            if rsi_series is not None:
                rsi_series.name = self.column_name
                return rsi_series
        except Exception as e:
            print(f"Error calculating {self.column_name}: {e}")
        return None

    def get_column_name(self) -> str:
        return self.column_name

register_indicator(
    id="RSI",
    cls=RSIIndicator,
    name="Relative Strength Index",
    example_format="RSI_14",
    default_params="RSI_14"
)
