FROM python:3.11-slim AS base

# Set environment variable to indicate container environment
ENV CONTAINER_ENV=1

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install production dependencies explicitly
RUN pip install --no-cache-dir gunicorn uvicorn

# Copy source code
COPY app/ ./app/

FROM base AS development
# Install development dependencies
RUN pip install --no-cache-dir uvicorn

# Expose development port
EXPOSE 8001

# Start the API with hot reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

FROM base AS production
# Expose Cloud Run's port
EXPOSE 8080

# Start with gunicorn as the production server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "app.main:app", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"] 