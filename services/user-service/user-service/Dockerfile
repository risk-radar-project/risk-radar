# First stage: Build the application
FROM maven:3.9.6-amazoncorretto-21 AS build
WORKDIR /app

COPY . .
RUN mvn clean package -DskipTests

COPY src ./src
RUN mvn clean package -DskipTests

# Second stage: Run the application
FROM openjdk:21-jdk-slim
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

EXPOSE 8080
ENTRYPOINT ["/wait-for-it.sh", "postgres:5432", "--", "java", "-jar", "app.jar"]