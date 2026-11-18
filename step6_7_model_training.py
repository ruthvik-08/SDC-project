# ==============================================================================
# STEPS 6 & 7: MODEL SELECTION & MODEL TRAINING SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Models Trained:
#   - Classification: Logistic Regression, KNN, Naive Bayes, Decision Tree, Random Forest
#   - Data Balancing: SMOTE (applied strictly on training data only)
#   - Regression: Linear Regression, Polynomial Regression (Degree 2)
#   - Clustering & Dimensionality: K-Means (k=4), PCA (2 components)
# ==============================================================================

import json
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.metrics import silhouette_score, davies_bouldin_score
from imblearn.over_sampling import SMOTE

print("=" * 70)
print("STEPS 6 & 7: MODEL TRAINING (COLLEGE SYLLABUS MODELS)")
print("=" * 70)

# Load engineered dataset
data_file = "data/processed/all_india_140_engineered_features.csv"
print(f"Loading data from: {data_file}")
df = pd.read_csv(data_file)

# Select the scaled feature columns
feature_cols = [
    "temperature_scaled", "temp_max_scaled", "temp_min_scaled", "rainfall_scaled", "humidity_scaled",
    "effective_soil_wetness_scaled", "solar_radiation_scaled", "soil_ph_scaled", "soil_organic_carbon_scaled",
    "ndvi_scaled", "et0_scaled", "etc_scaled", "crop_code_scaled", "stage_code_scaled"
]

X = df[feature_cols]
y_class = df["stress_level_code"]
y_deficit = df["water_deficit"]
y_priority = df["irrigation_priority_index"]

# Split data into 80% Training and 20% Testing sets
# We pass X, y_class, y_deficit, y_priority in one call so rows align perfectly
X_train, X_test, y_train_c, y_test_c, y_train_def, y_test_def, y_train_p, y_test_p = train_test_split(
    X, y_class, y_deficit, y_priority, test_size=0.20, random_state=42, stratify=y_class
)

print(f"Training set: {len(X_train)} samples, Testing set: {len(X_test)} samples")

# Apply SMOTE strictly on training data only
smote = SMOTE(random_state=42, k_neighbors=3)
X_train_smote, y_train_c_smote = smote.fit_resample(X_train, y_train_c)
print(f"Training samples after SMOTE: {len(X_train_smote)}")

# ------------------------------------------------------------------------------
# 1. TRAIN CLASSIFICATION MODELS
# ------------------------------------------------------------------------------
clf_models = {
    "Logistic Regression": LogisticRegression(max_iter=500, random_state=42),
    "K-Nearest Neighbors (KNN)": KNeighborsClassifier(n_neighbors=5),
    "Gaussian Naive Bayes": GaussianNB(),
    "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=50, random_state=42)
}

classification_results = {}
print("\n--- Training Classification Models ---")
for model_name, model in clf_models.items():
    model.fit(X_train_smote, y_train_c_smote)
    preds = model.predict(X_test)
    acc = round(float(accuracy_score(y_test_c, preds)), 4)
    prec = round(float(precision_score(y_test_c, preds, average="weighted", zero_division=0)), 4)
    rec = round(float(recall_score(y_test_c, preds, average="weighted", zero_division=0)), 4)
    f1 = round(float(f1_score(y_test_c, preds, average="weighted", zero_division=0)), 4)
    cm = confusion_matrix(y_test_c, preds).tolist()

    classification_results[model_name] = {
        "accuracy": acc, "precision": prec, "recall": rec, "f1_score": f1, "confusion_matrix": cm
    }
    print(f"✓ {model_name:25s} -> Accuracy: {acc*100:.2f}%, F1-Score: {f1:.4f}")

# ------------------------------------------------------------------------------
# 2. TRAIN REGRESSION MODELS (FOR IRRIGATION PRIORITY INDEX)
# ------------------------------------------------------------------------------
reg_models = {
    "Linear Regression": LinearRegression(),
    "Polynomial Regression (Degree 2)": Pipeline([
        ("poly", PolynomialFeatures(degree=2)),
        ("linear", LinearRegression())
    ])
}

regression_results = {}
print("\n--- Training Regression Models (Irrigation Priority Index) ---")
for model_name, model in reg_models.items():
    model.fit(X_train, y_train_p)
    preds = model.predict(X_test)
    preds = np.clip(preds, 0.0, 100.0)
    mae = round(float(mean_absolute_error(y_test_p, preds)), 2)
    mse = round(float(mean_squared_error(y_test_p, preds)), 2)
    rmse = round(float(np.sqrt(mse)), 2)
    r2 = round(float(r2_score(y_test_p, preds)), 4)

    regression_results[model_name] = {
        "mae": mae, "mse": mse, "rmse": rmse, "r2_score": r2
    }
    print(f"✓ {model_name:32s} -> R²: {r2:.4f}, MAE: {mae:.2f}, RMSE: {rmse:.2f}")

# ------------------------------------------------------------------------------
# 3. CLUSTERING & DIMENSIONALITY REDUCTION (K-MEANS & PCA)
# ------------------------------------------------------------------------------
print("\n--- Fitting K-Means (k=4) and PCA (2D) ---")
kmeans = KMeans(n_clusters=4, random_state=42, n_init=10).fit(X)
pca = PCA(n_components=2, random_state=42).fit(X)

pca_coords = pca.transform(X)
df["cluster_id"] = kmeans.labels_
df["pca_x"] = np.round(pca_coords[:, 0], 3)
df["pca_y"] = np.round(pca_coords[:, 1], 3)

clustering_results = {
    "K-Means (k=4)": {
        "inertia": round(float(kmeans.inertia_), 2),
        "silhouette_score": round(float(silhouette_score(X, kmeans.labels_)), 4),
        "davies_bouldin_score": round(float(davies_bouldin_score(X, kmeans.labels_)), 4)
    },
    "PCA (2D Projection)": {
        "explained_variance_ratio": [round(float(v), 4) for v in pca.explained_variance_ratio_],
        "total_explained_variance": round(float(sum(pca.explained_variance_ratio_)), 4)
    }
}
print(f"✓ K-Means Silhouette Score: {clustering_results['K-Means (k=4)']['silhouette_score']}")
print(f"✓ PCA 2D Explained Variance: {clustering_results['PCA (2D Projection)']['total_explained_variance']*100:.2f}%")

# Save clustered dataset to CSV
clustered_file = "data/processed/all_india_140_clustered.csv"
df.to_csv(clustered_file, index=False)
print(f"Saved clustered dataset to: {clustered_file}")

# Save all metrics into a clean human-readable JSON file
all_metrics = {
    "classification": classification_results,
    "regression": regression_results,
    "clustering": clustering_results
}

metrics_json_path = "backend/model_evaluation_metrics.json"
with open(metrics_json_path, "w") as f:
    json.dump(all_metrics, f, indent=4)

print(f"Saved model metrics to: {metrics_json_path}")
print("=" * 70)
