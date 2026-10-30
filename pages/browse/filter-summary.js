// Keep the summary tied to filters that apply to the current list.
function filterSummary(data) {
  const filters = [];
  const add = (key, label) => filters.push({ key, label });
  const resources = data.section === 'resources' && data.libraryTab === 'resources';
  const products = data.section === 'market' && data.marketTab !== 'wanted';
  const keyword = data.keyword.trim();
  if (keyword) add('keyword', '搜索：' + keyword);
  if (resources) {
    if (data.major !== '全部专业') add('major', data.major);
    if (data.course !== '全部课程') add('course', data.course);
    if (data.goldOnly) add('goldOnly', '平台金选');
    if (data.savedOnly) add('savedOnly', '已收藏');
  }
  if ((resources || products) && data.category !== '全部') add('category', data.category);
  if (products) {
    if (data.budgetIndex) add('budgetIndex', data.budgetOptions[data.budgetIndex]);
    if (data.conditionIndex) add('conditionIndex', data.conditionOptions[data.conditionIndex]);
    if (data.school.id === 'tianjin' && data.campusIndex) add('campusIndex', data.campusOptions[data.campusIndex]);
  }
  if (data.section === 'resources' && data.libraryTab === 'requests' && data.requestStatusIndex) {
    add('requestStatusIndex', data.requestStatusOptions[data.requestStatusIndex]);
  }
  if (data.section === 'market' && data.marketTab === 'wanted' && data.marketFilter !== 'all') {
    add('marketFilter', { mine: '我发布的', open: '寻找中', resolved: '已找到', active: '进行中', ended: '已结束' }[data.marketFilter]);
  }
  if ((resources || products) && data.sortIndex) add('sortIndex', data.sortOptions[data.sortIndex]);
  return filters;
}
module.exports = { filterSummary };
