package com.postmanclone.helper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.postmanclone.helper.config.ParserConfig;
import com.postmanclone.helper.dto.DtoWalker;
import com.postmanclone.helper.db.DbConnectionManager;
import com.postmanclone.helper.db.TableEnumerator;
import com.postmanclone.helper.db.RowToJsonMapper;
import com.postmanclone.helper.db.ColumnFieldNameMatcher;
import com.postmanclone.helper.db.type.H2TypeNormalizer;
import com.postmanclone.helper.scanner.ClasspathResolver;
import com.postmanclone.helper.scanner.EndpointScanner;
import com.postmanclone.helper.scanner.GradleModuleDetector;
import com.postmanclone.helper.scanner.MavenModuleDetector;
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver;

import java.io.*;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class HelperJsonRpcServer {
    private final ObjectMapper mapper = new ObjectMapper();
    private final DbConnectionManager dbConnectionManager = new DbConnectionManager();
    private final TableEnumerator tableEnumerator = new TableEnumerator();
    private final RowToJsonMapper rowToJsonMapper = new RowToJsonMapper(new H2TypeNormalizer());
    private final Map<String, Object> initializeResult = Map.of(
        "jsonrpc", "2.0",
        "id", 1,
        "result", Map.of(
            "version", "0.1.0",
            "capabilities", new String[]{"initialize", "helper.ping", "classpath:walkDto", "scanner:scan", "scanner:rescan", "scanner:endpoints", "db:connect", "db:disconnect", "db:testConnection", "db:listTables"}
        )
    );

    public void run() {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter writer = new PrintWriter(System.out, true);

        try {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                try {
                    JsonNode request = mapper.readTree(line);
                    String method = request.has("method") ? request.get("method").asText() : "";
                    int id = request.has("id") ? request.get("id").asInt() : 0;

                    String response;
                    if ("initialize".equals(method)) {
                        response = mapper.writeValueAsString(
                            Map.of("jsonrpc", "2.0", "id", id,
                                   "result", Map.of("version", "0.1.0", "capabilities", new String[]{
                                       "initialize", "helper.ping", "classpath:walkDto",
                                       "scanner:scan", "scanner:rescan", "scanner:endpoints",
                                       "db:connect", "db:disconnect", "db:testConnection", "db:listTables",
                                       "db:fetchRows", "db:mapRowToDto"
                                   }))
                        );
                        writer.println(response);
                        writer.flush();
                        continue;
                    } else if ("helper.ping".equals(method)) {
                        // notification - no response
                        continue;
                    } else if ("shutdown".equals(method)) {
                        response = mapper.writeValueAsString(Map.of("jsonrpc", "2.0", "id", id, "result", "OK"));
                        writer.println(response);
                        writer.flush();
                        break;
                    } else if ("scanner:scan".equals(method) || "scanner:rescan".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String projectRoot = params.get("projectRoot").asText();
                            java.nio.file.Path projectPath = java.nio.file.Paths.get(projectRoot);
                            System.err.println("[helper] scanner:scan received, projectRoot=" + projectRoot);

                            EndpointScanner scanner = new EndpointScanner();
                            ObjectNode result = scanner.scan(projectPath);

                            System.err.println("[helper] scanner:scan done, ok=" + result.get("ok") + " files=" + result.get("totalFiles") + " endpoints=" + result.get("totalEndpoints"));
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "result", result
                            ));
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "Scan failed: " + e.getMessage())
                            ));
                        }
                    } else if ("scanner:endpoints".equals(method)) {
                        // Return empty endpoints - main process handles caching
                        try {
                            JsonNode params = request.get("params");
                            String projectId = params.has("projectId") ? params.get("projectId").asText() : "";
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "result", Map.of("ok", true, "controllers", new Object[0], "projectId", projectId)
                            ));
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "Endpoints fetch failed: " + e.getMessage())
                            ));
                        }
                    } else if ("classpath:walkDto".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String fqn = params.get("fqn").asText();
                            Path projectRoot = null;
                            List<Path> sourceRoots = new ArrayList<>();
                            if (params.has("projectRoot") && !params.get("projectRoot").asText().isEmpty()) {
                                projectRoot = Paths.get(params.get("projectRoot").asText());
                            }
                            if (params.has("classpathRoots")) {
                                for (JsonNode root : params.get("classpathRoots")) {
                                    sourceRoots.add(Paths.get(root.asText()));
                                }
                            }
                            if (sourceRoots.isEmpty() && projectRoot != null) {
                                sourceRoots = detectSourceRoots(projectRoot);
                            }
                            System.err.println("[helper] classpath:walkDto fqn=" + fqn + " projectRoot=" + projectRoot + " sourceRoots=" + sourceRoots);
                            CombinedTypeSolver solver = (projectRoot != null)
                                ? ClasspathResolver.createSolver(sourceRoots, projectRoot)
                                : ClasspathResolver.createSolver(sourceRoots);
                            DtoWalker walker = new DtoWalker(solver);
                            String bodyJson = walker.walk(fqn, sourceRoots, projectRoot);
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "result", bodyJson
                            ));
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "DTO walk failed: " + e.getMessage())
                            ));
                        }
                    } else if ("db:connect".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String connId = params.get("connId").asText();
                            String url = params.get("url").asText();
                            String user = params.get("user").asText();
                            String password = params.get("password").asText();
                            dbConnectionManager.connect(connId, url, user, password);
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "result", Map.of("status", "connected")
                            ));
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "DB connect failed: " + e.getMessage())
                            ));
                        }
                    } else if ("db:disconnect".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String connId = params.get("connId").asText();
                            dbConnectionManager.disconnect(connId);
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "result", Map.of("status", "disconnected")
                            ));
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "DB disconnect failed: " + e.getMessage())
                            ));
                        }
                    } else if ("db:testConnection".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String url = params.get("url").asText();
                            String user = params.get("user").asText();
                            String password = params.get("password").asText();
                            long start = System.currentTimeMillis();
                            boolean connected = dbConnectionManager.testConnection(url, user, password);
                            long latencyMs = System.currentTimeMillis() - start;
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "result", Map.of("connected", connected, "latencyMs", latencyMs)
                            ));
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "DB test failed: " + e.getMessage())
                            ));
                        }
                    } else if ("db:listTables".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String connId = params.get("connId").asText();
                            var pool = dbConnectionManager.getPool(connId);
                            if (pool == null) {
                                response = mapper.writeValueAsString(Map.of(
                                    "jsonrpc", "2.0", "id", id,
                                    "error", Map.of("code", -32603, "message", "Not connected")
                                ));
                            } else {
                                var tables = tableEnumerator.listTables(pool);
                                response = mapper.writeValueAsString(Map.of(
                                    "jsonrpc", "2.0", "id", id,
                                    "result", tables
                                ));
                            }
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "List tables failed: " + e.getMessage())
                            ));
                        }
                    } else if ("db:fetchRows".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String connId = params.get("connId").asText();
                            String tableName = params.get("tableName").asText();
                            String schema = params.has("schema") && !params.get("schema").isNull() ? params.get("schema").asText() : null;
                            String mode = params.has("mode") ? params.get("mode").asText() : "firstN";
                            String idValue = params.has("idValue") ? params.get("idValue").asText() : null;
                            String whereClause = params.has("whereClause") ? params.get("whereClause").asText() : null;
                            int limit = params.has("limit") ? params.get("limit").asInt() : 100;
                            var pool = dbConnectionManager.getPool(connId);
                            if (pool == null) {
                                response = mapper.writeValueAsString(Map.of(
                                    "jsonrpc", "2.0", "id", id,
                                    "error", Map.of("code", -32603, "message", "Not connected")
                                ));
                            } else {
                                var result = rowToJsonMapper.fetchRows(pool, tableName, schema, mode, idValue, whereClause, limit);
                                response = mapper.writeValueAsString(Map.of(
                                    "jsonrpc", "2.0", "id", id,
                                    "result", result
                                ));
                            }
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "Fetch rows failed: " + e.getMessage())
                            ));
                        }
                    } else if ("db:mapRowToDto".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String connId = params.get("connId").asText();
                            String tableName = params.get("tableName").asText();
                            Map<String, Object> rowId = mapper.convertValue(params.get("rowId"), Map.class);
                            String dtoFqn = params.get("dtoFqn").asText();
                            Map<String, String> columnMapping = params.has("columnMapping")
                                ? mapper.convertValue(params.get("columnMapping"), Map.class)
                                : new HashMap<>();
                            var pool = dbConnectionManager.getPool(connId);
                            if (pool == null) {
                                response = mapper.writeValueAsString(Map.of(
                                    "jsonrpc", "2.0", "id", id,
                                    "error", Map.of("code", -32603, "message", "Not connected")
                                ));
                            } else {
                                var result = rowToJsonMapper.mapRow(pool, tableName, rowId, dtoFqn, columnMapping);
                                response = mapper.writeValueAsString(Map.of(
                                    "jsonrpc", "2.0", "id", id,
                                    "result", result
                                ));
                            }
                        } catch (Exception e) {
                            response = mapper.writeValueAsString(Map.of(
                                "jsonrpc", "2.0", "id", id,
                                "error", Map.of("code", -32603, "message", "Map row failed: " + e.getMessage())
                            ));
                        }
                    } else {
                        response = mapper.writeValueAsString(Map.of(
                            "jsonrpc", "2.0", "id", id,
                            "error", Map.of("code", -32601, "message", "Method not found: " + method)
                        ));
                    }
                    writer.println(response);
                    writer.flush();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        } catch (IOException e) {
            // EOF reached
        }
    }

    private List<Path> detectSourceRoots(Path projectRoot) {
        List<Path> roots = MavenModuleDetector.findModuleRoots(projectRoot);
        if (!roots.isEmpty()) return roots;
        return GradleModuleDetector.findModuleRoots(projectRoot);
    }
}