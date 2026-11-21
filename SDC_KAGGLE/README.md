# SDC Machine Learning Project — Kaggle & FastAPI Deployment Guide

This guide describes how to run the KrishiJal Machine Learning pipeline and deploy the FastAPI backend on Kaggle Notebooks with public Ngrok tunneling.

---

## 1. Uploading the Dataset to Kaggle

1. Sign in to your account at [kaggle.com](https://www.kaggle.com).
2. In the left navigation sidebar, click **Datasets**, then click **New Dataset** (or **+ Create** -> **New Dataset**).
3. Set the Dataset Title to: `krishijal-dataset`.
4. Upload the dataset file: `data/processed/krishijal_master_dataset.csv` (or drag and drop it from your project folder).
5. Click **Create** to finalize the upload.

---

## 2. Setting Up and Executing the Kaggle Notebook

1. In Kaggle, click **+ Create** -> **New Notebook**.
2. On the right-hand panel under **Input**, click **+ Add Input**.
3. Search for your uploaded dataset (`krishijal-dataset`) and click **Add**.
4. In the top menu bar, click **File** -> **Import Notebook**, and select:
   `SDC_KAGGLE/SDC_Kaggle_Notebook.ipynb`
5. Verify that the Notebook settings use:
   - **Environment**: Python 3
   - **Accelerator**: None / CPU (or GPU if preferred)
   - **Internet**: **Must be toggled ON** (in the right panel under *Settings* -> *Internet* -> *Turn on*) so that Uvicorn and Ngrok can connect to the web.
6. Run the notebook cells sequentially from top to bottom by clicking **Run All** or executing each cell with `Shift + Enter`.

---

## 3. Configuring Ngrok Authentication

1. Obtain your free Ngrok AuthToken from your dashboard at [dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
2. You can provide the token in either of two ways:
   - **Interactive Prompt**: When executing Cell 20, an input prompt will ask: `Enter Ngrok AuthToken:`. Paste your token and press `Enter`.
   - **Kaggle Secrets**: In the notebook menu, go to **Add-ons** -> **Secrets**, add a secret named `NGROK_AUTHTOKEN`, and paste your token value.
3. The notebook will automatically authenticate with Ngrok without saving or hardcoding your token into the code.

---

## 4. Starting the FastAPI Application

1. The notebook automatically trains the machine learning models and saves them to `/kaggle/working/models/saved_models/`.
2. It starts the Uvicorn server in a non-blocking background thread on port 8000.
3. `nest_asyncio` ensures that the FastAPI event loop runs smoothly inside the Jupyter environment.
4. The server stays online for the duration of the active Kaggle notebook session.

---

## 5. Obtaining the Public URL

When Cell 20 executes, it prints your live public endpoints:

```
https://<unique-subdomain>.ngrok-free.dev
https://<unique-subdomain>.ngrok-free.dev/docs
https://<unique-subdomain>.ngrok-free.dev/health
```

- **Interactive API Documentation (Swagger UI)**: Open `https://<unique-subdomain>.ngrok-free.dev/docs` in your browser.
- **Health Check**: Open `https://<unique-subdomain>.ngrok-free.dev/health` to verify that all classification and regression models are loaded and active.

---

## 6. Testing Prediction Endpoints Using Postman

### Request 1: Health Check
* **Method**: `GET`
* **URL**: `https://<your-ngrok-url>.ngrok-free.dev/health`
* **Expected Status**: `200 OK`
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

### Request 2: Crop Stress & Irrigation Prediction (Primary Endpoint)
* **Method**: `POST`
* **URL**: `https://<your-ngrok-url>.ngrok-free.dev/predict`
* **Headers**:
  - `Content-Type: application/json`
* **Body** (`raw` JSON):
```json
{
  "temperature": 34.0,
  "temp_max": 39.5,
  "temp_min": 25.0,
  "rainfall": 0.0,
  "humidity": 45.0,
  "effective_soil_wetness": 0.28,
  "solar_radiation": 22.0,
  "soil_ph": 7.5,
  "soil_organic_carbon": 0.48,
  "crop_type": "Cotton",
  "growth_stage": "Reproductive"
}
```
* **Expected Status**: `200 OK`
* **Expected Response**:
```json
{
  "status": "success",
  "input_features": {
    "temperature": 34.0,
    "temp_max": 39.5,
    "temp_min": 25.0,
    "rainfall": 0.0,
    "humidity": 45.0,
    "effective_soil_wetness": 0.28,
    "solar_radiation": 22.0,
    "soil_ph": 7.5,
    "soil_organic_carbon": 0.48,
    "ndvi": 0.606,
    "et0": 5.48,
    "etc": 6.03,
    "crop_code": 1.0,
    "stage_code": 2.0
  },
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

### Request 3: Interactive Crop Stress Simulator
* **Method**: `POST`
* **URL**: `https://<your-ngrok-url>.ngrok-free.dev/api/predict/crop-stress`
* **Headers**:
  - `Content-Type: application/json`
* **Body** (`raw` JSON):
```json
{
  "temperature": 33.0,
  "rainfall": 0.0,
  "effective_soil_wetness": 0.25,
  "selected_model": "Random Forest"
}
```
* **Expected Status**: `200 OK`

---

## 7. Downloading Saved Models from Kaggle

After the notebook runs, all trained models are stored in `/kaggle/working/models/saved_models/`:
- `crop_stress_classifier.pkl`
- `irrigation_priority_regressor.pkl`
- `feature_scaler.pkl`
- `crop_stress_decision_tree.pkl`
- `crop_stress_logistic_regression.pkl`
- `irrigation_decision_tree.pkl`
- `irrigation_linear_regression.pkl`

To download them:
1. In the right panel of the Kaggle notebook, click on **Output**.
2. Locate the `/kaggle/working/` folder.
3. Click the three dots next to any model file or folder and select **Download**.
