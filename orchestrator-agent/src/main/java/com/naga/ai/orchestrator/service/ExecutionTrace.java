package com.naga.ai.orchestrator.service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * Records every tool call the orchestrator LLM makes during a /plan request,
 * so the caller can see which steps ran and how long each one took.
 * Tool calls run on the request thread, so a ThreadLocal is enough.
 */
public final class ExecutionTrace {

    public record Step(String tool, String input, String output, long durationMs, boolean success) {
    }

    private static final ThreadLocal<List<Step>> CURRENT = new ThreadLocal<>();

    private ExecutionTrace() {
    }

    public static void start() {
        CURRENT.set(new ArrayList<>());
    }

    public static List<Step> finish() {
        List<Step> steps = CURRENT.get();
        CURRENT.remove();
        return steps != null ? steps : List.of();
    }

    /**
     * Runs the tool body and records it when a trace is active; otherwise just runs it.
     */
    public static String record(String tool, String input, Supplier<String> body) {
        List<Step> steps = CURRENT.get();
        long start = System.currentTimeMillis();
        try {
            String output = body.get();
            if (steps != null) {
                steps.add(new Step(tool, input, output, System.currentTimeMillis() - start, true));
            }
            return output;
        } catch (RuntimeException e) {
            if (steps != null) {
                steps.add(new Step(tool, input, e.getMessage(), System.currentTimeMillis() - start, false));
            }
            throw e;
        }
    }
}
