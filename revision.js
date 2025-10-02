// Variables globales pour la gestion des révisions
let allTerms = [];
let usedTerms = [];
let currentSession = [];
let currentTermIndex = 0;
let sessionResults = [];
let coursesData = null;

// Statistiques globales
let globalStats = {
    totalTerms: 0,
    seenTerms: 0,
    correctAnswers: 0,
    partialAnswers: 0,
    wrongAnswers: 0
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    loadCoursesData();
    loadUserProgress();
});

// Charger les données des cours
async function loadCoursesData() {
    try {
        const response = await fetch('ifsi_courses_2025-09-23.json');
        coursesData = await response.json();
        
        // Extraire tous les termes de tous les cours
        allTerms = [];
        coursesData.courses.forEach(course => {
            const [courseKey, courseData] = course;
            if (courseData.definitions) {
                courseData.definitions.forEach(def => {
                    allTerms.push({
                        term: def.term,
                        definition: def.definition,
                        ue: courseData.ue,
                        courseTitle: courseData.title
                    });
                });
            }
        });
        
        globalStats.totalTerms = allTerms.length;
        updateStatsDisplay();
        
        console.log(`${allTerms.length} termes chargés depuis ${coursesData.courses.length} cours`);
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        alert('Erreur lors du chargement des données. Vérifiez votre connexion.');
    }
}

// Charger la progression de l'utilisateur depuis localStorage
function loadUserProgress() {
    const savedProgress = localStorage.getItem('ifsi_revision_progress');
    if (savedProgress) {
        const progress = JSON.parse(savedProgress);
        usedTerms = progress.usedTerms || [];
        globalStats = { ...globalStats, ...progress.stats };
    }
    updateStatsDisplay();
}

// Sauvegarder la progression de l'utilisateur
function saveUserProgress() {
    const progress = {
        usedTerms: usedTerms,
        stats: globalStats
    };
    localStorage.setItem('ifsi_revision_progress', JSON.stringify(progress));
}

// Mettre à jour l'affichage des statistiques
function updateStatsDisplay() {
    const totalTermsElement = document.getElementById('totalTermsPreview');
    const remainingTermsElement = document.getElementById('remainingTerms');
    const globalProgressElement = document.getElementById('globalProgress');
    
    if (totalTermsElement) {
        totalTermsElement.textContent = globalStats.totalTerms;
    }
    
    if (remainingTermsElement) {
        const remaining = globalStats.totalTerms - usedTerms.length;
        remainingTermsElement.textContent = remaining;
    }
    
    if (globalProgressElement) {
        globalProgressElement.textContent = `Global : ${globalStats.seenTerms}/${globalStats.totalTerms} termes`;
    }
}

// Démarrer une session de révision
function startRevision() {
    if (allTerms.length === 0) {
        alert('Aucun terme disponible. Vérifiez le chargement des données.');
        return;
    }
    
    // Sélectionner 10 termes pour cette session
    currentSession = selectTermsForSession();
    currentTermIndex = 0;
    sessionResults = [];
    
    // Masquer l'écran de démarrage et afficher l'écran de révision
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('revisionScreen').style.display = 'block';
    
    // Démarrer le premier terme
    showCurrentTerm();
}

// Sélectionner 10 termes pour la session (rotation complète)
function selectTermsForSession() {
    const availableTerms = allTerms.filter(term => 
        !usedTerms.some(usedTerm => usedTerm.term === term.term)
    );
    
    // Si tous les termes ont été utilisés, réinitialiser
    if (availableTerms.length === 0) {
        usedTerms = [];
        console.log('Tous les termes ont été vus. Réinitialisation de la rotation.');
        return selectTermsForSession();
    }
    
    // Si moins de 10 termes disponibles, prendre tous les disponibles
    const numberOfTerms = Math.min(10, availableTerms.length);
    
    // Mélanger et sélectionner
    const shuffled = availableTerms.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numberOfTerms);
}

// Afficher le terme actuel
function showCurrentTerm() {
    const currentTerm = currentSession[currentTermIndex];
    
    // Mettre à jour l'affichage
    document.getElementById('termUE').textContent = `UE ${currentTerm.ue}`;
    document.getElementById('termNumber').textContent = `${currentTermIndex + 1}/${currentSession.length}`;
    document.getElementById('termName').textContent = currentTerm.term;
    document.getElementById('sessionProgress').textContent = `Session : ${currentTermIndex + 1}/${currentSession.length}`;
    
    // Réinitialiser l'interface
    document.getElementById('userAnswer').value = '';
    document.getElementById('correctionSection').style.display = 'none';
    document.getElementById('userAnswer').disabled = false;
    
    // Focus sur le textarea
    setTimeout(() => {
        document.getElementById('userAnswer').focus();
    }, 100);
}

