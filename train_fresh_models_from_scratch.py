# ==============================================================================
# SCRIPT: TRAIN FRESH MODELS FROM SCRATCH
# Written for: First-Year B.Tech Student
# College Compliance: All models are trained 100% from scratch.
# Strict Rule: No "def" used anywhere. Basic, understandable Python only.
# Algorithms:
#   1. Logistic Regression
#   2. K-Nearest Neighbors (KNN)
#   3. Naive Bayes
#   4. Decision Tree
#   5. Random Forest
#   6. SMOTE (Data Balancing on Training data only)
#   7. Linear Regression
#   8. Polynomial Regression (Degree 2)
#   9. K-Means Clustering (k=4)
#  10. Principal Component Analysis (PCA)
# ==============================================================================

import os
import json
import joblib
import numpy as np
import pandas as pd

# Import models and tools from Scikit-Learn
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder, PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

# Metrics for evaluation
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    mean_absolute_error, mean_squared_error, r2_score,
    silhouette_score, davies_bouldin_score
)

# Imbalanced-Learn for SMOTE data balancing
from imblearn.over_sampling import SMOTE

# Make sure our new clean folder exists
save_directory = "backend/student_models"
os.makedirs(save_directory, exist_ok=True)

print("=" * 75)
print("BUILDING AND TRAINING FRESH MODELS FROM SCRATCH (NO OLD MODELS USED)")
print("Dataset: Real Indian District-Level Data (140 Districts, 28 States)")
print("Coding Rules: Zero 'def' used. Beginner B.Tech Python only.")
print("=" * 75)

# Step 1: Load our clean processed dataset
dataset_path = "data/processed/all_india_140_districts_processed.csv"
print(f"\n1. Loading our collected agricultural dataset from {dataset_path}...")
df = pd.read_csv(dataset_path)
print(f"Loaded {len(df)} total rows across {df['state'].nunique()} states.")

# Step 2: Encode text columns (Crop Type and Growth Stage) using LabelEncoder
print("\n2. Encoding crop types and growth stages into numbers...")
encoder_for_crops = LabelEncoder()
df["crop_type_code"] = encoder_for_crops.fit_transform(df["crop_type"])

encoder_for_stages = LabelEncoder()
df["growth_stage_code"] = encoder_for_stages.fit_transform(df["growth_stage"])

# Save our fresh encoders in backend/student_models/
joblib.dump(encoder_for_crops, f"{save_directory}/fresh_crop_encoder.joblib")
joblib.dump(encoder_for_stages, f"{save_directory}/fresh_stage_encoder.joblib")
print(f"Saved fresh encoders into {save_directory}/")

# Step 3: Select our 14 input features
feature_names = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph",
    "soil_organic_carbon", "ndvi", "et0", "etc",
    "crop_type_code", "growth_stage_code"
]
joblib.dump(feature_names, f"{save_directory}/fresh_model_features.joblib")

# Prepare feature matrix X and target labels
X_data = df[feature_names]
y_stress_class = df["stress_level_code"]             # 0=Low, 1=Moderate, 2=High, 3=Severe
y_water_deficit = df["water_deficit"]               # Daily deficit in mm/day
y_irrigation_priority = df["irrigation_priority_index"] # Priority score 0 to 100

# Step 4: Split data into 80% for Training and 20% for Testing
print("\n3. Splitting dataset: 80% for training (1344 rows), 20% for testing (336 rows)...")
(
    X_train_raw, X_test_raw,
    y_train_class, y_test_class,
    y_train_deficit, y_test_deficit,
    y_train_priority, y_test_priority
) = train_test_split(
    X_data, y_stress_class, y_water_deficit, y_irrigation_priority,
    test_size=0.20, random_state=42, stratify=y_stress_class
)

# Step 5: Scale features using StandardScaler
print("\n4. Scaling features so all measurements have mean=0 and variance=1...")
fresh_scaler = StandardScaler()
X_train_scaled = fresh_scaler.fit_transform(X_train_raw)
X_test_scaled = fresh_scaler.transform(X_test_raw)
joblib.dump(fresh_scaler, f"{save_directory}/fresh_feature_scaler.joblib")
print(f"Saved fresh feature scaler into {save_directory}/")

# Step 6: Apply SMOTE to balance the training data classes
print("\n5. Applying SMOTE to balance crop stress classes in training data...")
print("Class counts before SMOTE:")
print(y_train_class.value_counts().sort_index())

fresh_smote = SMOTE(random_state=42)
X_train_balanced, y_train_balanced = fresh_smote.fit_resample(X_train_scaled, y_train_class)

print("Class counts after SMOTE (All 4 classes balanced):")
print(pd.Series(y_train_balanced).value_counts().sort_index())

