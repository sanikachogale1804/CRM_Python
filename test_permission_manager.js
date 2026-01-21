#!/usr/bin/env node
/**
 * Test the PermissionManager logic in a Node.js environment
 * This simulates what happens in the browser
 */

console.log("🧪 Testing PermissionManager logic...\n");

// Simulate sessionStorage and localStorage
const storage = {
    session: {},
    local: {}
};

Object.defineProperty(global, 'sessionStorage', {
    value: {
        getItem: (key) => storage.session[key] || null,
        setItem: (key, value) => { storage.session[key] = value; },
        removeItem: (key) => { delete storage.session[key]; }
    }
});

Object.defineProperty(global, 'localStorage', {
    value: {
        getItem: (key) => storage.local[key] || null,
        setItem: (key, value) => { storage.local[key] = value; },
        removeItem: (key) => { delete storage.local[key]; }
    }
});

// Simulate PermissionManager
const PermissionManager = {
    permissions: [],
    isAdmin: false,
    initialized: false,
    
    init() {
        if (this.initialized) return;
        
        try {
            const rawData = sessionStorage.getItem('userPermissions');
            console.log('📦 Raw sessionStorage.userPermissions:', rawData);
            
            const data = JSON.parse(rawData || '{}');
            this.permissions = data.permission_keys || [];
            this.isAdmin = data.is_admin || false;
            
            if (!this.isAdmin && localStorage.getItem('user')) {
                try {
                    const user = JSON.parse(localStorage.getItem('user'));
                    if (user.role === 'admin') {
                        this.isAdmin = true;
                        console.log('✅ Admin status inferred from localStorage');
                    }
                } catch (e) {}
            }
            
            this.initialized = true;
            console.log('✅ PermissionManager initialized:', {
                totalPermissions: this.permissions.length,
                isAdmin: this.isAdmin,
                firstPermissions: this.permissions.slice(0, 3)
            });
        } catch (error) {
            console.error('Failed to initialize PermissionManager:', error);
            this.permissions = [];
            this.isAdmin = false;
        }
    },
    
    has(permissionKey) {
        if (!permissionKey) return true;
        if (this.isAdmin) {
            console.log(`✅ Admin user - granting permission: ${permissionKey}`);
            return true;
        }
        return this.permissions.includes(permissionKey);
    },
    
    applyGuards() {
        if (!this.initialized) this.init();
        
        console.log('🔐 Applying permission guards...', {
            initialized: this.initialized,
            isAdmin: this.isAdmin,
            totalPermissions: this.permissions.length
        });
        
        if (this.isAdmin) {
            console.log('✅ Admin user detected - skipping all permission guards');
            return;
        }
        
        console.log('🔐 Checking non-admin permissions...');
    },
    
    store(permissionKeys, isAdmin = false) {
        this.permissions = permissionKeys || [];
        this.isAdmin = isAdmin;
        this.initialized = true;
        
        sessionStorage.setItem('userPermissions', JSON.stringify({
            permission_keys: this.permissions,
            is_admin: this.isAdmin
        }));
    }
};

// Test Case 1: Admin stores permissions in sessionStorage
console.log("\n=== TEST CASE 1: Admin with permissions in sessionStorage ===");
PermissionManager.store(['dashboard', 'leads', 'users'], true);
PermissionManager.initialized = false; // Reset to test init()
PermissionManager.init();
console.log("has('dashboard'):", PermissionManager.has('dashboard'));
console.log("has('invalid'):", PermissionManager.has('invalid'));

// Test Case 2: Check applyGuards for admin
console.log("\n=== TEST CASE 2: applyGuards() for admin ===");
PermissionManager.applyGuards();

// Test Case 3: Admin inferred from localStorage fallback
console.log("\n=== TEST CASE 3: Admin inferred from localStorage fallback ===");
localStorage.setItem('user', JSON.stringify({
    user_id: 1,
    username: 'admin',
    role: 'admin'
}));
sessionStorage.removeItem('userPermissions');
PermissionManager.permissions = [];
PermissionManager.isAdmin = false;
PermissionManager.initialized = false;
PermissionManager.init();
console.log("isAdmin after fallback:", PermissionManager.isAdmin);
console.log("has('dashboard'):", PermissionManager.has('dashboard'));

// Test Case 4: Non-admin without permissions
console.log("\n=== TEST CASE 4: Non-admin without permissions ===");
localStorage.setItem('user', JSON.stringify({
    user_id: 2,
    username: 'user',
    role: 'user'
}));
sessionStorage.removeItem('userPermissions');
PermissionManager.permissions = [];
PermissionManager.isAdmin = false;
PermissionManager.initialized = false;
PermissionManager.init();
console.log("isAdmin:", PermissionManager.isAdmin);
console.log("has('dashboard'):", PermissionManager.has('dashboard'));

console.log("\n✅ All tests completed!");
