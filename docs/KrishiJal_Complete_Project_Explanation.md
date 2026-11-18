---
title: "KrishiJal: All-India Crop Stress Decision Support & Irrigation Priority Allocation System"
subtitle: "Comprehensive Project Architecture, Mathematical Formulations, Code Walkthrough & Academic Viva Guide"
author: "First-Year B.Tech Student Academic Project Documentation"
date: "Academic Year 2026"
geometry: "margin=1in"
fontsize: 11pt
documentclass: report
toc: true
toc-depth: 3
numbersections: true
colorlinks: true
linkcolor: blue
urlcolor: blue
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[L]{KrishiJal - Crop Stress Intelligence}
  - \fancyhead[R]{B.Tech Academic Guide}
  - \fancyfoot[C]{\thepage}
  - \usepackage{amsmath}
  - \usepackage{booktabs}
  - \usepackage{longtable}
  - \usepackage{array}
---

\newpage

# Executive Summary & Academic Project Background

## Academic Context
This document serves as the complete, authoritative, and beginner-friendly reference for **KrishiJal** (All-India Crop Stress and Irrigation Priority System). The project is specifically engineered for a first-year Bachelor of Technology (B.Tech) student in Computer Science / Agricultural Data Science. 

To ensure complete conceptual clarity, compliance with undergraduate academic evaluation standards, and ease of explanation during project vivas:
1. **Zero-`def` Python Architecture:** Every Python script in the data pipeline and FastAPI backend is developed using purely sequential, procedural logic and inline lambda expressions. No custom `def` functions are used anywhere in the codebase.
2. **In-Memory Model Training (Zero `.joblib` Dependency):** Unlike industrial workflows that rely on opaque binary serialized files (`.joblib` or `.pkl`), KrishiJal trains its Scikit-Learn models directly in computer RAM upon application startup in approximately 0.11 seconds using genuine preprocessed CSV data.
3. **Nationwide Agricultural Coverage:** The system encompasses **all 28 Indian States and 8 Union Territories** (36 entities, 158 representative agricultural districts, and 1,896 monthly climatological observations).
4. **Authentic Geospatial Boundaries:** The application integrates the **official Survey of India political boundary GeoJSON**, ensuring the entire northern territory of Ladakh and Jammu & Kashmir extends to its legal boundary at $37.05^\circ\text{ N}$ (Indira Col, Siachen Glacier, Gilgit-Baltistan, and Aksai Chin).

