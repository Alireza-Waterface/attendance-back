import pandas as pd
from pymongo import MongoClient
from sklearn.ensemble import IsolationForest
import joblib
import os

# --- تنظیمات ---
MONGO_URI = "mongodb://localhost:27017/attendance_system"
DB_NAME = "attendance_system"
MODEL_PATH = "models"
MODEL_FILENAME = os.path.join(MODEL_PATH, "attendance_anomaly_model.joblib")
# ویژگی‌هایی که رفتار یک روز کاری را توصیف می‌کنند
FEATURES = ['checkin_hour', 'checkin_minute', 'work_duration_hours']

def fetch_and_prepare_data():
    """ داده‌های حضور و غیاب را برای آموزش مدل آماده می‌کند """
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    pipeline = [
        # فقط رکوردهای کامل و مربوط به کارمندان اداری
        {'$match': {
            'checkIn': {'$exists': True},
            'checkOut': {'$exists': True},
        }},
        {'$lookup': {
            'from': 'users', 'localField': 'user', 'foreignField': '_id', 'as': 'userInfo'
        }},
        {'$unwind': '$userInfo'},
        {'$match': {'userInfo.employeeType': 'اداری'}},
        # استخراج ویژگی‌های مورد نیاز
        {'$project': {
            'checkin_hour': {'$hour': {'date': '$checkIn', 'timezone': 'Asia/Tehran'}},
            'checkin_minute': {'$minute': {'date': '$checkIn', 'timezone': 'Asia/Tehran'}},
            'work_duration_hours': {'$divide': [{'$subtract': ['$checkOut', '$checkIn']}, 3600000]}
        }}
    ]
    
    data = list(db.attendances.aggregate(pipeline))
    client.close()
    
    if not data:
        return pd.DataFrame()
        
    df = pd.DataFrame(data)
    # اطمینان از اینکه فقط ویژگی‌های مورد نظر در DataFrame نهایی هستند
    return df[FEATURES]

def train_and_save_model(df):
    """ مدل Isolation Forest را آموزش داده و ذخیره می‌کند """
    if df.empty or len(df) < 10: # حداقل ۱۰ نمونه برای آموزش
        print("The dataset is empty or does not have enough records for anomaly detection.")
        return

    # contamination: درصد تقریبی داده‌های ناهنجار در مجموعه داده.
    # ما فرض می‌کنیم حدود ۱٪ از رکوردهای ما ناهنجار هستند. این پارامتر قابل تنظیم است.
    model = IsolationForest(contamination=0.01, random_state=42)
    model.fit(df)
    
    # ذخیره مدل
    os.makedirs(MODEL_PATH, exist_ok=True)
    joblib.dump(model, MODEL_FILENAME)
    
    print(f"Anomaly detection model trained successfully and saved to {MODEL_FILENAME}.")

if __name__ == "__main__":
    print("Starting anomaly detection model training process...")
    dataframe = fetch_and_prepare_data()
    train_and_save_model(dataframe)
    print("Process completed.")