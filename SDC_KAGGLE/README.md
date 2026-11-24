# SDC Machine Learning Project — Kaggle & Render Deployment Guide

This repository contains the beginner-friendly Machine Learning workflow for **KrishiJal: Crop Stress and Irrigation Priority Decision Support System**.

The project follows a clean academic architecture:
**Kaggle → Model Training → Saved Models → GitHub → Render → FastAPI → Postman / Frontend**

---

## 1. Allowed Libraries

* `pandas` — Data loading and tabular data manipulation
* `numpy` — Mathematical array calculations
* `matplotlib.pyplot` — Visual plots (Count plots, histograms, scatter plots)
* `seaborn` — Statistical visualizations (Heatmaps, box plots)
* `scikit-learn` — Preprocessing, classification, regression, and evaluation
* `joblib` — Model persistence and loading
* `fastapi` & `uvicorn` & `pydantic` — API backend and data validation

---

## 2. Machine Learning Workflow in Kaggle

The notebook `SDC_Kaggle_Notebook.ipynb` executes the complete ML pipeline across 32 beginner-friendly code cells with zero comments and zero markdown cells:

### Original Benchmarks (159 Districts & 1,331 Test Samples)
1. **Import Libraries**: Loads NumPy, Pandas, Matplotlib, Seaborn, Scikit-learn (KMeans, PCA, Random Forest), and Joblib.
2. **Load Master Dataset**: Reads `krishijal_master_dataset.csv` from `/kaggle/input/` or local directory.
3. **Display Dataset Information**: Shows `.head()`, `.info()`, and `.describe()`.
4. **Check Missing Values**: Inspects missing counts across columns.
5. **Handle Missing Values**: Cleans missing records and drops duplicates.
6. **Feature Selection**: Selects 14 observable agronomic and weather features.
7. **Encode Categorical Columns**: Uses `LabelEncoder` for `crop_type` and `growth_stage`.
8. **Visualizations**: Generates Count plots, Histograms, Correlation heatmaps, and Box plots.
9. **Train-Test Split & Scaling**: 80/20 train/test split with `StandardScaler` (1,331 test samples).
10. **Train Classification Models**:
    - Logistic Regression
    - Decision Tree Classifier
    - Random Forest Classifier
11. **Compare Classification Performance**: Evaluates Accuracy, Precision, Recall, and F1-Score.
12. **Evaluate with Confusion Matrix**: Visualizes prediction outcomes for the Random Forest classifier.
13. **Train Regression Models**:
    - Linear Regression
    - Decision Tree Regressor
    - Random Forest Regressor
14. **Compare Regression Performance & Actual vs Predicted**: Evaluates MAE, MSE, RMSE, and R² Score, with a scatter plot.
15. **Hyperparameter Tuning**: Performs parameter tuning with `GridSearchCV`.
16. **Save Trained Models**: Saves `.pkl` model files with `joblib.dump()`.

### All-India 732-District Expansion
17. **Load 732 Districts Dataset**: Reads `india_district_agriculture.csv` covering all 732 districts of India.
18. **Feature Vector Derivation**: Computes the 14 required physical and agronomic features for all 732 districts.
19. **All-India Priority Ranking**: Generates Random Forest regression and classification predictions, ranks districts from Rank 1 to Rank 732, and categorizes into High, Medium, and Low Priority.
20. **Top 10 Districts Priority Chart**: Plots the top 10 highest irrigation priority districts in India.
21. **Priority Distribution Summary**: Displays exact distribution counts across priority categories.
22. **Agro-Climatic K-Means Clustering (K=4)**: Performs unsupervised clustering into 4 agro-climatic zones with `KMeans(n_clusters=4, random_state=42)`.
23. **2D PCA Projection**: Projects all 732 districts onto 2 principal components with explained variance calculation.
24. **2D PCA Scatter Visualization**: Plots the 732-district cluster distribution with distinct color styling.
25. **Empirical Zone Characterization**: Computes mean temperature, rainfall, humidity, soil moisture, and priority index for each zone.
26. **Export Full Dataset**: Exports `all_india_732_districts_priority_and_clusters.csv` with all 732 ranked districts.

---

## 3. How to Update Your Existing Kaggle Notebook (Preserve Identity & URL)

To update your existing Kaggle notebook without creating a duplicate or changing its URL:

1. Open your existing notebook on [kaggle.com](https://www.kaggle.com) in your browser.
2. In the top editor menu bar, click **File** -> **Upload Notebook** (or **Import Notebook**).
3. Select your local file: `SDC_KAGGLE/SDC_Kaggle_Notebook.ipynb`.
4. Kaggle will replace the notebook contents in-place, keeping your existing URL, title, metadata, version history, and attached datasets.
5. Click **Save Version** -> Choose **Save & Run All (Commit)** -> Click **Save**.
6. The notebook will run all 32 cells from start to finish, generating all benchmark tables, plots, 732-district rankings, K-Means clusters, PCA projection, and saving all trained models to `/kaggle/working/`.

---

## 4. Deploying FastAPI on Render

1. Commit and push your saved models and code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Update models and beginner-friendly FastAPI backend"
   git push origin main
   ```
2. Log in to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository (`SDC-project`).
5. Configure the service:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Click **Create Web Service**.
7. Render will automatically build the service, install dependencies, load the models, and launch the application.

---

## 5. Testing API Endpoints in Postman

Once deployed on Render (or locally at `http://127.0.0.1:8000`), test the following endpoints:

### Endpoint 1: Health Check
* **Method**: `GET`
* **URL**: `https://<your-render-app>.onrender.com/health` (or `http://127.0.0.1:8000/health`)
* **Expected Response**:
```json
{
  "status": "healthy",
  "api_operational": true,
  "models_loaded": {
    "crop_stress_classifier": true,
    "irrigation_priority_regressor": true,
    "feature_scaler": true,
    "crop_stress_decision_tree": true,
    "crop_stress_logistic_regression": true,
    "irrigation_decision_tree": true,
    "irrigation_linear_regression": true
  },
  "dataset_records": 6654,
  "districts_covered": 159,
  "states_covered": 37
}
```

---

### Endpoint 2: Crop Stress & Irrigation Prediction
* **Method**: `POST`
* **URL**: `https://<your-render-app>.onrender.com/predict` (or `http://127.0.0.1:8000/predict`)
* **Headers**: `Content-Type: application/json`
* **Body** (`raw` JSON):
```json
{
  "temperature": 34.0,
  "rainfall": 0.0,
  "humidity": 45.0,
  "effective_soil_wetness": 0.28,
  "crop_type": "Cotton",
  "growth_stage": "Reproductive"
}
```
* **Expected Response**:
```json
{
  "status": "success",
  "crop_stress_prediction": {
    "stress_level_code": 2,
    "stress_level": "High",
    "condition_summary": "High stress, significant water deficit impacting crop growth."
  },
  "irrigation_priority_prediction": {
    "irrigation_priority_index": 52.4,
    "priority_category": "High Priority",
    "recommended_irrigation_depth": "35–45 mm",
    "actionable_farmer_advisory": "HIGH: Rapid soil moisture depletion observed. Schedule irrigation within 24–48 hours."
  }
}
```

---

### Endpoint 3: Interactive Swagger UI Documentation
* **Method**: `GET` in your web browser
* **URL**: `https://<your-render-app>.onrender.com/docs` (or `http://127.0.0.1:8000/docs`)
* Provides interactive documentation where you can inspect all parameters and execute sample requests directly.
