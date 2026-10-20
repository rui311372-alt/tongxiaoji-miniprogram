const { practiceQuestions, practiceCourses } = require('../../utils/practice-bank');
const { schools, resources } = require('../../utils/catalog');
const community = require('../../utils/community');
const requestSeeds = require('../../utils/request-seeds');
const questionById = {};
practiceQuestions.forEach(question => { questionById[question.id] = question; });
function emptyProgress() { return { version: 1, answers: {} }; }
function validProgress(raw) {
  const clean = emptyProgress();
  if (!raw || raw.version !== 1 || !raw.answers || typeof raw.answers !== 'object') return clean;
  practiceQuestions.forEach(question => {
    const item = raw.answers[question.id];
    if (!item || !Number.isSafeInteger(item.attempts) || item.attempts < 1 || !Number.isSafeInteger(item.correct) || item.correct < 0 || item.correct > item.attempts || !Number.isInteger(item.lastChoice) || item.lastChoice < 0 || item.lastChoice >= question.options.length) return;
    clean.answers[question.id] = { attempts: item.attempts, correct: item.correct, lastChoice: item.lastChoice, wrong: item.lastChoice !== question.answer };
  });
  return clean;
}
Page({
  data: {
    schoolId: '', schoolName: '', resourceCount: 0, outlineCount: 0, requestCount: 0, courseOptions: ['全部课程'].concat(practiceCourses), courseIndex: 0,
    selectedCourse: '全部课程', mode: 'all', current: null, options: [], index: 0,
    questionCount: 0, progressWidth: 0, choice: -1, submitted: false, hasChoice: false,
    answerLetter: '', answeredCorrect: false, answeredCount: 0, scopedCount: 64,
    accuracy: '—', totalAttempts: 0, totalCorrect: 0, wrongCount: 0, scopedWrongCount: 0,
    courseSummary: [], wrongItems: [], showWrongDetails: false, persistent: true
  },
  onLoad() { this._sessions = {}; this._persistErrors = {}; },
  onShow() {
    if (!this._sessions) this._sessions = {};
    if (!this._persistErrors) this._persistErrors = {};
    const requested = getApp().globalData.schoolId;
    const school = schools.find(item => item.id === requested) || schools[0];
    let available = resources;
    let requests = requestSeeds;
    try { available = community.getResources(); requests = community.getRequests().concat(requestSeeds); } catch (error) { /* The bundled practice bank remains available. */ }
    this.setData({ resourceCount: available.filter(item => item.school_id === school.id).length, outlineCount: available.filter(item => item.school_id === school.id && item.category === '复习提纲').length, requestCount: requests.filter(item => item.school_id === school.id && item.status === 'open').length });
    if (this._schoolId === school.id) return;
    this._schoolId = school.id;
    this._storageKey = 'txj.practice.v1:' + school.id;
    this._persistent = !this._persistErrors[school.id];
    if (this._sessions[school.id]) this._progress = this._sessions[school.id];
    else {
      try { this._progress = validProgress(wx.getStorageSync(this._storageKey)); }
      catch (error) { this._progress = emptyProgress(); this._persistent = false; this._persistErrors[school.id] = true; }
      this._sessions[school.id] = this._progress;
    }
    this.setData({ schoolId: school.id, schoolName: school.name, courseIndex: 0, selectedCourse: '全部课程', mode: 'all', persistent: this._persistent, showWrongDetails: false });
    wx.setNavigationBarTitle({ title: '同校集' });
    this.startRound('all');
    if (!this._persistent) wx.showToast({ title: '记录暂不能保存，可继续练习', icon: 'none' });
  },
  onSchoolChanged() { this.onShow(); },
  onLibraryTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'resources' && tab !== 'requests') return;
    wx.redirectTo({ url: '/pages/browse/browse?section=resources&libraryTab=' + tab });
  },
  openTopic(event) {
    const topic = event.currentTarget.dataset.topic;
    if (topic === 'practice') return;
    if (topic === 'requests') wx.redirectTo({ url: '/pages/browse/browse?section=resources&libraryTab=requests' });
    else if (topic === 'exam') wx.redirectTo({ url: '/pages/browse/browse?section=resources&libraryTab=resources&category=' + encodeURIComponent('复习提纲') });
  },
  onMainNav(event) { require('../../utils/main-nav').navigateMain(event.detail.tab); },
  scopedQuestions() { return practiceQuestions.filter(question => this.data.courseIndex === 0 || question.course === this.data.selectedCourse); },
  persist() {
    this._sessions[this._schoolId] = this._progress;
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
    let attempts = 0, correct = 0;
    Object.keys(answers).forEach(id => { attempts += answers[id].attempts; correct += answers[id].correct; });
    const summary = practiceCourses.map(course => {
      const courseQuestions = practiceQuestions.filter(question => question.course === course);
      const wrongQuestions = wrong.filter(question => question.course === course);
      const topicCounts = {};
      wrongQuestions.forEach(question => { topicCounts[question.topic] = (topicCounts[question.topic] || 0) + 1; });
      return { course, count: wrongQuestions.length, answered: courseQuestions.filter(question => answers[question.id]).length,
        topics: Object.keys(topicCounts).map(topic => ({ topic, count: topicCounts[topic] })) };
    });
    this.setData({
      answeredCount: scoped.filter(question => answers[question.id]).length, scopedCount: scoped.length,
      totalAttempts: attempts, totalCorrect: correct, accuracy: attempts ? Math.round(correct / attempts * 100) + '%' : '—',
      wrongCount: wrong.length, scopedWrongCount: scoped.filter(question => answers[question.id] && answers[question.id].wrong).length,
      courseSummary: summary,
      wrongItems: wrong.map(question => ({ id: question.id, course: question.course, topic: question.topic, stem: question.stem,
        answer: String.fromCharCode(65 + question.answer), answerText: question.options[question.answer], explanation: question.explanation }))
    });
  },
  startRound(mode) {
    const answers = this._progress.answers;
    this._round = this.scopedQuestions().filter(question => mode !== 'wrong' || (answers[question.id] && answers[question.id].wrong));
    this.setData({ mode });
    this.refreshStats();
    this.showQuestion(0);
  },
  showQuestion(index) {
    const questions = this._round || [];
    const bounded = Math.min(Math.max(0, index), Math.max(0, questions.length - 1));
    const question = questions[bounded] || null;
    this.setData({ index: bounded, questionCount: questions.length, current: question ? { id: question.id, course: question.course, topic: question.topic, stem: question.stem, explanation: question.explanation } : null,
      options: question ? question.options.map((text, optionIndex) => ({ text, index: optionIndex, letter: String.fromCharCode(65 + optionIndex), status: '' })) : [],
      progressWidth: questions.length ? Math.round((bounded + 1) / questions.length * 100) : 0,
      submitted: false, choice: -1, hasChoice: false, answerLetter: '', answeredCorrect: false });
  },
  changeCourse(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= this.data.courseOptions.length) return;
    this.setData({ courseIndex: index, selectedCourse: this.data.courseOptions[index] });
    this.startRound('all');
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
    this._progress.answers[question.id] = { attempts: (old ? old.attempts : 0) + 1, correct: (old ? old.correct : 0) + Number(correct), lastChoice: this.data.choice, wrong: !correct };
    this.setData({ submitted: true, answeredCorrect: correct, answerLetter: String.fromCharCode(65 + question.answer),
      options: this.data.options.map(option => ({ text: option.text, index: option.index, letter: option.letter,
        status: option.index === question.answer ? 'correct' : option.index === this.data.choice ? 'incorrect' : '' })) });
    this.persist();
    this.refreshStats();
  },
  previousQuestion() { if (this.data.index > 0) this.showQuestion(this.data.index - 1); },
  nextQuestion() { if (this.data.submitted && this.data.index < this.data.questionCount - 1) this.showQuestion(this.data.index + 1); },
  finishRound() { this.startRound('all'); wx.showToast({ title: '本轮完成，可以继续巩固', icon: 'none' }); },
  toggleWrongDetails() { this.setData({ showWrongDetails: !this.data.showWrongDetails }); },
  retryQuestion(event) {
    const question = questionById[event.currentTarget.dataset.id];
    if (!question) return;
    this.setData({ courseIndex: practiceCourses.indexOf(question.course) + 1, selectedCourse: question.course, mode: 'wrong' });
    this._round = [question];
    this.refreshStats();
    this.showQuestion(0);
    wx.pageScrollTo({ scrollTop: 0, duration: 220 });
  },
  clearProgress() {
    if (!this.data.totalAttempts) return;
    const schoolId = this._schoolId;
    wx.showModal({ title: '清空练习记录？', content: '将清空当前设备上' + this.data.schoolName + '的作答与错题记录。其他学校不受影响。', confirmText: '确认清空', confirmColor: '#a04436',
      success: result => {
        if (!result.confirm || this._schoolId !== schoolId) return;
        this._progress = emptyProgress();
        this.persist();
        this.setData({ showWrongDetails: false });
        this.startRound('all');
        wx.showToast({ title: this._persistent ? '本校记录已清空' : '本次记录已清空，保存失败', icon: 'none' });
      }
    });
  }
});
