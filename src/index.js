// require('dotenv').config("./env")
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: "./.env"
})

connectDB()    // when asyn fucntion done it give a promise so need to handle there
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running at port : ${process.env.PORT}`);
        
    })
    // app.on("error",(error)=>{
    //     console.log("Application failed to talk with database: ",error);
    //     throw error
    // })
})
.catch((err)=>{
    console.log("MONGO db connection failed!!! ",err);
    
})





/*
import express from "express"
const app = express()

( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error",(error)=>{
            console.log("Application failed to talk with database: ",error);
            throw error
        })

        app.listen(process.env.PORT, ()=>{
            console.log(`App is listening on port 
                ${process.env.PORT}`);
            
        })
    } catch(error){
        console.error("ERROR: ",error)
        throw error
    }
})()
    
*/    