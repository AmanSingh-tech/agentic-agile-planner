package com.naga.ai.orchestrator.service;

import java.util.List;

public record PlanResult(String summary, List<ExecutionTrace.Step> steps, long totalMs, String model) {
}
