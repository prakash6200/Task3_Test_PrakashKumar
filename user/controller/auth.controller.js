const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const utils = require("../../utils/otp");
const config = require("../../config/config");
const UserModel = require("../../models/users.model");
const LoginAttemptsModel = require("../../models/loginAttempts.model");
const { generateRandomString } = require("../../helpers");
const { handleErrorResponse, CustomErrorHandler } = require("../../middleware/CustomErrorHandler");


async function getUniqueUserReferralCode(referral) {
    return new Promise(async (resolve) => {
        const ref = referral ? referral : generateRandomString(8);

        referralExists = await UserModel.findOne({
            referralCode: ref,
        });

        if (!referralExists) {
            resolve(ref);
        } else {
            await getUniqueUserReferralCode(generateRandomString(8));
        }
    });
}

module.exports.referralInfo = async (request, response) => {
    try {
        const { referralCode } = request.query;

        userData = await UserModel.findOne({
            referralCode,
        });
        if(!userData) throw CustomErrorHandler.notFound("Enter a valid referral Code!");

        return response.status(200).json({
            status: true,
            message: "Referral Code Details.",
            data: { email: userData.email, name: userData.name }
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

module.exports.signUp = async (request, response) => {
    try {
        const { referral, name, email, mobile, password, cnfPassword, dob, isWhatsapp, isTelegram } = request.body;
   
        const checkEmail = await UserModel.findOne({
            email: email.toLowerCase().trim(),
        });
        if(checkEmail) throw CustomErrorHandler.alreadyExist("Your Email Is Already Registered!");


        const checkMobile = await UserModel.findOne({
            mobile: mobile.trim(),
        });
        if (checkMobile) throw CustomErrorHandler.alreadyExist("Your Mobile Is Already Registered!");

        let checkReferral = false;
        if (referral) {
            checkReferral = await UserModel.findOne({
                referralCode: referral.trim(),
                isDeleted: false,
            });
            // if(checkReferral && !checkReferral.isReferralAllowed){
            //     throw CustomErrorHandler.notAllowed("Referral Not allowed!, Please Stake!");
            // }
            if (!checkReferral){
                throw CustomErrorHandler.alreadyExist("Please Enter a Valid Referral Code!");
            }
        };

        if (password !== cnfPassword) {
            throw CustomErrorHandler.wrongCredentials("Confirm password not match!");
        };

        //GENERATING PASSWORD
        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(password, passwordSalt);

        const referralCode = await getUniqueUserReferralCode();

        //CREATING USER IN MONGODB
        const newUsers = await UserModel.create({
            userName: referralCode.trim(),
            name: name.trim(),
            referralCode: referralCode.trim(),
            email: email.toLowerCase().trim(),
            mobile: mobile,
            password: passwordHash,
            dob: dob,
            // isMobileVerified: true,
            fromUser: checkReferral && checkReferral._id ? checkReferral._id : null,
            isWhatsapp,
            isTelegram
        });

        //jwt tokens
        // const token = jwt.sign(JSON.stringify(newUsers), config.JWT_AUTH_TOKEN);

        delete newUsers.password;
        // const sendData = { userData: newUsers, token: token };
        const sendData = { userData: newUsers };

        try {
            await utils.sendOtpOnMobile(mobile);
            await utils.sendOtpOnEmail(email.toLowerCase().trim());
        } catch {
            console.log("Failed to send OTP!");
        };

        return response.status(200).json({
            status: true,
            message: "Register successfully.",
            data: sendData,
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

module.exports.login = async (request, response) => {
    try {
        const { email, mobile, password } = request.body;

        const identifier = email ? { email: email.toLowerCase().trim() } : { mobile };
        const maxAttempts = 5;
        const lockoutTime = 60 * 60 * 1000; // 1 hour in milliseconds

        let loginAttempt = await LoginAttemptsModel.findOne(identifier);
        if (loginAttempt) {
            const timeSinceLastAttempt = Date.now() - loginAttempt.lastAttemptAt.getTime();

            // Reset attempts if the lockout period has passed
            if (timeSinceLastAttempt > lockoutTime) {
                loginAttempt.attempts = 0;
                loginAttempt.lastAttemptAt = new Date();
                await loginAttempt.save();
            } else if (loginAttempt.attempts >= maxAttempts) {
                return response.status(429).json({
                    status: false,
                    message: `Too many login attempts. Please try again in ${Math.ceil(
                        (lockoutTime - timeSinceLastAttempt) / (60 * 1000)
                    )} minutes.`,
                });
            }
        }

        const userData = await UserModel.findOne({
            $or: [
                { 
                    email: email?email.toLowerCase().trim():email, 
                    role: "USER",
                    isDeleted: false, 
                },
                { 
                    mobile: mobile, 
                    role: "USER",
                    isDeleted: false, 
                }
            ]
        }).select("+password");

        if (!userData) {
            if (!loginAttempt) {
                loginAttempt = new LoginAttempt({ ...identifier, attempts: 1 });
            } else {
                loginAttempt.attempts += 1;
                loginAttempt.lastAttemptAt = new Date();
            }
            await loginAttempt.save();

            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        }

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };

        if (!userData.isMobileVerified) {
            throw CustomErrorHandler.unAuthorized("Mobile not verified!");
        };

        if (userData.role === "ADMIN") {
            throw CustomErrorHandler.unAuthorized();
        };

        const checkPassword = await bcrypt.compare(password, userData.password);
        if (!checkPassword) {
            throw CustomErrorHandler.wrongCredentials("Wrong Password!");
        };

        userData.lastLogin = Math.floor(Date.now() / 1000);
        await userData.save();

        const sanitizedUserData = { ...userData.toObject() };
        delete sanitizedUserData.profileImage;
        delete sanitizedUserData.password;

        const token = jwt.sign(JSON.stringify(sanitizedUserData), config.JWT_AUTH_TOKEN);

        return response.json({
            status: true,
            message: "Login success.",
            data: { sendData: { ...userData.toObject(), password: undefined }, token },
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// Send Otp for Verify Email or Mobile
module.exports.sendOtp = async (request, response) => {
    try {
        const { mobile, isTelegram } = request.body;

        const userData = await UserModel.findOne({
            mobile,
            isDeleted: false,
        })

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Mobile not found!");
        };

        const message = isTelegram == "true" ? "Otp send on telegram": "Otp send on mobile";
        // await utils.sendOtpOnMobile(userData.mobile);

        return response.status(200).json({
            status: true,
            message,
            data: "",
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// Verify Email or Password
module.exports.verifyOtp = async (request, response) => {
    try {
        const { mobile, email, otp } = request.body;

        const userData = await UserModel.findOne({
            $or: [
                { 
                    email: email?email.toLowerCase().trim():email, 
                    isDeleted: false, 
                },
                { 
                    mobile: mobile, 
                    isDeleted: false, 
                }
            ]
        });
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };

        let res;
        if (mobile) {
            res = await utils.verifyMobileOtp(userData.mobile, otp);
        } else {
            res = await utils.verifyEmailOtp(userData.email, otp);
        };
        if(!res) throw CustomErrorHandler.notAllowed(mobile ? "Failed to verify Mobile otp!" : "Failed to verify Email otp!");

        if(mobile){
            userData.isMobileVerified = true;
        } else {
            userData.isEmailVerified = true;
        };
        await userData.save();

        return response.status(200).json({
            status: res,
            message: mobile?"Mobile Verified.":"Email Verified.",
            data: "",
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

module.exports.changePassword = async (request, response) => {
    try {
        const { user, oldPassword, newPassword, cnfPassword } = request.body;
        console.log(user)
        const userData = await UserModel.findOne({
            _id: user._id,
            isDeleted: false
        }).select("+password");
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        if(newPassword !== cnfPassword){
            throw CustomErrorHandler.unAuthorized("Not Match Confirm Password!");
        }

        const checkPassword = await bcrypt.compare(oldPassword, userData.password);
        if(!checkPassword) throw CustomErrorHandler.wrongCredentials("Not Match Current Password!");

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);
        
        userData.password = passwordHash;
        await userData.save()

        return response.status(200).json({
            status: true,
            message: "Password Changed.",
            data: "",
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

module.exports.forgetPasswordVerifyOtp = async (request, response) => {
    try {
        const { mobile, email, otp } = request.body;

        const userData = await UserModel.findOne({
            $or: [
                { 
                    email: email?email.toLowerCase().trim():email, 
                    isDeleted: false, 
                },
                { 
                    mobile: mobile, 
                    isDeleted: false, 
                }
            ]
        });
        if (!userData) {
            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        };

        let res;
        if (mobile) {
            res = await utils.verifyMobileOtp(userData.mobile, otp);
        } else {
            res = await utils.verifyEmailOtp(userData.email, otp);
        };
        if(!res) throw CustomErrorHandler.notAllowed(mobile ? "Failed to verify Mobile otp!" : "Failed to verify Email otp!");
        
        const sanitizedUserData = { ...userData.toObject() };
        delete sanitizedUserData.profileImage;
        delete sanitizedUserData.password;

        const token = jwt.sign(JSON.stringify(sanitizedUserData), config.JWT_AUTH_TOKEN);

        return response.json({
            status: true,
            message: "Use this Token for Reset Password.",
            data: token,
        });  
    } catch (e) {
        handleErrorResponse(e, response);
    };
};

module.exports.resetPassword = async (request, response) => {
    try {
        const { user, newPassword, cnfPassword } = request.body;
        
        const userData = await UserModel.findOne({
            _id: user._id,
            isDeleted: false,
        });
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");

        if(newPassword !== cnfPassword){
            throw CustomErrorHandler.unAuthorized("Not Match Confirm Password!");
        };

        const passwordSalt = await bcrypt.genSalt(config.SALT_ROUND);
        const passwordHash = await bcrypt.hash(newPassword, passwordSalt);
        userData.password = passwordHash;
        userData.save();
        
        return response.status(200).json({
            status: true,
            message: "Success Reset Password.",
            data: "",
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};