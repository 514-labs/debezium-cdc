import { Controller, Get, Route, Tags, Query, Path, Request, SuccessResponse } from "tsoa";
import { getMooseUtils } from "@514labs/moose-lib";
import { Request as ExpressRequest } from "express";
import {
  olapCustomerAddresses,
  olapAnotherTable,
} from "../cdc/3-destinations/olap-tables";
import { PaginatedResponse, SingleResponse } from "../types/api";

@Route("olap/customer-addresses")
@Tags("OLAP Customer Addresses")
export class OlapCustomerAddressesController extends Controller {
  /**
   * List all customer addresses from OLAP database (ClickHouse)
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @param includeDeleted Include deleted records
   */
  @Get()
  @SuccessResponse("200", "Successfully retrieved customer addresses")
  public async listCustomerAddresses(
    @Request() request: ExpressRequest,
    @Query() limit: number = 100,
    @Query() offset: number = 0,
    @Query() includeDeleted: boolean = false
  ): Promise<PaginatedResponse<any>> {
    const moose = getMooseUtils(request);
    if (!moose) {
      this.setStatus(500);
      throw new Error("MooseStack utilities not available");
    }

    const { client, sql } = moose;

    const query = sql`
      SELECT
        *
      FROM ${olapCustomerAddresses}
      ${
        includeDeleted
          ? sql``
          : sql`WHERE ${olapCustomerAddresses.columns._is_deleted} = 0`
      }
      ORDER BY ${olapCustomerAddresses.columns.id} DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result = await client.query.execute(query);
    const data = await result.json();

    const countQuery = sql`
      SELECT count() as total
      FROM ${olapCustomerAddresses}
      ${
        includeDeleted
          ? sql``
          : sql`WHERE ${olapCustomerAddresses.columns._is_deleted} = 0`
      }
    `;

    const countResult = await client.query.execute(countQuery);
    const countData: Array<{ total: number }> = await countResult.json();

    return {
      success: true,
      data,
      count: data.length,
      total: countData[0]?.total || 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single customer address by ID from OLAP database
   * @param id Customer address ID
   * @param includeDeleted Include deleted records
   */
  @Get("{id}")
  @SuccessResponse("200", "Successfully retrieved customer address")
  public async getCustomerAddress(
    @Request() request: ExpressRequest,
    @Path() id: number,
    @Query() includeDeleted: boolean = false
  ): Promise<SingleResponse<any>> {
    const moose = getMooseUtils(request);
    if (!moose) {
      this.setStatus(500);
      throw new Error("MooseStack utilities not available");
    }

    const { client, sql } = moose;

    const query = sql`
      SELECT
        *
      FROM ${olapCustomerAddresses}
      WHERE ${olapCustomerAddresses.columns.id} = ${id}
      ${
        includeDeleted
          ? sql``
          : sql`AND ${olapCustomerAddresses.columns._is_deleted} = 0`
      }
      ORDER BY ${olapCustomerAddresses.columns.lsn} DESC
      LIMIT 1`;

    const result = await client.query.execute(query);
    const data = await result.json();

    if (data.length === 0) {
      this.setStatus(404);
      throw new Error("Customer address not found");
    }

    return {
      success: true,
      data: data[0],
    };
  }
}

@Route("olap/another-table")
@Tags("OLAP Another Table")
export class OlapAnotherTableController extends Controller {
  /**
   * List all records from another_table in OLAP database (ClickHouse)
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @param includeDeleted Include deleted records
   */
  @Get()
  @SuccessResponse("200", "Successfully retrieved records")
  public async listRecords(
    @Request() request: ExpressRequest,
    @Query() limit: number = 100,
    @Query() offset: number = 0,
    @Query() includeDeleted: boolean = false
  ): Promise<PaginatedResponse<any>> {
    const moose = getMooseUtils(request);
    if (!moose) {
      this.setStatus(500);
      throw new Error("MooseStack utilities not available");
    }

    const { client, sql } = moose;

    const query = sql`
      SELECT
        *
      FROM ${olapAnotherTable}
      ${
        includeDeleted
          ? sql``
          : sql`WHERE ${olapAnotherTable.columns._is_deleted} = 0`
      }
      ORDER BY ${olapAnotherTable.columns.id} DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const result = await client.query.execute(query);
    const data = await result.json();

    const countQuery = sql`
      SELECT count() as total
      FROM ${olapAnotherTable}
      ${
        includeDeleted
          ? sql``
          : sql`WHERE ${olapAnotherTable.columns._is_deleted} = 0`
      }
    `;

    const countResult = await client.query.execute(countQuery);
    const countData: Array<{ total: number }> = await countResult.json();

    return {
      success: true,
      data,
      count: data.length,
      total: countData[0]?.total || 0,
      limit,
      offset,
    };
  }

  /**
   * Get a single record by ID from another_table in OLAP database
   * @param id Record ID
   * @param includeDeleted Include deleted records
   */
  @Get("{id}")
  @SuccessResponse("200", "Successfully retrieved record")
  public async getRecord(
    @Request() request: ExpressRequest,
    @Path() id: number,
    @Query() includeDeleted: boolean = false
  ): Promise<SingleResponse<any>> {
    const moose = getMooseUtils(request);
    if (!moose) {
      this.setStatus(500);
      throw new Error("MooseStack utilities not available");
    }

    const { client, sql } = moose;

    const query = sql`
      SELECT
        *
      FROM ${olapAnotherTable}
      WHERE ${olapAnotherTable.columns.id} = ${id}
      ${
        includeDeleted
          ? sql``
          : sql`AND ${olapAnotherTable.columns._is_deleted} = 0`
      }
      ORDER BY ${olapAnotherTable.columns.lsn} DESC
      LIMIT 1
    `;

    const result = await client.query.execute(query);
    const data = await result.json();

    if (data.length === 0) {
      this.setStatus(404);
      throw new Error("Record not found");
    }

    return {
      success: true,
      data: data[0],
    };
  }
}
