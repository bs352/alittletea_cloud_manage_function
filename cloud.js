var AV = require('leanengine');

AV.Cloud.define('bindingStore', function(request) {
	var username = request.params.username;
	var bindingCode = request.params.code;
	
	var query = new AV.Query('_User');
	query.limit(1);
	query.equalTo('username', username);
	
	return query.find().then(function(objects){
		//var Stores = AV.Object.extend('Stores');
		var u = objects[0];	
		
		if (u) {
		
			return u.fetch({
				include: ['shops']
			}).then(function(user){
				var q = new AV.Query('Stores');
				q.limit(1);
				q.equalTo('key', bindingCode);
			
				return q.find().then(function(stores) {
					if (stores) {
						var store = stores[0];
						if (store) {
							var shops = user.get('shops');
							shops = shops ? shops : [];
							shops.push(store);
							user.set('shops', shops);
							return user.save();
						}
					}
					return 'fail';
				});
			});
			
			
		}
		return 'fail';
	});
});

const https = require('https');
var API_SERVER_LIST = {};

function UpdateAPIRoute(id, callback, options) {
	var opt = {
		hostname: 'app-router.leancloud.cn',
		path: '/2/route?appId=' + id
	};
	var request = https.get(opt, (res) => {
		const { statusCode } = res;
		const contentType = res.headers['content-type'];
		let error;
		if (statusCode !== 200) {
			error = new Error('Request Failed.\n' +
						  `Status Code: ${statusCode}`);
		} else if (!/^application\/json/.test(contentType)) {
			error = new Error('Invalid content-type.\n' +
						  `Expected application/json but received ${contentType}`);
		}
		if (error) {
			console.error(error.message);
			// consume response data to free up memory
			res.resume();
			return;
		}

		res.setEncoding('utf8');
		let rawData = '';
		res.on('data', (chunk) => { rawData += chunk; });
		res.on('end', () => {
			try {
				const d = JSON.parse(rawData);
				API_SERVER_LIST[id] = d["api_server"];
				console.log("API_Server for: " + id + " : " + API_SERVER_LIST[id]);
				callback(options, API_SERVER_LIST[id]);
			} catch (e) {
			  console.error(e.message);
			}
		});
	}).on('error', (e) => {
		console.error(`Got error: ${e.message}`);
	});
}

AV.Cloud.define('CollectReport', function(request) {
	
	var q = new AV.Query('Stores');
	
	return q.find().then(function(stores) {
		if (stores) {
			
			var results = [];
		
			var requested = 0;
			
			for (var id in stores) {
				var s = stores[id];
				var key = s.get('key');
				var id = s.get('id');
				var index = s.get('index') ? s.get('index') : '';
				var opt = {
					hostname: API_SERVER_LIST[id],
					path: '/1.1/classes/Snapshot' + index + '?order=-createdAt&limit=1',
					headers: {
						"X-LC-Id": id,
						"X-LC-Key": key,
						"X-Index": index
					}
				};	
				var DoRequest = function(options, host) {
					console.log("Using Server: " + host + " for id: " + options.headers["X-LC-Id"]);
					options.hostname = host;
					var request = https.get(options, (res) => {
						const { statusCode } = res;
						const contentType = res.headers['content-type'];

						let error;
						if (statusCode !== 200) {
							error = new Error('Request Failed.\n' +
										  `Status Code: ${statusCode}`);
						} else if (!/^application\/json/.test(contentType)) {
							error = new Error('Invalid content-type.\n' +
										  `Expected application/json but received ${contentType}`);
						}
						if (error) {
							console.error(error.message);
							// consume response data to free up memory
							res.resume();
							requested++;
							return;
						}

						res.setEncoding('utf8');
						let rawData = '';
						res.on('data', (chunk) => { rawData += chunk; });
						res.on('end', () => {
							try {
								requested++;
								const d = JSON.parse(rawData);
								const data = d.results[0];
								//console.log(data);
								if (new Date(data.date.iso).getDate() != (new Date()).getDate()) {
									data.orders = 0;
									data.cup = 0;
									data.sales = 0;
								}
								results.push({
									id: res.req.getHeader('X-LC-Id'),
									index: res.req.getHeader('X-Index'),
									orders: data.orders,
									cup: data.cup,
									sales: data.sales
								});
							  
								if (requested == stores.length) {
									var HourlyReport = AV.Object.extend('HourlyReport');
									var report = new HourlyReport();
									report.set('details', results);
									report.save();
									//console.log(report);
								}
							} catch (e) {
							  console.error(e.message);
							}
						});
					}).on('error', (e) => {
						requested++;
						console.error(`Got error: ${e.message}`);
					});
				};
				
				console.log("See if " + id + " has APISERVER: " + API_SERVER_LIST[id]);
				if (!API_SERVER_LIST[id]) {
					UpdateAPIRoute(id, DoRequest, opt);
				}
				else {
					DoRequest(opt, API_SERVER_LIST[id]);
				}
			}
		}
	});
});

/**
AV.Cloud.define('RouteRequest', function(request) {
	var url = request.params.url;
	var id = request.params.id;
	var key = request.params.key;
	
	var s = stores[id];
	var index = s.get('index') ? s.get('index') : '';
	
	var opt = {
		hostname: API_SERVER_LIST[id],
		path: '/1.1/classes/Snapshot' + index + '?order=-createdAt&limit=1',
		headers: {
			"X-LC-Id": id,
			"X-LC-Key": key,
			"X-Index": index
		}
	};	
	
	var DoRequest = function(options, host) {
		options.hostname = host;
		var request = https.get(options, (res) => {
			const { statusCode } = res;
			const contentType = res.headers['content-type'];

			let error;
			if (statusCode !== 200) {
				error = new Error('Request Failed.\n' +
							  `Status Code: ${statusCode}`);
			} else if (!/^application\/json/.test(contentType)) {
				error = new Error('Invalid content-type.\n' +
							  `Expected application/json but received ${contentType}`);
			}
			if (error) {
				console.error(error.message);
				// consume response data to free up memory
				res.resume();
				return;
			}

			res.setEncoding('utf8');
			let rawData = '';
			res.on('data', (chunk) => { rawData += chunk; });
			res.on('end', () => {
				try {
					const d = JSON.parse(rawData);
					const data = d.results[0];
					results.push({
						id: res.req.getHeader('X-LC-Id'),
						index: res.req.getHeader('X-Index'),
						orders: data.orders,
						cup: data.cup,
						sales: data.sales
					});
				  
					if (requested == stores.length) {
						var HourlyReport = AV.Object.extend('HourlyReport');
						var report = new HourlyReport();
						report.set('details', results);
						report.save();
					}
				} catch (e) {
				  console.error(e.message);
				}
			});
		}).on('error', (e) => {
			console.error(`Got error: ${e.message}`);
		});
	};
	
	if (!API_SERVER_LIST[id]) {
		UpdateAPIRoute(id, DoRequest, opt);
	}
	else {
		DoRequest(opt, API_SERVER_LIST[id]);
	}
});
*/