const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const {
  CustomerSchema,
  CustomerInputSchema,
  CustomerUpdateSchema,
  RandomRequestSchema,
  CustomerCreateRequestSchema,
  CustomerUpdateRequestSchema,
  HealthResponseSchema,
  CustomerResponseSchema,
  CustomerUpdateResponseSchema,
  CustomerDeleteResponseSchema,
  CustomersListResponseSchema,
  RandomOperationResponseSchema,
  BulkRandomResponseSchema,
  ErrorResponseSchema,
  CustomerIdParamSchema,
  BulkCountParamSchema,
  validateSchema,
} = require("./schemas");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Root endpoint with API info
app.get("/", (req, res) => {
  res.json({
    name: "CDC PostgreSQL API",
    version: "1.0.0",
    description:
      "API for performing CRUD operations with Debezium CDC integration",
    endpoints: {
      health: "/health",
      customers: "/customers",
      randomOperation: "/random-operation",
      randomDelete: "/random-customer",
      bulkRandom: "/bulk-random/:count",
    },
    cdcIntegration: {
      topic: "shop-server.public.customer_addresses",
      events: ["INSERT", "UPDATE", "DELETE"],
      connector: "Debezium PostgreSQL Connector",
    },
  });
});

// PostgreSQL connection
const pool = new Pool({
  host: "localhost",
  port: 5433,
  database: "shop",
  user: "postgres",
  password: "postgres",
});

// Sample data for random generation
const firstNames = [
  "John",
  "Jane",
  "Bob",
  "Alice",
  "Charlie",
  "Sarah",
  "Mike",
  "Emma",
  "David",
  "Lisa",
  "Tom",
  "Maria",
  "James",
  "Anna",
  "Chris",
];
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
];
const domains = [
  "example.com",
  "test.com",
  "demo.com",
  "sample.org",
  "mock.net",
];
const streets = [
  "Main St",
  "Oak Ave",
  "Pine Rd",
  "Elm St",
  "Maple Dr",
  "Cedar Ln",
  "Park Ave",
  "First St",
  "Second Ave",
  "Broadway",
];
const cities = [
  "Springfield",
  "Franklin",
  "Georgetown",
  "Madison",
  "Washington",
  "Lincoln",
  "Jefferson",
  "Clinton",
  "Jackson",
  "Monroe",
];
const states = [
  "California",
  "New York",
  "Texas",
  "Florida",
  "Illinois",
  "Pennsylvania",
  "Ohio",
  "Georgia",
  "North Carolina",
  "Michigan",
];
const countries = [
  "USA",
  "Canada",
  "Mexico",
  "UK",
  "Germany",
  "France",
  "Spain",
  "Italy",
  "Australia",
  "Japan",
];

// Helper functions
const getRandomElement = (array) =>
  array[Math.floor(Math.random() * array.length)];
const getRandomNumber = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomPhone = () =>
  `${getRandomNumber(100, 999)}-${getRandomNumber(100, 999)}-${getRandomNumber(
    1000,
    9999
  )}`;

