/**
 * نظام جرد وحصر الأصول الحكومية
 * Government Asset Inventory System
 * Main Application JavaScript
 */

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
    charts: {}
};

// === API Configuration ===
const API_BASE = 'tables';

// === Initialize Application ===
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showLoading();
    
    // Set current date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Load data
    await loadAllData();
    
    // Initialize charts
    initializeCharts();
    
    // Populate filter dropdowns
    populateFilters();
    
    // Update dashboard
    updateDashboard();
    
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
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// === Data Loading ===
async function loadAllData() {
    try {
        // Load assets
        const assetsResponse = await fetch(`${API_BASE}/assets?limit=1000`);
        if (assetsResponse.ok) {
            const assetsData = await assetsResponse.json();
            APP_STATE.assets = assetsData.data || [];
        }
        
        // Load departments
        const deptResponse = await fetch(`${API_BASE}/departments?limit=100`);
        if (deptResponse.ok) {
            const deptData = await deptResponse.json();
            APP_STATE.departments = deptData.data || [];
        }
        
        // Load maintenance records
        const maintResponse = await fetch(`${API_BASE}/maintenance?limit=100`);
        if (maintResponse.ok) {
            const maintData = await maintResponse.json();
            APP_STATE.maintenance = maintData.data || [];
        }
        
        // Load inventory logs
        const invResponse = await fetch(`${API_BASE}/inventory_logs?limit=100`);
        if (invResponse.ok) {
            const invData = await invResponse.json();
            APP_STATE.inventoryLogs = invData.data || [];
        }
        
        // If no data exists, load sample data
        if (APP_STATE.assets.length === 0) {
            await loadSampleData();
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        // Load sample data on error
        loadSampleDataLocally();
    }
}

async function loadSampleData() {
    // Sample departments
    const sampleDepts = [
        { name: 'تقنية المعلومات', location: 'الطابق الثالث', manager: 'أحمد محمد' },
        { name: 'الإدارة المالية', location: 'الطابق الثاني', manager: 'سارة أحمد' },
        { name: 'الموارد البشرية', location: 'الطابق الأول', manager: 'محمد علي' },
        { name: 'النقل والمواصلات', location: 'المبنى الخارجي', manager: 'عبدالله خالد' },
        { name: 'الخدمات الطبية', location: 'المبنى الطبي', manager: 'نورة سعد' }
    ];
    
    for (const dept of sampleDepts) {
        try {
            const response = await fetch(`${API_BASE}/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dept)
            });
            if (response.ok) {
                const newDept = await response.json();
                APP_STATE.departments.push(newDept);
            }
        } catch (e) {
            console.error('Error adding department:', e);
        }
    }
    
    // Sample assets
    const sampleAssets = [
        {
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
            notes: 'جهاز حديث بمواصفات عالية - Core i7'
        },
        {
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
            notes: 'طابعة شبكية للمكتب'
        },
        {
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
            notes: 'مكتب خشب طبيعي مع أدراج'
        },
        {
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
            notes: 'صيانة دورية منتظمة - موديل 2022'
        },
        {
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
            notes: 'جهاز رقمي دقيق'
        },
        {
            name: 'مكيف سبليت LG 24000 وحدة',
            code: 'ELC-2023-025',
            category: 'أجهزة كهربائية',
            location: 'الطابق الثاني - قاعة الاجتماعات',
            department: 'الإدارة المالية',
            purchaseDate: '2023-06-15',
            purchasePrice: 3500,
            currentValue: 3000,
            condition: 'جيد',
            serialNumber: 'LG-2023-AC-222',
            supplier: 'شركة التكييف والتبريد',
            warranty: '2025-06-15',
            assignee: '',
            notes: 'يحتاج تنظيف دوري'
        },
        {
            name: 'كرسي مكتب دوار',
            code: 'FRN-2024-078',
            category: 'أثاث',
            location: 'الطابق الأول - قسم الموارد البشرية',
            department: 'الموارد البشرية',
            purchaseDate: '2024-01-20',
            purchasePrice: 650,
            currentValue: 600,
            condition: 'ممتاز',
            serialNumber: 'CH-2024-333',
            supplier: 'مؤسسة الأثاث المكتبي',
            warranty: '2026-01-20',
            assignee: 'موظف الاستقبال',
            notes: 'كرسي مريح مع مسند للظهر'
        },
        {
            name: 'جهاز عرض Epson Projector',
            code: 'IT-2023-089',
            category: 'معدات إلكترونية',
            location: 'قاعة التدريب',
            department: 'الموارد البشرية',
            purchaseDate: '2023-09-10',
            purchasePrice: 4200,
            currentValue: 3500,
            condition: 'يحتاج صيانة',
            serialNumber: 'EP-2023-PRJ-444',
            supplier: 'شركة الأجهزة المرئية',
            warranty: '2025-09-10',
            assignee: '',
            notes: 'يحتاج تغيير لمبة العرض'
        },
        {
            name: 'خزانة ملفات معدنية',
            code: 'FRN-2022-156',
            category: 'معدات مكتبية',
            location: 'الطابق الثاني - غرفة الأرشيف',
            department: 'الإدارة المالية',
            purchaseDate: '2022-04-05',
            purchasePrice: 1200,
            currentValue: 900,
            condition: 'مقبول',
            serialNumber: 'FC-2022-555',
            supplier: 'مصنع المعدات المكتبية',
            warranty: '',
            assignee: '',
            notes: 'تحتاج صيانة للأقفال'
        },
        {
            name: 'سيارة هيونداي سوناتا 2023',
            code: 'VEH-2023-015',
            category: 'مركبات',
            location: 'موقف السيارات الرئيسي',
            department: 'النقل والمواصلات',
            purchaseDate: '2023-03-20',
            purchasePrice: 85000,
            currentValue: 72000,
            condition: 'ممتاز',
            serialNumber: 'HY-2023-SON-666',
            supplier: 'وكيل هيونداي',
            warranty: '2026-03-20',
            assignee: 'قسم النقل',
            notes: 'سيارة جديدة للمهام الرسمية'
        }
    ];
    
    for (const asset of sampleAssets) {
        try {
            const response = await fetch(`${API_BASE}/assets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(asset)
            });
            if (response.ok) {
                const newAsset = await response.json();
                APP_STATE.assets.push(newAsset);
            }
        } catch (e) {
            console.error('Error adding asset:', e);
        }
    }
}

