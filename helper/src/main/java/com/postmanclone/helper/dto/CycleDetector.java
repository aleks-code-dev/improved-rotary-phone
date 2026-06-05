package com.postmanclone.helper.dto;

import java.util.HashSet;
import java.util.Set;

public class CycleDetector {
    private final Set<String> visited = new HashSet<>();
    private int depth = 0;
    private static final int MAX_DEPTH = 6;

    public void enter(String fqn) {
        visited.add(fqn);
        depth++;
    }

    public void leave(String fqn) {
        visited.remove(fqn);
        depth--;
    }

    public boolean shouldEmitRef(String fqn) {
        return visited.contains(fqn);
    }

    public boolean isDepthExceeded() {
        return depth > MAX_DEPTH;
    }

    public int getDepth() {
        return depth;
    }
}
