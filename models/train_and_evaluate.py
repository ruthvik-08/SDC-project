"""
Stages 6 - 10: Model Selection, Training, Evaluation, Hyperparameter Tuning & Saving
Author: First-Year B.Tech Student Project
Algorithms Used (STRICTLY as specified):
 - Regression: Linear Regression, Polynomial Regression
 - Classification: Logistic Regression, KNN, Naive Bayes, Decision Tree, Random Forest
 - Data Balancing: SMOTE (applied ONLY on training data)
 - Clustering & Dimensionality Reduction: K-Means, PCA
Evaluation Metrics:
 - Regression: MAE, MSE, RMSE, R2 Score
 - Classification: Accuracy, Precision, Recall, F1 Score, Confusion Matrix
 - Clustering: Silhouette Score, Davies-Bouldin Score, Inertia
Tuning: GridSearchCV
Saving: Joblib inside backend/models/
"""

import os
import json
import joblib
import numpy as np
import pandas as pd

# Scikit-learn models and metrics
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    silhouette_score, davies_bouldin_score
)

# Imbalanced-learn for SMOTE
from imblearn.over_sampling import SMOTE

# Output directory for saved models
MODEL_DIR = "backend/models"
os.makedirs(MODEL_DIR, exist_ok=True)

print("=" * 80)
print("STAGES 6 - 10: MACHINE LEARNING MODEL PIPELINE")
print("=" * 80)

# Load engineered dataset
DATA_PATH = "data/processed/agricultural_engineered_features.csv"
df = pd.read_csv(DATA_PATH)
print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")

# Load model feature list, scaler, and encoders
feature_cols = joblib.load(os.path.join(MODEL_DIR, "model_features.joblib"))
scaler = joblib.load(os.path.join(MODEL_DIR, "feature_scaler.joblib"))
crop_encoder = joblib.load(os.path.join(MODEL_DIR, "crop_encoder.joblib"))
stage_encoder = joblib.load(os.path.join(MODEL_DIR, "stage_encoder.joblib"))

print(f"Features used for modeling ({len(feature_cols)} total):")
for i, feat in enumerate(feature_cols, 1):
    print(f"  {i}. {feat}")

# Feature matrix X
X = df[feature_cols].copy()

# Target variables
y_class = df["stress_level_code"].copy()          # 0=Low, 1=Moderate, 2=High, 3=Severe
y_deficit = df["water_deficit"].copy()            # Continuous daily water deficit (mm/day)
y_priority = df["irrigation_priority_index"].copy() # Continuous 0 to 100

# -----------------------------------------------------------------------------
# STAGE 7: DATA SPLITTING & SMOTE BALANCING
# -----------------------------------------------------------------------------
print("\n" + "-" * 60)
print("STAGE 7: DATA SPLITTING & SMOTE BALANCING")
print("-" * 60)

# Simultaneously split features and all targets so row indices match perfectly
(
    X_train_raw, X_test_raw,
    y_train_class, y_test_class,
    y_train_def, y_test_def,
    y_train_ipi, y_test_ipi
) = train_test_split(
    X, y_class, y_deficit, y_priority,
    test_size=0.20, random_state=42, stratify=y_class
)

# Standardize numerical features using the fitted scaler
X_train_scaled = scaler.transform(X_train_raw)
X_test_scaled = scaler.transform(X_test_raw)

print(f"Training set size: {X_train_raw.shape[0]} samples")
print(f"Testing set size:  {X_test_raw.shape[0]} samples")
print("\nTraining Class Distribution BEFORE SMOTE:")
class_labels = ["Low", "Moderate", "High", "Severe"]
for code, count in y_train_class.value_counts().sort_index().items():
    print(f" - {class_labels[code]} (Code {code}): {count} samples")

# Apply SMOTE ONLY to training data (preserving pure authentic test set)
smote = SMOTE(random_state=42)
X_train_smote, y_train_smote = smote.fit_resample(X_train_scaled, y_train_class)

print("\nTraining Class Distribution AFTER SMOTE (Balanced):")
for code, count in pd.Series(y_train_smote).value_counts().sort_index().items():
    print(f" - {class_labels[code]} (Code {code}): {count} samples")

# Dictionary to hold all evaluation results for reporting and frontend
evaluation_metrics = {
    "classification": {},
    "regression_water_deficit": {},
    "regression_irrigation_priority": {},
    "clustering": {},
    "dataset_summary": {
        "total_records": len(df),
        "train_samples": len(X_train_raw),
        "test_samples": len(X_test_raw),
        "features_count": len(feature_cols)
    }
}

# -----------------------------------------------------------------------------
# STAGES 6, 7 & 8: CLASSIFICATION MODELS & EVALUATION
# -----------------------------------------------------------------------------
print("\n" + "=" * 80)
print("TRAINING & EVALUATION: CLASSIFICATION MODELS (Crop Stress Severity)")
print("=" * 80)

