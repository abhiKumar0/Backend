import { AsyncHandler} from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { OPTIONS } from "../constants.js";
import jwt, { decode } from "jsonwebtoken"

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;

    //Avoid validation
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went while generating access and refresh token"
    );
  }
};

const registerUser = AsyncHandler(async (req, res) => {
  //Retrieving data from req.body
  const { fullName, email, username, password } = req.body;


  //Validation of input
  if (
    [fullName, email, username, password].some((field) => field?.trim === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //Check if the user already exist
  const existedUser = await User.findOne({
    //Operator to check if any exist for multiple unique ids
    $or: [{ username }, { email }],
  });


  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  //Managing file or Retrieving file path from multer
  const avatarPath = req.files?.avatar[0]?.path;
  let coverImagePath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
    coverImagePath = req.files?.coverImage[0].path;
  }

  //Validation
  if (!avatarPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //Uploading to cloudinary
  console.log("Avatar", avatarPath)
  const avatar = await uploadOnCloudinary(avatarPath);
  console.log("Avatar af6yer", avatar)
  
  const coverImage = await uploadOnCloudinary(coverImagePath);


  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  //Creating user
  const user = await User.create({
    fullName,
    email,
    password,
    username: username.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = AsyncHandler(async (req, res) => {
  //data from req.body
  //username or email
  //find the user
  //password check
  //generate access and refresh token
  //send cookie

  const { email, username, password } = req.body;

  //Validation
  if (!username || !email) {
    throw new ApiError(400, "username or email is required");
  }

  //Find the user
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User doesn't exists");
  }

  const isPasswordValid = await user.matchPassword(user._id);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid Credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessTokenAndRefreshToken();

  //select ignores fields that are passed
  const loggedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );


  return res
    .status(200)
    .cookie("accessToken", accessToken, OPTIONS)
    .cookie("refreshToken", refreshToken, OPTIONS)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = AsyncHandler( async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1 //remove this field from document
      }
    },
    {
      new: true
    }
  )


  return res.status(200)
  .clearCookie("accessToken", accessToken, OPTIONS)
  .clearCookie("refreshToken", refreshToken, OPTIONS)
  .json(new ApiResponse(200, {}, "User logged out"))
})

const refreshAccessToken = AsyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorize request");
  }

  try {
    const decodedToken = await jwt.verify(incomingRefreshToken, process.env.REFRESH_SECRET_KEY);

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const {accessToken, refreshToken} =  await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, OPTIONS)
      .cookie("refreshToken", refreshToken, OPTIONS)
      .json(
        new ApiResponse(
          200,
          {accessToken, refreshToken},
          "Access token refreshed"
        )
      )
  } catch (error) {
    throw new ApiError(401, error?.message || "Unauthorize request")
  }


})


export { registerUser, loginUser , logoutUser};
