(() => {
    'use strict';

    const state = {
        terms: [],
        currentSemester: 'ALL',
        availableUEs: [],
        baseUEs: [],
        selectedBaseUEs: new Set(),
        selectedUEs: new Set(),
        requestedCount: 10,
        questions: [],
        currentIndex: 0,
        score: 0,
        answers: [],
        selectedAnswerIndex: null,
        answerValidated: false
    };

    const SEMESTER_COLORS = {
        ALL: '#2563EB',
        S1: '#0cb2afff',
        S2: '#a1c65dff',
        S3: '#fac723ff',
        S4: '#f29222ff',
        S5: '#e95e50ff',
        S6: '#936facff'
    };

    const elements = {
        setupPanel: document.getElementById('setupPanel'),
        quizPanel: document.getElementById('quizPanel'),
        resultsPanel: document.getElementById('resultsPanel'),
        semesterButtonsContainer: document.getElementById('semesterButtonsContainer'),
        ueGroupsContainer: document.getElementById('ueGroupsContainer'),
        ueSelectAll: document.getElementById('ueSelectAll'),
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
        elements.ueSelectAll.addEventListener('click', selectAllUEs);

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
        state.availableUEs = [...new Set(state.terms.map((item) => item.ue))].sort(compareUE);
        state.baseUEs = [...new Set(state.availableUEs.map(getBaseUE))].sort(compareUE);
        state.selectedBaseUEs = new Set(state.baseUEs);
        renderSemesterButtons();
        renderBaseUEButtons();
        updateSelectedUEs();
        elements.availabilityMessage.textContent = 'Sélectionnez une ou plusieurs UE pour composer votre évaluation.';
    }

    function renderSemesterButtons() {
        const semesters = [['🌍 Tous', 'ALL'], ['S1', 'S1'], ['S2', 'S2'], ['S3', 'S3'], ['S4', 'S4'], ['S5', 'S5'], ['S6', 'S6']];
        const filtersSection = document.querySelector('.filters-section');
        const semesterColor = SEMESTER_COLORS[state.currentSemester] || SEMESTER_COLORS.ALL;
        filtersSection.style.setProperty('--semester-color', semesterColor);
        filtersSection.style.setProperty(
            '--semester-text-color',
            ['S3', 'S4', 'S5'].includes(state.currentSemester) ? '#264653' : 'white'
        );
        elements.semesterButtonsContainer.innerHTML = semesters.map(([label, value]) =>
            `<button type="button" class="semester-btn${value === state.currentSemester ? ' active' : ''}" data-semester="${value}">${label}</button>`
        ).join('');
        elements.semesterButtonsContainer.querySelectorAll('.semester-btn').forEach((button) => {
            button.addEventListener('click', () => {
                state.currentSemester = button.dataset.semester;
                renderSemesterButtons();
                updateSelectedUEs();
                renderBaseUEButtons();
                updateAvailability();
            });
        });
    }

    function renderBaseUEButtons() {
        const visibleUEs = state.availableUEs.filter((ue) =>
            state.currentSemester === 'ALL' || ue.endsWith(state.currentSemester)
        );
        const visibleBaseUEs = [...new Set(visibleUEs.map(getBaseUE))].sort(compareUE);
        const groups = new Map();
        visibleBaseUEs.forEach((baseUE) => {
            const prefix = baseUE.split('.')[0];
            if (!groups.has(prefix)) groups.set(prefix, []);
            groups.get(prefix).push(baseUE);
        });
        elements.ueGroupsContainer.innerHTML = [...groups.values()].map((ues) => `
            <div class="ue-group">
                <div class="ue-group-buttons">${ues.map((baseUE) => `
                    <button type="button" class="ue-global-btn${state.selectedBaseUEs.has(baseUE) ? ' active' : ''}" data-ue="${escapeHtml(baseUE)}" title="Sélectionner UE ${escapeHtml(baseUE)}">${escapeHtml(baseUE)}</button>
                `).join('')}</div>
            </div>
        `).join('');
        elements.ueGroupsContainer.querySelectorAll('.ue-global-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const baseUE = button.dataset.ue;
                state.selectedBaseUEs.has(baseUE) ? state.selectedBaseUEs.delete(baseUE) : state.selectedBaseUEs.add(baseUE);
                updateSelectedUEs();
                renderBaseUEButtons();
                updateAvailability();
            });
        });
        elements.ueSelectAll.classList.toggle(
            'active',
            visibleBaseUEs.every((baseUE) => state.selectedBaseUEs.has(baseUE))
        );
    }

    function selectAllUEs() {
        const visibleBaseUEs = state.availableUEs
            .filter((ue) => state.currentSemester === 'ALL' || ue.endsWith(state.currentSemester))
            .map(getBaseUE);
        state.selectedBaseUEs = new Set(visibleBaseUEs);
        updateSelectedUEs();
        renderBaseUEButtons();
        updateAvailability();
    }

    function updateSelectedUEs() {
        state.selectedUEs = new Set(state.availableUEs.filter((ue) => {
            const matchesSemester = state.currentSemester === 'ALL' || ue.endsWith(state.currentSemester);
            return matchesSemester && state.selectedBaseUEs.has(getBaseUE(ue));
        }));
    }

    function getBaseUE(ue) {
        const match = ue.match(/^(\d+\.\d+)\./);
        return match ? match[1] : ue;
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
