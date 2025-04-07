import pandas as pd
import pandas_ta as ta
from typing import Optional
from . import register_indicator

print("MACD indicator module loaded.")

class MACDIndicator:
    indicator_name = "MACD"

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        self.fast = fast
        self.slow = slow
        self.signal = signal
        self.prefix = f"{self.indicator_name}_{self.fast}_{self.slow}_{self.signal}"

    def calculate(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if df is None or 'close' not in df.columns:
            return None
        try:
            macd_df = df.ta.macd(fast=self.fast, slow=self.slow, signal=self.signal)
            if macd_df is not None:
                # Rename columns to unique names based on input config
                macd_df = macd_df.rename(columns={
                    macd_df.columns[0]: f"{self.prefix}_line",
                    macd_df.columns[1]: f"{self.prefix}_signal",
                    macd_df.columns[2]: f"{self.prefix}_hist"
                })
                return macd_df
        except Exception as e:
            print(f"Error calculating MACD: {e}")
        return None

    def get_column_name(self) -> str:
        return self.prefix  # Used only for display/ID, not for direct column insertion

register_indicator(
    id="MACD",
    cls=MACDIndicator,
    name="MACD (Moving Average Convergence Divergence)",
    example_format="MACD_12_26_9",
    default_params="MACD_12_26_9"
)
