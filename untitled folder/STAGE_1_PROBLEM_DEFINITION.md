# Stage 1: Problem Definition

## Project Title
**All-India Crop Stress Detection and Irrigation Priority Allocation System**

---

## 1. Background and Context
Agriculture is the backbone of the Indian economy, employing nearly half of the nation's workforce and feeding 1.4 billion citizens. However, Indian agriculture faces two massive, interconnected challenges:
1. **Uneven Water Availability**: Over 50% of India's gross cropped area relies heavily on seasonal monsoon rains, which are increasingly erratic due to climate shifts.
2. **Groundwater Depletion & Over-Extraction**: In canal and tubewell-irrigated belts (such as Punjab, Haryana, and Tamil Nadu), ground tables are rapidly sinking. In drought-prone regions (such as Vidarbha, Marathwada, and Rayalaseema), acute water deficits lead to frequent crop failures.

When irrigation water is limited, district water boards, canal managers, and farmers must decide **where**, **when**, and **how much** water to release. Without scientific data, water is often allocated haphazardly, leading to crop loss in severely stressed fields while water is wasted in areas that do not immediately require it.

---

## 2. Project Objective
The primary objective of this project is to:
1. **Identify and Monitor Crop Stress Across All of India**:
   Cover all geographic zones (North, South, East, West, Central, Northeast) representing India's diverse agro-climatic zones.
2. **Predict Crop Water Stress Severity**:
   Classify agricultural regions into actionable stress categories:
   - **Low Stress (Normal / Healthy)**
   - **Moderate Stress (Monitoring Required)**
   - **High Stress (Irrigation Needed Soon)**
   - **Severe Stress (Emergency Irrigation Required)**
3. **Estimate Quantitative Water Deficit (Evapotranspiration & Moisture Deficit)**:
   Predict daily water requirement ($mm/day$) so farmers and irrigation engineers know the exact depth of water needed.
4. **Cluster Similar Agricultural Regions**:
   Group districts with similar climatic, soil, and stress characteristics using unsupervised learning (K-Means & PCA) to guide regional policy.
5. **Prioritise Irrigation Scheduling**:
   Generate an objective, rank-ordered **Irrigation Priority Index (IPI)** from 0 to 100 based on crop water stress, soil moisture deficit, temperature extremes, rainfall shortage, and crop growth stage vulnerability.

---

## 3. Scope of Nationwide Coverage
The system spans all major agro-climatic zones of India:
- **Northern Region**: Punjab (Ludhiana), Haryana (Karnal), Uttar Pradesh (Varanasi, Meerut), Uttarakhand (Pantnagar), Jammu & Kashmir (Anantnag).
- **Southern Region**: Andhra Pradesh (Guntur), Telangana (Warangal), Karnataka (Dharwad, Mandya), Tamil Nadu (Thanjavur, Coimbatore), Kerala (Palakkad).
- **Western Region**: Maharashtra (Nashik, Solapur, Akola), Gujarat (Anand, Rajkot), Rajasthan (Jaipur, Jodhpur).
- **Eastern Region**: Bihar (Patna), West Bengal (Burdwan), Odisha (Cuttack), Jharkhand (Ranchi).
- **Central Region**: Madhya Pradesh (Indore, Bhopal), Chhattisgarh (Raipur).
- **North-Eastern Region**: Assam (Jorhat), Meghalaya (Ri-Bhoi), Tripura (Agartala).

---

## 4. Key Agronomic and Meteorological Indicators
The system uses authentic physical principles:
- **Reference Evapotranspiration ($ET_0$)**: Water evaporated from soil and transpired by reference grass under local solar radiation, temperature, and humidity (FAO-56 standard).
- **Crop Evapotranspiration ($ET_c$)**: $ET_c = K_c \times ET_0$, where $K_c$ is the crop coefficient based on crop type (Rice, Wheat, Cotton, Sugarcane, Maize, Pulses, Mustard, Groundnut) and growth stage (Initial, Vegetative, Reproductive/Flowering, Maturity).
- **Soil Moisture Deficit**: Difference between Soil Field Capacity ($FC$) and actual Root-Zone Soil Moisture.
- **Crop Water Stress Index ($CWSI$)**: Standard metric quantifying the gap between potential crop water demand and actual soil moisture supply:
  $$CWSI = 1 - \frac{Actual\ Evapotranspiration}{Potential\ Evapotranspiration}$$

---

## 5. First-Year B.Tech Presentation Summary
- **Input**: Daily weather measurements (Temperature, Rainfall, Humidity, Solar Radiation), Soil parameters (Soil Type, Root Moisture, Field Capacity), and Crop factors (Crop Type, Growth Stage).
- **Output**:
  1. Crop Stress Level (Classification).
  2. Daily Water Deficit in $mm$ (Regression).
  3. Regional Clustered Zones (Clustering).
  4. Irrigation Priority Rank & Recommendations (Actionable Advisory).
