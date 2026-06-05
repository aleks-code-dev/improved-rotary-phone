package com.postmanclone.helper.db;

import com.zaxxer.hikari.HikariDataSource;

import java.sql.*;
import java.util.*;

public class TableEnumerator {

    public List<Map<String, Object>> listTables(HikariDataSource pool) throws SQLException {
        List<Map<String, Object>> tables = new ArrayList<>();
        try (Connection conn = pool.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getTables(null, null, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    String schema = rs.getString("TABLE_SCHEM");

                    int columnCount = 0;
                    try (ResultSet cols = meta.getColumns(null, null, tableName, "%")) {
                        while (cols.next()) columnCount++;
                    }

                    int rowCount = 0;
                    try (Statement stmt = conn.createStatement();
                         ResultSet countRs = stmt.executeQuery("SELECT COUNT(*) FROM \"" + tableName + "\"")) {
                        if (countRs.next()) {
                            rowCount = countRs.getInt(1);
                            if (rowCount > 10000) rowCount = 10000;
                        }
                    } catch (SQLException e) {
                        // Count query may fail for views or permission issues — skip
                    }

                    Map<String, Object> table = new LinkedHashMap<>();
                    table.put("name", tableName);
                    table.put("schema", schema);
                    table.put("columnCount", columnCount);
                    table.put("rowCountEstimate", rowCount);
                    tables.add(table);
                }
            }
        }
        return tables;
    }

    public List<Map<String, Object>> listColumns(HikariDataSource pool, String tableName) throws SQLException {
        List<Map<String, Object>> columns = new ArrayList<>();
        try (Connection conn = pool.getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            try (ResultSet rs = meta.getColumns(null, null, tableName, "%")) {
                while (rs.next()) {
                    Map<String, Object> col = new LinkedHashMap<>();
                    col.put("name", rs.getString("COLUMN_NAME"));
                    col.put("typeName", rs.getString("TYPE_NAME"));
                    col.put("nullable", rs.getInt("NULLABLE") == DatabaseMetaData.columnNullable);
                    columns.add(col);
                }
            }
        }
        return columns;
    }
}