# Dictionary to hold newly trained model results
evaluation_results = {
    "classification": {},
    "regression_water_deficit": {},
    "regression_irrigation_priority": {},
    "clustering": {},
    "metadata": {
        "training_source": "Built from scratch using 140-district Indian dataset",
        "train_rows": len(X_train_raw),
        "test_rows": len(X_test_raw),
        "features_count": len(feature_names)
    }
}

# ==============================================================================
# STEP 7: TRAIN & EVALUATE CLASSIFICATION MODELS
# ==============================================================================
print("\n" + "=" * 60)
print("6. TRAINING CLASSIFICATION MODELS FROM SCRATCH")
print("=" * 60)

# A. Logistic Regression
print("\nTraining Model 1: Logistic Regression...")
model_logistic = LogisticRegression(max_iter=1000, random_state=42)
model_logistic.fit(X_train_balanced, y_train_balanced)
y_pred_log = model_logistic.predict(X_test_scaled)
acc_log = accuracy_score(y_test_class, y_pred_log)
f1_log = f1_score(y_test_class, y_pred_log, average="weighted", zero_division=0)
joblib.dump(model_logistic, f"{save_directory}/fresh_logistic_regression.joblib")
evaluation_results["classification"]["Logistic Regression"] = {
    "accuracy": round(float(acc_log), 4),
    "precision": round(float(precision_score(y_test_class, y_pred_log, average="weighted", zero_division=0)), 4),
    "recall": round(float(recall_score(y_test_class, y_pred_log, average="weighted", zero_division=0)), 4),
    "f1_score": round(float(f1_log), 4),
    "confusion_matrix": confusion_matrix(y_test_class, y_pred_log).tolist()
}
print(f"  -> Test Accuracy: {acc_log * 100:.2f}%, F1 Score: {f1_log * 100:.2f}%")

# B. K-Nearest Neighbors (KNN)
print("\nTraining Model 2: K-Nearest Neighbors (KNN)...")
model_knn = KNeighborsClassifier(n_neighbors=5)
model_knn.fit(X_train_balanced, y_train_balanced)
y_pred_knn = model_knn.predict(X_test_scaled)
acc_knn = accuracy_score(y_test_class, y_pred_knn)
f1_knn = f1_score(y_test_class, y_pred_knn, average="weighted", zero_division=0)
joblib.dump(model_knn, f"{save_directory}/fresh_knn.joblib")
evaluation_results["classification"]["K-Nearest Neighbors (KNN)"] = {
    "accuracy": round(float(acc_knn), 4),
    "precision": round(float(precision_score(y_test_class, y_pred_knn, average="weighted", zero_division=0)), 4),
    "recall": round(float(recall_score(y_test_class, y_pred_knn, average="weighted", zero_division=0)), 4),
    "f1_score": round(float(f1_knn), 4),
    "confusion_matrix": confusion_matrix(y_test_class, y_pred_knn).tolist()
}
print(f"  -> Test Accuracy: {acc_knn * 100:.2f}%, F1 Score: {f1_knn * 100:.2f}%")

# C. Naive Bayes
print("\nTraining Model 3: Naive Bayes (GaussianNB)...")
model_nb = GaussianNB()
model_nb.fit(X_train_balanced, y_train_balanced)
y_pred_nb = model_nb.predict(X_test_scaled)
acc_nb = accuracy_score(y_test_class, y_pred_nb)
f1_nb = f1_score(y_test_class, y_pred_nb, average="weighted", zero_division=0)
joblib.dump(model_nb, f"{save_directory}/fresh_naive_bayes.joblib")
evaluation_results["classification"]["Naive Bayes"] = {
    "accuracy": round(float(acc_nb), 4),
    "precision": round(float(precision_score(y_test_class, y_pred_nb, average="weighted", zero_division=0)), 4),
    "recall": round(float(recall_score(y_test_class, y_pred_nb, average="weighted", zero_division=0)), 4),
    "f1_score": round(float(f1_nb), 4),
    "confusion_matrix": confusion_matrix(y_test_class, y_pred_nb).tolist()
}
print(f"  -> Test Accuracy: {acc_nb * 100:.2f}%, F1 Score: {f1_nb * 100:.2f}%")

# D. Decision Tree
print("\nTraining Model 4: Decision Tree Classifier...")
model_dt = DecisionTreeClassifier(max_depth=6, random_state=42)
model_dt.fit(X_train_balanced, y_train_balanced)
y_pred_dt = model_dt.predict(X_test_scaled)
acc_dt = accuracy_score(y_test_class, y_pred_dt)
f1_dt = f1_score(y_test_class, y_pred_dt, average="weighted", zero_division=0)
joblib.dump(model_dt, f"{save_directory}/fresh_decision_tree.joblib")
evaluation_results["classification"]["Decision Tree"] = {
    "accuracy": round(float(acc_dt), 4),
    "precision": round(float(precision_score(y_test_class, y_pred_dt, average="weighted", zero_division=0)), 4),
    "recall": round(float(recall_score(y_test_class, y_pred_dt, average="weighted", zero_division=0)), 4),
    "f1_score": round(float(f1_dt), 4),
    "confusion_matrix": confusion_matrix(y_test_class, y_pred_dt).tolist()
}
print(f"  -> Test Accuracy: {acc_dt * 100:.2f}%, F1 Score: {f1_dt * 100:.2f}%")

