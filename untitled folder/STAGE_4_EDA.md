# Stage 4: Exploratory Data Analysis (EDA)

## 1. Overview
Exploratory Data Analysis was conducted using **Pandas**, **Matplotlib**, and **Seaborn** to understand data distributions, regional variances, correlations, and stress patterns across India.

---

## 2. Key Statistical Insights
| Metric | Mean | Std Dev | Min | Median | Max | Agronomic Significance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Daily Temperature (°C)** | 26.58 | 4.48 | 2.37 | 26.96 | 40.99 | Hot tropical conditions in summer/Kharif; cool winters in North/Himalayas. |
| **Daily Rainfall (mm/day)** | 4.93 | 10.62 | 0.00 | 0.76 | 262.61 | Highly skewed; prolonged dry spells interspersed with heavy monsoon downpours. |
| **Relative Humidity (%)** | 72.98 | 15.08 | 16.61 | 77.60 | 96.07 | Coastal and eastern belts experience high RH (>80%); western arid zones drop <30%. |
| **Effective Soil Wetness** | 0.65 | 0.16 | 0.22 | 0.66 | 0.99 | Drops below critical 0.60 threshold during dry spells, triggering plant stress. |
| **Reference ET0 (mm/day)** | 4.41 | 0.89 | 2.50 | 4.33 | 7.54 | Demonstrates high atmospheric evaporative demand across agricultural plains. |
| **Crop ETc (mm/day)** | 4.27 | 1.16 | 1.44 | 4.21 | 7.92 | Peak demand during reproductive flowering for rice and sugarcane. |
| **CWSI (Stress Index)** | 0.08 | 0.13 | 0.00 | 0.00 | 0.63 | Quantifies transpiration shortfall ($1 - ET_a/ET_c$). |
| **NDVI (Vegetation Index)** | 0.66 | 0.20 | 0.19 | 0.72 | 0.88 | Captures canopy growth from early seedling (0.28) to lush reproduction (0.85). |
| **Irrigation Priority Index** | 22.43 | 14.02 | 4.00 | 19.35 | 73.70 | Objective ranking from 0 to 100 for irrigation release. |

---

## 3. Generated Visualizations
All high-resolution figures have been saved to [eda/plots/](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots):

1. **[temperature_distribution.png](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots/temperature_distribution.png)**:
   - Displays bell-shaped temperature distribution centered at $27^\circ C$, with regional boxplots highlighting cooler northern mountain zones vs warm southern and western plains.
2. **[rainfall_distribution.png](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots/rainfall_distribution.png)**:
   - Highlights the highly skewed nature of rainfall with heavy dry spells, contrasting the high precipitation of Northeast and Coastal belts with the dry Western arid zone.
3. **[soil_moisture_distribution.png](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots/soil_moisture_distribution.png)**:
   - Clearly marks the $0.60$ stress threshold and shows how surface moisture depletion leads to root-zone depletion.
4. **[crop_stress_distribution.png](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots/crop_stress_distribution.png)**:
   - Shows the authentic class distribution:
     - **Low Stress**: 3,458 observations (72.7%)
     - **Moderate Stress**: 615 observations (12.9%)
     - **High Stress**: 501 observations (10.5%)
     - **Severe Stress**: 184 observations (3.9%)
     - And Irrigation Priority breakdown: Low (3,658), Medium (834), High (250), Critical (16).
5. **[correlation_heatmap.png](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots/correlation_heatmap.png)**:
   - Strong negative correlation between Soil Wetness and CWSI ($-0.85$).
   - Strong positive correlation between Temperature and ET0 ($+0.78$).
   - Strong positive correlation between CWSI and Irrigation Priority Index ($+0.82$).
6. **[regional_stress_comparison.png](file:///Users/p.ruthvik/Desktop/sdc_project/eda/plots/regional_stress_comparison.png)**:
   - Compares crop stress severity proportions across North, South, East, West, Central, and Northeast India.
