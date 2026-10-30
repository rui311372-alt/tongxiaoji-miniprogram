const { schools } = require('../../utils/catalog');
const community = require('../../utils/community');
const exp = require('../../utils/experience');
const presentation = require('../../utils/presentation');
const library = require('../../utils/library-state');
const store = require('../../utils/store');
const requestSeeds = require('../../utils/request-seeds');
const { getResourceMajors } = require('../../utils/resource-majors');
const { navigateMain } = require('../../utils/main-nav');
const { priorityMajors,orderMajors } = require('../../utils/major-order');
const { backToLibrary } = require('./library-navigation');
const { filterSummary } = require('./filter-summary');
const PAGE_SIZE=12;
const createdAt=x=>typeof x.created_at==='number'?x.created_at:(Date.parse(x.created_at)||0);
const effectivePrice=x=>x.auction?x.auction.current_cents:x.price_cents;
function auctionDisplay(a){
 if(!a)return{auctionLabel:'',auctionTone:'neutral',auctionClock:'',auctionPriceLabel:'当面交易'};
 const mine=a.myBidCount>0,leading=mine&&a.winner==='current-local-student',minutes=Math.ceil(Math.max(0,a.end_at-Date.now())/60000);
 const label=a.isOwner?(a.ended?'我发布 · 已结束':'我发布'):a.ended?(a.isWinner?'我已中拍':mine?'未中拍':'已结束'):leading?'我正领先':mine?'已被超价':'竞拍中';
 const clock=a.ended?'本场已截止':minutes>=1440?'剩余 '+Math.floor(minutes/1440)+' 天 '+Math.floor(minutes%1440/60)+' 小时':minutes>=60?'剩余 '+Math.floor(minutes/60)+' 小时 '+minutes%60+' 分':'剩余 '+minutes+' 分钟';
 return{auctionLabel:label,auctionTone:a.isOwner?'neutral':a.isWinner||leading?'leading':mine&&!a.ended?'outbid':a.ended?'neutral':'active',auctionClock:clock,auctionPriceLabel:a.ended&&a.bid_count?'最终出价':a.bid_count?'当前价':'起拍价'};
}
const defaults={keyword:'',category:'全部',major:'全部专业',course:'全部课程',sortIndex:0,goldOnly:false,savedOnly:false,budgetIndex:0,conditionIndex:0,campusIndex:0,requestStatusIndex:0,marketFilter:'all'};
const emptySchoolData=()=>({items:[],total:0,resourceTotal:0,productTotal:0,requestTotal:0,reviewTotal:0,searches:[],majorOptions:['全部专业'],courseOptions:['全部课程'],majorCards:[],canUseMyMajor:false,majorIndex:0,courseIndex:0,resourceChoices:[],comparison:[],comparedCount:0,comparisonOpen:false,hasMore:false});
function createBrowsePage(topic = '') { return {
  data: {school:schools[0],section:'resources',activeNav:'library',libraryTab:'resources',marketTab:'products',...defaults,filtersOpen:true,total:0,resourceTotal:0,productTotal:0,requestTotal:0,reviewTotal:0,activeFilters:[],items:[],hasMore:false,error:'',toolsHint:'',searches:[],majorOptions:[],courseOptions:[],majorIndex:0,courseIndex:0,resourceChoices:[],comparison:[],comparisonOpen:false,comparedCount:0,sortOptions:['最新分享','下载较多','评分优先'],resourceCategories:['全部','课程笔记','复习提纲','习题整理','其他'],productCategories:['全部','书籍教材','宿舍好物','出行运动','数码设备','其他'],budgetOptions:['全部预算','30元及以下','30—100元','100元以上'],conditionOptions:['全部成色','全新未使用','九成新','八成新','正常使用','有使用痕迹'],campusOptions:['全部校区','北洋园','卫津路','其他地点'],requestStatusOptions:['全部状态','寻找中','已解决']},
  onLoad(options = {}) { const section=topic?'resources':options.section==='market'?'market':'resources';this._compared=[];this._topic=topic||(section==='resources'?(options.libraryTab==='requests'?'help':options.category==='复习提纲'?'review':''):'');this.setData({section,topic:this._topic,topicTitle:this._topic==='review'?'期末冲刺':this._topic==='help'?'互助补齐':'',filtersOpen:true,activeNav:section==='market'?'market':'library',libraryTab:this._topic==='help'?'requests':'resources',marketTab:['wanted','auctions'].includes(options.marketTab)?options.marketTab:'products',category:'全部'}); },
  onShow() {this._visible=true;this._disposed=false;const school=schools.find(s=>s.id===getApp().globalData.schoolId)||schools[0];if(this.data.school.id!==school.id){this._compared=[];this._allProducts=[];this.setData({...defaults,...emptySchoolData()});}this.setData({school,sortOptions:this.data.section==='resources'?['最新分享','下载较多','评分优先']:['最新发布','价格从低到高','价格从高到低']});this.refresh();this.startAuctionClock();},
  onHide(){this._visible=false;this.stopAuctionClock();},
  onUnload(){this._disposed=true;this._visible=false;this.stopAuctionClock();},
  stopAuctionClock(){if(this._auctionTimer)clearInterval(this._auctionTimer);this._auctionTimer=null;},
  startAuctionClock(){this.stopAuctionClock();if(this._visible&&!this._disposed&&this.data.section==='market'&&this.data.marketTab==='auctions')this._auctionTimer=setInterval(()=>this.updateAuctionClock(),15000);},
  updateAuctionClock(){if(!this._visible||this._disposed||this.data.section!=='market'||this.data.marketTab!=='auctions'||this.data.error)return;const count=this.visibleCount||PAGE_SIZE,changed=(this._allProducts||[]).some(x=>x.auction&&!x.auction.ended&&x.auction.end_at<=Date.now());if(changed){this.refresh();if(!this.data.error){this.visibleCount=count;this.applyVisible();}}else{this.matches=(this.matches||[]).map(x=>Object.assign({},x,auctionDisplay(x.auction)));this.applyVisible();}},
  onSchoolChanged() {this._compared=[];this._allProducts=[];this.setData({...defaults,...emptySchoolData(),filtersOpen:true});this.onShow();},
  onMainNav(event) {if(this._topic&&event.detail.tab==='library'){this.backToLibrary();return;}if(event.detail.tab!==this.data.activeNav)navigateMain(event.detail.tab);},
  backToLibrary,
  changeLibrary(event) {const tab=event.currentTarget.dataset.tab;if(tab==='practice')this.practiceTopic();else if(tab==='requests')this.helpTopic();else this.backToLibrary();},
  changeMarket(event) {const tab=event.currentTarget.dataset.tab;this.setData({...defaults,marketTab:['wanted','auctions'].includes(tab)?tab:'products'});this.refresh();this.startAuctionClock();},
  reviewTopic() {wx.navigateTo({url:'/pages/review/review'});},
  practiceTopic() {wx.navigateTo({url:'/pages/practice/practice'});},
  helpTopic() {wx.navigateTo({url:'/pages/help/help'});},
  onSearch(event) {this.setData({keyword:event.detail.value});this.refresh();},
  clearKeyword(){this.setData({keyword:''});this.refresh();},
  removeFilter(event){
    const key=event.currentTarget.dataset.key;
    if(!Object.prototype.hasOwnProperty.call(defaults,key))return;
    const update={[key]:defaults[key]};
    // A course belongs to its major; releasing the major also releases its course.
    if(key==='major')update.course=defaults.course;
    this.setData(update);this.refresh();
  },
  confirmSearch() {try{library.recordSearch(this.data.school.id,this.data.section,this.data.keyword);this.setData({searches:library.getSearches(this.data.school.id,this.data.section)});}catch(error){this.setData({toolsHint:error.message});}},
  useSearch(event) {this.setData({keyword:event.currentTarget.dataset.value});this.refresh();this.confirmSearch();},
  clearSearches() {wx.showModal({title:'清空搜索记录？',content:'只清空本校当前栏目的本机搜索词。',success:r=>{if(!r.confirm)return;try{library.clearSearches(this.data.school.id,this.data.section);this.setData({searches:[]});}catch(e){this.toast(e);}}});},
  toggleFilters(){this.setData({filtersOpen:true});},
  setCategory(event){this.setData({category:event.currentTarget.dataset.value});this.refresh();},
  changeMajor(event){const major=this.data.majorOptions[Number(event.detail.value)];if(major){this.setData({major,course:'全部课程'});this.refresh();}},
  changeCourse(event){const course=this.data.courseOptions[Number(event.detail.value)];if(course){this.setData({course});this.refresh();}},
  changeFilter(event){const key=event.currentTarget.dataset.key;if(!['sortIndex','budgetIndex','conditionIndex','campusIndex','requestStatusIndex'].includes(key))return;this.setData({[key]:Number(event.detail.value)||0});this.refresh();},
  toggleGoldOnly(){this.setData({goldOnly:!this.data.goldOnly});this.refresh();},
  toggleSavedOnly(){this.setData({savedOnly:!this.data.savedOnly});this.refresh();},
  choosePriorityMajor(event){const major=event.currentTarget.dataset.major;if(!priorityMajors.includes(major))return;this.setData({...defaults,major:this.data.major===major?'全部专业':major});this.refresh();},
  useMyMajor(){try{const major=store.getProfile().major;if(!this.data.majorOptions.includes(major)){this.toast('这个专业暂时没有资料，可先查看全部');return;}this.setData({...defaults,major});this.refresh();}catch(e){this.toast(e);}},
  onPageScroll(event){const show=event.scrollTop>650;if(show!==!!this.data.showBackTop)this.setData({showBackTop:show});},
  backTop(){wx.pageScrollTo({scrollTop:0,duration:300});},
  onPullDownRefresh(){this.refresh();if(typeof wx.stopPullDownRefresh==='function')wx.stopPullDownRefresh();},
  setMarketFilter(event){const value=event.currentTarget.dataset.value;if(this.data.marketTab!=='wanted'||!['all','open','resolved','mine'].includes(value))return;this.setData({marketFilter:value});this.refresh();},
  offerSimilar(){wx.navigateTo({url:'/pages/publish/publish?kind=product'});},
  clearFilters(){this.setData({...defaults});this.refresh();},
  refresh(){
    try{
      const d=this.data,school=d.school.id, resources=community.getResources().filter(x=>x.school_id===school),products=presentation.getProducts().filter(x=>x.school_id===school).map(x=>x.sale_mode==='auction'?{...x,auction:exp.getAuction(x.id,school)}:x),requests=community.getRequests().concat(requestSeeds).filter(x=>x.school_id===school),wanted=community.getWanted().filter(x=>x.school_id===school);
      const summaries=exp.getReviewSummaries(school),downloadCounts=library.getDownloads(school),favoriteIds=new Set(store.getFavorites(school).map(x=>x.section+':'+x.id));
      const terms=d.keyword.toLowerCase().trim().split(/\s+/).filter(Boolean),isResource=d.section==='resources'&&d.libraryTab==='resources',isProduct=d.section==='market'&&d.marketTab!=='wanted';
      const source=d.section==='resources'?(d.libraryTab==='requests'?requests:resources):(d.marketTab==='wanted'?wanted:products.filter(x=>d.marketTab==='auctions'?x.sale_mode==='auction':x.sale_mode!=='auction'));
      this.matches=source.filter(x=>{
        if(d.section==='market'&&d.marketTab==='wanted'&&d.marketFilter!=='all'){if(d.marketFilter==='mine'&&!x.isLocal)return false;if(d.marketFilter!=='mine'&&x.status!==d.marketFilter)return false;}
        if(isResource){if(this._topic==='review'&&x.category!=='复习提纲')return false;if(d.major!=='全部专业'&&!getResourceMajors(x).includes(d.major))return false;if(d.course!=='全部课程'&&x.course!==d.course)return false;if(d.goldOnly&&!x.gold)return false;if(d.savedOnly&&!favoriteIds.has('resources:'+x.id))return false;}
        if((isResource||isProduct)&&d.category!=='全部'&&x.category!==d.category)return false;
        if(d.section==='resources'&&d.libraryTab==='requests'&&d.requestStatusIndex&&x.status!==(d.requestStatusIndex===1?'open':'resolved'))return false;
        if(isProduct){if(d.budgetIndex===1&&effectivePrice(x)>3000||d.budgetIndex===2&&(effectivePrice(x)<=3000||effectivePrice(x)>10000)||d.budgetIndex===3&&effectivePrice(x)<=10000)return false;if(d.conditionIndex&&x.condition!==d.conditionOptions[d.conditionIndex])return false;if(school==='tianjin'&&d.campusIndex){const area=String(x.place||'');if(d.campusIndex===1&&!area.includes('北洋园')||d.campusIndex===2&&!area.includes('卫津路')||d.campusIndex===3&&/北洋园|卫津路/.test(area))return false;}}
        return terms.every(t=>[x.title,x.course,getResourceMajors(x).join(' '),x.category,x.description,x.place].filter(Boolean).join(' ').toLowerCase().includes(t));
      }).map(x=>{const author=presentation.author(x);const {body,...card}=x;return {...card,majorLabel:getResourceMajors(x).join('、'),...presentation.rating(x,summaries[x.id]),...auctionDisplay(x.auction),authorName:author.name,authorCredit:author.credit,authorDemo:author.isDemo,price:presentation.money(x.auction ? x.auction.current_cents : (x.price_cents||x.budget_cents)),photo:presentation.photo(x),...presentation.resourceDownloads(x,downloadCounts[x.id]||0),favorite:favoriteIds.has(d.section+':'+x.id),compared:(this._compared||[]).includes(x.id),format:x.attachment?x.attachment.type.toUpperCase():'TXT',auction:x.auction||null};});
      if(isResource){this.matches.sort((a,b)=>d.sortIndex===2?b.scoreValue-a.scoreValue||b.ratingCount-a.ratingCount:d.sortIndex===1?b.downloads-a.downloads:createdAt(b)-createdAt(a));}
      else if(isProduct){this.matches.sort((a,b)=>d.sortIndex===1?effectivePrice(a)-effectivePrice(b):d.sortIndex===2?effectivePrice(b)-effectivePrice(a):createdAt(b)-createdAt(a));}
      const majorOptions=['全部专业',...orderMajors(resources.reduce((all,x)=>all.concat(getResourceMajors(x)),[]))],courseOptions=['全部课程',...new Set(resources.filter(x=>d.major==='全部专业'||getResourceMajors(x).includes(d.major)).map(x=>x.course))];
      const majorCards=priorityMajors.map((major,index)=>({major,index,caption:['系统分析 · 数据设计','信息边界 · 流程管理','用户运营 · 交易履约'][index],count:resources.filter(x=>getResourceMajors(x).includes(major)).length,active:d.major===major}));
      this._allProducts=products;this.visibleCount=PAGE_SIZE;
      this.setData({error:'',toolsHint:'',resourceTotal:resources.length,productTotal:products.length,requestTotal:requests.filter(x=>x.status==='open').length,reviewTotal:resources.filter(x=>x.category==='复习提纲').length,majorOptions,courseOptions,majorIndex:Math.max(0,majorOptions.indexOf(d.major)),courseIndex:Math.max(0,courseOptions.indexOf(d.course)),searches:library.getSearches(school,d.section),resourceChoices:resources.map(x=>({id:x.id,title:x.title})),comparison:(this._compared||[]).map(id=>products.find(x=>x.id===id)).filter(Boolean).map(x=>({...x,price:presentation.money(x.price_cents),photo:presentation.photo(x)})),comparedCount:(this._compared||[]).length});
      this.setData({majorCards,canUseMyMajor:majorOptions.includes(store.getProfile().major),activeFilters:filterSummary(this.data)});
      this.applyVisible();wx.setNavigationBarTitle({title:this.data.topicTitle||'同校集'});
    }catch(e){this.matches=[];this._compared=[];this._allProducts=[];this.setData({...emptySchoolData(),error:e.message||'暂时无法读取本机内容，请重试。'});}
  },
  applyVisible(){this.setData({total:this.matches.length,items:this.matches.slice(0,this.visibleCount),hasMore:this.visibleCount<this.matches.length});},
  loadMore(){this.visibleCount+=PAGE_SIZE;this.applyVisible();},onReachBottom(){if(this.data.hasMore)this.loadMore();},
  openDetail(event){this.confirmSearch();const id=event.currentTarget.dataset.id,focus=event.currentTarget.dataset.focus||'';wx.navigateTo({url:'/pages/detail/detail?section='+this.data.section+'&school='+encodeURIComponent(this.data.school.id)+'&id='+encodeURIComponent(id)+'&focus='+focus});},
  toggleFavorite(event){const id=event.currentTarget.dataset.id;try{store.toggleFavorite(this.data.section,id,this.data.school.id);const count=this.visibleCount;this.refresh();this.visibleCount=count;this.applyVisible();}catch(e){this.toast(e);}},
  toggleCompare(event){const id=event.currentTarget.dataset.id;const ids=this._compared||[];if(ids.includes(id))this._compared=ids.filter(x=>x!==id);else if(ids.length>=3){this.toast('最多同时比较 3 件');return;}else this._compared=ids.concat(id);const count=this.visibleCount;this.refresh();this.visibleCount=count;this.applyVisible();},
  toggleComparison(){this.setData({comparisonOpen:!this.data.comparisonOpen});},clearComparison(){this._compared=[];this.setData({comparisonOpen:false});this.refresh();},
  openCredit(event){const row=this.matches.find(x=>x.id===event.currentTarget.dataset.id);if(!row)return;wx.showModal({title:row.authorName+' · 信用 '+row.authorCredit,content:row.isLocal?'这是当前本机账号的模拟履约信用。查看“我的 → 校园信用”可了解变动明细。':'这是课堂预置同学的示例信用，不是真实用户履约记录或交易担保。',showCancel:false});},
  openRequest(event){const row=this.matches.find(x=>x.id===event.currentTarget.dataset.id);if(!row)return;if(row.status==='resolved'&&row.resource_id)wx.navigateTo({url:'/pages/detail/detail?section=resources&school='+this.data.school.id+'&id='+encodeURIComponent(row.resource_id)});else wx.navigateTo({url:'/pages/publish/publish?kind=resource&course='+encodeURIComponent(row.course||'')});},
  resolveRequest(event){const resource=this.data.resourceChoices[Number(event.detail.value)],id=event.currentTarget.dataset.id;if(!resource)return;wx.showModal({title:'关联资料并标记已解决？',content:resource.title,success:r=>{if(!r.confirm)return;try{community.updateRequest(id,this.data.school.id,{status:'resolved',resource_id:resource.id});this.refresh();}catch(e){this.toast(e);}}});},
  reopenRequest(event){try{community.updateRequest(event.currentTarget.dataset.id,this.data.school.id,{status:'open'});this.refresh();}catch(e){this.toast(e);}},
  updateWanted(event){const {id,status}=event.currentTarget.dataset;try{community.updateWanted(id,this.data.school.id,status);this.refresh();}catch(e){this.toast(e);}},
  publishRequest(){wx.navigateTo({url:'/pages/publish/publish?kind='+(this.data.section==='market'?'wanted':'request')});},
  toast(e){wx.showToast({title:typeof e==='string'?e:e.message||'操作失败，请重试',icon:'none'});},
  onShareAppMessage(){return{title:this.data.school.name+' · 同校集',path:'/pages/index/index?school='+this.data.school.id};}
}; }
module.exports = { createBrowsePage };
