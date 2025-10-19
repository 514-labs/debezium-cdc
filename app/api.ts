/**
 * Example BYOF (Bring Your Own Framework) Express app
 *
 * This file demonstrates how to use Express with MooseStack for consumption
 * APIs using the WebApp class.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { WebApp, expressMiddleware, getMooseUtils } from "@514labs/moose-lib";
import { RegisterRoutes } from "../.generated/routes";
import swaggerUi from "swagger-ui-express";
import typia from "typia";
const app = express();

// Enable CORS for all routes
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply MooseStack middleware before routes
app.use(expressMiddleware());

// TEST TYPIA VALIDATION HERE...

interface TestTypiaValidationRequest {
  name: string;
  age: number;
}
/// FYI: I abandoned this approach because it was not working as expected. Instead, I'm using the tsoa validation. The files are generated in the .generated folder.
app.get(
  "/test-typia-validation",
  (_req: Request<{}, {}, {}, TestTypiaValidationRequest>, res: Response) => {
    const validated = typia.createValidate<TestTypiaValidationRequest>();
    const result = validated(_req.query);
    if (result.success) {
      res.send(result.data);
    } else {
      res.status(400).json({ error: result.errors.join(", ") });
    }
  }
);

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[api.ts] ${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Express error:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
});

app.use("/docs", swaggerUi.serve, async (_req: Request, res: Response) => {
  return res.send(
    swaggerUi.generateHTML(await import("../.generated/swagger.json"))
  );
});

RegisterRoutes(app);

export const exampleExpressApi = new WebApp("exampleExpress", app, {
  mountPath: "/express",
  metadata: {
    description: "Express API with middleware demonstrating WebApp integration",
  },
});
