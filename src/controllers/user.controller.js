import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken";
import mongoose from "mongoose";


// creating method to access both token easily
const generateAccessAndRefereshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)  //retriving the user of the given userId from DB
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken  // need to store refresh token into db 
        await user.save({validateBeforeSave: false}) //*** so save it into the DB and the password 
        // validation will be kicked up.. so avoid this we did the validateBeforeSave: false

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token!")
    }
}

const registerUser = asyncHandler( async (req,res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username,email
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password} = req.body
    // console.log("email: ",email);

    // if (fullName===""){
    //     throw new ApiError(400,"Fullname is required");
    // }

    // advance together check that each value has given or not?
    if(
        [fullName, email,username, password].some((field)=> field?.trim()=="")
    ){
        throw new ApiError(400,"All fields are required")
    }

    // check same user exist or not?
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists")
    }
    // console.log(req.files);
    

    // for taking...getting the localpath or not?
    const avatarLocalPath = req.files?.avatar[0]?.path; // multer gives file method 
    console.log(req.files.avatar)
    
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    // because the coverImage is not manditory so need to check like that
    let coverImageLocalPath;
    // req.files --> "files" because two files were uploaded in multer!
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }


    // avatar is given or not?
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is required")
    }

    // uploading on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // check beacuse avatar field is required
    if (!avatar) {
        throw new ApiError(400,"Avatar file is requiredd")
    }

    //**** some time cloudinary not work properly so open side wise to check */

    // creating User type object with the given data to push in Db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // chaining for which item not want to take like password, refreshToken
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken" // '-' for excepted that selection 
    )

    // check our error for creating user object
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    // For sending the created user response!!
    return res.status(201).json(
        new ApiResponse(200, createdUser,"User registered Successfully.")
    )
})

const loginUser = asyncHandler(async (req,res)=>{
    // req body -> data
    // username or email base login
    // find the user
    // password check
    // is password verified then access and refresh token generate
    // send token by cookie to the userbrowser localstorage

    const {email, username, password} = req.body
    console.log(email);
    
    
    // login by username and email
    if (!username && !email) {
        throw new ApiError(400,"username or email is required")
    }

    // searching in mongo with username or email and got the user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404,"User does not exist!")
    }

    // checking password by isPasswordCorrect which made in User model 
    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401,"Invalid user credentials(password invalid!)")
    }

    // generate accessToken and refreshToken
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    // again searching for user because after token creating the previous
    //  user not stored it by it's reference
    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken ")

    //cookie time
    const options = {
        httpOnly: true,  // by this two the cookie will be only able to modified 
        // into server not into frontend
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )


})

const logoutUser = asyncHandler(async (req,res)=>{
    // req.user ==> for getting that we did cookie==> access token==> auth.middleware ==> router
    // https://youtu.be/7DVpag3cO0g?list=PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW

    await User.findByIdAndUpdate(
        // for update in mongodb ***
        req.user._id, //for finding by which
        {  // what to update
            // $set: { 
            //     refreshToken: undefined
            // }
            $unset:{
                refreshToken: 1 // this removes the field from document 
            }
        },
        {
            new: true  // to get the new update response with undefined refreshtoken
        }
    )

    //cookie time for edit the cookies ****
    const options = {
        httpOnly: true,  // by this two the cookie will be only able to 
        // modified into server not into frontend
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

// for when the accessToken expired the refreshToken can renew it.
const refreshAccessToken = asyncHandler(async (req,res)=>{
    //get refreshToken from cookies
    // decode the token
    // search the User but the refreshToken _id
    // checking refreshToken with stored MongoDB stored refreshToken
    // then again generateAccessAndRefresh Token
    //send cookies

    // first from cookies and second if req come from mobile application
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // if(!incomingRefreshToken) would be
    if (!incomingRefreshToken) {
        throw new ApiError(401,"Unathorized request!!")
    }

    try {
        // decode the encrypted to get the orginal one
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        // searching by user_id
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401,"Invalid Refresh token!!")
        }
    
        // check with db stored refreshToken
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used!")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        // for new AccessToken let's generate it
        const {accessToken, newRefreshToken}= await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken",newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || 
            "Invalid refresh token!")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword, newPassword} = req.body
    // console.log("req:body: ",req.body)
    // console.log("hi2",oldPassword)
    // console.log(newPassword)
    // using auth.middleware we will add req.user to get the loggedin user ref
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false}) // to avoid 
    // the constraint check like unique, required in Mongo fields

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully."))

})

const getCurrentUser = asyncHandler(async (req,res)=>{
    return res
    .status(200) // as auth.middleware will inject req.user
    .json( new ApiResponse(
        200,
        req.user,
        "Current user fetched successfully."
    ))
})

const updateAccountDetails = asyncHandler(async (req,res)=>{
    const {fullName, email} = req.body

    if (!fullName || !email){
        throw new ApiError(400, "All fields are required!")
    }    

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName, // both method okay
                email: email
            }
        },
        {new: true} // it will return the updated information

    ).select("-password")  // for getting updated response 
    // without password field

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Account details updated successfully."
    ))
})

const updateUserAvatar = asyncHandler(async (req,res)=>{
    const avatarLocalPath = req.file?.path // single file uploaded
    //  by multer so used 'file'

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing!")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Avatar image updated successfully.")
    )
})

const updateUserCoverImage = asyncHandler(async (req,res)=>{
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "CoverImage file is missing!")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on Cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated successfully.")
    )

})

const getUserChannelProfile = asyncHandler(async (req,res)=>{
    // as when we want to visit any channel, we give /bubai.com **
    // for username will get from params

    // this username==> whose channel i am searching ****
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400,"username is missing!!")
    }

    // MongoDB aggregate Pipeline give output as array
    const channel = await User.aggregate([
        {   //searching for the channel with the help of username from DB
            $match: {
                username: username?.toLowerCase()
            }
        },
        { //pipeline checking for the total subscriptions of the user
            // In MongoDB, the "lookup" stage is part of the aggregation pipeline that 
            // allows you to perform left outer joins between collections, similar to SQL joins. 
            $lookup: {
                from:"subscriptions", // from which collections
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {  //pipeline checking for the total the user has subscribed
            $lookup: {
                from:"subscriptions", // from which collections
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            // adding these fields without schema model, done by code
            $addFields: {
                subcribersCount: {
                    $size: "$subscribers"  //dollar used beacuse field it is
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                // checking for the channel is subscribed or not?
                // https://youtu.be/fDTf1mk-jQg?list=PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW
                isSubscribed: {
                    $cond: {
                        // checking is subscribers
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]}, 
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            // filtering which values will be showed or passed
            $project: {
                fullName: 1,
                username: 1,
                subcribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404,"channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User Channel fetched Succesfully.")
    )
})

// when we did req.user._id ==> it give as string but moongose handle it 
// But in pipeline we need to manually convert into mongodb id
// https://youtu.be/qNnR7cuVliI?list=PLu71SKxNbfoBGh_8p_NS-ZAh6v7HhYqHW
const getWatchHistory = asyncHandler(async (req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project:{
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1,
                                    }
                                }
                            ]
                        }
                    },
                    {  // as after lookup we get array value, 
                    // so for frontend we convert into a object
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successully."
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}