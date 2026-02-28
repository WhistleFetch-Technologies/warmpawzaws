/**
 * ============================================================================
 * PROBLEM GRID ADMIN ENDPOINTS
 * ============================================================================
 * 
 * Full CRUD management for Problem Grid items
 * - List categories and items
 * - Create, update, delete items
 * - Toggle active status
 * - Reorder items
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update, remove } from '../database/rds-connection';

// ============================================================================
// LIST CATEGORIES HANDLER
// ============================================================================

class ListCategoriesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const { rows: categories } = await query(
        `SELECT 
          pgc.id,
          pgc.name,
          pgc.description,
          pgc.role_id,
          r.name as role_name,
          pgc.is_active,
          pgc.display_order,
          (SELECT COUNT(*) FROM problem_grid_items WHERE category_id = pgc.id) as item_count
        FROM problem_grid_categories pgc
        LEFT JOIN roles r ON r.id = pgc.role_id
        ORDER BY pgc.display_order ASC, pgc.name ASC`
      );

      return this.success({
        success: true,
        categories: categories.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          roleId: c.role_id,
          roleName: c.role_name,
          itemCount: parseInt(c.item_count) || 0,
          isActive: c.is_active,
          displayOrder: c.display_order,
        })),
      });
    } catch (error: any) {
      console.error('Error listing categories:', error);
      return this.error(error.message || 'Failed to list categories', 500);
    }
  }
}

// ============================================================================
// LIST ITEMS HANDLER
// ============================================================================

class ListItemsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const categoryId = context.event.queryStringParameters?.categoryId;
    const includeInactive = context.event.queryStringParameters?.includeInactive === 'true';

    try {
      let queryStr = `
        SELECT 
          pgi.id,
          pgi.name,
          pgi.description,
          pgi.icon,
          pgi.icon_url,
          pgi.color,
          pgi.category_id,
          pgc.name as category_name,
          pgi.role_ids,
          pgi.service_styles,
          pgi.keywords,
          pgi.display_order,
          pgi.is_active,
          pgi.created_at,
          pgi.updated_at
        FROM problem_grid_items pgi
        LEFT JOIN problem_grid_categories pgc ON pgc.id = pgi.category_id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (categoryId) {
        params.push(categoryId);
        queryStr += ` AND pgi.category_id = $${params.length}`;
      }

      if (!includeInactive) {
        queryStr += ` AND pgi.is_active = true`;
      }

      queryStr += ` ORDER BY pgi.display_order ASC, pgi.name ASC`;

      const { rows: items } = await query(queryStr, params);

      return this.success({
        success: true,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          icon: item.icon,
          iconUrl: item.icon_url,
          color: item.color,
          category: item.category_name || item.category_id,
          categoryId: item.category_id,
          roleIds: item.role_ids || [],
          serviceStyles: item.service_styles || ['at_home', 'at_center'],
          keywords: item.keywords || [],
          displayOrder: item.display_order,
          isActive: item.is_active,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
        count: items.length,
      });
    } catch (error: any) {
      console.error('Error listing items:', error);
      return this.error(error.message || 'Failed to list items', 500);
    }
  }
}

// ============================================================================
// CREATE ITEM HANDLER
// ============================================================================

class CreateItemHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { 
      name, 
      description, 
      icon, 
      iconUrl, 
      color, 
      category, 
      categoryId,
      roleIds, 
      serviceStyles, 
      keywords, 
      isActive = true 
    } = body;

    if (!name || (!category && !categoryId)) {
      return this.error('Name and category are required', 400);
    }

    try {
      // Get next display order
      const { rows: maxOrder } = await query(
        `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM problem_grid_items`
      );
      const displayOrder = maxOrder[0]?.next_order || 1;

      // Create the item
      const [item] = await insert('problem_grid_items', {
        name,
        description: description || null,
        icon: icon || null,
        icon_url: iconUrl || null,
        color: color || '#FF8C42',
        category_id: categoryId || category,
        role_ids: roleIds || [],
        service_styles: serviceStyles || ['at_home', 'at_center'],
        keywords: keywords || [],
        display_order: displayOrder,
        is_active: isActive,
        created_at: new Date(),
        updated_at: new Date(),
      });

      return this.success({
        success: true,
        item: {
          id: item.id,
          name: item.name,
          description: item.description,
          icon: item.icon,
          iconUrl: item.icon_url,
          color: item.color,
          categoryId: item.category_id,
          roleIds: item.role_ids,
          serviceStyles: item.service_styles,
          keywords: item.keywords,
          displayOrder: item.display_order,
          isActive: item.is_active,
        },
        message: 'Problem grid item created successfully',
      });
    } catch (error: any) {
      console.error('Error creating item:', error);
      return this.error(error.message || 'Failed to create item', 500);
    }
  }
}

// ============================================================================
// UPDATE ITEM HANDLER
// ============================================================================

class UpdateItemHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const itemId = context.event.pathParameters?.itemId;
    const body = this.parseBody(context.event);

    if (!itemId) {
      return this.error('Item ID is required', 400);
    }

    try {
      // Check item exists
      const existing = await select('problem_grid_items', { id: itemId });
      if (existing.length === 0) {
        return this.error('Item not found', 404);
      }

      // Build update object
      const updateData: any = {
        updated_at: new Date(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.iconUrl !== undefined) updateData.icon_url = body.iconUrl;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.category !== undefined) updateData.category_id = body.category;
      if (body.categoryId !== undefined) updateData.category_id = body.categoryId;
      if (body.roleIds !== undefined) updateData.role_ids = body.roleIds;
      if (body.serviceStyles !== undefined) updateData.service_styles = body.serviceStyles;
      if (body.keywords !== undefined) updateData.keywords = body.keywords;
      if (body.displayOrder !== undefined) updateData.display_order = body.displayOrder;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      await update('problem_grid_items', { id: itemId }, updateData);

      // Fetch updated item
      const updated = await select('problem_grid_items', { id: itemId });

      return this.success({
        success: true,
        item: updated[0],
        message: 'Problem grid item updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating item:', error);
      return this.error(error.message || 'Failed to update item', 500);
    }
  }
}

// ============================================================================
// DELETE ITEM HANDLER
// ============================================================================

class DeleteItemHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const itemId = context.event.pathParameters?.itemId;

    if (!itemId) {
      return this.error('Item ID is required', 400);
    }

    try {
      // Check item exists
      const existing = await select('problem_grid_items', { id: itemId });
      if (existing.length === 0) {
        return this.error('Item not found', 404);
      }

      // Soft delete by setting is_active to false, or hard delete
      // Using hard delete here
      await remove('problem_grid_items', { id: itemId });

      return this.success({
        success: true,
        message: 'Problem grid item deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting item:', error);
      return this.error(error.message || 'Failed to delete item', 500);
    }
  }
}

// ============================================================================
// TOGGLE ITEM STATUS HANDLER
// ============================================================================

class ToggleItemStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const itemId = context.event.pathParameters?.itemId;
    const body = this.parseBody(context.event);

    if (!itemId) {
      return this.error('Item ID is required', 400);
    }

    try {
      const existing = await select('problem_grid_items', { id: itemId });
      if (existing.length === 0) {
        return this.error('Item not found', 404);
      }

      const newStatus = body.isActive !== undefined ? body.isActive : !existing[0].is_active;

      await update('problem_grid_items', { id: itemId }, {
        is_active: newStatus,
        updated_at: new Date(),
      });

      return this.success({
        success: true,
        isActive: newStatus,
        message: newStatus ? 'Item activated' : 'Item deactivated',
      });
    } catch (error: any) {
      console.error('Error toggling item status:', error);
      return this.error(error.message || 'Failed to toggle status', 500);
    }
  }
}

// ============================================================================
// REORDER ITEMS HANDLER
// ============================================================================

class ReorderItemsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { items } = body; // Array of { id, displayOrder }

    if (!items || !Array.isArray(items)) {
      return this.error('Items array is required', 400);
    }

    try {
      // Update each item's display order
      for (const item of items) {
        await update('problem_grid_items', { id: item.id }, {
          display_order: item.displayOrder,
          updated_at: new Date(),
        });
      }

      return this.success({
        success: true,
        message: 'Items reordered successfully',
        updatedCount: items.length,
      });
    } catch (error: any) {
      console.error('Error reordering items:', error);
      return this.error(error.message || 'Failed to reorder items', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerProblemGridAdminEndpoints(app: Hono) {
  const listCategoriesHandler = new ListCategoriesHandler();
  const listItemsHandler = new ListItemsHandler();
  const createItemHandler = new CreateItemHandler();
  const updateItemHandler = new UpdateItemHandler();
  const deleteItemHandler = new DeleteItemHandler();
  const toggleStatusHandler = new ToggleItemStatusHandler();
  const reorderHandler = new ReorderItemsHandler();

  // Categories
  app.get('/admin/problem-grid/categories', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: '/admin/problem-grid/categories',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await listCategoriesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // List items
  app.get('/admin/problem-grid/items', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: '/admin/problem-grid/items',
      headers: {},
      body: '',
      pathParameters: {},
      queryStringParameters: Object.fromEntries(new URL(c.req.url).searchParams),
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await listItemsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Create item
  app.post('/admin/problem-grid/items', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/admin/problem-grid/items',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await createItemHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Update item
  app.put('/admin/problem-grid/items/:itemId', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'PUT',
      path: `/admin/problem-grid/items/${c.req.param('itemId')}`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { itemId: c.req.param('itemId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await updateItemHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Delete item
  app.delete('/admin/problem-grid/items/:itemId', async (c) => {
    const event = {
      httpMethod: 'DELETE',
      path: `/admin/problem-grid/items/${c.req.param('itemId')}`,
      headers: {},
      body: '',
      pathParameters: { itemId: c.req.param('itemId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await deleteItemHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Toggle item status
  app.post('/admin/problem-grid/items/:itemId/toggle', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = {
      httpMethod: 'POST',
      path: `/admin/problem-grid/items/${c.req.param('itemId')}/toggle`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { itemId: c.req.param('itemId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await toggleStatusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Reorder items
  app.post('/admin/problem-grid/items/reorder', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/admin/problem-grid/items/reorder',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'problem-grid-admin', functionVersion: '$LATEST' };
    const result = await reorderHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