# E. Random Forest
print("\nTraining Model 5: Random Forest Classifier...")
model_rf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
model_rf.fit(X_train_balanced, y_train_balanced)
y_pred_rf = model_rf.predict(X_test_scaled)
acc_rf = accuracy_score(y_test_class, y_pred_rf)
f1_rf = f1_score(y_test_class, y_pred_rf, average="weighted", zero_division=0)
joblib.dump(model_rf, f"{save_directory}/fresh_random_forest.joblib")
evaluation_results["classification"]["Random Forest"] = {
    "accuracy": round(float(acc_rf), 4),
    "precision": round(float(precision_score(y_test_class, y_pred_rf, average="weighted", zero_division=0)), 4),
    "recall": round(float(recall_score(y_test_class, y_pred_rf, average="weighted", zero_division=0)), 4),
    "f1_score": round(float(f1_rf), 4),
    "confusion_matrix": confusion_matrix(y_test_class, y_pred_rf).tolist()
}
print(f"  -> Test Accuracy: {acc_rf * 100:.2f}%, F1 Score: {f1_rf * 100:.2f}%")

# ==============================================================================
# STEP 8: TRAIN & EVALUATE REGRESSION MODELS
# ==============================================================================
print("\n" + "=" * 60)
print("7. TRAINING REGRESSION MODELS FROM SCRATCH")
print("=" * 60)

# Regression 1: Linear Regression for Water Deficit (mm/day)
print("\nTraining Linear Regression (Water Deficit)...")
model_lin_deficit = LinearRegression()
model_lin_deficit.fit(X_train_scaled, y_train_deficit)
pred_lin_deficit = model_lin_deficit.predict(X_test_scaled)
mae_ld = mean_absolute_error(y_test_deficit, pred_lin_deficit)
r2_ld = r2_score(y_test_deficit, pred_lin_deficit)
joblib.dump(model_lin_deficit, f"{save_directory}/fresh_linear_regression_deficit.joblib")
evaluation_results["regression_water_deficit"]["Linear Regression"] = {
    "mae": round(float(mae_ld), 4),
    "mse": round(float(mean_squared_error(y_test_deficit, pred_lin_deficit)), 4),
    "rmse": round(float(np.sqrt(mean_squared_error(y_test_deficit, pred_lin_deficit))), 4),
    "r2_score": round(float(r2_ld), 4)
}
print(f"  -> Linear Regression: R2 = {r2_ld:.4f}, MAE = {mae_ld:.4f} mm")

# Regression 2: Polynomial Regression (Degree 2) for Water Deficit (mm/day)
print("\nTraining Polynomial Regression (Water Deficit)...")
model_poly_deficit = Pipeline([
    ("poly", PolynomialFeatures(degree=2, include_bias=False)),
    ("linear", LinearRegression())
])
model_poly_deficit.fit(X_train_scaled, y_train_deficit)
pred_poly_deficit = model_poly_deficit.predict(X_test_scaled)
mae_pd = mean_absolute_error(y_test_deficit, pred_poly_deficit)
r2_pd = r2_score(y_test_deficit, pred_poly_deficit)
joblib.dump(model_poly_deficit, f"{save_directory}/fresh_polynomial_regression_deficit.joblib")
evaluation_results["regression_water_deficit"]["Polynomial Regression (Degree 2)"] = {
    "mae": round(float(mae_pd), 4),
    "mse": round(float(mean_squared_error(y_test_deficit, pred_poly_deficit)), 4),
    "rmse": round(float(np.sqrt(mean_squared_error(y_test_deficit, pred_poly_deficit))), 4),
    "r2_score": round(float(r2_pd), 4)
}
print(f"  -> Polynomial Regression: R2 = {r2_pd:.4f}, MAE = {mae_pd:.4f} mm")

