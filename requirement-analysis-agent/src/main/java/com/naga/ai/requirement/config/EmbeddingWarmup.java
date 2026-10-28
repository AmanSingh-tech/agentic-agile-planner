package com.naga.ai.requirement.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

/**
 * Loads the embedding model in the background on startup so the first approval
 * does not pay the model load time when acceptance criteria are stored in PGVector.
 */
@Component
public class EmbeddingWarmup {
    private static final Logger logger = LoggerFactory.getLogger(EmbeddingWarmup.class);

    private final EmbeddingModel embeddingModel;

    public EmbeddingWarmup(EmbeddingModel embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        CompletableFuture.runAsync(() -> {
            long start = System.currentTimeMillis();
            try {
                embeddingModel.embed("warm up");
                logger.info("Embedding model warmed up in {} ms", System.currentTimeMillis() - start);
            } catch (Exception e) {
                logger.warn("Embedding model warm up failed: {}", e.getMessage());
            }
        });
    }
}
