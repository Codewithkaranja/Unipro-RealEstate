// =========================
// UniproRealEstate - Admin Dashboard (Land-Only)
// =========================

// API Configuration
const API_BASE = 'https://unipro-realestate.onrender.com';
const API_ENDPOINTS = {
    listings: `${API_BASE}/api/listings`,
    listingById: (id) => `${API_BASE}/api/listings/${id}`,
    addListing: `${API_BASE}/api/listings/add`,
    health: `${API_BASE}/health`,
    apiHealth: `${API_BASE}/api/health`
};

// =========================
// DOM Elements
// =========================
const loginForm = document.getElementById('loginForm');
const loginSection = document.getElementById('loginSection');
const adminSection = document.getElementById('adminSection');
const propertyForm = document.getElementById('propertyForm');
const propertiesTable = document.getElementById('propertiesTable')?.querySelector('tbody');
const logoutBtn = document.getElementById('logoutBtn');
const imageInput = document.getElementById('images');
const imagePreview = document.getElementById('imagePreview');
const existingImagesPreview = document.getElementById('existingImagesPreview');
const formStatus = document.getElementById('formStatus');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');

// =========================
// Global State
// =========================
let currentEditId = null;
let existingImages = [];
let allListings = [];
let features = [];

// =========================
// Public API for frontend pages (property.js)
// =========================
window.PropertyAdminAPI = {
    // Get all listings (public method for other pages)
    getAllProperties: async function() {
        try {
            const response = await this._makeRequest(API_ENDPOINTS.listings);
            allListings = response;
            return response.map(listing => this._processForFrontend(listing));
        } catch (error) {
            console.error('PropertyAdminAPI: Error fetching listings:', error);
            throw error;
        }
    },

    // Process listing data for frontend consumption (land-only)
    _processForFrontend: function(listing) {
        return {
            _id: listing._id || listing.id,
            title: listing.title || 'Untitled Land',
            location: listing.location || 'unknown',
            type: listing.type || 'land-res',
            status: listing.status || 'available',
            price: listing.price || 'Price on request',
            priceNum: listing.priceNum || this._extractPriceNumber(listing),
            priceDisplay: this._formatPriceDisplay(listing),
            plotSize: listing.plotSize || listing.size || '',
            titleType: listing.titleType || '',
            amenities: Array.isArray(listing.amenities) ? listing.amenities : (listing.features || []),
            verificationChecklist: Array.isArray(listing.verificationChecklist) ? listing.verificationChecklist : [],
            documentsAvailable: Array.isArray(listing.documentsAvailable) ? listing.documentsAvailable : [],
            mapLink: listing.mapLink || '',
            description: listing.description || 'No description available',
            whatsapp: listing.whatsapp || '254727619305',
            images: Array.isArray(listing.images) ? listing.images.map(img => this._normalizeImageUrl(img)) : [],
            createdAt: listing.createdAt || new Date().toISOString()
        };
    },

    // Extract price number (same logic as frontend)
    _extractPriceNumber: function(listing) {
        if (listing.priceNum !== undefined && listing.priceNum !== null) {
            const n = Number(listing.priceNum);
            return Number.isFinite(n) ? n : 0;
        }
        if (!listing.price) return 0;
        const raw = String(listing.price).toLowerCase().trim();
        const cleaned = raw
            .replace(/\/\s*(month|mo|week|wk|day|yr|year)\b/g, '')
            .replace(/\b(per|a)\s*(month|mo|week|wk|day|yr|year)\b/g, '')
            .replace(/\b(monthly|weekly|daily|yearly|annum)\b/g, '')
            .trim();
        const match = cleaned.match(/(\d[\d,]*\.?\d*)\s*([mk])?\b/);
        if (!match) return 0;
        let num = parseFloat(match[1].replace(/,/g, ''));
        if (!Number.isFinite(num)) return 0;
        const suffix = match[2];
        if (suffix === 'm') num *= 1_000_000;
        if (suffix === 'k') num *= 1_000;
        return num;
    },

    // Normalize image URL
    _normalizeImageUrl: function(src) {
        if (!src) return this._getPlaceholderImage();
        if (src.startsWith('http://') || src.startsWith('https://')) {
            if (src.includes('res.cloudinary.com')) {
                return src.replace('/upload/', '/upload/f_auto,q_auto,w_900,c_fill,g_auto/');
            }
            return src;
        }
        if (src.startsWith('/')) return `${API_BASE}${src}`;
        return `${API_BASE}/${src}`;
    },

    _getPlaceholderImage: function(type = '') {
        const images = {
            'land-res': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'land-comm': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'ranch': 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        };
        return images[type] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    },

    // Format price for display (sale only, M/K format)
    _formatPriceDisplay: function(listing) {
        const amount = listing.priceNum || this._extractPriceNumber(listing);
        return this._formatPrice(amount);
    },

    _formatPrice: function(amount) {
        if (!amount || amount === 0) return 'Price on request';
        if (amount >= 1000000) {
            const millions = amount / 1000000;
            const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, '');
            return `KES ${formatted}M`;
        } else if (amount >= 1000) {
            return `KES ${(amount / 1000).toFixed(0)}K`;
        }
        return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
    },

    // Get listing by ID
    getPropertyById: async function(id) {
        try {
            const listing = await this._makeRequest(API_ENDPOINTS.listingById(id));
            return this._processForFrontend(listing);
        } catch (error) {
            console.error(`PropertyAdminAPI: Error fetching listing ${id}:`, error);
            throw error;
        }
    },

    // Filter listings (optional, kept for completeness)
    getProperties: function(filters = {}) {
        let filtered = [...allListings];
        if (filters.type) filtered = filtered.filter(l => l.type === filters.type);
        if (filters.location) filtered = filtered.filter(l => l.location.toLowerCase().includes(filters.location.toLowerCase()));
        if (filters.minPrice) filtered = filtered.filter(l => (l.priceNum || 0) >= filters.minPrice);
        if (filters.maxPrice) filtered = filtered.filter(l => (l.priceNum || 0) <= filters.maxPrice);
        if (filters.status) filtered = filtered.filter(l => l.status === filters.status);
        return filtered;
    },

    // Check server health
    checkServerHealth: async function() {
        try {
            const response = await fetch(API_ENDPOINTS.health);
            return response.ok;
        } catch {
            return false;
        }
    },

    // Private request helper
    _makeRequest: async function(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
};

