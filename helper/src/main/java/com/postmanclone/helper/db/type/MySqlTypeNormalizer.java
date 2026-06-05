package com.postmanclone.helper.db.type;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class MySqlTypeNormalizer implements TypeNormalizer {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Object normalize(ResultSet rs, int col, String typeName) throws SQLException {
        Object raw = rs.getObject(col);
        if (raw == null) return null;

        if ("JSON".equalsIgnoreCase(typeName)) {
            try {
                String jsonStr = raw instanceof String ? (String) raw : raw.toString();
                return mapper.readTree(jsonStr);
            } catch (Exception e) {
                return raw.toString();
            }
        }

        return raw;
    }
}
