"""
KrishiJal: Classification Model Training Pipeline
Loads data from data/processed/krishijal_master_dataset.csv
Trains syllabus-approved classification models:
  1. Logistic Regression
  2. K-Nearest Neighbors (KNN)
  3. Gaussian Naive Bayes
  4. Decision Tree Classifier
  5. Random Forest Classifier
Enforces correct ML practices:
  - 80/20 Stratified train-test split
  - StandardScaler fit exclusively on X_train (Zero Data Leakage)
  - SMOTE applied exclusively on training data
"""

import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split # type: ignore
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

MASTER_CSV = "data/processed/krishijal_master_dataset.csv"

CLASSIFICATION_FEATURES = [
    "temperature", "temp_max", "temp_min", "rainfall", "humidity",
    "effective_soil_wetness", "solar_radiation", "soil_ph", "soil_organic_carbon",
    "ndvi", "et0", "etc", "crop_code", "stage_code"
]

TARGET_COL = "stress_level_code"

def train_and_evaluate_classification(dataset_path=MASTER_CSV):
    print("=" * 70)
    print("KRISHIJAL: CLASSIFICATION MODELS TRAINING")
    print(f"Dataset: {dataset_path}")
    print("=" * 70)
    
    df = pd.read_csv(dataset_path)
    X = df[CLASSIFICATION_FEATURES].copy()
    y = df[TARGET_COL].copy()
    
    # Stratified Train-Test Split (80% Train, 20% Test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")
    
    # Feature Scaling - Strictly on X_train to prevent Data Leakage
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # SMOTE - Strictly on training data
    smote = SMOTE(random_state=42)
    X_train_res, y_train_res = smote.fit_resample(X_train_scaled, y_train)
    print(f"SMOTE rebalanced training samples: {len(X_train_res)}")
    
    # Define models
    models = {
        "Random Forest": RandomForestClassifier(n_estimators=50, max_depth=12, random_state=42),
        "Decision Tree": DecisionTreeClassifier(max_depth=8, random_state=42),
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Gaussian Naive Bayes": GaussianNB(),
        "KNN": KNeighborsClassifier(n_neighbors=5)
    }
    
    results = {}
    trained_models = {}
    
    print("\nTraining and evaluating on unseen test set...")
    for name, model in models.items():
        model.fit(X_train_res, y_train_res)
        preds = model.predict(X_test_scaled)
        
        acc = float(accuracy_score(y_test, preds))
        prec = float(precision_score(y_test, preds, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, preds, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, preds, average="weighted", zero_division=0))
        cm = confusion_matrix(y_test, preds).tolist()
        
        results[name] = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "confusion_matrix": cm
        }
        trained_models[name] = model
        print(f"  [{name:20s}] Accuracy: {acc*100:6.2f}% | Precision: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f}")
        
    return results, trained_models, scaler

if __name__ == "__main__":
    metrics, _, _ = train_and_evaluate_classification()
