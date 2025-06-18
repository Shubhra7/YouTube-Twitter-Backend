class ApiError extends Error{
    constructor(
        statusCode,
        message= "Something went wrong",
        errors= [],
        stack=""
    ){
        super(message)
        this.statusCode = statusCode
        this.data=null
        this.message= message
        this.success = false
        this.errors = errors

        // if we pass the stack then we will use that stack otherwise we will use the stack trace
        // stack means the error line number and file name
        if (stack){
            this.stack = stack
        }else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export { ApiError }