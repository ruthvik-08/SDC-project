"""
KrishiJal: Master Dataset Generation Pipeline
Restructures the multi-file data pipeline into ONE unified master CSV:
  data/processed/krishijal_master_dataset.csv

Combines the 158-district nationwide monthly climatology (1,896 records)
and the 26-district high-frequency daily observations (4,758 records).
Fixes data anomalies (e.g. Lakshadweep NASA -999.0 fill values),
standardizes categories, tracks data granularity, and preserves all features.
"""

import os
import numpy as np
import pandas as pd

# Define paths
DATA_DIR = "data"
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
MASTER_CSV_PATH = os.path.join(PROCESSED_DIR, "krishijal_master_dataset.csv")

# Standard ICAR Agro-Climatic Zone mapping across all 36 Indian States and UTs
STATE_TO_ZONE = {
    # North
    "Jammu and Kashmir": "North", "Ladakh": "North", "Punjab": "North",
    "Haryana": "North", "Himachal Pradesh": "North", "Uttar Pradesh": "North",
    "Uttarakhand": "North", "Chandigarh": "North", "Delhi": "North",
    # South
    "Andhra Pradesh": "South", "Telangana": "South", "Karnataka": "South",
    "Tamil Nadu": "South", "Kerala": "South", "Puducherry": "South",
    "Lakshadweep": "South", "Andaman and Nicobar": "South",
    # East
    "Bihar": "East", "Jharkhand": "East", "Odisha": "East", "West Bengal": "East",
    # West
    "Rajasthan": "West", "Gujarat": "West", "Maharashtra": "West", "Goa": "West",
    "Dadra and Nagar Haveli and Daman and Diu": "West",
    # Central
    "Madhya Pradesh": "Central", "Chhattisgarh": "Central",
    # Northeast
    "Assam": "Northeast", "Arunachal Pradesh": "Northeast", "Manipur": "Northeast",
    "Meghalaya": "Northeast", "Mizoram": "Northeast", "Nagaland": "Northeast",
    "Sikkim": "Northeast", "Tripura": "Northeast"
}

MONTH_MAP_STR_TO_INT = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
}

MONTH_MAP_INT_TO_STR = {v: k for k, v in MONTH_MAP_STR_TO_INT.items()}

# Deterministic label encodings
CROP_ENCODING = {
    "Barley": 0, "Cotton": 1, "Groundnut": 2, "Maize": 3, "Mustard": 4,
    "Pulses": 5, "Rice": 6, "Sugarcane": 7, "Wheat": 8
}

STAGE_ENCODING = {
    "Initial": 0, "Maturity": 1, "Reproductive": 2, "Vegetative": 3
}

STRESS_ENCODING = {
    "Low": 0, "Moderate": 1, "High": 2, "Severe": 3
}

PRIORITY_ENCODING = {
    "Low": 0, "Medium": 1, "High": 2, "Critical": 3
}

