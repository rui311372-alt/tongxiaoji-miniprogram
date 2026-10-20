const store = require('./store');
const { schools } = require('./catalog');
const community = require('./community');
const KEY = 'txj.library-tools.v1';
function read() {
  const data = store.read(KEY, { searches: {}, downloads: {} });
  const map = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const invalid = () => { throw new Error('学习工具记录格式异常，原记录未覆盖，请检查后重试。'); };
  if (!map(data) || !map(data.searches) || !map(data.downloads)) invalid();
  Object.keys(data.searches).forEach(key => {
    const parts=key.split(':'), rows=data.searches[key];
    if (parts.length!==2 || !schools.some(s=>s.id===parts[0]) || !['resources','market'].includes(parts[1]) || !Array.isArray(rows) || rows.length>8 || rows.some(value=>typeof value!=='string' || value.length>60)) invalid();
  });
  Object.keys(data.downloads).forEach(school => {
    const rows=data.downloads[school];
    if (!schools.some(s=>s.id===school) || !map(rows) || Object.keys(rows).some(id=>!Number.isInteger(rows[id]) || rows[id]<0 || rows[id]>999999)) invalid();
  });
  return data;
}
function scope(school, section) {
  if (!schools.some(s=>s.id === school) || !['resources','market'].includes(section)) throw new Error('学校或栏目无效。');
  return school + ':' + section;
}
function getSearches(school, section) {
  const rows = read().searches[scope(school, section)];
  return Array.isArray(rows) ? rows.filter(x=>typeof x==='string' && x.length<=60).slice(0,8) : [];
}
function recordSearch(school, section, query) {
  const text = String(query || '').trim().slice(0,60); if (!text) return;
  const data=read(), key=scope(school,section), rows=Array.isArray(data.searches[key])?data.searches[key]:[];
  data.searches[key]=[text,...rows.filter(x=>x!==text)].slice(0,8); store.write(KEY,data);
}
function clearSearches(school, section) { const data=read(); delete data.searches[scope(school,section)]; store.write(KEY,data); }
function getDownloads(school) { scope(school,'resources'); const map=read().downloads[school]; return map && typeof map==='object' && !Array.isArray(map) ? map : {}; }
function recordDownload(id,school) {
  if (!community.getResources().some(x=>x.id===id && x.school_id===school)) throw new Error('资料不存在。');
  const data=read(); scope(school,'resources'); const map=data.downloads[school] || {};
  map[id]=Math.min(999999,(Number.isInteger(map[id])?map[id]:0)+1); data.downloads[school]=map; store.write(KEY,data);
  return map[id];
}
module.exports={getSearches,recordSearch,clearSearches,getDownloads,recordDownload};
