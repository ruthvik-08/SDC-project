# Stages 12 & 13: Frontend Development & Model Integration

## 1. Overview
The user interface is designed in vanilla HTML5, CSS3, and JavaScript (`index.html`, `style.css`, `app.js`). It is hosted directly on the FastAPI server at `/app` or can run independently in any browser.

---

## 2. User Interface Modules
1. **Top Status Bar & KPI Cards**:
   - Status Indicator: Dynamically connects to FastAPI backend and displays live connectivity.
   - Real-time KPI Cards: Total coverage (26 districts, 19 states), Average National Temperature ($26.58^\circ C$), Average Rainfall ($4.93\ mm$), Average Soil Wetness ($0.65$), Potential Crop Evapotranspiration ($4.27\ mm/day$), and Mean Irrigation Priority Index ($22.4/100$).
2. **Interactive Prediction Studio (Tab 1)**:
   - Preset buttons for representative districts:
     - **Solapur** (Maharashtra drought-prone pulses belt)
     - **Jodhpur** (Rajasthan arid mustard belt)
     - **Ludhiana** (Punjab Indo-Gangetic rice/wheat belt)
     - **Guntur** (Andhra Pradesh Krishna basin cotton belt)
     - **Jorhat** (Assam Northeast humid rice belt)
   - Field parameter inputs: Temperature, Temp Max/Min, Daily Rainfall, Relative Humidity, Soil Wetness, Solar Radiation, Soil pH, Soil Organic Carbon, Staple Crop, Phenological Growth Stage.
   - Algorithm selector: Random Forest (99.47%), Decision Tree (99.68%), Logistic Regression (96.11%), KNN (92.54%), Naive Bayes (91.18%).
   - Live Results Panel:
     - Crop Stress Severity Level (Color-coded: Green = Low, Yellow = Moderate, Orange = High, Red = Severe).
     - Irrigation Priority Index ($0$ to $100$) with graphical progress meter.
     - Predicted Quantitative Water Deficit ($mm/day$) via Polynomial Regression.
     - Potential Crop Evapotranspiration ($ET_c$) and Canopy NDVI.
     - Model confidence probability breakdown bars.
     - Actionable agronomic recommendation for farmers and irrigation engineers.
3. **All-India Irrigation Water Allocation Priority Table (Tab 2)**:
   - Rank-ordered table of all 26 districts based on objective Irrigation Priority Index.
   - Filterable by zone: North, South, East, West, Central, Northeast.
   - Displays rank, district, state, zone, staple crop, priority score, status badge, recommended water depth ($mm$), soil moisture, and CWSI.
4. **Agro-Climatic Regional Clustering & PCA (Tab 3)**:
   - Unsupervised K-Means ($k=4$) cluster profile cards.
   - Table of all districts with cluster assignments and 2D PCA coordinates `(pca_x, pca_y)`.
5. **Model Evaluation & Benchmarking (Tab 4)**:
   - Live evaluation tables displaying actual test metrics for all classification models (Accuracy, Precision, Recall, F1) and regression models (MAE, MSE, RMSE, $R^2$).
   - Clustering Silhouette Score ($0.1943$), Davies-Bouldin Score ($1.5908$), Inertia ($38,198.6$), and PCA variance ($54.93\%$).
   - GridSearchCV tuning summaries for Random Forest, KNN, and Decision Tree.
6. **Charts & Visualizations (Tab 5)**:
   - Interactive Chart.js charts:
     - Crop Stress Distribution (Bar chart).
     - Irrigation Priority Distribution (Doughnut chart).
     - Regional Daily Rainfall by Zone (Bar chart).
     - Machine Learning Classifier Accuracy Benchmarks (Bar chart).

---

## 3. Frontend-Backend Integration
All frontend displays consume live responses from FastAPI endpoints:
- `GET /` $\rightarrow$ Health status
- `GET /api/dataset/info` $\rightarrow$ KPI summary & distributions
- `POST /api/predict/crop-stress` $\rightarrow$ Real-time predictions
- `GET /api/irrigation/priority` $\rightarrow$ Allocation table
- `GET /api/clusters/regions` $\rightarrow$ Regional clustering
- `GET /api/models/evaluation` $\rightarrow$ Performance metrics
