import pandas as pd
from pymongo import MongoClient
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
import joblib
import os
import sys
import numpy as np

# --- تنظیمات ---
MONGO_URI = "mongodb://localhost:27017/attendance_system"
DB_NAME = "attendance_system"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "models")
MODEL_FILENAME = os.path.join(MODEL_PATH, "employee_clustering_model.joblib")
SCALER_FILENAME = os.path.join(MODEL_PATH, "employee_clustering_scaler.joblib")
IMPUTER_FILENAME = os.path.join(MODEL_PATH, "employee_clustering_imputer.joblib")
N_CLUSTERS = 3 # تعداد خوشه‌های مورد نظر (مثلا: منظم، شناور، در معرض خطر)

def fetch_data():
    """ Fetches and aggregates data from MongoDB. """
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    pipeline = [
        # Match only records with complete check-in and check-out
        {'$match': {'checkIn': {'$exists': True}, 'checkOut': {'$exists': True}}},
        # Group by user and calculate core metrics
        {'$group': {
            '_id': '$user',
            'avg_checkin_hour': {'$avg': {'$hour': {'date': '$checkIn', 'timezone': 'Asia/Tehran'}}},
            'avg_work_duration': {'$avg': {'$divide': [{'$subtract': ['$checkOut', '$checkIn']}, 3600000]}},
            'total_lates': {'$sum': {'$cond': [{'$eq': ['$status', 'تاخیر']}, 1, 0]}}
        }},
        # Join with user info
        {'$lookup': {
            'from': 'users',
            'localField': '_id',
            'foreignField': '_id',
            'as': 'userInfo'
        }},
        {'$unwind': '$userInfo'},
        {'$match': {
            'userInfo.roles': 'کارمند'
        }},
        {'$project': {
            'user_id': '$_id',
            'fullName': '$userInfo.fullName',
            'avg_checkin_hour': 1,
            'avg_work_duration': 1,
            'total_lates': 1,
            '_id': 0
        }}
    ]
    
    data = list(db.attendances.aggregate(pipeline))
    client.close()
    return pd.DataFrame(data)

def train_and_save_model(df):
    """ مدل K-Means را آموزش داده و ذخیره می‌کند """
    if df.empty or len(df) < N_CLUSTERS:
        print("The dataset is empty or does not have enough records for clustering.")
        return

    # انتخاب ویژگی‌ها برای خوشه‌بندی
    features = df[['avg_checkin_hour', 'avg_work_duration', 'total_lates']]

    nan_check_before = features.isnull().sum()
    print("\n--- NaN Check Before Imputation ---")
    print(nan_check_before)

    imputer = SimpleImputer(strategy='mean')
    features_imputed = imputer.fit_transform(features)

    print("\n--- NaN Check After Imputation ---")
    print(f"Contains NaNs: {np.isnan(features_imputed).any()}")
    
    # استانداردسازی داده‌ها (بسیار مهم برای K-Means)
    scaler = StandardScaler()
    scaled_features = scaler.fit_transform(features_imputed)
    
    # آموزش مدل K-Means
    kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=42, n_init=10)
    kmeans.fit(scaled_features)
    
    # ذخیره مدل و scaler
    os.makedirs(MODEL_PATH, exist_ok=True)
    joblib.dump(kmeans, MODEL_FILENAME)
    joblib.dump(scaler, SCALER_FILENAME)
    joblib.dump(imputer, IMPUTER_FILENAME)
    
    print(f"Clustering model trained successfully and saved to {MODEL_FILENAME}.")

if __name__ == "__main__":
    print("Starting clustering model training process...")
    dataframe = fetch_data()
    train_and_save_model(dataframe)
    print("Clustering model training process completed.")