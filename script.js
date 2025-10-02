// Variables globales
let selectedFile = null;
let extractedData = null;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentStats();
    setupEventListeners();
    
    // Rafraîchir les statistiques toutes les 30 secondes
    setInterval(loadCurrentStats, 30000);
    
    // Rafraîchir les statistiques quand la page redevient visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            loadCurrentStats();
        }
    });
});

// Configuration des événements
function setupEventListeners() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Gestion du drag & drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => fileInput.click());

    // Gestion de la sélection de fichier
    fileInput.addEventListener('change', handleFileSelect);
}

// Gestion du drag over
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

// Gestion du drag leave
function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

// Gestion du drop
function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelection(files[0]);
    }
}

// Gestion de la sélection de fichier
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFileSelection(files[0]);
    }
}

// Traitement de la sélection de fichier
function handleFileSelection(file) {
    // Vérification du type de fichier
    if (!file.name.toLowerCase().endsWith('.odt')) {
        showStatus('Erreur : Seuls les fichiers .odt sont acceptés.', 'error');
        return;
    }

    selectedFile = file;
    showFilePreview(file);
    
    // Simulation de l'extraction des données (à remplacer par le traitement réel)
    simulateFileExtraction(file);
}

// Affichage de l'aperçu du fichier
function showFilePreview(file) {
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const uploadArea = document.getElementById('uploadArea');

    fileName.textContent = file.name;
    filePreview.style.display = 'block';
    uploadArea.style.display = 'none';
}

// Suppression du fichier sélectionné
function removeFile() {
    selectedFile = null;
    extractedData = null;
    
    const filePreview = document.getElementById('filePreview');
    const uploadArea = document.getElementById('uploadArea');
    const previewSection = document.getElementById('previewSection');
    const uploadBtn = document.getElementById('uploadBtn');

    filePreview.style.display = 'none';
    uploadArea.style.display = 'block';
    previewSection.style.display = 'none';
    uploadBtn.disabled = true;

    // Reset du input file
    document.getElementById('fileInput').value = '';
}

// Extraction réelle des données du fichier ODT
async function simulateFileExtraction(file) {
    showStatus('Extraction des données en cours...', 'processing');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/extract_odt', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            extractedData = await response.json();
            
            // Vérifier si les données sont valides
            if (!extractedData.metadata || !extractedData.definitions) {
                throw new Error('Données extraites invalides');
            }
            
            console.log('Données extraites:', extractedData); // Debug
            showDataPreview(extractedData);
            showStatus('Données extraites avec succès !', 'success');
            document.getElementById('uploadBtn').disabled = false;
        } else {
            const error = await response.json();
            console.error('Erreur serveur:', error); // Debug
            
            // Si le serveur retourne du contenu brut pour debug
            if (error.raw_content) {
                console.log('Contenu brut extrait:', error.raw_content);
                showStatus(`❌ Erreur de parsing. Contenu détecté: ${error.raw_content.substring(0, 100)}...`, 'error');
            } else {
                throw new Error(error.error || 'Erreur lors de l\'extraction');
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        showStatus(`❌ Erreur lors de l'extraction: ${error.message}`, 'error');
        
        // Fallback: utilisation des données simulées pour la démonstration
        extractedData = {
            metadata: {
                ue: "3.10",
                title: "Les bactéries (exemple)",
                author: "test",
                date: "19/09/2025"
            },
            definitions: [
                {
                    term: "Bactérie",
                    definition: "micro-organisme eucaryote avec un chromosome d'ADN libre dans le cytoplasme. Se reproduit par simple division"
                },
                {
                    term: "Biofilm",
                    definition: "amas de cellules bactériennes enrobés d'une matrice ⇒ difficile à déloger"
                }
            ]
        };
        showDataPreview(extractedData);
        showStatus('⚠️ Utilisation de données d\'exemple (erreur d\'extraction)', 'error');
        document.getElementById('uploadBtn').disabled = false;
    }
}

