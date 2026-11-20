"""
Stage 4: Exploratory Data Analysis (EDA) Script
Author: First-Year B.Tech Student Project
Purpose: Analyze the processed agricultural dataset using Pandas, Matplotlib, and Seaborn.
         Generate clear, informative graphs saved to eda/plots/:
         1. Temperature distribution
         2. Rainfall distribution
         3. Soil moisture distribution
         4. Crop stress distribution
         5. Correlation heatmap
         6. Regional stress comparison
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# Set Matplotlib style for clear presentation graphics
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams["font.sans-serif"] = "DejaVu Sans"
plt.rcParams["figure.dpi"] = 150

# Define paths
DATA_PATH = "data/processed/all_india_agricultural_processed.csv"
PLOTS_DIR = "eda/plots"

print("=" * 70)
print("STAGE 4: EXPLORATORY DATA ANALYSIS (EDA)")
print("=" * 70)

# Load processed data
df = pd.read_csv(DATA_PATH)
print(f"Dataset loaded: {df.shape[0]} rows, {df.shape[1]} columns\n")

# Summary Statistics
print("Summary Statistics for Core Variables:")
core_vars = ["temperature", "rainfall", "humidity", "effective_soil_wetness", "et0", "etc", "cwsi", "ndvi", "irrigation_priority_index"]
summary_df = df[core_vars].describe().T[["mean", "std", "min", "50%", "max"]]
summary_df.columns = ["Mean", "Std Dev", "Min", "Median", "Max"]
print(summary_df.round(2))

# -------------------------------------------------------------
# GRAPH 1: Temperature Distribution
# -------------------------------------------------------------
print("\n[1/5] Generating Temperature Distribution Plot...")
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Histogram with KDE
sns.histplot(df["temperature"], bins=30, kde=True, color="#d95f02", ax=axes[0])
axes[0].set_title("Distribution of Daily Mean Temperature (°C)", fontsize=13, fontweight="bold")
axes[0].set_xlabel("Temperature (°C)", fontsize=11)
axes[0].set_ylabel("Frequency (Days)", fontsize=11)
axes[0].axvline(df["temperature"].mean(), color="black", linestyle="--", label=f"Mean: {df['temperature'].mean():.1f}°C")
axes[0].legend()

# Boxplot by Geographic Zone
sns.boxplot(data=df, x="zone", y="temperature", palette="Set2", ax=axes[1])
axes[1].set_title("Temperature by Indian Agro-Climatic Zone", fontsize=13, fontweight="bold")
axes[1].set_xlabel("Zone", fontsize=11)
axes[1].set_ylabel("Temperature (°C)", fontsize=11)

plt.tight_layout()
temp_plot_path = f"{PLOTS_DIR}/temperature_distribution.png"
plt.savefig(temp_plot_path)
plt.close()
print(f"Saved: {temp_plot_path}")

# -------------------------------------------------------------
# GRAPH 2: Rainfall Distribution
# -------------------------------------------------------------
print("[2/5] Generating Rainfall Distribution Plot...")
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Rainfall Histogram (zoomed in to 0-50 mm for readability, since rainfall has dry days)
rain_non_zero = df[df["rainfall"] > 0]["rainfall"]
sns.histplot(rain_non_zero, bins=35, kde=True, color="#1f78b4", ax=axes[0])
axes[0].set_xlim(0, 50)
axes[0].set_title("Rainfall Distribution on Rainy Days (0-50 mm)", fontsize=13, fontweight="bold")
axes[0].set_xlabel("Rainfall (mm/day)", fontsize=11)
axes[0].set_ylabel("Count of Rainy Days", fontsize=11)

# Rainfall by Zone Boxplot
sns.barplot(data=df, x="zone", y="rainfall", estimator="mean", ci=None, palette="Blues_d", ax=axes[1])
axes[1].set_title("Average Daily Rainfall by Indian Zone (mm/day)", fontsize=13, fontweight="bold")
axes[1].set_xlabel("Zone", fontsize=11)
axes[1].set_ylabel("Mean Daily Rainfall (mm)", fontsize=11)
for p in axes[1].patches:
    axes[1].annotate(f"{p.get_height():.2f}", (p.get_x() + p.get_width() / 2., p.get_height() / 2),
                     ha="center", va="center", color="white", fontweight="bold")

plt.tight_layout()
rain_plot_path = f"{PLOTS_DIR}/rainfall_distribution.png"
plt.savefig(rain_plot_path)
plt.close()
print(f"Saved: {rain_plot_path}")

# -------------------------------------------------------------
# GRAPH 3: Soil Moisture Distribution
# -------------------------------------------------------------
print("[3/5] Generating Soil Moisture Distribution Plot...")
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Effective Soil Moisture Histogram
sns.histplot(df["effective_soil_wetness"], bins=25, kde=True, color="#33a02c", ax=axes[0])
axes[0].axvline(0.60, color="red", linestyle="--", label="Stress Threshold (0.60)")
axes[0].axvline(df["effective_soil_wetness"].mean(), color="black", linestyle="-", label=f"Mean: {df['effective_soil_wetness'].mean():.2f}")
axes[0].set_title("Distribution of Soil Moisture Wetness (0 to 1 scale)", fontsize=13, fontweight="bold")
axes[0].set_xlabel("Effective Soil Moisture Fraction", fontsize=11)
axes[0].set_ylabel("Frequency", fontsize=11)
axes[0].legend()

# Surface vs Root-zone Soil Moisture Scatter
sns.scatterplot(data=df, x="surface_soil_moisture", y="root_zone_soil_moisture", hue="stress_level",
                palette={"Low": "#2ca02c", "Moderate": "#ff7f0e", "High": "#d62728", "Severe": "#9467bd"},
                alpha=0.6, ax=axes[1])
axes[1].set_title("Surface vs Root-Zone Moisture by Stress Level", fontsize=13, fontweight="bold")
axes[1].set_xlabel("Surface Soil Moisture (0-5 cm)", fontsize=11)
axes[1].set_ylabel("Root-Zone Soil Moisture (0-100 cm)", fontsize=11)

plt.tight_layout()
soil_plot_path = f"{PLOTS_DIR}/soil_moisture_distribution.png"
plt.savefig(soil_plot_path)
plt.close()
print(f"Saved: {soil_plot_path}")

# -------------------------------------------------------------
# GRAPH 4: Crop Stress Distribution
# -------------------------------------------------------------
print("[4/5] Generating Crop Stress Distribution Plot...")
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# Countplot of Stress Levels
stress_order = ["Low", "Moderate", "High", "Severe"]
stress_colors = ["#2ca02c", "#ffbb78", "#ff7f0e", "#d62728"]
stress_counts = df["stress_level"].value_counts().reindex(stress_order)

sns.barplot(x=stress_counts.index, y=stress_counts.values, palette=stress_colors, ax=axes[0])
axes[0].set_title("Crop Stress Severity Class Distribution", fontsize=13, fontweight="bold")
axes[0].set_xlabel("Crop Stress Level", fontsize=11)
axes[0].set_ylabel("Total Observations (Days)", fontsize=11)
for i, val in enumerate(stress_counts.values):
    pct = (val / len(df)) * 100.0
    axes[0].text(i, val + 40, f"{val}\n({pct:.1f}%)", ha="center", fontsize=10, fontweight="bold")

# Irrigation Priority Index Distribution
priority_order = ["Low", "Medium", "High", "Critical"]
priority_colors = ["#1b9e77", "#e6ab02", "#e7298a", "#e41a1c"]
priority_counts = df["irrigation_priority"].value_counts().reindex(priority_order)

sns.barplot(x=priority_counts.index, y=priority_counts.values, palette=priority_colors, ax=axes[1])
axes[1].set_title("Irrigation Priority Distribution Across India", fontsize=13, fontweight="bold")
axes[1].set_xlabel("Irrigation Priority Level", fontsize=11)
axes[1].set_ylabel("Total Observations (Days)", fontsize=11)
for i, val in enumerate(priority_counts.values):
    pct = (val / len(df)) * 100.0
    axes[1].text(i, val + 40, f"{val}\n({pct:.1f}%)", ha="center", fontsize=10, fontweight="bold")

plt.tight_layout()
stress_plot_path = f"{PLOTS_DIR}/crop_stress_distribution.png"
plt.savefig(stress_plot_path)
plt.close()
print(f"Saved: {stress_plot_path}")

# -------------------------------------------------------------
# GRAPH 5: Correlation Heatmap
# -------------------------------------------------------------
print("[5/5] Generating Correlation Heatmap...")
corr_features = [
    "temperature", "rainfall", "humidity", "effective_soil_wetness",
    "solar_radiation", "crop_coefficient_kc", "et0", "etc",
    "cwsi", "ndvi", "water_deficit", "irrigation_priority_index"
]
corr_matrix = df[corr_features].corr()

plt.figure(figsize=(11, 8))
mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
sns.heatmap(corr_matrix, mask=mask, annot=True, fmt=".2f", cmap="coolwarm",
            vmin=-1, vmax=1, cbar_kws={"shrink": 0.8}, linewidths=0.5)
plt.title("Correlation Heatmap of Agricultural & Agro-Climatic Features", fontsize=14, fontweight="bold", pad=15)
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
heatmap_plot_path = f"{PLOTS_DIR}/correlation_heatmap.png"
plt.savefig(heatmap_plot_path)
plt.close()
print(f"Saved: {heatmap_plot_path}")

# Regional stress breakdown plot
plt.figure(figsize=(12, 5))
cross_tab = pd.crosstab(df["zone"], df["stress_level"], normalize="index")[stress_order] * 100.0
cross_tab.plot(kind="bar", stacked=True, color=stress_colors, figsize=(12, 5))
plt.title("Crop Stress Breakdown by Indian Agro-Climatic Zone (%)", fontsize=13, fontweight="bold")
plt.xlabel("Agro-Climatic Zone", fontsize=11)
plt.ylabel("Percentage of Season (%)", fontsize=11)
plt.xticks(rotation=0)
plt.legend(title="Crop Stress Level", bbox_to_anchor=(1.02, 1), loc="upper left")
plt.tight_layout()
regional_plot_path = f"{PLOTS_DIR}/regional_stress_comparison.png"
plt.savefig(regional_plot_path)
plt.close()
print(f"Saved: {regional_plot_path}")

print("\n" + "=" * 70)
print("STAGE 4 EDA COMPLETED SUCCESSFULLY")
print(f"All 6 graphs successfully generated in: {PLOTS_DIR}")
print("=" * 70)
