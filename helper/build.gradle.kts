plugins {
    java
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.fasterxml.jackson.core:jackson-databind:2.21.2")
    implementation("info.picocli:picocli:4.7.6")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

application {
    mainClass.set("com.postmanclone.helper.Main")
}

tasks.named<Jar>("jar") {
    manifest {
        attributes(
            "Main-Class" to "com.postmanclone.helper.Main",
            "Class-Path" to configurations.getByName("runtimeClasspath").files.joinToString(" ") { it.name }
        )
    }
}