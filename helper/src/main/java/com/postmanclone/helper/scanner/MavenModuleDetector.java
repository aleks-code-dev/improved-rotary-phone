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
 * Detects multi-module Maven projects by parsing pom.xml for <modules> element.
 * Falls back to single-module (src/main/java) if no modules found.
 */
public class MavenModuleDetector {

    private static final Pattern MODULE_PATTERN = Pattern.compile(
        "<module>\\s*([^<]+?)\\s*</module>"
    );

    /**
     * Find all source root directories for a Maven project.
     * If multi-module, returns src/main/java for each module.
     * If single-module, returns src/main/java from the project root.
     */
    public static List<Path> findModuleRoots(Path projectRoot) {
        List<Path> roots = new ArrayList<>();

        Path pomXml = projectRoot.resolve("pom.xml");
        if (Files.exists(pomXml)) {
            try {
                String content = Files.readString(pomXml, StandardCharsets.UTF_8);
                Matcher matcher = MODULE_PATTERN.matcher(content);
                while (matcher.find()) {
                    String moduleName = matcher.group(1).trim();
                    Path moduleRoot = projectRoot.resolve(moduleName).resolve("src/main/java");
                    if (Files.exists(moduleRoot)) {
                        roots.add(moduleRoot);
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
