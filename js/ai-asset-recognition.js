/**
 * نظام التعرف على الأصول بالذكاء الاصطناعي
 * AI Asset Recognition System
 * Version 1.0.0
 */

// === AI Configuration ===
const AI_CONFIG = {
    // سيتم تعيين مفتاح API من قبل المستخدم
    apiKey: '',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    maxImages: 5,
    maxImageSize: 4 * 1024 * 1024, // 4MB
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
};

// === AI State ===
const AI_STATE = {
    capturedImages: [],
    analyzedData: null,
    isAnalyzing: false,
    currentStep: 1
};

/**
 * تهيئة إعدادات الذكاء الاصطناعي
 */
async function initializeAISettings() {
    try {
        const savedApiKey = await dbGet(STORES.settings, 'ai_api_key');
        if (savedApiKey && savedApiKey.value) {
            AI_CONFIG.apiKey = savedApiKey.value;
        }
        
        const savedModel = await dbGet(STORES.settings, 'ai_model');
        if (savedModel && savedModel.value) {
            AI_CONFIG.model = savedModel.value;
        }
    } catch (error) {
        console.log('No AI settings found, using defaults');
    }
}

/**
 * حفظ إعدادات الذكاء الاصطناعي
 */
async function saveAISettings() {
    try {
        await dbPut(STORES.settings, { key: 'ai_api_key', value: AI_CONFIG.apiKey });
        await dbPut(STORES.settings, { key: 'ai_model', value: AI_CONFIG.model });
        showToast('تم حفظ إعدادات الذكاء الاصطناعي بنجاح', 'success');
    } catch (error) {
        console.error('Error saving AI settings:', error);
        showToast('خطأ في حفظ الإعدادات', 'error');
    }
}

/**
 * فتح نافذة الإضافة بالذكاء الاصطناعي
 */
function openAIAssetModal() {
    // التحقق من وجود مفتاح API
    if (!AI_CONFIG.apiKey) {
        showAISetupPrompt();
        return;
    }
    
    const modal = document.getElementById('aiAssetModal');
    if (!modal) {
        console.error('AI Modal not found');
        return;
    }
    
    // إعادة تعيين الحالة
    AI_STATE.capturedImages = [];
    AI_STATE.analyzedData = null;
    AI_STATE.isAnalyzing = false;
    AI_STATE.currentStep = 1;
    
    // إعادة تعيين واجهة المستخدم
    resetAIModalUI();
    
    modal.classList.remove('hidden');
}

/**
 * إغلاق نافذة الإضافة بالذكاء الاصطناعي
 */
