App({
  globalData: { schoolId: 'tianjin' },
  onLaunch() {
    try { const saved = wx.getStorageSync('txj.school.v1'); if (typeof saved === 'string' && saved) this.globalData.schoolId = saved; }
    catch (error) { /* Selection stays available in memory. */ }
  }
});
