// Variables globales
let selectedCourseFile = null;
let selectedImageFile = null;
let activeTab = 'courses';

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
    setupUploads();
});

// Initialisation de l'interface d'administration
function initializeAdmin() {
    console.log('Interface d\'administration initialisée');
}

// Configuration des zones d'upload
function setupUploads() {
    setupCourseUpload();
    setupImageUpload();
}

// ========================================
// GESTION DES ONGLETS
// ========================================

function switchTab(tabName) {
    // Mettre à jour les onglets
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Mettre à jour les sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    if (tabName === 'courses') {
        document.getElementById('coursesSection').classList.add('active');
        activeTab = 'courses';
    } else if (tabName === 'images') {
        document.getElementById('imagesSection').classList.add('active');
        activeTab = 'images';
    }
    
    // Réinitialiser les formulaires lors du changement d'onglet
    resetAllForms();
}

// ========================================
// UPLOAD DE COURS (.ODT)
// ========================================

function setupCourseUpload() {
    const uploadArea = document.getElementById('courseUploadArea');
    const fileInput = document.getElementById('courseFileInput');
    
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
        handleCourseFileSelection(e.dataTransfer.files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleCourseFileSelection(e.target.files[0]);
    });
}

function handleCourseFileSelection(file) {
    if (!file) return;
    
    // Vérification du type de fichier
    if (!file.name.toLowerCase().endsWith('.odt')) {
        showStatus('Seuls les fichiers .odt sont acceptés pour les cours', 'error');
        return;
    }
    
    selectedCourseFile = file;
    showCourseFilePreview(file);
    document.getElementById('courseMetadataForm').style.display = 'block';
    document.getElementById('courseUploadBtn').disabled = false;
}

function showCourseFilePreview(file) {
    // Supprimer l'ancien aperçu s'il existe
    const existingPreview = document.querySelector('#courseMetadataForm .file-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    const preview = document.createElement('div');
    preview.className = 'file-preview';
    preview.innerHTML = `
        <div class="file-icon">📄</div>
        <div class="file-info">
            <h4>${file.name}</h4>
            <p>${(file.size/1024).toFixed(1)} KB • Fichier ODT</p>
            <p>Prêt pour l'extraction et le traitement</p>
        </div>
        <button class="remove-file-btn" onclick="removeCourseFilePreview()">✖ Supprimer</button>
    `;
    
    document.getElementById('courseMetadataForm').prepend(preview);
}

function removeCourseFilePreview() {
    selectedCourseFile = null;
    const preview = document.querySelector('#courseMetadataForm .file-preview');
    if (preview) preview.remove();
    document.getElementById('courseMetadataForm').style.display = 'none';
    document.getElementById('courseFileInput').value = '';
    document.getElementById('courseUploadBtn').disabled = true;
}

async function uploadCourse() {
    if (!selectedCourseFile) {
        showStatus('Aucun fichier de cours sélectionné', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedCourseFile);
    
    try {
        showStatus('Traitement du fichier ODT en cours...', 'info');
        
        // D'abord extraire le contenu du fichier
        const extractResponse = await fetch('/api/extract_odt', {
            method: 'POST',
            body: formData
        });
        
        const extractResult = await extractResponse.json();
        
        if (!extractResponse.ok) {
            throw new Error(extractResult.error || 'Erreur lors de l\'extraction');
        }
        
        // Ensuite ajouter le cours à la base de données
        const addResponse = await fetch('/api/add_course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(extractResult)
        });
        
        const addResult = await addResponse.json();
        
        if (addResponse.ok && addResult.success) {
            showStatus(`✅ Cours "${extractResult.metadata.title}" ajouté avec succès ! (${extractResult.definitions.length} définitions)`, 'success');
            resetCourseForm();
        } else {
            throw new Error(addResult.error || 'Erreur lors de l\'ajout du cours');
        }
        
    } catch (error) {
        showStatus(`❌ Erreur : ${error.message}`, 'error');
        console.error('Erreur upload cours:', error);
    }
}

function resetCourseForm() {
    selectedCourseFile = null;
    document.getElementById('courseMetadataForm').style.display = 'none';
    document.getElementById('courseFileInput').value = '';
    document.getElementById('courseUploadBtn').disabled = true;
    
    const preview = document.querySelector('#courseMetadataForm .file-preview');
    if (preview) preview.remove();
}

// ========================================
// UPLOAD D'IMAGES
// ========================================

function setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('imageFileInput');
    
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
        handleImageFileSelection(e.dataTransfer.files[0]);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleImageFileSelection(e.target.files[0]);
    });
}

