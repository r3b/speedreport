var BASE='http://api.usergrid.com/rbridges/speedreport/reports';
Ajax.get(BASE).then(function(err, response){
	var list=document.getElementById('list');
	list.innerHTML="";
	var response_data=JSON.parse(response.responseText);

	//console.log(response_data);
	response_data.entities.forEach(function(entity){
		list.innerHTML+="<li><a href=\"report.html?"+entity.uuid+"\">"+entity.log.pages[0].title+" ("+entity.log.pages[0].id+")</a>";
	})
})
