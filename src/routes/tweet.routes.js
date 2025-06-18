import { Router } from "express";
import {verifyJWT} from '../middlewares/auth.middleware.js';
import { createTweet,
    updateTweet,
    deleteTweet,
    getUserTweets
 } from '../controllers/tweet.controller.js';
import {upload} from '../middlewares/multer.middleware.js';

const router = Router();

router.use(verifyJWT, upload.none()); // upload.none() for not allowing the file upload

router.route("/").post(createTweet);
router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);

router.route("/user/:userId").get(getUserTweets)
export default router;
