Component({
  properties: {
    active: { type: String, value: 'library' },
    disabled: { type: Boolean, value: false }
  },
  data: {
    tabs: [
      { key: 'library', label: '学习资料' },
      { key: 'market', label: '二手集市' },
      { key: 'publish', label: '发布' },
      { key: 'messages', label: '消息' },
      { key: 'mine', label: '我的' }
    ]
  },
  methods: {
    onSelect: function (event) {
      if (this.properties.disabled) return;
      this.triggerEvent('select', { tab: event.currentTarget.dataset.tab });
    }
  }
});
