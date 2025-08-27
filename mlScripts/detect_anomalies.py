import pandas as pd
from pymongo import MongoClient
import joblib
import json
import sys
import io

# --- تنظیمات ---
MONGO_URI = "mongodb://localhost:27017/attendance_system"
DB_NAME = "attendance_system"
MODEL_FILENAME = 'models/attendance_anomaly_model.joblib'
FEATURES = ['checkin_hour', 'checkin_minute', 'work_duration_hours']

def get_daily_data(target_date):
    """ داده‌های روز مشخص شده را از MongoDB استخراج می‌کند """
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    pipeline = [
        {'$match': {
            'date': target_date,
            'checkIn': {'$exists': True},
            'checkOut': {'$exists': True},
        }},
        {'$lookup': {
            'from': 'users', 'localField': 'user', 'foreignField': '_id', 'as': 'userInfo'
        }},
        {'$unwind': '$userInfo'},
        {'$project': {
            'record_id': '$_id',
            'user_id': '$user',
            'fullName': '$userInfo.fullName',
            'date': 1,
            'checkin_hour': {'$hour': {'date': '$checkIn', 'timezone': 'Asia/Tehran'}},
            'checkin_minute': {'$minute': {'date': '$checkIn', 'timezone': 'Asia/Tehran'}},
            'work_duration_hours': {'$divide': [{'$subtract': ['$checkOut', '$checkIn']}, 3600000]}
        }}
    ]
    data = list(db.attendances.aggregate(pipeline))
    client.close()
    return pd.DataFrame(data)

def detect_anomalies(target_date):
    """ ناهنجاری‌ها را برای یک روز خاص شناسایی می‌کند """
    try:
        model = joblib.load(MODEL_FILENAME)
    except FileNotFoundError:
        return {"error": "مدل آموزش‌دیده یافت نشد. لطفاً ابتدا مدل را آموزش دهید."}

    df = get_daily_data(target_date)
    if df.empty:
        return [] # اگر داده‌ای برای این روز نیست، هیچ ناهنجاری وجود ندارد

    # پیش‌بینی
    # Isolation Forest مقدار -1 را برای ناهنجاری‌ها و 1 را برای داده‌های عادی برمی‌گرداند
    predictions = model.predict(df[FEATURES])
    df['is_anomaly'] = (predictions == -1)
    
    # فقط رکوردهای ناهنجار را برمی‌گردانیم
    anomalies = df[df['is_anomaly'] == True]
    
    # تبدیل ObjectId به رشته برای سازگاری با JSON
    anomalies['record_id'] = anomalies['record_id'].astype(str)
    anomalies['user_id'] = anomalies['user_id'].astype(str)

    result = anomalies[['record_id', 'user_id', 'fullName', 'date']].to_dict(orient='records')
    return result

if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    # تاریخ مورد نظر را از آرگومان‌های خط فرمان می‌خوانیم
    if len(sys.argv) > 1:
        target_date = sys.argv[1]
        anomalies_result = detect_anomalies(target_date)
        print(json.dumps(anomalies_result, ensure_ascii=False))
    else:
        print(json.dumps({"error": "تاریخ مورد نظر ارسال نشده است."}))