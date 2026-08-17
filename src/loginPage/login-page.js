import { InputPlus } from "./input-plus.js";
import { ShadowElement, SvgPlus, delay} from "../Utilities/utils.js";
import { addAuthChangeListener, callFunction, forceAuthStateChange, getUser, GoogleAuthProvider, linkWithCredential, OAuthProvider, signInWithCustomToken, signInWithPopup, signOut } from "../Firebase/firebase.js";
import { Debugger } from "../shared.js";

const DEBUG = new Debugger("login-page", "color: white; background: rgb(203, 14, 89); padding: 5px; border-radius: 5px;");

const OTP_RESEND_INTERVAL = 120; // seconds
const ForceSignInWithMicrosoftEmails = [
    "cerebralpalsy.org.au"
]

let AUTH_RESOLVER = null;
addAuthChangeListener((user) => {
    if (AUTH_RESOLVER) {
        AUTH_RESOLVER(user);
        AUTH_RESOLVER = null;
    }
});

function waitForAuthChange(timeout = 60000) {
    return Promise.race([
        new Promise(resolve => {
            AUTH_RESOLVER = resolve;
        }),
        delay(timeout).then(() => { return null})
    ]);
}

let credential = null;
function retrievePendingCred() {
    return credential;
}

function savePendingCred(pendingCred) {
    credential = pendingCred;
    // localStorage.setItem("pendingCred", JSON.stringify(pendingCred));
}

/**
 * Requests an OTP for the given email. If the email is new, returns isNewUser = true.
 * In this case, the user should be prompted to create an account.
 * If an error occurs, then the error string is returned.
 * 
 * @param {string} email 
 * @returns {Promise<[boolean, string]>} isNewUser, error
 */
async function requestOTP(email) {
    let res = (await callFunction("otp-getOTP", {email} ));
    res = res ? res.data : {};
    let isNewUser = false;
    let error = null
    if (res.errors && res.errors.length > 0){
        error = res.errors[0];
        let isToSoon = error.startsWith("OTP");
        isNewUser = error.startsWith("NewUser");
        if (!isToSoon && !isNewUser) {
            error = "opt-FF: " + error
        } else {
            error = null;
        }
    }
    return [isNewUser, error];
}

/**
 * Verifies the given OTP for the given email. If successful, signs in the user.
 * If an error occurs, then the error string is returned.
 * 
 * @param {string} email
 * @param {string} otp
 * @returns {Promise<string>} error
 */
async function verifyOTP(email, otp) {
    // Call firebase function to verify OTP and get custom token
    let res = (await callFunction("otp-checkOTP", {email, otp} )).data;
    
    let error = null
    // If the results from the function contains errors
    if (res.errors && res.errors.length > 0){
        // return the first error
        error = res.errors[0];
    } else {
        try {
            // Sign in with the custom token from the function result
            let result = await signInWithCustomToken(res.token);

            // If there is a pending credential from a provider sign in, link it to the user's account
            let cred = retrievePendingCred();
            if (cred) {
                try {
                    await linkWithCredential(result.user, cred);
                } catch (e) {
                    DEBUG.log("VerifyOTP", "Error linking credential", e);
                }
            }

        // Catch any errors that occur during sign in or linking and return them
        } catch (e) {
            error = "sign in with token + link: " + e.message;
        }
    }
    return error
}

/**
 * Creates an account with the given email, first name, and last name.
 * If an error occurs, then the error string is returned.
 * 
 * @param {string} email
 * @param {string} firstName
 * @param {string} lastName
 * @returns {Promise<string>} error
 */
async function createAccountWithOTP(email, firstName, lastName) {
    let res = (await callFunction("otp-createAccountWithOTP", {
        email,
        firstName,
        lastName
    })).data;
    let error = null
    if (res.errors && res.errors.length > 0){
        error = "otp-FF: "+res.errors[0];
    }
    return error
}

/**
 * Verify specified email.
 * 
 */
