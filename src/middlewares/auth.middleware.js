import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { AsyncHandler } from "../utils/AsyncHandler.js";
import jwt from "jsonwebtoken"

export const verifyJWT = AsyncHandler(async(req, res, next) => {
  try {
    const token = req.cookie?.accessToken || req.header("Authorization").replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorize");
    }


    //Decoding token
    const decodedToken = jwt.verify(token, process.env.ACCESS_SECRET_KEY);

    //User with id from decoded token
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }

    //Adding user in req
    req.user = user;
    next();


  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token")
  }
})