import { Controller, Get, Route, Tags, SuccessResponse } from "tsoa";

interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

@Route("health")
@Tags("Health")
export class HealthController extends Controller {
  /**
   * Health check endpoint
   */
  @Get()
  @SuccessResponse("200", "Service is healthy")
  public async getHealth(): Promise<HealthResponse> {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "example-express-api",
    };
  }
}
