const Fs = require('fs');

NEWOPERATION('users.save', function(error, value, callback) {
	callback(SUCCESS(true));
	setTimeout2('users.save', function() {
		Fs.writeFile(F.path.databases('users.json'), JSON.stringify(F.global.users), F.error());
	}, 500);
});

NEWOPERATION('users.load', function(error, value, callback) {
	Fs.readFile(F.path.databases('users.json'), function(err, data) {
		if (err)
			F.global.users = [];
		else
			F.global.users = data.toString('utf8').parseJSON(true);

		for (var i = 0, length = F.global.users.length; i < length; i++) {
			var user = F.global.users[i];
			user.online = false;

			if (!user.department)
				user.department = 'Members';

			!user.lastmessages && (user.lastmessages = {});

			// Cleaner for unhandled assignment
			delete user.recent[''];
			delete user.recent[user.id];
			delete user.unread[user.id];
			delete user.unread[''];
			delete user.lastmessages[''];
			delete user.lastmessages[user.id];
			delete user.recent['undefined'];
			delete user.unread['undefined'];
			delete user.lastmessages['undefined'];
		}

		callback(SUCCESS(true));
	});
});

// Performs notifications for unread messages
NEWOPERATION('users.notify', function(error, value, callback) {
	F.logger('notifications', 'begin');

	var has = false;

	F.global.users.wait(function(item, next) {

		if (!item.notifications)
			return next();

		var model = {};
		var count = 0;

		model.name = item.name;
		model.channels = [];
		model.users = [];
		model.has = false;

		Object.keys(item.unread).forEach(function(id) {
			var unread = F.global.channels.findItem('id', id);
			if (unread) {
				count += item.unread[id];
				model.channels.push({ item: unread, count: item.unread[id] });
				model.has = true;
				return;
			}

			unread = F.global.users.findItem('id', id);
			if (unread) {
				count += item.unread[id];
				model.users.push({ item: unread, count: item.unread[id] });
				model.has = true;
			}
		});

		if (model.has) {
			if (count === item.unreadcount)
				return next();
			item.unreadcount = count;
			has = true;
			F.logger('notifications', item.email, 'channels: ' + model.channels.length, 'users: ' + model.users.length);
			F.mail(item.email, '@({0}: unread messages)'.format(F.config.name), 'notification', model, next, '');
		} else
			next();

	}, function() {
		F.logger('notifications', 'end');
		has && OPERATION('users.save', NOOP);
	});

	callback(SUCCESS(true));
});

NEWOPERATION('channels.save', function(error, value, callback) {
	callback(SUCCESS(true));
	setTimeout2('users.save', function() {
		Fs.writeFile(F.path.databases('channels.json'), JSON.stringify(F.global.channels), F.error());
	}, 500);
});

NEWOPERATION('channels.load', function(error, value, callback) {
	Fs.readFile(F.path.databases('channels.json'), function(err, data) {
		if (err)
			F.global.channels = [];
		else
			F.global.channels = data.toString('utf8').parseJSON(true);
		callback(SUCCESS(true));
	});
});

NEWOPERATION('messages.cleaner', function(error, value, callback) {
	callback(SUCCESS(true));
	setTimeout2(value, function() {
		var db = NOSQL(value);
		var max = 100;
		db.count().callback(function(err, count) {
			if (count > max) {
				count = count - max;
				db.remove().prepare((doc, index) => index < count);
			}
		});
	}, 30000);
});

F.wait('database');
F.on('ready', function() {
	setTimeout(() => F.wait('database'), 2000);
	OPERATION('users.load', NOOP);
	OPERATION('channels.load', NOOP);
});