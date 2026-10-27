const { practiceQuestions, practiceCourses } = require('../../utils/practice-bank');
const { schools } = require('../../utils/catalog');
const { backToLibrary } = require('../browse/library-navigation');
const questionById = {};
practiceQuestions.forEach(question => { questionById[question.id] = question; });
function emptyProgress() { return { version: 1, answers: {} }; }
function validAnswer(item, question) {
  return !!(question && item && Number.isSafeInteger(item.attempts) && item.attempts >= 1 && Number.isSafeInteger(item.correct) && item.correct >= 0 && item.correct <= item.attempts && Number.isInteger(item.lastChoice) && item.lastChoice >= 0 && item.lastChoice < question.options.length);
}
function readableProgress(raw) {
  // Missing storage is safe to initialize. Existing but malformed data must
  // remain untouched, including unknown question records from another version.
  if (raw === '' || raw === undefined) return true;
  return !!(raw && raw.version === 1 && raw.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers) &&
    Object.keys(raw.answers).every(id => validAnswer(raw.answers[id], questionById[id])));
}
function validProgress(raw) {
  const clean = emptyProgress();
  if (!raw || raw.version !== 1 || !raw.answers || typeof raw.answers !== 'object') return clean;
  practiceQuestions.forEach(question => {
    const item = raw.answers[question.id];
    if (!validAnswer(item, question)) return;
    clean.answers[question.id] = { attempts: item.attempts, correct: item.correct, lastChoice: item.lastChoice, wrong: item.lastChoice !== question.answer };
  });
  return clean;
}
Page({
  data: {
    schoolId: '', schoolName: '', courseOptions: ['全部课程'].concat(practiceCourses), courseIndex: 0,
    selectedCourse: '全部课程', mode: 'all', current: null, options: [], index: 0,
    questionCount: 0, progressWidth: 0, choice: -1, submitted: false, hasChoice: false,
    answerLetter: '', answeredCorrect: false, answeredCount: 0, scopedCount: 64,
    accuracy: '—', totalAttempts: 0, totalCorrect: 0, scopedAttempts: 0, scopedCorrect: 0, wrongCount: 0, scopedWrongCount: 0,
    bankCourseCount: practiceCourses.length, bankQuestionCount: practiceQuestions.length,
    courseSummary: [], wrongItems: [], showWrongDetails: false, persistent: true, storageReadBlocked: false,
    completedWidth: 0, roundComplete: false, roundAnswered: 0, roundCorrect: 0,
    roundMastered: 0, roundAccuracy: '—', currentWasWrong: false
  },
  onLoad() { this._sessions = {}; this._persistErrors = {}; this._readErrors = {}; },
  onShow() {
    if (!this._sessions) this._sessions = {};
    if (!this._persistErrors) this._persistErrors = {};
    if (!this._readErrors) this._readErrors = {};
    const requested = getApp().globalData.schoolId;
    const school = schools.find(item => item.id === requested) || schools[0];
    if (this._schoolId === school.id) return;
    this._schoolId = school.id;
    this._storageKey = 'txj.practice.v1:' + school.id;
    this._persistent = !this._persistErrors[school.id];
    if (this._sessions[school.id]) this._progress = this._sessions[school.id];
    else {
      try {
        const raw = wx.getStorageSync(this._storageKey);
        this._progress = validProgress(raw);
        if (!readableProgress(raw)) this._readErrors[school.id] = true;
      }
      catch (error) { this._progress = emptyProgress(); this._readErrors[school.id] = true; }
      this._sessions[school.id] = this._progress;
    }
    if (this._readErrors[school.id]) this._persistent = false;
    this.setData({ schoolId: school.id, schoolName: school.name, courseIndex: 0, selectedCourse: '全部课程', mode: 'all', persistent: this._persistent, storageReadBlocked: !!this._readErrors[school.id], showWrongDetails: false });
    wx.setNavigationBarTitle({ title: '刷题练习' });
    this.startRound('all');
    if (!this._persistent) wx.showToast({ title: this._readErrors[school.id] ? '原记录读取异常，仅临时练习' : '记录暂不能保存，可继续练习', icon: 'none' });
  },
  onSchoolChanged() { this.onShow(); },
  backToLibrary,
  onMainNav(event) { if(event.detail.tab==='library')this.backToLibrary();else require('../../utils/main-nav').navigateMain(event.detail.tab); },
  scopedQuestions() { return practiceQuestions.filter(question => this.data.courseIndex === 0 || question.course === this.data.selectedCourse); },
  persist() {
    this._sessions[this._schoolId] = this._progress;
    if (this._readErrors[this._schoolId]) {
      this._persistent = false;
      this.setData({ persistent: false, storageReadBlocked: true });
      return;
    }
    try { wx.setStorageSync(this._storageKey, this._progress); this._persistent = true; }
    catch (error) {
      if (this._persistent) wx.showToast({ title: '保存失败，本次可继续练习', icon: 'none' });
      this._persistent = false;
    }
    this._persistErrors[this._schoolId] = !this._persistent;
    this.setData({ persistent: this._persistent });
  },
  refreshStats() {
    const answers = this._progress.answers;
    const scoped = this.scopedQuestions();
    const wrong = practiceQuestions.filter(question => answers[question.id] && answers[question.id].wrong);
    const scopedWrong = scoped.filter(question => answers[question.id] && answers[question.id].wrong);
    let attempts = 0, correct = 0;
    Object.keys(answers).forEach(id => { attempts += answers[id].attempts; correct += answers[id].correct; });
    const scopedAttempts = scoped.reduce((sum, question) => sum + (answers[question.id] ? answers[question.id].attempts : 0), 0);
    const scopedCorrect = scoped.reduce((sum, question) => sum + (answers[question.id] ? answers[question.id].correct : 0), 0);
    const answeredCount = scoped.filter(question => answers[question.id]).length;
    const summary = practiceCourses.filter(course => this.data.courseIndex === 0 || course === this.data.selectedCourse).map(course => {
      const courseQuestions = practiceQuestions.filter(question => question.course === course);
      const wrongQuestions = wrong.filter(question => question.course === course);
      const topicCounts = {};
      wrongQuestions.forEach(question => { topicCounts[question.topic] = (topicCounts[question.topic] || 0) + 1; });
      return { course, count: wrongQuestions.length, total: courseQuestions.length, answered: courseQuestions.filter(question => answers[question.id]).length,
        topics: Object.keys(topicCounts).map(topic => ({ topic, count: topicCounts[topic] })) };
    });
    this.setData({
      answeredCount, scopedCount: scoped.length, completedWidth: scoped.length ? Math.round(answeredCount / scoped.length * 100) : 0,
      totalAttempts: attempts, totalCorrect: correct, scopedAttempts, scopedCorrect,
      accuracy: scopedAttempts ? Math.round(scopedCorrect / scopedAttempts * 100) + '%' : '—',
      wrongCount: wrong.length, scopedWrongCount: scopedWrong.length,
      courseSummary: summary,
      wrongItems: scopedWrong.map(question => ({ id: question.id, course: question.course, topic: question.topic, stem: question.stem,
        answer: String.fromCharCode(65 + question.answer), answerText: question.options[question.answer], explanation: question.explanation }))
    });
  },
  startRound(mode) {
    const answers = this._progress.answers;
    this._round = this.scopedQuestions().filter(question => mode !== 'wrong' || (answers[question.id] && answers[question.id].wrong));
    // Keep a stable queue while showing explanations; a corrected question is
    // removed from future wrong-answer rounds, without shifting this round's index.
    this._roundAnswers = {};
    this.setData({ mode, roundComplete: false, roundAnswered: 0, roundCorrect: 0, roundMastered: 0, roundAccuracy: '—', showWrongDetails: false });
    this.refreshStats();
    this.showQuestion(0);
  },
  showQuestion(index) {
    const questions = this._round || [];
    const bounded = Math.min(Math.max(0, index), Math.max(0, questions.length - 1));
    const question = questions[bounded] || null;
    const receipt = question && this._roundAnswers[question.id];
    this.setData({ index: bounded, questionCount: questions.length, current: question ? { id: question.id, course: question.course, topic: question.topic, stem: question.stem, explanation: question.explanation } : null,
      options: question ? question.options.map((text, optionIndex) => ({ text, index: optionIndex, letter: String.fromCharCode(65 + optionIndex),
        status: receipt ? (optionIndex === question.answer ? 'correct' : optionIndex === receipt.choice ? 'incorrect' : '') : '' })) : [],
      progressWidth: questions.length ? Math.round((bounded + 1) / questions.length * 100) : 0,
      submitted: !!receipt, choice: receipt ? receipt.choice : -1, hasChoice: !!receipt,
      answerLetter: receipt ? String.fromCharCode(65 + question.answer) : '', answeredCorrect: receipt ? receipt.correct : false,
      currentWasWrong: receipt ? receipt.wasWrong : false });
  },
  changeCourse(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.courseOptions.length) return;
    this.setData({ courseIndex: index, selectedCourse: this.data.courseOptions[index] });
    this.startRound(this.data.mode);
  },
  practiceAll() { this.startRound('all'); },
  practiceWrong() { this.startRound('wrong'); },
  selectOption(event) {
    if (this.data.submitted || !this.data.current) return;
    const index = Number(event.currentTarget.dataset.index);
    const question = questionById[this.data.current.id];
    if (!Number.isInteger(index) || index < 0 || index >= question.options.length) return;
    this.setData({ choice: index, hasChoice: true, options: this.data.options.map(option => ({ text: option.text, index: option.index, letter: option.letter, status: option.index === index ? 'selected' : '' })) });
  },
  submitAnswer() {
    if (this.data.submitted || !this.data.hasChoice || !this.data.current) return;
    const question = questionById[this.data.current.id];
    if (!question || this.data.choice < 0 || this.data.choice >= question.options.length) return;
    const correct = this.data.choice === question.answer;
    const old = this._progress.answers[question.id];
    if (this._roundAnswers[question.id]) return;
    this._roundAnswers[question.id] = { choice: this.data.choice, correct, wasWrong: !!(old && old.wrong) };
    this._progress.answers[question.id] = { attempts: (old ? old.attempts : 0) + 1, correct: (old ? old.correct : 0) + Number(correct), lastChoice: this.data.choice, wrong: !correct };
    const receipts = Object.keys(this._roundAnswers).map(id => this._roundAnswers[id]);
    const roundCorrect = receipts.filter(item => item.correct).length;
    this.setData({ submitted: true, answeredCorrect: correct, currentWasWrong: !!(old && old.wrong), answerLetter: String.fromCharCode(65 + question.answer),
      roundAnswered: receipts.length, roundCorrect, roundMastered: receipts.filter(item => item.wasWrong && item.correct).length,
      roundAccuracy: Math.round(roundCorrect / receipts.length * 100) + '%',
      options: this.data.options.map(option => ({ text: option.text, index: option.index, letter: option.letter,
        status: option.index === question.answer ? 'correct' : option.index === this.data.choice ? 'incorrect' : '' })) });
    this.persist();
    this.refreshStats();
  },
  previousQuestion() { if (this.data.index > 0) this.showQuestion(this.data.index - 1); },
  nextQuestion() { if (this.data.submitted && this.data.index < this.data.questionCount - 1) this.showQuestion(this.data.index + 1); },
  finishRound() {
    if (!this.data.submitted || this.data.index !== this.data.questionCount - 1 || this.data.roundAnswered !== this.data.questionCount) return;
    this.setData({ roundComplete: true });
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },
  toggleWrongDetails() { this.setData({ showWrongDetails: !this.data.showWrongDetails }); },
  retryQuestion(event) {
    const question = questionById[event.currentTarget.dataset.id];
    if (!question || !this._progress.answers[question.id] || !this._progress.answers[question.id].wrong) return;
    this.setData({ courseIndex: practiceCourses.indexOf(question.course) + 1, selectedCourse: question.course, mode: 'wrong' });
    this._round = [question];
    this._roundAnswers = {};
    this.setData({ roundComplete: false, roundAnswered: 0, roundCorrect: 0, roundMastered: 0, roundAccuracy: '—', showWrongDetails: false });
    this.refreshStats();
    this.showQuestion(0);
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },
  clearProgress() {
    if (!this.data.totalAttempts) return;
    const schoolId = this._schoolId;
    wx.showModal({ title: '清空练习记录？', content: this.data.storageReadBlocked ? '仅清空本校当前临时练习。设备上原有记录不会改动。' : '将清空当前设备上' + this.data.schoolName + '的作答与错题记录。其他学校不受影响。', confirmText: '确认清空', confirmColor: '#a04436',
      success: result => {
        if (!result.confirm || this._schoolId !== schoolId) return;
        this._progress = emptyProgress();
        this.persist();
        this.setData({ showWrongDetails: false });
        this.startRound('all');
        wx.showToast({ title: this.data.storageReadBlocked ? '临时记录已清空，原记录未改动' : this._persistent ? '本校记录已清空' : '本次记录已清空，保存失败', icon: 'none' });
      }
    });
  }
});
