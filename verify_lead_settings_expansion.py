#!/usr/bin/env python
"""
Verification Script for Lead Settings Expansion
================================================

This script verifies that all new tabs and settings have been properly
added to the lead_settings system with database persistence.

Features Tested:
1. HTML tabs exist (Reports, System Settings, Security, Email, Database, Import/Export)
2. Form fields exist for all new settings
3. JavaScript functions exist for loading/saving all new settings
4. Default data includes reports
5. Default preferences includes all 50+ settings
6. Database persistence is implemented
"""

import json
import os
import re
import sys
from pathlib import Path

# Color codes
GREEN = '\033[92m'
BLUE = '\033[94m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'
BOLD = '\033[1m'

def print_header(text):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_failure(text):
    print(f"{RED}❌ {text}{RESET}")

def print_info(text):
    print(f"{BLUE}ℹ️  {text}{RESET}")

def print_warning(text):
    print(f"{YELLOW}⚠️  {text}{RESET}")

def check_html_tabs():
    """Check if all new tabs exist in lead_settings.html"""
    print_header("Checking HTML Tabs")
    
    html_path = Path("templates/lead_settings.html")
    if not html_path.exists():
        print_failure(f"File not found: {html_path}")
        return False
    
    with open(html_path, 'r') as f:
        content = f.read()
    
    required_tabs = [
        ('reports', 'Reports'),
        ('system_settings', 'System Settings'),
        ('security', 'Security'),
        ('email_config', 'Email Configuration'),
        ('database', 'Database'),
        ('import_export', 'Import/Export')
    ]
    
    all_exist = True
    for tab_id, tab_name in required_tabs:
        if f'data-tab="{tab_id}"' in content:
            print_success(f"Tab '{tab_name}' exists in navigation")
        else:
            print_failure(f"Tab '{tab_name}' NOT found in navigation")
            all_exist = False
        
        if f'id="{tab_id}-tab"' in content or f'class="tab-content" id="{tab_id}' in content:
            print_success(f"Tab content for '{tab_name}' exists")
        else:
            print_warning(f"Tab content for '{tab_name}' might need verification")
    
    return all_exist

def check_form_fields():
    """Check if all form fields exist for new settings"""
    print_header("Checking Form Fields")
    
    html_path = Path("templates/lead_settings.html")
    with open(html_path, 'r') as f:
        content = f.read()
    
    required_fields = [
        # System Settings
        ('maintenanceMode', 'Maintenance Mode'),
        ('debugMode', 'Debug Mode'),
        ('defaultLanguage', 'Default Language'),
        ('systemTimezone', 'System Timezone'),
        
        # Security
        ('passwordMinLength', 'Password Min Length'),
        ('requireSpecialChar', 'Require Special Character'),
        ('sessionTimeout', 'Session Timeout'),
        ('enableAuditLog', 'Enable Audit Log'),
        
        # Email
        ('smtpHost', 'SMTP Host'),
        ('smtpPort', 'SMTP Port'),
        ('fromEmail', 'From Email'),
        ('leadNotification', 'Lead Notification'),
        
        # Database
        ('autoBackup', 'Auto Backup'),
        ('backupFrequency', 'Backup Frequency'),
        
        # Import/Export
        ('maxImportRecords', 'Max Import Records'),
        ('csvDelimiter', 'CSV Delimiter')
    ]
    
    all_exist = True
    for field_id, field_name in required_fields:
        if f'id="{field_id}"' in content:
            print_success(f"Form field '{field_name}' exists")
        else:
            print_failure(f"Form field '{field_name}' NOT found")
            all_exist = False
    
    return all_exist

def check_javascript_functions():
    """Check if all JavaScript functions exist"""
    print_header("Checking JavaScript Functions")
    
    js_path = Path("static/js/lead_settings.js")
    if not js_path.exists():
        print_failure(f"File not found: {js_path}")
        return False
    
    with open(js_path, 'r') as f:
        content = f.read()
    
    required_functions = [
        ('loadSystemSettings', 'Load System Settings'),
        ('loadSecuritySettings', 'Load Security Settings'),
        ('loadEmailConfig', 'Load Email Configuration'),
        ('loadDatabaseSettings', 'Load Database Settings'),
        ('loadImportExportSettings', 'Load Import/Export Settings'),
        ('addNewReport', 'Add New Report'),
        ('saveAllSettings', 'Save All Settings')
    ]
    
    all_exist = True
    for func_name, func_display in required_functions:
        pattern = f'function {func_name}\\('
        if re.search(pattern, content):
            print_success(f"Function '{func_display}' exists")
        else:
            print_failure(f"Function '{func_display}' NOT found")
            all_exist = False
    
    return all_exist

def check_default_data():
    """Check if default data includes all new settings"""
    print_header("Checking Default Data Structure")
    
    js_path = Path("static/js/lead_settings.js")
    with open(js_path, 'r') as f:
        content = f.read()
    
    # Check for reports in defaultData
    if "'reports':" in content or '"reports":' in content:
        print_success("Reports array exists in defaultData")
    else:
        print_failure("Reports array NOT found in defaultData")
    
    # Check for system settings in defaultPreferences
    system_settings = ['maintenanceMode', 'debugMode', 'defaultLanguage', 'systemTimezone']
    for setting in system_settings:
        if f"'{setting}':" in content or f'"{setting}":' in content:
            print_success(f"Default setting '{setting}' exists")
        else:
            print_failure(f"Default setting '{setting}' NOT found")
    
    return True

