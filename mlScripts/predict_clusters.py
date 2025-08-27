import pandas as pd
import joblib
import json
import io
import sys
from train_clustering_model import fetch_data # از اسکریپت قبلی تابع را وارد می‌کنیم

def predict_clusters():
    """ مدل را بارگذاری کرده و خوشه‌ها را برای داده‌های فعلی پیش‌بینی می‌کند """
    try:
        kmeans = joblib.load('models/employee_clustering_model.joblib')
        scaler = joblib.load('models/employee_clustering_scaler.joblib')
        imputer = joblib.load('models/employee_clustering_imputer.joblib')
    except FileNotFoundError:
        return {"error": "مدل آموزش‌دیده یافت نشد. لطفاً ابتدا مدل را آموزش دهید."}

    df = fetch_data()
    if df.empty:
        return {"error": "داده‌ای برای پیش‌بینی وجود ندارد."}

    features = df[['avg_checkin_hour', 'avg_work_duration', 'total_lates']]
    features_imputed = imputer.transform(features)
    scaled_features = scaler.transform(features_imputed)
    
    # پیش‌بینی خوشه‌ها
    df['cluster'] = kmeans.predict(scaled_features)
    
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