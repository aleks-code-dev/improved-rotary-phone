package com.postmanclone.helper.db.type;

import java.sql.ResultSet;
import java.sql.SQLException;

public interface TypeNormalizer {
    Object normalize(ResultSet rs, int columnIndex, String columnTypeName) throws SQLException;
}
