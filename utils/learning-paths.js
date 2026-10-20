const original=require('./discovery-data');
const extension=require('./major-resources');
module.exports={collections:extension.collections.concat(original.collections),gold:original.gold,authors:original.authors};
