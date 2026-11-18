# ==============================================================================
# STEP 2: DATA COLLECTION SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Data Sources: NASA POWER API & Soil Health Card
# ==============================================================================

import os
import pandas as pd

# Create raw data folder if it doesn't exist
os.makedirs("data/raw", exist_ok=True)

print("=" * 70)
print("STEP 2: DATA COLLECTION (READING DISTRICTS & RAW DATA FROM CSV)")
print("=" * 70)

# Step 2.1: Read the district information table directly from CSV
# No hardcoded list is needed! We simply read the CSV file.
districts_file = "data/raw/india_districts.csv"
print(f"Reading district information from: {districts_file}")
districts_df = pd.read_csv(districts_file)

print(f"Total States Covered: {districts_df['state'].nunique()}")
print(f"Total Districts Covered: {len(districts_df)}")

# Step 2.2: Load the raw monthly agro-meteorological observations
raw_data_file = "data/raw/all_india_140_districts_raw.csv"
print(f"Reading collected climatology data from: {raw_data_file}")
df_raw = pd.read_csv(raw_data_file)

# Display dataset details
print("\nFirst 5 rows of collected raw data:")
print(df_raw[["state", "district", "month", "temperature", "rainfall", "humidity"]].head())

print("\n" + "=" * 70)
print("STEP 2 SUMMARY:")
print(f"Total Records: {len(df_raw)}")
print(f"States in Data: {df_raw['state'].nunique()}")
print(f"Districts in Data: {df_raw['district'].nunique()}")
print(f"Columns: {list(df_raw.columns)}")
print("=" * 70)
