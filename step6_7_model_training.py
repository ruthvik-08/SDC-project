# ==============================================================================
# STEPS 6 & 7: MODEL SELECTION & MODEL TRAINING SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Dataset: data/processed/krishijal_master_dataset.csv (Single Master Dataset)
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
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.metrics import silhouette_score, davies_bouldin_score
from imblearn.over_sampling import SMOTE

print("=" * 70)
print("STEPS 6 & 7: MODEL TRAINING ON KRISHIJAL MASTER DATASET")
print("=" * 70)

# Load single master dataset
data_file = "data/processed/krishijal_master_dataset.csv"
print(f"Loading data from: {data_file}")
df = pd.read_csv(data_file)
print(f"Loaded {len(df)} records across {df['district'].nunique()} districts in {df['state'].nunique()} States & UTs.")

# 14 agronomic and meteorological feature columns
feature_cols = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

X = df[feature_cols]
y_class = df["stress_level_code"]
y_deficit = df["water_deficit"]
y_priority = df["irrigation_priority_index"]

# Step 1: Stratified 80/20 Train-Test Split
X_train, X_test, y_train_class, y_test_class, y_train_pri, y_test_pri, y_train_def, y_test_def = train_test_split(
    X, y_class, y_priority, y_deficit, test_size=0.20, random_state=42, stratify=y_class
)
print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

# Step 2: Scale features strictly on X_train to prevent Data Leakage
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Step 3: Apply SMOTE strictly on training data
smote = SMOTE(random_state=42)
X_train_res, y_train_res = smote.fit_resample(X_train_scaled, y_train_class)
print(f"Training samples after SMOTE rebalancing: {len(X_train_res)}")

# Step 4: Train and Evaluate Classification Models
print("\n--- Training Classification Models ---")
clf_models = {
    "Random Forest": RandomForestClassifier(n_estimators=50, max_depth=12, random_state=42),
    "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=42),
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "Gaussian Naive Bayes": GaussianNB(),
    "KNN": KNeighborsClassifier(n_neighbors=5)
}

clf_metrics = {}
for name, model in clf_models.items():
    model.fit(X_train_res, y_train_res)
    preds = model.predict(X_test_scaled)
    
    acc = float(accuracy_score(y_test_class, preds))
    prec = float(precision_score(y_test_class, preds, average="weighted", zero_division=0))
    rec = float(recall_score(y_test_class, preds, average="weighted", zero_division=0))
    f1 = float(f1_score(y_test_class, preds, average="weighted", zero_division=0))
    cm = confusion_matrix(y_test_class, preds).tolist()
    
    clf_metrics[name] = {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": cm
    }
    print(f"  [{name:20s}] Accuracy: {acc*100:6.2f}% | Precision: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f}")

# Step 5: Train and Evaluate Regression Models
print("\n--- Training Regression Models ---")
reg_priority_linear = LinearRegression().fit(X_train_scaled, y_train_pri)
reg_priority_poly = Pipeline([("poly", PolynomialFeatures(degree=2)), ("linear", LinearRegression())]).fit(X_train_scaled, y_train_pri)

reg_deficit_linear = LinearRegression().fit(X_train_scaled, y_train_def)
reg_deficit_poly = Pipeline([("poly", PolynomialFeatures(degree=2)), ("linear", LinearRegression())]).fit(X_train_scaled, y_train_def)

pred_pri_lin = reg_priority_linear.predict(X_test_scaled)
pred_pri_poly = reg_priority_poly.predict(X_test_scaled)

pred_def_lin = reg_deficit_linear.predict(X_test_scaled)
pred_def_poly = reg_deficit_poly.predict(X_test_scaled)

