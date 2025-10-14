const { z } = require("zod");

// Base Customer schema (database representation)
const CustomerSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  email: z.string().email().max(100),
  res_address: z.string().max(200).nullable(),
  work_address: z.string().max(200).nullable(),
  country: z.string().max(50).nullable(),
  state: z.string().max(50).nullable(),
  phone_1: z.string().max(20).nullable(),
  phone_2: z.string().max(20).nullable(),
});

// Customer input schema (for creating customers with camelCase)
const CustomerInputSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email().max(100),
  resAddress: z.string().max(200).optional(),
  workAddress: z.string().max(200).optional(),
  country: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  phone1: z.string().max(20).optional(),
  phone2: z.string().max(20).optional(),
});

// Customer update schema (all fields optional, using snake_case for database)
const CustomerUpdateSchema = z.object({
  first_name: z.string().min(1).max(50).optional(),
  last_name: z.string().min(1).max(50).optional(),
  email: z.string().email().max(100).optional(),
  res_address: z.string().max(200).optional(),
  work_address: z.string().max(200).optional(),
  country: z.string().max(50).optional(),
  state: z.string().max(50).optional(),
  phone_1: z.string().max(20).optional(),
  phone_2: z.string().max(20).optional(),
});

// Random request schema
const RandomRequestSchema = z.object({
  random: z.boolean(),
});

// Union schema for customer creation (manual or random)
const CustomerCreateRequestSchema = z.union([
  CustomerInputSchema,
  RandomRequestSchema,
]);

// Union schema for customer updates (manual or random)
const CustomerUpdateRequestSchema = z.union([
  CustomerUpdateSchema,
  RandomRequestSchema,
]);

// Response schemas
const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string().datetime(),
});

const CustomerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: CustomerSchema,
  cdcEvent: z.string(),
});

const CustomerUpdateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: CustomerSchema,
  updatedFields: z.array(z.string()),
  cdcEvent: z.string(),
});

const CustomerDeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: CustomerSchema,
  cdcEvent: z.string(),
});

const CustomersListResponseSchema = z.object({
  success: z.boolean(),
  count: z.number().int().min(0),
  data: z.array(CustomerSchema),
});

const RandomOperationResponseSchema = z.object({
  success: z.boolean(),
  operation: z.enum(["CREATE", "UPDATE"]),
  message: z.string(),
  data: CustomerSchema,
  updatedFields: z.array(z.string()).optional(),
  cdcEvent: z.string(),
});

const BulkOperationSchema = z.object({
  operation: z.enum(["CREATE", "UPDATE"]),
  data: CustomerSchema,
});

const BulkRandomResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  operations: z.array(BulkOperationSchema),
  cdcEvent: z.string(),
});

const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string(),
  message: z.string(),
});

// ID parameter schema
const CustomerIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const BulkCountParamSchema = z.object({
  count: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(20)),
});

// Validation middleware factory
const validateSchema = (schema, source = "body") => {
  return (req, res, next) => {
    try {
      let data;
      switch (source) {
        case "body":
          data = req.body;
          break;
        case "params":
          data = req.params;
          break;
        case "query":
          data = req.query;
          break;
        default:
          data = req.body;
      }

      const validated = schema.parse(data);

      // Replace the original data with validated data
      if (source === "body") {
        req.body = validated;
      } else if (source === "params") {
        req.params = validated;
      } else if (source === "query") {
        req.query = validated;
      }

      next();
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: "Invalid request data",
          details: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            received: err.received,
          })),
        });
      }
      next(error);
    }
  };
};

module.exports = {
  // Schemas
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

  // Middleware
  validateSchema,
};