// =========================
// Utility Functions (Admin only)
// =========================
const Utils = {
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Simple price formatting for admin table
    formatPrice: (price) => {
        if (!price || price === 0) return 'Price on request';
        if (price >= 1000000) {
            const millions = price / 1000000;
            const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, '');
            return `KES ${formatted}M`;
        } else if (price >= 1000) {
            return `KES ${(price / 1000).toFixed(0)}K`;
        }
        return `KES ${price.toLocaleString('en-KE')}`;
    },

    createPropertyCard: (listing) => {
        const processed = window.PropertyAdminAPI._processForFrontend(listing);
        return {
            id: processed._id,
            title: processed.title || 'Untitled Land',
            location: processed.location || 'Location not specified',
            type: processed.type ? processed.type.charAt(0).toUpperCase() + processed.type.slice(1) : 'N/A',
            transaction: 'sale', // for display only
            price: processed.priceDisplay,
            priceNum: processed.priceNum || 0,
            status: processed.status || 'available',
            images: processed.images || [],
            plotSize: processed.plotSize,
            titleType: processed.titleType,
            description: processed.description,
            whatsapp: processed.whatsapp,
            features: processed.amenities,
            createdAt: processed.createdAt
        };
    },

    getPriceDisplay: (listing) => {
        return window.PropertyAdminAPI._formatPriceDisplay(listing);
    }
};

