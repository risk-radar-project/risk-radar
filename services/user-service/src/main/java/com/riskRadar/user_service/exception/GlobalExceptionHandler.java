package com.riskRadar.user_service.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserOperationException.class)
    public ResponseEntity<?> handleUserOperationException(UserOperationException ex) {
        HttpStatus status = switch (ex.getErrorType()) {
            case USER_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case USER_ALREADY_BANNED -> HttpStatus.CONFLICT;
            case CANNOT_BAN_ADMIN, CANNOT_BAN_SELF -> HttpStatus.FORBIDDEN;
            case INVALID_CREDENTIALS -> HttpStatus.UNAUTHORIZED;
            case USER_BANNED -> HttpStatus.FORBIDDEN;
            case OPERATION_FAILED -> HttpStatus.INTERNAL_SERVER_ERROR;
        };

        return ResponseEntity
                .status(status)
                .body(Map.of(
                        "error", ex.getMessage(),
                        "type", ex.getErrorType().name()
                ));
    }
}
