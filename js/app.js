/**
 * نظام جرد وحصر الأصول الحكومية
 * Government Asset Inventory System
 * Enhanced Version with Offline Support & Local Storage
 */

// === Database Configuration ===
const DB_NAME = 'AssetInventoryDB';
const DB_VERSION = 2;
const STORES = {
    assets: 'assets',
    departments: 'departments',
    maintenance: 'maintenance',
    inventoryLogs: 'inventory_logs',
    settings: 'settings',
    syncQueue: 'sync_queue'
};

// === Application State ===
const APP_STATE = {
    assets: [],
    departments: [],
    maintenance: [],
    inventoryLogs: [],
    categories: ['أثاث', 'معدات إلكترونية', 'مركبات', 'أجهزة طبية', 'معدات مكتبية', 'أجهزة كهربائية', 'أخرى'],
    conditions: ['ممتاز', 'جيد', 'مقبول', 'يحتاج صيانة', 'تالف'],
    currentPage: 1,
    itemsPerPage: 10,
    selectedAsset: null,
    uploadedImages: [],
    barcodeScanner: null,
    charts: {},
    db: null,
    isOnline: navigator.onLine,
    lastSync: null,
    inventoryPerson: '',
    pendingSyncCount: 0,
    autoSaveEnabled: true
};

// === API Configuration ===
const API_BASE = 'tables';

// === IndexedDB Functions ===
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            APP_STATE.db = request.result;
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Assets store
            if (!db.objectStoreNames.contains(STORES.assets)) {
                const assetsStore = db.createObjectStore(STORES.assets, { keyPath: 'id' });
                assetsStore.createIndex('code', 'code', { unique: false });
                assetsStore.createIndex('category', 'category', { unique: false });
                assetsStore.createIndex('department', 'department', { unique: false });
            }
            
            // Departments store
            if (!db.objectStoreNames.contains(STORES.departments)) {
                db.createObjectStore(STORES.departments, { keyPath: 'id' });
            }
            
            // Maintenance store
            if (!db.objectStoreNames.contains(STORES.maintenance)) {
                db.createObjectStore(STORES.maintenance, { keyPath: 'id' });
            }
            
            // Inventory logs store
            if (!db.objectStoreNames.contains(STORES.inventoryLogs)) {
                db.createObjectStore(STORES.inventoryLogs, { keyPath: 'id' });
            }
            
            // Settings store
            if (!db.objectStoreNames.contains(STORES.settings)) {
                db.createObjectStore(STORES.settings, { keyPath: 'key' });
            }
            
            // Sync queue store
            if (!db.objectStoreNames.contains(STORES.syncQueue)) {
                const syncStore = db.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
                syncStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = APP_STATE.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = APP_STATE.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function dbPut(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = APP_STATE.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => {
            showAutoSaveIndicator();
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
        const transaction = APP_STATE.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function dbClear(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = APP_STATE.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// === Sync Queue Functions ===
async function addToSyncQueue(action, storeName, data) {
    const queueItem = {
        action,
        storeName,
        data,
        timestamp: Date.now()
    };
    
    await dbPut(STORES.syncQueue, queueItem);
    APP_STATE.pendingSyncCount++;
    updateSyncStatus();
}

async function processSyncQueue() {
    if (!APP_STATE.isOnline) return;
    
    try {
        const queue = await dbGetAll(STORES.syncQueue);
        
        for (const item of queue) {
            try {
                let endpoint = `${API_BASE}/${item.storeName}`;
                let method = 'POST';
                
                if (item.action === 'update') {
                    endpoint += `/${item.data.id}`;
                    method = 'PUT';
                } else if (item.action === 'delete') {
                    endpoint += `/${item.data.id}`;
                    method = 'DELETE';
                }
                
                await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined
                });
                
                await dbDelete(STORES.syncQueue, item.id);
                APP_STATE.pendingSyncCount--;
                
            } catch (e) {
                console.error('Sync error for item:', item, e);
            }
        }
        
        APP_STATE.lastSync = new Date();
        saveSettings();
        updateSyncStatus();
        
    } catch (error) {
        console.error('Error processing sync queue:', error);
    }
}

// === Settings Functions ===
async function loadSettings() {
    try {
        const inventoryPerson = await dbGet(STORES.settings, 'inventoryPerson');
        if (inventoryPerson) {
            APP_STATE.inventoryPerson = inventoryPerson.value;
            updateInventoryPersonDisplay();
        }
        
        const lastSync = await dbGet(STORES.settings, 'lastSync');
        if (lastSync) {
            APP_STATE.lastSync = new Date(lastSync.value);
        }
        
        const categories = await dbGet(STORES.settings, 'categories');
        if (categories && categories.value) {
            APP_STATE.categories = categories.value;
        }
        
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        await dbPut(STORES.settings, { key: 'inventoryPerson', value: APP_STATE.inventoryPerson });
        await dbPut(STORES.settings, { key: 'lastSync', value: APP_STATE.lastSync ? APP_STATE.lastSync.toISOString() : null });
        await dbPut(STORES.settings, { key: 'categories', value: APP_STATE.categories });
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// === Initialize Application ===
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showLoading();
    
    try {
        // Initialize database
        await initDatabase();
        console.log('Database initialized');
        
        // Load settings
        await loadSettings();
        
        // Set current date
        document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-SA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Initialize event listeners
        initializeEventListeners();
        
        // Setup online/offline handlers
        setupNetworkHandlers();
        
        // Load data (from local first, then try to sync)
        await loadAllData();
        
        // Initialize charts
        initializeCharts();
        
        // Populate filter dropdowns
        populateFilters();
        
        // Update dashboard
        updateDashboard();
        
        // Check for unsaved data
        checkForUnsavedData();
        
        // Register Service Worker
        registerServiceWorker();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('حدث خطأ أثناء تهيئة التطبيق', 'error');
    }
    
    hideLoading();
}

function initializeEventListeners() {
    // Mobile menu toggle
    document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
    
    // Asset form submit
    document.getElementById('assetForm').addEventListener('submit', handleAssetSubmit);
    
    // Department form submit
    document.getElementById('departmentForm').addEventListener('submit', handleDepartmentSubmit);
    
    // Maintenance form submit
    document.getElementById('maintenanceForm').addEventListener('submit', handleMaintenanceSubmit);
    
    // Inventory form submit
    document.getElementById('inventoryForm').addEventListener('submit', handleInventorySubmit);
    
    // Search and filters
    document.getElementById('assetSearch').addEventListener('input', debounce(filterAssets, 300));
    document.getElementById('categoryFilter').addEventListener('change', filterAssets);
    document.getElementById('conditionFilter').addEventListener('change', filterAssets);
    document.getElementById('departmentFilter').addEventListener('change', filterAssets);
    
    // Global search
    document.getElementById('globalSearch').addEventListener('input', debounce(handleGlobalSearch, 300));
    
    // Select all checkbox
    document.getElementById('selectAll').addEventListener('change', handleSelectAll);
    
    // Close modals on outside click
    document.querySelectorAll('.fixed.inset-0').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.add('hidden');
            }
        });
    });
    
    // Set today's date for inventory
    document.getElementById('inventoryDate').valueAsDate = new Date();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Before unload warning
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function handleKeyboardShortcuts(e) {
    // Ctrl+S or Cmd+S - Force sync
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        forceSyncData();
    }
    
    // Ctrl+N or Cmd+N - New asset
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        openAssetModal();
    }
    
    // Escape - Close modals
    if (e.key === 'Escape') {
        closeAllModals();
    }
}

function handleBeforeUnload(e) {
    if (APP_STATE.pendingSyncCount > 0) {
        // Data is safely stored in IndexedDB, no need to warn
        // But we can show a subtle message
        console.log('Closing with pending sync items:', APP_STATE.pendingSyncCount);
    }
}

function closeAllModals() {
    document.querySelectorAll('.fixed.inset-0').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// === Network Handlers ===
function setupNetworkHandlers() {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Initial status
    updateNetworkStatus();
}

function handleOnline() {
    APP_STATE.isOnline = true;
    updateNetworkStatus();
    
    // Show online banner briefly
    const banner = document.getElementById('onlineBanner');
    if (banner) {
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 3000);
    }
    
    // Try to sync pending data
    processSyncQueue();
    
    showToast('تم استعادة الاتصال بالإنترنت', 'success');
}

function handleOffline() {
    APP_STATE.isOnline = false;
    updateNetworkStatus();
    
    // Show offline banner
    const banner = document.getElementById('offlineBanner');
    if (banner) {
        banner.classList.add('show');
    }
    
    showToast('أنت الآن في وضع عدم الاتصال. البيانات محفوظة محلياً.', 'warning');
}

function updateNetworkStatus() {
    const offlineBanner = document.getElementById('offlineBanner');
    
    if (offlineBanner) {
        if (APP_STATE.isOnline) {
            offlineBanner.classList.remove('show');
        } else {
            offlineBanner.classList.add('show');
        }
    }
    
    updateSyncStatus();
}