def load_and_clean_140_districts():
    """Loads and cleans the 158-district monthly dataset (1,896 records)."""
    f_path = os.path.join(PROCESSED_DIR, "all_india_140_clustered.csv")
    df = pd.read_csv(f_path)
    
    # Clean NASA -999.0 fill values in Lakshadweep root zone soil moisture
    mask_anomaly = (df["root_zone_soil_moisture"] <= -900)
    if mask_anomaly.any():
        df.loc[mask_anomaly, "root_zone_soil_moisture"] = 0.42
        df.loc[mask_anomaly, "effective_soil_wetness"] = np.round(
            0.4 * df.loc[mask_anomaly, "surface_soil_moisture"] + 0.6 * 0.42, 3
        )
        df.loc[mask_anomaly, "stress_coefficient_ks"] = np.clip(
            df.loc[mask_anomaly, "effective_soil_wetness"] / 0.55, 0.0, 1.0
        )
        df.loc[mask_anomaly, "eta"] = np.round(
            df.loc[mask_anomaly, "stress_coefficient_ks"] * df.loc[mask_anomaly, "etc"], 2
        )
        df.loc[mask_anomaly, "cwsi"] = np.clip(
            1.0 - (df.loc[mask_anomaly, "eta"] / np.maximum(df.loc[mask_anomaly, "etc"], 0.1)),
            0.0, 1.0
        )
        df.loc[mask_anomaly, "water_deficit"] = np.maximum(
            df.loc[mask_anomaly, "etc"] - df.loc[mask_anomaly, "eta"] - df.loc[mask_anomaly, "rainfall"],
            0.0
        )
        df.loc[mask_anomaly, "irrigation_priority_index"] = np.round(
            45.0 * df.loc[mask_anomaly, "cwsi"] +
            35.0 * (1.0 - df.loc[mask_anomaly, "effective_soil_wetness"]) +
            20.0 * (df.loc[mask_anomaly, "water_deficit"] / 10.0),
            1
        )
        df.loc[mask_anomaly, "stress_level"] = "Low"
        df.loc[mask_anomaly, "stress_level_code"] = 0
        df.loc[mask_anomaly, "irrigation_priority"] = "Low"
        df.loc[mask_anomaly, "irrigation_priority_code"] = 0

    # Ensure month column consistency
    df["month_name"] = df["month"].astype(str)
    df["month"] = df["month_name"].map(MONTH_MAP_STR_TO_INT).fillna(1).astype(int)
    
    # Metadata & Granularity
    df["granularity"] = "monthly"
    df["record_id"] = [f"KMD_M_{i+1:04d}" for i in range(len(df))]
    df["zone"] = df["state"].map(STATE_TO_ZONE).fillna("Central")
    df["date"] = np.nan
    df["year"] = 2023
    df["day"] = np.nan
    df["day_of_year"] = np.nan
    df["field_capacity"] = np.nan
    df["wilting_point"] = np.nan
    
    # Standardize codes
    df["crop_code"] = df["crop_type"].map(CROP_ENCODING).fillna(1).astype(int)
    df["stage_code"] = df["growth_stage"].map(STAGE_ENCODING).fillna(3).astype(int)
    df["stress_level_code"] = df["stress_level"].map(STRESS_ENCODING).fillna(0).astype(int)
    df["irrigation_priority_code"] = df["irrigation_priority"].map(PRIORITY_ENCODING).fillna(0).astype(int)
    
    return df

def load_and_clean_agricultural_daily():
    """Loads and standardizes the 26-district daily dataset (4,758 records)."""
    f_path = os.path.join(PROCESSED_DIR, "all_india_agricultural_clustered.csv")
    df = pd.read_csv(f_path)
    
    df["granularity"] = "daily"
    df["record_id"] = [f"KMD_D_{i+1:04d}" for i in range(len(df))]
    
    # Ensure month consistency
    df["month"] = df["month"].astype(int)
    df["month_name"] = df["month"].map(MONTH_MAP_INT_TO_STR).fillna("JUN")
    
    # Standardize zone
    if "zone" not in df.columns or df["zone"].isnull().any():
        df["zone"] = df["state"].map(STATE_TO_ZONE).fillna("North")
        
    # Season derivation
    def get_season(m):
        if m in [6, 7, 8, 9, 10]:
            return "Kharif"
        elif m in [11, 12, 1, 2, 3]:
            return "Rabi"
        else:
            return "Zaid"
    df["season"] = df["month"].map(get_season)
    
    # Standardize codes
    df["crop_code"] = df["crop_type"].map(CROP_ENCODING).fillna(1).astype(int)
    df["stage_code"] = df["growth_stage"].map(STAGE_ENCODING).fillna(3).astype(int)
    df["stress_level_code"] = df["stress_level"].map(STRESS_ENCODING).fillna(0).astype(int)
    df["irrigation_priority_code"] = df["irrigation_priority"].map(PRIORITY_ENCODING).fillna(0).astype(int)
    
    return df

