import pandas as pd
from pymongo import MongoClient
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
import joblib
import os
import numpy as np

# --- تنظیمات ---
MONGO_URI = "mongodb://localhost:27017/attendance_system"
DB_NAME = "attendance_system"
MODEL_PATH = "models"
MODEL_FILENAME = os.path.join(MODEL_PATH, "employee_clustering_model.joblib")
SCALER_FILENAME = os.path.join(MODEL_PATH, "employee_clustering_scaler.joblib")
N_CLUSTERS = 3 # تعداد خوشه‌های مورد نظر (مثلا: منظم، شناور، در معرض خطر)

def fetch_data():
    """ داده‌ها را از MongoDB استخراج و به DataFrame تبدیل می‌کند """
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    pipeline = [
        # فقط رکوردهایی که ورود و خروج کامل دارند
        {'$match': {'checkIn': {'$exists': True}, 'checkOut': {'$exists': True}}},
        # محاسبه ساعات کاری و ساعت ورود
        {'$project': {
            'user': 1,
            'status': 1,
            'work_duration_hours': {'$divide': [{'$subtract': ['$checkOut', '$checkIn']}, 3600000]},
            'checkin_hour': {'$hour': {'date': '$checkIn', 'timezone': 'Asia/Tehran'}}
        }},
        # گروه‌بندی بر اساس کاربر و محاسبه میانگین‌ها
        {'$group': {
            '_id': '$user',
            'avg_checkin_hour': {'$avg': '$checkin_hour'},
            'avg_work_duration': {'$avg': '$work_duration_hours'},
            'total_lates': {'$sum': {'$cond': [{'$eq': ['$status', 'تاخیر']}, 1, 0]}}
        }},
        # پیوستن به اطلاعات کاربر برای دریافت نام
        {'$lookup': {
            'from': 'users',
            'localField': '_id',
            'foreignField': '_id',
            'as': 'userInfo'
        }},
        {'$unwind': '$userInfo'},
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
    joblib.dump(imputer, os.path.join(MODEL_PATH, "employee_clustering_imputer.joblib"))
    
    print(f"Clustering model trained successfully and saved to {MODEL_FILENAME}.")

if __name__ == "__main__":
    print("Starting clustering model training process...")
    dataframe = fetch_data()
    train_and_save_model(dataframe)
    print("Clustering model training process completed.")