function updateSyncStatus() {
    const syncStatusEl = document.getElementById('syncStatus');
    if (!syncStatusEl) return;
    
    if (!APP_STATE.isOnline) {
        syncStatusEl.className = 'sync-status pending';
        syncStatusEl.innerHTML = '<i class="fas fa-wifi-slash"></i> غير متصل';
    } else if (APP_STATE.pendingSyncCount > 0) {
        syncStatusEl.className = 'sync-status syncing';
        syncStatusEl.innerHTML = `<i class="fas fa-sync fa-spin"></i> جاري المزامنة (${APP_STATE.pendingSyncCount})`;
    } else {
        syncStatusEl.className = 'sync-status synced';
        syncStatusEl.innerHTML = '<i class="fas fa-check-circle"></i> متزامن';
    }
    
    // Update last sync time
    const lastSyncEl = document.getElementById('lastSyncTime');
    if (lastSyncEl && APP_STATE.lastSync) {
        lastSyncEl.textContent = `آخر مزامنة: ${formatDateTime(APP_STATE.lastSync)}`;
    }
}

function showAutoSaveIndicator() {
    const indicator = document.getElementById('autoSaveIndicator');
    if (indicator) {
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 2000);
    }
}

// === Service Worker Registration ===
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registered:', registration);
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    }
}

// === Page Navigation ===
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Show selected page
    document.getElementById(`page-${pageName}`).classList.remove('hidden');
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    event.target.closest('.nav-link').classList.add('active');
    
    // Update page title
    const titles = {
        'dashboard': 'لوحة التحكم',
        'assets': 'إدارة الأصول',
        'inventory': 'عمليات الجرد',
        'departments': 'الإدارات والأقسام',
        'reports': 'التقارير',
        'maintenance': 'الصيانة',
        'settings': 'الإعدادات'
    };
    document.getElementById('pageTitle').textContent = titles[pageName] || pageName;
    
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    
    // Page-specific actions
    if (pageName === 'assets') {
        renderAssetsTable();
    } else if (pageName === 'departments') {
        renderDepartments();
    } else if (pageName === 'maintenance') {
        renderMaintenanceTable();
        updateMaintenanceStats();
    } else if (pageName === 'settings') {
        renderCategoriesList();
        renderStorageInfo();
    } else if (pageName === 'inventory') {
        renderInventoryLogs();
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// === Data Loading ===
async function loadAllData() {
    try {
        // First, load from local IndexedDB
        APP_STATE.assets = await dbGetAll(STORES.assets);
        APP_STATE.departments = await dbGetAll(STORES.departments);
        APP_STATE.maintenance = await dbGetAll(STORES.maintenance);
        APP_STATE.inventoryLogs = await dbGetAll(STORES.inventoryLogs);
        
        console.log('Loaded from local DB:', {
            assets: APP_STATE.assets.length,
            departments: APP_STATE.departments.length
        });
        
        // If online, try to fetch from server and merge
        if (APP_STATE.isOnline) {
            await fetchAndMergeServerData();
        }
        
        // If still no data, load sample data
        if (APP_STATE.assets.length === 0 && APP_STATE.departments.length === 0) {
            await loadSampleData();
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        // Try to load sample data locally
        loadSampleDataLocally();
    }
}

async function fetchAndMergeServerData() {
    try {
        // Load assets from server
        const assetsResponse = await fetch(`${API_BASE}/assets?limit=1000`);
        if (assetsResponse.ok) {
            const assetsData = await assetsResponse.json();
            const serverAssets = assetsData.data || [];
            
            // Merge with local data (server takes precedence for same IDs)
            for (const asset of serverAssets) {
                await dbPut(STORES.assets, asset);
            }
            APP_STATE.assets = await dbGetAll(STORES.assets);
        }
        
        // Load departments from server
        const deptResponse = await fetch(`${API_BASE}/departments?limit=100`);
        if (deptResponse.ok) {
            const deptData = await deptResponse.json();
            const serverDepts = deptData.data || [];
            
            for (const dept of serverDepts) {
                await dbPut(STORES.departments, dept);
            }
            APP_STATE.departments = await dbGetAll(STORES.departments);
        }
        
        // Load maintenance records
        const maintResponse = await fetch(`${API_BASE}/maintenance?limit=100`);
        if (maintResponse.ok) {
            const maintData = await maintResponse.json();
            const serverMaint = maintData.data || [];
            
            for (const maint of serverMaint) {
                await dbPut(STORES.maintenance, maint);
            }
            APP_STATE.maintenance = await dbGetAll(STORES.maintenance);
        }
        
        // Load inventory logs
        const invResponse = await fetch(`${API_BASE}/inventory_logs?limit=100`);
        if (invResponse.ok) {
            const invData = await invResponse.json();
            const serverInv = invData.data || [];
            
            for (const inv of serverInv) {
                await dbPut(STORES.inventoryLogs, inv);
            }
            APP_STATE.inventoryLogs = await dbGetAll(STORES.inventoryLogs);
        }
        
        APP_STATE.lastSync = new Date();
        saveSettings();
        updateSyncStatus();
        
    } catch (error) {
        console.error('Error fetching server data:', error);
    }
}

async function loadSampleData() {
    // Sample departments
    const sampleDepts = [
        { id: generateId(), name: 'تقنية المعلومات', location: 'الطابق الثالث', manager: 'أحمد محمد' },
        { id: generateId(), name: 'الإدارة المالية', location: 'الطابق الثاني', manager: 'سارة أحمد' },
        { id: generateId(), name: 'الموارد البشرية', location: 'الطابق الأول', manager: 'محمد علي' },
        { id: generateId(), name: 'النقل والمواصلات', location: 'المبنى الخارجي', manager: 'عبدالله خالد' },
        { id: generateId(), name: 'الخدمات الطبية', location: 'المبنى الطبي', manager: 'نورة سعد' }
    ];
    
    for (const dept of sampleDepts) {
        await dbPut(STORES.departments, dept);
        APP_STATE.departments.push(dept);
        
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/departments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dept)
                });
            } catch (e) {
                console.error('Error syncing department:', e);
            }
        }
    }
    
    // Sample assets
    const sampleAssets = [
        {
            id: generateId(),
            name: 'جهاز كمبيوتر Dell OptiPlex',
            code: 'IT-2024-001',
            category: 'معدات إلكترونية',
            location: 'الطابق الثالث - غرفة 301',
            department: 'تقنية المعلومات',
            purchaseDate: '2024-01-15',
            purchasePrice: 4500,
            currentValue: 4000,
            condition: 'ممتاز',
            serialNumber: 'DL-2024-XYZ-123',
            supplier: 'شركة التقنية المتقدمة',
            warranty: '2027-01-15',
            assignee: 'محمد أحمد',
            inventoryPerson: '',
            lastInventoryDate: '',
            notes: 'جهاز حديث بمواصفات عالية - Core i7'
        },
        {
            id: generateId(),
            name: 'طابعة HP LaserJet Pro',
            code: 'IT-2024-002',
            category: 'معدات إلكترونية',
            location: 'الطابق الثالث - غرفة الطباعة',
            department: 'تقنية المعلومات',
            purchaseDate: '2024-02-10',
            purchasePrice: 2800,
            currentValue: 2500,
            condition: 'ممتاز',
            serialNumber: 'HP-2024-LJ-456',
            supplier: 'شركة الحاسب العربي',
            warranty: '2026-02-10',
            assignee: '',
            inventoryPerson: '',
            lastInventoryDate: '',
            notes: 'طابعة شبكية للمكتب'
        },
        {
            id: generateId(),
            name: 'مكتب تنفيذي خشبي',
            code: 'FRN-2023-045',
            category: 'أثاث',
            location: 'الطابق الثاني - مكتب المدير',
            department: 'الإدارة المالية',
            purchaseDate: '2023-05-20',
            purchasePrice: 3200,
            currentValue: 2800,
            condition: 'جيد',
            serialNumber: 'WD-2023-456',
            supplier: 'مؤسسة الأثاث الفاخر',
            warranty: '',
            assignee: 'مدير الإدارة المالية',
            inventoryPerson: '',
            lastInventoryDate: '',
            notes: 'مكتب خشب طبيعي مع أدراج'
        },
        {
            id: generateId(),
            name: 'سيارة تويوتا كامري 2022',
            code: 'VEH-2022-008',
            category: 'مركبات',
            location: 'موقف السيارات الرئيسي',
            department: 'النقل والمواصلات',
            purchaseDate: '2022-08-10',
            purchasePrice: 95000,
            currentValue: 78000,
            condition: 'جيد',
            serialNumber: 'TY-2022-CAM-789',
            supplier: 'وكيل تويوتا المعتمد',
            warranty: '',
            assignee: 'قسم النقل',
            inventoryPerson: '',
            lastInventoryDate: '',
            notes: 'صيانة دورية منتظمة - موديل 2022'
        },
        {
            id: generateId(),
            name: 'جهاز قياس ضغط الدم',
            code: 'MED-2024-012',
            category: 'أجهزة طبية',
            location: 'العيادة الطبية - الطابق الأول',
            department: 'الخدمات الطبية',
            purchaseDate: '2024-03-01',
            purchasePrice: 850,
            currentValue: 800,
            condition: 'ممتاز',
            serialNumber: 'OM-2024-BP-111',
            supplier: 'شركة المستلزمات الطبية',
            warranty: '2026-03-01',
            assignee: 'الممرض المسؤول',
            inventoryPerson: '',
            lastInventoryDate: '',
            notes: 'جهاز رقمي دقيق'
        }
    ];
    
    for (const asset of sampleAssets) {
        await dbPut(STORES.assets, asset);
        APP_STATE.assets.push(asset);
        
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/assets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(asset)
                });
            } catch (e) {
                console.error('Error syncing asset:', e);
            }
        }
    }
}