// Affichage de l'aperçu des données extraites
function showDataPreview(data) {
    const previewSection = document.getElementById('previewSection');
    const metadataPreview = document.getElementById('metadataPreview');
    const definitionsPreview = document.getElementById('definitionsPreview');

    console.log('Données reçues pour preview:', data); // Debug

    // Affichage des métadonnées
    metadataPreview.innerHTML = `
        <h4>📋 Métadonnées du cours</h4>
        <div class="metadata-item">
            <span class="metadata-label">UE :</span>
            <span class="metadata-value">${data.metadata.ue || 'Non défini'}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">Titre :</span>
            <span class="metadata-value">${data.metadata.title || 'Non défini'}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">Auteur :</span>
            <span class="metadata-value">${data.metadata.author || 'Non défini'}</span>
        </div>
        <div class="metadata-item">
            <span class="metadata-label">Date :</span>
            <span class="metadata-value">${data.metadata.date || 'Non défini'}</span>
        </div>
    `;

    // Affichage des définitions
    let definitionsHtml = '<h4>📝 Termes et définitions</h4>';
    
    console.log('Nombre de définitions:', data.definitions ? data.definitions.length : 0); // Debug
    
    if (data.definitions && data.definitions.length > 0) {
        data.definitions.forEach((def, index) => {
            console.log(`Définition ${index + 1}:`, def); // Debug
            definitionsHtml += `
                <div class="definition-item">
                    <div class="definition-term">${index + 1}. ${def.term || 'Terme non défini'}</div>
                    <div class="definition-text">${def.definition || 'Définition non définie'}</div>
                </div>
            `;
        });
    } else {
        definitionsHtml += `
            <div class="definition-item" style="text-align: center; color: #999; font-style: italic;">
                <p>❌ Aucune définition trouvée</p>
                <p>Vérifiez le format de votre fichier .odt</p>
            </div>
        `;
    }
    
    definitionsPreview.innerHTML = definitionsHtml;
    previewSection.style.display = 'block';
}

// Traitement du fichier et ajout au JSON
async function processFile() {
    if (!extractedData) {
        showStatus('Erreur : Aucune donnée extraite.', 'error');
        return;
    }

    showStatus('Vérification des doublons...', 'processing');

    try {
        // Appel à l'API Python pour traiter le fichier
        const response = await fetch('/api/add_course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(extractedData)
        });

        if (response.ok) {
            const result = await response.json();
            showStatus('✅ Cours ajouté avec succès au fichier JSON !', 'success');
            loadCurrentStats(); // Recharger les statistiques
            
            // Reset du formulaire après succès
            setTimeout(() => {
                resetForm();
            }, 3000);
            
        } else if (response.status === 409) {
            // Conflit - cours déjà existant
            const conflict = await response.json();
            showDuplicateDialog(conflict);
            
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors de l\'ajout des données');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showStatus('❌ Erreur lors de l\'ajout des données au fichier JSON.', 'error');
    }
}

