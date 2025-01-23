
module.exports.sendOtpOnMobile = async (mobile, otp) => {
    try {
        console.log(`Otp send on mobile ${mobile} and otp is ${otp}`);
        
        // Implement api for send mobile otp
        return true;
    } catch (err) {
        return false;
    }
};

module.exports.sendOtpOnTelegram = async (mobile, otp) => {
    try {
        console.log(`Otp send on mobile ${mobile} and otp is ${otp}`);

        // Implement the telegram api to send otp
        return true;
    } catch (err) {
        return false;
    }
};