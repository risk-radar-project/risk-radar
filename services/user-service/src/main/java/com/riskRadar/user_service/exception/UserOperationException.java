package com.riskRadar.user_service.exception;


import lombok.Getter;

@Getter
public class UserOperationException extends RuntimeException {
    private final ErrorType errorType;

    public enum ErrorType {
        USER_NOT_FOUND,
        USER_ALREADY_BANNED,
        CANNOT_BAN_ADMIN,
        CANNOT_BAN_SELF,
        INVALID_CREDENTIALS,
        USER_BANNED,
        OPERATION_FAILED
    }

    public UserOperationException(String message, ErrorType errorType) {
        super(message);
        this.errorType = errorType;
    }

    public UserOperationException(String message, ErrorType errorType, Throwable cause) {
        super(message, cause);
        this.errorType = errorType;
    }

}
