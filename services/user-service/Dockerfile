FROM maven:3.9.6-amazoncorretto-21 AS build
WORKDIR /app

COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

# Optimized JVM settings for demo/low-memory environments
# -Xms128m: Initial heap 128MB
# -Xmx256m: Max heap 256MB  
# -XX:MaxMetaspaceSize=64m: Limit metaspace
# -XX:+UseSerialGC: Serial GC uses less memory than G1
# -XX:+TieredCompilation -XX:TieredStopAtLevel=1: Faster startup, less memory for JIT
ENV JAVA_TOOL_OPTIONS="-Xms128m -Xmx256m -XX:MaxMetaspaceSize=64m -XX:+UseSerialGC -XX:+TieredCompilation -XX:TieredStopAtLevel=1"

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
