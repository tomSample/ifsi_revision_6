// Variables globales
let imagesData = { images: [], categories: {} };
let selectedFile = null;

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    initializeGallery();
    setupUpload();
    // Vérifier l'authentification pour afficher les boutons admin
    if (typeof authManager !== 'undefined') {
        authManager.checkAuthStatus();
    }
});

// Initialisation de la galerie
async function initializeGallery() {
    await loadImages();
    populateCategories();
    displayImages('all');
}

// Configuration de l'upload
function setupUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // Gestion du drag & drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFileSelection(e.dataTransfer.files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFileSelection(e.target.files[0]);
    });
}

// Gestion de la sélection de fichier
function handleFileSelection(file) {
    if (!file) return;
    
    // Vérification du type de fichier
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showStatus('Seuls les fichiers PNG, JPG et PDF sont acceptés', 'error');
        return;
    }
    
    // Vérification de la taille (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showStatus('Le fichier est trop volumineux (max 5MB)', 'error');
        return;
    }
    
    selectedFile = file;
    showFilePreview(file);
    document.getElementById('metadataForm').style.display = 'block';
}

// Affichage de l'aperçu du fichier
function showFilePreview(file) {
    // Supprimer l'ancien aperçu s'il existe
    const existingPreview = document.querySelector('.file-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <img src="${e.target.result}" alt="Aperçu">
                <div>
                    <strong>${file.name}</strong><br>
                    <small>${(file.size/1024).toFixed(1)} KB • ${file.type.split('/')[1].toUpperCase()}</small>
                </div>
                <button onclick="removeFilePreview()" style="margin-left: auto; background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem;">✖</button>
            `;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `
            <div class="pdf-icon">📄</div>
            <div>
                <strong>${file.name}</strong><br>
                <small>${(file.size/1024).toFixed(1)} KB • PDF</small>
            </div>
            <button onclick="removeFilePreview()" style="margin-left: auto; background: #dc3545; color: white; border: none; border-radius: 4px; padding: 0.5rem;">✖</button>
        `;
    }
    
    document.getElementById('metadataForm').prepend(preview);
}

// Supprimer l'aperçu du fichier
function removeFilePreview() {
    selectedFile = null;
    const preview = document.querySelector('.file-preview');
    if (preview) preview.remove();
    document.getElementById('metadataForm').style.display = 'none';
    document.getElementById('fileInput').value = '';
    resetForm();
}

// Upload de l'image
async function uploadImage() {
    if (!selectedFile) {
        showStatus('Aucun fichier sélectionné', 'error');
        return;
    }
    
    const category = document.getElementById('categorySelect').value;
    const subcategory = document.getElementById('subcategoryInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();
    const tagsInput = document.getElementById('tagsInput').value.trim();
    
    if (!category || !description) {
        showStatus('Veuillez remplir au minimum la catégorie et la description', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('category', category);
    formData.append('subcategory', subcategory);
    formData.append('description', description);
    formData.append('tags', tagsInput);
    
    try {
        showStatus('Upload en cours...', 'info');
        
        const response = await fetch('/api/upload_image', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showStatus('✅ Image uploadée avec succès !', 'success');
            resetUploadForm();
            await loadImages(); // Recharger les images
            displayImages('all'); // Réafficher la galerie
        } else {
            showStatus(`❌ Erreur : ${result.error || 'Erreur inconnue'}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ Erreur de connexion : ${error.message}`, 'error');
        console.error('Erreur upload:', error);
    }
}

// Chargement des images depuis le serveur
async function loadImages() {
    try {
        const response = await fetch('images_metadata.json');
        if (response.ok) {
            imagesData = await response.json();
        } else {
            // Fichier n'existe pas encore, initialiser structure vide
            imagesData = {
                images: [],
                categories: {
                    "anatomie-physiologie": {
                        name: "Anatomie & Physiologie",
                        icon: "🫀",
                        description: "Schémas anatomiques et mécanismes physiologiques"
                    },
                    "systemes": {
                        name: "Systèmes & Processus", 
                        icon: "⚙️",
                        description: "Processus pathologiques et systémiques"
                    },
                    "normes": {
                        name: "Normes & Protocoles",
                        icon: "📋", 
                        description: "Valeurs de référence et protocoles de soins"
                    }
                }
            };
        }
    } catch (error) {
        console.log('Première utilisation - aucune image encore uploadée');
        imagesData = {
            images: [],
            categories: {
                "anatomie-physiologie": {
                    name: "Anatomie & Physiologie",
                    icon: "🫀",
                    description: "Schémas anatomiques et mécanismes physiologiques"
                },
                "systemes": {
                    name: "Systèmes & Processus",
                    icon: "⚙️", 
                    description: "Processus pathologiques et systémiques"
                },
                "normes": {
                    name: "Normes & Protocoles",
                    icon: "📋",
                    description: "Valeurs de référence et protocoles de soins"
                }
            }
        };
    }
}

// Peupler les catégories (pour futur usage)
function populateCategories() {
    // Ici on pourrait dynamiquement peupler les sélecteurs
    // Actuellement les catégories sont codées en dur dans le HTML
}

// Affichage des images selon la catégorie
function displayImages(categoryFilter) {
    const grid = document.getElementById('imagesGrid');
    let filteredImages = imagesData.images;
    
    if (categoryFilter !== 'all') {
        filteredImages = imagesData.images.filter(img => img.category === categoryFilter);
    }
    
    if (filteredImages.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🖼️</div>
                <h4>Aucune image dans cette catégorie</h4>
                <p>Commencez par uploader votre première image !</p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredImages.map(img => `
        <div class="image-card">
            <div class="image-thumbnail">
                ${img.type === 'pdf' ? 
                    '<div class="pdf-thumbnail">📄</div>' :
                    `<img src="images/${img.category}/${img.filename}" alt="${img.description}">`
                }
            </div>
            <div class="image-info">
                <h4>${img.description}</h4>
                <div class="image-meta">
                    ${imagesData.categories[img.category]?.icon || '📁'} ${imagesData.categories[img.category]?.name || img.category}
                    ${img.subcategory ? ` • ${img.subcategory}` : ''}
                    <br>
                    📅 ${img.uploaded_date} • 📏 ${img.size}
                </div>
                ${img.tags && img.tags.length > 0 ? `
                    <div class="image-tags">
                        ${img.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="image-actions">
                    <button class="action-btn view-btn" onclick="viewImageInModal('images/${img.category}/${img.filename}', ${JSON.stringify(img).replace(/"/g, '&quot;')})">
                        👁️ Voir
                    </button>
                    <button class="action-btn download-btn" onclick="downloadImage('${img.id}')">
                        ⬇️ Télécharger
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteImage('images/${img.category}/${img.filename}', ${JSON.stringify(img).replace(/"/g, '&quot;')})">
                        🗑️ Supprimer
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Changer de catégorie
function showCategory(category) {
    // Mettre à jour les onglets actifs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Afficher les images de la catégorie
    displayImages(category);
}

// Voir une image
function viewImage(imageId) {
    const image = imagesData.images.find(img => img.id === imageId);
    if (!image) return;
    
    const imageUrl = `images/${image.category}/${image.filename}`;
    
    if (image.type === 'pdf') {
        // Ouvrir le PDF dans un nouvel onglet
        window.open(imageUrl, '_blank');
    } else {
        // Créer une modal pour afficher l'image
        showImageModal(image, imageUrl);
    }
}

// Modal pour afficher l'image
function showImageModal(image, imageUrl) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        cursor: pointer;
    `;
    
    modal.innerHTML = `
        <div style="max-width: 90%; max-height: 90%; text-align: center;">
            <img src="${imageUrl}" alt="${image.description}" 
                 style="max-width: 100%; max-height: 80vh; border-radius: 8px;">
            <div style="color: white; padding: 1rem; background: rgba(0,0,0,0.7); border-radius: 8px; margin-top: 1rem;">
                <h3>${image.description}</h3>
                <p>${image.subcategory ? image.subcategory + ' • ' : ''}${image.uploaded_date}</p>
            </div>
        </div>
    `;
    
    modal.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    document.body.appendChild(modal);
}

// Télécharger une image
function downloadImage(imageId) {
    const image = imagesData.images.find(img => img.id === imageId);
    if (!image) return;
    
    const imageUrl = `images/${image.category}/${image.filename}`;
    
    // Créer un lien de téléchargement
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = image.original_name || image.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Réinitialiser le formulaire d'upload
function resetUploadForm() {
    selectedFile = null;
    document.getElementById('metadataForm').style.display = 'none';
    document.getElementById('fileInput').value = '';
    resetForm();
    
    const preview = document.querySelector('.file-preview');
    if (preview) preview.remove();
}

// Réinitialiser les champs du formulaire
function resetForm() {
    document.getElementById('categorySelect').value = '';
    document.getElementById('subcategoryInput').value = '';
    document.getElementById('descriptionInput').value = '';
    document.getElementById('tagsInput').value = '';
}

// Afficher un message de statut
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Faire disparaître le message après 5 secondes
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }, 5000);
}

