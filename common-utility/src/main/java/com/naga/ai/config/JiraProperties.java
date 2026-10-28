package com.naga.ai.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
@ConfigurationProperties(prefix = "jira")
public class JiraProperties {
    private String baseUrl;
    private String email;
    private String apiToken;
    private String projectSpaceKey;
    private String storyPointsField;
    private boolean mock;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getApiToken() {
        return apiToken;
    }

    public void setApiToken(String apiToken) {
        this.apiToken = apiToken;
    }

    public String getProjectSpaceKey() {
        return projectSpaceKey;
    }

    public void setProjectSpaceKey(String projectSpaceKey) {
        this.projectSpaceKey = projectSpaceKey;
    }

    public String getStoryPointsField() {
        return storyPointsField;
    }

    public void setStoryPointsField(String storyPointsField) {
        this.storyPointsField = storyPointsField;
    }

    public boolean isMock() {
        return mock;
    }

    public void setMock(boolean mock) {
        this.mock = mock;
    }

    /**
     * Mock mode is used when explicitly enabled or when Jira credentials are not configured,
     * so the agents can run end to end locally without a Jira Cloud account.
     */
    public boolean isMockMode() {
        return mock || isBlank(email) || isBlank(apiToken);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    @PostConstruct
    public void validate() {
        if (isMockMode()) {
            return;
        }
        Objects.requireNonNull(baseUrl,
                "jira.baseUrl is required");
        Objects.requireNonNull(email,
                "jira.email is required — " +
                        "set JIRA_EMAIL env variable");
        Objects.requireNonNull(apiToken,
                "jira.apiToken is required — " +
                        "set JIRA_API_TOKEN env variable");
        Objects.requireNonNull(projectSpaceKey,
                "jira.projectSpaceKey is required — " +
                        "set JIRA_PROJECT_KEY env variable");
    }

    @Override
    public String toString() {
        return "JiraProperties { " +
                "baseUrl='" + baseUrl + '\'' +
                ", email='" + email + '\'' +
                ", apiToken='" + (isBlank(apiToken) ? "" : "****") + '\'' +
                ", projectSpaceKey='" + projectSpaceKey + '\'' +
                ", storyPointsField='" + storyPointsField + '\'' +
                ", mock=" + isMockMode() +
                '}';
    }
}
