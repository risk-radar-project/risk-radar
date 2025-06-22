FROM python:3.9-slim

WORKDIR /app

RUN pip install mkdocs-material mkdocs-awesome-pages-plugin

COPY . .

CMD ["mkdocs", "serve", "--dev-addr=0.0.0.0:8000"]
