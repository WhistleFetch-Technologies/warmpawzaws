/**
 * ============================================================================
 * COMMUNITY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles community features:
 * - Get community posts
 * - Create posts
 * - Like/unlike posts
 * - Comment on posts
 * - Delete posts
 * 
 * Date: 2026-01-07
 * Phase 1: Mobile Improvements
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, deleteRows, query } from '../database/rds-connection';

export function registerCommunityEndpoints(app: Hono) {
  /**
   * GET /community/posts
   * Get community posts
   */
  app.get("/community/posts", async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const posts = await query(
        `SELECT 
          p.*,
          c.first_name || ' ' || c.last_name as author_name,
          c.photo as author_photo,
          (SELECT COUNT(*) FROM community_likes WHERE post_id = p.id) as likes_count,
          (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id) as comments_count,
          EXISTS(SELECT 1 FROM community_likes WHERE post_id = p.id AND customer_id = $1) as is_liked
         FROM community_posts p
         LEFT JOIN customers c ON p.customer_id = c.id
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [customerId || null, limit, offset]
      );

      return c.json({
        success: true,
        posts: posts.rows,
        count: posts.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching community posts:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /community/posts
   * Create a new post
   */
  app.post("/community/posts", async (c) => {
    try {
      const { customerId, content, images, petId } = await c.req.json();

      if (!customerId || !content) {
        return c.json({ error: 'customerId and content are required' }, 400);
      }

      const post = await insert('community_posts', {
        customer_id: customerId,
        content,
        images: images || [],
        pet_id: petId || null,
        created_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        post: post[0],
        message: 'Post created successfully',
      });
    } catch (error: any) {
      console.error('Error creating post:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /community/posts/:postId/like
   * Like a post
   */
  app.post("/community/posts/:postId/like", async (c) => {
    try {
      const { postId } = c.req.param();
      const { customerId } = await c.req.json();

      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }

      // Check if already liked
      const existing = await select('community_likes', { post_id: postId, customer_id: customerId });
      
      if (existing.length > 0) {
        return c.json({ success: true, message: 'Already liked' });
      }

      await insert('community_likes', {
        post_id: postId,
        customer_id: customerId,
        created_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Post liked successfully',
      });
    } catch (error: any) {
      console.error('Error liking post:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /community/posts/:postId/like
   * Unlike a post
   */
  app.delete("/community/posts/:postId/like", async (c) => {
    try {
      const { postId } = c.req.param();
      const customerId = c.req.query('customerId');

      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }

      await deleteRows('community_likes', { post_id: postId, customer_id: customerId });

      return c.json({
        success: true,
        message: 'Post unliked successfully',
      });
    } catch (error: any) {
      console.error('Error unliking post:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /community/posts/:postId/comments
   * Comment on a post
   */
  app.post("/community/posts/:postId/comments", async (c) => {
    try {
      const { postId } = c.req.param();
      const { customerId, comment } = await c.req.json();

      if (!customerId || !comment) {
        return c.json({ error: 'customerId and comment are required' }, 400);
      }

      const commentRecord = await insert('community_comments', {
        post_id: postId,
        customer_id: customerId,
        comment,
        created_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        comment: commentRecord[0],
        message: 'Comment added successfully',
      });
    } catch (error: any) {
      console.error('Error adding comment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /community/posts/:postId/comments
   * Get comments for a post
   */
  app.get("/community/posts/:postId/comments", async (c) => {
    try {
      const { postId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50', 10);

      const comments = await query(
        `SELECT 
          c.*,
          cust.first_name || ' ' || cust.last_name as author_name,
          cust.photo as author_photo
         FROM community_comments c
         LEFT JOIN customers cust ON c.customer_id = cust.id
         WHERE c.post_id = $1
         ORDER BY c.created_at ASC
         LIMIT $2`,
        [postId, limit]
      );

      return c.json({
        success: true,
        comments: comments.rows,
        count: comments.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching comments:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /community/posts/:postId
   * Delete a post
   */
  app.delete("/community/posts/:postId", async (c) => {
    try {
      const { postId } = c.req.param();
      const customerId = c.req.query('customerId');

      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }

      // Verify ownership
      const posts = await select('community_posts', { id: postId, customer_id: customerId });
      if (posts.length === 0) {
        return c.json({ error: 'Post not found or unauthorized' }, 404);
      }

      // Delete likes and comments first
      await deleteRows('community_likes', { post_id: postId });
      await deleteRows('community_comments', { post_id: postId });
      await deleteRows('community_posts', { id: postId });

      return c.json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting post:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