function closeAIAssetModal() {
    const modal = document.getElementById('aiAssetModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // إيقاف الكاميرا إذا كانت تعمل
    stopAICamera();
    
    // إعادة تعيين الحالة
    AI_STATE.capturedImages = [];
    AI_STATE.analyzedData = null;
    AI_STATE.isAnalyzing = false;
}

/**
 * إعادة تعيين واجهة نافذة الذكاء الاصطناعي
 */
function resetAIModalUI() {
    // إظهار خطوة التقاط الصور
    showAIStep(1);
    
    // مسح معاينة الصور
    const previewContainer = document.getElementById('aiImagePreviewContainer');
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    
    // إخفاء نتائج التحليل
    const resultsContainer = document.getElementById('aiAnalysisResults');
    if (resultsContainer) {
        resultsContainer.classList.add('hidden');
    }
    
    // تحديث عداد الصور
    updateAIImageCounter();
}

/**
 * عرض خطوة معينة في النافذة
 */
function showAIStep(stepNumber) {
    AI_STATE.currentStep = stepNumber;
    
    // إخفاء جميع الخطوات
    document.querySelectorAll('.ai-step').forEach(step => {
        step.classList.add('hidden');
    });
    
    // إظهار الخطوة المحددة
    const currentStep = document.getElementById(`aiStep${stepNumber}`);
    if (currentStep) {
        currentStep.classList.remove('hidden');
    }
    
    // تحديث مؤشر الخطوات
    updateStepIndicator(stepNumber);
}

/**
 * تحديث مؤشر الخطوات
 */
function updateStepIndicator(currentStep) {
    for (let i = 1; i <= 3; i++) {
        const indicator = document.getElementById(`stepIndicator${i}`);
        if (indicator) {
            if (i < currentStep) {
                indicator.classList.remove('bg-gray-300', 'bg-blue-600');
                indicator.classList.add('bg-green-500');
            } else if (i === currentStep) {
                indicator.classList.remove('bg-gray-300', 'bg-green-500');
                indicator.classList.add('bg-blue-600');
            } else {
                indicator.classList.remove('bg-blue-600', 'bg-green-500');
                indicator.classList.add('bg-gray-300');
            }
        }
    }
}

/**
 * تشغيل الكاميرا لالتقاط الصور
 */
async function startAICamera() {
    const video = document.getElementById('aiCameraVideo');
    const cameraContainer = document.getElementById('aiCameraContainer');
    
    if (!video || !cameraContainer) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        });
        
        video.srcObject = stream;
        cameraContainer.classList.remove('hidden');
        
        // إخفاء أزرار الإدخال الأخرى
        document.getElementById('aiInputOptions')?.classList.add('hidden');
        
    } catch (error) {
        console.error('Camera access error:', error);
        showToast('لا يمكن الوصول إلى الكاميرا. تأكد من منح الإذن.', 'error');
    }
}

/**
 * إيقاف الكاميرا
 */
function stopAICamera() {
    const video = document.getElementById('aiCameraVideo');
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }
    
    const cameraContainer = document.getElementById('aiCameraContainer');
    if (cameraContainer) {
        cameraContainer.classList.add('hidden');
    }
    
    // إظهار أزرار الإدخال
    document.getElementById('aiInputOptions')?.classList.remove('hidden');
}

/**
 * التقاط صورة من الكاميرا
 */
