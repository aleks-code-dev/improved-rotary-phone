package com.postmanclone.helper.scanner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.AnnotationExpr;
import com.github.javaparser.ast.expr.ArrayInitializerExpr;
import com.github.javaparser.ast.expr.MemberValuePair;
import com.github.javaparser.ast.expr.NormalAnnotationExpr;
import com.github.javaparser.ast.expr.SingleMemberAnnotationExpr;
import com.github.javaparser.ast.expr.StringLiteralExpr;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitOption;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

/**
 * Scans a Spring project for @RestController and @Controller endpoints.
 * Uses Files.walkFileTree to skip excluded directories efficiently.
 */
public class EndpointScanner {

    private static final int MAX_FILES = 10_000;
    private static final int MAX_DEPTH = 50;

    private static final Set<String> SKIP_DIRS = Set.of(
        ".git", "node_modules", ".idea", ".gradle", ".mvn",
        "build", "out", "dist", "target", "classes", "test-classes",
        "generated-sources", "generated-test-sources",
        "bin", ".settings", ".classpath", ".project",
        "test" // skip src/test/ entirely
    );

    private final ObjectMapper mapper;
    private int totalFiles;
    private int totalEndpoints;
    private final List<String> errors;
    private final Set<String> parsedFiles = new HashSet<>();

    public EndpointScanner() {
        this.mapper = new ObjectMapper();
        this.errors = new ArrayList<>();
        this.totalFiles = 0;
        this.totalEndpoints = 0;
    }

    /**
     * Scan a Spring project root for endpoints.
     */
    public ObjectNode scan(Path projectRoot) {
        long startTime = System.currentTimeMillis();
        totalFiles = 0;
        totalEndpoints = 0;
        errors.clear();
        parsedFiles.clear();

        // Configure parser for Java 21
        StaticJavaParser.getParserConfiguration()
            .setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21);

        ObjectNode result = mapper.createObjectNode();
        ArrayNode controllers = mapper.createArrayNode();

        try {
            List<Path> sourceRoots = findSourceRoots(projectRoot);

            if (sourceRoots.isEmpty()) {
                errors.add("No buildable sources found in " + projectRoot);
                result.put("ok", false);
                result.set("controllers", controllers);
                result.put("scanDurationMs", System.currentTimeMillis() - startTime);
                result.put("totalFiles", 0);
                result.put("totalEndpoints", 0);
                result.set("errors", mapper.valueToTree(errors));
                return result;
            }

            System.err.println("[scanner] Source roots: " + sourceRoots);

            for (Path sourceRoot : sourceRoots) {
                walkSourceRoot(sourceRoot, controllers);
            }

        } catch (Exception e) {
            errors.add("Scan failed: " + e.getMessage());
            System.err.println("[scanner] ERROR: " + e.getMessage());
            e.printStackTrace(System.err);
        }

        long duration = System.currentTimeMillis() - startTime;
        System.err.println("[scanner] Scan complete: " + totalFiles + " files, " + totalEndpoints + " endpoints in " + duration + "ms");

        result.put("ok", true);
        result.put("projectId", computeProjectId(projectRoot));
        result.put("projectPath", projectRoot.toAbsolutePath().toString());
        result.set("controllers", controllers);
        result.put("scanDurationMs", duration);
        result.put("totalFiles", totalFiles);
        result.put("totalEndpoints", totalEndpoints);
        result.set("errors", mapper.valueToTree(errors));