function loadSampleDataLocally() {
    // Fallback local data if everything fails
    APP_STATE.departments = [
        { id: '1', name: 'تقنية المعلومات', location: 'الطابق الثالث', manager: 'أحمد محمد' },
        { id: '2', name: 'الإدارة المالية', location: 'الطابق الثاني', manager: 'سارة أحمد' },
        { id: '3', name: 'الموارد البشرية', location: 'الطابق الأول', manager: 'محمد علي' }
    ];
    
    APP_STATE.assets = [
        {
            id: '1',
            name: 'جهاز كمبيوتر Dell OptiPlex',
            code: 'IT-2024-001',
            category: 'معدات إلكترونية',
            location: 'الطابق الثالث - غرفة 301',
            department: 'تقنية المعلومات',
            purchaseDate: '2024-01-15',
            purchasePrice: 4500,
            currentValue: 4000,
            condition: 'ممتاز',
            serialNumber: 'DL-2024-XYZ-123',
            supplier: 'شركة التقنية المتقدمة',
            warranty: '2027-01-15',
            assignee: 'محمد أحمد',
            inventoryPerson: '',
            lastInventoryDate: '',
            notes: 'جهاز حديث بمواصفات عالية'
        }
    ];
}

// === Generate ID ===
function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// === Check for Unsaved Data ===
async function checkForUnsavedData() {
    try {
        const queue = await dbGetAll(STORES.syncQueue);
        APP_STATE.pendingSyncCount = queue.length;
        
        if (queue.length > 0) {
            updateSyncStatus();
            
            // If online, try to sync
            if (APP_STATE.isOnline) {
                processSyncQueue();
            }
        }
    } catch (error) {
        console.error('Error checking unsaved data:', error);
    }
}

// === Force Sync ===
async function forceSyncData() {
    if (!APP_STATE.isOnline) {
        showToast('لا يمكن المزامنة - أنت غير متصل بالإنترنت', 'warning');
        return;
    }
    
    showLoading();
    
    try {
        await processSyncQueue();
        await fetchAndMergeServerData();
        updateDashboard();
        showToast('تم مزامنة البيانات بنجاح', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showToast('حدث خطأ أثناء المزامنة', 'error');
    }
    
    hideLoading();
}

// === Inventory Person Functions ===
function setInventoryPerson() {
    const name = prompt('أدخل اسم القائم بالجرد:', APP_STATE.inventoryPerson);
    if (name !== null) {
        APP_STATE.inventoryPerson = name.trim();
        saveSettings();
        updateInventoryPersonDisplay();
        showToast('تم تحديث اسم القائم بالجرد', 'success');
    }
}

function updateInventoryPersonDisplay() {
    const displays = document.querySelectorAll('.inventory-person-display');
    displays.forEach(el => {
        if (APP_STATE.inventoryPerson) {
            el.textContent = APP_STATE.inventoryPerson;
            el.parentElement.style.display = 'flex';
        } else {
            el.parentElement.style.display = 'none';
        }
    });
    
    // Update the badge in sidebar
    const badge = document.getElementById('inventoryPersonBadge');
    if (badge) {
        if (APP_STATE.inventoryPerson) {
            badge.innerHTML = `<i class="fas fa-user-check"></i> ${APP_STATE.inventoryPerson}`;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// === Dashboard Functions ===
function updateDashboard() {
    // Update stats
    document.getElementById('totalAssets').textContent = APP_STATE.assets.length;
    
    const totalValue = APP_STATE.assets.reduce((sum, asset) => sum + (parseFloat(asset.currentValue) || 0), 0);
    document.getElementById('totalValue').textContent = formatCurrency(totalValue);
    
    const needMaintenance = APP_STATE.assets.filter(a => a.condition === 'يحتاج صيانة' || a.condition === 'تالف').length;
    document.getElementById('needMaintenance').textContent = needMaintenance;
    
    document.getElementById('totalDepartments').textContent = APP_STATE.departments.length;
    
    // Update recent assets table
    renderRecentAssets();
    
    // Update alerts
    renderAlerts();
    
    // Update charts
    updateCharts();
}

function renderRecentAssets() {
    const tbody = document.getElementById('recentAssetsTable');
    const recentAssets = APP_STATE.assets.slice(-5).reverse();
    
    tbody.innerHTML = recentAssets.map(asset => `
        <tr class="hover:bg-gray-50 cursor-pointer" onclick="viewAssetDetails('${asset.id}')">
            <td class="py-3 px-4 text-sm font-medium text-blue-600">${asset.code}</td>
            <td class="py-3 px-4 text-sm text-gray-800">${asset.name}</td>
            <td class="py-3 px-4 text-sm text-gray-600">${asset.category}</td>
            <td class="py-3 px-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${getConditionClass(asset.condition)}">
                    ${asset.condition}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderAlerts() {
    const alertsList = document.getElementById('alertsList');
    const alerts = [];
    
    // Check for maintenance needed
    const maintenanceNeeded = APP_STATE.assets.filter(a => a.condition === 'يحتاج صيانة');
    if (maintenanceNeeded.length > 0) {
        alerts.push({
            type: 'warning',
            icon: 'fa-wrench',
            message: `${maintenanceNeeded.length} أصول تحتاج صيانة`,
            color: 'orange'
        });
    }
    
    // Check for damaged assets
    const damaged = APP_STATE.assets.filter(a => a.condition === 'تالف');
    if (damaged.length > 0) {
        alerts.push({
            type: 'danger',
            icon: 'fa-exclamation-triangle',
            message: `${damaged.length} أصول تالفة تحتاج استبدال`,
            color: 'red'
        });
    }
    
    // Check for expiring warranties
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringWarranties = APP_STATE.assets.filter(a => {
        if (!a.warranty) return false;
        const warrantyDate = new Date(a.warranty);
        return warrantyDate > today && warrantyDate < thirtyDaysLater;
    });
    if (expiringWarranties.length > 0) {
        alerts.push({
            type: 'info',
            icon: 'fa-shield-alt',
            message: `${expiringWarranties.length} أصول ينتهي ضمانها قريباً`,
            color: 'blue'
        });
    }
    
    // Check pending sync
    if (APP_STATE.pendingSyncCount > 0) {
        alerts.push({
            type: 'info',
            icon: 'fa-sync',
            message: `${APP_STATE.pendingSyncCount} عناصر في انتظار المزامنة`,
            color: 'purple'
        });
    }
    
    // Render alerts
    if (alerts.length === 0) {
        alertsList.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-check-circle text-3xl text-green-500 mb-2"></i>
                <p>لا توجد تنبيهات</p>
            </div>
        `;
    } else {
        alertsList.innerHTML = alerts.map(alert => `
            <div class="flex items-start gap-3 p-3 bg-${alert.color}-50 rounded-lg border border-${alert.color}-200">
                <i class="fas ${alert.icon} text-${alert.color}-500 mt-1"></i>
                <div>
                    <p class="text-sm font-medium text-${alert.color}-700">${alert.message}</p>
                </div>
            </div>
        `).join('');
    }
}

// === Chart Functions ===
function initializeCharts() {
    // Category Distribution Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    APP_STATE.charts.category = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    rtl: true,
                    labels: {
                        font: { family: 'Tajawal' }
                    }
                }
            }
        }
    });
    
    // Condition Chart
    const conditionCtx = document.getElementById('conditionChart').getContext('2d');
    APP_STATE.charts.condition = new Chart(conditionCtx, {
        type: 'bar',
        data: {
            labels: APP_STATE.conditions,
            datasets: [{
                label: 'عدد الأصول',
                data: [],
                backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        font: { family: 'Tajawal' }
                    }
                },
                y: {
                    ticks: {
                        font: { family: 'Tajawal' }
                    }
                }
            }
        }
    });
}

function updateCharts() {
    // Update category chart
    const categoryData = {};
    APP_STATE.assets.forEach(asset => {
        categoryData[asset.category] = (categoryData[asset.category] || 0) + 1;
    });
    
    APP_STATE.charts.category.data.labels = Object.keys(categoryData);
    APP_STATE.charts.category.data.datasets[0].data = Object.values(categoryData);
    APP_STATE.charts.category.update();
    
    // Update condition chart
    const conditionData = APP_STATE.conditions.map(condition => 
        APP_STATE.assets.filter(a => a.condition === condition).length
    );
    
    APP_STATE.charts.condition.data.datasets[0].data = conditionData;
    APP_STATE.charts.condition.update();
}

