package com.postmanclone.helper.db.type;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.Reader;
import java.sql.Clob;
import java.sql.ResultSet;
import java.sql.SQLException;

public class OracleTypeNormalizer implements TypeNormalizer {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Object normalize(ResultSet rs, int col, String typeName) throws SQLException {
        Object raw = rs.getObject(col);
        if (raw == null) return null;

        if ("JSON".equalsIgnoreCase(typeName)) {
            try {
                String jsonStr;
                if (raw instanceof Clob clob) {
                    Reader reader = clob.getCharacterStream();
                    StringBuilder sb = new StringBuilder();
                    char[] buf = new char[4096];
                    int n;
                    while ((n = reader.read(buf)) != -1) sb.append(buf, 0, n);
                    jsonStr = sb.toString();
                } else {
                    jsonStr = raw.toString();
                }
                return mapper.readTree(jsonStr);
            } catch (Exception e) {
                return raw.toString();
            }
        }

        return raw;
    }
}
