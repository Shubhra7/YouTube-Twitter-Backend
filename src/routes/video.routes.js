import {Router} from "express";
import {upload} from "../middlewares/multer.middleware.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";

import {
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    getAllVideos,
    togglePublishStatus
} from "../controllers/video.controller.js";

const router = Router();

router.route("/")
    .get(getAllVideos)
    .post(
    verifyJWT,
    upload.fields([
        {
            name: "videoFile",
            maxCount:1
        },
        {
            name: "thumbnail",
            maxCount: 1
        }
    ]),
    publishAVideo
);

router
    .route("/v/:videoId")
    .get(verifyJWT, getVideoById)
    .patch(verifyJWT, upload.single("thumbnail"), updateVideo)
    .delete(verifyJWT, deleteVideo);

router.route("/toggle/publish/:videoId")
        .patch(verifyJWT,togglePublishStatus);
        
export default router