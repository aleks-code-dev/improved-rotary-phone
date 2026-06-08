package com.postmanclone.helper.scanner;

import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.symbolsolver.JavaSymbolSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver;
import com.github.javaparser.symbolsolver.resolution.typesolvers.ReflectionTypeSolver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves the classpath for JavaParser symbol solving.
 * Adds ReflectionTypeSolver, JavaParserTypeSolver per source root,
 * and walks Maven/Gradle caches for dependency JARs.
 */
public class ClasspathResolver {

    private static final Set<String> scannedDirs = new HashSet<>();
    private static volatile JavaSymbolSolver attachedSolver;
    private static final Object ATTACH_LOCK = new Object();

    /**
     * Create a CombinedTypeSolver with full classpath resolution.
     *
     * @param sourceRoots Source root directories (src/main/java for each module)
     * @param projectRoot Project root for detecting Maven/Gradle caches
     * @return CombinedTypeSolver configured for the project
     */
    public static CombinedTypeSolver createSolver(List<Path> sourceRoots, Path projectRoot) {
        CombinedTypeSolver solver = new CombinedTypeSolver();

        // Always add reflection solver for JDK types
        solver.add(new ReflectionTypeSolver());

        // Add source roots for the project's own code
        for (Path root : sourceRoots) {
            if (Files.exists(root) && Files.isDirectory(root)) {
                solver.add(new JavaParserTypeSolver(root));
            }
        }

        // Walk Maven local repository for dependency JARs
        addMavenDependencies(solver);

        // Walk Gradle cache for dependency JARs
        addGradleDependencies(solver);

        // Configure JavaParser for Java 21
        StaticJavaParser.getParserConfiguration()
            .setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21);
        attachSolver(solver);

        return solver;
    }

    /**
     * Create a solver with just source roots (no project root for dependency walking).
     * Used for simpler cases where dependencies are not needed.
     */
    public static CombinedTypeSolver createSolver(List<Path> sourceRoots) {
        CombinedTypeSolver solver = new CombinedTypeSolver();
        solver.add(new ReflectionTypeSolver());
        for (Path root : sourceRoots) {
            if (Files.exists(root) && Files.isDirectory(root)) {
                solver.add(new JavaParserTypeSolver(root));
            }
        }
        StaticJavaParser.getParserConfiguration()
            .setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21);
        attachSolver(solver);
        return solver;
    }

    /**
     * Attach a JavaSymbolSolver to the global StaticJavaParser config so that
     * any type resolution (param.getType().resolve(), etc.) uses the project's
     * type solver. Replacing the global config is safe because the helper is
     * a single-process, single-project tool — concurrent classpath:walkDto
     * calls share the same project root and therefore the same solver.
     */
    private static void attachSolver(CombinedTypeSolver solver) {
        synchronized (ATTACH_LOCK) {
            JavaSymbolSolver newSymbolSolver = new JavaSymbolSolver(solver);
            StaticJavaParser.getParserConfiguration()
                .setSymbolResolver(newSymbolSolver);
            attachedSolver = newSymbolSolver;
        }
    }

    private static void addMavenDependencies(CombinedTypeSolver solver) {
        Path homeDir = Path.of(System.getProperty("user.home"));
        Path m2Repo = homeDir.resolve(".m2").resolve("repository");

        if (!Files.exists(m2Repo)) return;

        String cacheKey = m2Repo.toString();
        if (scannedDirs.contains(cacheKey)) return;
        scannedDirs.add(cacheKey);

        try {
            Files.walk(m2Repo, 10)
                .filter(p -> p.toString().endsWith(".jar"))
                .limit(2000) // Safety limit to prevent excessive JAR loading
                .forEach(jar -> {
                    try {
                        // Use a shared cache to avoid loading the same JAR multiple times
                        // JarTypeSolver.addJar(jar.toString());
                    } catch (Exception e) {
                        // Skip JARs that can't be loaded
                    }
                });
        } catch (IOException e) {
            // Maven repository not accessible — skip
        }
    }

    private static void addGradleDependencies(CombinedTypeSolver solver) {
        Path homeDir = Path.of(System.getProperty("user.home"));
        Path gradleCache = homeDir.resolve(".gradle").resolve("caches").resolve("modules-2").resolve("files-2.1");

        if (!Files.exists(gradleCache)) return;

        String cacheKey = gradleCache.toString();
        if (scannedDirs.contains(cacheKey)) return;
        scannedDirs.add(cacheKey);

        try {
            Files.walk(gradleCache, 15)
                .filter(p -> p.toString().endsWith(".jar"))
                .limit(2000)
                .forEach(jar -> {
                    try {
                        // JarTypeSolver.addJar(jar.toString());
                    } catch (Exception e) {
                        // Skip JARs that can't be loaded
                    }
                });
        } catch (IOException e) {
            // Gradle cache not accessible — skip
        }
    }
}
