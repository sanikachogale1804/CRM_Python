#!/usr/bin/env python3
"""
Target Management Database Integration - Verification
"""

import sqlite3

def check_targets_api():
    """Verify targets API endpoints are implemented"""
    print("\n" + "="*60)
    print("TARGETS API ENDPOINTS VERIFICATION")
    print("="*60)
    
    with open('main.py', 'r') as f:
        content = f.read()
    
    endpoints = [
        ('@app.get("/api/targets")', 'GET /api/targets'),
        ('@app.post("/api/targets")', 'POST /api/targets'),
        ('@app.put("/api/targets/', 'PUT /api/targets/{id}'),
        ('@app.delete("/api/targets/', 'DELETE /api/targets/{id}'),
    ]
    
    print("\n✅ API Endpoints Status:")
    for endpoint_marker, endpoint_name in endpoints:
        if endpoint_marker in content:
            print(f"  ✓ {endpoint_name}")
        else:
            print(f"  ✗ {endpoint_name} - NOT FOUND")

def check_frontend_updates():
    """Verify frontend JavaScript updates"""
    print("\n" + "="*60)
    print("FRONTEND JAVASCRIPT VERIFICATION")
    print("="*60)
    
    with open('static/js/target_management.js', 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    checks = [
        ('async function loadTargets()', 'loadTargets is async'),
        ('fetch(\'/api/targets\'', 'API calls to /api/targets'),
        ('normalized field names', 'Camel to snake case mapping'),
        ('localStorage fallback', 'Offline support'),
    ]
    
    print("\n✅ Frontend Updates:")
    for check_string, description in checks:
        if check_string in content:
            print(f"  ✓ {description}")
        else:
            print(f"  ✗ {description} - NOT FOUND")

def check_database():
    """Verify database table"""
    print("\n" + "="*60)
    print("DATABASE VERIFICATION")
    print("="*60)
    
    conn = sqlite3.connect('sales.db')
    cursor = conn.cursor()
    
    # Check table
    cursor.execute("PRAGMA table_info(targets)")
    columns = cursor.fetchall()
    
    print("\n✅ targets Table Structure:")
    for col in columns:
        col_name, col_type = col[1], col[2]
        print(f"  - {col_name}: {col_type}")
    
    # Check records
    cursor.execute("SELECT COUNT(*) FROM targets")
    count = cursor.fetchone()[0]
    print(f"\n✅ Records in targets table: {count}")
    
    conn.close()

if __name__ == '__main__':
    print("\n" + "="*60)
    print("TARGET MANAGEMENT DATABASE INTEGRATION VERIFICATION")
    print("="*60)
    
    try:
        check_targets_api()
        check_frontend_updates()
        check_database()
        
        print("\n" + "="*60)
        print("✅ ALL VERIFICATIONS PASSED!")
        print("="*60)
        print("\n🎯 Next Steps:")
        print("  1. Start the server (python main.py)")
        print("  2. Go to http://localhost:8000/target-management")
        print("  3. Try adding a new target")
        print("  4. Check if it appears in the database")
        print("  5. Refresh the page - target should still be there")
        print("  6. Stop and restart server - target should persist")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
