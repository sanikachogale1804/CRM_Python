#!/usr/bin/env python3
"""
Recalculate all lead percentages based on current configured statuses
Ek baar chalaoga, sab leads ko update kar dega
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
print("LEAD PERCENTAGE RECALCULATION SCRIPT")
print("="*80)

# Step 1: Get current configured percentages
print("\n📋 Step 1: Current status percentage config fetch kar rahe hain...")
cursor.execute("SELECT setting_data FROM lead_settings WHERE setting_type = 'status_percentages'")
row = cursor.fetchone()

if not row or not row['setting_data']:
    print("❌ Koi configuration nahi mila!")
    conn.close()
    exit(1)

percentages = json.loads(row['setting_data'])
print(f"✅ {len(percentages)} statuses ka config mil gaya")
for status, pct in percentages.items():
    print(f"   - '{status}': {pct}%")

# Step 2: Get all leads
print("\n📋 Step 2: Sab leads fetch kar rahe hain...")
cursor.execute("SELECT id, lead_id, lead_status, lead_percentage FROM leads ORDER BY id")
all_leads = cursor.fetchall()
print(f"✅ {len(all_leads)} leads mil gaye")

# Step 3: Calculate new percentages
print("\n📋 Step 3: Naye percentages calculate kar rahe hain...")
updated_count = 0
not_updated = 0

for lead in all_leads:
    lead_id = lead['lead_id']
    status = lead['lead_status']
    old_pct = lead['lead_percentage']
    
    # Calculate new percentage
    if status in percentages:
        new_pct = int(percentages[status])
    else:
        new_pct = 0  # No default - force explicit config
    
    # Update if different
    if new_pct != old_pct:
        cursor.execute(
            "UPDATE leads SET lead_percentage = %s WHERE id = %s",
            (new_pct, lead['id'])
        )
        updated_count += 1
        print(f"   ✅ {lead_id}: '{status}' -> {old_pct}% → {new_pct}%")
    else:
        not_updated += 1

conn.commit()

print(f"\n📊 Results:")
print(f"   - Updated: {updated_count} leads")
print(f"   - No change: {not_updated} leads")

# Step 4: Verification
print("\n📋 Step 4: Verification kar rahe hain...")
cursor.execute("SELECT DISTINCT lead_status, lead_percentage FROM leads ORDER BY lead_status")
verification = cursor.fetchall()

print("\n✅ Final lead status percentages:")
for row in verification:
    status = row['lead_status']
    current_pct = row['lead_percentage']
    configured_pct = percentages.get(status, 'NOT CONFIGURED')
    
    if status in percentages:
        match = "✅" if current_pct == percentages[status] else "❌"
        print(f"   {match} '{status}': {current_pct}% (config: {configured_pct}%)")
    else:
        print(f"   ⚠️  '{status}': {current_pct}% (NOT in config)")

print("\n" + "="*80)
print("✅ RECALCULATION COMPLETE!")
print("="*80)

print("\n📌 Next steps:")
print("   1. Page refresh karo browser mein")
print("   2. Leads ko dekhne ja")
print("   3. 'Contacted' status wale leads ab 20% show honge")

conn.close()
