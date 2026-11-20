"""
KrishiJal: Master Dataset Generation Pipeline
Restructures the multi-file data pipeline into ONE unified master CSV:
  data/processed/krishijal_master_dataset.csv

Builds directly from raw datasets:
  - data/raw/all_india_140_districts_raw.csv (Nationwide 158-district monthly climatology)
  - data/raw/all_india_agricultural_raw.csv (26-district high-frequency daily observations)
  - data/raw/india_districts.csv (District geographical metadata)

Computes UN FAO-56 physical indicators, cleans NASA anomalies (Lakshadweep -999.0 fill values),
standardizes categories, tracks data granularity, and creates one self-contained master dataset.
"""

import os
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# Define paths
DATA_DIR = "data"
RAW_DIR = os.path.join(DATA_DIR, "raw")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")
MASTER_CSV_PATH = os.path.join(PROCESSED_DIR, "krishijal_master_dataset.csv")

# Standard ICAR Agro-Climatic Zone mapping across all 36 Indian States and UTs
STATE_TO_ZONE = {
    # North
    "Jammu And Kashmir": "North", "Jammu & Kashmir": "North", "Ladakh": "North", "Punjab": "North",
    "Haryana": "North", "Himachal Pradesh": "North", "Uttar Pradesh": "North",
    "Uttarakhand": "North", "Chandigarh": "North", "Delhi": "North",
    # South
    "Andhra Pradesh": "South", "Telangana": "South", "Karnataka": "South",
    "Tamil Nadu": "South", "Kerala": "South", "Puducherry": "South",
    "Lakshadweep": "South", "Andaman And Nicobar": "South", "Andaman and Nicobar": "South",
    # East
    "Bihar": "East", "Jharkhand": "East", "Odisha": "East", "West Bengal": "East",
    # West
    "Rajasthan": "West", "Gujarat": "West", "Maharashtra": "West", "Goa": "West",
    "Dadra And Nagar Haveli And Daman And Diu": "West",
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

# Mapping 16 historical / alternate district spellings to official 2025 LGD names
DISTRICT_NAME_MAPPING = {
    "ahmednagar": "ahilyanagar",
    "anantapur": "ananthapuramu",
    "banaskantha": "banas kantha",
    "bardez": "north goa",
    "tiswadi": "north goa",
    "salcete": "south goa",
    "burdwan": "purba bardhaman",
    "geyzing": "gyalshing",
    "lakshadweep": "lakshadweep district",
    "leh": "leh ladakh",
    "north & middle andaman": "north and middle andaman",
    "south andaman": "south andamans",
    "north delhi": "north",
    "south west delhi": "south west",
    "pantnagar": "udham singh nagar",
    "ri-bhoi": "ri bhoi"
}

def load_and_preprocess_140_districts():
    """Loads and computes FAO-56 metrics for the 158-district monthly dataset (1,896 records)."""
    raw_path = os.path.join(RAW_DIR, "all_india_140_districts_raw.csv")
    df = pd.read_csv(raw_path)
    df = df.drop_duplicates()
    
    # Missing values imputation
    num_cols = ["temperature", "temp_max", "temp_min", "rainfall", "humidity",
                "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
                "soil_ph", "soil_organic_carbon"]
    for col in num_cols:
        df[col] = df[col].fillna(df[col].median())
        
    text_cols = ["state", "district", "crop_type", "soil_type"]
    for col in text_cols:
        df[col] = df[col].astype(str).str.strip().str.title()
        
    # Clean NASA -999.0 fill values in Lakshadweep root zone soil moisture
    mask_anomaly = (df["root_zone_soil_moisture"] <= -900)
    if mask_anomaly.any():
        df.loc[mask_anomaly, "root_zone_soil_moisture"] = 0.42
        
    # Indian Agricultural Seasons and Growth Stages
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
    
    # FAO-56 Crop Coefficients (Kc)
    crop_kc_map = {
        "Rice": 1.15, "Wheat": 0.95, "Cotton": 1.05, "Sugarcane": 1.20,
        "Maize": 1.00, "Pulses": 0.85, "Groundnut": 0.90, "Mustard": 0.85, "Barley": 0.90
    }
    df["crop_coefficient_kc"] = df["crop_type"].map(crop_kc_map).fillna(1.0)
    
    # Reference Evapotranspiration (ET0) using Hargreaves formula
    temp_diff = np.sqrt(np.maximum(df["temp_max"] - df["temp_min"], 1.0))
    df["et0"] = np.round(0.0023 * (df["temperature"] + 17.8) * temp_diff * (0.408 * df["solar_radiation"]), 2)
    df["etc"] = np.round(df["crop_coefficient_kc"] * df["et0"], 2)
    
    # Effective Soil Moisture
    df["effective_soil_wetness"] = np.round(0.4 * df["surface_soil_moisture"] + 0.6 * df["root_zone_soil_moisture"], 3)
    df["stress_coefficient_ks"] = np.round(np.clip(df["effective_soil_wetness"] / 0.55, 0.0, 1.0), 3)
    df["eta"] = np.round(df["stress_coefficient_ks"] * df["etc"], 2)
    df["cwsi"] = np.round(np.clip(1.0 - (df["eta"] / np.maximum(df["etc"], 0.1)), 0.0, 1.0), 3)
    df["water_deficit"] = np.round(np.maximum(df["etc"] - df["eta"] - df["rainfall"], 0.0), 2)
    df["ndvi"] = np.round(np.clip(0.65 + (df["effective_soil_wetness"] * 0.15) - (df["cwsi"] * 0.25), 0.15, 0.88), 3)
    
    # Irrigation Priority Index (IPI: 0 - 100)
    ipi_raw = 45.0 * df["cwsi"] + 35.0 * (1.0 - df["effective_soil_wetness"]) + 20.0 * (df["water_deficit"] / 10.0)
    df["irrigation_priority_index"] = np.round(np.clip(ipi_raw, 0.0, 100.0), 1)
    
    df["stress_level"] = "Low"
    df.loc[df["cwsi"] >= 0.25, "stress_level"] = "Moderate"
    df.loc[df["cwsi"] >= 0.45, "stress_level"] = "High"
    df.loc[df["cwsi"] >= 0.65, "stress_level"] = "Severe"
    
    df["irrigation_priority"] = "Low"
    df.loc[df["irrigation_priority_index"] >= 35.0, "irrigation_priority"] = "Medium"
    df.loc[df["irrigation_priority_index"] >= 50.0, "irrigation_priority"] = "High"
    df.loc[df["irrigation_priority_index"] >= 70.0, "irrigation_priority"] = "Critical"
    
    # Month standardization
    df["month_name"] = df["month"].astype(str)
    df["month"] = df["month_name"].map(MONTH_MAP_STR_TO_INT).fillna(1).astype(int)
    
    df["granularity"] = "monthly"
    df["record_id"] = [f"KMD_M_{i+1:04d}" for i in range(len(df))]
    df["zone"] = df["state"].map(STATE_TO_ZONE).fillna("Central")
    df["date"] = np.nan
    df["year"] = 2023
    df["day"] = np.nan
    df["day_of_year"] = np.nan
    df["field_capacity"] = np.nan
    df["wilting_point"] = np.nan
    
    df["crop_code"] = df["crop_type"].map(CROP_ENCODING).fillna(1).astype(int)
    df["stage_code"] = df["growth_stage"].map(STAGE_ENCODING).fillna(3).astype(int)
    df["stress_level_code"] = df["stress_level"].map(STRESS_ENCODING).fillna(0).astype(int)
    df["irrigation_priority_code"] = df["irrigation_priority"].map(PRIORITY_ENCODING).fillna(0).astype(int)
    
    return df

def load_and_preprocess_agricultural_daily():
    """Loads and computes FAO-56 metrics for the 26-district daily dataset (4,758 records)."""
    raw_path = os.path.join(RAW_DIR, "all_india_agricultural_raw.csv")
    df = pd.read_csv(raw_path)
    df = df.drop_duplicates()
    
    # Impute missing values
    numeric_cols = [
        "temperature", "temp_max", "temp_min", "rainfall", "humidity",
        "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
        "soil_ph", "soil_organic_carbon", "field_capacity", "wilting_point"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = df.groupby("district")[col].transform(lambda s: s.fillna(s.median()))
            df[col] = df[col].fillna(df[col].median())
            
    df["date"] = pd.to_datetime(df["date"])
    df["year"] = df["date"].dt.year
    df["month"] = df["date"].dt.month
    df["day"] = df["date"].dt.day
    df["day_of_year"] = df["date"].dt.dayofyear
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    
    string_cols = ["district", "state", "zone", "soil_type", "crop_type"]
    for col in string_cols:
        df[col] = df[col].astype(str).str.strip().str.title()
        
    season_day = df["day_of_year"] - df["day_of_year"].min() + 1
    def assign_growth_stage(day_num):
        if day_num <= 30:
            return "Initial"
        elif day_num <= 75:
            return "Vegetative"
        elif day_num <= 135:
            return "Reproductive"
        else:
            return "Maturity"
    df["growth_stage"] = season_day.apply(assign_growth_stage)
    
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
    
    temp_diff = np.maximum(df["temp_max"] - df["temp_min"], 1.0)
    df["et0"] = (0.0023 * (df["temperature"] + 17.8) * np.sqrt(temp_diff) * 14.5).clip(2.5, 8.5).round(2)
    df["etc"] = (df["crop_coefficient_kc"] * df["et0"]).round(2)
    df["effective_soil_wetness"] = (0.50 * df["surface_soil_moisture"] + 0.50 * df["root_zone_soil_moisture"]).round(3)
    df["stress_coefficient_ks"] = np.where(df["effective_soil_wetness"] >= 0.60, 1.0, df["effective_soil_wetness"] / 0.60).clip(0.10, 1.0).round(3)
    df["eta"] = (df["stress_coefficient_ks"] * df["etc"]).round(2)
    df["cwsi"] = (1.0 - (df["eta"] / df["etc"])).clip(0.0, 1.0).round(3)
    
    effective_rainfall = np.minimum(df["rainfall"] * 0.8, df["etc"])
    df["water_deficit"] = np.maximum(0.0, df["etc"] - (df["eta"] + effective_rainfall)).round(2)
    
    stage_base_ndvi = {"Initial": 0.28, "Vegetative": 0.62, "Reproductive": 0.78, "Maturity": 0.48}
    base_ndvi = df["growth_stage"].map(stage_base_ndvi)
    ndvi_adjustment = (df["effective_soil_wetness"] * 0.15) - (df["cwsi"] * 0.20)
    df["ndvi"] = (base_ndvi + ndvi_adjustment).clip(0.15, 0.88).round(3)
    
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
    
    soil_deficit = np.maximum(0.0, (0.65 - df["effective_soil_wetness"]) / 0.65)
    rain_deficit = np.where(df["rainfall"] < 2.5, 1.0 - (df["rainfall"] / 2.5), 0.0)
    heat_stress = np.where(df["temp_max"] > 32.0, (df["temp_max"] - 32.0) / 10.0, 0.0).clip(0.0, 1.0)
    stage_weights = df["growth_stage"].map({"Initial": 0.50, "Vegetative": 0.75, "Reproductive": 1.00, "Maturity": 0.40})
    raw_ipi = (0.35 * df["cwsi"] + 0.25 * soil_deficit + 0.15 * rain_deficit + 0.15 * heat_stress + 0.10 * stage_weights) * 100.0
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
    
    df["granularity"] = "daily"
    df["record_id"] = [f"KMD_D_{i+1:04d}" for i in range(len(df))]
    df["month_name"] = df["month"].map(MONTH_MAP_INT_TO_STR).fillna("JUN")
    if "zone" not in df.columns or df["zone"].isnull().any():
        df["zone"] = df["state"].map(STATE_TO_ZONE).fillna("North")
    df["season"] = "Kharif"
    
    df["crop_code"] = df["crop_type"].map(CROP_ENCODING).fillna(1).astype(int)
    df["stage_code"] = df["growth_stage"].map(STAGE_ENCODING).fillna(3).astype(int)
    df["stress_level_code"] = df["stress_level"].map(STRESS_ENCODING).fillna(0).astype(int)
    df["irrigation_priority_code"] = df["irrigation_priority"].map(PRIORITY_ENCODING).fillna(0).astype(int)
    
    return df

def enrich_with_soil_health_card_data(master_df):
    """
    Enriches the master dataset with Government of India Soil Health Card (SHC) 2024-25
    district-level soil nutrient indicators from data/raw/india_district_month_master_2025.csv.
    Adds official LGD codes, macro NPK shares, pH neutrality, organic carbon, and micro-nutrients.
    """
    shc_raw_path = os.path.join(RAW_DIR, "india_district_month_master_2025.csv")
    if not os.path.exists(shc_raw_path):
        print(f"Warning: SHC 2025 dataset not found at {shc_raw_path}. Skipping SHC enrichment.")
        return master_df

    print("\nEnriching master dataset with Government of India Soil Health Card (SHC) 2024-25...")
    shc_df = pd.read_csv(shc_raw_path)
    
    # Static district-level profile (drop 12-month duplicates per district)
    shc_district = shc_df.drop_duplicates(subset=["district_name"]).copy()
    shc_district["match_key"] = shc_district["district_name"].astype(str).str.strip().str.lower()
    
    master_df["match_key"] = master_df["district"].astype(str).str.strip().str.lower().map(
        lambda d: DISTRICT_NAME_MAPPING.get(d, d)
    )
    
    shc_cols = [
        "state_lgd_code", "district_lgd_code",
        "shc_macro_nitrogen_low_share_2024_25", "shc_macro_nitrogen_medium_share_2024_25", "shc_macro_nitrogen_high_share_2024_25",
        "shc_macro_phosphorus_low_share_2024_25", "shc_macro_phosphorus_medium_share_2024_25", "shc_macro_phosphorus_high_share_2024_25",
        "shc_macro_potassium_low_share_2024_25", "shc_macro_potassium_medium_share_2024_25", "shc_macro_potassium_high_share_2024_25",
        "shc_macro_organic_carbon_low_share_2024_25", "shc_macro_organic_carbon_medium_share_2024_25", "shc_macro_organic_carbon_high_share_2024_25",
        "shc_macro_soil_ph_acidic_share_2024_25", "shc_macro_soil_ph_neutral_share_2024_25", "shc_macro_soil_ph_alkaline_share_2024_25",
        "shc_macro_electrical_conductivity_saline_share_2024_25",
        "shc_micro_zinc_deficient_share_2024_25", "shc_micro_iron_deficient_share_2024_25", "shc_micro_boron_deficient_share_2024_25"
    ]
    
    merged = master_df.merge(shc_district[["match_key"] + shc_cols], on="match_key", how="left")
    merged.drop(columns=["match_key"], inplace=True)
    master_df.drop(columns=["match_key"], inplace=True, errors="ignore")
    
    # Impute missing numeric SHC values using state median then national median
    num_shc = [c for c in shc_cols if c not in ["state_lgd_code", "district_lgd_code"]]
    for col in num_shc:
        merged[col] = merged.groupby("state")[col].transform(lambda s: s.fillna(s.median()))
        merged[col] = merged[col].fillna(merged[col].median()).round(4)
        
    merged["state_lgd_code"] = merged["state_lgd_code"].fillna(0).astype(int)
    merged["district_lgd_code"] = merged["district_lgd_code"].fillna(0).astype(int)
    
    # Friendly agronomic classification columns
    merged["nitrogen_status"] = np.where(
        merged["shc_macro_nitrogen_low_share_2024_25"] >= 0.50, "Deficient (Low N)",
        np.where(merged["shc_macro_nitrogen_high_share_2024_25"] >= 0.35, "Rich (High N)", "Optimal (Medium N)")
    )
    merged["soil_ph_character"] = np.where(
        merged["shc_macro_soil_ph_acidic_share_2024_25"] >= 0.40, "Acidic Soil Belt",
        np.where(merged["shc_macro_soil_ph_alkaline_share_2024_25"] >= 0.40, "Alkaline Soil Belt", "Neutral / Balanced")
    )
    raw_health_score = (
        30.0 * merged["shc_macro_soil_ph_neutral_share_2024_25"] +
        25.0 * (1.0 - merged["shc_macro_nitrogen_low_share_2024_25"]) +
        20.0 * (1.0 - merged["shc_macro_phosphorus_low_share_2024_25"]) +
        15.0 * (1.0 - merged["shc_macro_potassium_low_share_2024_25"]) +
        10.0 * (1.0 - merged["shc_macro_electrical_conductivity_saline_share_2024_25"])
    )
    merged["soil_health_index"] = raw_health_score.clip(0.0, 100.0).round(1)
    
    print(f"  -> SHC Enrichment complete! Added 24 new soil chemistry & LGD features (Total columns: {len(merged.columns)}).")
    return merged

def generate_master_dataset():
    """Combines raw inputs and computes K-Means and PCA for the unified master dataset."""
    print("=" * 70)
    print("KRISHIJAL: MASTER DATASET GENERATION (DIRECT FROM RAW)")
    print("=" * 70)
    
    df_monthly = load_and_preprocess_140_districts()
    print(f"Processed monthly nationwide records: {len(df_monthly)} rows across {df_monthly['district'].nunique()} districts.")
    
    df_daily = load_and_preprocess_agricultural_daily()
    print(f"Processed daily observational records: {len(df_daily)} rows across {df_daily['district'].nunique()} districts.")
    
    # 48 master columns in canonical order
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
        "stress_level", "stress_level_code", "irrigation_priority", "irrigation_priority_code"
    ]
    
    df_m_aligned = df_monthly.reindex(columns=master_columns)
    df_d_aligned = df_daily.reindex(columns=master_columns)
    
    master_df = pd.concat([df_m_aligned, df_d_aligned], ignore_index=True)
    
    # Compute K-Means and PCA on entire master dataset
    cluster_features = [
        "temperature", "rainfall", "humidity", "effective_soil_wetness",
        "solar_radiation", "soil_ph", "soil_organic_carbon", "ndvi", "et0", "etc"
    ]
    scaler_clust = StandardScaler()
    X_clust_scaled = scaler_clust.fit_transform(master_df[cluster_features])
    
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    master_df["cluster_id"] = kmeans.fit_predict(X_clust_scaled)
    
    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_clust_scaled)
    master_df["pca_x"] = np.round(coords[:, 0], 2)
    master_df["pca_y"] = np.round(coords[:, 1], 2)
    
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
        
    dup_count = master_df.duplicated(subset=["granularity", "state", "district", "month", "date"]).sum()
    print(f"Duplicate records check: {dup_count} duplicates found.")
    
    # Enrich with Government of India Soil Health Card (SHC) 2024-25 Data
    master_df = enrich_with_soil_health_card_data(master_df)
    
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    master_df.to_csv(MASTER_CSV_PATH, index=False)
    
    print("\n" + "=" * 70)
    print("SUCCESSFULLY GENERATED MASTER DATASET DIRECTLY FROM RAW DATA!")
    print(f"Path: {MASTER_CSV_PATH}")
    print(f"Total Rows:    {len(master_df)}")
    print(f"Total Columns: {len(master_df.columns)}")
    print(f"States/UTs:    {master_df['state'].nunique()}")
    print(f"Districts:     {master_df['district'].nunique()}")
    print("=" * 70)
    
    return master_df

if __name__ == "__main__":
    generate_master_dataset()
