package com.postmanclone.helper.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.EnumDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import com.github.javaparser.ast.body.RecordDeclaration;
import com.github.javaparser.ast.body.TypeDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.type.Type;
import com.github.javaparser.resolution.types.ResolvedType;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class DtoWalker {
    private final CombinedTypeSolver solver;
    private final CycleDetector cycleDetector;
    private final ObjectMapper mapper;

    public DtoWalker(CombinedTypeSolver solver) {
        this.solver = solver;
        this.cycleDetector = new CycleDetector();
        this.mapper = new ObjectMapper();
    }

    public String walk(String fqn, List<Path> classpathRoots) throws IOException {
        return walk(fqn, classpathRoots, null);
    }

    public String walk(String fqn, List<Path> classpathRoots, Path projectRoot) throws IOException {
        this.projectRoot = projectRoot;
        ObjectNode root = walkType(fqn, classpathRoots);
        return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    private Path projectRoot;

    private ObjectNode walkType(String fqn, List<Path> classpathRoots) throws IOException {
        if (cycleDetector.shouldEmitRef(fqn)) {
            ObjectNode ref = mapper.createObjectNode();
            ref.put("$ref", shortName(fqn));
            return ref;
        }
        if (cycleDetector.isDepthExceeded()) {
            ObjectNode exceeded = mapper.createObjectNode();
            exceeded.put("_cycle_depth_exceeded", true);
            return exceeded;
        }

        Path sourceFile = findSourceFile(fqn, classpathRoots);
        if (sourceFile == null || !Files.exists(sourceFile)) {
            ObjectNode unresolved = mapper.createObjectNode();
            unresolved.put("_unresolved_type", shortName(fqn));
            return unresolved;
        }

        cycleDetector.enter(fqn);
        try {
            CompilationUnit cu = StaticJavaParser.parse(sourceFile);
            Optional<TypeDeclaration> typeOpt = cu.findFirst(TypeDeclaration.class,
                t -> t.getNameAsString().equals(shortName(fqn)));

            if (typeOpt.isEmpty()) {
                ObjectNode unresolved = mapper.createObjectNode();
                unresolved.put("_unresolved_type", shortName(fqn));
                return unresolved;
            }

            TypeDeclaration typeDecl = typeOpt.get();

            if (typeDecl.isEnumDeclaration()) {
                return walkEnum(typeDecl.asEnumDeclaration());
            }

            if (typeDecl.isRecordDeclaration()) {
                return walkRecord(typeDecl.asRecordDeclaration(), classpathRoots);
            }

            return walkClass(typeDecl.asClassOrInterfaceDeclaration(), classpathRoots);
        } finally {
            cycleDetector.leave(fqn);
        }
    }

    private ObjectNode walkEnum(EnumDeclaration enumDecl) {
        ObjectNode node = mapper.createObjectNode();
        String firstValue = enumDecl.getEntries().isEmpty()
            ? "UNKNOWN"
            : enumDecl.getEntries().get(0).getNameAsString();
        node.put(enumDecl.getNameAsString(), firstValue);
        return node;
    }

    private ObjectNode walkRecord(RecordDeclaration record, List<Path> classpathRoots) throws IOException {
        ObjectNode node = mapper.createObjectNode();
        for (Parameter param : record.getParameters()) {
            String paramName = param.getNameAsString();
            Type paramType = param.getType();
            String fieldName = getJsonFieldName(param.getAnnotations(), paramName);

            ResolvedType resolved = resolveType(paramType);
            if (resolved != null) {
                node.set(fieldName, resolveValue(resolved, classpathRoots));
            } else {
                node.put(fieldName, "<object>");
            }
        }
        return node;
    }

    private ObjectNode walkClass(ClassOrInterfaceDeclaration cls, List<Path> classpathRoots) throws IOException {
        ObjectNode node = mapper.createObjectNode();

        // Check for Lombok annotations — walk constructor params if present
        boolean hasLombok = cls.getAnnotationByName("Value").isPresent()
            || cls.getAnnotationByName("Data").isPresent()
            || cls.getAnnotationByName("AllArgsConstructor").isPresent();

        boolean hasGetterPattern = cls.getMethods().stream()
            .anyMatch(m -> m.getNameAsString().startsWith("get") || m.getNameAsString().startsWith("is"));

        if (hasLombok && !hasGetterPattern) {
            // Lombok: walk fields directly
            for (FieldDeclaration field : cls.getFields()) {
                if (field.isStatic()) continue;
                for (VariableDeclarator var : field.getVariables()) {
                    String fieldName = var.getNameAsString();
                    String jsonName = getJsonFieldName(field.getAnnotations(), fieldName);
                    ResolvedType resolved = resolveType(var.getType());
                    if (resolved != null) {
                        node.set(jsonName, resolveValue(resolved, classpathRoots));
                    } else {
                        node.put(jsonName, "<object>");
                    }
                }
            }
        } else {
            // Standard: walk getters
            Set<String> addedFields = new HashSet<>();
            for (MethodDeclaration method : cls.getMethods()) {
                if (!method.getParameters().isEmpty()) continue;
                if (method.isStatic()) continue;
                String methodName = method.getNameAsString();
                String fieldName = null;

                if (methodName.startsWith("get") && methodName.length() > 3) {
                    fieldName = Character.toLowerCase(methodName.charAt(3)) + methodName.substring(4);
                } else if (methodName.startsWith("is") && methodName.length() > 2) {
                    fieldName = Character.toLowerCase(methodName.charAt(2)) + methodName.substring(2);
                }

                if (fieldName == null) continue;
                if (addedFields.contains(fieldName)) continue;

                String jsonName = getJsonFieldName(method.getAnnotations(), fieldName);
                ResolvedType resolved = resolveType(method.getType());
                if (resolved != null) {
                    node.set(jsonName, resolveValue(resolved, classpathRoots));
                } else {
                    node.put(jsonName, "<object>");
                }
                addedFields.add(fieldName);
            }

            // Fallback: if no getters found, walk fields
            if (addedFields.isEmpty()) {
                for (FieldDeclaration field : cls.getFields()) {
                    if (field.isStatic()) continue;
                    for (VariableDeclarator var : field.getVariables()) {
                        String fieldName = var.getNameAsString();
                        String jsonName = getJsonFieldName(field.getAnnotations(), fieldName);
                        ResolvedType resolved = resolveType(var.getType());
                        if (resolved != null) {
                            node.set(jsonName, resolveValue(resolved, classpathRoots));
                        } else {
                            node.put(jsonName, "<object>");
                        }
                    }
                }
            }
        }

        return node;
    }

    private JsonNode resolveValue(ResolvedType resolved, List<Path> classpathRoots) throws IOException {
        if (resolved == null) {
            return TextNode.valueOf("<object>");
        }

        // Check for cycle on reference types
        if (resolved.isReferenceType()) {
            String fqn = resolved.asReferenceType().getQualifiedName();

            // Handle Optional<T>
            if ("java.util.Optional".equals(fqn)) {
                List<ResolvedType> typeParams = resolved.asReferenceType().typeParametersValues();
                if (!typeParams.isEmpty()) {
                    ResolvedType inner = typeParams.get(0);
                    JsonNode innerVal = resolveValue(inner, classpathRoots);
                    // Return inner value (Optional fields are included, not omitted per D-07)
                    return innerVal;
                }
                return TextNode.valueOf("<object>");
            }

            // Handle collections
            if ("java.util.List".equals(fqn) || "java.util.Set".equals(fqn)
                || "java.util.Collection".equals(fqn)) {
                List<ResolvedType> typeParams = resolved.asReferenceType().typeParametersValues();
                ArrayNode arr = mapper.createArrayNode();
                if (!typeParams.isEmpty()) {
                    arr.add(resolveValue(typeParams.get(0), classpathRoots));
                } else {
                    arr.add(TextNode.valueOf("<object>"));
                }
                return arr;
            }

            // Handle Map<K,V>
            if ("java.util.Map".equals(fqn)) {
                List<ResolvedType> typeParams = resolved.asReferenceType().typeParametersValues();
                ObjectNode map = mapper.createObjectNode();
                String key = typeParams.size() > 0 ? PlaceholderFactory.forType(typeParams.get(0)) : "<key>";
                if (typeParams.size() > 1) {
                    map.set(stripAngleBrackets(key), resolveValue(typeParams.get(1), classpathRoots));
                } else {
                    map.put(stripAngleBrackets(key), "<value>");
                }
                return map;
            }

            // Handle primitive wrapper types
            String placeholder = PlaceholderFactory.forType(resolved);
            if (!"<object>".equals(placeholder)) {
                return TextNode.valueOf(placeholder);
            }

            // Nested DTO — recursive walk
            return walkType(fqn, classpathRoots);
        }

        // Primitive types
        String placeholder = PlaceholderFactory.forType(resolved);
        return TextNode.valueOf(placeholder);
    }

    private String getJsonFieldName(List<?> annotations, String defaultName) {
        for (Object ann : annotations) {
            if (ann instanceof com.github.javaparser.ast.expr.AnnotationExpr) {
                String annStr = ((com.github.javaparser.ast.expr.AnnotationExpr) ann).getNameAsString();
                if ("JsonProperty".equals(annStr)) {
                    // Try to extract value
                    String annText = ann.toString();
                    int start = annText.indexOf('"');
                    int end = annText.lastIndexOf('"');
                    if (start >= 0 && end > start) {
                        return annText.substring(start + 1, end);
                    }
                }
            }
        }
        return defaultName;
    }

    private ResolvedType resolveType(Type type) {
        try {
            return type.resolve();
        } catch (Exception e) {
            return null;
        }
    }

    private static final Set<String> SKIP_DIRS = Set.of(
        ".git", "node_modules", "target", "build", "out", "dist",
        ".gradle", ".idea", ".vscode", "bin", "obj", ".mvn", "gradle", ".m2"
    );

    private Path findSourceFile(String fqn, List<Path> classpathRoots) {
        String relativePath = fqn.replace('.', '/') + ".java";
        for (Path root : classpathRoots) {
            Path candidate = root.resolve(relativePath);
            if (Files.exists(candidate)) {
                return candidate;
            }
        }
        // Fallback: bounded project-wide search so non-standard layouts
        // (custom Gradle source sets, mixed Kotlin/Java, plugin-generated
        // sources in build/...) still resolve. Bounded by depth + file count.
        if (projectRoot != null && Files.exists(projectRoot)) {
            Path found = scanForSourceFile(projectRoot, relativePath, fqn);
            if (found != null) return found;
        }
        System.err.println("[dto-walker] Could not find source for " + fqn + " (tried roots=" + classpathRoots + ", projectRoot=" + projectRoot + ")");
        return null;
    }

    private Path scanForSourceFile(Path root, String relativePath, String fqn) {
        Path[] result = new Path[1];
        try {
            java.nio.file.FileVisitor<Path> visitor = new java.nio.file.SimpleFileVisitor<>() {
                int visited = 0;
                @Override
                public java.nio.file.FileVisitResult preVisitDirectory(Path dir, java.nio.file.attribute.BasicFileAttributes attrs) {
                    String name = dir.getFileName() == null ? "" : dir.getFileName().toString();
                    if (SKIP_DIRS.contains(name)) {
                        return java.nio.file.FileVisitResult.SKIP_SUBTREE;
                    }
                    return java.nio.file.FileVisitResult.CONTINUE;
                }
                @Override
                public java.nio.file.FileVisitResult visitFile(Path file, java.nio.file.attribute.BasicFileAttributes attrs) {
                    if (result[0] != null) return java.nio.file.FileVisitResult.TERMINATE;
                    if (++visited > 50000) {
                        System.err.println("[dto-walker] Fallback search hit 50k file cap, giving up for " + fqn);
                        return java.nio.file.FileVisitResult.TERMINATE;
                    }
                    Path fileName = file.getFileName();
                    if (fileName != null && fileName.toString().equals(relativePath.substring(relativePath.lastIndexOf('/') + 1))) {
                        Path parent = file.getParent();
                        StringBuilder sb = new StringBuilder();
                        for (int i = parent.getNameCount() - 1; i >= 0; i--) {
                            sb.insert(0, "/").insert(0, parent.getName(i).toString());
                        }
                        String dirPath = sb.length() > 0 ? sb.substring(1) : "";
                        if (dirPath.equals(relativePath.substring(0, relativePath.lastIndexOf('/')).replace('/', java.io.File.separatorChar))
                            || dirPath.equals(relativePath.substring(0, relativePath.lastIndexOf('/')))) {
                            result[0] = file;
                            return java.nio.file.FileVisitResult.TERMINATE;
                        }
                    }
                    return java.nio.file.FileVisitResult.CONTINUE;
                }
            };
            java.nio.file.Files.walkFileTree(root, java.util.EnumSet.noneOf(java.nio.file.FileVisitOption.class), 30, visitor);
        } catch (IOException e) {
            System.err.println("[dto-walker] Fallback search I/O error: " + e.getMessage());
        }
        if (result[0] != null) {
            System.err.println("[dto-walker] Fallback resolved " + fqn + " -> " + result[0]);
        }
        return result[0];
    }

    private String shortName(String fqn) {
        int lastDot = fqn.lastIndexOf('.');
        return lastDot >= 0 ? fqn.substring(lastDot + 1) : fqn;
    }

    private String stripAngleBrackets(String s) {
        if (s.startsWith("<") && s.endsWith(">")) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }
}