// Gestion des touches clavier
document.addEventListener('keydown', function(event) {
    // Échap pour fermer la modal
    if (event.key === 'Escape') {
        const modal = document.querySelector('[style*="position: fixed"]');
        if (modal) {
            document.body.removeChild(modal);
        }
        closeImageModal();
        cancelDelete();
    }
});

// Variables pour la navigation d'images
let currentImageIndex = 0;
let currentImagesList = [];
let imageToDelete = null;

// Fonction pour visualiser l'image dans la modal
function viewImageInModal(imagePath, imageData) {
    openImageModal(imagePath, imageData);
}

// Fonction pour ouvrir l'image avec navigation
function openImageModal(imagePath, imageData) {
    // Mettre à jour la liste des images actuelles
    const currentCategory = document.querySelector('.category-tab.active').dataset.category || 
                           document.querySelector('.category-tab.active').onclick.toString().match(/showCategory\('(.+?)'\)/)[1];
    
    if (currentCategory === 'all') {
        currentImagesList = imagesData.images;
    } else {
        currentImagesList = imagesData.images.filter(img => img.category === currentCategory);
    }
    
    // Trouver l'index de l'image actuelle
    currentImageIndex = currentImagesList.findIndex(img => img.path === imagePath);
    
    // Afficher la modal
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    
    modalImage.src = imagePath;
    modalTitle.textContent = imageData.description || imageData.filename;
    modalDescription.textContent = `Catégorie: ${imageData.category} | Tags: ${(imageData.tags || []).join(', ')}`;
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Fermer la modal d'image
function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Navigation vers l'image précédente
function previousImage() {
    if (currentImagesList.length === 0) return;
    
    currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : currentImagesList.length - 1;
    const currentImage = currentImagesList[currentImageIndex];
    
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    
    modalImage.src = currentImage.path;
    modalTitle.textContent = currentImage.description || currentImage.filename;
    modalDescription.textContent = `Catégorie: ${currentImage.category} | Tags: ${(currentImage.tags || []).join(', ')}`;
}

// Navigation vers l'image suivante
function nextImage() {
    if (currentImagesList.length === 0) return;
    
    currentImageIndex = currentImageIndex < currentImagesList.length - 1 ? currentImageIndex + 1 : 0;
    const currentImage = currentImagesList[currentImageIndex];
    
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    
    modalImage.src = currentImage.path;
    modalTitle.textContent = currentImage.description || currentImage.filename;
    modalDescription.textContent = `Catégorie: ${currentImage.category} | Tags: ${(currentImage.tags || []).join(', ')}`;
}

// Fonction pour initier la suppression d'image (protégée par authentification)
function deleteImage(imagePath, imageData) {
    authManager.adminAction(() => {
        imageToDelete = { path: imagePath, data: imageData };
        
        const deleteConfirm = document.getElementById('deleteConfirm');
        const deleteImageName = document.getElementById('deleteImageName');
        
        deleteImageName.textContent = imageData.description || imageData.filename;
        deleteConfirm.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });
}

// Annuler la suppression
function cancelDelete() {
    const deleteConfirm = document.getElementById('deleteConfirm');
    deleteConfirm.style.display = 'none';
    document.body.style.overflow = 'auto';
    imageToDelete = null;
}

// Confirmer la suppression
async function confirmDelete() {
    if (!imageToDelete) return;
    
    try {
        const response = await fetch('/api/delete_image', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imagePath: imageToDelete.path
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('Image supprimée avec succès', 'success');
            cancelDelete();
            // Recharger la galerie
            await loadImages();
            const activeTab = document.querySelector('.category-tab.active');
            const category = activeTab.dataset.category || 
                           activeTab.onclick.toString().match(/showCategory\('(.+?)'\)/)[1];
            displayImages(category);
        } else {
            showStatus('Erreur lors de la suppression: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showStatus('Erreur lors de la suppression', 'error');
    }
}