async function forceEmailVerification(email) {
    let res = (await callFunction("otp-verifyEmail")).data

    let error = null
    if (res.errors && res.errors.length > 0){
        error = "otp-FF: "+res.errors[0];
    }
    return error
}
function checkEmailIsFromDomain(email, domain) {
    if (typeof email !== "string" || typeof domain !== "string") return false;

    const e = email.trim().toLowerCase().replace(/\.+$/, "");
    const d = domain.trim().toLowerCase().replace(/^\@+/, "").replace(/\.+$/, "");

    return e.endsWith(d)
}
function isEmailFromDomains(email, domains) {
    return domains.some(domain => checkEmailIsFromDomain(email, domain));
}

class TandC extends SvgPlus {
    constructor() {
        super("div");
        this.class = "terms";
        this.content = `<a target="_blank" href ="https://policies.squidly.com.au/terms-of-use/" >Terms of Service</a> and <a target="_blank" href = "https://policies.squidly.com.au/privacy/" >Privacy Policy</a>.`
    }
}

class SignInContainer extends SvgPlus {
    constructor(root) {
        super("div");
        this.class = "form-container sign-in";
        this.createChild("h1", {content: "Sign in"});
        const col = this.createChild("div", {class: "col"});
        this.email = col.createChild(InputPlus, {
            name: "email",
            type: "email",
            label: "Email",
            autocomplete: "off",
            required: true
        }).build();
        
        col.createChild("button", {
            content: "Continue", 
            class: "btn", 
            events: {click: () => root.signInWithOTP()}
        });

        const col2 = this.createChild("div", {class: "col"});
        col2.createChild("div", {class: "ctext", content: "or"});
        col2.createChild("button", {
            content: "Continue with Google", 
            class: "with-btn google", 
            events: {click: () => root.signInWithGoogle()},
            name: "googleSignIn"
        });
        col2.createChild("button", {
            content: "Continue with Microsoft", 
            class: "with-btn microsoft", 
            events: {click: () => root.signInWithMicrosoft()},
            name: "appleSignIn"
        });

        this.createChild(TandC);
    }
}
class SignUpContainer extends SvgPlus {
    constructor(root) {
        super("div");
        this.class = "form-container sign-up hide";
        this.createChild("h1", {content: "Create an account"});
        this.createChild("div", {
            class: "ctext",
            content: "Looks like this is your first time signing into Squidly. Please tell us your name so we can get started."
        });
        const col = this.createChild("div", {class: "col"});
        const row = col.createChild("div", {class: "row"});
        this.inputs = {};
        this.inputs.firstName = row.createChild(InputPlus, {
            name: "firstName",
            type: "text",                        
            label: "First name",
            autocomplete: "off",
            required: true
        }).build()
        this.inputs.lastName = row.createChild(InputPlus, {
            name: "lastName",
            type: "text",
            label: "Last name",
            autocomplete: "off",
            required: true
        }).build();    

        this.createChild("button", {
            content: "Get started", 
            class: "btn", 
            events: {click: () => root.createAccountWithOTP()}
        });

        this.createChild(TandC)  
    }
}
class OTPVerifyContainer extends SvgPlus {
    constructor(root) {
        super("div");
        this.class = "form-container otp-verify hide";
        this.createChild("h1", {content: "Please verify your identity"});
        this.createChild("span", {content: "Please enter the code sent to your email."});
        const col = this.createChild("div", {class: "col"});
        this.otpInput = col.createChild(InputPlus, {
            name: "otpInput",
            type: "otp",
            label: "One-time password",
            autocomplete: "off",
            required: true,
            length: 6,
        }).build();

        col.createChild("button", {
            content: "Verify", 
            class: "btn", 
            events: {click: () => root.verifyOTP()}
        });

        const resend = this.createChild("div", {class: "otp-resend"});
        resend.createChild("span", {class: "ctext", content: "Resend code in "});
        this.resendTimeEl = resend.createChild("span", {name: "otpResend", class: "ctext"});

        const resendCode = this.createChild("div", {class: "otp-resend-code"});
        resendCode.createChild("span", {class: "ctext", content: "Didn't receive the email? "});
        resendCode.createChild("span", {
            class: "btn-text",
            content: "Resend code.",
            events: {click: () => root.requestOTP()}
         });
    }
}


class LoginPage extends ShadowElement {
    #mode = null;

    constructor(el) {
        super(el, "div");
        this.root.class = "login-page";
        this.#build();
        this.mode = "signIn"
    }

