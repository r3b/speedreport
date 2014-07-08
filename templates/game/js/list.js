	var reportUrl="http://api.usergrid.com/rbridges/speedreport/reports/";
	var list=document.getElementById('list');
	Ajax.get(reportUrl).then(function(err,data){
		var data=JSON.parse(data.responseText);
		var reports=data.entities;
		reports.forEach(function(report){
			var a=document.createElement('a');
			a.href='maze.html#'+report.uuid;
			a.innerText=report.log.pages[0].id;
			var li=document.createElement('li');
			li.appendChild(a);
			//'<li><a href="+'" target="_blank">'+report.log.pages[0].id+'</a>'
			list.appendChild(li);
			console.log(report.log.pages[0].id);
		})
	});
