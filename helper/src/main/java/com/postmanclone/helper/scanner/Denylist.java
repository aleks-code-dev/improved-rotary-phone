package com.postmanclone.helper.scanner;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

/**
 * Denylist for scanner file walking.
 * Skips build artifacts, IDE directories, and oversized files.
 * Only walks src/main/java/ and src/main/kotlin/ directories.
 */
public class Denylist {

    private static final Set<String> DENIED_DIRS = Set.of(
        ".git", "node_modules", ".idea", ".gradle", ".mvn",
        "build", "out", "dist", "target", "classes", "test-classes",
        "generated-sources", "generated-test-sources",
        "bin", ".settings", ".classpath", ".project"
    );

    private static final long MAX_FILE_SIZE = 1024 * 1024; // 1MB

    /**
     * Check if a path should be skipped during scanning.
     * Returns true if any component of the path is in the denylist.
     */
    public static boolean shouldSkip(Path path) {
        Path absolute = path.toAbsolutePath();
        for (Path segment : absolute) {
            String name = segment.toString();
            if (DENIED_DIRS.contains(name)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if a file should be skipped due to size.
     * Returns true if the file is larger than 1MB.
     */
    public static boolean shouldSkipFile(Path file) {
        try {
            if (Files.size(file) > MAX_FILE_SIZE) {
                return true;
            }
        } catch (IOException e) {
            // If we can't read size, skip the file
            return true;
        }
        return false;
    }

    /**
     * Check if the path is a Java source directory we want to scan.
     * Matches src/main/java/ and src/main/kotlin/.
     */
    public static boolean isSourceDirectory(Path path) {
        String pathStr = path.toString().replace('\\', '/');
        return pathStr.contains("src/main/java") || pathStr.contains("src/main/kotlin");
    }

    /**
     * Check if a file is a Java source file we want to parse.
     */
    public static boolean isJavaFile(Path file) {
        String name = file.getFileName().toString();
        return name.endsWith(".java");
    }
}