const generateRandomCustomer = () => {
  const firstName = getRandomElement(firstNames);
  const lastName = getRandomElement(lastNames);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${getRandomElement(
    domains
  )}`;
  const resAddress = `${getRandomNumber(100, 9999)} ${getRandomElement(
    streets
  )}`;
  const workAddress = `${getRandomNumber(100, 9999)} ${getRandomElement(
    streets
  )}`;
  const country = getRandomElement(countries);
  const state = getRandomElement(states);
  const phone1 = getRandomPhone();
  const phone2 = getRandomPhone();

  return {
    firstName,
    lastName,
    email,
    resAddress,
    workAddress,
    country,
    state,
    phone1,
    phone2,
  };
};

// Routes with Zod validation

// Health check
app.get("/health", (req, res) => {
  const healthResponse = HealthResponseSchema.parse({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
  res.json(healthResponse);
});

// Get all customers
app.get("/customers", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customer_addresses ORDER BY id"
    );

    const response = CustomersListResponseSchema.parse({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });

    res.json(response);
  } catch (error) {
    console.error("Error fetching customers:", error);

    const errorResponse = ErrorResponseSchema.parse({
      success: false,
      error: "Database Error",
      message: error.message,
    });

    res.status(500).json(errorResponse);
  }
});

// Get customer by ID
app.get(
  "/customers/:id",
  validateSchema(CustomerIdParamSchema, "params"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "SELECT * FROM customer_addresses WHERE id = $1",
        [id]
      );

      if (result.rows.length === 0) {
        const errorResponse = ErrorResponseSchema.parse({
          success: false,
          error: "Customer not found",
          message: `Customer with ID ${id} does not exist`,
        });
        return res.status(404).json(errorResponse);
      }

      const response = CustomerResponseSchema.parse({
        success: true,
        message: "Customer found",
        data: result.rows[0],
        cdcEvent: "No CDC event for READ operations",
      });

      res.json(response);
    } catch (error) {
      console.error("Error fetching customer:", error);

      const errorResponse = ErrorResponseSchema.parse({
        success: false,
        error: "Database Error",
        message: error.message,
      });

      res.status(500).json(errorResponse);
    }
  }
);

// Create a new customer
app.post(
  "/customers",
  validateSchema(CustomerCreateRequestSchema, "body"),
  async (req, res) => {
    try {
      let customerData;

      // Check if it's a random request
      if (req.body.random) {
        customerData = generateRandomCustomer();
      } else {
        // Use validated data from Zod
        customerData = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          resAddress: req.body.resAddress || null,
          workAddress: req.body.workAddress || null,
          country: req.body.country || null,
          state: req.body.state || null,
          phone1: req.body.phone1 || null,
          phone2: req.body.phone2 || null,
        };
      }

      const {
        firstName,
        lastName,
        email,
        resAddress,
        workAddress,
        country,
        state,
        phone1,
        phone2,
      } = customerData;

      const result = await pool.query(
        `INSERT INTO customer_addresses 
       (first_name, last_name, email, res_address, work_address, country, state, phone_1, phone_2)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
        [
          firstName,
          lastName,
          email,
          resAddress,
          workAddress,
          country,
          state,
          phone1,
          phone2,
        ]
      );

      const response = CustomerResponseSchema.parse({
        success: true,
        message: "Customer created successfully",
        data: result.rows[0],
        cdcEvent: "INSERT operation captured by Debezium",
      });

      res.status(201).json(response);
    } catch (error) {
      console.error("Error creating customer:", error);

      const errorResponse = ErrorResponseSchema.parse({
        success: false,
        error: "Database Error",
        message: error.message,
      });

      res.status(500).json(errorResponse);
    }
  }
);