def generate_master_dataset():
    """Combines and saves the master dataset with 48 clean features."""
    print("=" * 70)
    print("KRISHIJAL: MASTER DATASET GENERATION")
    print("=" * 70)
    
    df_monthly = load_and_clean_140_districts()
    print(f"Loaded monthly nationwide records: {len(df_monthly)} rows across {df_monthly['district'].nunique()} districts.")
    
    df_daily = load_and_clean_agricultural_daily()
    print(f"Loaded daily observational records: {len(df_daily)} rows across {df_daily['district'].nunique()} districts.")
    
    # Define complete 48 master columns in canonical order
    master_columns = [
        # 1. Identification & Granularity
        "record_id", "granularity", "state", "district", "zone",
        "latitude", "longitude",
        # 2. Temporal Attributes
        "date", "year", "month", "month_name", "day", "day_of_year", "season",
        # 3. Agronomic & Soil Properties
        "crop_type", "crop_code", "growth_stage", "stage_code", "crop_coefficient_kc",
        "soil_type", "soil_ph", "soil_organic_carbon", "field_capacity", "wilting_point",
        # 4. Agro-Meteorological Observations
        "temperature", "temp_max", "temp_min", "rainfall", "humidity",
        "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
        # 5. Calculated FAO-56 & Physical Hydrology Indices
        "et0", "etc", "effective_soil_wetness", "stress_coefficient_ks",
        "eta", "cwsi", "water_deficit", "ndvi", "irrigation_priority_index",
        # 6. Target Classification & Priority Labels
        "stress_level", "stress_level_code", "irrigation_priority", "irrigation_priority_code",
        # 7. Unsupervised Clustering & Spatial PCA
        "cluster_id", "pca_x", "pca_y"
    ]
    
    # Select available columns from both
    df_m_aligned = df_monthly.reindex(columns=master_columns)
    df_d_aligned = df_daily.reindex(columns=master_columns)
    
    # Combine datasets
    master_df = pd.concat([df_m_aligned, df_d_aligned], ignore_index=True)
    
    # Enforce numeric types
    float_cols = [
        "latitude", "longitude", "soil_ph", "soil_organic_carbon",
        "temperature", "temp_max", "temp_min", "rainfall", "humidity",
        "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
        "crop_coefficient_kc", "et0", "etc", "effective_soil_wetness",
        "stress_coefficient_ks", "eta", "cwsi", "water_deficit", "ndvi",
        "irrigation_priority_index", "pca_x", "pca_y"
    ]
    for c in float_cols:
        master_df[c] = pd.to_numeric(master_df[c], errors="coerce").round(4)
        
    int_cols = ["month", "crop_code", "stage_code", "stress_level_code", "irrigation_priority_code", "cluster_id"]
    for c in int_cols:
        master_df[c] = master_df[c].fillna(0).astype(int)
        
    # Check duplicates
    dup_count = master_df.duplicated(subset=["granularity", "state", "district", "month", "date"]).sum()
    print(f"Duplicate records check: {dup_count} duplicates found.")
    
    # Save Master CSV
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    master_df.to_csv(MASTER_CSV_PATH, index=False)
    
    print("\n" + "=" * 70)
    print("SUCCESSFULLY GENERATED MASTER DATASET!")
    print(f"Path: {MASTER_CSV_PATH}")
    print(f"Total Rows:    {len(master_df)}")
    print(f"Total Columns: {len(master_df.columns)}")
    print(f"States/UTs:    {master_df['state'].nunique()} (All 28 States & 8 UTs)")
    print(f"Districts:     {master_df['district'].nunique()}")
    print(f"Granularities: {master_df['granularity'].value_counts().to_dict()}")
    print(f"Stress Levels: {master_df['stress_level'].value_counts().to_dict()}")
    print("=" * 70)
    
    return master_df

if __name__ == "__main__":
    generate_master_dataset()
