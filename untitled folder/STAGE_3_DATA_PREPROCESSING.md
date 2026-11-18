# Stage 3: Data Preprocessing

## 1. Overview
The raw data gathered from NASA POWER, the National Soil Health Card portal, and FAO WaPOR was preprocessed using **Pandas** and **NumPy**. All steps were designed to be robust, reproducible, and easy to explain.

---

## 2. Preprocessing Steps Completed
1. **Dataset Loading**:
   - Loaded `data/raw/all_india_agricultural_raw.csv` containing 4,758 rows and 20 attributes across 26 districts.
2. **Duplicate Detection & Removal**:
   - Checked for duplicate date-district rows using `df.drop_duplicates()`.
   - Result: 0 duplicates found (data integrity verified).
3. **Missing Value Handling**:
   - NASA POWER sensor missing flag (`-999.0`) was checked.
   - Any missing numerical values were imputed using the district-specific median, with global median fallback.
   - Final missing values across all columns: **0**.
4. **Data Type Correction & Standardisation**:
   - Converted `date` column into `pd.to_datetime`.
   - Extracted temporal components: `year`, `month`, `day`, `day_of_year`.
   - Trimmed and title-cased string columns (`district`, `state`, `zone`, `soil_type`, `crop_type`).
5. **Crop Calendar & Phenological Growth Stage Assignment**:
   - Mapped 183 days of the Kharif crop cycle into 4 standard FAO agronomic stages:
     - **Initial** (Days 1–30): Germination & early seedling
     - **Vegetative** (Days 31–75): Active tillering and stem elongation
     - **Reproductive** (Days 76–135): Flowering, pollination, grain/boll formation (critical water sensitivity)
     - **Maturity** (Days 136–183): Grain filling, ripening, and harvesting
6. **FAO-56 Physical Computations**:
   - Reference Evapotranspiration ($ET_0$) via FAO Hargreaves radiation-temperature formulation ($mm/day$).
   - Potential Crop Evapotranspiration: $ET_c = K_c \times ET_0$.
   - Effective Soil Wetness: $\theta_{eff} = 0.5 \times \text{surface} + 0.5 \times \text{root}$.
   - Transpiration reduction coefficient ($K_s$) and Actual Evapotranspiration ($ET_a$).
   - Crop Water Stress Index: $CWSI = 1 - (ET_a / ET_c)$.
   - Daily Water Deficit in $mm/day$.
   - Realistic NDVI canopy dynamics.
7. **Categorical Labeling & Priority Index**:
   - Crop Stress Level: **Low** (3,458), **Moderate** (615), **High** (501), **Severe** (184).
   - Irrigation Priority Index ($IPI$ from 0 to 100): **Low** (3,658), **Medium** (834), **High** (250), **Critical** (16).
8. **Processed CSV File Saved**:
   - Stored at `data/processed/all_india_agricultural_processed.csv`.
