package com.postmanclone.helper.scanner;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import com.github.javaparser.ast.nodeTypes.NodeWithAnnotations;
import com.github.javaparser.ast.stmt.Statement;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Scans a Spring project for @RestController and @Controller endpoints.
 * Extracts method-level metadata (HTTP verb, path, parameters, DTO types).
 */
public class EndpointScanner {

    private final CombinedTypeSolver solver;
    private final ObjectMapper mapper;
    private int totalFiles;
    private int totalEndpoints;
    private final List<String> errors;

    public EndpointScanner(CombinedTypeSolver solver) {
        this.solver = solver;
        this.mapper = new ObjectMapper();
        this.errors = new ArrayList<>();
        this.totalFiles = 0;
        this.totalEndpoints = 0;
    }

    /**
     * Scan a Spring project root for endpoints.
     * Returns an ObjectNode with the scan result.
     */
    public ObjectNode scan(Path projectRoot) {
        long startTime = System.currentTimeMillis();
        totalFiles = 0;
        totalEndpoints = 0;
        errors.clear();

        ObjectNode result = mapper.createObjectNode();
        ArrayNode controllers = mapper.createArrayNode();

        try {
            // Detect source roots (Maven or Gradle)
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

            // Walk all Java files in source roots
            for (Path sourceRoot : sourceRoots) {
                walkSourceRoot(sourceRoot, controllers);
            }

        } catch (Exception e) {
            errors.add("Scan failed: " + e.getMessage());
        }

        result.put("ok", true);
        result.put("projectId", computeProjectId(projectRoot));
        result.put("projectPath", projectRoot.toAbsolutePath().toString());
        result.set("controllers", controllers);
        result.put("scanDurationMs", System.currentTimeMillis() - startTime);
        result.put("totalFiles", totalFiles);
        result.put("totalEndpoints", totalEndpoints);
        result.set("errors", mapper.valueToTree(errors));

        return result;
    }

    private List<Path> findSourceRoots(Path projectRoot) {
        // Try Maven first
        List<Path> roots = MavenModuleDetector.findModuleRoots(projectRoot);
        if (!roots.isEmpty()) return roots;

        // Try Gradle
        roots = GradleModuleDetector.findModuleRoots(projectRoot);
        return roots;
    }

    private void walkSourceRoot(Path sourceRoot, ArrayNode controllers) throws IOException {
        if (!Files.exists(sourceRoot)) return;

        Files.walk(sourceRoot)
            .filter(Files::isRegularFile)
            .filter(Denylist::isJavaFile)
            .filter(p -> !Denylist.shouldSkip(p))
            .filter(p -> !Denylist.shouldSkipFile(p))
            .forEach(file -> {
                totalFiles++;
                try {
                    parseFile(file, controllers);
                } catch (Exception e) {
                    errors.add("Failed to parse " + file + ": " + e.getMessage());
                }
            });
    }

    private void parseFile(Path file, ArrayNode controllers) throws IOException {
        CompilationUnit cu = StaticJavaParser.parse(file);

        // Find all class declarations
        for (ClassOrInterfaceDeclaration cls : cu.findAll(ClassOrInterfaceDeclaration.class)) {
            // Check if this class is a REST controller
            if (!isRestController(cls)) continue;

            ObjectNode controllerNode = parseController(cls, file);
            if (controllerNode != null) {
                controllers.add(controllerNode);
            }
        }
    }

    private boolean isRestController(ClassOrInterfaceDeclaration cls) {
        return cls.getAnnotationByName("RestController").isPresent()
            || cls.getAnnotationByName("Controller").isPresent();
    }

    private ObjectNode parseController(ClassOrInterfaceDeclaration cls, Path sourceFile) {
        String className = cls.getNameAsString();
        String packageName = cls.findCompilationUnit()
            .flatMap(cu -> cu.getPackageDeclaration())
            .map(pd -> pd.getNameAsString())
            .orElse("");
        String fqn = packageName.isEmpty() ? className : packageName + "." + className;

        // Extract class-level @RequestMapping path
        String basePath = extractClassBasePath(cls);

        ArrayNode endpointsNode = mapper.createArrayNode();

        // Walk methods for endpoint annotations
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

        // Don't return controller if it has no endpoints
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

        // Extract path variables from method parameters
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

        // Extract query params from method parameters
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

        // Extract @RequestBody parameter type
        String requestBodyFqn = null;
        for (com.github.javaparser.ast.body.Parameter param : method.getParameters()) {
            for (AnnotationExpr ann : param.getAnnotations()) {
                if ("RequestBody".equals(ann.getNameAsString())) {
                    requestBodyFqn = resolveParamType(param);
                    break;
                }
            }
            if (requestBodyFqn != null) break;
        }

        // Build endpoint node
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

        // Consumes and produces
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

    private String resolveParamType(com.github.javaparser.ast.body.Parameter param) {
        try {
            return param.getTypeAsString();
        } catch (Exception e) {
            return param.getTypeAsString();
        }
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
                        // Handle RequestMethod.GET style
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

        // Ensure single slash between base and method paths
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
            // Fallback: use input hash code
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
}