// Update a customer
app.put("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // If random=true, generate random updates
    let updates = req.body;
    if (req.body.random) {
      const randomCustomer = generateRandomCustomer();
      // Randomly update 1-3 fields
      const fieldsToUpdate = Math.floor(Math.random() * 3) + 1;
      const fields = ["state", "resAddress", "workAddress", "phone1", "phone2"];
      const selectedFields = fields
        .sort(() => 0.5 - Math.random())
        .slice(0, fieldsToUpdate);

      updates = {};
      selectedFields.forEach((field) => {
        if (field === "state") updates.state = randomCustomer.state;
        if (field === "resAddress")
          updates.res_address = randomCustomer.resAddress;
        if (field === "workAddress")
          updates.work_address = randomCustomer.workAddress;
        if (field === "phone1") updates.phone_1 = randomCustomer.phone1;
        if (field === "phone2") updates.phone_2 = randomCustomer.phone2;
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (key !== "random" && updates[key] !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid fields to update",
      });
    }

    values.push(id); // Add ID as last parameter

    const result = await pool.query(
      `UPDATE customer_addresses 
       SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: result.rows[0],
      updatedFields: Object.keys(updates).filter((k) => k !== "random"),
      cdcEvent: "UPDATE operation will be captured by Debezium",
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update customer",
      message: error.message,
    });
  }
});

// Delete a customer
app.delete("/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM customer_addresses WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      });
    }

    res.json({
      success: true,
      message: "Customer deleted successfully",
      data: result.rows[0],
      cdcEvent: "DELETE operation will be captured by Debezium",
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete customer",
      message: error.message,
    });
  }
});

// Random operation endpoint - randomly creates OR updates a record
app.post("/random-operation", async (req, res) => {
  try {
    // Get existing customer count
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM customer_addresses"
    );
    const customerCount = parseInt(countResult.rows[0].count);

    // Decide operation: 70% chance to create if < 10 customers, otherwise 50/50
    const shouldCreate =
      customerCount < 10 ? Math.random() < 0.7 : Math.random() < 0.5;

    if (shouldCreate || customerCount === 0) {
      // Create new customer
      const customer = generateRandomCustomer();
      const result = await pool.query(
        `INSERT INTO customer_addresses 
         (first_name, last_name, email, res_address, work_address, country, state, phone_1, phone_2)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          customer.firstName,
          customer.lastName,
          customer.email,
          customer.resAddress,
          customer.workAddress,
          customer.country,
          customer.state,
          customer.phone1,
          customer.phone2,
        ]
      );

      res.json({
        success: true,
        operation: "CREATE",
        message: "Random customer created",
        data: result.rows[0],
        cdcEvent: "INSERT operation captured by Debezium",
      });
    } else {
      // Update existing customer
      const existingResult = await pool.query(
        "SELECT id FROM customer_addresses ORDER BY RANDOM() LIMIT 1"
      );
      const randomId = existingResult.rows[0].id;

      // Generate random updates
      const randomCustomer = generateRandomCustomer();
      const fieldsToUpdate = Math.floor(Math.random() * 3) + 1;
      const fields = [
        "state",
        "res_address",
        "work_address",
        "phone_1",
        "phone_2",
      ];
      const selectedFields = fields
        .sort(() => 0.5 - Math.random())
        .slice(0, fieldsToUpdate);

      const updates = {};
      selectedFields.forEach((field) => {
        if (field === "state") updates.state = randomCustomer.state;
        if (field === "res_address")
          updates.res_address = randomCustomer.resAddress;
        if (field === "work_address")
          updates.work_address = randomCustomer.workAddress;
        if (field === "phone_1") updates.phone_1 = randomCustomer.phone1;
        if (field === "phone_2") updates.phone_2 = randomCustomer.phone2;
      });

      // Build update query
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      Object.keys(updates).forEach((key) => {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      });

      values.push(randomId);

      const result = await pool.query(
        `UPDATE customer_addresses 
         SET ${updateFields.join(", ")}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      res.json({
        success: true,
        operation: "UPDATE",
        message: `Random update applied to customer ID ${randomId}`,
        data: result.rows[0],
        updatedFields: selectedFields,
        cdcEvent: "UPDATE operation captured by Debezium",
      });
    }
  } catch (error) {
    console.error("Error in random operation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to perform random operation",
      message: error.message,
    });
  }
});

// Bulk random operations
app.post("/bulk-random/:count", async (req, res) => {
  try {
    const count = Math.min(parseInt(req.params.count) || 5, 20); // Max 20 operations
    const results = [];

    for (let i = 0; i < count; i++) {
      try {
        // Use the same logic as random-operation but collect results
        const countResult = await pool.query(
          "SELECT COUNT(*) FROM customer_addresses"
        );
        const customerCount = parseInt(countResult.rows[0].count);
        const shouldCreate =
          customerCount < 10 ? Math.random() < 0.7 : Math.random() < 0.5;

        if (shouldCreate || customerCount === 0) {
          const customer = generateRandomCustomer();
          const result = await pool.query(
            `INSERT INTO customer_addresses 
             (first_name, last_name, email, res_address, work_address, country, state, phone_1, phone_2)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
              customer.firstName,
              customer.lastName,
              customer.email,
              customer.resAddress,
              customer.workAddress,
              customer.country,
              customer.state,
              customer.phone1,
              customer.phone2,
            ]
          );

          results.push({
            operation: "CREATE",
            data: result.rows[0],
          });
        } else {
          const existingResult = await pool.query(
            "SELECT id FROM customer_addresses ORDER BY RANDOM() LIMIT 1"
          );
          if (existingResult.rows.length > 0) {
            const randomId = existingResult.rows[0].id;
            const randomCustomer = generateRandomCustomer();

            const result = await pool.query(
              `UPDATE customer_addresses 
               SET state = $1, res_address = $2
               WHERE id = $3
               RETURNING *`,
              [randomCustomer.state, randomCustomer.resAddress, randomId]
            );

            results.push({
              operation: "UPDATE",
              data: result.rows[0],
            });
          }
        }

        // Small delay between operations
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (opError) {
        console.error(`Error in bulk operation ${i}:`, opError);
      }
    }

    res.json({
      success: true,
      message: `Completed ${results.length} random operations`,
      operations: results,
      cdcEvent: `${results.length} CDC events generated for Debezium`,
    });
  } catch (error) {
    console.error("Error in bulk random operations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to perform bulk random operations",
      message: error.message,
    });
  }
});

