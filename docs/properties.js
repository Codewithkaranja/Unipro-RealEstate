// ============================================
// PROPERTIES PAGE - LAND-ONLY, FEATURE-PRESERVED
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // ========== CONFIGURATION ==========
    const CONFIG = {
        apiBase: 'https://unipro-real-estate.onrender.com',
        itemsPerPage: 9,
        cacheKey: 'property_by_Unipro_cache',
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        retryAttempts: 2,
        retryDelay: 2000,
        fetchLimit: 100 // ✅ Request 100 listings from API
    };

    // ========== DOM ELEMENTS ==========
    const elements = {
        container: document.getElementById('propertiesGrid'),
        mobileMenu: document.getElementById('mobileMenu'),
        navLinks: document.getElementById('navLinks'),
        overlay: document.getElementById('overlay'),
        heroSearch: document.getElementById('hero-search'),
        searchJumpBtn: document.querySelector('.hero-search-btn'),
        filterSearch: document.getElementById('smart-search'),
        locationFilter: document.getElementById('location'),
        typeFilter: document.getElementById('property-type'),
        priceFilter: document.getElementById('price-range'),
        sizeFilter: document.getElementById('bedrooms'), // repurposed for plot size
        applyFiltersBtn: document.getElementById('applyFilters'),
        resetFiltersBtn: document.getElementById('resetFilters'),
        resetFiltersBtn2: document.getElementById('resetFilters2'),
        noResults: document.getElementById('noResults'),
        // Tabs are removed – no longer needed
        modal: document.getElementById('propertyModal'),
        modalClose: document.getElementById('modalClose'),
        modalBody: document.getElementById('modalBody'),
        pagination: document.getElementById('pagination')
    };

    // ========== STATE MANAGEMENT ==========
    let state = {
        properties: [],
        filteredProperties: [],
        currentPage: 1,
        isLoading: false,
        retryCount: 0,
        isServerHealthy: false,
        filters: {
            search: '',
            location: 'all',
            type: 'all',
            price: 'all',
            size: 'all' // renamed from bedrooms
        }
    };

    // ========== MODAL GLOBALS ==========
    let currentKeyDownHandler = null;

    // ========== INITIALIZATION ==========
    function init() {
        console.log('Initializing land-only property page...');
        
        if (!elements.container) {
            console.error('ERROR: Element with id="propertiesGrid" not found!');
            return;
        }

        setupEventListeners();
        updateFooterYear();
        
        // Pre-wake the server early
        fetch(`${CONFIG.apiBase}/health`).catch(() => {});
        
        checkServerHealth().then(() => {
            // Try to load from cache first for instant display
            const cached = getCachedProperties();
            if (cached && cached.length > 0) {
                console.log('📦 Using cached properties');
                state.properties = cached.map(processPropertyData);
                applyFilters(true);
                state.isLoading = false;
            }
            
            // Always fetch fresh data in background
            loadProperties();
        });
    }

    // ========== SERVER HEALTH CHECK ==========
    async function checkServerHealth() {
        try {
            // Try using admin.js API first if available
            if (window.PropertyAdminAPI && typeof window.PropertyAdminAPI.checkServerHealth === 'function') {
                state.isServerHealthy = await window.PropertyAdminAPI.checkServerHealth();
                console.log('✅ Using admin.js API for health check');
                return;
            }
            
            // Fallback to direct API call with AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${CONFIG.apiBase}/health`, {
                signal: controller.signal
            }).catch(() => null);
            
            clearTimeout(timeoutId);
            state.isServerHealthy = response?.ok || false;
            
            if (!state.isServerHealthy) {
                console.warn('⚠️ Server may be starting up or sleeping');
            }
        } catch (error) {
            console.warn('Server health check failed:', error);
            state.isServerHealthy = false;
        }
    }

    // ========== CACHE MANAGEMENT ==========
    function getCachedProperties() {
        try {
            const raw = localStorage.getItem(CONFIG.cacheKey);
            if (!raw) return null;
            
            const cached = JSON.parse(raw);
            const isValid = Date.now() - cached.timestamp < CONFIG.cacheTTL;
            
            return isValid ? cached.data : null;
        } catch (error) {
            console.warn('Cache read failed:', error);
            return null;
        }
    }
    
    function setCachedProperties(data) {
        try {
            localStorage.setItem(CONFIG.cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (error) {
            console.warn('Cache write failed:', error);
        }
    }

    // ========== DATA LOADING ==========
    async function loadProperties() {
        if (state.isLoading) return;
        
        state.isLoading = true;
        showSkeletons(); // Show skeletons immediately
        
        try {
            console.log('Fetching listings from API...');
            
            let properties = [];
            
            // Try to use admin.js API if available
            if (window.PropertyAdminAPI && typeof window.PropertyAdminAPI.getAllProperties === 'function') {
                console.log('🔄 Using admin.js API to fetch properties');
                properties = await window.PropertyAdminAPI.getAllProperties();
            } else {
                // Fallback to direct fetch with limit parameter
                console.log('🔄 Using direct API fetch');
                properties = await fetchPropertiesDirectly();
            }
            
            // If API fails, use sample land data
            if (!properties || !Array.isArray(properties) || properties.length === 0) {
                console.log('API returned no data, using sample land listings');
                properties = getSampleProperties();
            }
            
            console.log(`Loaded ${properties.length} properties`);
            
            // Process properties
            state.properties = properties.map(processPropertyData);
            
            // Cache the results
            setCachedProperties(properties);
            
            // Apply filters and render (initial load)
            applyFilters(true);
            
            if (properties.length === 0) {
                showEmptyState('No properties available at the moment. Please check back later.');
            }
            
        } catch (error) {
            console.error('❌ Error loading properties:', error);
            
            // Use sample data as fallback
            console.log('Using sample data due to error');
            state.properties = getSampleProperties().map(processPropertyData);
            applyFilters(true);
            
            // Show warning but continue
            showToast('Using sample data. API connection issue.', 'warning');
            
        } finally {
            state.isLoading = false;
        }
    }

    async function fetchPropertiesDirectly() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            // ✅ Request limit parameter for 100 properties – endpoint now /api/listings
            const response = await fetch(`${CONFIG.apiBase}/api/listings?limit=${CONFIG.fetchLimit}`, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Handle different response formats
            if (data.success === false) {
                throw new Error(data.message || 'API error');
            }
            
            return Array.isArray(data) ? data : [];
            
        } catch (error) {
            console.warn('API fetch failed:', error.message);
            return null; // Return null to trigger sample data
        }
    }

    // ========== PROCESS PROPERTY DATA (LAND-ONLY) ==========
    function processPropertyData(property) {
        // Generate ID if missing
        const id = property._id || property.id || generateId();
        
        // Normalize location
        let location = (property.location || 'unknown').toLowerCase().trim();
        const locationMap = {
            'kitengela': 'kitengela',
            'ngong': 'ngong',
            'syokimau': 'syokimau',
            'ongata rongai': 'ongata-rongai',
            'ongata-rongai': 'ongata-rongai',
            'athi river': 'athi-river',
            'kilimani': 'kilimani'
        };
        location = locationMap[location] || location;
        
        // Extract price number
        const priceNum = extractPriceNumber(property);
        
        // Determine property type (land categories)
        let type = 'unknown';
        if (property.type) {
            type = property.type.toLowerCase();
        } else if (property.category) {
            type = property.category.toLowerCase();
        }
        
        // Normalize type to match filter values
        const typeMap = {
            'land-res': 'land-res',
            'residential plot': 'land-res',
            'plot': 'land-res',
            'land-comm': 'land-comm',
            'commercial land': 'land-comm',
            'ranch': 'ranch',
            'agricultural': 'ranch',
            'acre': 'ranch'
        };
        type = typeMap[type] || type;
        
        return {
            id: id,
            title: property.title || 'Untitled Land',
            location: location,
            type: type,
            status: (property.status || 'available').toLowerCase(),
            priceNum: priceNum,
            priceDisplay: formatPrice(priceNum, property.price), // No transaction needed
            // Land-specific fields
            plotSize: property.plotSize || property.size || '',
            titleType: property.titleType || property.landTitle || '',
            amenities: property.amenities || property.features || [],
            verificationChecklist: property.verificationChecklist || [],
            documentsAvailable: property.documentsAvailable || [],
            mapLink: property.mapLink || '',
            description: property.description || 'No description available',
            whatsapp: property.whatsapp || '254727619305',
            images: Array.isArray(property.images) ? property.images.map(img => normalizeImageUrl(img)) : [],
            createdAt: property.createdAt || new Date().toISOString()
        };
    }

    // ✅ Price extraction (simplified – no rent logic)
    function extractPriceNumber(property) {
        if (property.priceNum !== undefined && property.priceNum !== null) {
            const n = Number(property.priceNum);
            return Number.isFinite(n) ? n : 0;
        }

        if (!property.price) return 0;

        const raw = String(property.price).toLowerCase().trim();

        // Remove any common period words (though land is sale only)
        const cleaned = raw
            .replace(/\/\s*(month|mo|week|wk|day|yr|year)\b/g, '')
            .replace(/\b(per|a)\s*(month|mo|week|wk|day|yr|year)\b/g, '')
            .replace(/\b(monthly|weekly|daily|yearly|annum)\b/g, '')
            .trim();

        // Extract first number + optional suffix M/K
        const match = cleaned.match(/(\d[\d,]*\.?\d*)\s*([mk])?\b/);
        if (!match) return 0;

        let num = parseFloat(match[1].replace(/,/g, ''));
        if (!Number.isFinite(num)) return 0;

        const suffix = match[2];
        if (suffix === 'm') num *= 1_000_000;
        if (suffix === 'k') num *= 1_000;

        return num;
    }

    function formatPrice(amount, rawPrice = '') {
        if (!amount || amount === 0) return 'Price on request';

        // Sale only – use K/M formatting
        if (amount >= 1000000) {
            const millions = amount / 1000000;
            const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, '');
            return `KES ${formatted}M`;
        } else if (amount >= 1000) {
            return `KES ${(amount / 1000).toFixed(0)}K`;
        }

        return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
    }

    // ========== IMAGE HANDLING ==========
    function normalizeImageUrl(src) {
        if (!src) return getPlaceholderImage();
        if (src.startsWith('http://') || src.startsWith('https://')) {
            return src.includes('res.cloudinary.com') ? cloudinaryCardUrl(src) : src;
        }
        if (src.startsWith('/')) return `${CONFIG.apiBase}${src}`;
        return `${CONFIG.apiBase}/${src}`;
    }

    function cloudinaryCardUrl(url) {
        if (!url.includes('res.cloudinary.com')) return url;
        // Add Cloudinary transformations for optimal loading
        return url.replace('/upload/', '/upload/f_auto,q_auto,w_900,c_fill,g_auto/');
    }

    function getPlaceholderImage(type = '') {
        const images = {
            'land-res': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'land-comm': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'ranch': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        
        return images[type] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    }

    // ========== UI STATES ==========
    function showSkeletons() {
        elements.container.innerHTML = '';
        
        // Create skeleton cards for instant UI feedback
        const skeletons = Array.from({ length: CONFIG.itemsPerPage }, (_, i) => 
            `<div class="property-card skeleton-card" style="animation-delay: ${i * 50}ms">
                <div class="property-img">
                    <div class="skeleton-img"></div>
                </div>
                <div class="property-details">
                    <div class="skeleton-line" style="width: 60%"></div>
                    <div class="skeleton-line" style="width: 90%; height: 24px; margin: 10px 0"></div>
                    <div class="skeleton-line" style="width: 70%"></div>
                    <div class="property-features">
                        <div class="skeleton-circle"></div>
                        <div class="skeleton-circle"></div>
                        <div class="skeleton-circle"></div>
                        <div class="skeleton-circle"></div>
                    </div>
                </div>
            </div>`
        ).join('');
        
        elements.container.innerHTML = skeletons;
    }

    function showEmptyState(message) {
        // Use existing #noResults block without overwriting structure
        if (elements.noResults) {
            const heading = elements.noResults.querySelector('h3');
            const paragraph = elements.noResults.querySelector('p');
            
            if (heading) heading.textContent = message || 'No properties match your filters';
            if (paragraph) {
                paragraph.innerHTML = 'Try adjusting your search criteria or <a href="https://wa.me/254727619305" target="_blank">WhatsApp us</a> for personalized property recommendations.';
            }
            
            elements.noResults.style.display = 'block';
        }
    }

    function updateFooterYear() {
        const currentYear = new Date().getFullYear();
        document.querySelectorAll('[id="currentYear"], [id="y"]').forEach(el => {
            el.textContent = currentYear;
        });
    }

    // ========== FILTERING (LAND-ONLY) ==========
    function applyFilters(initialLoad = false) {
        if (!state.properties.length) return;
        
        if (!initialLoad) {
            state.currentPage = 1;
        }
        
        // Update state from UI
        if (!initialLoad) {
            state.filters = {
                search: elements.filterSearch?.value.toLowerCase() || '',
                location: elements.locationFilter?.value || 'all',
                type: elements.typeFilter?.value || 'all',
                price: elements.priceFilter?.value || 'all',
                size: elements.sizeFilter?.value || 'all'  // map from bedrooms select
            };
        }
        
        console.log('Applying filters:', state.filters);
        
        // Filter properties
        state.filteredProperties = state.properties.filter(property => {
            // 1. Search filter
            if (state.filters.search) {
                const searchableText = `${property.title} ${formatLocationName(property.location)} ${formatTypeName(property.type)} ${property.description}`.toLowerCase();
                if (!searchableText.includes(state.filters.search)) return false;
            }
            
            // 2. Location filter
            if (state.filters.location !== 'all' && property.location !== state.filters.location) {
                return false;
            }
            
            // 3. Type filter (land categories)
            if (state.filters.type !== 'all' && property.type !== state.filters.type) {
                return false;
            }
            
            // 4. Price filter (sale only)
            if (state.filters.price !== 'all') {
                if (!checkPriceFilter(property.priceNum, state.filters.price)) {
                    return false;
                }
            }
            
            // 5. Size filter (plot size categories)
            if (state.filters.size !== 'all') {
                if (!checkSizeFilter(property.plotSize, state.filters.size)) {
                    return false;
                }
            }
            
            return true;
        });
        
        console.log(`Filtered to ${state.filteredProperties.length} properties`);
        
        // Update UI
        renderProperties();
        
        // Show/hide no results
        if (elements.noResults) {
            elements.noResults.style.display = state.filteredProperties.length ? 'none' : 'block';
        }
    }

    // ✅ Price filter for land (sale only)
    function checkPriceFilter(priceNum, filter) {
        const price = priceNum || 0;
        
        // Ranges from HTML: under-500k, 500k-1m, 1m-3m, 3m-10m, over-10m
        switch(filter) {
            case 'under-500k':
                return price <= 500000;
            case '500k-1m':
                return price >= 500000 && price <= 1000000;
            case '1m-3m':
                return price >= 1000000 && price <= 3000000;
            case '3m-10m':
                return price >= 3000000 && price <= 10000000;
            case 'over-10m':
                return price > 10000000;
            default:
                return true;
        }
    }

    // ✅ Size filter mapping from select options (originally bedrooms)
    function checkSizeFilter(plotSize, filter) {
        if (!plotSize) return false;
        const sizeStr = plotSize.toLowerCase();
        
        // Map select values to expected strings
        // Options: all,1,2,3,4+
        // We'll map: 1 -> 50x100, 2 -> 100x100, 3 -> 1/2 Acre, 4+ -> 1 Acre+
        if (filter === '1') {
            return sizeStr.includes('50x100');
        } else if (filter === '2') {
            return sizeStr.includes('100x100');
        } else if (filter === '3') {
            return sizeStr.includes('1/2') || sizeStr.includes('half');
        } else if (filter === '4+') {
            return sizeStr.includes('1 acre') || sizeStr.includes('acre') && !sizeStr.includes('1/2');
        }
        return true;
    }

    function resetFilters() {
        state.currentPage = 1;
        
        // Reset filter inputs
        if (elements.filterSearch) elements.filterSearch.value = '';
        if (elements.locationFilter) elements.locationFilter.value = 'all';
        if (elements.typeFilter) elements.typeFilter.value = 'all';
        if (elements.priceFilter) elements.priceFilter.value = 'all';
        if (elements.sizeFilter) elements.sizeFilter.value = 'all';
        
        applyFilters();
    }

    // ========== RENDERING ==========
    function renderProperties() {
        elements.container.innerHTML = '';
        
        if (state.filteredProperties.length === 0) {
            showEmptyState('No properties match your filters');
            if (elements.pagination) elements.pagination.innerHTML = '';
            return;
        }
        
        // Calculate pagination with safety check
        const totalPages = Math.ceil(state.filteredProperties.length / CONFIG.itemsPerPage);
        if (state.currentPage > totalPages) state.currentPage = totalPages || 1;
        
        const startIndex = (state.currentPage - 1) * CONFIG.itemsPerPage;
        const endIndex = startIndex + CONFIG.itemsPerPage;
        const pageProperties = state.filteredProperties.slice(startIndex, endIndex);
        
        // Render property cards
        pageProperties.forEach((property, index) => {
            const card = createPropertyCard(property, index);
            elements.container.appendChild(card);
        });
        
        // Update pagination
        renderPagination();
    }

    function createPropertyCard(property, index) {
        const card = document.createElement('div');
        card.className = 'property-card fade-in';
        card.style.animationDelay = `${index * 50}ms`;
        
        // Status badge/overlay logic (unchanged)
        let statusOverlay = '';
        if (property.status === 'sold') {
            statusOverlay = '<div class="sold-overlay"><div class="sold-text">SOLD</div></div>';
        } else if (property.status === 'reserved') {
            statusOverlay = '<div class="sold-overlay"><div class="sold-text">RESERVED</div></div>';
        }
        
        // Only show badge for available properties (not sold/reserved)
        const showBadge = property.status === 'available';
        const badgeClass = 'badge-available';
        
        // Get main image (first image or placeholder)
        const mainImage = property.images?.[0] || getPlaceholderImage(property.type);
        
        card.innerHTML = `
            <div class="property-img">
                <div class="img-wrapper">
                    <img src="${mainImage}" 
                         alt="${property.title}" 
                         loading="lazy"
                         decoding="async"
                         width="600"
                         height="400"
                         ${index === 0 ? 'fetchpriority="high"' : ''}
                         onerror="this.src='${getPlaceholderImage(property.type)}'">
                </div>
                ${statusOverlay}
                ${showBadge ? `<div class="property-badge ${badgeClass}">${property.status.toUpperCase()}</div>` : ''}
            </div>
            
            <div class="property-details">
                <div class="property-price">${property.priceDisplay}</div>
                <h3 class="property-title">${property.title}</h3>
                
                <div class="property-location">
                    <i class="fas fa-map-marker-alt"></i> ${formatLocationName(property.location)}
                </div>
                
                <div class="property-features">
                    <!-- Land features only -->
                    ${property.plotSize ? `
                        <div class="feature" title="Plot Size">
                            <i class="fas fa-expand"></i>
                            <span>${property.plotSize}</span>
                        </div>
                    ` : ''}
                    ${property.titleType ? `
                        <div class="feature" title="Title Type">
                            <i class="fas fa-file-contract"></i>
                            <span>${property.titleType}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="property-ctas">
                    <a href="https://wa.me/${property.whatsapp}?text=${encodeURIComponent(
                        `Hi, I'm interested in "${property.title}" (Listing ID: ${property.id}) at ${formatLocationName(property.location)}. Price: ${property.priceDisplay}`
                    )}" 
                       class="btn btn-whatsapp" 
                       target="_blank"
                       rel="noopener">
                        <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                    <button class="btn btn-secondary view-details-btn" data-id="${property.id}">
                        View Details
                    </button>
                </div>
            </div>`;
        
        // Add click handler for view details
        card.querySelector('.view-details-btn').addEventListener('click', () => {
            openPropertyModal(property);
        });
        
        return card;
    }

    function renderPagination() {
        if (!elements.pagination) return;
        
        const totalPages = Math.ceil(state.filteredProperties.length / CONFIG.itemsPerPage);
        
        if (totalPages <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }
        
        let html = '';
        
        // Previous button
        if (state.currentPage > 1) {
            html += `<button class="pagination-btn" data-page="${state.currentPage - 1}">
                        <i class="fas fa-chevron-left"></i> Previous
                     </button>`;
        }
        
        // Page numbers
        const maxVisible = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="pagination-btn ${i === state.currentPage ? 'active' : ''}" 
                     data-page="${i}">${i}</button>`;
        }
        
        // Next button
        if (state.currentPage < totalPages) {
            html += `<button class="pagination-btn" data-page="${state.currentPage + 1}">
                        Next <i class="fas fa-chevron-right"></i>
                     </button>`;
        }
        
        elements.pagination.innerHTML = html;
        
        // Add click handlers
        elements.pagination.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (!isNaN(page)) {
                    state.currentPage = page;
                    renderProperties();
                    window.scrollTo({ top: elements.container.offsetTop - 100, behavior: 'smooth' });
                }
            });
        });
    }

    // ========== MODAL FUNCTIONS (LAND-ONLY) ==========
    function openPropertyModal(property) {
        console.log('Opening modal for property:', property.title);
        
        if (!property || !elements.modalBody) return;
        
        // Initialize gallery state
        const galleryState = {
            currentIndex: 0,
            images: property.images || [getPlaceholderImage(property.type)],
            totalImages: property.images?.length || 1
        };
        
        // Create modal HTML with gallery navigation and land-specific details
        elements.modalBody.innerHTML = `
            <div class="modal-top">
                <h2>${property.title}</h2>
                <div class="modal-price">${property.priceDisplay}</div>
            </div>
            
            <div class="modal-gallery">
                <div class="main-image-container">
                    <img src="${galleryState.images[0]}" 
                         alt="${property.title}" 
                         class="main-image"
                         onerror="this.src='${getPlaceholderImage(property.type)}'">
                    
                    ${galleryState.totalImages > 1 ? `
                        <button class="gallery-nav gallery-prev" aria-label="Previous image">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="gallery-nav gallery-next" aria-label="Next image">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <div class="image-counter">
                            <span class="current-index">${galleryState.currentIndex + 1}</span>
                            /
                            <span class="total-images">${galleryState.totalImages}</span>
                        </div>
                    ` : ''}
                </div>
                
                ${galleryState.totalImages > 1 ? `
                    <div class="thumbnails">
                        ${galleryState.images.slice(0, 6).map((src, i) => `
                            <img src="${src}" 
                                 alt="${property.title} - Image ${i+1}" 
                                 class="thumbnail ${i === 0 ? 'active' : ''}"
                                 loading="lazy"
                                 data-index="${i}"
                                 onerror="this.src='${getPlaceholderImage(property.type)}'">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-info">
                <div class="info-grid">
                    <div class="info-item">
                        <strong><i class="fas fa-map-marker-alt"></i> Location:</strong>
                        <span>${formatLocationName(property.location)}</span>
                    </div>
                    <div class="info-item">
                        <strong><i class="fas fa-home"></i> Type:</strong>
                        <span>${formatTypeName(property.type)}</span>
                    </div>
                    ${property.plotSize ? `
                    <div class="info-item">
                        <strong><i class="fas fa-expand"></i> Plot Size:</strong>
                        <span>${property.plotSize}</span>
                    </div>` : ''}
                    ${property.titleType ? `
                    <div class="info-item">
                        <strong><i class="fas fa-file-contract"></i> Title Type:</strong>
                        <span>${property.titleType}</span>
                    </div>` : ''}
                    <div class="info-item">
                        <strong><i class="fas fa-exchange-alt"></i> Status:</strong>
                        <span class="status-${property.status}">${property.status.toUpperCase()}</span>
                    </div>
                </div>
                
                ${property.description ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-align-left"></i> Description</h3>
                        <p>${property.description}</p>
                    </div>
                ` : ''}
                
                ${property.amenities && property.amenities.length > 0 ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-star"></i> Amenities</h3>
                        <div class="features-grid">
                            ${property.amenities.map(a => `<span class="feature-tag">${a}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${property.verificationChecklist && property.verificationChecklist.length > 0 ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-check-circle"></i> Verification Checklist</h3>
                        <ul class="verification-list">
                            ${property.verificationChecklist.map(item => `<li><i class="fas fa-check"></i> ${item}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${property.documentsAvailable && property.documentsAvailable.length > 0 ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-file-pdf"></i> Documents Available</h3>
                        <ul class="documents-list">
                            ${property.documentsAvailable.map(doc => `<li><i class="fas fa-file"></i> ${doc}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${property.mapLink ? `
                    <div class="modal-section">
                        <h3><i class="fas fa-map"></i> Location Map</h3>
                        <a href="${property.mapLink}" target="_blank" rel="noopener" class="btn btn-outline btn-small">View on Map</a>
                    </div>
                ` : ''}
            </div>
            
            <div class="modal-actions">
                <a href="https://wa.me/${property.whatsapp}?text=${encodeURIComponent(
                    `Hi, I'm interested in "${property.title}" (Listing ID: ${property.id}) at ${formatLocationName(property.location)}. Price: ${property.priceDisplay}`
                )}" 
                   class="btn btn-whatsapp" 
                   target="_blank"
                   rel="noopener">
                    <i class="fab fa-whatsapp"></i> WhatsApp Inquiry
                </a>
                <a href="tel:+254727619305" class="btn btn-secondary">
                    <i class="fas fa-phone"></i> Call Now
                </a>
            </div>`;
        
        // Open modal
        elements.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Add gallery functionality (identical to original)
        if (galleryState.totalImages > 1) {
            const mainImage = elements.modalBody.querySelector('.main-image');
            const prevBtn = elements.modalBody.querySelector('.gallery-prev');
            const nextBtn = elements.modalBody.querySelector('.gallery-next');
            const thumbnails = elements.modalBody.querySelectorAll('.thumbnail');
            const currentIndexSpan = elements.modalBody.querySelector('.current-index');
            
            const updateGallery = (newIndex) => {
                galleryState.currentIndex = newIndex;
                mainImage.style.opacity = '0.7';
                setTimeout(() => {
                    mainImage.src = galleryState.images[newIndex];
                    mainImage.style.opacity = '1';
                }, 150);
                thumbnails.forEach((thumb, i) => {
                    thumb.classList.toggle('active', i === newIndex);
                });
                if (currentIndexSpan) {
                    currentIndexSpan.textContent = newIndex + 1;
                }
            };
            
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    const newIndex = galleryState.currentIndex === 0 ? galleryState.totalImages - 1 : galleryState.currentIndex - 1;
                    updateGallery(newIndex);
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const newIndex = galleryState.currentIndex === galleryState.totalImages - 1 ? 0 : galleryState.currentIndex + 1;
                    updateGallery(newIndex);
                });
            }
            thumbnails.forEach((thumb, i) => {
                thumb.addEventListener('click', () => updateGallery(i));
            });
            
            // Swipe functionality
            let touchStartX = 0, touchEndX = 0;
            if (mainImage) {
                mainImage.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                }, { passive: true });
                mainImage.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    const swipeDistance = touchEndX - touchStartX;
                    if (Math.abs(swipeDistance) > 50) {
                        if (swipeDistance > 0) {
                            const newIndex = galleryState.currentIndex === 0 ? galleryState.totalImages - 1 : galleryState.currentIndex - 1;
                            updateGallery(newIndex);
                        } else {
                            const newIndex = galleryState.currentIndex === galleryState.totalImages - 1 ? 0 : galleryState.currentIndex + 1;
                            updateGallery(newIndex);
                        }
                    }
                }, { passive: true });
            }
            
            // Keyboard navigation
            currentKeyDownHandler = (e) => {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const newIndex = galleryState.currentIndex === 0 ? galleryState.totalImages - 1 : galleryState.currentIndex - 1;
                    updateGallery(newIndex);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const newIndex = galleryState.currentIndex === galleryState.totalImages - 1 ? 0 : galleryState.currentIndex + 1;
                    updateGallery(newIndex);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeModal();
                }
            };
            document.addEventListener('keydown', currentKeyDownHandler);
        }
        
        // Mobile optimizations
        setTimeout(() => {
            if (window.innerWidth <= 768) {
                elements.modalBody.scrollTop = 0;
                const modalContent = elements.modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.display = 'flex';
                    modalContent.style.flexDirection = 'column';
                    modalContent.style.height = '100vh';
                    modalContent.style.maxHeight = '100vh';
                }
                const metaViewport = document.querySelector('meta[name="viewport"]');
                if (metaViewport) {
                    metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                }
            }
        }, 50);
    }

    function closeModal() {
        console.log('Closing modal');
        
        if (currentKeyDownHandler) {
            document.removeEventListener('keydown', currentKeyDownHandler);
            currentKeyDownHandler = null;
        }
        
        elements.modal.classList.remove('active');
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
        
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
            metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
        }
        
        const modalContent = elements.modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.display = '';
            modalContent.style.flexDirection = '';
            modalContent.style.height = '';
            modalContent.style.maxHeight = '';
        }
        if (elements.modalBody) {
            elements.modalBody.scrollTop = 0;
        }
    }

    // ========== UTILITY FUNCTIONS ==========
    function formatLocationName(location) {
        if (!location) return 'Unknown Location';
        const locationMap = {
            'kitengela': 'Kitengela',
            'ngong': 'Ngong',
            'syokimau': 'Syokimau',
            'ongata-rongai': 'Ongata Rongai',
            'athi-river': 'Athi River',
            'kilimani': 'Kilimani',
            'unknown': 'Location not specified'
        };
        return locationMap[location] || location.charAt(0).toUpperCase() + location.slice(1).replace(/-/g, ' ');
    }

    function formatTypeName(type) {
        if (!type) return 'Land';
        const typeMap = {
            'land-res': 'Residential Plot',
            'land-comm': 'Commercial Land',
            'ranch': 'Ranch / Agricultural',
            'unknown': 'Land'
        };
        return typeMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
    }

    function generateId() {
        return 'prop_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Sample land data fallback
    function getSampleProperties() {
        return [
            {
                id: 1,
                title: "Residential Plot in Kitengela",
                status: "available",
                price: "KES 850,000",
                location: "kitengela",
                type: "land-res",
                plotSize: "50x100 ft",
                titleType: "Freehold",
                amenities: ["Gated community", "Water", "Electricity nearby"],
                verificationChecklist: ["Title search done", "Survey confirmed", "No disputes"],
                documentsAvailable: ["Title deed", "Survey map", "Consent"],
                images: [],
                description: "Prime residential plot in Kitengela with title deed ready.",
                whatsapp: "254727619305"
            },
            {
                id: 2,
                title: "Commercial Land in Ngong",
                status: "available",
                price: "KES 2,500,000",
                location: "ngong",
                type: "land-comm",
                plotSize: "100x100 ft",
                titleType: "Freehold",
                amenities: ["Road access", "Near tarmac"],
                verificationChecklist: ["Title search done", "Zoning confirmed"],
                documentsAvailable: ["Title deed", "Map"],
                images: [],
                description: "Ideal for commercial development, near Ngong town.",
                whatsapp: "254727619305"
            },
            {
                id: 3,
                title: "Ranch in Athi River",
                status: "available",
                price: "KES 7,500,000",
                location: "athi-river",
                type: "ranch",
                plotSize: "5 Acres",
                titleType: "Freehold",
                amenities: ["Fenced", "Water borehole"],
                verificationChecklist: ["Title search done", "Beaconed"],
                documentsAvailable: ["Title deed", "Map"],
                images: [],
                description: "5-acre ranch suitable for farming or subdivision.",
                whatsapp: "254727619305"
            }
        ];
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }

    // ========== EVENT HANDLERS ==========
    function setupEventListeners() {
        console.log('Setting up event listeners');
        
        // Mobile menu
        if (elements.mobileMenu) {
            elements.mobileMenu.addEventListener('click', toggleMobileMenu);
        }
        if (elements.overlay) {
            elements.overlay.addEventListener('click', closeMobileMenu);
        }
        
        // Search jump
        if (elements.heroSearch) {
            elements.heroSearch.addEventListener('focus', jumpToSearch);
        }
        if (elements.searchJumpBtn) {
            elements.searchJumpBtn.addEventListener('click', jumpToSearch);
        }
        
        // Filters
        if (elements.applyFiltersBtn) {
            elements.applyFiltersBtn.addEventListener('click', () => {
                state.currentPage = 1;
                applyFilters();
            });
        }
        if (elements.resetFiltersBtn) {
            elements.resetFiltersBtn.addEventListener('click', resetFilters);
        }
        if (elements.resetFiltersBtn2) {
            elements.resetFiltersBtn2.addEventListener('click', resetFilters);
        }
        
        // Filter change events
        const filterElements = [
            elements.filterSearch,
            elements.locationFilter,
            elements.typeFilter,
            elements.priceFilter,
            elements.sizeFilter
        ];
        
        filterElements.forEach(filter => {
            if (filter) {
                filter.addEventListener('change', () => {
                    state.currentPage = 1;
                    applyFilters();
                });
            }
        });
        
        // Search input with debounce
        if (elements.filterSearch) {
            elements.filterSearch.addEventListener('input', debounce(() => {
                state.currentPage = 1;
                applyFilters();
            }, 300));
        }
        
        // Modal close events
        if (elements.modalClose) {
            const closeModalHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            };
            elements.modalClose.addEventListener('click', closeModalHandler);
            elements.modalClose.addEventListener('touchend', closeModalHandler);
            elements.modalClose.addEventListener('mouseup', closeModalHandler);
        }
        
        if (elements.modal) {
            elements.modal.addEventListener('click', (e) => {
                if (e.target === elements.modal) {
                    closeModal();
                }
            });
            elements.modal.addEventListener('touchend', (e) => {
                if (e.target === elements.modal) {
                    e.preventDefault();
                    closeModal();
                }
            }, { passive: false });
        }
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modal?.classList.contains('active')) {
                closeModal();
            }
        });
        
        // Window resize
        window.addEventListener('resize', handleResize);
    }

    function toggleMobileMenu() {
        const isOpening = !elements.navLinks.classList.contains('active');
        
        elements.navLinks.classList.toggle('active');
        elements.overlay.classList.toggle('active');
        elements.mobileMenu.innerHTML = isOpening 
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-bars"></i>';
        
        document.documentElement.style.overflow = isOpening ? 'hidden' : '';
    }

    function closeMobileMenu() {
        elements.navLinks.classList.remove('active');
        elements.overlay.classList.remove('active');
        elements.mobileMenu.innerHTML = '<i class="fas fa-bars"></i>';
        document.documentElement.style.overflow = '';
    }

    function jumpToSearch() {
        const filtersSection = document.querySelector('.property-filters');
        if (filtersSection && elements.filterSearch) {
            filtersSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            
            setTimeout(() => {
                if (elements.heroSearch && elements.heroSearch.value.trim()) {
                    elements.filterSearch.value = elements.heroSearch.value.trim();
                }
                elements.filterSearch.focus();
            }, 350);
        }
    }

    function handleResize() {
        if (window.innerWidth > 768 && elements.navLinks?.classList.contains('active')) {
            closeMobileMenu();
        }
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

    // ========== START THE APPLICATION ==========
    init();
});

// Add global styles (unchanged, but we can include them as before)
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        /* Loading skeleton */
        .skeleton-card {
            opacity: 0.7;
        }
        .skeleton-img {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            padding-top: 66.67%;
            width: 100%;
        }
        .skeleton-line {
            background: #f0f0f0;
            height: 14px;
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .skeleton-circle {
            width: 40px;
            height: 40px;
            background: #f0f0f0;
            border-radius: 50%;
        }
        
        /* Property badges */
        .property-badge {
            position: absolute;
            top: 15px;
            left: 15px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            color: white;
            z-index: 2;
        }
        .badge-available { background: #28a745; }
        .badge-sold { background: #dc3545; }
        .badge-reserved { background: #ffc107; color: #212529; }
        
        /* Sold overlay */
        .sold-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1;
        }
        .sold-text {
            background: #dc3545;
            color: white;
            padding: 10px 25px;
            font-size: 1.2rem;
            font-weight: bold;
            border-radius: 4px;
            transform: rotate(-15deg);
        }
        
        /* Property features */
        .property-features {
            display: flex;
            gap: 15px;
            margin: 15px 0;
            padding: 10px 0;
            border-top: 1px solid #eee;
            border-bottom: 1px solid #eee;
            flex-wrap: wrap;
        }
        .feature {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 0.9rem;
            color: #555;
        }
        .feature i {
            color: #28a745;
        }
        
        /* Modal styles */
        .property-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            overflow-y: auto;
        }
        .property-modal.active {
            display: block;
        }
        .modal-content {
            position: relative;
            background: white;
            margin: 50px auto;
            max-width: 900px;
            border-radius: 12px;
            overflow: hidden;
            animation: modalSlide 0.3s ease;
        }
        .modal-close {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.5);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-gallery {
            position: relative;
            height: 400px;
            overflow: hidden;
        }
        .modal-gallery .main-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .thumbnails {
            display: flex;
            gap: 10px;
            padding: 15px;
            background: #f8f9fa;
            overflow-x: auto;
        }
        .thumbnail {
            width: 80px;
            height: 60px;
            object-fit: cover;
            border-radius: 6px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.3s;
        }
        .thumbnail.active,
        .thumbnail:hover {
            opacity: 1;
            border: 2px solid #28a745;
        }
        .modal-info {
            padding: 30px;
        }
        .modal-top {
            padding: 30px 30px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .modal-price {
            font-size: 1.5rem;
            font-weight: bold;
            color: #28a745;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f5f5f5;
        }
        .info-item:last-child {
            border-bottom: none;
        }
        .modal-section {
            margin-bottom: 25px;
        }
        .modal-section h3 {
            color: #333;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .features-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }
        .feature-tag {
            background: #f0f9ff;
            color: #0369a1;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
        }
        .verification-list,
        .documents-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .verification-list li,
        .documents-list li {
            padding: 5px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .verification-list i,
        .documents-list i {
            color: #28a745;
        }
        
        /* Pagination */
        .pagination {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid #eee;
        }
        .pagination-btn {
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s;
            font-family: 'Jost', sans-serif;
        }
        .pagination-btn:hover {
            border-color: #28a745;
            color: #28a745;
        }
        .pagination-btn.active {
            background: #28a745;
            color: white;
            border-color: #28a745;
        }
        
        /* Toast */
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-width: 300px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        }
        .toast-warning {
            border-left: 4px solid #ffc107;
        }
        .toast-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .toast-close {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #999;
        }
        
        /* Animations */
        @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        @keyframes modalSlide {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }
        
        /* Mobile responsive */
        @media (max-width: 768px) {
            .modal-content {
                margin: 0;
                height: 100vh;
                border-radius: 0;
            }
            .modal-gallery {
                height: 300px;
            }
            .modal-actions {
                flex-direction: column;
            }
            .info-grid {
                grid-template-columns: 1fr;
            }
            .property-features {
                justify-content: space-between;
            }
            .feature {
                flex: 0 0 calc(50% - 10px);
            }
        }
    `;
    document.head.appendChild(style);
});