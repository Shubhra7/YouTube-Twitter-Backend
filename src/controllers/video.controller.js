import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError}  from "../utils/ApiError.js";
import {Video} from "../models/video.model.js";
import {Comment} from "../models/comment.model.js";
import {User} from "../models/user.model.js";
import{
    uploadOnCloudinary,
    deleteOnColudinary
} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import mongoose, {isValidObjectId} from "mongoose";
import {Like} from "../models/like.model.js";


// get video, upload to cloudinary, create video
// Publish video 
const publishAVideo = asyncHandler(async(req,res)=>{
    const {title,description} = req.body;

    if([title,description].some((field)=> field?.trim()==="")){
        throw new ApiError(400,"All Fields are required to publish a Video!!");
    }

    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

    if(!videoFileLocalPath){
        throw new ApiError(400,"videoFileLocalPath is required!!");
    }
    if(!thumbnailLocalPath){
        throw new ApiError(400,"thumbnailLocalPath is required!!");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if(!videoFile){
        throw new ApiError(400,"Video file not found (issue in cloudinary)");
    }
    if(!thumbnail){
        throw new ApiError(400,"Thumbnail not found(issue in cloudinary upload)!");
    }

    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id
        },
        owner: req.user?._id,
        isPublished: false
    });

    const videoUploaded = await Video.findById(video._id);

    if(!videoUploaded){
        throw new ApiError(500, "videoUpload failed please try again!(issue during create object in MONGOdb)");
    }

    return res.status(200).json(
        new ApiResponse(200,video,"Video uploaded successfully")
    )
});

//Get video by id
const getVideoById = asyncHandler(async (req,res)=>{
    const { videoId } = req.params;
    // taking video_id for request

    if(!isValidObjectId(videoId)){ //inbuild function the given id is valid or not?
        throw new ApiError(400, "Invalid VideoId");
    }
    
    if(!isValidObjectId(req.user?._id)){
        throw new ApiError(400, "Invalid userId");
    }
    // console.log("Hello bubai2");
    // console.log("user: ",req.user);
    const user_copy_id = new mongoose.Types.ObjectId(req.user._id);
    // console.log("user345: ", user_copy_id);
    


    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers"
                        }
                    },
                    {
                        $addFields: {
                            subscribersCount: {
                                $size: "$subscribers"
                            },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber"
                                        ]
                                    },
                                    then: true,
                                    else: false
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar":1,
                            subscribersCount: 1,
                            isSubscribed: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                owner: {
                    $first: "$owner"
                },
                isLiked: {
                    $cond: {
                        if: {$in: [req.user?._id, "$likes.likedBy"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                "videoFile.url":1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration:1,
                comments: 1,
                owner: 1,
                likesCount:1,
                isLiked:1
            }
        }
    ]);

    if(!video){
        throw new ApiError(500,"failed to fetch video");
    }

    // increment views if video fetched successfully
    await Video.findByIdAndUpdate(videoId, {
        $inc: {
            views: 1
        }
    });

    // console.log("User2 checkjjh:", req.user._id);
    // console.log("User2 check:", user_copy_id);
    
    // add this video to user watch history
    await User.findByIdAndUpdate(req.user?._id, {
        // addToSet adds a value to an array only if it 
        // doesn't already exist (i.e., prevents duplicates).
        $addToSet: {  
            watchHistory: videoId
        }
    });

    return res
    .status(200)
    .json(
        new ApiResponse(200, video[0], "video details fetched successfully")
    );

});

const updateVideo = asyncHandler(async (req,res)=>{
    const {title, description} = req.body;
    const {videoId} = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid VideoId!!");
    }

    if(!(title && description)){
        throw new ApiError(400,"Title and description are required!");
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404,"No video found!");
    }

    if(video?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            400,
            "You can't edit this video as you are not the owner"
        );
    }

    // deleting old thumbnail and updating new one
    const thumbnailToDelete = video.thumbnail.public_id;

    const thumbnailLocalPath = req.file?.path;

    if(!thumbnailLocalPath){
        throw new ApiError(400, "thumbnail is required");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if(!thumbnail){
        throw new ApiError(400,"thumbnail not found");
    }

    const updateVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                title,
                description,
                thumbnail:{
                    public_id: thumbnail.public_id,
                    url: thumbnail.url
                }
            }
        },
        { new: true}
    );

    if(!updateVideo){
        throw new ApiError(500,"Failed to update video please try again");
    }

    if(updateVideo){
        await deleteOnColudinary(thumbnailToDelete);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updateVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req,res)=>{
    const {videoId} = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid VideoId given!");
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404,"No video found!");
    }

    if(video?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            400,
            "You can't delete this video as you are not the owner!!"
        );
    }

    const videoDeleted = await Video.findByIdAndDelete(video?._id);

    if(!videoDeleted){
        throw new ApiError(400, "Failed to delete the video please try again");
    }

    // video model has thumbnail public_id stored in it-> check videoModel
    await deleteOnColudinary(video.thumbnail.public_id);
    // specify video while deleting video
    await deleteOnColudinary(video.videoFile.public_id,"video")

    // delete video likes
    await Like.deleteMany({
        video: videoId
    })

    // delete video comments
    await Comment.deleteMany({
        video: videoId
    })

    return res
        .status(200)
        .json(new ApiResponse(200,{},"Video deleted successfully"));
});

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    console.log(userId);
    const pipeline = [];

    // for using Full Text based search u need to create a search index in mongoDB atlas
    // you can include field mapppings in search index eg.title, description, as well
    // Field mappings specify which fields within your documents should be indexed for text search.
    // this helps in seraching only in title, desc providing faster search results
    // here the name of search index is 'search-videos'
    if (query) {
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"] // search on title and description field
                }
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid userId");
        }

        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    //sortBy can be views, createdAt, duration
    //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$ownerDetails"
        }
    );

    // ✅ Pagination with skip and limit directly here
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    const videos = await Video.aggregate(pipeline);

    // Optional: for total count — run a separate pipeline
    const countPipeline = [...pipeline];
    countPipeline.pop(); // remove $limit
    countPipeline.pop(); // remove $skip
    countPipeline.push({ $count: "total" });
    const countResult = await Video.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    return res.status(200).json(
        new ApiResponse(200, {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            videos
        }, "Videos fetched successfully")
    );
});

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req,res)=>{
    const {videoId} = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    if(video?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(
            400,
            "You can't toogle publish status as you are not the owner!"
        );
    }

    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        {
            $set:{
                isPublished: !video?.isPublished
            }
        },
        { new: true}  //to get the update one record
    )

    if(!toggledVideoPublish){
        throw new ApiError(500, "Failed to toggle video publish status");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggledVideoPublish.isPublished},
                "Video publish toggled successfully"
            )
        );
});


export{
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    getAllVideos,
    togglePublishStatus
}

