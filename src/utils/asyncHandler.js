const asyncHandler = (requestHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next)).
        catch((err)=>next(err))
    }
}

export { asyncHandler }


// const asyncHadler = ()=>{}
// const asyncHadler = (func)=> () =>{}
// const asyncHadler = (func)=> async () =>{}


// create a wrapper function to handle the async function using high level function (take argument as function and return a function)
// const asyncHandler = (fn) => async (req, res, next)=>{
//     try{
//         await fn(req, res, next)
//     } catch(error){
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message || "Internal Server Error"
//         })
//     }
// }
