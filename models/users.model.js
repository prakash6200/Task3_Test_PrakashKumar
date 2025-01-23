const mongoose = require("mongoose");
const { Schema } = mongoose;
const mongoosePaginate = require("mongoose-paginate-v2");

const User = new Schema(
    {
        userName: {
            type: String,
        },
        referralCode: {
            type: String,
            default: null,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 255,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        mobile: {
            type: String,
            required: true,
            unique: true,
        },
        fromUser: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        role: {
            type: String,
            enum: ["USER", "ADMIN"],
            default: "USER",
        },
        password: {
            type: String,
            select: false,
        },
        dob: {
            type: Date,
            required: true,
        },
        isMobileVerified: {
            type: Boolean,
            default: false,
        },
        isWhatsapp: {
            type: Boolean,
            default: false,
        },
        isTelegram: {
            type: Boolean,
            default: false,
        },
        mobileOtp: {
            type: String,
        },
        otpTime: {
            type: Date
        },
        lastLogin: {
            type: Number,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    },
);

User.index({ email: 1, mobile: 1 }, { unique: true });

User.plugin(mongoosePaginate);
module.exports = mongoose.models.User || mongoose.model("User", User);
