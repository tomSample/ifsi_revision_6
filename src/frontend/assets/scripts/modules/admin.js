// Import modules
// import { logger } from './logger.js'; // Désactivé temporairement

// Variables globales
let selectedCourseFiles = [];
const courseFileStates = new Map();
let selectedImageFile = null;
let activeTab = 'courses';

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', function() {
    initializeAdmin();
    setupUploads();
});

// Initialisation de l'interface d'administration
function initializeAdmin() {
    console.log('✅ Interface d\'administration initialisée');
}

// Configuration des zones d'upload
function setupUploads() {
    setupCourseUpload();
    setupImageUpload();
}

// ========================================
// GESTION DES ONGLETS
// ========================================
// NOTE: switchTab() est défini dans admin.html pour gérer tous les onglets (courses, images, reports, feedbacks)

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
        handleCourseFileSelection(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', (e) => {
        handleCourseFileSelection(e.target.files);
    });
}

function handleCourseFileSelection(files) {
    const newFiles = Array.from(files || []);
    if (newFiles.length === 0) return;

    const invalidFile = newFiles.find(file => !file.name.toLowerCase().endsWith('.odt'));
    if (invalidFile) {
        showStatus(`Le fichier "${invalidFile.name}" n'est pas un fichier .odt`, 'error');
    }

    const existingFiles = new Set(
        selectedCourseFiles.map(file => `${file.name}-${file.size}-${file.lastModified}`)
    );
    newFiles
        .filter(file => file.name.toLowerCase().endsWith('.odt'))
        .forEach(file => {
            const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
            if (!existingFiles.has(fileKey)) {
                selectedCourseFiles.push(file);
                existingFiles.add(fileKey);
            }
        });

    renderCourseFilePreviews();
    document.getElementById('courseMetadataForm').style.display = 'block';
    document.getElementById('courseUploadBtn').disabled = selectedCourseFiles.length === 0;
    newFiles
        .filter(file => file.name.toLowerCase().endsWith('.odt'))
        .forEach(file => checkCourseFile(file));
}

function getCourseFileKey(file) {
    return `${file.name}-${file.size}-${file.lastModified}`;
}

async function checkCourseFile(file) {
    const fileKey = getCourseFileKey(file);
    if (courseFileStates.has(fileKey)) return;

    courseFileStates.set(fileKey, { status: 'checking' });
    renderCourseFilePreviews();

    try {
        const courseData = await extractCourseFile(file);
        const response = await fetch('/api/check_course', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(courseData)
        });
        const result = await parseJsonResponse(response, 'Erreur lors de la vérification du cours');
        courseFileStates.set(fileKey, { status: result.status, courseData, details: result });
    } catch (error) {
        courseFileStates.set(fileKey, { status: 'error', error: error.message });
    }
    renderCourseFilePreviews();
}

function renderCourseFilePreviews() {
    const form = document.getElementById('courseMetadataForm');
    form.querySelectorAll('.course-file-preview').forEach(preview => preview.remove());

    selectedCourseFiles.forEach((file, index) => {
        const state = courseFileStates.get(getCourseFileKey(file)) || { status: 'checking' };
        const statusLabels = {
            checking: '🔄 Vérification en cours...',
            new: '✅ Cours nouveau — sera ajouté',
            duplicate_no_change: '⚠️ Doublon identique — ignoré automatiquement',
            confirm_update: '🔁 Version différente détectée — remplacement à confirmer',
            error: `❌ ${state.error || 'Vérification impossible'}`
        };
        const preview = document.createElement('div');
        preview.className = 'file-preview course-file-preview';
        preview.innerHTML = `
            <div class="file-icon">📄</div>
            <div class="file-info">
                <h4>${file.name}</h4>
                <p>${(file.size / 1024).toFixed(1)} KB • Fichier ODT</p>
                <p class="course-file-status course-file-status-${state.status}">${statusLabels[state.status]}</p>
            </div>
            <button class="remove-file-btn" type="button">✖ Supprimer</button>
        `;
        preview.querySelector('.remove-file-btn').addEventListener('click', () => {
            const [removedFile] = selectedCourseFiles.splice(index, 1);
            courseFileStates.delete(getCourseFileKey(removedFile));
            renderCourseFilePreviews();
            document.getElementById('courseUploadBtn').disabled = selectedCourseFiles.length === 0;
            if (selectedCourseFiles.length === 0) {
                document.getElementById('courseMetadataForm').style.display = 'none';
            }
        });
        form.prepend(preview);
    });
}

function removeCourseFilePreview() {
    selectedCourseFiles = [];
    courseFileStates.clear();
    document.querySelectorAll('#courseMetadataForm .course-file-preview').forEach(preview => preview.remove());
    document.getElementById('courseMetadataForm').style.display = 'none';
    document.getElementById('courseFileInput').value = '';
    document.getElementById('courseUploadBtn').disabled = true;
}

