package com.postmanclone.helper.db.type;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class PostgresTypeNormalizer implements TypeNormalizer {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Object normalize(ResultSet rs, int col, String typeName) throws SQLException {
        Object raw = rs.getObject(col);
        if (raw == null) return null;

        String className = raw.getClass().getName();
        if (className.equals("org.postgresql.util.PGobject")) {
            try {
                var pg = (org.postgresql.util.PGobject) raw;
                String pgType = pg.getType();
                if ("json".equals(pgType) || "jsonb".equals(pgType)) {
                    return mapper.readTree(pg.getValue());
                }
                return pg.getValue();
            } catch (Exception e) {
                return raw.toString();
            }
        }

        return raw;
    }
}
