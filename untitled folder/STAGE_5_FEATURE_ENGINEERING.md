# Stage 5: Feature Engineering

## 1. Overview
From the comprehensive preprocessed dataset, 14 key agronomic and meteorological features were engineered and selected.

---

## 2. Selected Feature Set
| # | Feature Name | Unit / Range | Type | Source & Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `temperature` | °C | Numerical | NASA POWER daily 2-meter air temperature. Drives basic plant metabolic rates. |
| 2 | `temp_max` | °C | Numerical | Maximum daily temperature. High temperatures ($>32^\circ C$) induce heat stress. |
| 3 | `temp_min` | °C | Numerical | Minimum daily temperature. Captures nighttime cooling and diurnal swings. |
| 4 | `rainfall` | mm/day | Numerical | Daily precipitation. Essential water source for rainfed crops. |
| 5 | `humidity` | % | Numerical | Relative atmospheric humidity. Inversely related to vapor pressure deficit. |
| 6 | `effective_soil_wetness`| 0.0 to 1.0 | Numerical | Combined topsoil and root-zone water wetness. Primary indicator of crop water availability. |
| 7 | `solar_radiation` | $MJ/m^2/day$| Numerical | Incoming solar radiation driving photosynthetic energy and evapotranspiration. |
| 8 | `soil_ph` | 5.4 to 8.4 | Numerical | Soil reaction from National Soil Health Card. Regulates nutrient and moisture uptake. |
| 9 | `soil_organic_carbon` | % | Numerical | Soil organic matter from Soil Health Card. Directly controls soil water holding capacity. |
| 10| `ndvi` | 0.15 to 0.88 | Numerical | Normalized Difference Vegetation Index. Tracks canopy density and health status. |
| 11| `et0` | mm/day | Numerical | FAO-56 Reference Evapotranspiration. Atmospheric evaporative demand. |
| 12| `etc` | mm/day | Numerical | Potential Crop Evapotranspiration ($K_c \times ET_0$). Peak crop water requirement. |
| 13| `crop_type_encoded` | 0 to 7 | Categorical | Encoded staple/cash crop: Rice, Wheat, Cotton, Sugarcane, Maize, Groundnut, Pulses, Mustard. |
| 14| `growth_stage_encoded`| 0 to 3 | Categorical | Encoded phenological stage: Initial, Vegetative, Reproductive, Maturity. |

---

## 3. Encoding and Feature Scaling
- **Categorical Encoders**:
  - `crop_encoder.joblib`: Maps crop names to integer indices [0..7].
  - `stage_encoder.joblib`: Maps growth stage names to integer indices [0..3].
- **Feature Scaler**:
  - `feature_scaler.joblib`: Standardizes all 14 input features to have zero mean and unit variance ($\mu=0, \sigma=1$).
- **Features List**:
  - `model_features.joblib`: Stores the exact ordered feature names used during training to ensure identical column ordering in the backend and frontend.
- **Storage Location**: All artifacts stored inside [backend/models/](file:///Users/p.ruthvik/Desktop/sdc_project/backend/models/).
