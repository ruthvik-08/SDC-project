---
title: "KrishiJal: All-India Crop Stress Decision Support & Irrigation Priority Allocation System"
subtitle: "Comprehensive Project Architecture, Mathematical Formulations, Master Dataset Pipeline & Academic Viva Guide"
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

## Academic Context & First-Year Evaluation Standards
This document serves as the complete, authoritative, and beginner-friendly reference for **KrishiJal** (All-India Crop Stress and Irrigation Priority System). The project is specifically engineered for a first-year Bachelor of Technology (B.Tech) student in Computer Science / Agricultural Data Science. 

To ensure complete conceptual clarity, compliance with undergraduate academic evaluation standards, and ease of explanation during project vivas:
1. **Unified Single Master Dataset Architecture:** The data pipeline consolidates all historical observations, nationwide climatological records, and official Government of India Soil Health Card (SHC) 2024–25 data into **one master CSV file** (`data/processed/krishijal_master_dataset.csv`) comprising **6,654 records and 72 features** across **159 districts in all 37 Indian States and Union Territories**.
2. **Zero-`def` Python Backend & Pure Procedural Logic:** The core data execution and FastAPI backend routes are built without unnecessary functional indirection. Routes use inline lambda handlers, allowing a beginner student to read and explain the entire system linearly from top to bottom.
3. **In-Memory Model Training (Zero `.joblib` Dependency):** Unlike industrial workflows that rely on opaque binary serialized files (`.joblib` or `.pkl`), KrishiJal trains its Scikit-Learn models directly in computer RAM upon application startup in approximately 0.12 seconds using the clean master dataset. This eliminates black-box dependencies and guarantees complete transparency during academic evaluation.
4. **Authentic Geospatial Boundaries:** The application integrates the **official Survey of India political boundary GeoJSON**, ensuring the entire northern territory of Ladakh and Jammu & Kashmir extends to its legal boundary at $37.05^\circ\text{ N}$ (Indira Col, Siachen Glacier, Gilgit-Baltistan, and Aksai Chin).

