const mongoose = require('mongoose');

const LoginAttemptSchema = new mongoose.Schema({
    email: { 
        type: String, 
        lowercase: true, 
        trim: true 
    },
    mobile: { 
        type: String 
    },
    attempts: { 
        type: Number, 
        default: 0 
    },
    lastAttemptAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('LoginAttempt', LoginAttemptSchema);
