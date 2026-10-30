const { schools } = require('../../utils/catalog');
Component({
  properties: {
    schoolId: { type: String, value: 'tianjin', observer(value) { this.syncSchool(value); } },
    disabled: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
    interceptHome: { type: Boolean, value: false }
  },
  data: { schools, index: 0, school: schools[0] },
  lifetimes: { attached() { this.syncSchool(this.properties.schoolId); } },
  methods: {
    syncSchool(id) {
      const found = schools.findIndex(row => row.id === id);
      const index = found < 0 ? 0 : found;
      this.setData({ index, school: schools[index] });
    },
    chooseSchool(event) {
      if (this.properties.disabled) return;
      const school = schools[Number(event.detail.value)];
      if (!school) return;
      getApp().globalData.schoolId = school.id;
      try { wx.setStorageSync('txj.school.v1', school.id); }
      catch (error) { wx.showToast({ title: '本次已切换，学校偏好未保存', icon: 'none' }); }
      this.syncSchool(school.id);
      this.triggerEvent('schoolchange', { school });
    },
    returnHome() {
      if (this.properties.disabled) return;
      if (this.properties.interceptHome) this.triggerEvent('returnhome');
      else wx.reLaunch({ url: '/pages/index/index' });
    }
  }
});
