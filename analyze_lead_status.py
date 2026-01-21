#!/usr/bin/env python3
"""
Debug script to check lead status names and percentage calculations
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

print("="*80)
print("LEAD STATUS ANALYSIS")
print("="*80)

# Get configured percentages
cursor.execute("SELECT setting_data FROM lead_settings WHERE setting_type = 'status_percentages'")
row = cursor.fetchone()
configured_percentages = {}
if row:
    configured_percentages = json.loads(row['setting_data'])

print("\n📊 CONFIGURED STATUS PERCENTAGES:")
print("-"*80)
for status, pct in configured_percentages.items():
    print(f"  '{status}': {pct}%")

# Get all unique status values from leads table
print("\n\n📋 ACTUAL LEAD STATUS VALUES IN DATABASE:")
print("-"*80)
cursor.execute("SELECT DISTINCT lead_status FROM leads ORDER BY lead_status")
statuses = cursor.fetchall()

if statuses:
    for row in statuses:
        status = row['lead_status']
        # Check if this status exists in configured
        if status in configured_percentages:
            configured_pct = configured_percentages[status]
            print(f"  ✅ '{status}' -> {configured_pct}% (FOUND IN CONFIG)")
        else:
            print(f"  ⚠️  '{status}' -> NOT IN CONFIG (will use default)")
else:
    print("  No leads found")

# Get some sample leads with their status and percentage
print("\n\n📊 SAMPLE LEADS WITH STATUS AND PERCENTAGE:")
print("-"*80)
cursor.execute("""
SELECT lead_id, lead_status, lead_percentage FROM leads LIMIT 10
""")
leads = cursor.fetchall()

for lead in leads:
    lead_id = lead['lead_id']
    status = lead['lead_status']
    percentage = lead['lead_percentage']
    
    if status in configured_percentages:
        expected = configured_percentages[status]
        match = "✅" if percentage == expected else "⚠️"
        print(f"  {match} {lead_id}: Status='{status}' -> Current:{percentage}%, Expected:{expected}%")
    else:
        print(f"  ❌ {lead_id}: Status='{status}' -> Current:{percentage}% (NOT IN CONFIG)")

# Show default fallback mappings
print("\n\n🔧 DEFAULT FALLBACK MAPPINGS (used when status not configured):")
print("-"*80)
defaults = {
    'New': 10,
    'Contacted': 25,
    'Negotiation': 50,
    'Converted': 100
}
for status, pct in defaults.items():
    print(f"  {status}: {pct}%")

print("\n" + "="*80)
print("ANALYSIS COMPLETE")
print("="*80)

conn.close()
