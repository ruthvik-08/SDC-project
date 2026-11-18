# 🌾 KrishiJal: All-India Crop Stress & Irrigation Priority System
### *A Machine Learning & Agro-Hydrology Decision System for Sustainable Water Management Across India*
**First-Year B.Tech Student Academic Project**

---

## 🌟 Executive Summary
India cultivates over 140 million hectares of agricultural land, yet more than half relies on seasonal rainfall or groundwater extraction from rapidly depleting aquifers. During dry spells, farmers and irrigation canal officers must decide **where, when, and how much irrigation water to release**.

**KrishiJal** is a data-driven agricultural decision system that covers **all geographic zones of India** (North, South, East, West, Central, and Northeast across 26 major agricultural districts). It leverages genuine agro-meteorological records from **NASA POWER**, authentic soil parameters from the **National Soil Health Card Portal (DAC&FW)**, and standard evapotranspiration principles from the **United Nations FAO (FAO-56)**.

The system performs:
1. **Crop Water Stress Classification** (Low, Moderate, High, Severe Stress) using Random Forest (99.47% accuracy), Decision Tree, KNN, Logistic Regression, and Naive Bayes, balanced with SMOTE.
2. **Water Deficit & Priority Regression** using Polynomial Regression ($R^2 = 0.9277$) and Linear Regression ($R^2 = 0.8178$).
3. **Regional Agro-Climatic Clustering** using K-Means ($k=4$) and Principal Component Analysis (PCA).
4. **Rank-Ordered Irrigation Water Allocation** to optimize limited water distribution across India.

---

## 📋 The 16 Project Stages (Completed in Order)
- [x] **Stage 1: Problem Definition** &rarr; Defined national crop stress detection and irrigation water priority.
- [x] **Stage 2: Data Collection** &rarr; Gathered genuine records from NASA POWER, Soil Health Card, and FAO WaPOR across 26 Indian districts.
- [x] **Stage 3: Data Preprocessing** &rarr; Cleaned missing values, removed duplicates, standardized dates, and computed FAO-56 $ET_0$, $ET_c$, $ET_a$, $CWSI$, $NDVI$, and $IPI$.
- [x] **Stage 4: Exploratory Data Analysis (EDA)** &rarr; Generated 6 publication-grade figures in `eda/plots/`.
- [x] **Stage 5: Feature Engineering** &rarr; Engineered 14 agronomic features, label encoders, and StandardScalers in `backend/models/`.
- [x] **Stage 6: Model Selection** &rarr; Selected strictly designated algorithms (Linear/Poly Regression, Logistic Regression, KNN, Naive Bayes, Decision Tree, Random Forest, SMOTE, K-Means, PCA).
- [x] **Stage 7: Model Training** &rarr; Split 80/20 with stratified train/test partitioning; applied SMOTE exclusively to training data.
- [x] **Stage 8: Model Evaluation** &rarr; Evaluated Accuracy, Precision, Recall, F1, Confusion Matrices, MAE, MSE, RMSE, $R^2$, Silhouette, and Inertia.
- [x] **Stage 9: Hyperparameter Tuning** &rarr; Conducted GridSearchCV for Random Forest, Decision Tree, and KNN.
- [x] **Stage 10: Model Saving** &rarr; Serialized all models, transformers, and evaluation metrics using Joblib in `backend/models/`.
- [x] **Stage 11: Backend Development** &rarr; Created beginner-friendly REST API in FastAPI (`backend/main.py`).
- [x] **Stage 12: Frontend Development** &rarr; Built responsive, clean web UI (`frontend/index.html`, `style.css`, `app.js`).
- [x] **Stage 13: Model Integration** &rarr; Connected UI directly to FastAPI backend for live inference.
- [x] **Stage 14: Testing** &rarr; Executed automated 8-part test suite with 100% pass rate (`tests/test_project.py`).
- [x] **Stage 15: Deployment** &rarr; Launched local FastAPI server daemon and established secure Cloudflare Tunnel.
- [x] **Stage 16: URL Generation** &rarr; Verified live local and public HTTPS access URLs.

---