// =========================
// Image Management
// =========================
const ImageManager = {
    init: () => {
        if (!imageInput) return;
        imageInput.addEventListener('change', (e) => {
            ImageManager.previewImages(Array.from(e.target.files));
        });
        const clearPreviewBtn = document.getElementById('clearPreview');
        if (clearPreviewBtn) {
            clearPreviewBtn.addEventListener('click', () => {
                imageInput.value = '';
                imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
            });
        }
    },

    previewImages: (files) => {
        if (!imagePreview) return;
        if (files.length === 0) {
            imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
            return;
        }
        imagePreview.innerHTML = '';
        files.forEach((file, index) => {
            if (!file.type.startsWith('image/')) {
                alert(`File ${file.name} is not an image. Please select image files only.`);
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                alert(`Image ${file.name} is too large (${Utils.formatFileSize(file.size)}). Maximum size is 5MB.`);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const div = document.createElement('div');
                div.className = 'preview-image';
                div.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}">
                    <span class="image-name">${file.name}</span>
                    <span class="image-size">${Utils.formatFileSize(file.size)}</span>
                `;
                imagePreview.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    },

    displayExistingImages: (images) => {
        if (!existingImagesPreview || !Array.isArray(images)) return;
        existingImages = images;
        if (images.length === 0) {
            existingImagesPreview.innerHTML = '<p class="text-muted">No existing images</p>';
            return;
        }
        existingImagesPreview.innerHTML = '';
        images.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'preview-image existing';
            div.innerHTML = `
                <img src="${url}" alt="Existing image ${index + 1}" 
                     onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiNlZWVlZWUiLz48dGV4dCB4PSI2MCIgeT0iNDUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSI+SW1hZ2UgJDE8L3RleHQ+PC9zdmc+';">
                <span class="image-index">Image ${index + 1}</span>
                <button type="button" class="remove-existing-btn" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            existingImagesPreview.appendChild(div);
        });
        existingImagesPreview.querySelectorAll('.remove-existing-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                ImageManager.removeExistingImage(index);
            });
        });
    },

    removeExistingImage: (index) => {
        if (confirm('Remove this image from the property?')) {
            existingImages.splice(index, 1);
            ImageManager.displayExistingImages(existingImages);
            FormManager.updateStatus('editing');
        }
    }
};

// =========================
// Form Management
// =========================
const FormManager = {
    updateStatus: (status, message = '') => {
        if (!formStatus) return;
        formStatus.style.display = 'block';
        switch(status) {
            case 'creating':
                formStatus.textContent = 'Creating new listing...';
                formStatus.className = 'alert alert-info';
                break;
            case 'editing':
                formStatus.textContent = `Editing listing ID: ${currentEditId}`;
                formStatus.className = 'alert alert-warning';
                break;
            case 'ready':
                formStatus.style.display = 'none';
                break;
            default:
                formStatus.textContent = message;
                formStatus.className = 'alert alert-secondary';
        }
    },

    reset: () => {
        if (propertyForm) propertyForm.reset();
        currentEditId = null;
        existingImages = [];
        features = [];
        // Reset transaction buttons (optional, just for UI)
        document.querySelectorAll('.transaction-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.transaction === 'plot-sale') btn.classList.add('active');
        });
        document.getElementById('features').value = '[]';
        FeaturesManager.displayFeatures();
        // Reset due diligence checkboxes (all checked by default)
        document.querySelectorAll('.dd-check').forEach(cb => cb.checked = true);
        const ddHidden = document.getElementById('dueDiligence');
        if (ddHidden) ddHidden.value = JSON.stringify(Array.from(document.querySelectorAll('.dd-check:checked')).map(cb => cb.value));
        
        if (formTitle) formTitle.textContent = 'Add New Listing';
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Listing';
            submitBtn.disabled = false;
        }
        if (imagePreview) imagePreview.innerHTML = '<p class="text-muted">No images selected</p>';
        if (existingImagesPreview) existingImagesPreview.innerHTML = '<p class="text-muted">No existing images</p>';
        document.getElementById('propertyId').value = '';
        FormManager.updateStatus('ready');
    },

    populateForEdit: (listing) => {
        const processed = window.PropertyAdminAPI._processForFrontend(listing);
        // Fill basic fields
        document.getElementById('propertyId').value = currentEditId;
        document.getElementById('title').value = processed.title || '';
        document.getElementById('location').value = processed.location || '';
        document.getElementById('type').value = processed.type || '';
        document.getElementById('status').value = processed.status || 'available';
        document.getElementById('price').value = processed.priceNum || 0;
        document.getElementById('size').value = processed.plotSize || '';
        document.getElementById('description').value = processed.description || '';
        document.getElementById('whatsapp').value = processed.whatsapp || '254727619305';
        // Features
        features = processed.amenities || [];
        document.getElementById('features').value = JSON.stringify(features);
        FeaturesManager.displayFeatures();
        // Due diligence checklist
        const ddChecks = document.querySelectorAll('.dd-check');
        const storedChecklist = processed.verificationChecklist || [];
        ddChecks.forEach(cb => {
            cb.checked = storedChecklist.includes(cb.value);
        });
        const ddHidden = document.getElementById('dueDiligence');
        if (ddHidden) ddHidden.value = JSON.stringify(storedChecklist);
        // Images
        if (processed.images?.length > 0) {
            ImageManager.displayExistingImages(processed.images);
        } else {
            ImageManager.displayExistingImages([]);
        }
        // Title (if we add a field later, handle it)
        // Map link (if we add a field later)
        
        if (formTitle) formTitle.textContent = `Edit Listing: ${processed.title}`;
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Listing';
        FormManager.updateStatus('editing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.getElementById('title').focus();
    }
};

