#!/usr/bin/env python3
"""Debug script to examine nfl_data_py data structure."""

import pandas as pd

def debug_nfl_data():
    """Debug the nfl_data_py data structure."""
    try:
        from nfl_data_py import import_ids, import_weekly_data
        
        print("=== NFL Data Py Debug ===")
        
        # Check player IDs
        print("\n1. Player IDs Structure:")
        ids = import_ids()
        print(f"Shape: {ids.shape}")
        print(f"Columns: {list(ids.columns)}")
        print(f"First few rows:")
        print(ids.head())
        
        print(f"\nData types:")
        print(ids.dtypes)
        
        print(f"\nNull values per column:")
        print(ids.isnull().sum())
        
        # Check for valid data
        print(f"\nRows with valid gsis_id: {ids['gsis_id'].notna().sum()}")
        print(f"Rows with valid nfl_id: {ids['nfl_id'].notna().sum()}")
        print(f"Rows with valid names: {ids['name'].notna().sum()}")
        print(f"Rows with valid positions: {ids['position'].notna().sum()}")
        
        # Check weekly data
        print("\n2. Weekly Data Structure:")
        weekly = import_weekly_data([2023])
        print(f"Shape: {weekly.shape}")
        print(f"Columns: {list(weekly.columns)}")
        print(f"First few rows:")
        print(weekly.head())
        
        print(f"\nWeekly data types:")
        print(weekly.dtypes)
        
        print(f"\nWeekly null values per column:")
        print(weekly.isnull().sum())
        
        # Check for player_id column
        if 'player_id' in weekly.columns:
            print(f"\nUnique player_ids in weekly data: {weekly['player_id'].nunique()}")
            print(f"Sample player_ids: {weekly['player_id'].dropna().head().tolist()}")
        
    except ImportError as e:
        print(f"Import error: {e}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_nfl_data()