// === Asset Management Functions ===
function populateFilters() {
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    const assetCategory = document.getElementById('assetCategory');
    
    // Clear existing options except first
    categoryFilter.innerHTML = '<option value="">جميع الفئات</option>';
    assetCategory.innerHTML = '';
    
    APP_STATE.categories.forEach(cat => {
        categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        assetCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    
    // Condition filter
    const conditionFilter = document.getElementById('conditionFilter');
    conditionFilter.innerHTML = '<option value="">جميع الحالات</option>';
    APP_STATE.conditions.forEach(cond => {
        conditionFilter.innerHTML += `<option value="${cond}">${cond}</option>`;
    });
    
    // Department filters
    const departmentFilter = document.getElementById('departmentFilter');
    const assetDepartment = document.getElementById('assetDepartment');
    const inventoryDepartment = document.getElementById('inventoryDepartment');
    const parentDepartment = document.getElementById('parentDepartment');
    
    departmentFilter.innerHTML = '<option value="">جميع الإدارات</option>';
    assetDepartment.innerHTML = '<option value="">-- اختر الإدارة --</option>';
    inventoryDepartment.innerHTML = '<option value="">جميع الإدارات</option>';
    parentDepartment.innerHTML = '<option value="">-- لا يوجد --</option>';
    
    APP_STATE.departments.forEach(dept => {
        const option = `<option value="${dept.name}">${dept.name}</option>`;
        departmentFilter.innerHTML += option;
        assetDepartment.innerHTML += option;
        inventoryDepartment.innerHTML += option;
        parentDepartment.innerHTML += option;
    });
    
    // Maintenance asset dropdown
    updateMaintenanceAssetDropdown();
}

function updateMaintenanceAssetDropdown() {
    const dropdown = document.getElementById('maintenanceAsset');
    dropdown.innerHTML = '<option value="">-- اختر الأصل --</option>';
    APP_STATE.assets.forEach(asset => {
        dropdown.innerHTML += `<option value="${asset.id}">${asset.code} - ${asset.name}</option>`;
    });
}

function renderAssetsTable() {
    const tbody = document.getElementById('assetsTableBody');
    const searchTerm = document.getElementById('assetSearch').value.toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter').value;
    const conditionFilter = document.getElementById('conditionFilter').value;
    const departmentFilter = document.getElementById('departmentFilter').value;
    
    // Filter assets
    let filtered = APP_STATE.assets.filter(asset => {
        const matchSearch = !searchTerm || 
            asset.name.toLowerCase().includes(searchTerm) ||
            asset.code.toLowerCase().includes(searchTerm) ||
            (asset.department && asset.department.toLowerCase().includes(searchTerm)) ||
            (asset.inventoryPerson && asset.inventoryPerson.toLowerCase().includes(searchTerm));
        const matchCategory = !categoryFilter || asset.category === categoryFilter;
        const matchCondition = !conditionFilter || asset.condition === conditionFilter;
        const matchDepartment = !departmentFilter || asset.department === departmentFilter;
        
        return matchSearch && matchCategory && matchCondition && matchDepartment;
    });
    
    // Pagination
    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / APP_STATE.itemsPerPage);
    const startIndex = (APP_STATE.currentPage - 1) * APP_STATE.itemsPerPage;
    const endIndex = startIndex + APP_STATE.itemsPerPage;
    const paginatedAssets = filtered.slice(startIndex, endIndex);
    
    // Update pagination info
    document.getElementById('showingFrom').textContent = totalRecords > 0 ? startIndex + 1 : 0;
    document.getElementById('showingTo').textContent = Math.min(endIndex, totalRecords);
    document.getElementById('totalRecords').textContent = totalRecords;
    
    // Render table rows
    tbody.innerHTML = paginatedAssets.map(asset => `
        <tr class="hover:bg-blue-50 transition-colors">
            <td class="py-4 px-4">
                <input type="checkbox" class="asset-checkbox w-4 h-4 rounded" data-id="${asset.id}">
            </td>
            <td class="py-4 px-4 text-sm font-medium text-blue-600">${asset.code}</td>
            <td class="py-4 px-4 text-sm font-semibold text-gray-800">${asset.name}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${asset.category}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${asset.department || '-'}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${asset.location || '-'}</td>
            <td class="py-4 px-4 text-sm font-semibold text-green-600">${formatCurrency(asset.currentValue)}</td>
            <td class="py-4 px-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${getConditionClass(asset.condition)}">
                    ${asset.condition}
                </span>
            </td>
            <td class="py-4 px-4">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="viewAssetDetails('${asset.id}')" class="action-btn view" title="عرض">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editAssetById('${asset.id}')" class="action-btn edit" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteAsset('${asset.id}')" class="action-btn delete" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Render pagination
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    let html = '';
    
    // Previous button
    html += `<button class="pagination-btn" onclick="goToPage(${APP_STATE.currentPage - 1})" ${APP_STATE.currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= APP_STATE.currentPage - 2 && i <= APP_STATE.currentPage + 2)) {
            html += `<button class="pagination-btn ${i === APP_STATE.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === APP_STATE.currentPage - 3 || i === APP_STATE.currentPage + 3) {
            html += `<span class="px-2">...</span>`;
        }
    }
    
    // Next button
    html += `<button class="pagination-btn" onclick="goToPage(${APP_STATE.currentPage + 1})" ${APP_STATE.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>
        <i class="fas fa-chevron-left"></i>
    </button>`;
    
    pagination.innerHTML = html;
}

function goToPage(page) {
    APP_STATE.currentPage = page;
    renderAssetsTable();
}

function filterAssets() {
    APP_STATE.currentPage = 1;
    renderAssetsTable();
}

// === Modal Functions ===
function openAssetModal(assetId = null) {
    const modal = document.getElementById('assetModal');
    const form = document.getElementById('assetForm');
    const title = document.getElementById('assetModalTitle');
    const saveBtn = document.getElementById('saveButtonText');
    
    form.reset();
    APP_STATE.uploadedImages = [];
    document.getElementById('imagePreviewContainer').innerHTML = '';
    
    // Set current inventory person
    if (APP_STATE.inventoryPerson) {
        document.getElementById('assetInventoryPerson').value = APP_STATE.inventoryPerson;
    }
    
    if (assetId) {
        // Edit mode
        const asset = APP_STATE.assets.find(a => a.id === assetId);
        if (asset) {
            title.textContent = 'تعديل بيانات الأصل';
            saveBtn.textContent = 'حفظ التعديلات';
            
            document.getElementById('assetId').value = asset.id;
            document.getElementById('assetName').value = asset.name || '';
            document.getElementById('assetCode').value = asset.code || '';
            document.getElementById('assetCategory').value = asset.category || '';
            document.getElementById('assetSerial').value = asset.serialNumber || '';
            document.getElementById('assetDepartment').value = asset.department || '';
            document.getElementById('assetLocation').value = asset.location || '';
            document.getElementById('assetPurchasePrice').value = asset.purchasePrice || '';
            document.getElementById('assetCurrentValue').value = asset.currentValue || '';
            document.getElementById('assetPurchaseDate').value = asset.purchaseDate || '';
            document.getElementById('assetCondition').value = asset.condition || 'جيد';
            document.getElementById('assetSupplier').value = asset.supplier || '';
            document.getElementById('assetWarranty').value = asset.warranty || '';
            document.getElementById('assetAssignee').value = asset.assignee || '';
            document.getElementById('assetInventoryPerson').value = asset.inventoryPerson || APP_STATE.inventoryPerson || '';
            document.getElementById('assetNotes').value = asset.notes || '';
            
            // Load images if any
            if (asset.images && asset.images.length > 0) {
                APP_STATE.uploadedImages = [...asset.images];
                renderImagePreviews();
            }
        }
    } else {
        // Add mode
        title.textContent = 'إضافة أصل جديد';
        saveBtn.textContent = 'حفظ الأصل';
        document.getElementById('assetId').value = '';
    }
    
    modal.classList.remove('hidden');
}

function closeAssetModal() {
    document.getElementById('assetModal').classList.add('hidden');
}

async function handleAssetSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const assetId = document.getElementById('assetId').value;
    const isNew = !assetId;
    const finalId = isNew ? generateId() : assetId;
    
    const assetData = {
        id: finalId,
        name: document.getElementById('assetName').value,
        code: document.getElementById('assetCode').value,
        category: document.getElementById('assetCategory').value,
        serialNumber: document.getElementById('assetSerial').value,
        department: document.getElementById('assetDepartment').value,
        location: document.getElementById('assetLocation').value,
        purchasePrice: parseFloat(document.getElementById('assetPurchasePrice').value) || 0,
        currentValue: parseFloat(document.getElementById('assetCurrentValue').value) || 0,
        purchaseDate: document.getElementById('assetPurchaseDate').value,
        condition: document.getElementById('assetCondition').value,
        supplier: document.getElementById('assetSupplier').value,
        warranty: document.getElementById('assetWarranty').value,
        assignee: document.getElementById('assetAssignee').value,
        inventoryPerson: document.getElementById('assetInventoryPerson').value,
        lastInventoryDate: new Date().toISOString().split('T')[0],
        notes: document.getElementById('assetNotes').value,
        images: APP_STATE.uploadedImages,
        updatedAt: Date.now()
    };
    
    try {
        // Save to local IndexedDB first
        await dbPut(STORES.assets, assetData);
        
        // Update app state
        if (isNew) {
            APP_STATE.assets.push(assetData);
        } else {
            const index = APP_STATE.assets.findIndex(a => a.id === assetId);
            if (index !== -1) {
                APP_STATE.assets[index] = assetData;
            }
        }
        
        // Add to sync queue if online will sync, if offline will queue
        if (APP_STATE.isOnline) {
            try {
                const endpoint = isNew ? `${API_BASE}/assets` : `${API_BASE}/assets/${assetId}`;
                const method = isNew ? 'POST' : 'PUT';
                
                await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(assetData)
                });
            } catch (e) {
                // If server sync fails, add to queue
                await addToSyncQueue(isNew ? 'create' : 'update', 'assets', assetData);
            }
        } else {
            // Add to sync queue for later
            await addToSyncQueue(isNew ? 'create' : 'update', 'assets', assetData);
        }
        
        showToast(isNew ? 'تم إضافة الأصل بنجاح وحفظه محلياً' : 'تم تحديث الأصل بنجاح وحفظه محلياً', 'success');
        
        closeAssetModal();
        updateDashboard();
        renderAssetsTable();
        updateMaintenanceAssetDropdown();
        
    } catch (error) {
        console.error('Error saving asset:', error);
        showToast('حدث خطأ أثناء حفظ الأصل', 'error');
    }
    
    hideLoading();
}

function viewAssetDetails(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    APP_STATE.selectedAsset = asset;
    
    const content = document.getElementById('assetDetailsContent');
    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">اسم الأصل</p>
                <p class="text-lg font-semibold text-gray-800">${asset.name}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">كود الأصل</p>
                <p class="text-lg font-semibold text-blue-600">${asset.code}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">الفئة</p>
                <p class="text-lg font-semibold text-gray-800">${asset.category}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">الرقم التسلسلي</p>
                <p class="text-lg font-semibold text-gray-800">${asset.serialNumber || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">القسم</p>
                <p class="text-lg font-semibold text-gray-800">${asset.department || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl md:col-span-2">
                <p class="text-sm text-gray-600 mb-1">الموقع</p>
                <p class="text-lg font-semibold text-gray-800">${asset.location || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">تاريخ الشراء</p>
                <p class="text-lg font-semibold text-gray-800">${asset.purchaseDate || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">سعر الشراء</p>
                <p class="text-lg font-semibold text-green-600">${formatCurrency(asset.purchasePrice)}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">القيمة الحالية</p>
                <p class="text-lg font-semibold text-green-600">${formatCurrency(asset.currentValue)}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">الحالة</p>
                <span class="inline-block px-4 py-2 rounded-full text-sm font-semibold ${getConditionClass(asset.condition)}">
                    ${asset.condition}
                </span>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">المورد</p>
                <p class="text-lg font-semibold text-gray-800">${asset.supplier || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">انتهاء الضمان</p>
                <p class="text-lg font-semibold text-gray-800">${asset.warranty || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">المستخدم/المسؤول</p>
                <p class="text-lg font-semibold text-gray-800">${asset.assignee || '-'}</p>
            </div>
            <div class="bg-purple-50 p-4 rounded-xl border-2 border-purple-200">
                <p class="text-sm text-purple-600 mb-1"><i class="fas fa-user-check ml-1"></i>القائم بالجرد</p>
                <p class="text-lg font-semibold text-purple-800">${asset.inventoryPerson || '-'}</p>
                ${asset.lastInventoryDate ? `<p class="text-xs text-purple-500 mt-1">آخر جرد: ${asset.lastInventoryDate}</p>` : ''}
            </div>
            <div class="bg-gray-50 p-4 rounded-xl md:col-span-2">
                <p class="text-sm text-gray-600 mb-1">ملاحظات</p>
                <p class="text-base text-gray-800">${asset.notes || 'لا توجد ملاحظات'}</p>
            </div>
            ${asset.images && asset.images.length > 0 ? `
                <div class="bg-gray-50 p-4 rounded-xl md:col-span-2">
                    <p class="text-sm text-gray-600 mb-3">صور الأصل</p>
                    <div class="grid grid-cols-3 gap-4">
                        ${asset.images.map((img, idx) => `
                            <img src="${img}" alt="صورة ${idx + 1}" class="w-full h-40 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-colors" onclick="window.open('${img}', '_blank')">
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('assetDetailsModal').classList.remove('hidden');
}

function closeAssetDetailsModal() {
    document.getElementById('assetDetailsModal').classList.add('hidden');
    APP_STATE.selectedAsset = null;
}

function editAsset() {
    if (APP_STATE.selectedAsset) {
        closeAssetDetailsModal();
        openAssetModal(APP_STATE.selectedAsset.id);
    }
}

function editAssetById(assetId) {
    openAssetModal(assetId);
}

async function deleteAsset(assetId) {
    if (!confirm('هل أنت متأكد من حذف هذا الأصل؟')) return;
    
    showLoading();
    
    try {
        // Delete from local IndexedDB
        await dbDelete(STORES.assets, assetId);
        
        // Remove from app state
        APP_STATE.assets = APP_STATE.assets.filter(a => a.id !== assetId);
        
        // Try to delete from server or add to sync queue
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/assets/${assetId}`, { method: 'DELETE' });
            } catch (e) {
                await addToSyncQueue('delete', 'assets', { id: assetId });
            }
        } else {
            await addToSyncQueue('delete', 'assets', { id: assetId });
        }
        
        showToast('تم حذف الأصل بنجاح', 'success');
        
        updateDashboard();
        renderAssetsTable();
        
    } catch (error) {
        console.error('Error deleting asset:', error);
        showToast('حدث خطأ أثناء حذف الأصل', 'error');
    }
    
    hideLoading();
}

// === Image Upload Functions ===
function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    const maxImages = 3;
    
    if (APP_STATE.uploadedImages.length + files.length > maxImages) {
        showToast(`يمكنك إضافة ${maxImages} صور كحد أقصى`, 'warning');
        return;
    }
    
    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            showToast('حجم الصورة يجب أن يكون أقل من 5MB', 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
            APP_STATE.uploadedImages.push(reader.result);
            renderImagePreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    container.innerHTML = APP_STATE.uploadedImages.map((img, idx) => `
        <div class="image-preview relative">
            <img src="${img}" alt="صورة ${idx + 1}" class="w-full h-32 object-cover rounded-lg">
            <button type="button" onclick="removeImage(${idx})" class="remove-btn">
                <i class="fas fa-times text-xs"></i>
            </button>
        </div>
    `).join('');
}

function removeImage(index) {
    APP_STATE.uploadedImages.splice(index, 1);
    renderImagePreviews();
}

// === Code Generation ===
function generateCode() {
    const category = document.getElementById('assetCategory').value;
    const prefix = getCategoryPrefix(category);
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900) + 100;
    
    document.getElementById('assetCode').value = `${prefix}-${year}-${random}`;
}

