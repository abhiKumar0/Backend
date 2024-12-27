import { AsyncHandler as asyncHandler } from "../utils/AsyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = async (req, res) => {
  
  //Retrieving data from req.body
  const {fullName, email, username, password} = req.body;
  
  
  //Validation of input
  if ([fullName, email, username, password].some((field) => field.trim === "")) {
      throw new ApiError(400, "All fields are required");
  }

  //Check if the user already exist
  const existedUser = User.find({
    //Operator to check if any exist for multiple unique ids
    $or: [ { username }, { email } ]
  })

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //Managing file or Retrieving file path from multer
  const avatarPath = req.files?.avatar[0].path;
  const coverImagePath = req.files?.coverImage[0].path;

  //Validation
  if (!avatarPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //Uploading to cloudinary
  const avatar = await uploadOnCloudinary(avatarPath);
  const coverImage = await uploadOnCloudinary(coverImagePath);

  if (!avatar) {
    throw new ApiError(400, "Avatar to upload image");
  }
  
  //Creating user
  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res.status(200).json(
    new ApiResponse(200, createdUser, "User registered successfully")
  )

}


export {
  registerUser,
}