reg_metrics = {
    "irrigation_priority": {
        "Linear Regression": {
            "mae": round(float(mean_absolute_error(y_test_pri, pred_pri_lin)), 4),
            "mse": round(float(mean_squared_error(y_test_pri, pred_pri_lin)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test_pri, pred_pri_lin))), 4),
            "r2_score": round(float(r2_score(y_test_pri, pred_pri_lin)), 4)
        },
        "Polynomial Regression (Deg 2)": {
            "mae": round(float(mean_absolute_error(y_test_pri, pred_pri_poly)), 4),
            "mse": round(float(mean_squared_error(y_test_pri, pred_pri_poly)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test_pri, pred_pri_poly))), 4),
            "r2_score": round(float(r2_score(y_test_pri, pred_pri_poly)), 4)
        }
    },
    "water_deficit": {
        "Linear Regression": {
            "mae": round(float(mean_absolute_error(y_test_def, pred_def_lin)), 4),
            "mse": round(float(mean_squared_error(y_test_def, pred_def_lin)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test_def, pred_def_lin))), 4),
            "r2_score": round(float(r2_score(y_test_def, pred_def_lin)), 4)
        },
        "Polynomial Regression (Deg 2)": {
            "mae": round(float(mean_absolute_error(y_test_def, pred_def_poly)), 4),
            "mse": round(float(mean_squared_error(y_test_def, pred_def_poly)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_test_def, pred_def_poly))), 4),
            "r2_score": round(float(r2_score(y_test_def, pred_def_poly)), 4)
        }
    }
}

print(f"  [Priority Polynomial Deg 2] MAE: {reg_metrics['irrigation_priority']['Polynomial Regression (Deg 2)']['mae']} | R2: {reg_metrics['irrigation_priority']['Polynomial Regression (Deg 2)']['r2_score']}")
print(f"  [Deficit Polynomial Deg 2 ] MAE: {reg_metrics['water_deficit']['Polynomial Regression (Deg 2)']['mae']} | R2: {reg_metrics['water_deficit']['Polynomial Regression (Deg 2)']['r2_score']}")

# Step 6: Unsupervised Clustering & PCA
print("\n--- Training Clustering & PCA ---")
cluster_cols = [
    "temperature", "rainfall", "humidity", "effective_soil_wetness",
    "solar_radiation", "soil_ph", "soil_organic_carbon", "ndvi", "et0", "etc"
]
X_clust = df[cluster_cols]
scaler_clust = StandardScaler()
X_clust_scaled = scaler_clust.fit_transform(X_clust)

kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
cluster_labels = kmeans.fit_predict(X_clust_scaled)

pca = PCA(n_components=2, random_state=42)
pca_coords = pca.fit_transform(X_clust_scaled)

clust_metrics = {
    "k_means": {
        "n_clusters": 4,
        "inertia": round(float(kmeans.inertia_), 2),
        "silhouette_score": round(float(silhouette_score(X_clust_scaled, cluster_labels)), 4),
        "davies_bouldin_index": round(float(davies_bouldin_score(X_clust_scaled, cluster_labels)), 4)
    },
    "pca": {
        "pc1_explained_variance_ratio": round(float(pca.explained_variance_ratio_[0]), 4),
        "pc2_explained_variance_ratio": round(float(pca.explained_variance_ratio_[1]), 4),
        "total_2d_explained_variance_ratio": round(float(np.sum(pca.explained_variance_ratio_)), 4)
    }
}

# Step 7: Save Consolidated Evaluation Metrics JSON
evaluation_summary = {
    "dataset_source": "data/processed/krishijal_master_dataset.csv",
    "total_records": len(df),
    "train_records": len(X_train),
    "test_records": len(X_test),
    "classification": clf_metrics,
    "regression_irrigation_priority": reg_metrics["irrigation_priority"],
    "regression_water_deficit": reg_metrics["water_deficit"],
    "clustering": clust_metrics["k_means"],
    "pca": clust_metrics["pca"]
}

with open("backend/model_evaluation_metrics.json", "w") as f:
    json.dump(evaluation_summary, f, indent=2)

print("\nSaved updated evaluation metrics to backend/model_evaluation_metrics.json!")
print("=" * 70)
