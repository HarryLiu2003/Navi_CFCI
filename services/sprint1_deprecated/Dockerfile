FROM python:3.11-slim AS base

WORKDIR /app

# Set environment variables to skip building and use prebuilt wheels
ENV PIP_NO_BUILD_ISOLATION=false
ENV PIP_PREFER_BINARY=true

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir --prefer-binary -r requirements.txt

# Development stage
FROM base AS development
RUN pip install --no-cache-dir uvicorn

# Copy application code and post_install script
COPY app/ ./app/
COPY post_install.py .

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=8002

# Expose the port for development
EXPOSE 8002

# Start the application with hot reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]

# Production stage
FROM base AS production

# Install production dependencies explicitly
RUN pip install --no-cache-dir gunicorn

# Copy application code and post_install script
COPY app/ ./app/
COPY post_install.py .

# Set environment variables
ENV PYTHONPATH=/app

# Expose Cloud Run port
EXPOSE 8080

# Start with gunicorn as the production server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "app.main:app", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"] 