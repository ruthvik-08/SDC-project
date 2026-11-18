# ==============================================================================
# STEP 3: DATA PREPROCESSING SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Tasks: Cleaning missing values, duplicates, and applying agricultural formulas.
# ==============================================================================

import os
import numpy as np
import pandas as pd

# Create processed folder
os.makedirs("data/processed", exist_ok=True)

print("=" * 70)
print("STEP 3: DATA PREPROCESSING (CLEANING & PHYSICAL FORMULAS)")
print("=" * 70)

# Step 3.1: Load raw data from CSV
raw_file = "data/raw/all_india_140_districts_raw.csv"
print(f"Loading raw data from: {raw_file}")
df = pd.read_csv(raw_file)

# Step 3.2: Remove duplicate rows
before_dup = len(df)
df = df.drop_duplicates()
print(f"Duplicates removed: {before_dup - len(df)}")

# Step 3.3: Handle missing values by replacing with column median
num_cols = ["temperature", "temp_max", "temp_min", "rainfall", "humidity",
            "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
            "soil_ph", "soil_organic_carbon"]
for col in num_cols:
    df[col] = df[col].fillna(df[col].median())

print(f"Missing values remaining: {df.isnull().sum().sum()}")

# Step 3.4: Standardize text columns
text_cols = ["state", "district", "crop_type", "soil_type"]
for col in text_cols:
    df[col] = df[col].astype(str).str.strip().str.title()

# Step 3.5: Map Indian Agricultural Seasons and Growth Stages
# Monsoon: Jun-Sep (Kharif), Winter: Oct-Mar (Rabi), Summer: Apr-May (Zaid)
season_map = {
    "JAN": "Rabi", "FEB": "Rabi", "MAR": "Rabi", "OCT": "Rabi", "NOV": "Rabi", "DEC": "Rabi",
    "JUN": "Kharif", "JUL": "Kharif", "AUG": "Kharif", "SEP": "Kharif",
    "APR": "Zaid", "MAY": "Zaid"
}
stage_map = {
    "JAN": "Vegetative", "FEB": "Reproductive", "MAR": "Maturity", "OCT": "Initial", "NOV": "Initial", "DEC": "Vegetative",
    "JUN": "Initial", "JUL": "Vegetative", "AUG": "Reproductive", "SEP": "Maturity",
    "APR": "Vegetative", "MAY": "Reproductive"
}

df["season"] = df["month"].str.upper().map(season_map).fillna("Kharif")
df["growth_stage"] = df["month"].str.upper().map(stage_map).fillna("Vegetative")

# Step 3.6: Assign FAO-56 Crop Coefficients (Kc)
crop_kc_map = {
    "Rice": 1.15, "Wheat": 0.95, "Cotton": 1.05, "Sugarcane": 1.20,
    "Maize": 1.00, "Pulses": 0.85, "Groundnut": 0.90, "Mustard": 0.85
}
df["crop_coefficient_kc"] = df["crop_type"].map(crop_kc_map).fillna(1.0)

# Step 3.7: Calculate Reference Evapotranspiration (ET0) using Hargreaves formula
temp_diff = np.sqrt(np.maximum(df["temp_max"] - df["temp_min"], 1.0))
df["et0"] = np.round(0.0023 * (df["temperature"] + 17.8) * temp_diff * (0.408 * df["solar_radiation"]), 2)

# Step 3.8: Crop Water Demand (ETc) = Kc * ET0
df["etc"] = np.round(df["crop_coefficient_kc"] * df["et0"], 2)

# Step 3.9: Effective Soil Moisture (Weighted combination of surface and root zone)
df["effective_soil_wetness"] = np.round(0.4 * df["surface_soil_moisture"] + 0.6 * df["root_zone_soil_moisture"], 3)

# Step 3.10: Soil Water Stress Coefficient (Ks) and Actual Evapotranspiration (ETa)
df["stress_coefficient_ks"] = np.round(np.clip(df["effective_soil_wetness"] / 0.55, 0.0, 1.0), 3)
df["eta"] = np.round(df["stress_coefficient_ks"] * df["etc"], 2)

# Step 3.11: Crop Water Stress Index (CWSI) = 1 - (ETa / ETc)
df["cwsi"] = np.round(np.clip(1.0 - (df["eta"] / np.maximum(df["etc"], 0.1)), 0.0, 1.0), 3)

# Step 3.12: Daily Crop Water Deficit (mm/day)
df["water_deficit"] = np.round(np.maximum(df["etc"] - df["eta"] - df["rainfall"], 0.0), 2)

# Step 3.13: NDVI (Normalized Difference Vegetation Index)
df["ndvi"] = np.round(np.clip(0.65 + (df["effective_soil_wetness"] * 0.15) - (df["cwsi"] * 0.25), 0.15, 0.88), 3)

# Step 3.14: Irrigation Priority Index (IPI) on a scale of 0 to 100
ipi_raw = 45.0 * df["cwsi"] + 35.0 * (1.0 - df["effective_soil_wetness"]) + 20.0 * (df["water_deficit"] / 10.0)
df["irrigation_priority_index"] = np.round(np.clip(ipi_raw, 0.0, 100.0), 1)

# Step 3.15: Create categorical and numerical labels
# Crop Stress Level: 0=Low, 1=Moderate, 2=High, 3=Severe
df["stress_level"] = "Low"
df.loc[df["cwsi"] >= 0.25, "stress_level"] = "Moderate"
df.loc[df["cwsi"] >= 0.45, "stress_level"] = "High"
df.loc[df["cwsi"] >= 0.65, "stress_level"] = "Severe"

stress_code_map = {"Low": 0, "Moderate": 1, "High": 2, "Severe": 3}
df["stress_level_code"] = df["stress_level"].map(stress_code_map)

# Irrigation Priority Level: Low, Medium, High, Critical
df["irrigation_priority"] = "Low"
df.loc[df["irrigation_priority_index"] >= 35.0, "irrigation_priority"] = "Medium"
df.loc[df["irrigation_priority_index"] >= 50.0, "irrigation_priority"] = "High"
df.loc[df["irrigation_priority_index"] >= 70.0, "irrigation_priority"] = "Critical"

priority_code_map = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
df["irrigation_priority_code"] = df["irrigation_priority"].map(priority_code_map)

# Save processed CSV file
output_file = "data/processed/all_india_140_districts_processed.csv"
df.to_csv(output_file, index=False)

print("\n" + "=" * 70)
print("STEP 3 COMPLETE: PREPROCESSED DATASET SAVED")
print(f"Saved to: {output_file}")
print(f"Total Rows: {len(df)}")
print(f"Stress Level Counts:\n{df['stress_level'].value_counts().to_string()}")
print(f"Irrigation Priority Counts:\n{df['irrigation_priority'].value_counts().to_string()}")
print("=" * 70)
