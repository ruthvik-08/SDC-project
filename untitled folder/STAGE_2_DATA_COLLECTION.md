# Stage 2: Data Collection & Nationwide Verification

## 1. Overview
Genuine agricultural datasets have been collected across **all geographic zones of India** (North, South, East, West, Central, Northeast) covering 26 representative agricultural districts in 19 states and union territories.

---

## 2. Verified Data Sources
1. **NASA POWER (Prediction of Worldwide Energy Resources - Agroclimatology)**:
   - **Endpoint**: `https://power.larc.nasa.gov/api/temporal/daily/point`
   - **Verification Status**: 200 OK across all coordinates.
   - **Parameters Retrieved**:
     - `T2M`: Daily Mean Temperature at 2m (°C)
     - `T2M_MAX`: Daily Maximum Temperature (°C)
     - `T2M_MIN`: Daily Minimum Temperature (°C)
     - `PRECTOTCORR`: Daily Precipitation / Rainfall (mm/day)
     - `RH2M`: Relative Humidity at 2m (%)
     - `GWETTOP`: Surface Soil Wetness / Moisture (0-5 cm, fraction 0 to 1)
     - `GWETROOT`: Root-Zone Soil Wetness / Moisture (0-100 cm, fraction 0 to 1)
     - `ALLSKY_SFC_SW_DWN`: All-Sky Surface Shortwave Solar Radiation ($MJ/m^2/day$)

2. **Soil Health Card Portal (Ministry of Agriculture & Farmers Welfare, Govt of India)**:
   - Real district soil classifications:
     - Soil Texture & Type (Alluvial, Black/Regur, Tarai, Mountain Loam, Red & Yellow, Desert Sandy, Coastal Alluvium, Laterite)
     - Soil pH and Organic Carbon (%)
     - Field Capacity ($FC$) and Permanent Wilting Point ($PWP$)

3. **FAO WaPOR & FAO Irrigation and Drainage Paper 56**:
   - Standard reference crop evapotranspiration coefficients ($K_c$) for Indian staple and cash crops:
     - Rice, Wheat, Sugarcane, Cotton, Maize, Pulses, Mustard, Groundnut
   - Standard crop phenological growth stages: Initial, Vegetative, Reproductive/Flowering, Maturity.

4. **ISRO Bhuvan & DiCRA (NABARD / UNDP / Govt of Telangana)**:
   - Vegetation canopy metrics and satellite Normalized Difference Vegetation Index (NDVI) baseline bounds.

---

## 3. Nationwide Coverage Summary
- **Total Districts**: 26
- **Total States Covered**: 19
- **Time Period**: 2023-06-01 to 2023-11-30 (183 consecutive days per district)
- **Total Observations**: 4,758 genuine daily agricultural records
- **Raw Storage Location**:
  - Combined CSV: `data/raw/all_india_agricultural_raw.csv`
  - Per-district raw JSON responses: `data/raw/*_raw.json`

### Geographic Distribution:
| Zone | Districts Covered | Representative States |
| :--- | :--- | :--- |
| **North** (6) | Ludhiana, Karnal, Varanasi, Meerut, Pantnagar, Anantnag | Punjab, Haryana, UP, Uttarakhand, J&K |
| **West** (7) | Jaipur, Jodhpur, Rajkot, Anand, Nashik, Solapur, Akola | Rajasthan, Gujarat, Maharashtra |
| **Central** (3) | Indore, Bhopal, Raipur | Madhya Pradesh, Chhattisgarh |
| **East** (4) | Patna, Burdwan, Cuttack, Ranchi | Bihar, West Bengal, Odisha, Jharkhand |
| **South** (5) | Guntur, Warangal, Dharwad, Thanjavur, Palakkad | Andhra Pradesh, Telangana, Karnataka, Tamil Nadu, Kerala |
| **Northeast** (1) | Jorhat | Assam |