function getCategoryPrefix(category) {
    const prefixes = {
        'أثاث': 'FRN',
        'معدات إلكترونية': 'IT',
        'مركبات': 'VEH',
        'أجهزة طبية': 'MED',
        'معدات مكتبية': 'OFF',
        'أجهزة كهربائية': 'ELC',
        'أخرى': 'OTH'
    };
    return prefixes[category] || 'AST';
}

// === Barcode Functions ===
function generateBarcode() {
    if (!APP_STATE.selectedAsset) return;
    
    const modal = document.getElementById('barcodeModal');
    const barcodeImg = document.getElementById('barcodeImage');
    const assetName = document.getElementById('barcodeAssetName');
    
    JsBarcode(barcodeImg, APP_STATE.selectedAsset.code, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: true,
        font: 'Tajawal',
        textMargin: 5
    });
    
    assetName.textContent = APP_STATE.selectedAsset.name;
    modal.classList.remove('hidden');
}

function closeBarcodeModal() {
    document.getElementById('barcodeModal').classList.add('hidden');
}

function printBarcode() {
    const content = document.getElementById('barcodeContainer').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة الباركود</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Tajawal', sans-serif; text-align: center; padding: 20px; }
                svg { max-width: 100%; }
            </style>
        </head>
        <body>${content}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// === Barcode Scanner ===
function startBarcodeScanner() {
    const video = document.getElementById('barcodeVideo');
    const placeholder = document.getElementById('scanner-placeholder');
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    
    navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
    })
    .then(stream => {
        video.srcObject = stream;
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        video.play();
        
        // Add scanner line animation
        const container = document.getElementById('barcodeScannerContainer');
        const line = document.createElement('div');
        line.className = 'scanner-line';
        line.id = 'scannerLine';
        container.appendChild(line);
    })
    .catch(err => {
        showToast('لا يمكن الوصول إلى الكاميرا. تأكد من منح الإذن.', 'error');
        console.error('Camera error:', err);
    });
}

function stopBarcodeScanner() {
    const video = document.getElementById('barcodeVideo');
    const placeholder = document.getElementById('scanner-placeholder');
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    const line = document.getElementById('scannerLine');
    
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    video.classList.add('hidden');
    placeholder.classList.remove('hidden');
    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    
    if (line) line.remove();
}

