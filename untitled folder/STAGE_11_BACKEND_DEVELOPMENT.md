# Stage 11: Backend Development (FastAPI)

## 1. Overview
The backend is built using **FastAPI** (`backend/main.py`), designed with clear, beginner-friendly Python code and structured REST endpoints.

---

## 2. API Endpoints Architecture
| HTTP Method | Route | Description | Input / Output |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | API Health & System Information | Returns API status, version, and route links. |
| `GET` | `/api/dataset/info` | Nationwide Dataset Summary | Returns counts, national averages ($T, Rain, Soil, ET_0$), and distributions. |
| `GET` | `/api/districts` | District Directory | List of 26 Indian districts with GPS coordinates, zones, and staple crops. |
| `POST` | `/api/predict/crop-stress` | Real-Time Prediction | Predicts Crop Stress Level (Classification), Water Deficit (Regression), and IPI. |
| `GET` | `/api/clusters/regions` | Regional Agro-Climatic Clusters | K-Means ($k=4$) cluster assignments, 2D PCA coordinates, and agronomic profiles. |
| `GET` | `/api/irrigation/priority`| Irrigation Priority Table | Rank-ordered districts by Irrigation Priority Index (0–100) with depth advisory. |
| `GET` | `/api/models/evaluation` | Real Model Metrics | Actual Accuracy, Precision, Recall, F1, MAE, RMSE, $R^2$, and Confusion Matrices. |
| `GET` | `/app` | Frontend Static Mount | Serves the user interface directly on the same web server. |

---

## 3. Real-Time Prediction Request Payload Schema
```json
{
  "temperature": 33.5,
  "temp_max": 39.0,
  "temp_min": 26.0,
  "rainfall": 0.0,
  "humidity": 35.0,
  "effective_soil_wetness": 0.32,
  "solar_radiation": 22.0,
  "soil_ph": 8.0,
  "soil_organic_carbon": 0.35,
  "crop_type": "Cotton",
  "growth_stage": "Reproductive",
  "selected_model": "Random Forest"
}
```

## 4. Real-Time Prediction Response
```json
{
  "crop_stress_level": "High",
  "crop_stress_code": 2,
  "model_used": "Random Forest",
  "probabilities_percentage": {
    "Low": 0.0,
    "Moderate": 4.0,
    "High": 88.0,
    "Severe": 8.0
  },
  "predicted_water_deficit_mm_per_day": 3.42,
  "irrigation_priority_index": 62.4,
  "irrigation_priority_level": "High Priority",
  "urgency_color": "#ff7f0e",
  "recommendation": "Crop canopy is stressed and transpiration is suppressed. Apply 30–40 mm irrigation immediately.",
  "calculated_agronomic_indicators": {
    "reference_et0_mm": 5.48,
    "crop_etc_mm": 6.03,
    "estimated_ndvi": 0.58
  }
}
```
