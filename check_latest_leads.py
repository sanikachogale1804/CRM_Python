import mysql.connector

try:
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='',
        database='crm_system'
    )
    cursor = conn.cursor(dictionary=True)
    
    # Check latest leads
    cursor.execute('SELECT lead_id, customer_name, created_at FROM leads ORDER BY created_at DESC LIMIT 3')
    leads = cursor.fetchall()
    print("Latest Leads:")
    for lead in leads:
        print(f"  {lead['lead_id']} | {lead['customer_name']} | {lead['created_at']}")
    
    # Check latest history entries
    cursor.execute('SELECT lead_id, field_name, changed_at FROM lead_history ORDER BY changed_at DESC LIMIT 5')
    histories = cursor.fetchall()
    print("\nLatest Lead History Entries:")
    for hist in histories:
        print(f"  {hist['lead_id']} | {hist['field_name']} | {hist['changed_at']}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f'Error: {e}')
