const priorityMajors=['信息管理与信息系统','保密管理','电子商务'];
function orderMajors(values){const unique=[...new Set(values.filter(x=>typeof x==='string'&&x))];return priorityMajors.filter(x=>unique.includes(x)).concat(unique.filter(x=>!priorityMajors.includes(x)));}
module.exports={priorityMajors,orderMajors};
