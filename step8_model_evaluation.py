# ==============================================================================
# STEP 8: MODEL EVALUATION SUMMARY SCRIPT
# Level: First-Year B.Tech Student
# Rules: No "def" used anywhere. Short and beginner-friendly Python.
# Displays: All evaluation metrics for Classification, Regression & Clustering.
# ==============================================================================

import json

print("=" * 70)
print("STEP 8: MODEL EVALUATION REPORT (EVALUATED ON UNSEEN TEST SET)")
print("=" * 70)

# Read evaluation metrics from the JSON file created in Steps 6 & 7
metrics_file = "backend/model_evaluation_metrics.json"
with open(metrics_file, "r") as f:
    metrics = json.load(f)

print(f"Dataset Source: {metrics.get('dataset_source', 'krishijal_master_dataset.csv')}")
print(f"Total Samples:  {metrics.get('total_records', 6654)} (Train: {metrics.get('train_records', 5323)}, Test: {metrics.get('test_records', 1331)})")

# 1. Classification Model Performance
print("\n--- 1. CLASSIFICATION MODEL BENCHMARKS (CROP STRESS SEVERITY) ---")
print(f"{'Model Name':<28} | {'Accuracy':<10} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10}")
print("-" * 75)
for name, res in metrics["classification"].items():
    print(f"{name:<28} | {res['accuracy']*100:>8.2f}% | {res['precision']:>10.4f} | {res['recall']:>10.4f} | {res['f1_score']:>10.4f}")

# 2. Regression Model Performance (Irrigation Priority Index)
print("\n--- 2. REGRESSION BENCHMARKS (IRRIGATION PRIORITY INDEX, 0 - 100) ---")
print(f"{'Model Name':<34} | {'MAE':<8} | {'MSE':<8} | {'RMSE':<8} | {'R² Score':<8}")
print("-" * 75)
for name, res in metrics["regression_irrigation_priority"].items():
    print(f"{name:<34} | {res['mae']:>8.2f} | {res['mse']:>8.2f} | {res['rmse']:>8.2f} | {res['r2_score']:>8.4f}")

# 3. Regression Model Performance (Water Deficit)
print("\n--- 3. REGRESSION BENCHMARKS (DAILY WATER DEFICIT, mm/day) ---")
print(f"{'Model Name':<34} | {'MAE':<8} | {'MSE':<8} | {'RMSE':<8} | {'R² Score':<8}")
print("-" * 75)
for name, res in metrics["regression_water_deficit"].items():
    print(f"{name:<34} | {res['mae']:>8.2f} | {res['mse']:>8.2f} | {res['rmse']:>8.2f} | {res['r2_score']:>8.4f}")

# 4. Clustering & PCA
print("\n--- 4. CLUSTERING & DIMENSIONALITY REDUCTION BENCHMARKS ---")
kmeans_res = metrics["clustering"]
print(f"K-Means Inertia:            {kmeans_res['inertia']}")
print(f"K-Means Silhouette Score:   {kmeans_res['silhouette_score']}")
print(f"K-Means Davies-Bouldin:     {kmeans_res['davies_bouldin_index']}")

pca_res = metrics["pca"]
print(f"PC1 Explained Variance:     {pca_res['pc1_explained_variance_ratio']*100:.2f}%")
print(f"PC2 Explained Variance:     {pca_res['pc2_explained_variance_ratio']*100:.2f}%")
print(f"Total 2D Explained Variance:{pca_res['total_2d_explained_variance_ratio']*100:.2f}%")

print("\n" + "=" * 70)
print("STEP 8 COMPLETE: ALL MODEL EVALUATION RESULTS DISPLAYED SUCCESSFULLY")
print("=" * 70)
