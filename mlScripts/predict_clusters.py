import pandas as pd
import joblib
import json
import io
import os
import sys
from pymongo import MongoClient

MONGO_URI = "mongodb://localhost:27017/attendance_system"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "models")
DB_NAME = "attendance_system"
MODEL_FILENAME = os.path.join(MODEL_PATH, 'employee_clustering_model.joblib')
SCALER_FILENAME = os.path.join(MODEL_PATH, 'employee_clustering_scaler.joblib')
IMPUTER_FILENAME = os.path.join(MODEL_PATH, 'employee_clustering_imputer.joblib')

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

def predict_clusters():
    """ مدل را بارگذاری کرده و خوشه‌ها را برای داده‌های فعلی پیش‌بینی می‌کند """
    try:
        kmeans = joblib.load(MODEL_FILENAME)
        scaler = joblib.load(SCALER_FILENAME)
        imputer = joblib.load(IMPUTER_FILENAME)
    except FileNotFoundError as e:
        return {"error": f"Model file not found. Please train the model first. Details: {e}"}

    df = fetch_data()
    if df.empty:
        return {"error": "داده‌ای برای پیش‌بینی وجود ندارد."}

    features = df[['avg_checkin_hour', 'avg_work_duration', 'total_lates']]
    features_imputed = imputer.transform(features)
    scaled_features = scaler.transform(features_imputed)
    
    # پیش‌بینی خوشه‌ها
    df['cluster'] = kmeans.predict(scaled_features)

    df['user_id'] = df['user_id'].astype(str)
    
    # آماده‌سازی خروجی JSON
    # می‌توانیم به هر خوشه یک برچسب معنایی بدهیم
    cluster_labels = {0: "منظم و وقت‌شناس", 1: "شناور و پرکار", 2: "در معرض خطر (تاخیر زیاد)"}
    df['cluster_label'] = df['cluster'].map(cluster_labels)

    result = df[['user_id', 'fullName', 'cluster', 'cluster_label']].to_dict(orient='records')
    return result

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    # خروجی را به صورت JSON در stdout چاپ می‌کنیم تا Node.js بتواند آن را بخواند
    predictions = predict_clusters()
    print(json.dumps(predictions, ensure_ascii=False))