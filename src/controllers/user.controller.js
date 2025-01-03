import { AsyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { OPTIONS } from "../constants.js";
import jwt, { decode } from "jsonwebtoken";
import mongoose from "mongoose";

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
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImagePath = req.files?.coverImage[0].path;
  }

  //Validation
  if (!avatarPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //Uploading to cloudinary
  console.log("Avatar", avatarPath);
  const avatar = await uploadOnCloudinary(avatarPath);
  console.log("Avatar af6yer", avatar);

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

const logoutUser = AsyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $unset: {
        refreshToken: 1, //remove this field from document
      },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .clearCookie("accessToken", accessToken, OPTIONS)
    .clearCookie("refreshToken", refreshToken, OPTIONS)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = AsyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorize request");
  }

  try {
    const decodedToken = await jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_SECRET_KEY
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, OPTIONS)
      .cookie("refreshToken", refreshToken, OPTIONS)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Unauthorize request");
  }
});

const changePassword = AsyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new passwords are required");
  }

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await User.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = AsyncHandler(async (req, res) => {
  return res.status(200).json(200, req.user, "User fetched successfully");
});

const updateAccountDetails = AsyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    throw new ApiError(400, "Email and fullname are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details Updated"));
});

const updateAvatarImage = AsyncHandler(async (req, res) => {
  const avatarPath = req.file?.path;
  if (!avatarPath) {
    throw new ApiError(400, "Avatar image is missing");
  }

  const avatar = await uploadOnCloudinary(avatarPath);

  const user = await User.findByIdAndDelete(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateCoverImage = AsyncHandler(async (req, res) => {
  const coverImagePath = req.file?.path;
  if (!coverImagePath) {
    throw new ApiError(400, "Avatar image is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImagePath);

  const user = await User.findByIdAndDelete(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getChannelProfile = AsyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }
  const channel = await User.aggregate([
    // Stage 1: $match - Filters the documents to match a specific condition.
    {
      $match: {
        username: username?.toLowerCase(), // Filters users whose username matches the provided username, case-insensitive.
      },
    },
    // Stage 2: $lookup - Performs a join with the "subscriptions" collection.
    {
      $lookup: {
        from: "subscriptions", // Specifies the collection to join (subscriptions).
        localField: "_id", // The field in the User collection (User._id).
        foreignField: "channel", // The field in the "subscriptions" collection (subscriptions.channel).
        as: "subscribers", // The resulting array of matching documents will be added as a new field "subscribers".
      },
    },
    // Stage 3: $lookup - Performs another join with the "subscriptions" collection.
    {
      $lookup: {
        from: "subscriptions", // Specifies the collection to join (subscriptions).
        localField: "_id", // The field in the User collection (User._id).
        foreignField: "subscriber", // The field in the "subscriptions" collection (subscriptions.subscriber).
        as: "subscribedTo", // The resulting array of matching documents will be added as a new field "subscribedTo".
      },
    },
    // Stage 4: $addFields - Adds new fields or modifies existing fields in the documents.
    {
      $addFields: {
        // Adds a field "subscribersCount" to store the count of subscribers.
        subscribersCount: {
          $size: "$subscribers", // Calculates the size of the "subscribers" array to get the count.
        },
        // Adds a field "channelSubscribedCount" to store the count of channels the user is subscribed to.
        channelSubscribedCount: {
          $size: "$subscribedTo", // Calculates the size of the "subscribedTo" array to get the count.
        },
        // Adds a field "isSubscribed" to indicate if the current user is subscribed to this channel.
        isSubscribed: {
          $cond: {
            // If the current user's ID exists in the "subscribers" array, mark as subscribed.
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true, // The user is subscribed.
            else: false, // The user is not subscribed.
          },
        },
      },
    },
    // Stage 5: $project - Specifies which fields to include or exclude in the final result.
    {
      $project: {
        fullName: 1, // Include the "fullName" field.
        email: 1, // Include the "email" field.
        username: 1, // Include the "username" field.
        avatar: 1, // Include the "avatar" field.
        coverImage: 1, // Include the "coverImage" field.
        isSubscribed: 1, // Include the "isSubscribed" field (from $addFields).
        subscribersCount: 1, // Include the "subscribersCount" field (from $addFields).
        channelSubscribedCount: 1, // Include the "channelSubscribedCount" field (from $addFields).
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel doesn't exists");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched"));
});

const getWatchHistory = AsyncHandler(async (req, res) => {
  const user = await User.aggregate([
    // Stage 1: $match - Filters the User collection to find the user by their _id.
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id), // Matches the user by their ObjectId (req.user._id).
      },
    },
    // Stage 2: $lookup - Performs a join with the "videos" collection based on the watchHistory field.
    {
      $lookup: {
        from: "videos", // Specifies the collection to join (videos).
        localField: "watchHistory", // Field in the User collection to join (User.watchHistory).
        foreignField: "_id", // The field in the "videos" collection (videos._id) that matches with User.watchHistory.
        as: "watchHistory", // The resulting array of matched documents will be added as "watchHistory".
        pipeline: [
          // Nested pipeline inside the $lookup to further process the "videos" collection.
          {
            $lookup: {
              from: "users", // Specifies the collection to join with (users).
              localField: "owner", // The field in "videos" collection (videos.owner) to match with "users" collection.
              foreignField: "_id", // The field in the "users" collection (_id) to match with "videos.owner".
              as: "owner", // The result will be stored in a new field "owner" in the "videos" documents.
              pipeline: [
                // Nested pipeline inside the $lookup to shape the data further.
                {
                  $project: {
                    username: 1, // Only include the "username" field from the "users" collection.
                    fullName: 1, // Only include the "fullName" field.
                    avatar: 1, // Only include the "avatar" field.
                  },
                },
              ],
            },
          },
          // Stage 3: $addFields - Modifies the "owner" field by selecting the first element from the "owner" array.
          {
            $addFields: {
              owner: {
                $first: "$owner", // Extracts the first element from the "owner" array (as there might be multiple matches).
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, user[0], "Watch history fetched successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatarImage,
  updateCoverImage,
  getChannelProfile,
  getWatchHistory,
};
