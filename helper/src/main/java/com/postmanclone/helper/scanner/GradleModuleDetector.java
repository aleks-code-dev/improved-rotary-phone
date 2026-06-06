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

        // Try settings.gradle.kts first, then settings.gradle
        Path settingsGradle = projectRoot.resolve("settings.gradle.kts");
        if (!Files.exists(settingsGradle)) {
            settingsGradle = projectRoot.resolve("settings.gradle");
        }

        if (Files.exists(settingsGradle)) {
            try {
                String content = Files.readString(settingsGradle, StandardCharsets.UTF_8);

                // Match include('module') pattern
                Matcher includeMatcher = INCLUDE_PATTERN.matcher(content);
                while (includeMatcher.find()) {
                    String moduleName = includeMatcher.group(1).trim();
                    Path moduleRoot = projectRoot.resolve(moduleName).resolve("src/main/java");
                    if (Files.exists(moduleRoot)) {
                        roots.add(moduleRoot);
                    }
                }

                // Match include project(':module') pattern
                if (roots.isEmpty()) {
                    Matcher projectMatcher = PROJECT_PATTERN.matcher(content);
                    while (projectMatcher.find()) {
                        String moduleName = projectMatcher.group(1).trim();
                        Path moduleRoot = projectRoot.resolve(moduleName).resolve("src/main/java");
                        if (Files.exists(moduleRoot)) {
                            roots.add(moduleRoot);
                        }
                    }
                }
            } catch (IOException e) {
                // Fall through to single-module fallback
            }
        }

        // Fallback: if no modules found, check for single-module src/main/java
        if (roots.isEmpty()) {
            Path srcMain = projectRoot.resolve("src/main/java");
            if (Files.exists(srcMain)) {
                roots.add(srcMain);
            }
        }

        return roots;
    }
}
