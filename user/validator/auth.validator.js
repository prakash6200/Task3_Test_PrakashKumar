const Joi = require("joi");

module.exports.signUp = async (request, response, next) => {
    const rules = Joi.object({
        name: Joi.string().min(3).max(40).required(),
        email: Joi.string().email().required(),
        mobile: Joi.string().required(),
        // mobile: Joi.string().length(10).pattern(/^[6-9]\d{9}$/).required(),
        password: Joi.string().required(),
        cnfPassword: Joi.string().required(),
        referral: Joi.string(),
        isWhatsapp: Joi.boolean(),
        isTelegram: Joi.boolean(),
        dob: Joi.date().required(),
    });
    
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};

module.exports.login = async (request, response, next) => {
    const rules = Joi.object().keys({
        email: Joi.string().email(),
        mobile: Joi.string(),
        mobileOtp: Joi.string(),
        password: Joi.string().required(),
    }).or('email', 'mobile');
    const { error } = rules.validate(request.body);

    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    }
    return next();
};

module.exports.sendOtp = async (request, response, next) => {
    const rules = Joi.object().keys({
        mobile: Joi.string().required(),
        isTelegram: Joi.boolean().required()
    }).or('email', 'mobile');
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};

module.exports.verifyOtp = async (request, response, next) => {
    const rules = Joi.object().keys({
        email: Joi.string().email(),
        mobile: Joi.string(),
        otp: Joi.number().required(),
    }).or('email', 'mobile');
    const { error } = rules.validate(request.body);
    if (error) {
        return response
            .status(422)
            .json({ status: false, message: error.message, data: null });
    } else {
        return next();
    }
};
