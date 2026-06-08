package com.postmanclone.helper.scanner;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Detects multi-module Gradle projects by parsing settings.gradle or settings.gradle.kts
 * for include statements. Falls back to single-module (src/main/java) if no includes found.
 */
public class GradleModuleDetector {

    // Matches: include('module1', 'module2') or include("module1", "module2")
    private static final Pattern INCLUDE_PATTERN = Pattern.compile(
        "include\\s*\\(\\s*['\"]([^'\"]+)['\"]"
    );

    // Matches: include project(':module1'), project(':module2')
    private static final Pattern PROJECT_PATTERN = Pattern.compile(
        "project\\s*\\(\\s*['\"]?:([^'\"]+)['\"]?\\s*\\)"
    );

    /**
     * Find all source root directories for a Gradle project.
     * If multi-module, returns src/main/java for each module.
     * If single-module, returns src/main/java from the project root.
     */
    public static List<Path> findModuleRoots(Path projectRoot) {
        List<Path> roots = new ArrayList<>();

        Path settingsGradle = projectRoot.resolve("settings.gradle.kts");
        if (!Files.exists(settingsGradle)) {
            settingsGradle = projectRoot.resolve("settings.gradle");
        }

        System.err.println("[scanner] Gradle: looking for settings.gradle in " + projectRoot);

        if (Files.exists(settingsGradle)) {
            System.err.println("[scanner] Gradle: found " + settingsGradle.getFileName() + ", parsing for includes...");
            try {
                String content = Files.readString(settingsGradle, StandardCharsets.UTF_8);

                Matcher includeMatcher = INCLUDE_PATTERN.matcher(content);
                while (includeMatcher.find()) {
                    String moduleName = includeMatcher.group(1).trim();
                    Path moduleRoot = projectRoot.resolve(moduleName).resolve("src/main/java");
                    System.err.println("[scanner] Gradle: found include '" + moduleName + "' -> " + moduleRoot + " (exists=" + Files.exists(moduleRoot) + ")");
                    if (Files.exists(moduleRoot)) {
                        roots.add(moduleRoot);
                    }
                }

                if (roots.isEmpty()) {
                    Matcher projectMatcher = PROJECT_PATTERN.matcher(content);
                    while (projectMatcher.find()) {
                        String moduleName = projectMatcher.group(1).trim();
                        Path moduleRoot = projectRoot.resolve(moduleName).resolve("src/main/java");
                        System.err.println("[scanner] Gradle: found project '" + moduleName + "' -> " + moduleRoot + " (exists=" + Files.exists(moduleRoot) + ")");
                        if (Files.exists(moduleRoot)) {
                            roots.add(moduleRoot);
                        }
                    }
                }

                if (roots.isEmpty()) {
                    System.err.println("[scanner] Gradle: no includes found in " + settingsGradle.getFileName());
                }
            } catch (IOException e) {
                System.err.println("[scanner] Gradle: failed to read " + settingsGradle.getFileName() + ": " + e.getMessage());
            }
        } else {
            System.err.println("[scanner] Gradle: no settings.gradle(.kts) found");
        }

        if (roots.isEmpty()) {
            Path srcMain = projectRoot.resolve("src/main/java");
            boolean exists = Files.exists(srcMain);
            System.err.println("[scanner] Gradle: fallback single-module src/main/java exists=" + exists);
            if (exists) {
                roots.add(srcMain);
            }
        }

        System.err.println("[scanner] Gradle: found " + roots.size() + " source root(s): " + roots);
        return roots;
    }
}
