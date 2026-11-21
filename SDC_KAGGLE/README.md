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

The notebook `SDC_Kaggle_Notebook.ipynb` executes the complete ML pipeline in 14 straightforward steps:

1. **Import Libraries**: Loads NumPy, Pandas, Matplotlib, Seaborn, Scikit-learn, and Joblib.
2. **Load Dataset**: Reads `krishijal_master_dataset.csv` from `/kaggle/input/` or local directory.
3. **Display Dataset Information**: Shows `.head()`, `.info()`, and `.describe()`.
4. **Check Missing Values**: Inspects missing counts across columns.
5. **Handle Missing Values**: Cleans missing records and drops duplicates.
6. **Remove Unnecessary Columns**: Selects core observable features.
7. **Encode Categorical Columns**: Uses `LabelEncoder` for `crop_type` and `growth_stage`.
8. **Visualizations**: Generates Count plots, Histograms, Correlation heatmaps, and Box plots.
9. **Train-Test Split & Scaling**: 80/20 train/test split with `StandardScaler`.
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
15. **Hyperparameter Tuning**: Performs simple tuning with `GridSearchCV`.
16. **Save Trained Models**: Saves `.pkl` model files to `/kaggle/working/models/saved_models/`.

---

## 3. How to Run on Kaggle

1. Go to [kaggle.com](https://www.kaggle.com) and click **+ Create** -> **New Dataset**.
2. Upload `krishijal_master_dataset.csv` and name the dataset `krishijal-dataset`.
3. Create a **New Notebook** (`+ Create` -> `New Notebook`).
4. In the right panel under **Input**, click **+ Add Input** and add your `krishijal-dataset`.
5. In the top menu, click **File** -> **Import Notebook**, and select `SDC_Kaggle_Notebook.ipynb`.
6. Click **Run All** (or press `Shift + Enter` on each cell).
7. The notebook will run all cells in order and save all trained models into `/kaggle/working/models/saved_models/`.
8. To download the saved models: In the right panel under **Output**, click the three dots next to `/kaggle/working/` and click **Download**.

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