// Affichage du dialogue de doublon
function showDuplicateDialog(conflictData) {
    const existing = conflictData.existing_course;
    const newCourse = conflictData.new_course;
    
    const dialogHtml = `
        <div class="duplicate-dialog" id="duplicateDialog">
            <div class="duplicate-content">
                <h3>⚠️ Cours déjà existant</h3>
                <p>Un cours avec le même titre existe déjà dans la base de données :</p>
                
                <div class="course-comparison">
                    <div class="existing-course">
                        <h4>📚 Cours existant</h4>
                        <div class="course-info">
                            <p><strong>Titre :</strong> ${existing.title}</p>
                            <p><strong>UE :</strong> ${existing.ue}</p>
                            <p><strong>Date :</strong> ${existing.date}</p>
                            <p><strong>Auteur :</strong> ${existing.author}</p>
                            <p><strong>Définitions :</strong> ${existing.definitions_count}</p>
                        </div>
                    </div>
                    
                    <div class="new-course">
                        <h4>📝 Nouveau cours</h4>
                        <div class="course-info">
                            <p><strong>Titre :</strong> ${newCourse.title}</p>
                            <p><strong>UE :</strong> ${newCourse.ue}</p>
                            <p><strong>Date :</strong> ${newCourse.date}</p>
                            <p><strong>Auteur :</strong> ${newCourse.author}</p>
                            <p><strong>Définitions :</strong> ${newCourse.definitions_count}</p>
                        </div>
                    </div>
                </div>
                
                <div class="dialog-actions">
                    <button class="update-btn" onclick="updateExistingCourse()">
                        🔄 Mettre à jour le cours existant
                    </button>
                    <button class="cancel-btn" onclick="closeDuplicateDialog()">
                        ❌ Annuler
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Ajouter le dialogue à la page
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
    showStatus('⚠️ Cours en doublon détecté. Veuillez choisir une action.', 'error');
}

// Fermer le dialogue de doublon
function closeDuplicateDialog() {
    const dialog = document.getElementById('duplicateDialog');
    if (dialog) {
        dialog.remove();
    }
    showStatus('❌ Ajout annulé - cours déjà existant.', 'error');
}

// Mettre à jour le cours existant
async function updateExistingCourse() {
    showStatus('Mise à jour du cours en cours...', 'processing');
    
    try {
        const response = await fetch('/api/update_course', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(extractedData)
        });

        if (response.ok) {
            const result = await response.json();
            showStatus('✅ Cours mis à jour avec succès !', 'success');
            loadCurrentStats(); // Recharger les statistiques
            
            // Fermer le dialogue
            closeDuplicateDialog();
            
            // Reset du formulaire après succès
            setTimeout(() => {
                resetForm();
            }, 3000);
            
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showStatus('❌ Erreur lors de la mise à jour du cours.', 'error');
    }
}

// Reset du formulaire
function resetForm() {
    selectedFile = null;
    extractedData = null;

    const filePreview = document.getElementById('filePreview');
    const uploadArea = document.getElementById('uploadArea');
    const previewSection = document.getElementById('previewSection');
    const uploadBtn = document.getElementById('uploadBtn');
    const status = document.getElementById('status');

    filePreview.style.display = 'none';
    uploadArea.style.display = 'block';
    previewSection.style.display = 'none';
    uploadBtn.disabled = true;
    status.innerHTML = '';
    status.className = 'status';

    // Reset du input file
    document.getElementById('fileInput').value = '';
}

// Affichage des messages de statut
function showStatus(message, type) {
    const status = document.getElementById('status');
    status.innerHTML = type === 'processing' ? 
        `<span class="loading"></span>${message}` : 
        message;
    status.className = `status ${type}`;
}

// Chargement des statistiques actuelles
async function loadCurrentStats() {
    try {
        showStatsLoading(true);
        
        const response = await fetch('/api/stats');
        if (response.ok) {
            const stats = await response.json();
            updateStatsDisplay(stats);
            showStatsLoading(false);
        } else {
            console.error('Erreur lors du chargement des statistiques:', response.status);
            showStatsError();
        }
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
        showStatsError();
    }
}

// Affichage d'un état de chargement pour les statistiques
function showStatsLoading(isLoading) {
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        if (isLoading) {
            stat.classList.add('loading');
            stat.textContent = '...';
        } else {
            stat.classList.remove('loading');
        }
    });
}

// Affichage d'une erreur pour les statistiques
function showStatsError() {
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        stat.classList.remove('loading');
        stat.textContent = '?';
        stat.title = 'Erreur de chargement';
    });
}

// Mise à jour de l'affichage des statistiques avec animation
function updateStatsDisplay(stats) {
    const elements = {
        totalCourses: document.getElementById('totalCourses'),
        totalTerms: document.getElementById('totalTerms'),
        studiedTerms: document.getElementById('studiedTerms'),
        correctAnswers: document.getElementById('correctAnswers')
    };
    
    // Animer chaque statistique
    Object.keys(elements).forEach(key => {
        const element = elements[key];
        const newValue = stats[key] || 0;
        const currentValue = parseInt(element.textContent) || 0;
        
        if (newValue !== currentValue) {
            // Animation de changement
            element.classList.add('updating');
            
            // Animer le compteur
            animateCounter(element, currentValue, newValue, 1000);
            
            setTimeout(() => {
                element.classList.remove('updating');
            }, 1000);
        } else {
            element.textContent = newValue;
        }
        
        // Enlever les états d'erreur
        element.classList.remove('loading');
        element.removeAttribute('title');
    });
    
    // Calculer et afficher le pourcentage de réussite
    const correctAnswers = stats.correctAnswers || 0;
    const studiedTerms = stats.studiedTerms || 0;
    const successRate = studiedTerms > 0 ? Math.round((correctAnswers / studiedTerms) * 100) : 0;
    
    updateSuccessRate(successRate);
    
    // Mettre à jour l'horodatage
    updateLastUpdateTime();
    
    // Ajouter une indication visuelle de rafraîchissement
    showRefreshIndicator();
}

// Animation de compteur
function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    const diff = end - start;
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Utiliser une courbe d'animation easeOutCubic
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(start + (diff * easeOutCubic));
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = end;
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Mise à jour du taux de réussite
function updateSuccessRate(rate) {
    let rateElement = document.getElementById('successRate');
    if (!rateElement) {
        // Créer l'élément s'il n'existe pas
        const statsGrid = document.getElementById('statsGrid');
        const rateDiv = document.createElement('div');
        rateDiv.className = 'stat-item success-rate';
        rateDiv.innerHTML = `
            <span class="stat-number" id="successRate">${rate}%</span>
            <span class="stat-label">Réussite</span>
        `;
        statsGrid.appendChild(rateDiv);
        rateElement = document.getElementById('successRate');
    } else {
        rateElement.textContent = `${rate}%`;
    }
    
    // Colorer selon le taux de réussite
    rateElement.className = 'stat-number';
    if (rate >= 80) {
        rateElement.classList.add('success-high');
    } else if (rate >= 60) {
        rateElement.classList.add('success-medium');
    } else if (rate > 0) {
        rateElement.classList.add('success-low');
    }
}

// Mise à jour de l'horodatage
function updateLastUpdateTime() {
    const updateTimeElement = document.getElementById('updateTime');
    if (updateTimeElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        updateTimeElement.textContent = timeString;
    }
}

// Affichage d'un indicateur de rafraîchissement
function showRefreshIndicator() {
    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        statsSection.classList.add('refreshed');
        setTimeout(() => {
            statsSection.classList.remove('refreshed');
        }, 1000);
    }
}

// Fonction pour rafraîchir manuellement les statistiques
function refreshStats() {
    loadCurrentStats();
    showStatus('📊 Statistiques mises à jour !', 'success');
}