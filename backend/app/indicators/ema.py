import pandas as pd
import pandas_ta as ta
from typing import Optional
from . import register_indicator

print("EMA indicator module loaded.")

class EMAIndicator:
    """Exponential Moving Average"""
    indicator_name = "EMA"

    def __init__(self, length: int = 20):
        if length <= 0:
            raise ValueError("EMA length must be positive.")
        self.length = length
        self.column_name = f"{self.indicator_name}_{self.length}"

    def calculate(self, df: pd.DataFrame) -> Optional[pd.Series]:
        if df is None or 'close' not in df.columns: return None
        try:
            ema_series = df.ta.ema(length=self.length)
            if ema_series is not None:
                ema_series.name = self.column_name
                return ema_series
        except Exception as e:
            print(f"Error calculating {self.column_name}: {e}")
        return None

    def get_column_name(self) -> str:
        return self.column_name

register_indicator(
    id="EMA",
    cls=EMAIndicator,
    name="Exponential Moving Average",
    example_format="EMA_20",
    default_params="EMA_20"
)
