FROM python:3.10-slim AS base

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base AS development
RUN pip install --no-cache-dir uvicorn

# Copy application
COPY . .

# Expose development port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage
FROM base AS production

# Install production dependencies explicitly
RUN pip install --no-cache-dir gunicorn

# Copy application
COPY . .

# Expose Cloud Run port
EXPOSE 8080

# Start with gunicorn as the production server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "app.main:app", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"] 