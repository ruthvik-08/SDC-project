# Stages 6–10: Model Selection, Training, Evaluation, Tuning & Saving

## 1. Stage 6: Model Selection
As strictly specified, the following models were selected and evaluated:

### 1.1 Regression Models
- **Linear Regression**: Ordinary Least Squares baseline.
- **Polynomial Regression (Degree 2)**: Captures non-linear meteorological interactions ($T \times RH$, Radiation $\times$ Moisture).

### 1.2 Classification Models (Crop Stress Severity: Low, Moderate, High, Severe)
- **Logistic Regression**: Linear multi-class decision boundary with Softmax.
- **K-Nearest Neighbors (KNN)**: Non-parametric distance-based neighbor voting.
- **Naive Bayes (Gaussian)**: Probabilistic conditional independence baseline.
- **Decision Tree**: Non-linear, interpretable hierarchical splitting (CART).
- **Random Forest**: Ensemble of bagging decision trees reducing variance.

### 1.3 Data Balancing
- **SMOTE (Synthetic Minority Over-sampling Technique)**: Applied strictly to the training partition only ($N=2,766$ balanced samples per class).

### 1.4 Clustering & Dimensionality Reduction
- **K-Means ($k=4$)**: Unsupervised clustering of regional agro-climatic zones.
- **Principal Component Analysis (PCA)**: Unsupervised linear projection reducing 14 dimensions to 2 principal components.

---

## 2. Stage 7: Model Training Details
- **Data Partition**: 80% Training ($N=3,806$), 20% Testing ($N=952$) with stratified splitting.
- **Feature Standardization**: `StandardScaler` applied to fit training distribution and transform test distribution.
- **SMOTE Balancing**:
  - Before SMOTE: Low ($2,766$), Moderate ($492$), High ($401$), Severe ($147$).
  - After SMOTE on Train: Low ($2,766$), Moderate ($2,766$), High ($2,766$), Severe ($2,766$).

---

## 3. Stage 8: Actual Model Evaluation Results

### 3.1 Classification Performance (Unseen Test Set $N=952$)
| Model | Accuracy | Precision (Weighted) | Recall (Weighted) | F1 Score (Weighted) |
| :--- | :--- | :--- | :--- | :--- |
| **Random Forest (Tuned)** | **99.47%** | **99.48%** | **99.47%** | **99.48%** |
| **Decision Tree (Tuned)** | **99.68%** | **99.68%** | **99.68%** | **99.68%** |
| **Logistic Regression** | 96.11% | 96.78% | 96.11% | 96.26% |
| **K-Nearest Neighbors (KNN)** | 92.54% | 93.10% | 92.54% | 92.70% |
| **Naive Bayes** | 91.18% | 92.06% | 91.18% | 91.40% |

#### Confusion Matrix (Random Forest Test Set):
```
Actual \ Predicted   Low   Moderate   High   Severe
Low                  690       2        0       0
Moderate               1     120        2       0
High                   0       0      100       0
Severe                 0       0        0      37
```

### 3.2 Regression Performance (Unseen Test Set)
#### Target: Water Deficit ($mm/day$)
| Model | MAE ($mm/day$) | MSE | RMSE ($mm/day$) | $R^2$ Score |
| :--- | :--- | :--- | :--- | :--- |
| **Linear Regression** | 0.2494 | 0.1300 | 0.3605 | 0.6525 |
| **Polynomial Regression (Degree 2)** | **0.1177** | **0.0372** | **0.1930** | **0.9004** |

#### Target: Irrigation Priority Index (0 to 100)
| Model | MAE | MSE | RMSE | $R^2$ Score |
| :--- | :--- | :--- | :--- | :--- |
| **Linear Regression** | 4.7517 | 34.392 | 5.8645 | 0.8178 |
| **Polynomial Regression (Degree 2)** | **2.8594** | **13.646** | **3.6941** | **0.9277** |

### 3.3 Clustering & PCA Metrics
- **K-Means ($k=4$)**:
  - **Silhouette Score**: $0.1943$
  - **Davies-Bouldin Score**: $1.5908$
  - **Inertia**: $38,198.58$
- **PCA (2 Components)**:
  - Component 1: $36.02\%$ explained variance
  - Component 2: $18.91\%$ explained variance
  - Total Explained Variance: **$54.93\%$**

---

## 4. Stage 9: Hyperparameter Tuning (GridSearchCV)
- **Random Forest**: Best Parameters: `{'max_depth': 12, 'min_samples_split': 2, 'n_estimators': 100}`, Test Accuracy = **$99.47\%$**
- **Decision Tree**: Best Parameters: `{'max_depth': 8, 'min_samples_leaf': 2}`, Test Accuracy = **$99.68\%$**
- **K-Nearest Neighbors**: Best Parameters: `{'n_neighbors': 3, 'weights': 'distance'}`, Test Accuracy = **$92.54\%$**

---

## 5. Stage 10: Model Saving
All models and preprocessing objects were serialized with **Joblib** into [backend/models/](file:///Users/p.ruthvik/Desktop/sdc_project/backend/models/):
- `best_crop_stress_random_forest.joblib`
- `best_crop_stress_decision_tree.joblib`
- `best_crop_stress_knn.joblib`
- `logistic_regression.joblib`
- `naive_bayes.joblib`
- `linear_regression_water_deficit.joblib`
- `polynomial_regression_water_deficit.joblib`
- `linear_regression_irrigation_priority.joblib`
- `polynomial_regression_irrigation_priority.joblib`
- `kmeans_cluster.joblib`
- `pca_model.joblib`
- `crop_encoder.joblib`
- `stage_encoder.joblib`
- `feature_scaler.joblib`
- `model_features.joblib`
- `model_metrics.json`