function captureAIPhoto() {
    const video = document.getElementById('aiCameraVideo');
    if (!video) return;
    
    if (AI_STATE.capturedImages.length >= AI_CONFIG.maxImages) {
        showToast(`الحد الأقصى هو ${AI_CONFIG.maxImages} صور`, 'warning');
        return;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    addAICapturedImage(imageData);
    
    // تأثير الفلاش
    showCaptureFlash();
}

/**
 * إضافة صورة ملتقطة
 */
function addAICapturedImage(imageData) {
    AI_STATE.capturedImages.push({
        id: generateId(),
        data: imageData,
        timestamp: Date.now()
    });
    
    renderAIImagePreviews();
    updateAIImageCounter();
}

/**
 * عرض معاينات الصور
 */
function renderAIImagePreviews() {
    const container = document.getElementById('aiImagePreviewContainer');
    if (!container) return;
    
    container.innerHTML = AI_STATE.capturedImages.map((img, index) => `
        <div class="relative group">
            <img src="${img.data}" alt="صورة ${index + 1}" 
                 class="w-24 h-24 object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-500 transition-all"
                 onclick="previewAIImage('${img.id}')">
            <button onclick="removeAICapturedImage('${img.id}')" 
                    class="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm">
                <i class="fas fa-times"></i>
            </button>
            <span class="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1 rounded">${index + 1}</span>
        </div>
    `).join('');
}

/**
 * حذف صورة ملتقطة
 */
function removeAICapturedImage(imageId) {
    AI_STATE.capturedImages = AI_STATE.capturedImages.filter(img => img.id !== imageId);
    renderAIImagePreviews();
    updateAIImageCounter();
}

/**
 * معاينة صورة بحجم كامل
 */
function previewAIImage(imageId) {
    const image = AI_STATE.capturedImages.find(img => img.id === imageId);
    if (!image) return;
    
    // إنشاء نافذة معاينة
    const previewModal = document.createElement('div');
    previewModal.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4';
    previewModal.onclick = () => previewModal.remove();
    previewModal.innerHTML = `
        <img src="${image.data}" class="max-w-full max-h-full object-contain rounded-lg">
        <button class="absolute top-4 right-4 text-white text-3xl hover:text-gray-300">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(previewModal);
}

/**
 * تحديث عداد الصور
 */
function updateAIImageCounter() {
    const counter = document.getElementById('aiImageCounter');
    if (counter) {
        counter.textContent = `${AI_STATE.capturedImages.length} / ${AI_CONFIG.maxImages}`;
    }
    
    // تفعيل/تعطيل زر التحليل
    const analyzeBtn = document.getElementById('aiAnalyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.disabled = AI_STATE.capturedImages.length === 0;
        analyzeBtn.classList.toggle('opacity-50', AI_STATE.capturedImages.length === 0);
    }
}

/**
 * تأثير الفلاش عند الالتقاط
 */
function showCaptureFlash() {
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-white z-[100] pointer-events-none';
    flash.style.animation = 'flash 0.3s ease-out';
    document.body.appendChild(flash);
    
    setTimeout(() => flash.remove(), 300);
}

/**
 * رفع صور من الجهاز
 */
function triggerAIFileUpload() {
    const input = document.getElementById('aiFileInput');
    if (input) {
        input.click();
    }
}

/**
 * معالجة الملفات المرفوعة
 */
function handleAIFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const remainingSlots = AI_CONFIG.maxImages - AI_STATE.capturedImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    filesToProcess.forEach(file => {
        if (!AI_CONFIG.supportedFormats.includes(file.type)) {
            showToast(`صيغة الملف ${file.name} غير مدعومة`, 'warning');
            return;
        }
        
        if (file.size > AI_CONFIG.maxImageSize) {
            showToast(`الملف ${file.name} كبير جداً (الحد الأقصى 4MB)`, 'warning');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            addAICapturedImage(e.target.result);
        };
        reader.readAsDataURL(file);
    });
    
    // مسح قيمة الإدخال للسماح برفع نفس الملف مرة أخرى
    event.target.value = '';
}

/**
 * بدء تحليل الصور بالذكاء الاصطناعي
 */
async function analyzeAssetImages() {
    if (AI_STATE.capturedImages.length === 0) {
        showToast('الرجاء التقاط أو رفع صورة واحدة على الأقل', 'warning');
        return;
    }
    
    if (!AI_CONFIG.apiKey) {
        showAISetupPrompt();
        return;
    }
    
    AI_STATE.isAnalyzing = true;
    showAIStep(2);
    
    const progressBar = document.getElementById('aiProgressBar');
    const statusText = document.getElementById('aiStatusText');
    
    try {
        // تحديث حالة التحليل
        updateAnalysisProgress(10, 'جاري تحضير الصور...');
        
        // تحضير الصور للإرسال
        const imageContents = AI_STATE.capturedImages.map(img => ({
            type: 'image_url',
            image_url: {
                url: img.data,
                detail: 'high'
            }
        }));
        
        updateAnalysisProgress(30, 'جاري إرسال الصور للتحليل...');
        
        // إنشاء الطلب للذكاء الاصطناعي
        const prompt = buildAnalysisPrompt();
        
        const response = await fetch(AI_CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_CONFIG.apiKey}`
            },
            body: JSON.stringify({
                model: AI_CONFIG.model,
                messages: [
                    {
                        role: 'system',
                        content: getSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            ...imageContents
                        ]
                    }
                ],
                max_tokens: 2000,
                temperature: 0.3
            })
        });
        
        updateAnalysisProgress(70, 'جاري تحليل البيانات...');
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `خطأ في الاتصال: ${response.status}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0]?.message?.content;
        
        if (!aiResponse) {
            throw new Error('لم يتم الحصول على رد من الذكاء الاصطناعي');
        }
        
        updateAnalysisProgress(90, 'جاري معالجة النتائج...');
        
        // تحليل الرد
        const analyzedData = parseAIResponse(aiResponse);
        AI_STATE.analyzedData = analyzedData;
        
        updateAnalysisProgress(100, 'تم التحليل بنجاح!');
        
        // الانتقال لخطوة المراجعة
        setTimeout(() => {
            showAIStep(3);
            displayAnalysisResults(analyzedData);
        }, 500);
        
    } catch (error) {
        console.error('Analysis error:', error);
        AI_STATE.isAnalyzing = false;
        
        showToast(`خطأ في التحليل: ${error.message}`, 'error');
        showAIStep(1);
    }
}

/**
 * تحديث شريط التقدم
 */
function updateAnalysisProgress(percent, text) {
    const progressBar = document.getElementById('aiProgressBar');
    const statusText = document.getElementById('aiStatusText');
    
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    if (statusText) {
        statusText.textContent = text;
    }
}

/**
 * بناء طلب التحليل
 */
function buildAnalysisPrompt() {
    // الحصول على التصنيفات المتاحة
    const categories = APP_STATE.categories || [];
    const categories2 = APP_STATE.categories2 || [];
    const categories3 = APP_STATE.categories3 || [];
    const conditions = APP_STATE.conditions || ['ممتاز', 'جيد', 'مقبول', 'يحتاج صيانة', 'تالف'];
    const departments = APP_STATE.departments?.map(d => d.name) || [];
    const locations = APP_STATE.locations || [];
    const buildings = APP_STATE.buildings || [];
    const floors = APP_STATE.floors || [];
    
    return `