function manualCodeEntry() {
    const code = prompt('أدخل كود الأصل:');
    if (code) {
        processScannedCode(code);
    }
}

function processScannedCode(code) {
    const asset = APP_STATE.assets.find(a => a.code === code || a.serialNumber === code);
    
    const resultDiv = document.getElementById('scannedResult');
    
    if (asset) {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-xl';
        resultDiv.innerHTML = `
            <p class="text-green-700 font-semibold"><i class="fas fa-check-circle ml-2"></i>تم التعرف على الأصل</p>
            <p class="text-gray-600 mt-1">${asset.code} - ${asset.name}</p>
            <div class="flex gap-2 mt-2">
                <button onclick="viewAssetDetails('${asset.id}')" class="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
                    عرض التفاصيل
                </button>
                <button onclick="markAssetInventoried('${asset.id}')" class="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">
                    <i class="fas fa-check ml-1"></i>تسجيل الجرد
                </button>
            </div>
        `;
    } else {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-xl';
        resultDiv.innerHTML = `
            <p class="text-red-700 font-semibold"><i class="fas fa-times-circle ml-2"></i>لم يتم التعرف على الأصل</p>
            <p class="text-gray-600 mt-1">الكود: ${code}</p>
            <button onclick="openAssetModal()" class="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                <i class="fas fa-plus ml-1"></i>إضافة كأصل جديد
            </button>
        `;
    }
}

async function markAssetInventoried(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    asset.inventoryPerson = APP_STATE.inventoryPerson || prompt('أدخل اسم القائم بالجرد:');
    asset.lastInventoryDate = new Date().toISOString().split('T')[0];
    asset.updatedAt = Date.now();
    
    try {
        await dbPut(STORES.assets, asset);
        
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/assets/${assetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(asset)
                });
            } catch (e) {
                await addToSyncQueue('update', 'assets', asset);
            }
        } else {
            await addToSyncQueue('update', 'assets', asset);
        }
        
        showToast('تم تسجيل جرد الأصل بنجاح', 'success');
        
    } catch (error) {
        console.error('Error marking asset:', error);
        showToast('حدث خطأ', 'error');
    }
}

// === Department Functions ===
function openDepartmentModal(deptId = null) {
    const modal = document.getElementById('departmentModal');
    const form = document.getElementById('departmentForm');
    const title = document.getElementById('departmentModalTitle');
    
    form.reset();
    
    if (deptId) {
        const dept = APP_STATE.departments.find(d => d.id === deptId);
        if (dept) {
            title.textContent = 'تعديل الإدارة';
            document.getElementById('departmentId').value = dept.id;
            document.getElementById('departmentName').value = dept.name || '';
            document.getElementById('parentDepartment').value = dept.parent || '';
            document.getElementById('departmentLocation').value = dept.location || '';
            document.getElementById('departmentManager').value = dept.manager || '';
        }
    } else {
        title.textContent = 'إضافة إدارة جديدة';
        document.getElementById('departmentId').value = '';
    }
    
    modal.classList.remove('hidden');
}

function closeDepartmentModal() {
    document.getElementById('departmentModal').classList.add('hidden');
}

async function handleDepartmentSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const deptId = document.getElementById('departmentId').value;
    const isNew = !deptId;
    const finalId = isNew ? generateId() : deptId;
    
    const deptData = {
        id: finalId,
        name: document.getElementById('departmentName').value,
        parent: document.getElementById('parentDepartment').value,
        location: document.getElementById('departmentLocation').value,
        manager: document.getElementById('departmentManager').value,
        updatedAt: Date.now()
    };
    
    try {
        // Save to local IndexedDB
        await dbPut(STORES.departments, deptData);
        
        // Update app state
        if (isNew) {
            APP_STATE.departments.push(deptData);
        } else {
            const index = APP_STATE.departments.findIndex(d => d.id === deptId);
            if (index !== -1) {
                APP_STATE.departments[index] = deptData;
            }
        }
        
        // Sync with server
        if (APP_STATE.isOnline) {
            try {
                const endpoint = isNew ? `${API_BASE}/departments` : `${API_BASE}/departments/${deptId}`;
                const method = isNew ? 'POST' : 'PUT';
                
                await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(deptData)
                });
            } catch (e) {
                await addToSyncQueue(isNew ? 'create' : 'update', 'departments', deptData);
            }
        } else {
            await addToSyncQueue(isNew ? 'create' : 'update', 'departments', deptData);
        }
        
        showToast(isNew ? 'تم إضافة الإدارة بنجاح' : 'تم تحديث الإدارة بنجاح', 'success');
        
        closeDepartmentModal();
        renderDepartments();
        populateFilters();
        updateDashboard();
        
    } catch (error) {
        console.error('Error saving department:', error);
        showToast('حدث خطأ أثناء حفظ الإدارة', 'error');
    }
    
    hideLoading();
}

function renderDepartments() {
    const grid = document.getElementById('departmentsGrid');
    
    grid.innerHTML = APP_STATE.departments.map(dept => {
        const assetCount = APP_STATE.assets.filter(a => a.department === dept.name).length;
        
        return `
            <div class="department-card bg-white rounded-2xl shadow-lg p-6">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-gov-blue bg-opacity-10 p-3 rounded-xl">
                        <i class="fas fa-building text-2xl text-gov-blue"></i>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="openDepartmentModal('${dept.id}')" class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteDepartment('${dept.id}')" class="p-2 text-red-600 hover:bg-red-100 rounded-lg">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <h4 class="text-lg font-bold text-gray-800 mb-2">${dept.name}</h4>
                <div class="space-y-2 text-sm text-gray-600">
                    <p><i class="fas fa-map-marker-alt ml-2 text-gray-400"></i>${dept.location || 'غير محدد'}</p>
                    <p><i class="fas fa-user ml-2 text-gray-400"></i>${dept.manager || 'غير محدد'}</p>
                    <p><i class="fas fa-boxes ml-2 text-gray-400"></i>${assetCount} أصل</p>
                </div>
            </div>
        `;
    }).join('');
}