function handleImageFileSelection(file) {
    if (!file) return;
    
    // Vérification du type de fichier
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
        showStatus('Seuls les fichiers PNG, JPG et PDF sont acceptés pour les images', 'error');
        return;
    }
    
    // Vérification de la taille (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showStatus('Le fichier est trop volumineux (max 5MB)', 'error');
        return;
    }
    
    selectedImageFile = file;
    showImageFilePreview(file);
    document.getElementById('imageMetadataForm').style.display = 'block';
    document.getElementById('imageUploadBtn').disabled = false;
}

function showImageFilePreview(file) {
    // Supprimer l'ancien aperçu s'il existe
    const existingPreview = document.querySelector('#imageMetadataForm .file-preview');
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
                <div class="file-info">
                    <h4>${file.name}</h4>
                    <p>${(file.size/1024).toFixed(1)} KB • ${file.type.split('/')[1].toUpperCase()}</p>
                </div>
                <button class="remove-file-btn" onclick="removeImageFilePreview()">✖ Supprimer</button>
            `;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `
            <div class="file-icon">📄</div>
            <div class="file-info">
                <h4>${file.name}</h4>
                <p>${(file.size/1024).toFixed(1)} KB • PDF</p>
            </div>
            <button class="remove-file-btn" onclick="removeImageFilePreview()">✖ Supprimer</button>
        `;
    }
    
    document.getElementById('imageMetadataForm').prepend(preview);
}

function removeImageFilePreview() {
    selectedImageFile = null;
    const preview = document.querySelector('#imageMetadataForm .file-preview');
    if (preview) preview.remove();
    document.getElementById('imageMetadataForm').style.display = 'none';
    document.getElementById('imageFileInput').value = '';
    document.getElementById('imageUploadBtn').disabled = true;
    resetImageFormFields();
}

async function uploadImage() {
    if (!selectedImageFile) {
        showStatus('Aucune image sélectionnée', 'error');
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
    formData.append('file', selectedImageFile);
    formData.append('category', category);
    formData.append('subcategory', subcategory);
    formData.append('description', description);
    formData.append('tags', tagsInput);
    
    try {
        showStatus('Upload de l\'image en cours...', 'info');
        
        const response = await fetch('/api/upload_image', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showStatus(`✅ Image "${description}" uploadée avec succès !`, 'success');
            resetImageForm();
        } else {
            throw new Error(result.error || 'Erreur inconnue');
        }
    } catch (error) {
        showStatus(`❌ Erreur : ${error.message}`, 'error');
        console.error('Erreur upload image:', error);
    }
}

function resetImageForm() {
    selectedImageFile = null;
    document.getElementById('imageMetadataForm').style.display = 'none';
    document.getElementById('imageFileInput').value = '';
    document.getElementById('imageUploadBtn').disabled = true;
    resetImageFormFields();
    
    const preview = document.querySelector('#imageMetadataForm .file-preview');
    if (preview) preview.remove();
}

function resetImageFormFields() {
    document.getElementById('categorySelect').value = '';
    document.getElementById('subcategoryInput').value = '';
    document.getElementById('descriptionInput').value = '';
    document.getElementById('tagsInput').value = '';
}

// ========================================
// FONCTIONS UTILITAIRES
// ========================================

function resetAllForms() {
    resetCourseForm();
    resetImageForm();
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    // Faire défiler vers le message
    statusDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Faire disparaître le message après 5 secondes (sauf pour les succès)
    if (type !== 'success') {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 5000);
    } else {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 8000);
    }
}

// Gestion des touches clavier
document.addEventListener('keydown', function(event) {
    // Échap pour réinitialiser
    if (event.key === 'Escape') {
        if (activeTab === 'courses') {
            resetCourseForm();
        } else if (activeTab === 'images') {
            resetImageForm();
        }
    }
    
    // Ctrl+1 et Ctrl+2 pour changer d'onglet
    if (event.ctrlKey) {
        if (event.key === '1') {
            event.preventDefault();
            document.querySelector('[onclick="switchTab(\'courses\')"]').click();
        } else if (event.key === '2') {
            event.preventDefault();
            document.querySelector('[onclick="switchTab(\'images\')"]').click();
        }
    }
});