قم بتحليل هذه الصور للأصل/الأصول الحكومية وحدد المعلومات التالية:

## التصنيفات المتاحة:
- **الفئة الرئيسية (category)**: ${categories.join('، ')}
- **الفئة الفرعية (category2)**: ${categories2.join('، ')}
- **الفئة التفصيلية (category3)**: ${categories3.join('، ')}
- **حالة الأصل (condition)**: ${conditions.join('، ')}
- **الإدارات المتاحة (department)**: ${departments.length > 0 ? departments.join('، ') : 'غير محدد'}
- **المواقع المتاحة (location)**: ${locations.join('، ')}
- **المباني (building)**: ${buildings.join('، ')}
- **الطوابق (floor)**: ${floors.join('، ')}

## المطلوب:
1. حدد نوع الأصل وصنفه ضمن الفئات المتاحة أعلاه
2. اقترح اسماً وصفياً مناسباً للأصل بالعربية
3. حدد حالة الأصل بناءً على مظهره في الصور
4. إذا ظهرت أي علامات تجارية أو أرقام تسلسلية، حددها
5. قدّر العمر التقريبي للأصل إن أمكن
6. اذكر أي ملاحظات مهمة

## صيغة الرد (JSON فقط):
{
    "name": "اسم الأصل المقترح",
    "category": "الفئة الرئيسية من القائمة",
    "category2": "الفئة الفرعية من القائمة",
    "category3": "الفئة التفصيلية من القائمة",
    "condition": "حالة الأصل من القائمة",
    "brand": "العلامة التجارية إن وجدت",
    "model": "الموديل إن وجد",
    "serialNumber": "الرقم التسلسلي إن ظهر",
    "color": "اللون الرئيسي",
    "material": "المادة المصنوع منها",
    "estimatedAge": "العمر التقريبي بالسنوات",
    "dimensions": "الأبعاد التقريبية إن أمكن",
    "features": ["ميزة 1", "ميزة 2"],
    "notes": "ملاحظات إضافية",
    "confidence": 85,
    "suggestedDepartment": "الإدارة المقترحة",
    "suggestedLocation": "الموقع المقترح"
}

