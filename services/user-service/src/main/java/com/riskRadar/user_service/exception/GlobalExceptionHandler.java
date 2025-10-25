package com.riskRadar.user_service.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(UserAlreadyExistsException.class)
    public ResponseEntity<Map<String, String>> handleUserAlreadyExists(UserAlreadyExistsException exception) {
        logger.warn("User already exists: {}", exception.getMessage());
        return createErrorResponse(exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationError(MethodArgumentNotValidException exception) {
        String message = "Validation failed";
        if (exception.getBindingResult().hasFieldErrors()) {
            message = exception.getBindingResult().getFieldError().getDefaultMessage();
        }
        logger.warn("Validation error: {}", message);
        return createErrorResponse(message, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException exception) {
        logger.warn("Invalid argument: {}", exception.getMessage());
        return createErrorResponse(exception.getMessage(), HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, String>> handleSecurityException(SecurityException exception) {
        logger.warn("Security violation: {}", exception.getMessage());
        return createErrorResponse("Access denied", HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException exception) {
        logger.error("Unexpected runtime exception", exception);

        String message = "An internal server error occurred. Please try again later.";
        return createErrorResponse(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneralException(Exception exception) {
        logger.error("Unexpected exception", exception);

        String message = "An unexpected error occurred. Please try again later.";
        return createErrorResponse(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private ResponseEntity<Map<String, String>> createErrorResponse(String message, HttpStatus status) {
        Map<String, String> errorBody = new HashMap<>();
        errorBody.put("error", message);
        errorBody.put("timestamp", LocalDateTime.now().toString());
        errorBody.put("status", String.valueOf(status.value()));
        return ResponseEntity.status(status).body(errorBody);
    }
}