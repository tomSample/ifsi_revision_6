(() => {
    'use strict';

    const state = {
        terms: [],
        selectedUEs: new Set(),
        requestedCount: 10,
        questions: [],
        currentIndex: 0,
        score: 0,
        answers: [],
        selectedAnswerIndex: null,
        answerValidated: false
    };

    const elements = {
        setupPanel: document.getElementById('setupPanel'),
        quizPanel: document.getElementById('quizPanel'),
        resultsPanel: document.getElementById('resultsPanel'),
        ueList: document.getElementById('ueList'),
        availabilityMessage: document.getElementById('availabilityMessage'),
        questionHint: document.getElementById('questionHint'),
        startButton: document.getElementById('startButton'),
        questionProgress: document.getElementById('questionProgress'),
        questionScore: document.getElementById('questionScore'),
        questionUE: document.getElementById('questionUE'),
        questionTerm: document.getElementById('questionTerm'),
        answerList: document.getElementById('answerList'),
        nextButton: document.getElementById('nextButton'),
        resultsScore: document.getElementById('resultsScore'),
        resultsSummary: document.getElementById('resultsSummary'),
        resultsDetails: document.getElementById('resultsDetails'),
        restartButton: document.getElementById('restartButton')
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        document.querySelectorAll('.question-option').forEach((button) => {
            button.addEventListener('click', () => selectQuestionCount(Number(button.dataset.count)));
        });
        elements.startButton.addEventListener('click', startEvaluation);
        elements.nextButton.addEventListener('click', handleAnswerAction);
        elements.restartButton.addEventListener('click', resetEvaluation);

        try {
            const response = await fetch('../../data/courses.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            state.terms = flattenTerms(data.courses);
            renderUEs();
            selectQuestionCount(state.terms.length >= 20 ? 20 : 10);
        } catch (error) {
            console.error('Impossible de charger les termes pour l’évaluation:', error);
            elements.availabilityMessage.textContent = 'Les données des cours sont momentanément indisponibles.';
        }
    }

    function flattenTerms(courses) {
        return (courses || []).flatMap(([courseKey, course]) =>
            (course.definitions || [])
                .filter((definition) => definition.term && definition.definition && course.ue)
                .map((definition) => ({
                    term: definition.term,
                    definition: definition.definition,
                    ue: course.ue,
                    courseKey
                }))
        );
    }

    function renderUEs() {
        const counts = new Map();
        state.terms.forEach((item) => counts.set(item.ue, (counts.get(item.ue) || 0) + 1));
        elements.ueList.innerHTML = [...counts.keys()].sort(compareUE).map((ue) => `
            <label class="ue-option">
                <input type="checkbox" value="${escapeHtml(ue)}">
                <span>UE ${escapeHtml(ue)}</span>
                <small>${counts.get(ue)} termes</small>
            </label>
        `).join('');
        elements.ueList.addEventListener('change', (event) => {
            if (event.target.matches('input')) {
                event.target.checked ? state.selectedUEs.add(event.target.value) : state.selectedUEs.delete(event.target.value);
                updateAvailability();
            }
        });
        elements.availabilityMessage.textContent = 'Sélectionnez une ou plusieurs UE pour composer votre évaluation.';
    }

    function selectQuestionCount(count) {
        state.requestedCount = count;
        document.querySelectorAll('.question-option').forEach((button) => {
            button.classList.toggle('selected', Number(button.dataset.count) === count);
        });
        updateAvailability();
    }

    function updateAvailability() {
        const available = getEligibleTerms().length;
        const actualCount = Math.min(state.requestedCount, available);
        elements.questionHint.textContent = available
            ? `${available} termes peuvent être utilisés. L’évaluation comportera ${actualCount} question${actualCount > 1 ? 's' : ''}.`
            : 'Chaque UE sélectionnée doit contenir au moins 3 définitions pour proposer des choix fiables.';
        elements.startButton.disabled = actualCount === 0;
    }

    function getEligibleTerms() {
        const selected = state.terms.filter((item) => state.selectedUEs.has(item.ue));
        return selected.filter((item) => selected.filter((candidate) => candidate.ue === item.ue).length >= 3);
    }

    function startEvaluation() {
        const eligibleTerms = getEligibleTerms();
        const count = Math.min(state.requestedCount, eligibleTerms.length);
        if (!count) return;
        state.questions = shuffle(eligibleTerms).slice(0, count).map(createQuestion);
        state.currentIndex = 0;
        state.score = 0;
        state.answers = [];
        elements.setupPanel.classList.add('hidden');
        elements.resultsPanel.classList.add('hidden');
        elements.quizPanel.classList.remove('hidden');
        renderQuestion();
    }

    function createQuestion(correct) {
        const sameUE = state.terms.filter((item) => item.ue === correct.ue && item.term !== correct.term);
        const distractors = shuffle(sameUE).slice(0, 2);
        return { correct, options: shuffle([correct, ...distractors]) };
    }

    function renderQuestion() {
        const question = state.questions[state.currentIndex];
        elements.questionProgress.textContent = `Question ${state.currentIndex + 1}/${state.questions.length}`;
        elements.questionScore.textContent = `Score : ${state.score}`;
        elements.questionUE.textContent = `UE ${question.correct.ue}`;
        elements.questionTerm.textContent = question.correct.term;
        elements.answerList.innerHTML = question.options.map((option, index) => `
            <button type="button" class="answer-button" data-index="${index}">${escapeHtml(option.definition)}</button>
        `).join('');
        elements.answerList.querySelectorAll('.answer-button').forEach((button) => {
            button.addEventListener('click', () => selectAnswer(Number(button.dataset.index)));
        });
        state.selectedAnswerIndex = null;
        state.answerValidated = false;
        elements.nextButton.textContent = 'Valider ma réponse';
        elements.nextButton.disabled = true;
        elements.nextButton.classList.remove('answer-correct', 'answer-incorrect');
        elements.nextButton.classList.remove('hidden');
    }

    function selectAnswer(index) {
        if (state.answerValidated) return;
        state.selectedAnswerIndex = index;
        elements.answerList.querySelectorAll('.answer-button').forEach((button, buttonIndex) => {
            button.classList.toggle('selected', buttonIndex === index);
        });
        elements.nextButton.disabled = false;
    }

    function handleAnswerAction() {
        if (!state.answerValidated) {
            validateAnswer();
            return;
        }
        showNextQuestion();
    }

    function validateAnswer() {
        if (state.selectedAnswerIndex === null) return;
        const question = state.questions[state.currentIndex];
        const selected = question.options[state.selectedAnswerIndex];
        const correct = selected.term === question.correct.term;
        if (correct) state.score += 1;
        state.answers.push({ question, selected, correct });
        state.answerValidated = true;
        elements.nextButton.classList.add(correct ? 'answer-correct' : 'answer-incorrect');
        elements.answerList.querySelectorAll('.answer-button').forEach((button) => {
            button.disabled = true;
        });
        elements.questionScore.textContent = `Score : ${state.score}`;
        elements.nextButton.textContent = state.currentIndex === state.questions.length - 1 ? 'Voir le résultat' : 'Question suivante';
    }

    function showNextQuestion() {
        if (state.currentIndex === state.questions.length - 1) {
            showResults();
            return;
        }
        state.currentIndex += 1;
        renderQuestion();
    }

    function showResults() {
        elements.quizPanel.classList.add('hidden');
        elements.resultsPanel.classList.remove('hidden');
        elements.resultsScore.textContent = `${state.score}/${state.questions.length}`;
        elements.resultsSummary.textContent = `${Math.round((state.score / state.questions.length) * 100)} % de réussite.`;
        elements.resultsDetails.innerHTML = '<h4>Correction</h4>' + state.answers.map((answer, index) => `
            <div class="result-item ${answer.correct ? 'correct' : ''}">
                <strong>${index + 1}. ${escapeHtml(answer.question.correct.term)}</strong><br>
                ${answer.correct ? 'Bonne réponse.' : `Votre réponse : ${escapeHtml(answer.selected.definition)}<br>Bonne réponse : ${escapeHtml(answer.question.correct.definition)}`}
            </div>
        `).join('');
    }

    function resetEvaluation() {
        state.questions = [];
        state.answers = [];
        state.score = 0;
        state.selectedAnswerIndex = null;
        state.answerValidated = false;
        elements.resultsPanel.classList.add('hidden');
        elements.setupPanel.classList.remove('hidden');
        updateAvailability();
    }

    function compareUE(a, b) {
        return a.localeCompare(b, 'fr', { numeric: true });
    }

    function shuffle(items) {
        return [...items].sort(() => Math.random() - 0.5);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (character) => {
            switch (character) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case String.fromCharCode(39): return '&#039;';
            default: return character;
            }
        });
    }
})();
