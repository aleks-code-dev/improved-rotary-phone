package com.postmanclone.helper.db;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.postmanclone.helper.db.type.TypeNormalizer;
import com.zaxxer.hikari.HikariDataSource;

import java.sql.*;
import java.util.*;

public class RowToJsonMapper {
    private final TypeNormalizer normalizer;
    private final ObjectMapper mapper = new ObjectMapper();

    public RowToJsonMapper(TypeNormalizer normalizer) {
        this.normalizer = normalizer;
    }

    public Map<String, Object> fetchRows(HikariDataSource pool, String tableName, String schema,
                                          String mode, String idValue, String whereClause, int limit) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<Map<String, Object>> columns = new ArrayList<>();
        boolean truncated = false;
        int totalCount = 0;

        limit = Math.min(limit, 100);

        try (Connection conn = pool.getConnection()) {
            // Get column metadata
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet colRs = meta.getColumns(null, schema, tableName, "%")) {
                while (colRs.next()) {
                    Map<String, Object> col = new LinkedHashMap<>();
                    col.put("name", colRs.getString("COLUMN_NAME"));
                    col.put("typeName", colRs.getString("TYPE_NAME"));
                    col.put("nullable", colRs.getInt("NULLABLE") == DatabaseMetaData.columnNullable);
                    columns.add(col);
                }
            }

            // Build and execute query
            String sql;
            PreparedStatement stmt;

            switch (mode) {
                case "byId":
                    sql = "SELECT * FROM \"" + tableName + "\" WHERE \"id\" = ? LIMIT ?";
                    stmt = conn.prepareStatement(sql);
                    stmt.setString(1, idValue);
                    stmt.setInt(2, limit);
                    break;
                case "byWhere":
                    if (whereClause != null && (whereClause.contains(";") || containsDestructiveKeywords(whereClause))) {
                        throw new SQLException("Invalid WHERE clause: contains destructive keywords or semicolons");
                    }
                    sql = "SELECT * FROM \"" + tableName + "\" WHERE " + (whereClause != null ? whereClause : "1=1") + " LIMIT ?";
                    stmt = conn.prepareStatement(sql);
                    stmt.setInt(1, limit);
                    break;
                default: // firstN
                    sql = "SELECT * FROM \"" + tableName + "\" LIMIT ?";
                    stmt = conn.prepareStatement(sql);
                    stmt.setInt(1, limit);
                    break;
            }

            stmt.setFetchSize(50);
            try (ResultSet rs = stmt.executeQuery()) {
                ResultSetMetaData rsMeta = rs.getMetaData();
                int colCount = rsMeta.getColumnCount();

                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                        String colName = rsMeta.getColumnName(i);
                        String typeName = rsMeta.getColumnTypeName(i);
                        Object value = normalizer.normalize(rs, i, typeName);
                        row.put(colName, value);
                    }
                    rows.add(row);
                }
            }

            // Get total count
            try (Statement countStmt = conn.createStatement();
                 ResultSet countRs = countStmt.executeQuery("SELECT COUNT(*) FROM \"" + tableName + "\"")) {
                if (countRs.next()) {
                    totalCount = countRs.getInt(1);
                    if (totalCount > 10000) totalCount = 10000;
                }
            } catch (SQLException e) {
                // Count may fail — skip
            }

            truncated = rows.size() >= limit && totalCount > limit;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rows", rows);
        result.put("columns", columns);
        result.put("truncated", truncated);
        result.put("totalCount", totalCount);
        return result;
    }

    public Map<String, Object> mapRow(HikariDataSource pool, String tableName, Map<String, Object> rowId,
                                       String dtoFqn, Map<String, String> columnMapping) throws SQLException {
        // Fetch the specific row — prefer primary key columns for the WHERE clause
        StringBuilder sql = new StringBuilder("SELECT * FROM \"" + tableName + "\" WHERE ");
        List<Object> params = new ArrayList<>();

        try (Connection conn = pool.getConnection()) {
            // Try to find primary key columns
            List<String> pkColumns = new ArrayList<>();
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet pkRs = meta.getPrimaryKeys(null, null, tableName)) {
                while (pkRs.next()) {
                    pkColumns.add(pkRs.getString("COLUMN_NAME"));
                }
            }

            // Use PK columns if found and all present in rowId, otherwise use all rowId columns
            List<String> whereColumns;
            if (!pkColumns.isEmpty() && rowId.keySet().containsAll(pkColumns)) {
                whereColumns = pkColumns;
            } else {
                whereColumns = new ArrayList<>(rowId.keySet());
            }

            int idx = 0;
            for (String col : whereColumns) {
                if (idx > 0) sql.append(" AND ");
                sql.append("\"").append(col).append("\" = ?");
                Object val = rowId.get(col);
                params.add(val);
                idx++;
            }

            ObjectNode bodyNode = mapper.createObjectNode();
            List<Map<String, Object>> mappingResult = new ArrayList<>();
            int mapped = 0, required = 0, total = 0;

            try (PreparedStatement stmt = conn.prepareStatement(sql.toString())) {
                for (int i = 0; i < params.size(); i++) {
                    stmt.setObject(i + 1, params.get(i));
                }
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        ResultSetMetaData rsMeta = rs.getMetaData();
                        int colCount = rsMeta.getColumnCount();

                        // Build column name set
                        List<String> dbColumns = new ArrayList<>();
                        Map<String, Integer> colIndexMap = new HashMap<>();
                        for (int i = 1; i <= colCount; i++) {
                            String colName = rsMeta.getColumnName(i);
                            dbColumns.add(colName);
                            colIndexMap.put(colName, i);
                        }

                        // Apply mapping — if no explicit mapping, auto-map all columns to camelCase
                        Set<String> mappedColumns = new HashSet<>();
                        if (columnMapping.isEmpty()) {
                            for (String dbCol : dbColumns) {
                                columnMapping.put(dbCol, ColumnFieldNameMatcher.snakeToCamel(dbCol));
                            }
                        }
                        for (Map.Entry<String, String> entry : columnMapping.entrySet()) {
                            String dbCol = entry.getKey();
                            String dtoField = entry.getValue();
                            if ("__none__".equals(dtoField)) continue;

                            Integer colIdx = colIndexMap.get(dbCol);
                            if (colIdx == null) continue;

                            String typeName = rsMeta.getColumnTypeName(colIdx);
                            Object value = normalizer.normalize(rs, colIdx, typeName);
                            bodyNode.put(dtoField, value != null ? value.toString() : null);
                            mappedColumns.add(dbCol);

                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("column", dbCol);
                            m.put("field", dtoField);
                            m.put("compatibility", "exact");
                            mappingResult.add(m);
                        }

                        mapped = mappedColumns.size();
                        total = colCount;
                    }
                }
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("ok", true);
            String bodyJson;
            try {
                bodyJson = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(bodyNode);
            } catch (Exception e) {
                bodyJson = bodyNode.toString();
            }
            result.put("bodyJson", bodyJson);
            result.put("mapping", mappingResult);

            Map<String, Object> coverage = new LinkedHashMap<>();
            coverage.put("mapped", mapped);
            coverage.put("required", required);
            coverage.put("total", total);
            result.put("coverage", coverage);
            result.put("warnings", Collections.emptyList());

            return result;
        }
    }

    private boolean containsDestructiveKeywords(String clause) {
        String upper = clause.toUpperCase();
        return upper.contains("DROP ") || upper.contains("DELETE ") ||
               upper.contains("UPDATE ") || upper.contains("INSERT ") ||
               upper.contains("ALTER ") || upper.contains("TRUNCATE ");
    }
}
