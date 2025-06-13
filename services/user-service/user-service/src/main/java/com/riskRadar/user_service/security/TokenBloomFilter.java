package com.riskRadar.user_service.security;

import com.google.common.base.Charsets;
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

@Component
public class TokenBloomFilter {
    private BloomFilter<String> bloomFilter;

    @PostConstruct
    public void init(){
        // capacity = 10000, false positive rate = 1%
        bloomFilter = BloomFilter.create(Funnels.stringFunnel(Charsets.UTF_8), 100000, 0.01);
    }
    public void addToken(String token){
        bloomFilter.put(token);
    }
    public boolean mightContainToken(String token){
        return bloomFilter.mightContain(token);
    }
}
