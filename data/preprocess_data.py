"""
Stage 3: Data Preprocessing Script
Author: First-Year B.Tech Student Project
Purpose: Load raw agricultural dataset, clean data, handle missing values,
         remove duplicates, correct data types, standardise dates and geography,
         calculate authentic physical indicators (FAO-56 Evapotranspiration, CWSI, and NDVI),
         and save clean processed CSV for model training and analysis.
"""

import os
import numpy as np
import pandas as pd

# Define file paths
RAW_DATA_PATH = "data/raw/all_india_agricultural_raw.csv"
PROCESSED_DATA_DIR = "data/processed"
PROCESSED_DATA_PATH = os.path.join(PROCESSED_DATA_DIR, "all_india_agricultural_processed.csv")

os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)

print("=" * 70)
print("STAGE 3: DATA PREPROCESSING")
print("=" * 70)

# 1. Load dataset using Pandas
print(f"Loading raw dataset from {RAW_DATA_PATH}...")
df = pd.read_csv(RAW_DATA_PATH)
print(f"Initial raw data shape: {df.shape[0]} rows, {df.shape[1]} columns")

# 2. Check and remove duplicate records
initial_count = len(df)
df = df.drop_duplicates()
print(f"Duplicates removed: {initial_count - len(df)}")

# 3. Handle missing values
# Impute any missing numerical values with the district-specific median
numeric_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
    "soil_ph", "soil_organic_carbon", "field_capacity", "wilting_point"
]
for col in numeric_cols:
    if col in df.columns:
        df[col] = df.groupby("district")[col].transform(lambda s: s.fillna(s.median()))
        df[col] = df[col].fillna(df[col].median())

print(f"Missing values after cleaning: {df.isnull().sum().sum()}")

# 4. Correct data types and standardise dates
df["date"] = pd.to_datetime(df["date"])
df["year"] = df["date"].dt.year
df["month"] = df["date"].dt.month
df["day"] = df["date"].dt.day
df["day_of_year"] = df["date"].dt.dayofyear

# Clean string columns
string_cols = ["district", "state", "zone", "soil_type", "crop_type"]
for col in string_cols:
    df[col] = df[col].astype(str).str.strip().str.title()

# 5. Determine Crop Growth Stage (June to November Kharif season)
# Day 1 = June 1, Day 183 = November 30
season_day = df["day_of_year"] - df["day_of_year"].min() + 1

def assign_growth_stage(day_num):
    if day_num <= 30:
        return "Initial"        # Germination & Seedling
    elif day_num <= 75:
        return "Vegetative"     # Active Tillering & Stem Elongation
    elif day_num <= 135:
        return "Reproductive"   # Flowering, Grain/Boll Formation (Critical Stage)
    else:
        return "Maturity"       # Ripening & Harvesting

df["growth_stage"] = season_day.apply(assign_growth_stage)

# 6. Assign FAO-56 Crop Coefficient (Kc)
KC_MAPPING = {
    "Rice":       {"Initial": 1.05, "Vegetative": 1.15, "Reproductive": 1.25, "Maturity": 0.95},
    "Wheat":      {"Initial": 0.60, "Vegetative": 0.95, "Reproductive": 1.15, "Maturity": 0.50},
    "Cotton":     {"Initial": 0.70, "Vegetative": 1.00, "Reproductive": 1.20, "Maturity": 0.75},
    "Sugarcane":  {"Initial": 0.85, "Vegetative": 1.15, "Reproductive": 1.25, "Maturity": 0.80},
    "Maize":      {"Initial": 0.70, "Vegetative": 1.05, "Reproductive": 1.20, "Maturity": 0.60},
    "Groundnut":  {"Initial": 0.50, "Vegetative": 0.85, "Reproductive": 1.10, "Maturity": 0.60},
    "Pulses":     {"Initial": 0.50, "Vegetative": 0.85, "Reproductive": 1.05, "Maturity": 0.55},
    "Mustard":    {"Initial": 0.50, "Vegetative": 0.85, "Reproductive": 1.05, "Maturity": 0.45}
}

def lookup_kc(row):
    crop = row["crop_type"]
    stage = row["growth_stage"]
    if crop in KC_MAPPING and stage in KC_MAPPING[crop]:
        return KC_MAPPING[crop][stage]
    return 1.0

df["crop_coefficient_kc"] = df.apply(lookup_kc, axis=1)

# 7. Calculate Reference Evapotranspiration (ET0) using FAO Hargreaves Method
# Ra equivalent depth for tropical India is approximately 14.5 mm/day
temp_diff = np.maximum(df["temp_max"] - df["temp_min"], 1.0)
df["et0"] = (0.0023 * (df["temperature"] + 17.8) * np.sqrt(temp_diff) * 14.5).clip(2.5, 8.5).round(2)

# Potential Crop Evapotranspiration: ETc = Kc * ET0 (mm/day)
df["etc"] = (df["crop_coefficient_kc"] * df["et0"]).round(2)

# 8. Calculate Effective Soil Wetness combining Topsoil and Rootzone
# Topsoil dries faster; root zone provides moisture buffer
df["effective_soil_wetness"] = (0.50 * df["surface_soil_moisture"] + 0.50 * df["root_zone_soil_moisture"]).round(3)

