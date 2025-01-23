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
    try {console.log("hello")
        const { email, mobile, password, mobileOtp} = request.body;

        // Determine identifier
        const identifier = email ? { email: email.toLowerCase().trim() } : { mobile };
        const maxAttempts = 5;
        const lockoutTime = 60 * 60 * 1000; // 1 hour in milliseconds

        // Check login attempts
        let loginAttempt = await LoginAttemptsModel.findOne(identifier);
        if (loginAttempt) {
            const timeSinceLastAttempt = Date.now() - loginAttempt.lastAttemptAt.getTime();

            // Reset attempts if lockout period has passed
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

        // Find user
        const userData = await UserModel.findOne({
            $or: [
                {
                    email: email ? email.toLowerCase().trim() : email,
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

        // Handle non-existent user
        if (!userData) {
            if (!loginAttempt) {
                loginAttempt = new LoginAttemptsModel({ ...identifier, attempts: 1 });
            } else {
                loginAttempt.attempts += 1;
                loginAttempt.lastAttemptAt = new Date();
            }
            await loginAttempt.save();

            throw CustomErrorHandler.wrongCredentials(mobile ? "Mobile not found!" : "Email not found!");
        }

        // Check user verification
        if (!userData.isMobileVerified) {
            throw CustomErrorHandler.unAuthorized("Mobile not verified!");
        }

        if (userData.role === "ADMIN") {
            throw CustomErrorHandler.unAuthorized();
        }

        // Validate password
        const checkPassword = await bcrypt.compare(password, userData.password);
        if (!checkPassword) {
            if (!loginAttempt) {
                loginAttempt = new LoginAttemptsModel({ ...identifier, attempts: 1 });
            } else {
                loginAttempt.attempts += 1;
                loginAttempt.lastAttemptAt = new Date();
            }
            await loginAttempt.save();

            throw CustomErrorHandler.wrongCredentials("Wrong Password!");
        }

        if(userData.mobileOtp == null){
            const otp = generateOtp()

            await utils.sendOtpOnMobile(userData.mobile, otp)
            userData.mobileOtp = otp;
            userData.otpTime = new Date();
            await userData.save();

            return response.json({
                status: true,
                message: "Otp send on mobile",
                data: '',
            });
        }

        if (userData.mobileOtp !== mobileOtp) {
            return response.status(400).json({
                status: false,
                message: "Invalid OTP.",
            });
        }

        // Check OTP expiration (e.g., valid for 10 minutes)
        const otpExpiryTime = 10 * 60 * 1000; // 10 minutes in milliseconds
        const timeElapsed = Date.now() - new Date(userData.otpTime).getTime();

        if (timeElapsed > otpExpiryTime) {
            return response.status(400).json({
                status: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }

        userData.mobileOtp = null; // Clear the OTP after successful verification
        userData.otpTime = null; // Clear the OTP timestamp
  
        // Successful login: reset login attempts
        if (loginAttempt) {
            await LoginAttemptsModel.deleteOne(identifier);
        }

        // Update user login timestamp
        userData.lastLogin = Math.floor(Date.now() / 1000);
        await userData.save();

        // Sanitize user data for the response
        const sanitizedUserData = { ...userData.toObject() };
        delete sanitizedUserData.password;

        // Generate JWT token
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

function generateOtp() {
    const otp = Math.floor(100000 + Math.random() * 900000); // Generates a random 6-digit number
    return otp.toString(); // Convert to string if needed
}

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

        const otp = generateOtp()

        userData.mobileOtp = otp;
        userData.otpTime = new Date();
        await userData.save();

        const message = isTelegram == "true" ? "Otp send on telegram": "Otp send on mobile";
        
        if (isTelegram == "true") {
            await utils.sendOtpOnTelegram(mobile, otp);
        } else {
            await utils.sendOtpOnMobile(mobile, otp);
        }

        return response.status(200).json({
            status: true,
            message,
            data: "",
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};


module.exports.verifyOtp = async (request, response) => {
    try {
        const { mobile, otp } = request.body;

        // Find user
        const userData = await UserModel.findOne({
            mobile: mobile,
            isDeleted: false,
        });

        if (!userData) {
            throw CustomErrorHandler.wrongCredentials("Mobile not found!");
        }

        // Check if OTP matches
        if (userData.mobileOtp !== otp) {
            return response.status(400).json({
                status: false,
                message: "Invalid OTP.",
            });
        }

        // Check OTP expiration (e.g., valid for 10 minutes)
        const otpExpiryTime = 10 * 60 * 1000; // 10 minutes in milliseconds
        const timeElapsed = Date.now() - new Date(userData.otpTime).getTime();

        if (timeElapsed > otpExpiryTime) {
            return response.status(400).json({
                status: false,
                message: "OTP has expired. Please request a new OTP.",
            });
        }

        // Mark mobile as verified
        userData.isMobileVerified = true;
        userData.mobileOtp = null; // Clear the OTP after successful verification
        userData.otpTime = null; // Clear the OTP timestamp
        await userData.save();

        return response.status(200).json({
            status: true,
            message: "Mobile verified successfully.",
            data: "",
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};

// only for admin
module.exports.checkUserList = async (request, response) => {
    try {
        const { user } = request.body;

        const userData = await UserModel.findOne({
            _id: user._id,
            role: "ADMIN", // Role based access
            isDeleted: false
        })
        if(!userData) throw CustomErrorHandler.unAuthorized("Access Denied!");
        
        const userList = await UserModel.find({});

        return response.status(200).json({
            status: true,
            message: "User list.",
            data: userList,
        });
    } catch (e) {
        handleErrorResponse(e, response);
    }
};
