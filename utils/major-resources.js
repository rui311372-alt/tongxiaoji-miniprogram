// 36篇原创基础资料由21个校园分区共用，避免把重复正文打包756次。
const {schools}=require('./catalog');
const {priorityMajors}=require('./major-order');
const templates=require('./major-core-content').concat(require('./major-security-content')).sort((a,b)=>priorityMajors.indexOf(a.major)-priorityMajors.indexOf(b.major));
const resources=schools.flatMap(school=>templates.map(template=>({
 id:'r-major-v1-'+school.id+'-'+template.key,school_id:school.id,
 title:template.title,course:template.course,major:template.major,category:template.category,
 description:template.description,body:template.body,demoScore:template.demoScore,
 gold:false,isLocal:false,origin:'shared-major-example',author_name:'同校集专业资料组',
 created_at:'2026-10-20T00:00:00+08:00',attachment:null
})));
const routeCopy=[
 {title:'信管：从需求到系统',subtitle:'业务理解 → 分析建模 → 数据设计',description:'从订单业务的小例子开始，依次读需求、数据流程图、数据库和验收案例。每篇都有可复核例子及自测答案；这是跨校共用的原创基础专题，不代表本校课程安排。'},
 {title:'保密管理：从边界到流程',subtitle:'分类边界 → 权限审批 → 留痕复盘',description:'通过虚构内部资料案例练习信息分类、最小权限、审批与审计，再检查风险、事件处理和恢复。资料不作法定密级判定或法律结论。'},
 {title:'电商：从浏览到履约',subtitle:'商品与用户 → 订单库存 → 服务复盘',description:'按可核对的小数据案例，练习漏斗、订单去重、库存与售后流程。先独立算一次，再对照自测答案；所有数据均为教学示例。'}
];
const collections=schools.flatMap(school=>priorityMajors.map((major,index)=>({
 id:'collection-major-v1-'+school.id+'-'+index,school_id:school.id,major,
 ...routeCopy[index],resource_ids:templates.filter(t=>t.major===major).map(t=>'r-major-v1-'+school.id+'-'+t.key)
})));
module.exports={templates,resources,collections};
