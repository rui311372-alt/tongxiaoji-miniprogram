const community = require('./community');
const photoMap = require('./photo-map');
const experience = require('./experience');
const store = require('./store');
const discovery = require('./discovery-data');
const { resources: catalogResources } = require('./catalog');
const { resources: majorResources } = require('./major-resources');
const builtinResources = new Map(catalogResources.concat(majorResources).map(item => [item.id, item.school_id]));
// Classroom fixture values are deterministic and never written into the user's
// real local download counters or account credit ledger.
function sampleHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}
function resourceDownloads(item, localCount) {
  const localDownloads = Number.isInteger(localCount) && localCount >= 0 ? localCount : 0;
  const downloadsDemo = !item.isLocal && builtinResources.get(item.id) === item.school_id;
  const demoDownloads = downloadsDemo ? 18 + sampleHash('downloads:' + item.id) % 483 : 0;
  return { downloads: demoDownloads + localDownloads, localDownloads, demoDownloads, downloadsDemo };
}
const money = cents => (Number(cents || 0) / 100).toFixed(2).replace(/\.00$/, '');
function getProducts() {
  const overlays = experience.getAuctionProducts();
  const map = new Map(overlays.map(x => [x.id || x.product_id, x]));
  return community.getProducts().map(x => Object.assign({}, x, map.get(x.id) || {}));
}
function photo(item) { return photoMap[item.image] || item.image || ''; }
function rating(item, summary) {
  const real=summary && summary.count>0 && summary.average>=1 && summary.average<=5;
  const value=real?summary.average:Number(item.demoScore || 0);
  return { hasScore: value>0, scoreValue: value, scorePercent:Math.max(0,Math.min(100,value*20)), scoreLabel: value>0?value.toFixed(1):'待评分', scoreSource:real?'同学评分':value>0?'综合评分':'暂无评价', isDemoScore:!real&&value>0, ratingCount:real?summary.count:0 };
}
function author(item) {
  if(item.isLocal) { const p=store.getProfile(), c=experience.getCredit(item.school_id); return {name:p.nickname,credit:c.score,creditLabel:c.level,isDemo:false}; }
  const p=discovery.authors[item.id];
  const name=p?p.nickname:(item.author_name || '同校同学');
  // Shared group labels do not identify one contributor. Keep explicit author
  // IDs consistent; otherwise use the resource's stable classroom fixture key.
  const key=p&&p.id?p.id:item.author_id||item.id;
  return {name,credit:86+sampleHash('credit:'+key)%33,creditLabel:'课堂示例信用',isDemo:true};
}
module.exports={getProducts,photo,money,rating,author,resourceDownloads};
