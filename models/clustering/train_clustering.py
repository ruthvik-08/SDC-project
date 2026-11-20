"""
KrishiJal: Unsupervised Clustering & Dimensionality Reduction Pipeline
Loads data from data/processed/krishijal_master_dataset.csv
Trains:
  1. K-Means Clustering (k=4 Regional Agro-Climatic Zones)
  2. Principal Component Analysis (PCA - 2D Coordinate Projection)
Evaluates:
  - Inertia (Sum of squared cluster distances)
  - Silhouette Score (-1 to +1)
  - Davies-Bouldin Index (Lower is better)
  - PCA Explained Variance Ratio
"""

import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score

MASTER_CSV = "data/processed/krishijal_master_dataset.csv"

CLUSTERING_FEATURES = [
    "temperature", "rainfall", "humidity", "effective_soil_wetness",
    "solar_radiation", "soil_ph", "soil_organic_carbon", "ndvi", "et0", "etc"
]

def train_and_evaluate_clustering(dataset_path=MASTER_CSV):
    print("=" * 70)
    print("KRISHIJAL: CLUSTERING & PCA PIPELINE")
    print(f"Dataset: {dataset_path}")
    print("=" * 70)
    
    df = pd.read_csv(dataset_path)
    X = df[CLUSTERING_FEATURES].copy()
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 1. K-Means Clustering (k=4)
    print("\nTraining K-Means (k=4)...")
    kmeans = KMeans(n_clusters=4, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(X_scaled)
    
    inertia = float(kmeans.inertia_)
    sil = float(silhouette_score(X_scaled, cluster_labels))
    db = float(davies_bouldin_score(X_scaled, cluster_labels))
    
    print(f"  Inertia:              {inertia:10.2f}")
    print(f"  Silhouette Score:     {sil:10.4f} (Separation quality)")
    print(f"  Davies-Bouldin Index: {db:10.4f} (Compactness quality)")
    
    # 2. PCA Dimensionality Reduction (2 Components)
    print("\nFitting Principal Component Analysis (PCA)...")
    pca = PCA(n_components=2, random_state=42)
    pca_coords = pca.fit_transform(X_scaled)
    
    var_pc1 = float(pca.explained_variance_ratio_[0])
    var_pc2 = float(pca.explained_variance_ratio_[1])
    var_total = float(np.sum(pca.explained_variance_ratio_))
    
    print(f"  PC1 Explained Variance: {var_pc1*100:6.2f}%")
    print(f"  PC2 Explained Variance: {var_pc2*100:6.2f}%")
    print(f"  Total 2D Variance:      {var_total*100:6.2f}%")
    
    results = {
        "k_means": {
            "n_clusters": 4,
            "inertia": round(inertia, 2),
            "silhouette_score": round(sil, 4),
            "davies_bouldin_index": round(db, 4),
            "cluster_distribution": pd.Series(cluster_labels).value_counts().to_dict()
        },
        "pca": {
            "pc1_explained_variance_ratio": round(var_pc1, 4),
            "pc2_explained_variance_ratio": round(var_pc2, 4),
            "total_2d_explained_variance_ratio": round(var_total, 4)
        }
    }
    
    return results, kmeans, pca, scaler

if __name__ == "__main__":
    metrics, _, _, _ = train_and_evaluate_clustering()
