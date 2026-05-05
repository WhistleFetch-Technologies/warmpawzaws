# Build context: this directory (services/delivery-service)
#   docker build -t delivery-service:dev .
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /build
COPY pom.xml mvnw mvnw.cmd ./
COPY .mvn .mvn
COPY src ./src
RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /build/target/delivery-service-*.jar /app/app.jar
EXPOSE 8082
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT exec java $JAVA_OPTS -jar /app/app.jar
