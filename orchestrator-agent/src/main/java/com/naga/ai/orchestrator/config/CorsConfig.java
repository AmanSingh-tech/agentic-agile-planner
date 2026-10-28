package com.naga.ai.orchestrator.config;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Allows the web frontend (e.g. deployed on Vercel) to call the orchestrator from the browser.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    private static final Logger logger = LoggerFactory.getLogger(CorsConfig.class);

    @Value("${cors.allowed-origins:*}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        logger.info("CORS allowed origins: {}", String.join(",", allowedOrigins));
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
    }

    /**
     * Chrome's Private Network Access sends this preflight header when a public site
     * (https://*.vercel.app) calls a server on localhost — answer it so the request is allowed.
     */
    @Bean
    public Filter privateNetworkAccessFilter() {
        return (request, response, chain) -> {
            HttpServletRequest req = (HttpServletRequest) request;
            if ("true".equals(req.getHeader("Access-Control-Request-Private-Network"))) {
                ((HttpServletResponse) response).setHeader("Access-Control-Allow-Private-Network", "true");
            }
            chain.doFilter(request, response);
        };
    }
}
