# backend/app/indicators/__init__.py
from typing import Optional, Any, List, Dict

print("Indicators package loading...")

# Central Registry to store info about available indicators
# Structure: { 'ID': {'class': IndicatorClass, 'name': 'Display Name', 'format': '...', 'default': '...' } }
INDICATOR_REGISTRY: Dict[str, Dict] = {}

def register_indicator(id: str, cls: type, name: str, example_format: str, default_params: str):
    """Adds an indicator class and its metadata to the registry."""
    if id in INDICATOR_REGISTRY:
        print(f"Warning: Indicator ID '{id}' being overwritten in registry.")
    INDICATOR_REGISTRY[id] = {
        'class': cls,
        'name': name,
        'example_format': example_format,
        'default_params': default_params
    }
    print(f"Indicator '{name}' ({id}) registered.")

def get_indicator(indicator_name_with_params: str) -> Optional[Any]:
    """
    Parses indicator string, looks up in registry, and returns an
    instantiated indicator object. Returns None if invalid.
    """
    parts = indicator_name_with_params.upper().split('_')
    indicator_id = parts[0]

    print(f"Factory: Looking up indicator for ID '{indicator_id}' from request '{indicator_name_with_params}'")

    if indicator_id not in INDICATOR_REGISTRY:
        print(f"Factory: Unknown indicator ID: '{indicator_id}'")
        return None

    reg_info = INDICATOR_REGISTRY[indicator_id]
    indicator_class = reg_info['class']

    try:
        # Basic parameter handling based on common patterns (can be improved)
        if indicator_id == "SMA" and len(parts) == 2:
            length = int(parts[1])
            print(f"Factory: Creating {indicator_class.__name__}(length={length})")
            return indicator_class(length=length)
        # === Add elif blocks here for other indicators as needed ===
        # elif indicator_id == "EMA" and len(parts) == 2:
        #     length = int(parts[1])
        #     print(f"Factory: Creating {indicator_class.__name__}(length={length})")
        #     return indicator_class(length=length)
        # elif indicator_id == "RSI" and len(parts) == 2:
        #     # ... parse params ... create instance ...
        #     pass
        # elif indicator_id == "MACD" and len(parts) == 4:
        #     # ... parse params ... create instance ...
        #     pass
        else:
             # Attempt default instantiation if format unexpected or no params needed
             # This might fail if __init__ requires arguments not provided
             print(f"Factory: Attempting default instantiation for {indicator_class.__name__} (request: {indicator_name_with_params})")
             return indicator_class() # Assumes default __init__ works if format is wrong/simple

    except (ValueError, IndexError, TypeError) as e:
        print(f"Factory: Error parsing parameters or instantiating '{indicator_name_with_params}': {e}")
        return None

def get_available_indicator_info() -> List[Dict]:
    """Returns a list of metadata for all registered indicators."""
    available_list = []
    for indicator_id, reg_info in INDICATOR_REGISTRY.items():
        available_list.append({
            "id": indicator_id,
            "name": reg_info['name'],
            "example_format": reg_info['example_format'],
            "default_params": reg_info['default_params']
        })
    print(f"Factory: Returning info for {len(available_list)} available indicators.")
    return available_list

# --- IMPORTANT: Import indicator modules AFTER registry/functions are defined ---
# This ensures the classes exist and the register_indicator function is ready
# when the modules are loaded and try to register themselves.
print("Importing indicator modules to trigger registration...")
from . import sma
from . import rsi 
from . import macd
from . import ema
# from . import ema # Uncomment when ema.py is created
# from . import rsi # Uncomment when rsi.py is created
# from . import macd # Uncomment when macd.py is created
print("Indicator modules imported.")