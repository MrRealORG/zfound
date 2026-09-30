/* ==========================================================================
   ZFound × Zeeno Soft — Unified Tauri (Rust) & Native Bridge Controller
   ========================================================================== */

(function () {
    // Native Rust / WebView Bridge Adapter
    const Bridge = {
        isTauri: () => !!(window.__TAURI__ && window.__TAURI__.core),

        async getAppInfo() {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('get_app_info');
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_app_info();
            }
            return null;
        },

        async getLogs() {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('get_logs');
            }
            return [];
        },

        async selectFolder() {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('choose_folder');
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.select_folder();
            }
            return null;
        },

        async selectImageFile() {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('choose_image_file');
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.select_image_file();
            }
            return null;
        },

        async getDefaultFolder() {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('get_default_folder');
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_default_folder();
            }
            return null;
        },

        async setDefaultFolder(folder) {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('set_default_folder', { folder });
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.set_default_folder(folder);
            }
            return null;
        },

        async scanFolder(path, recursive = true) {
            if (this.isTauri()) {
                const items = await window.__TAURI__.core.invoke('scan_folder', { path, recursive });
                return { status: 'success', count: items.length, items };
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.scan_folder(path, recursive);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async indexImages() {
            if (this.isTauri()) {
                const count = await window.__TAURI__.core.invoke('index_images');
                return { status: 'success', indexed_count: count };
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.index_scanned_images();
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async searchSimilar(queryPath, topK = 50, minScore = 0.70) {
            if (this.isTauri()) {
                const results = await window.__TAURI__.core.invoke('search_similar', {
                    queryPath,
                    topK,
                    minScore: minScore * 100.0
                });
                return { status: 'success', results };
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.search_similar(queryPath, topK, minScore);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async getThumbnail(path, maxSize = 240) {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('get_thumbnail', { path, maxSize });
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_thumbnail_b64(path, maxSize);
            }
            return '';
        },

        async openImage(path) {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('open_image', { path });
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.open_image(path);
            }
        },

        async revealInExplorer(path) {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('reveal_in_explorer', { path });
            } else if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.reveal_in_explorer(path);
            }
        },

        async saveItemMetadata(imagePath, code, box, customName) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.save_item_metadata(imagePath, code, box, customName);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async getItemMetadata(imagePath) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_item_metadata(imagePath);
            }
            return { code: '', box: '', custom_name: '' };
        },

        async batchAssignCodes(prefix, startNum, pad, box) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.batch_assign_codes(prefix, startNum, pad, box);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async renameImageFile(imagePath, newName) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.rename_image_file(imagePath, newName);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        // Storage & Inventory Bridge
        async getStorageBoxes() {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_storage_boxes();
            }
            return [];
        },

        async createStorageBox(name, description = '') {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.create_storage_box(name, description);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async renameStorageBox(boxId, newName) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.rename_storage_box(boxId, newName);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async deleteStorageBox(boxId) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.delete_storage_box(boxId);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async getInventory(searchQuery = '', boxFilter = '') {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_inventory(searchQuery, boxFilter);
            }
            return [];
        },

        async updateInventoryItem(itemId, name, code, box, notes = '') {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.update_inventory_item(itemId, name, code, box, notes);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async deleteInventoryItem(itemId) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.delete_inventory_item(itemId);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        // Product Scanner Session Bridge
        async selectMultipleImages() {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.select_multiple_images();
            }
            return [];
        },

        async startScanSession() {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.start_scan_session();
            }
            return null;
        },

        async getActiveSession() {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_active_session();
            }
            return null;
        },

        async clearScanSession() {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.clear_scan_session();
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async addSessionImages(filePaths) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.add_session_images(filePaths);
            }
            return null;
        },

        async captureWebcamImage(base64Data) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.capture_webcam_image(base64Data);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async retakeSessionImage(imageId, newFilePath = null, base64Data = null) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.retake_session_image(imageId, newFilePath, base64Data);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async reanalyzeSessionImage(imageId) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.reanalyze_session_image(imageId);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async deleteSessionImage(imageId) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.delete_session_image(imageId);
            }
            return null;
        },

        async setActiveSessionImage(imageId) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.set_active_session_image(imageId);
            }
            return null;
        },

        async updateDetectionBox(imageId, productId, x, y, width, height) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.update_detection_box(imageId, productId, x, y, width, height);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async addManualProduct(imageId, x, y, width, height) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.add_manual_product(imageId, x, y, width, height);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async deleteDetectionProduct(imageId, productId) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.delete_detection_product(imageId, productId);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async getScalerModels() {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.get_scaler_models();
            }
            return [];
        },

        async generateProductCrops(sessionId = null, upscale = true, model = 'realesrgan') {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.generate_product_crops(sessionId, upscale, model);
            }
            return [];
        },

        async saveInventoryProducts(productsData, targetFolder = null) {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.save_inventory_products(productsData, targetFolder);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async retakeProductCrop(productId, newFilePath = null, base64Data = null, upscale = true, model = 'realesrgan') {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.retake_product_crop(productId, newFilePath, base64Data, upscale, model);
            }
            return { status: 'error', message: 'No backend bridge available' };
        },

        async upscaleProductCrop(cropPath, scale = 4, model = 'realesrgan') {
            if (window.pywebview && window.pywebview.api) {
                return await window.pywebview.api.upscale_product_crop(cropPath, scale, model);
            }
            return { status: 'error', message: 'No backend bridge available' };
        }
    };

    // High-performance thumbnail cache & throttled IPC queue (ensures 60 FPS buttery smooth UI)
    const thumbnailMemoryCache = new Map();
    const thumbnailQueue = [];
    let activeThumbnailWorkers = 0;
    const MAX_CONCURRENT_THUMBNAILS = 5;

    function processThumbnailQueue() {
        if (activeThumbnailWorkers >= MAX_CONCURRENT_THUMBNAILS || thumbnailQueue.length === 0) {
            return;
        }

        const task = thumbnailQueue.shift();
        activeThumbnailWorkers++;

        Bridge.getThumbnail(task.path, task.size || 240)
            .then(b64 => {
                if (b64) {
                    thumbnailMemoryCache.set(task.path, b64);
                    task.callback(b64);
                }
            })
            .catch(() => {})
            .finally(() => {
                activeThumbnailWorkers--;
                processThumbnailQueue();
            });
    }

    function loadThumbnailSmoothly(path, callback, size = 240) {
        if (!path) return;
        if (thumbnailMemoryCache.has(path)) {
            callback(thumbnailMemoryCache.get(path));
            return;
        }
        thumbnailQueue.push({ path, size, callback });
        processThumbnailQueue();
    }

    // Global intersection observer with smooth queued loading
    const thumbnailObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const path = img.dataset.src;
                if (path && !img.dataset.loaded) {
                    img.dataset.loaded = 'true';
                    loadThumbnailSmoothly(path, (b64) => {
                        img.src = b64;
                    }, 240);
                }
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '160px' });

    // State
    const state = {
        activeView: 'finder',
        currentFolder: '',
        scannedItems: [],
        indexedCount: 0,
        activeQueryPath: '',
        activeModel: null,
        minScoreThreshold: 0.70,
        isStrictMode: true,
        isIndexing: false,
        activeItem: null,
        filterQuery: '',
        // Scanner State
        scanner: {
            activeSession: null,
            activeImage: null,
            selectedProductId: null,
            tool: 'select', // 'select' | 'cut'
            zoom: 1.0,
            panX: 0,
            panY: 0,
            isPanning: false,
            panStartX: 0,
            panStartY: 0,
            dragTarget: null, // { type: 'move'|'handle', productId, handle, startX, startY, origBox }
            isCutting: false,
            cutStartX: 0,
            cutStartY: 0,
            crops: [],
            cameraStream: null,
            cameraFacing: 'environment',
            retakeTargetImageId: null,
            retakeTargetCropId: null
        },
        // Storage State
        storage: {
            boxes: [],
            inventory: [],
            selectedBoxFilter: '',
            searchFilter: ''
        },
        // Product Viewer Modal State
        viewer: {
            products: [],
            currentIndex: 0,
            zoom: 1.0
        }
    };

    // DOM Elements
    const elements = {
        splashScreen: document.getElementById('splash-screen'),
        splashProgressBar: document.getElementById('splash-progress-bar'),
        splashStatusText: document.getElementById('splash-status-text'),
        appRoot: document.getElementById('app-root'),
        navItems: document.querySelectorAll('.nav-item'),
        viewPanels: document.querySelectorAll('.view-panel'),
        btnSelectFolder: document.getElementById('btn-select-folder'),
        btnIndexImages: document.getElementById('btn-index-images'),
        btnBatchLabel: document.getElementById('btn-batch-label'),
        btnSetDefaultFolder: document.getElementById('btn-set-default-folder'),
        statScannedCount: document.getElementById('stat-scanned-count'),
        statIndexedCount: document.getElementById('stat-indexed-count'),
        statFolderPath: document.getElementById('stat-folder-path'),
        gallerySearchFilter: document.getElementById('gallery-search-filter'),
        btnClearGalleryFilter: document.getElementById('btn-clear-gallery-filter'),
        galleryFilterCount: document.getElementById('gallery-filter-count'),
        indexProgressContainer: document.getElementById('index-progress-container'),
        indexProgressBar: document.getElementById('index-progress-bar'),
        indexProgressPct: document.getElementById('index-progress-pct'),
        indexProgressLabel: document.getElementById('index-progress-label'),
        galleryGrid: document.getElementById('gallery-grid'),
        queryDropzone: document.getElementById('query-dropzone'),
        queryFileInput: document.getElementById('query-file-input'),
        btnBrowseQuery: document.getElementById('btn-browse-query'),
        queryUploadCard: document.getElementById('query-upload-card'),
        queryUploadWash: document.getElementById('query-upload-wash'),
        queryFileBadge: document.getElementById('query-file-badge'),
        queryFileExt: document.getElementById('query-file-ext'),
        queryBadgePreview: document.getElementById('query-badge-preview'),
        queryFileName: document.getElementById('query-file-name'),
        queryStatusIcon: document.getElementById('query-status-icon'),
        queryStatusLabel: document.getElementById('query-status-label'),
        queryFileSize: document.getElementById('query-file-size'),
        queryProgressFill: document.getElementById('query-progress-fill'),
        queryImgElement: document.getElementById('query-img-element'),
        btnClearQuery: document.getElementById('btn-clear-query'),
        queryStatusText: document.getElementById('query-status-text'),
        strictModeToggleWrap: document.getElementById('strict-mode-toggle-wrap'),
        gooSwitchStrict: document.getElementById('goo-switch-strict'),
        strictModeTitle: document.getElementById('strict-mode-title'),
        strictModeSubtitle: document.getElementById('strict-mode-subtitle'),
        searchThreshold: document.getElementById('search-threshold'),
        searchThresholdVal: document.getElementById('search-threshold-val'),
        btnEmptyStateBrowse: document.getElementById('btn-empty-state-browse'),
        resultsGrid: document.getElementById('results-grid'),
        resultsCountBadge: document.getElementById('results-count-badge'),
        sidebarModelName: document.getElementById('sidebar-model-name'),
        engineActiveModelTitle: document.getElementById('engine-active-model-title'),
        engineDim: document.getElementById('engine-dim'),
        detectedModelsList: document.getElementById('detected-models-list'),
        liveLogsTerminal: document.getElementById('live-logs-terminal'),
        btnClearLogs: document.getElementById('btn-clear-logs'),
        toastPill: document.getElementById('toast-pill'),
        toastIcon: document.getElementById('toast-icon'),
        toastText: document.getElementById('toast-message') || document.getElementById('toast-text'),
        lightboxModal: document.getElementById('lightbox-modal'),
        lightboxImg: document.getElementById('lightbox-img'),
        lightboxFilename: document.getElementById('lightbox-filename'),
        lightboxFilepath: document.getElementById('lightbox-filepath'),
        lightboxScoreBadge: document.getElementById('lightbox-score-badge'),
        lightboxCodeBadge: document.getElementById('lightbox-code-badge'),
        lightboxBoxBadge: document.getElementById('lightbox-box-badge'),
        lightboxInputCode: document.getElementById('lightbox-input-code'),
        lightboxInputBox: document.getElementById('lightbox-input-box'),
        lightboxInputName: document.getElementById('lightbox-input-name'),
        lightboxBtnSaveMeta: document.getElementById('lightbox-btn-save-meta'),
        lightboxBtnRenameFile: document.getElementById('lightbox-btn-rename-file'),
        lightboxSaveStatus: document.getElementById('lightbox-save-status'),
        lightboxClose: document.getElementById('lightbox-close'),
        lightboxBtnOpen: document.getElementById('lightbox-btn-open'),
        lightboxBtnReveal: document.getElementById('lightbox-btn-reveal'),
        batchModal: document.getElementById('batch-modal'),
        batchClose: document.getElementById('batch-close'),
        batchPrefixInput: document.getElementById('batch-prefix-input'),
        batchStartNum: document.getElementById('batch-start-num'),
        batchPadSelect: document.getElementById('batch-pad-select'),
        batchBoxInput: document.getElementById('batch-box-input'),
        batchPreviewText: document.getElementById('batch-preview-text'),
        btnRunBatchLabel: document.getElementById('btn-run-batch-label'),
        btnCancelBatch: document.getElementById('btn-cancel-batch'),

        // Scanner View Elements
        scannerSessionBar: document.getElementById('scanner-session-bar'),
        btnScannerCamera: document.getElementById('btn-scanner-camera'),
        btnScannerUpload: document.getElementById('btn-scanner-upload'),
        scannerFileInput: document.getElementById('scanner-file-input'),
        btnScannerNext: document.getElementById('btn-scanner-next'),
        badgeNextCount: document.getElementById('badge-next-count'),
        sessionThumbsStrip: document.getElementById('session-thumbs-strip'),
        sessionImageCount: document.getElementById('session-image-count'),
        statAiDetected: document.getElementById('stat-ai-detected'),
        statManualAdded: document.getElementById('stat-manual-added'),
        statRemoved: document.getElementById('stat-removed'),
        statFinalProducts: document.getElementById('stat-final-products'),
        toolBtnSelect: document.getElementById('tool-btn-select'),
        toolBtnCut: document.getElementById('tool-btn-cut'),
        btnZoomIn: document.getElementById('btn-zoom-in'),
        btnZoomOut: document.getElementById('btn-zoom-out'),
        btnZoomFit: document.getElementById('btn-zoom-fit'),
        btnZoom100: document.getElementById('btn-zoom-100'),
        canvasZoomLevel: document.getElementById('canvas-zoom-level'),
        canvasViewport: document.getElementById('canvas-viewport'),
        canvasStage: document.getElementById('canvas-stage'),
        canvasImage: document.getElementById('canvas-image'),
        canvasSvg: document.getElementById('canvas-svg'),
        canvasEmptyState: document.getElementById('canvas-empty-state'),
        cardQualityAdvisory: document.getElementById('card-quality-advisory'),
        qualityAdvisoryTitle: document.getElementById('quality-advisory-title'),
        qualityAdvisoryText: document.getElementById('quality-advisory-text'),
        scannerActiveImgName: document.getElementById('scanner-active-img-name'),
        btnActiveRetake: document.getElementById('btn-active-retake'),
        btnActiveReanalyze: document.getElementById('btn-active-reanalyze'),
        btnActiveDelete: document.getElementById('btn-active-delete'),
        countImageProducts: document.getElementById('count-image-products'),
        detectedProductsList: document.getElementById('detected-products-list'),
        scannerStepCanvas: document.getElementById('scanner-step-canvas'),
        scannerStepReview: document.getElementById('scanner-step-review'),
        btnBackToCanvas: document.getElementById('btn-back-to-canvas'),
        reviewTotalCount: document.getElementById('review-total-count'),
        productsReviewGrid: document.getElementById('products-review-grid'),
        autoCodeInput: document.getElementById('auto-code-input'),
        btnAutoCodeApply: document.getElementById('btn-auto-code-apply'),
        batchBoxSelect: document.getElementById('batch-box-select'),
        btnBatchBoxApply: document.getElementById('btn-batch-box-apply'),
        canvasScalerSelect: document.getElementById('canvas-scaler-select'),
        scalerModelSelect: document.getElementById('scaler-model-select'),
        btnUpscaleAll: document.getElementById('btn-upscale-all'),
        btnSaveInventory: document.getElementById('btn-save-inventory'),
        labelSaveInventory: document.getElementById('label-save-inventory'),
        autosaveStatus: document.getElementById('autosave-status'),

        // Camera Modal
        cameraModal: document.getElementById('camera-modal'),
        cameraClose: document.getElementById('camera-close'),
        cameraVideo: document.getElementById('camera-video'),
        cameraErrorWrap: document.getElementById('camera-error-wrap'),
        cameraErrorMsg: document.getElementById('camera-error-msg'),
        btnCameraSwitch: document.getElementById('btn-camera-switch'),
        btnCameraSnap: document.getElementById('btn-camera-snap'),
        btnCameraFallbackUpload: document.getElementById('btn-camera-fallback-upload'),

        // Storage View Elements
        btnCreateBox: document.getElementById('btn-create-box'),
        storageBoxCountBadge: document.getElementById('storage-box-count-badge'),
        storageBoxesGrid: document.getElementById('storage-boxes-grid'),
        inventorySearchFilter: document.getElementById('inventory-search-filter'),
        btnClearInventoryFilter: document.getElementById('btn-clear-inventory-filter'),
        selectInventoryBoxFilter: document.getElementById('select-inventory-box-filter'),
        inventoryFilterCount: document.getElementById('inventory-filter-count'),
        inventoryGrid: document.getElementById('inventory-grid'),

        // New Box Modal
        newBoxModal: document.getElementById('new-box-modal'),
        newBoxClose: document.getElementById('new-box-close'),
        inputNewBoxName: document.getElementById('input-new-box-name'),
        inputNewBoxDesc: document.getElementById('input-new-box-desc'),
        btnSaveNewBox: document.getElementById('btn-save-new-box'),
        btnCancelNewBox: document.getElementById('btn-cancel-new-box'),

        // Product Viewer Modal
        productViewerModal: document.getElementById('product-viewer-modal'),
        productViewerClose: document.getElementById('product-viewer-close'),
        productViewerCodeBadge: document.getElementById('product-viewer-code-badge'),
        productViewerBoxBadge: document.getElementById('product-viewer-box-badge'),
        productViewerTitle: document.getElementById('product-viewer-title'),
        btnViewerPrev: document.getElementById('btn-viewer-prev'),
        btnViewerNext: document.getElementById('btn-viewer-next'),
        productViewerPos: document.getElementById('product-viewer-pos'),
        productViewerImg: document.getElementById('product-viewer-img'),
        btnViewerZoomIn: document.getElementById('btn-viewer-zoom-in'),
        btnViewerZoomOut: document.getElementById('btn-viewer-zoom-out'),
        btnViewerZoomFit: document.getElementById('btn-viewer-zoom-fit'),
        productViewerDims: document.getElementById('product-viewer-dims')
    };

    function showToast(message, icon = '✦') {
        if (!elements.toastPill) return;
        if (elements.toastIcon) elements.toastIcon.textContent = icon;
        if (elements.toastText) elements.toastText.textContent = message;
        elements.toastPill.classList.remove('hidden');
        clearTimeout(elements.toastPill._timer);
        elements.toastPill._timer = setTimeout(() => {
            elements.toastPill.classList.add('hidden');
        }, 3200);
    }

    function initSplashScreen() {
        if (!elements.splashScreen || !elements.splashProgressBar) {
            if (elements.appRoot) {
                elements.appRoot.classList.remove('hidden');
                elements.appRoot.style.opacity = '1';
            }
            checkBackendInfo();
            return;
        }

        let progress = 0;
        const interval = setInterval(() => {
            progress += 25;
            if (elements.splashProgressBar) elements.splashProgressBar.style.width = `${progress}%`;

            if (progress === 50 && elements.splashStatusText) {
                elements.splashStatusText.textContent = 'Mounting AI vision engine...';
            } else if (progress === 75 && elements.splashStatusText) {
                elements.splashStatusText.textContent = 'Preparing Apple-style workspace...';
            } else if (progress >= 100) {
                clearInterval(interval);
                if (elements.splashStatusText) elements.splashStatusText.textContent = 'Ready';
                setTimeout(() => {
                    if (elements.splashScreen) elements.splashScreen.classList.add('fade-out');
                    if (elements.appRoot) {
                        elements.appRoot.classList.remove('hidden');
                        elements.appRoot.style.opacity = '1';
                    }
                    checkBackendInfo();
                }, 300);
            }
        }, 80);
    }

    async function checkBackendInfo() {
        try {
            const info = await Bridge.getAppInfo();
            if (info) {
                state.activeModel = info.active_model || 'clip-vit-base-patch32';
                elements.sidebarModelName.textContent = info.active_model || 'CLIP AI Ready';
                elements.engineActiveModelTitle.textContent = info.active_model || 'clip-vit-base-patch32';
                elements.engineDim.textContent = `${info.dimension || 512}-D Vector Space`;

                if (info.models_available && info.models_available.length > 0) {
                    elements.detectedModelsList.innerHTML = info.models_available.map(m => `
                        <div class="info-row">
                            <span class="info-key">${m.name}</span>
                            <span class="info-val">${m.dimension || 512}D • ${m.model_type || 'local'}</span>
                        </div>
                    `).join('');
                }

                // If user has a default folder saved, auto-load it
                if (info.default_folder && !state.currentFolder) {
                    state.currentFolder = info.default_folder;
                    elements.statFolderPath.textContent = info.default_folder;
                    elements.statFolderPath.title = info.default_folder;
                    scanFolder(info.default_folder);
                }
            }
        } catch (e) {
            console.warn('[ZFound] Info warning:', e);
        }
    }

    let logsInterval = null;
    function setupNavigation() {
        elements.navItems.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetView = btn.dataset.view;
                if (!targetView) return;

                elements.navItems.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                elements.viewPanels.forEach(p => p.classList.remove('active'));
                const targetPanel = document.getElementById(`view-${targetView}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                    state.activeView = targetView;
                }

                if (targetView === 'models') {
                    refreshLogs();
                    if (!logsInterval) {
                        logsInterval = setInterval(refreshLogs, 1500);
                    }
                } else if (logsInterval) {
                    clearInterval(logsInterval);
                    logsInterval = null;
                }

                if (targetView === 'scanner') {
                    if (typeof refreshScannerView === 'function') {
                        refreshScannerView();
                    }
                } else if (targetView === 'storage') {
                    if (typeof loadStorageData === 'function') {
                        loadStorageData();
                    }
                }
            });
        });
    }

    async function refreshLogs() {
        if (!elements.liveLogsTerminal) return;
        try {
            const logs = await Bridge.getLogs();
            if (logs && logs.length > 0) {
                elements.liveLogsTerminal.innerHTML = logs.map(l => {
                    let cls = 'log-line';
                    if (l.includes('Saved') || l.includes('Loaded')) cls += ' log-storage';
                    else if (l.includes('Scanning') || l.includes('Discovered')) cls += ' log-scan';
                    else if (l.includes('query') || l.includes('matches') || l.includes('ranked')) cls += ' log-match';
                    return `<div class="${cls}">${escapeHtml(l)}</div>`;
                }).join('');
                elements.liveLogsTerminal.scrollTop = elements.liveLogsTerminal.scrollHeight;
            }
        } catch (e) {}
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function initGooSwitch() {
        const switchWrap = elements.strictModeToggleWrap;
        const switchBtn = elements.gooSwitchStrict;
        if (!switchBtn) return;

        const thumb = switchBtn.querySelector('.goo-thumb');
        const droplet = switchBtn.querySelector('.goo-droplet');
        const shadow = switchBtn.querySelector('.goo-shadow');

        function setGooState(isOn, animated = true) {
            state.isStrictMode = isOn;
            switchBtn.classList.toggle('is-on', isOn);
            switchBtn.setAttribute('aria-checked', isOn ? 'true' : 'false');

            const targetThumbX = isOn ? 33 : 5;
            const targetShadowCx = isOn ? 45 : 17;
            const targetBlobCx = isOn ? 45 : 17;

            if (animated) {
                if (droplet && thumb) {
                    droplet.setAttribute('rx', '15');
                    droplet.setAttribute('cx', String((targetBlobCx + (isOn ? 25 : 37)) / 2));
                    setTimeout(() => {
                        droplet.setAttribute('rx', '11');
                        droplet.setAttribute('cx', String(targetBlobCx));
                    }, 140);
                }
            } else {
                if (droplet) {
                    droplet.setAttribute('rx', '11');
                    droplet.setAttribute('cx', String(targetBlobCx));
                }
            }

            if (thumb) thumb.setAttribute('x', String(targetThumbX));
            if (shadow) shadow.setAttribute('cx', String(targetShadowCx));

            if (elements.strictModeTitle) {
                elements.strictModeTitle.textContent = isOn ? 'Exact Design Only' : 'Broad Match';
            }
            if (elements.strictModeSubtitle) {
                elements.strictModeSubtitle.textContent = isOn ? '70%+ Strict' : 'All (25%+)';
                elements.strictModeSubtitle.style.color = isOn ? 'var(--accent-emerald)' : 'var(--text-muted)';
            }
        }

        const toggleHandler = () => {
            const nextState = !state.isStrictMode;
            setGooState(nextState, true);

            if (nextState) {
                elements.searchThreshold.value = 70;
                state.minScoreThreshold = 0.70;
                elements.searchThresholdVal.textContent = '70%';
                showToast('Exact Design Mode Enabled (70%+ match)', '🎯');
            } else {
                elements.searchThreshold.value = 25;
                state.minScoreThreshold = 0.25;
                elements.searchThresholdVal.textContent = '25%';
                showToast('Broad Match Mode Enabled (25%+ match)', '🌐');
            }

            if (state.activeQueryPath) {
                runSimilaritySearch(state.activeQueryPath);
            }
        };

        if (switchWrap) switchWrap.addEventListener('click', toggleHandler);

        switchBtn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleHandler();
            }
        });

        // Initialize state
        setGooState(state.isStrictMode, false);

        window.syncGooSwitch = (val) => {
            const shouldBeOn = val >= 65;
            if (shouldBeOn !== state.isStrictMode) {
                setGooState(shouldBeOn, true);
            }
        };
    }

    function setupActions() {
        // Native Windows Explorer folder picker (NO prompt)
        elements.btnSelectFolder.addEventListener('click', async () => {
            const folder = await Bridge.selectFolder();
            if (folder) {
                state.currentFolder = folder;
                elements.statFolderPath.textContent = folder;
                elements.statFolderPath.title = folder;
                scanFolder(folder);
            }
        });

        // Set current folder as default
        if (elements.btnSetDefaultFolder) {
            elements.btnSetDefaultFolder.addEventListener('click', async () => {
                if (!state.currentFolder) {
                    showToast('Select a folder first', '⚠️');
                    return;
                }
                await Bridge.setDefaultFolder(state.currentFolder);
                showToast(`Default folder set to: ${state.currentFolder}`, '★');
            });
        }

        elements.btnIndexImages.addEventListener('click', async () => {
            if (!state.scannedItems.length || state.isIndexing) return;
            runIndexing();
        });

        // Initialize Apple Liquid GooSwitch
        initGooSwitch();

        elements.searchThreshold.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.minScoreThreshold = val / 100.0;
            elements.searchThresholdVal.textContent = `${val}%`;
            
            // Bidirectional sync with GooSwitch
            if (window.syncGooSwitch) {
                window.syncGooSwitch(val);
            }

            if (state.activeQueryPath) {
                runSimilaritySearch(state.activeQueryPath);
            }
        });

        if (elements.btnClearLogs) {
            elements.btnClearLogs.addEventListener('click', () => {
                if (elements.liveLogsTerminal) {
                    elements.liveLogsTerminal.innerHTML = '<div class="log-line text-muted">[Console] Logs cleared.</div>';
                }
            });
        }
    }

    function updateLightboxBadges(item) {
        if (!item) return;
        if (elements.lightboxCodeBadge) {
            if (item.code) {
                elements.lightboxCodeBadge.textContent = item.code;
                elements.lightboxCodeBadge.classList.remove('hidden');
            } else {
                elements.lightboxCodeBadge.classList.add('hidden');
            }
        }
        if (elements.lightboxBoxBadge) {
            if (item.box) {
                elements.lightboxBoxBadge.textContent = item.box;
                elements.lightboxBoxBadge.classList.remove('hidden');
            } else {
                elements.lightboxBoxBadge.classList.add('hidden');
            }
        }
    }

    function setupLightbox() {
        if (!elements.lightboxModal) return;

        const closeLightbox = () => {
            elements.lightboxModal.classList.add('hidden');
        };

        if (elements.lightboxClose) {
            elements.lightboxClose.addEventListener('click', closeLightbox);
        }

        const backdrop = elements.lightboxModal.querySelector('.lightbox-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', closeLightbox);
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !elements.lightboxModal.classList.contains('hidden')) {
                closeLightbox();
            }
        });

        // Save Details (Code, Box #, Custom Title)
        if (elements.lightboxBtnSaveMeta) {
            elements.lightboxBtnSaveMeta.addEventListener('click', async () => {
                if (!state.activeItem) return;
                const code = elements.lightboxInputCode ? elements.lightboxInputCode.value.trim() : '';
                const box = elements.lightboxInputBox ? elements.lightboxInputBox.value.trim() : '';
                const name = elements.lightboxInputName ? elements.lightboxInputName.value.trim() : '';

                state.activeItem.code = code;
                state.activeItem.box = box;
                state.activeItem.custom_name = name;

                updateLightboxBadges(state.activeItem);

                const res = await Bridge.saveItemMetadata(state.activeItem.path, code, box, name);
                if (res && res.status === 'success') {
                    if (elements.lightboxSaveStatus) {
                        elements.lightboxSaveStatus.classList.remove('hidden');
                        setTimeout(() => {
                            if (elements.lightboxSaveStatus) elements.lightboxSaveStatus.classList.add('hidden');
                        }, 2500);
                    }
                    showToast(`Saved details for ${state.activeItem.name}`, '💾');
                    renderFilteredGallery();
                } else {
                    showToast('Failed to save details', '⚠️');
                }
            });
        }

        // Rename file on disk to match code / custom name
        if (elements.lightboxBtnRenameFile) {
            elements.lightboxBtnRenameFile.addEventListener('click', async () => {
                if (!state.activeItem) return;
                const currentName = state.activeItem.name;
                const currentCode = state.activeItem.code || '';
                const ext = currentName.substring(currentName.lastIndexOf('.'));
                const baseName = currentName.substring(0, currentName.lastIndexOf('.'));
                
                const defaultNew = currentCode ? `${currentCode}_${baseName}${ext}` : currentName;
                const entered = prompt(`Rename image file on disk:`, defaultNew);
                if (entered && entered.trim() && entered.trim() !== currentName) {
                    const res = await Bridge.renameImageFile(state.activeItem.path, entered.trim());
                    if (res && res.status === 'success') {
                        state.activeItem.path = res.new_path;
                        state.activeItem.name = res.new_name;
                        elements.lightboxFilename.textContent = res.new_name;
                        elements.lightboxFilepath.textContent = res.new_path;
                        showToast(`Renamed file to ${res.new_name}`, '✓');
                        renderFilteredGallery();
                    } else {
                        alert(res ? res.message : 'Rename failed');
                    }
                }
            });
        }
    }

    function openLightbox(item, score = null) {
        if (!elements.lightboxModal) return;

        state.activeItem = item;
        elements.lightboxFilename.textContent = item.custom_name ? `${item.custom_name} (${item.name})` : item.name;
        elements.lightboxFilepath.textContent = item.path;
        elements.lightboxImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

        if (elements.lightboxInputCode) elements.lightboxInputCode.value = item.code || '';
        if (elements.lightboxInputBox) elements.lightboxInputBox.value = item.box || '';
        if (elements.lightboxInputName) elements.lightboxInputName.value = item.custom_name || '';
        if (elements.lightboxSaveStatus) elements.lightboxSaveStatus.classList.add('hidden');

        updateLightboxBadges(item);

        if (score !== null) {
            elements.lightboxScoreBadge.style.display = 'inline-flex';
            elements.lightboxScoreBadge.textContent = score === 100 ? '100% Exact' : `${score}% Match`;
        } else {
            elements.lightboxScoreBadge.style.display = 'none';
        }

        loadThumbnailSmoothly(item.path, (b64) => {
            if (b64) elements.lightboxImg.src = b64;
        }, 1000);

        elements.lightboxBtnOpen.onclick = () => Bridge.openImage(item.path);
        elements.lightboxBtnReveal.onclick = () => Bridge.revealInExplorer(item.path);

        elements.lightboxModal.classList.remove('hidden');
    }

    function setupBatchModal() {
        if (!elements.btnBatchLabel || !elements.batchModal) return;

        const closeBatchModal = () => {
            elements.batchModal.classList.add('hidden');
        };

        const updateBatchPreview = () => {
            const prefix = elements.batchPrefixInput ? elements.batchPrefixInput.value.trim() : 'ZF';
            const start = elements.batchStartNum ? parseInt(elements.batchStartNum.value) || 1 : 1;
            const pad = elements.batchPadSelect ? parseInt(elements.batchPadSelect.value) || 2 : 2;
            const ex1 = `${prefix}${String(start).padStart(pad, '0')}`;
            const ex2 = `${prefix}${String(start + 1).padStart(pad, '0')}`;
            const ex3 = `${prefix}${String(start + 2).padStart(pad, '0')}`;
            if (elements.batchPreviewText) {
                elements.batchPreviewText.textContent = `${ex1}, ${ex2}, ${ex3}... (${state.scannedItems.length} images)`;
            }
        };

        elements.btnBatchLabel.addEventListener('click', () => {
            if (!state.scannedItems || !state.scannedItems.length) {
                showToast('Please scan a folder first', '⚠️');
                return;
            }
            updateBatchPreview();
            elements.batchModal.classList.remove('hidden');
        });

        if (elements.batchClose) {
            elements.batchClose.addEventListener('click', closeBatchModal);
        }
        if (elements.btnCancelBatch) {
            elements.btnCancelBatch.addEventListener('click', closeBatchModal);
        }

        if (elements.batchPrefixInput) elements.batchPrefixInput.addEventListener('input', updateBatchPreview);
        if (elements.batchStartNum) elements.batchStartNum.addEventListener('input', updateBatchPreview);
        if (elements.batchPadSelect) elements.batchPadSelect.addEventListener('change', updateBatchPreview);

        if (elements.btnRunBatchLabel) {
            elements.btnRunBatchLabel.addEventListener('click', async () => {
                const prefix = elements.batchPrefixInput ? elements.batchPrefixInput.value.trim() : 'ZF';
                const start = elements.batchStartNum ? parseInt(elements.batchStartNum.value) || 1 : 1;
                const pad = elements.batchPadSelect ? parseInt(elements.batchPadSelect.value) || 2 : 2;
                const box = elements.batchBoxInput ? elements.batchBoxInput.value.trim() : '';

                showToast('Batch auto-labelling images...', '🏷️');
                const res = await Bridge.batchAssignCodes(prefix, start, pad, box);
                if (res && res.status === 'success') {
                    state.scannedItems = res.items || state.scannedItems;
                    renderFilteredGallery();
                    closeBatchModal();
                    showToast(`Successfully assigned codes to ${res.count} images!`, '✓');
                } else {
                    showToast(res ? res.message : 'Batch labelling failed', '⚠️');
                }
            });
        }
    }

    function setupGalleryFilter() {
        if (!elements.gallerySearchFilter) return;

        const onFilterInput = () => {
            state.filterQuery = elements.gallerySearchFilter.value.trim().toLowerCase();
            if (elements.btnClearGalleryFilter) {
                if (state.filterQuery) {
                    elements.btnClearGalleryFilter.classList.remove('hidden');
                } else {
                    elements.btnClearGalleryFilter.classList.add('hidden');
                }
            }
            renderFilteredGallery();
        };

        elements.gallerySearchFilter.addEventListener('input', onFilterInput);

        if (elements.btnClearGalleryFilter) {
            elements.btnClearGalleryFilter.addEventListener('click', () => {
                elements.gallerySearchFilter.value = '';
                state.filterQuery = '';
                elements.btnClearGalleryFilter.classList.add('hidden');
                renderFilteredGallery();
            });
        }
    }

    function renderFilteredGallery() {
        if (!state.filterQuery) {
            if (elements.galleryFilterCount) elements.galleryFilterCount.classList.add('hidden');
            renderGallery(state.scannedItems);
            return;
        }

        const q = state.filterQuery;
        const filtered = state.scannedItems.filter(it => {
            const name = (it.name || '').toLowerCase();
            const code = (it.code || '').toLowerCase();
            const box = (it.box || '').toLowerCase();
            const custom = (it.custom_name || '').toLowerCase();
            return name.includes(q) || code.includes(q) || box.includes(q) || custom.includes(q);
        });

        if (elements.galleryFilterCount) {
            elements.galleryFilterCount.textContent = `${filtered.length} of ${state.scannedItems.length}`;
            elements.galleryFilterCount.classList.remove('hidden');
        }

        renderGallery(filtered);
    }

    async function scanFolder(folder) {
        showToast('Scanning directory...', '🔍');
        elements.galleryGrid.innerHTML = `
            <div class="empty-state">
                <h3>Scanning Directory...</h3>
                <p>${folder}</p>
            </div>
        `;

        try {
            const res = await Bridge.scanFolder(folder, true);
            if (res && res.status === 'success') {
                state.scannedItems = res.items || [];
                elements.statScannedCount.textContent = state.scannedItems.length;

                // Check if index was automatically loaded from .zfound_index.json
                const info = await Bridge.getAppInfo();
                if (info && info.indexed_count > 0) {
                    state.indexedCount = info.indexed_count;
                    elements.statIndexedCount.textContent = info.indexed_count;
                    showToast(`Loaded ${info.indexed_count} indexed items from folder!`, '💾');
                } else {
                    state.indexedCount = 0;
                    elements.statIndexedCount.textContent = '0';
                }

                if (state.scannedItems.length > 0) {
                    elements.btnIndexImages.disabled = false;
                    renderFilteredGallery();
                    showToast(`Discovered ${state.scannedItems.length} images`);
                } else {
                    elements.btnIndexImages.disabled = true;
                    elements.galleryGrid.innerHTML = `
                        <div class="empty-state">
                            <h3>No Images Found</h3>
                            <p>This directory has no supported image files.</p>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error('[ZFound] Scan error:', e);
            showToast('Scan error', '⚠️');
        }
    }

    function renderGallery(items) {
        elements.galleryGrid.innerHTML = '';
        if (!items || items.length === 0) {
            elements.galleryGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No Matching Images</h3>
                    <p>No images matched your current filter.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.title = `${item.code ? '[' + item.code + '] ' : ''}${item.custom_name || item.name}`;

            // Top Badges (Code & Box)
            const badgesTop = document.createElement('div');
            badgesTop.className = 'card-badges-top';
            badgesTop.innerHTML = `
                ${item.code ? `<span class="card-badge-code">${escapeHtml(item.code)}</span>` : ''}
                ${item.box ? `<span class="card-badge-box">${escapeHtml(item.box)}</span>` : ''}
            `;
            card.appendChild(badgesTop);

            const img = document.createElement('img');
            img.alt = item.name;
            img.dataset.src = item.path;
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

            // Lazy-load via smooth intersection observer
            thumbnailObserver.observe(img);

            const overlay = document.createElement('div');
            overlay.className = 'image-card-overlay';
            overlay.innerHTML = `
                ${item.custom_name ? `<div class="image-card-custom-name">${escapeHtml(item.custom_name)}</div>` : ''}
                <div class="image-card-name">${escapeHtml(item.name)}</div>
                <div class="image-card-size">${formatBytes(item.size)}</div>
            `;

            card.appendChild(img);
            card.appendChild(overlay);

            card.addEventListener('click', () => {
                openLightbox(item);
            });

            fragment.appendChild(card);
        });

        elements.galleryGrid.appendChild(fragment);
    }

    window.onIndexProgress = function (done, total, pct) {
        if (elements.indexProgressContainer) elements.indexProgressContainer.classList.remove('hidden');
        if (elements.indexProgressBar) elements.indexProgressBar.style.width = `${pct}%`;
        if (elements.indexProgressPct) elements.indexProgressPct.textContent = `${pct}%`;
        if (elements.indexProgressLabel) elements.indexProgressLabel.textContent = `Indexing ${done} / ${total} images...`;
    };

    window.onIndexComplete = function (res) {
        state.isIndexing = false;
        if (elements.indexProgressContainer) elements.indexProgressContainer.classList.add('hidden');
        if (elements.btnIndexImages) elements.btnIndexImages.disabled = false;

        if (res && res.status === 'success') {
            state.indexedCount = res.indexed_count;
            if (elements.statIndexedCount) elements.statIndexedCount.textContent = res.indexed_count;
            showToast(`Indexed ${res.indexed_count} images with AI vectors!`, '💾');
        } else {
            showToast(res ? (res.message || 'Indexing error') : 'Indexing failed', '⚠️');
        }
    };

    async function runIndexing() {
        state.isIndexing = true;
        if (elements.btnIndexImages) elements.btnIndexImages.disabled = true;
        if (elements.indexProgressContainer) elements.indexProgressContainer.classList.remove('hidden');
        if (elements.indexProgressBar) elements.indexProgressBar.style.width = '0%';
        if (elements.indexProgressPct) elements.indexProgressPct.textContent = '0%';
        if (elements.indexProgressLabel) elements.indexProgressLabel.textContent = 'Mounting AI vision model...';

        try {
            const res = await Bridge.indexImages();
            if (res && res.status === 'success' && res.indexed_count !== undefined) {
                window.onIndexComplete(res);
            } else if (res && res.status === 'error') {
                window.onIndexComplete(res);
            }
        } catch (e) {
            state.isIndexing = false;
            if (elements.indexProgressContainer) elements.indexProgressContainer.classList.add('hidden');
            if (elements.btnIndexImages) elements.btnIndexImages.disabled = false;
            console.error('[ZFound] Index error:', e);
            showToast('Indexing error', '⚠️');
        }
    }

    function setupDropzone() {
        const dropzone = elements.queryDropzone;
        if (!dropzone) return;

        // Native file picker on browse click or dropzone click
        const pickImage = async () => {
            const file = await Bridge.selectImageFile();
            if (file) {
                loadQueryImage(file);
            }
        };

        if (elements.btnBrowseQuery) {
            elements.btnBrowseQuery.addEventListener('click', (e) => {
                e.stopPropagation();
                pickImage();
            });
        }

        dropzone.addEventListener('click', (e) => {
            if (e.target.closest('#btn-browse-query') || e.target.closest('#btn-clear-query')) return;
            pickImage();
        });

        dropzone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropzone.setAttribute('data-state', 'drag');
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.setAttribute('data-state', 'drag');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.setAttribute('data-state', 'idle');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.setAttribute('data-state', 'idle');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.path) {
                    loadQueryImage(file.path.replace(/\\/g, '/'), file.size);
                }
            }
        });

        if (elements.btnClearQuery) {
            elements.btnClearQuery.addEventListener('click', (e) => {
                e.stopPropagation();
                clearQuery();
            });
        }
    }

    async function loadQueryImage(filePath, fileSize = null) {
        state.activeQueryPath = filePath;
        const fileName = filePath.split(/[/\\]/).pop() || 'query_image.png';
        const ext = fileName.includes('.') ? fileName.split('.').pop().toUpperCase() : 'IMG';

        // Toggle from dropzone to active upload card
        if (elements.queryDropzone) elements.queryDropzone.classList.add('hidden');
        if (elements.queryUploadCard) elements.queryUploadCard.classList.remove('hidden');

        // Set card information
        if (elements.queryFileName) elements.queryFileName.textContent = fileName;
        if (elements.queryFileExt) elements.queryFileExt.textContent = ext;

        // Dog-eared badge styling
        if (elements.queryFileBadge) {
            elements.queryFileBadge.classList.remove('hidden');
            if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'BMP'].includes(ext)) {
                elements.queryFileBadge.className = 'file-badge bg-blue-500';
            } else {
                elements.queryFileBadge.className = 'file-badge bg-indigo-500';
            }
        }
        if (elements.queryBadgePreview) elements.queryBadgePreview.classList.add('hidden');

        // Progress wash & comet initial
        if (elements.queryUploadWash) elements.queryUploadWash.style.width = '35%';
        if (elements.queryProgressFill) elements.queryProgressFill.style.transform = 'scaleX(0.35)';

        // Status line
        if (elements.queryStatusLabel) {
            elements.queryStatusLabel.textContent = 'Searching visual memory...';
            elements.queryStatusLabel.className = 'file-status-label status-uploading';
        }
        if (elements.queryStatusIcon) {
            elements.queryStatusIcon.innerHTML = `
                <svg class="status-spinner-arc" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-opacity="0.18" stroke-width="2.5"/>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="12 100"/>
                </svg>
            `;
        }

        // Determine size
        let finalSize = fileSize;
        if (!finalSize && state.scannedItems && state.scannedItems.length) {
            const found = state.scannedItems.find(item => item.path === filePath || item.name === fileName);
            if (found && found.size) finalSize = found.size;
        }
        if (elements.queryFileSize) {
            elements.queryFileSize.textContent = finalSize ? `${formatBytes(finalSize)} of ${formatBytes(finalSize)}` : ext;
        }

        if (elements.queryStatusText) elements.queryStatusText.textContent = 'Comparing visual embeddings...';

        // Fetch high-quality thumbnail preview
        const b64 = await Bridge.getThumbnail(filePath, 400);
        if (b64) {
            if (elements.queryImgElement) elements.queryImgElement.src = b64;
            if (elements.queryBadgePreview) {
                elements.queryBadgePreview.src = b64;
                elements.queryBadgePreview.classList.remove('hidden');
                if (elements.queryFileBadge) elements.queryFileBadge.classList.add('hidden');
            }
        }

        runSimilaritySearch(filePath);
    }

    function clearQuery() {
        state.activeQueryPath = '';
        if (elements.queryImgElement) elements.queryImgElement.src = '';
        if (elements.queryBadgePreview) elements.queryBadgePreview.src = '';
        if (elements.queryUploadCard) elements.queryUploadCard.classList.add('hidden');
        if (elements.queryDropzone) {
            elements.queryDropzone.classList.remove('hidden');
            elements.queryDropzone.setAttribute('data-state', 'idle');
        }
        if (elements.queryStatusText) elements.queryStatusText.textContent = 'Drop an image to begin matching';
        if (elements.resultsCountBadge) elements.resultsCountBadge.textContent = '0 results';
        if (elements.resultsGrid) {
            elements.resultsGrid.innerHTML = `
                <div class="empty-state results-empty">
                    <h3>Ready for Query</h3>
                    <p>Drop an image in the dock to scan your indexed library for duplicates and visual lookalikes.</p>
                </div>
            `;
        }
    }

    async function runSimilaritySearch(imagePath) {
        if (!state.indexedCount && (!state.scannedItems || !state.scannedItems.length)) {
            showToast('Please index a folder first', '⚠️');
            elements.queryStatusText.textContent = 'No images indexed in library';
            return;
        }

        elements.resultsGrid.innerHTML = `
            <div class="empty-state results-empty">
                <h3>Searching Neural Features...</h3>
                <p>Comparing high-dimensional visual embeddings</p>
            </div>
        `;

        try {
            const res = await Bridge.searchSimilar(imagePath, 50, state.minScoreThreshold);
            if (res && res.status === 'success') {
                const results = res.results || [];
                elements.resultsCountBadge.textContent = `${results.length} matches`;
                elements.queryStatusText.textContent = `Found ${results.length} ranked AI matches`;
                
                // Update FileUpload Card to Completed
                if (elements.queryUploadWash) elements.queryUploadWash.style.width = '100%';
                if (elements.queryProgressFill) elements.queryProgressFill.style.transform = 'scaleX(1)';
                if (elements.queryStatusLabel) {
                    elements.queryStatusLabel.textContent = 'Completed';
                    elements.queryStatusLabel.className = 'file-status-label';
                }
                if (elements.queryStatusIcon) {
                    elements.queryStatusIcon.innerHTML = `
                        <svg class="status-tick-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <circle cx="12" cy="12" r="9" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981"/>
                            <polyline points="8 12 11 15 16 9" stroke="#10b981"/>
                        </svg>
                    `;
                }

                renderSearchResults(results);
            } else if (res && res.status === 'dimension_mismatch') {
                elements.queryStatusText.textContent = 'Index update needed';
                showToast(res.message, '⚠️');
                elements.resultsGrid.innerHTML = `
                    <div class="empty-state results-empty">
                        <div class="empty-icon-wrap" style="color:var(--accent-orange, #ff9f0a)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <h3>Index Update Needed</h3>
                        <p>${escapeHtml(res.message)}</p>
                        <button id="btn-reindex-prompt" class="btn btn-primary btn-sm" style="margin-top:14px; padding: 8px 18px;">⚡ Index Images Now</button>
                    </div>
                `;
                const reindexBtn = document.getElementById('btn-reindex-prompt');
                if (reindexBtn) {
                    reindexBtn.addEventListener('click', () => {
                        if (elements.navItems && elements.navItems.length > 0) {
                            elements.navItems[0].click();
                        }
                        runIndexing();
                    });
                }
            } else {
                elements.queryStatusText.textContent = res ? res.message : 'Search error';
                showToast(res ? res.message : 'Search error', '⚠️');
            }
        } catch (e) {
            console.error('[ZFound] Search error:', e);
            elements.queryStatusText.textContent = 'Search failed';
        }
    }

    function renderSearchResults(results) {
        elements.resultsGrid.innerHTML = '';

        if (!results || results.length === 0) {
            elements.resultsGrid.innerHTML = `
                <div class="empty-state results-empty">
                    <h3>No Matches Found</h3>
                    <p>Try lowering the minimum score threshold slider.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = `result-card ${item.is_exact ? 'exact-match' : ''}`;
            card.title = `${item.code ? '[' + item.code + '] ' : ''}${item.custom_name ? item.custom_name + ' - ' : ''}${item.name}`;

            // Top Badges (Code & Box)
            const badgesTop = document.createElement('div');
            badgesTop.className = 'card-badges-top';
            badgesTop.innerHTML = `
                ${item.code ? `<span class="card-badge-code">${escapeHtml(item.code)}</span>` : ''}
                ${item.box ? `<span class="card-badge-box">${escapeHtml(item.box)}</span>` : ''}
            `;

            const img = document.createElement('img');
            img.alt = item.name;
            img.dataset.src = item.path;
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

            // Lazy-load with cache
            thumbnailObserver.observe(img);

            const badge = document.createElement('div');
            badge.className = `score-badge ${item.is_exact ? 'exact' : ''}`;
            badge.textContent = item.is_exact ? '100% Exact' : `${item.score}% Match`;

            const actions = document.createElement('div');
            actions.className = 'result-actions-overlay';
            actions.innerHTML = `
                <div style="flex:1; min-width:0; margin-right:6px;">
                    ${item.custom_name ? `<div class="image-card-custom-name" style="color:var(--accent-gold); font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.custom_name)}</div>` : ''}
                    <span class="image-card-name">${escapeHtml(item.name)}</span>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button class="btn-icon-tiny" title="Open Image" data-action="open">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn-icon-tiny" title="Reveal in File Explorer" data-action="reveal">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                </div>
            `;

            actions.querySelector('[data-action="open"]').addEventListener('click', (e) => {
                e.stopPropagation();
                Bridge.openImage(item.path);
            });

            actions.querySelector('[data-action="reveal"]').addEventListener('click', (e) => {
                e.stopPropagation();
                Bridge.revealInExplorer(item.path);
            });

            card.addEventListener('click', () => {
                openLightbox(item, item.score);
            });

            card.appendChild(badgesTop);
            card.appendChild(img);
            card.appendChild(badge);
            card.appendChild(actions);

            fragment.appendChild(card);
        });

        elements.resultsGrid.appendChild(fragment);
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /* ==========================================================================
       AI Product Scanner Subsystem (PP-PicoDet-XS & Manual Cut Workflow)
       ========================================================================== */

    function refreshScannerView() {
        if (!state.scanner.activeSession) {
            checkActiveSessionOnBoot();
        } else {
            renderSessionThumbs();
            renderCanvas();
            setTimeout(zoomFitCanvas, 30);
            updateSafetyStats();
        }
    }

    async function checkActiveSessionOnBoot() {
        try {
            const sess = await Bridge.getActiveSession();
            if (sess && sess.images && sess.images.length > 0) {
                state.scanner.activeSession = sess;
                const activeId = sess.active_image_id || sess.images[0].id;
                state.scanner.activeImage = sess.images.find(img => img.id === activeId) || sess.images[0];
            }
            renderSessionThumbs();
            renderCanvas();
            setTimeout(zoomFitCanvas, 30);
            updateSafetyStats();
        } catch (e) {
            console.warn('[ZFound] Error checking active session:', e);
            renderSessionThumbs();
            renderCanvas();
            setTimeout(zoomFitCanvas, 30);
            updateSafetyStats();
        }
    }

    function updateSafetyStats() {
        let aiCount = 0;
        let manualCount = 0;
        let removedCount = 0;
        let finalCount = 0;

        (state.scanner.activeSession?.images || []).forEach(img => {
            removedCount += (img.removed_count || 0);
            (img.products || []).forEach(p => {
                if (p.source === 'manual') manualCount++;
                else aiCount++;
                finalCount++;
            });
        });

        if (elements.statAiDetected) elements.statAiDetected.textContent = aiCount;
        if (elements.statManualAdded) elements.statManualAdded.textContent = manualCount;
        if (elements.statRemoved) elements.statRemoved.textContent = removedCount;
        if (elements.statFinalProducts) elements.statFinalProducts.textContent = finalCount;
        if (elements.badgeNextCount) elements.badgeNextCount.textContent = finalCount;
        if (elements.btnScannerNext) elements.btnScannerNext.disabled = (finalCount === 0);
    }

    function renderSessionThumbs() {
        if (!elements.sessionThumbsStrip) return;
        const images = state.scanner.activeSession?.images || [];

        if (elements.sessionImageCount) {
            elements.sessionImageCount.textContent = `${images.length} image${images.length === 1 ? '' : 's'}`;
        }

        if (images.length === 0) {
            elements.sessionThumbsStrip.innerHTML = '<div class="session-empty-hint text-muted">Upload or take photos to start a multi-image scan session.</div>';
            return;
        }

        elements.sessionThumbsStrip.innerHTML = '';
        const fragment = document.createDocumentFragment();

        images.forEach(img => {
            const thumb = document.createElement('div');
            const isActive = state.scanner.activeImage && state.scanner.activeImage.id === img.id;
            thumb.className = `session-thumb-card session-thumb-item ${isActive ? 'active' : ''}`;
            thumb.dataset.imageId = img.id;

            const prodCount = (img.products || []).length;
            thumb.innerHTML = `
                <img src="${img.thumb_url || img.data_url || ''}" alt="${escapeHtml(img.name)}" class="session-thumb-img" loading="lazy">
                <span class="session-thumb-badge">${prodCount}</span>
                <span class="session-thumb-name">${escapeHtml(img.name)}</span>
                <button class="session-thumb-del" title="Remove image">✕</button>
            `;

            thumb.addEventListener('click', (e) => {
                if (e.target.closest('.session-thumb-del')) return;
                switchActiveSessionImage(img.id);
            });

            thumb.querySelector('.session-thumb-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Remove image "${img.name}" from session?`)) {
                    await deleteSessionImage(img.id);
                }
            });

            fragment.appendChild(thumb);
        });

        elements.sessionThumbsStrip.appendChild(fragment);
    }

    async function switchActiveSessionImage(imageId) {
        if (!state.scanner.activeSession) return;
        const target = state.scanner.activeSession.images.find(im => im.id === imageId);
        if (target) {
            state.scanner.activeImage = target;
            state.scanner.selectedProductId = null;
            state.scanner.activeSession.active_image_id = imageId;
            await Bridge.setActiveSessionImage(imageId);
            renderSessionThumbs();
            renderCanvas();
            zoomFitCanvas();
            updateSafetyStats();
        }
    }

    async function deleteSessionImage(imageId) {
        const sess = await Bridge.deleteSessionImage(imageId);
        if (sess) {
            state.scanner.activeSession = sess;
            state.scanner.activeImage = sess.images.find(im => im.id === sess.active_image_id) || sess.images[0] || null;
            state.scanner.selectedProductId = null;
            renderSessionThumbs();
            renderCanvas();
            zoomFitCanvas();
            updateSafetyStats();
            showToast('Image removed from session', '🗑️');
        }
    }

    function updateCanvasTransform() {
        if (!elements.canvasStage) return;
        elements.canvasStage.style.transform = `translate(${state.scanner.panX}px, ${state.scanner.panY}px) scale(${state.scanner.zoom})`;
        if (elements.canvasZoomLevel) {
            elements.canvasZoomLevel.textContent = `${Math.round(state.scanner.zoom * 100)}%`;
        }
    }

    let rafTransformPending = false;
    function requestUpdateCanvasTransform() {
        if (rafTransformPending) return;
        rafTransformPending = true;
        requestAnimationFrame(() => {
            updateCanvasTransform();
            rafTransformPending = false;
        });
    }

    function zoomFitCanvas() {
        if (!elements.canvasViewport || !state.scanner.activeImage) return;
        const vpRect = elements.canvasViewport.getBoundingClientRect();
        if (!vpRect.width || !vpRect.height) return;
        const imgW = state.scanner.activeImage.width || 800;
        const imgH = state.scanner.activeImage.height || 600;

        const pad = 36;
        const availW = Math.max(100, vpRect.width - pad);
        const availH = Math.max(100, vpRect.height - pad);
        const scaleX = availW / imgW;
        const scaleY = availH / imgH;
        state.scanner.zoom = Math.max(0.08, Math.min(scaleX, scaleY, 1.0));

        const scaledW = imgW * state.scanner.zoom;
        const scaledH = imgH * state.scanner.zoom;
        state.scanner.panX = Math.round((vpRect.width - scaledW) / 2);
        state.scanner.panY = Math.round((vpRect.height - scaledH) / 2);
        updateCanvasTransform();
    }

    function clientToImageCoords(clientX, clientY) {
        const img = elements.canvasImage;
        if (!img) return { x: 0, y: 0 };
        const rect = img.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: 0, y: 0 };
        const origW = state.scanner.activeImage?.width || rect.width;
        const origH = state.scanner.activeImage?.height || rect.height;
        const scaleX = origW / rect.width;
        const scaleY = origH / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        return {
            x: Math.max(0, Math.min(origW, x)),
            y: Math.max(0, Math.min(origH, y))
        };
    }

    function renderCanvas() {
        const activeImg = state.scanner.activeImage;
        if (!activeImg) {
            if (elements.canvasEmptyState) elements.canvasEmptyState.classList.remove('hidden');
            if (elements.canvasImage) {
                elements.canvasImage.src = '';
                elements.canvasImage.style.width = '0px';
                elements.canvasImage.style.height = '0px';
            }
            if (elements.canvasStage) {
                elements.canvasStage.style.width = '0px';
                elements.canvasStage.style.height = '0px';
            }
            if (elements.canvasSvg) {
                elements.canvasSvg.innerHTML = '';
            }
            if (elements.scannerActiveImgName) elements.scannerActiveImgName.textContent = '-';
            if (elements.qualityAdvisoryTitle) elements.qualityAdvisoryTitle.textContent = 'Quality Check';
            if (elements.qualityAdvisoryText) elements.qualityAdvisoryText.textContent = 'No image loaded';
            if (elements.countImageProducts) elements.countImageProducts.textContent = '0';
            if (elements.detectedProductsList) {
                elements.detectedProductsList.innerHTML = '<p class="text-muted" style="padding:10px 0; font-size:12px;">No products detected yet.</p>';
            }
            return;
        }

        if (elements.canvasEmptyState) elements.canvasEmptyState.classList.add('hidden');
        if (elements.canvasImage) {
            elements.canvasImage.src = activeImg.data_url || '';
            elements.canvasImage.style.width = `${activeImg.width}px`;
            elements.canvasImage.style.height = `${activeImg.height}px`;
        }

        if (elements.canvasStage) {
            elements.canvasStage.style.width = `${activeImg.width}px`;
            elements.canvasStage.style.height = `${activeImg.height}px`;
        }

        if (elements.canvasSvg) {
            elements.canvasSvg.setAttribute('viewBox', `0 0 ${activeImg.width} ${activeImg.height}`);
            elements.canvasSvg.setAttribute('width', activeImg.width);
            elements.canvasSvg.setAttribute('height', activeImg.height);
            elements.canvasSvg.style.width = `${activeImg.width}px`;
            elements.canvasSvg.style.height = `${activeImg.height}px`;
        }

        if (elements.scannerActiveImgName) {
            elements.scannerActiveImgName.textContent = activeImg.name;
        }

        // Quality advisory
        if (elements.cardQualityAdvisory && elements.qualityAdvisoryTitle && elements.qualityAdvisoryText) {
            const qual = activeImg.quality || {};
            if (qual.warning) {
                elements.qualityAdvisoryTitle.textContent = 'Quality Warning ⚠️';
                elements.qualityAdvisoryTitle.style.color = 'var(--accent-orange, #f59e0b)';
                elements.qualityAdvisoryText.textContent = qual.warning;
            } else {
                elements.qualityAdvisoryTitle.textContent = 'Quality: Optimal ✓';
                elements.qualityAdvisoryTitle.style.color = 'var(--accent-green, #10b981)';
                elements.qualityAdvisoryText.textContent = `Sharpness (Laplacian: ${qual.laplacian_variance || 0}) and lighting are optimal.`;
            }
        }

        renderSvgBoxes();
        renderDetectionsList();
    }

    function renderSvgBoxes() {
        if (!elements.canvasSvg || !state.scanner.activeImage) return;
        const products = state.scanner.activeImage.products || [];

        // Clear existing elements, but keep temp-cut-rect if currently cutting
        const tempRect = elements.canvasSvg.querySelector('#temp-cut-rect');
        elements.canvasSvg.innerHTML = '';
        if (tempRect) elements.canvasSvg.appendChild(tempRect);

        products.forEach(p => {
            const isSelected = state.scanner.selectedProductId === p.id;
            const isManual = p.source === 'manual';

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `svg-product-box svg-bbox ${isSelected ? 'selected' : ''} ${isManual ? 'manual' : ''}`);
            g.setAttribute('data-product-id', p.id);

            // Box rectangle
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('class', 'box-rect svg-bbox-rect');
            rect.setAttribute('x', p.x);
            rect.setAttribute('y', p.y);
            rect.setAttribute('width', p.width);
            rect.setAttribute('height', p.height);
            rect.setAttribute('rx', '4');
            rect.setAttribute('fill', isManual ? 'rgba(14, 165, 233, 0.18)' : 'rgba(16, 185, 129, 0.18)');
            rect.setAttribute('stroke', isSelected ? '#38bdf8' : (isManual ? '#0ea5e9' : '#10b981'));
            rect.setAttribute('stroke-width', isSelected ? '4' : '3');
            rect.setAttribute('vector-effect', 'non-scaling-stroke');
            g.appendChild(rect);

            // Label pill
            const labelText = `Product ${p.product_index}${isManual ? ' (Manual)' : ''}`;
            const labelWidth = Math.max(90, labelText.length * 8 + 16);
            const labelY = Math.max(0, p.y - 24);

            const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            labelBg.setAttribute('class', 'box-label-bg svg-bbox-label-bg');
            labelBg.setAttribute('x', p.x);
            labelBg.setAttribute('y', labelY);
            labelBg.setAttribute('width', labelWidth);
            labelBg.setAttribute('height', '22');
            labelBg.setAttribute('rx', '4');
            labelBg.setAttribute('fill', isManual ? '#0ea5e9' : '#10b981');
            g.appendChild(labelBg);

            const labelTextEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelTextEl.setAttribute('class', 'box-label-text svg-bbox-label-text');
            labelTextEl.setAttribute('x', p.x + 8);
            labelTextEl.setAttribute('y', labelY + 15);
            labelTextEl.setAttribute('fill', '#000000');
            labelTextEl.setAttribute('font-size', '11');
            labelTextEl.setAttribute('font-weight', '700');
            labelTextEl.setAttribute('font-family', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');
            labelTextEl.textContent = labelText;
            g.appendChild(labelTextEl);

            // 8 Resize handles if selected
            if (isSelected) {
                const handles = [
                    { name: 'nw', x: p.x - 5, y: p.y - 5 },
                    { name: 'n',  x: p.x + p.width / 2 - 5, y: p.y - 5 },
                    { name: 'ne', x: p.x + p.width - 5, y: p.y - 5 },
                    { name: 'e',  x: p.x + p.width - 5, y: p.y + p.height / 2 - 5 },
                    { name: 'se', x: p.x + p.width - 5, y: p.y + p.height - 5 },
                    { name: 's',  x: p.x + p.width / 2 - 5, y: p.y + p.height - 5 },
                    { name: 'sw', x: p.x - 5, y: p.y + p.height - 5 },
                    { name: 'w',  x: p.x - 5, y: p.y + p.height / 2 - 5 }
                ];

                handles.forEach(h => {
                    const handleEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    handleEl.setAttribute('class', `handle svg-bbox-handle handle-${h.name}`);
                    handleEl.setAttribute('x', h.x);
                    handleEl.setAttribute('y', h.y);
                    handleEl.setAttribute('width', '10');
                    handleEl.setAttribute('height', '10');
                    handleEl.setAttribute('rx', '2');
                    handleEl.setAttribute('fill', '#ffffff');
                    handleEl.setAttribute('stroke', '#0284c7');
                    handleEl.setAttribute('stroke-width', '2');
                    handleEl.setAttribute('vector-effect', 'non-scaling-stroke');
                    handleEl.setAttribute('data-handle', h.name);
                    g.appendChild(handleEl);
                });
            }

            elements.canvasSvg.appendChild(g);
        });
    }

    function updateSingleSvgBox(p) {
        if (!elements.canvasSvg) return;
        const g = elements.canvasSvg.querySelector(`.svg-product-box[data-product-id="${p.id}"]`);
        if (!g) return;

        const rect = g.querySelector('.box-rect');
        if (rect) {
            rect.setAttribute('x', p.x);
            rect.setAttribute('y', p.y);
            rect.setAttribute('width', p.width);
            rect.setAttribute('height', p.height);
        }

        const labelY = Math.max(0, p.y - 24);
        const labelBg = g.querySelector('.box-label-bg');
        if (labelBg) {
            labelBg.setAttribute('x', p.x);
            labelBg.setAttribute('y', labelY);
        }

        const labelTextEl = g.querySelector('.box-label-text');
        if (labelTextEl) {
            labelTextEl.setAttribute('x', p.x + 8);
            labelTextEl.setAttribute('y', labelY + 15);
        }

        const handles = [
            { name: 'nw', x: p.x - 5, y: p.y - 5 },
            { name: 'n',  x: p.x + p.width / 2 - 5, y: p.y - 5 },
            { name: 'ne', x: p.x + p.width - 5, y: p.y - 5 },
            { name: 'e',  x: p.x + p.width - 5, y: p.y + p.height / 2 - 5 },
            { name: 'se', x: p.x + p.width - 5, y: p.y + p.height - 5 },
            { name: 's',  x: p.x + p.width / 2 - 5, y: p.y + p.height - 5 },
            { name: 'sw', x: p.x - 5, y: p.y + p.height - 5 },
            { name: 'w',  x: p.x - 5, y: p.y + p.height / 2 - 5 }
        ];

        handles.forEach(h => {
            const handleEl = g.querySelector(`.handle-${h.name}`);
            if (handleEl) {
                handleEl.setAttribute('x', h.x);
                handleEl.setAttribute('y', h.y);
            }
        });
    }

    let rafDragPending = false;
    let pendingDragBox = null;
    function requestUpdateSvgBox(p) {
        pendingDragBox = p;
        if (rafDragPending) return;
        rafDragPending = true;
        requestAnimationFrame(() => {
            if (pendingDragBox) {
                updateSingleSvgBox(pendingDragBox);
            }
            rafDragPending = false;
        });
    }

    function renderDetectionsList() {
        if (!elements.detectedProductsList || !state.scanner.activeImage) return;
        const products = state.scanner.activeImage.products || [];

        if (elements.countImageProducts) {
            elements.countImageProducts.textContent = products.length;
        }

        if (products.length === 0) {
            elements.detectedProductsList.innerHTML = '<p class="text-muted" style="padding:10px 0; font-size:12px;">No products detected yet.</p>';
            return;
        }

        elements.detectedProductsList.innerHTML = '';
        const fragment = document.createDocumentFragment();

        products.forEach(p => {
            const isSelected = state.scanner.selectedProductId === p.id;
            const itemEl = document.createElement('div');
            itemEl.className = `detection-list-item detected-prod-item ${isSelected ? 'selected' : ''}`;
            itemEl.dataset.productId = p.id;

            const isManual = p.source === 'manual';
            itemEl.innerHTML = `
                <div class="detection-info detected-prod-left">
                    <span class="detection-badge detected-prod-badge ${isManual ? 'manual badge-manual' : 'ai badge-ai'}">${isManual ? 'Manual Cut' : 'AI'}</span>
                    <span class="detection-title">Product ${p.product_index}</span>
                    <span class="detection-dims">${Math.round(p.width)}×${Math.round(p.height)}px</span>
                </div>
                <button class="btn-del-prod" title="Delete product">✕</button>
            `;

            itemEl.addEventListener('click', (e) => {
                if (e.target.closest('.btn-del-prod')) return;
                state.scanner.selectedProductId = p.id;
                renderSvgBoxes();
                renderDetectionsList();
            });

            itemEl.querySelector('.btn-del-prod').addEventListener('click', async (e) => {
                e.stopPropagation();
                await deleteProduct(p.id);
            });

            fragment.appendChild(itemEl);
        });

        elements.detectedProductsList.appendChild(fragment);
    }

    async function deleteProduct(productId) {
        if (!state.scanner.activeImage) return;
        const res = await Bridge.deleteDetectionProduct(state.scanner.activeImage.id, productId);
        if (res && res.status === 'success') {
            state.scanner.activeSession = res.session;
            state.scanner.activeImage = res.session.images.find(im => im.id === state.scanner.activeImage.id) || null;
            state.scanner.selectedProductId = null;
            renderCanvas();
            renderSessionThumbs();
            updateSafetyStats();
            showToast('Product removed', '🗑️');
        }
    }

    async function renderProductReviewGrid() {
        if (!elements.productsReviewGrid) return;
        elements.productsReviewGrid.innerHTML = '';
        const crops = state.scanner.crops || [];
        if (elements.reviewTotalCount) elements.reviewTotalCount.textContent = crops.length;

        const boxes = await Bridge.getStorageBoxes();
        const boxOptionsHtml = '<option value="">No Box</option>' + boxes.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join('');

        // Populate batch box dropdown in review toolbar
        if (elements.batchBoxSelect) {
            const currentVal = elements.batchBoxSelect.value;
            elements.batchBoxSelect.innerHTML = '<option value="">Select Box...</option>' + boxes.map(b => `<option value="${escapeHtml(b.name)}">${escapeHtml(b.name)}</option>`).join('');
            if (currentVal) elements.batchBoxSelect.value = currentVal;
        }

        const fragment = document.createDocumentFragment();
        crops.forEach((crop, idx) => {
            const card = document.createElement('div');
            card.className = 'product-review-card';
            card.dataset.index = idx;
            card.dataset.cropId = crop.id;

            const isManual = crop.source === 'manual';
            const dimText = `${crop.width || 0}×${crop.height || 0}`;
            const modelBadge = crop.model_name || 'AI HD';
            const isHd = crop.is_hd !== false;

            card.innerHTML = `
                <div class="crop-preview-wrap" title="Click to inspect product">
                    <img src="${crop.crop_b64 || ''}" alt="${escapeHtml(crop.name)}" class="crop-preview-img">
                    <span class="crop-badge ${isManual ? 'manual' : 'ai'}">${isManual ? 'Manual Cut' : 'AI'}</span>
                    ${isHd ? `<span class="hd-badge" title="AI Model: ${escapeHtml(modelBadge)}">✨ ${escapeHtml(modelBadge)} • ${dimText}</span>` : ''}
                </div>
                <div class="crop-details-form">
                    <div class="meta-field-row">
                        <label class="meta-label">Product Name</label>
                        <input type="text" class="meta-input input-crop-name" value="${escapeHtml(crop.name || `Product ${crop.product_index}`)}" placeholder="Enter name...">
                    </div>
                    <div class="meta-field-group" style="margin-top:6px;">
                        <div class="meta-field-col">
                            <label class="meta-label">Code / SKU</label>
                            <input type="text" class="meta-input input-crop-code" value="${escapeHtml(crop.code || '')}" placeholder="e.g. ZF01">
                        </div>
                        <div class="meta-field-col">
                            <label class="meta-label">Storage Box</label>
                            <select class="meta-input meta-select select-crop-box">
                                ${boxOptionsHtml}
                            </select>
                        </div>
                    </div>
                    <div class="crop-card-footer">
                        <div class="crop-footer-left">
                            <button class="btn-secondary-micro btn-retake-crop" title="Retake photo for only this specific product">
                                <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                <span>Retake</span>
                            </button>
                            <button class="btn-secondary-micro btn-enhance-crop" title="Re-enhance with selected AI model">
                                <svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                <span>Enhance</span>
                            </button>
                        </div>
                        <button class="btn-del-crop btn-danger-outline btn-micro" title="Discard this product">Discard</button>
                    </div>
                </div>
            `;

            const selectBox = card.querySelector('.select-crop-box');
            if (selectBox && crop.box) {
                selectBox.value = crop.box;
            }

            // Live input updates
            card.querySelector('.input-crop-name').addEventListener('input', (e) => {
                crop.name = e.target.value;
            });
            card.querySelector('.input-crop-name').addEventListener('blur', (e) => {
                crop.name = e.target.value.trim();
            });
            card.querySelector('.input-crop-code').addEventListener('input', (e) => {
                crop.code = e.target.value;
            });
            card.querySelector('.input-crop-code').addEventListener('blur', (e) => {
                crop.code = e.target.value.trim();
            });
            selectBox.addEventListener('change', (e) => {
                crop.box = e.target.value;
            });

            // Click crop preview to inspect in viewer modal
            card.querySelector('.crop-preview-wrap').addEventListener('click', (e) => {
                if (e.target.closest('.btn-retake-crop') || e.target.closest('.btn-enhance-crop')) return;
                openProductViewer(crops, idx);
            });

            // Single Product Retake
            card.querySelector('.btn-retake-crop').addEventListener('click', async (e) => {
                e.stopPropagation();
                const choice = confirm(`Retake photo for "${crop.name || 'this product'}"?\n\n• Click OK to use live Camera\n• Click Cancel to select an Image File from disk\n\n(All other products, codes, and boxes remain unchanged!)`);
                if (choice) {
                    state.scanner.retakeTargetCropId = crop.id;
                    openCameraModal();
                } else {
                    const file = await Bridge.selectImageFile();
                    if (file) {
                        const model = getSelectedScalerModel();
                        showToast(`Enhancing retaken photo with ${model}...`, '✨');
                        const res = await Bridge.retakeProductCrop(crop.id, file, null, true, model);
                        if (res && res.status === 'success') {
                            if (res.product) {
                                crops[idx] = { ...crops[idx], ...res.product, crop_path: res.crop_path, raw_crop_path: res.raw_crop_path, crop_b64: res.crop_b64, width: res.width, height: res.height, enhanced_width: res.width, enhanced_height: res.height, model_name: res.model_name, is_hd: true, enhanced: true };
                            } else {
                                crop.crop_path = res.crop_path;
                                crop.raw_crop_path = res.raw_crop_path;
                                crop.crop_b64 = res.crop_b64;
                                crop.width = res.width;
                                crop.height = res.height;
                                crop.enhanced_width = res.width;
                                crop.enhanced_height = res.height;
                                crop.model_name = res.model_name;
                                crop.is_hd = true;
                                crop.enhanced = true;
                            }
                            renderProductReviewGrid();
                            showToast(`Product photo updated with ${res.model_name || 'AI'} in HD!`, '✓');
                        } else {
                            showToast(res ? res.message : 'Retake failed', '⚠️');
                        }
                    }
                }
            });

            // Single Product Re-enhance / Upscale
            card.querySelector('.btn-enhance-crop').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!crop.crop_path) return;
                const model = getSelectedScalerModel();
                showToast(`Upscaling & enhancing with ${model}...`, '✨');
                const res = await Bridge.upscaleProductCrop(crop.crop_path, 4, model);
                if (res && res.status === 'success') {
                    crop.crop_b64 = res.crop_b64;
                    crop.width = res.width;
                    crop.height = res.height;
                    crop.enhanced_width = res.width;
                    crop.enhanced_height = res.height;
                    crop.model_name = res.model_name;
                    crop.is_hd = true;
                    crop.enhanced = true;
                    renderProductReviewGrid();
                    showToast(`Enhanced with ${res.model_name} to ${res.width}×${res.height} px!`, '✨');
                } else {
                    showToast('Enhancement failed', '⚠️');
                }
            });

            // Discard crop
            card.querySelector('.btn-del-crop').addEventListener('click', () => {
                crops.splice(idx, 1);
                renderProductReviewGrid();
                showToast('Product discarded', '🗑️');
            });

            fragment.appendChild(card);
        });

        elements.productsReviewGrid.appendChild(fragment);
    }

    function setupCameraModal() {
        if (!elements.cameraModal) return;

        const closeCamera = () => {
            if (state.scanner.cameraStream) {
                state.scanner.cameraStream.getTracks().forEach(t => t.stop());
                state.scanner.cameraStream = null;
            }
            if (elements.cameraVideo) elements.cameraVideo.srcObject = null;
            elements.cameraModal.classList.add('hidden');
            state.scanner.retakeTargetImageId = null;
            state.scanner.retakeTargetCropId = null;
        };

        if (elements.cameraClose) elements.cameraClose.addEventListener('click', closeCamera);
        const backdrop = elements.cameraModal.querySelector('.lightbox-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeCamera);

        const startCamera = async () => {
            if (elements.cameraErrorWrap) elements.cameraErrorWrap.classList.add('hidden');
            if (state.scanner.cameraStream) {
                state.scanner.cameraStream.getTracks().forEach(t => t.stop());
            }

            try {
                const constraints = {
                    video: {
                        facingMode: state.scanner.cameraFacing,
                        width: { ideal: 1920 },
                        height: { ideal: 1080 }
                    },
                    audio: false
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                state.scanner.cameraStream = stream;
                if (elements.cameraVideo) {
                    elements.cameraVideo.srcObject = stream;
                    elements.cameraVideo.play();
                }
            } catch (err) {
                console.error('[ZFound] Camera error:', err);
                if (elements.cameraErrorWrap) {
                    elements.cameraErrorWrap.classList.remove('hidden');
                    if (elements.cameraErrorMsg) {
                        elements.cameraErrorMsg.textContent = 'Camera not accessible or permission denied. You can upload an image file instead.';
                    }
                }
            }
        };

        if (elements.btnCameraSwitch) {
            elements.btnCameraSwitch.addEventListener('click', () => {
                state.scanner.cameraFacing = (state.scanner.cameraFacing === 'user') ? 'environment' : 'user';
                startCamera();
            });
        }

        if (elements.btnCameraFallbackUpload) {
            elements.btnCameraFallbackUpload.addEventListener('click', async () => {
                closeCamera();
                if (elements.btnScannerUpload) elements.btnScannerUpload.click();
            });
        }

        if (elements.btnCameraSnap) {
            elements.btnCameraSnap.addEventListener('click', async () => {
                const video = elements.cameraVideo;
                if (!video || !video.videoWidth || !video.videoHeight) {
                    showToast('Camera not ready', '⚠️');
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

                showToast('Processing photo with PP-PicoDet-XS...', '📸');

                // Single-Product Crop Retake
                if (state.scanner.retakeTargetCropId) {
                    const retakeCropId = state.scanner.retakeTargetCropId;
                    closeCamera();
                    const model = getSelectedScalerModel();
                    showToast(`Enhancing retaken photo with ${model}...`, '✨');
                    const res = await Bridge.retakeProductCrop(retakeCropId, null, dataUrl, true, model);
                    if (res && res.status === 'success') {
                        const cropIndex = (state.scanner.crops || []).findIndex(c => c.id === retakeCropId);
                        if (cropIndex !== -1) {
                            if (res.product) {
                                state.scanner.crops[cropIndex] = { ...state.scanner.crops[cropIndex], ...res.product, crop_path: res.crop_path, raw_crop_path: res.raw_crop_path, crop_b64: res.crop_b64, width: res.width, height: res.height, enhanced_width: res.width, enhanced_height: res.height, model_name: res.model_name, is_hd: true, enhanced: true };
                            } else {
                                state.scanner.crops[cropIndex].crop_path = res.crop_path;
                                state.scanner.crops[cropIndex].raw_crop_path = res.raw_crop_path;
                                state.scanner.crops[cropIndex].crop_b64 = res.crop_b64;
                                state.scanner.crops[cropIndex].width = res.width;
                                state.scanner.crops[cropIndex].height = res.height;
                                state.scanner.crops[cropIndex].enhanced_width = res.width;
                                state.scanner.crops[cropIndex].enhanced_height = res.height;
                                state.scanner.crops[cropIndex].model_name = res.model_name;
                                state.scanner.crops[cropIndex].is_hd = true;
                                state.scanner.crops[cropIndex].enhanced = true;
                            }
                            renderProductReviewGrid();
                            showToast(`Product photo updated with ${res.model_name || 'AI'} in HD!`, '✓');
                        }
                    } else {
                        showToast(res ? res.message : 'Retake failed', '⚠️');
                    }
                    return;
                }

                // Whole Session Image Retake
                if (state.scanner.retakeTargetImageId) {
                    const retakeId = state.scanner.retakeTargetImageId;
                    closeCamera();
                    const res = await Bridge.retakeSessionImage(retakeId, null, dataUrl);
                    if (res && res.status === 'success') {
                        state.scanner.activeSession = res.session;
                        state.scanner.activeImage = res.session.images.find(im => im.id === retakeId) || null;
                        renderCanvas();
                        zoomFitCanvas();
                        renderSessionThumbs();
                        updateSafetyStats();
                        showToast('Image retaken successfully!', '✓');
                    } else {
                        showToast('Retake failed', '⚠️');
                    }
                } else {
                    closeCamera();
                    const res = await Bridge.captureWebcamImage(dataUrl);
                    if (res && res.status === 'success') {
                        state.scanner.activeSession = res.session;
                        const imgs = res.session.images || [];
                        state.scanner.activeImage = imgs[imgs.length - 1] || null;
                        renderCanvas();
                        zoomFitCanvas();
                        renderSessionThumbs();
                        updateSafetyStats();
                        showToast('Photo added to session!', '✓');
                    } else {
                        showToast('Error capturing photo', '⚠️');
                    }
                }
            });
        }

        window.openCameraModal = () => {
            elements.cameraModal.classList.remove('hidden');
            startCamera();
        };
    }

    function setupScanner() {
        setupCameraModal();

        // Upload images button
        if (elements.btnScannerUpload) {
            elements.btnScannerUpload.addEventListener('click', async () => {
                const files = await Bridge.selectMultipleImages();
                if (files && files.length > 0) {
                    showToast(`Analyzing ${files.length} image(s) with PP-PicoDet-XS...`, '🔍');
                    const sess = await Bridge.addSessionImages(files);
                    if (sess) {
                        state.scanner.activeSession = sess;
                        state.scanner.activeImage = sess.images[sess.images.length - 1] || null;
                        renderSessionThumbs();
                        renderCanvas();
                        zoomFitCanvas();
                        updateSafetyStats();
                        showToast('Discovered products with PP-PicoDet-XS', '✓');
                    }
                } else if (!window.pywebview || !window.pywebview.api) {
                    if (elements.scannerFileInput) elements.scannerFileInput.click();
                }
            });
        }

        if (elements.scannerFileInput) {
            elements.scannerFileInput.addEventListener('change', async (e) => {
                const fileList = Array.from(e.target.files || []);
                if (fileList.length === 0) return;
                showToast(`Reading ${fileList.length} image(s)...`, '🔍');
                for (const file of fileList) {
                    const reader = new FileReader();
                    reader.onload = async (re) => {
                        const dataUrl = re.target.result;
                        const res = await Bridge.captureWebcamImage(dataUrl);
                        if (res && res.session) {
                            state.scanner.activeSession = res.session;
                            state.scanner.activeImage = res.session.images[res.session.images.length - 1] || null;
                            renderSessionThumbs();
                            renderCanvas();
                            zoomFitCanvas();
                            updateSafetyStats();
                        }
                    };
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            });
        }

        // Empty state browse button & drag-and-drop
        if (elements.btnEmptyStateBrowse) {
            elements.btnEmptyStateBrowse.addEventListener('click', (e) => {
                e.stopPropagation();
                if (elements.btnScannerUpload) elements.btnScannerUpload.click();
            });
        }

        if (elements.canvasEmptyState) {
            elements.canvasEmptyState.addEventListener('click', (e) => {
                if (e.target.closest('#btn-empty-state-browse')) return;
                if (elements.btnScannerUpload) elements.btnScannerUpload.click();
            });

            elements.canvasEmptyState.addEventListener('dragenter', (e) => {
                e.preventDefault();
                elements.canvasEmptyState.setAttribute('data-state', 'drag');
            });

            elements.canvasEmptyState.addEventListener('dragover', (e) => {
                e.preventDefault();
                elements.canvasEmptyState.setAttribute('data-state', 'drag');
            });

            elements.canvasEmptyState.addEventListener('dragleave', () => {
                elements.canvasEmptyState.setAttribute('data-state', 'idle');
            });

            elements.canvasEmptyState.addEventListener('drop', async (e) => {
                e.preventDefault();
                elements.canvasEmptyState.setAttribute('data-state', 'idle');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const files = Array.from(e.dataTransfer.files);
                    const paths = files.map(f => f.path ? f.path.replace(/\\/g, '/') : null).filter(Boolean);
                    if (paths.length > 0) {
                        showToast(`Analyzing ${paths.length} dropped image(s) with PP-PicoDet-XS...`, '🔍');
                        const sess = await Bridge.addSessionImages(paths);
                        if (sess) {
                            state.scanner.activeSession = sess;
                            state.scanner.activeImage = sess.images[sess.images.length - 1] || null;
                            renderSessionThumbs();
                            renderCanvas();
                            zoomFitCanvas();
                            updateSafetyStats();
                            showToast('Discovered products with PP-PicoDet-XS', '✓');
                        }
                    }
                }
            });
        }

        // Camera button
        if (elements.btnScannerCamera) {
            elements.btnScannerCamera.addEventListener('click', () => {
                state.scanner.retakeTargetImageId = null;
                openCameraModal();
            });
        }

        // Tool toggle
        if (elements.toolBtnSelect) {
            elements.toolBtnSelect.addEventListener('click', () => {
                state.scanner.tool = 'select';
                elements.toolBtnSelect.classList.add('active');
                if (elements.toolBtnCut) elements.toolBtnCut.classList.remove('active');
                if (elements.canvasViewport) elements.canvasViewport.style.cursor = 'default';
            });
        }

        if (elements.toolBtnCut) {
            elements.toolBtnCut.addEventListener('click', () => {
                state.scanner.tool = 'cut';
                elements.toolBtnCut.classList.add('active');
                if (elements.toolBtnSelect) elements.toolBtnSelect.classList.remove('active');
                if (elements.canvasViewport) elements.canvasViewport.style.cursor = 'crosshair';
                showToast('Manual Cut active: Click & drag on image to draw box', '✂️');
            });
        }

        // Zoom buttons
        if (elements.btnZoomIn) {
            elements.btnZoomIn.addEventListener('click', () => {
                state.scanner.zoom = Math.min(5.0, state.scanner.zoom + 0.25);
                updateCanvasTransform();
            });
        }

        if (elements.btnZoomOut) {
            elements.btnZoomOut.addEventListener('click', () => {
                state.scanner.zoom = Math.max(0.2, state.scanner.zoom - 0.25);
                updateCanvasTransform();
            });
        }

        if (elements.btnZoom100) {
            elements.btnZoom100.addEventListener('click', () => {
                state.scanner.zoom = 1.0;
                state.scanner.panX = 0;
                state.scanner.panY = 0;
                updateCanvasTransform();
            });
        }

        if (elements.btnZoomFit) {
            elements.btnZoomFit.addEventListener('click', zoomFitCanvas);
        }

        // Canvas wheel zoom
        if (elements.canvasViewport) {
            elements.canvasViewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (!state.scanner.activeImage) return;
                const factor = e.deltaY < 0 ? 1.15 : 0.85;
                state.scanner.zoom = Math.max(0.15, Math.min(5.0, state.scanner.zoom * factor));
                updateCanvasTransform();
            }, { passive: false });
        }

        // Canvas Mouse Down
        if (elements.canvasViewport) {
            elements.canvasViewport.addEventListener('mousedown', (e) => {
                if (!state.scanner.activeImage) return;

                // Middle click, space key, or background click in select tool -> Pan
                if (e.button === 1 || e.spaceKey || (state.scanner.tool === 'select' && !e.target.closest('.svg-product-box'))) {
                    state.scanner.isPanning = true;
                    state.scanner.panStartX = e.clientX - state.scanner.panX;
                    state.scanner.panStartY = e.clientY - state.scanner.panY;
                    if (elements.canvasViewport) elements.canvasViewport.style.cursor = 'grabbing';
                    if (state.scanner.tool === 'select' && !e.target.closest('.svg-product-box')) {
                        state.scanner.selectedProductId = null;
                        renderSvgBoxes();
                        renderDetectionsList();
                    }
                    return;
                }

                const imgCoords = clientToImageCoords(e.clientX, e.clientY);

                if (state.scanner.tool === 'cut') {
                    state.scanner.isCutting = true;
                    state.scanner.cutStartX = imgCoords.x;
                    state.scanner.cutStartY = imgCoords.y;

                    let tempRect = elements.canvasSvg.querySelector('#temp-cut-rect');
                    if (!tempRect) {
                        tempRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                        tempRect.setAttribute('id', 'temp-cut-rect');
                        tempRect.setAttribute('class', 'box-rect temp-cut-box svg-drawing-rect');
                        tempRect.setAttribute('fill', 'rgba(14, 165, 233, 0.22)');
                        tempRect.setAttribute('stroke', '#0ea5e9');
                        tempRect.setAttribute('stroke-width', '2.5');
                        tempRect.setAttribute('stroke-dasharray', '4 3');
                        tempRect.setAttribute('vector-effect', 'non-scaling-stroke');
                        elements.canvasSvg.appendChild(tempRect);
                    }
                    tempRect.setAttribute('x', imgCoords.x);
                    tempRect.setAttribute('y', imgCoords.y);
                    tempRect.setAttribute('width', 0);
                    tempRect.setAttribute('height', 0);
                    return;
                }

                // Select Tool: check if clicked on handle
                const handleEl = e.target.closest('.handle');
                if (handleEl) {
                    const boxGroup = handleEl.closest('.svg-product-box');
                    const pId = boxGroup?.dataset.productId;
                    const prod = (state.scanner.activeImage.products || []).find(p => p.id === pId);
                    if (prod) {
                        state.scanner.dragTarget = {
                            type: 'handle',
                            productId: pId,
                            handle: handleEl.dataset.handle,
                            startX: imgCoords.x,
                            startY: imgCoords.y,
                            origBox: { ...prod }
                        };
                    }
                    return;
                }

                // Select Tool: check if clicked on product box
                const boxGroup = e.target.closest('.svg-product-box');
                if (boxGroup) {
                    const pId = boxGroup.dataset.productId;
                    const prod = (state.scanner.activeImage.products || []).find(p => p.id === pId);
                    if (prod) {
                        state.scanner.selectedProductId = pId;
                        renderSvgBoxes();
                        renderDetectionsList();
                        state.scanner.dragTarget = {
                            type: 'move',
                            productId: pId,
                            startX: imgCoords.x,
                            startY: imgCoords.y,
                            origBox: { ...prod }
                        };
                    }
                }
            });
        }

        // Window Mouse Move
        window.addEventListener('mousemove', (e) => {
            if (state.scanner.isPanning) {
                state.scanner.panX = e.clientX - state.scanner.panStartX;
                state.scanner.panY = e.clientY - state.scanner.panStartY;
                requestUpdateCanvasTransform();
                return;
            }

            if (state.scanner.isCutting) {
                const coords = clientToImageCoords(e.clientX, e.clientY);
                const x = Math.min(coords.x, state.scanner.cutStartX);
                const y = Math.min(coords.y, state.scanner.cutStartY);
                const w = Math.abs(coords.x - state.scanner.cutStartX);
                const h = Math.abs(coords.y - state.scanner.cutStartY);

                const tempRect = elements.canvasSvg?.querySelector('#temp-cut-rect');
                if (tempRect) {
                    tempRect.setAttribute('x', x);
                    tempRect.setAttribute('y', y);
                    tempRect.setAttribute('width', w);
                    tempRect.setAttribute('height', h);
                }
                return;
            }

            if (state.scanner.dragTarget && state.scanner.activeImage) {
                const dt = state.scanner.dragTarget;
                const coords = clientToImageCoords(e.clientX, e.clientY);
                const prod = (state.scanner.activeImage.products || []).find(p => p.id === dt.productId);
                if (!prod) return;

                const dx = coords.x - dt.startX;
                const dy = coords.y - dt.startY;
                const orig = dt.origBox;
                const maxW = state.scanner.activeImage.width;
                const maxH = state.scanner.activeImage.height;

                if (dt.type === 'move') {
                    prod.x = Math.max(0, Math.min(maxW - prod.width, Math.round(orig.x + dx)));
                    prod.y = Math.max(0, Math.min(maxH - prod.height, Math.round(orig.y + dy)));
                } else if (dt.type === 'handle') {
                    let newX = orig.x;
                    let newY = orig.y;
                    let newW = orig.width;
                    let newH = orig.height;

                    if (dt.handle.includes('w')) {
                        const proposedW = orig.width - dx;
                        if (proposedW >= 15) {
                            newX = Math.max(0, orig.x + dx);
                            newW = proposedW;
                        }
                    }
                    if (dt.handle.includes('e')) {
                        newW = Math.max(15, Math.min(maxW - newX, orig.width + dx));
                    }
                    if (dt.handle.includes('n')) {
                        const proposedH = orig.height - dy;
                        if (proposedH >= 15) {
                            newY = Math.max(0, orig.y + dy);
                            newH = proposedH;
                        }
                    }
                    if (dt.handle.includes('s')) {
                        newH = Math.max(15, Math.min(maxH - newY, orig.height + dy));
                    }

                    prod.x = Math.round(newX);
                    prod.y = Math.round(newY);
                    prod.width = Math.round(newW);
                    prod.height = Math.round(newH);
                }

                requestUpdateSvgBox(prod);
            }
        });

        // Window Mouse Up
        window.addEventListener('mouseup', async () => {
            if (state.scanner.isPanning) {
                state.scanner.isPanning = false;
                if (elements.canvasViewport) {
                    elements.canvasViewport.style.cursor = (state.scanner.tool === 'cut') ? 'crosshair' : 'default';
                }
            }

            if (state.scanner.isCutting && state.scanner.activeImage) {
                state.scanner.isCutting = false;
                const tempRect = elements.canvasSvg?.querySelector('#temp-cut-rect');
                if (tempRect) {
                    const x = parseFloat(tempRect.getAttribute('x')) || 0;
                    const y = parseFloat(tempRect.getAttribute('y')) || 0;
                    const w = parseFloat(tempRect.getAttribute('width')) || 0;
                    const h = parseFloat(tempRect.getAttribute('height')) || 0;
                    tempRect.remove();

                    if (w >= 15 && h >= 15) {
                        const res = await Bridge.addManualProduct(state.scanner.activeImage.id, x, y, w, h);
                        if (res && res.status === 'success') {
                            state.scanner.activeSession = res.session;
                            state.scanner.activeImage = res.session.images.find(im => im.id === state.scanner.activeImage.id) || null;
                            state.scanner.selectedProductId = res.product.id;
                            renderCanvas();
                            renderSessionThumbs();
                            updateSafetyStats();
                            showToast(`Manual product cut added: Product ${res.product.product_index}`, '✂️');
                        }
                    }
                }
            }

            if (state.scanner.dragTarget && state.scanner.activeImage) {
                const dt = state.scanner.dragTarget;
                state.scanner.dragTarget = null;
                const prod = (state.scanner.activeImage.products || []).find(p => p.id === dt.productId);
                if (prod) {
                    renderSvgBoxes();
                    renderDetectionsList();
                    await Bridge.updateDetectionBox(state.scanner.activeImage.id, prod.id, prod.x, prod.y, prod.width, prod.height);
                    updateSafetyStats();
                }
            }
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', async (e) => {
            if (state.activeView !== 'scanner') return;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

            if (e.key === 'v' || e.key === 'V') {
                if (elements.toolBtnSelect) elements.toolBtnSelect.click();
            } else if (e.key === 'c' || e.key === 'C') {
                if (elements.toolBtnCut) elements.toolBtnCut.click();
            } else if (e.key === '+' || e.key === '=') {
                if (elements.btnZoomIn) elements.btnZoomIn.click();
            } else if (e.key === '-' || e.key === '_') {
                if (elements.btnZoomOut) elements.btnZoomOut.click();
            } else if (e.key === 'f' || e.key === 'F') {
                if (elements.btnZoomFit) elements.btnZoomFit.click();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.scanner.selectedProductId) {
                e.preventDefault();
                await deleteProduct(state.scanner.selectedProductId);
            }
        });

        // Active image controls (Retake, Re-Analyze, Delete)
        if (elements.btnActiveRetake) {
            elements.btnActiveRetake.addEventListener('click', async () => {
                if (!state.scanner.activeImage) return;
                const choice = confirm(`Retake "${state.scanner.activeImage.name}"?\n\n• Click OK to take a live photo with camera.\n• Click Cancel to choose an image file from disk.\n\n(All other session images and entered data are completely preserved!)`);
                if (choice) {
                    state.scanner.retakeTargetImageId = state.scanner.activeImage.id;
                    openCameraModal();
                } else {
                    const file = await Bridge.selectImageFile();
                    if (file) {
                        showToast('Retaking image with PP-PicoDet-XS...', '🔄');
                        const res = await Bridge.retakeSessionImage(state.scanner.activeImage.id, file);
                        if (res && res.status === 'success') {
                            state.scanner.activeSession = res.session;
                            state.scanner.activeImage = res.session.images.find(im => im.id === state.scanner.activeImage.id) || null;
                            renderCanvas();
                            renderSessionThumbs();
                            updateSafetyStats();
                            showToast('Image retaken successfully!', '✓');
                        } else {
                            showToast(res ? res.message : 'Retake failed', '⚠️');
                        }
                    }
                }
            });
        }

        if (elements.btnActiveReanalyze) {
            elements.btnActiveReanalyze.addEventListener('click', async () => {
                if (!state.scanner.activeImage) return;
                showToast('Deep multi-pass re-analysis running (AI + Contrast + Contours)...', '🔄');
                const res = await Bridge.reanalyzeSessionImage(state.scanner.activeImage.id);
                if (res && res.status === 'success') {
                    state.scanner.activeSession = res.session;
                    state.scanner.activeImage = res.session.images.find(im => im.id === state.scanner.activeImage.id) || null;
                    renderCanvas();
                    renderSessionThumbs();
                    updateSafetyStats();
                    showToast(res.message || 'Image re-analyzed!', '✓');
                } else {
                    showToast(res ? res.message : 'Re-analyze failed', '⚠️');
                }
            });
        }

        if (elements.btnActiveDelete) {
            elements.btnActiveDelete.addEventListener('click', async () => {
                if (!state.scanner.activeImage) return;
                if (confirm(`Remove "${state.scanner.activeImage.name}" from this scan session?`)) {
                    await deleteSessionImage(state.scanner.activeImage.id);
                }
            });
        }

        function getSelectedScalerModel() {
            if (elements.scalerModelSelect && elements.scalerModelSelect.value) {
                return elements.scalerModelSelect.value;
            }
            if (elements.canvasScalerSelect && elements.canvasScalerSelect.value) {
                return elements.canvasScalerSelect.value;
            }
            return 'realesrgan';
        }

        if (elements.canvasScalerSelect) {
            elements.canvasScalerSelect.addEventListener('change', (e) => {
                if (elements.scalerModelSelect) elements.scalerModelSelect.value = e.target.value;
            });
        }
        if (elements.scalerModelSelect) {
            elements.scalerModelSelect.addEventListener('change', (e) => {
                if (elements.canvasScalerSelect) elements.canvasScalerSelect.value = e.target.value;
            });
        }

        // Step 1 -> Step 2 Review Transition
        if (elements.btnScannerNext) {
            elements.btnScannerNext.addEventListener('click', async () => {
                const model = getSelectedScalerModel();
                showToast(`Generating ${model} upscaled & enhanced product crops...`, '✨');
                const crops = await Bridge.generateProductCrops(null, true, model);
                if (!crops || crops.length === 0) {
                    showToast('No products detected to review', '⚠️');
                    return;
                }
                state.scanner.crops = crops;
                renderProductReviewGrid();
                if (elements.scannerSessionBar) elements.scannerSessionBar.classList.add('hidden');
                if (elements.scannerStepCanvas) elements.scannerStepCanvas.classList.add('hidden');
                if (elements.scannerStepReview) elements.scannerStepReview.classList.remove('hidden');
            });
        }

        if (elements.btnBackToCanvas) {
            elements.btnBackToCanvas.addEventListener('click', () => {
                if (elements.scannerStepReview) elements.scannerStepReview.classList.add('hidden');
                if (elements.scannerSessionBar) elements.scannerSessionBar.classList.remove('hidden');
                if (elements.scannerStepCanvas) elements.scannerStepCanvas.classList.remove('hidden');
                renderCanvas();
                zoomFitCanvas();
                updateSafetyStats();
            });
        }

        // Review Toolbar: Auto-Code Generator
        const applyAutoCode = () => {
            const rawVal = (elements.autoCodeInput ? elements.autoCodeInput.value.trim() : '') || 'ZF01';
            const match = rawVal.match(/^(.*?)(\d+)$/);
            let prefix = 'ZF';
            let startNum = 1;
            let padLength = 2;

            if (match) {
                prefix = match[1];
                startNum = parseInt(match[2], 10);
                padLength = match[2].length;
            } else {
                prefix = rawVal;
                startNum = 1;
                padLength = 2;
            }

            const crops = state.scanner.crops || [];
            if (crops.length === 0) {
                showToast('No products in review grid', '⚠️');
                return;
            }

            crops.forEach((crop, i) => {
                const numStr = String(startNum + i).padStart(padLength, '0');
                crop.code = `${prefix}${numStr}`;
            });

            const cards = elements.productsReviewGrid?.querySelectorAll('.product-review-card');
            cards?.forEach((card, idx) => {
                const input = card.querySelector('.input-crop-code');
                if (input && crops[idx]) {
                    input.value = crops[idx].code;
                    input.classList.remove('flash-highlight');
                    void input.offsetWidth;
                    input.classList.add('flash-highlight');
                }
            });

            const firstCode = crops[0]?.code;
            const lastCode = crops[crops.length - 1]?.code;
            showToast(`Auto-assigned codes: ${firstCode} → ${lastCode}`, '⚡');
        };

        if (elements.btnAutoCodeApply) {
            elements.btnAutoCodeApply.addEventListener('click', applyAutoCode);
        }

        if (elements.autoCodeInput) {
            elements.autoCodeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyAutoCode();
                }
            });
        }

        // Review Toolbar: Batch Box Assignment
        const applyBatchBox = () => {
            const box = elements.batchBoxSelect ? elements.batchBoxSelect.value : '';
            if (!box) {
                showToast('Please select a storage box first', '⚠️');
                return;
            }
            const crops = state.scanner.crops || [];
            if (crops.length === 0) {
                showToast('No products in review grid', '⚠️');
                return;
            }

            crops.forEach(crop => {
                crop.box = box;
            });

            const cards = elements.productsReviewGrid?.querySelectorAll('.product-review-card');
            cards?.forEach((card, idx) => {
                const sel = card.querySelector('.select-crop-box');
                if (sel && crops[idx]) {
                    sel.value = crops[idx].box;
                    sel.classList.remove('flash-highlight');
                    void sel.offsetWidth;
                    sel.classList.add('flash-highlight');
                }
            });

            showToast(`Assigned ${crops.length} products to Box "${box}"`, '📦');
        };

        if (elements.btnBatchBoxApply) {
            elements.btnBatchBoxApply.addEventListener('click', applyBatchBox);
        }

        // Review Toolbar: Upscale All Crops
        const upscaleAllCrops = async () => {
            const crops = state.scanner.crops || [];
            if (crops.length === 0) {
                showToast('No products in review grid', '⚠️');
                return;
            }

            const model = getSelectedScalerModel();
            if (elements.btnUpscaleAll) elements.btnUpscaleAll.disabled = true;
            showToast(`Upscaling & enhancing ${crops.length} crops with ${model}...`, '✨');

            let enhancedCount = 0;
            let lastModelLabel = 'AI HD';
            for (let i = 0; i < crops.length; i++) {
                const c = crops[i];
                if (c.crop_path) {
                    const res = await Bridge.upscaleProductCrop(c.crop_path, 4, model);
                    if (res && res.status === 'success') {
                        c.crop_b64 = res.crop_b64;
                        c.width = res.width;
                        c.height = res.height;
                        c.enhanced_width = res.width;
                        c.enhanced_height = res.height;
                        c.model_name = res.model_name;
                        c.is_hd = true;
                        c.enhanced = true;
                        lastModelLabel = res.model_name || lastModelLabel;
                        enhancedCount++;
                    }
                }
            }

            renderProductReviewGrid();
            if (elements.btnUpscaleAll) elements.btnUpscaleAll.disabled = false;
            showToast(`Enhanced ${enhancedCount} products with ${lastModelLabel}!`, '✨');
        };

        if (elements.btnUpscaleAll) {
            elements.btnUpscaleAll.addEventListener('click', upscaleAllCrops);
        }

        // Save to Inventory
        if (elements.btnSaveInventory) {
            elements.btnSaveInventory.addEventListener('click', async () => {
                if (!state.scanner.crops || state.scanner.crops.length === 0) {
                    showToast('No products to save', '⚠️');
                    return;
                }

                elements.btnSaveInventory.disabled = true;
                if (elements.labelSaveInventory) elements.labelSaveInventory.textContent = 'Saving...';

                try {
                    const res = await Bridge.saveInventoryProducts(state.scanner.crops);
                    if (res && res.status === 'success') {
                        showToast(`Saved ${res.count} products to inventory!`, '🎉');
                        state.scanner.crops = [];
                        state.scanner.activeSession = null;
                        state.scanner.activeImage = null;

                        if (elements.scannerStepReview) elements.scannerStepReview.classList.add('hidden');
                        if (elements.scannerSessionBar) elements.scannerSessionBar.classList.remove('hidden');
                        if (elements.scannerStepCanvas) elements.scannerStepCanvas.classList.remove('hidden');
                        renderCanvas();
                        renderSessionThumbs();
                        zoomFitCanvas();
                        updateSafetyStats();

                        // Switch to Storage view
                        const storageNavBtn = Array.from(elements.navItems).find(n => n.dataset.view === 'storage');
                        if (storageNavBtn) storageNavBtn.click();
                    } else {
                        showToast(res ? res.message : 'Save error', '⚠️');
                    }
                } catch (e) {
                    console.error('[ZFound] Save inventory error:', e);
                    showToast('Error saving inventory', '⚠️');
                } finally {
                    elements.btnSaveInventory.disabled = false;
                    if (elements.labelSaveInventory) elements.labelSaveInventory.textContent = 'Save to Inventory';
                }
            });
        }
    }

    /* ==========================================================================
       Storage Locations & Inventory Subsystem
       ========================================================================== */

    function setupStorage() {
        if (elements.btnCreateBox && elements.newBoxModal) {
            const closeNewBox = () => {
                elements.newBoxModal.classList.add('hidden');
                if (elements.inputNewBoxName) elements.inputNewBoxName.value = '';
                if (elements.inputNewBoxDesc) elements.inputNewBoxDesc.value = '';
            };

            elements.btnCreateBox.addEventListener('click', () => {
                elements.newBoxModal.classList.remove('hidden');
                if (elements.inputNewBoxName) elements.inputNewBoxName.focus();
            });

            if (elements.newBoxClose) elements.newBoxClose.addEventListener('click', closeNewBox);
            if (elements.btnCancelNewBox) elements.btnCancelNewBox.addEventListener('click', closeNewBox);

            if (elements.btnSaveNewBox) {
                elements.btnSaveNewBox.addEventListener('click', async () => {
                    const name = elements.inputNewBoxName ? elements.inputNewBoxName.value.trim() : '';
                    const desc = elements.inputNewBoxDesc ? elements.inputNewBoxDesc.value.trim() : '';
                    if (!name) {
                        showToast('Box name cannot be empty', '⚠️');
                        return;
                    }
                    const res = await Bridge.createStorageBox(name, desc);
                    if (res && res.status === 'success') {
                        showToast(`Created box: ${name}`, '📦');
                        closeNewBox();
                        loadStorageData();
                    } else {
                        showToast(res ? res.message : 'Error creating box', '⚠️');
                    }
                });
            }
        }

        if (elements.inventorySearchFilter) {
            elements.inventorySearchFilter.addEventListener('input', () => {
                state.storage.searchFilter = elements.inventorySearchFilter.value.trim();
                if (elements.btnClearInventoryFilter) {
                    elements.btnClearInventoryFilter.classList.toggle('hidden', !state.storage.searchFilter);
                }
                filterAndRenderInventory();
            });
        }

        if (elements.btnClearInventoryFilter) {
            elements.btnClearInventoryFilter.addEventListener('click', () => {
                elements.inventorySearchFilter.value = '';
                state.storage.searchFilter = '';
                elements.btnClearInventoryFilter.classList.add('hidden');
                filterAndRenderInventory();
            });
        }

        if (elements.selectInventoryBoxFilter) {
            elements.selectInventoryBoxFilter.addEventListener('change', (e) => {
                state.storage.selectedBoxFilter = e.target.value;
                filterAndRenderInventory();
            });
        }
    }

    async function loadStorageData() {
        try {
            const [boxes, inventory] = await Promise.all([
                Bridge.getStorageBoxes(),
                Bridge.getInventory()
            ]);
            state.storage.boxes = boxes || [];
            state.storage.inventory = inventory || [];

            renderStorageBoxes();
            updateBoxFilterDropdown();
            filterAndRenderInventory();
        } catch (e) {
            console.error('[ZFound] Error loading storage:', e);
        }
    }

    function renderStorageBoxes() {
        if (!elements.storageBoxesGrid) return;
        elements.storageBoxesGrid.innerHTML = '';
        const boxes = state.storage.boxes || [];

        if (elements.storageBoxCountBadge) {
            elements.storageBoxCountBadge.textContent = `${boxes.length} box${boxes.length === 1 ? '' : 'es'}`;
        }

        if (boxes.length === 0) {
            elements.storageBoxesGrid.innerHTML = '<div class="empty-state" style="padding:20px 0;"><p class="text-muted">No storage boxes yet. Click + New Box to create one.</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();
        boxes.forEach(box => {
            const card = document.createElement('div');
            const isSelected = state.storage.selectedBoxFilter === box.name;
            card.className = `storage-box-card ${isSelected ? 'active-box' : ''}`;
            card.innerHTML = `
                <div class="box-card-top">
                    <span class="box-icon">📦</span>
                    <span class="box-product-count">${box.product_count || 0} items</span>
                </div>
                <h4 class="box-name">${escapeHtml(box.name)}</h4>
                <p class="box-desc">${escapeHtml(box.description || 'General storage')}</p>
                <div class="box-card-actions">
                    <button class="btn-micro btn-view-box" title="Filter inventory by this box">View</button>
                    <button class="btn-micro btn-rename-box" title="Rename box">Rename</button>
                    <button class="btn-micro btn-danger-outline btn-del-box" title="Delete box">✕</button>
                </div>
            `;

            card.querySelector('.btn-view-box').addEventListener('click', (e) => {
                e.stopPropagation();
                if (state.storage.selectedBoxFilter === box.name) {
                    state.storage.selectedBoxFilter = '';
                } else {
                    state.storage.selectedBoxFilter = box.name;
                }
                if (elements.selectInventoryBoxFilter) elements.selectInventoryBoxFilter.value = state.storage.selectedBoxFilter;
                renderStorageBoxes();
                filterAndRenderInventory();
            });

            card.querySelector('.btn-rename-box').addEventListener('click', async (e) => {
                e.stopPropagation();
                const newName = prompt(`Rename box "${box.name}":`, box.name);
                if (newName && newName.trim() && newName.trim() !== box.name) {
                    const res = await Bridge.renameStorageBox(box.id, newName.trim());
                    if (res && res.status === 'success') {
                        showToast(`Renamed box to: ${newName.trim()}`, '✓');
                        loadStorageData();
                    } else {
                        showToast(res ? res.message : 'Rename failed', '⚠️');
                    }
                }
            });

            card.querySelector('.btn-del-box').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete storage box "${box.name}"? (Inventory items will remain intact)`)) {
                    await Bridge.deleteStorageBox(box.id);
                    showToast(`Deleted box: ${box.name}`, '🗑️');
                    loadStorageData();
                }
            });

            card.addEventListener('click', () => {
                card.querySelector('.btn-view-box').click();
            });

            fragment.appendChild(card);
        });

        elements.storageBoxesGrid.appendChild(fragment);
    }

    function updateBoxFilterDropdown() {
        if (!elements.selectInventoryBoxFilter) return;
        const boxes = state.storage.boxes || [];
        const currentVal = state.storage.selectedBoxFilter;

        let html = '<option value="">All Storage Boxes</option>';
        boxes.forEach(b => {
            html += `<option value="${escapeHtml(b.name)}" ${b.name === currentVal ? 'selected' : ''}>${escapeHtml(b.name)} (${b.product_count || 0})</option>`;
        });
        elements.selectInventoryBoxFilter.innerHTML = html;
    }

    function filterAndRenderInventory() {
        if (!elements.inventoryGrid) return;
        const query = (state.storage.searchFilter || '').toLowerCase();
        const boxFilter = state.storage.selectedBoxFilter;
        const items = state.storage.inventory || [];

        const filtered = items.filter(it => {
            if (boxFilter && it.box !== boxFilter) return false;
            if (query) {
                const name = (it.name || '').toLowerCase();
                const code = (it.code || '').toLowerCase();
                const box = (it.box || '').toLowerCase();
                const notes = (it.notes || '').toLowerCase();
                if (!name.includes(query) && !code.includes(query) && !box.includes(query) && !notes.includes(query)) {
                    return false;
                }
            }
            return true;
        });

        if (elements.inventoryFilterCount) {
            elements.inventoryFilterCount.textContent = `${filtered.length} product${filtered.length === 1 ? '' : 's'}`;
        }

        elements.inventoryGrid.innerHTML = '';
        if (filtered.length === 0) {
            elements.inventoryGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon-wrap">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        </svg>
                    </div>
                    <h3>No Matching Products</h3>
                    <p>No products match your current search or box filter.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        filtered.forEach((it, idx) => {
            const card = document.createElement('div');
            card.className = 'inventory-card';
            card.innerHTML = `
                <div class="card-badges-top">
                    ${it.code ? `<span class="card-badge-code">${escapeHtml(it.code)}</span>` : ''}
                    ${it.box ? `<span class="card-badge-box">${escapeHtml(it.box)}</span>` : ''}
                </div>
                <img class="inventory-card-img" alt="${escapeHtml(it.name)}" data-src="${it.file_path}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E">
                <div class="inventory-card-details">
                    <h4 class="inventory-card-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</h4>
                    <div class="inventory-card-meta">
                        <span>${it.created_at ? it.created_at.split(' ')[0] : ''}</span>
                        <div class="inventory-card-actions">
                            <button class="btn-icon-tiny btn-inv-open" title="Open Image">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                            <button class="btn-icon-tiny btn-inv-reveal" title="Reveal in File Explorer">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            </button>
                            <button class="btn-icon-tiny btn-inv-del" title="Delete from Inventory">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            const img = card.querySelector('.inventory-card-img');
            thumbnailObserver.observe(img);

            card.querySelector('.btn-inv-open').addEventListener('click', (e) => {
                e.stopPropagation();
                Bridge.openImage(it.file_path);
            });

            card.querySelector('.btn-inv-reveal').addEventListener('click', (e) => {
                e.stopPropagation();
                Bridge.revealInExplorer(it.file_path);
            });

            card.querySelector('.btn-inv-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Remove "${it.name}" (${it.code}) from inventory?`)) {
                    await Bridge.deleteInventoryItem(it.id);
                    showToast('Item deleted from inventory', '🗑️');
                    loadStorageData();
                }
            });

            card.addEventListener('click', () => {
                openProductViewer(filtered, idx);
            });

            fragment.appendChild(card);
        });

        elements.inventoryGrid.appendChild(fragment);
    }

    /* ==========================================================================
       Product Image Viewer Modal Subsystem
       ========================================================================== */

    function setupProductViewer() {
        if (!elements.productViewerModal) return;

        const closeViewer = () => {
            elements.productViewerModal.classList.add('hidden');
            state.viewer.products = [];
            state.viewer.zoom = 1.0;
        };

        if (elements.productViewerClose) elements.productViewerClose.addEventListener('click', closeViewer);
        const backdrop = elements.productViewerModal.querySelector('.lightbox-backdrop');
        if (backdrop) backdrop.addEventListener('click', closeViewer);

        const updateViewerDisplay = () => {
            const item = state.viewer.products[state.viewer.currentIndex];
            if (!item) return;

            if (elements.productViewerTitle) elements.productViewerTitle.textContent = item.name || 'Product';
            if (elements.productViewerCodeBadge) {
                elements.productViewerCodeBadge.textContent = item.code || '';
                elements.productViewerCodeBadge.style.display = item.code ? 'inline-block' : 'none';
            }
            if (elements.productViewerBoxBadge) {
                elements.productViewerBoxBadge.textContent = item.box || '';
                elements.productViewerBoxBadge.style.display = item.box ? 'inline-block' : 'none';
            }

            if (elements.productViewerPos) {
                elements.productViewerPos.textContent = `${state.viewer.currentIndex + 1} of ${state.viewer.products.length}`;
            }

            if (elements.productViewerImg) {
                const src = item.crop_b64 || item.file_path || item.crop_path || '';
                if (src.startsWith('data:') || src.startsWith('blob:')) {
                    elements.productViewerImg.src = src;
                } else {
                    loadThumbnailSmoothly(src, (b64) => {
                        if (b64) elements.productViewerImg.src = b64;
                    }, 1200);
                }
                elements.productViewerImg.style.transform = `scale(${state.viewer.zoom})`;
            }

            if (elements.productViewerDims) {
                if (item.width && item.height) {
                    elements.productViewerDims.textContent = `Dimensions: ${item.width} × ${item.height} px`;
                } else {
                    elements.productViewerDims.textContent = '';
                }
            }
        };

        if (elements.btnViewerPrev) {
            elements.btnViewerPrev.addEventListener('click', () => {
                if (state.viewer.currentIndex > 0) {
                    state.viewer.currentIndex--;
                    state.viewer.zoom = 1.0;
                    updateViewerDisplay();
                }
            });
        }

        if (elements.btnViewerNext) {
            elements.btnViewerNext.addEventListener('click', () => {
                if (state.viewer.currentIndex < state.viewer.products.length - 1) {
                    state.viewer.currentIndex++;
                    state.viewer.zoom = 1.0;
                    updateViewerDisplay();
                }
            });
        }

        if (elements.btnViewerZoomIn) {
            elements.btnViewerZoomIn.addEventListener('click', () => {
                state.viewer.zoom = Math.min(4.0, state.viewer.zoom + 0.25);
                if (elements.productViewerImg) elements.productViewerImg.style.transform = `scale(${state.viewer.zoom})`;
            });
        }

        if (elements.btnViewerZoomOut) {
            elements.btnViewerZoomOut.addEventListener('click', () => {
                state.viewer.zoom = Math.max(0.4, state.viewer.zoom - 0.25);
                if (elements.productViewerImg) elements.productViewerImg.style.transform = `scale(${state.viewer.zoom})`;
            });
        }

        if (elements.btnViewerZoomFit) {
            elements.btnViewerZoomFit.addEventListener('click', () => {
                state.viewer.zoom = 1.0;
                if (elements.productViewerImg) elements.productViewerImg.style.transform = `scale(1)`;
            });
        }

        document.addEventListener('keydown', (e) => {
            if (elements.productViewerModal.classList.contains('hidden')) return;
            if (e.key === 'Escape') closeViewer();
            else if (e.key === 'ArrowLeft' && elements.btnViewerPrev) elements.btnViewerPrev.click();
            else if (e.key === 'ArrowRight' && elements.btnViewerNext) elements.btnViewerNext.click();
        });

        window.openProductViewer = (productsList, startIndex = 0) => {
            if (!productsList || productsList.length === 0) return;
            state.viewer.products = productsList;
            state.viewer.currentIndex = Math.max(0, Math.min(productsList.length - 1, startIndex));
            state.viewer.zoom = 1.0;
            updateViewerDisplay();
            elements.productViewerModal.classList.remove('hidden');
        };
    }

    // Initialize application
    function init() {
        setupNavigation();
        setupActions();
        setupDropzone();
        setupLightbox();
        setupGalleryFilter();
        setupBatchModal();
        setupScanner();
        setupStorage();
        setupProductViewer();
        initSplashScreen();
        checkActiveSessionOnBoot();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
