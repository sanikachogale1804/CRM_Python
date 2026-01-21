/**
 * Login Page JavaScript
 * Responsive and Mobile-Friendly
 */

class LoginManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
        this.initializeTime();
        this.checkSession();
    }

    initializeElements() {
        // Form elements
        this.loginForm = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.rememberMe = document.getElementById('rememberMe');
        this.loginButton = document.getElementById('loginButton');
        
        // Action buttons
        this.clearUsernameBtn = document.getElementById('clearUsername');
        this.togglePasswordBtn = document.getElementById('togglePassword');
        this.demoButtons = document.querySelectorAll('.demo-btn');
        
        // Alert containers
        this.errorAlert = document.getElementById('errorAlert');
        this.successAlert = document.getElementById('successAlert');
        
        // Error displays
        this.usernameError = document.getElementById('usernameError');
        this.passwordError = document.getElementById('passwordError');
        
        // Time display
        this.currentTime = document.getElementById('currentTime');
    }

    setupEventListeners() {
        // Form submission
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        
        // Input actions
        this.clearUsernameBtn?.addEventListener('click', () => this.clearUsername());
        this.togglePasswordBtn?.addEventListener('click', () => this.togglePasswordVisibility());
        
        // Input validation
        this.usernameInput.addEventListener('input', () => this.validateUsername());
        this.passwordInput.addEventListener('input', () => this.validatePassword());
        
        // Demo accounts
        this.demoButtons.forEach(btn => {
            btn.addEventListener('click', () => this.fillDemoCredentials(btn));
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Touch device optimizations
        this.optimizeForTouch();
    }

    initializeTime() {
        const updateTime = () => {
            const now = new Date();
            this.currentTime.textContent = now.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        };
        
        updateTime();
        setInterval(updateTime, 60000); // Update every minute
    }

    async checkSession() {
        try {
            const response = await fetch('/api/validate-session', {
                credentials: 'include',
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                // Already logged in, redirect to dashboard
                console.log('User already logged in, redirecting to dashboard...');
                window.location.href = '/dashboard';
                return;
            }
            
            // If response is not ok, user is not logged in, so continue showing login form
            console.log('No active session, showing login form');
        } catch (error) {
            // Network error or endpoint not available - not critical, just show login form
            console.log('Session check failed (expected if not logged in)');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        // Validate form
        if (!this.validateForm()) {
            return;
        }
        // Disable form and show loading
        this.setFormState(true);
        try {
            const credentials = {
                username: this.usernameInput.value.trim(),
                password: this.passwordInput.value
            };
            // Collect system info
            const systemInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                screen: {
                    width: window.screen.width,
                    height: window.screen.height,
                    availWidth: window.screen.availWidth,
                    availHeight: window.screen.availHeight,
                    colorDepth: window.screen.colorDepth,
                    pixelDepth: window.screen.pixelDepth
                },
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceMemory: navigator.deviceMemory || null,
                hardwareConcurrency: navigator.hardwareConcurrency || null,
                touchSupport: 'ontouchstart' in window,
                cookiesEnabled: navigator.cookieEnabled,
                referrer: document.referrer
            };
            // Fetch public IP and add to systemInfo
            try {
                const ipRes = await fetch('https://api.ipify.org?format=json');
                if (ipRes.ok) {
                    const ipData = await ipRes.json();
                    systemInfo.publicIP = ipData.ip;
                }
            } catch (ipErr) {
                systemInfo.publicIP = 'unavailable';
            }
            // Send login request
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(credentials)
            });
            const data = await response.json();
            if (data.success) {
                // Send system info to backend for audit log
                fetch('/api/audit-system-info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        username: credentials.username,
                        system_info: systemInfo
                    })
                });
                this.showAlert('success', 'Login successful! Redirecting...');
                // ...existing code...
                // Store user info
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('session_token', data.session_token);
                // Store permissions for PermissionManager
                if (window.PermissionManager) {
                    window.PermissionManager.store(
                        data.user.permission_keys || [],
                        data.user.is_admin || false
                    );
                }
                // Remember me
                if (this.rememberMe.checked) {
                    localStorage.setItem('remembered_username', credentials.username);
                } else {
                    localStorage.removeItem('remembered_username');
                }
                this.trackLoginEvent('success', credentials.username);
                const permissionKeys = data.user.permission_keys || [];
                const isAdmin = data.user.is_admin || false;
                const hasPageAccess = (pageKey) => {
                    if (isAdmin) return true;
                    return permissionKeys.some(key => key === pageKey || key.startsWith(`${pageKey}.`));
                };
                const preferredRoutes = [
                    { key: 'dashboard', path: '/dashboard' },
                    { key: 'leads', path: '/leads' },
                    { key: 'add_lead', path: '/add-lead' },
                    { key: 'target_management', path: '/target-management' },
                    { key: 'lead_settings', path: '/lead-settings' },
                    { key: 'users', path: '/users' },
                    { key: 'control_panel', path: '/control-panel' },
                ];
                const computedRedirect = preferredRoutes.find(route => hasPageAccess(route.key))?.path || '/leads';
                const redirectTarget = data.redirect_to || computedRedirect;
                setTimeout(() => {
                    window.location.href = redirectTarget;
                }, 1000);
            } else {
                this.showAlert('error', data.detail || 'Invalid credentials');
                this.trackLoginEvent('failed', credentials.username);
                this.setFormState(false);
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showAlert('error', this.getNetworkErrorMessage(error));
            this.trackLoginEvent('error');
            this.setFormState(false);
        }
    }

    validateForm() {
        let isValid = true;
        
        // Clear previous errors
        this.clearErrors();
        
        // Validate username
        if (!this.validateUsername()) {
            isValid = false;
        }
        
        // Validate password
        if (!this.validatePassword()) {
            isValid = false;
        }
        
        return isValid;
    }

    validateUsername() {
        const username = this.usernameInput.value.trim();
        let isValid = true;
        let errorMessage = '';
        
        if (!username) {
            errorMessage = 'Username is required';
            isValid = false;
        } else if (username.length < 3) {
            errorMessage = 'Username must be at least 3 characters';
            isValid = false;
        } else if (username.length > 50) {
            errorMessage = 'Username must be less than 50 characters';
            isValid = false;
        }
        
        this.showInputError(this.usernameInput, this.usernameError, errorMessage);
        return isValid;
    }

    validatePassword() {
        const password = this.passwordInput.value;
        let isValid = true;
        let errorMessage = '';
        
        if (!password) {
            errorMessage = 'Password is required';
            isValid = false;
        } else if (password.length < 6) {
            errorMessage = 'Password must be at least 6 characters';
            isValid = false;
        }
        
        this.showInputError(this.passwordInput, this.passwordError, errorMessage);
        return isValid;
    }

    showInputError(input, errorElement, message) {
        if (message) {
            input.classList.add('error');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Add ARIA attributes for accessibility
            input.setAttribute('aria-invalid', 'true');
            input.setAttribute('aria-describedby', errorElement.id);
        } else {
            input.classList.remove('error');
            errorElement.style.display = 'none';
            input.removeAttribute('aria-invalid');
            input.removeAttribute('aria-describedby');
        }
    }

    clearErrors() {
        this.showInputError(this.usernameInput, this.usernameError, '');
        this.showInputError(this.passwordInput, this.passwordError, '');
        this.hideAlert();
    }

    setFormState(isLoading) {
        const inputs = [this.usernameInput, this.passwordInput, this.rememberMe];
        const buttonText = this.loginButton.querySelector('.btn-text');
        
        if (isLoading) {
            // Disable form
            inputs.forEach(input => input.disabled = true);
            this.loginButton.disabled = true;
            
            // Show loading state
            buttonText.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span>';
            this.loginButton.style.cursor = 'wait';
            
        } else {
            // Enable form
            inputs.forEach(input => input.disabled = false);
            this.loginButton.disabled = false;
            
            // Restore button text
            buttonText.textContent = 'Sign In';
            this.loginButton.style.cursor = 'pointer';
        }
    }

    clearUsername() {
        this.usernameInput.value = '';
        this.usernameInput.focus();
        this.validateUsername();
    }

    togglePasswordVisibility() {
        const type = this.passwordInput.getAttribute('type');
        const isPassword = type === 'password';
        
        this.passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        this.togglePasswordBtn.classList.toggle('active', !isPassword);
        
        // Announce change for screen readers
        const announcement = isPassword ? 'Password visible' : 'Password hidden';
        this.announceForScreenReaders(announcement);
    }

    fillDemoCredentials(button) {
        const username = button.dataset.username;
        const password = button.dataset.password;
        
        this.usernameInput.value = username;
        this.passwordInput.value = password;
        
        // Trigger validation
        this.validateUsername();
        this.validatePassword();
        
        // Focus on login button
        this.loginButton.focus();
        
        // Announce for screen readers
        this.announceForScreenReaders(`Demo ${username} credentials filled`);
    }

    showAlert(type, message) {
        // Hide both alerts first
        this.errorAlert.style.display = 'none';
        this.successAlert.style.display = 'none';
        this.errorAlert.removeAttribute('role');
        this.successAlert.removeAttribute('role');
        
        const alertElement = type === 'error' ? this.errorAlert : this.successAlert;
        const alertType = type === 'error' ? 'alert' : 'status';
        
        alertElement.textContent = message;
        alertElement.style.display = 'block';
        alertElement.setAttribute('role', alertType);
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                this.hideAlert();
            }, 5000);
        }
        
        // Focus alert for screen readers
        if (type === 'error') {
            setTimeout(() => {
                alertElement.focus();
            }, 100);
        }
    }

    hideAlert() {
        this.errorAlert.style.display = 'none';
        this.successAlert.style.display = 'none';
        this.errorAlert.removeAttribute('role');
        this.successAlert.removeAttribute('role');
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.loginForm.requestSubmit();
        }
        
        // Escape to clear form
        if (e.key === 'Escape') {
            this.clearUsername();
        }
    }

    optimizeForTouch() {
        // Increase touch target size on mobile
        if ('ontouchstart' in window) {
            const touchElements = [
                this.loginButton,
                this.clearUsernameBtn,
                this.togglePasswordBtn,
                ...this.demoButtons
            ];
            
            touchElements.forEach(el => {
                if (el) {
                    el.style.minHeight = '44px';
                    el.style.minWidth = '44px';
                }
            });
        }
    }

    getNetworkErrorMessage(error) {
        if (navigator.onLine === false) {
            return 'No internet connection. Please check your network.';
        }
        
        if (error.message.includes('Failed to fetch')) {
            return 'Cannot connect to server. Please try again.';
        }
        
        return 'Network error occurred. Please try again.';
    }

    trackLoginEvent(status, username = '') {
        // You can integrate with analytics services here
        console.log(`Login ${status} for user: ${username}`);
        
        // Example: Send to analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'login', {
                'event_category': 'authentication',
                'event_label': status,
                'value': username
            });
        }
    }

    announceForScreenReaders(message) {
        // Create announcement element
        let announcement = document.getElementById('screen-reader-announcement');
        
        if (!announcement) {
            announcement = document.createElement('div');
            announcement.id = 'screen-reader-announcement';
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.style.cssText = `
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                white-space: nowrap;
                border: 0;
            `;
            document.body.appendChild(announcement);
        }
        
        announcement.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            announcement.textContent = '';
        }, 1000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load remembered username
    const rememberedUsername = localStorage.getItem('remembered_username');
    if (rememberedUsername) {
        document.getElementById('username').value = rememberedUsername;
        document.getElementById('rememberMe').checked = true;
    }
    
    // Initialize login manager
    window.loginManager = new LoginManager();
    
    // Focus username field on load
    setTimeout(() => {
        const usernameField = document.getElementById('username');
        if (usernameField && !usernameField.value) {
            usernameField.focus();
        }
    }, 100);
});

// Service Worker Registration (Optional)
if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}

// Offline Detection
window.addEventListener('online', () => {
    if (window.loginManager) {
        window.loginManager.showAlert('success', 'You are back online.');
    }
});

window.addEventListener('offline', () => {
    if (window.loginManager) {
        window.loginManager.showAlert('error', 'You are offline. Some features may not work.');
    }
});

// Page Visibility API
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden
        console.log('Login page hidden');
    } else {
        // Page is visible
        console.log('Login page visible');
    }
});

// Prevent form resubmission on refresh
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}