        return result;
    }

    private List<Path> findSourceRoots(Path projectRoot) {
        List<Path> roots = MavenModuleDetector.findModuleRoots(projectRoot);
        if (!roots.isEmpty()) return roots;
        return GradleModuleDetector.findModuleRoots(projectRoot);
    }

    /**
     * Walk source root using Files.walkFileTree which SKIPS excluded directories
     * instead of Files.walk which visits every file then filters.
     */
    private void walkSourceRoot(Path sourceRoot, ArrayNode controllers) throws IOException {
        if (!Files.exists(sourceRoot)) {
            System.err.println("[scanner] Source root does not exist: " + sourceRoot);
            return;
        }

        System.err.println("[scanner] Walking: " + sourceRoot);

        Files.walkFileTree(sourceRoot, EnumSet.noneOf(FileVisitOption.class), MAX_DEPTH,
            new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    String dirName = dir.getFileName().toString();
                    // Skip excluded directories entirely (no traversal)
                    if (SKIP_DIRS.contains(dirName)) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (totalFiles >= MAX_FILES) {
                        System.err.println("[scanner] Hit file limit (" + MAX_FILES + "), stopping");
                        return FileVisitResult.TERMINATE;
                    }

                    String fileName = file.getFileName().toString();
                    if (!fileName.endsWith(".java")) {
                        return FileVisitResult.CONTINUE;
                    }

                    // Skip files > 1MB
                    if (attrs.size() > 1024 * 1024) {
                        System.err.println("[scanner] Skipping large file (>1MB): " + file);
                        return FileVisitResult.CONTINUE;
                    }

                    // Deduplicate (symlinks etc)
                    String canonical = file.toAbsolutePath().normalize().toString();
                    if (!parsedFiles.add(canonical)) {
                        return FileVisitResult.CONTINUE;
                    }

                    totalFiles++;
                    if (totalFiles % 50 == 0) {
                        System.err.println("[scanner] Parsed " + totalFiles + " files, found " + totalEndpoints + " endpoints so far...");
                    }

                    try {
                        parseFile(file, controllers);
                    } catch (Exception e) {
                        System.err.println("[scanner] Failed to parse " + file + ": " + e.getMessage());
                    }

                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE;
                }
            });
    }

    private void parseFile(Path file, ArrayNode controllers) throws IOException {
        CompilationUnit cu = StaticJavaParser.parse(file);

        for (ClassOrInterfaceDeclaration cls : cu.findAll(ClassOrInterfaceDeclaration.class)) {
            if (!isRestController(cls)) continue;

            System.err.println("[scanner] Found controller: " + cls.getNameAsString() + " in " + file);
            ObjectNode controllerNode = parseController(cls, cu, file);
            if (controllerNode != null) {
                controllers.add(controllerNode);
            }
        }
    }

    private boolean isRestController(ClassOrInterfaceDeclaration cls) {
        return cls.getAnnotationByName("RestController").isPresent()
            || cls.getAnnotationByName("Controller").isPresent();
    }

    private ObjectNode parseController(ClassOrInterfaceDeclaration cls, CompilationUnit cu, Path sourceFile) {
        String className = cls.getNameAsString();
        String packageName = cu.getPackageDeclaration()
            .map(pd -> pd.getNameAsString())
            .orElse("");
        String fqn = packageName.isEmpty() ? className : packageName + "." + className;

        String basePath = extractClassBasePath(cls);

        ArrayNode endpointsNode = mapper.createArrayNode();

        for (MethodDeclaration method : cls.getMethods()) {
            for (AnnotationExpr ann : method.getAnnotations()) {
                String annName = ann.getNameAsString();
                String httpMethod = null;
                String methodPath = null;
                String consumes = null;
                String produces = null;

                switch (annName) {
                    case "GetMapping":
                        httpMethod = "GET";
                        methodPath = extractPath(ann);
                        consumes = extractAttribute(ann, "consumes");
                        produces = extractAttribute(ann, "produces");
                        break;
                    case "PostMapping":
                        httpMethod = "POST";
                        methodPath = extractPath(ann);
                        consumes = extractAttribute(ann, "consumes");
                        produces = extractAttribute(ann, "produces");
                        break;
                    case "PutMapping":
                        httpMethod = "PUT";
                        methodPath = extractPath(ann);
                        consumes = extractAttribute(ann, "consumes");
                        produces = extractAttribute(ann, "produces");
                        break;
                    case "PatchMapping":
                        httpMethod = "PATCH";
                        methodPath = extractPath(ann);
                        consumes = extractAttribute(ann, "consumes");
                        produces = extractAttribute(ann, "produces");
                        break;
                    case "DeleteMapping":
                        httpMethod = "DELETE";
                        methodPath = extractPath(ann);
                        consumes = extractAttribute(ann, "consumes");
                        produces = extractAttribute(ann, "produces");
                        break;
                    case "RequestMapping":
                        httpMethod = extractMethod(ann);
                        methodPath = extractPath(ann);
                        consumes = extractAttribute(ann, "consumes");
                        produces = extractAttribute(ann, "produces");
                        break;
                    default:
                        continue;
                }

                if (httpMethod != null) {
                    String fullPath = mergePaths(basePath, methodPath);
                    ObjectNode endpointNode = parseEndpoint(
                        method, httpMethod, fullPath, consumes, produces, fqn, sourceFile
                    );
                    if (endpointNode != null) {
                        endpointsNode.add(endpointNode);
                        totalEndpoints++;
                    }
                }
            }
        }

        if (endpointsNode.isEmpty()) return null;

        ObjectNode controllerNode = mapper.createObjectNode();
        controllerNode.put("fqn", fqn);
        controllerNode.put("simpleName", className);
        controllerNode.put("basePath", basePath);
        controllerNode.put("sourceFile", sourceFile.toString());
        controllerNode.set("endpoints", endpointsNode);

        return controllerNode;
    }

    private String extractClassBasePath(ClassOrInterfaceDeclaration cls) {
        for (AnnotationExpr ann : cls.getAnnotations()) {
            if ("RequestMapping".equals(ann.getNameAsString())) {
                String path = extractPath(ann);
                return path != null ? path : "";
            }
        }
        return "";
    }

    private ObjectNode parseEndpoint(MethodDeclaration method, String httpMethod,
                                      String fullPath, String consumes, String produces,
                                      String controllerFqn, Path sourceFile) {
        String methodName = method.getNameAsString();
        String endpointId = generateEndpointId(controllerFqn, httpMethod, fullPath);

        ArrayNode pathVars = mapper.createArrayNode();
        for (com.github.javaparser.ast.body.Parameter param : method.getParameters()) {
            for (AnnotationExpr ann : param.getAnnotations()) {
                if ("PathVariable".equals(ann.getNameAsString())) {
                    ObjectNode pv = mapper.createObjectNode();
                    String paramName = extractAnnotationValue(ann);
                    if (paramName == null || paramName.isEmpty()) {
                        paramName = param.getNameAsString();
                    }
                    pv.put("name", paramName);
                    pv.put("type", param.getTypeAsString());
                    pv.put("required", true);
                    pathVars.add(pv);
                }
            }
        }

        ArrayNode queryParams = mapper.createArrayNode();
        for (com.github.javaparser.ast.body.Parameter param : method.getParameters()) {
            for (AnnotationExpr ann : param.getAnnotations()) {
                if ("RequestParam".equals(ann.getNameAsString())) {
                    ObjectNode qp = mapper.createObjectNode();
                    String paramName = extractAnnotationValue(ann);
                    if (paramName == null || paramName.isEmpty()) {
                        paramName = param.getNameAsString();
                    }
                    qp.put("name", paramName);
                    qp.put("type", param.getTypeAsString());
                    boolean required = extractBooleanAttribute(ann, "required", true);
                    qp.put("required", required);
                    String defaultValue = extractAttribute(ann, "defaultValue");
                    if (defaultValue != null && !defaultValue.isEmpty() && !"\"\"".equals(defaultValue)) {
                        qp.put("defaultValue", defaultValue);
                    } else {
                        qp.putNull("defaultValue");
                    }
                    queryParams.add(qp);
                }
            }
        }

        String requestBodyFqn = null;
        for (com.github.javaparser.ast.body.Parameter param : method.getParameters()) {
            for (AnnotationExpr ann : param.getAnnotations()) {
                if ("RequestBody".equals(ann.getNameAsString())) {
                    requestBodyFqn = resolveTypeFqn(param.getType(), method);
                    break;
                }
            }
            if (requestBodyFqn != null) break;
        }

        ObjectNode endpoint = mapper.createObjectNode();
        endpoint.put("id", endpointId);
        endpoint.put("method", httpMethod);
        endpoint.put("fullPath", fullPath);
        endpoint.put("handlerMethod", methodName);
        endpoint.set("pathVariables", pathVars);
        endpoint.set("queryParams", queryParams);
        if (requestBodyFqn != null) {
            endpoint.put("requestBodyFqn", requestBodyFqn);
        } else {
            endpoint.putNull("requestBodyFqn");
        }

        ArrayNode consumesArr = mapper.createArrayNode();
        if (consumes != null && !consumes.isEmpty()) {
            for (String ct : consumes.split(",")) {
                consumesArr.add(ct.trim());
            }
        } else {
            consumesArr.add("application/json");
        }
        endpoint.set("consumes", consumesArr);

        ArrayNode producesArr = mapper.createArrayNode();
        if (produces != null && !produces.isEmpty()) {
            for (String pt : produces.split(",")) {
                producesArr.add(pt.trim());
            }
        } else {
            producesArr.add("application/json");
        }
        endpoint.set("produces", producesArr);

        endpoint.put("sourceFile", sourceFile.toString());
        endpoint.put("lineNumber", method.getBegin().map(pos -> pos.line).orElse(0));

        return endpoint;
    }

    private String extractPath(AnnotationExpr ann) {
        if (ann instanceof SingleMemberAnnotationExpr) {
            var value = ((SingleMemberAnnotationExpr) ann).getMemberValue();
            if (value instanceof StringLiteralExpr) {
                return ((StringLiteralExpr) value).getValue();
            }
            if (value instanceof ArrayInitializerExpr) {
                for (var e : ((ArrayInitializerExpr) value).getValues()) {
                    if (e instanceof StringLiteralExpr) {
                        return ((StringLiteralExpr) e).getValue();
                    }
                }
            }
        }
        if (ann instanceof NormalAnnotationExpr) {
            for (MemberValuePair pair : ((NormalAnnotationExpr) ann).getPairs()) {
                String name = pair.getNameAsString();
                if ("value".equals(name) || "path".equals(name)) {
                    if (pair.getValue() instanceof StringLiteralExpr) {
                        return ((StringLiteralExpr) pair.getValue()).getValue();
                    }
                    if (pair.getValue() instanceof ArrayInitializerExpr) {
                        for (var e : ((ArrayInitializerExpr) pair.getValue()).getValues()) {
                            if (e instanceof StringLiteralExpr) {
                                return ((StringLiteralExpr) e).getValue();
                            }
                        }
                    }
                }
            }
        }
        return "";
    }

    private String extractMethod(AnnotationExpr ann) {
        if (ann instanceof NormalAnnotationExpr) {
            for (MemberValuePair pair : ((NormalAnnotationExpr) ann).getPairs()) {
                if ("method".equals(pair.getNameAsString())) {
                    String value = extractAnnotationValueFromExpr(pair.getValue());
                    if (value != null && !value.isEmpty()) {
                        if (value.contains(".")) {
                            String[] parts = value.split("\\.");
                            return parts[parts.length - 1];
                        }
                        return value;
                    }
                }
            }
        }
        return null;
    }

    private String extractAttribute(AnnotationExpr ann, String attrName) {
        if (ann instanceof NormalAnnotationExpr) {
            for (MemberValuePair pair : ((NormalAnnotationExpr) ann).getPairs()) {
                if (attrName.equals(pair.getNameAsString())) {
                    return extractAnnotationValueFromExpr(pair.getValue());
                }
            }
        }
        return null;
    }

    private boolean extractBooleanAttribute(AnnotationExpr ann, String attrName, boolean defaultValue) {
        if (ann instanceof NormalAnnotationExpr) {
            for (MemberValuePair pair : ((NormalAnnotationExpr) ann).getPairs()) {
                if (attrName.equals(pair.getNameAsString())) {
                    String value = extractAnnotationValueFromExpr(pair.getValue());
                    return "true".equals(value);
                }
            }
        }
        return defaultValue;
    }

    private String extractAnnotationValue(AnnotationExpr ann) {
        if (ann instanceof SingleMemberAnnotationExpr) {
            var value = ((SingleMemberAnnotationExpr) ann).getMemberValue();
            return extractAnnotationValueFromExpr(value);
        }
        if (ann instanceof NormalAnnotationExpr) {
            for (MemberValuePair pair : ((NormalAnnotationExpr) ann).getPairs()) {
                if ("value".equals(pair.getNameAsString())) {
                    return extractAnnotationValueFromExpr(pair.getValue());
                }
            }
        }
        return null;
    }

    private String extractAnnotationValueFromExpr(com.github.javaparser.ast.expr.Expression expr) {
        if (expr instanceof StringLiteralExpr) {
            return ((StringLiteralExpr) expr).getValue();
        }
        if (expr instanceof com.github.javaparser.ast.expr.NameExpr) {
            return ((com.github.javaparser.ast.expr.NameExpr) expr).getNameAsString();
        }
        return expr.toString();
    }

    private String mergePaths(String basePath, String methodPath) {
        if (basePath == null || basePath.isEmpty()) return methodPath != null ? methodPath : "";
        if (methodPath == null || methodPath.isEmpty()) return basePath;

        String base = basePath.endsWith("/") ? basePath.substring(0, basePath.length() - 1) : basePath;
        String method = methodPath.startsWith("/") ? methodPath : "/" + methodPath;
        return base + method;
    }

    private String generateEndpointId(String controllerFqn, String httpMethod, String fullPath) {
        String input = controllerFqn + httpMethod + fullPath;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            return String.format("%016x", input.hashCode() & 0xFFFFFFFFL);
        }
    }

    private String computeProjectId(Path projectRoot) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(projectRoot.toAbsolutePath().toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            return String.format("%016x", projectRoot.hashCode() & 0xFFFFFFFFL);
        }
    }

    /**
     * Best-effort resolution of a parameter type to its fully qualified name.
     *
     * JavaParser's Type.resolve() requires a configured symbol solver; the scanner
     * does not set one up because that would mean loading every dependency JAR on
     * every scan. Instead we use a deterministic, low-cost fallback that handles
     * the common cases:
     *  1. java.* / primitive types — leave as-is (won't appear as @RequestBody DTOs)
     *  2. The type is in the same package as the declaring compilation unit
     *  3. The type matches a single-static-import or a regular import
     *  4. The type is an inner class referenced as Outer.Inner
     *  5. Last resort — use the source string (may be unqualified for same-package
     *     types whose package could not be determined; the DtoWalker handles simple
     *     names defensively)
     */
    private String resolveTypeFqn(com.github.javaparser.ast.type.Type type, com.github.javaparser.ast.body.MethodDeclaration method) {
        if (type == null) return null;
        String sourceType = type.asString();
        if (sourceType == null || sourceType.isEmpty()) return null;
        if (sourceType.startsWith("java.") || sourceType.startsWith("javax.") || sourceType.startsWith("jakarta.")) {
            return sourceType;
        }
        // Strip array / generic suffixes for the lookup
        String lookup = sourceType;
        int lt = lookup.indexOf('<');
        if (lt >= 0) lookup = lookup.substring(0, lt);
        int lb = lookup.indexOf('[');
        if (lb >= 0) lookup = lookup.substring(0, lb);
        lookup = lookup.trim();

        CompilationUnit cu = method.findCompilationUnit().orElse(null);
        String packageName = cu == null ? "" : cu.getPackageDeclaration()
            .map(pd -> pd.getNameAsString()).orElse("");

        // Inner class reference (Outer.Inner) — best effort, just return as-is
        if (lookup.contains(".")) {
            return sourceType;
        }

        if (cu != null) {
            // Check imports
            for (com.github.javaparser.ast.ImportDeclaration imp : cu.getImports()) {
                String impName = imp.getNameAsString();
                if (impName.endsWith("." + lookup) || impName.endsWith(".*")) {
                    // Wildcard import — can't resolve without symbol solver; return source string
                    if (impName.endsWith(".*")) return sourceType;
                    return impName;
                }
            }
            // Same-package class — qualify with current package
            if (!packageName.isEmpty()) {
                return packageName + "." + lookup;
            }
        }
        return sourceType;
    }
}