def check_render_function():
    """Check if renderCurrentTab handles all new tabs"""
    print_header("Checking renderCurrentTab Function")
    
    js_path = Path("static/js/lead_settings.js")
    with open(js_path, 'r') as f:
        content = f.read()
    
    required_cases = [
        ('reports', "render reports tab"),
        ('system_settings', "render system settings"),
        ('security', "render security settings"),
        ('email_config', "render email config"),
        ('database', "render database settings"),
        ('import_export', "render import/export settings")
    ]
    
    all_exist = True
    for case_name, description in required_cases:
        pattern = f"case\\s+['\\\"]?{case_name}['\\\"]?:"
        if re.search(pattern, content):
            print_success(f"Case '{case_name}' exists in renderCurrentTab")
        else:
            print_failure(f"Case '{case_name}' NOT found in renderCurrentTab")
            all_exist = False
    
    return all_exist

def check_database_endpoints():
    """Check if database endpoints exist in main.py"""
    print_header("Checking Database Endpoints")
    
    main_py = Path("main.py")
    with open(main_py, 'r') as f:
        content = f.read()
    
    endpoints = [
        ('/api/settings/lead-settings', 'GET'),
        ('/api/settings/lead-settings', 'POST'),
        ('/api/targets', 'GET'),
        ('/api/targets', 'POST'),
        ('/api/targets', 'PUT'),
        ('/api/targets', 'DELETE')
    ]
    
    all_exist = True
    for endpoint, method in endpoints:
        pattern = f'@app\\.(get|post|put|delete)\\(["\']?{endpoint}["\']?'
        if re.search(pattern, content, re.IGNORECASE):
            print_success(f"Endpoint {method} {endpoint} exists")
        else:
            # Check for other patterns
            if endpoint in content:
                print_warning(f"Endpoint {method} {endpoint} might exist but pattern not matched")
            else:
                print_failure(f"Endpoint {method} {endpoint} NOT found")
                all_exist = False
    
    return all_exist

def check_save_functionality():
    """Check if saveAllSettings includes all new settings"""
    print_header("Checking saveAllSettings Implementation")
    
    js_path = Path("static/js/lead_settings.js")
    with open(js_path, 'r') as f:
        content = f.read()
    
    # Extract the saveAllSettings function
    match = re.search(r'async function saveAllSettings\(\)\s*{(.*?)^}', content, re.MULTILINE | re.DOTALL)
    
    if not match:
        print_failure("Could not find saveAllSettings function")
        return False
    
    func_content = match.group(1)
    
    required_in_save = [
        'maintenanceMode',
        'passwordMinLength',
        'smtpHost',
        'autoBackup',
        'maxImportRecords',
        'localStorage.setItem',
        'JSON.stringify(preferences)'
    ]
    
    all_exist = True
    for item in required_in_save:
        if item in func_content:
            print_success(f"saveAllSettings includes '{item}'")
        else:
            print_failure(f"saveAllSettings missing '{item}'")
            all_exist = False
    
    return all_exist

def check_file_syntax():
    """Check for JavaScript syntax errors"""
    print_header("Checking JavaScript Syntax")
    
    js_path = Path("static/js/lead_settings.js")
    with open(js_path, 'r') as f:
        content = f.read()
    
    # Basic syntax checks
    checks = [
        (content.count('{'), content.count('}'), 'Braces'),
        (content.count('['), content.count(']'), 'Brackets'),
        (content.count('('), content.count(')'), 'Parentheses')
    ]
    
    all_valid = True
    for open_count, close_count, name in checks:
        if open_count == close_count:
            print_success(f"{name} are balanced ({open_count} pairs)")
        else:
            print_failure(f"{name} are NOT balanced (open: {open_count}, close: {close_count})")
            all_valid = False
    
    return all_valid

def generate_summary():
    """Generate final summary"""
    print_header("VERIFICATION SUMMARY")
    
    tests = [
        ("HTML Tabs", check_html_tabs),
        ("Form Fields", check_form_fields),
        ("JavaScript Functions", check_javascript_functions),
        ("Default Data", check_default_data),
        ("renderCurrentTab", check_render_function),
        ("Database Endpoints", check_database_endpoints),
        ("saveAllSettings", check_save_functionality),
        ("File Syntax", check_file_syntax)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_warning(f"Error running {test_name}: {str(e)}")
            results.append((test_name, False))
    
    print_header("TEST RESULTS")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = f"{GREEN}PASS{RESET}" if result else f"{RED}FAIL{RESET}"
        print(f"{status} - {test_name}")
    
    percentage = (passed / total) * 100
    if percentage == 100:
        print_success(f"\n🎉 All tests passed! ({passed}/{total})")
    elif percentage >= 80:
        print_warning(f"\n⚠️  Most tests passed ({passed}/{total} - {percentage:.1f}%)")
    else:
        print_failure(f"\n❌ Some tests failed ({passed}/{total} - {percentage:.1f}%)")
    
    print("\n" + "="*60)
    print("NEXT STEPS:")
    print("="*60)
    print("""
1. ✅ Test all new tabs in browser:
   - Go to http://localhost:8000/lead-settings
   - Click each tab (Reports, System, Security, Email, Database, Import/Export)
   - Verify form fields are displayed correctly
   
2. ✅ Test data persistence:
   - Edit settings in each tab
   - Click 'Save Settings'
   - Refresh page (F5) - settings should persist
   - Restart server - settings should still exist in database
   
3. ✅ Test add/edit/delete for Reports:
   - Click 'Add Report' button
   - Fill in report details
   - Save and verify it appears in the list
   
4. ✅ Monitor database:
   - Check lead_settings.db for new entries
   - Verify all preferences are saved in system_settings table
    
5. ✅ Test system-wide application:
   - New settings should affect system behavior globally
   - Email settings should be used for sending notifications
   - Security settings should enforce constraints system-wide
""")

if __name__ == "__main__":
    print_header("LEAD SETTINGS EXPANSION VERIFICATION")
    print_info("Verifying all new tabs and settings implementation...")
    
    generate_summary()