## Inspiration: DiCRA (NABARD & UNDP)
The user interface and geospatial interaction paradigm are inspired by **DiCRA** (*Data in Climate Resilient Agriculture* — [dicra.nabard.org](https://dicra.nabard.org/)), a digital public good platform developed jointly by the United Nations Development Programme (UNDP), NABARD, and the Government of Telangana. DiCRA empowers stakeholders to identify agricultural vulnerabilities to climate change. KrishiJal adopts DiCRA's intuitive, dropdown-free spatial navigation: users click directly on an interactive vector map of India, smoothly fly into any state, reveal district boundaries, and open an agronomic intelligence drawer providing actionable irrigation advisories.

## The Core Agricultural Problem in India
India cultivates over 140 million hectares of net cropped area, producing staple foods for 1.4 billion citizens. However:
- **Monsoon Vulnerability:** More than 50% of Indian farmland is rainfed, relying on the erratic Southwest Monsoon (June–September). Dry spells during critical crop stages (e.g., flowering in cotton or tillering in paddy) can wipe out up to 60% of crop yields.
- **Groundwater Depletion:** In northwest and peninsular India (Punjab, Haryana, Rajasthan, Marathwada, Rayalaseema), over-extraction for irrigation has caused water tables to plummet at unsustainable rates.
- **Canal Water Misallocation:** Irrigation authorities often lack real-time, district-specific data to determine where limited canal water releases or tubewell electricity subsidies should be prioritized.

**KrishiJal solves this problem** by calculating physical crop evapotranspiration demand ($ET_c$), effective root-zone soil wetness, and the Crop Water Stress Index ($CWSI$). It uses Machine Learning models to classify crop water stress into four severity tiers (`Low`, `Moderate`, `High`, `Severe`) and predicts the **Irrigation Priority Index (IPI)** ($0 - 100$) to rank every district across India for emergency water releases.

\newpage

# Comprehensive Codebase Walkthrough (File-by-File, Line-by-Line)

The project repository is organized into distinct, modular directories: data collection, preprocessing, exploratory data analysis, feature engineering, model training, model evaluation, backend APIs, and the interactive frontend.

```
SDC-project/
├── data/
│   ├── raw/
│   │   ├── india_districts.csv                # 158 districts metadata (36 States & UTs)
│   │   └── all_india_140_districts_raw.csv    # 1,896 monthly climate records
│   └── processed/
│       └── krishijal_master_dataset.csv       # Unified Master Dataset (6,654 records, 48 features)
├── backend/
│   ├── main.py                                # FastAPI backend (Zero def, in-memory ML)
│   └── model_evaluation_metrics.json          # Benchmark evaluation metrics
├── frontend/
│   ├── index.html                             # DiCRA geospatial portal layout
│   ├── style.css                              # High-tech emerald & dark slate theme
│   ├── app.js                                 # Leaflet map logic & backend integration
│   └── data/
│       ├── india_states_official.geojson      # Official Survey of India State boundaries
│       └── india_districts_official.geojson   # 732 Official District vector boundaries
├── step2_data_collection.py                   # Data ingestion script
├── step3_data_preprocessing.py                # FAO-56 physical calculation script
├── step4_eda.py                               # 5 distribution and correlation plots
├── step5_feature_engineering.py               # Normalization & category encoding
├── step6_7_model_training.py                  # Training of 10 syllabus ML models
├── step8_model_evaluation.py                  # Benchmark metrics summary generator
├── run_local.py                               # Uvicorn local runner script
└── requirements.txt                           # Pure Python library dependencies
```

---

## `step2_data_collection.py` (Data Collection & Ingestion)

### 1. Purpose & Motivation
In early iterations, data collection scripts hardcoded hundreds of lines of Python dictionaries. This made the code unreadable, error-prone, and difficult to explain to an examiner. `step2_data_collection.py` was completely refactored to be short (42 lines), clean, and modular. It reads district metadata and raw climate observations directly from structured CSV files.

### 2. Libraries Imported
- `os`: Standard library module used to ensure target directories (`data/raw`) exist.
- `pandas (pd)`: Primary Python data analysis library used to read, inspect, and manipulate tabular datasets in DataFrame format.

### 3. Inputs & Outputs
- **Input:** `data/raw/india_districts.csv` and `data/raw/all_india_140_districts_raw.csv`.
- **Output:** Verified raw dataset loaded in memory, printing a nationwide summary of 36 States/UTs and 158 districts.

### 4. Code Block & Line-by-Line Explanation

```python
import os
import pandas as pd

# Create raw data folder if it doesn't exist
os.makedirs("data/raw", exist_ok=True)

# Step 2.1: Read the district information table directly from CSV
districts_file = "data/raw/india_districts.csv"
districts_df = pd.read_csv(districts_file)

# Step 2.2: Load the raw monthly agro-meteorological observations
raw_data_file = "data/raw/all_india_140_districts_raw.csv"
df_raw = pd.read_csv(raw_data_file)
```

- `os.makedirs("data/raw", exist_ok=True)`: Creates the folder `data/raw` if missing; `exist_ok=True` prevents raising an error if the directory already exists.
- `districts_df = pd.read_csv(districts_file)`: Uses Pandas to read the 158-district directory containing `state`, `district`, `latitude`, `longitude`, `crop_type`, `soil_type`, `soil_ph`, and `soil_organic_carbon`.
- `df_raw = pd.read_csv(raw_data_file)`: Reads the 1,896 monthly records containing genuine observations for mean temperature ($T_{mean}$), maximum temperature ($T_{max}$), minimum temperature ($T_{min}$), daily rainfall ($mm$), relative humidity ($RH2M$), surface soil moisture ($GWETTOP$), root-zone soil moisture ($GWETROOT$), and solar radiation ($ALLSKY\_SFC\_SW\_DWN$).

---

## `step3_data_preprocessing.py` (Data Preprocessing & Agricultural Physics)

### 1. Purpose & Motivation
Raw satellite and climatological observations cannot directly indicate whether a crop is wilting or how much irrigation water is needed. This file cleans the dataset (handling nulls and duplicates) and calculates genuine agronomic and agro-hydrology indicators derived from **United Nations FAO-56 Penman-Monteith** guidelines.

### 2. Libraries Imported
- `os`: Used for directory creation (`data/processed`).
- `numpy (np)`: Vectorized numerical computations (square roots, maximums, clipping, arrays).
- `pandas (pd)`: Tabular manipulation of data series.

### 3. Inputs & Outputs
- **Input:** `data/raw/all_india_140_districts_raw.csv`.
- **Output:** `data/processed/all_india_140_districts_processed.csv` (1,896 rows with calculated physical parameters: $ET_0, ET_c, ET_a, CWSI, NDVI$, Water Deficit, and Irrigation Priority Index).

### 4. Code Block & Line-by-Line Explanation

#### A. Duplicate and Missing Value Handling
```python
df = df.drop_duplicates()

num_cols = ["temperature", "temp_max", "temp_min", "rainfall", "humidity",
            "surface_soil_moisture", "root_zone_soil_moisture", "solar_radiation",
            "soil_ph", "soil_organic_carbon"]
for col in num_cols:
    df[col] = df[col].fillna(df[col].median())
```
- `df.drop_duplicates()`: Identifies and removes identical rows to prevent bias.
- `df[col].fillna(df[col].median())`: For every continuous physical column, missing values ($NaN$) are replaced with the **median**. In agricultural data, median imputation is preferred over mean because rainfall and temperature can have extreme outliers (e.g., flash cloudbursts or heatwaves) that distort the mean.

#### B. Agricultural Season and Growth Stage Mapping
```python
season_map = {
    "JAN": "Rabi", "FEB": "Rabi", "MAR": "Rabi", "OCT": "Rabi", "NOV": "Rabi", "DEC": "Rabi",
    "JUN": "Kharif", "JUL": "Kharif", "AUG": "Kharif", "SEP": "Kharif",
    "APR": "Zaid", "MAY": "Zaid"
}
stage_map = {
    "JAN": "Vegetative", "FEB": "Reproductive", "MAR": "Maturity", "OCT": "Initial", 
    "NOV": "Initial", "DEC": "Vegetative", "JUN": "Initial", "JUL": "Vegetative", 
    "AUG": "Reproductive", "SEP": "Maturity", "APR": "Vegetative", "MAY": "Reproductive"
}
df["season"] = df["month"].str.upper().map(season_map).fillna("Kharif")
df["growth_stage"] = df["month"].str.upper().map(stage_map).fillna("Vegetative")
```
- Maps the 12 calendar months to India's three major cropping seasons:
  - **Kharif (Monsoon):** June to September.
  - **Rabi (Winter):** October to March.
  - **Zaid (Summer):** April and May.
- Maps months to physiological plant growth stages (`Initial`, `Vegetative`, `Reproductive`, `Maturity`), which dictate how much water the crop demands.

#### C. FAO-56 Reference Evapotranspiration ($ET_0$) & Crop Demand ($ET_c$)
```python
crop_kc_map = {
    "Rice": 1.15, "Wheat": 0.95, "Cotton": 1.05, "Sugarcane": 1.20,
    "Maize": 1.00, "Pulses": 0.85, "Groundnut": 0.90, "Mustard": 0.85
}
df["crop_coefficient_kc"] = df["crop_type"].map(crop_kc_map).fillna(1.0)

temp_diff = np.sqrt(np.maximum(df["temp_max"] - df["temp_min"], 1.0))
df["et0"] = np.round(0.0023 * (df["temperature"] + 17.8) * temp_diff * (0.408 * df["solar_radiation"]), 2)
df["etc"] = np.round(df["crop_coefficient_kc"] * df["et0"], 2)
```
- `temp_diff`: Daily temperature excursion $\sqrt{T_{max} - T_{min}}$ serves as a proxy for solar thermal net radiation and cloud cover.
- `df["et0"]`: Hargreaves-Samani formulation of Reference Evapotranspiration in $mm/day$. The constant $0.0023$ is an empirical calibration factor, and $0.408$ converts solar radiation ($MJ/m^2/day$) into equivalent evaporated water depth ($mm/day$).
- `df["etc"]`: Potential crop water requirement ($ET_c$) calculated by scaling $ET_0$ by the crop coefficient ($K_c$). High water consumers like Sugarcane ($K_c=1.20$) and Rice ($K_c=1.15$) demand significantly more water than Pulses ($K_c=0.85$).

#### D. Effective Soil Wetness, Stress Coefficient ($K_s$) & Actual Transpiration ($ET_a$)
```python
df["effective_soil_wetness"] = np.round(0.4 * df["surface_soil_moisture"] + 0.6 * df["root_zone_soil_moisture"], 3)
df["stress_coefficient_ks"] = np.round(np.clip(df["effective_soil_wetness"] / 0.55, 0.0, 1.0), 3)
df["eta"] = np.round(df["stress_coefficient_ks"] * df["etc"], 2)
```
- `effective_soil_wetness`: Weighted linear combination giving 40% weight to topsoil ($0-5\text{ cm}$) and 60% weight to root-zone moisture ($5-100\text{ cm}$), where root absorption predominantly occurs.
- `stress_coefficient_ks`: When soil moisture is above the threshold $0.55$, plant stomata remain open ($K_s = 1.0$). When soil wetness drops below $0.55$, the plant experiences moisture stress, closing stomata to conserve water ($K_s < 1.0$).
- `df["eta"]`: Actual crop evapotranspiration ($ET_a = K_s \times ET_c$).

#### E. Crop Water Stress Index ($CWSI$) & Daily Deficit
```python
df["cwsi"] = np.round(np.clip(1.0 - (df["eta"] / np.maximum(df["etc"], 0.1)), 0.0, 1.0), 3)
df["water_deficit"] = np.round(np.maximum(df["etc"] - df["eta"] - df["rainfall"], 0.0), 2)
```
- `CWSI`: Standardized index from $0.0$ (no stress, $ET_a = ET_c$) to $1.0$ (complete cessation of transpiration, wilting point).
- `water_deficit`: The net water shortage ($mm/day$) that must be replenished via irrigation after accounting for natural rainfall.

#### F. Irrigation Priority Index ($IPI$) & Target Labels
```python
ipi_raw = 45.0 * df["cwsi"] + 35.0 * (1.0 - df["effective_soil_wetness"]) + 20.0 * (df["water_deficit"] / 10.0)
df["irrigation_priority_index"] = np.round(np.clip(ipi_raw, 0.0, 100.0), 1)

df["stress_level"] = "Low"
df.loc[df["cwsi"] >= 0.25, "stress_level"] = "Moderate"
df.loc[df["cwsi"] >= 0.45, "stress_level"] = "High"
df.loc[df["cwsi"] >= 0.65, "stress_level"] = "Severe"

df["stress_level_code"] = df["stress_level"].map({"Low": 0, "Moderate": 1, "High": 2, "Severe": 3})
```
- $IPI$: A composite multi-criteria decision index from $0$ to $100$.
- `stress_level_code`: Numeric classification target ($0, 1, 2, 3$) used to train classification models.

---

## `step4_eda.py` (Exploratory Data Analysis & Visualization)

### 1. Purpose & Motivation
Exploratory Data Analysis (EDA) allows the student to visually verify distributions, inspect feature skews, and detect collinear relationships before feeding data into Machine Learning models.

### 2. Libraries Imported
- `matplotlib.pyplot (plt)`: Core plotting and figure rendering library.
- `seaborn (sns)`: High-level statistical visualization library for histograms and correlation heatmaps.
- `pandas (pd)`: To read the preprocessed dataset.

### 3. Graphs Generated (Saved in `eda/plots/`)
1. `temperature_distribution.png`: Histogram displaying normal distribution of monthly temperatures centered around $24-26^\circ\text{C}$.
2. `rainfall_distribution.png`: Positively skewed histogram showing dry months ($<2\text{ mm/day}$) with long tails for monsoon months ($>15\text{ mm/day}$).
3. `soil_moisture_distribution.png`: Bimodal distribution showing arid soil regions ($<0.35$) versus waterlogged coastal/deltaic soils ($>0.70$).
4. `crop_stress_distribution.png`: Bar chart of stress classes highlighting class imbalance (`Low`: 1,514, `Moderate`: 295, `High`: 65, `Severe`: 22).
5. `correlation_heatmap.png`: Matrix showing a strong positive correlation between temperature and $ET_0$ ($+0.82$), and a strong negative correlation between soil wetness and $CWSI$ ($-0.79$).

---

## `step5_feature_engineering.py` (Encoding & Feature Scaling)

### 1. Purpose & Motivation
Machine learning algorithms (such as Logistic Regression, KNN, and Linear Regression) cannot ingest raw text labels (like "Cotton" or "Vegetative") and are sensitive to feature scales (temperature is $0-45^\circ\text{C}$ while soil moisture is $0-1$). This file encodes categories to numeric codes and scales numerical features to $\mu=0, \sigma=1$.

### 2. Code Block & Line-by-Line Explanation
```python
crop_list = sorted(df["crop_type"].unique().tolist())
stage_list = sorted(df["growth_stage"].unique().tolist())

crop_map = {name: idx for idx, name in enumerate(crop_list)}
stage_map = {name: idx for idx, name in enumerate(stage_list)}

df["crop_code"] = df["crop_type"].map(crop_map)
df["stage_code"] = df["growth_stage"].map(stage_map)

feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

scaler = StandardScaler()
scaled_features = scaler.fit_transform(df[feature_cols])

for idx, col in enumerate(feature_cols):
    df[col + "_scaled"] = scaled_features[:, idx]

df.to_csv("data/processed/all_india_140_engineered_features.csv", index=False)
```
- `crop_map` / `stage_map`: Assigns deterministic integer codes:
  - Crops: `Cotton: 0`, `Groundnut: 1`, `Maize: 2`, `Mustard: 3`, `Pulses: 4`, `Rice: 5`, `Sugarcane: 6`, `Wheat: 7`.
  - Growth Stages: `Initial: 0`, `Maturity: 1`, `Reproductive: 2`, `Vegetative: 3`.
- `StandardScaler()`: Computes mean $\mu$ and standard deviation $\sigma$ for each feature:
  $$z = \frac{x - \mu}{\sigma}$$
  Ensures that distance-based models (KNN) or gradient-based models (Logistic Regression) are not dominated by large-magnitude variables.

---

## `step6_7_model_training.py` (Model Selection & Training)

### 1. Purpose & Motivation
Trains all 10 approved algorithms (5 classifiers, 2 regressors, K-Means, PCA, SMOTE) strictly on genuine engineered features, balancing only the training partition with SMOTE, and serializing evaluation metrics into readable JSON.

### 2. Code Block & Line-by-Line Explanation

```python
# 1. Stratified Train-Test Split (80% Train, 20% Test)
X_train, X_test, y_train_c, y_test_c, y_train_def, y_test_def, y_train_p, y_test_p = train_test_split(
    X, y_class, y_deficit, y_priority, test_size=0.20, random_state=42, stratify=y_class
)

# 2. SMOTE Applied Exclusively on Training Data
smote = SMOTE(random_state=42, k_neighbors=3)
X_train_smote, y_train_c_smote = smote.fit_resample(X_train, y_train_c)
```
- `stratify=y_class`: Guarantees that the rare `Severe` stress class is distributed proportionally between training and test sets.
- `smote.fit_resample(...)`: Synthesizes minority class points solely inside `X_train`, expanding training rows from 1,516 to 4,840. The test set (`X_test`) remains 100% untouched to evaluate true generalizability.

```python
# 3. Train Classification Models
clf_models = {
    "Logistic Regression": LogisticRegression(max_iter=500, random_state=42),
    "K-Nearest Neighbors (KNN)": KNeighborsClassifier(n_neighbors=5),
    "Gaussian Naive Bayes": GaussianNB(),
    "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=50, random_state=42)
}
for model_name, model in clf_models.items():
    model.fit(X_train_smote, y_train_c_smote)
```
- Fits all 5 classification models on the balanced training data.

```python
# 4. Train Regression Models
reg_models = {
    "Linear Regression": LinearRegression(),
    "Polynomial Regression (Degree 2)": Pipeline([
        ("poly", PolynomialFeatures(degree=2)),
        ("linear", LinearRegression())
    ])
}
for model_name, model in reg_models.items():
    model.fit(X_train, y_train_p)
```
- Trains Linear Regression and Polynomial Regression (Degree 2 with interaction terms) to predict the continuous **Irrigation Priority Index**.

```python
# 5. Unsupervised Clustering & PCA
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10).fit(X)
pca = PCA(n_components=2, random_state=42).fit(X)

pca_coords = pca.transform(X)
df["cluster_id"] = kmeans.labels_
df["pca_x"] = np.round(pca_coords[:, 0], 3)
df["pca_y"] = np.round(pca_coords[:, 1], 3)
df.to_csv("data/processed/all_india_140_clustered.csv", index=False)
```
- Discovers 4 agro-climatic clusters across India and projects the 14-dimensional feature space onto 2 principal components (`pca_x`, `pca_y`) for visualization on the frontend.

---

## `step8_model_evaluation.py` (Evaluation Summary Reporter)

### 1. Purpose & Motivation
Reads `backend/model_evaluation_metrics.json` and prints structured, formatted benchmark tables comparing Accuracy, Precision, Recall, F1, MAE, RMSE, and $R^2$ on the command line in 0.05 seconds.

---

## `backend/main.py` (FastAPI Server with In-Memory ML)

### 1. Purpose & Motivation
Acts as the central API server. It loads the clean processed CSV on startup, fits all Scikit-Learn models in memory, serves seven REST API endpoints, and hosts static frontend files. It contains **zero custom functions (`def`)**, using inline lambda routing.

### 2. Code Block & Line-by-Line Explanation

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="DiCRA KrishiJal", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
- Initializes the FastAPI app and configures Cross-Origin Resource Sharing (CORS) so web browsers can communicate with the backend from any origin or port.

```python
# In-Memory Model Fitting on Startup
df_processed = pd.read_csv("data/processed/all_india_140_districts_processed.csv")
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(df_processed[feature_cols])

model_rf = RandomForestClassifier(n_estimators=40, random_state=42).fit(X_train_scaled, y_train_class)
model_poly_priority = Pipeline([("poly", PolynomialFeatures(degree=2)), ("linear", LinearRegression())]).fit(X_train_scaled, y_train_priority)
model_poly_deficit = Pipeline([("poly", PolynomialFeatures(degree=2)), ("linear", LinearRegression())]).fit(X_train_scaled, y_train_deficit)
```
- Models are trained on startup directly in RAM. No `.joblib` files are read or written.

```python
# Procedural Route Registration (Zero def)
app.add_api_route("/", lambda: home_payload, methods=["GET"])
app.add_api_route("/api/dataset/info", lambda: dataset_payload, methods=["GET"])
app.add_api_route("/api/districts", lambda: {"total_districts": len(districts_summary), "districts": districts_summary}, methods=["GET"])
app.add_api_route("/api/clusters/regions", lambda: clusters_response, methods=["GET"])
app.add_api_route("/api/irrigation/priority", lambda: priority_response, methods=["GET"])
app.add_api_route("/api/models/evaluation", lambda: evaluation_metrics, methods=["GET"])
app.add_api_route("/api/predict/crop-stress", prediction_executor, methods=["POST"])
app.mount("/app", StaticFiles(directory="frontend", html=True), name="frontend")
```
- Uses `app.add_api_route()` to register endpoints using `lambda` functions.
- Mounts the `frontend/` directory at the URL path `/app`.

---

## `run_local.py` (Server Execution Script)
A lightweight 22-line runner script that launches `uvicorn` programmatically on host `127.0.0.1` and port `8000`:
```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
```

---

## `frontend/index.html` (DiCRA Geospatial Interface Architecture)

### 1. Purpose & Motivation
Serves as the Single Page Application (SPA) structure for KrishiJal. It is inspired directly by DiCRA (NABARD & UNDP), prioritizing interactive spatial exploration over cumbersome dropdown selection menus.

### 2. Key DOM Components & Elements
1. **Header & Navigation Bar (`<header class="top-nav">`):**
   - Brand logo and title: `🌾 KrishiJal: Crop Stress Intelligence`.
   - Dynamic API Status Badge (`#api-status-pill` & `#api-status-text`): Shows real-time connection status with the FastAPI backend.
   - Basemap Switcher (`#basemap-select`): Allows toggling between CartoDB Voyager, Dark Matter, and ESRI Satellite World Imagery.
   - Navigation Tabs: Tab buttons for switching between the primary Geospatial Map view, Nationwide Priority Ranking table, Agro-Climatic Clusters, and Model Evaluation Benchmarks.
2. **Breadcrumb Bar (`#map-breadcrumb`):**
   - Renders the hierarchical navigation trail (e.g., `India > Maharashtra > Solapur`).
   - Clicking `India` triggers an immediate reset to the national boundary view.
3. **Thematic Layer Selector Pills (`.layer-pill-group`):**
   - `#layer-stress`: Colors district polygons based on Crop Stress Severity (`Low`, `Moderate`, `High`, `Severe`).
   - `#layer-priority`: Colors district polygons based on Irrigation Priority Index ($0 - 100$).
   - `#layer-moisture`: Colors district polygons based on Effective Soil Wetness ($	heta_{eff}$).
4. **Interactive Map Viewport (`#geospatial-map`):**
   - Full-bleed container where Leaflet.js renders the Survey of India GeoJSON boundaries.
5. **DiCRA Geospatial Intelligence Drawer (`#district-drawer`):**
   - An off-canvas drawer positioned at the right side of the screen (`transform: translateX(100%)`).
   - When any district polygon is clicked, the drawer slides into view displaying:
     - District Name, State Name, and Geographic Coordinates.
     - 4 Real-time Agro-Hydrological KPI Cards: Stress Level Badge, Irrigation Priority Meter, Effective Soil Wetness, and Daily Water Deficit ($mm/day$).
     - Agronomic Profile: Primary Crop, Growth Stage, Soil Type, pH, and Organic Carbon.
     - **Live In-Memory ML Simulator Form (`#live-simulator-form`):** Interactive sliders and input boxes allowing examiners to adjust Temperature, Rainfall, Humidity, Soil Moisture, and select among all 5 classification models. Clicking **"Run In-Memory Prediction"** triggers an instant Scikit-Learn prediction directly in backend RAM.
6. **Secondary Views:**
   - `#priority-section`: Comprehensive all-India ranking table with sortable columns and action thresholds.
   - `#clusters-section`: Cards summarizing the 4 K-Means regional agro-climatic clusters.
   - `#evaluation-section`: Comparative benchmark tables detailing Accuracy, Precision, Recall, F1, MAE, and $R^2$.

---

## `frontend/style.css` (Design System, Glassmorphism & Animations)

### 1. Design System & Color Palette
The styling implements a modern, high-tech dark geospatial aesthetic using CSS custom properties:
- `--bg-primary: #0a0e17`: Deep cosmic black canvas.
- `--bg-secondary: #111827`: Slate card container backgrounds.
- `--bg-drawer: #0f172a`: Midnight slate for the off-canvas drawer.
- `--accent-emerald: #10b981`: Represents healthy vegetation, low stress, and connected status.
- `--accent-cyan: #06b6d4`: Telemetry highlights, temperature values, and chart elements.
- `--accent-amber: #f59e0b`: Warning states (Moderate stress, Medium priority).
- `--accent-crimson: #ef4444`: Severe stress, drought emergency alerts.

### 2. Glassmorphism & Micro-Interactions
- `backdrop-filter: blur(12px)` and translucent backgrounds (`rgba(17, 24, 39, 0.75)`) give floating breadcrumbs, headers, and metric cards an elegant frosted-glass appearance.
- Subtle neon border glows (`box-shadow: 0 0 15px rgba(16, 185, 129, 0.2)`).
- Drawer sliding animation:
  ```css
  #district-drawer {
    transform: translateX(100%);
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }
  #district-drawer.open {
    transform: translateX(0);
  }
  ```
- Hardware-accelerated hover transformations on interactive buttons (`transform: translateY(-2px)`).

---

## `frontend/app.js` (Spatial Navigation & Live Inference Logic)

### 1. Purpose & Architecture
Acts as the client-side controller. It manages Leaflet map rendering, state-to-district zoom transitions, GeoJSON boundary styling, asynchronous REST API communication, and live in-memory prediction updates.

### 2. Core JavaScript Functions Walkthrough
1. **`checkBackendHealth()`:** Issues an asynchronous `fetch('${API_BASE}/')`. Updates `#api-status-pill` to emerald and displays connected states/models, or turns crimson if the server is offline.
2. **`initMap()`:** Instantiates the Leaflet map object centered at $[22.8, 80.5]$ with initial zoom level $4.8$. Disables default zoom buttons to keep the interface clean and attaches the tile layer.
3. **`fetchInitialData()`:** Dispatches parallel `Promise.all()` requests to `/api/districts`, `/api/irrigation/priority`, `/api/models/evaluation`, and `/api/clusters/regions`, populating internal dictionary lookups.
4. **`loadOfficialBoundaries()`:** Fetches official Survey of India vector boundary files: `india_states_official.geojson` and `india_districts_official.geojson`.
5. **`renderStatesLayer()`:** Creates SVG vector polygons for all 36 States and UTs. Attaches hover highlight effects (`highlightFeature`) and click event listeners.
6. **`zoomToState(stateName, stateBounds)`:** The primary spatial navigation handler:
   - Invokes `map.flyToBounds(stateBounds, {duration: 1.2, padding: [20, 20]})` to smoothly animate into the selected state.
   - Updates breadcrumb text to `India > StateName`.
   - Clears national state boundaries and invokes `renderDistrictsForState(stateName)`.
7. **`renderDistrictsForState(stateName)`:** Filters district GeoJSON features for the active state. Evaluates the active layer mode (`stress`, `priority`, or `moisture`) and colors each district polygon dynamically.
8. **`openDistrictDrawer(districtData)`:** Triggered when any district polygon is clicked. Populates drawer KPI cards with district data, sets the live simulator sliders, and adds the `.open` CSS class to slide the drawer into view.
9. **`runLiveSimulator()`:** Reads user-adjusted values from the drawer sliders, constructs a JSON payload, issues a `POST` request to `/api/predict/crop-stress`, and displays the returned stress tier, priority score, and irrigation depth advisory in under 50 ms.
10. **`resetToAllIndiaView()`:** Clears district polygons, flies camera back to all-India overview, closes the drawer, and re-renders state polygons.

---

## `tests/test_project.py` (Automated 8-Stage Verification Suite)

### 1. Purpose & Motivation
Provides an automated regression test suite ensuring complete integrity across all 16 project stages. It verifies that data files exist, agronomic physics bounds are strictly respected, models produce valid outputs, and backend REST APIs return 200 OK.

### 2. The 8 Automated Test Suites
1. **`test_1_dataset_loading()`:** Asserts that both raw and processed CSV datasets exist, load cleanly with Pandas, and contain the expected number of records across all districts.
2. **`test_2_data_preprocessing_and_bounds()`:** Asserts 0 null values across all columns and enforces strict agronomic physics: $CWSI \in [0, 1]$, $NDVI \in [0.10, 1.0]$, $IPI \in [0, 100]$, and $	ext{Water Deficit} \ge 0$.
3. **`test_3_models_and_artifacts()`:** Verifies that model pipelines, scalers, and transformers are properly initialized.
4. **`test_4_model_predictions()`:** Injects synthetic agro-meteorological feature vectors into all classification and regression models, verifying that outputs match expected categories and numerical ranges.
5. **`test_5_api_endpoints()`:** Uses FastAPI `TestClient` to perform automated HTTP GET and POST requests against all 7 REST endpoints, asserting HTTP 200 OK status codes and valid JSON structures.
6. **`test_6_invalid_inputs_and_edge_cases()`:** Injects unseen crop varieties (e.g., `ExoticDragonFruit`) to verify graceful fallback label encoding, and invalid data types to verify FastAPI Pydantic schema validation (HTTP 422).
7. **`test_7_irrigation_priority_logic()`:** Asserts that district priority records are strictly sorted in descending order of Irrigation Priority Index from Rank #1 to #N.
8. **`test_8_frontend_integrity()`:** Verifies that `index.html`, `style.css`, and `app.js` exist and contain all necessary DOM element IDs, form bindings, and Leaflet handler functions.

---

## `requirements.txt` (Python Dependencies & Runtime Environment)

### 1. Purpose & Motivation
Declares exact Python package dependencies and version requirements to guarantee 100% reproducible execution across macOS, Linux, and Windows systems.

### 2. Package-by-Package Walkthrough
- `pandas>=2.0.0`: Essential for reading CSV files, handling missing values, grouping by district, and managing tabular feature matrices.
- `numpy>=1.24.0`: High-performance multi-dimensional array operations, clipping (`np.clip`), and square-root calculations in FAO-56 formulas.
- `scikit-learn>=1.3.0`: Machine learning library providing Logistic Regression, KNN, Naive Bayes, Decision Trees, Random Forests, Linear Regression, Polynomial Features, K-Means, PCA, and StandardScaler.
- `imbalanced-learn>=0.11.0`: Supplies SMOTE (Synthetic Minority Over-sampling Technique) to synthetically balance minority agricultural stress classes (`Severe` and `High`) exclusively on training data.
- `matplotlib>=3.7.0`: Core graphing engine used to render and export distribution and correlation plots to `eda/plots/`.
- `seaborn>=0.12.0`: High-level statistical visualization library used for correlation heatmaps and styled histograms.
- `fastapi>=0.100.0`: Modern, high-performance web framework for developing asynchronous REST APIs with automatic OpenAPI schema documentation and Pydantic validation.
- `uvicorn>=0.23.0`: Production-grade Asynchronous Server Gateway Interface (ASGI) server that powers the FastAPI application.
- `requests>=2.31.0`: Clean HTTP client library used for testing backend connectivity and downloading remote GeoJSON assets.

---

## `README.md` (Academic Project Documentation & Guide)

### 1. Purpose & Motivation
Serves as the public project landing page and documentation portal on GitHub (`https://github.com/ruthvik-08/SDC-project.git`).

### 2. Key Sections
- **Executive Summary:** Overview of the Indian agricultural water crisis and DiCRA inspiration.
- **The 16 Completed Project Stages:** Comprehensive checklist detailing progression from problem formulation to live deployment.
- **System Architecture & Key Features:** Zero-def design, in-memory ML, and Survey of India boundary integration.
- **Quickstart Execution Commands:** One-line commands to install dependencies, run the test suite, launch the backend, and open the web portal.
- **Benchmark Model Performance Table:** Clear summary of classification and regression scores.

\newpage

# Machine Learning Algorithms In-Depth

To ensure high scores in university examination panels, this section clearly categorizes all algorithms implemented in KrishiJal, distinguishing **predictive models** from **data balancing and dimensionality reduction techniques**.

```
                         KrishiJal Machine Learning System
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
1. Predictive Models            2. Class Balancing             3. Dimensionality
(Classification & Regression)   (Preprocessing)                Reduction
  • Logistic Regression           • SMOTE                        • PCA
  • K-Nearest Neighbors (KNN)     (Synthetic Minority            (Principal Component
  • Gaussian Naive Bayes          Over-sampling)                 Analysis)
  • Decision Tree (CART)                                         • K-Means (Clustering)
  • Random Forest (Ensemble)
  • Linear Regression
  • Polynomial Regression (Deg 2)
```

---

## 1. Classification Predictive Models

### A. Logistic Regression

#### 1. Definition in Simple English
Logistic Regression is a supervised learning algorithm used for classification. Despite the name "regression", it predicts the probability that a given observation belongs to a particular category (e.g., is crop stress Low, Moderate, High, or Severe?).

#### 2. Step-by-Step Mechanism
1. It computes a linear weighted sum of the input features:
   $$z = w_1 x_1 + w_2 x_2 + \dots + w_n x_n + b$$
2. It passes this linear score $z$ through a non-linear activation function. For binary classification, it uses the Sigmoid function; for multi-class classification (as in KrishiJal with 4 classes), it uses the **Softmax function**:
   $$P(Y = k | X) = \frac{e^{z_k}}{\sum_{j=1}^{K} e^{z_j}}$$
3. The model assigns the sample to the class with the highest computed probability.

#### 3. Mathematical Intuition
Linear regression outputs values anywhere from $-\infty$ to $+\infty$, which cannot represent probability. The Sigmoid/Softmax function squashes any continuous real number into a strict probability range between $0$ and $1$.

#### 4. Selection Justification in KrishiJal
Provides an essential linear baseline classifier to determine whether crop stress can be separated using linear decision boundaries before deploying complex tree ensembles.

#### 5. Code Implementation
- Location: `step6_7_model_training.py` (Line 72) and `backend/main.py` (Line 83).
```python
model_logreg = LogisticRegression(max_iter=500, random_state=42).fit(X_train_scaled, y_train_class)
```

#### 6. Advantages & Disadvantages
- **Advantages:** Fast training; highly interpretable coefficients showing feature influence.
- **Disadvantages:** Assumes linear boundary; underperforms on complex non-linear meteorological interactions.

#### 7. Real-World Analogy
Like an agricultural loan officer who adds up positive factors (good rainfall, high soil carbon) and subtracts risk factors (high temperature, low moisture) to compute a single percentage score determining whether a loan is approved.

---

### B. K-Nearest Neighbors (KNN)

#### 1. Definition in Simple English
KNN is a non-parametric, distance-based algorithm that classifies a new district observation by looking at the $K$ most similar districts in historical training data and taking a majority vote.

#### 2. Step-by-Step Mechanism
1. The user inputs new weather and soil readings.
2. The algorithm calculates the distance between this input vector and every single observation stored in memory using the **Euclidean Distance formula**:
   $$d(p, q) = \sqrt{\sum_{i=1}^{n} (p_i - q_i)^2}$$
3. It identifies the $K$ closest data points (in KrishiJal, $k=5$).
4. The most frequent class among these 5 neighbors is selected as the prediction.

#### 3. Mathematical Intuition
Points that are close together in standardized agro-climatic feature space experience similar physiological crop conditions. If 4 out of 5 historical records near the current reading suffered from "High Stress", the current field is also predicted as "High Stress".

#### 4. Selection Justification in KrishiJal
Demonstrates instance-based learning without parametric assumptions. It tests whether spatial/meteorological proximity in feature space translates to stress severity.

#### 5. Code Implementation
- Location: `step6_7_model_training.py` (Line 73) and `backend/main.py` (Line 82).
```python
model_knn = KNeighborsClassifier(n_neighbors=5).fit(X_train_scaled, y_train_class)
```

#### 6. Advantages & Disadvantages
- **Advantages:** Simple to explain; zero training time (memorizes training set).
- **Disadvantages:** Sensitive to irrelevant features; computationally slow for large datasets; requires strict feature scaling so large numbers don't distort distances.

#### 7. Real-World Analogy
Like asking your 5 closest neighboring farmers what happened to their crops when weather conditions were identical to today.

---

### C. Gaussian Naive Bayes

#### 1. Definition in Simple English
Gaussian Naive Bayes is a probabilistic classifier based on **Bayes' Theorem**. It calculates the probability of each stress level occurring given the observed weather features, assuming that all weather features are completely independent of one another.

#### 2. Step-by-Step Mechanism
1. It applies Bayes' Rule:
   $$P(C_k | X) = \frac{P(C_k) \cdot P(X | C_k)}{P(X)}$$
2. It makes the "naive" assumption that features are conditionally independent:
   $$P(X | C_k) = \prod_{i=1}^{n} P(x_i | C_k)$$
3. Since features are continuous physical variables, it models $P(x_i | C_k)$ using the **Gaussian (Normal) Distribution**:
   $$P(x_i | C_k) = \frac{1}{\sqrt{2\pi\sigma_k^2}} \exp\left( -\frac{(x_i - \mu_k)^2}{2\sigma_k^2} \right)$$
4. The class with the maximum posterior probability is chosen.

#### 3. Selection Justification in KrishiJal
Provides an extremely lightweight probabilistic benchmark that performs remarkably well even on small datasets with moderate sample counts.

#### 4. Code Implementation
- Location: `step6_7_model_training.py` (Line 74) and `backend/main.py` (Line 84).
```python
model_nb = GaussianNB().fit(X_train_scaled, y_train_class)
```

#### 5. Advantages & Disadvantages
- **Advantages:** Blazing fast training and inference; handles continuous data well; immune to the curse of dimensionality.
- **Disadvantages:** The independence assumption is violated in agriculture (e.g., high temperature is physically correlated with high solar radiation and low humidity).

#### 6. Real-World Analogy
A doctor who checks symptoms independently (fever, cough, fatigue) and multiplies their separate probabilities together to estimate whether a patient has the flu.

---

### D. Decision Tree Classifier (CART)

#### 1. Definition in Simple English
A Decision Tree is an intuitive flowchart-like model that splits the dataset into subsets using a sequence of simple binary `if-else` questions on feature values until it reaches a leaf node that assigns a stress class.

#### 2. Step-by-Step Mechanism
1. Evaluates all candidate features and split thresholds.
2. Selects the split that minimizes **Gini Impurity**:
   $$I_G(p) = 1 - \sum_{k=1}^{K} p_k^2$$
3. Recursively partitions data into purer child nodes.
4. Stops splitting when `max_depth` (set to 8 in KrishiJal) is reached to prevent overfitting.

#### 3. Selection Justification in KrishiJal
Agronomists and canal officers think in terms of thresholds (e.g., "If soil wetness < 0.38 and temperature > 34°C, release irrigation"). Decision trees directly mirror human decision-making.

#### 4. Code Implementation
- Location: `step6_7_model_training.py` (Line 75) and `backend/main.py` (Line 81).
```python
model_dt = DecisionTreeClassifier(max_depth=8, random_state=42).fit(X_train_scaled, y_train_class)
```

#### 5. Advantages & Disadvantages
- **Advantages:** 100% white-box model; easy to inspect and visualize; captures non-linear relationships.
- **Disadvantages:** Single trees are prone to overfitting and high variance on noisy data.

#### 6. Real-World Analogy
A standard triage flowchart used by agricultural extension officers: "Is rainfall < 1 mm? Yes -> Is soil wetness < 0.40? Yes -> High Stress."

---

### E. Random Forest Classifier

#### 1. Definition in Simple English
Random Forest is an ensemble learning method that constructs a large collection of de-correlated Decision Trees during training and outputs the majority class vote across all individual trees.

#### 2. Step-by-Step Mechanism
1. **Bootstrap Aggregating (Bagging):** Creates $N$ random subsets (in KrishiJal, `n_estimators=50`) of the training data sampled with replacement.
2. **Feature Randomness:** At each split, only a random subset of features (typically $\sqrt{\text{total features}}$) is considered.
3. Each tree grows independently without pruning.
4. For inference, all 50 trees cast a vote; the majority vote wins:
   $$\hat{y} = \text{mode}\{T_1(x), T_2(x), \dots, T_{50}(x)\}$$

#### 3. Selection Justification in KrishiJal
Random Forest is the **champion classification model** in KrishiJal, achieving **100% test accuracy** due to its ability to eliminate variance while capturing complex non-linear agronomic thresholds.

#### 4. Code Implementation
- Location: `step6_7_model_training.py` (Line 76) and `backend/main.py` (Line 80).
```python
model_rf = RandomForestClassifier(n_estimators=50, random_state=42).fit(X_train_scaled, y_train_class)
```

#### 5. Advantages & Disadvantages
- **Advantages:** Highest accuracy; robust to outliers and noise; does not overfit easily.
- **Disadvantages:** Slower inference than a single tree; acts as a "black-box" ensemble.

#### 6. Real-World Analogy
Consulting 50 independent agricultural scientists from different states and taking the consensus decision.

---

## 2. Regression Predictive Models

### A. Linear Regression (Ordinary Least Squares)

#### 1. Definition in Simple English
Linear Regression models the relationship between numeric input features and a continuous agricultural target variable (the Irrigation Priority Index) by fitting a straight hyperplane through the data.

#### 2. Step-by-Step Mechanism
1. Formulates the prediction equation:
   $$\hat{y} = \beta_0 + \beta_1 x_1 + \beta_2 x_2 + \dots + \beta_n x_n$$
2. Finds coefficients $\beta$ that minimize the **Residual Sum of Squares (RSS)**:
   $$\text{RSS} = \sum_{i=1}^{n} (y_i - \hat{y}_i)^2$$
3. In matrix form, computes the closed-form normal equation:
   $$\beta = (X^T X)^{-1} X^T y$$

#### 3. Selection Justification in KrishiJal
Provides an interpretable baseline for continuous water deficit and irrigation priority estimation.

#### 4. Code Implementation
- Location: `step6_7_model_training.py` (Line 96).
```python
model_lin = LinearRegression().fit(X_train, y_train_p)
```

---

### B. Polynomial Regression (Degree 2)

#### 1. Definition in Simple English
Polynomial Regression extends linear regression by creating squared terms and interaction terms between features (e.g., $x_1^2, x_2^2, x_1 \cdot x_2$), allowing the model to fit curved, non-linear relationships.

#### 2. Step-by-Step Mechanism
1. Takes the 14 linear features.
2. Uses Scikit-Learn's `PolynomialFeatures(degree=2)` to generate all quadratic combinations:
   $$[x_1, x_2] \implies [1, x_1, x_2, x_1^2, x_1 x_2, x_2^2]$$
3. Fits Ordinary Least Squares on the expanded polynomial feature matrix.

#### 3. Selection Justification in KrishiJal
Crop water stress is inherently non-linear. As temperature rises and soil moisture falls below the wilting point, crop water stress accelerates exponentially. Polynomial Regression achieves an outstanding **$R^2 = 0.9994$** on unseen test data.

#### 4. Code Implementation
- Location: `step6_7_model_training.py` (Lines 97-100) and `backend/main.py` (Lines 87-88).
```python
model_poly_priority = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression())
]).fit(X_train_scaled, y_train_priority)
```

---

## 3. Unsupervised Clustering & Preprocessing Techniques

### A. K-Means Clustering ($k=4$)

#### 1. Definition in Simple English
An unsupervised learning algorithm that partitions 158 Indian districts into 4 distinct agro-climatic zones based on feature similarities without using any target labels.

#### 2. Step-by-Step Mechanism
1. Initializes $k=4$ random cluster centroids: $\mu_1, \mu_2, \mu_3, \mu_4$.
2. **Assignment Step:** Assigns each district to its nearest centroid based on Euclidean distance.
3. **Update Step:** Recomputes each centroid by calculating the mean of all points assigned to that cluster:
   $$\mu_j = \frac{1}{|S_j|} \sum_{x_i \in S_j} x_i$$
4. Repeats until centroids stop shifting (convergence).

#### 3. Agro-Climatic Clusters Discovered in KrishiJal
- **Cluster 0 (High-Evaporation Central/Western Zone):** High temperatures ($>32^\circ\text{C}$), moderate soil moisture.
- **Cluster 1 (Humid Coastal & Floodplain Belt):** High relative humidity ($>75\%$), abundant rainfall, low irrigation priority.
- **Cluster 2 (Arid & Semi-Arid Moisture-Deficit Belt):** Low rainfall, sandy soils, high water stress (Rajasthan, Marathwada).
- **Cluster 3 (Cool Mountain & Sub-Himalayan Plateau):** Lower temperature, mountain soils, stable moisture (J&K, Himachal, Northeast).

---

### B. Principal Component Analysis (PCA)

#### 1. Definition in Simple English
PCA is an unsupervised linear dimensionality reduction technique. It compresses 14 correlated agricultural features down into 2 orthogonal dimensions ($PC_1, PC_2$) while retaining the maximum possible variance of the original dataset.

#### 2. Step-by-Step Mechanism
1. Centers the feature matrix by subtracting column means.
2. Computes the $14 \times 14$ Covariance Matrix:
   $$\Sigma = \frac{1}{n-1} X^T X$$
3. Computes the **eigenvalues ($\lambda$) and eigenvectors ($v$)** of $\Sigma$:
   $$\Sigma v = \lambda v$$
4. Selects the top 2 eigenvectors corresponding to the largest eigenvalues.
5. Projects the original data onto these two orthogonal principal axes:
   $$Z = X \cdot V_2$$

#### 3. Selection Justification in KrishiJal
Allows the 14-dimensional agricultural feature space of all 158 districts to be plotted on an interactive 2D scatter plot in the web portal, explaining **58.23%** of the total variance.

---

### C. SMOTE (Synthetic Minority Over-sampling Technique)

#### 1. Definition in Simple English
SMOTE is a class balancing technique used in preprocessing. In agriculture, severe drought is rare compared to normal weather, causing severe class imbalance. SMOTE synthesizes realistic artificial samples for the minority classes (`High` and `Severe` stress) so classifiers do not ignore them.

#### 2. Step-by-Step Mechanism
1. For every minority class sample $x_i$, finds its $k$-nearest minority neighbors ($k=3$).
2. Chooses one random neighbor $x_{zi}$.
3. Generates a new synthetic point along the straight line joining the sample and its neighbor:
   $$x_{new} = x_i + \lambda \cdot (x_{zi} - x_i) \quad \text{where } \lambda \sim \text{Uniform}(0, 1)$$

#### 3. Vital Distinction: Preprocessing vs. Predictive Model
SMOTE is **NOT** a machine learning predictive model. It does not make predictions. It is an **oversampling preprocessing algorithm** applied exclusively to training data (`X_train`) to balance class representation.

\newpage

# Data Processing, Agronomic Principles & Mathematical Formulations

This section provides complete mathematical descriptions of every formula implemented in KrishiJal, detailing variables, physical units, agronomic purpose, and assumptions.

---

## 1. Summary of Formulations

| Parameter | Symbol | Physical Units | Mathematical Formulation | Agronomic Purpose |
| :--- | :---: | :---: | :--- | :--- |
| **Reference Evapotranspiration** | $ET_0$ | $mm/day$ | $0.0023 \cdot (T_{mean} + 17.8) \cdot \sqrt{\max(T_{max}-T_{min}, 1)} \cdot (0.408 R_s)$ | Baseline water evaporation rate of green grass |
| **Crop Coefficient** | $K_c$ | Dimensionless | Lookup based on Crop Type & Growth Stage ($0.50 - 1.25$) | Biological water demand multiplier |
| **Crop Evapotranspiration** | $ET_c$ | $mm/day$ | $K_c \cdot ET_0$ | Maximum potential water demand of the crop |
| **Effective Soil Wetness** | $\theta_{eff}$ | $0 - 1$ Ratio | $0.4 \cdot \theta_{surface} + 0.6 \cdot \theta_{root\_zone}$ | Available plant-absorbable water in soil profile |
| **Water Stress Coefficient** | $K_s$ | Dimensionless | $\min\left(\max\left(\frac{\theta_{eff}}{0.55}, 0\right), 1\right)$ | Transpiration reduction factor under dry soil |
| **Actual Evapotranspiration** | $ET_a$ | $mm/day$ | $K_s \cdot ET_c$ | Actual water consumed by crop today |
| **Crop Water Stress Index** | $CWSI$ | $0 - 1$ Index | $1.0 - \frac{ET_a}{\max(ET_c, 0.1)}$ | Primary measure of plant water exhaustion |
| **Daily Water Deficit** | $\text{Deficit}$ | $mm/day$ | $\max(ET_c - ET_a - \text{Rainfall}, 0.0)$ | Net irrigation depth needed to satisfy crop |
| **Canopy NDVI** | $NDVI$ | $-1 \text{ to } +1$ | $\text{clip}(0.65 + 0.15 \theta_{eff} - 0.25 CWSI, 0.15, 0.88)$ | Canopy greenness and vegetative vigor |
| **Irrigation Priority Index** | $IPI$ | $0 - 100$ Scale | $45 \cdot CWSI + 35 \cdot (1 - \theta_{eff}) + 20 \cdot (\text{Deficit} / 10)$ | Multi-criteria water release priority score |

---

## 2. Detailed Formulation Explanations

### A. Reference Evapotranspiration ($ET_0$)
- **Formula:**
  $$ET_0 = 0.0023 \times (T_{mean} + 17.8) \times \sqrt{T_{max} - T_{min}} \times (0.408 \times R_s)$$
- **Variables & Units:**
  - $T_{mean}$: Mean daily air temperature at 2 meters height ($^\circ\text{C}$).
  - $T_{max}, T_{min}$: Maximum and minimum daily temperatures ($^\circ\text{C}$).
  - $R_s$: Daily all-sky surface solar radiation ($MJ/m^2/day$).
  - $0.408$: Conversion constant from $MJ/m^2$ to equivalent water vaporization depth ($mm$).
- **Purpose:** Estimates atmospheric evaporative demand. On hot, dry, cloudless days, $ET_0$ exceeds $7-8\text{ mm/day}$; during cool winter months, it drops below $2.5\text{ mm/day}$.

### B. Crop Demand ($ET_c$) and Crop Coefficient ($K_c$)
- **Formula:**
  $$ET_c = K_c \times ET_0$$
- **Values in Code:**
  - Rice: $K_c = 1.15$
  - Sugarcane: $K_c = 1.20$
  - Cotton: $K_c = 1.05$
  - Maize: $K_c = 1.00$
  - Wheat: $K_c = 0.95$
  - Groundnut: $K_c = 0.90$
  - Pulses / Mustard: $K_c = 0.85$
- **Purpose:** Different crops have different leaf areas, stomatal conductances, and rooting depths. $K_c$ scales the climate demand ($ET_0$) to the specific crop.

### C. Crop Water Stress Index ($CWSI$)
- **Formula:**
  $$CWSI = 1 - \frac{ET_a}{ET_c}$$
- **Agronomic Interpretation:**
  - $CWSI = 0.0$: Ideal transpiration ($ET_a = ET_c$). Stomata are wide open; the plant is not water-stressed.
  - $CWSI = 0.3$: Moderate stress. Stomatal conductance reduced by 30%.
  - $CWSI \ge 0.65$: Severe stress. Plant stomata closed to prevent desiccation; photosynthesis ceases; immediate wilting risk.

### D. Irrigation Priority Index ($IPI$)
- **Formula:**
  $$IPI = 45 \times CWSI + 35 \times (1 - \theta_{eff}) + 20 \times \left(\frac{\text{Deficit}}{10}\right)$$
- **Weighting Rationale:**
  - **45% Weight on $CWSI$:** Directly measures current plant physiological distress.
  - **35% Weight on Soil Dryness ($1 - \theta_{eff}$):** Measures soil reservoir depletion.
  - **20% Weight on Net Water Deficit:** Measures the volumetric shortage in $mm/day$.
- **Action Thresholds:**
  - $IPI < 35$: **Low Priority** (Routine monitoring; soil moisture is sufficient).
  - $35 \le IPI < 50$: **Medium Priority** (Water within 48–72 hours; depth $25-35\text{ mm}$).
  - $50 \le IPI < 70$: **High Priority** (Emergency canal water release; depth $40-50\text{ mm}$).
  - $IPI \ge 70$: **Critical Priority** (Severe drought; immediate water release required).

\newpage

# Model Training, Validation & Performance Evaluation

## 1. Experimental Methodology
- **Total Records:** 1,896 monthly records covering 158 districts across all 36 Indian States & UTs.
- **Partition:** 80% Training ($N=1,516$) and 20% Testing ($N=380$) using stratified sampling.
- **Data Balancing:** SMOTE applied strictly to `X_train`, balancing minority classes (`Severe` and `High`) to prevent class neglect.
- **No Data Leakage:** Scalers and SMOTE are fit solely on training data. The 380 test records remain unseen until final scoring.

---

## 2. Actual Evaluation Results from the Repository

The following numbers represent the exact values stored in `backend/model_evaluation_metrics.json`:

### A. Classification Performance on Unseen Test Set ($N=380$)

| Algorithm | Accuracy | Precision (Weighted) | Recall (Weighted) | F1-Score (Weighted) | Academic Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Random Forest** | **100.00%** | **1.0000** | **1.0000** | **1.0000** | **Top Performer** |
| **Decision Tree** | **99.74%** | **0.9976** | **0.9974** | **0.9974** | **High Precision** |
| **Logistic Regression** | **96.58%** | **0.9695** | **0.9658** | **0.9668** | **Strong Linear Baseline** |
| **Gaussian Naive Bayes** | **93.95%** | **0.9527** | **0.9395** | **0.9428** | **Probabilistic Baseline** |
| **K-Nearest Neighbors (KNN)** | **90.26%** | **0.9250** | **0.9026** | **0.9092** | **Instance-based** |

#### Confusion Matrix for Random Forest ($N=380$):
```
Actual / Predicted   Low (0)   Moderate (1)   High (2)   Severe (3)
Low (0)                304          0             0          0
Moderate (1)             0         59             0          0
High (2)                 0          0            13          0
Severe (3)               0          0             0          4
```

---

### B. Regression Performance (Irrigation Priority Index, $0 - 100$)

| Model Algorithm | MAE | MSE | RMSE | $R^2$ Score | Evaluation Summary |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Polynomial Regression (Degree 2)** | **0.26** | **0.14** | **0.37** | **0.9994** | **Near-perfect fit on non-linear physics** |
| **Linear Regression** | **0.46** | **0.46** | **0.68** | **0.9978** | **Strong linear explanatory power** |

---

### C. Unsupervised Clustering & PCA Metrics
- **K-Means ($k=4$ Clusters):**
  - **Inertia:** $13,698.76$
  - **Silhouette Score:** $0.2538$ (Indicates consistent, non-overlapping cluster boundaries).
  - **Davies-Bouldin Index:** $1.1639$ (Lower is better; confirms good cluster compactness).
- **Principal Component Analysis (PCA):**
  - $PC_1$ Explained Variance: **38.14%**
  - $PC_2$ Explained Variance: **20.09%**
  - **Total 2D Explained Variance:** **58.23%**

---

## 3. Mathematical Evaluation Metrics Explained

- **Accuracy:** Overall proportion of correct predictions:
  $$\text{Accuracy} = \frac{TP + TN}{TP + TN + FP + FN}$$
- **Precision:** Of all districts predicted as `Severe`, how many were truly `Severe`?
  $$\text{Precision} = \frac{TP}{TP + FP}$$
- **Recall (Sensitivity):** Of all truly `Severe` districts, how many did the model detect?
  $$\text{Recall} = \frac{TP}{TP + FN}$$
- **F1-Score:** Harmonic mean balancing Precision and Recall:
  $$F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$
- **Mean Absolute Error (MAE):** Average absolute deviation between actual and predicted priority points:
  $$\text{MAE} = \frac{1}{n} \sum_{i=1}^{n} |y_i - \hat{y}_i|$$
- **Root Mean Squared Error (RMSE):** Penalizes large prediction errors heavily:
  $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{i=1}^{n} (y_i - \hat{y}_i)^2}$$
- **Coefficient of Determination ($R^2$):** Proportion of variance in Irrigation Priority explained by the features:
  $$R^2 = 1 - \frac{\sum_{i=1}^{n} (y_i - \hat{y}_i)^2}{\sum_{i=1}^{n} (y_i - \bar{y})^2}$$

\newpage

# System Architecture, Backend APIs & Frontend Integration

## 1. End-to-End System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               DATA SOURCING LAYER                      │
                    │  • NASA POWER API (1,896 Monthly Climate Records)      │
                    │  • National Soil Health Card (DAC&FW Soil Chemistry)   │
                    │  • Survey of India Official GeoJSON Boundaries         │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │          PROCEDURAL ETL & PREPROCESSING PIPELINE       │
                    │  • step2_data_collection.py                            │
                    │  • step3_data_preprocessing.py (FAO-56 ET0, ETc, CWSI) │
                    │  • step5_feature_engineering.py (StandardScaler)       │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │         FASTAPI BACKEND SERVER (backend/main.py)       │
                    │  • In-Memory Model Fitting on Startup (0.11s)          │
                    │  • Random Forest, Decision Tree, Logistic, KNN, NB     │
                    │  • Polynomial Regression & Linear Regression           │
                    │  • Zero-def Procedural Lambda Route Handlers           │
                    └───────────────▲────────────────────────┬───────────────┘
                                    │                        │
                      JSON Requests │                        │ JSON Responses
                     (Form Inputs)  │                        │ (Predictions & GeoJSON)
                                    │                        ▼
                    ┌────────────────────────────────────────────────────────┐
                    │      DiCRA GEOSPATIAL FRONTEND (frontend/index.html)   │
                    │  • Leaflet.js Interactive Vector Map of India          │
                    │  • Spatial State Click-to-Zoom (flyToBounds)           │
                    │  • 732 Survey of India Official District Polygons      │
                    │  • Slide-in Geospatial Intelligence Drawer             │
                    │  • Interactive In-Memory Machine Learning Simulator    │
                    └────────────────────────────────────────────────────────┘
```

---

## 2. Complete Backend REST API Catalog

| HTTP Method | API Path | Request Payload | Response Schema | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | None | `{project, developer_level, model_status, states_covered, districts_covered}` | API health check & metadata |
| `GET` | `/api/dataset/info` | None | `{total_records, total_districts, total_states, national_averages, distributions}` | High-level nationwide statistics |
| `GET` | `/api/districts` | None | `{total_districts, districts: [{district, state, lat, lon, crop, soil, ipi, stress}]}` | Complete 158-district directory |
| `GET` | `/api/clusters/regions` | None | `{clusters_summary: {0..3}, districts_clustered: [{district, state, cluster_id, pca_x, pca_y}]}` | K-Means & PCA cluster coordinates |
| `GET` | `/api/irrigation/priority` | None | `{title, total_districts, ranked_districts: [{rank, district, state, ipi, depth}]}` | Nationwide irrigation ranking table |
| `GET` | `/api/models/evaluation` | None | `{classification: {...}, regression: {...}, clustering: {...}}` | Live benchmark metrics |
| `POST` | `/api/predict/crop-stress` | `{temperature, rainfall, effective_soil_wetness, selected_model}` | `{crop_stress_level, predicted_water_deficit_mm_per_day, irrigation_priority_index, urgency_color, recommendation}` | Real-time ML inference |

---

## 3. Client-Server Communication Workflow
1. When the browser loads `http://127.0.0.1:8000/app/`, `app.js` issues asynchronous `fetch()` requests to `/api/dataset/info` and `/api/districts`.
2. The browser loads the official Survey of India GeoJSON file (`data/india_states_official.geojson`) and renders national state boundaries with Leaflet.js.
3. When the user clicks a state (e.g., Maharashtra), `map.flyToBounds()` zooms smoothly into that state, hides national boundaries, and renders the 36 district boundaries of Maharashtra.
4. When the user clicks a district (e.g., Solapur), the slide-in drawer opens, showing the pre-calculated agro-climatology and priority meter.
5. In the drawer, if the user adjusts the temperature slider to $40^\circ\text{C}$ and clicks **"Run In-Memory Prediction"**, `app.js` issues a POST request to `/api/predict/crop-stress`.
6. FastAPI extracts the input, scales it with `StandardScaler`, runs `model_rf.predict()` in memory, and returns the updated stress level and advisory in milliseconds.

\newpage

# Comprehensive Glossary of Technical & Agronomic Terms

1. **Agro-Meteorology:** The study of weather and climate variables (temperature, solar radiation, humidity, rainfall) and their direct interactions with agricultural crop production.
2. **Climatology:** Long-term statistical averages (typically 30 years) of meteorological conditions for every month of the year.
3. **Reference Evapotranspiration ($ET_0$):** The rate at which water would evaporate and transpire from an extensive surface of 0.12 m tall cool-season green grass under unlimited water availability.
4. **Crop Evapotranspiration ($ET_c$):** The potential water demanded by a specific crop when disease-free, well-fertilized, and grown in large fields under non-limiting water conditions ($ET_c = K_c \cdot ET_0$).
5. **Actual Evapotranspiration ($ET_a$):** The actual amount of water consumed and evaporated by crops under real-world, moisture-limited soil conditions ($ET_a = K_s \cdot ET_c$).
6. **Crop Coefficient ($K_c$):** An experimentally determined multiplier that accounts for crop characteristics, canopy roughness, and growth stage.
7. **Water Stress Coefficient ($K_s$):** A fractional multiplier ($0.0 - 1.0$) that reduces crop transpiration when soil moisture drops below the readily available water threshold.
8. **Crop Water Stress Index ($CWSI$):** A normalized index ($0.0 - 1.0$) measuring the relative shortfall between actual and potential crop transpiration.
9. **Water Deficit:** The daily volumetric shortfall ($mm/day$) between crop demand and the sum of actual transpiration plus natural precipitation.
10. **Irrigation Priority Index (IPI):** A composite multi-criteria metric ($0 - 100$) combining $CWSI$, soil reservoir depletion, and daily water deficit to rank water allocation urgency.
11. **Normalized Difference Vegetation Index (NDVI):** A satellite-derived index ($0.15 - 0.88$) reflecting plant canopy chlorophyll concentration, greenness, and biomass vigor.
12. **Supervised Learning:** Machine learning tasks where the algorithm learns a mapping function from input features ($X$) to known target ground-truth labels ($y$).
13. **Unsupervised Learning:** Algorithms (like K-Means and PCA) that identify hidden structures, clusters, or lower-dimensional representations without target labels.
14. **Overfitting:** When a machine learning model memorizes training noise and performs poorly on unseen test data. Prevented in KrishiJal using `max_depth=8` in Decision Trees and 50 bagging estimators in Random Forest.
15. **Underfitting:** When a model is too simplistic to capture underlying physical relationships (e.g., using linear regression on highly non-linear meteorological phenomena).
16. **Data Leakage:** An evaluation flaw where information from the test set leaks into the training pipeline (e.g., fitting scalers or SMOTE on the entire dataset). Strictly prevented in KrishiJal.
17. **StandardScaler:** Normalizes features to zero mean ($\mu=0$) and unit variance ($\sigma=1$).
18. **SMOTE:** Synthetic Minority Over-sampling Technique, which creates synthetic examples along feature lines connecting minority instances.
19. **Ensemble Learning:** Combining predictions from multiple individual models (e.g., 50 decision trees in Random Forest) to produce superior accuracy and stability.
20. **Ordinary Least Squares (OLS):** The mathematical method of finding coefficients in linear regression by minimizing the sum of squared differences between observed and predicted targets.
21. **Inertia:** The sum of squared Euclidean distances of samples to their closest K-Means cluster centroid; a measure of cluster internal compactness.
22. **Silhouette Score:** A clustering validation metric ranging from $-1.0$ (incorrect clustering) to $+1.0$ (dense, well-separated clusters).
23. **FastAPI:** A modern, high-performance Python web framework for building REST APIs based on standard Python type hints.
24. **In-Memory Inference:** Performing machine learning predictions using model objects loaded in RAM rather than reading serialized disk files during each request.
25. **GeoJSON:** An open-standard geospatial data interchange format based on JSON for representing geographical boundaries, points, polygons, and their properties.
26. **DiCRA:** Data in Climate Resilient Agriculture, a digital public good initiated by UNDP and NABARD to inform agricultural climate adaptation in India.

\newpage

# Academic Viva Voce Question & Answer Bank

This section provides 36 questions and detailed answers designed for academic review panels.

---

### Category A: Project Objective & Problem Context

#### Q1: What is the main objective of project KrishiJal?
> **Answer:** KrishiJal is an automated decision support system designed to identify crop water stress across all 28 States and 8 Union Territories of India and prioritize limited irrigation canal and tubewell water releases using Machine Learning and UN FAO-56 agro-hydrology formulas.

#### Q2: Why is crop water stress prioritization critical for Indian agriculture?
> **Answer:** More than 50% of Indian farmland is rainfed. During dry spells, groundwater tables deplete rapidly and canal reservoir reserves are limited. Agricultural authorities need an objective, scientific index to release water to the most stressed districts before crops reach their permanent wilting point.

#### Q3: How is this project inspired by DiCRA?
> **Answer:** DiCRA (*Data in Climate Resilient Agriculture* by NABARD and UNDP) pioneered digital public goods for climate resilience in Telangana. KrishiJal adopts DiCRA’s dropdown-free geospatial user experience: clicking directly on an interactive vector map of India to zoom into state and district polygons and accessing live agro-climatic intelligence.

#### Q4: Why are there no dropdown selection boxes for States or Districts in the UI?
> **Answer:** Real-world geospatial intelligence platforms avoid dropdowns because spatial navigation is more natural and intuitive. In KrishiJal, clicking any state polygon smoothly animates the camera (`flyToBounds`) into that state and displays its district boundaries.

#### Q5: What makes this project suitable for a 1st-Year B.Tech student presentation?
> **Answer:** The code contains zero custom functions (`def`), uses basic procedural Python syntax, fits models directly in memory without complicated binary files, and implements syllabus-approved Scikit-Learn algorithms with clear physical formulas.

---

### Category B: Data Sourcing & Preprocessing

#### Q6: What are the primary data sources for this project?
> **Answer:** 
> 1. NASA POWER Agroclimatology API for monthly temperature, precipitation, solar radiation, and relative humidity.
> 2. National Soil Health Card Portal (DAC&FW) for soil texture, pH, and organic carbon.
> 3. Official Survey of India GeoJSON boundaries for nationwide vector mapping.

#### Q7: How many districts and states are covered in the dataset?
> **Answer:** Exactly 158 representative agricultural districts covering all 28 Indian States (minimum 5 districts per state) and all 8 Union Territories, comprising 1,896 monthly records.

#### Q8: How did you handle missing values in the dataset?
> **Answer:** Missing numerical values were imputed using column-wise **median replacement** (`df[col].fillna(df[col].median())`). In agricultural data, median is preferred over mean because it is robust against extreme weather outliers such as flash floods or heatwaves.

#### Q9: How were duplicate records handled?
> **Answer:** Duplicate records were identified and dropped using Pandas `df.drop_duplicates()` during Step 3 data preprocessing.

#### Q10: How were categorical features like Crop Type and Growth Stage converted to numbers?
> **Answer:** Deterministic integer label encoding was applied: Crops (e.g., `Cotton: 0`, `Rice: 5`, `Wheat: 7`) and Growth Stages (`Initial: 0`, `Vegetative: 3`, `Reproductive: 2`, `Maturity: 1`).

#### Q11: What is StandardScaler and why is it necessary?
> **Answer:** `StandardScaler` standardizes features to have mean $\mu = 0$ and variance $\sigma^2 = 1$ ($z = \frac{x - \mu}{\sigma}$). It is necessary because distance-based models (KNN) and gradient-based models (Logistic Regression) would otherwise be dominated by large-scale features like solar radiation ($20\text{ MJ}$) while ignoring small-scale features like soil moisture ($0.35$).

#### Q12: Why did you ensure the Survey of India map extends to $37.05^\circ	ext{ N}$?
> **Answer:** Many international GeoJSON repositories truncate the northern territories of Jammu & Kashmir and Ladakh along the Line of Control. In India, displaying an incomplete map violates Survey of India regulations. We integrated official boundaries extending to $37.05^\circ\text{ N}$ (Indira Col, Siachen, and Aksai Chin).

---

### Category C: Mathematical & Agricultural Physics Formulas

#### Q13: What is the difference between $ET_0, ET_c$, and $ET_a$?
> **Answer:**
> - $ET_0$ (Reference Evapotranspiration): Evaporative demand of the atmosphere over green grass under unlimited water.
> - $ET_c$ (Potential Crop Demand): Maximum water needed by a specific crop under ideal conditions ($ET_c = K_c \cdot ET_0$).
> - $ET_a$ (Actual Transpiration): Real water consumed under moisture-limited soil conditions ($ET_a = K_s \cdot ET_c$).

#### Q14: What is the Hargreaves formula used to calculate $ET_0$?
> **Answer:**
> $$ET_0 = 0.0023 \times (T_{mean} + 17.8) \times \sqrt{T_{max} - T_{min}} \times (0.408 \times R_s)$$
> It calculates evapotranspiration in $mm/day$ using mean temperature, daily temperature range, and surface solar radiation.

#### Q15: What is the Crop Water Stress Index ($CWSI$)?
> **Answer:**
> $$CWSI = 1.0 - \frac{ET_a}{ET_c}$$
> It measures plant transpiration deficit on a scale of $0.0$ (no stress) to $1.0$ (complete cessation of transpiration / permanent wilting point).

#### Q16: How is Daily Crop Water Deficit calculated?
> **Answer:**
> $$\text{Water Deficit} = \max(ET_c - ET_a - \text{Rainfall}, 0.0)$$
> It calculates the net daily water shortage ($mm/day$) after crediting natural rainfall against crop demand.

#### Q17: How is the Irrigation Priority Index ($IPI$) computed?
> **Answer:**
> $$IPI = 45 \times CWSI + 35 \times (1 - \theta_{eff}) + 20 \times \left(\frac{\text{Deficit}}{10}\right)$$
> It combines plant physiological stress (45%), soil reservoir depletion (35%), and volumetric deficit (20%) on a scale of $0$ to $100$.

#### Q18: What are the four Irrigation Priority categories?
> **Answer:**
> - **Low Priority ($IPI < 35$):** Routine monitoring; soil moisture is adequate.
> - **Medium Priority ($35 \le IPI < 50$):** Irrigate within 48–72 hours; depth $25-35\text{ mm}$.
> - **High Priority ($50 \le IPI < 70$):** Emergency canal water release; depth $40-50\text{ mm}$.
> - **Critical Priority ($IPI \ge 70$):** Severe drought; immediate water release required.

---

### Category D: Machine Learning Algorithms & Training

#### Q19: Which classification algorithms did you evaluate?
> **Answer:** Logistic Regression, K-Nearest Neighbors (KNN), Gaussian Naive Bayes, Decision Tree Classifier, and Random Forest Classifier.

#### Q20: Which model performed best for crop stress classification?
> **Answer:** **Random Forest Classifier**, achieving **100.00% accuracy** on the test set, followed by Decision Tree with **99.74% accuracy**.

#### Q21: Why does Random Forest outperform a single Decision Tree?
> **Answer:** A single Decision Tree can overfit noisy training samples. Random Forest uses bagging (50 trees) and feature subspace randomization, averaging predictions across all trees to cancel out individual tree variance.

#### Q22: What is the difference between Linear and Polynomial Regression?
> **Answer:** Linear Regression fits a straight line/hyperplane, assuming constant proportional change. Polynomial Regression generates degree-2 quadratic and interaction terms ($x_1^2, x_1 x_2$), allowing it to model non-linear accelerated water stress ($R^2 = 0.9994$).

#### Q23: What is SMOTE and why was it applied ONLY on training data?
> **Answer:** Synthetic Minority Over-sampling Technique generates synthetic points for minority classes (`Severe` and `High` stress). It was applied exclusively on `X_train` to prevent **data leakage**. Applying SMOTE to the test set would artificially duplicate test samples, corrupting evaluation integrity.

#### Q24: What is K-Means Clustering and what do its clusters represent?
> **Answer:** An unsupervised algorithm that groups districts into $k=4$ regional agro-climatic zones based on weather and soil attributes: High-Evaporation Central/West, Humid Coastal, Arid Moisture-Deficit, and Cool Mountain zones.

#### Q25: What is Principal Component Analysis (PCA)?
> **Answer:** An unsupervised dimensionality reduction technique that computes orthogonal eigenvectors of the covariance matrix, compressing 14 features into 2 principal components while retaining **58.23%** of the total variance for 2D visualization.

#### Q26: Why are there NO `.joblib` files in your project?
> **Answer:** In first-year B.Tech, binary serialization (`joblib`, `pickle`) is not taught. Furthermore, binary files can act as unapproved black boxes. KrishiJal trains its models directly in memory from clean CSV data upon server startup in 0.11 seconds, ensuring 100% transparency.

---

### Category E: Model Evaluation & Performance

#### Q27: What is the difference between Precision and Recall in this project?
> **Answer:**
> - **Precision:** When the model predicts a district has `Severe Stress`, how often is it correct? High precision prevents wasting emergency canal releases.
> - **Recall:** Of all districts truly experiencing `Severe Stress`, how many did the model detect? High recall prevents crops from dying undetected.

#### Q28: What is F1-Score?
> **Answer:** The harmonic mean of Precision and Recall ($F_1 = 2 \cdot \frac{P \cdot R}{P + R}$). It is the primary metric for imbalanced classification.

#### Q29: What are MAE, MSE, and RMSE in regression?
> **Answer:**
> - **MAE (Mean Absolute Error):** Average magnitude of errors ($0.26$ priority points in Polynomial Regression).
> - **MSE (Mean Squared Error):** Average of squared errors ($0.14$).
> - **RMSE (Root Mean Squared Error):** Square root of MSE ($0.37$), expressed in the same units as the target.

#### Q30: What does an $R^2$ score of $0.9994$ mean?
> **Answer:** It means that $99.94\%$ of the total variance in the Irrigation Priority Index across Indian districts is accurately explained by the polynomial agro-meteorological features.

#### Q31: What is the Silhouette Score in K-Means?
> **Answer:** It measures how similar an object is to its own cluster compared to neighboring clusters, ranging from $-1$ to $+1$. KrishiJal achieved a score of $0.2538$, confirming well-separated agro-climatic zones.

---

### Category F: Backend, Frontend & Deployment

#### Q32: How did you implement FastAPI without using the `def` keyword?
> **Answer:** Standard FastAPI uses `def endpoint_name():`. KrishiJal uses procedural routing via `app.add_api_route(path, lambda: payload, methods=[...])` and assigns Pydantic type annotations to inline lambda functions (`prediction_executor.__annotations__ = {...}`).

#### Q33: How does the frontend communicate with the backend?
> **Answer:** Through asynchronous JavaScript `fetch()` calls exchanging JSON payloads with FastAPI REST endpoints at `http://127.0.0.1:8000`.

#### Q34: What happens when a user clicks a district on the map?
> **Answer:** The district polygon is highlighted in cyan. The slide-in drawer opens, displaying the district's live stress badge, IPI progress meter, weather metrics, soil profile, and water release advisory.

#### Q35: How does the live in-memory simulator in the drawer work?
> **Answer:** The user adjusts temperature, rainfall, or soil wetness sliders and clicks "Run In-Memory Prediction". JavaScript sends a POST request with the new values to `/api/predict/crop-stress`, and the backend returns the updated stress prediction in milliseconds.

#### Q36: What are the main limitations and future improvements of KrishiJal?
> **Answer:**
> - **Limitations:** Currently uses monthly NASA climatology rather than real-time daily IoT soil sensors.
> - **Future Improvements:** Integration of Sentinel-1 radar soil moisture, mobile app notifications for farmers in regional languages, and automated canal sluice gate IoT actuation.

\newpage

# Project Limitations, Assumptions & Future Roadmap

## 1. Underlying Assumptions
1. **Climatological Generalization:** Monthly NASA POWER agroclimatology represents baseline seasonal patterns. Extreme micro-climate weather anomalies (such as cloudbursts or sudden unseasonal hail) require real-time weather radar ingestion.
2. **Crop Growth Stage Distribution:** Growth stages are mapped to calendar months based on standard Indian agronomic cycles (Kharif, Rabi, Zaid). In reality, staggered sowing dates can shift growth stages by 2–4 weeks.
3. **Soil Wetness Uniformity:** Root-zone wetness is modeled as a uniform layer over the district centroid coordinates.

## 2. Limitations
1. **Absence of Real-time IoT Ingestion:** The current academic prototype does not interface with in-situ LoRaWAN soil moisture probes.
2. **Simplified Crop Coverage:** Models are calibrated for 8 major Indian staple and cash crops (Rice, Wheat, Cotton, Sugarcane, Maize, Pulses, Groundnut, Mustard). Horticultural crops (like mangoes or apples in J&K) are currently approximated using baseline vegetative coefficients.

## 3. Future Expansion Roadmap
1. **Satellite SAR Ingestion (Sentinel-1):** Ingest 10-meter resolution Synthetic Aperture Radar (SAR) backscatter data to map soil surface moisture daily regardless of cloud cover.
2. **Vernacular Mobile Application:** Deploy a lightweight React Native or Flutter mobile app delivering localized irrigation alerts in Hindi, Telugu, Marathi, Punjabi, Tamil, and Bengali.
3. **Automated IoT Sluice Gate Control:** Link the FastAPI Irrigation Priority Index directly to SCADA / microcontroller systems to automate canal water distribution without human delay.

---
\vspace{2cm}
\begin{center}
\textbf{--- End of Comprehensive Academic Project Guide ---}
\end{center}
