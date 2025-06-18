import { Router } from "express";
import { getCurrentUser,
        logoutUser,
        loginUser,
        registerUser,
        refreshAccessToken,
        changeCurrentPassword } from "../controllers/user.controller.js"
import { updateAccountDetails,
        updateUserAvatar,
        updateUserCoverImage,
        getUserChannelProfile,
        getWatchHistory } from "../controllers/user.controller.js"
import {upload} from '../middlewares/multer.middleware.js'
import {verifyJWT} from '../middlewares/auth.middleware.js'

const router = Router()

router.route("/register").post(
    upload.fields([     // adding the upload multer middleware
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount: 1
        }
    ])
    ,registerUser)

router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(
    verifyJWT, // this middleware help to give the req the 
    // loggedin user ref by access token from cookies
    logoutUser
)

// for end to regenarate the accessToken from refreshToken
router.route("/refresh-token").post(refreshAccessToken)

router.route("/change-password").post(verifyJWT, changeCurrentPassword)

router.route("/current-user").get(verifyJWT,getCurrentUser)

router.route("/update-account").patch(verifyJWT,updateAccountDetails)

router.route("/avatar").patch(verifyJWT,
    upload.single("avatar")  //for upload in multer
    ,updateUserAvatar)

router.route("/cover-image").patch(verifyJWT,
    upload.single("coverImage")
    ,updateUserCoverImage
)

// for getUserChannelProfile==> we take channel username from params***
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)

router.route("/history").get(verifyJWT, getWatchHistory)

export default router