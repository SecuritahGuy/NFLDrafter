#!/usr/bin/env python3
"""Test script to examine nfl_data_py data structure"""

try:
    from nfl_data_py import import_ids
    import pandas as pd
    
    print("Importing player IDs...")
    ids = import_ids()
    
    print(f"Data shape: {ids.shape}")
    print(f"Columns: {list(ids.columns)}")
    
    # Show first few rows
    print("\nFirst 5 rows:")
    print(ids.head())
    
    # Check for non-null values in key columns
    print(f"\nNon-null counts:")
    print(f"gsis_id: {ids['gsis_id'].notna().sum()}")
    print(f"nfl_id: {ids['nfl_id'].notna().sum()}")
    print(f"name: {ids['name'].notna().sum()}")
    print(f"position: {ids['position'].notna().sum()}")
    print(f"team: {ids['team'].notna().sum()}")
    
    # Show sample of valid players
    valid_players = ids.dropna(subset=['gsis_id', 'name', 'position'])
    print(f"\nValid players (with gsis_id, name, position): {len(valid_players)}")
    
    if len(valid_players) > 0:
        print("\nSample valid player:")
        sample = valid_players.iloc[0]
        print(f"  gsis_id: {sample['gsis_id']}")
        print(f"  name: {sample['name']}")
        print(f"  position: {sample['position']}")
        print(f"  team: {sample['team']}")
    
except ImportError as e:
    print(f"Import error: {e}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
