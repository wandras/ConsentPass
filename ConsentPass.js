/**
 * Manages the instant execution of callbacks (tags) or their scheduling at the acceptance event.
 * 
 * A JavaScript singleton class is used to ensure consistency by controlling a single instance.
 * The class is then referenced in the window.wa namespace with a short-circuit evaluation
 * to prevent reloading the class (and thus preserving its static properties) in subsequent runs.
 * Having a single instance also prevents from duplicating the queue.
 * Usage:
 * 
 wa.consentPass = new wa.ConsentPass(); // construction always returns the same instance
 wa.consentPass.runWithConsent('STRICTLY_NECESSARY', function(e) {
    // operations to run with the specified consent...
 });
 
 */

wa.ConsentPass = wa.ConsentPass || class ConsentPass {
    static instance;
    #codeToType;
    #logStyle;
    #dataLayer;
    
    constructor() {
        // single instance:
        if (ConsentPass.instance) {
            return ConsentPass.instance;
        }

        ConsentPass.instance = this;
        this.#initConsents();
        this.#listenConsentChange();
        this.#setLogStyle();
    }
    #initConsents() {
        this.consents = {
            'STRICTLY_NECESSARY': {
                code: 'C0001',
                value: false,
                queue: []
            },
            'PERFORMANCE': {
                code: 'C0002',
                value: false,
                queue: []
            },
            'FUNCTIONAL': {
                code: 'C0003',
                value: false,
                queue: []
            },
            'TARGETING': {
                code: 'C0004',
                value: false,
                queue: []
            }
        }
        
        this.#codeToType = this.#createReverseMap();
        
        var self = this; // reference to the local scope, for injection purposes

        // reference the consents in flat properties of this.#dataLayer:
        Object.defineProperties(this.#dataLayer, {
            consent_strictly_necessary: {
                get() {
                    return self.consents.STRICTLY_NECESSARY.value;
                },
                enumerable: true,
                configurable: true
            },
            consent_functional: {
                get() {
                    return self.consents.FUNCTIONAL.value;
                },
                enumerable: true,
                configurable: true
            },
            consent_performance: {
                get() {
                    return self.consents.PERFORMANCE.value;
                },
                enumerable: true,
                configurable: true
            },
            consent_targeting: {
                get() {
                    return self.consents.TARGETING.value;
                },
                enumerable: true,
                configurable: true
            }
        });
        
        // populate this.consents with data (consents are also saved into this.#dataLayer);
		// this.consents is automatically updated at each change:
		this.#refreshConsents();
	}
    setDataLayer(dataLayer) {
        this.#dataLayer = dataLayer || window.utag_data;
    }
    runWithConsent(type, callback) {
        // run the callback if the consent specified has been accepted, or schedule it at the acceptance
        // receives the consent type (e.g. 'STRICTLY_NECESSARY') and the callback
        var code = this.getConsentCodeByType(type);
		
        if (!code) {
            console.log('%cConsentPass: invalid consent type "' + type + '" provided for callback', this.#logStyle);
            return false;
        }
		
        if (typeof callback !== 'function') {
            console.log('%cConsentPass: invalid callback provided for consent ' + type + '(' + code + ')', this.#logStyle);
            return false;
        }
        
        if (this.getConsent(type) === true) {
            // consent accepted, execute the callback at runtime:
            try {
                callback(type);
            } catch (error) {
                console.log('%cConsentPass: callback error for consent type "' + type + '"', this.#logStyle, error);
            }
        } else {
            // consent not accepted yet, save the callback in the proper queue:
            this.consents[type].queue.push(callback);
        }
    }
    getConsents() {
        // get Onetrust consents as an object literal, values: true/false if set, undefined otherwise, and updates this.consents
		var plainConsents = {}; // the final object to be returned

		for (var type in this.consents) {
			plainConsents[type] = this.consents[type]?.value;
		}
		
		return plainConsents;
    }
    getConsent(type) {
        // get Onetrust consent by type (e.g. 'STRICTLY_NECESSARY'), returns true/false if set, undefined otherwise
        return this.consents[type]?.value;
    }
    getConsentByCode(code) {
        // get Onetrust consent by type (e.g. 'C0001'), returns true/false if set, undefined otherwise
		var type = this.getConsentTypeByCode(code);
        return this.getConsent(type);
    }
    #listenConsentChange() {
        // add a consent change listener though the gtmHelper instance, executing and emptying the queues of the accepted consents
        const oldWrapper = window.OptanonWrapper || function() {};

        window.OptanonWrapper = () => {
            oldWrapper();

            // get the user consents plain object and update the local this.consents object:
            var plainConsents = this.#refreshConsents();
            console.log('%cConsentPass: consents set to', this.#logStyle, plainConsents);
            
            try {
                // empty the queue of tags with accepted consent:
                for (var type in this.consents) {
                    var queue = this.consents[type].queue;
                    
                    if (this.consents[type].value === true) {
                        var code = this.getConsentCodeByType(type);
                        console.log('%cConsentPass: consent "' + type + '" (' + code + ') accepted, ' + (queue.length > 0 ? 'executing queue (' + queue.length + ' callbacks)' : 'no callback scheduled'), this.#logStyle);
                        
                        // consents of the current type have been accepted, loop over the queue to run stored callbacks:
                        while (queue.length > 0) {
                            // sequentially execute and empty the queue:
                            var callback = queue.shift();
                            
                            if (typeof callback === 'function') {
                                try {
                                    callback(type);
                                } catch (error) {
                                    console.log('%cConsentPass: callback error for consent type "' + type + '" (' + code + ')', this.#logStyle, error);
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('%cConsentPass: queues execution error', this.#logStyle, error);
            }
        }
    }
	#refreshConsents() {
		// refresh the consents plain object and the this.consents object with the latest values
		var plainConsents = {};
		
		try {
		    // try to get autonomously the consents by parsing the Onetrust cookie:
		    var consents = this.fetchConsents();
		    
		    if (consents !== false) {
        		for (var type in this.consents) {
        			var code = this.getConsentCodeByType(type);
        			this.consents[type].value = consents?.[code] === 1;
        		}
        		// the consents object fetched is actually the plainConsents object to be returned:
        		plainConsents = consents;
		    }
		} catch(error) {
		    console.log('%cConsentPass: #refreshContent error', this.#logStyle, error);
		}
		
		// return the plain object:
		return plainConsents;
	}
    getConsentTypes() {
        // return all the possible consent types ('STRICTLY_NECESSARY', 'FUNCTIONAL'...) as an array
        return Object.keys(this.consents);
    }
	getConsentCodes() {
	    // return all the possible consent codes (C0001...5) as an array
		var codes = [];
		for (var type in this.consents) {
			codes.push(this.consents[type].code);
		}
		return codes;
	}
    getConsentTypeByCode(code) {
        // get the consent type given the code (C0001...5)
        return this.#codeToType?.[code];
    }
    getConsentCodeByType(type) {
        // get the consent code (C0001...5) given the type
		return this.consents?.[type]?.code;
    }
    #createReverseMap() {
        // for performance reasons, a reverse map (code to type) is create when the this.consents object is initialized
        var codeToType = {};
        
        for (var type in this.consents) {
            codeToType[this.consents[type].code] = type;
        }
        
        return codeToType;
    }
    fetchConsents() {
        // Tries to read directly OneTrust consents through the Optanon cookie
        // Returns an object literal containing the OneTrust consents (e.g. { C0001: true, C0002: false ... }), false if they are not set
        return this.parseCookieConsents(document.cookie);
    }
    parseCookieConsents(cookieString) {
        // Receives the whole document.cookie string as argument searching the OneTrust cookie and parsing it
        // May be used to allow manually check cookie strings of different domains/scopes, passing them as argument
        // Returns an object literal containing the OneTrust consents, false if they are not set
        if (typeof cookieString !== 'string') {
            return false;
        }
        
        let lookup = encodeURIComponent('OptanonConsent') + "=";
        let cookieArray = cookieString.split(';');
        var consentCookie = null;
        
        for (let i = 0, l = cookieArray.length; i < l; ++i) {
            let cookie = cookieArray[i].trim();
            
            if (cookie.indexOf(lookup) === 0) {
                consentCookie = decodeURIComponent(cookie.substring(lookup.length, cookie.length));
                break;
            }
        }
        
        if (!consentCookie) {
            return false;
        }
        
        var params = new URLSearchParams(consentCookie),
            groupStr = params.get('groups');
        
        if (!groupStr) {
            return false;
        }
        
        var groups = groupStr.split(';')[0];
        if (!groups) {
            return false;
        }
        
        var consentPairs = groups.trim().split(','),
            consents = {};
        
        consentPairs.forEach(pair => {
            const [key, value] = pair.split(':');
            if (key && value !== undefined) {
                // it's a valid pair
                consents[key] = parseInt(value, 10);
            }
        });
        
        return consents;
    }
    #setLogStyle() {
        this.#logStyle = "color: #0c7";
    }
}