async function deleteDepartment(deptId) {
    if (!confirm('هل أنت متأكد من حذف هذه الإدارة؟')) return;
    
    showLoading();
    
    try {
        await dbDelete(STORES.departments, deptId);
        APP_STATE.departments = APP_STATE.departments.filter(d => d.id !== deptId);
        
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/departments/${deptId}`, { method: 'DELETE' });
            } catch (e) {
                await addToSyncQueue('delete', 'departments', { id: deptId });
            }
        } else {
            await addToSyncQueue('delete', 'departments', { id: deptId });
        }
        
        showToast('تم حذف الإدارة بنجاح', 'success');
        
        renderDepartments();
        updateDashboard();
        
    } catch (error) {
        console.error('Error deleting department:', error);
        showToast('حدث خطأ أثناء حذف الإدارة', 'error');
    }
    
    hideLoading();
}

// === Maintenance Functions ===
function openMaintenanceModal() {
    document.getElementById('maintenanceModal').classList.remove('hidden');
    document.getElementById('maintenanceForm').reset();
}

function closeMaintenanceModal() {
    document.getElementById('maintenanceModal').classList.add('hidden');
}

async function handleMaintenanceSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const assetId = document.getElementById('maintenanceAsset').value;
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    
    const maintenanceData = {
        id: generateId(),
        assetId: assetId,
        assetName: asset ? asset.name : '',
        assetCode: asset ? asset.code : '',
        type: document.getElementById('maintenanceType').value,
        priority: document.getElementById('maintenancePriority').value,
        description: document.getElementById('maintenanceDescription').value,
        status: 'قيد الانتظار',
        requestDate: new Date().toISOString().split('T')[0],
        cost: 0,
        requestedBy: APP_STATE.inventoryPerson || ''
    };
    
    try {
        await dbPut(STORES.maintenance, maintenanceData);
        APP_STATE.maintenance.push(maintenanceData);
        
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/maintenance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(maintenanceData)
                });
            } catch (e) {
                await addToSyncQueue('create', 'maintenance', maintenanceData);
            }
        } else {
            await addToSyncQueue('create', 'maintenance', maintenanceData);
        }
        
        showToast('تم إرسال طلب الصيانة بنجاح', 'success');
        
        closeMaintenanceModal();
        renderMaintenanceTable();
        updateMaintenanceStats();
        
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        showToast('حدث خطأ أثناء إرسال الطلب', 'error');
    }
    
    hideLoading();
}

function renderMaintenanceTable() {
    const tbody = document.getElementById('maintenanceTableBody');
    
    tbody.innerHTML = APP_STATE.maintenance.map((maint, index) => `
        <tr class="hover:bg-gray-50">
            <td class="py-4 px-4 text-sm font-medium text-gray-800">M-${String(index + 1).padStart(3, '0')}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${maint.assetCode} - ${maint.assetName}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${maint.type}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${maint.requestDate}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${formatCurrency(maint.cost)}</td>
            <td class="py-4 px-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(maint.status)}">
                    ${maint.status}
                </span>
            </td>
            <td class="py-4 px-4">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="updateMaintenanceStatus('${maint.id}', 'قيد التنفيذ')" class="action-btn edit" title="قيد التنفيذ" ${maint.status !== 'قيد الانتظار' ? 'disabled' : ''}>
                        <i class="fas fa-play"></i>
                    </button>
                    <button onclick="updateMaintenanceStatus('${maint.id}', 'مكتملة')" class="action-btn view" title="إكمال" ${maint.status === 'مكتملة' ? 'disabled' : ''}>
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function updateMaintenanceStatus(maintId, newStatus) {
    showLoading();
    
    try {
        const maint = APP_STATE.maintenance.find(m => m.id === maintId);
        if (maint) {
            maint.status = newStatus;
            maint.updatedAt = Date.now();
            
            await dbPut(STORES.maintenance, maint);
            
            if (APP_STATE.isOnline) {
                try {
                    await fetch(`${API_BASE}/maintenance/${maintId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    });
                } catch (e) {
                    await addToSyncQueue('update', 'maintenance', maint);
                }
            } else {
                await addToSyncQueue('update', 'maintenance', maint);
            }
            
            showToast('تم تحديث حالة الطلب', 'success');
        }
        
        renderMaintenanceTable();
        updateMaintenanceStats();
        
    } catch (error) {
        console.error('Error updating maintenance:', error);
        showToast('حدث خطأ أثناء التحديث', 'error');
    }
    
    hideLoading();
}

function updateMaintenanceStats() {
    const pending = APP_STATE.maintenance.filter(m => m.status === 'قيد الانتظار').length;
    const inProgress = APP_STATE.maintenance.filter(m => m.status === 'قيد التنفيذ').length;
    const completed = APP_STATE.maintenance.filter(m => m.status === 'مكتملة').length;
    
    document.getElementById('pendingMaintenance').textContent = pending;
    document.getElementById('inProgressMaintenance').textContent = inProgress;
    document.getElementById('completedMaintenance').textContent = completed;
}

// === Inventory Functions ===
async function handleInventorySubmit(e) {
    e.preventDefault();
    showLoading();
    
    const inventoryData = {
        id: generateId(),
        name: document.getElementById('inventoryName').value,
        department: document.getElementById('inventoryDepartment').value,
        date: document.getElementById('inventoryDate').value,
        status: 'جاري',
        assetsCount: 0,
        inventoryPerson: APP_STATE.inventoryPerson || '',
        createdAt: new Date().toISOString()
    };
    
    try {
        await dbPut(STORES.inventoryLogs, inventoryData);
        APP_STATE.inventoryLogs.push(inventoryData);
        
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/inventory_logs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(inventoryData)
                });
            } catch (e) {
                await addToSyncQueue('create', 'inventory_logs', inventoryData);
            }
        } else {
            await addToSyncQueue('create', 'inventory_logs', inventoryData);
        }
        
        showToast('تم بدء عملية الجرد بنجاح', 'success');
        document.getElementById('inventoryForm').reset();
        document.getElementById('inventoryDate').valueAsDate = new Date();
        renderInventoryLogs();
        
    } catch (error) {
        console.error('Error creating inventory:', error);
        showToast('حدث خطأ أثناء بدء الجرد', 'error');
    }
    
    hideLoading();
}

function renderInventoryLogs() {
    const tbody = document.getElementById('inventoryLogTable');
    
    tbody.innerHTML = APP_STATE.inventoryLogs.map((log, index) => `
        <tr class="hover:bg-gray-50">
            <td class="py-4 px-4 text-sm font-medium text-gray-800">INV-${String(index + 1).padStart(3, '0')}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${log.name}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${log.department || 'جميع الإدارات'}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${log.date}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${log.assetsCount}</td>
            <td class="py-4 px-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${log.status === 'مكتمل' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${log.status}
                </span>
            </td>
            <td class="py-4 px-4">
                <button onclick="viewInventoryDetails('${log.id}')" class="action-btn view">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// === Reports Functions ===
function generateReport(type) {
    const container = document.getElementById('reportContainer');
    
    switch (type) {
        case 'summary':
            generateSummaryReport(container);
            break;
        case 'depreciation':
            generateDepreciationReport(container);
            break;
        case 'maintenance':
            generateMaintenanceReport(container);
            break;
        case 'inventory':
            generateInventoryReport(container);
            break;
    }
}

function generateSummaryReport(container) {
    const totalValue = APP_STATE.assets.reduce((sum, a) => sum + (parseFloat(a.currentValue) || 0), 0);
    const totalPurchase = APP_STATE.assets.reduce((sum, a) => sum + (parseFloat(a.purchasePrice) || 0), 0);
    
    const categoryStats = {};
    APP_STATE.assets.forEach(asset => {
        if (!categoryStats[asset.category]) {
            categoryStats[asset.category] = { count: 0, value: 0 };
        }
        categoryStats[asset.category].count++;
        categoryStats[asset.category].value += parseFloat(asset.currentValue) || 0;
    });
    
    container.innerHTML = `
        <div class="report-section">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">تقرير ملخص الأصول</h3>
                <div class="flex gap-2">
                    <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-xl">
                    <p class="text-sm text-gray-600">إجمالي الأصول</p>
                    <p class="text-2xl font-bold text-gov-blue">${APP_STATE.assets.length}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-xl">
                    <p class="text-sm text-gray-600">القيمة الإجمالية الحالية</p>
                    <p class="text-2xl font-bold text-gov-green">${formatCurrency(totalValue)}</p>
                </div>
                <div class="bg-yellow-50 p-4 rounded-xl">
                    <p class="text-sm text-gray-600">إجمالي قيمة الشراء</p>
                    <p class="text-2xl font-bold text-gov-gold">${formatCurrency(totalPurchase)}</p>
                </div>
            </div>
            
            <h4 class="text-lg font-semibold text-gray-800 mb-4">توزيع الأصول حسب الفئة</h4>
            <table class="w-full mb-6">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الفئة</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">عدد الأصول</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">القيمة الإجمالية</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">النسبة</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(categoryStats).map(([cat, stats]) => `
                        <tr class="border-b">
                            <td class="py-3 px-4">${cat}</td>
                            <td class="py-3 px-4">${stats.count}</td>
                            <td class="py-3 px-4">${formatCurrency(stats.value)}</td>
                            <td class="py-3 px-4">${((stats.count / APP_STATE.assets.length) * 100).toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateDepreciationReport(container) {
    const assetsWithDepreciation = APP_STATE.assets.map(asset => {
        const purchase = parseFloat(asset.purchasePrice) || 0;
        const current = parseFloat(asset.currentValue) || 0;
        const depreciation = purchase - current;
        const rate = purchase > 0 ? ((depreciation / purchase) * 100).toFixed(1) : 0;
        
        return { ...asset, depreciation, rate };
    }).sort((a, b) => b.depreciation - a.depreciation);
    
    const totalDepreciation = assetsWithDepreciation.reduce((sum, a) => sum + a.depreciation, 0);
    
    container.innerHTML = `
        <div class="report-section">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">تقرير إهلاك الأصول</h3>
                <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-print ml-2"></i>طباعة
                </button>
            </div>
            
            <div class="bg-red-50 p-4 rounded-xl mb-6">
                <p class="text-sm text-gray-600">إجمالي الإهلاك</p>
                <p class="text-2xl font-bold text-red-600">${formatCurrency(totalDepreciation)}</p>
            </div>
            
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الكود</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الأصل</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">سعر الشراء</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">القيمة الحالية</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الإهلاك</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">نسبة الإهلاك</th>
                    </tr>
                </thead>
                <tbody>
                    ${assetsWithDepreciation.slice(0, 20).map(asset => `
                        <tr class="border-b">
                            <td class="py-3 px-4 text-blue-600">${asset.code}</td>
                            <td class="py-3 px-4">${asset.name}</td>
                            <td class="py-3 px-4">${formatCurrency(asset.purchasePrice)}</td>
                            <td class="py-3 px-4">${formatCurrency(asset.currentValue)}</td>
                            <td class="py-3 px-4 text-red-600">${formatCurrency(asset.depreciation)}</td>
                            <td class="py-3 px-4">${asset.rate}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function generateMaintenanceReport(container) {
    const needMaintenance = APP_STATE.assets.filter(a => a.condition === 'يحتاج صيانة');
    const damaged = APP_STATE.assets.filter(a => a.condition === 'تالف');
    
    container.innerHTML = `
        <div class="report-section">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">تقرير الصيانة</h3>
                <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-print ml-2"></i>طباعة
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-orange-50 p-4 rounded-xl">
                    <p class="text-sm text-gray-600">تحتاج صيانة</p>
                    <p class="text-2xl font-bold text-orange-600">${needMaintenance.length}</p>
                </div>
                <div class="bg-red-50 p-4 rounded-xl">
                    <p class="text-sm text-gray-600">أصول تالفة</p>
                    <p class="text-2xl font-bold text-red-600">${damaged.length}</p>
                </div>
            </div>
            
            <h4 class="text-lg font-semibold text-gray-800 mb-4">أصول تحتاج صيانة</h4>
            <table class="w-full mb-6">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الكود</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الأصل</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">القسم</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الموقع</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الملاحظات</th>
                    </tr>
                </thead>
                <tbody>
                    ${needMaintenance.map(asset => `
                        <tr class="border-b">
                            <td class="py-3 px-4 text-blue-600">${asset.code}</td>
                            <td class="py-3 px-4">${asset.name}</td>
                            <td class="py-3 px-4">${asset.department || '-'}</td>
                            <td class="py-3 px-4">${asset.location || '-'}</td>
                            <td class="py-3 px-4">${asset.notes || '-'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="5" class="py-4 text-center text-gray-500">لا توجد أصول تحتاج صيانة</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function generateInventoryReport(container) {
    container.innerHTML = `
        <div class="report-section">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-gray-800">تقرير عمليات الجرد</h3>
                <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-print ml-2"></i>طباعة
                </button>
            </div>
            
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">رقم العملية</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">اسم الجرد</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">التاريخ</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الإدارة</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">القائم بالجرد</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${APP_STATE.inventoryLogs.map((log, index) => `
                        <tr class="border-b">
                            <td class="py-3 px-4">INV-${String(index + 1).padStart(3, '0')}</td>
                            <td class="py-3 px-4">${log.name}</td>
                            <td class="py-3 px-4">${log.date}</td>
                            <td class="py-3 px-4">${log.department || 'جميع الإدارات'}</td>
                            <td class="py-3 px-4">${log.inventoryPerson || '-'}</td>
                            <td class="py-3 px-4">
                                <span class="px-3 py-1 rounded-full text-xs font-semibold ${log.status === 'مكتمل' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${log.status}
                                </span>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="6" class="py-4 text-center text-gray-500">لا توجد عمليات جرد</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

function printReport() {
    window.print();
}

// === Settings Functions ===
function renderCategoriesList() {
    const list = document.getElementById('categoriesList');
    list.innerHTML = APP_STATE.categories.map(cat => `
        <div class="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
            <span>${cat}</span>
            <button onclick="removeCategory('${cat}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addCategory() {
    const input = document.getElementById('newCategory');
    const category = input.value.trim();
    
    if (!category) {
        showToast('يرجى إدخال اسم الفئة', 'warning');
        return;
    }
    
    if (APP_STATE.categories.includes(category)) {
        showToast('هذه الفئة موجودة بالفعل', 'warning');
        return;
    }
    
    APP_STATE.categories.push(category);
    input.value = '';
    saveSettings();
    renderCategoriesList();
    populateFilters();
    showToast('تم إضافة الفئة بنجاح', 'success');
}

function removeCategory(category) {
    if (!confirm(`هل أنت متأكد من حذف الفئة "${category}"؟`)) return;
    
    APP_STATE.categories = APP_STATE.categories.filter(c => c !== category);
    saveSettings();
    renderCategoriesList();
    showToast('تم حذف الفئة', 'success');
}

async function renderStorageInfo() {
    const container = document.getElementById('storageInfo');
    if (!container) return;
    
    try {
        // Get IndexedDB storage estimate
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
            const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
            const percentage = ((estimate.usage / estimate.quota) * 100).toFixed(1);
            
            container.innerHTML = `
                <div class="storage-info">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-gray-700">التخزين المحلي</span>
                        <span class="text-sm text-gray-500">${usedMB} MB من ${quotaMB} MB</span>
                    </div>
                    <div class="storage-bar">
                        <div class="storage-bar-fill" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                    <div class="mt-3 text-sm text-gray-600">
                        <p><i class="fas fa-database ml-1"></i> الأصول: ${APP_STATE.assets.length}</p>
                        <p><i class="fas fa-building ml-1"></i> الإدارات: ${APP_STATE.departments.length}</p>
                        <p><i class="fas fa-sync ml-1"></i> قيد المزامنة: ${APP_STATE.pendingSyncCount}</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error getting storage info:', error);
    }
}

// === Export Functions ===
function exportToExcel() {
    const data = APP_STATE.assets.map(asset => ({
        'الكود': asset.code,
        'الاسم': asset.name,
        'الفئة': asset.category,
        'القسم': asset.department,
        'الموقع': asset.location,
        'تاريخ الشراء': asset.purchaseDate,
        'سعر الشراء': asset.purchasePrice,
        'القيمة الحالية': asset.currentValue,
        'الحالة': asset.condition,
        'الرقم التسلسلي': asset.serialNumber,
        'المورد': asset.supplier,
        'الضمان': asset.warranty,
        'المسؤول': asset.assignee,
        'القائم بالجرد': asset.inventoryPerson,
        'تاريخ آخر جرد': asset.lastInventoryDate,
        'ملاحظات': asset.notes
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأصول');
    XLSX.writeFile(wb, `جرد_الأصول_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast('تم تصدير البيانات بنجاح', 'success');
}

function exportToPDF() {
    showToast('جاري تحضير ملف PDF...', 'info');
    window.print();
}

function exportAllData() {
    const data = {
        assets: APP_STATE.assets,
        departments: APP_STATE.departments,
        maintenance: APP_STATE.maintenance,
        inventoryLogs: APP_STATE.inventoryLogs,
        categories: APP_STATE.categories,
        inventoryPerson: APP_STATE.inventoryPerson,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    showToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.assets) {
                for (const asset of data.assets) {
                    asset.id = asset.id || generateId();
                    await dbPut(STORES.assets, asset);
                    
                    if (APP_STATE.isOnline) {
                        try {
                            await fetch(`${API_BASE}/assets`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(asset)
                            });
                        } catch (e) {
                            await addToSyncQueue('create', 'assets', asset);
                        }
                    }
                }
            }
            
            if (data.departments) {
                for (const dept of data.departments) {
                    dept.id = dept.id || generateId();
                    await dbPut(STORES.departments, dept);
                }
            }
            
            if (data.categories) {
                APP_STATE.categories = data.categories;
                saveSettings();
            }
            
            if (data.inventoryPerson) {
                APP_STATE.inventoryPerson = data.inventoryPerson;
                saveSettings();
            }
            
            await loadAllData();
            updateDashboard();
            populateFilters();
            updateInventoryPersonDisplay();
            
            showToast('تم استيراد البيانات بنجاح', 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            showToast('حدث خطأ أثناء استيراد البيانات', 'error');
        }
        
        hideLoading();
    };
    reader.readAsText(file);
}

async function clearAllLocalData() {
    if (!confirm('هل أنت متأكد من حذف جميع البيانات المحلية؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    showLoading();
    
    try {
        await dbClear(STORES.assets);
        await dbClear(STORES.departments);
        await dbClear(STORES.maintenance);
        await dbClear(STORES.inventoryLogs);
        await dbClear(STORES.syncQueue);
        
        APP_STATE.assets = [];
        APP_STATE.departments = [];
        APP_STATE.maintenance = [];
        APP_STATE.inventoryLogs = [];
        APP_STATE.pendingSyncCount = 0;
        
        updateDashboard();
        showToast('تم حذف جميع البيانات المحلية', 'success');
        
    } catch (error) {
        console.error('Error clearing data:', error);
        showToast('حدث خطأ', 'error');
    }
    
    hideLoading();
}

// === Helper Functions ===
function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('ar-SA') + ' ر.س';
}

function formatDateTime(date) {
    if (!date) return '-';
    return new Date(date).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getConditionClass(condition) {
    const classes = {
        'ممتاز': 'condition-excellent',
        'جيد': 'condition-good',
        'مقبول': 'condition-acceptable',
        'يحتاج صيانة': 'condition-maintenance',
        'تالف': 'condition-damaged'
    };
    return classes[condition] || 'bg-gray-100 text-gray-700';
}

function getStatusClass(status) {
    const classes = {
        'قيد الانتظار': 'status-pending',
        'قيد التنفيذ': 'status-inprogress',
        'مكتملة': 'status-completed'
    };
    return classes[status] || 'bg-gray-100 text-gray-700';
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');
    
    toast.className = 'fixed bottom-4 left-4 text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300 z-50';
    
    const types = {
        success: { bg: 'bg-green-600', icon: 'fa-check-circle' },
        error: { bg: 'bg-red-600', icon: 'fa-times-circle' },
        warning: { bg: 'bg-yellow-600', icon: 'fa-exclamation-triangle' },
        info: { bg: 'bg-blue-600', icon: 'fa-info-circle' }
    };
    
    toast.classList.add(types[type].bg);
    icon.className = `fas ${types[type].icon}`;
    msg.textContent = message;
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function handleGlobalSearch(e) {
    const term = e.target.value.toLowerCase();
    if (term.length < 2) return;
    
    const results = APP_STATE.assets.filter(a => 
        a.name.toLowerCase().includes(term) || 
        a.code.toLowerCase().includes(term)
    );
    
    if (results.length > 0) {
        showPage('assets');
        document.getElementById('assetSearch').value = term;
        filterAssets();
    }
}

function handleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.asset-checkbox');
    checkboxes.forEach(cb => cb.checked = e.target.checked);
}

function printAssetDetails() {
    window.print();
}

// === PWA Install ===
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
        installBtn.classList.add('show');
    }
});

async function installPWA() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        showToast('تم تثبيت التطبيق بنجاح', 'success');
    }
    
    deferredPrompt = null;
    
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
        installBtn.classList.remove('show');
    }
}
