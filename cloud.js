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