## Inspiration: DiCRA (NABARD & UNDP)
The user interface and geospatial interaction paradigm are inspired by **DiCRA** (*Data in Climate Resilient Agriculture* — [dicra.nabard.org](https://dicra.nabard.org/)), a digital public good platform developed jointly by the United Nations Development Programme (UNDP), NABARD, and the Government of Telangana. DiCRA empowers stakeholders to identify agricultural vulnerabilities to climate change. 

KrishiJal adopts DiCRA's intuitive, dropdown-free spatial navigation:
- **No Dropdown Menus:** Traditional web dashboards force users to scroll through long dropdown lists of 28 states and 700+ districts. In KrishiJal, the user interacts directly with the map.
- **Spatial Click-to-Zoom:** Users click directly on any state vector polygon on an interactive vector map of India. The camera smoothly animates and flies into that state, hides the national boundary, and displays the local district polygons.
- **DiCRA Geospatial Intelligence Drawer:** Clicking any district polygon slides open an agronomic intelligence drawer from the right side of the screen, providing real-time crop water stress classification, evapotranspiration demand, soil moisture levels, and actionable irrigation advisories.

## The Core Agricultural Problem in India
India cultivates over 140 million hectares of net cropped area, producing staple foods for 1.4 billion citizens. However:
- **Monsoon Vulnerability:** More than 50% of Indian farmland is rainfed, relying on the erratic Southwest Monsoon (June–September). Dry spells during critical crop stages (e.g., flowering in cotton or tillering in paddy) can wipe out up to 60% of crop yields.
- **Groundwater Depletion:** In northwest and peninsular India (Punjab, Haryana, Rajasthan, Marathwada, Rayalaseema), over-extraction for irrigation has caused water tables to plummet at unsustainable rates.
- **Canal Water Misallocation:** Irrigation authorities often lack real-time, district-specific data to determine where limited canal water releases or tubewell electricity subsidies should be prioritized.

**KrishiJal solves this problem** by calculating physical crop evapotranspiration demand ($ET_c$), effective root-zone soil wetness, and the Crop Water Stress Index ($CWSI$). It uses Machine Learning models to classify crop water stress into four severity tiers (`Low`, `Moderate`, `High`, `Severe`) and predicts the **Irrigation Priority Index (IPI)** ($0 - 100$) to rank every district across India for emergency water releases.

\newpage

# Comprehensive Codebase Walkthrough (File-by-File, Line-by-Line)

The project repository follows a clean, modular structure where data generation, modular model training, backend APIs, and the interactive frontend are strictly organized:

```
SDC-project/
|
+-- data/
|   +-- raw/
|   |   +-- all_india_140_districts_raw.csv    # NASA POWER monthly climatology (158 districts)
|   |   +-- all_india_agricultural_raw.csv     # NASA POWER daily observations (26 districts)
|   |   +-- india_district_month_master_2025.csv # Govt Soil Health Card 2024-25 & LGD directory
|   |   +-- india_districts.csv                # 158 districts geographical metadata directory
|   |
|   +-- processed/
|       +-- krishijal_master_dataset.csv       # Single Master Dataset (6,654 rows, 72 columns)
|
+-- preprocessing/
|   +-- master_dataset.py                      # Master dataset generation pipeline from raw
|
+-- models/
|   +-- classification/
|   |   +-- train_classification.py            # RF, DT, Logistic, KNN, Gaussian NB + SMOTE
|   +-- regression/
|   |   +-- train_regression.py                # Linear & Polynomial (Priority & Deficit)
|   +-- clustering/
|       +-- train_clustering.py                # K-Means (k=4) & PCA (2D Projection)
|
+-- backend/
|   +-- main.py                                # FastAPI server (In-memory ML, zero-def)
|   +-- model_evaluation_metrics.json          # Benchmark evaluation metrics
|
+-- frontend/
|   +-- index.html                             # DiCRA geospatial portal layout
|   +-- style.css                              # High-tech emerald & dark slate theme
|   +-- app.js                                 # Leaflet map logic & backend integration
|   +-- data/
|       +-- india_states_official.geojson      # Official Survey of India State boundaries
|       +-- india_districts_official.geojson   # 732 Official District vector boundaries
|
+-- tests/
|   +-- test_project.py                        # Automated 8-stage regression test suite
|
+-- step4_eda.py                               # 5 distribution & correlation plots
+-- step5_feature_engineering.py               # Feature matrix extraction & scaling verification
+-- step6_7_model_training.py                  # Syllabus ML model training runner
+-- step8_model_evaluation.py                  # Benchmark metrics summary reporter
+-- run_local.py                               # Uvicorn local runner script
+-- requirements.txt                           # Pure Python library dependencies
```

---

## `preprocessing/master_dataset.py` (Master Dataset Pipeline)

### 1. Purpose & Motivation
Previously, the project generated six separate processed CSV files. This fragmented structure made it difficult to manage file dependencies. `preprocessing/master_dataset.py` restructures the pipeline into **one single master dataset** (`data/processed/krishijal_master_dataset.csv`). It reads directly from raw data in `data/raw/`, cleans anomalies, applies UN FAO-56 agro-hydrology formulas, standardizes categories, and unifies daily observations and monthly climatological normals.

### 2. Libraries Imported
- `os`: Standard library module used to manage directory paths.
- `numpy (np)`: Fast vector math, square roots, and array clipping (`np.clip`, `np.maximum`).
- `pandas (pd)`: Tabular data structures, date parsing, and CSV exporting.
- `sklearn.cluster.KMeans` & `sklearn.decomposition.PCA`: Computes regional clusters ($k=4$) and 2D spatial coordinates for the entire master dataset.
- `sklearn.preprocessing.StandardScaler`: Standardizes clustering features to zero mean and unit variance.

### 3. Inputs & Outputs
- **Inputs:** `data/raw/all_india_140_districts_raw.csv`, `data/raw/all_india_agricultural_raw.csv`, `data/raw/india_district_month_master_2025.csv`, and `data/raw/india_districts.csv`.
- **Output:** `data/processed/krishijal_master_dataset.csv` (6,654 rows, 72 columns).

### 4. Key Functions Walkthrough
- `load_and_preprocess_140_districts()`:
  - Reads `all_india_140_districts_raw.csv` (1,896 records across 158 districts).
  - Cleans the NASA POWER `-999.0` fill value anomaly in Lakshadweep root-zone soil moisture by replacing it with valid coastal island moisture ($0.42$).
  - Calculates Hargreaves $ET_0$, Crop Demand $ET_c = K_c \cdot ET_0$, Effective Soil Wetness $\theta_{eff}$, Stress Reduction Factor $K_s$, Actual Transpiration $ET_a = K_s \cdot ET_c$, Crop Water Stress Index $CWSI = 1 - (ET_a / ET_c)$, Daily Water Deficit, and Irrigation Priority Index ($IPI$).
  - Maps Indian seasons, growth stages, crop codes ($0-8$), and stage codes ($0-3$).
  - Sets `granularity = 'monthly'` and generates unique IDs `KMD_M_0001` to `KMD_M_1896`.
- `load_and_preprocess_agricultural_daily()`:
  - Reads `all_india_agricultural_raw.csv` (4,758 daily records across 26 districts).
  - Cleans dates, standardizes district names, and computes the same FAO-56 indices for daily time-series records.
  - Sets `granularity = 'daily'` and generates unique IDs `KMD_D_0001` to `KMD_D_4758`.
- `enrich_with_soil_health_card_data()`:
  - Reads official Government of India Soil Health Card (SHC) cycle records from `data/raw/india_district_month_master_2025.csv`.
  - Harmonizes 16 alternate district spellings (e.g. *Ahilyanagar* for *Ahmednagar*, *Ananthapuramu* for *Anantapur*, *North Goa* for *Bardez* and *Tiswadi*).
  - Appends official Local Government Directory (LGD) codes (`state_lgd_code`, `district_lgd_code`), macro-nutrient shares (Nitrogen, Phosphorus, Potassium NPK, pH neutrality, Organic Carbon), and micro-nutrients (Zinc, Iron, Boron).
  - Engineers human-readable agronomic categories: `nitrogen_status`, `soil_ph_character`, and a composite `soil_health_index` ($0-100$).
- `generate_master_dataset()`:
  - Aligns both daily and monthly datasets into canonical columns.
  - Runs K-Means ($k=4$) and PCA (2 components) across all 6,654 records to assign `cluster_id`, `pca_x`, and `pca_y`.
  - Enriches the merged table with Government Soil Health Card data.
  - Asserts that zero duplicate records exist across `(granularity, state, district, month, date)`.
  - Saves the final table to `data/processed/krishijal_master_dataset.csv`.

---

## `models/classification/train_classification.py` (Classification Pipeline)

### 1. Purpose & Motivation
Provides a dedicated, modular training pipeline for all syllabus-approved classification models. It reads directly from `data/processed/krishijal_master_dataset.csv`, enforces zero data leakage, applies SMOTE strictly on training data, and evaluates models on unseen test data.

### 2. Code Block & Line-by-Line Walkthrough
```python
CLASSIFICATION_FEATURES = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

X = df[CLASSIFICATION_FEATURES].copy()
y = df["stress_level_code"].copy()

# Stratified 80/20 Train-Test Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)

# Feature Scaling strictly on X_train
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# SMOTE strictly on training data
smote = SMOTE(random_state=42)
X_train_res, y_train_res = smote.fit_resample(X_train_scaled, y_train)
```
- `CLASSIFICATION_FEATURES`: 14 meteorological, vegetative, and soil features selected to predict crop stress.
- `stratify=y`: Guarantees that minority classes (`Severe` and `High`) appear in the exact same proportion in both training (80%) and testing (20%) sets.
- `scaler.fit_transform(X_train)`: Computes mean $\mu$ and standard deviation $\sigma$ using only training data, preventing test set data leakage.
- `smote.fit_resample(...)`: Synthesizes minority class records exclusively in `X_train_res`, balancing the training set from 5,323 to 15,948 samples.

### 3. Models Trained & Evaluated
1. **Random Forest Classifier (`n_estimators=50`, `max_depth=12`):** Achieves **99.40% accuracy** on unseen test data.
2. **Decision Tree Classifier (`max_depth=8`):** Achieves **98.80% accuracy**.
3. **Logistic Regression (`max_iter=1000`):** Achieves **96.09% accuracy**.
4. **K-Nearest Neighbors (`n_neighbors=5`):** Achieves **92.79% accuracy**.
5. **Gaussian Naive Bayes:** Achieves **81.14% accuracy**.

---

## `models/regression/train_regression.py` (Regression Pipeline)

### 1. Purpose & Motivation
Trains predictive regression models to estimate two continuous physical targets:
- **Target A:** `irrigation_priority_index` ($0.0 - 100.0$)
- **Target B:** `water_deficit` ($mm/day$)

### 2. Code Block & Line-by-Line Walkthrough
```python
# 80/20 Train-Test Split
X_train, X_test, y_train_pri, y_test_pri, y_train_def, y_test_def = train_test_split(
    X, y_priority, y_deficit, test_size=0.20, random_state=42
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

reg_priority_poly = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression())
]).fit(X_train_scaled, y_train_pri)
```
- Trains **Linear Regression (Ordinary Least Squares)** and **Polynomial Regression (Degree 2)**.
- `PolynomialFeatures(degree=2)` generates all interaction terms ($x_i x_j$) and quadratic powers ($x_i^2$), allowing the model to capture non-linear relationships such as $ET_0 \propto (T_{max} - T_{min})^{0.5}$.
- Evaluates Mean Absolute Error (MAE), Mean Squared Error (MSE), Root Mean Squared Error (RMSE), and Coefficient of Determination ($R^2$).
- **Results:** Polynomial Regression achieves **$R^2 = 0.9393$** (MAE: 2.60) for Irrigation Priority, and **$R^2 = 0.8501$** (MAE: 0.15) for Water Deficit.

---

## `models/clustering/train_clustering.py` (Clustering & PCA Pipeline)

### 1. Purpose & Motivation
Extracts hidden regional patterns across Indian districts without using class labels. It groups districts into four regional agro-climatic zones and computes 2D coordinates for interactive spatial visualization.

### 2. Code Block & Line-by-Line Walkthrough
```python
CLUSTERING_FEATURES = [
    "temperature", "rainfall", "humidity", "effective_soil_wetness",
    "solar_radiation", "soil_ph", "soil_organic_carbon", "ndvi", "et0", "etc"
]

scaler = StandardScaler()
X_scaled = scaler.fit_transform(df[CLUSTERING_FEATURES])

kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_scaled)

pca = PCA(n_components=2, random_state=42)
pca_coords = pca.fit_transform(X_scaled)
```
- Fits K-Means ($k=4$), evaluating **Inertia** ($37,413.65$), **Silhouette Score** ($0.2180$), and **Davies-Bouldin Index** ($1.5211$).
- Fits PCA ($n\_components=2$), explaining **39.12% variance on $PC_1$** and **17.77% variance on $PC_2$** (**56.90% total 2D variance**).

---

## `step6_7_model_training.py` (Unified Training Runner)
Serves as the root execution script that trains all 10 models on `data/processed/krishijal_master_dataset.csv` and updates `backend/model_evaluation_metrics.json`. Built purely procedurally without custom `def` functions.

---

## `backend/main.py` (FastAPI Server with In-Memory ML)

### 1. Purpose & Motivation
Acts as the production API server. On startup, it loads `data/processed/krishijal_master_dataset.csv`, fits all Scikit-Learn models directly in RAM in 0.12 seconds, serves seven REST API endpoints, and hosts static frontend files. It uses **zero custom functions (`def`)**, binding routes with inline lambda expressions.

### 2. Code Block & Line-by-Line Walkthrough
```python
# Load single consolidated master dataset
master_dataset_path = "data/processed/krishijal_master_dataset.csv"
df_master = pd.read_csv(master_dataset_path)
df_processed = df_master
df_all = df_master

feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

X_train = df_processed[feature_cols]
y_train_class = df_processed["stress_level_code"]
y_train_deficit = df_processed["water_deficit"]
y_train_priority = df_processed["irrigation_priority_index"]

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

# Fit Models in RAM
model_rf = RandomForestClassifier(n_estimators=40, random_state=42).fit(X_train_scaled, y_train_class)
model_dt = DecisionTreeClassifier(max_depth=8, random_state=42).fit(X_train_scaled, y_train_class)
model_knn = KNeighborsClassifier(n_neighbors=5).fit(X_train_scaled, y_train_class)
model_logreg = LogisticRegression(max_iter=500).fit(X_train_scaled, y_train_class)
model_nb = GaussianNB().fit(X_train_scaled, y_train_class)

model_poly_priority = Pipeline([("poly", PolynomialFeatures(degree=2)), ("linear", LinearRegression())]).fit(X_train_scaled, y_train_priority)
model_poly_deficit = Pipeline([("poly", PolynomialFeatures(degree=2)), ("linear", LinearRegression())]).fit(X_train_scaled, y_train_deficit)
```
- Fits models in computer RAM upon startup in 0.12 seconds. No `.joblib` files are read or written.

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
- Registers all 7 REST endpoints using functional lambda closures.
- Mounts the `frontend/` directory at the URL path `/app`.

---

## `tests/test_project.py` (Automated 8-Stage Verification Suite)
Provides an automated test suite verifying the master dataset, physical bounds, model inferences, and API routes.
- `test_1_master_dataset_loading()`: Asserts that `krishijal_master_dataset.csv` contains 6,654 rows, 72 columns (including 24 Govt Soil Health Card features), and 0 duplicates.
- `test_2_data_preprocessing_and_bounds()`: Asserts 0 null values in core columns, no negative soil moisture anomalies (Lakshadweep cleaned), $CWSI \in [0, 1]$, and $IPI \in [0, 100]$.
- `test_3_in_memory_models()`: Asserts that all models and scalers are loaded in RAM.
- `test_4_model_predictions()`: Tests inference with sample feature vectors.
- `test_5_api_endpoints()`: Uses FastAPI `TestClient` to verify that all 7 REST routes return HTTP 200 OK.
- `test_6_invalid_inputs_and_edge_cases()`: Verifies graceful handling of unseen categories and schema validation (HTTP 422).
- `test_7_irrigation_priority_logic()`: Asserts strict descending rank order of irrigation priority scores.
- `test_8_frontend_integrity()`: Confirms HTML, CSS, JS, and GeoJSON files exist with required bindings.

---

## `frontend/index.html`, `style.css` & `app.js` (Geospatial Portal)
- **`index.html`**: Structures the DiCRA-inspired web portal. Contains the Leaflet map container (`#geospatial-map`), floating breadcrumbs (`#map-breadcrumb`), thematic layer buttons, the slide-in **DiCRA Geospatial Intelligence Drawer** (`#district-drawer`), and the live ML simulator form (`#sim-form`).
- **`style.css`**: Provides high-contrast, modern dark-mode styling (`#0a0e17` background, emerald accents `#10b981`, cyan data text `#06b6d4`, glassmorphism blur effects, and smooth CSS transitions).
- **`app.js`**: Operates Leaflet.js:
  - Fetches and renders official Survey of India GeoJSON boundaries.
  - Implements the spatial state click-to-zoom (`map.flyToBounds`).
  - Colors district polygons dynamically based on active layer (Crop Stress, Irrigation Priority, Soil Moisture).
  - Populates the slide-in drawer when any district polygon is clicked.
  - Sends asynchronous POST requests to `/api/predict/crop-stress` and displays real-time predictions in under 10 ms.

\newpage

# Machine Learning Algorithms In-Depth

To ensure complete conceptual clarity, this section clearly categorizes all algorithms implemented in KrishiJal, distinguishing **predictive models** from **data balancing and dimensionality reduction techniques**.

```
                         KrishiJal Machine Learning System
                                        |
        +-------------------------------+-------------------------------+
        v                               v                               v
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
1. **Definition:** A supervised classification algorithm that estimates the probability that an observation belongs to a specific category using the logistic sigmoid function.
2. **How it Works Step by Step:**
   - Computes a linear combination of input features: $z = w_0 + w_1 x_1 + \dots + w_n x_n$.
   - Passes $z$ through the sigmoid function: $\sigma(z) = \frac{1}{1 + e^{-z}}$, mapping any value to $(0, 1)$.
   - Applies One-vs-Rest (OvR) to output class probabilities across the 4 stress classes.
3. **Mathematical Formulation:**
   $$\sigma(z) = \frac{1}{1 + e^{-z}}$$
   Loss function (Log-Loss):
   $$J(w) = -\frac{1}{m} \sum_{i=1}^{m} \left[ y^{(i)} \log(\hat{y}^{(i)}) + (1 - y^{(i)}) \log(1 - \hat{y}^{(i)}) \right]$$
4. **Why Selected:** Serves as a transparent linear baseline. Fast and highly interpretable.
5. **Code Location:** `models/classification/train_classification.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Fast training (0.01s), low memory usage, outputs calibrated probabilities.
   - *Disadvantages:* Cannot model non-linear interactions without polynomial expansion.
7. **Real-World Analogy:** Like a doctor calculating a patient's risk of fever based on body temperature and white blood cell count.

---

### B. K-Nearest Neighbors (KNN)
1. **Definition:** An instance-based non-parametric classifier that assigns a label based on the majority vote of its $k$ closest neighbors in feature space.
2. **How it Works Step by Step:**
   - Calculates the Euclidean distance between the target observation and all training points.
   - Identifies the $k$ closest points (we use $k=5$).
   - Assigns the class label that appears most frequently among the $k$ neighbors.
3. **Mathematical Formulation:**
   $$d(p, q) = \sqrt{\sum_{i=1}^{n} (p_i - q_i)^2}$$
4. **Why Selected:** Agronomic conditions are spatially and climatologically continuous. Districts with similar temperatures, soil types, and rainfall exhibit similar crop stress.
5. **Code Location:** `models/classification/train_classification.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Simple, zero training phase, captures complex non-linear boundaries.
   - *Disadvantages:* Slow inference on large datasets; sensitive to irrelevant features (mitigated by `StandardScaler`).
7. **Real-World Analogy:** Like guessing a student's grade by looking at the grades of the 5 students who study with them.

---

### C. Gaussian Naive Bayes
1. **Definition:** A probabilistic classifier based on Bayes' Theorem assuming conditional independence between features given the class label.
2. **How it Works Step by Step:**
   - Calculates the prior probability $P(y)$ for each stress level.
   - Models continuous features using a Gaussian normal distribution $P(x_i | y) = \mathcal{N}(\mu, \sigma^2)$.
   - Multiplies likelihoods across all features and chooses the class maximizing the posterior probability.
3. **Mathematical Formulation:**
   $$P(y | x_1, \dots, x_n) \propto P(y) \prod_{i=1}^{n} P(x_i | y)$$
   $$P(x_i | y) = \frac{1}{\sqrt{2\pi \sigma_y^2}} \exp\left( -\frac{(x_i - \mu_y)^2}{2\sigma_y^2} \right)$$
4. **Why Selected:** Serves as a fast probabilistic baseline. Performs reliably even when data is sparse.
5. **Code Location:** `models/classification/train_classification.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Extremely fast, requires minimal training data, robust to noise.
   - *Disadvantages:* Independence assumption rarely holds in climate data (temperature and $ET_0$ are correlated).
7. **Real-World Analogy:** A weather forecaster predicting rain based on humidity and cloud cover independently.

---

### D. Decision Tree Classifier (CART)
1. **Definition:** A non-parametric supervised learning algorithm that partitions feature space into homogenous regions using a tree-like hierarchy of if-else decision rules.
2. **How it Works Step by Step:**
   - Evaluates every feature and split threshold to find the division that maximizes Gini Impurity reduction.
   - Recursively splits the data until the maximum depth (`max_depth=8`) is reached.
   - Assigns the majority class of leaf nodes to incoming samples.
3. **Mathematical Formulation:**
   $$\text{Gini}(D) = 1 - \sum_{i=1}^{C} p_i^2$$
   Information Gain:
   $$\Delta \text{Gini} = \text{Gini}(D) - \frac{|D_L|}{|D|} \text{Gini}(D_L) - \frac{|D_R|}{|D|} \text{Gini}(D_R)$$
4. **Why Selected:** Matches agricultural extension guidelines (e.g., "If soil moisture $< 0.35$ and $T_{max} > 38^\circ\text{C}$, then stress is High"). Highly transparent for academic defense.
5. **Code Location:** `models/classification/train_classification.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Human-interpretable rules, handles non-linear relationships, requires no feature scaling.
   - *Disadvantages:* Prone to overfitting (mitigated by setting `max_depth=8`).
7. **Real-World Analogy:** An agricultural officer's printed diagnostic flowchart for identifying plant diseases.

---

### E. Random Forest Classifier
1. **Definition:** An ensemble learning method that constructs a multitude of decision trees (50 trees) at training time and outputs the mode of their class predictions (Bagging / Bootstrap Aggregating).
2. **How it Works Step by Step:**
   - Generates 50 bootstrap samples of the training data with replacement.
   - Trains a decision tree on each sample, selecting a random subset of features ($\sqrt{n}$) at each split.
   - Aggregates the 50 predictions by majority voting.
3. **Mathematical Formulation:**
   $$\hat{y} = \text{mode}\left( \{ T_1(x), T_2(x), \dots, T_B(x) \} \right)$$
   Variance reduction:
   $$\text{Var}(\bar{X}) = \rho \sigma^2 + \frac{1 - \rho}{B} \sigma^2$$
4. **Why Selected:** **Top-performing classification model** in our project (**99.40% Accuracy**). Drastically reduces decision tree variance and avoids overfitting.
5. **Code Location:** `models/classification/train_classification.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* High accuracy, robust to outliers and noise, provides feature importance rankings.
   - *Disadvantages:* Slower inference than a single tree, requires more memory.
7. **Real-World Analogy:** A panel of 50 agronomists independently assessing a crop field and voting on the diagnosis.

---

## 2. Regression Predictive Models

### A. Linear Regression (Ordinary Least Squares)
1. **Definition:** A linear model that estimates a continuous target by finding the optimal hyperplane minimizing the sum of squared differences between observed and predicted targets.
2. **How it Works Step by Step:**
   - Expresses the target as a linear equation: $\hat{y} = \beta_0 + \sum_{i=1}^{n} \beta_i x_i$.
   - Calculates the closed-form normal equation: $\beta = (X^T X)^{-1} X^T y$.
3. **Mathematical Formulation:**
   $$J(\beta) = \sum_{i=1}^{m} (y_i - \hat{y}_i)^2 = \| y - X\beta \|^2$$
4. **Why Selected:** Baseline regression benchmark to measure whether crop water deficit and irrigation priority can be explained by linear relationships.
5. **Code Location:** `models/regression/train_regression.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Fast computation, mathematically transparent, closed-form solution.
   - *Disadvantages:* Cannot model non-linear meteorological phenomena ($R^2 = 0.8059$ vs $0.9393$ for polynomial).
7. **Real-World Analogy:** Estimating monthly electricity cost directly proportional to hours of air conditioner usage.

---

### B. Polynomial Regression (Degree 2)
1. **Definition:** A form of regression where the relationship between feature variables and the target is modeled as an $n^{\text{th}}$-degree polynomial (Degree 2 in KrishiJal).
2. **How it Works Step by Step:**
   - Expands the feature vector into quadratic terms ($x_i^2$) and pairwise interaction products ($x_i x_j$).
   - Fits standard Ordinary Least Squares on the expanded feature matrix.
3. **Mathematical Formulation:**
   $$\hat{y} = \beta_0 + \sum_{i=1}^{n} \beta_i x_i + \sum_{i=1}^{n} \sum_{j \ge i}^{n} \beta_{ij} x_i x_j$$
4. **Why Selected:** **Top-performing regression model** (**$R^2 = 0.9393$** for Priority Index, **$R^2 = 0.8501$** for Deficit). Accurately captures non-linear physics like Hargreaves $ET_0 \propto \sqrt{T_{max} - T_{min}}$ and interaction between soil moisture and evapotranspiration.
5. **Code Location:** `models/regression/train_regression.py` and `backend/main.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Models curved physical functions without neural networks, high accuracy.
   - *Disadvantages:* Increases feature dimensions from 14 to 119 interaction terms.
7. **Real-World Analogy:** Calculating the braking distance of a tractor, which grows quadratically with speed ($d \propto v^2$).

---

## 3. Unsupervised Clustering & Preprocessing Techniques

### A. K-Means Clustering ($k=4$)
1. **Definition:** An unsupervised partition-based clustering algorithm that groups $n$ observations into $k$ distinct, non-overlapping clusters based on Euclidean distance to cluster centroids.
2. **How it Works Step by Step:**
   - Initializes 4 centroids at random (`k-means++` initialization).
   - Assigns each district to its nearest centroid.
   - Recalculates centroids by computing the mean of all points assigned to that cluster.
   - Repeats assignment and update steps until centroids stabilize (convergence).
3. **Mathematical Formulation:**
   $$\text{Inertia} = \sum_{j=1}^{k} \sum_{x_i \in C_j} \| x_i - \mu_j \|^2$$
4. **Why Selected:** Automatically segments India's 159 districts into 4 distinct agro-climatic zones based on temperature, rainfall, and soil moisture without human bias.
5. **Code Location:** `models/clustering/train_clustering.py` and `preprocessing/master_dataset.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Fast, scalable, groups districts with similar climate risks.
   - *Disadvantages:* Assumes spherical cluster geometry; requires pre-specifying $k=4$.
7. **Real-World Analogy:** Grouping farmers into 4 training batches based on their land size and water access.

---

### B. Principal Component Analysis (PCA)
1. **Definition:** An unsupervised linear dimensionality reduction technique that transforms correlated features into a smaller set of uncorrelated variables called Principal Components.
2. **How it Works Step by Step:**
   - Standardizes the 10 numerical climate features using `StandardScaler`.
   - Computes the $10 \times 10$ feature covariance matrix $\Sigma = \frac{1}{m} X^T X$.
   - Calculates the eigenvalues and eigenvectors of $\Sigma$.
   - Projects data points onto the top 2 eigenvectors ($PC_1$ and $PC_2$) to create 2D map coordinates.
3. **Mathematical Formulation:**
   $$\Sigma v = \lambda v$$
   $$\text{Coordinates: } Z = X W_2$$
4. **Why Selected:** Allows high-dimensional agro-climatic data (10 dimensions) to be projected onto an interactive 2D scatter plot on the web portal while retaining **56.90% of total variance**.
5. **Code Location:** `models/clustering/train_clustering.py` and `preprocessing/master_dataset.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Removes collinearity, enables 2D visualization, preserves maximum data variance.
   - *Disadvantages:* Principal components are linear combinations and lose direct physical units ($^\circ\text{C}$ or $mm$).
7. **Real-World Analogy:** Photographing a 3D tractor from the side to capture its length and height in a 2D image.

---

### C. SMOTE (Synthetic Minority Over-sampling Technique)
1. **Definition:** An advanced data balancing technique that synthesizes new examples for minority classes by interpolating between neighboring instances in feature space.
2. **How it Works Step by Step:**
   - Identifies minority class samples (`Severe` and `High` stress).
   - For each minority point, finds its $k$ nearest minority neighbors ($k=5$).
   - Creates synthetic points along the line segment joining the point and its neighbors:
     $$x_{new} = x + \lambda (x_{neighbor} - x), \quad \lambda \in [0, 1]$$
3. **Mathematical Formulation:**
   $$x_{\text{synthetic}} = x_i + \text{rand}(0, 1) \times (x_{zi} - x_i)$$
4. **Why Selected:** Genuine agricultural drought data has extreme class imbalance (`Low`: 4,984 records, `Severe`: 194 records). Without SMOTE, classifiers would ignore severe drought events.
5. **Code Location:** Applied strictly to training data in `models/classification/train_classification.py` and `step6_7_model_training.py`.
6. **Advantages & Disadvantages:**
   - *Advantages:* Mitigates class imbalance without simple duplication, prevents model neglect of drought events.
   - *Disadvantages:* Must **never be applied to the test set** to prevent data leakage.
7. **Real-World Analogy:** Creating realistic mock exam questions similar to rare, difficult questions from past exam papers.

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
  - Barley: $K_c = 0.90$
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
- **Single Master Dataset Source:** `data/processed/krishijal_master_dataset.csv`.
- **Total Records:** 6,654 records covering 159 districts across all 37 Indian States and Union Territories.
- **Partition:** 80% Training ($N=5,323$) and 20% Testing ($N=1,331$) using stratified sampling on crop stress class.
- **Data Balancing:** SMOTE applied strictly to `X_train`, balancing minority classes (`Severe` and `High`) from 5,323 to 15,948 samples.
- **Zero Data Leakage:** Scalers and SMOTE are fit solely on training data. The 1,331 test records remain unseen until final scoring.

---

## 2. Actual Evaluation Results from the Repository

The following numbers represent the exact values stored in `backend/model_evaluation_metrics.json`:

### A. Classification Performance on Unseen Test Set ($N=1,331$)

| Algorithm | Accuracy | Precision (Weighted) | Recall (Weighted) | F1-Score (Weighted) | Academic Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Random Forest** | **99.40%** | **0.9941** | **0.9940** | **0.9940** | **Top Performer** |
| **Decision Tree** | **98.80%** | **0.9883** | **0.9880** | **0.9881** | **High Precision** |
| **Logistic Regression** | **96.09%** | **0.9651** | **0.9609** | **0.9621** | **Strong Linear Baseline** |
| **K-Nearest Neighbors (KNN)** | **92.79%** | **0.9362** | **0.9279** | **0.9307** | **Instance-based** |
| **Gaussian Naive Bayes** | **81.14%** | **0.8526** | **0.8114** | **0.8267** | **Probabilistic Baseline** |

#### Confusion Matrix for Random Forest ($N=1,331$ Unseen Test Records):
```
Actual / Predicted   Low (0)   Moderate (1)   High (2)   Severe (3)
Low (0)                993          4             0          0
Moderate (1)             0        179             3          0
High (2)                 0          0           113          0
Severe (3)               0          0             1         38
```

---

### B. Regression Performance

| Target Parameter | Model Algorithm | MAE | MSE | RMSE | $R^2$ Score | Evaluation Summary |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Irrigation Priority Index (0 - 100)** | **Polynomial Regression (Deg 2)** | **2.60** | **11.60** | **3.41** | **0.9393** | **Top Performer on non-linear physics** |
| | **Linear Regression** | **4.87** | **37.09** | **6.09** | **0.8059** | Strong linear baseline |
| **Water Deficit (mm/day)** | **Polynomial Regression (Deg 2)** | **0.15** | **0.05** | **0.23** | **0.8501** | **Captures parabolic shortfall** |
| | **Linear Regression** | **0.26** | **0.15** | **0.39** | **0.5855** | Baseline linear model |

---

### C. Unsupervised Clustering & PCA Metrics
- **K-Means ($k=4$ Clusters):**
  - **Inertia:** $37,413.65$
  - **Silhouette Score:** $0.2180$ (Confirms consistent separation between climate zones).
  - **Davies-Bouldin Index:** $1.5211$ (Lower is better; confirms good cluster compactness).
- **Principal Component Analysis (PCA):**
  - $PC_1$ Explained Variance: **39.12%**
  - $PC_2$ Explained Variance: **17.77%**
  - **Total 2D Explained Variance:** **56.90%**

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
                    +--------------------------------------------------------+
                    |               DATA SOURCING LAYER                      |
                    |  • NASA POWER API (Agro-Climatology Observations)      |
                    |  • National Soil Health Card (DAC&FW Soil Chemistry)   |
                    |  • Survey of India Official GeoJSON Boundaries         |
                    +---------------------------+----------------------------+
                                                |
                                                v
                    +--------------------------------------------------------+
                    |          MASTER DATASET PIPELINE                       |
                    |  • preprocessing/master_dataset.py                     |
                    |  • Generates data/processed/krishijal_master_dataset.csv|
                    |  • Cleans NASA anomalies, combines 6,654 records       |
                    +---------------------------+----------------------------+
                                                |
                                                v
                    +--------------------------------------------------------+
                    |         FASTAPI BACKEND SERVER (backend/main.py)       |
                    |  • In-Memory Model Fitting on Startup (0.12s)          |
                    |  • Loads krishijal_master_dataset.csv in RAM           |
                    |  • Random Forest, Decision Tree, Logistic, KNN, NB     |
                    |  • Polynomial Regression & Linear Regression           |
                    |  • Zero-def Procedural Lambda Route Handlers           |
                    +---------------^------------------------+---------------+
                                    |                        |
                      JSON Requests |                        | JSON Responses
                     (Form Inputs)  |                        | (Predictions & GeoJSON)
                                    |                        v
                    +--------------------------------------------------------+
                    |      DiCRA GEOSPATIAL FRONTEND (frontend/index.html)   |
                    |  • Leaflet.js Interactive Vector Map of India          |
                    |  • Spatial State Click-to-Zoom (flyToBounds)           |
                    |  • 732 Survey of India Official District Polygons      |
                    |  • Slide-in Geospatial Intelligence Drawer             |
                    |  • Interactive In-Memory Machine Learning Simulator    |
                    +--------------------------------------------------------+
```

---

## 2. Complete Backend REST API Catalog

| HTTP Method | API Path | Request Payload | Response Schema | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | None | `{project, master_dataset, total_records, states_covered, districts_covered}` | API health check & metadata |
| `GET` | `/api/dataset/info` | None | `{total_records, total_districts, total_states, national_averages, distributions}` | High-level nationwide statistics |
| `GET` | `/api/districts` | None | `{total_districts, districts: [{district, state, lat, lon, crop, soil, ipi, stress}]}` | Complete 159-district directory |
| `GET` | `/api/clusters/regions` | None | `{clusters_summary: {0..3}, districts_clustered: [{district, state, cluster_id, pca_x, pca_y}]}` | K-Means & PCA cluster coordinates |
| `GET` | `/api/irrigation/priority` | None | `{title, total_districts, ranked_districts: [{rank, district, state, ipi, depth}]}` | Nationwide irrigation ranking table |
| `GET` | `/api/models/evaluation` | None | `{classification: {...}, regression: {...}, clustering: {...}}` | Live benchmark metrics |
| `POST` | `/api/predict/crop-stress` | `{temperature, rainfall, effective_soil_wetness, selected_model}` | `{crop_stress_level, predicted_water_deficit_mm_per_day, irrigation_priority_index, recommendation}` | Real-time ML inference |

---

## 3. Client-Server Communication Workflow

1. When the browser loads `http://127.0.0.1:8000/app/`, `app.js` issues asynchronous `fetch()` requests to `/api/dataset/info` and `/api/districts`.
2. The browser loads the official Survey of India GeoJSON file (`data/india_states_official.geojson`) and renders national state boundaries with Leaflet.js.
3. When the user clicks a state (e.g., Maharashtra), `map.flyToBounds()` zooms smoothly into that state, hides national boundaries, and renders the 36 district boundaries of Maharashtra.
4. When the user clicks a district (e.g., Solapur), the slide-in drawer opens, showing the pre-calculated agro-climatology and priority meter.
5. In the drawer, if the user adjusts the temperature slider to $40^\circ\text{C}$ and clicks **"Run In-Memory Prediction"**, `app.js` issues a POST request to `/api/predict/crop-stress`.
6. FastAPI extracts the input, scales it with `StandardScaler`, runs `model_rf.predict()` in memory, and returns the updated stress level and advisory in under 10 milliseconds.

\newpage

# Comprehensive Glossary of Technical & Agronomic Terms

1. **Master Dataset:** A consolidated, authoritative single data repository (`krishijal_master_dataset.csv`) that brings together historical time-series observations and nationwide climatological data under a single harmonized schema.
2. **Data Granularity:** The level of detail represented in a data table. KrishiJal explicitly harmonizes two granularities: high-frequency daily observations and monthly climatological normals.
3. **Missing Value Imputation:** Replacing unobserved entries with statistically defensible estimates (such as district-wise medians) rather than dropping rows.
4. **Agro-Meteorology:** The study of weather and climate variables (temperature, solar radiation, humidity, rainfall) and their direct interactions with agricultural crop production.
5. **Climatology:** Long-term statistical averages (typically 30 years) of meteorological conditions for every month of the year.
6. **Reference Evapotranspiration ($ET_0$):** The rate at which water would evaporate and transpire from an extensive surface of 0.12 m tall cool-season green grass under unlimited water availability.
7. **Crop Evapotranspiration ($ET_c$):** The potential water demanded by a specific crop when disease-free, well-fertilized, and grown in large fields under non-limiting water conditions ($ET_c = K_c \cdot ET_0$).
8. **Actual Evapotranspiration ($ET_a$):** The actual amount of water consumed and evaporated by crops under real-world, moisture-limited soil conditions ($ET_a = K_s \cdot ET_c$).
9. **Crop Coefficient ($K_c$):** An experimentally determined multiplier that accounts for crop characteristics, canopy roughness, and growth stage.
10. **Water Stress Coefficient ($K_s$):** A fractional multiplier ($0.0 - 1.0$) that reduces crop transpiration when soil moisture drops below the readily available water threshold.
11. **Crop Water Stress Index ($CWSI$):** A normalized index ($0.0 - 1.0$) measuring the relative shortfall between actual and potential crop transpiration.
12. **Water Deficit:** The daily volumetric shortfall ($mm/day$) between crop demand and the sum of actual transpiration plus natural precipitation.
13. **Irrigation Priority Index (IPI):** A composite multi-criteria metric ($0 - 100$) combining $CWSI$, soil reservoir depletion, and daily water deficit to rank water allocation urgency.
14. **Normalized Difference Vegetation Index (NDVI):** A satellite-derived index ($0.15 - 0.88$) reflecting plant canopy chlorophyll concentration, greenness, and biomass vigor.
15. **Supervised Learning:** Machine learning tasks where the algorithm learns a mapping function from input features ($X$) to known target ground-truth labels ($y$).
16. **Unsupervised Learning:** Algorithms (like K-Means and PCA) that identify hidden structures, clusters, or lower-dimensional representations without target labels.
17. **Overfitting:** When a machine learning model memorizes training noise and performs poorly on unseen test data. Prevented in KrishiJal using `max_depth=8` in Decision Trees and 50 bagging estimators in Random Forest.
18. **Underfitting:** When a model is too simplistic to capture underlying physical relationships (e.g., using linear regression on highly non-linear meteorological phenomena).
19. **Data Leakage:** An evaluation flaw where information from the test set leaks into the training pipeline (e.g., fitting scalers or SMOTE on the entire dataset). Strictly prevented in KrishiJal.
20. **StandardScaler:** Normalizes features to zero mean ($\mu=0$) and unit variance ($\sigma=1$).
21. **SMOTE:** Synthetic Minority Over-sampling Technique, which creates synthetic examples along feature lines connecting minority instances.
22. **Ensemble Learning:** Combining predictions from multiple individual models (e.g., 50 decision trees in Random Forest) to produce superior accuracy and stability.
23. **Ordinary Least Squares (OLS):** The mathematical method of finding coefficients in linear regression by minimizing the sum of squared differences between observed and predicted targets.
24. **Inertia:** The sum of squared Euclidean distances of samples to their closest K-Means cluster centroid; a measure of cluster internal compactness.
25. **Silhouette Score:** A clustering validation metric ranging from $-1.0$ (incorrect clustering) to $+1.0$ (dense, well-separated clusters).
26. **FastAPI:** A modern, high-performance Python web framework for building REST APIs based on standard Python type hints.
27. **In-Memory Inference:** Performing machine learning predictions using model objects loaded in RAM rather than reading serialized disk files during each request.
28. **GeoJSON:** An open-standard geospatial data interchange format based on JSON for representing geographical boundaries, points, polygons, and their properties.

\newpage

# Academic Viva Voce Question & Answer Bank

This section provides 38 questions and detailed answers designed for academic review panels.

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
> **Answer:** The code contains zero custom functions (`def`) in execution scripts, uses basic procedural Python syntax, fits models directly in memory without complicated binary files, and implements syllabus-approved Scikit-Learn algorithms with clear physical formulas.

---

### Category B: Master Dataset Sourcing & Preprocessing

#### Q6: Why did we restructure the project into ONE Master Dataset?
> **Answer:** Previously, six separate processed CSV files were generated, making it difficult to maintain consistent feature versions across models. By creating `data/processed/krishijal_master_dataset.csv`, we established a single, authoritative source of truth (6,654 records, 72 features) to which all classification, regression, clustering, and backend services connect.

#### Q7: How many districts, states, and records are covered in the Master Dataset?
> **Answer:** Exactly 6,654 records covering 159 districts across all 37 States and Union Territories (including NCT Delhi), incorporating both 1,896 monthly climatological summaries and 4,758 daily observations.

#### Q8: How did you combine daily and monthly data without creating incorrect records?
> **Answer:** In `preprocessing/master_dataset.py`, we implemented a dual-granularity schema with a `granularity` tracker (`'monthly'` vs `'daily'`). Daily records retain exact date fields (`date`, `day`, `day_of_year`), while monthly records leave those fields as legitimate `NaN` rather than inventing false daily dates.

#### Q9: What data quality issue did you discover in the NASA POWER dataset, and how was it solved?
> **Answer:** In `all_india_140_districts_raw.csv`, NASA POWER reported `-999.0` for `root_zone_soil_moisture` in Lakshadweep across all 12 months because satellite radar soil sensors lack land resolution over tiny coral atolls. This resulted in an erroneous `effective_soil_wetness = -599.0`, misclassifying Lakshadweep as experiencing severe drought. In `preprocessing/master_dataset.py`, we identified and cleaned this anomaly, replacing `-999.0` with valid coastal sandy soil moisture ($0.42$), correctly recalculating $CWSI$ and restoring Lakshadweep to "Low" stress.

#### Q10: How did you enrich the master dataset with Government of India Soil Health Card (SHC) 2024–25 data?
> **Answer:** We ingested `data/raw/india_district_month_master_2025.csv`, which holds nationwide Soil Health Card nutrient shares (NPK, pH, organic carbon) across 783 districts. We harmonized 16 historical/administrative name variations (such as Maharashtra's official renaming of Ahmednagar to Ahilyanagar, and Anantapur to Ananthapuramu) and joined 24 soil chemistry and LGD attributes into our 159 districts, upgrading the dataset from 48 to 72 features with zero missing values.

#### Q10: How did you handle missing values in numerical columns?
> **Answer:** Missing numerical values were imputed using column-wise median replacement (`df[col].fillna(df[col].median())`). In agricultural data, median is preferred over mean because it is robust against extreme weather outliers such as flash floods or heatwaves.

#### Q11: How were duplicate records handled?
> **Answer:** Duplicate records were identified and dropped based on `(granularity, state, district, month, date)`. The final master dataset contains exactly 0 duplicate records.

#### Q12: How were categorical features like Crop Type and Growth Stage converted to numbers?
> **Answer:** Deterministic integer label encoding was applied: Crops (`Barley: 0` to `Wheat: 8`) and Growth Stages (`Initial: 0`, `Maturity: 1`, `Reproductive: 2`, `Vegetative: 3`).

---

### Category C: Mathematical & Agricultural Physics Formulas

#### Q13: What is Reference Evapotranspiration ($ET_0$), and what formula was used?
> **Answer:** $ET_0$ represents atmospheric evaporative demand for a standard grass reference crop. We implemented the UN FAO Hargreaves formula:
> $$ET_0 = 0.0023 \times (T_{mean} + 17.8) \times \sqrt{T_{max} - T_{min}} \times (0.408 \times R_s)$$

#### Q14: What is Crop Evapotranspiration ($ET_c$) and Crop Coefficient ($K_c$)?
> **Answer:** $ET_c = K_c \times ET_0$. The crop coefficient $K_c$ accounts for crop canopy roughness, leaf area, and growth stage, scaling atmospheric evaporative demand to the specific biological water requirement of crops like Rice ($K_c = 1.15$) or Cotton ($K_c = 1.05$).

#### Q15: How is Effective Soil Moisture ($\theta_{eff}$) calculated?
> **Answer:** As a depth-weighted combination of surface moisture and root-zone moisture: $\theta_{eff} = 0.4 \times \theta_{surface} + 0.6 \times \theta_{root\_zone}$, reflecting that deep root zones buffer crops against rapid topsoil desiccation.

#### Q16: What is the difference between $ET_0$, $ET_c$, and $ET_a$?
> **Answer:**
> - $ET_0$: Baseline evaporative demand of green grass under unlimited water.
> - $ET_c$: Potential water demand of a specific crop under non-limiting water conditions ($ET_c = K_c \times ET_0$).
> - $ET_a$: *Actual* water consumed by the crop under moisture-limited soil conditions ($ET_a = K_s \times ET_c$, where $K_s \le 1.0$).

#### Q17: What is Crop Water Stress Index ($CWSI$)?
> **Answer:** $CWSI = 1 - \frac{ET_a}{ET_c}$. It ranges from $0.0$ (no stress, optimal transpiration) to $1.0$ (severe stress, complete stomatal closure).

#### Q18: What is the Irrigation Priority Index ($IPI$), and how is it weighted?
> **Answer:** $IPI = 45 \times CWSI + 35 \times (1 - \theta_{eff}) + 20 \times (\text{Deficit} / 10)$. It places 45% weight on plant stress, 35% on soil reservoir depletion, and 20% on volumetric water deficit to produce a single actionable priority score ($0 - 100$).

---

### Category D: Machine Learning Algorithms & Training

#### Q19: Which machine learning algorithms are implemented in KrishiJal?
> **Answer:**
> - **Classification:** Random Forest, Decision Tree, Logistic Regression, KNN, Gaussian Naive Bayes.
> - **Regression:** Linear Regression, Polynomial Regression (Degree 2).
> - **Clustering & Dimensionality:** K-Means ($k=4$), PCA (2 components).
> - **Data Balancing:** SMOTE.

#### Q20: Why is Random Forest the top classification performer?
> **Answer:** Random Forest uses 50 bootstrapped decision trees and feature bagging. Aggregating diverse trees cancels out individual errors, yielding **99.40% accuracy** on unseen test data without overfitting.

#### Q21: Why does Polynomial Regression outperform Linear Regression for priority prediction?
> **Answer:** Agricultural physics involves non-linear relationships (e.g., solar radiation and temperature interact multiplicatively, and temperature difference enters through a square root). Polynomial Regression includes interaction terms ($x_i x_j$) and quadratic powers ($x_i^2$), increasing $R^2$ from $0.8059$ to **$0.9393$**.

#### Q22: What is SMOTE, and why is it applied only to training data?
> **Answer:** SMOTE creates synthetic minority class examples by interpolating between neighboring instances in feature space. Applying SMOTE to the test set causes **data leakage**; it must only balance `X_train` so that test evaluation reflects genuine real-world class distributions.

#### Q23: Why do we use StandardScaler before training KNN and Logistic Regression?
> **Answer:** KNN relies on Euclidean distance, and Logistic Regression uses gradient descent. Unscaled features with large numerical values (like solar radiation at $25\text{ MJ}$) would dominate features with small ranges (like soil moisture at $0.35$). `StandardScaler` standardizes all features to mean $\mu = 0$ and variance $\sigma^2 = 1$.

#### Q24: How was data leakage strictly prevented during scaling?
> **Answer:** The scaler was fit exclusively on the training split: `scaler.fit_transform(X_train)`. The test set was transformed using the training parameters: `scaler.transform(X_test)`.

---

### Category E: Model Evaluation & Benchmark Results

#### Q25: What are the evaluation results for Random Forest on the unseen test set?
> **Answer:** On $N=1,331$ test records, Random Forest achieved **99.40% Accuracy**, **0.9941 Precision**, **0.9940 Recall**, and **0.9940 F1-Score**.

#### Q26: What is a Confusion Matrix, and what did ours show?
> **Answer:** A matrix comparing actual ground-truth classes with predicted classes. For Random Forest ($N=1,331$), 993 Low, 179 Moderate, 113 High, and 38 Severe stress records were correctly classified, with only 8 total minor misclassifications.

#### Q27: What is the difference between MAE and RMSE in regression?
> **Answer:** MAE measures the average magnitude of absolute errors linearly. RMSE squares errors before averaging, penalizing large outliers heavily. In our priority model, MAE was $2.60$ and RMSE was $3.41$.

#### Q28: What is $R^2$ score?
> **Answer:** The coefficient of determination ($0.0 - 1.0$), representing the proportion of variance in the target variable explained by the model. Our Polynomial model achieved **$R^2 = 0.9393$** (93.93% variance explained).

#### Q29: What do Silhouette Score and Inertia tell us about K-Means?
> **Answer:** Inertia ($37,413.65$) measures internal cluster compactness (sum of squared distances to centroid). Silhouette Score ($0.2180$) measures how well-separated clusters are from neighboring clusters.

---

### Category F: Architecture, Implementation & Defense

#### Q30: Why does the backend train models in memory instead of loading `.joblib` files?
> **Answer:** In-memory fitting on startup takes only 0.12 seconds on the clean master dataset, eliminating external binary dependencies and guaranteeing complete transparency for academic examiners.

#### Q31: How does the client frontend communicate with the backend?
> **Answer:** Through asynchronous REST API calls using JavaScript `fetch()`. The frontend requests GeoJSON and district metrics via GET endpoints and issues POST requests to `/api/predict/crop-stress` for real-time inference.

#### Q32: What automated testing did you implement?
> **Answer:** An 8-stage automated test suite in `tests/test_project.py` verifying dataset loading, physical bounds, in-memory models, predictions, all 7 API endpoints, edge cases, descending priority ranking, and frontend static assets with a **100% pass rate**.

---

\newpage

# Project Limitations, Assumptions & Future Roadmap

## 1. Underlying Assumptions
1. **Atmospheric Radiation Approximation:** Where in-situ solar pyranometers were absent, solar radiation ($R_s$) was derived from satellite-based all-sky downwelling shortwave flux (NASA POWER).
2. **Crop Growth Stage Modeling:** Growth stages are modeled based on standard Indian agronomic cycles (Kharif, Rabi, Zaid). In field practice, staggered sowing dates can shift growth stages by 2–4 weeks.
3. **Soil Wetness Uniformity:** Root-zone wetness is modeled as a uniform layer over district centroid coordinates.

## 2. Limitations
1. **Absence of Real-time IoT Ingestion:** The current academic prototype relies on satellite climatology rather than real-time in-situ LoRaWAN soil moisture probes.
2. **Crop Coverage Scope:** Models are calibrated for 9 major Indian staple and cash crops (Rice, Wheat, Cotton, Sugarcane, Maize, Pulses, Groundnut, Mustard, Barley). Horticultural crops are currently approximated using baseline vegetative coefficients.

## 3. Future Expansion Roadmap
1. **Satellite SAR Ingestion (Sentinel-1):** Ingest 10-meter resolution Synthetic Aperture Radar (SAR) backscatter data to map soil surface moisture daily regardless of cloud cover.
2. **Vernacular Mobile Application:** Deploy a lightweight React Native or Flutter mobile app delivering localized irrigation alerts in Hindi, Telugu, Marathi, Punjabi, Tamil, and Bengali.
3. **Automated IoT Sluice Gate Control:** Link the FastAPI Irrigation Priority Index directly to SCADA / microcontroller systems to automate canal water distribution without human delay.

---
\begin{center}
\textbf{— End of Comprehensive Academic Project Guide —}
\end{center}
