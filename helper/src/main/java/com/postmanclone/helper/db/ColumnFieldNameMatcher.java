package com.postmanclone.helper.db;

import java.util.*;

public class ColumnFieldNameMatcher {

    public static Map<String, String> autoMap(List<String> dbColumns, List<String> dtoFields) {
        Map<String, String> mapping = new LinkedHashMap<>();
        Map<String, String> lowerDtoToField = new HashMap<>();
        for (String field : dtoFields) {
            lowerDtoToField.put(field.toLowerCase(), field);
        }

        for (String column : dbColumns) {
            String normalized = snakeToCamel(column);
            // Priority 1: exact case-insensitive match
            if (lowerDtoToField.containsKey(column.toLowerCase())) {
                mapping.put(column, lowerDtoToField.get(column.toLowerCase()));
                continue;
            }
            // Priority 2: snake_case → camelCase match
            if (lowerDtoToField.containsKey(normalized.toLowerCase())) {
                mapping.put(column, lowerDtoToField.get(normalized.toLowerCase()));
                continue;
            }
            // Priority 3: camelCase → snake_case match
            String snakeField = camelToSnake(column);
            if (lowerDtoToField.containsKey(snakeField.toLowerCase())) {
                mapping.put(column, lowerDtoToField.get(snakeField.toLowerCase()));
            }
        }

        return mapping;
    }

    static String snakeToCamel(String snake) {
        StringBuilder sb = new StringBuilder();
        boolean nextUpper = false;
        for (int i = 0; i < snake.length(); i++) {
            char c = snake.charAt(i);
            if (c == '_') {
                nextUpper = true;
            } else {
                sb.append(nextUpper ? Character.toUpperCase(c) : c);
                nextUpper = false;
            }
        }
        return sb.toString();
    }

    static String camelToSnake(String camel) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < camel.length(); i++) {
            char c = camel.charAt(i);
            if (Character.isUpperCase(c)) {
                if (i > 0) sb.append('_');
                sb.append(Character.toLowerCase(c));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