// Vérifier la réponse de l'utilisateur
function checkAnswer() {
    const userAnswer = document.getElementById('userAnswer').value.trim();
    
    if (!userAnswer) {
        alert('Veuillez saisir votre réponse avant de vérifier.');
        return;
    }
    
    const currentTerm = currentSession[currentTermIndex];
    
    // Afficher la section de correction
    document.getElementById('userAnswerDisplay').textContent = userAnswer;
    document.getElementById('correctAnswerDisplay').textContent = currentTerm.definition;
    document.getElementById('correctionSection').style.display = 'block';
    
    // Désactiver le textarea et le bouton
    document.getElementById('userAnswer').disabled = true;
    
    // Faire défiler vers la correction
    document.getElementById('correctionSection').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// Auto-évaluation de l'utilisateur
function evaluate(evaluation) {
    const currentTerm = currentSession[currentTermIndex];
    
    // Enregistrer le résultat
    sessionResults.push({
        term: currentTerm,
        userAnswer: document.getElementById('userAnswer').value.trim(),
        evaluation: evaluation
    });
    
    // Marquer le terme comme utilisé
    usedTerms.push(currentTerm);
    
    // Mettre à jour les statistiques globales
    globalStats.seenTerms++;
    if (evaluation === 'correct') {
        globalStats.correctAnswers++;
    } else if (evaluation === 'partial') {
        globalStats.partialAnswers++;
    } else {
        globalStats.wrongAnswers++;
    }
    
    // Passer au terme suivant ou terminer la session
    currentTermIndex++;
    
    if (currentTermIndex < currentSession.length) {
        // Terme suivant après un délai
        setTimeout(() => {
            showCurrentTerm();
        }, 1000);
    } else {
        // Fin de session
        setTimeout(() => {
            showResults();
        }, 1000);
    }
    
    // Sauvegarder la progression
    saveUserProgress();
}

// Afficher les résultats de la session
function showResults() {
    // Calculer les statistiques de la session
    const correct = sessionResults.filter(r => r.evaluation === 'correct').length;
    const partial = sessionResults.filter(r => r.evaluation === 'partial').length;
    const wrong = sessionResults.filter(r => r.evaluation === 'wrong').length;
    const scorePercentage = Math.round(((correct + partial * 0.5) / sessionResults.length) * 100);
    
    // Mettre à jour l'affichage
    document.getElementById('scorePercentage').textContent = `${scorePercentage}%`;
    document.getElementById('correctCount').textContent = correct;
    document.getElementById('partialCount').textContent = partial;
    document.getElementById('wrongCount').textContent = wrong;
    
    // Modifier la couleur du cercle selon le score
    const circle = document.getElementById('scoreCircle');
    if (scorePercentage >= 80) {
        circle.style.background = 'conic-gradient(from 0deg, #4caf50 0%, #66bb6a 100%)';
    } else if (scorePercentage >= 60) {
        circle.style.background = 'conic-gradient(from 0deg, #ffca28 0%, #ffd54f 100%)';
    } else {
        circle.style.background = 'conic-gradient(from 0deg, #ef5350 0%, #e57373 100%)';
    }
    
    // Masquer l'écran de révision et afficher les résultats
    document.getElementById('revisionScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';
    
    // Mettre à jour les statistiques globales
    updateStatsDisplay();
}

// Démarrer une nouvelle session
function startNewSession() {
    // Réinitialiser l'affichage
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('reviewScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
    
    // Mettre à jour les statistiques
    updateStatsDisplay();
}

// Revoir les réponses de la session
function reviewSession() {
    const reviewContent = document.getElementById('reviewContent');
    
    // Générer le contenu de révision
    reviewContent.innerHTML = sessionResults.map((result, index) => {
        const evaluationClass = result.evaluation;
        const evaluationText = {
            'correct': '✅ Correcte',
            'partial': '🟡 Partielle',
            'wrong': '❌ Incorrecte'
        }[result.evaluation];
        
        return `
            <div class="review-item ${evaluationClass}">
                <h4>${index + 1}. ${result.term.term} (UE ${result.term.ue})</h4>
                <div class="review-answer">
                    <strong>Votre réponse :</strong>
                    ${result.userAnswer}
                </div>
                <div class="review-answer">
                    <strong>Définition correcte :</strong>
                    ${result.term.definition}
                </div>
                <div class="review-evaluation">
                    <strong>Évaluation :</strong> ${evaluationText}
                </div>
            </div>
        `;
    }).join('');
    
    // Afficher l'écran de révision
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('reviewScreen').style.display = 'block';
}

// Fermer l'écran de révision
function closeReview() {
    document.getElementById('reviewScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';
}

// Gestion du clavier
document.addEventListener('keydown', function(event) {
    // Entrée pour vérifier la réponse si on est dans le textarea
    if (event.key === 'Enter' && event.ctrlKey) {
        const textarea = document.getElementById('userAnswer');
        if (document.activeElement === textarea && !textarea.disabled) {
            checkAnswer();
        }
    }
    
    // Échap pour fermer la révision
    if (event.key === 'Escape') {
        const reviewScreen = document.getElementById('reviewScreen');
        if (reviewScreen.style.display === 'block') {
            closeReview();
        }
    }
});

// Ajouter un raccourci clavier dans le textarea
document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('userAnswer');
    if (textarea) {
        textarea.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && event.ctrlKey) {
                event.preventDefault();
                checkAnswer();
            }
        });
    }
});