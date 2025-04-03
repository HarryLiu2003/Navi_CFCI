FROM python:3.11-slim AS base

# Set environment variable to indicate container environment
ENV CONTAINER_ENV=1

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY app/ ./app/

FROM base AS development
# Install development dependencies
RUN pip install --no-cache-dir uvicorn

# Expose API port
EXPOSE 8000

# Start the API with hot reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

FROM base AS production
# Expose API port
EXPOSE 8000

# Start the API without debug mode
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"] 