# 9. Actual Evapotranspiration (ETa) and Crop Water Stress Index (CWSI)
# Under FAO-56, when soil moisture falls below 0.60, transpiration is reduced
df["stress_coefficient_ks"] = np.where(
    df["effective_soil_wetness"] >= 0.60,
    1.0,
    df["effective_soil_wetness"] / 0.60
).clip(0.10, 1.0).round(3)

df["eta"] = (df["stress_coefficient_ks"] * df["etc"]).round(2)

# CWSI = 1 - (ETa / ETc)
df["cwsi"] = (1.0 - (df["eta"] / df["etc"])).clip(0.0, 1.0).round(3)

# 10. Water Deficit (mm/day)
# Water Deficit = ETc - (ETa + Effective Rainfall)
effective_rainfall = np.minimum(df["rainfall"] * 0.8, df["etc"])
df["water_deficit"] = np.maximum(0.0, df["etc"] - (df["eta"] + effective_rainfall)).round(2)

# 11. Model authentic NDVI (Normalized Difference Vegetation Index)
# Base NDVI depends on crop growth stage, adjusted by soil moisture and water stress
stage_base_ndvi = {
    "Initial": 0.28,
    "Vegetative": 0.62,
    "Reproductive": 0.78,
    "Maturity": 0.48
}
base_ndvi = df["growth_stage"].map(stage_base_ndvi)
ndvi_adjustment = (df["effective_soil_wetness"] * 0.15) - (df["cwsi"] * 0.20)
df["ndvi"] = (base_ndvi + ndvi_adjustment).clip(0.15, 0.88).round(3)

# 12. Categorize Crop Stress Level
# Low: Healthy crop canopy (< 0.10)
# Moderate: Mild moisture restriction (0.10 - 0.25)
# High: Significant water stress (0.25 - 0.40)
# Severe: Critical depletion (> 0.40)
def assign_stress_level(cwsi_val):
    if cwsi_val < 0.10:
        return "Low"
    elif cwsi_val < 0.25:
        return "Moderate"
    elif cwsi_val < 0.40:
        return "High"
    else:
        return "Severe"

df["stress_level"] = df["cwsi"].apply(assign_stress_level)

# Stress code for models
stress_code_map = {"Low": 0, "Moderate": 1, "High": 2, "Severe": 3}
df["stress_level_code"] = df["stress_level"].map(stress_code_map)

# 13. Calculate Objective Irrigation Priority Index (IPI: 0 to 100)
# Factors:
# 1) CWSI (35%)
# 2) Soil Deficit below optimal 0.65 threshold (25%)
# 3) Rainfall Deficit (< 2.5 mm/day) (15%)
# 4) Heat Stress (> 32°C) (15%)
# 5) Stage Vulnerability (Flowering is most critical) (10%)
soil_deficit = np.maximum(0.0, (0.65 - df["effective_soil_wetness"]) / 0.65)
rain_deficit = np.where(df["rainfall"] < 2.5, 1.0 - (df["rainfall"] / 2.5), 0.0)
heat_stress = np.where(df["temp_max"] > 32.0, (df["temp_max"] - 32.0) / 10.0, 0.0).clip(0.0, 1.0)
stage_weights = df["growth_stage"].map({
    "Initial": 0.50,
    "Vegetative": 0.75,
    "Reproductive": 1.00,  # Peak sensitivity
    "Maturity": 0.40
})

raw_ipi = (
    0.35 * df["cwsi"] +
    0.25 * soil_deficit +
    0.15 * rain_deficit +
    0.15 * heat_stress +
    0.10 * stage_weights
) * 100.0

df["irrigation_priority_index"] = raw_ipi.clip(0.0, 100.0).round(1)

def assign_priority_category(score):
    if score < 30.0:
        return "Low"
    elif score < 50.0:
        return "Medium"
    elif score < 70.0:
        return "High"
    else:
        return "Critical"

df["irrigation_priority"] = df["irrigation_priority_index"].apply(assign_priority_category)

priority_code_map = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
df["irrigation_priority_code"] = df["irrigation_priority"].map(priority_code_map)

# 14. Save processed CSV file
df.to_csv(PROCESSED_DATA_PATH, index=False)

print("\n" + "=" * 70)
print("STAGE 3 SUMMARY: PREPROCESSING COMPLETE")
print(f"Processed dataset saved to: {PROCESSED_DATA_PATH}")
print(f"Dataset shape: {df.shape[0]} rows, {df.shape[1]} columns")
print("\nCrop Stress Level counts:")
print(df["stress_level"].value_counts())
print("\nIrrigation Priority counts:")
print(df["irrigation_priority"].value_counts())
print("\nKey summary statistics across India:")
print(f" - Mean Temperature: {df['temperature'].mean():.2f} °C")
print(f" - Mean Rainfall: {df['rainfall'].mean():.2f} mm/day")
print(f" - Mean Humidity: {df['humidity'].mean():.2f} %")
print(f" - Mean Soil Moisture (Effective): {df['effective_soil_wetness'].mean():.3f}")
print(f" - Mean Reference ET0: {df['et0'].mean():.2f} mm/day")
print(f" - Mean Crop ETc: {df['etc'].mean():.2f} mm/day")
print(f" - Mean CWSI: {df['cwsi'].mean():.3f}")
print(f" - Mean NDVI: {df['ndvi'].mean():.3f}")
print(f" - Mean Irrigation Priority Index: {df['irrigation_priority_index'].mean():.1f} / 100")
print("=" * 70)
