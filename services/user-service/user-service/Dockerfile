# First stage: Build the application
FROM maven:3.9.6-amazoncorretto-21 AS build
WORKDIR /app

COPY pom.xml .
RUN mvn clean install -U

COPY src ./src
RUN mvn clean package -DskipTests

# Second stage: Run the application
FROM openjdk:21-jdk-slim
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]