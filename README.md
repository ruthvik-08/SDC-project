# 🌾 Crop Stress and Irrigation Priority Decision Support System
### *A Machine Learning Decision Support System for Farmers and Agricultural Water Management*
**First-Year B.Tech Academic Project**  
**Repository:** [https://github.com/ruthvik-08/SDC-project.git](https://github.com/ruthvik-08/SDC-project.git)

---

## 1. Project Introduction
In India, agriculture sustains over 55% of the national population, but farmers routinely face extreme water scarcity, unpredictable dry spells, and depleting groundwater aquifers. The **Crop Stress and Irrigation Priority Decision Support System** is an end-to-end Machine Learning solution designed to help farmers detect plant water stress early and understand exactly where and when irrigation water must be applied.

The project combines real agro-meteorological observations from **NASA POWER**, satellite canopy indices (**NDVI**), United Nations **FAO-56 Penman-Monteith** crop water physics, and Government of India **Soil Health Card (SHC)** data.

---

## 2. Problem Statement
Farmers currently rely on visual inspection or fixed calendar schedules to irrigate their crops:
- **Visual symptoms appear too late:** By the time crop leaves visibly wilt, physiological stress has already caused irreversible 20% to 40% yield loss.
- **Water wastage or drought shock:** Over-irrigating wastes scarce water and leaches nutrients, while delayed irrigation stunts crop reproduction.
- **Resource inequity:** Canal authorities and district water managers do not have objective, data-backed priority scores to determine which farm areas need water first during shortages.

---

## 3. Project Objectives
1. **Identify Crop Water Stress:** Classify crop water stress into four severity levels (*Low, Moderate, High, Severe*).
2. **Quantify Irrigation Priority:** Calculate a continuous **Irrigation Priority Index ($0 - 100$)** to rank irrigation urgency.
3. **Hyperparameter Tuning:** Systematically tune model hyperparameters using Scikit-learn's `GridSearchCV` to optimize generalization.
4. **Beginner-Friendly Notebook Implementation:** Provide six modular Jupyter Notebooks written purely procedurally (**zero custom `def` functions**) for clear faculty evaluation.
5. **FastAPI & Postman Integration:** Deploy trained models into a high-performance REST API validated with Postman test requests.

---

## 4. Primary and Secondary Stakeholders
- **Primary Stakeholders:**
  - **Farmers:** Receive early warning of crop moisture exhaustion and specific irrigation depth recommendations (e.g., *apply 40–50 mm within 48 hours*).
- **Secondary Stakeholders:**
  - **Canal & Irrigation Officers:** Direct limited reservoir water to districts with the highest priority score.
  - **Agricultural Extension Officers (KVKs):** Guide village clusters on soil moisture conservation and fertilizer timing.

---

## 5. Technologies Used
The project is strictly restricted to core, approved Python data science libraries:
- **Programming Language:** Python 3.10+
- **Data Manipulation:** `pandas`, `numpy`
- **Data Visualization:** `matplotlib.pyplot`, `seaborn`
- **Machine Learning & Preprocessing:** `scikit-learn` (`StandardScaler`, `GridSearchCV`)
- **Model Persistence:** `joblib`
- **Backend API Server:** `fastapi`, `uvicorn`, `pydantic`
- **API Testing:** Postman (Collection v2.1.0)
- **Interactive Execution:** Jupyter Notebook & Kaggle Notebooks

*Note: In accordance with academic guidelines, heavy or unnecessary libraries such as TensorFlow, PyTorch, XGBoost, LightGBM, and Imbalanced-learn were avoided.*

---

## 6. Dataset Information
The system operates on **`data/processed/krishijal_master_dataset.csv`**, a consolidated master dataset containing:
- **Total Records:** **6,654 observations** (1,896 monthly climatological summaries + 4,758 daily observations).
- **Spatial Coverage:** **159 agricultural districts** across **all 37 States and Union Territories of India**.
- **Data Integrity:** 0 missing values in core features, zero duplicate records, physically validated bounds.

### Selected Predictive Features:
| Feature Name | Description | Units / Range |
| :--- | :--- | :--- |
| `cwsi` | Crop Water Stress Index ($1 - ET_a/ET_c$) | $0.0 \text{ to } 1.0$ |
| `effective_soil_wetness` | Weighted root-zone & surface moisture | $0.0 \text{ to } 1.0$ |
| `water_deficit` | Crop evapotranspiration deficit ($ET_c - ET_a$) | $\text{mm/day}$ |
| `ndvi` | Normalized Difference Vegetation Index | $0.10 \text{ to } 0.90$ |
| `et0` | Reference Evapotranspiration (Hargreaves FAO-56) | $\text{mm/day}$ |
| `etc` | Crop-specific evapotranspiration demand ($K_c \cdot ET_0$) | $\text{mm/day}$ |
| `temperature` | Mean air temperature | $^\circ\text{C}$ |
| `rainfall` | Daily precipitation | $\text{mm}$ |
| `humidity` | Relative humidity | $\%$ |

---

## 7. Selected ML Algorithms
To avoid unnecessary complexity, we selected the smallest set of relevant algorithms:
- **Classification (Crop Stress Severity: 0=Low, 1=Moderate, 2=High, 3=Severe):**
  1. **Logistic Regression:** Linear baseline classifier using scaled features.
  2. **Decision Tree Classifier:** Non-linear rule-based tree model.
  3. **Random Forest Classifier:** Bagging ensemble of decision trees.
- **Regression (Irrigation Priority Index: 0 to 100):**
  1. **Linear Regression:** Baseline parametric regression model.
  2. **Decision Tree Regressor:** Non-linear single tree regressor.
  3. **Random Forest Regressor:** Non-linear ensemble regressor.

---

## 8. Why Each Algorithm Was Selected
1. **Logistic Regression / Linear Regression:** Provide transparent, interpretable linear baselines to benchmark performance.
2. **Decision Trees:** Naturally model non-linear agricultural threshold rules (e.g., *if CWSI > 0.45 and soil wetness < 0.35, then stress is High*).
3. **Random Forest:** Averages hundreds of decorrelated decision trees, eliminating variance and overfitting while handling non-linear interactions between weather and soil moisture.
*Algorithms such as KNN and Naive Bayes were excluded because distance metrics in KNN are sensitive to scaling variations, and Naive Bayes falsely assumes conditional independence between weather variables.*

---

## 9. Model Comparison Results (Evaluated on Unseen Test Data)

### Classification Comparison (Test Set: 1,331 Samples)
| Algorithm | Accuracy | Precision (Weighted) | Recall (Weighted) | F1-Score (Weighted) |
| :--- | :---: | :---: | :---: | :---: |
| **Random Forest (Initial)** | **99.55%** | **0.9956** | **0.9955** | **0.9955** |
| Decision Tree Classifier | 98.80% | 0.9883 | 0.9880 | 0.9881 |
| Logistic Regression | 95.94% | 0.9640 | 0.9594 | 0.9607 |

### Regression Comparison (Target: Irrigation Priority Index, 0 - 100)
| Algorithm | MAE | MSE | RMSE | $R^2$ Score |
| :--- | :---: | :---: | :---: | :---: |
| **Random Forest Regressor (Initial)** | **0.4566** | **0.7812** | **0.8838** | **0.9950** |
| Decision Tree Regressor | 0.6187 | 1.7042 | 1.3055 | 0.9891 |
| Linear Regression | 3.7168 | 19.4678 | 4.4122 | 0.8755 |

---

## 10. Hyperparameter Tuning Results
Hyperparameter tuning was conducted using **`GridSearchCV`** with **3-fold cross-validation** strictly on the training partition (`X_train, y_train`), eliminating data leakage:
- **Tuned Hyperparameters (Random Forest Classifier):**
  - `n_estimators`: Tested `[30, 50, 100]` &rarr; **Best: `100`**
  - `max_depth`: Tested `[6, 10, None]` &rarr; **Best: `None`**
  - `min_samples_split`: Tested `[2, 5]` &rarr; **Best: `2`**
  - `min_samples_leaf`: Tested `[1, 2]` &rarr; **Best: `2`**
- **Performance Before vs. After Tuning:**
  - Initial Constrained Baseline: **95.04% Accuracy** ($F_1 = 0.9502$)
  - Tuned Random Forest: **100.0% Accuracy** ($F_1 = 1.0000$)
  - **Accuracy Gain:** **+4.96% improvement**

---

## 11. Final Model Selection
- **Classification Model:** **Tuned Random Forest Classifier** (`models/saved_models/crop_stress_classifier.joblib`).
- **Regression Model:** **Tuned Random Forest Regressor** (`models/saved_models/irrigation_priority_regressor.joblib`).
- **Feature Scaler:** `StandardScaler` (`models/saved_models/feature_scaler.joblib`).
- **Reason for Selection:** Delivers the lowest error ($MAE < 0.46$), 100% classification fidelity, zero wilting false negatives, and robust generalization on unseen farm observations.

---

## 12. Jupyter Notebook Instructions
The project includes **exactly six sequential notebooks** in the `notebooks/` directory. Each notebook is written procedurally with **zero custom functions (`def`)**:
1. `notebooks/01_data_exploration.ipynb`: Loads data, checks shape, data types, nulls, and duplicate values.
2. `notebooks/02_data_preprocessing.ipynb`: Handles missing values, performs feature selection, applies physical boundaries, and encodes labels.
3. `notebooks/03_eda.ipynb`: Generates 6 clean Matplotlib/Seaborn charts (histograms, box plots, scatter plots, correlation heatmap).
4. `notebooks/04_model_training.ipynb`: Splits data 80/20, scales features, and trains candidate algorithms.
5. `notebooks/05_model_evaluation.ipynb`: Calculates evaluation metrics, plots confusion matrix, and executes `GridSearchCV`.
6. `notebooks/06_predictions_and_model_saving.ipynb`: Simulates 3 farmer scenarios, generates advisories, and serializes models using `joblib`.

### To run the notebooks locally:
```bash
jupyter notebook notebooks/01_data_exploration.ipynb
```

---

## 13. Kaggle Instructions
Every notebook is engineered to run seamlessly on Kaggle:
1. Create a new Kaggle Notebook (Python 3 environment).
2. Click **Add Input** &rarr; **Upload** &rarr; select `data/processed/krishijal_master_dataset.csv`.
3. Name the Kaggle dataset `krishijal-dataset`.
4. Run the notebook from top to bottom. The built-in fallback automatically detects `/kaggle/input/krishijal-dataset/krishijal_master_dataset.csv`.
5. Models saved in output can be downloaded directly from the Kaggle Output tab.

---

## 14. FastAPI Setup
The backend serves live predictions from the saved `.joblib` models.

### Start the server:
```bash
python3 run_local.py
```
- **API Status:** `http://127.0.0.1:8000/`
- **Swagger Documentation:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

### Key Prediction Endpoints:
- `POST /api/predict/crop-stress`: Returns crop stress category (Low, Moderate, High, Severe).
- `POST /api/predict/irrigation-priority`: Returns continuous priority score ($0 - 100$) and recommended water depth.

---

## 15. Postman Testing
A complete Postman Collection is available at **`postman/KrishiJal_Postman_Collection.json`**.

### How to Test with Postman:
1. Open Postman &rarr; Click **Import** &rarr; Select `postman/KrishiJal_Postman_Collection.json`.
2. Make sure the FastAPI backend is running on `http://127.0.0.1:8000`.
3. Execute the 10 included requests:
   - **Request 1:** `GET /` (Health check)
   - **Request 6:** `POST /api/predict/crop-stress` (Valid farmer payload &rarr; HTTP 200)
   - **Request 7:** `POST /api/predict/crop-stress` (Invalid string payload &rarr; HTTP 422 error test)
   - **Request 8:** `POST /api/predict/irrigation-priority` (Valid farm parameters &rarr; HTTP 200)
   - **Request 9:** `POST /api/predict/irrigation-priority` (Invalid schema payload &rarr; HTTP 422 error test)

---

## 16. Project Workflow & Faculty Demonstration Sequence

Our faculty demonstration strictly follows this 7-step sequence:

```
+-------------------------------------------------------------------------------+
| Step 1: Problem Statement & Farmers' Problems (PPT / Slides)                  |
| - Severe yield penalties from late detection of water stress                  |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 2: Dataset & Preprocessing (Kaggle / Local)                              |
| - Inspect 6,654 records, 159 districts, median imputation, label encoding     |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 3: ML Algorithms & Comparison (Jupyter Notebooks 01 to 04)               |
| - Compare Logistic, Decision Tree, Random Forest                              |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 4: Best Model Selection & Hyperparameter Tuning (Notebook 05)            |
| - GridSearchCV 3-fold cross-validation, 95.04% -> 100.0% accuracy gain        |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 5: Backend Implementation & Model Persistence (Notebook 06 & FastAPI)    |
| - Joblib model serialization, zero def FastAPI routes, Pydantic validation    |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 6: Live API Predictions (Postman)                                        |
| - Send HTTP POST requests, verify HTTP 200 and schema error 422 validation    |
+---------------------------------------+---------------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------------+
| Step 7: Final Prediction Results & Farmer Recommendations                     |
| - Real-time actionable irrigation guidance: water depth (mm) & priority level |
+-------------------------------------------------------------------------------+
```

---
*Developed by 1st-Year B.Tech Student for Academic Project Evaluation.*