// =========================
// Features Management (Amenities)
// =========================
const FeaturesManager = {
    init: () => {
        const addFeatureBtn = document.getElementById('addFeature');
        if (addFeatureBtn) addFeatureBtn.addEventListener('click', FeaturesManager.addFeature);
        const featureInput = document.getElementById('featureInput');
        if (featureInput) {
            featureInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); FeaturesManager.addFeature(); }
            });
        }
        const featuresInput = document.getElementById('features');
        if (featuresInput && featuresInput.value) {
            try {
                features = JSON.parse(featuresInput.value);
                FeaturesManager.displayFeatures();
            } catch (e) { features = []; }
        }
    },
    
    addFeature: () => {
        const featureInput = document.getElementById('featureInput');
        const feature = featureInput.value.trim();
        if (!feature) return;
        features.push(feature);
        document.getElementById('features').value = JSON.stringify(features);
        FeaturesManager.displayFeatures();
        featureInput.value = '';
        featureInput.focus();
    },
    
    removeFeature: (index) => {
        if (confirm('Remove this feature?')) {
            features.splice(index, 1);
            document.getElementById('features').value = JSON.stringify(features);
            FeaturesManager.displayFeatures();
        }
    },
    
    displayFeatures: () => {
        const featuresList = document.getElementById('featuresList');
        if (!featuresList) return;
        featuresList.innerHTML = '';
        if (features.length === 0) {
            featuresList.innerHTML = '<p class="text-muted" style="font-size: 14px; padding: 10px;">No amenities added yet</p>';
            return;
        }
        features.forEach((feature, index) => {
            const span = document.createElement('span');
            span.className = 'feature-tag';
            span.innerHTML = `
                ${feature}
                <button type="button" class="remove-feature" data-index="${index}" title="Remove feature">
                    <i class="fas fa-times"></i>
                </button>
            `;
            featuresList.appendChild(span);
        });
        featuresList.querySelectorAll('.remove-feature').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                FeaturesManager.removeFeature(index);
            });
        });
    }
};

