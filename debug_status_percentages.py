#!/usr/bin/env python3
"""
Debug script to check status percentages in database
"""

import pymysql
import pymysql.cursors
import json

conn = pymysql.connect(
    host='127.0.0.1',
    user='root',
    password='@Ramlakhan123',
    database='crm_system',
    cursorclass=pymysql.cursors.DictCursor
)
cursor = conn.cursor()

print("="*70)
print("STATUS PERCENTAGES DEBUG")
print("="*70)

cursor.execute("SELECT setting_type, setting_data FROM lead_settings WHERE setting_type = 'status_percentages'")
row = cursor.fetchone()

if row:
    print("\n✅ Setting found in database")
    print(f"\nSetting Type: {row['setting_type']}")
    print(f"Raw Data: {row['setting_data']}")
    print(f"\nType of setting_data: {type(row['setting_data'])}")
    
    try:
        parsed = json.loads(row['setting_data'])
        print(f"\n✅ Successfully parsed as JSON")
        print(f"Parsed data: {parsed}")
        print(f"Type: {type(parsed)}")
        
        if isinstance(parsed, dict):
            print("\n✅ It's a dictionary (correct format)")
            print("\nStatus -> Percentage mappings:")
            for key, value in parsed.items():
                print(f"  {key}: {value}%")
        elif isinstance(parsed, list):
            print("\n⚠️ It's a list (WRONG FORMAT!)")
            print("Items in list:")
            for item in parsed:
                print(f"  {item}")
    except json.JSONDecodeError as e:
        print(f"\n❌ Failed to parse JSON: {e}")
else:
    print("\n❌ No status_percentages setting found in database")

print("\n" + "="*70)

conn.close()
