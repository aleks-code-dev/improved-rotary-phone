package com.postmanclone.helper.dto;

import com.github.javaparser.resolution.types.ResolvedType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

public class PlaceholderFactory {

    private static final String[] SAMPLE_STRINGS = {
        "lorem ipsum", "dolor sit amet", "consectetur adipiscing", "tempor incididunt",
        "labore et dolore", "magna aliqua", "enim ad minim", "veniam quis nostrud",
        "exercitation ullamco", "laboris nisi ut", "aliquip ex ea", "commodo consequat"
    };

    public static String forType(ResolvedType type) {
        if (type == null) {
            return "{}";
        }

        if (type.isPrimitive()) {
            String prim = type.asPrimitive().describe();
            if ("boolean".equals(prim)) return String.valueOf(ThreadLocalRandom.current().nextBoolean());
            if ("int".equals(prim)) return String.valueOf(ThreadLocalRandom.current().nextInt(1, 1000));
            if ("long".equals(prim)) return String.valueOf(ThreadLocalRandom.current().nextLong(1, 100000));
            if ("double".equals(prim)) return String.valueOf(ThreadLocalRandom.current().nextDouble(0, 100));
            if ("float".equals(prim)) return String.valueOf(ThreadLocalRandom.current().nextFloat() * 100);
            if ("short".equals(prim)) return String.valueOf((short) ThreadLocalRandom.current().nextInt(1, 1000));
            if ("byte".equals(prim)) return String.valueOf((byte) ThreadLocalRandom.current().nextInt(1, 127));
            if ("char".equals(prim)) return String.valueOf((char) ThreadLocalRandom.current().nextInt('a', 'z' + 1));
        }

        if (type.isReferenceType()) {
            String fqn = type.asReferenceType().getQualifiedName();

            if ("java.lang.String".equals(fqn)) return SAMPLE_STRINGS[ThreadLocalRandom.current().nextInt(SAMPLE_STRINGS.length)];
            if ("java.lang.Boolean".equals(fqn)) return String.valueOf(ThreadLocalRandom.current().nextBoolean());
            if ("java.lang.Integer".equals(fqn)) return String.valueOf(ThreadLocalRandom.current().nextInt(1, 1000));
            if ("java.lang.Long".equals(fqn)) return String.valueOf(ThreadLocalRandom.current().nextLong(1, 100000));
            if ("java.lang.Double".equals(fqn)) return String.valueOf(ThreadLocalRandom.current().nextDouble(0, 100));
            if ("java.lang.Float".equals(fqn)) return String.valueOf(ThreadLocalRandom.current().nextFloat() * 100);
            if ("java.lang.Short".equals(fqn)) return String.valueOf((short) ThreadLocalRandom.current().nextInt(1, 1000));
            if ("java.lang.Byte".equals(fqn)) return String.valueOf((byte) ThreadLocalRandom.current().nextInt(1, 127));
            if ("java.math.BigDecimal".equals(fqn)) return new BigDecimal(ThreadLocalRandom.current().nextDouble(0, 1000)).setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
            if ("java.math.BigInteger".equals(fqn)) return String.valueOf(ThreadLocalRandom.current().nextLong(1, 1000000));
            if ("java.util.UUID".equals(fqn)) return UUID.randomUUID().toString();
            if ("java.time.LocalDate".equals(fqn)) {
                long randomEpochDay = ThreadLocalRandom.current().nextLong(
                    LocalDate.of(2020, 1, 1).toEpochDay(),
                    LocalDate.of(2026, 12, 31).toEpochDay()
                );
                return LocalDate.ofEpochDay(randomEpochDay).toString();
            }
            if ("java.time.LocalDateTime".equals(fqn) || "java.time.Instant".equals(fqn)
                || "java.util.Date".equals(fqn)) {
                long randomMillis = ThreadLocalRandom.current().nextLong(
                    LocalDate.of(2020, 1, 1).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli(),
                    LocalDate.of(2026, 12, 31).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
                );
                return Instant.ofEpochMilli(randomMillis).toString();
            }
        }

        return "<object>";
    }
}
