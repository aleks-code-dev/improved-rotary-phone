plugins {
    java
    application
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.fasterxml.jackson.core:jackson-databind:2.21.2")
    implementation("info.picocli:picocli:4.7.6")

    // DTO parsing
    implementation("com.github.javaparser:javaparser-core:3.28.1")
    implementation("com.github.javaparser:javaparser-symbol-solver-core:3.28.1")

    // Bytecode (Lombok fallback)
    implementation("org.ow2.asm:asm:9.7")

    // Database
    implementation("com.zaxxer:HikariCP:6.2.1")
    implementation("org.postgresql:postgresql:42.7.11")
    implementation("com.mysql:mysql-connector-j:9.1.0")
    implementation("com.h2database:h2:2.3.232")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

application {
    mainClass.set("com.postmanclone.helper.Main")
}

tasks.shadowJar {
    archiveBaseName.set("postmanclone-helper")
    archiveClassifier.set("")
    mergeServiceFiles()
}
