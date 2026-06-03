package com.postmanclone.helper;

import picocli.CommandLine;
import picocli.CommandLine.Command;

import java.util.concurrent.Callable;

@Command(name = "postmanclone-helper", mixinStandardHelpOptions = true, version = "postmanclone-helper 0.1.0")
public class Main implements Callable<Integer> {
    @CommandLine.Option(names = {"--stdio"}, description = "Run in stdio mode (default)")
    boolean stdio = true;

    @CommandLine.Option(names = {"--version"}, description = "Print version")
    boolean version;

    @CommandLine.Option(names = {"--health"}, description = "Health check")
    boolean health;

    public static void main(String[] args) {
        System.exit(new CommandLine(new Main()).execute(args));
    }

    @Override
    public Integer call() {
        if (version) {
            System.out.println("postmanclone-helper 0.1.0");
            return 0;
        }
        if (health) {
            System.out.println("OK");
            return 0;
        }
        new HelperJsonRpcServer().run();
        return 0;
    }
}