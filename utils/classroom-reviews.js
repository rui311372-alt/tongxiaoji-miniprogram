// 只读课堂点评，不写入experience，不伪装成真实用户评价或真实使用人数。
const names=['知夏','北辰同学','小满','林间笔记','橙子同学','晚风','小禾','青柠','拾页','晨光'];
const themes={
 '课程笔记':['概念和例子放在一起，对照着读比较容易跟上。','先看知识范围再读例子，整理笔记时更容易抓住重点。','把易错点列出来很有帮助，我会再按自己的课程补充。'],
 '复习提纲':['适合先梳理一遍知识范围，再回到例题检查薄弱的地方。','按照提纲自己讲一遍，遇到卡住的部分再回去看正文。','章节之间的关系比较清楚，用来安排复习顺序很方便。'],
 '习题整理':['先自己做，再对照参考思路，能发现漏掉的条件。','例子的步骤能逐项核对，做完自测再看答案更有收获。','误区提醒很实用，计算前先把口径和条件写清楚。']
};
function hash(text){let n=0;for(const ch of text)n=(n*31+ch.charCodeAt(0))>>>0;return n;}
function getClassroomReviews(resource){
 if(!resource||resource.isLocal||!(resource.demoScore>=1&&resource.demoScore<=5))return{reviews:[],count:0,average:null,distribution:{1:0,2:0,3:0,4:0,5:0}};
 const seed=hash(resource.id),average=Math.round(resource.demoScore*10)/10,total=Math.round(average*10),base=Math.floor(average),extra=total-base*10;
 const distribution={1:0,2:0,3:0,4:0,5:0},comments=themes[resource.category]||themes['课程笔记'];
 const reviews=Array.from({length:10},(_,i)=>{const rank=(i*3+(seed%10))%10,score=base+(rank<extra?1:0);distribution[score]++;const note=comments[(seed+i)%comments.length];return{id:'classroom-'+resource.id+'-'+i,score,author:names[(seed+i)%names.length],comment:'《'+resource.title+'》：'+note+(score<=3?' 有些地方还需要结合课堂讲解进一步理解。':i%3===1?' 如果能再补一组相近练习，使用起来会更顺手。':''),starsText:'★'.repeat(score)+'☆'.repeat(5-score),date:'课后学习反馈',isDemo:true};});
 return{reviews,count:reviews.length,average,distribution};
}
module.exports={getClassroomReviews};
