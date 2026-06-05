package com.postmanclone.helper.dto;

import com.github.javaparser.resolution.types.ResolvedType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.UUID;

public class PlaceholderFactory {

    public static String forType(ResolvedType type) {
        if (type == null) {
            return "<object>";
        }

        String name = type.describe();

        if (type.isPrimitive()) {
            String prim = type.asPrimitive().describe();
            if ("boolean".equals(prim)) return "<boolean>";
            if ("int".equals(prim) || "long".equals(prim) || "double".equals(prim)
                || "float".equals(prim) || "short".equals(prim) || "byte".equals(prim)) {
                return "<number>";
            }
            if ("char".equals(prim)) return "<string>";
        }

        if (type.isReferenceType()) {
            String fqn = type.asReferenceType().getQualifiedName();

            if ("java.lang.String".equals(fqn)) return "<string>";
            if ("java.lang.Boolean".equals(fqn)) return "<boolean>";
            if ("java.lang.Integer".equals(fqn) || "java.lang.Long".equals(fqn)
                || "java.lang.Double".equals(fqn) || "java.lang.Float".equals(fqn)
                || "java.lang.Short".equals(fqn) || "java.lang.Byte".equals(fqn)) {
                return "<number>";
            }
            if ("java.math.BigDecimal".equals(fqn) || "java.math.BigInteger".equals(fqn)) {
                return "<number>";
            }
            if ("java.util.UUID".equals(fqn)) return "<uuid>";
            if ("java.time.LocalDate".equals(fqn)) return "<date>";
            if ("java.time.LocalDateTime".equals(fqn) || "java.time.Instant".equals(fqn)
                || "java.util.Date".equals(fqn)) {
                return "<datetime>";
            }
        }

        return "<object>";
    }
}
