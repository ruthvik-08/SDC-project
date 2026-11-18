# ==============================================================================
# STEP 5: FEATURE ENGINEERING SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Tasks: Encoding crop/stage names to numbers, scaling features, saving CSV.
# ==============================================================================

import pandas as pd
from sklearn.preprocessing import StandardScaler

print("=" * 70)
print("STEP 5: FEATURE ENGINEERING (ENCODING & SCALING)")
print("=" * 70)

# Load preprocessed dataset
data_file = "data/processed/all_india_140_districts_processed.csv"
print(f"Loading data from: {data_file}")
df = pd.read_csv(data_file)

# Step 5.1: Encode categorical columns into simple numbers
# Crops: Cotton=0, Groundnut=1, Maize=2, Mustard=3, Pulses=4, Rice=5, Sugarcane=6, Wheat=7
crop_list = sorted(df["crop_type"].unique().tolist())
stage_list = sorted(df["growth_stage"].unique().tolist())

crop_map = {name: idx for idx, name in enumerate(crop_list)}
stage_map = {name: idx for idx, name in enumerate(stage_list)}

df["crop_code"] = df["crop_type"].map(crop_map)
df["stage_code"] = df["growth_stage"].map(stage_map)

print(f"Encoded {len(crop_map)} crops and {len(stage_map)} growth stages.")

# Step 5.2: Define useful feature columns for training
feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

print(f"Selected {len(feature_cols)} features for model training.")

# Step 5.3: Feature Scaling using StandardScaler
scaler = StandardScaler()
scaled_features = scaler.fit_transform(df[feature_cols])

# Create scaled columns
for idx, col in enumerate(feature_cols):
    df[col + "_scaled"] = scaled_features[:, idx]

# Save engineered dataset to CSV
output_file = "data/processed/all_india_140_engineered_features.csv"
df.to_csv(output_file, index=False)

print("\n" + "=" * 70)
print("STEP 5 COMPLETE: ENGINEERED FEATURES SAVED TO CSV")
print(f"Saved to: {output_file}")
print(f"Total Rows: {len(df)}, Total Columns: {len(df.columns)}")
print("=" * 70)
