# ==============================================================================
# STEP 8: MODEL EVALUATION SUMMARY SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Displays: All evaluation metrics for Classification, Regression & Clustering.
# ==============================================================================

import json

print("=" * 70)
print("STEP 8: MODEL EVALUATION REPORT (EVALUATED ON TEST SET)")
print("=" * 70)

# Read evaluation metrics from the JSON file created in Steps 6 & 7
metrics_file = "backend/model_evaluation_metrics.json"
with open(metrics_file, "r") as f:
    metrics = json.load(f)

# 1. Classification Model Performance
print("\n--- 1. CLASSIFICATION MODEL BENCHMARKS (CROP STRESS) ---")
print(f"{'Model Name':<28} | {'Accuracy':<10} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
print("-" * 75)
for name, res in metrics["classification"].items():
    print(f"{name:<28} | {res['accuracy']*100:>8.2f}% | {res['precision']:>10.4f} | {res['recall']:>10.4f} | {res['f1_score']:>10.4f}")

# 2. Regression Model Performance
print("\n--- 2. REGRESSION MODEL BENCHMARKS (IRRIGATION PRIORITY INDEX) ---")
print(f"{'Model Name':<34} | {'MAE':<8} | {'MSE':<8} | {'RMSE':<8} | {'R² Score':<8}")
print("-" * 75)
for name, res in metrics["regression"].items():
    print(f"{name:<34} | {res['mae']:>8.2f} | {res['mse']:>8.2f} | {res['rmse']:>8.2f} | {res['r2_score']:>8.4f}")

# 3. Clustering & PCA
print("\n--- 3. CLUSTERING & DIMENSIONALITY REDUCTION BENCHMARKS ---")
kmeans_res = metrics["clustering"]["K-Means (k=4)"]
print(f"K-Means Inertia:            {kmeans_res['inertia']}")
print(f"K-Means Silhouette Score:   {kmeans_res['silhouette_score']}")
print(f"K-Means Davies-Bouldin:     {kmeans_res['davies_bouldin_score']}")

pca_res = metrics["clustering"]["PCA (2D Projection)"]
print(f"PCA 2D Explained Variance:  {pca_res['total_explained_variance']*100:.2f}%")

print("\n" + "=" * 70)
print("STEP 8 COMPLETE: ALL MODEL EVALUATION RESULTS DISPLAYED")
print("=" * 70)
