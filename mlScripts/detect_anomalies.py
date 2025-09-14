import pandas as pd
from pymongo import MongoClient
import joblib
import json
import sys
import io
import os

# --- تنظیمات ---
MONGO_URI = "mongodb://localhost:27017/attendance_system"
DB_NAME = "attendance_system"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "models")
MODEL_FILENAME = os.path.join(MODEL_PATH, 'attendance_anomaly_model.joblib')
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

def generate_explanation(record):
    """ Generates a human-readable explanation for why a record is anomalous. """
    explanations = []
    checkin_hour = record.get('checkin_hour', 0)
    duration = record.get('work_duration_hours', 0)
    checkout_hour = checkin_hour + duration

    if checkin_hour >= 12:
        explanations.append(f"ورود بسیار دیرهنگام (ساعت {int(checkin_hour)})")
    
    if duration < 2:
        explanations.append(f"مدت زمان کاری بسیار کوتاه (حدود {duration:.1f} ساعت)")
    
    if duration > 10:
        explanations.append(f"مدت زمان کاری بسیار طولانی (حدود {duration:.1f} ساعت)")

    if (checkin_hour < 9 and checkout_hour > 16) and (duration > 2 and duration < 6):
        explanations.append(f"مدت حضور طولانی اما ساعت کاری کوتاه (تنها {duration:.1f} ساعت)")
        
    if (checkin_hour >= 10 and checkin_hour < 12) and (duration < 4):
        explanations.append("شروع دیرهنگام و پایان زودهنگام")

    if not explanations:
        return "ترکیب نامتعارفی از ساعت ورود و مدت زمان کاری."

    return "، ".join(explanations)


def detect_anomalies(target_date):
    """ Detects anomalies for a specific day and provides explanations. """
    try:
        model = joblib.load(MODEL_FILENAME)
    except FileNotFoundError:
        return {"error": "مدل آموزش‌دیده یافت نشد. لطفاً ابتدا مدل را آموزش دهید."}

    df = get_daily_data(target_date)
    if df.empty:
        return []

    # Predict which records are anomalies (-1 for anomalies)
    predictions = model.predict(df[FEATURES])
    df['is_anomaly'] = (predictions == -1)
    
    anomalies_df = df[df['is_anomaly'] == True].copy() # Use .copy() to avoid SettingWithCopyWarning
    
    if anomalies_df.empty:
        return []

    # --- >> NEW EXPLANATION LOGIC IS HERE << ---
    # Apply the explanation function to each anomalous row
    anomalies_df['explanation'] = anomalies_df.apply(generate_explanation, axis=1)
    # --- >> END OF NEW LOGIC << ---
    
    # Convert ObjectIds to strings for JSON serialization
    anomalies_df['record_id'] = anomalies_df['record_id'].astype(str)
    anomalies_df['user_id'] = anomalies_df['user_id'].astype(str)

    # Select the final columns to return to the Node.js server
    result = anomalies_df[['record_id', 'user_id', 'fullName', 'date', 'explanation']].to_dict(orient='records')
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