    #build() {
        const c = this.createChild("div", {class: "container"});
        this.signIn = c.createChild(SignInContainer, {}, this);
        this.signUp = c.createChild(SignUpContainer, {}, this);
        this.vOTP = c.createChild(OTPVerifyContainer, {}, this);
        this.overlay = this.createChild("div", {class: "overlay"});
        this.overlayTextEl = this.overlay.createChild("div", {class: "ctext", name: "overlayText"});
        const loader = this.overlay.createChild("div", {class: "simple-loader", content: `<b></b><b></b><b></b>`});
    }

    set overlayText(text) {
        this.overlayTextEl.innerHTML = text;
    }
    set loading(value) {
        this.root.toggleAttribute("loading", value);
        if (!value) this.overlayText = "";
    }
    
    set mode(mode) {
        if (this.mode !== mode) {
            this.#mode = mode;
            this.vOTP.otpInput.value = "";
            this.signUp.inputs.firstName.value = "";
            this.signUp.inputs.lastName.value = "";
            if (mode === "signIn") {
                credential = null;
                this.signIn.email.value = "";
            }
            ["vOTP", "signIn", "signUp"].forEach(m => {
                this[m].classList.toggle("hide", mode !== m)
            })
        }
    }
    get mode() {
        return this.#mode;
    }
    set email(email) {
        this.signIn.email.value = email;
    }
    get email() {
        return this.signIn.email.value;
    }
    
  
    showOverlayError(error, action, actionpast) {
    }
    
    resetOTPCountDown() {
        const otpResend = this.vOTP.resendTimeEl
        this.vOTP.toggleAttribute("count-down", true);
        otpResend.innerText = `${Math.ceil(OTP_RESEND_INTERVAL / 60)}  minutes`;
        if (this.otpInterval) {
            clearInterval(this.otpInterval);
        }

        let time = OTP_RESEND_INTERVAL;
        this.otpInterval = setInterval(() => {
            if (time > 1) {
                time--;
                
                otpResend.innerText = time > 60 ? `${Math.ceil(time / 60)} minutes` : `${time}s`;
            } else {
                clearInterval(this.otpInterval);
                this.vOTP.toggleAttribute("count-down", false);
            }
        }, 1000);
    }

    async verifyOTP() {
        this.loading = true;
        // Validate the OTP input
        if (this.vOTP.otpInput.validate()) {

            // Get the OTP value from the input and call the verifyOTP function
            let otp = this.vOTP.otpInput.value;
            let error = await verifyOTP(this.email, otp);

            let hide = true;
            if (error) {
                // If there was an error verifying the OTP, show it on the overlay
                if (error.startsWith("OPT:")) {
                    // this.els.otpError.innerText = error.replace("OPT:", "").trim();
                } else {
                    this.showOverlayError(error, "verifying your code", "verify my code");
                    hide = false;
                }
            } else {
                // If the users email is not verified, force a refresh of 
                // the auth state to update the emailVerified property
                if (getUser().emailVerified === false) { 
                    await Promise.all([
                        forceAuthStateChange(),
                        waitForAuthChange(10000)
                    ])
                }
            }
        
            if (hide) this.loading = false;
        } else {
            // this.els.otpError.innerText = "Invalid code";
            this.loading = false;
        }
    }
    
    async requestOTP(email = this.signIn.email.value) {
        DEBUG.logStart("requestOTP", `Requesting OTP for email: ${email}`)
        if (isEmailFromDomains(email, ForceSignInWithMicrosoftEmails)) {
            DEBUG.logBasic("Forcing sign in with Microsoft for email")
            await this.signInWithMicrosoft();
        } else {
            this.loading = true;
            this.overlayText = `Sending verification code`;
            let [isNewUser, error] = await requestOTP(email);
            DEBUG.logBasic(`Is new user: ${isNewUser}, error: ${error}`)
            if (isNewUser) {
                this.mode = "signUp";
                this.loading = false;
            } else if (error) {
                switch (error) {
                    case "opt-FF: Email domain is not allowed.":
                        this.overlayText = "";
                        this.signInWithMicrosoft();
                        break;
    
                    default:
                        this.showOverlayError(error, "requesting a verification code", "request a verification code");
                        break;
                }
            } else {
                this.resetOTPCountDown();
                this.mode = "vOTP";
                this.loading = false;
            }
        }
        DEBUG.logEnd();
    } 
    
    async createAccountWithOTP() {
        let {firstName, lastName} = this.signUp.inputs;
        if (firstName.validate() && lastName.validate()) {
            this.loading = true;
            this.overlayText = `Creating account...`;
            let error = await createAccountWithOTP(this.email, firstName.value, lastName.value);
            if (error){
                this.showOverlayError(error, "creating your account", "create an account using email");
            } else {
                this.resetOTPCountDown();
                this.mode = "vOTP";
                this.loading = false;
            }
        }
    }

    async signInWithOTP() {
        const email = this.signIn.email;
        if (email.validate()) {
            await this.requestOTP(email.value);
        }
    }

    async signInWithGoogle(){
        let provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: "select_account"   // tells Microsoft to always show account chooser
        });
        await this.signInWithProvider(provider, "Google");
    }

    async signInWithMicrosoft(){
        let provider = new OAuthProvider('microsoft.com');
        provider.setCustomParameters({
            prompt: "select_account"   // tells Microsoft to always show account chooser
        });
        await this.signInWithProvider(provider, "Microsoft");
    }

    async signInWithProvider(p, pname = "provider") {
        this.overlayText = "";
        this.loading = true;

        let providerError = null;
        let res;
        let userEmail;
        try {
            DEBUG.log("Provider sign in", "Attempting to sign in with provider: ", pname)
            res = await signInWithPopup(p);
        } catch (error) {
            
            // Users email already exists with a different auth provider.
            if (error.code === "auth/account-exists-with-different-credential") {
                console.warn("User has signed in with a different provider.");

                // Save the credential they used to sign in
                const pendingCred = p.constructor.credentialFromError(error);
                savePendingCred(pendingCred);
                
                // Request the user to sign in with a one time password
                userEmail = error.customData.email;

                // If the email is from a domain that we force to sign in with Microsoft, 
                // show an error message instead of requesting OTP.
                if (isEmailFromDomains(userEmail, ForceSignInWithMicrosoftEmails)) {
                    providerError = `It looks like your ${pname} account is registered with a provider that is now blocked for your email.`;
                    console.warn(`It looks like your ${pname} account is registered with a provider that is now blocked for your email.`)
                // Otherwise, request OTP for the email so they can link their provider account to their existing account.
                } else {
                    this.email = userEmail;
                    await this.requestOTP(userEmail);
                }
            } else if (error.code === "auth/cancelled-popup-request" || error.code === "auth/popup-closed-by-user") {
                // User cancelled the sign in process.
                console.warn("User cancelled the popup.");
                providerError = true;
                this.loading = false;

            } else {
                // Some other error occurred.
                console.warn("Some unforseen sign in with provider error", error)
                providerError = error.message;
            }
        }

        // If there was an error with the provider sign in, show it on the overlay. 
        if (providerError && typeof error === "string") {
            this.showOverlayError(error, `signing you in with your ${pname}`, `sign in with my ${pname}`);

        // Otherwise, if sign in was successful, save the credential for later linking and hide the overlay.
        } else if (!providerError) {
            // If the users email is not verified and is from a domain that we force to sign in with Microsoft.
            savePendingCred(p.constructor.credentialFromResult(res));
            this.loading = !res.user.emailVerified;
        }
    }

    async onEmailNeedsVerification({email}) {
        DEBUG.logBasic("Email needs verification for email: ", email)
        if (isEmailFromDomains(email, ForceSignInWithMicrosoftEmails)) {
            this.loading = true;
            DEBUG.logBasic("Forcing email verification for email: ", email)
            let res = await forceEmailVerification(email);
            DEBUG.logBasic("force email verification result: ", res)
            if (res) {
                this.showOverlayError(res, "verifying your email", "verify my email");
            } else {
                await forceAuthStateChange();
            }
            this.loading = false;
        } else {
            this.email = email;
            await this.requestOTP(email);
        }
    }


    reset() {
        this.mode = "signIn";
    }

    static get usedStyleSheets() {
        return [
            import.meta.resolve("./login-page.css"),
            InputPlus.styleSheet,
            import.meta.resolve("./theme.css")
        ]
    }

    static define() {
        SvgPlus.defineHTMLElement(LoginPage);
    }
}
export {LoginPage}