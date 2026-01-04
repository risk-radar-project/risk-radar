FROM maven:3.9.6-amazoncorretto-21 AS build
WORKDIR /app

COPY . .
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

ENV JAVA_TOOL_OPTIONS="-Xms256m -Xmx512m"

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
