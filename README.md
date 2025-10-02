ConsentPass

ConsentPass is a singleton JavaScript class that manages the execution of callbacks (tags) based on user consent. Callbacks can be executed immediately if consent is granted or queued to run when consent is later accepted.

Features

Singleton: only one instance is created, avoiding duplicate queues

Consent types supported: STRICTLY_NECESSARY, FUNCTIONAL, PERFORMANCE, TARGETING

Callbacks can be queued for later execution on consent acceptance

Automatic refresh and parsing of OneTrust consent cookies

Optional data layer integration

Usage

Create or reference the singleton instance:
wa.consentPass = new wa.ConsentPass();

Execute a callback with a specific consent type:
wa.consentPass.runWithConsent('STRICTLY_NECESSARY', function() {
// code to run when consent is granted
});

Optionally, set a custom data layer:
wa.consentPass.setDataLayer(window.utag_data);

Available methods

runWithConsent(type, callback): executes or queues a callback based on consent

getConsents(): returns an object with current consent values

getConsent(type): returns true/false if a specific consent type is accepted

getConsentByCode(code): returns true/false for a consent code

getConsentTypes(): returns an array of all consent types

getConsentCodes(): returns an array of all consent codes

getConsentTypeByCode(code): returns the consent type for a given code

getConsentCodeByType(type): returns the consent code for a given type

fetchConsents(): reads consents directly from the OneTrust cookie

License
MIT License.
