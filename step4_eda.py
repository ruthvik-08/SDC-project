# ==============================================================================
# STEP 4: EXPLORATORY DATA ANALYSIS (EDA) SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Charts: Temperature, Rainfall, Soil Moisture, Crop Stress, Correlation Heatmap
# ==============================================================================

import os
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

# Create plots folder
os.makedirs("eda/plots", exist_ok=True)

print("=" * 70)
print("STEP 4: EXPLORATORY DATA ANALYSIS (EDA)")
print("=" * 70)

# Load master processed dataset
data_file = "data/processed/krishijal_master_dataset.csv"
print(f"Loading data from: {data_file}")
df = pd.read_csv(data_file)

# 1. Temperature Distribution
print("Generating 1/5: Temperature Distribution...")
plt.figure(figsize=(8, 4))
sns.histplot(df["temperature"], bins=20, kde=True, color="#d95f02")
plt.title("Distribution of Temperature (°C) across Indian Districts")
plt.xlabel("Temperature (°C)")
plt.ylabel("Count")
plt.tight_layout()
plt.savefig("eda/plots/temperature_distribution.png", dpi=120)
plt.close()

# 2. Rainfall Distribution
print("Generating 2/5: Rainfall Distribution...")
plt.figure(figsize=(8, 4))
sns.histplot(df["rainfall"], bins=20, kde=True, color="#1b9e77")
plt.title("Distribution of Daily Rainfall (mm/day) across Indian Districts")
plt.xlabel("Rainfall (mm/day)")
plt.ylabel("Count")
plt.tight_layout()
plt.savefig("eda/plots/rainfall_distribution.png", dpi=120)
plt.close()

# 3. Soil Moisture Distribution
print("Generating 3/5: Soil Moisture Distribution...")
plt.figure(figsize=(8, 4))
sns.histplot(df["effective_soil_wetness"], bins=20, kde=True, color="#7570b3")
plt.title("Distribution of Effective Soil Moisture (0 to 1 Ratio)")
plt.xlabel("Effective Soil Moisture")
plt.ylabel("Count")
plt.tight_layout()
plt.savefig("eda/plots/soil_moisture_distribution.png", dpi=120)
plt.close()

# 4. Crop Stress Level Distribution
print("Generating 4/5: Crop Stress Level Distribution...")
plt.figure(figsize=(7, 4))
stress_order = ["Low", "Moderate", "High", "Severe"]
sns.countplot(data=df, x="stress_level", order=stress_order, palette="Blues")
plt.title("Crop Stress Level Distribution (Low, Moderate, High, Severe)")
plt.xlabel("Crop Stress Level")
plt.ylabel("Number of Observations")
plt.tight_layout()
plt.savefig("eda/plots/crop_stress_distribution.png", dpi=120)
plt.close()

# 5. Correlation Heatmap
print("Generating 5/5: Correlation Heatmap...")
corr_features = ["temperature", "rainfall", "humidity", "effective_soil_wetness",
                 "solar_radiation", "cwsi", "water_deficit", "irrigation_priority_index"]
corr_matrix = df[corr_features].corr()

plt.figure(figsize=(9, 6))
sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap="coolwarm", vmin=-1, vmax=1)
plt.title("Correlation Heatmap of Weather, Soil & Water Stress Features")
plt.tight_layout()
plt.savefig("eda/plots/correlation_heatmap.png", dpi=120)
plt.close()

print("\n" + "=" * 70)
print("STEP 4 COMPLETE: ALL 5 EDA CHARTS SAVED TO eda/plots/")
print("=" * 70)