// Delete random customer
app.delete("/random-customer", async (req, res) => {
  try {
    // Check if any customers exist
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM customer_addresses"
    );
    const customerCount = parseInt(countResult.rows[0].count);

    if (customerCount === 0) {
      const errorResponse = ErrorResponseSchema.parse({
        success: false,
        error: "No customers found",
        message:
          "Cannot delete a random customer because no customers exist in the database",
      });
      return res.status(404).json(errorResponse);
    }

    // Select and delete a random customer
    const result = await pool.query(
      "DELETE FROM customer_addresses WHERE id = (SELECT id FROM customer_addresses ORDER BY RANDOM() LIMIT 1) RETURNING *"
    );

    const response = CustomerDeleteResponseSchema.parse({
      success: true,
      message: "Random customer deleted successfully",
      data: result.rows[0],
      cdcEvent: "DELETE operation captured by Debezium",
    });

    res.json(response);
  } catch (error) {
    console.error("Error deleting random customer:", error);

    const errorResponse = ErrorResponseSchema.parse({
      success: false,
      error: "Database Error",
      message: error.message,
    });

    res.status(500).json(errorResponse);
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 CDC API Server running on http://localhost:${port}`);
  console.log(`📊 Endpoints:`);
  console.log(`   GET    /                          - API information`);
  console.log(`   GET    /health                    - Health check`);
  console.log(`   GET    /customers                 - List all customers`);
  console.log(`   GET    /customers/:id             - Get customer by ID`);
  console.log(
    `   POST   /customers                 - Create customer (add "random": true for random data)`
  );
  console.log(
    `   PUT    /customers/:id             - Update customer (add "random": true for random updates)`
  );
  console.log(`   DELETE /customers/:id             - Delete customer`);
  console.log(
    `   POST   /random-operation          - Randomly create OR update a record`
  );
  console.log(
    `   DELETE /random-customer           - Delete a random customer`
  );
  console.log(
    `   POST   /bulk-random/:count        - Perform multiple random operations (max 20)`
  );
  console.log(`\n💡 Quick Start:`);
  console.log(`   curl -X POST http://localhost:${port}/random-operation`);
  console.log(`   curl -X DELETE http://localhost:${port}/random-customer`);
  console.log(`   curl http://localhost:${port}/customers`);
  console.log(`\n🛡️ Zod validation enabled for all endpoints`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down CDC API server...");
  await pool.end();
  process.exit(0);
});
