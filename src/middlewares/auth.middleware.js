import { asyncHandler } from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"

// for getting the already loggedin user
export const verifyJWT = asyncHandler(async(req,res,next)=>{
    try {
        // taking token information from cookies or passed header in mobile dev
        const token = req.cookies?.accessToken || 
        req.header("Authorization")?.replace("Bearer ","")
    
        // do if not token get
        if (!token) {
            throw new ApiError(401, "Unathorized request!")
        }
    
        // secret key to decode the encryption
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) 
    
        const user = await User.findById(decodedToken?._id).select // token_id === user_id in AccessToken
        ("-password -refreshToken")
    
        if (!user) {
            //TODO: discuss about frontend
            throw new ApiError(401,"Invalid Access Token")
        }
    
        // adding "user" object to req
        // that will add user reference to the req and will help to do next work
        req.user = user;
        next()  //**** very Important because middleware without the next() will stacked here!!! */
    } catch (error) {
        throw new ApiError(401, error?.message ||
            "Invalid access token"
        )
    }
})