أجب بتنسيق JSON فقط بدون أي نص إضافي.
`;
}

/**
 * الحصول على System Prompt
 */
function getSystemPrompt() {
    return `أنت خبير في تصنيف وتحديد الأصول الحكومية والمكتبية. 
مهمتك هي تحليل صور الأصول وتصنيفها بدقة.
- استخدم التصنيفات المتاحة فقط
- إذا لم تجد تصنيفاً مناسباً، اختر "أخرى"
- كن دقيقاً في تحديد حالة الأصل
- اذكر أي معلومات مرئية مثل الأرقام التسلسلية أو العلامات التجارية
- أجب دائماً بتنسيق JSON فقط`;
}

/**
 * تحليل رد الذكاء الاصطناعي
 */
function parseAIResponse(response) {
    try {
        // محاولة استخراج JSON من الرد
        let jsonStr = response;
        
        // إذا كان الرد يحتوي على نص إضافي، حاول استخراج JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonStr = jsonMatch[0];
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // التحقق من البيانات وتنظيفها
        return {
            name: parsed.name || 'أصل غير محدد',
            category: validateCategory(parsed.category, APP_STATE.categories),
            category2: validateCategory(parsed.category2, APP_STATE.categories2),
            category3: validateCategory(parsed.category3, APP_STATE.categories3),
            condition: validateCategory(parsed.condition, APP_STATE.conditions),
            brand: parsed.brand || '',
            model: parsed.model || '',
            serialNumber: parsed.serialNumber || '',
            color: parsed.color || '',
            material: parsed.material || '',
            estimatedAge: parsed.estimatedAge || '',
            dimensions: parsed.dimensions || '',
            features: Array.isArray(parsed.features) ? parsed.features : [],
            notes: parsed.notes || '',
            confidence: Math.min(100, Math.max(0, parsed.confidence || 70)),
            suggestedDepartment: parsed.suggestedDepartment || '',
            suggestedLocation: parsed.suggestedLocation || ''
        };
        
    } catch (error) {
        console.error('Error parsing AI response:', error);
        // إرجاع بيانات افتراضية في حالة الخطأ
        return {
            name: 'أصل غير محدد',
            category: 'أخرى',
            category2: 'أخرى',
            category3: 'أخرى',
            condition: 'جيد',
            confidence: 50,
            notes: 'لم يتمكن النظام من تحليل الصورة بشكل كامل. يرجى إدخال البيانات يدوياً.',
            rawResponse: response
        };
    }
}

/**
 * التحقق من صحة التصنيف
 */
function validateCategory(value, validOptions) {
    if (!value || !validOptions || validOptions.length === 0) {
        return validOptions?.[validOptions.length - 1] || 'أخرى';
    }
    
    // البحث عن تطابق تام
    if (validOptions.includes(value)) {
        return value;
    }
    
    // البحث عن تطابق جزئي
    const match = validOptions.find(opt => 
        opt.includes(value) || value.includes(opt)
    );
    
    return match || validOptions[validOptions.length - 1] || 'أخرى';
}

/**
 * عرض نتائج التحليل
 */
function displayAnalysisResults(data) {
    const container = document.getElementById('aiAnalysisResults');
    if (!container) return;
    
    container.classList.remove('hidden');
    
    // تعبئة الحقول بالبيانات المستخرجة
    setFieldValue('aiResultName', data.name);
    setFieldValue('aiResultCategory', data.category);
    setFieldValue('aiResultCategory2', data.category2);
    setFieldValue('aiResultCategory3', data.category3);
    setFieldValue('aiResultCondition', data.condition);
    setFieldValue('aiResultSerial', data.serialNumber);
    setFieldValue('aiResultBrand', data.brand);
    setFieldValue('aiResultModel', data.model);
    setFieldValue('aiResultNotes', buildNotesText(data));
    
    // عرض نسبة الثقة
    const confidenceEl = document.getElementById('aiConfidenceLevel');
    if (confidenceEl) {
        confidenceEl.textContent = `${data.confidence}%`;
        confidenceEl.className = `font-bold ${data.confidence >= 80 ? 'text-green-600' : data.confidence >= 60 ? 'text-yellow-600' : 'text-red-600'}`;
    }
    
    // عرض الميزات المكتشفة
    const featuresContainer = document.getElementById('aiDetectedFeatures');
    if (featuresContainer && data.features && data.features.length > 0) {
        featuresContainer.innerHTML = data.features.map(f => 
            `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">${f}</span>`
        ).join('');
    }
    
    // عرض معاينة الصور
    renderAIResultImages();
}

