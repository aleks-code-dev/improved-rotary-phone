package com.postmanclone.helper.dto;

import com.github.javaparser.ast.body.EnumDeclaration;

import java.util.stream.Collectors;

public class EnumCommentEmitter {

    public static String emitComment(EnumDeclaration enumDecl) {
        String values = enumDecl.getEntries().stream()
            .map(entry -> entry.getNameAsString())
            .collect(Collectors.joining(", "));
        return " // valid: " + values;
    }
}