async function uploadCourse() {
    if (selectedCourseFiles.length === 0) {
        showStatus('Aucun fichier de cours sélectionné', 'error');
        return;
    }

    const filesToUpload = [...selectedCourseFiles];
    const uploadButton = document.getElementById('courseUploadBtn');
    uploadButton.disabled = true;
    let uploadedCount = 0;
    let skippedCount = 0;

    try {
        await Promise.all(filesToUpload.map(file => checkCourseFile(file)));
        for (const [index, file] of filesToUpload.entries()) {
            showStatus(`Traitement du fichier ${index + 1}/${filesToUpload.length} : ${file.name}`, 'info');
            const fileState = courseFileStates.get(getCourseFileKey(file));
            if (!fileState || fileState.status === 'error') {
                throw new Error(fileState?.error || `Vérification impossible pour "${file.name}"`);
            }
            if (fileState.status === 'duplicate_no_change') {
                skippedCount++;
                continue;
            }
            const extractResult = fileState.courseData;
            const addResult = await addCourseData(extractResult);

            if (addResult.success) {
                uploadedCount++;
                sessionStorage.removeItem('coursesData_session');
            } else if (addResult.action_required === 'duplicate_no_change') {
                skippedCount++;
            } else if (addResult.action_required === 'confirm_update') {
                if (confirmDuplicateCourse(addResult)) {
                    await updateExistingCourse(extractResult, false);
                    uploadedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                throw new Error(addResult.error || `Erreur lors de l'ajout de "${file.name}"`);
            }
        }

        showStatus(`✅ Import terminé : ${uploadedCount} cours ajouté(s), ${skippedCount} ignoré(s).`, 'success');
        resetCourseForm();
    } catch (error) {
        showStatus(`❌ Erreur : ${error.message}`, 'error');
        console.error('Erreur upload cours:', error);
    } finally {
        uploadButton.disabled = selectedCourseFiles.length === 0;
    }
}

async function extractCourseFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/extract_odt', { method: 'POST', body: formData });
    const result = await parseJsonResponse(response, 'Erreur lors de l\'extraction');
    if (!result.metadata || !result.definitions) {
        throw new Error('Format de données invalide. Le fichier ODT n\'a pas pu être correctement parsé.');
    }
    return result;
}

async function addCourseData(courseData) {
    const response = await fetch('/api/add_course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseData)
    });
    return parseJsonResponse(response, 'Erreur lors de l\'ajout du cours', [409]);
}

async function parseJsonResponse(response, defaultMessage, acceptedStatuses = []) {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error(defaultMessage);
    }
    const result = await response.json();
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
        throw new Error(result.error || defaultMessage);
    }
    return result;
}

function resetCourseForm() {
    selectedCourseFiles = [];
    courseFileStates.clear();
    document.getElementById('courseMetadataForm').style.display = 'none';
    document.getElementById('courseFileInput').value = '';
    document.getElementById('courseUploadBtn').disabled = true;
    document.querySelectorAll('#courseMetadataForm .course-file-preview').forEach(preview => preview.remove());
}

// Gérer les cours en doublon
function confirmDuplicateCourse(duplicateInfo) {
    const existing = duplicateInfo.existing_course;
    const newCourse = duplicateInfo.new_course;
    
    const confirmMsg = `⚠️ Ce cours existe déjà !

Cours existant :
- Titre : ${existing.title}
- Date : ${existing.date}
- Auteur : ${existing.author}
- ${existing.definitions_count} définitions

Nouveau fichier :
- Titre : ${newCourse.title}
- Date : ${newCourse.date}
- Auteur : ${newCourse.author}
- ${newCourse.definitions_count} définitions

Voulez-vous remplacer le cours existant ?`;

    return confirm(confirmMsg);
}

// Mettre à jour un cours existant
async function updateExistingCourse(courseData, resetForm = true) {
    try {
        showStatus('Mise à jour du cours en cours...', 'info');
        
        const response = await fetch('/api/update_course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(courseData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            sessionStorage.removeItem('coursesData_session');
            showStatus(`✅ Cours "${courseData.metadata.title}" mis à jour avec succès !`, 'success');
            if (resetForm) resetCourseForm();
        } else {
            throw new Error(result.error || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        showStatus(`❌ Erreur : ${error.message}`, 'error');
        console.error('Erreur mise à jour cours:', error);
        throw error;
    }
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
    const title = document.getElementById('titleInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();
    
    if (!category || !title) {
        showStatus('Veuillez remplir au minimum la catégorie et le titre', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', selectedImageFile);
    formData.append('category', category);
    formData.append('title', title);
    formData.append('description', description);
    
    try {
        showStatus('Upload de l\'image en cours...', 'info');
        
        const response = await fetch('/api/upload_image', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showStatus(`✅ Image "${title}" uploadée avec succès !`, 'success');
            resetImageForm();
        } else {
            throw new Error(result.error || 'Erreur inconnue');
        }
    } catch (error) {
        showStatus(`❌ Erreur : ${error.message}`, 'error');
        console.error('❌ Erreur upload image:', error);
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
    document.getElementById('titleInput').value = '';
    document.getElementById('descriptionInput').value = '';
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