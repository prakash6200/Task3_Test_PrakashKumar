const jwt = require("jsonwebtoken");
const config = require("./../config/config");

module.exports.verifyJWTToken = (request, response, next) => {
    try {
        const token = request.headers.authorization;
        if (!token) {
            return response
                .status(403)
                .json({
                    status: false,
                    message: "Invalid token or expired!",
                    data: null,
                });
        } else {
            jwt.verify(token, config.JWT_AUTH_TOKEN, async (err, result) => {
                if (err) {
                    return response
                        .status(401)
                        .json({
                            status: false,
                            message: "You are Not Authorize",
                            data: null,
                        });
                } else {
                    if (result) {
                        request.body.user = result;
                        return next();
                    } else {
                        return response
                            .status(401)
                            .json({
                                status: false,
                                message: "Invalid token or expired!",
                                data: null,
                            });
                    }
                }
            });
        }
    } catch (e) {
        return response
            .status(500)
            .json({
                status: false,
                message: "Invalid token or expired!",
                data: null,
            });
    }
};

module.exports.verifyJWTTokenSocket = (io) => {
    io.use((socket, next) => {
        try {
            let token = socket.handshake.headers.authorization;
            console.log("Hello", token)
            if (!token) {
                socket.disconnect();
                return next(new Error("Invalid token or expired!"));
            } else {
                jwt.verify(token, config.JWT_AUTH_TOKEN, async (err, result) => {
                    if (err) {
                    socket.disconnect();
                    return next(new Error("You are not authorized"));
                    } else {
                    if (result) {
                        // Assign the updated payload to the request body
                        // socket.user = result;
                        UserModel.findOne({
                        _id: result._id,
                        })
                        .then((u) => {
                            if (!u) {
                            return next(new Error("Invalid token was provided"));
                            } else {
                            socket.user = u;
                            next();
                            }
                        })
                        .catch((e) => {
                            return next(new Error("Invalid token was provided"));
                        });
                        // return next();
                    } else {
                        socket.disconnect();
                        return next(new Error("Invalid token or expired!"));
                    }
                    }
                });
            }
        } catch (error) {
            console.log("error in socket auth:", error);
            socket.disconnect();
            return next(new Error(error));
        }
    });
};