// =========================
// Listings Table Management
// =========================
const PropertiesTable = {
    render: (listings) => {
        if (!propertiesTable) return;
        if (!Array.isArray(listings) || listings.length === 0) {
            propertiesTable.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        <div class="alert alert-info">
                            <i class="fas fa-map-marked-alt fa-2x mb-3"></i>
                            <h5>No Listings Found</h5>
                            <p>Start by adding your first land listing!</p>
                            <button class="btn btn-primary mt-2" onclick="FormManager.reset()">
                                <i class="fas fa-plus"></i> Add First Listing
                            </button>
                        </div>
                    </td>
                </tr>`;
            return;
        }
        propertiesTable.innerHTML = '';
        listings.forEach(listing => {
            const card = Utils.createPropertyCard(listing);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${card.title}</td>
                <td>${card.location}</td>
                <td>${card.type}</td>
                <td>Land Sale</td> <!-- Category fixed -->
                <td>${card.price}</td>
                <td><span class="status-badge ${card.status}">${card.status.charAt(0).toUpperCase() + card.status.slice(1)}</span></td>
                <td>
                    ${card.images.length > 0 ? 
                        `<span class="badge bg-success">${card.images.length} image(s)</span>` : 
                        `<span class="badge bg-warning">No images</span>`
                    }
                </td>
                <td class="actions">
                    <button class="btn btn-outline edit-btn" data-id="${card.id}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger delete-btn" data-id="${card.id}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            propertiesTable.appendChild(tr);
        });
        PropertiesTable.attachEventListeners();
    },

    attachEventListeners: () => {
        if (!propertiesTable) return;
        propertiesTable.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            if (!id) return;
            if (btn.classList.contains('edit-btn')) {
                ListingAPI.editListing(id);
            } else if (btn.classList.contains('delete-btn')) {
                ListingAPI.deleteListing(id);
            }
        });
    },

    showLoading: () => {
        if (!propertiesTable) return;
        propertiesTable.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Loading listings...</p>
                </td>
            </tr>`;
    },

    showError: (error) => {
        if (!propertiesTable) return;
        propertiesTable.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="alert alert-danger">
                        <h5><i class="fas fa-exclamation-triangle"></i> Error Loading Listings</h5>
                        <p>${error}</p>
                    </div>
                </td>
            </tr>`;
    }
};

// =========================
// Transaction Buttons (UI only, not used in payload)
// =========================
const TransactionManager = {
    init: () => {
        const transactionButtons = document.querySelectorAll('.transaction-btn');
        transactionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                transactionButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // We don't store transaction; just UI feedback
            });
        });
    }
};

// =========================
// API Communication
// =========================
const ListingAPI = {
    fetchListings: async () => {
        if (!propertiesTable) return;
        PropertiesTable.showLoading();
        try {
            const listings = await window.PropertyAdminAPI.getAllProperties();
            allListings = listings;
            PropertiesTable.render(listings);
            console.log(`✅ Loaded ${listings.length} listings`);
            return listings;
        } catch (error) {
            console.error('❌ Error fetching listings:', error);
            PropertiesTable.showError(error.message);
            throw error;
        }
    },

    editListing: async (id) => {
        try {
            console.log('✏️ Editing listing ID:', id);
            currentEditId = id;
            const listing = await window.PropertyAdminAPI.getPropertyById(id);
            FormManager.populateForEdit(listing);
        } catch (error) {
            console.error('❌ Error fetching listing data:', error);
            alert(`Error: ${error.message || 'Failed to load listing for editing'}`);
        }
    },

    createListing: async (listingData, imageFiles) => {
        const formData = new FormData();
        Object.keys(listingData).forEach(key => {
            if (listingData[key] !== undefined && listingData[key] !== null) {
                formData.append(key, listingData[key]);
            }
        });
        for (let i = 0; i < imageFiles.length; i++) {
            formData.append('images', imageFiles[i]);
        }
        const response = await fetch(API_ENDPOINTS.addListing, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create listing: ${errorText}`);
        }
        return await response.json();
    },

    updateListing: async (id, listingData, hasNewImages) => {
        if (!hasNewImages) {
            return await fetch(API_ENDPOINTS.listingById(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(listingData)
            }).then(res => {
                if (!res.ok) throw new Error(`Update failed: ${res.status}`);
                return res.json();
            });
        } else {
            const formData = new FormData();
            formData.append('data', JSON.stringify(listingData));
            const imageFiles = imageInput.files;
            for (let i = 0; i < imageFiles.length; i++) {
                formData.append('images', imageFiles[i]);
            }
            return await fetch(API_ENDPOINTS.listingById(id), {
                method: 'PATCH',
                body: formData
            }).then(res => {
                if (!res.ok) throw new Error(`Update failed: ${res.status}`);
                return res.json();
            });
        }
    },

    deleteListing: async (id) => {
        if (!confirm("Are you sure you want to delete this listing?\n\nThis action cannot be undone.")) {
            return;
        }
        try {
            const response = await fetch(API_ENDPOINTS.listingById(id), {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Delete failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            alert(data.message || "✅ Listing deleted successfully!");
            if (currentEditId === id) {
                FormManager.reset();
            }
            await ListingAPI.fetchListings();
        } catch (error) {
            console.error('❌ Error deleting listing:', error);
            alert(`Error: ${error.message || 'Failed to delete listing'}`);
        }
    }
};

// =========================
// Form Submission Handler
// =========================
async function handleFormSubmit(e) {
    e.preventDefault();

    // Validate required fields
    const requiredFields = ['title', 'location', 'type', 'status', 'price', 'size'];
    for (const field of requiredFields) {
        const el = document.getElementById(field);
        if (!el || !el.value.trim()) {
            alert(`Please fill in the ${field} field`);
            return;
        }
    }

    const price = parseFloat(document.getElementById('price').value);
    if (isNaN(price) || price <= 0) {
        alert('Please enter a valid price (positive number)');
        return;
    }

    // Get features (amenities)
    const featuresValue = document.getElementById('features').value;
    let amenities = [];
    try {
        amenities = JSON.parse(featuresValue);
    } catch (e) {
        console.error('Error parsing features:', e);
    }

    // Get due diligence checklist
    const ddHidden = document.getElementById('dueDiligence');
    let verificationChecklist = [];
    if (ddHidden && ddHidden.value) {
        try {
            verificationChecklist = JSON.parse(ddHidden.value);
        } catch (e) {
            console.error('Error parsing due diligence:', e);
        }
    }

    // Prepare listing data (land-only)
    const listingData = {
        title: document.getElementById('title').value.trim(),
        location: document.getElementById('location').value,
        type: document.getElementById('type').value.toLowerCase(),
        status: document.getElementById('status').value.toLowerCase(),
        priceNum: price,
        price: `KES ${price.toLocaleString()}`,
        plotSize: document.getElementById('size').value.trim(),
        description: document.getElementById('description').value || '',
        whatsapp: document.getElementById('whatsapp').value || '254727619305',
        amenities: amenities,
        verificationChecklist: verificationChecklist,
        // Optional fields (not in form yet):
        titleType: '',  // can be added later
        documentsAvailable: [],
        mapLink: ''
    };

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = currentEditId 
            ? '<i class="fas fa-spinner fa-spin"></i> Updating...' 
            : '<i class="fas fa-spinner fa-spin"></i> Creating...';

        let result;
        if (!currentEditId) {
            if (imageInput.files.length === 0) {
                alert('Please select at least one image for new listing');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Listing';
                return;
            }
            result = await ListingAPI.createListing(listingData, imageInput.files);
            alert('✅ Listing created successfully!');
        } else {
            // Include existing images array if any were kept
            listingData.images = existingImages;
            const hasNewImages = imageInput.files.length > 0;
            result = await ListingAPI.updateListing(currentEditId, listingData, hasNewImages);
            alert('✅ Listing updated successfully!');
        }

        FormManager.reset();
        await ListingAPI.fetchListings();
        
    } catch (error) {
        console.error('❌ Error saving listing:', error);
        alert(`Error: ${error.message || 'Failed to save listing'}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = currentEditId 
            ? '<i class="fas fa-save"></i> Update Listing'
            : '<i class="fas fa-save"></i> Create Listing';
    }
}

// =========================
// Authentication
// =========================
const Auth = {
    login: (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (username && password) {
            localStorage.setItem('adminLoggedIn', "true");
            loginSection.style.display = "none";
            adminSection.style.display = "block";
            ListingAPI.fetchListings();
            FormManager.reset();
        } else {
            alert("Please enter credentials");
        }
    },

    logout: () => {
        localStorage.removeItem('adminLoggedIn');
        loginSection.style.display = "block";
        adminSection.style.display = "none";
        FormManager.reset();
    },

    checkAuth: () => {
        return localStorage.getItem('adminLoggedIn') === "true";
    }
};

// =========================
// Server Health Check
// =========================
async function checkServerHealth() {
    try {
        const response = await fetch(API_ENDPOINTS.health);
        if (!response.ok) console.warn('⚠️ Server health check failed');
    } catch (error) {
        console.warn('⚠️ Server may be starting up...');
    }
}

// =========================
// Initialization
// =========================
document.addEventListener('DOMContentLoaded', () => {
    if (Auth.checkAuth()) {
        loginSection.style.display = "none";
        adminSection.style.display = "block";
        checkServerHealth().then(() => {
            ListingAPI.fetchListings();
        });
    }
    
    ImageManager.init();
    FeaturesManager.init();
    TransactionManager.init();
    FormManager.updateStatus('ready');
    
    // Sync due diligence checkboxes with hidden field
    const ddChecks = document.querySelectorAll('.dd-check');
    const ddHidden = document.getElementById('dueDiligence');
    function syncDueDiligence() {
        const selected = Array.from(ddChecks).filter(cb => cb.checked).map(cb => cb.value);
        if (ddHidden) ddHidden.value = JSON.stringify(selected);
    }
    ddChecks.forEach(cb => cb.addEventListener('change', syncDueDiligence));
    syncDueDiligence(); // initial sync
    
    if (loginForm) loginForm.addEventListener('submit', Auth.login);
    if (logoutBtn) logoutBtn.addEventListener('click', Auth.logout);
    if (propertyForm) propertyForm.addEventListener('submit', handleFormSubmit);
    
    const resetBtn = document.getElementById('resetForm');
    if (resetBtn) resetBtn.addEventListener('click', FormManager.reset);
});

// =========================
// Export for testing/usage
// =========================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PropertyAdminAPI,
        Utils,
        ListingAPI,
        Auth
    };
}