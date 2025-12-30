/**
 * نظام جرد وحصر الأصول الحكومية
 * Government Asset Inventory System
 * Enhanced Version with Offline Support & Local Storage
 */

// === Database Configuration ===
const DB_NAME = 'AssetInventoryDB';
const DB_VERSION = 3;
const STORES = {
    assets: 'assets',
    departments: 'departments',
    maintenance: 'maintenance',
    inventoryLogs: 'inventory_logs',
    settings: 'settings',
    syncQueue: 'sync_queue',
    activityLogs: 'activity_logs',
    assetLocations: 'asset_locations'
};

// === Application State ===
const APP_STATE = {
    assets: [],
    departments: [],
    maintenance: [],
    inventoryLogs: [],
    activityLogs: [], // سجل متابعة التعديلات
    assetLocations: [], // مواقع الأصول
    // الفئات الموسعة - الفئة 1 (الرئيسية)
    categories: [
        'أثاث مكتبي', 'أثاث استقبال', 'أثاث قاعات اجتماعات', 'أثاث مختبرات',
        'أجهزة حاسب آلي', 'أجهزة محمولة', 'طابعات وماسحات', 'خوادم وشبكات', 'شاشات عرض',
        'مركبات نقل', 'مركبات خدمات', 'معدات نقل ثقيل',
        'أجهزة طبية تشخيصية', 'أجهزة طبية علاجية', 'معدات مختبرات طبية',
        'معدات مكتبية', 'آلات تصوير', 'أجهزة عرض',
        'مكيفات', 'مولدات كهربائية', 'أجهزة إنارة', 'معدات أمن وسلامة',
        'معدات صيانة', 'معدات نظافة', 'معدات حدائق',
        'أخرى'
    ],
    // الفئة 2 (الفرعية)
    categories2: [
        'كراسي', 'مكاتب', 'طاولات', 'خزائن', 'أرفف',
        'ديسكتوب', 'لابتوب', 'تابلت', 'هاتف ذكي',
        'طابعة ليزر', 'طابعة حبر', 'ماسح ضوئي', 'آلة تصوير',
        'سيرفر', 'راوتر', 'سويتش', 'فايروول',
        'سيارة صغيرة', 'سيارة نقل', 'حافلة', 'دراجة نارية',
        'جهاز أشعة', 'جهاز موجات', 'جهاز تحليل',
        'أخرى'
    ],
    // الفئة 3 (التفصيلية)
    categories3: [
        'كرسي مدير', 'كرسي موظف', 'كرسي انتظار', 'كرسي دوار',
        'مكتب مدير', 'مكتب موظف', 'مكتب استقبال', 'مكتب كمبيوتر',
        'طاولة اجتماعات', 'طاولة طعام', 'طاولة عمل', 'طاولة خدمة',
        'خزانة ملفات', 'خزانة أدوات', 'خزانة ملابس', 'خزانة عرض',
        'Dell', 'HP', 'Lenovo', 'Apple', 'Asus', 'Acer',
        'تويوتا', 'نيسان', 'هيونداي', 'فورد', 'شيفروليه',
        'أخرى'
    ],
    // أسماء الأصول المحفوظة
    assetNames: [],
    // الموردين المحفوظين
    suppliers: [
        'شركة التقنية المتقدمة', 'شركة الحاسب العربي', 'مؤسسة الأثاث الفاخر',
        'شركة المستلزمات الطبية', 'وكيل تويوتا المعتمد', 'شركة الكهرباء والإنارة'
    ],
    locations: ['الطابق الأول - مكتب 101', 'الطابق الثاني - غرفة 201', 'الطابق الثالث - قاعة الاجتماعات', 'المستودع', 'موقف السيارات', 'المبنى الرئيسي', 'المبنى الفرعي', 'القبو', 'السطح'],
    buildings: ['المبنى الرئيسي', 'المبنى الفرعي', 'مبنى الخدمات', 'المستودع', 'موقف السيارات'],
    floors: ['القبو', 'الأرضي', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السطح'],
    assignees: [],
    conditions: ['ممتاز', 'جيد', 'مقبول', 'يحتاج صيانة', 'تالف'],
    currentPage: 1,
    itemsPerPage: 10,
    selectedAsset: null,
    uploadedImages: [],
    barcodeScanner: null,
    barcodeScannerStream: null,
    barcodeScannerTargetField: null,
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
            
            // Activity logs store
            if (!db.objectStoreNames.contains(STORES.activityLogs)) {
                const activityStore = db.createObjectStore(STORES.activityLogs, { keyPath: 'id' });
                activityStore.createIndex('timestamp', 'timestamp', { unique: false });
                activityStore.createIndex('type', 'type', { unique: false });
            }
            
            // Asset locations store
            if (!db.objectStoreNames.contains(STORES.assetLocations)) {
                db.createObjectStore(STORES.assetLocations, { keyPath: 'id' });
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
        
        const locations = await dbGet(STORES.settings, 'locations');
        if (locations && locations.value) {
            APP_STATE.locations = locations.value;
        }
        
        const assignees = await dbGet(STORES.settings, 'assignees');
        if (assignees && assignees.value) {
            APP_STATE.assignees = assignees.value;
        }
        
        const assetNames = await dbGet(STORES.settings, 'assetNames');
        if (assetNames && assetNames.value) {
            APP_STATE.assetNames = assetNames.value;
        }
        
        const suppliers = await dbGet(STORES.settings, 'suppliers');
        if (suppliers && suppliers.value) {
            APP_STATE.suppliers = suppliers.value;
        }
        
        const categories2 = await dbGet(STORES.settings, 'categories2');
        if (categories2 && categories2.value) {
            APP_STATE.categories2 = categories2.value;
        }
        
        const categories3 = await dbGet(STORES.settings, 'categories3');
        if (categories3 && categories3.value) {
            APP_STATE.categories3 = categories3.value;
        }
        
        const buildings = await dbGet(STORES.settings, 'buildings');
        if (buildings && buildings.value) {
            APP_STATE.buildings = buildings.value;
        }
        
        const floors = await dbGet(STORES.settings, 'floors');
        if (floors && floors.value) {
            APP_STATE.floors = floors.value;
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
        await dbPut(STORES.settings, { key: 'categories2', value: APP_STATE.categories2 });
        await dbPut(STORES.settings, { key: 'categories3', value: APP_STATE.categories3 });
        await dbPut(STORES.settings, { key: 'locations', value: APP_STATE.locations });
        await dbPut(STORES.settings, { key: 'assignees', value: APP_STATE.assignees });
        await dbPut(STORES.settings, { key: 'assetNames', value: APP_STATE.assetNames });
        await dbPut(STORES.settings, { key: 'suppliers', value: APP_STATE.suppliers });
        await dbPut(STORES.settings, { key: 'buildings', value: APP_STATE.buildings });
        await dbPut(STORES.settings, { key: 'floors', value: APP_STATE.floors });
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
    
    // Initialize searchable selects
    initializeSearchableSelects();
    
    // Initialize buildings dropdown
    initializeBuildingsDropdown();
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
        renderLocationsList();
        renderAssigneesList();
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
    categoryFilter.innerHTML = '<option value="">-- الكل --</option>';
    assetCategory.innerHTML = '';
    
    APP_STATE.categories.forEach(cat => {
        categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        assetCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    
    // Condition filter
    const conditionFilter = document.getElementById('conditionFilter');
    conditionFilter.innerHTML = '<option value="">-- الكل --</option>';
    APP_STATE.conditions.forEach(cond => {
        conditionFilter.innerHTML += `<option value="${cond}">${cond}</option>`;
    });
    
    // Department filters
    const departmentFilter = document.getElementById('departmentFilter');
    const assetDepartment = document.getElementById('assetDepartment');
    const inventoryDepartment = document.getElementById('inventoryDepartment');
    const parentDepartment = document.getElementById('parentDepartment');
    
    departmentFilter.innerHTML = '<option value="">-- الكل --</option>';
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
    
    // Location dropdown
    const assetLocation = document.getElementById('assetLocation');
    if (assetLocation) {
        assetLocation.innerHTML = '<option value="">-- اختر الموقع --</option>';
        APP_STATE.locations.forEach(loc => {
            assetLocation.innerHTML += `<option value="${loc}">${loc}</option>`;
        });
    }
    
    // Assignee dropdown
    const assetAssignee = document.getElementById('assetAssignee');
    if (assetAssignee) {
        assetAssignee.innerHTML = '<option value="">-- اختر المسؤول --</option>';
        APP_STATE.assignees.forEach(assignee => {
            assetAssignee.innerHTML += `<option value="${assignee}">${assignee}</option>`;
        });
    }
    
    // Asset name dropdown
    const assetNameSelect = document.getElementById('assetNameSelect');
    if (assetNameSelect) {
        assetNameSelect.innerHTML = '<option value="">-- اختر أو أدخل اسم جديد --</option>';
        APP_STATE.assetNames.forEach(name => {
            assetNameSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }
    
    // Supplier dropdown
    const assetSupplierSelect = document.getElementById('assetSupplierSelect');
    if (assetSupplierSelect) {
        assetSupplierSelect.innerHTML = '<option value="">-- اختر أو أدخل مورد --</option>';
        APP_STATE.suppliers.forEach(supplier => {
            assetSupplierSelect.innerHTML += `<option value="${supplier}">${supplier}</option>`;
        });
    }
    
    // Category 2 dropdown
    const assetCategory2 = document.getElementById('assetCategory2');
    if (assetCategory2) {
        assetCategory2.innerHTML = '<option value="">-- اختر الفئة الفرعية --</option>';
        APP_STATE.categories2.forEach(cat => {
            assetCategory2.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
    
    // Category 3 dropdown
    const assetCategory3 = document.getElementById('assetCategory3');
    if (assetCategory3) {
        assetCategory3.innerHTML = '<option value="">-- اختر الفئة التفصيلية --</option>';
        APP_STATE.categories3.forEach(cat => {
            assetCategory3.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
    
    // === Populate Advanced Search Filters ===
    populateAdvancedSearchFilters();
    
    // Building dropdown
    const assetBuilding = document.getElementById('assetBuilding');
    if (assetBuilding && APP_STATE.buildings) {
        assetBuilding.innerHTML = '<option value="">-- اختر المبنى --</option>';
        APP_STATE.buildings.forEach(building => {
            assetBuilding.innerHTML += `<option value="${building}">${building}</option>`;
        });
    }
    
    // Floor dropdown (if custom floors exist)
    const assetFloor = document.getElementById('assetFloor');
    if (assetFloor && APP_STATE.floors) {
        const defaultFloors = ['القبو', 'الأرضي', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السطح'];
        assetFloor.innerHTML = '<option value="">-- اختر الدور --</option>';
        // Add default floors
        defaultFloors.forEach(floor => {
            assetFloor.innerHTML += `<option value="${floor}">${floor}</option>`;
        });
        // Add custom floors from settings
        APP_STATE.floors.forEach(floor => {
            if (!defaultFloors.includes(floor)) {
                assetFloor.innerHTML += `<option value="${floor}">${floor}</option>`;
            }
        });
    }
    
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
    
    // Get all filter values using the new function
    const filters = getActiveFilterValues();
    
    // Filter assets with advanced search
    let filtered = APP_STATE.assets.filter(asset => {
        // Text search - search in multiple fields
        const matchSearch = !filters.search || 
            (asset.name && asset.name.toLowerCase().includes(filters.search)) ||
            (asset.code && asset.code.toLowerCase().includes(filters.search)) ||
            (asset.department && asset.department.toLowerCase().includes(filters.search)) ||
            (asset.inventoryPerson && asset.inventoryPerson.toLowerCase().includes(filters.search)) ||
            (asset.building && asset.building.toLowerCase().includes(filters.search)) ||
            (asset.floor && asset.floor.toLowerCase().includes(filters.search)) ||
            (asset.room && asset.room.toLowerCase().includes(filters.search)) ||
            (asset.location && asset.location.toLowerCase().includes(filters.search)) ||
            (asset.locationDesc && asset.locationDesc.toLowerCase().includes(filters.search)) ||
            (asset.supplier && asset.supplier.toLowerCase().includes(filters.search)) ||
            (asset.assignee && asset.assignee.toLowerCase().includes(filters.search)) ||
            (asset.serialNumber && asset.serialNumber.toLowerCase().includes(filters.search));
        
        // Dropdown filters - exact match
        const matchAssetName = !filters.assetName || asset.name === filters.assetName;
        const matchCategory = !filters.category || asset.category === filters.category;
        const matchCategory2 = !filters.category2 || asset.category2 === filters.category2;
        const matchCategory3 = !filters.category3 || asset.category3 === filters.category3;
        const matchDepartment = !filters.department || asset.department === filters.department;
        const matchBuilding = !filters.building || asset.building === filters.building;
        const matchFloor = !filters.floor || asset.floor === filters.floor;
        const matchRoom = !filters.room || asset.room === filters.room;
        const matchLocation = !filters.location || asset.location === filters.location;
        const matchAssignee = !filters.assignee || asset.assignee === filters.assignee;
        const matchCondition = !filters.condition || asset.condition === filters.condition;
        const matchSupplier = !filters.supplier || asset.supplier === filters.supplier;
        
        return matchSearch && matchAssetName && matchCategory && matchCategory2 && matchCategory3 && 
               matchDepartment && matchBuilding && matchFloor && matchRoom && matchLocation && 
               matchAssignee && matchCondition && matchSupplier;
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
            <td class="py-4 px-4 text-sm text-gray-600" title="${getFullLocationString(asset)}">${getShortLocationString(asset)}</td>
            <td class="py-4 px-4">
                <div class="flex items-center gap-2 cursor-pointer group" onclick="openQuickEditValueModal('${asset.id}')" title="انقر للتعديل السريع">
                    <span class="text-sm font-semibold text-green-600">${formatCurrency(asset.currentValue)}</span>
                    <i class="fas fa-edit text-xs text-gray-400 group-hover:text-gov-blue opacity-0 group-hover:opacity-100 transition-opacity"></i>
                </div>
            </td>
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
    updateActiveFiltersDisplay();
}

// === Advanced Search Functions ===
function toggleAdvancedSearch() {
    const panel = document.getElementById('advancedSearchPanel');
    const toggle = document.getElementById('advancedSearchToggle');
    
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        toggle.innerHTML = '<i class="fas fa-times ml-1"></i>إخفاء البحث المتقدم';
        toggle.classList.add('text-red-500');
        toggle.classList.remove('text-gov-blue');
    } else {
        panel.classList.add('hidden');
        toggle.innerHTML = '<i class="fas fa-sliders-h ml-1"></i>بحث متقدم';
        toggle.classList.remove('text-red-500');
        toggle.classList.add('text-gov-blue');
    }
}

function populateAdvancedSearchFilters() {
    // Get unique values from existing assets
    const uniqueAssetNames = [...new Set(APP_STATE.assets.map(a => a.name).filter(Boolean))];
    const uniqueCategories2 = [...new Set([...APP_STATE.categories2, ...APP_STATE.assets.map(a => a.category2).filter(Boolean)])];
    const uniqueCategories3 = [...new Set([...APP_STATE.categories3, ...APP_STATE.assets.map(a => a.category3).filter(Boolean)])];
    const uniqueBuildings = [...new Set([...APP_STATE.buildings, ...APP_STATE.assets.map(a => a.building).filter(Boolean)])];
    const uniqueFloors = [...new Set([...APP_STATE.floors, ...APP_STATE.assets.map(a => a.floor).filter(Boolean)])];
    const uniqueRooms = [...new Set(APP_STATE.assets.map(a => a.room).filter(Boolean))];
    const uniqueLocations = [...new Set([...APP_STATE.locations, ...APP_STATE.assets.map(a => a.location).filter(Boolean)])];
    const uniqueAssignees = [...new Set([...APP_STATE.assignees, ...APP_STATE.assets.map(a => a.assignee).filter(Boolean)])];
    const uniqueSuppliers = [...new Set([...APP_STATE.suppliers, ...APP_STATE.assets.map(a => a.supplier).filter(Boolean)])];
    
    // Populate Asset Name Filter
    const filterAssetName = document.getElementById('filterAssetName');
    if (filterAssetName) {
        filterAssetName.innerHTML = '<option value="">-- الكل --</option>';
        uniqueAssetNames.sort((a, b) => a.localeCompare(b, 'ar')).forEach(name => {
            filterAssetName.innerHTML += `<option value="${name}">${name}</option>`;
        });
    }
    
    // Populate Category 2 Filter
    const filterCategory2 = document.getElementById('filterCategory2');
    if (filterCategory2) {
        filterCategory2.innerHTML = '<option value="">-- الكل --</option>';
        uniqueCategories2.sort((a, b) => a.localeCompare(b, 'ar')).forEach(cat => {
            filterCategory2.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
    
    // Populate Category 3 Filter
    const filterCategory3 = document.getElementById('filterCategory3');
    if (filterCategory3) {
        filterCategory3.innerHTML = '<option value="">-- الكل --</option>';
        uniqueCategories3.sort((a, b) => a.localeCompare(b, 'ar')).forEach(cat => {
            filterCategory3.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
    }
    
    // Populate Building Filter
    const filterBuilding = document.getElementById('filterBuilding');
    if (filterBuilding) {
        filterBuilding.innerHTML = '<option value="">-- الكل --</option>';
        uniqueBuildings.sort((a, b) => a.localeCompare(b, 'ar')).forEach(building => {
            filterBuilding.innerHTML += `<option value="${building}">${building}</option>`;
        });
    }
    
    // Populate Floor Filter
    const filterFloor = document.getElementById('filterFloor');
    if (filterFloor) {
        filterFloor.innerHTML = '<option value="">-- الكل --</option>';
        uniqueFloors.forEach(floor => {
            filterFloor.innerHTML += `<option value="${floor}">${floor}</option>`;
        });
    }
    
    // Populate Room Filter
    const filterRoom = document.getElementById('filterRoom');
    if (filterRoom) {
        filterRoom.innerHTML = '<option value="">-- الكل --</option>';
        uniqueRooms.sort((a, b) => a.localeCompare(b, 'ar')).forEach(room => {
            filterRoom.innerHTML += `<option value="${room}">${room}</option>`;
        });
    }
    
    // Populate Location Filter
    const filterLocation = document.getElementById('filterLocation');
    if (filterLocation) {
        filterLocation.innerHTML = '<option value="">-- الكل --</option>';
        uniqueLocations.sort((a, b) => a.localeCompare(b, 'ar')).forEach(location => {
            filterLocation.innerHTML += `<option value="${location}">${location}</option>`;
        });
    }
    
    // Populate Assignee Filter
    const filterAssignee = document.getElementById('filterAssignee');
    if (filterAssignee) {
        filterAssignee.innerHTML = '<option value="">-- الكل --</option>';
        uniqueAssignees.sort((a, b) => a.localeCompare(b, 'ar')).forEach(assignee => {
            filterAssignee.innerHTML += `<option value="${assignee}">${assignee}</option>`;
        });
    }
    
    // Populate Supplier Filter
    const filterSupplier = document.getElementById('filterSupplier');
    if (filterSupplier) {
        filterSupplier.innerHTML = '<option value="">-- الكل --</option>';
        uniqueSuppliers.sort((a, b) => a.localeCompare(b, 'ar')).forEach(supplier => {
            filterSupplier.innerHTML += `<option value="${supplier}">${supplier}</option>`;
        });
    }
}

function clearAllFilters() {
    // Clear text search
    document.getElementById('assetSearch').value = '';
    
    // Clear all select filters
    const filterIds = [
        'filterAssetName', 'categoryFilter', 'filterCategory2', 'filterCategory3',
        'departmentFilter', 'filterBuilding', 'filterFloor', 'filterRoom',
        'filterLocation', 'filterAssignee', 'conditionFilter', 'filterSupplier'
    ];
    
    filterIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });
    
    // Refresh the table
    filterAssets();
    
    showToast('تم مسح جميع الفلاتر', 'info');
}

function updateActiveFiltersDisplay() {
    const container = document.getElementById('activeFiltersContainer');
    const tagsContainer = document.getElementById('activeFiltersTags');
    
    if (!container || !tagsContainer) return;
    
    const filterLabels = {
        'assetSearch': 'البحث',
        'filterAssetName': 'اسم الأصل',
        'categoryFilter': 'الفئة الرئيسية',
        'filterCategory2': 'الفئة الفرعية',
        'filterCategory3': 'الفئة التفصيلية',
        'departmentFilter': 'الإدارة/القسم',
        'filterBuilding': 'المبنى',
        'filterFloor': 'الدور/الطابق',
        'filterRoom': 'الغرفة/المكتب',
        'filterLocation': 'الموقع التفصيلي',
        'filterAssignee': 'المستخدم/المسؤول',
        'conditionFilter': 'الحالة',
        'filterSupplier': 'المورد'
    };
    
    const activeFilters = [];
    
    Object.keys(filterLabels).forEach(id => {
        const element = document.getElementById(id);
        if (element && element.value) {
            activeFilters.push({
                id: id,
                label: filterLabels[id],
                value: element.value
            });
        }
    });
    
    if (activeFilters.length > 0) {
        container.classList.remove('hidden');
        tagsContainer.innerHTML = activeFilters.map(filter => `
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-gov-blue text-white text-xs rounded-full">
                <span>${filter.label}: ${filter.value}</span>
                <button onclick="removeFilter('${filter.id}')" class="hover:bg-white hover:bg-opacity-20 rounded-full p-0.5">
                    <i class="fas fa-times"></i>
                </button>
            </span>
        `).join('');
    } else {
        container.classList.add('hidden');
    }
}

function removeFilter(filterId) {
    const element = document.getElementById(filterId);
    if (element) {
        element.value = '';
        filterAssets();
    }
}

function getActiveFilterValues() {
    return {
        search: document.getElementById('assetSearch')?.value?.toLowerCase() || '',
        assetName: document.getElementById('filterAssetName')?.value || '',
        category: document.getElementById('categoryFilter')?.value || '',
        category2: document.getElementById('filterCategory2')?.value || '',
        category3: document.getElementById('filterCategory3')?.value || '',
        department: document.getElementById('departmentFilter')?.value || '',
        building: document.getElementById('filterBuilding')?.value || '',
        floor: document.getElementById('filterFloor')?.value || '',
        room: document.getElementById('filterRoom')?.value || '',
        location: document.getElementById('filterLocation')?.value || '',
        assignee: document.getElementById('filterAssignee')?.value || '',
        condition: document.getElementById('conditionFilter')?.value || '',
        supplier: document.getElementById('filterSupplier')?.value || ''
    };
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
            if (document.getElementById('assetCategory2')) document.getElementById('assetCategory2').value = asset.category2 || '';
            if (document.getElementById('assetCategory3')) document.getElementById('assetCategory3').value = asset.category3 || '';
            document.getElementById('assetSerial').value = asset.serialNumber || '';
            document.getElementById('assetDepartment').value = asset.department || '';
            document.getElementById('assetLocation').value = asset.location || '';
            
            // Set new location fields
            if (document.getElementById('assetBuilding')) document.getElementById('assetBuilding').value = asset.building || '';
            if (document.getElementById('assetBuildingCustom')) document.getElementById('assetBuildingCustom').value = '';
            if (document.getElementById('assetFloor')) document.getElementById('assetFloor').value = asset.floor || '';
            if (document.getElementById('assetFloorCustom')) document.getElementById('assetFloorCustom').value = '';
            if (document.getElementById('assetRoom')) document.getElementById('assetRoom').value = asset.room || '';
            if (document.getElementById('assetLocationDesc')) document.getElementById('assetLocationDesc').value = asset.locationDesc || '';
            
            document.getElementById('assetPurchasePrice').value = asset.purchasePrice || '';
            document.getElementById('assetCurrentValue').value = asset.currentValue || '';
            document.getElementById('assetPurchaseDate').value = asset.purchaseDate || '';
            document.getElementById('assetCondition').value = asset.condition || 'جيد';
            document.getElementById('assetSupplier').value = asset.supplier || '';
            document.getElementById('assetWarranty').value = asset.warranty || '';
            document.getElementById('assetAssignee').value = asset.assignee || '';
            document.getElementById('assetInventoryPerson').value = asset.inventoryPerson || APP_STATE.inventoryPerson || '';
            if (document.getElementById('assetTechnicalData')) document.getElementById('assetTechnicalData').value = asset.technicalData || '';
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
    
    const assetName = document.getElementById('assetName').value;
    const supplierName = document.getElementById('assetSupplier').value;
    
    // Save new asset name if not exists
    if (assetName && !APP_STATE.assetNames.includes(assetName)) {
        APP_STATE.assetNames.push(assetName);
        saveSettings();
    }
    
    // Save new supplier if not exists
    if (supplierName && !APP_STATE.suppliers.includes(supplierName)) {
        APP_STATE.suppliers.push(supplierName);
        saveSettings();
    }
    
    // Get building value (from select or custom input)
    const buildingSelect = document.getElementById('assetBuilding');
    const buildingCustom = document.getElementById('assetBuildingCustom');
    const building = buildingCustom && buildingCustom.value.trim() ? buildingCustom.value.trim() : (buildingSelect ? buildingSelect.value : '');
    
    // Get floor value (from select or custom input)
    const floorSelect = document.getElementById('assetFloor');
    const floorCustom = document.getElementById('assetFloorCustom');
    const floor = floorCustom && floorCustom.value.trim() ? floorCustom.value.trim() : (floorSelect ? floorSelect.value : '');
    
    // Get room value
    const room = document.getElementById('assetRoom') ? document.getElementById('assetRoom').value : '';
    
    // Get location description
    const locationDesc = document.getElementById('assetLocationDesc') ? document.getElementById('assetLocationDesc').value : '';
    
    // Save new building if not exists
    if (building && !APP_STATE.buildings) {
        APP_STATE.buildings = [];
    }
    if (building && APP_STATE.buildings && !APP_STATE.buildings.includes(building)) {
        APP_STATE.buildings.push(building);
        saveSettings();
        initializeBuildingsDropdown();
    }
    
    const assetData = {
        id: finalId,
        name: assetName,
        code: document.getElementById('assetCode').value,
        category: document.getElementById('assetCategory').value,
        category2: document.getElementById('assetCategory2') ? document.getElementById('assetCategory2').value : '',
        category3: document.getElementById('assetCategory3') ? document.getElementById('assetCategory3').value : '',
        serialNumber: document.getElementById('assetSerial').value,
        department: document.getElementById('assetDepartment').value,
        building: building,
        floor: floor,
        room: room,
        location: document.getElementById('assetLocation').value,
        locationDesc: locationDesc,
        purchasePrice: parseFloat(document.getElementById('assetPurchasePrice').value) || 0,
        currentValue: parseFloat(document.getElementById('assetCurrentValue').value) || 0,
        purchaseDate: document.getElementById('assetPurchaseDate').value,
        condition: document.getElementById('assetCondition').value,
        supplier: supplierName,
        warranty: document.getElementById('assetWarranty').value,
        assignee: document.getElementById('assetAssignee').value,
        inventoryPerson: document.getElementById('assetInventoryPerson').value,
        lastInventoryDate: new Date().toISOString().split('T')[0],
        technicalData: document.getElementById('assetTechnicalData') ? document.getElementById('assetTechnicalData').value : '',
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
        
        // Log activity
        await logActivity(isNew ? 'إضافة أصل' : 'تعديل أصل', 'asset', `${assetData.code} - ${assetData.name}`);
        
        showToast(isNew ? 'تم إضافة الأصل بنجاح وحفظه محلياً' : 'تم تحديث الأصل بنجاح وحفظه محلياً', 'success');
        
        closeAssetModal();
        updateDashboard();
        renderAssetsTable();
        updateMaintenanceAssetDropdown();
        populateFilters();
        
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
                <p class="text-sm text-gray-600 mb-1">الفئة 1 (الرئيسية)</p>
                <p class="text-lg font-semibold text-gray-800">${asset.category}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">الفئة 2 (الفرعية)</p>
                <p class="text-lg font-semibold text-gray-800">${asset.category2 || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">الفئة 3 (التفصيلية)</p>
                <p class="text-lg font-semibold text-gray-800">${asset.category3 || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">الرقم التسلسلي</p>
                <p class="text-lg font-semibold text-gray-800">${asset.serialNumber || '-'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl">
                <p class="text-sm text-gray-600 mb-1">القسم</p>
                <p class="text-lg font-semibold text-gray-800">${asset.department || '-'}</p>
            </div>
            
            <!-- معلومات الموقع التفصيلية -->
            <div class="location-info-card md:col-span-2">
                <p class="text-sm text-green-700 mb-3 font-semibold"><i class="fas fa-map-marker-alt ml-2"></i>معلومات الموقع</p>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="location-badge">
                        <i class="fas fa-building"></i>
                        <span>${asset.building || 'غير محدد'}</span>
                    </div>
                    <div class="location-badge">
                        <i class="fas fa-layer-group"></i>
                        <span>${asset.floor ? 'الدور ' + asset.floor : 'غير محدد'}</span>
                    </div>
                    <div class="location-badge">
                        <i class="fas fa-door-open"></i>
                        <span>${asset.room || 'غير محدد'}</span>
                    </div>
                    <div class="location-badge">
                        <i class="fas fa-map-pin"></i>
                        <span>${asset.location || 'غير محدد'}</span>
                    </div>
                </div>
                ${asset.locationDesc ? `<p class="text-sm text-gray-600 mt-3"><i class="fas fa-info-circle ml-1"></i>${asset.locationDesc}</p>` : ''}
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
            <div class="bg-cyan-50 p-4 rounded-xl md:col-span-2 border border-cyan-200">
                <p class="text-sm text-cyan-600 mb-1"><i class="fas fa-cogs ml-1"></i>البيانات الفنية</p>
                <p class="text-base text-gray-800">${asset.technicalData || 'لا توجد بيانات فنية'}</p>
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
        
        // Get asset info before removing
        const deletedAsset = APP_STATE.assets.find(a => a.id === assetId);
        
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
        
        // Log activity
        if (deletedAsset) {
            await logActivity('حذف أصل', 'asset', `${deletedAsset.code} - ${deletedAsset.name}`);
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
                <div class="flex items-center justify-center gap-2">
                    <button onclick="viewInventoryDetails('${log.id}')" class="action-btn view" title="عرض">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editInventoryLog('${log.id}')" class="action-btn edit" title="تعديل" ${log.status === 'مكتمل' ? 'disabled' : ''}>
                        <i class="fas fa-edit"></i>
                    </button>
                    ${log.status !== 'مكتمل' ? `
                        <button onclick="completeInventoryLog('${log.id}')" class="action-btn" title="إكمال" style="background: #10b981; color: white;">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button onclick="deleteInventoryLog('${log.id}')" class="action-btn delete" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
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
                    <button onclick="exportReportToExcel('summary')" class="bg-gov-green text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
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
                <div class="flex gap-2">
                    <button onclick="exportReportToExcel('depreciation')" class="bg-gov-green text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                    <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                </div>
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
                <div class="flex gap-2">
                    <button onclick="exportReportToExcel('maintenance')" class="bg-gov-green text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                    <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                </div>
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
                <div class="flex gap-2">
                    <button onclick="exportReportToExcel('inventory')" class="bg-gov-green text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-file-excel ml-2"></i>تصدير Excel
                    </button>
                    <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-print ml-2"></i>طباعة
                    </button>
                </div>
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
        'الفئة الرئيسية': asset.category,
        'الفئة الفرعية': asset.category2 || '',
        'الفئة التفصيلية': asset.category3 || '',
        'القسم': asset.department,
        'المبنى': asset.building || '',
        'الدور': asset.floor || '',
        'الغرفة': asset.room || '',
        'الموقع التفصيلي': asset.location || '',
        'وصف الموقع': asset.locationDesc || '',
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
        'البيانات الفنية': asset.technicalData || '',
        'ملاحظات': asset.notes
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأصول');
    XLSX.writeFile(wb, `جرد_الأصول_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast('تم تصدير البيانات بنجاح', 'success');
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

// Toggle import menu
function toggleImportMenu() {
    const menu = document.getElementById('importMenu');
    menu.classList.toggle('hidden');
}

// Close import menu when clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('importMenu');
    const btn = e.target.closest('[onclick*="toggleImportMenu"]');
    if (!btn && menu && !menu.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

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

// === Location Management Functions ===
function renderLocationsList() {
    const list = document.getElementById('locationsList');
    if (!list) return;
    
    list.innerHTML = APP_STATE.locations.map(loc => `
        <div class="flex items-center justify-between bg-green-50 p-3 rounded-lg">
            <span class="text-gray-700"><i class="fas fa-map-marker-alt ml-2 text-gov-green"></i>${loc}</span>
            <button onclick="removeLocation('${loc}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addLocation() {
    const input = document.getElementById('newLocation');
    const location = input.value.trim();
    
    if (!location) {
        showToast('يرجى إدخال اسم الموقع', 'warning');
        return;
    }
    
    if (APP_STATE.locations.includes(location)) {
        showToast('هذا الموقع موجود بالفعل', 'warning');
        return;
    }
    
    APP_STATE.locations.push(location);
    input.value = '';
    saveSettings();
    renderLocationsList();
    populateFilters();
    showToast('تم إضافة الموقع بنجاح', 'success');
}

function removeLocation(location) {
    if (!confirm(`هل أنت متأكد من حذف الموقع "${location}"؟`)) return;
    
    APP_STATE.locations = APP_STATE.locations.filter(l => l !== location);
    saveSettings();
    renderLocationsList();
    populateFilters();
    showToast('تم حذف الموقع', 'success');
}

// === Assignee Management Functions ===
function renderAssigneesList() {
    const list = document.getElementById('assigneesList');
    if (!list) return;
    
    list.innerHTML = APP_STATE.assignees.map(assignee => `
        <div class="flex items-center justify-between bg-purple-50 p-3 rounded-lg">
            <span class="text-gray-700"><i class="fas fa-user-tie ml-2 text-purple-600"></i>${assignee}</span>
            <button onclick="removeAssignee('${assignee}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addAssignee() {
    const input = document.getElementById('newAssignee');
    const assignee = input.value.trim();
    
    if (!assignee) {
        showToast('يرجى إدخال اسم المستخدم/المسؤول', 'warning');
        return;
    }
    
    if (APP_STATE.assignees.includes(assignee)) {
        showToast('هذا المستخدم/المسؤول موجود بالفعل', 'warning');
        return;
    }
    
    APP_STATE.assignees.push(assignee);
    input.value = '';
    saveSettings();
    renderAssigneesList();
    populateFilters();
    showToast('تم إضافة المستخدم/المسؤول بنجاح', 'success');
}

function removeAssignee(assignee) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم/المسؤول "${assignee}"؟`)) return;
    
    APP_STATE.assignees = APP_STATE.assignees.filter(a => a !== assignee);
    saveSettings();
    renderAssigneesList();
    populateFilters();
    showToast('تم حذف المستخدم/المسؤول', 'success');
}

// === Excel Import Functions ===
async function importCategoriesFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newCategories = data.map(row => {
                // Try to get value from first column, could be named differently
                return row['الفئة'] || row['فئة'] || row['Category'] || row['category'] || Object.values(row)[0];
            }).filter(cat => cat && typeof cat === 'string' && cat.trim());
            
            const uniqueNew = [...new Set(newCategories)].filter(cat => !APP_STATE.categories.includes(cat.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.categories.push(...uniqueNew.map(c => c.trim()));
                saveSettings();
                renderCategoriesList();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} فئة جديدة`, 'success');
            } else {
                showToast('لا توجد فئات جديدة للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing categories:', error);
        showToast('حدث خطأ أثناء استيراد الفئات', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

async function importLocationsFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newLocations = data.map(row => {
                return row['الموقع'] || row['موقع'] || row['Location'] || row['location'] || Object.values(row)[0];
            }).filter(loc => loc && typeof loc === 'string' && loc.trim());
            
            const uniqueNew = [...new Set(newLocations)].filter(loc => !APP_STATE.locations.includes(loc.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.locations.push(...uniqueNew.map(l => l.trim()));
                saveSettings();
                renderLocationsList();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} موقع جديد`, 'success');
            } else {
                showToast('لا توجد مواقع جديدة للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing locations:', error);
        showToast('حدث خطأ أثناء استيراد المواقع', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

async function importAssigneesFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newAssignees = data.map(row => {
                return row['المستخدم'] || row['المسؤول'] || row['مستخدم'] || row['Assignee'] || row['User'] || Object.values(row)[0];
            }).filter(a => a && typeof a === 'string' && a.trim());
            
            const uniqueNew = [...new Set(newAssignees)].filter(a => !APP_STATE.assignees.includes(a.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.assignees.push(...uniqueNew.map(a => a.trim()));
                saveSettings();
                renderAssigneesList();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} مستخدم/مسؤول جديد`, 'success');
            } else {
                showToast('لا يوجد مستخدمين جدد للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing assignees:', error);
        showToast('حدث خطأ أثناء استيراد المستخدمين', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheet];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// === Excel Import Functions for Categories 2, 3, Suppliers, Asset Names ===
async function importCategories2FromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newCategories = data.map(row => {
                return row['الفئة'] || row['الفئة الفرعية'] || row['فئة'] || row['Category'] || row['category2'] || Object.values(row)[0];
            }).filter(cat => cat && typeof cat === 'string' && cat.trim());
            
            const uniqueNew = [...new Set(newCategories)].filter(cat => !APP_STATE.categories2.includes(cat.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.categories2.push(...uniqueNew.map(c => c.trim()));
                saveSettings();
                renderCategories2List();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} فئة فرعية جديدة`, 'success');
            } else {
                showToast('لا توجد فئات فرعية جديدة للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing categories2:', error);
        showToast('حدث خطأ أثناء استيراد الفئات الفرعية', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

async function importCategories3FromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newCategories = data.map(row => {
                return row['الفئة'] || row['الفئة التفصيلية'] || row['فئة'] || row['Category'] || row['category3'] || Object.values(row)[0];
            }).filter(cat => cat && typeof cat === 'string' && cat.trim());
            
            const uniqueNew = [...new Set(newCategories)].filter(cat => !APP_STATE.categories3.includes(cat.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.categories3.push(...uniqueNew.map(c => c.trim()));
                saveSettings();
                renderCategories3List();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} فئة تفصيلية جديدة`, 'success');
            } else {
                showToast('لا توجد فئات تفصيلية جديدة للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing categories3:', error);
        showToast('حدث خطأ أثناء استيراد الفئات التفصيلية', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

async function importAssetNamesFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newNames = data.map(row => {
                return row['الاسم'] || row['اسم الأصل'] || row['أصل'] || row['Name'] || row['AssetName'] || Object.values(row)[0];
            }).filter(name => name && typeof name === 'string' && name.trim());
            
            const uniqueNew = [...new Set(newNames)].filter(name => !APP_STATE.assetNames.includes(name.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.assetNames.push(...uniqueNew.map(n => n.trim()));
                saveSettings();
                renderAssetNamesList();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} اسم أصل جديد`, 'success');
            } else {
                showToast('لا توجد أسماء أصول جديدة للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing asset names:', error);
        showToast('حدث خطأ أثناء استيراد أسماء الأصول', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

async function importSuppliersFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            const newSuppliers = data.map(row => {
                return row['المورد'] || row['اسم المورد'] || row['مورد'] || row['Supplier'] || row['supplier'] || Object.values(row)[0];
            }).filter(sup => sup && typeof sup === 'string' && sup.trim());
            
            const uniqueNew = [...new Set(newSuppliers)].filter(sup => !APP_STATE.suppliers.includes(sup.trim()));
            
            if (uniqueNew.length > 0) {
                APP_STATE.suppliers.push(...uniqueNew.map(s => s.trim()));
                saveSettings();
                renderSuppliersList();
                populateFilters();
                showToast(`تم استيراد ${uniqueNew.length} مورد جديد`, 'success');
            } else {
                showToast('لا يوجد موردين جدد للاستيراد', 'info');
            }
        }
    } catch (error) {
        console.error('Error importing suppliers:', error);
        showToast('حدث خطأ أثناء استيراد الموردين', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

// === Searchable Select Functions ===
function initializeSearchableSelects() {
    // Add search functionality to all searchable selects
    document.querySelectorAll('.searchable-select').forEach(select => {
        makeSelectSearchable(select);
    });
}

function makeSelectSearchable(selectElement) {
    if (selectElement.dataset.searchableInitialized) return;
    
    const container = selectElement.closest('.searchable-select-container') || selectElement.parentElement;
    
    // Create search input
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'searchable-select-wrapper relative';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'searchable-select-search w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-gov-blue-light mb-1';
    searchInput.placeholder = 'اكتب للبحث...';
    searchInput.style.display = 'none';
    
    // Insert search input before select
    selectElement.parentNode.insertBefore(searchInput, selectElement);
    
    // Store original options
    const originalOptions = Array.from(selectElement.options).map(opt => ({
        value: opt.value,
        text: opt.textContent,
        selected: opt.selected
    }));
    
    // Show search on focus
    selectElement.addEventListener('focus', function() {
        searchInput.style.display = 'block';
        searchInput.focus();
    });
    
    // Filter options on search
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        // Clear current options
        selectElement.innerHTML = '';
        
        // Filter and add matching options
        const filteredOptions = originalOptions.filter(opt => 
            opt.text.toLowerCase().includes(searchTerm) || opt.value === ''
        );
        
        filteredOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (opt.selected) option.selected = true;
            selectElement.appendChild(option);
        });
        
        // Show count
        if (searchTerm && filteredOptions.length <= 1) {
            showToast(`لا توجد نتائج لـ "${searchTerm}"`, 'info');
        }
    });
    
    // Hide search on blur (with delay to allow selection)
    searchInput.addEventListener('blur', function() {
        setTimeout(() => {
            searchInput.style.display = 'none';
            searchInput.value = '';
            // Restore all options
            selectElement.innerHTML = '';
            originalOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                selectElement.appendChild(option);
            });
        }, 200);
    });
    
    selectElement.dataset.searchableInitialized = 'true';
}

// Enhanced searchable select with dropdown
function createEnhancedSearchableSelect(selectId, options, placeholder = 'اختر أو ابحث...') {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const container = select.parentElement;
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-searchable-select relative';
    
    // Create input for search
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-gov-blue-light';
    input.placeholder = placeholder;
    input.id = selectId + '_search';
    
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'enhanced-select-dropdown absolute top-full left-0 right-0 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 hidden';
    
    // Hide original select
    select.style.display = 'none';
    
    // Insert new elements
    container.insertBefore(wrapper, select);
    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);
    wrapper.appendChild(select);
    
    // Populate dropdown
    function populateDropdown(filter = '') {
        dropdown.innerHTML = '';
        const filterLower = filter.toLowerCase();
        
        options.forEach(opt => {
            if (filterLower && !opt.toLowerCase().includes(filterLower)) return;
            
            const item = document.createElement('div');
            item.className = 'px-4 py-2 hover:bg-gov-blue hover:text-white cursor-pointer transition-colors';
            item.textContent = opt;
            item.addEventListener('click', () => {
                input.value = opt;
                select.value = opt;
                dropdown.classList.add('hidden');
                select.dispatchEvent(new Event('change'));
            });
            dropdown.appendChild(item);
        });
    }
    
    // Events
    input.addEventListener('focus', () => {
        populateDropdown(input.value);
        dropdown.classList.remove('hidden');
    });
    
    input.addEventListener('input', () => {
        populateDropdown(input.value);
        dropdown.classList.remove('hidden');
    });
    
    input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.add('hidden'), 200);
    });
    
    // Set initial value
    if (select.value) {
        input.value = select.value;
    }
}

// === Buildings Dropdown Initialization ===
function initializeBuildingsDropdown() {
    const buildingSelect = document.getElementById('assetBuilding');
    if (!buildingSelect) return;
    
    // Clear existing options except first
    buildingSelect.innerHTML = '<option value="">-- اختر المبنى --</option>';
    
    // Add buildings from APP_STATE
    if (APP_STATE.buildings && APP_STATE.buildings.length > 0) {
        APP_STATE.buildings.forEach(building => {
            const option = document.createElement('option');
            option.value = building;
            option.textContent = building;
            buildingSelect.appendChild(option);
        });
    }
}

// === Load Buildings from Settings ===
async function loadBuildingsSettings() {
    try {
        const buildings = await dbGet(STORES.settings, 'buildings');
        if (buildings && buildings.value) {
            APP_STATE.buildings = buildings.value;
        }
    } catch (error) {
        console.error('Error loading buildings settings:', error);
    }
}

// === Get Full Location String ===
function getFullLocationString(asset) {
    const parts = [];
    if (asset.building) parts.push(asset.building);
    if (asset.floor) parts.push(`الدور ${asset.floor}`);
    if (asset.room) parts.push(asset.room);
    if (asset.location && !parts.includes(asset.location)) parts.push(asset.location);
    if (asset.locationDesc) parts.push(`(${asset.locationDesc})`);
    
    return parts.length > 0 ? parts.join(' - ') : 'غير محدد';
}

// === Get Short Location String (for table display) ===
function getShortLocationString(asset) {
    // Priority: room > location > building+floor
    if (asset.room) {
        return asset.room;
    }
    if (asset.location) {
        return asset.location.length > 25 ? asset.location.substring(0, 22) + '...' : asset.location;
    }
    if (asset.building || asset.floor) {
        const short = [];
        if (asset.building) short.push(asset.building);
        if (asset.floor) short.push(asset.floor);
        const result = short.join(' - ');
        return result.length > 25 ? result.substring(0, 22) + '...' : result;
    }
    return '-';
}

// === Barcode Scanner for Fields ===
function scanBarcodeForField(fieldId) {
    APP_STATE.barcodeScannerTargetField = fieldId;
    document.getElementById('barcodeScannerTargetField').value = fieldId;
    document.getElementById('barcodeScannerResult').classList.add('hidden');
    document.getElementById('barcodeScannerModal').classList.remove('hidden');
    
    startFieldBarcodeScanner();
}

async function startFieldBarcodeScanner() {
    const video = document.getElementById('barcodeScannerVideo');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        
        APP_STATE.barcodeScannerStream = stream;
        video.srcObject = stream;
        video.play();
        
        // Start Quagga for barcode detection
        if (typeof Quagga !== 'undefined') {
            Quagga.init({
                inputStream: {
                    name: "Live",
                    type: "LiveStream",
                    target: document.getElementById('barcodeScannerPreview'),
                    constraints: {
                        facingMode: "environment"
                    }
                },
                decoder: {
                    readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "upc_reader", "upc_e_reader"]
                }
            }, function(err) {
                if (err) {
                    console.error('Quagga init error:', err);
                    return;
                }
                Quagga.start();
            });
            
            Quagga.onDetected(function(result) {
                const code = result.codeResult.code;
                if (code) {
                    handleBarcodeDetection(code);
                }
            });
        }
        
    } catch (error) {
        console.error('Camera error:', error);
        showToast('لا يمكن الوصول إلى الكاميرا. تأكد من منح الإذن.', 'error');
    }
}

function handleBarcodeDetection(code) {
    const targetField = APP_STATE.barcodeScannerTargetField;
    
    if (targetField) {
        document.getElementById(targetField).value = code;
        
        // Show result
        const resultDiv = document.getElementById('barcodeScannerResult');
        document.getElementById('barcodeScannerResultText').textContent = code;
        resultDiv.classList.remove('hidden');
        
        // Play success sound
        playBeepSound();
        
        // Close modal after short delay
        setTimeout(() => {
            closeBarcodeScannerModal();
        }, 1000);
    }
}

function closeBarcodeScannerModal() {
    // Stop video stream
    if (APP_STATE.barcodeScannerStream) {
        APP_STATE.barcodeScannerStream.getTracks().forEach(track => track.stop());
        APP_STATE.barcodeScannerStream = null;
    }
    
    // Stop Quagga
    if (typeof Quagga !== 'undefined') {
        try {
            Quagga.stop();
        } catch (e) {}
    }
    
    document.getElementById('barcodeScannerModal').classList.add('hidden');
    APP_STATE.barcodeScannerTargetField = null;
}

function manualBarcodeEntry() {
    const targetField = APP_STATE.barcodeScannerTargetField;
    const code = prompt('أدخل الكود يدوياً:');
    
    if (code && targetField) {
        document.getElementById(targetField).value = code.trim();
        closeBarcodeScannerModal();
        showToast('تم إدخال الكود', 'success');
    }
}

function playBeepSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 1000;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        setTimeout(() => oscillator.stop(), 150);
    } catch (e) {}
}

// === Quick Edit Current Value Functions ===
function openQuickEditValueModal(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    document.getElementById('quickEditAssetId').value = assetId;
    document.getElementById('quickEditAssetName').textContent = `${asset.code} - ${asset.name}`;
    document.getElementById('quickEditPurchasePrice').textContent = formatCurrency(asset.purchasePrice);
    document.getElementById('quickEditCurrentValue').value = asset.currentValue || 0;
    
    document.getElementById('quickEditValueModal').classList.remove('hidden');
}

function closeQuickEditValueModal() {
    document.getElementById('quickEditValueModal').classList.add('hidden');
}

async function saveQuickEditValue() {
    const assetId = document.getElementById('quickEditAssetId').value;
    const newValue = parseFloat(document.getElementById('quickEditCurrentValue').value) || 0;
    
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    showLoading();
    
    try {
        asset.currentValue = newValue;
        asset.updatedAt = Date.now();
        
        // Save to IndexedDB
        await dbPut(STORES.assets, asset);
        
        // Sync with server
        if (APP_STATE.isOnline) {
            try {
                await fetch(`${API_BASE}/assets/${assetId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentValue: newValue })
                });
            } catch (e) {
                await addToSyncQueue('update', 'assets', asset);
            }
        } else {
            await addToSyncQueue('update', 'assets', asset);
        }
        
        showToast('تم تحديث القيمة الحالية بنجاح', 'success');
        closeQuickEditValueModal();
        renderAssetsTable();
        updateDashboard();
        
    } catch (error) {
        console.error('Error updating value:', error);
        showToast('حدث خطأ أثناء التحديث', 'error');
    }
    
    hideLoading();
}

// === Export Reports to Excel Functions ===
// === Additional Enhancements ===

// Import Assets from Excel
async function importAssetsFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    showLoading();
    
    try {
        const data = await readExcelFile(file);
        if (data && data.length > 0) {
            let imported = 0;
            let skipped = 0;
            
            for (const row of data) {
                // Map Excel columns to asset fields
                const assetData = {
                    id: generateId(),
                    name: row['اسم الأصل'] || row['الاسم'] || row['Name'] || '',
                    code: row['الكود'] || row['كود الأصل'] || row['Code'] || generateAutoCode(),
                    category: row['الفئة'] || row['Category'] || 'أخرى',
                    serialNumber: row['الرقم التسلسلي'] || row['Serial'] || '',
                    department: row['القسم'] || row['الإدارة'] || row['Department'] || '',
                    location: row['الموقع'] || row['Location'] || '',
                    purchaseDate: formatExcelDate(row['تاريخ الشراء'] || row['Purchase Date']),
                    purchasePrice: parseFloat(row['سعر الشراء'] || row['Purchase Price']) || 0,
                    currentValue: parseFloat(row['القيمة الحالية'] || row['Current Value']) || 0,
                    condition: row['الحالة'] || row['Condition'] || 'جيد',
                    supplier: row['المورد'] || row['Supplier'] || '',
                    warranty: formatExcelDate(row['الضمان'] || row['Warranty']),
                    assignee: row['المسؤول'] || row['المستخدم'] || row['Assignee'] || '',
                    inventoryPerson: row['القائم بالجرد'] || APP_STATE.inventoryPerson || '',
                    notes: row['ملاحظات'] || row['Notes'] || '',
                    lastInventoryDate: new Date().toISOString().split('T')[0],
                    updatedAt: Date.now()
                };
                
                // Skip if no name
                if (!assetData.name) {
                    skipped++;
                    continue;
                }
                
                // Save to IndexedDB
                await dbPut(STORES.assets, assetData);
                APP_STATE.assets.push(assetData);
                
                // Add to sync queue
                if (APP_STATE.isOnline) {
                    try {
                        await fetch(`${API_BASE}/assets`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(assetData)
                        });
                    } catch (e) {
                        await addToSyncQueue('create', 'assets', assetData);
                    }
                } else {
                    await addToSyncQueue('create', 'assets', assetData);
                }
                
                imported++;
            }
            
            showToast(`تم استيراد ${imported} أصل${skipped > 0 ? ` (تم تجاهل ${skipped})` : ''}`, 'success');
            updateDashboard();
            renderAssetsTable();
            populateFilters();
        }
    } catch (error) {
        console.error('Error importing assets:', error);
        showToast('حدث خطأ أثناء استيراد الأصول', 'error');
    }
    
    event.target.value = '';
    hideLoading();
}

function formatExcelDate(value) {
    if (!value) return '';
    
    // If it's an Excel date number
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    
    // If it's already a date string
    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }
    
    return '';
}

function generateAutoCode() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `AST-${year}-${random}`;
}

// Export all data with comprehensive fields
function exportAllAssetsToExcel() {
    const data = APP_STATE.assets.map(asset => ({
        'الكود': asset.code,
        'اسم الأصل': asset.name,
        'الفئة': asset.category,
        'الرقم التسلسلي': asset.serialNumber,
        'القسم/الإدارة': asset.department,
        'الموقع التفصيلي': asset.location,
        'تاريخ الشراء': asset.purchaseDate,
        'سعر الشراء': asset.purchasePrice,
        'القيمة الحالية': asset.currentValue,
        'الإهلاك': (parseFloat(asset.purchasePrice) || 0) - (parseFloat(asset.currentValue) || 0),
        'الحالة': asset.condition,
        'المورد': asset.supplier,
        'تاريخ انتهاء الضمان': asset.warranty,
        'المستخدم/المسؤول': asset.assignee,
        'القائم بالجرد': asset.inventoryPerson,
        'تاريخ آخر جرد': asset.lastInventoryDate,
        'ملاحظات': asset.notes
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأصول');
    
    // Add summary sheet
    const summaryData = [
        { 'البند': 'إجمالي الأصول', 'القيمة': APP_STATE.assets.length },
        { 'البند': 'إجمالي قيمة الشراء', 'القيمة': APP_STATE.assets.reduce((sum, a) => sum + (parseFloat(a.purchasePrice) || 0), 0) },
        { 'البند': 'إجمالي القيمة الحالية', 'القيمة': APP_STATE.assets.reduce((sum, a) => sum + (parseFloat(a.currentValue) || 0), 0) },
        { 'البند': 'إجمالي الإهلاك', 'القيمة': APP_STATE.assets.reduce((sum, a) => sum + ((parseFloat(a.purchasePrice) || 0) - (parseFloat(a.currentValue) || 0)), 0) },
        { 'البند': 'تاريخ التصدير', 'القيمة': new Date().toLocaleString('ar-SA') },
        { 'البند': 'القائم بالجرد', 'القيمة': APP_STATE.inventoryPerson || 'غير محدد' }
    ];
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'ملخص');
    
    XLSX.writeFile(wb, `جرد_الأصول_الشامل_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('تم تصدير جميع البيانات بنجاح', 'success');
}

// Download Excel Template for Import
function downloadExcelTemplate() {
    const templateData = [
        {
            'اسم الأصل': 'مثال: جهاز كمبيوتر',
            'الكود': 'IT-2024-001',
            'الفئة': 'معدات إلكترونية',
            'الرقم التسلسلي': 'SN-123456',
            'القسم/الإدارة': 'تقنية المعلومات',
            'الموقع': 'الطابق الثاني - غرفة 201',
            'تاريخ الشراء': '2024-01-15',
            'سعر الشراء': 5000,
            'القيمة الحالية': 4500,
            'الحالة': 'ممتاز',
            'المورد': 'شركة التقنية',
            'الضمان': '2027-01-15',
            'المسؤول': 'أحمد محمد',
            'ملاحظات': 'ملاحظات إضافية'
        }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج');
    
    // Add instructions sheet
    const instructions = [
        { 'التعليمات': 'قم بتعبئة البيانات في الأعمدة المحددة' },
        { 'التعليمات': 'الفئات المتاحة: أثاث، معدات إلكترونية، مركبات، أجهزة طبية، معدات مكتبية، أجهزة كهربائية، أخرى' },
        { 'التعليمات': 'الحالات المتاحة: ممتاز، جيد، مقبول، يحتاج صيانة، تالف' },
        { 'التعليمات': 'تنسيق التاريخ: YYYY-MM-DD مثال: 2024-01-15' },
        { 'التعليمات': 'الحقول المطلوبة: اسم الأصل (على الأقل)' }
    ];
    const instrWs = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, instrWs, 'تعليمات');
    
    XLSX.writeFile(wb, 'نموذج_استيراد_الأصول.xlsx');
    showToast('تم تحميل النموذج', 'success');
}

// Search by barcode in inventory page
function searchByBarcode() {
    const code = prompt('أدخل كود الأصل أو الرقم التسلسلي:');
    if (!code) return;
    
    const asset = APP_STATE.assets.find(a => 
        a.code === code || 
        a.serialNumber === code ||
        a.code.toLowerCase().includes(code.toLowerCase())
    );
    
    if (asset) {
        viewAssetDetails(asset.id);
    } else {
        showToast('لم يتم العثور على الأصل', 'warning');
    }
}

// Bulk update assets condition
async function bulkUpdateCondition(newCondition) {
    const selectedIds = Array.from(document.querySelectorAll('.asset-checkbox:checked'))
        .map(cb => cb.dataset.id);
    
    if (selectedIds.length === 0) {
        showToast('يرجى تحديد أصول للتحديث', 'warning');
        return;
    }
    
    if (!confirm(`هل تريد تحديث حالة ${selectedIds.length} أصل إلى "${newCondition}"؟`)) return;
    
    showLoading();
    
    try {
        for (const id of selectedIds) {
            const asset = APP_STATE.assets.find(a => a.id === id);
            if (asset) {
                asset.condition = newCondition;
                asset.updatedAt = Date.now();
                await dbPut(STORES.assets, asset);
                
                if (APP_STATE.isOnline) {
                    try {
                        await fetch(`${API_BASE}/assets/${id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ condition: newCondition })
                        });
                    } catch (e) {
                        await addToSyncQueue('update', 'assets', asset);
                    }
                }
            }
        }
        
        showToast(`تم تحديث ${selectedIds.length} أصل`, 'success');
        renderAssetsTable();
        updateDashboard();
    } catch (error) {
        console.error('Bulk update error:', error);
        showToast('حدث خطأ أثناء التحديث', 'error');
    }
    
    hideLoading();
}

// Generate comprehensive asset report
function generateAssetReport(assetId) {
    const asset = APP_STATE.assets.find(a => a.id === assetId);
    if (!asset) return;
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الأصل - ${asset.code}</title>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Tajawal', sans-serif; padding: 40px; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e40af; padding-bottom: 20px; }
                .header h1 { color: #1e40af; margin: 0; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .info-item { padding: 10px; background: #f8fafc; border-radius: 8px; }
                .info-label { font-size: 12px; color: #64748b; }
                .info-value { font-size: 16px; font-weight: bold; color: #1e293b; }
                .barcode { text-align: center; margin: 30px 0; }
                .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>نظام جرد وحصر الأصول الحكومية</h1>
                <p>تقرير تفصيلي للأصل</p>
            </div>
            <div class="info-grid">
                <div class="info-item"><div class="info-label">كود الأصل</div><div class="info-value">${asset.code}</div></div>
                <div class="info-item"><div class="info-label">اسم الأصل</div><div class="info-value">${asset.name}</div></div>
                <div class="info-item"><div class="info-label">الفئة</div><div class="info-value">${asset.category}</div></div>
                <div class="info-item"><div class="info-label">الرقم التسلسلي</div><div class="info-value">${asset.serialNumber || '-'}</div></div>
                <div class="info-item"><div class="info-label">القسم</div><div class="info-value">${asset.department || '-'}</div></div>
                <div class="info-item"><div class="info-label">الموقع</div><div class="info-value">${asset.location || '-'}</div></div>
                <div class="info-item"><div class="info-label">تاريخ الشراء</div><div class="info-value">${asset.purchaseDate || '-'}</div></div>
                <div class="info-item"><div class="info-label">سعر الشراء</div><div class="info-value">${formatCurrency(asset.purchasePrice)}</div></div>
                <div class="info-item"><div class="info-label">القيمة الحالية</div><div class="info-value">${formatCurrency(asset.currentValue)}</div></div>
                <div class="info-item"><div class="info-label">الحالة</div><div class="info-value">${asset.condition}</div></div>
                <div class="info-item"><div class="info-label">المسؤول</div><div class="info-value">${asset.assignee || '-'}</div></div>
                <div class="info-item"><div class="info-label">القائم بالجرد</div><div class="info-value">${asset.inventoryPerson || '-'}</div></div>
            </div>
            <div class="barcode">
                <svg id="barcodeSvg"></svg>
            </div>
            <div class="footer">
                <p>تم إنشاء هذا التقرير بتاريخ: ${new Date().toLocaleString('ar-SA')}</p>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
            <script>
                JsBarcode("#barcodeSvg", "${asset.code}", { format: "CODE128", width: 2, height: 60 });
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

function exportReportToExcel(reportType) {
    let data = [];
    let filename = '';
    
    switch (reportType) {
        case 'summary':
            data = APP_STATE.assets.map(asset => ({
                'الكود': asset.code,
                'الاسم': asset.name,
                'الفئة': asset.category,
                'القسم': asset.department,
                'الموقع': asset.location,
                'سعر الشراء': asset.purchasePrice,
                'القيمة الحالية': asset.currentValue,
                'الحالة': asset.condition
            }));
            filename = 'تقرير_ملخص_الأصول';
            break;
            
        case 'depreciation':
            data = APP_STATE.assets.map(asset => {
                const purchase = parseFloat(asset.purchasePrice) || 0;
                const current = parseFloat(asset.currentValue) || 0;
                const depreciation = purchase - current;
                const rate = purchase > 0 ? ((depreciation / purchase) * 100).toFixed(1) : 0;
                return {
                    'الكود': asset.code,
                    'الاسم': asset.name,
                    'سعر الشراء': purchase,
                    'القيمة الحالية': current,
                    'الإهلاك': depreciation,
                    'نسبة الإهلاك %': rate
                };
            });
            filename = 'تقرير_الإهلاك';
            break;
            
        case 'maintenance':
            const needMaint = APP_STATE.assets.filter(a => a.condition === 'يحتاج صيانة' || a.condition === 'تالف');
            data = needMaint.map(asset => ({
                'الكود': asset.code,
                'الاسم': asset.name,
                'القسم': asset.department,
                'الموقع': asset.location,
                'الحالة': asset.condition,
                'ملاحظات': asset.notes
            }));
            filename = 'تقرير_الصيانة';
            break;
            
        case 'inventory':
            data = APP_STATE.inventoryLogs.map((log, index) => ({
                'رقم العملية': `INV-${String(index + 1).padStart(3, '0')}`,
                'اسم الجرد': log.name,
                'التاريخ': log.date,
                'الإدارة': log.department || 'جميع الإدارات',
                'القائم بالجرد': log.inventoryPerson,
                'الحالة': log.status
            }));
            filename = 'تقرير_الجرد';
            break;
    }
    
    if (data.length === 0) {
        showToast('لا توجد بيانات للتصدير', 'warning');
        return;
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    showToast('تم تصدير التقرير بنجاح', 'success');
}

// === Asset Names Management ===
function renderAssetNamesList() {
    const list = document.getElementById('assetNamesList');
    if (!list) return;
    
    list.innerHTML = APP_STATE.assetNames.map(name => `
        <div class="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
            <span class="text-gray-700"><i class="fas fa-box ml-2 text-blue-600"></i>${name}</span>
            <button onclick="removeAssetName('${name}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addAssetName() {
    const input = document.getElementById('newAssetName');
    const name = input.value.trim();
    
    if (!name) {
        showToast('يرجى إدخال اسم الأصل', 'warning');
        return;
    }
    
    if (APP_STATE.assetNames.includes(name)) {
        showToast('هذا الاسم موجود بالفعل', 'warning');
        return;
    }
    
    APP_STATE.assetNames.push(name);
    input.value = '';
    saveSettings();
    renderAssetNamesList();
    populateFilters();
    showToast('تم إضافة اسم الأصل بنجاح', 'success');
}

function removeAssetName(name) {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    
    APP_STATE.assetNames = APP_STATE.assetNames.filter(n => n !== name);
    saveSettings();
    renderAssetNamesList();
    showToast('تم حذف اسم الأصل', 'success');
}

// === Supplier Management ===
function renderSuppliersList() {
    const list = document.getElementById('suppliersList');
    if (!list) return;
    
    list.innerHTML = APP_STATE.suppliers.map(supplier => `
        <div class="flex items-center justify-between bg-orange-50 p-3 rounded-lg">
            <span class="text-gray-700"><i class="fas fa-truck ml-2 text-orange-600"></i>${supplier}</span>
            <button onclick="removeSupplier('${supplier}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addSupplier() {
    const input = document.getElementById('newSupplier');
    const supplier = input.value.trim();
    
    if (!supplier) {
        showToast('يرجى إدخال اسم المورد', 'warning');
        return;
    }
    
    if (APP_STATE.suppliers.includes(supplier)) {
        showToast('هذا المورد موجود بالفعل', 'warning');
        return;
    }
    
    APP_STATE.suppliers.push(supplier);
    input.value = '';
    saveSettings();
    renderSuppliersList();
    populateFilters();
    showToast('تم إضافة المورد بنجاح', 'success');
}

function removeSupplier(supplier) {
    if (!confirm(`هل أنت متأكد من حذف "${supplier}"؟`)) return;
    
    APP_STATE.suppliers = APP_STATE.suppliers.filter(s => s !== supplier);
    saveSettings();
    renderSuppliersList();
    showToast('تم حذف المورد', 'success');
}

// === Categories 2 & 3 Management ===
function renderCategories2List() {
    const list = document.getElementById('categories2List');
    if (!list) return;
    
    list.innerHTML = APP_STATE.categories2.map(cat => `
        <div class="flex items-center justify-between bg-indigo-50 p-3 rounded-lg">
            <span class="text-gray-700"><i class="fas fa-layer-group ml-2 text-indigo-600"></i>${cat}</span>
            <button onclick="removeCategory2('${cat}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addCategory2() {
    const input = document.getElementById('newCategory2');
    const category = input.value.trim();
    
    if (!category) {
        showToast('يرجى إدخال الفئة', 'warning');
        return;
    }
    
    if (APP_STATE.categories2.includes(category)) {
        showToast('هذه الفئة موجودة بالفعل', 'warning');
        return;
    }
    
    APP_STATE.categories2.push(category);
    input.value = '';
    saveSettings();
    renderCategories2List();
    populateFilters();
    showToast('تم إضافة الفئة 2 بنجاح', 'success');
}

function removeCategory2(category) {
    if (!confirm(`هل أنت متأكد من حذف "${category}"؟`)) return;
    
    APP_STATE.categories2 = APP_STATE.categories2.filter(c => c !== category);
    saveSettings();
    renderCategories2List();
    showToast('تم حذف الفئة', 'success');
}

function renderCategories3List() {
    const list = document.getElementById('categories3List');
    if (!list) return;
    
    list.innerHTML = APP_STATE.categories3.map(cat => `
        <div class="flex items-center justify-between bg-pink-50 p-3 rounded-lg">
            <span class="text-gray-700"><i class="fas fa-tags ml-2 text-pink-600"></i>${cat}</span>
            <button onclick="removeCategory3('${cat}')" class="text-red-600 hover:bg-red-100 p-2 rounded-lg">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addCategory3() {
    const input = document.getElementById('newCategory3');
    const category = input.value.trim();
    
    if (!category) {
        showToast('يرجى إدخال الفئة', 'warning');
        return;
    }
    
    if (APP_STATE.categories3.includes(category)) {
        showToast('هذه الفئة موجودة بالفعل', 'warning');
        return;
    }
    
    APP_STATE.categories3.push(category);
    input.value = '';
    saveSettings();
    renderCategories3List();
    populateFilters();
    showToast('تم إضافة الفئة 3 بنجاح', 'success');
}

function removeCategory3(category) {
    if (!confirm(`هل أنت متأكد من حذف "${category}"؟`)) return;
    
    APP_STATE.categories3 = APP_STATE.categories3.filter(c => c !== category);
    saveSettings();
    renderCategories3List();
    showToast('تم حذف الفئة', 'success');
}

// === Asset Locations Management ===
async function loadAssetLocations() {
    try {
        APP_STATE.assetLocations = await dbGetAll(STORES.assetLocations);
    } catch (error) {
        console.error('Error loading asset locations:', error);
        APP_STATE.assetLocations = [];
    }
}

function renderAssetLocationsPage() {
    const grid = document.getElementById('assetLocationsGrid');
    if (!grid) return;
    
    grid.innerHTML = APP_STATE.assetLocations.map(loc => {
        const assetCount = APP_STATE.assets.filter(a => a.location === loc.name).length;
        
        return `
            <div class="bg-white rounded-2xl shadow-lg p-6 border-r-4 border-gov-green">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-green-100 p-3 rounded-xl">
                        <i class="fas fa-map-marker-alt text-2xl text-gov-green"></i>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="editAssetLocation('${loc.id}')" class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteAssetLocation('${loc.id}')" class="p-2 text-red-600 hover:bg-red-100 rounded-lg">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <h4 class="text-lg font-bold text-gray-800 mb-2">${loc.name}</h4>
                <div class="space-y-2 text-sm text-gray-600">
                    <p><i class="fas fa-building ml-2 text-gray-400"></i>${loc.building || 'غير محدد'}</p>
                    <p><i class="fas fa-layer-group ml-2 text-gray-400"></i>${loc.floor || 'غير محدد'}</p>
                    <p><i class="fas fa-boxes ml-2 text-gray-400"></i>${assetCount} أصل</p>
                </div>
            </div>
        `;
    }).join('');
    
    // Update location count in dashboard
    const locCountEl = document.getElementById('totalLocations');
    if (locCountEl) {
        locCountEl.textContent = APP_STATE.assetLocations.length;
    }
}

function openAssetLocationModal(locId = null) {
    const modal = document.getElementById('assetLocationModal');
    const form = document.getElementById('assetLocationForm');
    const title = document.getElementById('assetLocationModalTitle');
    
    form.reset();
    
    if (locId) {
        const loc = APP_STATE.assetLocations.find(l => l.id === locId);
        if (loc) {
            title.textContent = 'تعديل الموقع';
            document.getElementById('assetLocationId').value = loc.id;
            document.getElementById('assetLocationName').value = loc.name || '';
            document.getElementById('assetLocationBuilding').value = loc.building || '';
            document.getElementById('assetLocationFloor').value = loc.floor || '';
            document.getElementById('assetLocationRoom').value = loc.room || '';
            document.getElementById('assetLocationDescription').value = loc.description || '';
        }
    } else {
        title.textContent = 'إضافة موقع جديد';
        document.getElementById('assetLocationId').value = '';
    }
    
    modal.classList.remove('hidden');
}

function closeAssetLocationModal() {
    document.getElementById('assetLocationModal').classList.add('hidden');
}

async function handleAssetLocationSubmit(e) {
    e.preventDefault();
    showLoading();
    
    const locId = document.getElementById('assetLocationId').value;
    const isNew = !locId;
    const finalId = isNew ? generateId() : locId;
    
    const locationData = {
        id: finalId,
        name: document.getElementById('assetLocationName').value,
        building: document.getElementById('assetLocationBuilding').value,
        floor: document.getElementById('assetLocationFloor').value,
        room: document.getElementById('assetLocationRoom').value,
        description: document.getElementById('assetLocationDescription').value,
        updatedAt: Date.now()
    };
    
    try {
        await dbPut(STORES.assetLocations, locationData);
        
        if (isNew) {
            APP_STATE.assetLocations.push(locationData);
            // Add to locations array for dropdowns
            if (!APP_STATE.locations.includes(locationData.name)) {
                APP_STATE.locations.push(locationData.name);
                saveSettings();
            }
        } else {
            const index = APP_STATE.assetLocations.findIndex(l => l.id === locId);
            if (index !== -1) {
                APP_STATE.assetLocations[index] = locationData;
            }
        }
        
        // Log activity
        await logActivity(isNew ? 'إضافة موقع' : 'تعديل موقع', 'location', locationData.name);
        
        showToast(isNew ? 'تم إضافة الموقع بنجاح' : 'تم تحديث الموقع بنجاح', 'success');
        
        closeAssetLocationModal();
        renderAssetLocationsPage();
        populateFilters();
        updateDashboard();
        
    } catch (error) {
        console.error('Error saving location:', error);
        showToast('حدث خطأ أثناء حفظ الموقع', 'error');
    }
    
    hideLoading();
}

function editAssetLocation(locId) {
    openAssetLocationModal(locId);
}

async function deleteAssetLocation(locId) {
    if (!confirm('هل أنت متأكد من حذف هذا الموقع؟')) return;
    
    showLoading();
    
    try {
        const loc = APP_STATE.assetLocations.find(l => l.id === locId);
        await dbDelete(STORES.assetLocations, locId);
        APP_STATE.assetLocations = APP_STATE.assetLocations.filter(l => l.id !== locId);
        
        // Log activity
        if (loc) {
            await logActivity('حذف موقع', 'location', loc.name);
        }
        
        showToast('تم حذف الموقع بنجاح', 'success');
        
        renderAssetLocationsPage();
        updateDashboard();
        
    } catch (error) {
        console.error('Error deleting location:', error);
        showToast('حدث خطأ أثناء حذف الموقع', 'error');
    }
    
    hideLoading();
}

// === Activity Log Functions ===
async function logActivity(action, type, details) {
    const activity = {
        id: generateId(),
        action: action,
        type: type,
        details: details,
        user: APP_STATE.inventoryPerson || 'مستخدم غير معروف',
        timestamp: Date.now()
    };
    
    try {
        await dbPut(STORES.activityLogs, activity);
        APP_STATE.activityLogs.push(activity);
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

async function loadActivityLogs() {
    try {
        APP_STATE.activityLogs = await dbGetAll(STORES.activityLogs);
        // Sort by timestamp descending
        APP_STATE.activityLogs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error('Error loading activity logs:', error);
        APP_STATE.activityLogs = [];
    }
}

function renderActivityLogs() {
    const container = document.getElementById('activityLogsList');
    if (!container) return;
    
    // Filter last month
    const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentLogs = APP_STATE.activityLogs.filter(log => log.timestamp >= oneMonthAgo);
    
    if (recentLogs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-history text-4xl mb-3 opacity-50"></i>
                <p>لا توجد أنشطة في آخر شهر</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentLogs.slice(0, 50).map(log => {
        const date = new Date(log.timestamp);
        const iconClass = getActivityIcon(log.type);
        const colorClass = getActivityColor(log.type);
        
        return `
            <div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div class="p-2 rounded-lg ${colorClass}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="flex-1">
                    <p class="font-semibold text-gray-800">${log.action}</p>
                    <p class="text-sm text-gray-600">${log.details}</p>
                    <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span><i class="fas fa-user ml-1"></i>${log.user}</span>
                        <span><i class="fas fa-clock ml-1"></i>${formatDateTime(date)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getActivityIcon(type) {
    const icons = {
        'asset': 'fa-box',
        'department': 'fa-building',
        'location': 'fa-map-marker-alt',
        'inventory': 'fa-clipboard-check',
        'maintenance': 'fa-wrench',
        'settings': 'fa-cog'
    };
    return icons[type] || 'fa-history';
}

function getActivityColor(type) {
    const colors = {
        'asset': 'bg-blue-100 text-blue-600',
        'department': 'bg-amber-100 text-amber-600',
        'location': 'bg-green-100 text-green-600',
        'inventory': 'bg-purple-100 text-purple-600',
        'maintenance': 'bg-orange-100 text-orange-600',
        'settings': 'bg-gray-100 text-gray-600'
    };
    return colors[type] || 'bg-gray-100 text-gray-600';
}

// === Inventory Operations Edit/Delete ===
function editInventoryLog(logId) {
    const log = APP_STATE.inventoryLogs.find(l => l.id === logId);
    if (!log) return;
    
    document.getElementById('inventoryName').value = log.name;
    document.getElementById('inventoryDepartment').value = log.department || '';
    document.getElementById('inventoryDate').value = log.date;
    
    // Store the ID for editing
    document.getElementById('inventoryForm').dataset.editId = logId;
    
    showToast('يمكنك تعديل البيانات ثم الضغط على بدء الجرد للحفظ', 'info');
}

async function deleteInventoryLog(logId) {
    if (!confirm('هل أنت متأكد من حذف عملية الجرد هذه؟')) return;
    
    showLoading();
    
    try {
        await dbDelete(STORES.inventoryLogs, logId);
        APP_STATE.inventoryLogs = APP_STATE.inventoryLogs.filter(l => l.id !== logId);
        
        // Log activity
        await logActivity('حذف عملية جرد', 'inventory', `حذف الجرد رقم ${logId}`);
        
        showToast('تم حذف عملية الجرد بنجاح', 'success');
        renderInventoryLogs();
        
    } catch (error) {
        console.error('Error deleting inventory log:', error);
        showToast('حدث خطأ أثناء الحذف', 'error');
    }
    
    hideLoading();
}

async function completeInventoryLog(logId) {
    const log = APP_STATE.inventoryLogs.find(l => l.id === logId);
    if (!log) return;
    
    showLoading();
    
    try {
        log.status = 'مكتمل';
        log.completedAt = Date.now();
        log.updatedAt = Date.now();
        
        await dbPut(STORES.inventoryLogs, log);
        
        // Log activity
        await logActivity('إكمال عملية جرد', 'inventory', log.name);
        
        showToast('تم إكمال عملية الجرد بنجاح', 'success');
        renderInventoryLogs();
        
    } catch (error) {
        console.error('Error completing inventory log:', error);
        showToast('حدث خطأ', 'error');
    }
    
    hideLoading();
}

// === Asset Performance Indicator ===
function calculateAssetPerformance() {
    const totalAssets = APP_STATE.assets.length;
    if (totalAssets === 0) return { score: 0, excellent: 0, good: 0, acceptable: 0, maintenance: 0, damaged: 0 };
    
    const excellent = APP_STATE.assets.filter(a => a.condition === 'ممتاز').length;
    const good = APP_STATE.assets.filter(a => a.condition === 'جيد').length;
    const acceptable = APP_STATE.assets.filter(a => a.condition === 'مقبول').length;
    const maintenance = APP_STATE.assets.filter(a => a.condition === 'يحتاج صيانة').length;
    const damaged = APP_STATE.assets.filter(a => a.condition === 'تالف').length;
    
    // Calculate weighted score (100 = all excellent, 0 = all damaged)
    const score = Math.round(
        ((excellent * 100) + (good * 75) + (acceptable * 50) + (maintenance * 25) + (damaged * 0)) / totalAssets
    );
    
    return { score, excellent, good, acceptable, maintenance, damaged, total: totalAssets };
}

function renderAssetPerformanceIndicator() {
    const container = document.getElementById('assetPerformanceIndicator');
    if (!container) return;
    
    const performance = calculateAssetPerformance();
    const scoreColor = performance.score >= 75 ? 'text-green-600' : 
                       performance.score >= 50 ? 'text-yellow-600' : 
                       performance.score >= 25 ? 'text-orange-600' : 'text-red-600';
    const bgColor = performance.score >= 75 ? 'bg-green-500' : 
                    performance.score >= 50 ? 'bg-yellow-500' : 
                    performance.score >= 25 ? 'bg-orange-500' : 'bg-red-500';
    
    container.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div>
                <p class="text-gray-600 text-sm">مؤشر أداء الأصول</p>
                <p class="text-4xl font-bold ${scoreColor}">${performance.score}%</p>
            </div>
            <div class="w-20 h-20 relative">
                <svg class="transform -rotate-90 w-20 h-20">
                    <circle cx="40" cy="40" r="35" stroke="#e5e7eb" stroke-width="8" fill="none"/>
                    <circle cx="40" cy="40" r="35" stroke="currentColor" stroke-width="8" fill="none"
                        stroke-dasharray="${2 * Math.PI * 35}"
                        stroke-dashoffset="${2 * Math.PI * 35 * (1 - performance.score / 100)}"
                        class="${scoreColor}"/>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                    <i class="fas fa-chart-line ${scoreColor} text-xl"></i>
                </div>
            </div>
        </div>
        <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">ممتاز</span>
                <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-green-500" style="width: ${(performance.excellent / performance.total) * 100}%"></div>
                    </div>
                    <span class="font-semibold text-green-600">${performance.excellent}</span>
                </div>
            </div>
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">جيد</span>
                <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500" style="width: ${(performance.good / performance.total) * 100}%"></div>
                    </div>
                    <span class="font-semibold text-blue-600">${performance.good}</span>
                </div>
            </div>
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">مقبول</span>
                <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-yellow-500" style="width: ${(performance.acceptable / performance.total) * 100}%"></div>
                    </div>
                    <span class="font-semibold text-yellow-600">${performance.acceptable}</span>
                </div>
            </div>
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">يحتاج صيانة</span>
                <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-500" style="width: ${(performance.maintenance / performance.total) * 100}%"></div>
                    </div>
                    <span class="font-semibold text-orange-600">${performance.maintenance}</span>
                </div>
            </div>
            <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">تالف</span>
                <div class="flex items-center gap-2">
                    <div class="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-red-500" style="width: ${(performance.damaged / performance.total) * 100}%"></div>
                    </div>
                    <span class="font-semibold text-red-600">${performance.damaged}</span>
                </div>
            </div>
        </div>
    `;
}

// === Add location manually when entering asset ===
function addLocationFromAssetForm() {
    const locationInput = document.getElementById('assetLocationCustom');
    if (!locationInput) return;
    
    const newLocation = locationInput.value.trim();
    if (!newLocation) {
        showToast('يرجى إدخال اسم الموقع', 'warning');
        return;
    }
    
    if (APP_STATE.locations.includes(newLocation)) {
        showToast('هذا الموقع موجود بالفعل', 'warning');
        return;
    }
    
    APP_STATE.locations.push(newLocation);
    saveSettings();
    populateFilters();
    
    // Select the new location in dropdown
    document.getElementById('assetLocation').value = newLocation;
    locationInput.value = '';
    
    showToast('تم إضافة الموقع بنجاح', 'success');
}

// Update showPage to include new pages
const originalShowPage = showPage;
showPage = function(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    if (event && event.target) {
        const navLink = event.target.closest('.nav-link');
        if (navLink) navLink.classList.add('active');
    }
    
    // Update page title
    const titles = {
        'dashboard': 'لوحة التحكم',
        'assets': 'إدارة الأصول',
        'inventory': 'عمليات الجرد',
        'departments': 'الإدارات والأقسام',
        'locations': 'مواقع الأصول',
        'reports': 'التقارير',
        'maintenance': 'الصيانة',
        'settings': 'الإعدادات',
        'activity': 'سجل النشاط'
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
        titleEl.textContent = titles[pageName] || pageName;
    }
    
    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    
    // Page-specific actions
    if (pageName === 'assets') {
        renderAssetsTable();
    } else if (pageName === 'departments') {
        renderDepartments();
    } else if (pageName === 'locations') {
        renderAssetLocationsPage();
    } else if (pageName === 'maintenance') {
        renderMaintenanceTable();
        updateMaintenanceStats();
    } else if (pageName === 'settings') {
        renderCategoriesList();
        renderCategories2List();
        renderCategories3List();
        renderLocationsList();
        renderAssigneesList();
        renderAssetNamesList();
        renderSuppliersList();
        renderStorageInfo();
    } else if (pageName === 'inventory') {
        renderInventoryLogs();
    } else if (pageName === 'activity') {
        renderActivityLogs();
    } else if (pageName === 'dashboard') {
        renderAssetPerformanceIndicator();
    }
};

// Update dashboard to include new stats
const originalUpdateDashboard = updateDashboard;
updateDashboard = function() {
    originalUpdateDashboard();
    
    // Update location count
    const locCountEl = document.getElementById('totalLocations');
    if (locCountEl) {
        locCountEl.textContent = APP_STATE.assetLocations.length || APP_STATE.locations.length;
    }
    
    // Render performance indicator
    renderAssetPerformanceIndicator();
};

// Initialize new data on app start
const originalInitializeApp = initializeApp;
initializeApp = async function() {
    showLoading();
    
    try {
        // Initialize database
        await initDatabase();
        console.log('Database initialized');
        
        // Load settings
        await loadSettings();
        
        // Load activity logs
        await loadActivityLogs();
        
        // Load asset locations
        await loadAssetLocations();
        
        // Set current date
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('ar-SA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
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
        
        // Initialize asset location form handler
        const locForm = document.getElementById('assetLocationForm');
        if (locForm) {
            locForm.addEventListener('submit', handleAssetLocationSubmit);
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('حدث خطأ أثناء تهيئة التطبيق', 'error');
    }
    
    hideLoading();
};
