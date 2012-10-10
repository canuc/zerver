//TODO: remove dependency on JSON

(function (window) {
	var apiRefresh   = {{__API_REFRESH__}},
		apiHost      = {{__API_HOST__}},
		apiDir       = {{__API_DIR__}},
		apiName      = {{__API_NAME__}},
		apiRoot      = {{__API_ROOT__}},
		apiObj       = {{__API_OBJ__}},
		apiFunctions = {{__API_FUNCTIONS__}},
		apiData      = {{__API_APIS__}},
		apis         = {};

	main();

	function main () {
		if (apiData) {
			setupRequire();
		}
		else {
			setupSingleAPI();
		}

		if (apiRefresh) {
			setupAutoRefresh();
		}
	}

	function setupRequire () {
		for (var apiRoot in apiData) {
			apis[apiRoot] = setupFunctions(apiData[apiRoot][0], apiData[apiRoot][1], [ apiRoot ]);
		}

		window[apiName] = function (apiRoot) {
			if (apiRoot in apis) {
				return apis[apiRoot];
			}
			else {
				throw TypeError(apiRoot + ' is not a known Zerver API');
			}
		};
	}

	function setupSingleAPI () {
		window[apiName] = setupFunctions(apiObj, apiFunctions, [ apiRoot ]);
	}

	function setupFunctions (obj, functions, tree) {
		var value;

		for (var key in functions) {
			value = functions[key];

			if (value === true) {
				obj[key] = function (key) {
					return function () {
						var data     = {},
							args     = Array.prototype.slice.call(arguments),
							numArgs  = args.length,
							callback = args[numArgs - 1];

						if (typeof callback === 'function') {
							args.pop();
						}
						else {
							data.noResponse = true;
							callback = function () {};
						}

						data.args = args;

						apiCall(tree.concat(key), data, callback);
					};
				}(key);
			}

			else if ((typeof value === 'object') && (typeof obj[key] === 'object')) {
				obj[key] = setupFunctions(obj[key], value, tree.concat([ key ]));
			}
		}

		return obj;
	}

	function apiCall (tree, args, callback) {
		var url  = '//' + apiHost + '/' + apiDir,
			data = JSON.stringify(args),
			done = false,
			xhr;

		for (var i=0, len=tree.length; i<len; i++) {
			url += '/' + encodeURIComponent( tree[i] );
		}

		if ((apiHost !== window.location.host) && (typeof XDomainRequest !== 'undefined')) {
			xhr = new XDomainRequest();

			xhr.onload = function () {
				xhrComplete(200);
			};
			xhr.onerror = function () {
				xhrComplete(0);
			};
			xhr.ontimeout = function () {
				xhrComplete(0);
			};
		}
		else {
			if (typeof XMLHttpRequest !== 'undefined') {
				xhr = new XMLHttpRequest();
			}
			else if (typeof ActiveXObject !== 'undefined') {
				xhr = new ActiveXObject('Microsoft.XMLHTTP');
			}
			else {
				throw Error('browser does not support ajax');
			}

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					xhrComplete(xhr.status);
				}
			};
		}

		xhr.open('POST', url, true);
		xhr.send(data);

		function xhrComplete (status) {
			if (done) {
				return;
			}
			done = true;

			var data = [],
				errorType, errorString;

			if (status === 200) {
				try {
					var response = JSON.parse(xhr.responseText);

					if (response.data) {
						data = response.data;
					}
					else {
						errorType = 'library';
						errorString = response.error;
					}
				}
				catch (err) {
					errorType = 'zerver';
					errorString = 'failed to parse response';
				}
			}
			else {
				errorType = 'zerver';
				errorString = 'http error, ' + status;
			}

			var context = {
				error       : !!errorType ,
				errorType   : errorType   ,
				errorString : errorString
			};

			callback.apply(context, data);
		}
	}

	function setupAutoRefresh () {
		var REFRESH_FLAG = '__ZERVER_REFRESH_FLAG',
			REFRESH_FUNC = 'ZERVER_REFRESH';

		if ( window[REFRESH_FLAG] ) {
			return;
		}
		window[REFRESH_FLAG] = true;

		if (typeof window[REFRESH_FUNC] !== 'function') {
			window[REFRESH_FUNC] = function () {
				window.location.reload();
			};
		}

		var done   = false,
			head   = document.getElementsByTagName('head')[0],
			script = document.createElement('script');

		script.src = '//'+apiHost+'/socket.io/socket.io.js';
		script.async = true;
		script.onload = script.onreadystatechange = function(){
			if (done) {
				return;
			}

			if (!this.readyState || (this.readyState == 'loaded') || (this.readyState == 'complete')) {
				done = true;
				setTimeout(setupRefreshListener, 0);
				script.onload = script.onreadystatechange = null;
				head.removeChild(script);
			}
		};
		head.appendChild(script);

		function setupRefreshListener () {
			io.connect('//'+apiHost+'/'+apiDir+'/_refresh')
				.on('refresh', function () {
					var refresher = window[REFRESH_FUNC];

					if (typeof refresher === 'function') {
						refresher();
					}
				});
		}
	}
})(window);