/**
 * تعيين قيمة حقل
 */
function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = value || '';
    }
}

/**
 * بناء نص الملاحظات
 */
function buildNotesText(data) {
    let notes = [];
    
    if (data.color) notes.push(`اللون: ${data.color}`);
    if (data.material) notes.push(`المادة: ${data.material}`);
    if (data.estimatedAge) notes.push(`العمر التقريبي: ${data.estimatedAge}`);
    if (data.dimensions) notes.push(`الأبعاد: ${data.dimensions}`);
    if (data.notes) notes.push(data.notes);
    
    return notes.join('\n');
}

/**
 * عرض الصور في نتائج التحليل
 */
function renderAIResultImages() {
    const container = document.getElementById('aiResultImagesPreview');
    if (!container) return;
    
    container.innerHTML = AI_STATE.capturedImages.map((img, index) => `
        <img src="${img.data}" alt="صورة ${index + 1}" 
             class="w-20 h-20 object-cover rounded-lg border-2 border-gray-200">
    `).join('');
}

/**
 * حفظ الأصل من نتائج الذكاء الاصطناعي
 */
async function saveAIAnalyzedAsset() {
    showLoading();
    
    try {
        const assetId = generateId();
        
        // جمع البيانات من الحقول
        const assetName = document.getElementById('aiResultName')?.value || 'أصل جديد';
        const supplierName = document.getElementById('aiResultSupplier')?.value || '';
        
        // حفظ اسم الأصل الجديد
        if (assetName && !APP_STATE.assetNames.includes(assetName)) {
            APP_STATE.assetNames.push(assetName);
        }
        
        // حفظ المورد الجديد
        if (supplierName && !APP_STATE.suppliers.includes(supplierName)) {
            APP_STATE.suppliers.push(supplierName);
        }
        
        const assetData = {
            id: assetId,
            name: assetName,
            code: document.getElementById('aiResultCode')?.value || generateAssetCode(),
            category: document.getElementById('aiResultCategory')?.value || 'أخرى',
            category2: document.getElementById('aiResultCategory2')?.value || '',
            category3: document.getElementById('aiResultCategory3')?.value || '',
            serialNumber: document.getElementById('aiResultSerial')?.value || '',
            department: document.getElementById('aiResultDepartment')?.value || '',
            building: document.getElementById('aiResultBuilding')?.value || '',
            floor: document.getElementById('aiResultFloor')?.value || '',
            room: document.getElementById('aiResultRoom')?.value || '',
            location: document.getElementById('aiResultLocation')?.value || '',
            purchasePrice: parseFloat(document.getElementById('aiResultPrice')?.value) || 0,
            currentValue: parseFloat(document.getElementById('aiResultCurrentValue')?.value) || 0,
            purchaseDate: document.getElementById('aiResultPurchaseDate')?.value || '',
            condition: document.getElementById('aiResultCondition')?.value || 'جيد',
            supplier: supplierName,
            warranty: document.getElementById('aiResultWarranty')?.value || '',
            assignee: document.getElementById('aiResultAssignee')?.value || '',
            inventoryPerson: APP_STATE.inventoryPerson || '',
            lastInventoryDate: new Date().toISOString().split('T')[0],
            technicalData: document.getElementById('aiResultTechnicalData')?.value || '',
            notes: document.getElementById('aiResultNotes')?.value || '',
            images: AI_STATE.capturedImages.map(img => img.data),
            aiAnalyzed: true,
            aiConfidence: AI_STATE.analyzedData?.confidence || 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // حفظ في قاعدة البيانات المحلية
        await dbPut(STORES.assets, assetData);
        
        // إضافة للحالة
        APP_STATE.assets.push(assetData);
        
        // مزامنة مع الخادم
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
        
        // تسجيل النشاط
        await logActivity('create', 'asset', assetId, `إضافة أصل جديد بالذكاء الاصطناعي: ${assetName}`);
        
        // تحديث الإعدادات
        await saveSettings();
        
        // تحديث الواجهة
        renderAssetsList();
        updateDashboard();
        
        hideLoading();
        showToast('تم حفظ الأصل بنجاح', 'success');
        closeAIAssetModal();
        
    } catch (error) {
        console.error('Error saving AI asset:', error);
        hideLoading();
        showToast('خطأ في حفظ الأصل', 'error');
    }
}

/**
 * توليد رمز للأصل
 */
function generateAssetCode() {
    const prefix = 'AST';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * إعادة التحليل
 */
function retryAIAnalysis() {
    showAIStep(1);
}

/**
 * عرض نافذة إعداد الذكاء الاصطناعي
 */
function showAISetupPrompt() {
    const existingModal = document.getElementById('aiSetupModal');
    if (existingModal) {
        existingModal.classList.remove('hidden');
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'aiSetupModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div class="text-center mb-6">
                <div class="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-robot text-3xl text-blue-600"></i>
                </div>
                <h3 class="text-xl font-bold text-gray-800">إعداد الذكاء الاصطناعي</h3>
                <p class="text-gray-600 mt-2">لاستخدام ميزة التعرف التلقائي على الأصول، يجب إدخال مفتاح OpenAI API</p>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">مفتاح API</label>
                    <input type="password" id="aiApiKeyInput" 
                           class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                           placeholder="sk-...">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">النموذج</label>
                    <select id="aiModelSelect" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="gpt-4o">GPT-4o (موصى به)</option>
                        <option value="gpt-4o-mini">GPT-4o Mini (أسرع وأرخص)</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                </div>
                
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p class="text-sm text-yellow-800">
                        <i class="fas fa-info-circle ml-1"></i>
                        يتم تخزين المفتاح محلياً في متصفحك فقط ولا يتم إرساله لأي خادم آخر.
                    </p>
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button onclick="document.getElementById('aiSetupModal').classList.add('hidden')" 
                        class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                    إلغاء
                </button>
                <button onclick="saveAISetup()" 
                        class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    حفظ وتفعيل
                </button>
            </div>
            
            <div class="mt-4 text-center">
                <a href="https://platform.openai.com/api-keys" target="_blank" 
                   class="text-sm text-blue-600 hover:underline">
                    <i class="fas fa-external-link-alt ml-1"></i>
                    الحصول على مفتاح API من OpenAI
                </a>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * حفظ إعدادات الذكاء الاصطناعي
 */
async function saveAISetup() {
    const apiKey = document.getElementById('aiApiKeyInput')?.value?.trim();
    const model = document.getElementById('aiModelSelect')?.value;
    
    if (!apiKey) {
        showToast('الرجاء إدخال مفتاح API', 'warning');
        return;
    }
    
    if (!apiKey.startsWith('sk-')) {
        showToast('مفتاح API غير صالح', 'error');
        return;
    }
    
    AI_CONFIG.apiKey = apiKey;
    AI_CONFIG.model = model || 'gpt-4o';
    
    await saveAISettings();
    
    document.getElementById('aiSetupModal')?.classList.add('hidden');
    
    // فتح نافذة الإضافة بالذكاء الاصطناعي
    openAIAssetModal();
}

/**
 * فتح إعدادات الذكاء الاصطناعي
 */
function openAISettings() {
    showAISetupPrompt();
    
    // تعبئة القيم الحالية
    setTimeout(() => {
        const apiKeyInput = document.getElementById('aiApiKeyInput');
        const modelSelect = document.getElementById('aiModelSelect');
        
        if (apiKeyInput && AI_CONFIG.apiKey) {
            apiKeyInput.value = AI_CONFIG.apiKey;
        }
        if (modelSelect && AI_CONFIG.model) {
            modelSelect.value = AI_CONFIG.model;
        }
    }, 100);
}

// إضافة تأثير الفلاش CSS
const flashStyle = document.createElement('style');
flashStyle.textContent = `
    @keyframes flash {
        0% { opacity: 0.8; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(flashStyle);

/**
 * تعبئة القوائم المنسدلة في نموذج الذكاء الاصطناعي
 */
function populateAIFormDropdowns() {
    // تعبئة الفئات الرئيسية
    const categorySelect = document.getElementById('aiResultCategory');
    if (categorySelect && APP_STATE.categories) {
        categorySelect.innerHTML = '<option value="">اختر الفئة</option>' +
            APP_STATE.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
    
    // تعبئة الفئات الفرعية
    const category2Select = document.getElementById('aiResultCategory2');
    if (category2Select && APP_STATE.categories2) {
        category2Select.innerHTML = '<option value="">اختر الفئة الفرعية</option>' +
            APP_STATE.categories2.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
    
    // تعبئة الفئات التفصيلية
    const category3Select = document.getElementById('aiResultCategory3');
    if (category3Select && APP_STATE.categories3) {
        category3Select.innerHTML = '<option value="">اختر الفئة التفصيلية</option>' +
            APP_STATE.categories3.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    }
    
    // تعبئة الإدارات
    const departmentSelect = document.getElementById('aiResultDepartment');
    if (departmentSelect && APP_STATE.departments) {
        departmentSelect.innerHTML = '<option value="">اختر الإدارة</option>' +
            APP_STATE.departments.map(dept => `<option value="${dept.name}">${dept.name}</option>`).join('');
    }
    
    // تعبئة المباني
    const buildingSelect = document.getElementById('aiResultBuilding');
    if (buildingSelect && APP_STATE.buildings) {
        buildingSelect.innerHTML = '<option value="">اختر المبنى</option>' +
            APP_STATE.buildings.map(b => `<option value="${b}">${b}</option>`).join('');
    }
    
    // تعبئة الطوابق
    const floorSelect = document.getElementById('aiResultFloor');
    if (floorSelect && APP_STATE.floors) {
        floorSelect.innerHTML = '<option value="">اختر الطابق</option>' +
            APP_STATE.floors.map(f => `<option value="${f}">${f}</option>`).join('');
    }
}

/**
 * فتح نافذة الإضافة بالذكاء الاصطناعي (نسخة محدثة)
 */
const originalOpenAIAssetModal = openAIAssetModal;
openAIAssetModal = function() {
    // التحقق من وجود مفتاح API
    if (!AI_CONFIG.apiKey) {
        showAISetupPrompt();
        return;
    }
    
    const modal = document.getElementById('aiAssetModal');
    if (!modal) {
        console.error('AI Modal not found');
        return;
    }
    
    // إعادة تعيين الحالة
    AI_STATE.capturedImages = [];
    AI_STATE.analyzedData = null;
    AI_STATE.isAnalyzing = false;
    AI_STATE.currentStep = 1;
    
    // إعادة تعيين واجهة المستخدم
    resetAIModalUI();
    
    // تعبئة القوائم المنسدلة
    populateAIFormDropdowns();
    
    modal.classList.remove('hidden');
};

// تهيئة إعدادات AI عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    initializeAISettings();
});
