package com.riskRadar.user_service.service;

import java.security.SecureRandom;
import java.util.Base64;

public class JwtKeyGenerator {
    public static void main(String[] args) {
        byte[] key = new byte[64]; // 512-bit key
        new SecureRandom().nextBytes(key);
        System.out.println(Base64.getEncoder().encodeToString(key));
    }
}
