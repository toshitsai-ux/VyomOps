import os
import json
import sys
import firebase_admin
from firebase_admin import credentials, firestore, storage

db = None
bucket = None

try:
    creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if creds_json:
        try:
            creds_dict = json.loads(creds_json)
            cred = credentials.Certificate(creds_dict)
            print("Parsed Firebase Admin Credentials from stringified JSON env variable.")
        except Exception as e:
            print(f"CRITICAL: FIREBASE_CREDENTIALS_JSON was provided but could not be parsed as JSON: {e}")
            sys.exit(1)
    else:
        cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "firebase-service-account.json")
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            print(f"Loaded Firebase Admin Credentials from file: {cred_path}")
        else:
            # Graceful check for environment-based default credentials or local testing
            print("No explicit Firebase service credentials found. Attempting Application Default Credentials.")
            cred = None

    # Guarantee initialization
    if not firebase_admin._apps:
        # Resolve storage bucket name gracefully
        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET")
        if not bucket_name:
            # Fallback to a active standard bucket name
            bucket_name = "quantum-park-43n78.firebasestorage.app"
        
        if cred:
            firebase_admin.initialize_app(cred, {
                'storageBucket': bucket_name
            })
        else:
            firebase_admin.initialize_app(options={
                'storageBucket': bucket_name
            })

    # Read Firestore Database ID from configuration
    database_id = None
    try:
        config_path = "firebase-applet-config.json"
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                database_id = config.get("firestoreDatabaseId")
    except Exception as e:
        print(f"Warning: could not load database ID from config: {e}")

    if database_id:
        db = firestore.client(database_id=database_id)
        print(f"Firestore Client configured with Database ID: {database_id}")
    else:
        db = firestore.client()

    bucket = storage.bucket()
    
    print("Firebase Admin successfully initialized in Python context.")

except Exception as err:
    print(f"CRITICAL ERROR: Failed to bootstrap Firebase Admin SDK: {err}")
    sys.exit(1)
export_db = db
export_bucket = bucket
