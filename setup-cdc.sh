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
            sleep 1
            i=$((i+1))
        fi
    done
    echo '❌ Kafka Connect not ready after 30s'
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

# Push database schema using Drizzle
echo "📊 Setting up database schema with Drizzle..."
if command -v pnpm &> /dev/null; then
    pnpm db:push
else
    echo "⚠️  pnpm not found, using npm..."
    npm run db:push
fi

# Seed initial data using Drizzle
echo "🌱 Seeding initial data with Drizzle..."
if command -v pnpm &> /dev/null; then
    pnpm db:seed 10
else
    npm run db:seed 10
fi

# Ensure connector config exists
if [ ! -f "postgres-connector.json" ]; then
    echo "❌ postgres-connector.json not found in project root."
    exit 1
fi

# Recreate connector from JSON to pick up changes
if curl -f http://localhost:8084/connectors/postgres-connector >/dev/null 2>&1; then
    echo "♻️  Deleting existing connector..."
    curl -X DELETE http://localhost:8084/connectors/postgres-connector
    sleep 2
fi

echo "🔌 Creating Debezium PostgreSQL connector from postgres-connector.json..."
curl -X POST http://localhost:8084/connectors \
  -H "Content-Type: application/json" \
  --data-binary @postgres-connector.json

echo ""
echo "🎉 CDC Setup Complete!"
echo ""
echo "Your CDC pipeline is ready! Here's what was set up:"
echo "  ✅ PostgreSQL database with customer_addresses table (via Drizzle)"
echo "  ✅ 5 sample customers seeded (via Drizzle)"
echo "  ✅ Debezium connector streaming to pg-cdc.public.customer_addresses"
echo "  ✅ Apicurio Schema Registry with JSON Schema validation"
echo ""
echo "🎨 Next Steps:"
echo "1. Open Drizzle Studio to manage data visually:"
echo "   pnpm db:studio"
echo "   → Opens at https://local.drizzle.studio/"
echo ""
echo "2. Check your Moose terminal for CDC events!"
echo "   Every change in Drizzle Studio triggers a CDC event"
echo ""
echo "3. Create more test data:"
echo "   pnpm db:seed 100000    # Add 100,000 random customers"
echo "   pnpm db:list       # View all customers"
echo "   pnpm db:clear      # Delete all customers"
echo ""
echo "🔧 Monitoring Commands:"
echo "• Check connector status:"
echo "  curl http://localhost:8084/connectors/postgres-connector/status"
echo ""
echo "• View CDC events in Kafka:"
echo "  docker exec debezium-cdc-redpanda-1 rpk topic consume pg-cdc.public.customer_addresses --num 5"
echo ""
echo "• Check Schema Registry:"
echo "  curl http://localhost:8081/apis/registry/v2/search/artifacts"
echo ""
echo "📡 Services Running:"
echo "  • Moose Dev:       http://localhost:4000 (check terminal for CDC events!)"
echo "  • Drizzle Studio:  http://local.drizzle.studio (start with: pnpm db:studio)"
echo "  • PostgreSQL:      localhost:5433"
echo "  • Kafka Connect:   http://localhost:8084"
echo "  • Schema Registry: http://localhost:8081"
echo "  • Redpanda:        localhost:19092"