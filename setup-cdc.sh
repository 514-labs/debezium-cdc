#!/bin/bash

echo "🚀 Setting up Debezium CDC with Moose Docker Override..."

# Function to wait for Kafka Connect API
wait_for_kafka_connect() {
    echo "⏳ Waiting for Kafka Connect to be ready..."
    i=0
    while [ $i -lt 30 ]; do
        if curl -f http://localhost:8084/connectors >/dev/null 2>&1; then
            echo '✅ Kafka Connect ready!'
            return 0
        else
            echo "  Waiting for Kafka Connect... ($((i+1))/30)"
            sleep 3
            i=$((i+1))
        fi
    done
    echo '❌ Kafka Connect not ready after 90s'
    exit 1
}

# Check if override file exists
if [ ! -f "docker-compose.dev.override.yaml" ]; then
    echo "❌ docker-compose.dev.override.yaml not found!"
    echo "Please ensure the override file is in the project root."
    exit 1
fi

echo "✅ Found docker-compose.dev.override.yaml"

# Check if Moose dev is running by checking for Redpanda
echo "🔍 Checking if Moose dev server is running..."
if ! nc -z localhost 19092 2>/dev/null; then
    echo "⚠️  Moose dev server not detected!"
    echo ""
    echo "Please start Moose dev server first:"
    echo "  moose dev"
    echo ""
    echo "This will:"
    echo "  1. Start Moose's core infrastructure (Redpanda, ClickHouse, etc.)"
    echo "  2. Automatically load your CDC services from docker-compose.dev.override.yaml"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Moose dev server is running!"
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for CDC PostgreSQL to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if docker exec cdc-postgres pg_isready -U postgres -d shop 2>/dev/null; then
        echo "✅ PostgreSQL ready!"
        break
    else
        echo "  Waiting for PostgreSQL... ($((attempt+1))/$max_attempts)"
        sleep 2
        attempt=$((attempt+1))
    fi
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ PostgreSQL not ready after 60s. Check if 'moose dev' is running."
    exit 1
fi

# Wait for Kafka Connect to be ready
wait_for_kafka_connect

# Create sample table and data in PostgreSQL
echo "📊 Creating sample table and data..."
docker exec -i cdc-postgres psql -U postgres -d shop << 'EOF'
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS customer_addresses (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100),
    res_address VARCHAR(200),
    work_address VARCHAR(200),
    country VARCHAR(50),
    state VARCHAR(50),
    phone_1 VARCHAR(20),
    phone_2 VARCHAR(20)
);

-- Only insert sample data if table is empty
INSERT INTO customer_addresses (first_name, last_name, email, res_address, work_address, country, state, phone_1, phone_2) 
SELECT * FROM (VALUES
    ('John', 'Doe', 'john.doe@example.com', '123 Main St', '456 Work Ave', 'USA', 'California', '555-0101', '555-0102'),
    ('Jane', 'Smith', 'jane.smith@example.com', '789 Oak St', '321 Business Blvd', 'USA', 'New York', '555-0201', '555-0202'),
    ('Bob', 'Johnson', 'bob.johnson@example.com', '456 Pine St', '789 Corporate Dr', 'USA', 'Texas', '555-0301', '555-0302'),
    ('Alice', 'Williams', 'alice.williams@example.com', '321 Elm St', '654 Office Way', 'USA', 'Florida', '555-0401', '555-0402'),
    ('Charlie', 'Brown', 'charlie.brown@example.com', '654 Maple Ave', '987 Work Plaza', 'USA', 'Illinois', '555-0501', '555-0502')
) AS new_data
WHERE NOT EXISTS (SELECT 1 FROM customer_addresses LIMIT 1);

SELECT COUNT(*) as total_records FROM customer_addresses;
EOF

# Check if connector already exists
if curl -f http://localhost:8084/connectors/shop-server-connector >/dev/null 2>&1; then
    echo "ℹ️  Connector already exists. Checking status..."
    curl http://localhost:8084/connectors/shop-server-connector/status
else
    # Create Debezium connector
    echo "🔌 Creating Debezium PostgreSQL connector..."
    curl -X POST http://localhost:8084/connectors \
      -H "Content-Type: application/json" \
      -d '{
        "name": "shop-server-connector",
        "config": {
          "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
          "database.hostname": "cdc-postgres",
          "database.port": "5432",
          "database.user": "postgres",
          "database.password": "postgres",
          "database.dbname": "shop",
          "topic.prefix": "shop-server",
          "table.include.list": "public.customer_addresses",
          "plugin.name": "pgoutput",
          "slot.name": "debezium_slot",
          "publication.name": "dbz_publication"
        }
      }'
fi

echo ""
echo "🎉 CDC Setup Complete!"
echo ""
echo "Your CDC services are now integrated with Moose using docker-compose.dev.override.yaml"
echo ""
echo "🔧 Available Commands:"
echo "1. Check connector status:"
echo "   curl http://localhost:8084/connectors/shop-server-connector/status"
echo ""
echo "2. Test CDC by modifying data:"
echo "   docker exec -i cdc-postgres psql -U postgres -d shop -c \"INSERT INTO customer_addresses (first_name, last_name, email, country, state) VALUES ('Test', 'User', 'test@example.com', 'USA', 'Nevada');\""
echo ""
echo "3. Consume CDC events from Moose's Redpanda:"
echo "   # From your Moose app's external topics configuration"
echo "   # Topic: shop-server.public.customer_addresses"
echo ""
echo "📡 Services:"
echo "- CDC PostgreSQL: localhost:5433 (user: postgres, password: postgres, db: shop)"
echo "- Kafka Connect API: http://localhost:8084"
echo "- Redpanda (Moose): localhost:19092"
echo ""
echo "ℹ️  Note: CDC services are managed by Moose dev server"
echo "   - Start: moose dev (includes CDC services automatically)"
echo "   - Stop: Ctrl+C in moose dev terminal"