function loadSampleDataLocally() {
    // Fallback local data if API fails
    APP_STATE.departments = [
        { id: '1', name: 'تقنية المعلومات', location: 'الطابق الثالث', manager: 'أحمد محمد' },
        { id: '2', name: 'الإدارة المالية', location: 'الطابق الثاني', manager: 'سارة أحمد' },
        { id: '3', name: 'الموارد البشرية', location: 'الطابق الأول', manager: 'محمد علي' },
        { id: '4', name: 'النقل والمواصلات', location: 'المبنى الخارجي', manager: 'عبدالله خالد' },
        { id: '5', name: 'الخدمات الطبية', location: 'المبنى الطبي', manager: 'نورة سعد' }
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
            notes: 'جهاز حديث بمواصفات عالية'
        },
        {
            id: '2',
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
            notes: 'مكتب خشب طبيعي'
        },
        {
            id: '3',
            name: 'سيارة تويوتا كامري',
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
            notes: 'صيانة دورية منتظمة'
        }
    ];
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
    
    APP_STATE.categories.forEach(cat => {
        categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
        assetCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    
    // Condition filter
    const conditionFilter = document.getElementById('conditionFilter');
    APP_STATE.conditions.forEach(cond => {
        conditionFilter.innerHTML += `<option value="${cond}">${cond}</option>`;
    });
    
    // Department filters
    const departmentFilter = document.getElementById('departmentFilter');
    const assetDepartment = document.getElementById('assetDepartment');
    const inventoryDepartment = document.getElementById('inventoryDepartment');
    const parentDepartment = document.getElementById('parentDepartment');
    
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
            (asset.department && asset.department.toLowerCase().includes(searchTerm));
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
    html += `<button class="pagination-btn" onclick="goToPage(${APP_STATE.currentPage + 1})" ${APP_STATE.currentPage === totalPages ? 'disabled' : ''}>
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
    const assetData = {
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
        notes: document.getElementById('assetNotes').value,
        images: APP_STATE.uploadedImages
    };
    
    try {
        if (assetId) {
            // Update existing asset
            const response = await fetch(`${API_BASE}/assets/${assetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assetData)
            });
            
            if (response.ok) {
                const updatedAsset = await response.json();
                const index = APP_STATE.assets.findIndex(a => a.id === assetId);
                if (index !== -1) {
                    APP_STATE.assets[index] = updatedAsset;
                }
                showToast('تم تحديث الأصل بنجاح', 'success');
            }
        } else {
            // Create new asset
            const response = await fetch(`${API_BASE}/assets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assetData)
            });
            
            if (response.ok) {
                const newAsset = await response.json();
                APP_STATE.assets.push(newAsset);
                showToast('تم إضافة الأصل بنجاح', 'success');
            }
        }
        
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
        await fetch(`${API_BASE}/assets/${assetId}`, {
            method: 'DELETE'
        });
        
        APP_STATE.assets = APP_STATE.assets.filter(a => a.id !== assetId);
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
    const infoSpan = document.getElementById('scannedAssetInfo');
    
    if (asset) {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-xl';
        resultDiv.innerHTML = `
            <p class="text-green-700 font-semibold"><i class="fas fa-check-circle ml-2"></i>تم التعرف على الأصل</p>
            <p class="text-gray-600 mt-1">${asset.code} - ${asset.name}</p>
            <button onclick="viewAssetDetails('${asset.id}')" class="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
                عرض التفاصيل
            </button>
        `;
    } else {
        resultDiv.classList.remove('hidden');
        resultDiv.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-xl';
        resultDiv.innerHTML = `
            <p class="text-red-700 font-semibold"><i class="fas fa-times-circle ml-2"></i>لم يتم التعرف على الأصل</p>
            <p class="text-gray-600 mt-1">الكود: ${code}</p>
        `;
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
    const deptData = {
        name: document.getElementById('departmentName').value,
        parent: document.getElementById('parentDepartment').value,
        location: document.getElementById('departmentLocation').value,
        manager: document.getElementById('departmentManager').value
    };
    
    try {
        if (deptId) {
            const response = await fetch(`${API_BASE}/departments/${deptId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deptData)
            });
            
            if (response.ok) {
                const updatedDept = await response.json();
                const index = APP_STATE.departments.findIndex(d => d.id === deptId);
                if (index !== -1) {
                    APP_STATE.departments[index] = updatedDept;
                }
                showToast('تم تحديث الإدارة بنجاح', 'success');
            }
        } else {
            const response = await fetch(`${API_BASE}/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deptData)
            });
            
            if (response.ok) {
                const newDept = await response.json();
                APP_STATE.departments.push(newDept);
                showToast('تم إضافة الإدارة بنجاح', 'success');
            }
        }
        
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
        await fetch(`${API_BASE}/departments/${deptId}`, {
            method: 'DELETE'
        });
        
        APP_STATE.departments = APP_STATE.departments.filter(d => d.id !== deptId);
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
        assetId: assetId,
        assetName: asset ? asset.name : '',
        assetCode: asset ? asset.code : '',
        type: document.getElementById('maintenanceType').value,
        priority: document.getElementById('maintenancePriority').value,
        description: document.getElementById('maintenanceDescription').value,
        status: 'قيد الانتظار',
        requestDate: new Date().toISOString().split('T')[0],
        cost: 0
    };
    
    try {
        const response = await fetch(`${API_BASE}/maintenance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(maintenanceData)
        });
        
        if (response.ok) {
            const newMaintenance = await response.json();
            APP_STATE.maintenance.push(newMaintenance);
            showToast('تم إرسال طلب الصيانة بنجاح', 'success');
        }
        
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
        const response = await fetch(`${API_BASE}/maintenance/${maintId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            const index = APP_STATE.maintenance.findIndex(m => m.id === maintId);
            if (index !== -1) {
                APP_STATE.maintenance[index].status = newStatus;
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
        name: document.getElementById('inventoryName').value,
        department: document.getElementById('inventoryDepartment').value,
        date: document.getElementById('inventoryDate').value,
        status: 'جاري',
        assetsCount: 0,
        createdAt: new Date().toISOString()
    };
    
    try {
        const response = await fetch(`${API_BASE}/inventory_logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inventoryData)
        });
        
        if (response.ok) {
            const newLog = await response.json();
            APP_STATE.inventoryLogs.push(newLog);
            showToast('تم بدء عملية الجرد بنجاح', 'success');
            document.getElementById('inventoryForm').reset();
            document.getElementById('inventoryDate').valueAsDate = new Date();
            renderInventoryLogs();
        }
        
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
                <button onclick="printReport()" class="bg-gov-blue text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-print ml-2"></i>طباعة
                </button>
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
            
            <h4 class="text-lg font-semibold text-gray-800 mb-4">أصول تالفة</h4>
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الكود</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">الأصل</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">القسم</th>
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">القيمة</th>
                    </tr>
                </thead>
                <tbody>
                    ${damaged.map(asset => `
                        <tr class="border-b">
                            <td class="py-3 px-4 text-blue-600">${asset.code}</td>
                            <td class="py-3 px-4">${asset.name}</td>
                            <td class="py-3 px-4">${asset.department || '-'}</td>
                            <td class="py-3 px-4">${formatCurrency(asset.currentValue)}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="4" class="py-4 text-center text-gray-500">لا توجد أصول تالفة</td></tr>'}
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
                        <th class="text-right py-3 px-4 font-semibold text-gray-700">عدد الأصول</th>
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
                            <td class="py-3 px-4">${log.assetsCount}</td>
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
    renderCategoriesList();
    populateFilters();
    showToast('تم إضافة الفئة بنجاح', 'success');
}

function removeCategory(category) {
    if (!confirm(`هل أنت متأكد من حذف الفئة "${category}"؟`)) return;
    
    APP_STATE.categories = APP_STATE.categories.filter(c => c !== category);
    renderCategoriesList();
    showToast('تم حذف الفئة', 'success');
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

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.assets) {
                for (const asset of data.assets) {
                    await fetch(`${API_BASE}/assets`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(asset)
                    });
                }
            }
            
            if (data.departments) {
                for (const dept of data.departments) {
                    await fetch(`${API_BASE}/departments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dept)
                    });
                }
            }
            
            await loadAllData();
            updateDashboard();
            showToast('تم استيراد البيانات بنجاح', 'success');
            
        } catch (error) {
            console.error('Import error:', error);
            showToast('حدث خطأ أثناء استيراد البيانات', 'error');
        }
    };
    reader.readAsText(file);
}

// === Helper Functions ===
function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('ar-SA') + ' ر.س';
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