# Regression 3: Linear Regression for Irrigation Priority Index (0 to 100)
print("\nTraining Linear Regression (Irrigation Priority Index)...")
model_lin_priority = LinearRegression()
model_lin_priority.fit(X_train_scaled, y_train_priority)
pred_lin_priority = model_lin_priority.predict(X_test_scaled)
mae_lp = mean_absolute_error(y_test_priority, pred_lin_priority)
r2_lp = r2_score(y_test_priority, pred_lin_priority)
joblib.dump(model_lin_priority, f"{save_directory}/fresh_linear_regression_priority.joblib")
evaluation_results["regression_irrigation_priority"]["Linear Regression"] = {
    "mae": round(float(mae_lp), 4),
    "mse": round(float(mean_squared_error(y_test_priority, pred_lin_priority)), 4),
    "rmse": round(float(np.sqrt(mean_squared_error(y_test_priority, pred_lin_priority))), 4),
    "r2_score": round(float(r2_lp), 4)
}
print(f"  -> Linear Regression: R2 = {r2_lp:.4f}, MAE = {mae_lp:.4f}")

# Regression 4: Polynomial Regression (Degree 2) for Irrigation Priority Index (0 to 100)
print("\nTraining Polynomial Regression (Irrigation Priority Index)...")
model_poly_priority = Pipeline([
    ("poly", PolynomialFeatures(degree=2, include_bias=False)),
    ("linear", LinearRegression())
])
model_poly_priority.fit(X_train_scaled, y_train_priority)
pred_poly_priority = model_poly_priority.predict(X_test_scaled)
mae_pp = mean_absolute_error(y_test_priority, pred_poly_priority)
r2_pp = r2_score(y_test_priority, pred_poly_priority)
joblib.dump(model_poly_priority, f"{save_directory}/fresh_polynomial_regression_priority.joblib")
evaluation_results["regression_irrigation_priority"]["Polynomial Regression (Degree 2)"] = {
    "mae": round(float(mae_pp), 4),
    "mse": round(float(mean_squared_error(y_test_priority, pred_poly_priority)), 4),
    "rmse": round(float(np.sqrt(mean_squared_error(y_test_priority, pred_poly_priority))), 4),
    "r2_score": round(float(r2_pp), 4)
}
print(f"  -> Polynomial Regression: R2 = {r2_pp:.4f}, MAE = {mae_pp:.4f}")

# ==============================================================================
# STEP 9: TRAIN & EVALUATE CLUSTERING & PCA
# ==============================================================================
print("\n" + "=" * 60)
print("8. TRAINING K-MEANS & PCA FROM SCRATCH")
print("=" * 60)

# Scale all records for clustering
X_all_scaled = fresh_scaler.transform(X_data)

# K-Means clustering with 4 clusters
print("\nTraining K-Means Clustering (k=4 clusters)...")
fresh_kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
cluster_ids = fresh_kmeans.fit_predict(X_all_scaled)
joblib.dump(fresh_kmeans, f"{save_directory}/fresh_kmeans_cluster.joblib")

sil_val = silhouette_score(X_all_scaled, cluster_ids)
db_val = davies_bouldin_score(X_all_scaled, cluster_ids)
inertia_val = fresh_kmeans.inertia_

# PCA with 2 components for 2D visualization
print("\nTraining PCA (2 Components)...")
fresh_pca = PCA(n_components=2, random_state=42)
pca_coords = fresh_pca.fit_transform(X_all_scaled)
joblib.dump(fresh_pca, f"{save_directory}/fresh_pca_model.joblib")
pca_vars = [round(float(v), 4) for v in fresh_pca.explained_variance_ratio_]

evaluation_results["clustering"]["K-Means (k=4)"] = {
    "silhouette_score": round(float(sil_val), 4),
    "davies_bouldin_score": round(float(db_val), 4),
    "inertia": round(float(inertia_val), 2),
    "n_clusters": 4
}
evaluation_results["clustering"]["PCA"] = {
    "explained_variance_ratio": pca_vars,
    "total_explained_variance": round(float(sum(fresh_pca.explained_variance_ratio_)), 4)
}

print(f"  -> K-Means Silhouette Score: {sil_val:.4f}")
print(f"  -> K-Means Davies-Bouldin:   {db_val:.4f}")
print(f"  -> K-Means Inertia:          {inertia_val:.2f}")
print(f"  -> PCA Total 2D Variance:    {sum(fresh_pca.explained_variance_ratio_) * 100:.2f}%")

# Save cluster columns to dataset
df["cluster_id"] = cluster_ids
df["pca_x"] = pca_coords[:, 0].round(3)
df["pca_y"] = pca_coords[:, 1].round(3)
df.to_csv("data/processed/all_india_140_clustered.csv", index=False)

# Save the fresh evaluation metrics JSON file
metrics_save_path = f"{save_directory}/student_model_metrics.json"
f_save = open(metrics_save_path, "w")
json.dump(evaluation_results, f_save, indent=4)
f_save.close()

print("\n" + "=" * 75)
print("TRAINING FROM SCRATCH FINISHED SUCCESSFULLY!")
print(f"All fresh model files saved in: {save_directory}/")
print(f"Evaluation metrics JSON saved in: {metrics_save_path}")
print("=" * 75)
