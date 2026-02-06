FROM maven:3.9.8-eclipse-temurin-21 AS builder

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy

WORKDIR /app

COPY --from=builder /app/target/*.jar app.jar

# Optimized JVM settings for demo/low-memory environments
# -Xms128m: Initial heap 128MB
# -Xmx320m: Max heap 320MB (increased for Spring Boot)
# -XX:MaxMetaspaceSize=128m: Increased metaspace for Spring Boot
# -XX:+UseSerialGC: Serial GC uses less memory than G1
ENV JAVA_TOOL_OPTIONS="-Xms128m -Xmx320m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