## 🚀 Access URLs
| Environment | Access Link | Description | Status |
| :--- | :--- | :--- | :--- |
| **Local Frontend UI** | [http://127.0.0.1:8000/app/](http://127.0.0.1:8000/app/) | Clean user interface with preset buttons & live prediction | **Active** |
| **Local API Status** | [http://127.0.0.1:8000/](http://127.0.0.1:8000/) | Root health and route overview | **Active** |
| **Local API Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Interactive Swagger UI for testing endpoints | **Active** |
| **Public Frontend UI** | [https://trusted-lower-gay-depend.trycloudflare.com/app/](https://trusted-lower-gay-depend.trycloudflare.com/app/) | Publicly accessible web application | **Active & Verified** |
| **Public API Docs** | [https://trusted-lower-gay-depend.trycloudflare.com/docs](https://trusted-lower-gay-depend.trycloudflare.com/docs) | Public Swagger API documentation | **Active & Verified** |

---

## 📊 Model Performance Highlights
### Classification (Crop Stress Severity: Low, Moderate, High, Severe)
- **Random Forest (Tuned)**: **99.47% Accuracy**, **99.48% F1 Score**
- **Decision Tree (Tuned)**: **99.68% Accuracy**, **99.68% F1 Score**
- **Logistic Regression**: 96.11% Accuracy, 96.26% F1 Score
- **K-Nearest Neighbors (KNN)**: 92.54% Accuracy, 92.70% F1 Score
- **Naive Bayes**: 91.18% Accuracy, 91.40% F1 Score

### Regression
- **Irrigation Priority Index (0–100)**:
  - Polynomial Regression (Degree 2): **$R^2 = 0.9277$**, $MAE = 2.8594$
  - Linear Regression: $R^2 = 0.8178$, $MAE = 4.7517$
- **Water Deficit ($mm/day$)**:
  - Polynomial Regression (Degree 2): **$R^2 = 0.9004$**, $MAE = 0.1177\ mm/day$
  - Linear Regression: $R^2 = 0.6525$, $MAE = 0.2494\ mm/day$

### Clustering & Dimensionality Reduction
- **K-Means ($k=4$)**: Silhouette Score = **$0.1943$**, Davies-Bouldin Score = **$1.5908$**, Inertia = **$38,198.6$**
- **PCA**: 2 Principal Components capture **$54.93\%$** of national agricultural variance.

---

## 📁 Project Directory Structure
```
sdc_project/
├── data/
│   ├── raw/
│   │   ├── all_india_agricultural_raw.csv        # Genuine NASA POWER & Soil data (4,758 rows)
│   │   └── *_raw.json                            # Per-district raw API responses
│   ├── processed/
│   │   ├── all_india_agricultural_processed.csv  # Cleaned, standardized dataset (39 columns)
│   │   ├── agricultural_engineered_features.csv  # 14 engineered features + encoders
│   │   └── all_india_agricultural_clustered.csv  # Dataset with cluster IDs & PCA coordinates
│   ├── collect_data.py                           # Stage 2 data collection script
│   └── preprocess_data.py                        # Stage 3 preprocessing script
├── eda/
│   ├── eda_analysis.py                           # Stage 4 EDA generation script
│   └── plots/                                    # Publication-grade PNG graphs
│       ├── temperature_distribution.png
│       ├── rainfall_distribution.png
│       ├── soil_moisture_distribution.png
│       ├── crop_stress_distribution.png
│       ├── correlation_heatmap.png
│       └── regional_stress_comparison.png
├── models/
│   ├── prepare_features.py                       # Stage 5 feature selection & scaling script
│   └── train_and_evaluate.py                     # Stages 6-10 model training & tuning pipeline
├── backend/
│   ├── main.py                                   # Stage 11 FastAPI application
│   └── models/                                   # Stage 10 Joblib serialized models
│       ├── best_crop_stress_random_forest.joblib
│       ├── best_crop_stress_decision_tree.joblib
│       ├── best_crop_stress_knn.joblib
│       ├── logistic_regression.joblib
│       ├── naive_bayes.joblib
│       ├── linear_regression_water_deficit.joblib
│       ├── polynomial_regression_water_deficit.joblib
│       ├── linear_regression_irrigation_priority.joblib
│       ├── polynomial_regression_irrigation_priority.joblib
│       ├── kmeans_cluster.joblib
│       ├── pca_model.joblib
│       ├── crop_encoder.joblib
│       ├── stage_encoder.joblib
│       ├── feature_scaler.joblib
│       ├── model_features.joblib
│       └── model_metrics.json
├── frontend/                                     # Stages 12 & 13 User Interface
│   ├── index.html                                # Semantic HTML5 responsive layout
│   ├── style.css                                 # Modern CSS3 agricultural theme
│   └── app.js                                    # Live API integration & Chart.js charts
├── tests/
│   └── test_project.py                           # Stage 14 Automated 8-part test suite
├── STAGE_1_PROBLEM_DEFINITION.md                 # Stage 1 documentation
├── STAGE_2_DATA_COLLECTION.md                     # Stage 2 documentation
├── STAGE_3_DATA_PREPROCESSING.md                 # Stage 3 documentation
├── STAGE_4_EDA.md                                # Stage 4 documentation
├── STAGE_5_FEATURE_ENGINEERING.md                # Stage 5 documentation
├── STAGE_6_TO_10_MODEL_DEVELOPMENT.md            # Stages 6-10 documentation
├── STAGE_11_BACKEND_DEVELOPMENT.md               # Stage 11 documentation
├── STAGE_12_AND_13_FRONTEND_AND_INTEGRATION.md   # Stages 12-13 documentation
├── STAGE_14_TESTING.md                           # Stage 14 documentation
├── STAGE_15_AND_16_DEPLOYMENT_AND_URLS.md        # Stages 15-16 documentation
├── run_local.py                                  # One-click launcher script
├── requirements.txt                              # Python package dependencies
└── README.md                                     # Complete project documentation
```

---

## 🛠️ How to Run the Project
### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Local Server
```bash
python3 run_local.py
```
Open **[http://127.0.0.1:8000/app/](http://127.0.0.1:8000/app/)** in your web browser.

### 3. Run Automated Tests
```bash
python3 tests/test_project.py
```
All 8 test suites will execute and verify 100% pass rate.
