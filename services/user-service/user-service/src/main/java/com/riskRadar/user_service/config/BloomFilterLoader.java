package com.riskRadar.user_service.config;

import com.riskRadar.user_service.security.TokenBloomFilter;
import com.riskRadar.user_service.service.TokenRedisService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class BloomFilterLoader implements ApplicationRunner{

    private final TokenRedisService redisService;
    private final TokenBloomFilter tokenBloomFilter;

    public BloomFilterLoader(TokenRedisService redisService, TokenBloomFilter tokenBloomFilter) {
        this.redisService = redisService;
        this.tokenBloomFilter = tokenBloomFilter;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception{
        List<String> tokens = redisService.getAllValidTokens();

        for(String token : tokens){
            System.out.println("Token added to Bloom filter:" + token);
            tokenBloomFilter.addToken(token);
        }
    }
}
