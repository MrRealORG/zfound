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
            }
            return null;
        },

        async setDefaultFolder(folder) {
            if (this.isTauri()) {
                return await window.__TAURI__.core.invoke('set_default_folder', { folder });
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
        }
    };

    // Global intersection observer for fast, non-blocking thumbnail loading
    const thumbnailObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const path = img.dataset.src;
                if (path && !img.dataset.loaded) {
                    img.dataset.loaded = 'true';
                    Bridge.getThumbnail(path, 240).then(b64 => {
                        if (b64) img.src = b64;
                    }).catch(() => {});
                }
                observer.unobserve(img);
            }
        });
    }, { rootMargin: '120px' });

    // State
    const state = {
        activeView: 'finder',
        currentFolder: '',
        scannedItems: [],
        indexedCount: 0,
        activeQueryPath: '',
        activeModel: null,
        minScoreThreshold: 0.70,
        isIndexing: false
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
        btnSetDefaultFolder: document.getElementById('btn-set-default-folder'),
        statScannedCount: document.getElementById('stat-scanned-count'),
        statIndexedCount: document.getElementById('stat-indexed-count'),
        statFolderPath: document.getElementById('stat-folder-path'),
        indexProgressContainer: document.getElementById('index-progress-container'),
        indexProgressBar: document.getElementById('index-progress-bar'),
        indexProgressPct: document.getElementById('index-progress-pct'),
        indexProgressLabel: document.getElementById('index-progress-label'),
        galleryGrid: document.getElementById('gallery-grid'),
        queryDropzone: document.getElementById('query-dropzone'),
        queryFileInput: document.getElementById('query-file-input'),
        dropzonePlaceholder: document.getElementById('dropzone-placeholder'),
        dropzonePreview: document.getElementById('dropzone-preview'),
        queryImgElement: document.getElementById('query-img-element'),
        btnClearQuery: document.getElementById('btn-clear-query'),
        queryStatusText: document.getElementById('query-status-text'),
        searchThreshold: document.getElementById('search-threshold'),
        searchThresholdVal: document.getElementById('search-threshold-val'),
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
        lightboxClose: document.getElementById('lightbox-close'),
        lightboxBtnOpen: document.getElementById('lightbox-btn-open'),
        lightboxBtnReveal: document.getElementById('lightbox-btn-reveal')
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

        elements.searchThreshold.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            state.minScoreThreshold = val / 100.0;
            elements.searchThresholdVal.textContent = `${val}%`;
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
    }

    function openLightbox(item, score = null) {
        if (!elements.lightboxModal) return;

        elements.lightboxFilename.textContent = item.name;
        elements.lightboxFilepath.textContent = item.path;
        elements.lightboxImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

        if (score !== null) {
            elements.lightboxScoreBadge.style.display = 'inline-flex';
            elements.lightboxScoreBadge.textContent = score === 100 ? '100% Exact' : `${score}% Match`;
        } else {
            elements.lightboxScoreBadge.style.display = 'none';
        }

        Bridge.getThumbnail(item.path, 1000).then(b64 => {
            if (b64) elements.lightboxImg.src = b64;
        }).catch(() => {});

        elements.lightboxBtnOpen.onclick = () => Bridge.openImage(item.path);
        elements.lightboxBtnReveal.onclick = () => Bridge.revealInExplorer(item.path);

        elements.lightboxModal.classList.remove('hidden');
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
                    renderGallery(state.scannedItems);
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
        const fragment = document.createDocumentFragment();

        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.title = item.path;

            const img = document.createElement('img');
            img.alt = item.name;
            img.dataset.src = item.path;
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';

            // Lazy-load via intersection observer
            thumbnailObserver.observe(img);

            const overlay = document.createElement('div');
            overlay.className = 'image-card-overlay';
            overlay.innerHTML = `
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

    async function runIndexing() {
        state.isIndexing = true;
        elements.btnIndexImages.disabled = true;
        elements.indexProgressContainer.classList.remove('hidden');
        elements.indexProgressBar.style.width = '30%';
        elements.indexProgressPct.textContent = '30%';
        elements.indexProgressLabel.textContent = 'Extracting CLIP 512-D neural vectors...';

        try {
            const res = await Bridge.indexImages();
            state.isIndexing = false;
            elements.indexProgressContainer.classList.add('hidden');
            elements.btnIndexImages.disabled = false;

            if (res && res.status === 'success') {
                state.indexedCount = res.indexed_count;
                elements.statIndexedCount.textContent = res.indexed_count;
                showToast(`Indexed ${res.indexed_count} images with AI vectors!`, '💾');
            } else {
                showToast(res ? res.message : 'Indexing failed', '⚠️');
            }
        } catch (e) {
            state.isIndexing = false;
            elements.indexProgressContainer.classList.add('hidden');
            elements.btnIndexImages.disabled = false;
            console.error('[ZFound] Index error:', e);
            showToast('Indexing error', '⚠️');
        }
    }

    function setupDropzone() {
        const dropzone = elements.queryDropzone;

        // Native file picker on click (NO prompt)
        dropzone.addEventListener('click', async (e) => {
            if (e.target.closest('#btn-clear-query')) return;
            const file = await Bridge.selectImageFile();
            if (file) {
                loadQueryImage(file);
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.path) {
                    loadQueryImage(file.path.replace(/\\/g, '/'));
                }
            }
        });

        elements.btnClearQuery.addEventListener('click', (e) => {
            e.stopPropagation();
            clearQuery();
        });
    }

    async function loadQueryImage(filePath) {
        state.activeQueryPath = filePath;
        elements.dropzonePlaceholder.classList.add('hidden');
        elements.dropzonePreview.classList.remove('hidden');

        const b64 = await Bridge.getThumbnail(filePath, 400);
        if (b64) elements.queryImgElement.src = b64;

        elements.queryStatusText.textContent = 'Searching CLIP 512-D neural memory...';
        runSimilaritySearch(filePath);
    }

    function clearQuery() {
        state.activeQueryPath = '';
        elements.queryImgElement.src = '';
        elements.dropzonePreview.classList.add('hidden');
        elements.dropzonePlaceholder.classList.remove('hidden');
        elements.queryStatusText.textContent = 'Drop an image to begin matching';
        elements.resultsCountBadge.textContent = '0 results';
        elements.resultsGrid.innerHTML = `
            <div class="empty-state results-empty">
                <h3>Ready for Query</h3>
                <p>Drop an image in the dock to scan your indexed library for duplicates and visual lookalikes.</p>
            </div>
        `;
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
                <p>Comparing 512-D CLIP visual embeddings</p>
            </div>
        `;

        try {
            const res = await Bridge.searchSimilar(imagePath, 50, state.minScoreThreshold);
            if (res && res.status === 'success') {
                const results = res.results || [];
                elements.resultsCountBadge.textContent = `${results.length} matches`;
                elements.queryStatusText.textContent = `Found ${results.length} ranked AI matches`;
                renderSearchResults(results);
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
            card.title = item.path;

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
                <span class="image-card-name">${escapeHtml(item.name)}</span>
                <div style="display:flex; gap:6px;">
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

    // Initialize application
    function init() {
        setupNavigation();
        setupActions();
        setupDropzone();
        setupLightbox();
        initSplashScreen();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