classification_models = {
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "K-Nearest Neighbors (KNN)": KNeighborsClassifier(n_neighbors=5),
    "Naive Bayes": GaussianNB(),
    "Decision Tree": DecisionTreeClassifier(max_depth=6, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
}

trained_classifiers = {}

for name, model in classification_models.items():
    print(f"\nTraining {name}...")
    # Train on SMOTE-balanced training set
    model.fit(X_train_smote, y_train_smote)
    trained_classifiers[name] = model
    
    # Predict on unseen test set
    y_pred = model.predict(X_test_scaled)
    
    # Calculate evaluation metrics
    acc = accuracy_score(y_test_class, y_pred)
    prec = precision_score(y_test_class, y_pred, average="weighted", zero_division=0)
    rec = recall_score(y_test_class, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_test_class, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_test_class, y_pred).tolist()
    
    evaluation_metrics["classification"][name] = {
        "accuracy": round(float(acc), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1_score": round(float(f1), 4),
        "confusion_matrix": cm
    }
    
    print(f"  -> Accuracy:  {acc * 100:.2f}%")
    print(f"  -> Precision: {prec * 100:.2f}%")
    print(f"  -> Recall:    {rec * 100:.2f}%")
    print(f"  -> F1 Score:  {f1 * 100:.2f}%")

# -----------------------------------------------------------------------------
# STAGES 6, 7 & 8: REGRESSION MODELS & EVALUATION
# -----------------------------------------------------------------------------
print("\n" + "=" * 80)
print("TRAINING & EVALUATION: REGRESSION MODELS")
print("=" * 80)

# Target 1: Water Deficit (mm/day)
print("\n--- Target 1: Water Deficit (mm/day) ---")
# 1. Linear Regression
lin_reg_def = LinearRegression()
lin_reg_def.fit(X_train_scaled, y_train_def)
y_pred_lin_def = lin_reg_def.predict(X_test_scaled)

mae_ld = mean_absolute_error(y_test_def, y_pred_lin_def)
mse_ld = mean_squared_error(y_test_def, y_pred_lin_def)
rmse_ld = np.sqrt(mse_ld)
r2_ld = r2_score(y_test_def, y_pred_lin_def)

evaluation_metrics["regression_water_deficit"]["Linear Regression"] = {
    "mae": round(float(mae_ld), 4),
    "mse": round(float(mse_ld), 4),
    "rmse": round(float(rmse_ld), 4),
    "r2_score": round(float(r2_ld), 4)
}
print(f"Linear Regression -> R²: {r2_ld:.4f}, MAE: {mae_ld:.4f} mm/day, RMSE: {rmse_ld:.4f}")

# 2. Polynomial Regression (Degree 2)
poly_reg_def = Pipeline([
    ("poly_features", PolynomialFeatures(degree=2, include_bias=False)),
    ("linear_model", LinearRegression())
])
poly_reg_def.fit(X_train_scaled, y_train_def)
y_pred_poly_def = poly_reg_def.predict(X_test_scaled)

mae_pd = mean_absolute_error(y_test_def, y_pred_poly_def)
mse_pd = mean_squared_error(y_test_def, y_pred_poly_def)
rmse_pd = np.sqrt(mse_pd)
r2_pd = r2_score(y_test_def, y_pred_poly_def)

evaluation_metrics["regression_water_deficit"]["Polynomial Regression (Degree 2)"] = {
    "mae": round(float(mae_pd), 4),
    "mse": round(float(mse_pd), 4),
    "rmse": round(float(rmse_pd), 4),
    "r2_score": round(float(r2_pd), 4)
}
print(f"Polynomial Regression (Degree 2) -> R²: {r2_pd:.4f}, MAE: {mae_pd:.4f} mm/day, RMSE: {rmse_pd:.4f}")

# Target 2: Irrigation Priority Index (0 to 100)
print("\n--- Target 2: Irrigation Priority Index (0 to 100) ---")
# 1. Linear Regression
lin_reg_ipi = LinearRegression()
lin_reg_ipi.fit(X_train_scaled, y_train_ipi)
y_pred_lin_ipi = lin_reg_ipi.predict(X_test_scaled)

mae_li = mean_absolute_error(y_test_ipi, y_pred_lin_ipi)
mse_li = mean_squared_error(y_test_ipi, y_pred_lin_ipi)
rmse_li = np.sqrt(mse_li)
r2_li = r2_score(y_test_ipi, y_pred_lin_ipi)

evaluation_metrics["regression_irrigation_priority"]["Linear Regression"] = {
    "mae": round(float(mae_li), 4),
    "mse": round(float(mse_li), 4),
    "rmse": round(float(rmse_li), 4),
    "r2_score": round(float(r2_li), 4)
}
print(f"Linear Regression -> R²: {r2_li:.4f}, MAE: {mae_li:.4f}, RMSE: {rmse_li:.4f}")

# 2. Polynomial Regression (Degree 2)
poly_reg_ipi = Pipeline([
    ("poly_features", PolynomialFeatures(degree=2, include_bias=False)),
    ("linear_model", LinearRegression())
])
poly_reg_ipi.fit(X_train_scaled, y_train_ipi)
y_pred_poly_ipi = poly_reg_ipi.predict(X_test_scaled)

mae_pi = mean_absolute_error(y_test_ipi, y_pred_poly_ipi)
mse_pi = mean_squared_error(y_test_ipi, y_pred_poly_ipi)
rmse_pi = np.sqrt(mse_pi)
r2_pi = r2_score(y_test_ipi, y_pred_poly_ipi)

evaluation_metrics["regression_irrigation_priority"]["Polynomial Regression (Degree 2)"] = {
    "mae": round(float(mae_pi), 4),
    "mse": round(float(mse_pi), 4),
    "rmse": round(float(rmse_pi), 4),
    "r2_score": round(float(r2_pi), 4)
}
print(f"Polynomial Regression (Degree 2) -> R²: {r2_pi:.4f}, MAE: {mae_pi:.4f}, RMSE: {rmse_pi:.4f}")

# -----------------------------------------------------------------------------
# STAGES 6, 7 & 8: CLUSTERING & DIMENSIONALITY REDUCTION (K-Means & PCA)
# -----------------------------------------------------------------------------
print("\n" + "=" * 80)
print("TRAINING & EVALUATION: CLUSTERING & PCA (Agro-Climatic Regions)")
print("=" * 80)

# Scale full dataset for clustering
X_all_scaled = scaler.transform(X)

# K-Means Clustering (k=4 clusters)
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_all_scaled)

sil_score = silhouette_score(X_all_scaled, cluster_labels)
db_score = davies_bouldin_score(X_all_scaled, cluster_labels)
inertia_val = kmeans.inertia_

evaluation_metrics["clustering"]["K-Means (k=4)"] = {
    "silhouette_score": round(float(sil_score), 4),
    "davies_bouldin_score": round(float(db_score), 4),
    "inertia": round(float(inertia_val), 2),
    "n_clusters": 4
}

print(f"K-Means Clustering (k=4):")
print(f"  -> Silhouette Score:     {sil_score:.4f} (Higher is better, -1 to +1)")
print(f"  -> Davies-Bouldin Score: {db_score:.4f} (Lower is better)")
print(f"  -> Inertia:              {inertia_val:.2f}")

# PCA (Dimensionality reduction to 2 components for 2D visualization)
pca = PCA(n_components=2, random_state=42)
X_pca = pca.fit_transform(X_all_scaled)
var_explained = pca.explained_variance_ratio_

evaluation_metrics["clustering"]["PCA"] = {
    "explained_variance_ratio": [round(float(v), 4) for v in var_explained],
    "total_explained_variance": round(float(sum(var_explained)), 4)
}

print(f"\nPrincipal Component Analysis (PCA):")
print(f"  -> Component 1 Explained Variance: {var_explained[0] * 100:.2f}%")
print(f"  -> Component 2 Explained Variance: {var_explained[1] * 100:.2f}%")
print(f"  -> Total 2D Explained Variance:    {sum(var_explained) * 100:.2f}%")

# Save cluster labels into the processed data for backend regional queries
df["cluster_id"] = cluster_labels
df["pca_x"] = X_pca[:, 0].round(3)
df["pca_y"] = X_pca[:, 1].round(3)
df.to_csv("data/processed/all_india_agricultural_clustered.csv", index=False)
print("Saved clustered data with PCA coordinates to data/processed/all_india_agricultural_clustered.csv")

# -----------------------------------------------------------------------------
# STAGE 9: HYPERPARAMETER TUNING (GridSearchCV)
# -----------------------------------------------------------------------------
print("\n" + "=" * 80)
print("STAGE 9: HYPERPARAMETER TUNING (GridSearchCV)")
print("=" * 80)

# 1. Tune Random Forest Classifier
print("Tuning Random Forest Classifier with GridSearchCV...")
rf_param_grid = {
    "n_estimators": [50, 100, 150],
    "max_depth": [6, 8, 12],
    "min_samples_split": [2, 5]
}
rf_grid = GridSearchCV(
    RandomForestClassifier(random_state=42),
    rf_param_grid,
    cv=3,
    scoring="accuracy",
    n_jobs=-1
)
rf_grid.fit(X_train_smote, y_train_smote)
best_rf = rf_grid.best_estimator_
best_rf_acc = accuracy_score(y_test_class, best_rf.predict(X_test_scaled))

print(f"  -> Best Random Forest Parameters: {rf_grid.best_params_}")
print(f"  -> Tuned Random Forest Test Accuracy: {best_rf_acc * 100:.2f}%")

# 2. Tune K-Nearest Neighbors Classifier
print("\nTuning K-Nearest Neighbors with GridSearchCV...")
knn_param_grid = {
    "n_neighbors": [3, 5, 7, 9],
    "weights": ["uniform", "distance"]
}
knn_grid = GridSearchCV(
    KNeighborsClassifier(),
    knn_param_grid,
    cv=3,
    scoring="accuracy",
    n_jobs=-1
)
knn_grid.fit(X_train_smote, y_train_smote)
best_knn = knn_grid.best_estimator_
best_knn_acc = accuracy_score(y_test_class, best_knn.predict(X_test_scaled))

print(f"  -> Best KNN Parameters: {knn_grid.best_params_}")
print(f"  -> Tuned KNN Test Accuracy: {best_knn_acc * 100:.2f}%")

# 3. Tune Decision Tree Classifier
print("\nTuning Decision Tree with GridSearchCV...")
dt_param_grid = {
    "max_depth": [4, 6, 8, 10],
    "min_samples_leaf": [1, 2, 4]
}
dt_grid = GridSearchCV(
    DecisionTreeClassifier(random_state=42),
    dt_param_grid,
    cv=3,
    scoring="accuracy",
    n_jobs=-1
)
dt_grid.fit(X_train_smote, y_train_smote)
best_dt = dt_grid.best_estimator_
best_dt_acc = accuracy_score(y_test_class, best_dt.predict(X_test_scaled))

print(f"  -> Best Decision Tree Parameters: {dt_grid.best_params_}")
print(f"  -> Tuned Decision Tree Test Accuracy: {best_dt_acc * 100:.2f}%")

evaluation_metrics["tuning"] = {
    "Random Forest": {
        "best_params": rf_grid.best_params_,
        "best_cv_score": round(float(rf_grid.best_score_), 4),
        "tuned_test_accuracy": round(float(best_rf_acc), 4)
    },
    "KNN": {
        "best_params": knn_grid.best_params_,
        "best_cv_score": round(float(knn_grid.best_score_), 4),
        "tuned_test_accuracy": round(float(best_knn_acc), 4)
    },
    "Decision Tree": {
        "best_params": dt_grid.best_params_,
        "best_cv_score": round(float(dt_grid.best_score_), 4),
        "tuned_test_accuracy": round(float(best_dt_acc), 4)
    }
}

# -----------------------------------------------------------------------------
# STAGE 10: SAVE TRAINED MODELS USING JOBLIB IN backend/models/
# -----------------------------------------------------------------------------
print("\n" + "=" * 80)
print("STAGE 10: SAVING ALL MODELS USING JOBLIB")
print("=" * 80)

# Save classification models
joblib.dump(best_rf, os.path.join(MODEL_DIR, "best_crop_stress_random_forest.joblib"))
joblib.dump(best_knn, os.path.join(MODEL_DIR, "best_crop_stress_knn.joblib"))
joblib.dump(best_dt, os.path.join(MODEL_DIR, "best_crop_stress_decision_tree.joblib"))
joblib.dump(trained_classifiers["Logistic Regression"], os.path.join(MODEL_DIR, "logistic_regression.joblib"))
joblib.dump(trained_classifiers["Naive Bayes"], os.path.join(MODEL_DIR, "naive_bayes.joblib"))

# Save regression models
joblib.dump(lin_reg_def, os.path.join(MODEL_DIR, "linear_regression_water_deficit.joblib"))
joblib.dump(poly_reg_def, os.path.join(MODEL_DIR, "polynomial_regression_water_deficit.joblib"))
joblib.dump(lin_reg_ipi, os.path.join(MODEL_DIR, "linear_regression_irrigation_priority.joblib"))
joblib.dump(poly_reg_ipi, os.path.join(MODEL_DIR, "polynomial_regression_irrigation_priority.joblib"))

# Save clustering & PCA models
joblib.dump(kmeans, os.path.join(MODEL_DIR, "kmeans_cluster.joblib"))
joblib.dump(pca, os.path.join(MODEL_DIR, "pca_model.joblib"))

# Save comprehensive metrics JSON for FastAPI backend and Frontend
metrics_file_path = os.path.join(MODEL_DIR, "model_metrics.json")
with open(metrics_file_path, "w") as f:
    json.dump(evaluation_metrics, f, indent=4)

print(f"All models successfully saved in: {MODEL_DIR}")
print(f"Evaluation metrics JSON saved in: {metrics_file_path}")

print("\n" + "=" * 80)
print("FINAL PIPELINE COMPLETE!")
print("=" * 80)
