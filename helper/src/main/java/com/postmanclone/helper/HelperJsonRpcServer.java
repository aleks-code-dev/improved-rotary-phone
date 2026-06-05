package com.postmanclone.helper;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.postmanclone.helper.config.ParserConfig;
import com.postmanclone.helper.dto.DtoWalker;
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
    private final Map<String, Object> initializeResult = Map.of(
        "jsonrpc", "2.0",
        "id", 1,
        "result", Map.of(
            "version", "0.1.0",
            "capabilities", new String[]{"initialize", "helper.ping", "classpath:walkDto"}
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
                                   "result", Map.of("version", "0.1.0", "capabilities", new String[]{"initialize", "helper.ping", "classpath:walkDto"}))
                        );
                    } else if ("helper.ping".equals(method)) {
                        // notification - no response
                        continue;
                    } else if ("shutdown".equals(method)) {
                        response = mapper.writeValueAsString(Map.of("jsonrpc", "2.0", "id", id, "result", "OK"));
                        writer.println(response);
                        writer.flush();
                        break;
                    } else if ("classpath:walkDto".equals(method)) {
                        try {
                            JsonNode params = request.get("params");
                            String fqn = params.get("fqn").asText();
                            List<Path> sourceRoots = new ArrayList<>();
                            if (params.has("classpathRoots")) {
                                for (JsonNode root : params.get("classpathRoots")) {
                                    sourceRoots.add(Paths.get(root.asText()));
                                }
                            }
                            CombinedTypeSolver solver = ParserConfig.createSolver(sourceRoots);
                            DtoWalker walker = new DtoWalker(solver);
                            String bodyJson = walker.walk(fqn, sourceRoots);
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
}