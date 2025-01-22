const config = require("../config/config");
// const client = require("twilio")(
//     config.TWILIO_ACCOUNT_SID,
//     config.TWILIO_AUTH_TOKEN,
// );

module.exports.sendOtpOnMobile = async (mobile) => {
    try {
        await client.verify.v2
            .services(config.TWILIO_SERVICE_ID)
            .verifications.create({ to: `+91${mobile}`, channel: "sms" });
        return true;
    } catch (err) {
        return false;
    }
};

module.exports.sendOtpOnEmail = async (email) => {
    try {
        await client.verify.v2
            .services(config.TWILIO_SERVICE_ID)
            .verifications.create({ to: email, channel: "email" });
        return true;
    } catch {
        return false;
    }
};

module.exports.verifyMobileOtp = async(mobile, otp) => {
    try {
        await client.verify.v2
            .services(config.TWILIO_SERVICE_ID)
            .verificationChecks.create({ to: `+91${mobile}`, code: otp });
        return true;
    } catch(e) {
        return false;
    }
};

module.exports.verifyEmailOtp = async(email, otp) => {
    try {
        await client.verify.v2
            .services(config.TWILIO_SERVICE_ID)
            .verificationChecks.create({ to: email, code: otp });
        return true;
    } catch(e) {
        return false;
    }
};