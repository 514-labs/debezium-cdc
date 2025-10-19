import {
  Controller,
  Get,
  Route,
  Tags,
  Query,
  Path,
  SuccessResponse,
} from "tsoa";
import { db } from "../oltp/connection";
import { customerAddresses, anotherTable } from "../oltp/schema";
import { eq, desc, asc, sql as drizzleSql, getTableColumns } from "drizzle-orm";
import { PaginatedResponse, SingleResponse } from "../types/api";

@Route("oltp/customer-addresses")
@Tags("OLTP Customer Addresses")
export class OltpCustomerAddressesController extends Controller {
  /**
   * List all customer addresses from OLTP database
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @param sortBy Column to sort by
   * @param sortOrder Sort order (asc or desc)
   */
  @Get()
  @SuccessResponse("200", "Successfully retrieved customer addresses")
  public async listCustomerAddresses(
    @Query() limit: number = 100,
    @Query() offset: number = 0,
    @Query() sortBy?: string,
    @Query() sortOrder: "asc" | "desc" = "asc"
  ): Promise<PaginatedResponse<any>> {
    const cols = getTableColumns(customerAddresses);
    type CustomerAddressCols = keyof typeof cols;

    const sortByCol = (sortBy as CustomerAddressCols) || "id";
    const orderByColumn = cols[sortByCol] ?? cols.id;
    const orderByFn = sortOrder === "desc" ? desc : asc;

    const results = await db
      .select()
      .from(customerAddresses)
      .orderBy(orderByFn(orderByColumn))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(customerAddresses);

    return {
      success: true,
      data: results,
      count: results.length,
      total: total[0]?.count || 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single customer address by ID from OLTP database
   * @param id Customer address ID
   */
  @Get("{id}")
  @SuccessResponse("200", "Successfully retrieved customer address")
  public async getCustomerAddress(
    @Path() id: number
  ): Promise<SingleResponse<any>> {
    const result = await db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.id, id))
      .limit(1);

    if (result.length === 0) {
      this.setStatus(404);
      throw new Error("Customer address not found");
    }

    return {
      success: true,
      data: result[0],
    };
  }
}

@Route("oltp/another-table")
@Tags("OLTP Another Table")
export class OltpAnotherTableController extends Controller {
  /**
   * List all records from another_table in OLTP database
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @param sortBy Column to sort by
   * @param sortOrder Sort order (asc or desc)
   */
  @Get()
  @SuccessResponse("200", "Successfully retrieved records")
  public async listRecords(
    @Query() limit: number = 100,
    @Query() offset: number = 0,
    @Query() sortBy?: string,
    @Query() sortOrder: "asc" | "desc" = "asc"
  ): Promise<PaginatedResponse<any>> {
    const cols = getTableColumns(anotherTable);
    type AnotherTableCols = keyof typeof cols;

    const sortByCol = (sortBy as AnotherTableCols) || "id";
    const orderByColumn = cols[sortByCol] ?? cols.id;
    const orderByFn = sortOrder === "desc" ? desc : asc;

    const results = await db
      .select()
      .from(anotherTable)
      .orderBy(orderByFn(orderByColumn))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: drizzleSql<number>`count(*)` })
      .from(anotherTable);

    return {
      success: true,
      data: results,
      count: results.length,
      total: total[0]?.count || 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single record by ID from another_table in OLTP database
   * @param id Record ID
   */
  @Get("{id}")
  @SuccessResponse("200", "Successfully retrieved record")
  public async getRecord(@Path() id: number): Promise<SingleResponse<any>> {
    const result = await db
      .select()
      .from(anotherTable)
      .where(eq(anotherTable.id, id))
      .limit(1);

    if (result.length === 0) {
      this.setStatus(404);
      throw new Error("Record not found");
    }

    return {
      success: true,
      data: result[0],
    };
  }
}
